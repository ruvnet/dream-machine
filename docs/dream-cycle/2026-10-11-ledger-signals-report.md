# Ledger-Signals SOTA Report — 2026

## TL;DR
`learningSignals()`'s `duplicateDirections` signal is meant to detect "a
finding repeated in >= 3 PRIOR NIGHTS" (STEP 1.1's own wording) so the agent
rotates away from an over-mined direction. The implementation instead counted
raw **row** occurrences of a normalized finding key, with no per-date dedup.
The real, committed `docs/dream-cycle/LEDGER.md` violates the 1-row-per-night
assumption this relies on (a known, already-documented defect: nights get
re-appended once a PR/issue number firms up — see the 2026-09-21 ledger-signals
report, PR #129, which added `distinctDatesInWindow` as a *diagnostic* for
this exact row/night conflation but explicitly left `duplicateDirections`
itself unfixed, naming it as future work). Concretely: the 2026-08-28
"harden anchored replay JSON evidence…" finding was appended 3 times on the
*same* date, and `duplicateDirections` flagged it as a 3-night repeat — a
false positive from one night, not three nights independently converging on
the same direction. An existing unit test even locked the bug in (it used 3
rows via the `row()` test helper with no `date` override, so all 3 silently
shared one default date). Fix: dedupe rows by `(directionKey, date)` before
counting, so N re-appends of one date contribute at most 1. `pendingFindings`
(open, unmerged PRs — no row/date exists yet) are deliberately left counted
as-is, one occurrence per string, unchanged.

## What's new
PR #129 (2026-09-21) proved the row/night conflation exists and fixed its
*visible* symptom in `nightsConsidered`/the TUI message, but its own report
named `duplicateDirections` as out of scope ("should `learningSignals` go
further and window by unique date... deliberately out of scope tonight").
This is the first finding to show the conflation also corrupts
`duplicateDirections` itself — not just a dashboard label, but the signal
STEP 1.1 uses to decide whether to rotate off a direction — and to fix that
specific consumer without touching the window-slicing question PR #129 left
open.

## Competitors (evidence grade)
- **Sakana AI Scientist** (B, vendor blog + paper): one experiment record per
  run in a flat file; no windowed "repeated direction" signal comparable to
  this one, so no precedent either way for the specific row/night confusion.
- **OpenHands** (A, official repo): one-file-per-episode SWE-bench trajectory
  logs sidestep this entirely — there is no shared, multi-writer, re-appended
  ledger to conflate rows with nights in the first place.
- **DSPy/GEPA** (A, official repo): optimizer traces key on an explicit
  generation index, never a human-readable calendar date, so "N occurrences"
  and "N generations" can never silently diverge the way row-vs-date can here.
- **SWE-agent** (A, official repo): JSONL trajectories, one line per attempt;
  no cross-run "duplicate direction" aggregation to compare against.
- **AutoGPT lineage** (C, general knowledge, unverified against current
  source): flat run logs historically, no comparable learning-signal layer.

As with PR #129, none of the A/B-grade competitors maintain a hand-editable,
multi-writer markdown ledger with a "rows ≈ nights" assumption (this repo's
own design, ADR-0001) — this is a repo-specific correction, not one with
external precedent to borrow.

## Frozen hypothesis
Given the real committed `docs/dream-cycle/LEDGER.md` (a documented case: the
2026-08-28 night's row was re-appended 3 times under the identical finding
text as its PR/issue reference was corrected), when `learningSignals()`
counts `duplicateDirections` by raw row occurrence of a finding's
`directionKey` instead of distinct dates, then a single re-appended night is
mis-counted as 3 independent nights and falsely crosses the ">= 3 prior
nights" rotate-away threshold, subject to: a genuine repeat across 3 actually
distinct dates must still be flagged (no loss of detection power), and
`pendingFindings` (open-PR findings with no row date) must keep contributing
one occurrence each, unchanged.

## Benchmark / evaluation
- Evaluator: `npm test` (`vitest run && npm run test:governance` — real repo
  test suite), run on parent then candidate on identical source, per
  `dream.config.json`'s own `evaluatorEntrypoints.bench`.
- Corpus: the actual committed `docs/dream-cycle/LEDGER.md` (read live via the
  CLI, not synthetic) plus new/updated unit tests using the existing `row()`
  fixture helper.
- Parent (baseline, commit `5707c825b2c065de44abed02594e1abf5eab95ea`):
  `npx vitest run` → 769/769 pass (25 files); `npm run test:governance` →
  159/159 pass (after fetching the `scripts/benchmark-ticket-codec.mjs`
  pinned reference commit into this shallow clone — see "Known duplicate"
  below; before that fetch, 156/159, 3 pre-existing environmental failures
  unrelated to this candidate). 928/928 total on identical source.
- Candidate: `npx vitest run` → 770/770 pass (25 files, +1); `npm run
  test:governance` → 159/159 pass (unchanged). 929/929 total, **0
  regressions**. `npm run typecheck` and `npm run lint` clean. Live check:
  `node packages/cli/dist/bin.js ledger signals --path
  docs/dream-cycle/LEDGER.md --merged "<36 real merged PR numbers>"
  --open-count 14` on the real ledger still reports
  `duplicateDirections: ["harden anchored replay json evidence reject"]`
  pre-fix and `duplicateDirections: []` post-fix for that same real data —
  the live false positive is gone.

## Known duplicate (withheld, not re-filed)
While establishing the baseline, `npm test` failed 3/159 with `git show
<sha>:packages/edge-contracts/src/index.ts` erroring `exists on disk, but not
in '<sha>'` — `scripts/benchmark-ticket-codec.mjs`'s pinned-reference oracle
is unreachable in this environment's shallow clone (`clone_depth`), even
though the pinned commit is real, non-rewritten upstream history (`git fetch
origin <sha>` resolves it immediately). This is an **already-filed, already
in-flight** finding: issue #149 / PR #150 (opened 2026-10-03, both still
open). Confirmed via live search before doing anything further; not re-filed,
not re-fixed, not claimed as tonight's candidate. Recorded here only because
it was the first thing the baseline run surfaced tonight.

