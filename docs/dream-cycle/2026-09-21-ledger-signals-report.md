# Ledger-Signals SOTA Report — 2026

## TL;DR
`learningSignals()`'s window (`rows.slice(-window)`, default 14) is a raw
row-count slice, not a calendar-night slice. The real, committed
`docs/dream-cycle/LEDGER.md` violates the 1-row-per-night assumption it
relies on: several nights were re-appended (a near-duplicate row added later
once the real PR/issue number was known), so the last 14 rows cover only 11
distinct calendar dates. `nightsConsidered` reports 14 regardless, and the
TUI's zero-merge warning ("zero merges in {nightsConsidered} nights")
inherits that overstatement verbatim into a human-facing dashboard message.
Fix: add an additive `distinctDatesInWindow` signal field and use it in the
one place the row/night conflation is user-visible.

## What's new
Prior ledger-signals nights (2026-08-26 #33, 2026-09-01 #62, 2026-09-06 #89)
each added a *new* signal (pendingFindings, ledgerStaleness, verified
zeroMergeStreak via `--merged`). None examined whether the window itself
correctly represents "N nights". This is the first finding to test that
assumption directly against the real ledger's data shape, and the first to
show it's false with a reproducible count.

## Competitors (evidence grade)
- **Sakana AI Scientist** (B, vendor blog + paper): logs one experiment
  record per run to a flat file; no windowed trailing-N aggregation step
  comparable to this ledger's, so no direct precedent for the same failure
  mode — included for contrast, not as a fix source.
- **OpenHands** (A, official repo, evaluation harness): SWE-bench trajectory
  logs are one-file-per-episode, sidestepping row/date conflation entirely by
  construction (no shared append-only ledger). Confirms the dream-machine
  ledger's shared-single-file-multiple-writers design is the actual root
  cause, not something upstream tooling would catch.
- **DSPy/GEPA** (A, official repo): its optimizer trace stores one JSON
  record per proposed variant with an explicit generation index, not a
  human-readable date — avoids this class of bug by not using calendar dates
  as the windowing key at all.
- **SWE-agent** (A, official repo): trajectory JSONL, one line per attempt,
  no cross-run windowed signal computation comparable to `learningSignals`.
- **AutoGPT lineage** (C, general knowledge, unverified against current
  source): historically used flat run logs without a "last N sessions"
  learning-signal layer of this kind.

None of the four A/B-grade competitors maintain a hand-editable, multi-writer,
markdown ledger with a "last N rows ~= last N nights" assumption, which is
this repo's own design (ADR-0001) — so the fix has no direct external
precedent to borrow; it is a repo-specific correction to a repo-specific
column-window assumption.

## Frozen hypothesis
Given the real committed `docs/dream-cycle/LEDGER.md` (39 data rows mixing
self-hosted dream-cycle nights and cross-repo portfolio nights, several
re-appended with only their PR/issue reference updated once known —
2026-08-27 appears 2x, 2026-08-28 3x, 2026-08-29 2x, 2026-08-30 3x — as
consecutive but non-adjacent rows in append order), when `learningSignals()`'s
window (`rows.slice(-window)`, default 14) is applied as a raw row-count
slice, then the resulting `nightsConsidered` (14) overstates real calendar-
night coverage in that window (measured directly: only 11 distinct dates),
and the TUI's zero-merge warning inherits that overstatement into its
human-facing text, subject to: zero change to existing `zeroMergeStreak`,
`duplicateDirections`, `blockedEvalStreak`, `ledgerStale`, or `lastRowDate`
outputs — every existing test stays green, byte-identical.

## Benchmark / evaluation
- Evaluator: `npm test` (real repo test suite: vitest unit + node:test
  governance suite), run on parent then candidate on identical source.
- Corpus: the actual committed `docs/dream-cycle/LEDGER.md` (not synthetic) —
  used directly in a new unit test asserting `distinctDatesInWindow < nightsConsidered`
  against the byte-identical file content read from disk.
- Parent (baseline, commit aa931ca): `npx vitest run` → 645/645 pass (24
  files); `npm run test:governance` → 140/140 pass. 785/785 total, 0 fail.
  `npm run typecheck` and `npm run lint` clean.
- Candidate: `npx vitest run` → 651/651 pass (24 files, +6); `npm run
  test:governance` → 140/140 pass (unchanged). 791/791 total, 0 regressions.
  `npm run typecheck` and `npm run lint` clean. Live CLI check on the real
  ledger (`node packages/cli/dist/bin.js ledger signals --path
  docs/dream-cycle/LEDGER.md`) reproduces `distinctDatesInWindow: 11` next to
  `nightsConsidered: 14`, matching the frozen hypothesis exactly.

## Adversarial critique (self-applied, one round)
First draft of the regression test asserted an exact value
(`distinctDatesInWindow === 11`) by reading the **live**
`docs/dream-cycle/LEDGER.md` at test time. That file gains a new row every
night this pipeline runs — including tonight's own STEP 25 append — so the
window contents (and therefore the count) would shift on the very next run,
breaking the test it was meant to protect. Caught before finalizing: froze a
snapshot of tonight's real ledger into
`packages/ledger/src/__fixtures__/2026-09-21-ledger-snapshot.md` and pinned
the exact-value regression test to that fixture instead. Added a second,
separate test that reads the live path but asserts only the invariant
(`distinctDatesInWindow <= nightsConsidered`), which holds for any future
content — so ledger growth cannot break it. No gold answer, benchmark, or
threshold was altered; this only fixed which file the test reads.

## Darwin
Not run. `evaluatorEntrypoints.darwin` invokes `npx @metaharness/darwin` —
unpinned, resolves registry `latest` on every invocation, not covered by this
repo's lockfile (flagged as a standing supply-chain risk in the compiled
routine itself, STEP 8). Bounded Darwin is optional ("only if available");
given the standing warning and that this candidate is a small, deterministic,
fully-unit-tested library change with no need for evolutionary search, running
an unpinned `npx` package tonight was not justified. Left for a human decision
on pinning, as instructed.

