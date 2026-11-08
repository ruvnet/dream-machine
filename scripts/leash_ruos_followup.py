#!/usr/bin/env python3
"""Bounded training-only prompt/CPU search; strict independent confirmation.

No tokens, providers, model downloads, model text execution or promotion.
This tests format compatibility, not useful learned routing or weight training.
"""
import argparse
import hashlib
import json
from pathlib import Path
import time

import numpy as np

from leash_activations import ActivationWorker
from leash_workloads import grade, make_manifest


def prompt(task, variant):
    text = task["prompt"]
    if variant == 0:
        return text
    if variant == 1:
        example = ('{"tool":"read_file","args":{"path":"lib/example.py"}}'
                   if task["family"] == "tool_json" else '{"replacement":"+"}')
        return "Output only JSON, for example " + example + ". Never output source code.\n" + text
    if variant != 2:
        raise ValueError("unknown frozen template")
    if task["family"] == "tool_json":
        request = text.split("Request: ", 1)[1]
        return ('Case ' + task["id"] + '\nRead file lib/a.py => {"tool":"read_file","args":{"path":"lib/a.py"}}\n'
                'List directory lib => {"tool":"list_directory","args":{"path":"lib"}}\n'
                + request + ' =>')
    meaning = text.split("The function must return the ", 1)[1].split(". Current source:", 1)[0]
    return ('Case ' + task["id"] + '\nsum of a and b => {"replacement":"+"}\n'
            'a minus b => {"replacement":"-"}\n'
            'product of a and b => {"replacement":"*"}\n'
            'integer floor quotient of a divided by b => {"replacement":"//"}\n'
            + meaning + ' =>')


def protocol():
    train = make_manifest(261017)["tasks"][:8]
    confirmation = make_manifest(261018)["tasks"][-24:]
    # Exact input separation, including the small repair functions.
    for split, tasks in (("training", train), ("confirmation", confirmation)):
        for i, task in enumerate(tasks):
            task["id"] = f"ruos-v2-{split}-{i}"
            task["split"] = split
            if task["family"] == "repository_repair":
                task["prompt"] = task["prompt"].replace("calculate(a, b)", f"calculate_{split}_{i}(a, b)")
    return {"schema": 2, "training": train, "confirmation": confirmation,
            "templates": [0, 1, 2], "outputTokens": 32, "activationSamples": 24,
            "evidence": "PUBLIC_SYNTHETIC_FORMAT_COMPATIBILITY_ONLY"}


def infer(worker, task, variant):
    out = worker.infer(prompt(task, variant), max_new_tokens=32)
    return {"id": task["id"], "family": task["family"], "variant": variant,
            "passed": grade(task, out["text"]), "text": out["text"],
            **{k: out[k] for k in ("identity", "promptTokens", "generatedTokens", "requestMs", "activationMs")}}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("model")
    parser.add_argument("evidence")
    args = parser.parse_args()
    root = Path(args.evidence)
    root.mkdir(parents=True, exist_ok=False)
    spec = protocol()
    with (root / "protocol.json").open("x") as stream:
        json.dump(spec, stream, indent=2, allow_nan=False)
    start = time.perf_counter_ns()
    workers = []
    try:
        baseline = ActivationWorker(args.model, "12fd25f77366fa6b3b4b768ec3050bf629380bac", 15,
                                    max_requests=128)
        workers.append(baseline)
        if baseline.artifacts["model.safetensors"] != "5af571cbf074e6d21a03528d2330792e532ca608f24ac70a143f6b369968ab8c":
            raise ValueError("model provenance mismatch")
        training = [[infer(baseline, task, variant) for task in spec["training"]] for variant in spec["templates"]]
        # Stable selection on training only. Ties favor the simplest unchanged template.
        selected = max(spec["templates"], key=lambda v: sum(r["passed"] for r in training[v]))
        optimized = ActivationWorker(args.model, "12fd25f77366fa6b3b4b768ec3050bf629380bac", 15,
                                     max_requests=100, precision="dynamic-int8")
        workers.append(optimized)
        quant_training = [infer(optimized, task, selected) for task in spec["training"]]
        timing = {}
        for name, worker in (("float32", baseline), ("dynamic-int8", optimized)):
            for i in range(3):
                worker.infer(f"Public parser warmup {i}.", max_new_tokens=0)
            samples = [worker.infer(f"Explain JSON parser validation, public case {i}.", max_new_tokens=0)
                       for i in range(spec["activationSamples"])]
            timing[name] = {"samples": len(samples), "requestMs": [r["requestMs"] for r in samples],
                            "p95Ms": float(np.quantile([r["requestMs"] for r in samples], .95)),
                            "startupMs": worker.startupMs}
        use_quant = (sum(r["passed"] for r in quant_training) >= sum(r["passed"] for r in training[selected])
                     and timing["dynamic-int8"]["p95Ms"] < timing["float32"]["p95Ms"])
        candidate = optimized if use_quant else baseline
        frozen = {"template": selected, "precision": "dynamic-int8" if use_quant else "float32"}
        (root / "selected.json").write_text(json.dumps(frozen, indent=2) + "\n")
        pairs = []
        for i, task in enumerate(spec["confirmation"]):
            order = (("baseline", baseline, 0), ("candidate", candidate, selected))
            if i % 2:
                order = order[::-1]
            pair = {name: infer(worker, task, variant) for name, worker, variant in order}
            pairs.append(pair)
        families = {}
        for family in ("tool_json", "repository_repair"):
            rows = [r for r in pairs if r["baseline"]["family"] == family]
            families[family] = {"tasks": len(rows),
                                **{n: sum(r[n]["passed"] for r in rows) for n in ("baseline", "candidate")}}
        report = {"schema": 2, "scope": "synthetic format compatibility and CPU optimization only",
                  "training": training, "quantizedTraining": quant_training, "selected": frozen,
                  "timing": timing, "confirmation": pairs, "families": families,
                  "protocolSha256": hashlib.sha256((root / "protocol.json").read_bytes()).hexdigest(),
                  "sourceSha256": {p.name: hashlib.sha256(p.read_bytes()).hexdigest() for p in
                                   (Path(__file__), Path(__file__).with_name("leash_activations.py"),
                                    Path(__file__).with_name("leash_workloads.py"))},
                  "formatGate": all(f["candidate"] / f["tasks"] >= .9 and f["candidate"] >= f["baseline"]
                                    for f in families.values()),
                  "activationLatencyGate": timing[frozen["precision"]]["p95Ms"] < 150,
                  "providerCalls": 0, "billedCost": None, "promotionAuthorized": False,
                  "wallMs": (time.perf_counter_ns() - start) / 1e6,
                  "limits": ["Public toy tasks, not secret holdouts or representative repository repairs.",
                             "Prompt selection is not model-weight training or demonstrated learned routing.",
                             "Activation timing excludes transport, completion generation and action queueing.",
                             "No automatic drift detector or production permission integration.",
                             "Local CPU and idle costs unmetered; full monetary gate remains unknown."]}
        (root / "result.json").write_text(json.dumps(report, indent=2, allow_nan=False) + "\n")
        print(json.dumps({k: report[k] for k in ("selected", "families", "formatGate", "activationLatencyGate", "wallMs")}), flush=True)
        print(json.dumps({"timing": {n: {k: v for k, v in t.items() if k != "requestMs"} for n, t in timing.items()}}), flush=True)
    finally:
        for worker in workers:
            worker.close()


if __name__ == "__main__":
    main()
