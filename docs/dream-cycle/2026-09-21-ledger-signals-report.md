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
one place the row/night conflation is user-visible. **Round 2 (after
evidence-gate review):** also fixed strict calendar-date validation (impossible
dates like `2026-02-30` were passing as valid "nights"), a second row/night
conflation the reviewer caught a few lines above the first fix, this report's
own undercounted measurements, and added an offline packed-consumer CI gate
after the reviewer's repro exposed that `@dream-machine/ledger`'s published
npm package has been frozen at its 2026-08-13 day-one state ever since — see
"Review response" below.

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
Given the real committed `docs/dream-cycle/LEDGER.md` (37 data rows mixing
self-hosted dream-cycle nights and cross-repo portfolio nights, spanning 21
distinct dates — 12 of those dates carry more than one row, re-appended with
only their PR/issue reference updated once known: 2026-08-25(x2), -26(x2),
-27(x2), -28(x4), -29(x3), -30(x3), -09-01(x2), -02(x2), -03(x2), -05(x2),
-06(x2), -07(x2) — as consecutive but non-adjacent rows in append order),
when `learningSignals()`'s window (`rows.slice(-window)`, default 14) is
applied as a raw row-count slice, then the resulting `nightsConsidered` (14)
overstates real calendar-night coverage in that window (measured directly:
only 11 distinct dates), and the TUI's zero-merge warning inherits that
overstatement into its human-facing text, subject to: zero change to existing
`zeroMergeStreak`, `duplicateDirections`, `blockedEvalStreak`, `ledgerStale`,
or `lastRowDate` outputs — every existing test stays green, byte-identical.

*(Corrected in review response below: the first-published version of this
report undercounted both the total row count — 39 vs. the actual 37 — and
the duplicate-date list, which named only 4 of the 12 actually-duplicated
dates. The core 14-rows/11-dates window measurement was always correct and
is unchanged; only the surrounding whole-ledger characterization was wrong.)*

## Benchmark / evaluation
- Evaluator: `npm test` (real repo test suite: vitest unit + node:test
  governance suite), run on parent then candidate on identical source.
- Corpus: the actual committed `docs/dream-cycle/LEDGER.md` (not synthetic) —
  used directly in a new unit test asserting `distinctDatesInWindow < nightsConsidered`
  against the byte-identical file content read from disk.
- Parent (baseline, commit aa931ca): `npx vitest run` → 645/645 pass (24
  files); `npm run test:governance` → 140/140 pass. 785/785 total, 0 fail.
  `npm run typecheck` and `npm run lint` clean.
- Candidate, round 1 (first published to PR #129): `npx vitest run` →
  651/651 pass (24 files, +6); `npm run test:governance` → 140/140 pass
  (unchanged). 791/791 total, 0 regressions.
- Candidate, round 2 (after review response — see below): `npx vitest run`
  → 656/656 pass (24 files, +11 from baseline); `npm run test:governance` →
  141/141 pass (+1, the new packed-consumer gate). 797/797 total, 0
  regressions. `npm run typecheck` and `npm run lint` clean. Live CLI check
  on the real ledger (`node packages/cli/dist/bin.js ledger signals --path
  docs/dream-cycle/LEDGER.md`) reproduces `distinctDatesInWindow: 12` next to
  `nightsConsidered: 14` (12, not 11, because this branch's own ledger row
  from STEP 25 added a 12th distinct date to the live window — expected and
  consistent with the mechanism this finding describes).

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

## Review response (round 2)
`ruvnet` reviewed round 1 at head `c7c47c3` and returned **REJECT** with five
findings. Each verified independently against the actual code/data before
fixing (not taken on faith):

1. **Calendar-shaped impossible dates pass verification and count as
   nights.** Confirmed: `DATE_RE = /^\d{4}-\d{2}-\d{2}$/` accepts
   `2026-99-99` and `2026-02-30` — shape-valid, not calendar-valid. This
   fed every date-derived signal (`distinctDatesInWindow`, `lastRowDate`,
   `daysSinceLastRow`, `ledgerStale`) and `verifyLedger`'s own date check.
   Fixed: added `isValidCalendarDate()` (format check + a UTC round-trip
   through `Date`) and switched every one of those call sites to it.
2. **Singular message renders "1 nights".** Confirmed in the exact
   real-world case that already exists in this repo's own test suite (14
   rows sharing one date → `distinctDatesInWindow=1`). Fixed: a `plural()`
   helper in `tui.ts`; verified against that exact fixture.
3. **The dashboard header still labels total rows as nights** (`nights
   ${total}`, where `total = rows.length` is an all-time row count, not a
   per-night one) — the same conflation this PR fixes everywhere else,
   left standing a few lines above the fix. Confirmed and fixed: relabeled
   to `rows ${total}`.
