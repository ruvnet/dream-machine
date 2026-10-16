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
import math
import threading


def validate_text(text, max_tokens):
    from leash_probe import require
    require(type(text) is str and 0 < len(text) <= 16384, "bounded prompt required")
    require(type(max_tokens) is int and 1 <= max_tokens <= 512, "bounded token count required")


class ActivationWorker:
    """Resident, sequential CPU model worker. No server or credential binding.

    Startup verifies bytes once. Every request checks the materialized artifact
    inventory for changes and records full warm request time, not only forward.
    A parent process must enforce a hard process timeout for untrusted workloads.
    """
    def __init__(self, model_path, revision, layer, *, max_tokens=256, threads=2,
                 max_requests=256, max_model_bytes=512 * 1024 * 1024, chat=True, precision="float32"):
        from leash_probe import require, identity, digest
        start = time.perf_counter_ns()
        validate_text("setup", max_tokens)
        require(type(threads) is int and 1 <= threads <= 4, "invalid CPU thread limit")
        require(type(max_requests) is int and 1 <= max_requests <= 1000, "invalid request ceiling")
        require(type(max_model_bytes) is int and 0 < max_model_bytes <= 1024 * 1024 * 1024,
                "invalid model byte ceiling")
        require(type(chat) is bool, "explicit prompt format required")
        require(precision in ("float32", "dynamic-int8"), "invalid precision")
        forbidden = [k for k in os.environ if any(s in k.upper() for s in ("TOKEN", "SECRET", "PASSWORD", "API_KEY"))]
        require(not forbidden, "run the activation child with a credential-free environment")
        path = Path(model_path).resolve(strict=True)
        require(path.is_dir(), "local model directory required")
        require(any(path.glob("*.safetensors")), "safetensors weights required")
        artifacts, inventory, total = {}, {}, 0
        for p in path.rglob("*"):
            require(not p.is_symlink(), "model must be a materialized, reviewed directory")
            if p.is_file():
                stat = p.stat(); total += stat.st_size
                require(total <= max_model_bytes, "model exceeds CPU experiment size ceiling")
                h = hashlib.sha256()
                with p.open("rb") as stream:
                    for chunk in iter(lambda: stream.read(1024 * 1024), b""):
                        h.update(chunk)
                name = str(p.relative_to(path))
                artifacts[name] = h.hexdigest()
                inventory[name] = (stat.st_size, stat.st_mtime_ns, stat.st_ino)
        config = json.loads((path / "config.json").read_text())
        for name, ceiling in (("hidden_size", 1024), ("num_hidden_layers", 32), ("vocab_size", 100000)):
            require(type(config.get(name)) is int and 0 < config[name] <= ceiling,
                    "model architecture exceeds reviewed CPU limits")
        require(type(layer) is int and 0 <= layer <= config["num_hidden_layers"], "invalid hidden layer")
        import torch
        from transformers import AutoModelForCausalLM, AutoTokenizer
        torch.set_num_threads(threads)
        self.identity = identity({"model": path.name + ("/chat" if chat else "") +
                                  ("/dynamic-int8" if precision == "dynamic-int8" else ""), "revision": revision,
                                  "artifactDigest": digest(artifacts), "layer": layer,
                                  "position": "last_prompt_token"})
        self.tokenizer = AutoTokenizer.from_pretrained(str(path), local_files_only=True, trust_remote_code=False)
        self.model = AutoModelForCausalLM.from_pretrained(str(path), local_files_only=True,
                                                       trust_remote_code=False, use_safetensors=True).eval()
        if precision == "dynamic-int8":
            self.model = torch.ao.quantization.quantize_dynamic(
                self.model, {torch.nn.Linear}, dtype=torch.qint8, inplace=False).eval()
        self.torch, self.path, self.inventory, self.artifacts = torch, path, inventory, artifacts
        self.max_tokens, self.max_requests, self.requests = max_tokens, max_requests, 0
        self.chat, self.layer, self.closed = chat, layer, False
        self.lock = threading.Lock()
        self.startupMs = (time.perf_counter_ns() - start) / 1e6

    def _check_inventory(self):
        from leash_probe import require
        current = {}
        for p in self.path.rglob("*"):
            require(not p.is_symlink(), "model artifact changed")
            if p.is_file():
                s = p.stat(); current[str(p.relative_to(self.path))] = (s.st_size, s.st_mtime_ns, s.st_ino)
        require(current == self.inventory, "model artifact changed; reload and recalibrate")

    def infer(self, text, max_new_tokens=32):
        from leash_probe import require
        validate_text(text, self.max_tokens)
        require(type(max_new_tokens) is int and 0 <= max_new_tokens <= 64, "invalid generation ceiling")
        request_start = time.perf_counter_ns()
        # Nonblocking: one worker cannot accumulate an unbounded internal queue.
        require(self.lock.acquire(blocking=False), "worker busy")
        try:
            require(not self.closed, "worker closed")
            require(self.requests < self.max_requests, "request ceiling exhausted")
            self._check_inventory()
            prompt = self.tokenizer.apply_chat_template([{"role": "user", "content": text}],
                        tokenize=False, add_generation_prompt=True) if self.chat else text
            inputs = self.tokenizer(prompt, return_tensors="pt", truncation=False)
            require(0 < inputs["input_ids"].shape[1] <= self.max_tokens, "prompt exceeds token budget")
            self.requests += 1
            forward_start = time.perf_counter_ns()
            first_forward = []
            def mark_first(_module, _args, _result):
                if not first_forward:
                    first_forward.append((time.perf_counter_ns() - forward_start) / 1e6)
            hook = self.model.register_forward_hook(mark_first)
            try:
                with self.torch.inference_mode():
                    if max_new_tokens:
                        out = self.model.generate(**inputs, max_new_tokens=max_new_tokens,
                              do_sample=False, use_cache=True, return_dict_in_generate=True,
                              output_hidden_states=True, pad_token_id=self.tokenizer.eos_token_id)
                        hidden = out.hidden_states[0][self.layer]
                        generated = out.sequences[0, inputs["input_ids"].shape[1]:]
                        response = self.tokenizer.decode(generated, skip_special_tokens=True)
                        count = len(generated)
                    else:
                        out = self.model(**inputs, output_hidden_states=True, use_cache=False)
                        hidden = out.hidden_states[self.layer]
                        response, count = "", 0
            finally:
                hook.remove()
            activation = hidden[0, -1].float().cpu().tolist()
            require(all(math.isfinite(v) for v in activation), "non-finite model output")
            return {"schema": 1, "identity": dict(self.identity), "activation": activation,
                    "artifactDigests": dict(self.artifacts), "text": response, "generatedTokens": count,
                    "promptTokens": int(inputs["input_ids"].shape[1]),
                    "activationMs": first_forward[0],
                    "requestMs": (time.perf_counter_ns() - request_start) / 1e6,
                    "startupMs": self.startupMs, "cacheHit": False,
                    "promptDigest": hashlib.sha256(text.encode()).hexdigest(),
                    "stage": "RESIDENT_MODEL_INTERFACE_ONLY", "promotionAuthorized": False}
        finally:
            self.lock.release()

    def close(self):
        with self.lock:
            if not self.closed:
                del self.model, self.tokenizer
                self.closed = True


