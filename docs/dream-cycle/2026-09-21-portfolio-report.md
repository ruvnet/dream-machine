# Dream Machine portfolio cycle — 2026-09-21

## Executive receipt

This cycle evaluated the exact-owner Ruvnet portfolio against the default-branch Dream Machine contract at `aa931caad5dd0108253645bba0ab1481ad7da0ee`. It read the README, SECURITY policy, `dream.config.json`, ADR-0107, the ruOS runbook, manifests, workflows, tests, and compiled pipeline before selecting work.

- Inventory: **322 owned repositories** — 219 public and 103 private; none archived; 284 indexed, 38 unindexed, and 11 empty.
- Activity since the prior checkpoint: one observed public default-branch commit in one repository. Private activity was zero in aggregate.
- Open-state searches reached connector limits at at least 100 pull requests and 100 issues.
- Deep reviews: five. Verdicts: zero `ACCEPT`, five `REJECT`, zero repository-level `INCONCLUSIVE`.
- Changes: four exact-head COMMENT reviews; zero new issues, implementation PRs, direct default-branch pushes, merges, releases, deployments, automerge changes, or research-strategy promotions.
- Private repositories are represented only by aggregates. No secret, private identity, exploit instruction, or redacted elevated-finding detail appears here.

Passing a source test is not delivery. Every reviewed candidate failed at a later state: real package, persisted state, malformed evidence, production caller, or effective authority.

## Contract and baseline

The governing inputs and SHA-256 digests were:

- `README.md`: `24fad88c6cfadb7b001904a5357b79cc4a5397afdbf85f772012e067f9874321`
- `SECURITY.md`: `624887dd1c2c7679e7b359f8638e8cb08768dc7f3edb253761ee137cb1b022a5`
- `dream.config.json`: `1df9b95540b4d2fa33bac98f30b0e898763277d6dd2bb18544d511ffd933ee63`
- ADR-0107: `10eff15d20b63703e159b24091d39666cc8eda455da9d7579af6c7e4acc3838f`
- ruOS runbook: `b10cb10844a6dbf045c80e0d814fd8c2c379e77eae007c4000cd37df4eabb2eb`
- compiled pipeline: 14,361 bytes, SHA-256 `6f8e1f5dd58921309dbf58a9b4f6f94cddcd0679f6568f89537730c26140ef28`

Dream main validation passed 645/645 Vitest tests, 140/140 governance checks, typecheck, build, lint, edge contracts, development policy, and a production dependency audit with zero vulnerabilities. A pinned read-only Ruflo 3.25.6 deep scan reported zero findings.

Ruflo initialized a project-local hybrid memory with bundled `all-MiniLM-L6-v2`, 384 dimensions, HNSW enabled, and 6/6 initialization checks. The fresh local store returned no prior result; continuity was therefore recovered from the verified Core Memory and signed-federation records, not inferred from an empty database.

## Portfolio triage

Selection used the contract weights: security 35%, functionality and production impact 30%, change velocity 10%, measurable optimization 10%, SOTA relevance 10%, and review age 5%. Critical security or functionality evidence could override scoring. Dream Machine, MetaHarness, Ruflo, and RuVector ranked through active implementation risk. Open Claude Code rotated upward as a neglected, high-impact execution boundary. Archived repositories were excluded from mutation; there were none.

Prior accepted-but-unintegrated work was inspected first. Dream PR #125 was only proposed/reproduced: it was not integration-ready, merged, deployed, or live-verified. No other reviewed candidate crossed those later stages.

## Deep reviews

### Dream Machine PR #125

Frozen hypothesis: the candidate rejects invalid screenshot bytes and ships the trusted verifier through the actual CLI artifact without authority, compatibility, or resource regression.

Exact head `e44cadfa755550a92dcb0852c77618a34072292f` materially improves three cases: bad IDAT CRC, invalid zlib, and decompression-bound violations changed from `ACCEPT` to `REJECT`. A valid fixture remains accepted and explicit encoded, decoded, pixel, and evidence-file ceilings remain bounded.

