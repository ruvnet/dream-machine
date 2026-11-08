# ADR-0016: offline activation-based escalation experiment

Status: experimental, no runtime promotion. Date: 2026-10-16.

## Specification and boundaries

Evaluate whether selective initial routing reduces complete inference cost by
15% while remaining within one percentage point of always-strong completion on
each of two distinct workflow families. Require independently verified paired
task traces, complete cost accounting and separate reference/calibration/confirmation
task IDs. Public toy inputs are not hidden holdouts. Point estimates alone do
not demonstrate statistical noninferiority or production readiness.

LEASH (https://arxiv.org/abs/2610.22280v1) supplies the shared-covariance
failure-distance score. This is a scoped experiment, NOT a full reproduction:
no manager, runtime takeover or shadow intervention is evaluated. Always-strong
outcomes cannot stand in for counterfactual mid-task takeovers with different histories.

## Flow and architecture

Reviewed local safetensors -> credential-free CPU activation child -> labeled
reference vectors -> regularized covariance fit -> separate calibration quantile
-> frozen confirmation vectors -> advisory routing and complete paired cost comparison.
Runtime recommendation never authorizes tools, credentials or permission escalation.
Trusted permission denial and externally detected drift cause abstention. Automatic
drift detection is not implemented. Changed model/revision/artifact inventory/layer requires recalibration.

Distance subtraction is expanded into an exactly equivalent linear score after
one offline fit. This avoids quadratic per-query matrix work. Dimensions and
input sizes are bounded. No automatic dependencies, models or provider calls.
Local activation extraction forbids remote code and pickle weights, enforces
token limits and rejects inherited credential names. It reads only a local
model directory. Operators must verify the declared revision against downloaded
artifact hashes; a declared revision is not proof of provenance.

## Tests and execution

`python -m unittest discover -s scripts -p test_leash_probe.py -v`

Requires NumPy. Optional activation extraction requires a separately reviewed
CPU PyTorch/Transformers environment and materialized safetensors model directory:

`env -i PATH=/usr/bin:/bin HF_HUB_OFFLINE=1 TRANSFORMERS_OFFLINE=1 /absolute/venv/bin/python scripts/leash_activations.py /absolute/model FULL_COMMIT_SHA --layer 2`

Pass a bounded JSON object `{"text":"public prompt"}` on stdin. No outcome labels
or evaluator reasoning go to the model. Extraction proves only access to real
activations, not task success or useful self-improvement. A tiny/random model is
valid only for interface testing, never as evidence for the paper's gains.

`python scripts/leash_probe.py /private/paired-spec.json` reads an object with
identity, reference, calibration, confirmation, fraction, evidenceKind, monitorCost and setupCost.
Each row has id, family, activation and boolean weakSuccess. Confirmation additionally
requires boolean strongSuccess, complete weakCost/strongCost and activationMs.
Costs use one consistent unit and include full serving runs; unknown costs must
not be supplied as zero. setupCost includes reference-bank collection, fitting and
calibration and is allocated proportionally across this confirmation serving horizon.
The evaluator does NOT verify cost provenance or enforce a production gate.

Random controls match strong-call counts and serving dollars per family; heterogeneous
route costs within a family fail closed until a monetary-budget matcher is implemented. Fixed
routing takes the first calibrated call-count positions, not an optimized baseline.
Keep both limitations visible. Timing includes supplied activation inference and
measured scoring, but excludes model loading and application queueing.

## Threat model, completion and rollback

Inputs are untrusted arrays/JSON, not shell commands. Reject nonfinite values,
wrong dimensions, duplicate IDs, mixed identities, missing costs and split reuse.
Receipts bind input/bank/calibration/decision digests; hashes give integrity, not
authority. Recompute decisions for replay rather than merely round-trip JSON.
No source text or secrets are emitted by the activation adapter. Raw activations
may contain private information and belong in private evidence storage, not public logs.

All outputs remain experimental and promotionAuthorized=false. Removing these
standalone scripts rolls back the experiment; no existing runtime paths change.
Remaining acceptance work: independently verified two-family real traces, monetary
controls on representative tasks, uncertainty intervals, monitored
drift, permission integration and actual Ruflo action-latency measurement.

## Resident worker and shadow follow-up

The opt-in resident worker, bounded two-family model evaluator, Python observer,
and async Ruflo adapter are implemented. The JS scorer replays Python-fitted
synthetic banks. The actual upstream Ruflo class was checked for preservation of
its original result on 24 permission-denied shadow observations; no production
hook is installed. See the three `docs/runbooks/leash-*.md` runbooks.

The first real model-output evaluation was inconclusive: both pinned small models
failed all 36 strict JSON cases, so no bank was fitted. The 24-request warm
activation p95 was 248.38 ms, missing 150 ms. Preserve full public-synthetic
receipts, failures and source hashes under `docs/research/leash-resident-20261016/`.
These are infrastructure and negative model-compatibility results, not useful
self-improvement, production routing, automatic drift detection or deployment.
