# Dream Machine Self-Review — 2026-11-05

## TL;DR
Last week's forecast (PR #202, 2026-10-29) scores a genuine **HIT**: every
scheduled night since then left a live GitHub trace, unlike the vacuous HIT
scored the week before. But the six-night CONSOLIDATE run it measured points
at the real structural gap: `main` has not advanced since 2026-10-19 (PR
#196), 21 `dream/*` candidate PRs sit open against
`implementationTrack.reviewBacklogLimit=6`, and because at least one eligible
draft always exists, STEP 1.5's MODE has resolved to CONSOLIDATE on every
single non-self-review night since — which explicitly skips STEPS 2–9 and
17–24. There is no upper bound on how long this can run: CONSOLIDATE's entry
condition only clears once a human merges enough PRs to drop the backlog
below the limit, something this routine can never do by its own merge policy.
Tonight's candidate adds a `CONSOLIDATE_STREAK` cap (7 non-self-review nights)
so the routine is forced back to RESEARCH-ONLY — and keeps producing new
findings — even while the review backlog never clears.

## Score: last self-review's forecast (PR #202, issue #201)
**Forecast (frozen 2026-10-29):** over the next 7 nights, every scheduled
firing of this routine leaves at least one GitHub-visible trace (a
`dream/<DATE>-*` branch, or an equivalent reachable record), i.e. zero further
nights with no trace at all. Current value at freeze time: 6 of the prior 7
nights (2026-10-23→10-28) left no trace. Target: 0 of the next 7.

**Measured (2026-10-30 → 2026-11-04, live GitHub check — `search_issues`,
`pull_request_read.get_comments` on PRs #161/#180/#182/#184/#189/#192):**
- 2026-10-30: PR #161 — CONSOLIDATE comment, `<!-- dream-consolidate:
  3fc3222d -->` marker, merge commit `4af4332`.
- 2026-10-31: PR #180 — CONSOLIDATE comment, merge commit `63f51fc`.
- 2026-11-01: PR #182 — CONSOLIDATE comment, merge commit `1d563fae`.
- 2026-11-02: PR #184 — CONSOLIDATE comment, merge commit `f51e51ac`.
- 2026-11-03: PR #189 — CI-diagnostic + main-merge-in commit `7e19136`
  (consolidate marker posted retroactively the following night, same action).
- 2026-11-04: PR #189 marker comment + PR #192 — full CONSOLIDATE comment,
  merge commit `7104179`.
- No `dream/2026-11-0{1,2,3,4,5}-*` or `dream/2026-10-3{0,1}-*` branch exists
  anywhere (`list_branches` confirmed) — consistent with CONSOLIDATE opening
  no new candidate.
- No new `[Dream Cycle ...]` issue was filed in the window (`search_issues
  is:issue created:2026-10-30..2026-11-05` → 0 results).

**Verdict: HIT, and not vacuous this time.** Six real nights ran, each
left a reproducible GitHub trace, and the guard's own premise — "use
whichever path is reachable" — was exercised: every comment above was
posted via the GitHub MCP tool while `gh auth status` was separately
observed broken in this session (`GH_TOKEN` invalid), same as the two
preceding self-reviews. The forecast's mechanism held.

## Measure
- `search_issues is:pr is:merged head:dream/`: 39 merged. `is:pr is:unmerged
  is:closed head:dream/`: 7 closed-unmerged. `is:pr is:open head:dream/`: 21
  open. `pipelineMergeRate = 39 / (39+7+21) = 58.2%`.
- `reviewBacklogSize = 21` (open dream/* candidate PRs), `6×` over
  `implementationTrack.reviewBacklogLimit=6`.
- `ledgerStale=true` — main's `LEDGER.md` last real (merged) row is
  2026-10-12 (#177); every self-review/CONSOLIDATE row since lives only on
  unmerged branches.
- No REJECT, INCONCLUSIVE, closed-unmerged or stale candidate exists *since*
  the last self-review (2026-10-29) to classify by cause — because no new
  candidate was proposed at all in that window. That absence is itself the
  measurement.
- Confirmed via `list_branches`/`search_pull_requests`: the last *new*
  `dream/<DATE>-<surface>` branch (i.e. a non-self-review RESEARCH/IMPLEMENT/
  RESEARCH-ONLY night) is `dream/2026-10-18-security-adversarial` (PR #194).
  Every one of the 16 non-self-review nights since (2026-10-19→2026-11-04,
  excluding the self-review nights 10-22/10-29) resolved to CONSOLIDATE.

## Cluster
Taxonomy: planning | tool | memory | verification | recovery | resource |
security | unknown. With zero new candidates in the window there is nothing
to classify by individual failure cause (same shape as last week). The
dominant and only cluster this time is **planning**: STEP 1.5's own MODE
state machine has no exit from CONSOLIDATE once the backlog crosses
`reviewBacklogLimit` and at least one eligible draft exists — which, because
a new "oldest unmarked" draft is always available among 21 open PRs, holds
on every night regardless of how many nights pass. The gate that could clear
it (the backlog dropping below the limit) is entirely human-controlled; this
session's own merge policy forbids it from closing that gate itself. This is
a defect in the decision rule's shape, not in any evaluator, memory,
recovery path, resource limit or security control — hence **planning**,
count 1 (dominant by construction: it is the only mechanism active across
all 16 affected nights).

## Candidate (mechanism, one sentence)
Cap CONSOLIDATE at 7 consecutive non-self-review nights (`CONSOLIDATE_STREAK
< CONSOLIDATE_STREAK_CAP`, new constant = 7 in `packages/compile/src/v2.ts`);
once reached, MODE forces RESEARCH-ONLY instead, even with an eligible draft
still waiting, so new findings keep arriving regardless of how long the
human review backlog takes to clear.

`packages/compile/src/v2.ts`:
- Added `export const CONSOLIDATE_STREAK_CAP = 7`.
- `v2ModeSelection()`: added a `CONSOLIDATE_STREAK` measurement instruction
  (consecutive non-`routine-self-review` nights with neither a new
  `<branchPrefix><DATE>-<surface>` branch nor a new `[Dream Cycle <DATE>]`
  issue — i.e. nights whose only visible action was CONSOLIDATE); added
  `AND CONSOLIDATE_STREAK < 7` to CONSOLIDATE's entry condition; added
  `OR CONSOLIDATE_STREAK >= 7` to RESEARCH-ONLY's entry condition; added
  `CONSOLIDATE_STREAK` to the printed MODE line.

7 was chosen to match the one full week already observed running
uninterrupted (2026-10-30→2026-11-04 plus the two flanking non-self-review
days) — it guarantees at least one research-producing night per
self-review period, without requiring a new config field or touching
`implementationTrack.reviewBacklogLimit`/`selfReview.everyDays` (both
explicitly off-limits to self-review). Does not touch any item on the
routine constitution: `reviewBacklogLimit` and `selfReview.everyDays` are
unchanged values; CONSOLIDATE's never-merge/never-close/never-force-push
limits, the independent critic/reward-hack checks, evaluator entrypoints,
witness computation, ledger schema, research floors, and config
validation/v1 golden snapshots/`v2.test.ts` are all untouched in substance —
confirmed by diff review.

## Evaluation Receipt
Real evaluator: `npm test` (`vitest run && node --test scripts/*.test.mjs`).

| | Baseline (`3fc3222d`, parent, post-unshallow) | Candidate |
|---|---|---|
| vitest | 886 | 887 (+1 new, 0 regressions) |
| governance | 195 | 195 (unchanged) |
| lint / typecheck | clean | clean |
| mirror check (`compile-targets.mjs --check`) | pass | pass (all 5 targets regenerated + reviewed) |

Self-hosted `dream.config.json` compile output confirmed byte-identical to
its regenerated mirror (`docs/dream-cycle/compiled/ruvnet-dream-machine.md`);
all 5 targets sharing this compile engine (self-hosted +
`ruflo`/`metaharness`/`ruvector`/`ruclip`) had their mirrors regenerated —
same clause shape, verbatim across targets since neither touched function
takes a per-target parameter.

## Baseline
Parent commit `3fc3222d2e5566a203331d3686c4d2eaf06713a8` (`main`), this
session's own checkout (unshallowed from the fresh clone's default
`clone_depth` cutoff to resolve the same already-tracked environmental
governance-test failure as PR #202/#150 — `BASELINE_COMMIT`-unreachable
`packages/edge-contracts/src/index.ts`; not a code change).

## Darwin Lineage
`DARWIN=not-applicable` — a Schedule-contract/MODE-selection prose-and-
constant fix has no evolvable population or fitness function.

## Evidence
OBSERVATION: `main` unchanged at `3fc3222d` since PR #196 (2026-10-19).
OBSERVATION: 21 open `dream/*` PRs, 0 new ones since PR #194 (2026-10-18).
OBSERVATION: 6 consecutive non-self-review nights (2026-10-30→11-04), each
independently confirmed via PR comments, all CONSOLIDATE, zero new branches
or issues. INFERENCE: this pattern can repeat indefinitely because
CONSOLIDATE's entry condition does not depend on elapsed time or streak
length, only on backlog size and eligibility, both of which a 21-PR, 0-merge
backlog keeps satisfied night after night. DECISION: add a streak cap rather
than touch the backlog limit itself, since the limit is off-limits to
self-review and is not, on its own, the mechanism causing the lock — the
*uncapped duration* of CONSOLIDATE is.

## Reward-Hack Check
Independent critic dispatched (separate-context subagent, no authorship
stake, given only the diff, `ROUTINE_CONSTITUTION`, and instructions to
attack it against the off-limits list, test vacuity, and specification
ambiguity): **CLEAR**. It independently re-ran `npm run build -w
packages/compile`, `vitest run` on the three affected test files (181
passed), `lint`, `typecheck`, and `compile-targets.mjs --check` (all green),
confirmed the `CONSOLIDATE_STREAK` "new branch OR new issue" discriminator
is exhaustive against the actual STEP numbering (RESEARCH-ONLY always files
an issue per STEPS 15–18; IMPLEMENT/RESEARCH file both; only CONSOLIDATE
does neither), and confirmed the new test is not vacuous (asserts exact
substrings absent pre-change). It flagged two non-blocking nitpicks: the
live-check command given (`gh pr list --state open ...`) is open-PR-only, so
a merged-and-branch-deleted night's branch signal could be missed — though
since every non-CONSOLIDATE night also files a persistent issue, this
under-detection only biases toward *more* research, not toward dodging the
cap, so it is not mission-defeating; and the cap value (7) is a defensible
but somewhat round choice, with a smaller cap arguable as more conservative.
Both disclosed here rather than silently accepted. Self-critique in
parallel: does this
candidate weaken a test, benchmark, threshold, or gold answer? No — one test
added (`v2.test.ts`), none removed or loosened, and the new assertions check
both the presence of the new clauses and that the raw constant name
(`CONSOLIDATE_STREAK_CAP`) never leaks into the compiled prompt (only its
numeric value should). Does it cherry-pick or exploit the evaluator? No —
`npm test` runs unmodified. Does it change `reviewBacklogLimit` or
`selfReview.everyDays`? No — both are read, not written, same as before.
Does forcing RESEARCH-ONLY after the cap let a future CONSOLIDATE night
dodge the cap by, say, posting a spurious issue to reset the streak without
doing real research? The streak's reset condition is tied to STEPS 2-9/15-18
actually running (a RESEARCH-ONLY night necessarily files a real `[Dream
Cycle <DATE>]` issue with real research content per STEP 17-18's own
requirements, which are untouched) — not independently satisfiable without
doing the work the cap is meant to compel.

## Security Review
Touches only compiled instructions for a future agent run — no new tool,
permission, credential, or network call. It reduces a resource/availability
risk (new research silently withheld for unbounded nights while backlog
accumulates) rather than introducing one. No prompt-injection surface, no
new authority granted to any future night's agent beyond *when* it may defer
research in favor of CONSOLIDATE.

## Regression Analysis
10 files changed: 2 logic files (`v2.ts`, `index.ts`, one new constant + one
re-export + the STEP 1.5 template text), 1 test file (+1 test block), 2
generated snapshot files, 5 mechanically-regenerated compiled mirrors. All
887 vitest + 195 governance tests pass; lint/typecheck clean; mirror check
clean. No GLOBAL INVARIANT, verdict rule, promotion gate, merge policy
(`autoMerge`/`prMode`/ready-for-review predicate), CONSOLIDATE's never-merge/
close/force-push limits, independent-critic/reward-hack check, evaluator
entrypoint, witness computation, ledger schema,
`reviewBacklogLimit`/`everyDays` values, research floor, or
config-validation/golden-snapshot test was touched in substance — all
required by the self-review constitution (ADR-0011) to stay out of bounds,
confirmed by diff review.

## ADR
None — a MODE-selection threshold/prose fix to the routine's own compiled
template, not an architectural decision (STEP 19: never for parameter
changes or minor prompt/routing tweaks).

## Gist
`GIST=LOCAL` — no `gh` CLI (`GH_TOKEN` invalid in this session) and no
gist-creation MCP tool available tonight; same condition as PR #199/#202.
Full report committed as
`docs/dream-cycle/2026-11-05-routine-self-review-report.md`, the durable
artifact.

## Issue
#203

## Witness

```
report_sha256 : dfe9cb8068f2b6d469c7b6d8f98363a16dee565452cd11fd2891dd052cc9f549
session_commit: 3fc3222d2e5566a203331d3686c4d2eaf06713a8
witness       : d67dfbb0019792117619684ca623ce88dff9c60a8db7e9cd6adf5264c73d8afc
```

Computed over this file's canonical bytes (everything above this heading,
trailing whitespace collapsed to one newline). Verify:

```bash
dream-machine witness verify-report <committed-report-file>
```

## Merge Policy
**This PR stays draft, regardless of verdict.** Per STEP 1.6/ADR-0011's
routine constitution: "A self-review PR always stays human-review-only,
whatever `prMode` says." This session never merges and never autonomously
promotes candidate state.

## Ledger
Row to be appended for 2026-11-05 (`docs/dream-cycle/LEDGER.md`). Forecast
frozen for the next self-review (2026-11-12, `EPOCHDAY % 7 == 0`): over the
next 7 nights, at least one of them resolves to RESEARCH-ONLY, IMPLEMENT or
RESEARCH (i.e. `CONSOLIDATE_STREAK` is observed to reset at least once,
proving the cap fires in practice and not just in the template text).
Current value: 0 resets observed in the prior 16 non-self-review nights
(2026-10-19→2026-11-04, all CONSOLIDATE). Target: ≥1 of the next 7.
