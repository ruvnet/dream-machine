# Dream constellation portfolio report — 2026-09-14

## Contract and scope

The cycle began from `ruvnet/dream-machine` default branch `main` at
`3edd426f6c9c4b1e80235f7447dc863e749345cc`. Before portfolio work, the
current `README.md`, `SECURITY.md`, `dream.config.json`, ADRs, lockfile, and
compiled pipeline were read as the execution contract. The compiled prompt was
regenerated successfully (compiler-reported size: 14,258 bytes).

Human-only merge authority, draft-only autonomous work, fail-closed evidence,
private handling of high-severity findings, and one terminal verdict per frozen
hypothesis were preserved. No merge, release, deployment, direct default-branch
push, production probe, automerge change, or archived-repository modification
occurred.

## Portfolio inventory and prioritization

Pagination returned 321 owned repositories: 218 public and 103 private. None
are archived; 283 are search-indexed, 38 unindexed, and 11 empty. Private
repositories are represented only by aggregate counts.

Observed activity since the previous cycle is a lower bound: 15 public
default-branch commits across two repositories. Private activity was two commits
in one repository, aggregate-only. GitHub open-state search reported 1,437 open
pull requests and 1,648 open issues across the accessible owned portfolio.

The cohort was frozen before candidate outcomes using security 35%,
functionality/production impact 30%, velocity 10%, measurable optimization 10%,
SOTA relevance 10%, and review age 5%, with neglected-repository rotation.
Security and functionality risks overrode repeated optimization candidates.

## Deep cohort and frozen hypotheses

### 1. Core Memory — authority projection

