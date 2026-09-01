# Portfolio Dream cycle — 2026-09-01

## Decision summary

This cycle inventoried every accessible repository owned by `ruvnet`, deeply reviewed five active public repositories, accepted two narrowly scoped software improvements, rejected one unresolved execution-control hypothesis, and left two candidates inconclusive because required exact-head validation did not complete.

No repository was merged, released, promoted, pushed directly to a default branch, or configured for automerge. Private repositories appear only as portfolio aggregates.

## Inventory

- Owned repositories: **314**
- Public: **212**
- Private: **102**
- Archived: **0**
- Empty: **11**
- Public default-branch activity since the prior cutoff: **18 commits across 4 repositories**
- Private activity: **7 commits in 1 repository**, aggregate only
- Code-index enrichment: **273 indexed, 38 explicitly unindexed, 3 absent from the enrichment result**. All 314 repositories were still inventoried through repository pagination.

The public activity cohort was RuView (8 commits), minitoo-control (5), RuVector (4), and open-claude-code (1). Ruflo displaced a lower-risk rotation candidate because its open policy PR affects a live execution-control boundary.

## Contract and evidence rules

The default branch of Dream Machine was read first. Its README, SECURITY policy, `dream.config.json`, ADR-0001, compiler, and ledger remained the execution contract. The cycle froze one falsifiable hypothesis per deep repository, separated software-envelope evidence from production/model claims, required exact-head CI where available, and used only `ACCEPT`, `REJECT`, or `INCONCLUSIVE`.

Security review was read-only until a confirmed, minimal, issue-linked MiniToo patch was selected. No secrets, private repository names, production endpoints, or exploit payloads were published.

## Deep repository reviews

### 1. ruvnet/minitoo-control

**Frozen hypothesis.** A 262,145-byte text message is rejected at the WebSocket transport before `onEvent` receives it, while existing URL, authentication, rendering, packet, build, and audit gates remain green.

**Baseline.** The application checked `data.length` only after delivery. The `ws` transport therefore used its 104,857,600-byte default even though the project promised a 262,144-byte event ceiling.

