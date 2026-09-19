# Dream Machine portfolio cycle — 2026-09-15

## Executive receipt

- Contract commit: `ruvnet/dream-machine@3edd426f6c9c4b1e80235f7447dc863e749345cc` (`main`). The README, `SECURITY.md`, `dream.config.json`, ADR index and compiled 26-stage pipeline were read before portfolio work.
- Inventory: 321 repositories owned by the authenticated user: 218 public and 103 private; 0 archived; 283 indexed, 38 unindexed, and 11 empty. Private repositories are represented only by these aggregates.
- Activity lower bound since the preceding portfolio cutoff: 25 public default-branch commits across 2 repositories. No private default-branch commits were observed in aggregate.
- Open state: 1,430 open pull requests and 1,648 open issues across the accessible inventory.
- Deep cohort: Dream Machine, Ruflo, RuView, MetaHarness, and RuLTRA. Security and production-effect risks overrode ordinary ranking where applicable.
- Verdicts: 0 ACCEPT, 5 REJECT. No performance, security, production-readiness, Autogenous, or research-strategy promotion is claimed.
- Mutations: three exact-head pull-request reviews, two existing issue updates, this report, and exactly one ledger row. No new issue, implementation pull request, direct push, merge, release, deployment, protected-surface change, or automerge change.

## Governance and selection

Dream Machine remains evaluation-only: `autoMerge` is false and human promotion is required. Archived repositories were excluded from mutation; none were present. The weighted queue used security 35%, functionality/production impact 30%, change velocity 10%, measurable optimization 10%, SOTA relevance 10%, and review age 5%, with confirmed high-risk boundaries taking precedence.

| Repository | Priority | Reason for elevation |
|---|---:|---|
| RuView | 95 | New sensing/database control surface and absent exact-head qualification |
| MetaHarness | 93 | Promotion-integrity boundary after a prior rejected gate repair |
| RuLTRA | 91 | Edge artifact, persistence, and witness-trust release boundaries |
| Ruflo | 82 | Production MoE routing path, persistence semantics, and required CI failure |
| Dream Machine | 75 | Portfolio governance telemetry and candidate-head witness integrity |

The frozen software threshold for every repository required the advertised behavior to be reachable in the shipped path, adversarial controls to fail closed, persistence to survive exact restart when relevant, and all required exact-head workflows to pass. A passing focused suite alone was insufficient.

## Deep reviews

### 1. Dream Machine — PR #109

- Exact head: `fba825264cb464dc4c78917f319ecac4fb1b94cb`.
- Research hypothesis: tracing compiled inputs and recomputing the witness at the candidate head will expose any gap between typed backlog telemetry and the executable contract.
- Software hypothesis: the candidate reports finite, safe, execution-bound open-review backlog data and binds its witness to the reviewed head.
- Baseline and acceptance: the current compiled pipeline must pass the new input in ordinary execution; all public/library inputs must reject empty, non-finite, fractional, negative, and unsafe integers; labels must match measured semantics; the receipt must recompute at the candidate head; existing gates must remain green.
- Validation: `npm ci`, build, typecheck, lint, 627/627 Vitest tests, 81/81 governance tests, dependency audit, secret scan, Ruflo deep scan, CI, and CodeQL passed. The initial shallow-clone governance miss was resolved by fetching the contract's pinned reference commit and replaying 81/81.
- Finding: the compiled path does not obtain or pass the new backlog input. Runtime entry points still admit ambiguous or lossy values, the display overstates what the count measures, and the evidence witness is bound to the base contract rather than the candidate head.
- Measured delta: focused tests increased and remain green, but executable coverage of the new telemetry is still 0 in the ordinary compiled path; the mandatory system threshold is missed.
- Action: reused the existing exact-head rejection; no duplicate review or issue was created.
- Verdict: **REJECT**

### 2. Ruflo — PR #3330

