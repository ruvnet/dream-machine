#!/usr/bin/env python3
"""Bounded local-only benchmark. Outputs are evidence, never promotion authority."""
import argparse
import hashlib
import json
from pathlib import Path
import platform
import time

import numpy as np

from leash_activations import ActivationWorker
from leash_workloads import freeze_manifest, run


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("weak_path")
    parser.add_argument("strong_path")
    parser.add_argument("evidence_dir")
    args = parser.parse_args()
    root = Path(args.evidence_dir)
    root.mkdir(parents=True, exist_ok=False)
    manifest_path = root / "manifest.json"
    manifest = freeze_manifest(manifest_path)
    started = time.perf_counter_ns()
    weak = strong = None
    try:
        weak = ActivationWorker(args.weak_path, "12fd25f77366fa6b3b4b768ec3050bf629380bac", 15,
                                max_requests=100)
        strong = ActivationWorker(args.strong_path, "a10cc1512eabd3dde888204e902eca88bddb4951", 16,
                                  max_requests=64, max_model_bytes=1024 ** 3)
        expected = "e6bffe7435d7ddc10fd3b9a9efd429dafbacb1cb17015fb5562664e7532bf86e"
        if strong.artifacts.get("model.safetensors") != expected:
            raise ValueError("comparison model does not match pinned Hub weight hash")
        if weak.artifacts.get("model.safetensors") != "5af571cbf074e6d21a03528d2330792e532ca608f24ac70a143f6b369968ab8c":
            raise ValueError("weak model does not match pinned Hub weight hash")
        # Public prompts distinct from workload protocol. No response caching.
        for i in range(3):
            weak.infer(f"Explain what a unit test checks, example {i}.", max_new_tokens=0)
        samples = [weak.infer(f"Explain how a parser validates JSON input, example {i}.",
                              max_new_tokens=0) for i in range(24)]
        first = weak.infer("Return exactly the number 4.", max_new_tokens=0)
        second = weak.infer("Return exactly the number 4.", max_new_tokens=0)
        warm = {"samples": 24, "warmups": 3, "mode": "prefill_activation_only",
                "requestMs": [r["requestMs"] for r in samples],
                "p50RequestMs": float(np.median([r["requestMs"] for r in samples])),
                "p95RequestMs": float(np.quantile([r["requestMs"] for r in samples], .95)),
                "includes": ["artifact stat checks", "chat formatting", "tokenization", "model forward", "activation conversion"],
                "excludes": ["startup", "JSONL transport", "completion generation"],
                "queue": "busy requests rejected, no internal backlog",
                "cacheHits": sum(r["cacheHit"] for r in samples),
                "repeatActivationExact": first["activation"] == second["activation"]}
        (root / "warm.json").write_text(json.dumps(warm, indent=2, allow_nan=False) + "\n")
        report = run(weak, strong, manifest_path)
        report.update(residentStartupMs={"weak": weak.startupMs, "strong": strong.startupMs},
                      warmActivation=warm,
                      experimentWallMs=(time.perf_counter_ns() - started) / 1e6,
                      environment={"python": platform.python_version(), "platform": platform.platform(),
                                   "threadsPerWorker": 2, "device": "existing local CPU"},
                      inferenceProviderCalls=0, billedCost=None,
                      sourceDigest={p.name: hashlib.sha256(p.read_bytes()).hexdigest()
                                    for p in [Path(__file__), Path(__file__).with_name("leash_activations.py"),
                                              Path(__file__).with_name("leash_workloads.py"),
                                              Path(__file__).with_name("leash_probe.py")]})
        (root / "result.json").write_text(json.dumps(report, indent=2, allow_nan=False) + "\n")
        print(json.dumps({"verdict": report["verdict"], "outcomeCounts": report["outcomeCounts"],
                          "warm": warm, "manifestDigest": manifest["manifestDigest"],
                          "wallMs": report["experimentWallMs"]}, allow_nan=False), flush=True)
    finally:
        for worker in (weak, strong):
            if worker is not None:
                worker.close()


if __name__ == "__main__":
    main()
