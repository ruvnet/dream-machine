# Dream Machine portfolio report — 2026-09-12

## Contract and scope

The cycle fetched `ruvnet/dream-machine` default branch first at `3edd426f6c9c4b1e80235f7447dc863e749345cc`. The active contract was read from README.md (`355222b4f9ef7e46c199d903e74fa24223f33e4d`), SECURITY.md (`1663f995e80a3088e46fa6fa6633351ad934a959`), dream.config.json (`c17b00036f11b09cb0999f5142089c84252531f9`), ADR-0001 (`5770eac0d4ba6634897c0da982fb5c200f8b6a51`), the ADR index, compiled pipeline source (`e2c16ad1d34fd942dabce23dcc84ab47dcfa8efe`), manifests, and lockfile. Human-only merge authority, fail-closed evidence, private-vulnerability disclosure, and exactly one terminal verdict per hypothesis were preserved.

All owned repositories were inventoried with pagination: 100, 100, 100, 21, then 0 results. The portfolio contains 321 repositories: 218 public and 103 private. None are archived; 283 are indexed, 38 unindexed, and 11 empty. The public and private counts each increased by one since the prior inventory. Private repository identities and details are excluded.

Observed activity since `2026-09-11T07:00:00Z` is a lower bound: 31 default-branch commits across four public repositories. Private activity was four commits in one repository, aggregate-only. Open-state searches reached connector caps at at least 100 pull requests and 100 issues.

Security 35%, functionality/production 30%, velocity 10%, optimization 10%, SOTA 10%, and review age 5% selected RuLTRA, Ruflo, RuVector, RuView, and MetaHarness. The cohort, parent research strategy, lifecycle/provenance candidate, and held-out boundary questions were frozen before candidate outcomes.

## Deep reviews

### 1. RuLTRA — control-surface and release evidence

Research hypothesis: boundary tracing, browser-origin review, immutable-workflow guidance, and exact-main CI will distinguish a safe-by-default hardware console from a listener-only safety claim.

Software hypothesis: main `7483b792f5e0767161ccbf944d428d90e07a6416` enforces its documented control-surface isolation and produces a deployable Raspberry Pi artifact when CI is green.

The repository is a new public Rust workspace integrating pinned Autogenous types, RuVector memory, MetaHarness-style scoring, and a governed hardware loop. README, Cargo manifests/lockfile, UI routes/authentication, CI, ADR links, tests, trust boundaries, and release history were inspected. There is no SECURITY.md and no release yet.