Research hypothesis: primary authorization-memory research plus final-effect
tracing will determine whether source-bound projection prevents endogenous
authority laundering without denying valid authority. Software hypothesis:
[PR #92](https://github.com/ruvnet/core-memory/pull/92) must reject unauthorized,
stale, ambiguous, and relabeled derivations; bind authoritative source and
revocation freshness; preserve valid controls; integrate at the effect boundary;
and pass exact-head governance.

Exact head `45caa273746668663088a553c18958afdfb1b1d3` has green
[CI](https://github.com/ruvnet/core-memory/actions/runs/34765524057) and
[Security](https://github.com/ruvnet/core-memory/actions/runs/34765524064).
Node 22 and 24 each passed 75/75 tests; npm audits were clear. The synthetic
1,000-case benchmark reports false authority falling from 104/500 to 0/500,
false denial from 15/500 to 0/500, and 500/500 duplicate-sequence replays
rejected, with a 107.726 ms Node 24 candidate runtime.

Independent review nevertheless confirmed a high-severity source/revocation
binding condition. Mechanics are withheld from this public report. The new
projection also is not integrated into the provider effect path, so the measured
external enforcement delta is zero. Independent MetaHarness evaluation and the
two required human approvals remain absent. Open a
[private advisory](https://github.com/ruvnet/core-memory/security/advisories/new)
before remediation discussion.

**REJECT**

### 2. MetaHarness — cancellation propagation

Research hypothesis: cooperative-cancellation guidance plus runtime boundary
inspection will distinguish real fail-closed cancellation from acknowledgement
timing. Software hypothesis: [PR #302](https://github.com/ruvnet/metaharness/pull/302)
must prove bounded propagation through Rust, Ruflo, and an actual RVM/provider
commit boundary, with zero post-cancel effects, representative percentiles,
quality/waste controls, and all exact-head gates green.

Exact head `cb6b137f321b56c697faa326b4bd5c6db20030e4` passed the
[reproduction](https://github.com/ruvnet/metaharness/actions/runs/34359669645),
[CI](https://github.com/ruvnet/metaharness/actions/runs/34359669715), Real Tools,
and Draco workflows. Local Node 24 replay passed strict TypeScript compilation
and 30/30 tests. Across 1,000 synthetic pairs, p95 was 4,209.791 µs serial,
44.543 µs direct abort, and 62.723 µs through the bridge; all synthetic output
suppression and arithmetic controls passed.

The evaluator replays a JSONL module contract rather than a deployed authenticated
transport or concrete effect boundary. Cancellation remains cooperative, and an
adversarial control confirmed logical cancellation need not prevent a later
effect when the injected boundary fails to revalidate. The percentile measures
synchronous acknowledgement, not quiescence or provider settlement. Real quality
and provider waste are unmeasured. Exact-head
[Security](https://github.com/ruvnet/metaharness/actions/runs/34359669590)
failed its aggregate dependency gate; the green repair workflow did not commit
the repair.

**REJECT**

### 3. Ruflo — bounded recursive self-improvement

Research hypothesis: evaluator-hidden fresh holdouts and strict equal-work
controls will determine whether the branch demonstrates task-general recursive
improvement rather than persistence/admission engineering. Software hypothesis:
[PR #3309](https://github.com/ruvnet/ruflo/pull/3309) must preserve reservations,
isolation, cost bounds, and negative evidence; strictly beat its parent on fresh
tasks; keep execution disabled without approval; and pass every exact-head gate.

Exact head `237b7c31e7aaca2fc814549f5cef0dfddabd347d` passed 150 new
focused tests and 18 original tests locally. Its signed evidence replays
`NULL`/0-of-36, and all seven historical epochs replay. Dedicated
[bounded RSI](https://github.com/ruvnet/ruflo/actions/runs/34803525418),
[Verification](https://github.com/ruvnet/ruflo/actions/runs/34803525406), V3,
CodeQL, CVE, and Cross-Agent workflows passed.

No fresh-task outcome, inherited advantage, descendant gain, or end-to-end
equal-work comparison occurred. The only new effect is author-written operator
admission. Outer-author blindness is not technically enforced, total dollar cost
is unknown, and approved execution/isolation provenance remains absent. Candidate
execution correctly remains disabled. Required
[CI/CD](https://github.com/ruvnet/ruflo/actions/runs/34803525383) is red with
31 unexpected failing files; manifest and lockfile versions disagree; the CVE
workflow tolerates non-critical production findings; and the dedicated workflow
uses mutable Actions.

**REJECT**

### 4. RuView — provisioning credential lifecycle

Research hypothesis: Unix file-lifecycle guidance plus install, reopen, error,
and dry-run traces will determine whether world-readable Wi-Fi credential
artifacts are eliminated. Software hypothesis:
[PR #1889](https://github.com/ruvnet/RuView/pull/1889) must provide atomic
least-privilege creation, legacy repair before every exit, non-argv/non-stdout
credential handling, ownership/type checks, and Linux/macOS regression coverage.

Exact head `8898a3feb0ec6a6828444cde90ce23f95acab698` improves fresh
state-directory permissions from 0755 to 0700 and fresh JSON from 0644 to 0600;
14/14 focused tests pass. Exact-head CI, Security, Firmware CI, QEMU, CSI policy,
and Fix Marker workflows are green.

The fixed staging pathname can retain an existing 0644 mode, which atomic
replacement preserves. Legacy repair runs too late for read-only and failure
exits. Generator-failure CSV and dry-run NVS outputs can remain credential-bearing
0644 artifacts under umask 022, and credentials remain exposed through argv or
printed state. The current CI suite does not exercise these lifecycle paths or
macOS. No release contains the candidate head.

**REJECT**

### 5. RuLTRA — persisted witness replay

Research hypothesis: canonical serialization guidance and restart tracing will
identify the smallest compatible repair for the current chain-verification
failure. Software hypothesis: current main must verify untouched chains across
restarts, reject tampering, preserve the JSONL/hash format or migrate fail-closed,
and pass Rust, target, artifact, and security gates.

At exact main `d1ac38070f195ed28236384c86030a11c273b582`, the implementation
remains affected. The default 12-read cycle serializes one IEEE-754 value and the
default parser reconstructs its adjacent value, changing the hash input after
reopen. Existing [issue #2](https://github.com/ruvnet/rultra/issues/2) was updated
with the exact-head reproduction and the smallest compatible repair: scoped
`serde_json/float_roundtrip` plus three-boundary reopen, append, and tamper tests.
Switching old entries directly to a new canonical format was explicitly rejected
because it would invalidate historical hashes without an authenticated format
version.

Exact-main [CI](https://github.com/ruvnet/rultra/actions/runs/34796554016)
passed formatting, Clippy, workspace tests, Raspberry Pi cross-build, and RustSec.
None of 11 witness tests covers the failing float reopen. The cross-build artifact
upload also searches a different target directory from the build output, so
artifact existence is still unproven.

**REJECT**

## Security and functionality summary

No new remotely exploitable critical vulnerability or production compromise was
confirmed. One high-severity Core Memory authorization-integrity finding remains
redacted and warrants a private advisory. RuView's credential-lifecycle gaps and
RuLTRA's persisted-chain defect are publicly actionable functionality/security
findings; no secret values or exploit instructions were disclosed.

Dream Machine validation from a clean lockfile on Node 24/npm 11 passed 616
Vitest tests, 81 governance checks, build, lint, typecheck, and compiler replay.
`npm audit --omit=dev` reported zero vulnerabilities. Pinned Ruflo 3.25.6 deep
scan reported zero findings, and secret scan covered 82 files with none found.
Three STRIDE heuristic signals were manually rejected as false positives after
reachable-code inspection.

## SOTA and authoritative evidence

- [Authorization laundering, September 1, 2026](https://arxiv.org/abs/2609.01836)
  reports that source gating still leaves lifecycle/scope errors. Applicability:
  Core Memory needs non-malleable source semantics and current revocation state,
  not pointer equality or complete synthetic histories.
- [HackProbe, September 2026](https://arxiv.org/abs/2609.04665) uses a fixed
  hidden distribution plus a rotating fresh layer. Applicability: Ruflo's public
  repair hints and author-visible evaluator cannot establish inherited improvement.
- [Gander, revised September 9, 2026](https://arxiv.org/abs/2609.08977) treats
  responsive interaction as a system-level problem rather than an external
  orchestration flag. Applicability: MetaHarness must measure real transport,
  quiescence, waste, and commit fencing.
- The [MCP tools specification dated July 28, 2026](https://modelcontextprotocol.io/specification/2026-07-28/server/tools)
  requires input validation, access control, rate limits, output sanitation,
  timeouts, auditability, and human control. Applicability: authority and
  cancellation must be revalidated at each final effect.
- Linux [`open(2)`](https://man7.org/linux/man-pages/man2/open.2.html) specifies
  that creation mode applies only to newly created files and documents exclusive
  creation. Applicability: RuView must not reuse an attacker- or legacy-controlled
  staging inode without enforcing descriptor permissions.
- [RFC 8785](https://www.rfc-editor.org/rfc/rfc8785.html) requires deterministic
  JSON representation for cryptographic hashing/signing. Applicability: RuLTRA
  needs byte-stable numeric replay, while any new canonical format must be
  explicitly versioned for compatibility.

No paper, originating-team benchmark, green workflow, synthetic result, or signed
claim was relabeled as independent production validation.

## Ruflo research-loop receipt

Parent: contract-first exact-head source/workflow inspection; retrieval of the
prior validated lesson; authoritative-source deduplication; contradiction search;
effect-boundary tracing; and manual reproducibility/security critique. Candidate:
add lifecycle-complete source-freshness, post-cancel-effect, credential-artifact,
and persisted-byte restart checks. Source cutoff: 2026-09-14. Inclusion: primary
papers, standards, official runtime documentation, exact source/workflows, and
existing issues. Exclusion: vendor-only claims, duplicate source identities,
private details, exploit mechanics, and outcome-only summaries. Budget: one
generation below 45 minutes per repository. Frozen threshold: at least 10%
composite gain with no primary-source, citation, safety, privacy, licensing,
cost, or holdout regression.

The candidate mapped authoritative evidence to all five reviews and retained a
material contradiction in all five. Coverage therefore remained 5/5 versus the
parent's 5/5 (0 percentage-point gain), while the additional lifecycle controls
changed no terminal conclusion. Cost-normalized information gain and deterministic
MetaHarness replay were unavailable. The parent was retained; no research strategy
was promoted.

One redacted reusable lesson was stored with pinned Ruflo 3.25.6 under
`portfolio-patterns/portfolio-2026-09-14-bound-source-restart`: a primitive is
not system evidence until source/freshness, restart bytes, and the final commit
boundary are proven. Retrieval returned the exact stored value. The local
384-dimensional MiniLM index/runtime and key are recorded, but cross-host
persistence is not claimed.

Research-loop verdict: **INCONCLUSIVE**

## Autogenous sub-receipt

Frozen optional topology: primary-source researcher, replication reviewer,
contradiction/falsification researcher, security/privacy critic, and benchmark
designer; structured evidence deltas only. Parent baseline: the single-agent
Ruflo strategy above. Holdout: lifecycle and restart questions excluded from
candidate tuning. Frozen threshold: at least 15% authoritative-coverage or
contradiction-recall gain, no citation/primary-source regression, equal or lower
cost per validated finding, and deterministic conclusion replay.

The actual Autogenous runtime and validated LatentMesh transport were unavailable.
Platform reviewers used ordinary bounded messages as a manual fallback and are
not relabeled as Autogenous evidence. Because role-level token/cost accounting,
duplicate-source rate, and deterministic held-out replay were unavailable, no
topology or factual conclusion was promoted. Material disagreements were not
averaged away; none arose on the terminal verdicts.

Autogenous verdict: **INCONCLUSIVE**

## Constellation coordination and actions

Dream Machine supplied governance, compiled-pipeline replay, and durable evidence.
Ruflo 3.25.6 supplied security scanning and retrieval-verified local learning.
MetaHarness rules supplied adversarial and reward-hack gates; the live local
evaluator was unavailable. RuVector/RuVector WASM were considered for evidence
deduplication, but no validated remote backend was available, so exact identity
and manual deduplication were used. Core Memory supplied prior redacted lessons
and receives the aggregate checkpoint.

Actions:

- Four exact-head COMMENT reviews: Core Memory #92, MetaHarness #302, Ruflo #3309,
  and RuView #1889.
- One existing issue materially updated: RuLTRA #2.
- One dated report and exactly one ledger row added to existing Dream Machine
  draft PR #101.
- Zero new issues, implementation PRs, direct pushes, merges, releases,
  deployments, production probes, or automerge changes.

## Witness, blockers, and next cohort

After final report bytes are fixed, compute `REPORT_HASH=sha256(report)` and
`WITNESS=sha256(REPORT_HASH + 3edd426f6c9c4b1e80235f7447dc863e749345cc)`.
The ledger records the witness prefix; it grants no merge or promotion authority.

Blockers: the confidential Core Memory remediation and human approval; red
MetaHarness Security; no real cancellation transport/effect boundary; red Ruflo
full CI, mismatched dependency graph, and no evaluator-hidden fresh execution;
RuView's incomplete credential lifecycle and missing macOS regression; RuLTRA's
restart parser and missing uploaded artifact; 38 unindexed repositories; no
validated Autogenous/LatentMesh execution; no cost-accounted deterministic
MetaHarness research replay; and no validated RuVector/RVF retrieval backend.

Next cohort: private Core Memory remediation and independent evaluation;
MetaHarness live cancellation/effect fencing and dependency repair; Ruflo CI,
immutable workflows, and evaluator-hidden execution; RuView secure staging and
credential-channel redesign; RuLTRA float-roundtrip/restart repair and artifact
existence; QuDAG release recovery; Open Claude Code trusted dispatch; RuVector
native/WASM/RVF Workspace recovery; and neglected high-risk repositories.