- Exact head: `e0031bf0f321f681d8f18add0e0a96925284df86`.
- Research hypothesis: caller-graph tracing, default-parameter holdouts, and exact restart replay will distinguish a working adaptive router from a mathematically plausible but dormant test path.
- Software hypothesis: the load-balancing update is reachable in production, improves the preregistered imbalance threshold on unseen seeds under defaults, and preserves statistics exactly across restart.
- Baseline and acceptance: at least 15% holdout imbalance improvement with no quality regression; a production caller; consistent objective/gradient; exact reload invariance; required workflows green.
- Validation: 136/136 focused tests passed. Five workflow groups passed; required CI/CD failed. A 100-initialization by 64-unseen-embedding seeded holdout and a 1,000 route/update-pair microbenchmark were replayed.
- Finding: the new update has no non-test caller. The primary test amplifies the default coefficient 100-fold and checks direction rather than the frozen outcome. Under defaults, selection probability fell only 0.109–0.157% (mean 0.132%); imbalance change ranged from -4.92% to +6.01% (mean +1.56%); 0/100 runs reached 15%. Restart changes the effective routing denominator and exactly halves the recorded load-balance loss in the tested case. The objective also differs materially from the cited top-1, batch-averaged formulation.
- Measured delta: microbenchmark median moved from 178.80 ms to 176.11 ms (-1.50%), within noise and without a shipped caller. Mandatory improvement was 0/100.
- Security: a public evidence artifact also contains an elevated operational disclosure unrelated to the algorithm. Details are redacted; move it to a private advisory and remove it from public evidence.
- Action: exact-head review `5206909306` posted on [PR #3330](https://github.com/ruvnet/ruflo/pull/3330).
- Verdict: **REJECT**

### 3. RuView — PR #1932

- Exact head: `61c6b3bf918e7bc49ae03a222ef2409d7f5a1096`.
- Research hypothesis: enumerating registered tools, permissions, transactions, history edges, and container routes will reveal any difference between the advertised sensing graph and reachable effects.
- Software hypothesis: the Neo4j/MCP feature is least-privilege, room-scoped, bounded, transactional, historically correct, and fully qualified at the exact head.
- Baseline and acceptance: every effect must have caller/room authorization and confirmation, privacy and rate controls, bounded time/results, database-enforced read-only behavior where claimed, transactionally consistent writes, complete history, route/binary parity, unchanged defaults, and green exact-head workflows.
- Validation: shell syntax and literal-secret scans passed locally. GitHub exposed no exact-head jobs; Cargo was unavailable in the review environment. The change is 5 commits, 10 files, +1,215/-44 and is not reported mergeable.
- Finding: registered surface cardinality exceeds the advertised count and includes an effectful maintenance operation. Per-caller/room authorization, confirmation, privacy, rate, timeout, and result bounds are incomplete. The history traversal follows only current pointers, writes and pointer changes are not atomic, default features change, and container route/binary parity is incomplete. One configuration test does not exercise these boundaries.
- Security: an elevated authorization/privacy release blocker was confirmed. Details are intentionally redacted; use a [private security advisory](https://github.com/ruvnet/RuView/security/advisories/new).
- SOTA applicability: the MCP 2026-07-28 tools requirements and Neo4j's current RBAC, transaction-timeout, and effectful-subquery semantics define the relevant minimum boundary.
- Action: redacted exact-head review `5206909512` posted on [PR #1932](https://github.com/ruvnet/RuView/pull/1932).
- Verdict: **REJECT**

### 4. MetaHarness — PR #307

- Exact head: `37b0b2456129804f953957348247780c7d5171f9`.
- Research hypothesis: malformed evaluator objects and runtime/toolchain replay will expose promotion decisions that typed fixtures and fingerprint-only replay do not cover.
- Software hypothesis: every required safety and score field is type- and domain-validated before promotion, strict replay agrees with live execution, and clean installation is reproducible on supported runtimes.
- Baseline and acceptance: clean controls pass; malformed required fields deny promotion; strict and live decisions agree; exact-head workflows and clean installs pass without fallbacks that conceal lock drift.
- Validation: 85/85 focused flywheel tests, typecheck, ESM/CJS builds, CI, Security, Real Tools, Cargo audit/deny, and high/critical dependency gates passed. A clean Node 24/npm 11 `npm ci` failed on manifest/lock optional-native workspace mismatch; fallback install succeeded. Current CI uses Node 20/22 and permits that fallback.
- Finding: numeric-domain hardening is real, but a required safety value is not fully runtime-validated on a reachable promotion path. Clean controls pass; both malformed-safety denial trials instead promoted. Strict replay rejects the malformed receipt while the less complete replay path accepts it.
- Security: the remaining promotion-integrity condition is elevated and is redacted here; use a [private security advisory](https://github.com/ruvnet/metaharness/security/advisories/new).
- Measured delta: 85 focused tests pass, but 0/2 mandatory malformed-safety denial trials pass.
- Action: redacted exact-head review `5206909645` posted on [PR #307](https://github.com/ruvnet/metaharness/pull/307).
- Verdict: **REJECT**

### 5. RuLTRA — current main and issues #1/#2

- Exact main: `59325faa49e0c0d0bd57cf1899e016f7005a5039`.
- Research hypothesis: artifact existence, three-restart state replay, and trust-marker provenance checks will detect divergence between green edge CI and deployable/verifiable evidence.
- Software hypothesis: exact main produces the advertised Pi artifact with immutable provenance, preserves state and billing semantics across restart, and exposes only cryptographically grounded verification state.
- Baseline and acceptance: non-empty advertised artifact and checksum, tested MSRV, immutable Actions, byte-stable three-restart persistence, fail-closed sensor semantics, and cryptographically bound trust indicators.
- Validation: exact-main CI passed formatting, Clippy, 173 workspace tests, an aarch64 build, and a RustSec audit of 224 dependencies with zero known vulnerabilities on Rust 1.98.1.
- Finding: the build and upload paths still disagree, so the green job publishes no advertised artifact and does not prove the documented MSRV. Persistence evidence has not added the required precision/restart witness. Invalid range data now fails closed, but missing range data can still synthesize a billable working state. A separate elevated witness-trust boundary was confirmed and is redacted; use a private advisory.
- Measured delta: 173 tests and the cross-build pass, but artifact count remains 0 and the required three-restart receipt remains absent.
- Action: existing [issue #1](https://github.com/ruvnet/rultra/issues/1#issuecomment-5676489618) updated; issue #2 reused without duplicate commentary.
- Verdict: **REJECT**

## Security and functionality summary

No new remotely exploitable critical vulnerability was confirmed. Three elevated release blockers were confirmed in public repositories: RuView authorization/privacy, MetaHarness promotion integrity, and RuLTRA witness trust. Their actionable details are deliberately excluded from this public report; private security advisories are recommended. No secrets, exploit instructions, or private-repository identities were published.

The principal functionality failures are: inert Dream backlog telemetry; dormant and restart-inconsistent Ruflo learning; incomplete RuView history/transaction/container behavior; a MetaHarness runtime-validation and clean-install gap; and a RuLTRA artifact/persistence/sensor-semantics gap.

## Constellation integration receipt

- Dream Machine supplied the frozen governance contract, mutation ceilings, evidence schema, and human-only promotion boundary.
- Ruflo 3.25.6 supplied hierarchical coordination, security scanning, and project-scoped memory.
- MetaHarness supplied the adversarial promotion model; its live local evaluator was not used to claim promotion because the reviewed gate remains unsafe.
- RuVector 0.3.0 supplied local 384-dimensional `all-MiniLM-L6-v2` embeddings and RVF retrieval trials. Native SIMD was available; WASM and release-level cross-backend qualification were not established.
- RuView and RuLTRA were treated as downstream sensing and edge-evidence consumers whose effects must inherit the same authorization, persistence, and witness rules.
- Core Memory and the signed federation received redacted aggregate coordination receipts only.

### RuVector retrieval and deduplication

The frozen configuration was `ruvector@0.3.0`, bundled `all-MiniLM-L6-v2`, 384 dimensions, cosine distance, RVF, top-k 5. A named-ID ingestion trial reported five ingests but exposed one stored vector and only identity `0`; it was rejected. A numeric-ID holdout stored five vectors and returned all five. The exact self match was ID 0 at distance 0.000000; the remaining distances were 1.511000, 1.685947, 1.687454, and 1.734807. No near duplicate was identified. Numeric IDs were used only with an immutable external identity map. [RuVector issue #704](https://github.com/ruvnet/RuVector/issues/704#issuecomment-5676479144) records the release gate. No named-identity or cross-backend self-learning claim is made.

## SOTA and authoritative sources

- [MCP tools specification, 2026-07-28](https://modelcontextprotocol.io/specification/2026-07-28/server/tools): input validation, access control, rate limits, output sanitation, and human control for effectful tools; directly applicable to RuView and MetaHarness.
- [Neo4j role-based access control](https://neo4j.com/docs/operations-manual/current/authentication-authorization/manage-privileges/), [transaction timeouts](https://neo4j.com/docs/operations-manual/current/database-internals/transaction-management/), and [effectful `CALL` subqueries](https://neo4j.com/docs/cypher-manual/current/subqueries/call-subquery/): authoritative database boundaries for RuView.
- [Switch Transformers](https://jmlr.org/papers/volume23/21-0998/21-0998.pdf): the original top-1, batch-averaged auxiliary-load formulation used as the Ruflo baseline.
- [ReBA, 2026-08-01](https://arxiv.org/abs/2608.00574), [CoRM, 2026-09-01](https://arxiv.org/abs/2609.01100), and [When Load-Balancing Goes Too Far, 2026-09-03](https://arxiv.org/abs/2609.04453): recent evidence that router balance must be evaluated against quality, specialization, and realistic distributions rather than balance alone.
- [GitHub secure use reference](https://docs.github.com/en/actions/reference/security/secure-use): immutable full-SHA action references and workflow hardening; applicable to RuLTRA release qualification.

## Research Loop Receipt

- Parent strategy: authoritative semantics and freshness, final effect-boundary revalidation, and exact restart replay. Hash `ad4e4d5a84d81f06323366f181e1a7179acca753142ca7c1e4a6d20963da99ad`.
- Candidate generation: add full reachable-effect enumeration, advertised-versus-registered surface cardinality, and complete runtime-type validation at decision boundaries. Hash `ccf5c378ba0bcd85ed62ff81cbb4a9da7a764e86c636d366de24dc91f4832774`.
- Query set: Dream contract; exact PR head; caller graph; effect surfaces; workflow logs; primary standards/releases; contradiction search. Hash `d10636a8588b5113030039d20c95e3f32a3e694dcfcaa8318305854917204879`.
- Inclusion/exclusion: primary standards, current official documentation, exact repository evidence, and releases within the 2026-06-17 through 2026-09-15 cutoff were preferred. Vendor claims without executable evidence, synthetic confirmation, duplicated source identities, unbound receipts, and private details were excluded.
- Frozen budget: at most three generations or 45 minutes per repository; one candidate generation was sufficient. Seeds were recorded for the Ruflo 100x64 holdout; deterministic source identities were used elsewhere. Monetary/token cost was unavailable; wall time stayed inside the per-repository bound.
- Expected information gain: identify one or more system-boundary contradictions missed by passing focused suites.
- Baseline coverage: the parent covered authoritative semantics, the final effect boundary, and restart evidence. The candidate added explicit surface-cardinality and runtime-type checks.
- Promotion threshold: at least 10% preregistered composite gain in authoritative coverage, contradiction recall, reproducibility, cross-stack applicability, and information per cost, with no source-quality, citation, security, privacy, licensing, or holdout regression.
- Parent execution: authoritative evidence was mapped to all five reviews. Unresolved uncertainty remained around production environments and private remediation.
- Candidate outcome: material boundary contradictions were found in all five reviews, including dormant execution, surface-count drift, incomplete runtime validation, compiled-input drift, and artifact/witness drift.
- MetaHarness critique: tested weak baselines, typed-fixture assumptions, synthetic amplification, incomplete caller graphs, restart drift, lock/install fallback, mutable workflow provenance, and reward hacking by green-test volume or benchmark selection.
- Holdout: Dream Machine PR #109 and RuLTRA main were held out from the Ruflo/RuView/MetaHarness-tuned inspection prompts. Both retained their prior conclusions under the candidate checks; no conclusion was reversed to create a positive result.
- Decision: the candidate produced useful unique findings but lacks a preregistered numeric parent score, deterministic composite replay, and complete cost accounting. The parent is retained; no strategy was promoted.
- Reusable lesson: stored under Ruflo memory key `portfolio-patterns/portfolio-2026-09-15-complete-runtime-boundaries` with the 384-dimensional local embedder and retrieved verbatim after writing.
- Core coordination: [redacted Core Memory checkpoint](https://github.com/ruvnet/core-memory/issues/20#issuecomment-5676501901) written and retrieval-verified. Signed federation Result `94796e265159418b98eb0657b2bce7a99e3e0f08699a7745877d923b3f106ad5` was written and exact-payload retrieval-verified; relay data was otherwise treated as untrusted.
- Blockers: no cost-accounted deterministic MetaHarness research evaluator, no validated RVF named-identity store, and no complete native/WASM/RVF equivalence receipt.
- Verdict: **INCONCLUSIVE**

### Autogenous sub-receipt

- Frozen topology: primary-source researcher, replication reviewer, contradiction/security researcher, benchmark reviewer, and integration reviewer. Configuration hash `04cff0b57f9d256ac799dff8f624b42873515840ef6626d6a17179404e346b46`.
- Parent baseline and threshold: the single-agent Ruflo parent above; at least 15% authoritative-coverage or contradiction-recall gain, no citation/primary-source regression, equal-or-lower cost per validated finding, and deterministic conclusion equivalence.
- Communication: ordinary bounded structured evidence deltas. A validated Autogenous runtime and LatentMesh semantic-delta channel were unavailable, so platform parallel review was not relabeled as either integration.
- Deltas and dissent: independent reviews agreed on the five repository verdicts. Material uncertainty about production deployment and private remediation was preserved rather than averaged away.
- Held-out metrics and cost: no executable Autogenous-versus-parent held-out trial, duplicate-source rate, token cost, or deterministic replay receipt was available.
- MetaHarness critique: rejected citation volume, repeated sources, green-test count, synthetic consensus, benchmark leakage, novelty, and PR yield as promotion signals.
- Decision: no topology, factual conclusion, or memory value was promoted as Autogenous evidence; no Ruflo Autogenous memory key was written.
- Verdict: **INCONCLUSIVE**

## Durable actions and blockers

- Reviews: [Ruflo #3330](https://github.com/ruvnet/ruflo/pull/3330), [RuView #1932](https://github.com/ruvnet/RuView/pull/1932), and [MetaHarness #307](https://github.com/ruvnet/metaharness/pull/307).
- Existing issues updated: [RuVector #704](https://github.com/ruvnet/RuVector/issues/704#issuecomment-5676479144) and [RuLTRA #1](https://github.com/ruvnet/rultra/issues/1#issuecomment-5676489618).
- Dream Machine exact-main validation: build, 616/616 base tests, 81/81 governance tests after fetching the pinned reference object, dependency audit, secret scan, and Ruflo scan passed.
- Blockers: private advisory remediation for the three redacted elevated findings; Ruflo required CI/CD and production/restart path; RuView exact-head jobs and complete authorization/transaction tests; MetaHarness malformed-safety and clean-install gates; RuLTRA artifact/MSRV/restart/witness qualification; RuVector named identity and native/WASM/RVF equivalence.

## Next cohort

1. Private remediation and regression receipts for MetaHarness, RuView, and RuLTRA.
2. Dream Machine compiled backlog telemetry, exact candidate-head witness, and runtime integer validation.
3. Ruflo production caller, objective correction, default-coefficient holdout, restart-stable counters, and CI/CD recovery.
4. RuVector released named-ID integrity plus native/WASM/RVF workspace qualification.
5. RuView history, transactional pointer, container-route, and exact-head workflow recovery.
6. QuDAG release recovery and Open Claude Code trusted-dispatch boundaries.

The evidence gate created no implementation work because every frozen software hypothesis failed. Negative results are retained as first-class portfolio evidence.