def extract(model_path, revision, text, layer, max_tokens=256):
    """Compatibility one-shot extraction; persistent callers use ActivationWorker."""
    from leash_probe import require, identity, digest
    validate_text(text, max_tokens)
    worker = ActivationWorker(model_path, revision, layer, max_tokens=max_tokens, chat=False)
    try:
        out = worker.infer(text, max_new_tokens=0)
        out["stage"] = "ACTIVATION_EXTRACTION_ONLY"
        return out
    finally:
        worker.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("model_path")
    parser.add_argument("revision")
    parser.add_argument("--layer", type=int, required=True)
    parser.add_argument("--serve", action="store_true", help="bounded stdin/stdout JSONL worker, no network listener")
    parser.add_argument("--max-requests", type=int, default=128)
    args = parser.parse_args()
    if args.serve:
        worker = ActivationWorker(args.model_path, args.revision, args.layer, max_requests=args.max_requests)
        try:
            for _ in range(args.max_requests):
                raw = sys.stdin.readline(32769)
                if not raw:
                    break
                if len(raw) > 32768 or not raw.endswith("\n"):
                    raise ValueError("invalid bounded JSONL request")
                try:
                    item = json.loads(raw)
                    out = worker.infer(item["text"], item.get("max_new_tokens", 0))
                except (ValueError, KeyError, TypeError):
                    out = {"error": "INVALID_REQUEST", "promotionAuthorized": False}
                print(json.dumps(out, allow_nan=False), flush=True)
        finally:
            worker.close()
        raise SystemExit(0)
    raw = sys.stdin.read(32769)
    if len(raw) > 32768:
        raise ValueError("input too large")
    item = json.loads(raw)
    print(json.dumps(extract(args.model_path, args.revision, item["text"], args.layer), allow_nan=False))
