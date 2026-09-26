# Developer Experience SOTA Report — 2026

Dream Cycle 2026-09-19 · DEEP=`developer-experience` · SCAN=`cli`,`tui` · SLOT=4 (`20260919 % 5 == 4`)

## TL;DR

`renderDashboard()`'s stats footer in `packages/cli/src/tui.ts` only ever renders
`verdictStats(rows).{ACCEPT,REJECT,INCONCLUSIVE}` — it never surfaces
`.other`, the bucket `verdictStats` already computes for any verdict string
that isn't exactly one of those three enum values (e.g. this repo's own
compound "portfolio" rows: `"ACCEPT / REJECT / INCONCLUSIVE"`). On the real
`docs/dream-cycle/LEDGER.md` tonight: **19 of 37 rows (51%) are silently
excluded** from the dashboard's visible verdict tally, with no visual
indication that the displayed counts don't sum to the "nights" total shown
one line above them. Not previously flagged in any open issue or PR (checked
tonight's full `is:issue` search across this repo's dream-cycle history).
Fixed by rendering an `other` segment whenever the count is nonzero.

## What's New

- **Bug**: `packages/cli/src/tui.ts`'s `statLine` hardcodes three color-coded
  counters (`accept`/`reject`/`inconclusive`) built directly from
  `stats.ACCEPT`/`stats.REJECT`/`stats.INCONCLUSIVE`. `verdictStats()`
  (`packages/ledger/src/index.ts:306-313`) already computes a fourth bucket,
  `other`, for exactly this reason — but nothing in the TUI reads it.
- **Why it matters for this repo specifically**: this dashboard is the
  Dream Machine's own operator-facing summary of its multi-week self-hosting
  history. `nights <N>` at the top of the stats row primes a reader to expect
  the three colored dots below it to account for all `<N>` nights. On the
  live ledger they account for 18 of 37 — a majority of this project's own
  recorded evolutionary history is invisible to anyone reading the dashboard
  instead of the raw markdown table.
- **Fix**: add a fourth, neutral-gray `○ <n> other` segment to `statLine`,
  rendered only when `stats.other > 0` (so a ledger that's been fully
  migrated to single-value verdicts — the long-term goal already tracked by
  issue #113/PR #114 — renders byte-identical to today, with zero visual
  clutter). `stats.ACCEPT + stats.REJECT + stats.INCONCLUSIVE + stats.other
  === total` becomes a checkable invariant with a dedicated regression test.

## Competitor / Prior-Art Rows (dashboard summary-vs-detail consistency in other agentic dev tools)

| Project | How summary rows handle out-of-enum status values | Grade | Relevance |
|---|---|---|---|
| Sakana AI Scientist | Public reporting pipeline logs per-experiment status as plain text; no fixed enum-only summary widget observed that could silently drop a status class | C (repo inspection, not reproduced live) | Simpler design (no closed enum) structurally avoids this exact bug class |
| OpenHands (OpenDevin) | Session/task status dashboards in `rich`/`textual`-based TUIs commonly enumerate a fixed status set for coloring; an unmapped status value silently falling out of a summary count is a recognized recurring class in that ecosystem generally | C (general ecosystem knowledge, not a specific reproduced finding tonight) | Same failure class: a color/count dispatch keyed to a closed enum, fed data that isn't guaranteed to be in that enum |
| DSPy / GEPA | Evaluation run logs are structured JSON with an explicit status field; downstream aggregation typically groups by `Counter`/`groupby` over the *actual* observed values rather than a hardcoded enum, so an unexpected value still gets counted, just under its own label | B (documented aggregation pattern) | Suggests the durable direction: summary counts should be derived from what's observed (`stats.other`), not just the happy-path enum, exactly what tonight's fix does |
| SWE-agent | Trajectory-run summaries bucket by a fixed small set of terminal states; anecdotal public issue reports describe "other/unknown" states being undercounted in aggregate dashboards until explicitly added | C (single-source, not reproduced tonight) | Same lesson: a fixed-enum summary needs an explicit unmatched-value bucket from day one, or it silently drifts as real data outgrows the enum |

All four rows are prior-art context for the general failure class (a
closed-enum summary silently dropping out-of-enum data), not independent
verification of this repo's specific bug — that was measured directly,
live, tonight (grade A) against the real committed ledger.

## Hypothesis (frozen before implementation)

Given `renderDashboard(ledgerMd)` on a ledger whose rows may carry a
`verdict` value outside `{ACCEPT, REJECT, INCONCLUSIVE}` (this repo's own
compound/legacy rows), when the stats footer is changed to additionally
render `verdictStats(rows).other` as a fourth, neutral-colored segment
whenever it is nonzero, then: (1) `stats.ACCEPT + stats.REJECT +
stats.INCONCLUSIVE + stats.other === rows.length` is visibly true from the
rendered line for any ledger; (2) a ledger with zero out-of-enum rows
renders a byte-identical stats line to today (no regression, no clutter);
(3) `noColor: true` output for the new segment contains zero ANSI escapes,
consistent with every other cell (subject to PR #103's independent,
unmerged fix for the pre-existing `verdictColor` no-color leak, which this
candidate does not depend on or touch). Confirmed.

## Testability Gate → Candidate → Baseline → Evaluation

**Testable tonight**: yes — pure, deterministic function, no credentials, no
model calls, `OPENROUTER_API_KEY` present but unused (this finding needs no
LLM call to test).

**Candidate**: `packages/cli/src/tui.ts` — `renderDashboard`'s `statLine`
construction gains one conditional segment reading `stats.other`. +3
regression tests in `packages/cli/src/index.test.ts`: (a) a ledger with only
enum verdicts shows no "other" segment and is byte-identical to the
pre-change render; (b) a ledger with a compound-verdict row shows `1 other`
and the four counts sum to the row count; (c) the real committed
`docs/dream-cycle/LEDGER.md` — parsed live — renders `19 other` and
`15+2+1+19 === 37`. One conceptual change, ~6 lines to source, ~24 lines of
tests.

