# Dream Machine Self-Review — 2026-11-12

## TL;DR
Last week's forecast (PR #204, 2026-11-05 — "at least one of the next 7
nights resolves to RESEARCH-ONLY/IMPLEMENT/RESEARCH") scores a clean
**MISS**: 0 of the 7 nights since did (2026-11-06→11-11; 0 new `[Dream
Cycle ...]` issues, 0 new `dream/*` candidate PRs). But the mechanism meant
to force that outcome — `CONSOLIDATE_STREAK` — was never deployed: PR #204
itself is still open/unreviewed, so `main`'s compiled routine has no streak
cap at all tonight. The MISS is evidence against *leaving PR #204 unmerged*,
not against the cap's logic, which was never exercised in production. That
distinction exposed the real, narrower bug this self-review fixes: STEP
1.6.1 ("score the last forecast first") told every self-review session to
look for the prior forecast only in `docs/dream-cycle/LEDGER.md` on `main`
— but a `routine-self-review` row only lands there if its PR merges, and 0
of this routine's last 3 self-review PRs (#199, #202, #204) ever have.
Followed literally, STEP 1.6.1 would have told tonight's session "no prior
forecast exists" — false; three do, all on unmerged branches, including the
one just scored above. Fixed `v2SelfReview()` so STEP 1.6.1 also searches
`gh pr list --search 'head:<branchPrefix>' --state all` for the most recent
branch matching `-routine-self-review` and reads `LEDGER.md` at its head
when `main`'s copy has nothing newer — the exact lookup this session had to
do by hand to find PR #204's forecast in the first place.

## Score: last self-review's forecast (PR #204, issue #203)
**Forecast (frozen 2026-11-05, found on PR #204's own unmerged branch —
see below for why that lookup itself is the bug this session fixes):** over
the next 7 nights, at least one resolves to RESEARCH-ONLY, IMPLEMENT or
RESEARCH, i.e. `CONSOLIDATE_STREAK` observed to reset at least once. Current
value at freeze time: 0 resets in the prior 16 non-self-review nights
(2026-10-19→2026-11-04). Target: ≥1 of the next 7 (2026-11-06→2026-11-12).

**Measured (live GitHub check, `search_issues`/`list_pull_requests`/
`pull_request_read.get_comments`):**
- 0 new `[Dream Cycle 2026-11-0{6,7,8,9,10,11}]` issues filed
  (`is:issue created:2026-11-06..2026-11-12` → 0 results of any kind, let
  alone dream-cycle).
