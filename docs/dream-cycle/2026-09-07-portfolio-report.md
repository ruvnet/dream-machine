# Dream Machine portfolio cycle — 2026-09-07

## Executive result

One software-contract hypothesis was accepted, two frozen claims were rejected, and two candidates remain inconclusive. The cycle confirmed one severe functionality defect in RuVector's advertised quantization path and one medium supply-chain hardening gap in WorldGraph. It created WorldGraph issue #11, materially updated RuVector issue #968, and recorded four exact-head pull-request reviews. No critical or high remotely exploitable production vulnerability was confirmed. No implementation pull request, direct push to a default branch, merge, release, deployment, workflow authorization, or automerge change was performed.

## Contract and inventory

The cycle began by fetching the authenticated `ruvnet/dream-machine` default branch at signed commit `c4c2d8ed94a22fbc5edd77306ce1056793eb3c07`. The current contract was read from `README.md`, `SECURITY.md`, `dream.config.json`, the ADR index and applicable ADRs, `packages/compile/src/index.ts`, compiled golden output, manifests, lockfile, workflows, tests, and prior Dream evidence. The controlling invariants remain: evaluation is not promotion, every hypothesis ends in an evidence-bound verdict, exactly one portfolio ledger row is appended, human merge authority is preserved, and `autoMerge: false` is not changed.

Authenticated repository pagination returned:

- 317 repositories: 215 public and 102 private
- 0 archived; 279 indexed; 38 unindexed; 11 empty
- Public activity: 21 default-branch commits across 3 repositories in the observed window
- Private activity: 0 repositories and 0 commits, represented only as aggregates
- Open-state lower bounds: at least 100 pull requests and 100 issues; connector result caps prevent exact totals

The security/functionality/velocity/optimization/SOTA/review-age policy and neglect rotation selected RuVector, ruClip, WorldGraph, Ruflo, and MetaHarness. Dream Machine remained the control and evidence plane rather than a sixth hypothesis.

| Repository | Created | Default | Archived | Release surface reviewed | Primary concern |
| --- | --- | --- | --- | --- | --- |
| RuVector | 2025-11-19 | `main` | no | `ruvector-v0.2.40`, security/RVF releases | placeholder model artifact generation |
| ruClip | 2026-09-01 | `main` | no | no GitHub release | replay atomicity on real persistence backends |
| WorldGraph | 2026-06-16 | `main` | no | no GitHub release | hardware rendering evidence and mutable workflow dependencies |
| Ruflo | 2025-06-02 | `main` | no | published `v3.38.21`; draft release excluded | routing identity consistency and reproducibility |
| MetaHarness | 2026-06-13 | `main` | no | published `v0.4.4` | qualification of black-box instruments |

Repository instructions, security policies where present, manifests, lockfiles, CI, tests, release history, trust boundaries, issue context, PR diffs, and constellation integration points were read before action. WorldGraph and ruClip have no root `SECURITY.md`; repository-specific instructions were still honored. Archived repositories were not modified.

## Constellation relationships

Dream Machine supplied fail-closed governance and the one-row evidence contract. MetaHarness PR #291 supplies a non-authoritative qualification receipt that should gate every future Dream, Ruflo, RuVector, and WorldGraph measurement before promotion. Ruflo PR #3221 connects chosen model identity to the final routing decision, but its frozen reproducibility and latency claims failed. ruClip PR #15 delegates replay uniqueness to Ruflo's memory boundary; acceptance therefore requires the real native and WASM-backed durable implementations rather than the test double. WorldGraph composes Rust/WASM, browser rendering, and MetaHarness validation, but software rendering is not physical GPU attestation. RuVector's native/WASM/RVF parity remains mandatory for persistence claims, and its current quantization placeholder blocks trustworthy model-artifact lineage. Core Memory receives only a redacted aggregate checkpoint; the governed signed-federation endpoint was unavailable, so no signed federation claim is made.

## Security and functionality findings

- No new remotely exploitable critical or high production vulnerability was confirmed. No secrets, exploit details, or private-repository details were published.
- RuVector issue #968 is confirmed against current reachable source. The advertised SafeTensors path does not load tensor payloads before writing a zero-tensor GGUF header, and the GGUF-to-GGUF writer emits a placeholder payload. This is a severe functionality and artifact-integrity defect, not a claimed remote exploit. The issue now contains a fail-closed, loader-roundtrip acceptance gate.
- WorldGraph's three workflow files contain 24 external `uses:` references spanning 11 action identities; all use mutable tags. Issue #11 records the exact immutable-SHA, least-privilege, Dependabot, and green-CI gate. No referenced action is alleged to be compromised.
- ruClip PR #15 improves its modeled race result from 320/323 accepted cases to 323/323, but the workflow permits install fallback and does not execute the fixed concurrent corpus against each supported real durable backend. The existing replay-integrity finding remains unaccepted; sensitive dependency reachability belongs in private triage.
- Ruflo PR #3221 fixes the reachable stale model-identity path and all six observed workflow groups are green. Its own frozen run nevertheless reports 168 failures in both baseline and candidate and skips performance measurement, contradicting mandatory green-suite and zero-latency conditions.
- MetaHarness PR #291 is dependency-free, `authority: none`, and passes exact-head CI, Real Tools, Security, packaging, Node/Rust/WASM, audit, malformed-input, censoring, stability, and resource gates.

