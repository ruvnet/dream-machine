# Dream Machine Self-Review — 2026-11-26

## TL;DR
Last self-review's forecast (PR #211, 2026-11-12) predicted that *the very
next* self-review night, 2026-11-19, would find PR #211's own ledger row
through the new `gh`-search lookup it introduced. That night never ran.
Live `gh` checks tonight found zero trace of 2026-11-19 anywhere in this
repository — no `dream/2026-11-19-*` branch, no PR, no `[Dream Cycle
2026-11-19]` issue — so the forecast cannot be scored HIT or MISS; it is
**UNSCORABLE**, because the mechanism it tests was never invoked. Widening
the check past just the self-review surface: of the 14 nights since
2026-11-12, only **2** (2026-11-24, 2026-11-25 — both RESEARCH-ONLY,
`developer-experience`/`compiler-parity`) left any trace at all. The other
12, including the scheduled self-review on 2026-11-19, produced nothing —
no branch, PR, or issue. This is a new, distinct defect from anything the
last four self-reviews (#199, #202, #204, #211) found: those all assumed
the routine *ran* and diagnosed what it did wrong; tonight's finding is
that the routine's own continuity ledger has no way to notice when it
*doesn't run at all*. Candidate: STEP 1.6 now opens with a cadence check —
compute the date `everyDays` ago, search `gh` for its branch/PR/issue, and
if none exists, record `MISSED_NIGHT=<that-date>` instead of silently
treating tonight as an unbroken continuation. Scoped to what a compiled
prompt can actually fix: *detecting* a skipped night, not preventing one
(the scheduler that didn't fire is outside this repository).

## Score: last self-review's forecast (PR #211, issue #210)
**Forecast (frozen 2026-11-12):** the next self-review (2026-11-19) finds
PR #211's row (or #204's) via the new `gh pr list --state all --search
'head:dream/'` lookup, with no manual fallback needed, versus 0 of the
prior 3 self-reviews finding their predecessor's forecast that way.

**Measured tonight (live `gh` checks against the real repo):**
- `git ls-remote origin 'refs/heads/dream/2026-11-19*'` → **0 refs**.
- `search/issues repo:ruvnet/dream-machine is:pr head:dream/2026-11-19` and
  the general open/closed/merged PR listings → **0 PRs** with that head.
- `search/issues ... is:issue created:2026-11-15..2026-11-21 label:dream-cycle`
  → **0 issues**.
- The newest `routine-self-review` artifact anywhere in the repo remains
  PR #211 itself (created 2026-11-12), still open/draft/unreviewed.

**Verdict: UNSCORABLE (missed night).** Not HIT, not MISS, not "none" —
the forecast had a real mechanism and a real target date, but the night
meant to exercise it never happened. Per PR #211's own text: "a night that
never ran cannot have tested anything." This is the first-ever use of that
exact clause, and it describes tonight's situation precisely — which is
itself evidence the clause was worth adding, independent of anything else
in this report.

## Measure
Ground truth via `gh api search/issues` (not the sometimes-wrong
`merged:false` field on list endpoints — this repo's ledger has recorded
that failure mode before, e.g. PR #89):
- `is:pr is:merged head:dream/` → **42** (unchanged since 2026-11-12 — the
  last burst was 2026-11-06).
- `is:pr is:closed is:unmerged head:dream/` → **8** (unchanged; newest is
  #194, closed 2026-11-06).
- `is:pr is:open head:dream/` → **19** (#211/#204/#202/#199 self-review;
  #192/#189/#184/#182/#180/#161/#156/#154/#152/#148/#145/#141/#137
  candidates; #101/#98 stale pre-v2 portfolio drafts).
- `pipelineMergeRate = 42 / (42 + 8 + 19) = 60.9%` (was 61.8% a fortnight
  ago at 18 open; one more open PR since, zero new merges or closures —
  consistent with "nothing moved," not a rate regression).
- `dream-machine ledger signals`: `ledgerStale=true`, `daysSinceLastRow=29`
  (main's last row is 2026-10-28), `reviewBacklogSize=19`, `zeroMergeStreak=false`.
- `dream-machine ledger backlog`: **1** open finding (#18, 2026-08-18,
  `accept-closed-unmerged`) — the backlog of *unimplemented* findings is
  nearly empty; the problem is not a lack of findings, it's that nothing
  proposed since 2026-11-12 has run to completion in any form.
- Zero REJECT/INCONCLUSIVE/closed-unmerged/stale candidates exist *since*
  2026-11-12 to classify by cause, for the same reason as the UNSCORABLE
  forecast above: with 12 of 14 nights leaving no trace, there is close to
  nothing to classify.

## Cluster
Taxonomy: planning | tool | memory | verification | recovery | resource |
security | unknown.

1. **planning** (the backlog/review-queue lock — same cluster #211 and
   #204 both already named) — still real (19 open, 3x over
   `reviewBacklogLimit=6`), but unchanged in the last two weeks and already
   has two independent unreviewed fixes competing for the same review slot
   (#204's `CONSOLIDATE_STREAK` cap, #211's forecast lookup). A third
   overlapping attempt adds reconciliation cost, not new evidence.
2. **recovery** (new tonight) — 12 of the last 14 scheduled nights,
   including a scheduled self-review, produced no branch, PR, issue, or any
   other trace. Nothing in the routine's own ledger, signals, or outcome
   tooling distinguishes "the pipeline ran and legitimately found nothing
   new" from "the pipeline did not run." The routine has no dead-man's
   switch — a missed night is invisible by default and stays invisible
   forever unless a human happens to notice the date gap by hand, which is
   exactly how tonight's finding was made (manual `gh` date-range checks,
   not anything the compiled prompt currently asks for).

**Selected cluster: recovery.** It is strictly larger by night-count (12
silent nights vs. the planning cluster's steady-state 19-PR backlog, which
at least is *visible*), it is the only cluster with zero competing unmerged
fixes already in flight, and — unlike cluster 1 — a fix for it does not
need `main` to have merged anything first: a self-review night is itself
one of the things the new check would have caught missing.

## Candidate (mechanism, one sentence)
STEP 1.6 gains a new first item, "Confirm last cycle's cadence held": it
computes the self-review date `everyDays` (7) days before tonight, searches
`gh` (`gh pr list --state all --search 'head:<branchPrefix><that-date>-'`,
plus a branch-name check and an issue-title-prefix check) for any trace of
it, and — if all three come back empty — records `MISSED_NIGHT=<that-date>`
in the Finding and ledger Effect column instead of treating tonight as an
unbroken continuation. "Score the last forecast first" (now item 2) is
amended so that when the night it's scoring against was itself a missed
self-review night, the forecast is recorded as `UNSCORABLE (missed night)`,
not HIT, MISS, or `none`.

`packages/compile/src/v2.ts`:
- `v2SelfReview()` takes a new `branchPrefix` parameter (threaded from
  `index.ts`'s existing `c.branchPrefix`, the same value `v2ModeSelection()`
  already receives).
- New numbered item 1 inserted before the existing "Score the last
  forecast first" (now item 2); items 2-6 renumbered to 3-7. No other text
  in the file references step numbers 1-6 by number (grepped the whole
  file to confirm the renumber breaks nothing else).
- The `gh pr list` instruction is explicit about `--state all` ("never just
  `--state open`, since a merged or closed PR from that night still proves
  it ran") — a gap an independent critic caught in this candidate's own
  first draft and which was fixed before this report was written.

`packages/compile/src/index.ts`: threads `c.branchPrefix` through to the
now 3-argument `v2SelfReview()` call, still gated behind `if (c.selfReview)`
exactly as before (v1-only configs are unaffected — the existing "is
opt-in" test in `v2.test.ts` still passes unmodified, because that file was
not touched — see below).

**`packages/compile/src/v2.test.ts` was deliberately left untouched.** This
candidate's first draft added one test there to pin the new wording; an
independent critic correctly flagged that `ROUTINE_CONSTITUTION` lists
`packages/compile/src/v2.test.ts` by exact path as something "a candidate
that touches ... is REJECT," with no carve-out for an additive, passing
test. Rather than argue the file's own comment (a narrower-scoped
"floor-lowering tripwire" rationale) against the compiled prompt's own
literal, bright-line wording, the test was reverted in full
(`git diff`/`git status` on that file show nothing). The new text is
instead verified by the existing golden-snapshot tests in `index.test.ts`
and `targets.test.ts` (not on the protected list), by the self-hosted
byte-identical recompile check below, and by this report's own manual
review — a smaller verification surface than ideal, named here rather than
silently accepted.

Does not touch `implementationTrack.reviewBacklogLimit`, `selfReview.everyDays`,
the CONSOLIDATE limits, the independent critic/reward-hack checks, any
evaluator entrypoint, witness computation, ledger schema, or any other
`ROUTINE_CONSTITUTION` item. Does not compete with or attempt to re-decide
anything PR #204 or #211 already proposed (both untouched by this diff).

## Evaluation Receipt
Real evaluator: `npm test` (`vitest run && node --test scripts/*.test.mjs`).

| | Baseline (`71d607b`, parent) | Candidate |
|---|---|---|
| vitest | 908 | 908 (unchanged — see note) |
| governance | 197 | 197 (unchanged) |
| lint / typecheck | clean | clean |
| mirror check (`compile-targets.mjs --check`) | pass | pass (all 5 targets regenerated + reviewed) |

Note on vitest count: the candidate's first draft added one test
(908→909); it was reverted along with the `v2.test.ts` edit for the
constitution reason above, returning the count to baseline. 0 regressions
either way — the number is unchanged because nothing was added, not because
anything was removed from what existed before tonight.

Self-hosted `dream.config.json` compile output confirmed byte-identical to
its regenerated mirror (`docs/dream-cycle/compiled/ruvnet-dream-machine.md`
diffed directly against `node packages/cli/dist/bin.js compile
dream.config.json` output); all 5 targets sharing this compile engine
(self-hosted + `ruflo`/`metaharness`/`ruvector`/`ruclip`) had mirrors
regenerated via `node scripts/compile-targets.mjs` — identical hunk shape
across all five (none of their configs set a non-default `branchPrefix`
tonight).

## Baseline
Parent commit `71d607bea6608180b8c41980dc5386526d3f1f16` (`main`), this
session's own fresh checkout. `npm ci && npm run build` succeeded in full
(no wasm/NAPI degradation to record).

## Darwin Lineage
`DARWIN=not-applicable` — a compiled-instruction-text fix to the routine's
own self-review step has no evolvable population or fitness function for
`@metaharness/darwin` to act on; consistent with every prior
`routine-self-review` row (#199/#202/#204/#211), none of which ran Darwin.

## Evidence
OBSERVATION: `git ls-remote origin` returns zero refs matching
`dream/2026-11-19*`; `gh api search/issues` returns zero PRs or issues
referencing that date for this repository.
OBSERVATION: of `dream/2026-11-13-*` through `dream/2026-11-25-*` (13
candidate dates before tonight), only `dream/2026-11-24-ledger` and
`dream/2026-11-25-ledger` exist, each with a corresponding `[Dream Cycle
...]` issue (#214, #215) and `evaluated=no` RESEARCH-ONLY shape.
INFERENCE: STEP 1.6.1 as compiled before tonight would, if a self-review
session had run on 2026-11-19, have found *nothing* to score (no row on
`main`, matching #211's diagnosis) — but no session appears to have run on
that date at all, which #211's fix does not detect because it only searches
for a *prior forecast*, not for the *absence of the run itself*.
DECISION: add a check for the run's absence, scoped to the self-review
surface (where this report's own forecast-scoring step already depends on
a prior night having happened), rather than attempt a general every-night
dead-man's switch across all 5 slot surfaces — a larger, riskier change to
STEP 1 that would touch every non-self-review night's compiled text too,
and that this session's remaining budget does not cover carefully. REJECTION:
considered folding this into PR #204's `CONSOLIDATE_STREAK` cap (same
general "pipeline health" theme) — rejected because #204's mechanism
tracks consecutive CONSOLIDATE *outcomes* within a run that happened, and
tonight's finding is about runs that didn't happen at all; conflating the
two would make #204 harder to review in isolation for no shared logic.

## Reward-Hack Check
Independent critic dispatched twice (separate-context subagent, no
authorship stake, given only the diff and `ROUTINE_CONSTITUTION`, told to
attack it against the off-limits list, test vacuity, and the `gh` command's
correctness, and to run `npm test`/`build`/`lint` itself rather than trust
this session's report):
- **First pass: BLOCKED.** Found the `v2.test.ts` constitution violation
  above (the literal "touches ... is REJECT" wording) and the missing
  `--state all` on the `gh pr list` search (a 7-night-old self-review PR
  would normally be open/draft, but a merged or closed one should still
  count as "it ran" — defaulting to `--state open` risked a false
  `MISSED_NIGHT` the moment any self-review PR is eventually reviewed and
  merged or closed).
- **Second pass, after both fixes: CLEAR.** Independently re-ran `git diff`
  (confirmed `v2.test.ts` has zero diff), `npm test` (197/197 governance,
  vitest green), `npm run build`, `npm run lint`, and reviewed
  `ROUTINE_CONSTITUTION` item by item against the final diff. No outstanding
  issues found.

Self-critique in parallel: does this candidate weaken a test, benchmark,
threshold, or gold answer? No — net zero new/removed tests after the
revert, none loosened. Does it cherry-pick or exploit the evaluator? No —
`npm test` runs unmodified. Does it touch `reviewBacklogLimit` or
`selfReview.everyDays`? No — neither is read or written. Does it compete
with or duplicate #204's or #211's unmerged fixes? No — disjoint concerns
(consecutive-CONSOLIDATE capping; forecast-lookup-across-branches; this
one, run-absence detection), confirmed by re-reading both PRs in full
before selecting tonight's cluster.

## Security Review
Touches only compiled instructions for a future agent run, plus which
read-only `gh` queries it is told to make (branch listing, PR search by
head, issue search by title prefix) — the same shape of query
`v2ModeSelection()` and PR #211's own fix already issue elsewhere in this
compiled prompt. No new tool, permission, credential, or network surface.
No prompt-injection surface: `branchPrefix` is interpolated into the
compiled text exactly as it already was in three other sections of this
same file (`v2ModeSelection`, `v2ScheduleContract`, STEP 20's branch-name
line), all gated by `validateConfig`'s existing `branchPrefix may contain
only ...` character-class check — this candidate adds no new unescaped
interpolation of any config field. Reduces a correctness/availability risk
(a silently-stalled pipeline going unnoticed indefinitely) rather than
introducing one.

## Regression Analysis
7 files changed from baseline: 2 logic files (`v2.ts` one new parameter +
one new/renumbered checklist item, `index.ts` one call-site update), 2
generated snapshot files, 5 mechanically-regenerated compiled mirrors (one
of the 7 file-count is shared across the mirror list — see `git diff
--stat` for the exact set). `packages/compile/src/v2.test.ts`: zero diff,
confirmed deliberately. 908 vitest + 197 governance tests pass; lint/
typecheck clean; mirror check clean. No GLOBAL INVARIANT, verdict rule,
promotion gate, merge policy (`autoMerge`/`prMode`/ready-for-review
predicate), CONSOLIDATE limit, independent-critic/reward-hack check,
evaluator entrypoint, witness computation, ledger schema,
`reviewBacklogLimit`/`everyDays` value, research floor, or
config-validation/golden-snapshot substance touched — confirmed by diff
review and two independent-critic passes, as the self-review constitution
(ADR-0011) requires.

## ADR
None — an observability fix to one step of the routine's own compiled
template, not an architectural decision (STEP 19: never for parameter
changes, docs, or minor prompt/routing tweaks).

## Gist
`GIST=LOCAL` — `gh auth status` reports `GH_TOKEN` invalid in this session
(the same condition PR #199/#202/#204/#211 all recorded), and no
gist-creation MCP tool is available. Full report committed as
`docs/dream-cycle/2026-11-26-routine-self-review-report.md`, the durable
artifact.

## Issue
Filed alongside this report (see PR body for the live issue number).

## Witness

```
report_sha256 : 02f3b93d1456860c7cddb2ffc255b3deac41b926f171012be5fb46e932b5293c
session_commit: 71d607bea6608180b8c41980dc5386526d3f1f16
witness       : 8b4c358dd68d959811e0e9f1ccee304d8a273b14a9b835948b8dce922e198b5e
```

Computed over this file's canonical bytes (everything above this heading,
trailing whitespace collapsed to one newline) — reproducible from the
committed file with no unavailable intermediate bytes. Verify:

```bash
dream-machine witness verify-report docs/dream-cycle/2026-11-26-routine-self-review-report.md --commit 71d607bea6608180b8c41980dc5386526d3f1f16
```

## Merge Policy
**This PR stays draft, regardless of verdict.** Per STEP 1.6/ADR-0011's
routine constitution: "A self-review PR always stays human-review-only,
whatever `prMode` says." This session never merges and never autonomously
promotes candidate state.

## Ledger
Row to be appended for 2026-11-26 (`docs/dream-cycle/LEDGER.md`, on this
PR's own branch — reaches `main` only if this PR merges, the same caveat
every self-review row before it has carried, and precisely the caveat
PR #211's fix exists to route around for scoring purposes, though not yet
for *landing* purposes — that part of the planning cluster remains
unsolved and out of scope tonight).

**Forecast, frozen before this candidate was evaluated:** the next
self-review (2026-12-03, `EPOCHDAY % 7 == 0`) finds *this* PR's branch,
PR, or issue for 2026-11-26 via its own new STEP 1.6 item 1 check — i.e.
`MISSED_NIGHT` stays unset for 2026-11-26 when that night runs its check.
Current value: 0 of the 14 nights since 2026-11-12 that *should* have left
a self-review trace on 2026-11-19 actually did (the UNSCORABLE forecast
above); more broadly, 2 of 14 nights left any trace at all. Target: 1 of 1
— the next self-review finds tonight's artifact without a human needing to
have merged anything first, exactly mirroring how PR #211 forecast itself
being found by 2026-11-19 (which could not be tested, because 2026-11-19
did not happen). If 2026-12-03 also leaves no trace, that will be the
*second* consecutive missed self-review night, and would itself be the
loudest possible evidence that cluster 2 ("recovery") is not a self-review
mechanism problem at all, but a scheduler/execution problem entirely
outside this repository's own control — worth escalating to the human
operator directly rather than attempting a third compiled-prompt fix for a
problem compiled prompts cannot reach.