## Adversarial critique (independent subagent)
An independent critic (no authorship stake in the fix) read the full diff and
both source files, reproduced the real duplicate ledger rows directly against
`docs/dream-cycle/LEDGER.md`, re-ran `npx vitest run
packages/ledger/src/index.test.ts` itself (46/46, independently observed, not
taken on trust), and checked `directionKey('')`/blank-date and
`pendingFindings`-untouched edge cases. Verdict: clean, real fix, no
reward-hacking signal — no threshold touched, no cache, no narrowing to just
pass the new test, `pendingFindings` path byte-identical and explicitly
re-tested. Two non-blocking notes it raised (dedup key uses raw `r.date`, not
`isValidCalendarDate`-filtered, for symmetry with the rest of the module) are
recorded as a next step below, not fixed tonight — not reachable through a
`verifyLedger`-passing ledger today, and the existing `directionKey`/`bump`
path already had the same property.

## Darwin
Not run. `evaluatorEntrypoints.darwin` invokes `npx @metaharness/darwin` —
unpinned, resolves registry `latest` on every invocation (standing
supply-chain warning in the compiled routine, STEP 8; tracked by PR #84, long
merged, but the entrypoint config itself is still unpinned per issue #157/#158
in flight). Bounded Darwin is optional; this candidate is a small,
fully-unit-tested, deterministic library fix with no evolutionary-search use
case, so running an unpinned `npx` package tonight was not justified.

## Security review
No security-sensitive surface touched: no prompt injection, credential,
filesystem/network-scope, or agent-authority change. Pure in-memory signal
bookkeeping over already-parsed ledger rows.

## Next steps
1. Human review: extend the same `(key, date)` dedup discipline to any future
   `duplicateDirections`-like signal, and consider whether `directionKey`
   should use `isValidCalendarDate(r.date)` for the dedup key (critic's minor
   note) rather than the raw string — deliberately left additive-only tonight.
2. The *root cause* (nights getting re-appended at all) is still open — PR
   #129's own next-steps already named this; still unclaimed, still a
   separate, larger candidate (likely a `ledger append --amend-last` mode).
3. Issue #149 / PR #150 (shallow-clone git-show oracle) remains open and
   unreviewed; unrelated surface, flagged above only for visibility.
4. 14 open, unmerged `dream/*` PRs as of tonight (none overlapping this
   candidate's file); ledger was 11 days stale on `main` before this row.

## Witness

```
report_sha256 : d2a9e19a68680a40e8fa3bdc90718d2b5088e6bcf22910ba25cd682d52cbd8dc
session_commit: 5707c825b2c065de44abed02594e1abf5eab95ea
witness       : 54824cd4528bcc15932c98bd5d97dd2222271f571a1f7fd0ce32a29ddf790401
```

Computed over this file's canonical bytes (everything above this heading,
trailing whitespace collapsed to one newline) — reproducible from the
committed file with no unavailable intermediate bytes. Verify:

```bash
node packages/cli/dist/bin.js witness verify-report docs/dream-cycle/2026-10-11-ledger-signals-report.md --commit 5707c825b2c065de44abed02594e1abf5eab95ea
```

Additional live checks, reproducible by anyone:
- `npx vitest run && npm run test:governance` on the candidate branch → 929/929, 0 fail (parent: 928/928).
- `node packages/cli/dist/bin.js ledger signals --path docs/dream-cycle/LEDGER.md` on the candidate branch → `duplicateDirections` no longer contains the 2026-08-28 false positive.
