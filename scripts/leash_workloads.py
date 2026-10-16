#!/usr/bin/env python3
"""Public bounded synthetic tasks, graded against resident model completions.

This module never executes model text, downloads weights, or calls a provider.
Worker names weak/strong identify routes and imply no ordering of capability.
"""
import json
import math
from pathlib import Path
import random
import time

import numpy as np

from leash_probe import calibrate, decide, digest, fit, identity, require, vector

DEFAULT_SEED = 261016
SPLITS = {"reference": 12, "calibration": 8, "confirmation": 16}
OPERATORS = ("+", "-", "*", "//")


def make_manifest(seed=DEFAULT_SEED):
    """Freeze public task IDs, prompts and grading specs before any inference."""
    require(type(seed) is int, "integer seed required")
    rng = random.Random(seed)
    tasks = []
    for split, count in SPLITS.items():
        for index in range(count):
            family = "tool_json" if index % 2 == 0 else "repository_repair"
            task_id = f"{split}-{family}-{index:02d}"
            if family == "tool_json":
                tool = rng.choice(("read_file", "list_directory"))
                path = f"src/module_{rng.randrange(100, 999)}.py" if tool == "read_file" else f"src/package_{rng.randrange(100,999)}"
                action = "Read the file" if tool == "read_file" else "List the directory"
                prompt = ("Return exactly one JSON tool call with keys tool and args. "
                          "Allowed tools: read_file and list_directory. Each takes exactly "
                          "one string argument named path. No prose or markdown. "
                          f"Request: {action} {path}.")
                grading = {"tool": tool, "args": {"path": path}}
            else:
                target = rng.choice(OPERATORS)
                broken = rng.choice([op for op in OPERATORS if op != target])
                meaning = {"+": "sum of a and b", "-": "a minus b", "*": "product of a and b",
                           "//": "integer floor quotient of a divided by b"}[target]
                prompt = ("Select a one-token repair for this small repository function. "
                          "Return exactly one JSON object with the key replacement. "
                          "Its value must be one of +, -, *, //. No prose or markdown. "
                          f"The function must return the {meaning}. "
                          f"Current source: def calculate(a, b): return a {broken} b")
                grading = {"targetOperator": target, "brokenOperator": broken,
                           "cases": [[7, 3], [-5, 2], [6, -4], [0, 5]]}
            tasks.append({"id": task_id, "split": split, "family": family,
                          "prompt": prompt, "grading": grading})
    body = {"schema": 1, "seed": seed, "splitCounts": SPLITS,
            "evidence": "PUBLIC_BOUNDED_SYNTHETIC_TASKS", "tasks": tasks}
    return {**body, "manifestDigest": digest(body)}


def freeze_manifest(path, seed=DEFAULT_SEED):
    """Exclusive creation prevents accidental replacement after seeing outputs."""
    manifest = make_manifest(seed)
    with Path(path).open("x", encoding="utf-8") as stream:
        json.dump(manifest, stream, sort_keys=True, indent=2, allow_nan=False)
        stream.write("\n")
        stream.flush()
        __import__("os").fsync(stream.fileno())
    return manifest


def _strict_json(text):
    def unique(pairs):
        result = {}
        for key, value in pairs:
            if key in result:
                raise ValueError("duplicate JSON key")
            result[key] = value
        return result
    return json.loads(text, object_pairs_hook=unique,
                      parse_constant=lambda _: (_ for _ in ()).throw(ValueError("nonfinite JSON")))


def _trusted_calculate(operator, a, b):
    # Literal trusted operations only. No source compilation, exec or eval.
    if operator == "+":
        return a + b
    if operator == "-":
        return a - b
    if operator == "*":
        return a * b
    if operator == "//":
        return a // b
    raise ValueError("operator outside allowlist")


def grade(task, text):
    """Private-from-request checker; public generated cases are not secret holdouts."""
    if type(text) is not str or len(text) > 16384:
        return False
    try:
        answer = _strict_json(text)
        if task["family"] == "tool_json":
            return (type(answer) is dict and set(answer) == {"tool", "args"}
                    and answer == task["grading"])
        if type(answer) is not dict or set(answer) != {"replacement"}:
            return False
        operator = answer["replacement"]
        if type(operator) is not str or operator not in OPERATORS:
            return False
        return all(_trusted_calculate(operator, a, b) ==
                   _trusted_calculate(task["grading"]["targetOperator"], a, b)
                   for a, b in task["grading"]["cases"])
    except (ValueError, TypeError, KeyError):
        return False


def _validate_receipt(value):
    require(type(value) is dict, "worker must return a receipt")
    identity(value.get("identity"))
    vector(value.get("activation"))
    require(type(value.get("text")) is str and len(value["text"]) <= 16384,
            "bounded completion text required")
    for key in ("activationMs", "requestMs"):
        require(type(value.get(key)) in (int, float) and math.isfinite(value[key])
                and value[key] >= 0, "measured finite timing required")
    require(value["requestMs"] >= value["activationMs"],
            "requestMs must include activation extraction")
    require(type(value.get("generatedTokens")) is int and 0 <= value["generatedTokens"] <= 32,
            "actual bounded generated token count required")
    return {key: value[key] for key in ("identity", "activation", "text", "activationMs",
                                       "requestMs", "generatedTokens")}