4. **The committed report's row and duplicate-frequency measurements don't
   match its fixture.** Confirmed and it was worse than one number being
   off: the report said 39 total rows (actually 37) and named 4 duplicated
   dates (actually 12, with 2026-08-28 appearing 4 times, not 3). Recomputed
   directly from the fixture with a one-line script and corrected above —
   the core 14-rows/11-dates window measurement that the candidate itself
   stands on was never wrong, only the surrounding narrative was.
5. **A clean install of the packed CLI fails against its published ledger
   dependency because EVALS is not exported.** Confirmed, and larger than
   it first looked: `@dream-machine/ledger` has exactly one published npm
   version, `0.1.0`, dated 2026-08-13 (day one) — every feature added since
   then, including `EVALS`, `VERDICTS`, `learningSignals`, and
   `verifyLedger` itself, has never been republished. `@dream-machine/witness`,
   `@dream-machine/compile`, and `@dream-machine/schedule` are all in the
   same state; only the bundled, standalone `dream-machine` CLI artifact
   (built via `scripts/prepare-cli-publish.mjs`, which strips the
   `@dream-machine/*` deps and inlines them with esbuild) has ever been
   republished (0.1.0 → 0.1.1). A plain `npm pack` of `packages/cli` in its
   checked-in, non-bundled state still lists `@dream-machine/ledger: 0.1.0`
   as a real dependency, so installing that tarball outside the workspace
   resolves the stale registry package and breaks exactly as reported.
   Fixing the registry state itself means running `npm publish` — an
   irreversible, external, human-authorized action, not something this
   candidate does autonomously. What *is* in scope and now shipped: a
   deterministic, offline **packed-consumer gate**
   (`scripts/check-packed-ledger-export.test.mjs`, wired into CI for free
   via the existing `npm run test:governance` step) that `npm pack`s the
   current local source, installs the tarball in an isolated directory
   outside the workspace, imports it exactly as an external consumer would,
   and asserts `EVALS`/`VERDICTS`/`learningSignals`/`verifyLedger` are
   present and working. Verified with a negative control (temporarily
   stripped the `EVALS` export from the built `dist/`, confirmed the gate
   fails with `EVALS must be exported from the packed tarball`, restored,
   confirmed green again). This gate catches the *next* version of this bug
   before merge; it does not and cannot fix the registry being stale today
   — filed as issue #130 for a human publish decision.

## Darwin
Not run. `evaluatorEntrypoints.darwin` invokes `npx @metaharness/darwin` —
unpinned, resolves registry `latest` on every invocation, not covered by this
repo's lockfile (flagged as a standing supply-chain risk in the compiled
routine itself, STEP 8). Bounded Darwin is optional ("only if available");
given the standing warning and that this candidate is a small, deterministic,
fully-unit-tested library change with no need for evolutionary search, running
an unpinned `npx` package tonight was not justified. Left for a human decision
on pinning, as instructed.

## Witness (recomputed for round 2 — the round-1 stamp bound a report with
the measurement errors review found, so it is superseded, not reused)
- Session commit: `aa931caad5dd0108253645bba0ab1481ad7da0ee`
- Report sha256: `7942b82810660d555c9ff293a780834ad2c0674ed520ceaea9e2e1eea30dad2a`
  (recomputed the same stamp-then-fill way as round 1: hashed with this
  section still showing placeholder text, cross-checked against
  `dream-machine witness stamp`, then filled in below)
- Witness stamp: `f51d979a0ddfe5972e496ac1e478d026af67a69ec15ef4ff03be5fb5f9994810`
- Verifier (6 steps, reproducible by anyone):
  1. `git checkout <round-2 commit sha>` (the commit that finalizes this file)
  2. `sha256sum docs/dream-cycle/2026-09-21-ledger-signals-report.md` (report
     as hashed, before this section was filled in) → must match the Report
     sha256 recorded above.
  3. `printf '%s%s' <report_sha256> aa931caad5dd0108253645bba0ab1481ad7da0ee | sha256sum`
     → must match the Witness stamp above.
  4. `npx vitest run && npm run test:governance` on the candidate branch →
     expect 656/656 and 141/141, no skips.
  5. `node packages/cli/dist/bin.js ledger signals --path docs/dream-cycle/LEDGER.md`
     on the candidate branch → `distinctDatesInWindow` present and `<= nightsConsidered`.
  6. `node --test scripts/check-packed-ledger-export.test.mjs` → passes,
     proving a packed install of `@dream-machine/ledger` exports `EVALS`.

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
4. A human publish decision is needed on `@dream-machine/ledger`,
   `@dream-machine/witness`, `@dream-machine/compile`, and
   `@dream-machine/schedule` — all four have been stuck at their 2026-08-13
   day-one npm version with no republish since, so every feature added in
   the six weeks since (including this PR's own change) is invisible to
   anyone who `npm install`s them outside this workspace. Filed as issue
   #130 rather than fixed here (publishing is an irreversible, external,
   human-authorized action).
