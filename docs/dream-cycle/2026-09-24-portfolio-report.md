# Dream constellation portfolio report — 2026-09-24

## Contract and scope

The cycle began from `ruvnet/dream-machine` default branch `main` at `aa931caad5dd0108253645bba0ab1481ad7da0ee`. Before portfolio work, the current `README.md`, `SECURITY.md`, `dream.config.json`, ADRs, manifests and lockfile, workflows, tests, and compiled pipeline were read as the execution contract. The human-only merge boundary, private-aggregate rule, fail-closed evidence gates, five-repository limit, exact-head validation, and one-verdict-per-hypothesis rule were preserved.

No merge, release, deployment, default-branch push, automerge change, production probe, archived-repository mutation, credential use, or public disclosure of private-repository detail occurred. A draft security regression PR was created only after affected source and published-artifact reachability were confirmed and a harmless baseline-sensitive regression gate was available.

## Portfolio inventory and prioritization

All accessible exact-owner repositories were paginated as 100, 100, 100, and 23 entries: **323 repositories**, comprising 220 public and 103 private. None are archived; 285 are indexed, 38 unindexed, and 11 empty. `ruPet`, created 2026-09-22, is the newly observed public repository. Private repositories appear only as aggregate counts.

Since the prior 2026-09-22 checkpoint, 25 public default-branch commits were observed across five repositories: Open Claude Code 2, RuVector 6, Ruflo 12, ruPet 2, and the ruvnet profile repository 3. Private activity was zero commits across zero repositories, aggregate-only. Complete public search returned **1,437 open pull requests** and **1,407 open issues** with `incomplete_results:false`.

Selection used security 35%, functionality and production impact 30%, change velocity 10%, measurable optimization 10%, SOTA relevance 10%, and review age 5%, with neglected-repository rotation and confirmed-risk override. The cohort was frozen before outcomes: Dream Machine PR #132, Ruflo issue #3411, RVM PR #78, RuVector PR #1016, and RuView PR #1889.

## Deep reviews

### 1. Dream Machine PR #132 — stale-state classifier boundary

Frozen software hypothesis: narrowing the stale-state matcher must retain the documented Darwin collision while rejecting unrelated failures in source, the release-packed CLI, and exact-head CI.

