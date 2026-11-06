# Virtual-view prototype validation — 2026-10-09

Source baseline: Dream Machine `23a577082aad39750051dc7ef0ec9d0d72900adf`;
RuView `0ef6b96fe15e30b4a086992e47e18081a0ba37ce`.

## Executed software checks

- Node v24.19.0, local CPU, synthetic scenes. No robot or model calls.
- Cross-repository adapter benchmark: 100 warmups then 1,000 timed requests,
  256 objects per request. Final hardened implementation: p50 7.830 ms,
  p95 13.822 ms, maximum 34.751 ms. All 1,000 views released and signatures/
  deterministic render receipts replayed. Timed interval includes adapter,
  validation, CPU SVG render and signing; replay is checked outside that interval.
  Run concurrently with broader software checks; these are environment-specific
  observations, not a hardware latency guarantee.
- New focused tests: nine Dream Machine tests and two RuView adapter tests pass.
- Dream Machine typecheck, build and lint pass; 769 existing Vitest tests pass.
- Dream Machine governance: 159 tests pass, including new broker tests.
- Edge-contract and development-policy checks pass.
- RuView adapter plus existing LiDAR codec suite: six tests pass.
- `git diff --check` passes. Production Rust/firmware were not modified or tested.

Initial broad runs lacked installed dependencies and a historical git object used
by the existing codec differential oracle. `npm ci --ignore-scripts` and fetching
the exact reference commit restored these prerequisites; governance rerun passed.
No tests were weakened or skipped to obtain the result.

## Not established

Robot trials: zero. The +20 point lift on two of three tasks, bounded hardware
regressions, end-to-end latency and real pre-action drift detection are
INCONCLUSIVE. SVG box projections are conceptual, not photorealistic simulation.
No calibration, independent tracker, physics, policy execution or live actuator
integration is supplied. See ADR-0108 for the held-out trial protocol and limits.
The signature proves the planning payload's integrity, not sensor truth, receipt
delivery, measured timing, safety or authorization. Synthetic tests cannot promote
this prototype. No merge, deployment, firmware flash or public release performed.

Reproduce from Dream Machine:

```sh
npm ci --ignore-scripts
git fetch origin 35c9fd31ec0369f1c4b0ac7d5eda13d766bbb8cf
npm run check
node scripts/bench-virtual-view.mjs ../ruview/integrations/virtual-view/adapter.mjs
node --test ../ruview/integrations/virtual-view/adapter.test.mjs ../ruview/integrations/iphone-lidar/web/codec.test.mjs
```
