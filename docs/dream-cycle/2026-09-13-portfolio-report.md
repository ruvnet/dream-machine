# Dream Machine portfolio report — 2026-09-13

## Contract, inventory, and scope

The cycle fetched `ruvnet/dream-machine` default branch first at
`3edd426f6c9c4b1e80235f7447dc863e749345cc`. The active contract was read from
README.md (`355222b4f9ef7e46c199d903e74fa24223f33e4d`), SECURITY.md
(`1663f995e80a3088e46fa6fa6633351ad934a959`), dream.config.json
(`c17b00036f11b09cb0999f5142089c84252531f9`), ADR-0001, the ADR index, package
manifests, lockfile, and the freshly compiled 14,258-byte pipeline. Human-only
merge authority, fail-closed evidence, private vulnerability disclosure, and
exactly one terminal verdict per repository were preserved.

All owned repositories were inventoried using four pages of 100, 100, 100, and
21 results. The portfolio contains 321 repositories: 218 public and 103 private.
None are archived; 283 are indexed, 38 unindexed, and 11 empty. Private
repository identities and details are excluded.

Commit search is a lower bound because it used multiple common message terms
and each search is capped. Since 2026-09-12T00:00:00Z it found 15 public
default-branch commits across three repositories. Private activity was four
commits across two repositories, aggregate-only. Open-state searches again
reached connector caps at at least 100 pull requests and 100 issues.

The configured ranking—security 35%, functionality and production impact 30%,
velocity 10%, measurable optimization 10%, SOTA relevance 10%, and review age
5%—selected Dream Machine, Ruflo, MetaHarness, RuVector, and RuView. Each review
froze a software hypothesis and a separate research hypothesis before judging
the exact-head outcome.

## Deep reviews

### 1. Dream Machine — review-backlog telemetry

