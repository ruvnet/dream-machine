#!/usr/bin/env python3
"""Offline LEASH-inspired initial routing. Never grants execution authority.

Runtime scores are advisory only: paired complete-task traces cannot establish
the counterfactual outcome of a mid-task takeover or shadow intervention.
"""
import hashlib
import json
import math
import re
import time
from pathlib import Path

import numpy as np

MAX_ROWS = 10000
MAX_DIM = 1024


def require(ok, message):
    if not ok:
        raise ValueError(message)


def digest(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, allow_nan=False,
                                     separators=(",", ":")).encode()).hexdigest()


def vector(value, dimension=None):
    require(type(value) is list and 0 < len(value) <= MAX_DIM, "invalid vector size")
    require(all(type(v) in (int, float) and math.isfinite(v) and abs(v) <= 1e12
                for v in value), "non-finite or excessive activation")
    require(dimension is None or len(value) == dimension, "activation dimension mismatch")
    return np.array(value, dtype=np.float64)


def identity(value):
    require(type(value) is dict and set(value) == {"model", "revision", "artifactDigest", "layer", "position"},
            "invalid model identity")
    require(type(value["model"]) is str and 0 < len(value["model"]) <= 200, "model required")
    require(type(value["revision"]) is str and re.fullmatch(r"[a-f0-9]{40}", value["revision"]),
            "exact model revision required")
    require(type(value["artifactDigest"]) is str and re.fullmatch(r"[a-f0-9]{64}", value["artifactDigest"]),
            "model artifact inventory digest required")
    require(type(value["layer"]) is int and value["layer"] >= 0, "explicit layer required")
    require(value["position"] == "last_prompt_token", "only initial-query routing supported")
    return dict(value)


def rows(value):
    require(type(value) is list and 4 <= len(value) <= MAX_ROWS, "invalid row count")
    seen = set()
    for row in value:
        require(type(row) is dict, "invalid row")
        for key in ("id", "family"):
            require(type(row.get(key)) is str and 0 < len(row[key]) <= 200, "row identity required")
        require(row["id"] not in seen, "duplicate task id")
        seen.add(row["id"])
        vector(row.get("activation"))
        require(type(row.get("weakSuccess")) is bool, "weak outcome must be boolean")
    return value


def fit(reference, model_identity, ridge=0.01):
    """Shared within-class covariance, regularized once; O(d) online score."""
    reference = rows(reference)
    model_identity = identity(model_identity)
    require(type(ridge) in (int, float) and math.isfinite(ridge) and ridge > 0,
            "positive finite ridge required")
    dim = len(reference[0]["activation"])
    x = np.stack([vector(r["activation"], dim) for r in reference])
    y = np.array([r["weakSuccess"] for r in reference])
    require(y.sum() >= 2 and (~y).sum() >= 2, "two references per outcome required")
    mean, scale = x.mean(0), x.std(0)
    scale = np.maximum(scale, 1e-8)
    z = (x - mean) / scale
    passed, failed = z[y].mean(0), z[~y].mean(0)
    residual = z - np.where(y[:, None], passed, failed)
    covariance = residual.T @ residual / (len(x) - 2) + ridge * np.eye(dim)
    delta = np.linalg.solve(covariance, failed - passed)
    # d_pass^2 - d_fail^2: quadratic terms cancel exactly.
    weight = 2 * delta / scale
    bias = float(-2 * mean / scale @ delta - (passed + failed) @ delta)
    require(np.isfinite(weight).all() and math.isfinite(bias), "unstable fitted bank")
    return {"schema": 1, "identity": model_identity, "weight": weight.tolist(), "bias": bias,
            "referenceIds": sorted(r["id"] for r in reference),
            "referenceDigest": digest(reference), "ridge": ridge}