- 0 new `dream/*` candidate PRs opened since #204 (2026-11-05); the newest
  non-self-review branch remains `dream/2026-10-17-evaluation-adapters`
  (PR #192).
- 3 *pre-existing* backlog PRs (#139, #150, #158 — all opened well before
  2026-10-29) were merged in a burst on 2026-11-06, confirmed via
  `pull_request_read`. This is real human review activity, but it is not a
  new research/implement finding from the forecast window, so it does not
  satisfy the forecast.
- PR #141 recorded a "merge-conflict repair" comment on 2026-11-06 after
  that merge burst moved `main`, but the comment carries no
  `MODE=CONSOLIDATE`/`dream-consolidate` marker and reads as ad hoc repair,
  not a dated nightly-cycle run; no other open PR shows a dated comment in
  the window. Whether the scheduled routine fired at all on some of these
  nights is therefore not established either way by this check — recorded
  as an open question, not asserted.

**Verdict: MISS.** 0 of 7, against a target of ≥1. **Important caveat the
routine's own rule ("a missed forecast is evidence against that change, and
a candidate to revert") does not fit cleanly here:** `CONSOLIDATE_STREAK`
was never merged to `main`, so this MISS is evidence that *an unmerged fix
fixes nothing*, not evidence that the fix's logic is wrong — PR #204's own
unit tests, independent critic and this session's own build all still pass
against its logic in isolation. Nothing is reverted; PR #204 still stands,
unreviewed, exactly as before. This is the version of the ambiguity the new
STEP 1.6.1 text names explicitly: "an unmerged-but-HIT forecast is still
evidence the mechanism works; it is not evidence the repository has it" —
read in reverse here (unmerged-and-MISS is not evidence the mechanism is
*wrong*, only that it isn't *present*).

## Measure
- `search_issues is:pr is:merged head:dream/`: **42** (up from 39 at the
  last self-review — the 2026-11-06 burst).
- `search_issues is:pr is:closed is:unmerged head:dream/`: **8**.
- `search_issues is:pr is:open head:dream/`: **18**, cross-checked against
  `list_pull_requests` (21 open PRs total in the repo, 3 of which —
  #190 `experiment/leash-activation-...`, #168 `feat/verified-rule-learning-...`,
  #163 `feat/ruv-manifest-nexus-...` — are not `dream/*` candidates at all
  and must be excluded from the dream-cycle backlog count; the two counting
  methods agree once that's done).
- `pipelineMergeRate = 42 / (42 + 8 + 18) = 61.8%` (up from 58.2% a week
  ago — real, if bursty, human throughput; not zero).
- `reviewBacklogSize = 18` dream-cycle candidates, still 3x over
  `implementationTrack.reviewBacklogLimit=6`.
- 0 of this routine's 3 self-review-surface PRs (#199, #202, #204) have
  ever merged, independently of the general backlog's bursty-but-real
  61.8% rate — the self-review track specifically has a 0% merge rate over
  19+ days (#199 opened 2026-10-22).
- No REJECT, INCONCLUSIVE, closed-unmerged or stale candidate exists *since*
  this self-review's own window to classify by cause, because no new
  candidate was proposed at all — same shape as the 2026-11-05 report, one
  week further along.

## Cluster
Taxonomy: planning | tool | memory | verification | recovery | resource |
security | unknown. Two candidate clusters this week, both evidenced above:

1. **planning** (the backlog/CONSOLIDATE lock, same as last week) — still
   active, still the largest in raw night-count (7 more nights affected),
   but already has a frozen, evaluated, critic-clear fix sitting on `main`'s
   review queue (PR #204) since last week. Proposing a *second*,
   independent fix to the same mechanism before the first has even been
   looked at by a human would add a fourth overlapping self-review PR to
   reconcile, not reduce anything.
2. **verification** (new this week) — STEP 1.6.1's "score the last
   forecast" step reads only `main`'s `LEDGER.md`, which cannot see
   self-review rows that never merged. This session only found PR #204's
   forecast by manually searching GitHub PR branches once `${ledgerPath}`
   came up empty; a session that stopped there (as the literal instruction
   says) would wrongly conclude "no prior self-review forecast exists,"
   silently discarding the entire self-review history on every single
   self-review night, forever, independent of whatever STEP 1.5/1.6 MODE
   logic is in play. This is a defect in the self-review mechanism's own
   verification step, self-inflicted and distinct from the (already-known,
   already-fixed-but-unmerged) backlog/planning cluster.

**Selected cluster: verification.** It is newly identified, affects 100% of
future self-review nights (not just the ones blocked on a specific backlog
size), is independent of whether PR #204 or any other backlog candidate
ever merges, and — unlike cluster 1 — has no existing unreviewed fix already
competing for the same review slot.

## Candidate (mechanism, one sentence)
STEP 1.6.1 now also searches `gh pr list --search 'head:<branchPrefix>'
--state all --json number,headRefName,createdAt --jq
'[.[] | select(.headRefName | endswith("-routine-self-review"))] |
sort_by(.createdAt) | last'` for the most recent unmerged self-review
branch and scores `${ledgerPath}` at *its* head when that is newer than
whatever (if anything) `main` has, instead of concluding "no prior
forecast" from a `main`-only miss.

`packages/compile/src/v2.ts`:
- `v2SelfReview()` takes a new `branchPrefix` parameter (already available
  at its only call site, `index.ts`, as `c.branchPrefix`).
- STEP 1.6.1's text rewritten to explain *why* `main`'s ledger is
  insufficient (self-review PRs' 0% historical merge rate, cited above),
  give the exact `gh` lookup, and require recording `none` only if neither
  source has a row — never silence.

`packages/compile/src/index.ts`: threads `c.branchPrefix` through to the
now 3-argument `v2SelfReview()` call, still gated behind `if (c.selfReview)`
exactly as before (v1-only configs are unaffected — confirmed by the
existing "is opt-in" test, which still passes unmodified).

Does not touch `implementationTrack.reviewBacklogLimit`, `selfReview.everyDays`,
the CONSOLIDATE limits, the independent critic/reward-hack checks, any
evaluator entrypoint, witness computation, or ledger schema — none of
`ROUTINE_CONSTITUTION`'s items. Does not touch, compete with, or attempt to
re-decide anything PR #204 already proposed (`CONSOLIDATE_STREAK` is
untouched in this diff).

## Evaluation Receipt
Real evaluator: `npm test` (`vitest run && node --test scripts/*.test.mjs`).

| | Baseline (`71d607b`, parent) | Candidate |
|---|---|---|
| vitest | 886 | 887 (+1 new, 0 regressions) |
| governance | 197 | 197 (unchanged) |
| lint / typecheck | clean | clean |
| mirror check (`compile-targets.mjs --check`) | pass | pass (all 5 targets regenerated + reviewed) |

Self-hosted `dream.config.json` compile output confirmed byte-identical to
its regenerated mirror (`docs/dream-cycle/compiled/ruvnet-dream-machine.md`
diffed against `node packages/cli/dist/bin.js compile dream.config.json`
output directly); all 5 targets sharing this compile engine (self-hosted +
`ruflo`/`metaharness`/`ruvector`/`ruclip`) had their mirrors regenerated —
same clause shape, verbatim across targets since the touched functions take
no per-target-specific parameter beyond each target's own `branchPrefix`
(all five currently default to `dream/`, so the rendered text is identical
across targets tonight; a target with a different `branchPrefix` would
render its own value, exercised by `v2.test.ts`'s existing
single-quoting test on the default prefix).

## Baseline
Parent commit `71d607bea6608180b8c41980dc5386526d3f1f16` (`main`), this
session's own fresh checkout.

## Darwin Lineage
`DARWIN=not-applicable` — a self-review-step lookup-strategy fix has no
evolvable population or fitness function.

## Evidence
OBSERVATION: `docs/dream-cycle/LEDGER.md` on `main` contains zero rows with
Deep=`routine-self-review` (`grep` confirmed 0 matches) despite 3 real
self-review nights having run (2026-10-22, 2026-10-29, 2026-11-05).
OBSERVATION: all 3 corresponding PRs (#199, #202, #204) are
`state:open, merged:false, draft:true` (verified directly via
`pull_request_read`, not inferred from a list endpoint's sometimes-wrong
`merged` field — a failure mode this same repo's ledger has recorded before,
e.g. PR #89's finding). INFERENCE: STEP 1.6.1 as compiled tonight at session
start would have reported "no previous self-review row" had this session
followed it literally, which is false and would have silently discarded
3 nights of accumulated self-review evidence, including the very forecast
scored above. DECISION: fix the lookup to check unmerged self-review
branches, not just `main`, rather than try (again) to fix why self-review
PRs don't merge — that mechanism-level fix already exists, unreviewed, on
PR #204, and a second competing attempt at the same problem is not this
week's highest-value, least-overlapping change.

## Reward-Hack Check
Independent critic dispatched (separate-context subagent, no authorship
stake, given only the diff, `ROUTINE_CONSTITUTION`, and told to attack it
against the off-limits list, test vacuity, and the `gh` command's
correctness): **CLEAR**. It independently ran
`npx vitest run packages/compile/src/v2.test.ts packages/compile/src/index.test.ts packages/compile/src/targets.test.ts`
(181/181), `npm run lint`, `npm run typecheck`, and
`node scripts/compile-targets.mjs --check` (all green, not trusting this
session's own report); independently verified via `gh api
repos/ruvnet/dream-machine/pulls/{199,202,204}` that all three are
`state:open, merged:false` (the "0 of 3 merged" premise is real, not
assumed); confirmed the `--jq` suffix filter (`endswith("-routine-self-review")`)
correctly disambiguates self-review branches from other `dream/<date>-<surface>`
branches per STEP 20's existing naming convention, and that sorting by
`createdAt` (immutable at creation) is unaffected by force-push/rebase.
Disclosed three non-blocking nitpicks, all accepted and recorded rather than
silently dropped:
1. The new test only exercises the default `branchPrefix` (`'dream/'`), so
   it doesn't independently prove a non-default prefix is substituted
   correctly — same limitation as sibling tests in the file, not a
   regression, but a weaker test than ideal.
2. `sort_by(.createdAt) | last` recovers only the single most recent
   unmerged self-review branch; with 3 simultaneously open today (#199,
   #202, #204), this scores #204's forecast but leaves #199/#202's forecasts
   permanently unscored once a newer self-review branch exists — matching
   STEP 1.6.1's original "the previous row" (singular) framing, a tightly
   scoped fix rather than a backlog-draining mechanism, but worth the
   operator knowing it doesn't retroactively score the whole unmerged
   self-review backlog.
3. No explicit instruction for "a self-review branch is found but its
   `LEDGER.md` has no self-review row on it at all" (e.g. a malformed or
   incomplete self-review branch) — falls through to the generic `none if
   truly neither exists` catch-all, adequate but implicit.

Self-critique in parallel: does this candidate weaken a test, benchmark,
threshold, or gold answer? No — one test added, none removed or loosened.
Does it cherry-pick or exploit the evaluator? No — `npm test` runs
unmodified. Does it touch `reviewBacklogLimit` or `selfReview.everyDays`?
No — neither is read or written by this change. Does it compete with or
duplicate PR #204's unmerged fix? No — disjoint paragraphs of the same
function, no logical overlap (one concerns MODE selection for non-self-review
nights, the other concerns self-review's own forecast lookup).

## Security Review
Touches only compiled instructions for a future agent run, plus which `gh`
read-only query it is told to make — the exact same `gh pr list --search
'head:...'` shape `v2ModeSelection()` already issues elsewhere in this same
compiled prompt, so no new tool, permission, credential, or network
surface. No prompt-injection surface: the query result (PR numbers,
branch names, timestamps) is not interpolated back into any file path or
shell argument beyond the fixed `--jq` filter shown in the diff. Reduces a
correctness/availability risk (self-review silently amnesiac about its own
history) rather than introducing one.

## Regression Analysis
10 files changed: 2 logic files (`v2.ts`, `index.ts` — one new parameter,
one call-site update, template text), 1 test file (+1 test block), 2
generated snapshot files, 5 mechanically-regenerated compiled mirrors. 909
vitest + 197 governance tests pass; lint/typecheck clean; mirror check
clean. No GLOBAL INVARIANT, verdict rule, promotion gate, merge policy
(`autoMerge`/`prMode`/ready-for-review predicate), CONSOLIDATE's
never-merge/close/force-push limits, independent-critic/reward-hack check,
evaluator entrypoint, witness computation, ledger schema,
`reviewBacklogLimit`/`everyDays` values, research floor, or
config-validation/golden-snapshot test touched in substance — confirmed by
diff review and the independent critic, as required by the self-review
constitution (ADR-0011).

## ADR
None — a lookup-strategy fix to one step of the routine's own compiled
template, not an architectural decision (STEP 19: never for parameter
changes or minor prompt/routing tweaks).

## Gist
`GIST=LOCAL` — no `gh` CLI gist capability usable this session (`GH_TOKEN`
invalid; `gh auth status` fails) and no gist-creation MCP tool available;
same condition as PR #199/#202/#204. Full report committed as
`docs/dream-cycle/2026-11-12-routine-self-review-report.md`, the durable
artifact.

## Issue
Filed alongside this report (see PR body for the live issue number).

## Witness

```
report_sha256 : eff9372758990fbe2a6462bf8e8720d3d24302f5084ca63c3d9f4b1c2c8bbb0c
session_commit: 71d607bea6608180b8c41980dc5386526d3f1f16
witness       : d96eec2fe5f4e1397e55f3b088cca7cee9bbc93762ed9dda5cd9f8eb37b5c87b
```

Computed over this file's canonical bytes (everything above this heading,
trailing whitespace collapsed to one newline) via
`@dream-machine/witness`'s `stampReport()`. Verify:

```bash
node -e 'import("./packages/witness/dist/report-witness.js").then(({stampReport})=>{
  const fs=require("node:fs");
  const r=fs.readFileSync("docs/dream-cycle/2026-11-12-routine-self-review-report.md","utf8");
  console.log(stampReport(r,"71d607bea6608180b8c41980dc5386526d3f1f16"));
})'
```

Note: `witness verify-report` is documented in a prior ledger row as a CLI
command but is not actually wired into `packages/cli/src/bin.ts` (confirmed
by `grep`) — only the library function exists. Not fixed tonight (out of
this self-review's selected cluster; flagged here rather than silently
worked around).

## Merge Policy
**This PR stays draft, regardless of verdict.** Per STEP 1.6/ADR-0011's
routine constitution: "A self-review PR always stays human-review-only,
whatever `prMode` says." This session never merges and never autonomously
promotes candidate state.

## Ledger
Row to be appended for 2026-11-12 (`docs/dream-cycle/LEDGER.md`, on this
PR's own branch — it reaches `main` only if this PR merges, same caveat as
every self-review row before it, which is exactly why this self-review's
candidate fixes the step that has to find it anyway). Forecast frozen for
the next self-review (2026-11-19, `EPOCHDAY % 7 == 0`): the *next*
self-review session, run under tonight's fixed STEP 1.6.1, finds this very
PR's row (or #204's, whichever is newer) via the new `gh pr list` lookup
without a human needing to merge anything first — i.e. the lookup step
itself no longer silently reports "no prior forecast." Current value: 0 of
the last 3 self-review sessions' forecasts were ever found by the
as-compiled STEP 1.6.1 instruction alone (this one included — found only by
this session's manual GitHub search, which is the bug). Target: 1 of 1
(the very next self-review, 2026-11-19, successfully locates tonight's row
by following the compiled instruction as written, with no manual fallback
needed).
