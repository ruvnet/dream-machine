# Dream Machine portfolio report — 2026-09-03

## Executive result

- Inventory: 316 owned repositories; 214 public, 102 private, 0 archived, 11 empty.
- Search indexing: 278 indexed and 38 unindexed.
- Default-branch activity since 2026-09-02: 105 commits across 8 public repositories. Two private repositories recorded 17 commits, aggregate only.
- Open-state scan: GitHub returned 100 open pull requests and 100 open issues at connector caps; both totals are lower bounds.
- Deep cohort: Ruflo, RuForecast, MetaHarness, RuVector, and RuView.
- Verdict distribution: 1 ACCEPT, 2 REJECT, 2 INCONCLUSIVE.
- Actions: five exact-head PR reviews, this existing Dream draft PR reused for evidence, zero new issues, implementation PRs, direct pushes, merges, releases, or automerge changes.

No private repository identity, finding, branch, issue, commit, or dependency is included in this report.

## Contract and prioritization

The default branch of `ruvnet/dream-machine` was read first at
`7933c3599abe22df5290f4609d1f93f598feb3de`. Binding sources were
`README.md`, `SECURITY.md`, `dream.config.json`, ADR-0001,
`packages/compile/src/index.ts`, CI, package manifests, and the main ledger.

Selection followed the configured 35/30/10/10/10/5 risk weighting with
security/functionality overrides. The cohort was selected for: a published
dependency remediation, a new hosted forecasting control plane, a sandbox
containment candidate, a new OAuth boundary, and a flashing/model-correctness
candidate plus private-advisory triage.

## Repository 1 — Ruflo

### Frozen hypothesis

PR #2981 removes the published protobuf advisory from the shipped plugin tree
without breaking protobuf/ONNX consumers.

### Baseline, candidate, and critique

- Candidate: PR #2981 at `e12abe0204c134fc720f0867895384958cc10477`.
- Baseline: issue #3157 reported one critical, 12 high, and 25 moderate
  production dependency signals in a published installation.
- Current default branch already carries a root `protobufjs >=8.7.2` override;
  the PR separately edits one plugin subtree and its lockfile.
- The title/body, override floor, and resolved lockfile describe different
  remediation targets.
- All nine exact-head workflow groups require authorization. Clean packing,
  production-only audit, ONNX/protobuf compatibility, signing, witness, and
  integration evidence therefore remain absent.
- Reward-hack check: no acceptance is inferred from a lockfile diff or a root
  override that may not match the published artifact.

Acceptance threshold: cleanly pack/install the exact release artifact, show the
resolved dependency path and zero affected production nodes, preserve ONNX and
MCP behavior, and pass every required security/verification workflow on the
exact head.

**INCONCLUSIVE**

## Repository 2 — RuForecast

### Frozen hypothesis

PR #2 makes every hosted training request governance-bound and budget-accounted,
including cancellation and callback handling, without regressing the Rust service.

### Baseline, candidate, and critique

- Candidate: PR #2 at `a802067f0444e10f267c5052119524de1b21747d`.
- Exact-head Rust CI run 33632267006 passed.
- The candidate adds authorization, timeouts, cancellation bookkeeping, tests,
  and CI, but no real fal.ai request, cancellation drill, signed webhook replay,
  or provider-cost reconciliation was executed.
- fal documents that cancellation of an in-progress request is cooperative and
  the request can still complete unless the application implements cancellation.
  Local timeout bookkeeping therefore cannot establish stopped compute or spend.
- Webhook delivery is retried; request-ID idempotency and authenticated callbacks
  must survive process restart rather than only an in-memory test.
- Reward-hack check: green local CI is not treated as provider lifecycle evidence.

Acceptance threshold: one non-production submit → running → cancel/timeout →
terminal callback trace, authenticated callback replay rejection, durable
request-ID idempotency, and reconciliation of local reservations with provider
cost after restart.

