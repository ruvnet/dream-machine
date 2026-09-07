# Dream Machine portfolio cycle — 2026-09-06

## Executive result

One software-envelope hypothesis was accepted, one operational supply-chain hypothesis was rejected, and three hypotheses remain inconclusive. No critical or high production vulnerability was confirmed. One new actionable supply-chain provenance issue was opened, one existing issue was materially updated, and four exact-head pull-request reviews were recorded. No implementation pull request, direct push to the default branch, merge, release, deployment, or automerge change was performed.

## Contract and inventory

The cycle began from the authenticated `ruvnet/dream-machine` default branch at `c4c2d8ed94a22fbc5edd77306ce1056793eb3c07`. The execution contract was read from `README.md`, `SECURITY.md`, `dream.config.json`, applicable ADRs, `packages/compile/src/index.ts`, manifests, lockfiles, workflows, tests, releases, and the ledger. Evaluation is not promotion; human authority and `autoMerge: false` remain controlling.

Authenticated inventory with pagination and search-index enrichment:

- 317 owned repositories: 215 public and 102 private
- 0 archived; 279 indexed; 38 unindexed; 11 empty
- New public repository: `ruvnet/MoE-Foundry`
- Public activity lower bound: 32 default-branch commits across 8 repositories
- Private activity: 0 repositories and 0 commits in the observed window, aggregate only
- Open-state lower bounds: at least 100 pull requests and 100 issues; connector caps prevent exact totals
- Recently updated open state: 31 pull requests and 49 issues

The weighted security/functionality/velocity/optimization/SOTA/review-age policy and neglect rotation selected Dream Machine, Ruflo, RVM, RuView, and MoE Foundry. RuVector native/WASM/RVF remained a compatibility gate rather than a sixth deep review.

## Constellation relationships

Dream Machine supplies governance and non-promoting evaluation. MetaHarness supplies falsifiable candidate, adversarial, regression, compatibility, and reward-hack gates. Ruflo supplies project coordination, but PR #3210 still lacks exact-head cross-platform evidence. Core Memory receives an aggregate-only checkpoint; its governed signed-federation endpoint remains unavailable. RuVector, RVF, and RuVector WASM remain required for native/WASM top-K parity and persistent reopen evidence. MoE Foundry composes MetaHarness routing with bounded MCP tools and typed LatentMesh state while real-model/GPU qualification stays disabled behind issue #1. RuView's macOS RSSI adapter can join the RF evidence chain only after stable source identity and real-hardware provenance are demonstrated.

## Security and functionality findings

- No new remotely exploitable critical or high production vulnerability was confirmed.
- Dream Machine still has one unpinned `npx` evaluator and 19 mutable GitHub Actions references across six workflows. The compiler detects the former but the live config still executes it. Issue #18 was updated; issue #86 records the immutable-action gate. This is a confirmed provenance exposure, not evidence of compromise.
- Dream Machine PR #85 has CodeQL green and required CI red after three major development-dependency jumps.
- Ruflo PR #3210 repairs project-root claims placement in reachable code, but all six exact-head workflows require authorization and the documented clean-install blocker prevents broad replay.
- RVM PR #65 adds an allocation-free authorization primitive, but no lifecycle installer consumes it, no independent issuance or witness receipt is wired, and the p95 benchmark is absent.
- RuView PR #1845 reaches CoreWLAN RSSI/noise/channel and bounds the helper, but all exact-head workflows require authorization. If macOS withholds both SSID and BSSID, fallback identity derives only from an empty SSID and channel and can collapse distinct networks.
- MoE Foundry's exact-main workflow completed every root, harness, Python, validation, acceptance, smoke, doctor, and status step. Recorded Ruflo and npm scans report zero findings; Python advisories were not scanned and hashes are not authentication.

## Repository hypotheses

### Dream Machine

**Frozen hypothesis.** The current control plane prevents dynamic supply-chain resolution: executable package references and workflow actions are immutable while CI behavior is preserved.

**Baseline and threshold.** One live evaluator is unpinned and 19 action references use mutable tags. Acceptance requires both counts at zero, all exact-head workflows green, and no permission, trigger, protection, or automerge broadening.

**Candidate and critique.** Main CI run 33972074902 and CodeQL run 33972074926 pass. The merged detector surfaces the unpinned evaluator but does not pin or prevent it. Dependabot PRs #1 and #2 advance action tags yet remain mutable. PR #85 fails CI. Detection and current-main green status cannot substitute for enforcement.

**SOTA.** GitHub's current secure-use reference says a full-length commit SHA is the only immutable action reference. Applicability is direct; expected benefit is reducing mutable workflow code from 19 references to zero.

Verdict: REJECT

### Ruflo

**Frozen hypothesis.** PR #3210 makes sessions with the same effective project root share one claims store, isolates distinct roots, and preserves behavior across supported platforms with every exact-head gate green.

**Baseline and threshold.** Main anchored claims to the MCP process cwd. Acceptance requires same-root sharing, distinct-root isolation, ownership/release/handoff/steal behavior, atomic concurrency, Windows/Linux compatibility, clean installation, and all security/verification/cross-agent workflows green.

**Candidate and critique.** The two-file patch consistently uses `getProjectCwd()` and adds real temporary-filesystem coverage. The claimed 114 focused tests are relevant. However, CI, V3 CI, Verification, CVE Audit, Cross-Agent, and CodeQL all ended `action_required` at `3d87d5e`; clean broad replay and concurrency evidence are absent. No recent primary shared-claims benchmark can replace repository-specific execution evidence.

Verdict: INCONCLUSIVE

### RVM