Exact head `4f7dd445` passed 647/647 Vitest tests, 140/140 governance checks, lint, typecheck, [CI 35710053879](https://github.com/ruvnet/dream-machine/actions/runs/35710053879), and [CodeQL 35710053897](https://github.com/ruvnet/dream-machine/actions/runs/35710053897). The official publish-preparation path produced a runnable local package.

The classifier has no evaluator identity at the decision boundary. A non-Darwin benchmark failure containing the exact phrase `child id already exists` is still classified as `stale-state` and exits 3 in both exact source and the release-packed CLI. The added tests exercise weaker phrases and do not cover this collision. [Node process semantics](https://nodejs.org/api/process.html) support treating exit status and diagnostic text as separate evidence, not inferring evaluator identity from an unscoped substring.

Action: exact-head [COMMENT review 5300590944](https://github.com/ruvnet/dream-machine/pull/132#pullrequestreview-5300590944).

Verdict: **REJECT**

### 2. Ruflo issue #3411 / draft PR #3412 — published helper delivery gap

Frozen software hypothesis: every shipped GitHub helper copy must use direct argv invocation, the regression must fail the affected baseline without executing an exploit, and the exact packed artifact must contain the guarded implementation.

Issue #3411 confirmed that published `@claude-flow/mcp@3.0.0-alpha.9` contains a reachable shell-interpreter boundary. Current main had already repaired source in May 2026, but the npm dist-tags still resolve alpha.9, the root lockfile still resolves alpha.9, and the existing smoke covered only two of three shipped copies while passing the affected baseline.

Draft [PR #3412](https://github.com/ruvnet/ruflo/pull/3412) at exact head `abf6da6bebbfc94a89598b3984098af0b3ad31ea` aligns the MCP package helper, covers all three copies, and adds a benign whitespace-bearing argv case that distinguishes direct argv delivery from historical shell splitting. Local exact-head validation passed 18/18 behavioral cases and syntax checks. The alpha.10 candidate pack contains 65 files; tarball SHA-256 is `e666573728a1e45ba5fb5c2fdf1ffed634a4348c689df0f5c988383290adca99`, packed-helper SHA-256 is `23ad4cbd23f79d1f9bcc919ce62a52e0aef2cd998d6f0f1929e1d4fd088e99aa`, and the packed execution path uses `execFileSync` without an `execSync(...)` call. Node documents that `exec` runs through a shell while `execFile` spawns directly by default. [Node child-process documentation](https://nodejs.org/api/child_process.html#child_processexecfilefile-args-options)

The change is draft, unmerged, and unreleased. The published alpha.9 remains affected and should be handled through a private security advisory and an authorized release. CVE Audit, no-MetaHarness smoke, Cross-Agent, CodeQL, Verification, and V3 CI/CD passed at the exact head; main [CI/CD 35964519578](https://github.com/ruvnet/ruflo/actions/runs/35964519578) was still executing at the evidence freeze. Therefore the safe implementation is not yet integration-ready or delivered.

Action: materially updated [issue #3411](https://github.com/ruvnet/ruflo/issues/3411#issuecomment-5808901155) and created draft [PR #3412](https://github.com/ruvnet/ruflo/pull/3412).

Verdict: **INCONCLUSIVE**

### 3. RVM PR #78 — acquired-resource quarantine

Frozen software hypothesis: an acquired resource remains quarantined until a separate current authorization transaction, including restart, cancellation, replay, and failure paths, with reproducible overhead and repository-native CI.

The 1,037-line candidate adds a useful reference model without dependency or lockfile change. Workspace check and tests passed in [CI 35874945126](https://github.com/ruvnet/rvm/actions/runs/35874945126). The design is relevant to September 13, 2026 [AcquireBound](https://arxiv.org/abs/2609.14744), which separates acquisition from activation and evaluates crash/retry and effect confinement.

The exact-head dedicated workflow [35874945140](https://github.com/ruvnet/rvm/actions/runs/35874945140) failed formatting before its tests and benchmark; Rust 1.77 was cancelled. Main CI has failing workspace/WASM Clippy and a current advisory gate. Restart safety is explicitly unimplemented, the ledger binds only sequence rather than resource identity, benchmark cases reset the ledger, cancellation and persistence atomicity are unmeasured, the receipt omits required bindings, and no production enforcement caller is integrated. The repository also lacks the license files promised by its manifest.

Action: exact-head [COMMENT review 5300591117](https://github.com/ruvnet/rvm/pull/78#pullrequestreview-5300591117), reusing MetaHarness issue #347 for the missing evaluator integration.

Verdict: **REJECT**

### 4. RuVector PR #1016 — TypeSafe release qualification

Frozen software hypothesis: the clean package must meet frozen accuracy, calibration, latency, API, platform, native/WASM, and supply-chain gates on an untouched holdout before release.

Exact head `54d1fbab` built and loaded five target packages. Independent clean-package replay passed 294 tests with zero failures and seven binding-dependent skips; repeated output was deterministic; the Linux x64 pinned-model path achieved native p95 24.764 ms; transfer held 19/26, or 73.08%, without regression. Typesafe, native, supply-chain, WASM, formatting, and regression workflows passed, and the production runtime audit found no high or critical dependency finding. Official [ONNX Runtime Node](https://onnxruntime.ai/docs/get-started/with-javascript/node.html) and [Web](https://onnxruntime.ai/docs/get-started/with-javascript/web.html) guidance supports qualifying native and browser execution separately.

Mandatory outcome gates failed: department accuracy was 109/150 = 72.67% versus 82.33%; ECE was 0.392697 versus at most 0.05; urgency was 61.33% versus the 71.33% train-majority baseline; frustration was 40.67% versus the 52.67% baseline. OOS and WASM latency were skipped. Four of five targets only built and loaded rather than running real pinned-model inference, the documented API remains incomplete, the evaluation set is not an untouched holdout, failed quality gates are report-only, and required Workspace CI [35901224549](https://github.com/ruvnet/RuVector/actions/runs/35901224549) was cancelled.

Action: exact-head [COMMENT review 5300591281](https://github.com/ruvnet/RuVector/pull/1016#pullrequestreview-5300591281).

Verdict: **REJECT**

### 5. RuView PR #1889 — provisioning-state confidentiality

Frozen software hypothesis: credentials and staging state remain owner-only across pre-existing files, failure, dry-run, read-only paths, restart, and every supported platform.

Exact head `8898a3fe` is unchanged since its prior rejection. Focused source tests passed 14/14 and all exact-head workflows were green. The implementation has a positive intent and uses a staging path.

Independent harmless replay under `umask 022` reproduced four final-consumer failures: a pre-existing fixed `.tmp` file remains mode 0644 and is promoted because truncation does not change its mode; the read-only state remains 0644 while credentials are emitted; generator-failure CSV state is 0644; and dry-run binary state is 0644. The exact-head workflows do not execute `test_provision_state`, and the pinned source scan did not detect these deterministic lifecycle failures. POSIX [`open`](https://pubs.opengroup.org/onlinepubs/9799919799/functions/open.html), Python [`tempfile`](https://docs.python.org/3/library/tempfile.html), and Microsoft [file security](https://learn.microsoft.com/en-us/windows/win32/fileio/file-security-and-access-rights) require platform-specific creation and access-control handling rather than assuming truncation makes an existing path private.

Action: reused the existing public-safe review; no duplicate comment was posted.

Verdict: **REJECT**

## Security and constellation receipt

One reachable elevated published-artifact condition was confirmed in Ruflo and handled without exploit instructions through issue #3411, draft PR #3412, and a recommendation for a private advisory and authorized release. No new remotely exploitable critical production vulnerability was confirmed. Broad pinned Ruflo scans reported many monorepo, fixture, example, documentation, and dependency signals; only findings confirmed against a realistic execution path were acted on. No secrets or private-repository details were published.

Dream Machine supplied governance and durable evidence; MetaHarness supplied adversarial promotion criteria; Ruflo supplied orchestration, the security regression, and project-scoped memory; RuVector supplied native/WASM evidence and retrieval primitives; Core Memory and the signed federation supplied redacted continuity; ruOS supplied an observation probe. The reusable constellation lesson is: a source fix is not remediation until the shipped artifact is fixed, and a regression must fail the affected baseline rather than merely pass on the candidate.

Ruflo 3.25.6 initialized project-local hybrid memory using bundled `all-MiniLM-L6-v2`, 384 dimensions, HNSW, and 6/6 health checks. The lesson was stored with strict `--no-upsert` under `portfolio-patterns/portfolio-2026-09-24-baseline-sensitive-delivery` and retrieved verbatim. This is a validated evidence gate, not a promoted research strategy. GitHub's [artifact-attestation guidance](https://docs.github.com/en/actions/concepts/security/artifact-attestations) reinforces binding build provenance to the artifact while not replacing vulnerability review.

## Research Loop Receipt

- Parent: `state-transition-completeness`, previously finding material contradictions in 5/5 reviews.
- Candidate: `baseline-sensitive artifact closure`.
- Strategy/config SHA-256: `1660c6785e6c42492006c2d202483f2acc9b1dca47610198f722c3de68f35e02`.
- Query set: primary API/process/file semantics, exact published-package state, affected-baseline behavior, target-matrix execution, restart/cancellation, and downstream delivery.
- Inclusion: primary specifications, official documentation, exact commits, packages, workflows, and deterministic replay; exclusion: vendor claims without executable evidence, duplicate citations, synthetic consensus, and unbound reports.
- Source cutoff: 2026-09-24; budget at most 45 minutes per repository.
- Tuning: Ruflo, RVM, RuVector. Holdout: Dream Machine and RuView.
- Frozen threshold: at least 10% composite improvement with no primary-source, citation, security, privacy, licensing, reproducibility, or cost regression.

The candidate made affected-baseline detection explicit and prevented a false ACCEPT on the first Ruflo smoke. It found material contradictions in 5/5 repositories, equal to the parent: **0% improvement** against the frozen promotion threshold. Authoritative coverage and primary-source ratio were preserved, but identical cross-day cost/token replay was unavailable. The parent was retained; no research methodology was promoted.

Research-loop verdict: **INCONCLUSIVE**

### Autogenous sub-receipt

Bounded parallel roles covered primary-source research, replication review, contradiction/security analysis, benchmark design, and RuV integration mapping through structured evidence deltas. A validated Autogenous runtime, LatentMesh semantic-delta channel, deterministic seed, duplicate-source counter, and costed Autogenous-versus-parent holdout replay were unavailable. Platform parallel analysis was not relabelled as Autogenous or MetaHarness runtime evidence, and no Autogenous strategy or factual conclusion was promoted.

Autogenous verdict: **INCONCLUSIVE**

## ruOS governed-evaluation receipt

No desktop reported a live heartbeat. The personal Mac was excluded. A dedicated ruOS-named machine received the fixed harmless `printf 'ruos-preflight-v1\\n'` probe. It returned positive stdout but `status: unverified`, `exitCode: null`, `completionVersion: null`, and `completionVerified: false`; screenshot returned dimensions but no image bytes. Positive prose and dimensions were not parsed as success. Without authoritative completion, verified tenant, actual image bytes, isolation binding, and frozen workload assertions, live qualification cannot pass.

ruOS verdict: **INCONCLUSIVE**

## Durable actions and blockers

- Four exact-head COMMENT reviews were posted: Dream Machine #132, RVM #78, RuVector #1016, and the existing RuView #1889 review was reused.
- Ruflo issue #3411 was materially updated and draft implementation PR #3412 was created; it remains mergeable, draft, unmerged, unreleased, and without automerge.
- One reusable lesson was written to Ruflo memory and retrieval-verified.
- [Core Memory checkpoint 5809015715](https://github.com/ruvnet/core-memory/issues/20#issuecomment-5809015715) was written and retrieval-verified.
- Federation Result `57cc8e7050891c78f950fcfd1731d8cc4e7c692f0c8be79f3fbaeaf095d85cea` was retrieved from the relay and content-verified as untrusted coordination data.
- The Dream evidence branch passed 616/616 Vitest tests, 81/81 governance tests, lint, and typecheck locally before publication.
- Zero direct default-branch pushes, merges, releases, deployments, automerge changes, or research-strategy promotions occurred.

Blockers are Dream evaluator-identity binding; an authorized Ruflo advisory/release and terminal exact-head CI; RVM restart/cancellation/identity-bound enforcement and green toolchains; RuVector calibrated outcomes, untouched holdout, real multi-target inference, blocking quality gates, and Workspace CI; RuView atomic owner-only creation, read-only/failure cleanup, platform replay, and CI coverage; and authoritative ruOS completion with screenshot bytes.

Next cohort: authorized Ruflo published-artifact remediation and exact release verification; Dream structured evaluator errors; RVM durable activation transactions; calibrated RuVector/OOD and real native/WASM target qualification; RuView cross-platform owner-only state; QuDAG release recovery; Open Claude Code private trust-boundary remediation; ruPet initial security/functionality baseline; and neglected high-risk repositories.

Evaluation is not promotion. Nothing was merged, released, or deployed by this cycle.
