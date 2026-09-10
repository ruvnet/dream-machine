# Dream Machine portfolio report — 2026-09-10

## Scope and contract

Dream Machine default branch `main` was fetched first at `3edd426f6c9c4b1e80235f7447dc863e749345cc`. The active contract was taken from README.md, SECURITY.md, dream.config.json, ADR-0001 and the ADR index, the compiled pipeline source, package manifest, and lockfile. The contract prohibits autonomous merge or self-promotion, requires evidence before action, and requires exactly one terminal verdict for each frozen hypothesis.

The paginated owned-repository inventory contains 319 repositories: 217 public and 102 private. None are archived. 281 are indexed, 38 are unindexed, and 11 are empty. Private repositories are represented only by aggregates. Since the prior portfolio cutoff, 37 default-branch commits were observed across five public repositories; private activity was zero in aggregate. Open-state searches reached the connector limit at no fewer than 100 open pull requests and 100 open issues.

## Prioritization and cohort

Security and reachable functionality outweighed optimization. Review-age rotation and current activity selected Ruflo, MetaHarness, RuVector, RuView, and rudevolution. Archived repositories were excluded from mutation. Open issues and pull requests were reused where possible.

## Deep reviews

### 1. Ruflo — streaming multi-agent execution

Research hypothesis: authoritative boundary tracing plus exact-head workflow analysis will reveal whether the streaming design preserves explicit authority and bounded effects.

