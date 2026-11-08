"""Contract tests using fake receipts; these provide no model-performance evidence."""
import json
from pathlib import Path
import tempfile
import unittest

from leash_workloads import freeze_manifest, grade, make_manifest, run


class FakeWorker:
    """Reads public test fixtures internally; never represents real inference."""
    def __init__(self, manifest, name="weak", all_fail=False):
        self.tasks = {t["prompt"]: (i, t) for i, t in enumerate(manifest["tasks"])}
        self.name, self.all_fail, self.requests = name, all_fail, []

    def infer(self, text, max_new_tokens=32):
        self.requests.append((text, max_new_tokens))
        i, task = self.tasks[text]
        # Each split has both success and failure in both families.
        passed = not self.all_fail and (i % 4 < 2 if self.name == "weak" else i % 3 == 0)
        expected = task["grading"] if task["family"] == "tool_json" else {
            "replacement": task["grading"]["targetOperator"]}
        return {"text": json.dumps(expected) if passed else "invalid",
                "activation": [float(i % 4), float(i % 2)], "activationMs": 1,
                "requestMs": 10 + i % 5, "generatedTokens": 5,
                "identity": {"model": self.name, "revision": "a" * 40,
                             "artifactDigest": "b" * 64, "layer": 1,
                             "position": "last_prompt_token"}}


class WorkloadContracts(unittest.TestCase):
    def test_manifest_is_frozen_balanced_and_exclusive(self):
        first = make_manifest()
        self.assertEqual(first, make_manifest())
        self.assertNotEqual(first, make_manifest(99))
        self.assertEqual(len(first["tasks"]), 36)
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "manifest.json"
            self.assertEqual(freeze_manifest(path), first)
            with self.assertRaises(FileExistsError):
                freeze_manifest(path)
        for split, count in first["splitCounts"].items():
            tasks = [t for t in first["tasks"] if t["split"] == split]
            self.assertEqual(sum(t["family"] == "tool_json" for t in tasks), count // 2)

    def test_strict_grading_and_untrusted_repair_rejection(self):
        for task in make_manifest()["tasks"]:
            expected = task["grading"] if task["family"] == "tool_json" else {
                "replacement": task["grading"]["targetOperator"]}
            self.assertTrue(grade(task, json.dumps(expected)))
            self.assertFalse(grade(task, "```json\n" + json.dumps(expected) + "\n```"))
            self.assertFalse(grade(task, json.dumps({**expected, "extra": 1})))
            self.assertFalse(grade(task, '{"replacement":"+", "replacement":"-"}'))
            self.assertFalse(grade(task, json.dumps({"replacement": '__import__("os").system("id")'})))
            if task["family"] == "repository_repair":
                for operator in ("+", "-", "*", "//"):
                    self.assertEqual(grade(task, json.dumps({"replacement": operator})),
                                     operator == task["grading"]["targetOperator"])

    def test_paired_accounting_and_controls_contract_only(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "manifest.json"
            manifest = freeze_manifest(path)
            weak, strong = FakeWorker(manifest), FakeWorker(manifest, "strong")
            result = run(weak, strong, path, bootstrap_samples=100)
        self.assertEqual(len(weak.requests), 36)
        self.assertEqual(len(strong.requests), 36)
        self.assertEqual([p for p, _ in weak.requests], [t["prompt"] for t in manifest["tasks"]])
        self.assertTrue(all(tokens == 32 for _, tokens in weak.requests))
        self.assertIn(result["verdict"], ("NO_GAIN", "BOUNDED_EXPLORATORY_GAIN"))
        self.assertIsNone(result["monetaryCost"])
        self.assertFalse(result["promotionAuthorized"])
        self.assertEqual(len(result["pairedOutcomes"]), 36)
        for name in ("fixed", "seededRandom"):
            self.assertEqual(result["summaries"][name]["strongCalls"], result["summaries"]["candidate"]["strongCalls"])
        confirmation = [r for r in result["pairedOutcomes"] if r["split"] == "confirmation"]
        for i, route in enumerate(result["confirmationRoute"]):
            expected = confirmation[i]["weak"]["requestMs"] + route["decisionMs"]
            if route["strong"]:
                expected += confirmation[i]["strong"]["requestMs"]
            self.assertAlmostEqual(result["summaries"]["candidate"]["servingMs"][i], expected)
        counts = result["outcomeCounts"]["confirmation"]
        self.assertEqual(sum(sum(c.values()) for c in counts.values()), 16)

    def test_insufficient_labels_preserve_actual_outcomes(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "manifest.json"
            manifest = freeze_manifest(path)
            result = run(FakeWorker(manifest, all_fail=True), FakeWorker(manifest, "strong"), path, 100)
        self.assertEqual(result["verdict"], "INCONCLUSIVE")
        self.assertEqual(len(result["pairedOutcomes"]), 36)
        self.assertNotIn("bank", result)

    def test_all_failed_confirmation_is_evaluated_without_reroll(self):
        class FailedConfirmation(FakeWorker):
            def infer(self, text, max_new_tokens=32):
                result = super().infer(text, max_new_tokens)
                if self.tasks[text][1]["split"] == "confirmation":
                    result["text"] = "invalid"
                return result
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "manifest.json"
            manifest = freeze_manifest(path)
            result = run(FailedConfirmation(manifest), FakeWorker(manifest, "strong"), path, 100)
        self.assertIn("bank", result)
        self.assertEqual(result["verdict"], "NO_GAIN")
        self.assertEqual(set(result["perFamily"]), {"tool_json", "repository_repair"})
        self.assertFalse(result["promotionAuthorized"])

    def test_changed_manifest_is_rejected_before_worker_call(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "manifest.json"
            manifest = freeze_manifest(path)
            worker = FakeWorker(manifest)
            manifest["tasks"][0]["prompt"] += " modified"
            path.write_text(json.dumps(manifest))
            with self.assertRaises(ValueError):
                run(worker, worker, path, 100)
            self.assertEqual(worker.requests, [])

    def test_receipt_validation_rejects_unknown_timing(self):
        class InvalidWorker(FakeWorker):
            def infer(self, text, max_new_tokens=32):
                receipt = super().infer(text, max_new_tokens)
                receipt["requestMs"] = float("nan")
                return receipt
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "manifest.json"
            manifest = freeze_manifest(path)
            with self.assertRaisesRegex(ValueError, "timing"):
                run(InvalidWorker(manifest), FakeWorker(manifest, "strong"), path, 100)


if __name__ == "__main__":
    unittest.main()
