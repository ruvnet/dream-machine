# Dream Machine portfolio cycle — 2026-09-11

## Scope and execution contract

The default branch of `ruvnet/dream-machine` was fetched first at `3edd426f6c9c4b1e80235f7447dc863e749345cc`. The reviewed contract was README `355222b4`, SECURITY `1663f995`, `dream.config.json` `c17b0003`, compiled pipeline `e2c16ad1`, and ADR-0001 `5770eac0`. This cycle did not merge, enable automerge, deploy, release, probe production, or expand credentials or protected-surface authority.

Repository inventory used the authenticated installed-repository stream to exhaustion. Results: **319 owned repositories: 217 public and 102 private; none archived; 281 indexed, 38 unindexed, and 11 empty**. Private repositories were used only for the aggregate counts in this paragraph. Since the prior cutoff, public activity had a lower bound of **17 default-branch commits across 10 repositories**; private activity was **0 commits across 0 repositories** in aggregate. Open-state searches reached the connector ceiling at **at least 100 open PRs and 100 open issues**.

Selection used the configured 35/30/10/10/10/5 security, functionality/production, velocity, measurable optimization, SOTA relevance, and review-age weights, with security/functionality override and neglected-project rotation. The five-repository cohort was Ruflo, QuDAG, Agent Name Service, agentic-voice, and auto-browser.

## Frozen hypotheses and verdicts

### 1. Ruflo — authenticated consensus boundary

**Research hypothesis.** Exact-head effect tracing plus adversarial identity admission will determine whether the candidate converts hive roster membership into an authenticated consensus boundary.

**Implementation hypothesis.** At `b275fdd04258cfb1d0b7ba671c6185c819d4e0e6`, rejecting voter IDs absent from `state.workers` prevents an unauthenticated caller from manufacturing consensus.

**Baseline and threshold.** Baseline focused replay: 2/3 adversarial cases fail because fabricated voter IDs are counted. Candidate threshold: 3/3 focused tests, authenticated join/leave/vote at the final effect boundary, zero denied side effects after reopen, and every required exact-head workflow green.

