# ADR 0108: Uncertainty-triggered virtual-view prototype

Status: Proposed, opt-in research software. Date: 2026-10-09.

## Scope and evidence

SpatialHarness (https://arxiv.org/abs/2610.12457, submitted October 8) motivates
testing complementary views before retraining a control policy. This is NOT a
reproduction of its policy, scene reconstruction, physics or success rates.
Dream Machine is a repository-evaluation engine, not an existing robot simulator.
The additive `scripts/virtual-view-broker.mjs` is a dependency-free CPU prototype.
It does not change runtime defaults or execute a policy or actuator.

## Contract

Input is `virtual-view.v1`: requestId, sceneId, policyId, revision, frame=room_enu,
proof=SYNTHETIC|CODE|MEASURED, nowMs/observedMs in the same clock domain, contact
static|held|transition, target/reference object IDs, physicalAxis=x|y|z, and
2..256 objects. Each object has observed and independently predicted XYZ centres,
positive XYZ dimensions in metres, scalar uncertaintyM and sourceReceipt.
IDs are bounded and contain no XML markup. Geometry is bounded and finite.
The caller must calibrate, authenticate, synchronize and freeze the snapshot.
MEASURED is a caller label, not verified sensor provenance.

Default block conditions: age over 100 ms, contact transition, any centre drift
over 2 cm, or target/reference uncertainty over 10 cm. Below 1 cm uncertainty,
skip rendering. Otherwise choose one complementary orthographic axis maximizing
the visible relative offset and render an actual 256x256 SVG of axis-aligned boxes.
The renderer is conceptual: no meshes, perspective, occlusion reasoning, collision
detection or physics. It must not be presented as a physical camera observation.
Both static and held states require the same residual check; a host scene tracker
must update held-object predictions from its independently observed gripper pose.
No motion model is fabricated here. Thresholds are test defaults, not safety limits.

Elapsed local monotonic time includes validation, rendering, serialization and
Ed25519 signing. At or above 150 ms no image is released. A synchronous renderer
cannot be preempted; a production host must isolate it in a bounded worker.
The budget excludes model inference, transport, upstream reconstruction and GPU
encoding. End-to-end hardware timing must include those costs as applicable.

## Receipts and authority

Caller supplies an in-memory Ed25519 key; no key storage or credential discovery.
The signed planning receipt binds the full bounded snapshot, policy and version,
decision, selected axis and SVG digest. `replay` verifies an independently trusted
public key and recomputes the decision and image byte digest. Signatures establish
integrity, not truth of geometry or safety. Preserve snapshots only in appropriately
private storage; they may reveal scene layout. Keys never enter the receipt.

A planning receipt may exist for a deadline-suppressed view. It is NOT a release
authorization or proof that a policy saw the image. The returned delivery decision
and latency are local observations, not signed timing attestations. All outputs
have `authority:none`; live integration needs a separate action gate, freshness
recheck at use time, request/sequence binding and trusted delivery evidence.

## Integration and rollback

RuView's `integrations/virtual-view/adapter.mjs` accepts the broker by dependency
injection and is disabled by default. No RF Gaussian or raw LiDAR packet is silently
converted into manipulation geometry. A future calibrated tracker must satisfy
the explicit snapshot contract. Do not connect this prototype to real actuators.
Rollback: remove the additive scripts and adapter; no persistent migrations.

Run from Dream Machine (Node 22 or 24):

```sh
node --test scripts/virtual-view-broker.test.mjs
node scripts/bench-virtual-view.mjs ../ruview/integrations/virtual-view/adapter.mjs
```

The benchmark uses 100 warmups and 1,000 timed 256-object synthetic scenes and
verifies all receipts. It reports local software latency, not robot efficacy.
The test filename participates in existing `test:governance` CI.

## Frozen hardware study, still required

Freeze plug insertion, relative placement and drawer interaction, policy/model,
camera setup, scene tracker, action budget, scoring and independent safety monitor.
Randomize at least 50 trials per arm per task on held-out geometry. Record all
attempts, failures and timeouts. Require at least 20 separately labeled drift-hazard
candidate trials. Do not relabel blocked trials as successes or omit them.

`evaluateTrials` validates per-trial rows and requires at least +20 percentage
points on two of exactly three tasks, no task worse than -5 points, candidate
added-latency p95 strictly below 150 ms, at least 95% pre-action drift detection,
and every candidate receipt verified. Synthetic or incomplete rows are always
INCONCLUSIVE. Passing measured labels requires independent evidence review;
the evaluator cannot authenticate labels or grant promotion. Inspect raw captures,
held-out split, frozen-policy equivalence, confidence intervals and signed receipts
before interpreting a result. No hardware acceptance claim exists yet.

## Prior art

SpatialHarness is immediate research prior art. Synchronized virtual robot views
also appear in WO2022221171A1 and US9643314B2. Any hypothesis combining uncertainty,
contact state and signed view provenance needs a separate prior-art analysis.