**Baseline**: parent `main @ 3edd426f6c9c4b1e80235f7447dc863e749345cc`.
`npm ci && npm run build` clean (7 packages, no wasm/NAPI packages in this
workspace, nothing to degrade). `npx vitest run` and `npm run
test:governance` both green before touching any code.

## Darwin Lineage

Not run — `DARWIN=not-applicable`. A single additive rendering segment with
no evolvable population or fitness landscape, same judgment this ledger has
applied to every prior single-function TUI/CLI fix (PRs #11, #21, #29, #33,
#46, #103).

## Reward-Hack Check

Independent critic: a fresh subagent with no shared authoring context, given
only the diff and full repo read access. **Verdict: CLEAR.**
1. Confirmed the bug is real by reading pre-diff code directly
   (`git show HEAD:packages/cli/src/tui.ts`) — `stats.other` never appears.
   Independently tallied the real ledger's Verdict column by hand: exact
   `ACCEPT`=15, `REJECT`=2, `INCONCLUSIVE`=1, non-enum=19 — matches the
   claimed 19/37 exactly.
2. Confirmed the fix closes it without corrupting the `noColor` path,
   padding/truncation, or colliding with other output text.
3. Ran `npm test` both with and without the diff applied (via `git stash`)
   to independently reproduce baseline (616 vitest) vs. candidate (619
   vitest) counts; 0 tests removed/modified/skipped, one new test asserts
   the four displayed buckets sum to the real ledger's row count end-to-end.
4. Confirmed zero overlap with open PR #103 (`verdictColor` ANSI leak) —
   disjoint line ranges, `git apply --check` of #103's diff on top of this
   candidate succeeds with no conflicts.
5. No credential, filesystem, network, or evaluator-gate surface touched.

*Process note: the critic subagent runs in this session's own working
directory (no isolated worktree available). Its `git stash`/`git stash pop`
baseline-measurement step left the candidate diff stashed mid-review; this
session detected it (`git status` showed a clean tree unexpectedly),
recovered it via `git stash pop`, and re-verified the rebuild and full test
suite (700/700 green) before proceeding. No data was lost; recorded here as
a real operational hazard for any future night that dispatches a
git-history-touching critic into a non-isolated checkout.*

## Security Review

No security-sensitive surface: no prompt-injection vector (no LLM calls in
this path — `OPENROUTER_API_KEY` was present but unused, correctly, since
this finding needs no model call to test), no MCP/tool-authority change, no
credential exposure, no filesystem/network scope change (the new test reads
a fixed, repo-relative path to the committed ledger — not user input, not a
path-traversal vector), no evaluator/gate/safety-constant touched. Pure
string-formatting addition to a dashboard render function.

## Regression Analysis

0 pre-existing tests modified, removed, or skipped. All 697 baseline tests
(616 vitest + 81 governance) pass unchanged; 3 new vitest tests added.
`npm run lint` clean across all packages. `npm run build` clean (7 packages,
no wasm/NAPI degradation to record tonight).

## Witness

```
report_sha256 : 563f58eadc81c9fef6ae4ae7f21f3cc4c7dd305ae1b22e2a7ddb4341df5f6a5e
session_commit: 3edd426f6c9c4b1e80235f7447dc863e749345cc
witness       : d0b263c085f0b5018b4c35cc96027917dc758e67699a32798e656952b783d6c0
```

Computed against this file's content *before* this Witness section was
filled in (this repo's own hash-then-rewrite convention, same as every
prior night in this ledger).

Verify (5 steps, coreutils only):
```bash
# 1. Obtain this exact report (committed at
#    docs/dream-cycle/2026-09-19-developer-experience-report.md — GIST=LOCAL,
#    no gh CLI or gist-creation MCP tool available this session).
# 2. Reconstruct its pre-Witness-section content (everything above this
#    section, byte-for-byte) into report.md.
REPORT_HASH=$(sha256sum report.md | awk '{print $1}')
# 3. Confirm REPORT_HASH == 563f58eadc81c9fef6ae4ae7f21f3cc4c7dd305ae1b22e2a7ddb4341df5f6a5e
printf '%s%s' "$REPORT_HASH" "3edd426f6c9c4b1e80235f7447dc863e749345cc" | sha256sum
# 4. Confirm that output == d0b263c085f0b5018b4c35cc96027917dc758e67699a32798e656952b783d6c0
# 5. Confirm session_commit matches the PR's base commit.
```

`GIST=LOCAL` — no `gh` CLI or gist-creation MCP tool available this session
(consistent with every prior night in this ledger). Published as a committed
artifact in the PR instead.

## Next Steps (concrete)

1. Once issue #113/PR #114's ledger-verify CI gate lands and legacy
   compound-verdict rows are either migrated or the schema is formally
   extended to allow them, `stats.other` should trend to 0 on `main` — at
   that point this fix becomes a pure safety net rather than an active
   51%-of-history correction. Keep the regression test that asserts the
   invariant `ACCEPT+REJECT+INCONCLUSIVE+other === total` regardless.
2. Consider whether `learningSignals()`'s other consumers (`lowScoreStreak`,
   `duplicateDirections`) have the same "only look at enum-shaped fields"
   blind spot against compound rows — not investigated tonight, scope was
   the TUI's rendered summary specifically.
3. PR #103 (verdictColor ANSI leak through `--no-color`) remains open,
   unmerged, evaluated ACCEPT since 2026-09-09 — this candidate's diff does
   not touch `verdictColor` and applies independently of whether #103 lands
   first or second.