Software hypothesis: [PR #109](https://github.com/ruvnet/dream-machine/pull/109)
must safely validate backlog depth, preserve prior signals, work through the
library/CLI/TUI, and be consumed by the compiled nightly path.

Exact head `fba825264cb464dc4c78917f319ecac4fb1b94cb` is draft and mergeable.
Parent results were 616/616 Vitest plus 81/81 governance; candidate results were
627/627 Vitest (+11 additive tests) plus 81/81 governance. Local `npm run check`
passed, as did exact-head [CI run 34583598313](https://github.com/ruvnet/dream-machine/actions/runs/34583598313)
and [CodeQL run 34583598327](https://github.com/ruvnet/dream-machine/actions/runs/34583598327).
The locked production dependency graph reported zero advisories. The latest
release remains [v0.1.0, published August 13, 2026](https://github.com/ruvnet/dream-machine/releases/tag/v0.1.0).

The operational claim fails. Compiling the exact head produces a bare
`dream-machine ledger signals` instruction and never supplies `--open-count`,
so the nightly path still returns `reviewBacklogSize: null` without manual work.
The parser accepts integers outside JavaScript's safe range and silently rounds
them, while the exported library accepts negative, fractional, and non-finite
values. The UI also labels open candidates as “unreviewed” without measuring
review state. Finally, the report witness is anchored to the base/session commit
rather than the implementation head, so it does not bind the evaluated code.
The exact-head review requires safe bounded validation at both boundaries,
review-accurate wording, compiled-path consumption, and head-bound provenance.

Verdict: **REJECT**

### 2. Ruflo — bounded RSI experiment

Software hypothesis: draft [PR #3309](https://github.com/ruvnet/ruflo/pull/3309)
must demonstrate inherited improvement on evaluator-hidden tasks under matched
end-to-end cost, preserve negative evidence, keep effect authority closed, and
pass the repository's complete qualification envelope.

Exact head `d09afece5570748daf1db0cf73ea64264beacd1f` is mergeable but spans 40
commits, 174 files, and +54,076 lines. The original synthetic experiment is a
useful negative result: 137,088 evaluations, with the adaptive arm losing 16/16
seeds to frozen and shuffled controls. Prospective generalization ran 399,024
evaluations, passed 0/36 gates, and all 12 adaptive-versus-frozen means were
negative. Seven native development epochs used 209,784 BM25 field calls and
raised MRR from 0.383092 to 0.458503, but they recovered a developer-observed
static winner; adaptive tied frozen in all three final probes. No learned-credit,
recursive, or descendant-productivity advantage was established.

The bounded-RSI workflow passed 18/18 experiment/generalization tests and
177/177 loop/repair tests. CVE, CodeQL, Verification, V3 CI/CD, and cross-agent
workflows also passed. Required repository [CI/CD run 34741229613](https://github.com/ruvnet/ruflo/actions/runs/34741229613)
failed on the added corpus and package setup. `package.json` and `pnpm-lock.yaml`
disagree on two internal package versions, and the new workflow uses mutable
Action tags. Equal work covers logical synthetic slots, not total CPU, dollar,
acquisition, outer-research, or descendant cost. Source-disjoint tasks remain
public and developer-visible; exposed historical fixes are not evaluator-hidden
holdouts. Candidate execution remains correctly disabled and its proposed
resource envelope is not authorized. The latest release is
[v3.41.2, published September 10, 2026](https://github.com/ruvnet/ruflo/releases/tag/v3.41.2).

Verdict: **REJECT**

### 3. MetaHarness — promotion rule integrity

Software hypothesis: draft [PR #307](https://github.com/ruvnet/metaharness/pull/307)
must remove the zero-floor no-op lockout without allowing unchanged, malformed,
or safety-incomplete evidence to promote.

Exact head `37b0b2456129804f953957348247780c7d5171f9` is draft and mergeable.
The intended measured candidate raises the primary score 0.897456→0.950695
(+5.93%) and lowers cost per win 7.636364→7 (-8.33%), with no-op rate remaining
zero. The exact-head flywheel suite passes 85/85. [CI run 34680105139](https://github.com/ruvnet/metaharness/actions/runs/34680105139),
[Security run 34680105022](https://github.com/ruvnet/metaharness/actions/runs/34680105022),
and [Real Tools run 34680105073](https://github.com/ruvnet/metaharness/actions/runs/34680105073)
all passed across the declared platforms and gates. The latest release remains
[v0.4.4, published August 10, 2026](https://github.com/ruvnet/metaharness/releases/tag/v0.4.4).

Independent adversarial replay nevertheless found a reachable high-severity
promotion-integrity defect and a separate no-lift promotion case. Details that
would facilitate misuse are intentionally withheld from this public report.
Green CI demonstrates that the existing suite does not cover the failing
runtime-domain invariant, and the committed evidence receipt is stale relative
to the exact head. Open a [private MetaHarness security advisory](https://github.com/ruvnet/metaharness/security/advisories/new)
and regenerate the receipt only after maintainers add the fail-closed regression
set. No remote production exploitation was attempted or established.

Verdict: **REJECT**

### 4. RuVector — local deterministic min-cut

Software hypothesis: draft [PR #983](https://github.com/ruvnet/RuVector/pull/983)
must pass every preregistered effectiveness, performance, determinism, tamper,
feature-enabled, and native/WASM/RVF compatibility gate.

Exact head `33f3e414bb925c43317f7f9770e0148de3e13fef` is draft and mergeable.
The mandatory bridge-survival gain is +0.0 percentage points versus a required
≥15 points, so the primary effect gate fails. Twenty of twenty survivor-set
determinism trials and 20/20 single-byte tamper trials passed. The benchmark's
“largest within 1.5 seconds” selector incorrectly retains the first over-budget
Exact result. The correct in-budget point is n=84: roughly 263× faster than
Exact and 15.2× slower than the baseline, not the published n=168 comparison.

At the default `max_radius=0`, the implementation behaves as a degree-limited
singleton heuristic and ignores similarity-derived weights; it does not
establish equivalence to the cited tree-packing/coloring LocalKCut algorithm.
No workflow enables or tests `mincut-forget`. Required
[Workspace CI run 34681135836](https://github.com/ruvnet/RuVector/actions/runs/34681135836)
timed out at its 240-minute cap before `core-and-rest` produced a test summary,
although the other 17 jobs completed. Native, WASM-dedup, supply-chain,
regression, formatting, and clippy workflows passed, but none qualify the changed
feature or an RVF interoperability round trip. A new mandatory public struct
field also breaks downstream struct literals. Latest release:
[ruvector-v0.2.40, July 29, 2026](https://github.com/ruvnet/RuVector/releases/tag/ruvector-v0.2.40).

Verdict: **REJECT**

### 5. RuView — empty-room and live-view recovery

Software hypothesis: [PR #1914](https://github.com/ruvnet/RuView/pull/1914)
must remove empty-room false presence and restore live-view recovery without
weakening current-vitals authority, explicit disconnect, occupied recall,
source provenance, or privacy boundaries.

Exact head `50284aa9471114eab596976b1361918f67c796ee` is mergeable. Deterministic
replay found two changed-code regressions: the UI can retain numeric vital signs
after a governed frame abstains and reports an empty room, and explicit/manual
disconnect can schedule reconnection again. The author hardware receipt also
records `motion_level=absent` for 736/736 samples, including walking, so activity
remains nonfunctional. Existing UI tests pass 29/29, fix markers 27/27, and CSI
policy self-tests 6/6, but none cover the two changed behaviors. Rust validation
could not run locally. All five exact-head workflows—CI, Security, Bench, CSI
policy, and Fix Marker—ended `action_required` and executed no jobs. Latest
release: [v2655, September 11, 2026](https://github.com/ruvnet/RuView/releases/tag/v2655).

A separate reachable high-severity sensing-privacy condition was independently
confirmed. Its mechanics and any exploit path are redacted. Open a
[private RuView security advisory](https://github.com/ruvnet/RuView/security/advisories/new)
before remediation discussion. The public acceptance gate is limited to
authority-loss clearing, manual-disconnect suppression, deterministic
regressions, occupied/activity holdouts, and green exact-head CI/Rust evidence.

Verdict: **REJECT**

## Security and functionality summary

No critical vulnerability, exposed credential, or production compromise was
confirmed. Two high-severity findings were confirmed with high confidence and
kept redacted: one MetaHarness promotion-integrity boundary and one RuView
sensing-privacy boundary. Both warrant private GitHub Security Advisories.

Dream Machine exact-head local validation ran from a clean lockfile on Node
24.19.0/npm 11.9.0:

```text
npm ci                                      PASS
npm run check                               PASS: 627 Vitest + 81 governance
npm audit --omit=dev --json                 PASS: 0 vulnerabilities
ruflo 3.25.6 security scan --depth deep     PASS: 0 findings
ruflo 3.25.6 security secrets               PASS: 82 files, no secrets
ruflo 3.25.6 security threats --model stride 3 heuristic signals
```

The three STRIDE signals were manually rejected as false positives: ANSI escape
constants and explicit non-secret test fixtures. Scanner output was treated as
untrusted evidence and checked against reachable code. No archived repository
was modified, and no production system was probed.

## SOTA and authoritative evidence

- [BenchShield, September 10, 2026](https://arxiv.org/abs/2609.11028) supports
  infrastructure-side trajectory evidence and exposes the weakness of signed
  aggregate attestations alone. Applicability: Ruflo's future evaluator-hidden
  holdout and MetaHarness promotion receipts.
- [The Last AI Built by Humans, September 10, 2026](https://arxiv.org/abs/2609.11873)
  separates persistence from acquisition, adaptation, and recursive
  meta-improvement autonomy. Applicability: Ruflo currently demonstrates
  persistence engineering and useful negative evidence, not RSI.
- [Beyond Test Presence, July 13, 2026](https://arxiv.org/abs/2607.12068)
  motivates assertion-strength and edge-case review rather than accepting test
  counts. Applicability: every green-but-contradicted candidate in this cohort.
- [Vector-system benchmark methodology, August 13, 2026](https://arxiv.org/abs/2608.12812)
  measures quality, latency distributions, throughput, build time, and storage
  across datasets. Applicability: RuVector needs real embeddings, recall and
  false-positive quality, repeated seeds, and latency percentiles.
- [OpenCSI, revised August 4, 2026](https://arxiv.org/abs/2607.26665) limits its
  demonstrated transfer to binary presence and uses calibration maturity/drift
  abstention. [Age of Samples, June 30, 2026](https://arxiv.org/abs/2606.31690)
  makes freshness explicit for irregular acquisition. Applicability: RuView's
  current-vitals and activity claims.
- GitHub's [secure-use guidance](https://docs.github.com/en/actions/reference/security/secure-use)
  states that a full commit SHA is the only immutable third-party Action
  reference. Applicability: Ruflo's newly added workflow.
- Node states that its [permission model](https://nodejs.org/api/permissions.html)
  does not protect against malicious code, while Bubblewrap's
  [security model](https://github.com/containers/bubblewrap/blob/main/README.md)
  depends on the constructed policy. Applicability: Ruflo's disabled future
  candidate executor.

No paper, originating-team benchmark, signed claim, software-only result, or
hardware receipt was relabeled as independent production validation.

## Ruflo research-loop receipt

Parent strategy: contract-first exact-head source/workflow inspection, prior
Core Memory deduplication, authoritative-source search, final-effect tracing,
and manual security/reproducibility critique. Query set covered runtime-domain
validation, evaluator-hidden RSI controls, local-cut algorithm mapping, vector
benchmark methodology, sensing freshness, and workflow immutability. Source
cutoff: 2026-09-13. Inclusion: primary papers, official specifications/docs,
exact source, exact workflows, and existing issue evidence. Exclusion:
vendor-only conclusions, duplicate source identities, unverified summaries,
private-repository detail, and vulnerability mechanics. Budget: one generation,
below 45 minutes per repository. Frozen promotion threshold: ≥10% composite
improvement with no source-quality, citation, privacy, security, licensing,
cost, or holdout regression.

Candidate generation added contradiction-first runtime/effect-boundary checks.
Across five repositories it found multiple material contradictions, including
two independently confirmed confidential high-severity conditions. On Ruflo's
research corpus specifically, unique primary coverage rose from eight to ten
(+25%) by adding BenchShield and The Last AI Built by Humans, with no
primary-source-ratio decrease. However, information-gain-per-cost was not
available, the held-out set was not preregistered in a replayable artifact, and
the five repository conclusions were not deterministically replayed through a
local MetaHarness evaluator. Strategy promotion therefore remains blocked.

The pinned Ruflo runtime executed as v3.25.6. A local hybrid 384-dimensional
MiniLM memory backend initialized and verified 6/6 checks. One redacted reusable
lesson was stored under
`portfolio-patterns/portfolio-2026-09-13-runtime-gates` and exact retrieval
matched: compile-time types, signed aggregate booleans, green CI, and pass counts
do not prove an effect-boundary safety invariant; validate required runtime
domains, require strict beats-parent controls, run the changed feature, and use
an untouched or infrastructure-derived holdout. The local write is retrieval-
verified but cross-run persistence is not established; the same safe lesson is
therefore also preserved in this report and the Core Memory checkpoint.

Research-loop verdict: **INCONCLUSIVE**

## Autogenous sub-receipt

Frozen topology: five non-duplicative repository reviewers plus one independent
security/privacy critic, using structured deltas and ordinary bounded messages.
Parent baseline: the single-agent Ruflo strategy above. Source cutoff:
2026-09-13. Stopping rule: one review generation plus one independent critic.
Frozen threshold: ≥15% authoritative coverage or contradiction recall, no
citation or primary-source regression, equal or lower cost per validated
finding, and deterministic conclusion replay.

The actual ruvnet/Autogenous repository was inspected and remains an honestly
labelled research prototype; its live external integrations are not available
in this environment. The Autogenous runtime, validated LatentMesh semantic-delta
transport, and cost/token accounting were not executed. Platform reviewers
therefore served only as a manual parallel fallback and are not relabeled as
Autogenous evidence. Duplicate rate, cost per validated finding, and
deterministic held-out replay were unavailable, so no topology or factual
conclusion was promoted into Ruflo's next parent.

Autogenous verdict: **INCONCLUSIVE**

## Constellation coordination and actions

Dream Machine supplied governance and the compiled pipeline. Ruflo 3.25.6
supplied routing, security scanning, and local memory verification. MetaHarness
rules supplied adversarial/reward-hack gates; the live local evaluator was not
available. RuVector and RuVector WASM evidence was inspected, but the changed
feature and RVF interoperability were not executed. Core Memory supplied the
prior redacted lesson and receives this cycle's aggregate checkpoint.

Actions:

- Five exact-head PR reviews: Dream Machine #109, Ruflo #3309, MetaHarness #307,
  RuVector #983, and RuView #1914.
- Zero new or materially updated issues, implementation PRs, direct pushes,
  merges, releases, deployments, production probes, or automerge changes.
- One existing Dream Machine evidence draft (#101) receives this dated report
  and exactly one ledger row.
- No public disclosure of the two redacted high-severity conditions.

## Witness and replay

The report is committed without embedding its own digest. After final bytes are
fixed, compute `REPORT_HASH=sha256(report)` and
`WITNESS=sha256(REPORT_HASH + 3edd426f6c9c4b1e80235f7447dc863e749345cc)`.
The ledger row records the witness prefix. Re-run the commands and compare the
exact PR-head bytes; the witness does not authorize merge or promotion.

## Blockers and next cohort

Blockers: 38 unindexed repositories; open-state and commit-search caps; two
private advisories requiring maintainer handling; Ruflo full-CI and dependency
graph failures; no evaluator-hidden RSI holdout or approved execution budget;
MetaHarness promotion-integrity remediation; RuVector feature-disabled and
timed-out Workspace evidence; RuView action-required workflows and missing Rust
replay; no physical sensing validation; no validated LatentMesh channel; and no
cross-run proof for local Ruflo memory.

Next cohort: private MetaHarness and RuView remediation; Dream Machine compiled
backlog telemetry and head-bound witnesses; Ruflo full-CI, immutable workflow,
and evaluator-hidden controls; RuVector feature-enabled local-cut correctness;
RuView vitals/reconnect/activity regression coverage; QuDAG release recovery;
Open Claude Code trusted dispatch; and neglected high-risk repositories.
