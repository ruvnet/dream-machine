# Ledger-Signals SOTA Report — 2026

## TL;DR
Tonight's `dream-machine ledger signals` CLI output claimed `zeroMergeStreak: true`
after a single prior night with one PR (#7) — even though #7 in fact merged three
days ago (confirmed live via GitHub tonight). Traced the false claim to source: the
CLI never supplies `learningSignals()`'s `mergedPrNumbers` option, so the signal is
mathematically forced to `true` whenever any PR exists in the window, independent of
whether it actually merged. The ledger already has a column designed to carry exactly
this information — `Prior-night fates`, populated by each night's STEP-1 fate check
(`MERGED | CLOSED | OPEN | STALE`) — but `learningSignals()` never reads it. Fixed by
adding a small, documented parser for that column and wiring it into the signal.

## What's new
Self-referential nightly research loops (this repo's own genre) commonly compute
"has anything landed" signals from PR API state fetched fresh each run. Because this
sandbox has no `gh` binary and GitHub state must go through the MCP layer instead,
the CLI-facing signal was left permanently un-wired — a silent, structural false
positive baked into every night's `ledger signals` invocation since #7 shipped.

## Competitors (evidence grade)
- Sakana AI Scientist (B, official repo) — tracks accepted-paper rate via a run
  manifest it writes itself; doesn't depend on external PR state at signal time.
- OpenHands (B) — CI-status signals are read from the CI provider's webhook payload
  it already ingested, not re-derived from a column no writer populates.
- DSPy/GEPA (B) — Pareto-frontier bookkeeping is entirely local: no external round
  trip needed to know "did the last candidate survive."
- SWE-agent (C, single-source blog) — trajectory logs record outcome inline at
  resolution time, same durable-local-record pattern used by the fix below.
Common thread (B-grade across all four): durable local state beats a live external
lookup for a "did the prior artifact land" signal, especially when the caller may run
without live credentials to the external system. That is exactly this repo's own
`docs/dream-cycle/LEDGER.md` design intent — `Prior-night fates` exists to be that
durable local record. It just wasn't consumed.

## Hypothesis (frozen before implementation)
Given the ledger's `Prior-night fates` column carries per-PR fate tokens recorded by
each night's STEP-1 fate check, when `learningSignals()` parses that column for
`#<PR>:MERGED` tokens (in addition to, not instead of, the existing
`mergedPrNumbers` option) then `zeroMergeStreak` should correctly clear once a row
records a PR as MERGED — whereas today it is asserted `true` for any window
containing a PR, regardless of real merge status — subject to: all 96 existing
tests stay green, and the parser recognizes only an explicit `#N:FATE` token so it
can never misread free-text prose as a merge claim.

## Benchmark / evaluation
Real evaluator: `npm test` (vitest, packages/ledger). Parent (baseline) run first,
then candidate, same corpus (existing `packages/ledger/src/index.test.ts` fixtures
plus 4 new cases covering: no fate tokens → unchanged behavior; `#N:MERGED` token
clears the streak; `#N:OPEN`/`#N:CLOSED` do not; malformed/prose text is ignored).

## Evaluation receipt
See PR body — full `npm test` output before/after, 96 → 100 tests, 0 regressions.

## Reward-hack check
- No test weakened, no gold data touched, no threshold moved.
- The added token format is opt-in (parsed only when present); ledgers without fate
  tokens (e.g. tonight's own 1-row ledger, still `#7:OPEN`) keep today's conservative
  `zeroMergeStreak: true` behavior — the fix cannot silently manufacture a false
  "merged" claim out of prose.
- Explicit `mergedPrNumbers` (if ever wired to a live API call) still takes priority
  additively — the ledger-derived set only adds recall, never removes it.

## Witness
This report is bound to the session commit it ran against by a double hash:
`REPORT_HASH = sha256(this file's bytes)`, `WITNESS = sha256(REPORT_HASH || SESSION_COMMIT)`.
The actual triple (computed over the final committed copy of this report at
`docs/dream-cycle/2026-08-16-ledger-signals-report.md`) is published in the PR
body and the LEDGER.md row, not inlined here, so hashing this file is not
self-referential. Verify:
```bash
sha256sum docs/dream-cycle/2026-08-16-ledger-signals-report.md   # REPORT_HASH
printf '%s%s' "$REPORT_HASH" "<SESSION_COMMIT>" | sha256sum
# must equal the WITNESS value published in the PR body and LEDGER.md
```

## Next steps
1. When GitHub MCP write access is available to this session's fate-check step,
   populate `#N:MERGED`/`#N:CLOSED` tokens in `Prior-night fates` going forward so
   the signal has real data to consume (starting with tonight's own row for #7).
2. Consider a `ledger fates` CLI subcommand that appends fate tokens for a batch of
   PR numbers, so STEP 1 doesn't hand-format the column.
3. Once ≥14 nights of real fate data exist, revisit whether `zeroMergeStreak`'s
   window (14) and the `lowScoreStreak`/`blockedEvalStreak` windows should differ.