## Repository hypotheses

### RuVector

**Frozen hypothesis.** Current RuVector CLI quantization converts supported SafeTensors or GGUF inputs into independently loadable, non-empty GGUF artifacts, or fails closed before creating output.

**Baseline and threshold.** Issue #968 reports a 75-byte artifact with zero tensors and zero elements. Acceptance requires a pinned representative fixture, non-zero tensor table and payload, preserved shape/type/metadata, independent loader roundtrip, atomic interrupted-write behavior, malformed/unsupported-input refusal, bound hashes and exact commit, and green native workspace, supply-chain, regression, and WASM compatibility gates.

**Evidence and critique.** Current default head `edaffffb3b85768eb1f3ec1f683b7f46f0506af4` contains explicit placeholder behavior in both conversion paths. A progress display and syntactically valid header can reward the wrong metric while producing no usable model. No replacement was attempted without a runnable checkout and representative model fixture.

**SOTA and applicability.** The official GGUF specification defines tensor count, tensor information, and aligned tensor data; SafeTensors provides the source tensor metadata/data contract. The expected benefit is binary: every reported success independently loads non-zero tensors, while unsupported inputs create no artifact.

Verdict: REJECT

### ruClip

**Frozen hypothesis.** PR #15 admits at most one concurrent use of a nonce on every supported durable backend, with zero replay side effects and no sequential regression.

**Baseline and threshold.** The recorded modeled baseline accepts 320 of 323 cases. Acceptance requires 323/323 on repeated fixed concurrent corpora against each real backend, exactly one success per nonce, durable uniqueness after process restart, exact clean install, dependency/security gate completion, and exact-head receipt binding.

**Evidence and critique.** Candidate `0b1c58a7fc113ad7894b6507b1f6a962e62d1a15` moves admission to `memory_store` with `upsert: false`; workflow run 34022122260 passes and the updated model reports 323/323. SQLite's authoritative conflict semantics support constraint-backed single-statement refusal, but the test double cannot attest backend locking, process concurrency, durability, or native/WASM parity. CI's install fallback further weakens reproducibility.

**SOTA and applicability.** SQLite documents that the default uniqueness conflict action aborts the statement and backs out its changes. Applied here, the expected benefit is reducing accepted concurrent replays from three to zero beyond the one legitimate admission, measured on the actual backends.

Verdict: INCONCLUSIVE

### WorldGraph

**Frozen hypothesis.** PR #10 preserves deterministic graph/replay behavior while its upgraded renderer meets p95 frame time at or below 33.3 ms for 300 samples over 60 seconds on every declared target hardware class, with zero context loss.

**Baseline and threshold.** The software renderer is the reproducible baseline. Acceptance requires all repository software gates, asset-hash failure injection, renderer/driver/device and mode identity, the declared hardware sample count and duration, p95 threshold, context-loss count, artifact hashes, and no deploy or publication authority broadening.

**Evidence and critique.** Candidate `70ac6bd22355324d0375da5de8e6c5a8c715d556` has green RuLab run 34071798432 and standard CI run 34071798469. The recorded envelope includes 112 unit, 23 harness, 88 Rust/doctest, TypeScript, WASM, build, and 16 software-WebGL cases. The physical GPU benchmark was deliberately not run and CI uses a software renderer; screenshots and feature presence do not establish latency. Issue #11 separately tracks 24 mutable workflow references without weakening the publication hold.

**SOTA and applicability.** Current Three.js renderer and render-target documentation supports the implementation surface, not device performance. GitHub's secure-use reference says full commit SHAs are the only immutable action references. Expected benefit is measured p95 compliance on real targets plus reducing mutable workflow dependencies from 24 to zero.

Verdict: INCONCLUSIVE

### Ruflo

**Frozen hypothesis.** PR #3221 makes the returned tier, model, and concrete model identity internally consistent after escalation, preserves non-escalated behavior, adds zero latency, costs zero, and keeps the full existing suite green.

**Baseline and threshold.** The baseline can forward a lower-tier identity after the final tier escalates. Acceptance requires the three fixed invariant cases, a clean supported install, the full affected suite green, all exact-head security/verification/cross-agent workflows green, and routing latency within a preregistered non-inferiority threshold.

**Evidence and critique.** Candidate `77fb8fff76a762281e1edae29b3c7fc7aa239994` gates neural identity fields on the final returned model. The three focused cases pass, and CI/CD 34090944582, V3 CI 34090944578, Verification 34090944572, CVE Audit 34090944581, Cross-Agent 34090944591, and CodeQL 34090944575 all pass. The submitted baseline/candidate comparison still records 168 failures both ways, and the performance job is skipped. Equal failures show no attributable regression; they do not satisfy a green-suite requirement, and missing measurement cannot prove zero latency.