**Candidate.** [Issue 1](https://github.com/ruvnet/minitoo-control/issues/1) and [draft PR 2](https://github.com/ruvnet/minitoo-control/pull/2) pass `maxPayload: MAX_EVENT_BYTES` at construction and add a real loopback adversarial test.

**Measured result.** The transport allocation ceiling is reduced from 100 MiB to 256 KiB, a **400× tighter bound**. The oversized-frame regression completed in **22.7 ms**. Exact head `555e790c` passed **19/19 tests**, the Swift transport build, and `npm audit --omit=dev` with **0 vulnerabilities** in [CI run 33481090025](https://github.com/ruvnet/minitoo-control/actions/runs/33481090025).

**Adversarial and reward-hack checks.** The test uses an actual `WebSocketServer`, counts delivered events, waits for disconnect, terminates sockets, and closes the reconnect loop. No existing test, threshold, dependency, or policy was weakened.

**Verdict: ACCEPT**

### 2. ruvnet/RuView

**Frozen hypothesis.** [PR 1766](https://github.com/ruvnet/RuView/pull/1766) supplies a backend-bounded, clean-room experimental Rust forecasting envelope whose feature-off, CPU, hosted-wire, privacy, security, and compile contracts pass without claiming model accuracy, calibration, latency, memory, CUDA runtime, Docker runtime, or live-provider behavior.

**Evidence.** Exact head `2824cd7f` passed all six pull-request workflows: RuForecast Rust CI, repository CI, security scanning, CSI data policy, benchmark guard, and fix-marker guard. The large profile's **20,285,108** parameters are a structural design assertion. The benchmark ledger intentionally has no accepted runtime or quality row. Hosted v1 remains synthetic-only and RuVector remains evaluation-only.

**SOTA applicability.** Google Research released TimesFM-3 on **August 31, 2026**, reporting a 330M-parameter native multivariate zero-shot model trained on more than one trillion time points and leading results on major external benchmarks. The applicable next gate is a leakage-free, identical-example comparison against seasonal naive and an external SOTA baseline, with RuView's frozen weighted-quantile-loss and coverage thresholds. No Google source, weights, outputs, or configuration were used by this review. Source: [Google Research: TimesFM-3](https://research.google/blog/timesfm-3-a-zero-shot-foundation-model-for-multivariate-forecasting/).

**Adversarial and reward-hack checks.** Green compilation is not model-quality evidence; open production gates remain explicit. The review was recorded on the exact commit.

**Verdict: ACCEPT**

### 3. ruvnet/RuVector

**Frozen hypothesis.** The merged signed retrieval-anchor change binds Ed25519 receipt roots to version, purpose, issuer key, index scope, issuance time, and root; batched signing preserves complete tamper rejection while reducing amortized signing cost below 10% of per-query signing.

**Measured evidence.** The recorded benchmark reports approximately **15.6 µs → 1.1 µs/query** at batch 128, about **14× lower**, with **1,500/1,500** root, signature, and proof tamper trials rejected. Native verification, benchmarks, clippy/format, supply-chain, regression, NAPI, and WASM dedup workflows passed on merge commit `d8c8e94b`.

**Blocker.** Required [Workspace CI](https://github.com/ruvnet/RuVector/actions/runs/33412269834) was cancelled, and one dynamic dependency update job failed. The new API is experimental and not wired into a production query path. Organizational key registry, rotation, revocation, freshness policy, and real-consumer replay remain external gates.

**Verdict: INCONCLUSIVE**

### 4. ruvnet/open-claude-code

**Frozen hypothesis.** A denied Bash or subagent action launches zero processes because all effectful paths pass through one trusted dispatcher that enforces allow/deny rules, sandboxing, checkpointing, hooks, and persistence.

**Current reachability.** Default-branch code at `9d0052fc` still contains direct Bash process creation, an Agent path that constructs `bypassPermissions`, and settings for allow/deny and sandbox behavior that are not composed into one effect boundary. The latest commit only updates a version observation and has no attributable CI run.

The existing public [issue 17](https://github.com/ruvnet/open-claude-code/issues/17) remains the correct coordination record; no duplicate issue or additional sensitive implementation detail was published.

**Verdict: REJECT**

### 5. ruvnet/ruflo

**Frozen hypothesis.** [Draft PR 3152](https://github.com/ruvnet/ruflo/pull/3152) restores a stdio caller's tool budget after a 60,000 ms sliding window while preserving exact-boundary, partial-pruning, audit-time, and opt-in/default-off behavior.

**Evidence.** The patch reports **30/30** focused policy tests and pins the exact window boundary with an injected clock. The broader MCP sweep is **52/56** because two sibling distributions are absent.

**SOTA applicability.** The July 28, 2026 MCP specification requires servers to rate-limit tool invocations, while SEP-2567 removes protocol-level sessions. A wall-clock limit is therefore more forward-compatible than a permanent session-lifetime counter, but the field name remains semantically “per turn” while the implementation is a time-window limiter. Sources: [MCP tools security requirements](https://modelcontextprotocol.io/specification/2026-07-28/server/tools) and [SEP-2567](https://github.com/modelcontextprotocol/modelcontextprotocol/blob/main/seps/2567-sessionless-mcp.md).

**Blocker.** The exact candidate head `90f38192` has no workflow run. Its stacked parent [PR 3139](https://github.com/ruvnet/ruflo/pull/3139) has CodeQL green but cross-agent, CI/CD, CVE, verification, and V3 workflows red. The remaining stdio-only scope is disclosed.

**Verdict: INCONCLUSIVE**

## Security and functionality findings

- New confirmed medium availability/resource-integrity finding: MiniToo's documented 256 KiB event limit was not enforced before WebSocket message assembly. Issue-linked draft remediation is green.
- No new critical or high production vulnerability was confirmed.
- Open Claude Code's existing high-impact execution-control boundary remains unresolved on its existing public issue.
- RuVector's signed-anchor feature has strong focused evidence but cannot receive portfolio acceptance while required workspace validation is cancelled.
- Ruflo's policy reset is directionally correct but cannot receive security acceptance without exact-head and parent-workspace validation.

## Constellation relationships

- **Dream Machine** supplies the evidence contract, bounded rotation, verdict vocabulary, and durable ledger.
- **RuView** supplies privacy-labelled sensing and the experimental forecast envelope.
- **MiniToo Control** consumes an allowlisted, read-only RuView projection and now enforces the same byte boundary at transport and application layers.
- **RuVector** supplies evaluation-only retrieval for RuForecast and native/WASM compatibility evidence; signed roots are a future provenance primitive, not activation authority.
- **Ruflo** supplies opt-in MCP execution governance; its current rate-limit candidate remains stdio-scoped and unpromoted.
- **Open Claude Code** is the unresolved downstream execution boundary that must consume governance through one trusted dispatcher.
- **MetaHarness** was not treated as evidence for this narrow MiniToo fix because no repository-specific adapter or runnable checkout was exposed. RuView's native exact-head contract suite supplied the measurable evaluator. A mock or generic Darwin leaderboard would not establish candidate fitness.
- **Core Memory** receives only this cycle's aggregate coordination facts. No signed federation-persistence claim is made because a governed federation endpoint was not available.

## Actions and limits

- New issues: **1** — MiniToo [#1](https://github.com/ruvnet/minitoo-control/issues/1)
- Materially updated existing issues: **0**
- New implementation draft PRs: **1** — MiniToo [#2](https://github.com/ruvnet/minitoo-control/pull/2)
- Exact-head PR reviews: **2** — RuView #1766 and Ruflo #3152
- Evidence draft PRs: **1** — this portfolio report
- Direct pushes to default branches: **0**
- Merges/releases/automerge changes: **0**
- Public disclosure of private repository details: **0**

## Blockers and coverage debt

1. Three repositories were absent from the code-index enrichment result even though repository pagination covered all 314.
2. No general runnable checkout was exposed for pinned Ruflo 3.25.6, MetaHarness, lockfile-aware multi-ecosystem, secret, or STRIDE scans.
3. RuVector Workspace CI was cancelled.
4. Ruflo's candidate has no exact-head workflows and its parent has five red workflows.
5. Open Claude Code's version-only commit has no attributable CI and does not alter the trusted-dispatch boundary.
6. RuView has no accepted accuracy, calibration, runtime, memory, CUDA, Docker, live Fal, or production-integration receipt.
7. Hardware rendering/sensing was not exercised for MiniToo or RuView.

## Next cohort

1. MiniToo PR 2 exact-head retention and human review.
2. RuVector Workspace CI recovery plus a real signed-anchor consumer replay.
3. Ruflo parent/candidate reproducibility and all-transport policy composition.
4. Open Claude Code trusted dispatcher with zero-process denial tests.
5. RuView frozen quality/calibration benchmark against seasonal naive and a current external SOTA baseline.

## Completion gate

The accepted MiniToo verdict remains valid only while draft PR 2 is green on exact head `555e790c`, stays unmerged, and preserves the 262,144-byte cap. RuView acceptance remains limited to the experimental software envelope. Every other promotion remains blocked by the evidence gaps above.
