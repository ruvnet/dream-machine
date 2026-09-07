# Dream Machine portfolio report — 2026-09-02

## Executive result

- Inventory: 316 owned repositories; 214 public, 102 private, 0 archived, 11 empty.
- Search indexing: 278 indexed, 38 unindexed.
- Default-branch activity since 2026-09-01: at least 167 commits across 8 public repositories. One public repository reached the 100-result commit cap, so this is a lower bound.
- Private activity: 17 commits in 1 repository, aggregate only.
- Open-state scan: 100 open pull requests and 100 open issues returned at connector caps; counts are lower bounds.
- Deep cohort: Dream Machine, Ruflo, MetaHarness, ruClip, RuView.
- Verdict distribution: 1 ACCEPT, 3 REJECT, 1 INCONCLUSIVE.
- Actions: one existing security issue materially updated; four exact-head PR reviews; this existing Dream draft PR reused; zero new issues, implementation PRs, direct pushes, merges, releases, or automerge changes.

No private repository identity, finding, branch, issue, commit, or dependency appears in this report.

## Contract and prioritization

The default branch of `ruvnet/dream-machine` was read first at
`7933c3599abe22df5290f4609d1f93f598feb3de`. The binding sources were
`README.md`, `SECURITY.md`, `dream.config.json`, ADR-0001,
`packages/compile/src/index.ts`, CI, package manifests, and the main ledger.

Security and functionality overrides selected:

1. Ruflo's published production dependency signal and unreachable CVE gate.
2. MetaHarness root tests not executed by its nominal test command.
3. ruClip cross-company authorization and real-bridge recall defects.
4. Dream Machine's stale durable-memory detector.
5. RuView's new RuForecast evidence and automated submodule updates.

## Repository 1 — Dream Machine

### Frozen hypothesis

Given the daily ledger is the only durable cross-night memory, adding deterministic
freshness metadata to `learningSignals()` will flag the real stale ledger while
preserving append/verify behavior and all existing tests.

### Baseline and candidate

- Baseline: 98 tests; no staleness signal; main ledger last dated row 2026-08-26.
- Candidate: PR #62, exact head `ee8ca6739fe859a0a6bad210475f5157475da3a6`.
- Measured: 107/107 tests, +9 tests, zero reported regressions.
- Real ledger: `lastRowDate=2026-08-26`, `daysSinceLastRow=6`,
  `ledgerStale=true`.
- Exact-head CI and CodeQL passed.
- Reward-hack check: no existing tests, evaluators, gold data, promotion gates,
  append/verify behavior, or protected-branch authority changed.
- Residual risk: detection does not solve the persistence architecture that
  leaves nightly evidence on unmerged branches.

**ACCEPT**

## Repository 2 — Ruflo

### Frozen hypothesis

The published Ruflo MCP bridge's critical `protobufjs` dependency is both
remediated to a patched floor and proven unreachable from untrusted
schema/descriptor input, without breaking embeddings, MCP limits, or required
security workflows.

### Evidence

- Existing issue #3157 reproduces a bare `ruflo@3.38.20` production install
  with 1 critical, 12 high, and 25 moderate audit signals.
- The embedding path is live on each `memory_store`, but the official advisory
  requires attacker influence over a protobuf schema or JSON descriptor loaded
  through reflection/code generation. Caller-controlled text-to-embedding
  reachability to that precondition is not yet demonstrated.
- Patched `protobufjs` floor: 7.5.5 (or 8.0.1).
- The root CVE job fails before providing a complete release gate; the v3 audit
  alone is not equivalent to auditing the published package tree.
- PR #3160 focused reward tests report 56 -> 62, but exact-head state is five
  failed workflows and CodeQL alone green.
- The issue now records a patch/reachability/latency/security-workflow gate.
- MCP SOTA applicability: the 2026-07-28 revision removes protocol-level
  sessions and makes method/tool headers available for gateway authorization
  and metering; Ruflo's current hard-coded per-session limiter therefore also
  needs an explicit legacy-compatibility decision.

**INCONCLUSIVE**

## Repository 3 — MetaHarness

### Frozen hypothesis

MetaHarness CI executes every intended root test and can legitimately claim a
green repository-level suite and safe release order.

### Evidence

- Existing issue #264 confirms `npm test` traverses workspaces and skips the
  root suite.
- Direct root execution on main `42f568b7`: 12 failed files, 294 passed,
  5 skipped; 20 failed assertions, 3,007 passed, 61 skipped.
- One suite fails during collection, so the true unexecuted count can be higher.
- Confirmed classes include ADR contract drift, plugin inventory mismatch,
  OpenClaw validation, diagnostic/score contract drift, CLI exit semantics,
  release-order mismatch, workflow provenance expectations, and upgrade false
  positives.
- `@metaharness/avo` is ordered after a dependent in the release sequence.
- No small candidate can safely turn on the root runner until failures are
  repaired or explicitly quarantined with owners and expiry.

**REJECT**

## Repository 4 — ruClip

### Frozen hypothesis

A shared ruClip/Ruflo bridge preserves company isolation for claims and can
retrieve an exact company/entity by stable key after more than ten sibling
records.

### Evidence

- Existing issue #5 was confirmed against a real bridge.
- Claims carry bare issue IDs without company scope, permitting collisions
  between companies that reuse common issue IDs.
- Issue persistence nests the canonical key under a goal; callers knowing only
  company and issue cannot perform the claimed exact lookup.
- `recallByKey` asks a similarity/prefix primitive for only ten results; on the
  measured seeded company the exact company record fell outside the top ten and
  `recallCompany()` returned null.
- The in-memory fake always returns the exact key, so existing CI does not model
  production retrieval ranking.
