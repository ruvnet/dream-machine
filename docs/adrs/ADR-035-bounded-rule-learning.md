# Bounded rule learning and exact replay

Status: experimental, opt-in library integration. Date: 2026-10-11.

The compile package exports `@dream-machine/compile/rule-learning` and the root exports. A candidate pairs inert natural-language prose with a finite integer-state program. It never runs generated JavaScript, shell commands, imports, or network requests. Five operations cover set, add, multiply, copy, and add the action to a field. Safe integer checks reject overflow. Populations, state, transitions, instructions, and prose are capped.

Receipts contain full hidden probes and are evaluator-private artifacts. Never publish real hidden receipts or return them to the learner; publish only their hashes and aggregate metrics. A trusted caller supplies observations and separate nonempty hidden probes. `evaluateRuleCandidates` rejects any candidate with an execution error or an exact state mismatch. `verifyRuleReceipt` recomputes execution and SHA256 canonical JSON. Revision ancestry must include the verified parent receipt; its counterexample must be one of that parent's failed transitions and present in the new observations. Returned receipts are detached copies.

SHA256 provides content integrity, not authenticity. Store or sign the trusted root hash outside candidate control. A caller can invent its entire dataset; this library cannot attest collection provenance or secrecy. Do not expose hidden probes to proposal generation. After a failed probe is exposed as a counterexample, retire it from the sealed evaluation and acquire a fresh probe. No semantic equivalence between prose and code is claimed. Passing replay only establishes agreement with the supplied transitions.

## Host integration

```ts
import { evaluateRuleCandidates, verifyRuleReceipt } from '@dream-machine/compile/rule-learning';
const candidate = { schemaVersion: 1 as const, candidateId: 'add-action',
  rulebook: 'Add the action to x.', program: [{ op: 'addAction' as const, key: 'x' }] };
const observed = [{ state: { x: 1 }, action: 2, nextState: { x: 3 } }];
const sealed = [{ state: { x: 7 }, action: 4, nextState: { x: 11 } }];
const [receipt] = evaluateRuleCandidates([candidate], observed, sealed);
if (!receipt || !verifyRuleReceipt(receipt) || !receipt.accepted) throw Error('Reject');
```

A host must still run independent baseline comparisons and safety checks before promotion. Production acceptance requires a 20 percentage point gain on two of three sealed task families, at least 25% fewer interactions, bounded regressions, zero replay mismatches, no failed hidden probes, and reproducible revisions. These are requirements, not achieved research results.

## Validation and limitations

The synthetic fixture test covers add, multiply and action-dependent transitions across five seeds per family, selecting the correct supplied hypothesis over a deliberately wrong alternative. It tests deterministic execution and selection, not autonomous hypothesis discovery. No ARC-AGI replication, general learning, action-efficiency gain, or end-to-end RSI result is claimed. Only integer dictionaries and scalar integer actions are supported. This implementation introduces no default nightly behavior or automatic promotion.

Local benchmark on Node v24.19.0: 100 batches, each with 15 cells, two candidates, one observation and one probe per cell. All 1,500 synthetic selections were correct. Measured batch p50 was 2.17 ms and p95 6.43 ms. This includes fixture creation, validation and receipt generation on this host; it is not a production latency guarantee. Validation remains at each interpreter boundary; no cache or weakened checks were introduced for this small workload. Re-run `node scripts/benchmark-rule-learning.mjs` after building to measure your host.

## Observation-only proposal agent

`inferRuleCandidates(observations, options?)` now generates candidates rather than requiring a supplied correct program. This deterministic enumerative proposer sees only observed transitions. It searches single-target add, multiply, set, copy, action addition, and multiply-then-add templates over a bounded constant set (default integers -4 through 4). It returns `candidates`, `testedHypotheses`, `compatibleHypotheses`, and `searchComplete`. Multiple explanations can fit the same observations; all retained alternatives must face independent hidden evaluation. Empty candidates mean the finite search found no explanation, not that learning is impossible. `searchComplete: false` means the search budget or candidate retention cap prevented a complete result.

Search is capped at 4,096 tested hypotheses (default 2,048), 16 retained candidates and 17 constants with absolute value at most 1,024. Observation replay stops at the first mismatch. It does not infer multi-target programs, loops, nonlinear arithmetic, general algorithms, or natural-language semantics. Caller options reject unknown fields, so a hidden-probe field cannot silently enter the proposal API. Deterministic candidate IDs are program hashes; `ruleHash(observations)` and `ruleHash(result)` can bind a private proposal transcript. Returned candidates do not retain observation references. The proposer is not an LLM and does not use model credentials.

```ts
import { inferRuleCandidates, evaluateRuleCandidates } from '@dream-machine/compile/rule-learning';
const proposals = inferRuleCandidates(observed);
if (!proposals.candidates.length) throw Error('No compatible finite rule');
const receipts = evaluateRuleCandidates(proposals.candidates, observed, sealed);
// Keep these receipts private; a trusted host decides promotion independently.
```
