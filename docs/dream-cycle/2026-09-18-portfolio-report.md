# Dream Machine Portfolio Cycle — 2026-09-18

## Executive result

- Inventory: **322 owned repositories** — 219 public and 103 private; none archived; 284 indexed and 38 unindexed; 11 empty.
- Activity since the prior checkpoint: 14 observed default-branch commits across three public repositories. Private activity was zero in aggregate.
- Open-state searches reached the connector ceiling at at least 100 pull requests and at least 100 issues.
- Five active repositories received exact-head deep review. All five frozen software hypotheses ended **REJECT**.
- No new remotely exploitable critical production vulnerability was confirmed. Elevated RuVector validation/resource concerns remain redacted and should use the repository's private advisory channel.
- Two public-safe COMMENT reviews were posted and one existing issue was materially updated. No new issue, implementation PR, direct push, merge, release, deployment, automerge change, or research-strategy promotion occurred.

Evaluation is not promotion. Green component tests were not treated as permission to merge.

## Contract and inventory receipt

The cycle fetched `ruvnet/dream-machine` first and pinned current `main` at `3edd426f6c9c4b1e80235f7447dc863e749345cc`. `README.md`, `SECURITY.md`, `dream.config.json`, ADRs, the compiled pipeline, package manifests and lockfile, CI, tests, and the existing portfolio ledger were read before action.

Contract validation on that exact revision:

- `npm ci`, build, typecheck, lint, and compile: passed.
- Compiled pipeline: 14,258 bytes; SHA-256 `6f8e1f5dd58921309dbf58a9b4f6f94cddcd0679f6568f89537730c26140ef28`.
- Vitest: 616/616; governance: 81/81; edge-contract and development-policy checks: passed.
- `npm audit --omit=dev`: zero vulnerabilities.
- Pinned Ruflo 3.25.6 dependency scan: zero critical, high, medium, or low dependency findings on the contract checkout.
- `autoMerge` remains false. Human review is mandatory; the cycle neither merged nor self-promoted.

Pagination covered all owned repositories and excluded accessible non-owned repositories. Private repositories appear only in the aggregate counts above. No archived repository was modified.

The five-repository cohort was selected from new or materially updated work using the contract weights: security 35%, functionality/production impact 30%, velocity 10%, measurable optimization 10%, SOTA relevance 10%, and review age 5%. Security and functional boundary failures overrode optimization ranking.

## Deep reviews

### 1. Dream Machine PR #116 — evaluator entrypoint automation