**SOTA and applicability.** HookPry, submitted 2026-09-03, reinforces enforcement at lifecycle/effectful boundaries rather than trusting upstream declarations; the MCP 2026-07-28 tool contract likewise requires validated authorization and auditability at execution. Expected benefit is zero stale identity overrides at final dispatch, which needs a clean end-to-end receipt.

Verdict: REJECT

### MetaHarness

**Frozen hypothesis.** PR #291's non-authoritative qualification primitive rejects malformed, censored, unstable, resource-overrun, and policy-incompatible instrument evidence while accepting stable controls without a runtime dependency, regression, or authority grant.

**Baseline and threshold.** Shared black-box endpoints can make a clean harness observe unstable or censored trajectories. Acceptance requires matched emitted/parsed/executed traces, rank-agreement and interface-loss gates, bounded resources, malformed-input refusal, `authority: none`, package compatibility, exact-head deterministic tests, and green security/audit workflows.

**Evidence and critique.** Candidate `d9338e07fe403daea2606bdb2bef059403ee189c` passes CI 34033609942, Real Tools 34033609978, Security 34033610011, and deterministic workflow 34033609941. Node, Rust, WASM, packaging, audit, stability, censoring, malformed, and resource cases are covered. Reward-hack review found no runtime authority or dependency hidden in the receipt. This accepts the software primitive only; issue #290 still owns real-host and shared-endpoint qualification.

**SOTA and applicability.** Two primary studies submitted 2026-09-03 report that clean black-box observers can be unreliable on shared endpoints and that interface translation can sharply censor executed trajectories. The primitive directly measures those applicability conditions. Expected benefit is preventing unstable or interface-censored evidence from reaching Dream promotion gates.

Verdict: ACCEPT

## SOTA sources

- GitHub secure-use reference, checked 2026-09-07: https://docs.github.com/en/actions/reference/security/secure-use
- Clean Engineering, Unstable Measurement, submitted 2026-09-03: https://arxiv.org/abs/2609.04198
- Interface-Induced Trajectory Censoring, submitted 2026-09-03: https://arxiv.org/abs/2609.03966
- HookPry, submitted 2026-09-03: https://arxiv.org/abs/2609.03884
- MCP tools specification dated 2026-07-28: https://modelcontextprotocol.io/specification/2026-07-28/server/tools
- Official GGUF specification, checked 2026-09-07: https://github.com/ggml-org/ggml/blob/master/docs/gguf.md
- Official SafeTensors implementation/specification, checked 2026-09-07: https://github.com/safetensors/safetensors
- SQLite ON CONFLICT semantics, updated 2025-11-22 and checked 2026-09-07: https://www.sqlite.org/lang_conflict.html
- Three.js renderer documentation, checked 2026-09-07: https://threejs.org/docs/#api/en/renderers/WebGLRenderer

## Actions, commands, and blockers

Created WorldGraph issue #11; added a confirmed-source acceptance comment to RuVector issue #968; added exact-head reviews to ruClip PR #15, WorldGraph PR #10, Ruflo PR #3221, and MetaHarness PR #291. Reused existing issues #14, #968, #3220, #289/#290 and the existing draft implementation paths. No implementation PR or direct push was justified because the remaining patches cross unexecuted persistence, artifact, hardware, or reproducibility boundaries.

Connector-backed reproduction: fetch Dream default and contract files; paginate all authenticated owner repositories with index enrichment; search open PR/issue state and default-branch commits; inspect repository instructions, policies, manifests, lockfiles, workflows, releases, issues, diffs, source paths, exact-head workflow runs, and job outcomes; compare findings with primary specifications. Private repository activity was counted separately and never named or described.

Fresh runnable checkouts were unavailable. Therefore the pinned Ruflo 3.25.6 local scan, independent lockfile-aware secret/dependency/STRIDE replay, real ruClip backend race, RuVector native/WASM/RVF and model-loader roundtrip, physical WorldGraph GPU run, and governed Core Memory signed-federation write were not claimed. Workflow and search result caps, 38 unindexed repositories, absent hardware, and unavailable representative model/provider inputs remain coverage debt.

Reusable learning: detector recall, syntactic artifact validity, and software-renderer success are not enforcement, model-content, or hardware-performance receipts. Future candidates must bind the final effectful boundary, independently load or execute the produced artifact, and prove the declared physical/backend envelope.

Next cohort: RuVector #968 fail-closed quantization; ruClip #15 real native/WASM persistence concurrency; WorldGraph #11 immutable actions and PR #10 physical GPU receipt; Ruflo clean-install/full-suite/latency recovery; MetaHarness #290 real-host/shared-endpoint reproduction; neglected high-risk repositories rotated upward.