**INCONCLUSIVE**

## Repository 3 — MetaHarness

### Frozen hypothesis

PR #272 prevents a Tier-2 variant with a module-load side effect from being
spawned while preserving execution of a clean variant.

### Baseline, candidate, and measured delta

- Candidate: draft PR #272 at `d0efd59f634a1e851e11891425e64d301ffe8f53`.
- Adversarial baseline evidence records the marker side effect before preflight.
- Candidate evidence: blocked execution returns code 99, creates zero marker,
  rejects the multi-task path consistently, and preserves the clean control.
- Suite: 657 passed, 14 skipped. Exact-head CI, Real Tools, and Security workflows
  all passed.
- Functional delta: one modeled module-load side effect changed from executed to
  zero executions before spawn; no latency/throughput optimization is claimed.
- Compatibility scope: tested Node 22 non-Windows path only. Windows parity and
  the broader root-suite/release-ordering defect tracked by issue #264 remain out
  of scope.
- Reward-hack check: the adversarial marker is external to the result code, the
  clean control still runs, and no evaluator threshold or existing test was weakened.

Acceptance is intentionally limited to the tested fail-before-spawn software
envelope; it does not claim containment against actions outside the inspector's
model.

**ACCEPT**

## Repository 4 — RuVector

### Frozen hypothesis

Draft PR #958 provides an OAuth 2.1-compatible Claude.ai connection path while
preserving authorization integrity.

### Baseline, candidate, and adversarial critique

- Candidate: PR #958 at `830c42779865777a28f2a4796f912159a889a58e`.
- The reachable source does not enforce registered callback binding and PKCE
  end-to-end, and issued bearer tokens are not yet validated by the protected
  resource path.
- All six exact-head native, WASM, supply-chain, regression, formatting, and
  Workspace CI groups require authorization.
- MCP's July 28, 2026 authorization requirements mandate OAuth 2.1 safeguards,
  exact registered redirect validation, and protected-resource metadata.
- Sensitive reproduction detail is deliberately omitted from public evidence.
  Remediation should be reviewed through a private advisory before public hosting.
- Reward-hack check: metadata presence and token issuance are not accepted as
  proof that the resource boundary consumes and validates those tokens.

Acceptance threshold: negative tests for callback, PKCE, client/code/token,
replay, expiry, and audience binding; one complete register → authorize → token
→ protected-resource integration; every exact-head native/WASM/security workflow green.

**REJECT**

## Repository 5 — RuView

### Frozen hypothesis

PR #1782 fixes flashing portability, phantom occupancy, and timestamp handling
without weakening supported environments.

### Baseline, candidate, and adversarial critique

- Candidate: PR #1782 at `12d80e7c2d55b75e1c7acc1e9fb00664beec0444`.
- The flashing script embeds one maintainer-specific checkout and virtualenv path
  and accepts Wi-Fi credentials as a positional argument, contradicting its
  portability/security claim.
- The field-model change describes trace/r over nonzero covariance eigenvalues as
  unbiased noise without seeded evidence across rank-deficient aspect ratios.
- The timestamp clamp changes first-frame behavior without an explicit contract.
- The PR is non-mergeable and has no exact-head workflow run.
- Issue #1783 points to private security advisories. Their details were neither
  retrieved nor republished; maintainer private-advisory triage remains required.
- Reward-hack check: one white-noise fixture cannot establish estimator bias or
  supported-hardware compatibility.

Acceptance threshold: portable clean-checkout dry run; credentials excluded from
shell history/process arguments; seeded Monte Carlo p<n, p=n, and p>n cases with
a frozen bias threshold; explicit first-frame timestamp tests; all consumer
workflows green on the exact head.

**REJECT**

## Security findings

- No new remotely exploitable critical/high production vulnerability was confirmed.
- RuVector's candidate has a high-impact authorization-integrity blocker; public
  evidence is redacted to standards-level gaps and a private remediation path.
