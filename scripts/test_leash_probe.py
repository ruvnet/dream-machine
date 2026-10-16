import copy
import json
import unittest
import numpy as np
from leash_probe import fit, score, calibrate, decide, evaluate, vector


IDENTITY = {"model": "test-only", "revision": "a" * 40, "artifactDigest": "c" * 64,
            "layer": 2, "position": "last_prompt_token"}


def fixture(prefix, n=40):
    rng = np.random.default_rng(sum(map(ord, prefix)))
    return [{"id": f"{prefix}-{i}", "family": "files" if i % 2 else "structured-output",
             "activation": [float((-1 if i % 2 else 1) + rng.normal(0, .2)), float(rng.normal())],
             "weakSuccess": bool(i % 2), "strongSuccess": bool(i % 5),
             "weakCost": .1, "strongCost": 1., "activationMs": 2.}
            for i in range(n)]


class ProbeTests(unittest.TestCase):
    def setUp(self):
        self.reference, self.calibration, self.confirmation = [fixture(s) for s in ("train", "cal", "confirm")]
        self.bank = fit(self.reference, IDENTITY)
        self.gate = calibrate(self.bank, self.calibration, IDENTITY)

    def test_distance_matches_linear_score(self):
        x = np.array([r["activation"] for r in self.reference]); y = np.array([r["weakSuccess"] for r in self.reference])
        z = (x - x.mean(0)) / x.std(0); p, f = z[y].mean(0), z[~y].mean(0)
        residual = z - np.where(y[:, None], p, f)
        inverse = np.linalg.inv(residual.T @ residual / (len(x) - 2) + .01 * np.eye(2))
        for raw in np.random.default_rng(19).normal(size=(100, 2)):
            h = (raw - x.mean(0)) / x.std(0)
            expected = (h-p) @ inverse @ (h-p) - (h-f) @ inverse @ (h-f)
            self.assertAlmostEqual(score(self.bank, raw.tolist(), IDENTITY), expected, places=9)

    def test_failure_center_scores_higher(self):
        self.assertGreater(score(self.bank, [1., 0.], IDENTITY), score(self.bank, [-1., 0.], IDENTITY))

    def test_invalid_vectors(self):
        for value in ([float("nan")], [float("inf")], [True], [], [1e99], [0] * 1025):
            with self.assertRaises(ValueError): vector(value)

    def test_constant_features_regularized(self):
        for r in self.reference: r["activation"] = [1., 1.]
        bank = fit(self.reference, IDENTITY)
        self.assertEqual(score(bank, [1., 1.], IDENTITY), 0)

    def test_invalid_outcomes_and_duplicates(self):
        for mutation in (lambda r: r[0].update(weakSuccess="false"), lambda r: r[0].update(id=r[1]["id"])):
            data = copy.deepcopy(self.reference); mutation(data)
            with self.assertRaises(ValueError): fit(data, IDENTITY)

    def test_split_leakage(self):
        with self.assertRaises(ValueError): calibrate(self.bank, self.reference, IDENTITY)
        self.confirmation[0]["id"] = self.calibration[0]["id"]
        with self.assertRaises(ValueError): self.run_eval()

    def test_identity_change_rejected(self):
        for field, value in (("revision", "b"*40), ("artifactDigest", "d"*64), ("model", "other"), ("layer", 1)):
            changed = {**IDENTITY, field: value}
            with self.assertRaises(ValueError): score(self.bank, [0., 0.], changed)

    def test_permission_and_drift_fail_closed(self):
        self.assertEqual(decide(self.bank, self.gate, [1., 0.], IDENTITY, permitted=False)["action"], "abstain")
        self.assertEqual(decide(self.bank, self.gate, [1., 0.], IDENTITY, permitted=True, drift=True)["action"], "abstain")
        self.assertFalse(decide(self.bank, self.gate, [1., 0.], IDENTITY, permitted=True)["authorized"])

    def run_eval(self):
        return evaluate(self.bank, self.gate, self.confirmation, IDENTITY,
                        evidence_kind="synthetic", monitor_cost=.01, setup_cost=1., random_trials=50)

    def test_replay_recomputes_decisions(self):
        a, b = self.run_eval(), self.run_eval()
        self.assertEqual(a["decisionDigest"], b["decisionDigest"])
        self.assertEqual(a["families"], b["families"])
        for original, replayed in zip(a["receipts"], b["receipts"]):
            self.assertEqual(original["decision"], replayed["decision"])
        self.assertEqual(a["verdict"], "SYNTHETIC_ONLY")
        self.assertFalse(a["promotionAuthorized"])

    def test_missing_full_cost_fails(self):
        self.confirmation[0].pop("strongCost")
        with self.assertRaises(ValueError): self.run_eval()

    def test_one_family_fails(self):
        for r in self.confirmation: r["family"] = "same"
        with self.assertRaises(ValueError): self.run_eval()

    def test_counterexample_both_models_fail(self):
        for r in self.confirmation: r["strongSuccess"] = False; r["weakSuccess"] = False
        out = self.run_eval()
        self.assertTrue(all(r["completion"] == 0 for r in out["families"].values()))

    def test_tampering_changes_receipt(self):
        first = self.run_eval()
        self.confirmation[0]["weakSuccess"] = not self.confirmation[0]["weakSuccess"]
        second = self.run_eval()
        self.assertNotEqual(first["confirmationDigest"], second["confirmationDigest"])

    def test_invalid_threshold_fails(self):
        self.gate["threshold"] = float("nan")
        with self.assertRaises(ValueError): decide(self.bank, self.gate, [0., 0.], IDENTITY, permitted=True)

    def test_heterogeneous_costs_rejected(self):
        self.confirmation[0]["strongCost"] = 10.
        with self.assertRaises(ValueError): self.run_eval()

    def test_setup_cost_included(self):
        out = self.run_eval()
        self.assertAlmostEqual(sum(f["allocatedSetupCost"] for f in out["families"].values()), 1.)

    def test_higher_setup_cost_erases_savings(self):
        out = evaluate(self.bank, self.gate, self.confirmation, IDENTITY,
                       evidence_kind="synthetic", monitor_cost=.01, setup_cost=100., random_trials=10)
        self.assertTrue(all(not f["provisionalPointGate"] for f in out["families"].values()))


if __name__ == "__main__": unittest.main()
