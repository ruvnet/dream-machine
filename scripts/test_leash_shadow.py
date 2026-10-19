import json
import unittest
from unittest.mock import patch

from leash_shadow import ShadowRouter


def route_result():
    return {"model": "sonnet", "modelId": "anthropic/claude-sonnet-4-6",
            "confidence": .8, "uncertainty": .2, "complexity": .5,
            "reasoning": "PRIVATE_PROMPT", "alternatives": [{"model": "haiku", "score": .3}],
            "inferenceTimeUs": 10, "costMultiplier": 1, "routedBy": "heuristic",
            "provider": "anthropic", "secretExtension": "PRIVATE_LABEL"}


class ShadowTests(unittest.TestCase):
    def setUp(self):
        self.original = route_result()
        self.calls = []
        self.adapter = ShadowRouter(self.callback, {"weight": [1]}, {"threshold": 0})
        self.meta = dict(task_id="task:123", activation=[1234567.89],
                         model_identity={"model": "fixture"}, permitted=True)

    def callback(self, *args, **kwargs):
        self.calls.append((args, kwargs))
        return self.original

    def invoke(self, **changes):
        meta = {**self.meta, **changes}
        return self.adapter.route("PRIVATE_PROMPT", [1, 2], **meta)

    @patch("leash_shadow.decide", return_value={"action": "recommend_strong", "authorized": False})
    def test_result_identity_arguments_and_private_receipt(self, probe):
        before = dict(self.original)
        self.assertIs(self.invoke(), self.original)
        self.assertEqual(self.original, before)
        self.assertEqual(self.calls, [(("PRIVATE_PROMPT", [1, 2]), {})])
        receipt = self.adapter.receipts[0]
        self.assertEqual(receipt["originalModel"], "sonnet")
        self.assertEqual(receipt["suggestedRoute"], "recommend_strong")
        self.assertFalse(receipt["authorized"])
        encoded = json.dumps(receipt)
        for private in ("PRIVATE_PROMPT", "PRIVATE_LABEL", "1234567.89", "task:123"):
            self.assertNotIn(private, encoded)

    @patch("leash_shadow.decide", side_effect=ValueError("PRIVATE_PROMPT"))
    def test_probe_failure_is_contained(self, probe):
        self.assertIs(self.invoke(), self.original)
        self.assertEqual(self.adapter.receipts[0]["status"], "probe_error")
        self.assertNotIn("PRIVATE_PROMPT", json.dumps(self.adapter.receipts))

    @patch("leash_shadow.decide", return_value={"action": "recommend_strong", "authorized": False})
    def test_denied_or_drifted_recommendation_cannot_authorize(self, probe):
        for changes in ({"permitted": False}, {"drift": True}):
            self.assertIs(self.invoke(**changes), self.original)
            self.assertEqual(self.adapter.receipts[-1]["suggestedRoute"], "abstain")
            self.assertFalse(self.adapter.receipts[-1]["authorized"])

    @patch("leash_shadow.decide")
    def test_bad_metadata_or_schema_never_changes_route(self, probe):
        for changes in ({"task_id": "bad\nID"}, {"permitted": 1}, {"drift": "false"}):
            self.assertIs(self.invoke(**changes), self.original)
            self.assertEqual(self.adapter.receipts[-1]["status"], "invalid_input")
        for key, value in (("confidence", True), ("model", "injected\ntext"),
                           ("alternatives", None), ("modelId", "prompt with spaces")):
            self.original = route_result()
            self.original[key] = value
            self.assertIs(self.invoke(), self.original)
            self.assertEqual(self.adapter.receipts[-1]["status"], "invalid_input")
        probe.assert_not_called()

    @patch("leash_shadow.decide", return_value={"action": "recommend_strong", "authorized": True})
    def test_authorizing_probe_is_rejected(self, probe):
        self.assertIs(self.invoke(), self.original)
        self.assertIsNone(self.adapter.receipts[0]["suggestedRoute"])
        self.assertFalse(self.adapter.receipts[0]["authorized"])

    @patch("leash_shadow.decide", return_value={"action": "recommend_weak", "authorized": False})
    def test_advisory_timeout_discards_suggestion(self, probe):
        with patch("leash_shadow.time.perf_counter_ns", side_effect=[0, 1000, 100_001_000]):
            self.assertIs(self.invoke(), self.original)
        self.assertEqual(self.adapter.receipts[0]["status"], "timeout_advisory")
        self.assertIsNone(self.adapter.receipts[0]["suggestedRoute"])

    @patch("leash_shadow.decide", return_value={"action": "abstain", "authorized": False})
    def test_receipts_bounded_and_detached(self, probe):
        self.adapter = ShadowRouter(self.callback, {}, {}, max_receipts=2)
        for _ in range(5):
            self.invoke()
        self.assertEqual(len(self.adapter.receipts), 2)
        self.adapter.receipts[0]["authorized"] = True
        self.assertFalse(self.adapter.receipts[0]["authorized"])

    def test_real_probe_failure_and_original_callback_exception(self):
        self.assertIs(self.invoke(), self.original)
        self.assertEqual(self.adapter.receipts[0]["status"], "probe_error")
        error = RuntimeError("existing router failure")
        def broken(task):
            raise error
        adapter = ShadowRouter(broken, {}, {})
        with self.assertRaises(RuntimeError) as caught:
            adapter.route("task", **self.meta)
        self.assertIs(caught.exception, error)
        self.assertEqual(adapter.receipts, [])

    def test_real_local_probe_recommendation_and_identity_drift(self):
        identity = {"model": "fixture", "revision": "a" * 40,
                    "artifactDigest": "b" * 64, "layer": 2,
                    "position": "last_prompt_token"}
        self.adapter = ShadowRouter(self.callback,
                                    {"identity": identity, "weight": [1], "bias": 0},
                                    {"threshold": 0})
        self.assertIs(self.invoke(model_identity=identity), self.original)
        self.assertEqual(self.adapter.receipts[-1]["suggestedRoute"], "recommend_strong")
        self.assertIs(self.invoke(model_identity={**identity, "revision": "c" * 40}), self.original)
        self.assertEqual(self.adapter.receipts[-1]["status"], "probe_error")


if __name__ == "__main__":
    unittest.main()
