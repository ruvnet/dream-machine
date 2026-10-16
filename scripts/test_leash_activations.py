import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
from leash_activations import extract


class ActivationBoundaryTests(unittest.TestCase):
    def test_credentials_rejected_before_model_import(self):
        with tempfile.TemporaryDirectory() as d, patch.dict(os.environ, {"HF_TOKEN": "not-a-real-key"}):
            with self.assertRaisesRegex(ValueError, "credential-free"):
                extract(d, "a" * 40, "public text", 1)

    def test_missing_safe_weights_rejected(self):
        with tempfile.TemporaryDirectory() as d, patch.dict(os.environ, {}, clear=True):
            with self.assertRaisesRegex(ValueError, "safetensors"):
                extract(d, "a" * 40, "public text", 1)

    def test_oversize_prompt_rejected(self):
        with self.assertRaisesRegex(ValueError, "bounded prompt"):
            extract("/does-not-exist", "a" * 40, "x" * 16385, 1)

    def test_symlink_rejected(self):
        with tempfile.TemporaryDirectory() as d, patch.dict(os.environ, {}, clear=True):
            root = Path(d)
            (root / "model.safetensors").symlink_to("/etc/hosts")
            with self.assertRaisesRegex(ValueError, "materialized"):
                extract(d, "a" * 40, "public text", 1)


if __name__ == "__main__": unittest.main()
