#!/usr/bin/env python3
"""Independently regrade saved public CPU evidence, without inference or secrets."""
import argparse
import hashlib
import json
import math
from pathlib import Path

import numpy as np

from leash_ruos_followup import protocol
from leash_workloads import grade


def verify(root):
    root = Path(root)
    spec = json.loads((root / "protocol.json").read_text())
    report = json.loads((root / "result.json").read_text())
    if spec != protocol() or report["protocolSha256"] != hashlib.sha256((root / "protocol.json").read_bytes()).hexdigest():
        raise ValueError("protocol changed")
    if set(report["sourceSha256"]) != {"leash_ruos_followup.py", "leash_activations.py", "leash_workloads.py"}:
        raise ValueError("source inventory changed")
    for name, expected in report["sourceSha256"].items():
        if Path(name).name != name or hashlib.sha256(Path(__file__).with_name(name).read_bytes()).hexdigest() != expected:
            raise ValueError("source changed")
    checks = 0
    def check(rows, tasks, variant):
        nonlocal checks
        if len(rows) != len(tasks):
            raise ValueError("incomplete outcomes")
        for row, task in zip(rows, tasks):
            if row["id"] != task["id"] or row["family"] != task["family"] or row["variant"] != variant:
                raise ValueError("task mismatch")
            if type(row["passed"]) is not bool or row["passed"] != grade(task, row["text"]):
                raise ValueError("grade changed")
            if not 0 < row["promptTokens"] <= 256 or not 0 <= row["generatedTokens"] <= 32:
                raise ValueError("token ceiling exceeded")
            for key in ("requestMs", "activationMs"):
                if not math.isfinite(row[key]) or row[key] < 0:
                    raise ValueError("invalid measured timing")
            if row["requestMs"] < row["activationMs"]:
                raise ValueError("partial request timing")
            checks += 1
    if len(report["training"]) != 3:
        raise ValueError("incomplete template trials")
    for variant, rows in enumerate(report["training"]):
        check(rows, spec["training"], variant)
    selected = max(range(3), key=lambda v: sum(r["passed"] for r in report["training"][v]))
    check(report["quantizedTraining"], spec["training"], selected)
    for name, timing in report["timing"].items():
        if len(timing["requestMs"]) != 24 or not all(math.isfinite(x) and x > 0 for x in timing["requestMs"]):
            raise ValueError("invalid latency samples")
        if not math.isclose(timing["p95Ms"], float(np.quantile(timing["requestMs"], .95))):
            raise ValueError("latency summary changed")
    quantized = (sum(r["passed"] for r in report["quantizedTraining"]) >=
                 sum(r["passed"] for r in report["training"][selected]) and
                 report["timing"]["dynamic-int8"]["p95Ms"] < report["timing"]["float32"]["p95Ms"])
    expected = {"template": selected, "precision": "dynamic-int8" if quantized else "float32"}
    if expected != report["selected"] or expected != json.loads((root / "selected.json").read_text()):
        raise ValueError("training-only selection changed")
    if len(report["confirmation"]) != len(spec["confirmation"]):
        raise ValueError("incomplete confirmation")
    for name, variant in (("baseline", 0), ("candidate", selected)):
        check([r[name] for r in report["confirmation"]], spec["confirmation"], variant)
    families = {}
    for family in ("tool_json", "repository_repair"):
        rows = [r for r in report["confirmation"] if r["baseline"]["family"] == family]
        families[family] = {"tasks": len(rows), **{name: sum(r[name]["passed"] for r in rows)
                                                for name in ("baseline", "candidate")}}
    if families != report["families"] or report["providerCalls"] != 0 or report["promotionAuthorized"] is not False:
        raise ValueError("summary or permission changed")
    format_gate = all(f["candidate"] / f["tasks"] >= .9 and f["candidate"] >= f["baseline"] for f in families.values())
    latency_gate = report["timing"][expected["precision"]]["p95Ms"] < 150
    if report["formatGate"] != format_gate or report["activationLatencyGate"] != latency_gate:
        raise ValueError("gate changed")
    return {"verified": True, "outcomesRegraded": checks, "selected": expected, "families": families,
            "formatGate": format_gate, "activationLatencyGate": latency_gate,
            "timingP95Ms": {k: v["p95Ms"] for k, v in report["timing"].items()},
            "reportSha256": hashlib.sha256((root / "result.json").read_bytes()).hexdigest(),
            "promotionAuthorized": False}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("evidence")
    print(json.dumps(verify(parser.parse_args().evidence), allow_nan=False))