**Frozen hypothesis.** PR #65 denies every unauthorized lifecycle-hook update at the final effectful boundary, admits legitimate updates, emits a witness-bound decision, and validates below 100 microseconds p95.

**Baseline and threshold.** RVM had capability, epoch, rights, and witness substrates but no hook-update primitive. Acceptance requires zero unauthorized bindings over a frozen HookPry-style set, independent issuance, installer consumption, receipts, full CI/RustSec, and p95 below 100 microseconds.

**Candidate and critique.** The allocation-free primitive binds plugin and manifest identity, event mask, rights ceiling, epoch, expiry, next manifest, and command digest. Exact-head CI run 33872196557 passes and focused substitution/widening/expiry cases exist. The operational path, issuance, receipts, MetaHarness attack set, and latency measurement do not.

**SOTA.** HookPry, submitted 2026-09-03, evaluates lifecycle-hook update attacks outside the model decision path. Expected benefit is zero unauthorized hook bindings; it is not yet measured end to end.

Verdict: INCONCLUSIVE

### RuView

**Frozen hypothesis.** PR #1845 makes `--source wifi` on macOS deliver real, non-simulated RSSI observations with stable identities and no regression or helper hang.

**Baseline and threshold.** The runtime was Windows-oriented and the legacy helper streamed indefinitely. Acceptance requires clean macOS build/tests, helper install proof, green security/regression workflows, bounded subprocesses, deterministic abstention without identity, and a captured hardware provenance receipt. Accuracy is outside scope.

**Candidate and critique.** Swift one-shot mode returns connected-link RSSI/noise/channel, and Rust kills/reaps helpers after five seconds. Apple's CoreWLAN API supports those measurements. All five exact-head workflow groups ended `action_required`; no hardware receipt exists; and nil SSID/BSSID can conflate same-channel networks. Synthetic fixtures cannot substitute for current privacy behavior or physical execution.

**SOTA.** Apple's current CoreWLAN documentation is the authoritative API baseline. It supports feasibility, not sensing accuracy. Expected benefit is replacing silent simulation with provenance-labelled connected-link RSSI, contingent on permissions and identity.

Verdict: INCONCLUSIVE

### MoE Foundry

**Frozen hypothesis.** The published main commit provides a reproducible, fail-closed software contract for synthetic expert separation, bounded MCP/CLI operations, MetaHarness routing, and typed state checks without real-model or deployment claims.

**Baseline and threshold.** As a new repository, its declared baseline is 69 tests, 13 CLI/MCP checks, and six synthetic checkpoint roundtrips. Acceptance requires exact pins, clean installs, schema and boundary refusals, parent fallback, Python engine/smoke coverage, no shell/network/GPU/export MCP authority, exact-main CI green, and real-model claims withheld.

**Candidate and critique.** Workflow run 33976313700 passed all 17 recorded steps, including installs, validation, Node/Python tests, acceptance, smoke, harness build/tests/doctor, and status. Actions are full-SHA pinned and checkout credentials are not persisted. Security evidence records zero Ruflo/root/harness npm findings but explicitly leaves Python advisories, hostile filesystem races, authenticated replay, browser QA, real-model quality, and GPU performance unverified. Issue #1 freezes the real-model parent/random/selected gate.

**SOTA.** A June 14, 2026 unified expert-pruning study finds task-specific pruning may benefit from routing frequency and gate weighting, while task-agnostic selection favors activation-based criteria. This applies to the future real-model experiment. Expected benefit is a pre-registered criterion comparison against five matched random masks and the unchanged parent.

Verdict: ACCEPT

## SOTA sources

- GitHub secure-use reference, checked 2026-09-06: https://docs.github.com/en/actions/reference/security/secure-use
- HookPry, submitted 2026-09-03: https://arxiv.org/abs/2609.03884
- Apple CoreWLAN `CWInterface`, checked 2026-09-06: https://developer.apple.com/documentation/corewlan/cwinterface
- How to Score Experts for One-Shot MoE Expert Pruning, submitted 2026-06-14: https://arxiv.org/abs/2606.15716
- MCP tools specification dated 2026-07-28: https://modelcontextprotocol.io/specification/2026-07-28/server/tools

## Actions, reproduction, and blockers

Created Dream Machine issue #86, materially updated issue #18, and added exact-head reviews to Dream Machine PR #85, Ruflo PR #3210, RVM PR #65, and RuView PR #1845. Reused Ruflo issue #3178, RVM issue #64, and MoE Foundry issue #1. Created no implementation PR, direct push to main, merge, release, deployment, or automerge change. Private repositories appear only as aggregate counts.

Connector-backed reproduction: fetch the Dream contract at `c4c2d8e`; list authenticated owner repositories with index enrichment; search portfolio open state and recent commits; fetch exact PR patches, manifests, lockfiles, instructions, releases and runs; inspect all six Dream workflows; inspect MoE workflow run 33976313700 and its completed steps.

Fresh local checkouts were unavailable. Therefore no new local Ruflo 3.25.6 scan, Python advisory audit, RuVector native/WASM replay, macOS hardware test, or RVM benchmark was claimed.

Blockers: 38 unindexed repositories; search caps; unavailable checkouts; maintainer-authorized workflows; no physical macOS receipt; no RVM installer/benchmark; no real MoE GPU run; no governed signed-federation endpoint.

Next cohort: Dream #86 immutable workflow provenance and #18 evaluator pin; Ruflo install plus claims concurrency; RVM final-boundary hook integration; RuView nil-identity abstention and hardware receipt; MoE #1 real-model qualification; RuVector Workspace CI and native/WASM/RVF persistence replay.
