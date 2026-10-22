# Routine Self-Review — 2026-10-22

MODE: `routine-self-review` (STEP 1.6, `EPOCHDAY % 7 == 0`; `EPOCHDAY=20748`). This
overrides the slot rotation (slot 2 → `evaluation-adapters`) and STEP 1.5's MODE
selection for tonight only.

## TL;DR

The first routine-self-review night since ADR-0011 merged (2026-10-18). No prior
forecast exists to score. Measurement surfaced a live, self-reported near-miss on
PR #145 (2026-10-21): two concurrent sessions of this routine both selected the
same PR for CONSOLIDATE refresh around the same time. They converged on the
identical merge commit by luck — no damage resulted — but the Schedule Contract's
"Duplicate firing" guard (rule 2) cannot see this class of collision at all: it
only checks for a `dream/<DATE>-*` branch, which RESEARCH/IMPLEMENT nights create
and CONSOLIDATE nights never do (CONSOLIDATE pushes to an *existing* PR's own
older-dated branch instead). Candidate: extend the guard, gated on
`implementationTrack` being configured, so a CONSOLIDATE night checks its target
PR's own commits/comments for today's date before touching it, and moves to the
next eligible PR (or skips) if one is already there.

## 1. Score the last forecast

N/A. `docs/dream-cycle/LEDGER.md` has no prior `routine-self-review` row —
ADR-0011 (which introduces the self-review mechanism) merged on 2026-10-18, four
days ago, and `EPOCHDAY % 7 == 0` has not landed since. This is self-review
night #1. Nothing to score; nothing to revert.

## 2. Measure

Live GitHub fates (via GitHub MCP tools; `gh` CLI's `GH_TOKEN` is invalid in this
session, so facts were pulled through `search_pull_requests`/`pull_request_read`
instead — not a FALLBACK, just a different authenticated path):

```json
{
  "nights": 37, "verdicts": {"ACCEPT": 31, "REJECT": 2, "INCONCLUSIVE": 1, "other": 19},
  "prsTracked": 46, "fates": {"MERGED": 31, "CLOSED": 2, "OPEN": 0, "STALE": 0, "UNKNOWN": 13},
  "mergeRate": 0.939, "acceptMergeRate": 0.964, "falseAcceptRate": 0.036,
  "reviewBacklog": 19, "pipelineMergeRate": 0.596
}
```
(`dream-machine ledger outcomes --merged "7,11,21,24,29,33,38,44,46,47,49,53,55,57,60,62,65,69,79,84,87,89,91,100,103,105,109,111,114,116,120,122,127,129,132,143,165,167,177" --closed "9,15,17,19,27,40,59" --open "98,101,137,139,141,145,148,150,152,154,156,158,161,180,182,184,189,192,194" --open-count 19`)

