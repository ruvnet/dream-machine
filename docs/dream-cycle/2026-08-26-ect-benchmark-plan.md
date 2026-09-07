# ECT benchmark plan

## Baseline

Current Dream Machine completion path without claim-level evidence certificates.

## Candidate

`@dream-machine/witness` Evidence Carrying Termination with closed replay.

## Workload

At minimum 48 synthetic tasks across six tool-use families with clean executions and controlled termination faults. Fault families should include missing evidence, stale evidence, out-of-scope evidence, replay mismatch, trace mutation, duplicate evidence identity, partial answer support, and premature completion.

## Environment

Pin Node version, package lock, repository commit, evaluator version, and all random seeds. If a model is used for the baseline completion critic, pin provider, model version, decoding parameters, and prompt template.

## Metrics

1. unsafe completion count and rate
2. supported completion count and rate
3. successful recovery count and rate
4. false recovery on clean trajectories
5. certificate generation latency
6. trace bytes and certificate bytes
7. CPU time and memory overhead
8. failure reason distribution

## Reporting

Report absolute counts, absolute percentage-point deltas, relative changes where meaningful, confidence intervals clustered by task, failures, regressions, and reproduction commands. Negative results remain in the ledger.

## Promotion gate

No merge recommendation based on the paper's headline result. A local benchmark must show zero unsupported completion in the deterministic fault set and no more than a 2 percentage-point decrease in supported clean completion. Runtime overhead must be measured and disclosed rather than assumed negligible.
