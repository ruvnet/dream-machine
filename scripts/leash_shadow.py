"""Local, non-actuating adapter for Ruflo ModelRouter.route result dictionaries.

No production hook is installed. The existing callback owns routing and errors.
The shadow probe can observe but never replace its result or authorize execution.
"""
from collections import deque
import math
import re
import time

from leash_probe import decide, digest, require


def _number(value, low=0, high=None):
    return (type(value) in (int, float) and math.isfinite(value)
            and value >= low and (high is None or value <= high))


def _model(value):
    return type(value) is str and re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9._:/-]{0,199}", value)


def validate_route(value):
    """Validate the observed ModelRoutingResult surface; ignore extension fields.

    Source: v3/@claude-flow/cli/src/ruvector/model-router.ts. EnhancedRouteResult
    is intentionally not accepted: deterministic handlers are not model routes.
    """
    require(type(value) is dict, "invalid original route")
    require(value.get("model") in ("haiku", "sonnet", "opus"), "invalid original model")
    for key in ("confidence", "uncertainty", "complexity"):
        require(_number(value.get(key), high=1), "invalid route score")
    require(type(value.get("reasoning")) is str, "missing route reasoning")
    alternatives = value.get("alternatives")
    require(type(alternatives) is list and len(alternatives) <= 100, "invalid alternatives")
    for alternative in alternatives:
        require(type(alternative) is dict and alternative.get("model") in ("haiku", "sonnet", "opus")
                and _number(alternative.get("score")), "invalid alternative")
    for key in ("inferenceTimeUs", "costMultiplier"):
        require(_number(value.get(key)), "invalid route timing/cost")
    require(value.get("routedBy") in ("hybrid", "bandit-fallback", "heuristic"), "invalid mechanism")
    if "modelId" in value:
        require(_model(value["modelId"]), "invalid concrete model")
    if "openrouterModel" in value:
        require(_model(value["openrouterModel"]), "invalid provider model")
    if "provider" in value:
        require(value["provider"] in ("anthropic", "openrouter"), "invalid provider")
    if "neuralBackend" in value:
        require(value["neuralBackend"] in ("metaharness-knn", "metaharness-krr", "fastgrnn"),
                "invalid neural backend")
    return value["model"]


class ShadowRouter:
    """Wrap a synchronous existing route(task, *args, **kwargs) callback.

    timeout_ms is a post-computation advisory budget, NOT a hard wall-clock
    deadline. Use only the local bounded decide() probe; no providers or tools.
    Original callback exceptions propagate unchanged. All shadow failures are
    contained and its callback result is returned by identity.
    """

    def __init__(self, route, bank, calibration, *, max_receipts=256, timeout_ms=25):
        require(callable(route), "existing route callback required")
        require(type(max_receipts) is int and 1 <= max_receipts <= 4096, "invalid receipt limit")
        require(_number(timeout_ms) and timeout_ms > 0, "invalid advisory budget")
        self._route = route
        self._bank = bank
        self._calibration = calibration
        self._timeout_ms = timeout_ms
        self._receipts = deque(maxlen=max_receipts)

    @property
    def receipts(self):
        """Detached bounded receipt snapshot, with no raw task or activation."""
        return [dict(receipt) for receipt in self._receipts]

    def route(self, task, *args, task_id, activation, model_identity, permitted,
              drift=False, **kwargs):
        # Do not validate, rewrite, or pass shadow metadata to the real router.
        started = time.perf_counter_ns()
        original = self._route(task, *args, **kwargs)
        routed = time.perf_counter_ns()
        receipt = {"schema": 1, "mode": "shadow", "authorized": False,
                   "suggestedRoute": None, "status": "invalid_input",
                   "originalRouteMs": (routed - started) / 1e6}
        try:
            require(type(task_id) is str and re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9._:-]{0,127}", task_id),
                    "invalid task ID")
            require(type(task) is str and len(task) <= 1_000_000, "invalid task")
            require(type(permitted) is bool and type(drift) is bool, "explicit permission booleans required")
            receipt["originalModel"] = validate_route(original)
            if "modelId" in original:
                receipt["originalModelId"] = original["modelId"]
            # Hash only explicit fields; never serialize route reasoning or extras.
            receipt.update(taskIdHash=digest(task_id), taskHash=digest(task),
                           activationHash=digest(activation), identityHash=digest(model_identity),
                           bankHash=digest(self._bank), calibrationHash=digest(self._calibration))
            receipt["status"] = "probe_error"
            decision = decide(self._bank, self._calibration, activation, model_identity,
                              permitted=permitted, drift=drift)
            require(type(decision) is dict and decision.get("authorized") is False,
                    "probe cannot authorize")
            action = decision.get("action")
            require(action in ("recommend_strong", "recommend_weak", "abstain"), "invalid probe action")
            # An untrusted recommendation never bypasses the caller's gate.
            receipt["suggestedRoute"] = action if permitted and not drift else "abstain"
            receipt["status"] = "ok" if permitted and not drift else "abstain"
        except Exception:
            # Exception strings may contain prompts, vectors, secrets, or labels.
            receipt["suggestedRoute"] = None
        finally:
            elapsed = (time.perf_counter_ns() - routed) / 1e6
            receipt["shadowMs"] = elapsed
            receipt["budgetMs"] = self._timeout_ms
            if elapsed > self._timeout_ms:
                receipt["status"] = "timeout_advisory"
                receipt["suggestedRoute"] = None
            self._receipts.append(receipt)
        return original
