import os
from pathlib import Path
import tempfile
import unittest
import threading
from unittest.mock import patch
from leash_activations import ActivationWorker, extract


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

    def test_resident_guard_lifecycle_without_model(self):
        worker = ActivationWorker.__new__(ActivationWorker)
        worker.max_tokens, worker.max_requests, worker.requests = 256, 1, 1
        worker.closed, worker.lock = False, threading.Lock()
        with self.assertRaisesRegex(ValueError, "ceiling exhausted"):
            worker.infer("public")
        worker.closed = True
        with self.assertRaisesRegex(ValueError, "closed"):
            worker.infer("public")
        worker.lock.acquire()
        try:
            with self.assertRaisesRegex(ValueError, "busy"):
                worker.infer("public")
        finally:
            worker.lock.release()
        for invalid in (-1, 65, True):
            with self.assertRaisesRegex(ValueError, "generation ceiling"):
                worker.infer("public", invalid)

    def test_resident_inventory_detects_changes(self):
        worker = ActivationWorker.__new__(ActivationWorker)
        with tempfile.TemporaryDirectory() as directory:
            worker.path, worker.inventory = Path(directory), {}
            worker._check_inventory()
            (worker.path / "changed.json").write_text("{}")
            with self.assertRaisesRegex(ValueError, "changed"):
                worker._check_inventory()


if __name__ == "__main__": unittest.main()
