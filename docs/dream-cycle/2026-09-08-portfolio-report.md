# Dream constellation portfolio report — 2026-09-08

## Contract and scope

The cycle started from `ruvnet/dream-machine` default branch `main` at `3edd426f6c9c4b1e80235f7447dc863e749345cc`. The execution contract was read before portfolio work:

- `README.md` — `355222b4f9ef7e46c199d903e74fa24223f33e4d`
- `SECURITY.md` — `1663f995e80a3088e46fa6fa6633351ad934a959`
- `dream.config.json` — `c17b00036f11b09cb0999f5142089c84252531f9`
- `docs/adr/ADR-0001-governance-and-authorization.md` — `5770eac0d4ba6634897c0da982fb5c200f8b6a51`
- ADR index — `6a9877e7fa2842e247da2a1e2cd61143f61a77c3`
- compiled pipeline source `packages/compile/src/index.ts` — `e2c16ad1d34fd942dabce23dcc84ab47dcfa8efe`

The contract's human-only merge authority, fail-closed evidence rules, draft-PR policy, and exactly-one-verdict requirement were preserved. No merge, release, deployment, automerge change, credential use, production probe, or protected-surface change occurred.

## Portfolio inventory

Pagination found 317 owned repositories: 215 public and 102 private. None are archived; 279 are indexed, 38 unindexed, and 11 empty. Private repositories are represented only by aggregate counts.

Observed activity since the previous cohort is a lower bound because search endpoints cap results: at least 39 default-branch commits across four public repositories. Private activity was zero commits in aggregate. Open-state searches reached connector limits at at least 100 pull requests and at least 100 issues.

The cohort was selected with the configured weighting (security 35%, functionality/production impact 30%, velocity 10%, measurable optimization 10%, SOTA 10%, review age 5%) plus neglected-repository rotation. Critical findings would have overridden ranking; none was confirmed.

## Deep cohort and frozen hypotheses

### 1. Ruflo — semantic memory consolidation

Research hypothesis `a41e94874f2f2318`: current primary memory-consolidation research plus effect-path inspection will determine whether PR #3232 has representative evidence for default-on semantic deduplication. Inclusion: primary sources published within 90 days and exact-head artifacts. Exclusion: vendor-only, unpinned, result-only, or synthetic-as-independent claims. Holdout: hard-negative embeddings and cross-namespace cases. Expected information gain: distinguish deterministic implementation evidence from semantic-quality evidence.

Software hypothesis: embedding-aware `MemoryConsolidator.dedup()` removes near-semantic duplicates while preserving distinct memories, exact behavior, deterministic convergence, and acceptable latency on a representative real-embedding corpus.

Exact head: `b8237d3a295e3ad6e94e8308a8a50b1a2754680f`. CVE Audit, CodeQL, Cross-Agent Integration, Verification, CI/CD, and V3 CI/CD all passed. The focused suite covers fixed-point convergence, but its semantic-positive examples use identical cloned vectors. No pinned embedding model, labeled corpus, false-merge/false-split result, threshold sensitivity, cross-namespace isolation result, or realistic latency/memory baseline was provided. Existing issue #3231 was reused and the exact-head review records the missing gate.

Verdict: **INCONCLUSIVE**

### 2. Autogenous — receipt-path diagnostics and optional research exploration

Research hypothesis `04b7912f03948d1e`: a three-role Autogenous exploration (primary-source researcher, contradiction researcher, replication reviewer) improves authoritative coverage or contradiction recall by at least 15% over the frozen single-analyst parent, with no citation or primary-source-ratio regression and equal or lower cost per validated finding. Holdout: exact-head deterministic replay.

Software hypothesis: PR #15 reports the exact offending nested path for malformed canonical receipt input without changing canonical IDs or verdict semantics across supported runtimes.

Exact head: `7603b9cd63d8f8f8b2945ed99308cc4f8a809074`. The patch is narrow and its new Ruflo fixture is relevant, but the exact-head workflow is `action_required`; current CI, cross-runtime replay, and integration evidence did not execute. The Autogenous runtime was unavailable, so no exploration team, LatentMesh semantic-delta channel, held-out comparison, or promotion occurred.

Verdict: **INCONCLUSIVE**

### 3. RuVector — deterministic complete min-cut witnesses

Research hypothesis `75dae35384d71215`: source inspection plus native, WASM, regression, supply-chain, formatting, clippy, and workspace evidence establishes deterministic and complete partition materialization. Holdout: sparse, non-contiguous vertex universes and required Workspace CI.