**Evidence.** The candidate reaches 3/3 focused cases and five workflow groups pass: V3 CI/CD, CVE Audit, Cross-Agent, Verification, and CodeQL. [CI/CD run 34569593675](https://github.com/ruvnet/ruflo/actions/runs/34569593675) fails on the exact head because a clean install cannot resolve a required security package; the failure reproduced after rerun. The broader originating-team receipt is 2,863/3,036 passing, 46 failing, and 127 skipped. Reachable `hive-mind_join` and leave remain unauthenticated, so fabricated identities can first enter the roster and then satisfy the new vote check. Existing [issue #3290](https://github.com/ruvnet/ruflo/issues/3290) and [PR #3291](https://github.com/ruvnet/ruflo/pull/3291) were reused; an exact-commit review records the gate.

**Adversarial/reward-hack check.** Focused-test improvement was not accepted as end-to-end identity enforcement; pass counts, scope narrowing, and a majority of green workflows did not substitute for the final effect boundary.

**REJECT**

### 2. QuDAG — v2 cryptographic and DAG release qualification

**Research hypothesis.** Standards mapping, exact-head workflow replay, and independent negative controls will determine whether the merged v2 hardening is a releasable implementation rather than a plausible source change.

**Implementation hypothesis.** The ML-KEM, DAG admission, authentication, MCP, and federation changes at PR head `ac9c28927dfef31c8385a096dc034b39c7c8abcd` satisfy release qualification.

**Baseline and threshold.** Baseline was placeholder cryptography and incomplete admission checks. Threshold: deterministic focused and full-workspace tests, independent ML-KEM known-answer/interoperability and tamper cases, audit reachability, timing/fuzz/license/secret/container checks, CLI/WASM/platform compatibility, and frozen benchmarks, all bound to the exact candidate.

**Evidence.** Source inspection found a materially stronger RustCrypto ML-KEM construction, zeroized secret material, implicit-rejection handling, and an honestly fail-closed validation script. However, **0/6 exact-head workflow groups passed**: [CI](https://github.com/ruvnet/QuDAG/actions/runs/34432399593), [Performance Testing](https://github.com/ruvnet/QuDAG/actions/runs/34432399579), [v2 validation](https://github.com/ruvnet/QuDAG/actions/runs/34432399683), [Benchmarks](https://github.com/ruvnet/QuDAG/actions/runs/34432399717), [Security Scan](https://github.com/ruvnet/QuDAG/actions/runs/34432399613), and [Compatibility](https://github.com/ruvnet/QuDAG/actions/runs/34432399656). No post-merge receipt was present for `945fc6fc`. Dependency signals were retained without public exploitability claims. [Issue #17](https://github.com/ruvnet/QuDAG/issues/17) was created with a fail-closed release gate, and [PR #16](https://github.com/ruvnet/QuDAG/pull/16) received an exact-head review.

**Adversarial/reward-hack check.** A standards-compatible primitive and large change set were not treated as independent interoperability, timing, reachability, or release evidence.

**REJECT**

### 3. Agent Name Service — local identity lifecycle

**Research hypothesis.** Binding, expiry, challenge replay, concurrent mutation, and reopen tests can establish the local Registry API while preserving the distinction between cryptographic validity and current authorization.

**Implementation hypothesis.** At `ec972ebc6887b7808f8db4415a30e1a088b1e880`, the local registry rejects forged, expired, replayed, and revoked identities after reopen without exceeding capacity.

**Baseline and threshold.** Threshold: deterministic Ed25519 verification, pinned issuer, bounded lifetime, single-use audience-bound challenge, atomic SQLite registration/revocation, durable reopen behavior, exact-head green CI, and no claim that MCP binding validity implies registry authorization.

**Evidence.** Ten domain tests cover signature/tamper, expiry, revocation persistence, audience/replay, and capacity. The package has no third-party runtime dependencies. [Project validation](https://github.com/ruvnet/Agent-Name-Service/actions/runs/34542357761) and [MetaHarness/Autogenous](https://github.com/ruvnet/Agent-Name-Service/actions/runs/34542357801) pass. The originating-team benchmark reports 0.431 ms p95 over 1,000 local validations. MCP verification truthfully returns `revocationChecked: false`; it proves binding validity, not active membership or permission. [Issue #3](https://github.com/ruvnet/Agent-Name-Service/issues/3) remains open for issuer rotation, distributed revocation, rollback protection, tenant authentication, and revocation-aware MCP semantics. [PR #4](https://github.com/ruvnet/Agent-Name-Service/pull/4) received a scoped exact-head review.

**Adversarial/reward-hack check.** The MCP `valid` label was not promoted to authorization, and the local benchmark was not relabeled as distributed or production performance.

**ACCEPT**

### 4. agentic-voice — credential and provider boundary

**Research hypothesis.** Current-tree effect tracing plus secret-lifecycle evidence can distinguish code removal from revocation and production qualification.

**Implementation hypothesis.** At `a0940c9989617902b7c2f6d091ab5d71fe8a947c`, bounded provider routes and removal of the historical credential close the production security risk.

**Baseline and threshold.** Threshold: authorization before any provider effect; fixed destinations; redirect, size, frame, token, output, time, cancellation, and concurrency bounds; exact-head green workflows; privately verified credential revocation; live browser/provider replay; and shared deployment spending controls.

**Evidence.** The current tree credibly enforces the software controls and reports 15 domain security/provider tests, two SDK stdio tests, bounded child processes, and zero current runtime audit findings. [MetaHarness/Autogenous](https://github.com/ruvnet/agentic-voice/actions/runs/34542365238) and [Voice validation](https://github.com/ruvnet/agentic-voice/actions/runs/34542365058) pass. Historical credential revocation is not verified, and no live provider, microphone, multi-instance quota, cost, or quality receipt exists. Existing [issue #3](https://github.com/ruvnet/agentic-voice/issues/3) remains the private-owner gate; no credential or replacement value was disclosed. [PR #4](https://github.com/ruvnet/agentic-voice/pull/4) received a scoped review.

**Adversarial/reward-hack check.** Removal from current source was not counted as revocation, and synthetic/current-tree tests were not counted as live provider validation.

**REJECT**

### 5. auto-browser — inert snapshot containment

**Research hypothesis.** DNS rebinding, address-class, redirect, browser-network, deadline, and process-group negative controls can establish the bounded inert-snapshot envelope without implying general browser automation.

**Implementation hypothesis.** At `2b04e57faeaeb06b62e60b9315e02fdfe5780155`, the supported snapshot path prevents private-network fetches and browser side effects while terminating bounded hostile inputs.

**Baseline and threshold.** Threshold: exact HTTPS origin, credentials/hash/nonstandard-port rejection, all-address public validation with address pinning, no redirects, bounded HTML/deadlines, sandbox enabled, script/network/service-worker suppression, process-group cleanup, adversarial loopback/Chromium tests, and exact-head green CI.

**Evidence.** Six domain cases include actual DNS-loopback denial and inert Chromium extraction. Dependencies are pinned and the originating-team audit reports zero production findings. [Validation/package](https://github.com/ruvnet/auto-browser/actions/runs/34542459279) and [MetaHarness/Autogenous](https://github.com/ruvnet/auto-browser/actions/runs/34542462102) pass. Acceptance excludes unprivileged-container portability, public slow-drip behavior, authenticated/dynamic sites, disclosure actions, and production field memory; these remain under [issue #5](https://github.com/ruvnet/auto-browser/issues/5). [PR #6](https://github.com/ruvnet/auto-browser/pull/6) received an exact-head review.

**Adversarial/reward-hack check.** Software-renderer success was not counted as interactive-browser, container, or production evidence.

**ACCEPT**

## Security audit receipt

Read-only assessment covered repository security policies where present, manifests and lockfiles, changed trust boundaries, workflow results, and public dependency/audit output. No new remotely exploitable critical or high production vulnerability was confirmed. QuDAG has a confirmed release-gate failure with dependency and security signals whose production reachability remains unconfirmed. agentic-voice retains a private owner action for credential revocation. No secret value, exploit instruction, or private-repository detail was published.

A runnable checkout was unavailable, so pinned Ruflo `3.25.6` dependency/secret/STRIDE commands and fresh local native/WASM tests could not be executed. GitHub-hosted exact-head security evidence was used without claiming an independent local scan. QuDAG has no repository `SECURITY.md`; sensitive follow-up should use a private advisory rather than a public reproduction.

## SOTA and authoritative sources

- [NIST FIPS 203](https://csrc.nist.gov/pubs/fips/203/final) defines ML-KEM-512/768/1024 and lists a potential-update errata note. It is the authoritative QuDAG primitive contract, though older than the preferred 90-day window.
- The July 28, 2026 [MCP tools specification](https://modelcontextprotocol.io/specification/2026-07-28/server/tools) requires input validation, access control, rate limiting, output sanitization, client result validation, timeouts, and audit logging. This informs every MCP effect-boundary gate.
- GitHub's current [secure-use guidance](https://docs.github.com/en/actions/reference/security/secure-use) states that a full commit SHA is the only immutable action reference. Mutable action tags remain portfolio supply-chain debt.
- The [OWASP Secrets Management guidance](https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html) separates creation, rotation, revocation, and expiration and requires potentially compromised secrets to be revoked. This directly supports the agentic-voice verdict.

## Ruflo research-loop receipt

- **Prior memory recalled:** final-effect enforcement, exact-head holdouts, restart/reopen evidence, and the distinction between source removal and secret revocation. The redacted Core Memory record was retrieval-verified before the cycle.
- **Parent strategy:** exact-head required-workflow and final-effect-boundary tracing; authoritative-source-first; independent negative controls. Hash `6b94030ad14b7f194bed227354d3cb256685f6c1b0214afca28b6ec3a967a14e`.
- **Candidate generation:** add current-tree-removal versus lifecycle-revocation checks, post-merge receipts, and restart/reopen identity controls. Hash `982dc703445658ee35229d3d34a098e7e1da6c43a94d23534f7325e1e8c2596c`.
- **Holdout:** QuDAG release qualification and agentic-voice credential lifecycle were excluded from candidate formulation, then used to test the method.
- **Measured delta:** authoritative evidence mapped to 5/5 cohort questions and surfaced four material boundary contradictions: roster membership versus authenticated admission; merged source versus release receipt; binding validity versus revocation-aware authorization; current-tree removal versus credential revocation. A comparable replayable parent composite and connector cost metric were unavailable, so the preregistered 10% promotion threshold could not be evaluated.
- **Sources added/rejected:** four authoritative sources above were retained. Vendor/originating-team pass counts were retained only as attributed evidence; no withdrawn, circular, or uncited research claim was promoted.
- **Cost/time:** bounded within the 45-minute per-repository cap; token and monetary cost were not exposed by the available connector.
- **Runtime degradation:** no runnable Ruflo 3.25.6 checkout, durable Ruflo memory runtime, validated RuVector/RVF backend, or local MetaHarness evaluator was available. No strategy promotion, Ruflo memory write, retrieval verification, or self-learning claim was made.

**INCONCLUSIVE**

## Autogenous exploration sub-receipt

- **Frozen topology:** four roles—primary-source researcher, falsification critic, security/privacy critic, and benchmark designer. Configuration hash `4f0efdedb6a2d2756529ba61524be0f10d40bc32e7f4ef50cf0d55bd189d2f1d`.
- **Parent/holdout:** the Ruflo parent above; held-out QuDAG release and agentic-voice lifecycle questions; default 15% authoritative-coverage or contradiction-recall threshold with no quality/cost regression.
- **Communication:** structured evidence-delta fallback. LatentMesh semantic-delta transport was not claimed.
- **Dissent:** the strongest dissent was that green focused tests or source construction could justify scoped acceptance. MetaHarness-style critique retained scoped acceptance for Agent Name Service and auto-browser, but rejected broader Ruflo, QuDAG, and agentic-voice claims.
- **Metrics:** no executable Autogenous runtime, deterministic replay, token/cost receipt, duplicate-source rate, or held-out comparative score was available. No candidate strategy or factual conclusion was promoted; no Ruflo memory key was written.

**INCONCLUSIVE**

## Constellation integration and actions

Dream Machine supplied the governance contract and durable receipt. Ruflo supplied the reviewed learning/consensus surface and the manual research-loop structure. MetaHarness and Autogenous workflow evidence was consumed where exact-head runs existed, without claiming local runtime execution. RuVector/RuVector WASM retrieval was not claimed because a validated backend was unavailable. Core Memory supplied the prior aggregate lesson set and received a [retrieval-verified redacted aggregate checkpoint](https://github.com/ruvnet/core-memory/issues/20#issuecomment-5630760703).

Actions this cycle: **one new issue, five exact-head COMMENT reviews, one evidence draft update, zero implementation PRs, zero direct pushes, zero merges, zero releases, zero deployments, and zero automerge changes**.

## Blockers and next cohort

Blockers: no runnable repository checkouts; no durable Ruflo memory or governed signed-federation endpoint; no validated RuVector/RVF retrieval; no local MetaHarness or Autogenous runtime; QuDAG red release workflows; Ruflo cold-install failure; no private credential-revocation receipt; and missing live browser/provider/container evidence.

Next cohort: QuDAG issue #17 release recovery, Ruflo authenticated join/leave/vote and clean installation, Agent Name Service revocation-aware MCP semantics, agentic-voice private credential-lifecycle closure, auto-browser slow-drip/container qualification, MetaHarness dependency remediation, deterministic RuVector Workspace/native-WASM-RVF recovery, LatentMesh calibration, APx, and neglected high-risk repositories.
