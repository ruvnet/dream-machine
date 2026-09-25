# Dream constellation portfolio report — 2026-09-25

## Contract and scope

The cycle began from `ruvnet/dream-machine` default branch `main` at `aa931caad5dd0108253645bba0ab1481ad7da0ee`. Before portfolio work, the current `README.md`, `SECURITY.md`, `dream.config.json`, ADRs, manifests and lockfile, workflows, tests, ruOS runbook, and compiled pipeline were read as the execution contract. The human-only merge boundary, private-aggregate rule, fail-closed evidence gates, five-repository limit, exact-head validation, and one-verdict-per-hypothesis rule were preserved.

No merge, release, deployment, default-branch push, automerge change, production probe, archived-repository mutation, credential use, or public disclosure of private-repository detail occurred. Public actions were limited to three exact-head COMMENT reviews and one existing-issue update.

## Portfolio inventory and prioritization

All accessible exact-owner repositories were paginated as 100, 100, 100, and 24 entries: **324 repositories**, comprising 221 public and 103 private. None are archived; 286 are indexed, 38 unindexed, and 11 empty. `agents-of-the-dawm` is the newly observed public repository. Private repositories appear only as aggregate counts.

Since the prior checkpoint, 14 public default-branch commits were observed across four repositories: Open Claude Code 1, Ruflo 8, agents-of-the-dawm 3, and the ruvnet profile repository 2. Private activity was zero commits across zero repositories, aggregate-only. Complete exact-owner search returned **1,513 open pull requests** and **1,759 open issues** with `incomplete_results:false`.

Selection used security 35%, functionality and production impact 30%, change velocity 10%, measurable optimization 10%, SOTA relevance 10%, and review age 5%, with neglected-repository rotation and confirmed-risk override. Before candidate outcomes, the cohort and hypotheses were frozen: Ruflo issue #3411 / PR #3412, MetaHarness PR #352, agents-of-the-dawm PR #2, RuView PR #2001, and ruPet main/release v1.1.0.

## Deep reviews

### 1. Ruflo issue #3411 / draft PR #3412 — published MCP delivery closure

Frozen software hypothesis: the currently installable `@claude-flow/mcp` release must contain the safe direct-argv implementation in every shipped helper, pass bounded body and child-error cases, and be backed by exact release CI; an unshipped source candidate does not satisfy remediation.

The npm `latest`, `alpha`, and `v3alpha` tags still resolve to `3.0.0-alpha.9`, published 2026-05-09. Alpha.10 returns 404. A downloaded alpha.9 tarball had SHA-256 `bd7b33ff46623bf06ff723f55e35922684605ad060f2b4b581746cb19de04daa`; its helper had SHA-256 `9cec5c9b7e0bc079027abb103062275a7b8fb91d081909fe249e6488b745b4a9`. Harmless whitespace-bearing argv, literal-body, child-error, and body-bound probes confirmed that this remains the affected user-visible artifact. Details that would facilitate exploitation are withheld; use a private security advisory.