Software hypothesis: PR [#3259](https://github.com/ruvnet/ruflo/pull/3259) preserves explicit execution authority, contains session filesystem effects, and passes every required gate.

Evidence at `ce1b33d2de39647173565cbeafb898ffe855bdd4`:
- Verification, V3 CI, CVE Audit, Cross-Agent, and CodeQL passed.
- The required CI/CD test suite failed at this exact head.
- A user-controlled session identifier reaches a writable session destination without a containment contract at that boundary.
- Execution is enabled by default; non-interactive operation bypasses the confirmation prompt while the default capability set includes effectful tools.
- The review requires explicit execution opt-in or equivalent fail-closed authorization, zero-effect denied controls, platform containment tests, and cancellation/timeout/orphan/cost evidence.

Security assessment: a reachable local filesystem/effect boundary was confirmed. No exploit instructions, secret, or deployment claim is included. Any elevated-severity deployment finding should use a private advisory.

Verdict: **REJECT**

### 2. MetaHarness — host-adapter containment

Research hypothesis: format-specific adversarial review plus release-gate inspection will distinguish a correct local containment patch from a releasable security result.

Software hypothesis: draft PR [#300](https://github.com/ruvnet/metaharness/pull/300) rejects path escape and configuration/command injection without clean-control or release-gate regression.

Evidence at `2eff2ea2df1f6b2e0336f612e8892c4c40cd90b7`:
- The staging-root containment and YAML/TOML/shell escaping are relevant and covered by non-vacuous adversarial tests.
- Exact-head CI and Real Tools passed across the observed platform/runtime matrix.
- CodeQL, Rust audits, SBOM generation, and the root production-dependency check passed.
- The required Security aggregate failed because the web workspace retains independent high-severity production dependency signals. The patch was not identified as their cause.
- Existing issue [#299](https://github.com/ruvnet/metaharness/issues/299) and the draft PR were reused; no duplicate issue was created.

Verdict: **INCONCLUSIVE**

### 3. RuVector — vendored HNSW completeness

Research hypothesis: upstream provenance, deterministic-structure review, and exact-head native/WASM/workspace evidence will determine whether the proposed HNSW repair is promotable.

Software hypothesis: PR [#944](https://github.com/ruvnet/RuVector/pull/944) eliminates dropped-point behavior without recall, latency, native/WASM, or workspace regression.

Evidence at `52044ae207dbd10c8757c27af4e1ab516d9bc9de`:
- The root-cause analysis is corroborated by upstream issue [#37](https://github.com/jean-pierreBoth/hnswlib-rs/issues/37) and open upstream PR [#38](https://github.com/jean-pierreBoth/hnswlib-rs/pull/38).
- The candidate reports zero dropped points versus 780 of 20,000 on its clustered baseline and improved recall, but its small-index gate is probabilistic.
- The upstream change remains open rather than merged and released.
- All six exact-head RuVector workflow groups required authorization; native, WASM, regression, supply-chain, formatting, and Workspace evidence did not execute.
- Promotion requires a deterministic structural invariant or frozen seed, clustered and uniform recall/latency receipts, native/WASM parity, and a green Workspace run.

Verdict: **INCONCLUSIVE**

### 4. RuView — bundled vendor-pointer advance

Research hypothesis: commit-range magnitude, exact-target provenance, and consumer CI will show whether a multi-submodule update is independently reviewable and compatible.

Software hypothesis: PR [#1885](https://github.com/ruvnet/RuView/pull/1885) advances MetaHarness, Midstream, and RuVector with source-bound upstream validation and green consumer compatibility.

Evidence at `4cd0f290de2fc67bdd0d58ecc51b0f76b9df7727`:
- The pointers advance by 77, 2, and 274 upstream commits respectively: 353 commits total.
- The comparison spans at least 637 changed files; two upstream comparisons reached the 300-file API cap.
- No attributable exact-target workflow receipt was found for the selected pointers. The RuVector pointer is a binary-refresh commit that references a different build commit.
- All four RuView consumer workflows require authorization.
- Existing issue [#1743](https://github.com/ruvnet/RuView/issues/1743) was materially updated with this recurrence. The review requires split or independent receipts, source/binary provenance, exact upstream validation, and green consumer CI/Security/CSI/regression gates.

Verdict: **REJECT**

### 5. rudevolution — secure static validation and witness repair

Research hypothesis: boundary review and exact-head multi-runtime evidence will determine whether the merged repair removes unsafe evaluation while preserving standalone builds and deterministic output.

Software hypothesis: merged PR [#6](https://github.com/ruvnet/rudevolution/pull/6) replaces VM execution with bounded static validation, binds witness receipts to exact inputs, restores standalone builds, and preserves output while reducing rename cost.

Evidence at `ee15b1bc0f66f515d3086d502d2db6388c8647ed`:
- Exact-head Security and Correctness passed on Node 22, Node 24, and Rust, including locked installation, audits, dashboard build, unit/integration/doc tests, and benchmark compilation.
- The patch removes VM execution, uses bounded fixed-host retrieval, validates model/tensor and output paths, and binds witness v2 to exact source and module identities.
- Tests include 93 prior Node cases, 14 new security cases, 44 Rust unit tests, 17 Rust integration tests, and one doc test.
- Synthetic bulk-rename comparisons preserved exact output and improved 16.31→1.78 ms (9.17×), 2602.10→5.56 ms (467.92×), and 10742.24→11.91 ms (902.04×).
- Acceptance is limited to the software/security envelope and synthetic microbenchmark; no independent decompilation-accuracy or production claim is made.

Verdict: **ACCEPT**

## Security and functionality summary

No new remotely exploitable critical or high production vulnerability was confirmed. Ruflo has a confirmed local authority/filesystem-boundary defect and a red required suite. MetaHarness has an independently failing production-dependency gate. RuVector and RuView lack exact-head execution evidence. No secrets, exploit instructions, or private-repository details were published.

The reusable constellation lesson is: an orchestration feature must bind user intent to the final effectful boundary; a plausible source patch, open upstream corroboration, or syntactically valid submodule pointer does not substitute for deterministic exact-head native, WASM, security, and consumer receipts.

## SOTA and authoritative sources

- The [MCP 2026-07-28 tools specification](https://modelcontextprotocol.io/specification/2026-07-28/server/tools) requires input validation, access control, rate limiting, sanitized outputs, timeouts, logging, and human confirmation for sensitive operations. It applies directly to Ruflo's effect boundary and MetaHarness-generated integrations.
- Node's current [VM documentation](https://nodejs.org/api/vm.html) states that `node:vm` is not a security mechanism. This supports rudevolution's move from VM execution to bounded static validation.
- The August 13, 2026 [vector database benchmark](https://arxiv.org/abs/2608.12812) evaluates quality jointly with latency and resource behavior. It applies to RuVector's required recall/latency/workspace gate.
- The August 11, 2026 [Agent Safety as a Runtime Contract](https://arxiv.org/abs/2608.11274) motivates preventive enforcement plus verifiable evidence at the effectful boundary.
- GitHub's current [secure-use guidance](https://docs.github.com/en/actions/reference/security/secure-use) treats full commit SHAs as the immutable action reference. This remains relevant to portfolio supply-chain gates.

## Ruflo research-loop receipt

Parent strategy: exact-head repository and workflow review, authoritative primary-source search, contradiction-first boundary tracing, and reuse of existing evidence.

Candidate generation: add state-handle/path-boundary tracing, inspect required workflow logs rather than pass counts, quantify submodule commit/file deltas, and distinguish open upstream corroboration from released upstream validation.

Held-out evaluation: the candidate was manually applied across five repositories not used to tune the prior day's method. It identified four material limiting facts: Ruflo's unbound session/effect boundary, MetaHarness's independent release blocker, RuVector's unexecuted exact-head matrix/open upstream status, and RuView's 353-commit unreceipted sweep.

Measured delta: authoritative evidence mapped to all five cohort questions, but a comparable deterministic composite, cost trace, and replayable held-out Ruflo evaluation were unavailable. Thresholds were not changed and no strategy was promoted.

Sources added/rejected: MCP tools requirements, Node VM security guidance, a current vector-database benchmark, runtime-contract research, GitHub secure-use guidance, and the upstream HNSW issue/PR were retained. Vendor or originating-team claims without exact-head receipts were not treated as independent validation.

Winning strategy: retained parent with candidate lessons recorded only in this Dream receipt.

Reusable lesson stored: none. The repository-approved Ruflo runtime and durable memory were unavailable, so no memory write, retrieval verification, or self-learning claim was made.

Cost/time: bounded manual analysis within the cycle budget; token and monetary telemetry were unavailable.

Blockers: no runnable checkout, pinned Ruflo runtime, local MetaHarness evaluator, validated RuVector/RVF retrieval backend, or governed durable Ruflo memory endpoint.

Verdict: **INCONCLUSIVE**

## Autogenous sub-receipt

Topology frozen: four specialized roles—primary-source researcher, replication reviewer, contradiction/falsification researcher, and security/privacy critic. The single-agent parent, source cutoff of 2026-09-10, held-out cohort, no-authority constraint, and 15% promotion threshold were fixed before candidate assessment.

Execution: the Autogenous runtime, validated LatentMesh semantic-delta channel, local MetaHarness evaluator, RuVector/RVF retrieval backend, and durable Ruflo memory were unavailable. The safe fallback was ordinary bounded manual evidence deltas.

Held-out metrics: no runnable parallel baseline, token/cost trace, deterministic replay, duplicate-source rate, or comparative contradiction-recall score was available. Material dissent was preserved in the repository verdicts rather than averaged away.

Promotion decision: retain the single-agent Ruflo parent. No topology, factual conclusion, or strategy was promoted; no memory key was written or retrieved.

Verdict: **INCONCLUSIVE**

## Actions and durable coordination

- Four exact-head COMMENT reviews were submitted: Ruflo #3259, MetaHarness #300, RuVector #944, and RuView #1885.
- RuView issue #1743 was materially updated; no new issue was created.
- No implementation PR, direct push, merge, release, deployment, workflow rerun, protected-surface change, or automerge change was performed.
- Dream Machine supplied governance; MetaHarness supplied the adversarial evaluation model; RuVector native/WASM/RVF parity remained an acceptance gate; Core Memory receives only the redacted aggregate checkpoint.
- Private repositories appear only in inventory and activity aggregates.

## Blockers and next cohort

Blockers: required authorizations, absent runnable checkouts and hardware, unavailable Ruflo/Autogenous/MetaHarness/RuVector local runtimes, unresolved security-dependency signals, and no governed signed-federation endpoint.

Next cohort: Ruflo explicit execution/session containment and CI recovery; MetaHarness dependency remediation; RuVector deterministic HNSW plus Workspace/native-WASM evidence; RuView split submodule provenance; rudevolution independent accuracy evaluation; LatentMesh calibration; APx and QuDAG rotation; neglected high-risk repositories.