The actual unmodified `npm pack -w packages/cli` artifact installed but could not start: its published ledger dependency lacks workspace exports imported by the candidate. The committed packaging test instead bundles and rewrites a synthetic package, so it cannot qualify the publishable manifest. Independent valid-CRC/zlib probes also showed that indexed images without mandatory palette data, grayscale images with forbidden palette data, and duplicate palette chunks still produce `ACCEPT`. [PNG 3 §11.2.2](https://www.w3.org/TR/png-3/#11PLTE) requires these color-type, length, and cardinality rules.

Validation: 645/645 tests, 146/146 governance checks, typecheck/build/lint/policy, full audit, [CI 35494870253](https://github.com/ruvnet/dream-machine/actions/runs/35494870253), and [CodeQL 35494870210](https://github.com/ruvnet/dream-machine/actions/runs/35494870210) passed. These green checks do not cover the two failing holdouts.

Action: exact-head [COMMENT review 5263766510](https://github.com/ruvnet/dream-machine/pull/125#pullrequestreview-5263766510). Integration stages: proposed yes; reproduced partially; integration-ready no; merged no; deployed no; live-verified no.

Verdict: **REJECT**

### MetaHarness PR #337

Frozen hypothesis: `buildScorecard` can no longer mask High MCP risk behind a promotable state across all final consumers, malformed/missing/numeric evidence, live/replay parity, and a clean packed artifact.

Exact head `14cdad4db393b0da2ea09755c3fb64c68c2946f1` repairs the narrow valid-policy case: valid High policy reports score 97, Grade C, and process exit 1; Low and Medium controls remain stable. Build, TypeScript, 576 tests with two skips, [CI 35499232231](https://github.com/ruvnet/metaharness/actions/runs/35499232231), and [Real Tools 35499232255](https://github.com/ruvnet/metaharness/actions/runs/35499232255) passed, including a clean packed-consumer replay.

Present-but-malformed or JSON-`null` policy evidence is still collapsed into the absent-policy state. Across the library, text, JSON, bundle, out-file, and packed consumer it returns score 100, Grade A, exit 0, `mcpRisk: None`, and `releaseReady: true`. Structured valid-High output also omits an authoritative grade/exit while retaining `releaseReady: true`. Required [Security 35499232246](https://github.com/ruvnet/metaharness/actions/runs/35499232246) remains red on three unchanged high-or-greater web-UI dependency findings; no new critical/high finding was attributed to this diff.

Action: exact-head [COMMENT review 5263766681](https://github.com/ruvnet/metaharness/pull/337#pullrequestreview-5263766681). The review requires distinct absent/disabled and present-invalid states, object/schema validation, malformed/null/unreadable controls through all outputs, authoritative structured promotion state, and green required security checks.

Verdict: **REJECT**

### Ruflo PR #3385

Frozen hypothesis: case-folded denylist controls block caller-controlled search-path variables across every reachable execution path while preserving safe inherited environment variables and cross-platform behavior.

Exact head `b067a3fd5f3fec3076e7246ffc786ae08315965e` passed 32/32 focused tests. The baseline accepted 4/4 representative unsafe names; the candidate rejected 4/4, rejected 3/3 case variants at create time, and preserved the safe inherited-variable control.

Two held-out states fail. A legacy persisted session retains a newly denied variable because the execution boundary does not revalidate durable state. A clean install of the actual CLI tarball also resolves the previously published cli-core package, so 2/2 newly denied variables remain accepted by the shipped consumer. CI overlays locally built cli-core files into `node_modules`; that proves source integration, not package delivery. The committed receipt is bound to the base rather than the candidate head.

Exact-head [CVE Audit](https://github.com/ruvnet/ruflo/actions/runs/35569353944), [Cross-Agent Integration](https://github.com/ruvnet/ruflo/actions/runs/35569353949), [CodeQL](https://github.com/ruvnet/ruflo/actions/runs/35569354041), [Verification Pipeline](https://github.com/ruvnet/ruflo/actions/runs/35569354022), and [V3 CI/CD](https://github.com/ruvnet/ruflo/actions/runs/35569353946) passed. [CI/CD 35569353985](https://github.com/ruvnet/ruflo/actions/runs/35569353985) remained in progress at final evidence freeze after Ubuntu/macOS success while Windows packaging was active. The pinned scan found zero signals; the production dependency audit contained 12 inherited findings, six high and six moderate, unrelated to this diff.

Action: exact-head [COMMENT review 5263766607](https://github.com/ruvnet/ruflo/pull/3385#pullrequestreview-5263766607), reusing [issue #3384](https://github.com/ruvnet/ruflo/issues/3384). It requires effect-time persisted-state revalidation, actual cli-core package delivery, an unmodified packed-consumer replay, exact-head witness binding, and completed Windows qualification. [npm package metadata](https://docs.npmjs.com/cli/v11/configuring-npm/package-json#bundleddependencies) is the authoritative delivery contract.

Verdict: **REJECT**

### RuVector PR #1002

Frozen hypothesis: canonical min-cut repairs the previous correctness gap, improves bridge survival by at least 15 percentage points, preserves recall and bounded latency, has a production caller, and qualifies restart/order and native/WASM/RVF behavior.

Exact head `0d564e0d6936a953c4234f9c8a5bb8162209aefc` returned identical canonical output in 30/30 repeated ordered-input trials. Legacy was valid in 40% and degenerate in 60%. Baseline, Soft, and Hard recall@10 were all 100%; 20/20 tamper trials detected alteration. Soft and Hard latency remained within the frozen 100× scalar ceiling and were 114.8×–199.4× faster than legacy over the meaningful scale sweep.

The mandatory outcome did not move: bridge survival was 66.7% for baseline, Soft, and Hard, a **0.0 percentage-point** gain against the required ≥15 points. There is one corpus seed, no input permutation/reload/independent-seed holdout, no production caller, and no restart/order or native/WASM/RVF qualification. Required [Workspace CI 35496876809](https://github.com/ruvnet/RuVector/actions/runs/35496876809) was cancelled after four hours in the shard containing the changed consumer. The lockfile was unchanged and a pinned read-only scan found zero signals. Recent [incremental directed min-cut research](https://arxiv.org/abs/2608.16382) reinforces actual-cut semantics but is not a drop-in validation for this undirected source-anchored implementation.

Action: exact-head [COMMENT review 5263766764](https://github.com/ruvnet/RuVector/pull/1002#pullrequestreview-5263766764).

Verdict: **REJECT**

### Open Claude Code main and issue #17

Frozen hypothesis: current dispatch cannot perform an unauthorized effect and enforces explicit authority, working-directory/tool bounds, time/cost/cancellation, and clean-consumer behavior.

Exact main `411dbc3e5a97b43bb69c9b049efc43ab74d4937b` failed both explicit allow/deny gates, both path-containment gates, and the descendant-cancellation gate: 0/5 trust-boundary gates passed. The clean plan-mode denial control passed. Parsed policy, sandbox, subagent, nested-path, and timeout claims do not reach the effective execution boundary. A separate elevated startup trust-boundary condition was confirmed and is withheld; use a [private security advisory](https://github.com/ruvnet/open-claude-code/security/advisories/new).

The local suite passed 1,008/1,008 tests; production audit reported zero vulnerabilities across 45 dependencies; the pinned Ruflo scan reported zero findings; and `npm pack --dry-run` succeeded with 72 entries. Exact-main [Nightly Verified Release 35556359826](https://github.com/ruvnet/open-claude-code/actions/runs/35556359826) passed but lacks lifecycle/adversarial coverage and uses mutable Action tags. Node documents that terminating a subprocess does not inherently prove descendant-effect cancellation. [Node child-process semantics](https://nodejs.org/api/child_process.html#subprocesskillsignal) and current [Claude Code permission semantics](https://code.claude.com/docs/en/permissions) support the frozen boundary.

[Issue #17](https://github.com/ruvnet/open-claude-code/issues/17) already covers public-safe policy, sandbox, persistence, checkpoint, subagent, and lifecycle remediation. None of open PRs #15, #18, or #21 resolves the boundary. No duplicate public issue or comment was created, and no elevated mechanics were disclosed publicly.

Verdict: **REJECT**

## Security and constellation receipt

No new remotely exploitable critical production vulnerability was confirmed. The elevated Open Claude Code condition is redacted and belongs in a private advisory. MetaHarness's required dependency aggregate remains red. Ruflo's inherited production audit findings are unchanged. Dream and RuVector read-only scans found no signals; these automated scans did not substitute for reachable lifecycle analysis.

Dream supplied governance and durable evidence; MetaHarness supplied adversarial promotion gates; Ruflo supplied coordination and validated local memory; RuVector supplied retrieval/graph primitives; Core Memory and the signed federation supplied redacted continuity; ruOS was reserved for isolated execution/observation. The recurring relationship is a state transition: policy must remain bound when source becomes package, configuration becomes effect, state survives restart, and cancellation is expected to prevent later effects.

## SOTA and authoritative-source receipt

Source cutoff was 2026-09-21. Queries targeted authoritative format, package, process, permission, MCP, min-cut, and evaluation contracts. Vendor-only performance claims, inaccessible outcomes, private mechanics, unversioned summaries, and synthetic production claims were excluded.

- [PNG 3 palette rules](https://www.w3.org/TR/png-3/#11PLTE): applies to Dream screenshot bytes. Baseline covered CRC/zlib/bounds but not palette cardinality/color-type invariants. Expected benefit: reject syntactically shaped but invalid evidence before hashing or promotion.
- [MCP tools specification, 2026-07-28](https://modelcontextprotocol.io/specification/2026-07-28/server/tools): applies to MetaHarness and Open Claude Code validation, access control, confirmations, timeouts, and result handling. Baseline conflated absent and malformed policy or parsed without enforcement. Expected benefit: fail closed at the effective tool boundary.
- [npm package-json delivery semantics](https://docs.npmjs.com/cli/v11/configuring-npm/package-json#bundleddependencies): applies to Dream and Ruflo clean consumers. Baseline source tests overlaid or rebuilt dependencies. Expected benefit: qualify exactly what users install.
- [Node child-process semantics](https://nodejs.org/api/child_process.html#subprocesskillsignal): applies to cancellation and process descendants. Baseline considered parent completion/timeout sufficient. Expected benefit: test persisted effects after cancellation.
- [Incremental Directed Minimum Cut, 2026-08-17](https://arxiv.org/abs/2608.16382): adjacent recent evidence for maintaining actual cut semantics. Baseline optimized a synthetic wrapper without an outcome gain. Expected benefit: require a real cut and downstream bridge-survival result before promotion.
- [Beyond Test Presence, 2026-07-13](https://arxiv.org/abs/2607.12068) and [BenchShield, 2026-09-10](https://arxiv.org/abs/2609.11028): apply to assertion strength, lifecycle states, and reward integrity. Expected benefit: prevent green-count and synthetic-consumer reward hacking.

## Research Loop Receipt

- Prior evidence: 2026-09-20 report, Core Memory comment `5748204712`, federation Result `aed093568791e47b4a5995434d5bfe8bead9edb12f2ab35939ac0c6257f00cdf`, rejected hypotheses, benchmark receipts, and unresolved final-consumer questions.
- Parent strategy: delivery-bound triangulation across authoritative bytes, shipped verifier, durable identity, and authenticated completion. Hash: `7cd6e611be1a270a531f35e4369a1d65c05d36cae4a35142c800c631d0458468`.
- Candidate: state-transition completeness across absent, malformed, persisted, packaged, execution, cancellation, cleanup, and recovery states. Hash: `518c5751a62b1b884c12e9a8048d04ba2794519dbfde7057a95f16c710060aad`.
- Frozen threshold: ≥10% improvement in authoritative coverage, contradiction recall, reproducibility, cross-stack applicability, and information gained per unit cost; no primary-source, citation, security, privacy, licensing, or held-out regression.
- Budget: one generation; at most 45 minutes per repository. Monetary/token accounting was unavailable, so cost-normalized promotion could not pass.
- Tuning set: MetaHarness malformed-policy, Ruflo persisted/package, and RuVector consumer/outcome states. Holdout: Dream real-package/PNG rules and Open Claude Code effective-authority/cancellation states.
- Result: material contradictions in 5/5 reviews, equal to the parent's 5/5 contradiction count — **0% improvement** against the frozen ≥10% threshold. The candidate expanded MetaHarness policy states from four to six (+50%) and reproduced both added contradictions, but the corpus was small and not a costed preregistered composite.
- Critique: inspected omitted final consumers, synthetic-package substitution, fail-open absent/malformed equivalence, durable-state upgrades, caller reachability, cancelled CI, order/restart parity, scan false negatives, mutable release claims, privacy, licensing, simpler controls, and pass-count reward hacking.
- Decision: retain the parent. No strategy promotion or positive-result preference.
- Reusable lesson stored under `portfolio-patterns/portfolio-2026-09-21-state-transition-completeness` with pinned Ruflo 3.25.6, `all-MiniLM-L6-v2`, 384 dimensions, vector storage enabled; exact retrieval was verified.

Research-loop verdict: **INCONCLUSIVE**

### Autogenous sub-receipt

Before parallel exploration, the single-agent parent, five repository questions, cutoff, roles, threshold, and stopping rule were frozen. Five independent roles covered primary-source review, replication, contradiction/security, benchmark design, and integration mapping. Topology/configuration hash: `cd66f6852ec00f4fc498c1d957f8f4e295079764289cc8d56b8620f65fdb3efe`. Communication used bounded ordinary structured messages; LatentMesh semantic deltas were unavailable.

Useful unique deltas included Dream's actual-tarball failure, MetaHarness malformed/null equivalence, Ruflo persisted/package gaps, RuVector's zero outcome delta, and Open Claude Code's post-cancellation/effective-authority failures. Dissent was retained: each of the first four candidates contains a bounded positive source-level improvement, and Open Claude Code's ordinary suite is green. None outweighs its frozen system boundary.

No validated Autogenous runtime, LatentMesh channel, token/cost counter, or deterministic Autogenous-versus-parent replay was available. Platform parallel review is not relabeled as Autogenous evidence. No research strategy or unverified factual conclusion was promoted.

Autogenous verdict: **INCONCLUSIVE**

## ruOS governed-evaluation receipt

Target selection excluded the personal Mac and ready-labeled desktops without a live heartbeat. The dedicated evaluation target `ruos-ruos-evolution-candidate-8dd713` was selected. A fixed harmless `true` probe and screenshot request each returned unavailable status. There was no numeric exit code, completion version 1, authenticated `completionVerified: true`, or screenshot bytes.

No stdout parsing, screenshot URL, personal session, shared desktop, candidate verifier, credential, or retry substitution was used. Exact baseline/candidate/environment execution could not be established, so no user-journey, deployment, or production claim was made.

ruOS verdict: **INCONCLUSIVE**

## Durable coordination and actions

- [Core Memory checkpoint 5756523913](https://github.com/ruvnet/core-memory/issues/20#issuecomment-5756523913): written and retrieval-verified.
- Signed federation Result `65de1a0aeedd7be85b97eb8b420816742d16ef466ceff0d076aeed9dca9b871d`: retrieval-verified.
- Four exact-head COMMENT reviews: Dream #125, MetaHarness #337, Ruflo #3385, and RuVector #1002.
- Existing public trackers were reused: Ruflo #3384 and Open Claude Code #17. No duplicate issue was created.
- Zero new issues, implementation PRs, direct default-branch pushes, merges, releases, deployments, automerge changes, or strategy promotions.
- No candidate passed the evidence gate, so no implementation was created or promoted.

## Blockers and next cohort

Blockers: Dream actual-package compatibility and complete PNG semantics; MetaHarness malformed-policy and structured-output integrity plus required Security; Ruflo persisted-state revalidation, cli-core delivery, exact-head receipt, and Windows completion; RuVector outcome delta, production caller, required Workspace CI, seeded/order/restart and native/WASM/RVF parity; private Open Claude Code authority remediation; unavailable isolated ruOS execution.

Next cohort: re-evaluate Dream #125 only after real-tarball and palette-negative gates; MetaHarness policy parsing and authoritative structured verdicts; Ruflo effect-time revalidation/package delivery; RuVector actual-cut outcome and cross-target qualification; private Open Claude Code remediation; QuDAG release recovery; RuView freshness/transactionality; and neglected high-risk repositories.

Evaluation is not promotion. Nothing was merged or deployed by this cycle.