Software hypothesis: PR #969 yields identical complete min-cut partitions across repeated trials without dropping vertices outside the membership array's prior implied range, with native/WASM compatibility and a green workspace.

Exact head: `8f7d328d5a91875be29115f09ab3c3701e345a9c`. Sorting HashSet-derived traversal and materializing against the actual graph universe address the two identified causes; the 30-trial regression is relevant. Native, WASM Dedup, regression, supply-chain, formatting, and clippy workflows passed. Required Workspace CI run 34120280378 was cancelled, so the frozen gate is incomplete.

Verdict: **INCONCLUSIVE**

### 4. RuView — node identity through multistatic fusion

Research hypothesis `844351846947fc14`: tracing identifiers to the final fusion boundary reveals identity/position contradictions that metadata-only tests miss. Holdout: sparse IDs, reversed configuration order, missing nodes, and join/leave churn.

Software hypothesis: PR #1860 preserves explicit node-ID-to-position mapping end-to-end under sparse IDs and node churn while maintaining legacy configuration compatibility.

Exact head: `56fcc491047cbed8bde10834029b43a5ff39fb5a`. All five observed workflow groups passed. Explicit IDs are preserved for `NodeInfo`, but the runtime converts the configured map back to a positional vector before `set_node_positions`; frames are independently ordered by observed node ID. Sparse IDs, configuration reordering, or churn can therefore bind a frame to the wrong position downstream. Issue #1866 records the minimal ID-keyed fusion contract and adversarial regressions. This is a software-correctness finding, not a physical-accuracy claim.

Verdict: **REJECT**

### 5. MetaHarness — tool-response reward-hack evidence

Research hypothesis `f0447489597a826a`: response-side trajectory inspection finds tool-output reward hacking missed by argument-only inspection, with no clean-control, exporter, or deterministic replay regression. Holdout: nested response leaks, clean tool outputs, exporter behavior, and live-model scope.

Software hypothesis: PR #293 detects gold leakage in tool-response content, keeps clean trajectories unflagged, and prevents leaking evidence from entering exported trajectories.

Exact head: `4c77bdb58606b24f93127c05d8b5d424de17a00a`. Exact-head CI, Real Tools, and Security passed, together with packaging/audit and the reported Node/Rust/WASM matrices. The candidate proves a nonvacuous clean control, catches the response leak, preserves a clean response, and verifies exporter exclusion. Acceptance is limited to the deterministic Node software primitive; it is not independent live-model or production-corpus validation.

Verdict: **ACCEPT**

## Security and functionality

No new remotely exploitable critical or high production vulnerability was confirmed. No secrets, exploit instructions, or private-repository details were published.

A medium-priority functionality defect was confirmed in RuView's multistatic mapping and recorded as issue #1866. Ruflo's default-on semantic threshold remains an evidence risk, not a confirmed vulnerability. Autogenous and RuVector lack complete required workflows. MetaHarness's accepted result narrows a reward-hack monitoring blind spot within its tested envelope.

Runnable checkouts were unavailable. Consequently, pinned Ruflo 3.25.6 read-only scans, lockfile-aware `npm audit`/`cargo audit`, secret scanning, STRIDE generation, local dependency reachability, and fresh native/WASM/RVF replay could not run. Exact-head GitHub workflows and reachable source were used instead; this degradation grants no security-acceptance claim beyond the observed workflows.

## SOTA evidence and applicability