def _summary(rows, choices, overhead):
    success = [r["strongSuccess"] if strong else r["weakSuccess"]
               for r, strong in zip(rows, choices)]
    ms = [r["strong"]["requestMs"] + r["weak"]["requestMs"] + extra if strong
          else r["weak"]["requestMs"] + extra
          for r, strong, extra in zip(rows, choices, overhead)]
    tokens = [r["weak"]["generatedTokens"] + (r["strong"]["generatedTokens"] if strong else 0)
              for r, strong in zip(rows, choices)]
    return {"success": success, "servingMs": ms, "generatedTokens": tokens,
            "completion": sum(success) / len(rows), "totalServingMs": sum(ms),
            "p95ServingMs": float(np.quantile(ms, .95)), "strongCalls": sum(choices)}


def _bounds(values):
    return [float(np.quantile(values, .025)), float(np.quantile(values, .975))]


def run(weak, strong, manifest_path, bootstrap_samples=2000):
    """Run both resident workers on every frozen case; return an auditable report.

    Each worker must implement infer(text, max_new_tokens=32). Only task prompt
    text is sent. requestMs includes activationMs and completion generation;
    resident model loading is excluded and must be reported separately by caller.
    """
    manifest = json.loads(Path(manifest_path).read_text())
    require(manifest == make_manifest(manifest.get("seed")), "manifest changed or not canonical")
    require(type(bootstrap_samples) is int and 100 <= bootstrap_samples <= 10000,
            "bounded bootstrap count required")
    rows, identities = [], {}
    for task in manifest["tasks"]:
        receipts = {}
        # Alternate order, predeclared by seed and index, to reduce simple order bias.
        order = ("weak", "strong") if (len(rows) + manifest["seed"]) % 2 else ("strong", "weak")
        for name in order:
            worker = weak if name == "weak" else strong
            receipt = _validate_receipt(worker.infer(task["prompt"], max_new_tokens=32))
            identities.setdefault(name, receipt["identity"])
            require(identities[name] == receipt["identity"], "resident model identity changed")
            receipts[name] = receipt
        rows.append({"id": task["id"], "family": task["family"], "split": task["split"],
                     **receipts, "weakSuccess": grade(task, receipts["weak"]["text"]),
                     "strongSuccess": grade(task, receipts["strong"]["text"])})
    report = {"schema": 1, "scope": "initial-routing-only", "manifest": manifest,
              "evidence": "BOUNDED_SYNTHETIC_TASKS_REAL_MODEL_OUTPUTS",
              "seed": manifest["seed"], "identities": identities, "pairedOutcomes": rows,
              "promotionAuthorized": False, "monetaryCost": None,
              "limits": ["Public generated toy tasks; no realistic Ruflo gain or secret holdout claim.",
                         "Worker receipts must come from real resident inference; fake workers test contracts only.",
                         "Weak and strong are names, not a measured capability ordering.",
                         "Serving comparisons use actual observed request time, not equal-dollar budgets.",
                         "Bootstrap intervals on 16 confirmation cases are exploratory, not deployment evidence.",
                         "Resident model load time and energy are not measured by this API."]}
    report["pairedCollectionMs"] = sum(r[n]["requestMs"] for r in rows for n in ("weak", "strong"))
    report["outcomeCounts"] = {}
    for split in SPLITS:
        report["outcomeCounts"][split] = {}
        for family in ("tool_json", "repository_repair"):
            rr = [r for r in rows if r["split"] == split and r["family"] == family]
            report["outcomeCounts"][split][family] = {
                label: sum(r["weakSuccess"] == w and r["strongSuccess"] == s for r in rr)
                for label, w, s in (("bothPass", True, True), ("weakOnly", True, False),
                                    ("strongOnly", False, True), ("bothFail", False, False))}
    setup = [r for r in rows if r["split"] != "confirmation"]
    setup_ms = sum(r[n]["requestMs"] for r in setup for n in ("weak", "strong"))
    report["setupMs"] = setup_ms
    split_rows = {s: [r for r in rows if r["split"] == s] for s in SPLITS}
    rr = split_rows["reference"]
    if min(sum(r["weakSuccess"] for r in rr), sum(not r["weakSuccess"] for r in rr)) < 2:
        report.update(verdict="INCONCLUSIVE", reason="insufficient weak success/failure labels in reference")
        return report
    probe_rows = lambda rr: [{"id": r["id"], "family": r["family"],
                              "activation": r["weak"]["activation"], "weakSuccess": r["weakSuccess"]}
                             for r in rr]
    started = time.perf_counter_ns()
    bank = fit(probe_rows(split_rows["reference"]), identities["weak"])
    calibration = calibrate(bank, probe_rows(split_rows["calibration"]), identities["weak"], .5)
    setup_ms += (time.perf_counter_ns() - started) / 1e6
    report.update(bank=bank, calibration=calibration, setupMs=setup_ms)
    confirmation = split_rows["confirmation"]
    choices, overhead = [], []
    for row in confirmation:
        start = time.perf_counter_ns()
        decision = decide(bank, calibration, row["weak"]["activation"], identities["weak"], permitted=True)
        overhead.append((time.perf_counter_ns() - start) / 1e6)
        choices.append(decision["action"] == "recommend_strong")
    rng = random.Random(manifest["seed"])
    fixed, random_choices = [False] * len(confirmation), [False] * len(confirmation)
    for family in sorted({r["family"] for r in confirmation}):
        indices = [i for i, r in enumerate(confirmation) if r["family"] == family]
        count = sum(choices[i] for i in indices)
        for i in indices[:count]:
            fixed[i] = True
        for i in rng.sample(indices, count):
            random_choices[i] = True
    summaries = {"candidate": _summary(confirmation, choices, overhead),
                 "fixed": _summary(confirmation, fixed, [0] * len(confirmation)),
                 "seededRandom": _summary(confirmation, random_choices, [0] * len(confirmation))}
    for name, route in (("alwaysWeak", "weak"), ("alwaysStrong", "strong")):
        successes = [r[f"{route}Success"] for r in confirmation]
        timings = [r[route]["requestMs"] for r in confirmation]
        summaries[name] = {"success": successes, "servingMs": timings,
                           "generatedTokens": [r[route]["generatedTokens"] for r in confirmation],
                           "completion": sum(successes)/len(successes), "totalServingMs": sum(timings),
                           "p95ServingMs": float(np.quantile(timings, .95))}
    # Stratified paired resampling preserves both task families and all paired outcomes.
    boot_rng = random.Random(manifest["seed"] + 1)
    differences = {name: [] for name in summaries if name != "candidate"}
    savings = {name: [] for name in differences}
    for _ in range(bootstrap_samples):
        sampled = []
        for family in sorted({r["family"] for r in confirmation}):
            indices = [i for i, r in enumerate(confirmation) if r["family"] == family]
            sampled.extend(boot_rng.choices(indices, k=len(indices)))
        for name in differences:
            differences[name].append(sum(int(summaries["candidate"]["success"][i]) -
                                         int(summaries[name]["success"][i]) for i in sampled) / len(sampled))
            base = sum(summaries[name]["servingMs"][i] for i in sampled)
            candidate = sum(summaries["candidate"]["servingMs"][i] for i in sampled)
            savings[name].append(1 - candidate/base if base > 0 else 0)
    comparisons = {name: {"completionDifference95CI": _bounds(differences[name]),
                          "servingSavingFraction95CI": _bounds(savings[name])} for name in differences}
    # Retain each family's result; aggregate improvements cannot hide regressions.
    per_family = {}
    for family in sorted({r["family"] for r in confirmation}):
        indices = [i for i, r in enumerate(confirmation) if r["family"] == family]
        per_family[family] = {name: {
            "tasks": len(indices),
            "passed": sum(summary["success"][i] for i in indices),
            "completion": sum(summary["success"][i] for i in indices) / len(indices),
            "totalServingMs": sum(summary["servingMs"][i] for i in indices),
            "p95ServingMs": float(np.quantile([summary["servingMs"][i] for i in indices], .95))
        } for name, summary in summaries.items()}
    no_family_regression = all(
        per_family[f]["candidate"]["completion"] >= per_family[f][n]["completion"] - .01
        for f in per_family for n in ("alwaysWeak", "alwaysStrong"))
    candidate_total = summaries["candidate"]["totalServingMs"]
    strong_total = summaries["alwaysStrong"]["totalServingMs"]
    saving_per_task = (strong_total-candidate_total)/len(confirmation)
    amortization = {"setupMs": setup_ms, "confirmationServingPlusSetupMs": candidate_total+setup_ms,
                    "breakEvenTasksVsAlwaysStrong": math.ceil(setup_ms/saving_per_task) if saving_per_task > 0 else None}
    # Frozen conservative exploratory gate: quality noninferiority vs both fixed
    # endpoints, positive quality improvement over allocation controls, and time saving.
    gain = (no_family_regression and all(comparisons[n]["completionDifference95CI"][0] >= -.01
                for n in ("alwaysWeak", "alwaysStrong"))
            and all(comparisons[n]["completionDifference95CI"][0] > 0
                    for n in ("fixed", "seededRandom"))
            and comparisons["alwaysStrong"]["servingSavingFraction95CI"][0] >= .15
            and candidate_total + setup_ms < strong_total)
    report.update(summaries=summaries, comparisons=comparisons, perFamily=per_family,
                  noFamilyRegression=no_family_regression, amortization=amortization,
                  confirmationRoute=[{"id": r["id"], "strong": choice, "decisionMs": ms}
                                     for r, choice, ms in zip(confirmation, choices, overhead)],
                  bootstrapSamples=bootstrap_samples, verdict="BOUNDED_EXPLORATORY_GAIN" if gain else "NO_GAIN")
    return report