`ledger signals`: `zeroMergeStreak=false`, `ledgerStale=true`, `daysSinceLastRow=10`
(main's last row 2026-10-12), `reviewBacklogSize=19`.

`reviewBacklogSize` is **unchanged** from the 19 measured in ADR-0011's own
context table on 2026-10-18 — the CONSOLIDATE mechanism that ADR-0011 introduced
specifically to drain this queue has now run three nights (10-19, 10-20, 10-21)
and moved exactly two PRs (#137, #141) from draft to ready-for-review. Neither is
merged yet (expected — human review takes time; the routine never merges). This
is working as designed, not a defect.

Per-PR check of the three post-ADR-0011 CONSOLIDATE nights (`pull_request_read`
get_comments on #137, #141, #145):

- **#137 (2026-10-19):** merged main, fixed a `bin.test.ts` version-regex break
  the merge exposed, independent critic CLEAR, marked ready for review. Clean.
- **#141 (2026-10-20):** merged main, re-evaluated (887/887+195/195), independent
  critic CLEAR, marked ready for review. Clean.
- **#145 (2026-10-21):** merged main (one textual `LEDGER.md` conflict, resolved
  by chronological concatenation), re-evaluated (889/889+195/195), critic CLEAR,
  but `dependency-audit` red on the new head — reproduced identically on a bare
  clone of `main` with zero candidate diff (pre-existing `vite`/`launch-editor`
  dev-toolchain advisory, filed as #197) — so correctly stayed draft per STEP 1.5.
  **A second comment on the same PR, 3 minutes later, from a different session ID,
  self-reports**: *"another session of this same nightly routine was apparently
  working this exact PR concurrently and filed #197 ... about a minute before I
  posted ... this looks like the nightly trigger may have fired twice in close
  succession tonight."* `pull_request_read get_commits` on #145 confirms only one
  merge commit (`169623f`) and one CONSOLIDATE commit (`6ae0dd2`) actually landed
  — the two sessions' work converged, so no corruption happened this time.

No REJECT / INCONCLUSIVE / closed-unmerged / stale(>14d) candidate has been
produced since ADR-0011 (too little runtime: 4 days, 3 CONSOLIDATE nights, 0
RESEARCH/IMPLEMENT nights). The only concrete, fresh, reproducible-from-evidence
failure signal in the measurement window is the #145 duplicate-firing near-miss.

## 3. Cluster

Taxonomy: planning | tool | memory | verification | recovery | resource |
security | unknown (`clusterFailureTraces`).

| Cause | Count | Class |
|---|---|---|
| Schedule Contract's duplicate-firing guard has no coverage for CONSOLIDATE's branch-reuse code path (live near-miss, PR #145) | 1 | **tool** (scheduler/guard infrastructure) |

n=1 is the entire window (self-review night #1, 4 days of post-ADR-0011 history).
It is also the only cluster: nothing else in the window is a failure. Largest
(and only) cluster: **tool**.

## 4. Candidate

One mechanism, one sentence: before a CONSOLIDATE night touches a target PR,
check that PR's own commits and comments for today's `DATE`, and treat either as
"already ran today on this PR" — skip to the next eligible PR (or end with
`SKIP: already ran <DATE>` if none remain) instead of racing a concurrent run.

Implementation — `packages/compile/src/v2.ts`, `v2ScheduleContract()`:
- New parameter `hasConsolidate: boolean`. When true, appends a clause to rule 2
  ("Duplicate firing") stating the above, explicitly naming the gap it closes
  (the dated-branch check "cannot see" CONSOLIDATE). When false (no
  `implementationTrack`), the Schedule Contract compiles exactly as before —
  CONSOLIDATE doesn't exist for that config, so nothing should say it does.
- `packages/compile/src/index.ts`: call site now passes
  `Boolean(c.implementationTrack)`.
- This is prose, not executable logic — this entire repository compiles
  `dream.config.json` into a markdown instruction set for a future agent run;
  there is no runtime guard to unit-test beyond "is the right text present
  under the right config."

Not touched: GLOBAL INVARIANTS, the promotion gate, merge policy/`autoMerge`/
`prMode`/ready predicate, the CONSOLIDATE limits (never merge/close/force-push —
unaffected; this only changes *which* PR gets touched, never the limits on what
is done to it), the critic/reward-hack checks, evaluator entrypoints, witness
computation, ledger schema, `implementationTrack.reviewBacklogLimit` (still 6,
unchanged), `selfReview.everyDays` (still 7, unchanged), `researchDepth` floors
(unchanged), `config.ts` validation, the v1 golden snapshots, or the
constitution list. All out of bounds per STEP 1.6; none were touched.

## 5. Forecast (frozen before this PR is marked for review)

Metric: count of self-reported concurrent/duplicate-session incidents on
dream-cycle PR comments (the `clusterFailureTraces` "tool" cluster this candidate
targets).

- Current value: **1** incident in the 3 CONSOLIDATE nights since ADR-0011
  (2026-10-19 → 2026-10-21; PR #145).
- Predicted value: **0** incidents in the next 7 nights (through the next
  self-review, `EPOCHDAY % 7 == 0` → 2026-10-29).
- Horizon: 7 nights.
- How to score at the next self-review: grep all dream-cycle PR comments opened
  since this PR's merge-base for self-reports of a concurrent/duplicate session
  (the phrasing varies; look for mentions of a second session ID, "fired twice",
  "concurrently", or a receipts-log `unknown` outcome later confirmed already-done
  on GitHub). HIT if zero; MISS if ≥1, which would mean the text-level guard is
  being skipped or misread by the agent, or the race is tighter than a
  comment-and-commit check can catch (e.g. both sessions read "no comment yet"
  before either pushes) — in which case the next self-review's candidate should
  be a stronger mechanical lock (e.g. a receipts-log check, since the Schedule
  Contract's rule 1 already specifies an `unknown`-outcome GitHub recheck before
  any retry) rather than a second prose patch.

Residual risk, disclosed: this is a best-effort, non-atomic check (read-then-act
over the GitHub API), not a lock. Two sessions whose GitHub reads both land
before either one's write is still possible in principle, just much less likely
than today's zero-coverage gap. That gap is explicit in the forecast's MISS
branch above, not hidden.

## 6. Evaluate

Real evaluator: `npm test` (`vitest run && node --test scripts/*.test.mjs`).

| | Baseline (`3fc3222d`, parent) | Candidate |
|---|---|---|
| vitest | 886 | 887 (+1 new, 0 regressions) |
| governance | 195 | 195 (unchanged) |
| lint / typecheck | clean | clean |

New test (`packages/compile/src/v2.test.ts`): asserts the new clause's exact
substrings appear when `implementationTrack` is configured, and that the same
substrings are absent when it is not (using the clause's own text, not the bare
word "CONSOLIDATE" — that word already appears unconditionally in
`ROUTINE_CONSTITUTION`, so a naive `not.toContain('CONSOLIDATE')` assertion is
wrong; caught and fixed during this same review when it first failed against
the `v2` fixture, which has `selfReview` configured independently of
`implementationTrack`).

Self-hosted compile output: `node packages/cli/dist/bin.js compile
dream.config.json` recompiled byte-identical to the regenerated
`docs/dream-cycle/compiled/ruvnet-dream-machine.md` mirror. All 5 targets'
mirrors and golden snapshots were regenerated and reviewed — the repository's
compile engine is shared across `ruvnet/dream-machine` and
`targets/{ruflo,metaharness,ruvector,ruclip}.dream.json` (all 5 have
`implementationTrack` configured, confirmed via `targets.test.ts`'s own
`INVARIANT_LINES` check for `STEP 1.5: MODE SELECTION`), so a shared-template fix
necessarily changes every target's compiled output identically in shape (same
clause, parameterized only by each target's own `branchPrefix`). Each diff hunk
was reviewed before accepting; no target's clause differs in substance.

## Reward-Hack / Independent Critic Check

Dispatched a fresh, separate-context subagent critic (no shared history with
this session) against the isolated logic+test diff (`packages/compile/src/v2.ts`,
`index.ts`, `v2.test.ts`). It independently re-pulled PR #145's comments via the
GitHub API rather than trusting this report's summary, and confirmed CONSOLIDATE
is the only mode that skips the dated-branch-creation flow (STEP 1.5 vs. the
other three modes), so the gap and its `hasConsolidate = Boolean(c.implementationTrack)`
scoping are real and correctly targeted.

**Round 1 verdict: BLOCKED.** Two findings:

1. **Blocking — semantic defect.** The original clause checked the target PR's
   commits/comments for today's date with no attribution restriction, unlike its
   own sibling mechanism three lines away (the `dream-consolidate` marker, which
   explicitly scopes to "posted by this routine's own account (ignore markers
   from anyone else)"). As written, any human PR-author commit or unrelated
   reviewer comment dated today would satisfy the check and wrongly stall an
   eligible PR. **Fixed**: the clause now reads "...check that PR's own commits
   and comments for today's DATE authored by, or posted by, this routine's own
   account (ignore commits and comments from anyone else, same scoping as the
   `dream-consolidate` marker above)," mirroring the existing precedent exactly.
2. **Non-blocking.** The reviewed patch file omitted the 7 mechanically-generated
   snapshot/mirror files; the critic verified they were already correct and
   consistent in this working tree (rebuilt + reran `compile-targets.mjs`,
   no-op diff) — a reviewing artifact, not a defect in the candidate itself. All
   10 files (3 logic/test + 7 generated) are committed together.
3. **Cosmetic, non-blocking.** One line in the compiled markdown ran to 101
   characters against the list item's own ~70–80-char wrap convention.
   **Fixed**: rewrapped so the clause starts on its own line.

Re-ran the full suite after both fixes: vitest 887/887 (unchanged count — the
test asserts clause substrings that still hold after the wording fix), governance
195/195, lint/typecheck clean, `compile-targets.mjs` regenerated and reviewed
again (same shape, same 5 targets, no surprises). **Verdict: CLEAR** on the
semantic fix. This PR stays **draft** regardless: "a self-review PR always
stays human-review-only, whatever `prMode` says" (STEP 1.6's constitution) —
unlike an ordinary CONSOLIDATE/IMPLEMENT/RESEARCH candidate, a
`routine-self-review` PR is never marked ready for review by this routine
itself, even on ACCEPT with a clear critic. A human decides when to move it.

## Security Review

This candidate touches only the compiled *instructions* for a future agent run
(no new tool, permission, credential, or network call; the repo's own compiler
has no runtime enforcement of this guard — it is prose). It reduces a
resource-contention/data-integrity risk (two concurrent sessions racing to push
to the same PR branch and post conflicting comments) rather than introducing one.
No prompt-injection surface, no new authority, no change to least-privilege
posture.

## Darwin

`DARWIN=not-applicable` — a prompt-template conditional-text fix has no
evolvable population or fitness function (same judgment as the 2026-10-19
consolidation note on PR #137 for a comparable mechanical fix).

## Next steps

1. Score this forecast at the next self-review (2026-10-29): zero or more
   self-reported concurrent-session incidents since this PR's merge-base.
2. If the forecast MISSes, escalate from a prose check to a mechanical one
   (e.g., require the Schedule Contract's own receipts log, already specified in
   rule 1, to be checked for an `unknown`/in-flight entry on the target PR before
   CONSOLIDATE starts, rather than relying on a fresh GitHub read).
3. Independently, #197 (the pre-existing `vite`/`launch-editor` `dependency-audit`
   finding blocking #145's CI) remains open and unrelated to this candidate;
   worth a `security-adversarial` night.

GIST=LOCAL — no `gh` CLI (its `GH_TOKEN` is invalid in this session) and no
gist-creation MCP tool is available tonight. This committed file is the durable
artifact per STEP 17's fallback; publication is best-effort, not a stop
condition.

## Witness

```
report_sha256 : d322a9daae52a965672e085b8a505cadccb54b6a4f02d0dd8dbe6d518ef568eb
session_commit: 3fc3222d2e5566a203331d3686c4d2eaf06713a8
witness       : 8ba9e7138cc91c8b0fe6933c0d8c0acb3f8aef0968e3cf7bba8798a612e88942
```

Computed over this file's canonical bytes (everything above this heading,
trailing whitespace collapsed to one newline) — reproducible from the
committed file with no unavailable intermediate bytes. Verify:

```bash
dream-machine witness verify-report <committed-report-file>
```
