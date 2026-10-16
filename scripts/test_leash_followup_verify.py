"""Tamper regressions use synthetic fixtures, never model evidence."""
import hashlib
import json
from pathlib import Path
import tempfile
import unittest

from leash_ruos_followup import protocol
from leash_verify_followup import verify


class EvidenceVerification(unittest.TestCase):
    def fixture(self, root):
        spec = protocol()
        (root / "protocol.json").write_text(json.dumps(spec))
        def row(task, variant):
            answer = task["grading"] if task["family"] == "tool_json" else {"replacement": task["grading"]["targetOperator"]}
            return {"id": task["id"], "family": task["family"], "variant": variant, "passed": True,
                    "text": json.dumps(answer), "promptTokens": 100, "generatedTokens": 10,
                    "requestMs": 20, "activationMs": 10}
        selected = {"template": 0, "precision": "float32"}
        (root / "selected.json").write_text(json.dumps(selected))
        result = {"protocolSha256": hashlib.sha256((root / "protocol.json").read_bytes()).hexdigest(),
                  "sourceSha256": {name: hashlib.sha256(Path(__file__).with_name(name).read_bytes()).hexdigest()
                                   for name in ("leash_ruos_followup.py", "leash_activations.py", "leash_workloads.py")},
                  "training": [[row(t, v) for t in spec["training"]] for v in range(3)],
                  "quantizedTraining": [row(t, 0) for t in spec["training"]],
                  "confirmation": [{n: row(t, 0) for n in ("baseline", "candidate")} for t in spec["confirmation"]],
                  "timing": {n: {"requestMs": [ms] * 24, "p95Ms": ms} for n, ms in (("float32", 10), ("dynamic-int8", 20))},
                  "selected": selected, "families": {f: {"tasks": 12, "baseline": 12, "candidate": 12}
                                                     for f in ("tool_json", "repository_repair")},
                  "providerCalls": 0, "promotionAuthorized": False, "formatGate": True,
                  "activationLatencyGate": True}
        return result

    def test_regrading_and_modified_grade_rejection(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            result = self.fixture(root)
            (root / "result.json").write_text(json.dumps(result))
            self.assertEqual(verify(root)["outcomesRegraded"], 80)
            result["confirmation"][0]["candidate"]["text"] = "invalid"
            (root / "result.json").write_text(json.dumps(result))
            with self.assertRaisesRegex(ValueError, "grade changed"):
                verify(root)

    def test_source_and_latency_tamper_rejected(self):
        for kind in ("source", "latency"):
            with tempfile.TemporaryDirectory() as directory:
                root = Path(directory)
                result = self.fixture(root)
                if kind == "source":
                    result["sourceSha256"]["leash_activations.py"] = "0" * 64
                else:
                    result["timing"]["float32"]["p95Ms"] = 1
                (root / "result.json").write_text(json.dumps(result))
                with self.assertRaises(ValueError):
                    verify(root)


if __name__ == "__main__":
    unittest.main()