## Witness
- Session commit: `aa931caad5dd0108253645bba0ab1481ad7da0ee`
- Report sha256: `137a0d56e00a738824e666d23a7bde920fd17eba34f7c344e93505b34fc5a29a`
  (hashed with the Witness section still showing placeholder text, per
  `@dream-machine/witness`'s documented stamp-then-fill convention — the
  hash was cross-checked byte-for-byte against `dream-machine witness stamp`
  before this section was filled in)
- Witness stamp: `0c297fd8952485cb12c4b10d34ca59b0f5d19f2fd61b72fd0832530e8e43e09b`
- Verifier (5 steps, reproducible by anyone):
  1. `git checkout aa931caad5dd0108253645bba0ab1481ad7da0ee`
  2. `sha256sum /tmp/dream-gist-2026-09-21.md` (report as hashed, before this
     section was filled in) → must match the Report sha256 recorded above.
  3. `printf '%s%s' <report_sha256> aa931caad5dd0108253645bba0ab1481ad7da0ee | sha256sum`
     → must match the Witness stamp above.
  4. `npx vitest run && npm run test:governance` on the candidate branch →
     expect all-pass, no skips.
  5. `node packages/cli/dist/bin.js ledger signals --path docs/dream-cycle/LEDGER.md`
     on the candidate branch → `distinctDatesInWindow` present and `<= nightsConsidered`.

## Next steps
1. Human review: should `learningSignals` go further and window by unique
   date (not just report the discrepancy)? That's a larger, riskier,
   non-additive change — deliberately out of scope tonight given
   zeroMergeStreak bias-to-tiny guidance.
2. Investigate *why* the ledger has re-appended near-duplicate rows at all —
   likely `ledger append` being invoked twice per night once the real PR
   number becomes known after the ledger-row commit already landed. A durable
   fix (e.g. an `--amend-last` mode) is a separate, larger candidate.
3. PR #109 (reviewBacklogSize) and PR #114 (gate CI on ledger verify) are
   both open, unmerged, and adjacent in surface — a human triaging the
   ledger-signals backlog should look at those three PRs together rather than
   reviewing this one in isolation.
