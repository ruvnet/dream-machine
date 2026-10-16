"""Cross-language parity on fitted synthetic contracts, not performance evidence."""
import json
from pathlib import Path
import shutil
import subprocess
import unittest

from leash_probe import fit, calibrate, decide


class BridgeParity(unittest.TestCase):
    @unittest.skipUnless(shutil.which("node"), "Node required for JS bridge parity")
    def test_python_fitted_bank_replays_in_javascript(self):
        identity = {"model": "contract", "revision": "a" * 40, "artifactDigest": "b" * 64,
                    "layer": 1, "position": "last_prompt_token"}
        reference = [{"id": f"r{i}", "family": "fixture", "activation": [x, y], "weakSuccess": success}
                     for i, (x, y, success) in enumerate([(0, 1, True), (1, 0, True),
                                                        (3, 4, False), (4, 3, False)])]
        bank = fit(reference, identity)
        calibration_rows = [{**row, "id": "cal-" + row["id"]} for row in reference]
        calibration = calibrate(bank, calibration_rows, identity)
        vectors = [[0, 0], [1, 1], [3, 3], [4, 4]]
        expected = [decide(bank, calibration, vector, identity, permitted=True) for vector in vectors]
        module = Path(__file__).with_name("leash-ruflo-shadow.mjs").as_uri()
        source = """
import { readFileSync } from 'node:fs';
const { createLeashProbe } = await import(process.argv[1]);
const data = JSON.parse(readFileSync(0, 'utf8'));
const probe = createLeashProbe(data.bank, data.calibration);
console.log(JSON.stringify(data.vectors.map(activation => probe({activation, identity:data.identity}))));
"""
        result = subprocess.run([shutil.which("node"), "--input-type=module", "-e", source, module],
                                input=json.dumps({"bank": bank, "calibration": calibration,
                                                  "vectors": vectors, "identity": identity}),
                                text=True, capture_output=True, check=True, timeout=10)
        actual = json.loads(result.stdout)
        for want, got in zip(expected, actual):
            self.assertEqual(want["action"], got["action"])
            self.assertEqual(got["authorized"], False)
            self.assertAlmostEqual(want["score"], got["score"], places=8)


if __name__ == "__main__":
    unittest.main()