- A safe patch needs a compatibility/migration decision for existing bare claim
  IDs and exact-key storage. Increasing `topK` alone is not a correctness fix.
- No SECURITY.md exists on the default branch; shared-tenant deployments should
  treat the finding as private-advisory material while the already-public issue
  remains the deduplicated tracker.

**REJECT**

## Repository 5 — RuView

### Frozen hypothesis

The new RuForecast zero-shot comparison is reproducible from a clean checkout,
is attested by exact-head CI, and evaluates the current multivariate SOTA without
changing its frozen BIDMC windows or metrics.

### Evidence

- PR #1771 reports WQL improvements versus last-value:
  - Judge A: 18.4% to 41.6%.
  - Judge B: 12.5% to 33.3%.
- All five exact-head workflow groups pass, but none executes the Python
  evaluation harness or verifies the result table.
- The committed runner prepends `/tmp` and imports `bidmc_windows` from
  there; the documented clean command does not copy the committed module.
- Raw receipts, environment/model/data hashes, stochastic-repeat statistics,
  latency, and VRAM are absent.
- Google released TimesFM-3 on 2026-08-31: 330M parameters, over 1 trillion
  pretraining time points, native multiple targets/covariates, nine quantiles,
  and single-pass multivariate decoding. The PR's statement that TimesFM lacks
  native multivariate mode is therefore obsolete.
- PR #1772 advances two vendor submodules; all four consumer workflows are
  `action_required` and exact upstream targets are not validated.
- Exact-head reviews record clean-environment, receipt, TimesFM-3, cost, and
  upstream-provenance gates.

**REJECT**

## Security findings

- No new confirmed remotely exploitable critical/high vulnerability was
  established by this cycle.
- Confirmed critical dependency signal: Ruflo published production tree,
  GHSA-xq3m-2v4x-88gg / CVE-2026-41242. Exploit reachability remains unproven;
  release remediation is still required.
- Confirmed authorization-integrity defect: ruClip claim identity is not tenant
  scoped on a shared bridge. No new public exploit details were added.
- Confirmed assurance defect: MetaHarness root tests and at least one collection
  failure are absent from the normal green path.
- No secrets were printed or stored. No active network probe, production scan,
  credential test, or exploit execution was performed.

## SOTA sources and applicability

1. Google Research, “TimesFM-3: A zero-shot foundation model for multivariate
   forecasting,” 2026-08-31:
   https://research.google/blog/timesfm-3-a-zero-shot-foundation-model-for-multivariate-forecasting/
   Applicability: replaces RuView's univariate TimesFM-2.5 gap with a directly
   testable multivariate HR/RESP/SpO2 candidate on the frozen judges.
2. GitHub reviewed advisory GHSA-xq3m-2v4x-88gg, updated 2026-05-04:
   https://github.com/advisories/GHSA-xq3m-2v4x-88gg
   Applicability: exact patched floor and exploit preconditions for Ruflo.
3. MCP 2026-07-28 revision:
   https://blog.modelcontextprotocol.io/posts/2026-07-28/
   Applicability: stateless requests plus method/tool headers change how Ruflo
   should meter and authorize modern Streamable HTTP clients.

## Constellation relationships

- Dream Machine: evidence contract and cross-night freshness detection.
- MetaHarness: test/release assurance; currently rejects portfolio promotion
  while its root suite is skipped.
- Ruflo: MCP/claims/memory execution substrate; dependency and rate-control
  blockers propagate into ruClip.
- ruClip: company/goal/issue governance layer; real-bridge evidence exposes
  missing tenant and exact-key invariants.
- RuVector/AgentDB: semantic memory substrate; similarity retrieval must not be
  presented as exact-key storage.
- RuVector WASM: remains a compatibility gate for portfolio memory/evidence
  consumers; no new WASM candidate was accepted this cycle.
- RuView/RuForecast: sensor time-series workload that can now test TimesFM-3's
  native multivariate capability.

## Commands and remote evidence

- Repository inventory: authenticated GitHub pagination, pages 0..3 at 100/page.
- Open PR/issue scans: authenticated GitHub search, 100-result caps.
- Default-branch activity: repository search `user:ruvnet pushed:>=2026-09-01`
  plus per-repository commit enumeration; one public repository hit the
  100-commit cap.
- Exact-head workflow runs:
  - Dream #62: CI and CodeQL passed.
  - Ruflo #3160: CodeQL passed; five workflow groups failed.
  - RuView #1771: five workflow groups passed, but no Python evaluator job.
  - RuView #1772: four workflow groups require authorization.
- GitHub connector exposed no runnable checkout, so pinned Ruflo 3.25.6 scans,
  lockfile-aware local scans, MetaHarness local execution, and RuVector native/
  WASM replay could not be rerun in this session.

## Actions and blockers

- Materially updated existing Ruflo issue #3157 with advisory preconditions and
  a falsifiable remediation gate.
- Added exact-head reviews to Dream #62, Ruflo #3160, RuView #1771, and RuView
  #1772.
- Reused existing MetaHarness #264 and ruClip #5; no duplicates.
- Reused this existing Dream draft PR for the dated report and one ledger row.
- Zero implementation PRs, direct pushes, merges, releases, or gate weakening.
- Core Memory governed federation endpoint was not exposed. Only an aggregate,
  redacted GitHub checkpoint may be claimed.

## Next cohort

1. Ruflo patched production-tree candidate and schema-reachability regression.
2. ruClip tenant-scoped claim migration plus exact-key live-bridge contract.
3. MetaHarness root-suite recovery and release-order repair.
4. RuView TimesFM-3 multivariate, pinned clean-room replay with latency/VRAM.
5. RuVector Workspace CI and native/WASM receipt recovery.