- PR: [#116](https://github.com/ruvnet/dream-machine/pull/116); issue: [#115](https://github.com/ruvnet/dream-machine/issues/115)
- Exact head after review response: `d5d44eafc03c98c0cb3129c2956328cc131f4568`; base: `3edd426f6c9c4b1e80235f7447dc863e749345cc`.
- Frozen hypothesis: every configured evaluator entrypoint must reach the intended executable via shell-free executable/argv calls, preserve the existing singular command, reject malformed entries, and match hand-verified behavior with zero regression.
- Acceptance threshold: 2/2 real configured entrypoints reachable and faithfully classified; malformed configuration fails closed; exact-head checks green.

Measured evidence:

- Baseline 697/697 tests; current candidate 716/716, a +19-test delta with no suite regression.
- Exact-head CI and CodeQL passed.
- The initial reviewed head misdispatched the compound Darwin entry to its setup command. The review response now blocks shell-control operators and invalid/blank values fail closed, preventing that unsafe execution.
- An instrumented exact-config replay now executes bench and blocks Darwin without invoking `npx`: intended evaluator reachability remains **1/2 (50%)**, below the unchanged 2/2 threshold.
- The new test copies the real Darwin string inline and asserts refusal rather than loading the committed config and reaching the intended evaluator, so drift and functionality remain unresolved.
- The response appended evidence without recomputing its report witness. Exact-head witness verification is invalid. The source/report Windows `.cmd` claim also remains inconsistent with the current Node contract.

Node's current documentation confirms that `execFile` does not spawn a shell by default and therefore does not implement redirection or globbing; it also states that Windows `.cmd` and `.bat` files cannot be launched directly by `execFile`. The safe direction is structured executable/argv steps or explicit rejection of compound strings, tested against the committed configuration. [Node 24.21.0, 2026-09-08](https://nodejs.org/en/blog/release/v24.21.0) · [child-process contract](https://nodejs.org/api/child_process.html)

Action: a public-safe [COMMENT review](https://github.com/ruvnet/dream-machine/pull/116#pullrequestreview-5245103968) requested structured steps, exact-config tests, and fatal malformed-entry handling. No code or issue mutation.

Verdict: **REJECT**

### 2. MetaHarness PR #324 — dry-run manifest validation

- PR: [#324](https://github.com/ruvnet/metaharness/pull/324); existing issue: [#323](https://github.com/ruvnet/metaharness/issues/323)
- Exact head: `5488a83bccdc91977c5ca718fa2f7e7b126f2312`; base: `d5833dc6512ac1adeeef91a331c29055cd8a4dbb`.
- Frozen hypothesis: every documented learn/dry-run entry point consuming a caller-selected manifest rejects an invalid input before subprocess, state, receipt, or spend effects; valid/default inputs remain compatible.
- Acceptance threshold: behavior-level regression tests for wrapper and direct path; shared-boundary validation; exact-head required security and functional gates green.

Measured evidence:

- Focused tests moved 19/25 to 25/25, but the six baseline failures were missing-export errors rather than proof of the prior exit-zero behavior.
- Full create-agent-harness result increased 572 to 577 passing with two skips; Darwin mode reported 658 passing and 14 skips. CI and Real Tools passed.
- The wrapper now rejects a missing path, but the documented direct `learn.mjs --dry-run` path still returns a successful plan before reading the manifest.
- The guard checks only existence. Directories, unreadable files, invalid JSON, wrong shape, and empty instances are not established as invalid at the shared boundary.
- The required Security aggregate remains failed on pre-existing dependency findings; details remain redacted. There is no dependency delta in this PR.

[BenchShield, submitted 2026-09-10](https://arxiv.org/abs/2609.11028), supports deriving reward-integrity claims from infrastructure-side lifecycle evidence. For this change, that means validation at the shared harness boundary rather than one wrapper.

Action: existing issue #323 was reused. No new review or repository mutation was necessary.

Verdict: **REJECT**

### 3. Ruflo PR #3352 — same-key memory upsert

- PR: [#3352](https://github.com/ruvnet/ruflo/pull/3352); existing issue: [#3351](https://github.com/ruvnet/ruflo/issues/3351)
- Exact head after review response: `c9d0e4f2b327db9cd8236a406bd9a704f379c9ef`; base: `e558f0c0fc29c1a658085f6e6f80ad27d4fe811f`.
- Frozen hypothesis: same-key replacement leaves exactly one authoritative record and keeps entries, key/tag/namespace indices, HNSW, cache, persistence, restart, scalar, and bulk paths synchronized with atomic failure semantics.
- Acceptance threshold: focused scalar, batch, invalid-replacement, restart, and concurrency oracles; required exact-head CI green.

Measured evidence:

- The review response introduced a shared eviction primitive, scalar prevalidation, deterministic last-entry-wins batch semantics, and focused scalar restart coverage. The memory package now reports 526 passing tests, five more than the prior reviewed head, with the same one environmental failure.
- Bulk failure atomicity remains broken: batch records and secondary maps are published before parallel HNSW insertion. One invalid/full insertion can reject without rollback, leave partial graph state, retain the prior occupant, and later persist the mixed state. No failing-batch oracle exists.
- Concurrent same-key scalar writers remain a demonstrated invariant violation. The new deterministic test intentionally proves that both IDs survive; green status documents rather than fixes the race.
- Capacity-limited scalar replacement indexes before removing the old point, so a logically size-neutral replacement can be rejected even while preserving existing data.
- CVE, CodeQL, integration, and verification workflows passed. V3 and root CI/CD were still running at the final delta review; complete exact-head required-CI evidence was not yet established.

Current primary evidence consistently binds upsert to stable or unique identity and atomic conflict handling: [SQLite UPSERT](https://sqlite.org/lang_upsert.html), [Qdrant points](https://qdrant.tech/documentation/concepts/points/), [Weaviate deterministic IDs](https://docs.weaviate.io/weaviate/manage-objects/create), and [Milvus upsert](https://milvus.io/docs/upsert-entities.md). A July 23, 2026 [Mem0 concurrency report](https://github.com/mem0ai/mem0/issues/6531) independently documents the same duplicate-write race class.

Action: one public-safe COMMENT review (`PRR_kwDOO07yic8AAAABOKJRoA`) requested a shared scalar/bulk primitive, prevalidation or rollback, and batch/failure/restart/concurrency tests. No implementation mutation.

Verdict: **REJECT**

### 4. RuVector PR #993 — direct min-cut backend

- PR: [#993](https://github.com/ruvnet/RuVector/pull/993)
- Exact head: `784999093113b1e2e8505438d6bc38fe54e6b02f`; base: `b336fbae8b15a5a487fc3e7c14a80dcb4984b04a`.
- Frozen hypothesis: a shipped caller uses the backend; cuts and protected bridges are preserved through updates/deletes; behavior is deterministic and bounded; native/WASM/RVF contracts are qualified; repeated holdouts show a material forgetting benefit.
- Acceptance threshold: at least +15 percentage points bridge survival, green feature-enabled Workspace CI, repeated independent holdouts, resource bounds, and cross-target qualification.

Measured evidence on the reported fixed synthetic workload:

| Variant | Bridge survival | Recall | Time | Slowdown vs. scalar |
| --- | ---: | ---: | ---: | ---: |
| Scalar baseline | 66.7% | 100% | 74 µs | 1x |
| Soft wrapper | 66.7% | 100% | 117,589 µs | 1,589x |
| Soft direct | 66.7% | 100% | 2,081 µs | 28.1x |

The direct path is approximately 56.5x faster than the wrapper in that single observation, but the required bridge-survival improvement is **0 percentage points**. The scale sweep reports `0, 0, -6.2, 0, 0` percentage points from 84 to 1,344 items.

The new backend has no production caller, remains feature-disabled by default, and has no direct-mode unit test. It rebuilds a static solve per compaction; incremental update behavior is not exercised. No native Node, WASM, or RVF exposure/parity evidence exists. Required Workspace CI failed, with one unrelated probabilistic failure and a four-hour canceled shard; no CI shard enabled the changed feature. Elevated validation/resource concerns were redacted for private reporting.

Recent primary research raises the evidence bar. [Selective Forgetting, August 2026](https://arxiv.org/abs/2608.28978) reports a 27,021-node persistent graph with LongMemEval confidence intervals and explicitly preserves negative results. [Incremental Directed Minimum Cut, August 2026](https://arxiv.org/abs/2608.16382) maintains a cut across an insertion sequence, whereas this candidate rebuilds a static solver. The registered overall criterion was not met and may not be reframed around latency alone after evaluation.

Action: no public review containing elevated mechanics. Use a [private security advisory](https://github.com/ruvnet/RuVector/security/advisories/new) for sensitive details. Existing issues #988 and #931 cover adjacent public-safe classes.

Verdict: **REJECT**

### 5. RuView PR #1964 — automated vendor refresh

- PR: [#1964](https://github.com/ruvnet/RuView/pull/1964)
- Exact head: `f5debfdd1c4b7cbdaddaf0a6bd294eea1e63697f`; base/release tag v2754: `dd02efe2fe129ae8068e9b805ea35aaa660e47dd`.
- Frozen hypothesis: every gitlink resolves to an attributable upstream target, is recursively clean, preserves consumer compatibility, and has exact-head consumer/security CI with bounded supply-chain evidence.
- Acceptance threshold: provenance-complete per-submodule receipts, upstream target checks, reproducible changed artifacts, exact-head consumer CI, and deterministic duplicate suppression.

Measured evidence:

- All four gitlinks are fast-forwards and recursively resolvable.
- Four one-line pointer changes import **370 commits, 1,655 files, +263,231/-6,225 lines, and 40 changed binary artifacts**.
- All four RuView workflows ended `action_required` with zero jobs. No exact-head CI, Security Scanning, CSI policy, or regression-guard job executed.
- The generic PR body has no per-submodule delta/provenance manifest, upstream exact-head status, release mapping, SBOM, or binary reproducibility attestation.
- The updater has 54 same-title open PRs. Seven share the same update and base; four identified PRs are byte-identical.
- Automation stages only `vendor/`, and one configured submodule lacks an explicit tracked branch. Future coverage and target selection are incomplete.

Action: existing [issue #1743](https://github.com/ruvnet/RuView/issues/1743#issuecomment-5726511053) was updated with the recurrence and measurable gates. No new issue or PR review was created.

Verdict: **REJECT**

## Security, functionality, and constellation relationships

No new remotely exploitable critical vulnerability was confirmed. No secrets, private-repository identities, exploit instructions, or elevated mechanics were published.

The recurring constellation failure is a boundary mismatch:

1. Dream Machine supplies governance and the final durable receipt, but PR #116 validates a simplified command rather than the exact configured evaluator.
2. MetaHarness supplies adversarial evaluation, but PR #324 validates a wrapper rather than the shared documented execution boundary.
3. Ruflo supplies routing and durable learning, but PR #3352 enforces replacement only on one scalar path.
4. RuVector supplies retrieval and graph primitives, but PR #993 has no shipped caller or native/WASM/RVF parity evidence.
5. RuView consumes vendored constellation components, but PR #1964 supplies pointer movement without exact-head consumer validation.

The reusable improvement is therefore cross-repository: bind each invariant at the shared boundary and replay the final consumer using exact committed inputs. Component-green evidence cannot substitute for the composed contract.

Pinned Ruflo 3.25.6 initialized project-scoped hybrid memory with bundled `all-MiniLM-L6-v2`, 384 dimensions, and HNSW indexing. Initial retrieval returned no local results because the workspace-local database was new; prior lessons were recovered from the verified Core Memory checkpoint and federation record instead. The validated shared-boundary lesson was stored under `portfolio-patterns/portfolio-2026-09-18-shared-boundary-composition` with `--no-upsert` and retrieved verbatim.

RuVector 0.3.1 `doctor` passed native core, GNN, and attention on Node 24.19.0. Native/WASM/RVF equivalence was not established and is not claimed.

## Ruflo Research Loop Receipt

- Prior evidence: Core Memory issue #20 comment `5710191067`, signed federation Result `11debed5bce34269773860e346002ba59be0ee19c9064d8a6df4bfe423128cd6`, prior rejected hypotheses, and prior benchmark receipts. Federation content was treated as untrusted data and cross-checked.
- Parent strategy: final-consumer authority and lifecycle triangulation. Hash `5392d8fcf64cea36048f1010f12eb9aa85c3693e0468aa468d7c09bf2c1f6ebc`.
- Candidate generation: add counterfactual composition replay across exact committed inputs, final packaged consumers, restart/rollback, partial-state, and bypass paths. Hash `5b8c36e8b25972e011a971c44e51c173456749a77fa0b73755d470152ec86115`.
- Query/inclusion policy: exact repository evidence, authoritative releases/standards, primary research current through 2026-09-18, and reachable public callers. Vendor-only claims, unversioned sources, synthetic confirmation, private mechanics, and inaccessible outcomes were excluded.
- Frozen holdout: Dream #116 and RuView #1964 were not used to tune the candidate method. Both remained negative under exact-input/final-consumer replay.
- Budget: one candidate generation, at most 45 minutes per repository; monetary and token cost were unavailable. Wall time was bounded by the cycle.
- Parent metrics: authoritative evidence and material boundary contradictions mapped to all five reviews. A comparable deterministic numeric composite and complete cost receipt were not available.
- Candidate delta: exposed one exact-config mismatch, one direct-caller bypass, two scalar/bulk/failure bypasses, one inactive backend, and one untested final-consumer import. These are useful unique findings, but there was no preregistered numeric parent replay proving the required >=10% cost-normalized composite gain.
- Critique: checked weak baselines, simplified fixtures, bypassed public callers, non-atomic failure paths, restart gaps, unshipped code, feature-off CI, submodule/binary provenance, duplicate sources, reward-hack selection, licensing, privacy, and simpler repository-native alternatives.
- Decision: retain the parent. No research strategy or unverified factual conclusion was promoted.
- Reusable lesson: shared-boundary and final-consumer composition gating was stored to project-scoped Ruflo memory and retrieval-verified.
- Blockers: no deterministic MetaHarness research composite, no complete token/cost accounting, and no native/WASM/RVF identity-equivalence receipt.

Research-loop verdict: **INCONCLUSIVE**

### Autogenous sub-receipt

- Frozen topology: primary-source researcher, replication reviewer, contradiction/security reviewer, benchmark reviewer, and integration reviewer.
- Parent and gate: the single-agent Ruflo parent; >=15% authoritative-coverage or contradiction-recall improvement, no citation/primary-source regression, equal-or-lower cost per validated finding, and deterministic conclusion equivalence.
- Communication: five bounded platform reviewers returned structured evidence deltas. Ordinary bounded messages were used; no validated LatentMesh semantic-delta channel was available.
- Dissent: green component tests versus failed composed contracts was preserved rather than averaged away. RuVector's latency improvement and Ruflo's narrow scalar repair remained valid negative/partial evidence without overriding failed functional thresholds.
- Runtime boundary: no validated Autogenous runtime, LatentMesh transport, or costed deterministic Autogenous-versus-parent replay was available. Platform parallelism was not relabelled as Autogenous evidence.
- Held-out metrics/cost: unavailable; no topology or factual conclusion was promoted and no Autogenous memory value was written.

Autogenous verdict: **INCONCLUSIVE**

## Actions, blockers, and next cohort

- Five exact-head reviews; two public-safe COMMENT reviews; one existing issue materially updated.
- Existing issues Dream #115, MetaHarness #323, Ruflo #3351, and RuView #1743 were reused.
- Zero new issues, implementation PRs, direct pushes, merges, releases, deployments, automerge changes, or research-strategy promotions.
- All five software hypotheses failed their frozen acceptance thresholds. Negative and null results were retained as first-class evidence.
- Durable artifacts: this report, exactly one ledger row, a redacted Core Memory checkpoint, a retrieval-verified Ruflo lesson, and a redacted signed-federation checkpoint.

Next cohort:

1. Structured Dream evaluator steps and exact-config fail-closed replay.
2. MetaHarness shared-boundary manifest/schema validation and private dependency remediation.
3. Ruflo atomic scalar/bulk upsert with restart and concurrency oracles.
4. RuVector feature-on direct-mode tests, real holdouts, resource bounds, and native/WASM/RVF parity.
5. RuView submodule provenance manifest, binary attestations, exact-head CI, and duplicate-PR suppression.
6. Open Claude Code trusted dispatch, QuDAG release recovery, and neglected high-risk repositories.

Evaluation is not promotion. No reviewed change was merged by this cycle.