Exact-main [CI run 34665049643](https://github.com/ruvnet/rultra/actions/runs/34665049643) reports success for no-hardware tests, aarch64 cross-build, and RustSec audit. The same run warns that the advertised aarch64 binary path is absent, so no artifact was uploaded. Third-party Actions also use mutable tags. Public [issue #1](https://github.com/ruvnet/rultra/issues/1) records immutable-reference, nonzero-artifact, checksum, MSRV, and negative-gate criteria.

A separate reachable high-severity control-surface isolation defect was confirmed with high confidence. Its reproduction and implementation detail are intentionally withheld from this public report. No deployment is assumed. Open a [private RuLTRA security advisory](https://github.com/ruvnet/rultra/security/advisories/new) before remediation discussion.

**REJECT**

### 2. Ruflo — public federation review profile

Research hypothesis: the MCP 2026-07-28 authorization/tool contracts, exact-head profile diff, public gateway observations, and denial-path tests will show whether the profile removes model-visible secrets and binds effects to transport authorization end to end.

Software hypothesis: [PR #3300](https://github.com/ruvnet/ruflo/pull/3300) safely exposes public-review reads and bounded submissions through the intended production/client path without widening the legacy profile.

Exact head: `e5869af727674af2a011ca95ee9827fac548d2e7`. All eight observed workflow groups passed: CI/CD, Verification, CVE Audit, CodeQL, Marketplace, Cross-Agent, all-plugins, and no-MetaHarness. The profile removes membership-administration and secret-bearing tool parameters, uses transport headers for remaining writes, and labels relay-derived content with a fresh identifier.

The PR itself records five live paths returning 404, no relay-backed production read, and no independent target-client receipt. MCP explicitly treats tool annotations as untrusted hints, so the envelope cannot substitute for server-side effect enforcement. A COMMENT review records authenticated staging, zero-effect denial, rate/timeout, and client-preservation gates. Current inspected Ruflo release: v3.41.2, published September 10, 2026.

**INCONCLUSIVE**

### 3. RuVector — RVF string-ID release integrity

Research hypothesis: install-graph, close/reopen, independent-reader, native/WASM, and workspace evidence will show whether a manifest-floor bump repairs the published artifact rather than only source resolution.

Software hypothesis: [PR #980](https://github.com/ruvnet/RuVector/pull/980) safely repairs distinct string-ID persistence in the installable CLI and preserves the required workspace.

Exact head: `c334e350314b0e5826c56e0bde3d29110d0e702b`. The direction is relevant to confirmed [issue #704](https://github.com/ruvnet/RuVector/issues/704#issuecomment-5644355032), but only two package manifests change. The committed lockfile is not updated, no republished-artifact or independent-reader receipt exists, and metadata remains a separate fail-closed requirement.

Native, WASM-dedup, regression, supply-chain, npm-functional, formatting, and clippy evidence passed. Required Workspace CI [run 34616661436](https://github.com/ruvnet/RuVector/actions/runs/34616661436) failed after 3,546 of 3,547 tests passed: one reasoning-bank test could not acquire its database lock, and a sibling shard was cancelled. The issue and PR review now require a clean exact install, three distinct IDs across reopen, explicit metadata behavior, native/WASM parity, independent reading, and fully green Workspace CI. Latest inspected RuVector release remains 0.2.40; RVF durable COW 0.3.4 is separately released.

**REJECT**

### 4. RuView — calibration identity and expiry

Research hypothesis: lifecycle replay and exact-head source/workflow inspection will show that boot, session, binding, node, and model identities remain coherent across start, finish, promotion, reset, restart, and expiry.

Software hypothesis: [PR #1903](https://github.com/ruvnet/RuView/pull/1903) enforces those identities and passes its own long-running expiry invariant.

Exact head: `2c0abcc8023a45c6bf21dcbcfd78e9139b7bf172`. The explicit identities and 22 focused tests are relevant. CSI policy, fix-marker, benchmark, and Security workflows passed. Continuous Integration [run 34633581574](https://github.com/ruvnet/RuView/actions/runs/34633581574) failed in Rust Workspace Tests: `calibration_expiry_tests::long_running_expiry_is_not_reported_active_for_runtime_or_bootstrap` observed active when false was required. That is the exact lifecycle invariant changed by the PR; Docker, API documentation, and performance jobs were skipped afterward. The review requires the elapsed-time/unit repair, retained mismatch cases, full exact-head CI, and a real multi-node lifecycle receipt. Latest inspected release: v2655, September 11, 2026.

**REJECT**

### 5. MetaHarness — zero-floor promotion logic

Research hypothesis: invalid-score and reward-hack adversaries will show whether a zero/zero no-op tie removes ceiling lockout without expanding promotion to malformed evidence.

Software hypothesis: draft [PR #307](https://github.com/ruvnet/metaharness/pull/307) permits only the true zero floor while rejecting invalid, non-finite, or out-of-domain scores.

Exact head: `eb521e762d48f9cc3fefbdd1bbe6d1b92b81c105`. The intended zero/zero case is correct. Focused tests report 77/77, downstream tests 124/124, and exact-head CI, Security, and Real Tools all passed.

Adversarial source replay found a deterministic counterexample. The gate defines a baseline at floor as any `noopRate <= 0`, then accepts any candidate `noopRate <= 0`. `Score` is a TypeScript interface and the gate performs no finite or range validation. A negative/negative pair therefore promotes; NaN comparisons are also fail-open. The new negative-baseline test checks only a positive candidate and does not cover this case. The review requires finite/domain validation, `noopRate` in [0,1], nonnegative cost, and negative/NaN/infinity/missing-field controls before retaining the exact zero/zero exception. Latest inspected release: v0.4.4.

**REJECT**

## Security and functionality

One new high-severity RuLTRA finding was confirmed against reachable default code. It is redacted and reserved for private advisory handling. No new remotely exploitable critical finding was confirmed, no production system was probed, and no secret or private-repository detail was published.

Public confirmed defects: RuLTRA's green CI does not produce the advertised binary; RuVector's dependency change lacks release/install proof and required Workspace CI; RuView fails its own expiry regression; MetaHarness can promote out-of-domain evidence. Ruflo's local software envelope is green but production/client reachability remains unproven.

Read-only source, manifest, lockfile, workflow, dependency-gate, release, and trust-boundary review was performed. A runnable repository checkout was unavailable, so local `npm audit`, `cargo audit`, secret scanning, STRIDE generation, candidate builds, and fresh native/WASM/RVF replay could not be executed. Exact GitHub workflows and reachable source were used without upgrading their authority.

## SOTA and authoritative evidence

- The [MCP tools specification dated 2026-07-28](https://modelcontextprotocol.io/specification/2026-07-28/server/tools) requires input validation, access control, rate limiting, sanitized outputs, result validation, timeouts, auditability, and per-request authorization for state handles. It also says tool annotations are untrusted unless the server is trusted. Applicability: Ruflo's profile and every effectful review boundary.
- Current [tower-http CorsLayer documentation](https://docs.rs/tower-http/latest/tower_http/cors/struct.CorsLayer.html) states that `very_permissive` reflects the requesting origin, method, and headers. The [Private Network Access draft](https://wicg.github.io/private-network-access/) explicitly identifies web interfaces on loopback as a threat surface and warns that request side effects can matter even when responses cannot be read. Applicability: the redacted RuLTRA finding. These are authoritative interface/specification sources, not independent exploitation evidence.
- GitHub's [secure-use guidance](https://docs.github.com/en/actions/reference/security/secure-use) states that a full commit SHA is the only immutable third-party Action reference. Applicability: RuLTRA issue #1.
- The Ruflo 3.41.2 release documents memory-index preservation and sibling-store disclosure fixes. The validated research runtime for this cycle remained pinned at `@claude-flow/cli@3.25.6`; it was not silently upgraded.

No paper, release note, originating-team benchmark, or software-only receipt was relabeled as independent production validation.

## Ruflo research self-learning receipt

Parent: contract-first exact-head source/workflow inspection, prior issue and Core Memory deduplication, authoritative-source search, final-effect tracing, and manual security/reproducibility critique. Candidate generation: add lifecycle-expiry replay, numeric-domain adversaries, browser-origin/control-surface asymmetry, install-versus-published-artifact separation, and verified federation observations. Source cutoff: 2026-09-12. Inclusion: primary specifications, official documentation/releases, exact source, exact workflows, and existing issue evidence. Exclusion: vendor-only conclusions, synthetic claims without labels, unverifiable summaries, and sensitive vulnerability detail. Budget: one generation within the 45-minute per-repository cap. Frozen threshold: at least 10% preregistered composite improvement without source-quality, citation, privacy, security, licensing, cost, or held-out regression.

The pinned Ruflo CLI executed and reported v3.25.6. Verified federation retrieval added current claims and public coordination context. The candidate added five material boundary contradictions: missing release artifact, unproven Ruflo production/client path, source-only RVF floor, failed RuView expiry invariant, and invalid MetaHarness score admission. However, no project-scoped durable Ruflo database was available in a runnable repository checkout; initializing ephemeral state would not satisfy durability. Deterministic composite replay, information gain per cost, and a clean held-out comparison were therefore unavailable. No strategy was promoted, no Ruflo memory value was written, and no self-learning claim is made. The parent is retained.

Research-loop verdict: **INCONCLUSIVE**

## Autogenous sub-receipt

Frozen topology: four non-duplicative roles—primary-source researcher, replication reviewer, contradiction/falsification researcher, and security/privacy critic. Parent: the single-agent Ruflo strategy above. Communication mode would be structured evidence deltas, with LatentMesh only after validated integration. Frozen threshold: at least 15% authoritative-coverage or contradiction-recall improvement, no citation or primary-source regression, equal or lower cost per validated finding, and deterministic conclusion replay.

The Autogenous runtime, validated LatentMesh semantic-delta channel, project-scoped Ruflo memory, local MetaHarness evaluator, and validated RuVector retrieval backend were unavailable in the working checkout. Ordinary analysis cannot be relabeled as Autogenous. No topology executed, so tokens/cost, duplicate rate, disagreement, unique findings, false leads, held-out delta, memory write, or retrieval verification were measurable. The single-agent parent remains in force.

Autogenous verdict: **INCONCLUSIVE**

## Constellation coordination and actions

Dream Machine supplied governance and this durable report. MetaHarness supplied exact-head promotion evidence and received an adversarial gate review. Ruflo supplied the pinned research CLI and federation profile under review. RuVector/RVF native and WASM evidence was inspected but not freshly replayed. Core Memory and the signed gateway supplied retrieved coordination context; only a redacted aggregate checkpoint is published back. Gateway publication proves the gateway path, not personal identity, independent agent execution, or signed durable Ruflo memory.

Actions:
- Four exact-head PR reviews: Ruflo #3300, RuVector #980, RuView #1903, MetaHarness #307.
- One new issue: RuLTRA #1.
- One existing issue materially updated: RuVector #704.
- Zero implementation PRs, direct pushes to default branches, merges, releases, deployments, automerge changes, or production probes.
- No public disclosure of the redacted high-severity finding.

## Blockers and next cohort

Blockers: 38 unindexed repositories; open-state connector caps; no runnable repository checkout; no project-scoped durable Ruflo memory; unavailable Autogenous/LatentMesh/local MetaHarness execution; one failed RuVector Workspace job; one failed RuView lifecycle test; no target-client federation replay; no independent Raspberry Pi artifact/hardware receipt; and no private-advisory creation API.

Next cohort: private RuLTRA remediation and artifact CI; MetaHarness finite score validation; RuView expiry/lifecycle repair; RuVector lockfile/published string-ID replay and database-lock isolation; Ruflo authenticated production/client profile replay; QuDAG release recovery; Open Claude Code trusted dispatch; and neglected high-risk repositories.
