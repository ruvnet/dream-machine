import os
import tempfile
import unittest
from unittest.mock import patch

from leash_activations import ActivationWorker
from leash_ruos_followup import prompt, protocol


class FollowupContracts(unittest.TestCase):
    def test_frozen_protocol_and_input_separation(self):
        spec = protocol()
        self.assertEqual(spec, protocol())
        self.assertEqual(len(spec["training"]), 8)
        self.assertEqual(len(spec["confirmation"]), 24)
        for variant in spec["templates"]:
            train = {prompt(t, variant) for t in spec["training"]}
            confirmation = {prompt(t, variant) for t in spec["confirmation"]}
            self.assertFalse(train & confirmation)
            self.assertTrue(all(len(p) < 2000 for p in train | confirmation))
        for split in ("training", "confirmation"):
            for family in ("tool_json", "repository_repair"):
                self.assertEqual(sum(t["family"] == family for t in spec[split]), len(spec[split]) // 2)

    def test_prompt_templates_do_not_read_grading(self):
        for task in protocol()["training"]:
            stripped = {k: v for k, v in task.items() if k != "grading"}
            for variant in range(3):
                self.assertEqual(prompt(task, variant), prompt(stripped, variant))
        with self.assertRaises(ValueError):
            prompt(protocol()["training"][0], 3)

    def test_precision_rejected_before_import_or_model_access(self):
        with tempfile.TemporaryDirectory() as directory, patch.dict(os.environ, {}, clear=True):
            with self.assertRaisesRegex(ValueError, "precision"):
                ActivationWorker(directory, "a" * 40, 1, precision="unreviewed")


if __name__ == "__main__":
    unittest.main()