def score(bank, activation, model_identity):
    require(identity(model_identity) == bank["identity"], "model identity changed; recalibrate")
    w = vector(bank["weight"])
    bias = bank["bias"]
    require(type(bias) in (int, float) and math.isfinite(bias), "invalid bank bias")
    result = float(vector(activation, len(w)) @ w + bias)
    require(math.isfinite(result), "non-finite score")
    return result


def calibrate(bank, calibration, model_identity, fraction=0.5):
    calibration = rows(calibration)
    require(not set(bank["referenceIds"]) & {r["id"] for r in calibration}, "split leakage")
    require(type(fraction) in (int, float) and math.isfinite(fraction) and 0 < fraction < 1,
            "invalid escalation budget")
    scores = [score(bank, r["activation"], model_identity) for r in calibration]
    threshold = float(np.quantile(scores, 1 - fraction, method="higher"))
    return {"threshold": threshold, "fraction": fraction,
            "calibrationIds": sorted(r["id"] for r in calibration),
            "calibrationDigest": digest(calibration)}


def decide(bank, calibration, activation, model_identity, *, permitted, drift=False):
    require(type(permitted) is bool and type(drift) is bool, "explicit trusted gate required")
    if not permitted or drift:
        return {"action": "abstain", "reason": "permission" if not permitted else "drift",
                "authorized": False}
    threshold = calibration["threshold"]
    require(type(threshold) in (int, float) and math.isfinite(threshold), "invalid threshold")
    s = score(bank, activation, model_identity)
    return {"action": "recommend_strong" if s > threshold else "recommend_weak",
            "score": s, "authorized": False}