Draft [PR #3412](https://github.com/ruvnet/ruflo/pull/3412) at exact head `abf6da6bebbfc94a89598b3984098af0b3ad31ea` remains open, draft, cleanly mergeable, and unmerged. Its 65-file packed alpha.10 candidate had tar SHA-256 `e666573728a1e45ba5fb5c2fdf1ffed634a4348c689df0f5c988383290adca99`, passed all five independent artifact gates, and passed the repository smoke 18/18. A no-conflict local merge into current main `88955d9fa9c60836a3f9a3d0e47fcabdc5af4ff5` retained those results. PR checks were 107 successful and 3 skipped; current-main checks were 153 successful and 33 skipped.

Delivery remains absent: the PR changes no version, manifest, lockfile, or workflow; stable release automation does not publish standalone MCP; and the V3 alpha workflow calls a package script not defined by the V3 manifest. Ruflo v3.45.0 explicitly records that #3412 was not included and the npm MCP artifact remains affected. Node documents the relevant distinction between shell-mediated `exec` and direct-argv `execFile`. [Node child-process contract](https://nodejs.org/api/child_process.html)

Action: materially updated [issue #3411](https://github.com/ruvnet/ruflo/issues/3411#issuecomment-5828173820) with the release-closure requirements. No merge or release was performed.

Verdict: **REJECT**

### 2. MetaHarness PR #352 — independent-review context boundary

Frozen software hypothesis: the exact production entrypoint must create a fresh reviewer context with only verified evidence references, reject all identity/policy/task substitutions and missing evidence, and pass exact-head CI, Security, Real Tools, and a protected behavioral holdout.

Exact head `d1e08f2f1c41cbf093896c855be8be0e24bd7a50` adds a deterministic packet primitive. Focused tests passed 13/13, the flywheel suite passed 85/85, and a 10,000-case local benchmark accepted 0/6,000 generated malicious cases, denied 0/4,000 clean cases, produced zero digest mismatches, and processed about 23,639 cases/second. All six directly probed expectation substitutions were rejected.

Repository reachability showed no production caller, fresh reviewer process, evidence materializer, verified-reference-only input path, or tool/memory/environment isolation boundary. The ordinary SHA-256 packet digest proves internal consistency rather than trusted provenance. Empty evidence can verify; review/run identity is not part of the expectation; and the benchmark self-constructs its inputs, uses a straw baseline, omits several issue #351 families, and excludes isolation/model/evidence-retrieval cost. The September 2026 primary study supports limiting cross-episode history but does not validate this packet design. [Primary paper](https://arxiv.org/html/2609.24967) Node also distinguishes separate-process memory from potentially shared worker memory. [Node child processes](https://github.com/nodejs/node/blob/v24.19.0/doc/api/child_process.md) · [worker threads](https://github.com/nodejs/node/blob/v24.19.0/doc/api/worker_threads.md)

Exact-head Independent Review Context and Real Tools workflows passed, but [Security 36016905087](https://github.com/ruvnet/metaharness/actions/runs/36016905087) and [CI 36016905153](https://github.com/ruvnet/metaharness/actions/runs/36016905153) failed. The new workflow also regresses from full-SHA action pins to mutable v4 tags.

Action: exact-head [COMMENT review 5314449982](https://github.com/ruvnet/metaharness/pull/352#pullrequestreview-5314449982), reusing open issue #351.

Verdict: **REJECT**

### 3. agents-of-the-dawm PR #2 — playable browser journey

Frozen software hypothesis: a clean consumer build must preserve deterministic gate invariants and complete the intended journey on a dedicated isolated desktop, with exact-head green CI, consumer-bound replay, no production debug authority expansion, authoritative completion metadata, and actual screenshot bytes.

Exact head `ba6f27cbb239b99b2693dcc54926baeb5d19e738` passed clean install, typecheck, 25 files / 263 unit tests, build, and an asset audit with zero unknown assets or external runtime URLs. Golden seed 1047 produces stable upper and lower route hashes after 3,812 and 3,500 ticks. Renderer fallback, context loss, WASM failure, gate authorization, duplicate authorization, unsafe-route rejection, and save recovery have substantive automated coverage. The September 15, 2026 WebGPU Candidate Recommendation is the current authoritative browser-GPU contract. [W3C WebGPU](https://www.w3.org/TR/webgpu/)

The authoritative [exact-head workflow 36079667708](https://github.com/ruvnet/agents-of-the-dawm/actions/runs/36079667708) failed after 21m48s in E2E. `git diff --check` also fails while the workflow masks it with `|| true`. Replay binds seed, commands, and FNV-1a checkpoints, but not the build/commit, lockfile, manifest bytes, or consumer identity. Production exposes mutable simulation/debug methods and query controls outside the normal input lifecycle.

The committed user-journey evidence is headless Chromium with SwiftShader, no WebGPU adapter, and a non-head source SHA. A representative PNG is 138,337 bytes with SHA-256 `b0327826bb88de34212f7e95750a204ce3e14f79b34b56fdc1f3f44e78af76e2`, but its receipt does not bind that path or digest. The added real-GPU statement is prose-only. Unfamiliar-player timing, gamepad, listened audio, named reference devices, device-loss, exact-source screenshot binding, and authoritative ruOS completion remain unverified.

Action: exact-head [COMMENT review 5314474492](https://github.com/ruvnet/agents-of-the-dawm/pull/2#pullrequestreview-5314474492).

Verdict: **REJECT**

### 4. RuView PR #2001 — automated vendor-gitlink sweep

Frozen software hypothesis: each new gitlink must be reachable from its declared upstream branch, carry attributable upstream and RuView consumer validation, preserve provenance/licensing/security evidence, avoid duplicate automation, and pass every exact-head workflow.

Exact head `a21737302238dfd1e0f76e1f2b7a813236ed0b0f` advances MetaHarness, midstream, rufield, and RuVector pointers in one commit. The body provides no old/new comparisons, per-submodule change-risk receipt, upstream exact-head status, SBOM, or consumer result. All four exact-head workflows concluded `action_required`: [CI 36102886668](https://github.com/ruvnet/RuView/actions/runs/36102886668), Security Scanning 36102886662, CSI data policy 36102886690, and Fix-Marker Regression Guard 36102886658. Exact-owner search found 472 simultaneously open PRs with the same vendor-update title, demonstrating that supersession/deduplication is not enforced.

This does not allege a malicious upstream commit. It is a reproducibility and supply-chain promotion gap already scoped by [issue #1743](https://github.com/ruvnet/RuView/issues/1743). SLSA provenance separates artifact identity and build claims from ordinary source-pointer movement. [SLSA provenance v1.2](https://slsa.dev/spec/v1.2/provenance)

Action: exact-head [COMMENT review 5314452608](https://github.com/ruvnet/RuView/pull/2001#pullrequestreview-5314452608), reusing issue #1743.

Verdict: **REJECT**

### 5. ruPet main / v1.1.0 — initial package and consumer baseline

Frozen software hypothesis: the released pet artifact must match repository bytes and published checksums, contain only the declared v2 pet files without unsafe paths or executables, pass the official consumer validator, and keep the optional skill separate without authority expansion.

Main remains `ec2737995cdf74ef28a59ddd6d38e1c721fe0636`; release v1.1.0 was published 2026-09-22 and is not immutable. The released `ruPet.zip` SHA-256 is `20a5b951c2d870dce88ec4a41c538f9bcaad09c0db3e70515845838875056699`, exactly matching the repository artifact and `SHA256SUMS.txt`. The separate skill ZIP SHA-256 is `fc82a1565785e4d77ac40575c22dd8212427785aa63eca33d3794164c2d186d2`; both archives passed CRC testing and contained only their declared files, with no traversal or executable entry.

The official read-only pet consumer validator accepted the exact 2,181,894-byte repository WebP as v2: 1536×2288 atlas, 192×208 sprites, frame rows `[6,8,8,4,5,8,6,6,6,8,8]`, and zero validation errors. The pet ZIP contains only `pet.json`, `spritesheet.webp`, and `LICENSE`; the optional instruction skill remains a separate artifact. There are no open issues, PRs, or workflow runs.

Acceptance is narrowly scoped to artifact integrity, schema, and consumer compatibility. It does not establish live activation, reproducible release automation, provenance attestation, or immutable-release policy. No change or issue was warranted by the frozen gate.

Verdict: **ACCEPT**

## Security and constellation receipt

The previously confirmed elevated Ruflo published-artifact condition remains user-visible and requires a private advisory and authorized release. No new remotely exploitable critical production vulnerability was confirmed. MetaHarness lacks a production isolation boundary; agents-of-the-dawm exposes a production debug authority surface; and RuView lacks attributable dependency-promotion evidence. Those findings were disclosed only at public-safe abstraction. No secret or private-repository identity was published.

Dream Machine supplied governance and durable evidence; Ruflo supplied orchestration, memory, and release-artifact replay; MetaHarness supplied adversarial criteria while its own candidate was reviewed; RuVector native/WASM use was limited to existing evidence because no validated cross-target retrieval backend was available; RuView demonstrated the downstream gitlink relationship to MetaHarness and RuVector; Core Memory and the signed federation supplied redacted continuity; ruOS supplied an observation probe. The reusable constellation lesson is: a schema, digest, source fix, or benchmark is not a delivered control without a reachable caller, trusted evidence materialization, isolated effect boundary, blocking final-consumer validation, and verification of the shipped artifact.

The project-local Ruflo 3.25.6 database was absent at cycle start, so prior retrieval degraded to the committed report and retrieval-verified Core Memory record. It was reinitialized with hybrid memory, bundled `all-MiniLM-L6-v2`, 384 dimensions, and HNSW. The new lesson was stored with strict `--no-upsert` under `portfolio-patterns/portfolio-2026-09-25-boundary-delivery` and retrieved verbatim. This is a validated reusable lesson, not a promoted research strategy. No native/WASM/RVF equivalence claim was made.

## Research Loop Receipt

- Parent: `baseline-sensitive artifact closure`, previously finding contradictions in 5/5 reviews.
- Candidate: `authority-bearing final-consumer closure`.
- Strategy/config SHA-256: `1d281e4fe3702ab447c9e0e3b7a8c25dfc1892e82dce2b329e53b2cefc32cfe2`.
- Query set: production caller, isolated runtime, shipped artifact, exact workflow, consumer-bound receipt, persistence/cancellation, and supported release path.
- Inclusion: primary specifications, exact commits, packages, releases, workflows, and deterministic replay; exclusion: vendor claims without executable evidence, duplicate citations, synthetic consensus, and unbound prose.
- Source cutoff: 2026-09-25; budget at most 45 minutes per repository.
- Tuning: Ruflo, MetaHarness, RuView. Holdout: agents-of-the-dawm and ruPet.
- Frozen threshold: at least 10% composite improvement with no primary-source, citation, security, privacy, licensing, reproducibility, or cost regression.

Both strategies found four material contradictions across five repositories, including the two untouched holdouts: **0% improvement** against the frozen threshold. The candidate added useful caller/isolation distinctions and preserved authoritative coverage, but exact cross-day cost/token replay was unavailable. The parent was retained; no methodology was promoted.

Research-loop verdict: **INCONCLUSIVE**

### Autogenous sub-receipt

A three-role topology was frozen for delivery replication, security/provenance critique, and user-journey/benchmark review; configuration SHA-256 is `791e844994489b1fd999fe27e7b4a18a4073088a9d23155eb1386a02a716206a`. Roles returned structured evidence deltas through ordinary bounded messages and preserved dissent. A validated Autogenous runtime, LatentMesh channel, deterministic replay seed, duplicate-source counter, and costed Autogenous-versus-parent holdout were unavailable. Platform subagents were not relabelled as Autogenous, LatentMesh, or MetaHarness runtime evidence, and no strategy or factual conclusion was auto-promoted.

Autogenous verdict: **INCONCLUSIVE**

## ruOS governed-evaluation receipt

The trusted default-branch runbook was read before probing. Fleet telemetry reported no live heartbeat and could not establish isolation; the personal Mac was excluded. A dedicated ruOS-named candidate machine received only the fixed harmless `true` probe. It returned positive prose but `status: unverified`, `exitCode: null`, `completionVersion: null`, and `completionVerified: false`. Screenshot returned dimensions only, not image bytes. Positive stdout and dimensions were not parsed as success. Without authoritative completion, verified tenant/isolation, actual bytes, and frozen workload assertions, live agents-of-the-dawm qualification cannot pass.

ruOS verdict: **INCONCLUSIVE**

## Durable actions and blockers

- Three exact-head COMMENT reviews were posted: MetaHarness #352, agents-of-the-dawm #2, and RuView #2001.
- Ruflo issue #3411 was materially updated; draft PR #3412 remains open, draft, cleanly mergeable, unmerged, and unreleased.
- One reusable lesson was written to Ruflo memory and retrieval-verified.
- The Dream evidence branch passed typecheck, eight workspace builds, lint, 616/616 Vitest tests, 81/81 governance tests, edge-contract validation, and the development-policy gate locally before publication.
- Zero new issues, implementation PRs, direct default-branch pushes, merges, releases, deployments, automerge changes, or research-strategy promotions occurred.

Blockers are an authorized Ruflo standalone-MCP advisory/release and published-tarball replay; a real MetaHarness independent execution boundary plus green required workflows; agents-of-the-dawm exact-head E2E, debug-authority containment, consumer-bound replay, and isolated-device receipt; RuView provenance, automation deduplication, and consumer CI; ruPet reproducible/attested release automation and live activation evidence; and authoritative ruOS completion with screenshot bytes.

Next cohort: authorized Ruflo release verification; MetaHarness production isolation and four-arm holdout; agents-of-the-dawm bounded debug/user-journey qualification; RuView automation deduplication and per-submodule receipts; QuDAG release recovery; private Open Claude Code remediation; RuVector calibration/OOD qualification; RVM durable activation transactions; and neglected high-risk repositories.

Evaluation is not promotion. Nothing was merged, released, or deployed by this cycle.