- [LycheeMemory V2](https://arxiv.org/abs/2608.12990), submitted 2026-08-13, evaluates semantic segment-level consolidation on LoCoMo and LongMemEval-S and reports 89.22% and 92.20% respectively, with 86.0% and 75.9% construction-token reductions versus A-Mem. Applicability: Ruflo needs a representative consolidation corpus and quality/cost measurements; identical vectors are only a smoke test.
- [Can escalation channels redirect reward hacking toward defect disclosure?](https://arxiv.org/abs/2608.29460), submitted 2026-08-29, reports reward hacking falling from 23.6% to 5.3% under its combined intervention. Applicability: MetaHarness's response-side detection is useful evidence infrastructure, but detection alone does not establish enforcement or generalize beyond its frozen software tests.
- [Beyond Test Presence](https://arxiv.org/abs/2607.12068), submitted 2026-07-13, analyzes assertion strength, edge-case coverage, and flakiness rather than pass rate alone. Applicability: green tests were not treated as sufficient when semantic fixtures, effect-boundary assertions, or hermetic workspace evidence were absent.
- Cooperative multistatic sensing research such as [Cooperative ISAC for Joint Localization and Velocity Estimation](https://arxiv.org/abs/2602.20319) is outside the preferred 90-day window but reinforces that distributed observations are fused through an identity-aware central process. It does not validate RuView hardware accuracy and was used only as architecture context.

Baseline benefit claims were not imported from papers into repository verdicts. Each repository remained bound to its own frozen implementation evidence.

## Ruflo research self-learning receipt

Parent strategy hash: `b5be6bdb98279301`. Candidate strategy hash: `0939507eb652767a`. Hash algorithm: FNV-1a-64 over UTF-16 code units. Parent: contract-first, single-analyst exact-head source/workflow inspection, primary-source search, and contradiction search. Candidate generation: add explicit effect-boundary tracing and current-primary-source comparison. Cutoff: 2026-09-08. Budget: at most three generations or 45 minutes per repository; one bounded candidate generation was used. Promotion threshold was frozen at at least 10% improvement in authoritative coverage, contradiction recall, reproducibility, cross-stack applicability, and information gained per cost, with no safety, citation, primary-source-ratio, privacy, or licensing regression.

The candidate found the RuView downstream identity contradiction and the Ruflo cloned-vector evidence gap. However, the Ruflo runtime, durable Ruflo memory backend, RuVector/RVF retrieval backend, and local MetaHarness evaluator were unavailable. Cost/tokens were not exposed by the connector, the composite delta could not be reproduced numerically, and no held-out runtime replay was possible. The parent was retained. No reusable lesson was written to Ruflo memory and no memory key or retrieval verification is claimed. The reusable manual lesson is: trace evidence to the final effect boundary, and do not promote semantic quality from identical-vector fixtures.

Research-loop verdict: **INCONCLUSIVE**

## Autogenous sub-receipt

Frozen topology: three roles—primary-source researcher, contradiction/falsification researcher, and replication reviewer—with structured source/claim deltas and no authority over promotion, disclosure, merge, release, deployment, credentials, or protected surfaces. Parent baseline and 15% held-out gate were frozen before invocation.

Autogenous and validated LatentMesh semantic-delta communication were unavailable. Exploration fell back to one bounded analyst using ordinary connector messages. No duplicate-source rate, disagreement rate, token/cost delta, deterministic multi-agent replay, or held-out improvement could be measured. MetaHarness-style manual critique preserved the strongest contradictory interpretation, but no Autogenous strategy was promoted and no Ruflo memory key was written.

Autogenous verdict: **INCONCLUSIVE**

## Constellation coordination

Dream Machine supplied governance and the durable receipt. MetaHarness supplied the accepted adversarial evidence primitive. Ruflo remained the intended selector and learning memory, but its runtime was unavailable. Autogenous remained an optional proposal layer without authority and was unavailable. RuVector native/WASM/RVF remained the required retrieval/parity gate but could not be replayed locally. Core Memory receives only a redacted aggregate checkpoint; the governed signed-federation endpoint remains unavailable, so no signed-federation claim is made.

## Actions and workflow evidence

- One issue created: [RuView #1866](https://github.com/ruvnet/RuView/issues/1866).
- Five exact-head COMMENT reviews: [Ruflo #3232](https://github.com/ruvnet/ruflo/pull/3232), [Autogenous #15](https://github.com/ruvnet/autogenous/pull/15), [RuVector #969](https://github.com/ruvnet/RuVector/pull/969), [RuView #1860](https://github.com/ruvnet/RuView/pull/1860), and [MetaHarness #293](https://github.com/ruvnet/metaharness/pull/293).
- Ruflo exact-head runs: 34194921379, 34194921449, 34194921362, 34194921406, 34194921409, and 34194921313 passed.
- RuVector required Workspace CI 34120280378 was cancelled; six other observed workflow groups passed.
- RuView's five observed exact-head workflow groups passed.
- MetaHarness CI 34100589386, Security 34100589392, and Real Tools 34100589409 passed.
- Autogenous exact-head workflow required authorization and did not execute.
- Zero implementation PRs, direct pushes, merges, releases, deployments, automerge changes, or signed-federation claims.

## Blockers and next cohort

Blockers: 38 unindexed repositories; connector search caps; unavailable runnable checkouts; unavailable Ruflo, Autogenous, RuVector/RVF, and local MetaHarness runtimes; cancelled/authorization-gated workflows; no physical RuView validation; no governed signed-federation endpoint.

Next cohort: Ruflo real-embedding consolidation corpus and threshold calibration; RuView ID-keyed fusion remediation; RuVector Workspace CI recovery; Autogenous exact-head replay and a real held-out exploration trial; MetaHarness live-host qualification; Dream Machine immutable evaluator/action pinning; and neglected high-risk repositories.