def evaluate(bank, calibration, confirmation, model_identity, *, evidence_kind,
             monitor_cost, setup_cost, seed=261016, random_trials=1000):
    """Paired initial routing only; costs must include complete recorded runs.

    A monitor cost is a measured, task-independent cost in the same unit as the
    two route costs, e.g. USD. Unknown full costs must not be encoded as zero.
    Activation extraction latency is supplied per task and included in p95.
    """
    confirmation = rows(confirmation)
    require(evidence_kind in ("synthetic", "paired_real"), "evidence kind required")
    require(type(monitor_cost) in (float, int) and math.isfinite(monitor_cost)
            and monitor_cost >= 0, "known monitor cost required")
    require(type(setup_cost) in (float, int) and math.isfinite(setup_cost)
            and setup_cost >= 0, "known reference/calibration setup cost required")
    require(type(seed) is int and type(random_trials) is int and 1 <= random_trials <= 10000,
            "invalid random control budget")
    used = set(bank["referenceIds"]) | set(calibration["calibrationIds"])
    require(not used & {r["id"] for r in confirmation}, "confirmation split leakage")
    require(len({r["family"] for r in confirmation}) >= 2, "two task families required")
    receipts = []
    for r in confirmation:
        require(type(r.get("strongSuccess")) is bool, "paired strong outcome required")
        for key in ("weakCost", "strongCost", "activationMs"):
            require(type(r.get(key)) in (float, int) and math.isfinite(r[key]) and r[key] >= 0,
                    "known nonnegative cost and activation latency required")
        require(r["strongCost"] > 0, "positive strong cost required")
        start = time.perf_counter_ns()
        decision = decide(bank, calibration, r["activation"], model_identity, permitted=True)
        elapsed = (time.perf_counter_ns() - start) / 1e6
        strong = decision["action"] == "recommend_strong"
        receipts.append({"id": r["id"], "family": r["family"], "decision": decision,
                         "selectedSuccess": r["strongSuccess"] if strong else r["weakSuccess"],
                         "selectedCost": (r["strongCost"] if strong else r["weakCost"]) + monitor_cost,
                         "addedLatencyMs": r["activationMs"] + elapsed})
    families = {}
    rng = np.random.default_rng(seed)
    for family in sorted({r["family"] for r in confirmation}):
        indexes = [i for i, r in enumerate(confirmation) if r["family"] == family]
        rr = [confirmation[i] for i in indexes]
        measured = [receipts[i] for i in indexes]
        require(len({r["weakCost"] for r in rr}) == 1 and len({r["strongCost"] for r in rr}) == 1,
                "cost-matched controls require homogeneous route costs within each family")
        count = sum(r["decision"]["action"] == "recommend_strong" for r in measured)
        random_success, random_cost, fixed_success = [], [], []
        # Exact same number of strong calls in EACH family, not merely in aggregate.
        for _ in range(random_trials):
            selected = set(rng.choice(len(rr), count, replace=False).tolist())
            random_success.append(sum(r["strongSuccess"] if i in selected else r["weakSuccess"]
                                      for i, r in enumerate(rr)) / len(rr))
            random_cost.append(sum((r["strongCost"] if i in selected else r["weakCost"]) + monitor_cost
                                   for i, r in enumerate(rr)))
        fixed_success = sum(r["strongSuccess"] if i < count else r["weakSuccess"]
                            for i, r in enumerate(rr)) / len(rr)
        baseline = sum(r["strongCost"] for r in rr)
        allocated_setup = setup_cost * len(rr) / len(confirmation)
        saving = 1 - (sum(r["selectedCost"] for r in measured) + allocated_setup) / baseline
        completion = sum(r["selectedSuccess"] for r in measured) / len(rr)
        strong_completion = sum(r["strongSuccess"] for r in rr) / len(rr)
        families[family] = {"tasks": len(rr), "strongCalls": count,
                            "completion": completion, "alwaysStrongCompletion": strong_completion,
                            "fixedRoutingCompletion": fixed_success,
                            "randomCompletionMean": float(np.mean(random_success)),
                            "randomCostMean": float(np.mean(random_cost)),
                            "allocatedSetupCost": allocated_setup,
                            "alwaysStrongCost": baseline, "costSavingFraction": saving,
                            "pairedCompletionDifference": completion - strong_completion,
                            "provisionalPointGate": saving >= .15 and completion >= strong_completion - .01}
    deterministic = [{k: v for k, v in r.items() if k != "addedLatencyMs"} for r in receipts]
    return {"schema": 1, "scope": "initial-routing-only", "evidenceKind": evidence_kind,
            "identity": identity(model_identity), "bankDigest": digest(bank),
            "calibrationDigest": digest(calibration), "confirmationDigest": digest(confirmation),
            "seed": seed, "randomTrials": random_trials, "setupCost": setup_cost, "families": families,
            "addedLatencyP95Ms": float(np.quantile([r["addedLatencyMs"] for r in receipts], .95)),
            "decisionDigest": digest(deterministic), "receipts": receipts,
            "verdict": "SYNTHETIC_ONLY" if evidence_kind == "synthetic" else "REQUIRES_INDEPENDENT_REVIEW",
            "promotionAuthorized": False,
            "limits": ["Point estimates are not noninferiority confidence bounds.",
                       "Trace cost provenance and evidence-kind labels require independent verification.",
                       "Random controls match route cost and call count; setup cost is reported separately.",
                       "No mid-task handoff, shadow oversight or automatic drift detection is claimed."]}


def load_json(path):
    require(Path(path).stat().st_size <= 32 * 1024 * 1024, "input too large")
    return json.loads(Path(path).read_text(), parse_constant=lambda _: (_ for _ in ()).throw(ValueError("non-finite JSON")))


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("spec", help="local reference/calibration/confirmation JSON; never sent to a model")
    args = parser.parse_args()
    spec = load_json(args.spec)
    bank = fit(spec["reference"], spec["identity"])
    calibration = calibrate(bank, spec["calibration"], spec["identity"], spec["fraction"])
    result = evaluate(bank, calibration, spec["confirmation"], spec["identity"],
                      evidence_kind=spec["evidenceKind"], monitor_cost=spec["monitorCost"], setup_cost=spec["setupCost"])
    print(json.dumps(result, allow_nan=False, sort_keys=True))