- RuView's existing private advisories remain unverified through this connector;
  no public details or severity claims were added.
- Ruflo's published dependency signal remains a release blocker, but attacker-
  controlled schema reachability in the current published tree is unproven.
- No secret, active exploit, credential test, production probe, or protected-
  surface change was performed.

## SOTA sources and applicability

1. MCP Authorization Security Considerations, 2026-07-28:
   https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization/security-considerations
   Applicability: exact callback validation and OAuth 2.1 safeguards for RuVector.
2. fal Asynchronous Inference and Webhooks documentation:
   https://fal.ai/docs/documentation/model-apis/inference/queue
   https://fal.ai/docs/documentation/model-apis/inference/webhooks
   Applicability: cooperative cancellation, retry/idempotency, and callback
   evidence gates for RuForecast.
3. Google Research, TimesFM-3, 2026-08-31:
   https://research.google/blog/timesfm-3-a-zero-shot-foundation-model-for-multivariate-forecasting/
   Applicability: 330M-parameter native multivariate zero-shot baseline for
   RuForecast and RuView.
4. Ding et al., “Multivariate Time Series Forecasting needs Cross Variable Loss,”
   submitted 2026-08-06: https://arxiv.org/abs/2608.05742
   Applicability: a falsifiable cross-variable structural objective for future
   RuForecast training, evaluated separately from point-wise loss.

## Constellation relationships

- Dream Machine supplies the execution contract, evidence ledger, and verdict gates.
- MetaHarness supplies adversarial fail-before-spawn validation and accepts one
  scoped containment invariant this cycle.
- Ruflo supplies the MCP execution substrate; unresolved published dependency
  evidence blocks release acceptance.
- RuVector/RuVector WASM supply retrieval and portable memory surfaces; OAuth
  promotion is blocked until native/WASM and authorization receipts agree.
- RuForecast and RuView form a training/evaluation pair for multivariate sensor
  forecasting; TimesFM-3 and CvLoss define the next clean-room baselines.
- Core Memory receives only a redacted aggregate checkpoint; no private identity
  or finding is federated publicly.

## Commands and evidence

- Inventory: authenticated GitHub pagination, four 100-repository pages.
- Open state: authenticated GitHub PR and issue search; each reached 100-result cap.
- Activity: `user:ruvnet pushed:>=2026-09-02` followed by per-repository
  default-branch commit enumeration.
- Exact-head workflow queries were run for all five candidates.
- Source/patch inspection covered manifests, lockfiles, CI, security policies,
  tests, trust boundaries, and release/runtime integration points where indexed.
- The connector exposed no runnable checkout. Pinned Ruflo 3.25.6 execution,
  lockfile-aware local scans, real fal provider testing, RuVector native/WASM
  replay, Windows MetaHarness failure injection, and physical RuView testing
  could not be rerun. Those claims remain INCONCLUSIVE or rejected as specified.

## Actions, blockers, and owners

- Exact-head reviews added to Ruflo #2981, RuForecast #2, MetaHarness #272,
  RuVector #958, and RuView #1782.
- Reused Ruflo #3157, MetaHarness #264, and RuView #1783; no duplicate issue.
- Reused Dream draft PR #62 for this report and exactly one ledger row.
- Maintainers own workflow authorization, private-advisory triage, and hardware/
  provider execution. Candidate authors own exact-head regression receipts.
- Core Memory's governed federation endpoint was not exposed; only a redacted
  GitHub aggregate checkpoint can be verified.

## Next cohort

1. Ruflo published-tree audit and protobuf/ONNX compatibility on a runnable checkout.
2. RuForecast real fal lifecycle, callback, idempotency, and cost reconciliation.
3. RuVector OAuth private remediation plus native/WASM exact-head CI.
4. RuView private-advisory triage and portable field-model validation.
5. Rotation into neglected public repositories, with MetaHarness Windows/root-suite follow-up.
