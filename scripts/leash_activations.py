#!/usr/bin/env python3
"""Extract a last-prompt-token activation from a reviewed local causal model.

No download, provider call, pickle weights or remote model code is permitted.
Input stdin contains only public/synthetic prompt text, never labels or secrets.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import sys
import time


def extract(model_path, revision, text, layer, max_tokens=256):
    from leash_probe import require, identity, digest
    require(type(text) is str and 0 < len(text) <= 16384, "bounded prompt required")
    require(type(max_tokens) is int and 1 <= max_tokens <= 512, "bounded token count required")
    path = Path(model_path).resolve(strict=True)
    require(path.is_dir(), "local model directory required")
    # Sanitize before importing/loading a model; do not use provider credentials.
    forbidden = [k for k in os.environ if any(s in k.upper() for s in ("TOKEN", "SECRET", "PASSWORD", "API_KEY"))]
    require(not forbidden, "run the activation child with a credential-free environment")
    require(any(path.glob("*.safetensors")), "safetensors weights required")
    artifacts = {}
    total = 0
    for p in path.rglob("*"):
        require(not p.is_symlink(), "model must be a materialized, reviewed directory")
        if p.is_file():
            total += p.stat().st_size
            require(total <= 512 * 1024 * 1024, "model exceeds CPU experiment size ceiling")
            h = hashlib.sha256()
            with p.open("rb") as stream:
                for chunk in iter(lambda: stream.read(1024 * 1024), b""):
                    h.update(chunk)
            artifacts[str(p.relative_to(path))] = h.hexdigest()
    config = json.loads((path / "config.json").read_text())
    for name, ceiling in (("hidden_size", 1024), ("num_hidden_layers", 32), ("vocab_size", 100000)):
        require(type(config.get(name)) is int and 0 < config[name] <= ceiling,
                "model architecture exceeds reviewed CPU limits")
    import torch
    from transformers import AutoModelForCausalLM, AutoTokenizer
    model_identity = identity({"model": path.name, "revision": revision,
                               "artifactDigest": digest(artifacts),
                               "layer": layer, "position": "last_prompt_token"})
    torch.set_num_threads(2)
    tokenizer = AutoTokenizer.from_pretrained(str(path), local_files_only=True, trust_remote_code=False)
    model = AutoModelForCausalLM.from_pretrained(str(path), local_files_only=True,
                                               trust_remote_code=False, use_safetensors=True).eval()
    try:
        inputs = tokenizer(text, return_tensors="pt", truncation=False)
        require(0 < inputs["input_ids"].shape[1] <= max_tokens, "prompt exceeds token budget")
        start = time.perf_counter_ns()
        with torch.inference_mode():
            outputs = model(**inputs, output_hidden_states=True, use_cache=False)
        require(outputs.hidden_states is not None and layer < len(outputs.hidden_states),
                "requested hidden layer unavailable")
        activation = outputs.hidden_states[layer][0, -1].float().cpu().tolist()
        require(all(__import__("math").isfinite(v) for v in activation), "non-finite model output")
        # Expose prompt hash, not the prompt; never label this a task-success result.
        return {"schema": 1, "identity": model_identity, "activation": activation,
                "artifactDigests": artifacts,
                "activationMs": (time.perf_counter_ns() - start) / 1e6,
                "promptDigest": hashlib.sha256(text.encode()).hexdigest(),
                "stage": "ACTIVATION_EXTRACTION_ONLY", "promotionAuthorized": False}
    finally:
        del model


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("model_path")
    parser.add_argument("revision")
    parser.add_argument("--layer", type=int, required=True)
    args = parser.parse_args()
    raw = sys.stdin.read(32769)
    if len(raw) > 32768:
        raise ValueError("input too large")
    item = json.loads(raw)
    print(json.dumps(extract(args.model_path, args.revision, item["text"], args.layer), allow_nan=False))
