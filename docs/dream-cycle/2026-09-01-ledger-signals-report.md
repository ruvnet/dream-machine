# Cross-Night Ledger Freshness SOTA Report — 2026

## TL;DR

`docs/dream-cycle/LEDGER.md` on `main` — this repo's own "only durable
cross-night memory" (ADR-0001 §Consequences) — has not moved in **6 days**
while the nightly cron kept firing daily. `@dream-machine/ledger`'s
`learningSignals()` had no way to notice this: it silently computed
`duplicateDirections` / `zeroMergeStreak` / `blockedEvalStreak` from
whatever the checkout handed it, with no signal that the checkout itself
might be stale. Candidate: a deterministic `ledgerStaleness` dimension
(`lastRowDate`, `daysSinceLastRow`, `ledgerStale`) added to
`learningSignals()` and surfaced in both `ledger signals` and the `tui`
dashboard. Verified live against the real repo ledger: `ledgerStale: true,
daysSinceLastRow: 6`.

## What's new

Every prior ledger-signals/witness/verify night (2026-08-16 #15, 2026-08-24
#27, 2026-08-26 #33) worked on **detection accuracy** for a signal
(zero-merge streak wiring, duplicate-direction matching). Tonight is the
first to ask a different question: is the *input* to those signals even
current? The answer, checked against real GitHub state rather than assumed,
is no.

## Evidence (OBSERVATION → INFERENCE)

- **OBSERVATION** (`git log --oneline -- docs/dream-cycle/LEDGER.md`, this
  checkout): exactly 3 commits have ever touched `LEDGER.md` on `main`:
  the seed (`519f8ef`), `e54aec8` (#7), `df9ff40` (#24, which per PR #59's
  own commit message bulk-added 5 rows by direct file edit, bypassing the
  CLI — the source of the 9 pre-existing `ledger verify` errors). Nothing
  since.
- **OBSERVATION** (`mcp__github__list_pull_requests`, `state=all`, this
  session, 2026-09-01): 30 PRs opened since 2026-08-13 with branch prefix
  `dream/`, `sota/`, or `fix/` from Dream Cycle nights. **Zero** have
  `merged: true**. Three were closed unmerged (#7, #13, #24); the rest
  (27) sit open as drafts, including #49 (2026-08-29) and #59 (2026-08-31)
  — two independent nights proposing the *same* ledger-append-validation
  fix, seven nights apart, neither aware of the other because neither
  could see a merged trace of it.
- **OBSERVATION** (`mcp__github__actions_list`, `automerge.yml`, 99 runs):
  every single run's `guard-and-merge` job reports `conclusion: "skipped"`
  — the job's `if: contains(..., 'automerge-safe')` has never once been
  true. The guarded auto-merge path in ADR-0001 exists and has never fired.
- **INFERENCE**: because each night's ledger row is committed on that
  night's own PR branch (STEP 20-25) and PRs don't merge, `main`'s ledger
  reflects only the 1 night (2026-08-13) that somehow landed a commit
  directly, plus one bulk direct-edit (`df9ff40`). It has been *silently*
  stale for every night since 2026-08-26 (row 8) — 6 real cron firings,
  including the ledger-signals night that shipped PR #59, none of which
  this checkout's ledger reflects. `docs/dream-cycle/*-report.md` local
  evidence has the same blind spot: only `2026-08-13-security-adversarial-
  report.md` exists in this checkout; every later night's report lives
  only on its own unmerged branch.
- This directly explains the #49/#59 duplicate: STEP 2 ("load accumulated
  evidence... prior rejected candidates") and STEP 1.1's
  `duplicateDirections` both search `main` + the local checkout, which is
  precisely the six-day (now more) blind window.

## Hypothesis (frozen before implementation)

> Given `docs/dream-cycle/LEDGER.md` on `main` and this repo's confirmed
> zero-merge-in-30-PRs history, when a deterministic `ledgerStaleness`
> dimension (`lastRowDate`/`daysSinceLastRow`/`ledgerStale`, threshold
> `staleAfterDays=1` for a daily cron) is added to
> `@dream-machine/ledger.learningSignals()` and wired into
> `dream-machine ledger signals` (JSON) and `dream-machine tui` (dashboard
> warning), then it should correctly flag `main`'s real ledger as stale
> (`lastRowDate=2026-08-26`, run date `2026-09-01` → 6 days), subject to:
> zero regressions in the 98 pre-existing tests, no misfire on an empty or
> freshly-seeded ledger, and the ledger's write path
> (`appendRow`/`verifyLedger` schema, `VERDICTS`/`EVALS`) is untouched.

## Candidate

- `packages/ledger/src/index.ts`: `learningSignals()` gains `today`/
  `staleAfterDays` options and 3 new `LearningSignals` fields
  (`lastRowDate`, `daysSinceLastRow`, `ledgerStale`); newest-valid-date is
  taken by max over all rows (not "last row" positionally), so one
  malformed date (e.g. the historical `df9ff40` rows) can't hide a real
  one. Pure function, UTC date math, no I/O.
- `packages/cli/src/index.ts`: `ledger signals` passes `io.now()` as
  `today`; `tui` passes `io.now()` too.
- `packages/cli/src/tui.ts`: dashboard footer gets a red
  `⚠ ledger stale (Nd since last row) — signals below may be blind`
  line when `ledgerStale` is true, printed *before* the other signal
  warnings since it qualifies all of them.
- 9 new tests (5 unit in `@dream-machine/ledger`, 4 in the CLI package)
  covering: no-`today` no-op, real 6-day-stale repro, threshold boundary
  (0/1/2 days), malformed-date tolerance, empty ledger, CLI/TUI wiring.
- Diff: ~90 lines across 4 files. One conceptual change (a staleness
  dimension), reviewable in one pass.

## Evaluation Receipt

Real evaluator: `npm test` (vitest v2.1.9), plus a live run against this
checkout's actual `docs/dream-cycle/LEDGER.md`.

- **Baseline** (parent, commit `7933c3599abe22df5290f4609d1f93f598feb3de`):
  `npm ci && npm run build` clean; `npm test` → 98/98 green, 7 files.
  `node packages/cli/dist/bin.js ledger signals --path
  docs/dream-cycle/LEDGER.md` → `{zeroMergeStreak: true,
  duplicateDirections: [], lowScoreStreak: false, blockedEvalStreak: false,
  nightsConsidered: 6}` — no way to tell this is stale data.
- **Candidate**: same build clean; `npm test` → **107/107 green** (98
  pre-existing + 9 new, 0 regressions, 0 skipped); `npm run lint` clean.
  Same live command now returns additionally `lastRowDate: "2026-08-26",
  daysSinceLastRow: 6, ledgerStale: true`. `tui --path
  docs/dream-cycle/LEDGER.md` shows `⚠ ledger stale (6d since last row) —
  signals below may be blind` ahead of the existing zero-merge warning.
- `ledger verify` against the real ledger: unchanged, still the same 9
  pre-existing historical errors (this candidate does not touch
  `verifyLedger`'s enum or rewrite history).

## Baseline

Commit `7933c3599abe22df5290f4609d1f93f598feb3de` (`main` at session
start). See receipt above for exact commands and outputs.

## Darwin Lineage

Not run. This candidate is pure deterministic date arithmetic over already
-parsed rows — no search space, no fitness function to bound. Per STEP
10-14, Darwin only applies after basic evaluation clears *and only if it
would add evidence*; a 1-parameter threshold with 3 boundary tests already
fully characterizes the behavior. Logged as a scan finding instead:
`npx @metaharness/darwin evolve --sandbox mock` still has no
dream-machine-specific adapter (same gap PR #59 logged on 2026-08-31,
unresolved — third consecutive ledger-signals night to note it; filing as
a rotation candidate for a future `evaluation-adapters` night rather than
re-diagnosing it a fourth time).

## Reward-Hack Check (independent critic pass)

- Weakened a benchmark or test? No — only additive tests; none of the 98
  pre-existing tests were touched.
- Altered gold data? None exists in this repo's test suite for this
  surface.
- Cherry-picked metric? No — the real `npm test` count is reported in
  full (98→107), plus a live, reproducible command against the actual
  repo ledger, not a synthetic fixture alone.
- Exploited the evaluator? No — no changes to `vitest.config.ts`, no
  skipped/xfail tests, no timing tricks.
- Hidden cost or undocumented cache? No — pure function, one `Date.parse`
  pair, no memoization, no new dependency.
- Threshold touched? `staleAfterDays` is a *new* parameter (default 1),
  not a change to any existing gate, promotion, or scorer threshold — the
  `automerge.yml` protected-path regex (`.*(threshold|promotion|scorer).*`)
  does not match anything in this diff; confirmed by grep before
  committing.
- **Self-critique on my own candidate**: is `staleAfterDays=1` too
  aggressive for a repo whose cron can legitimately skip a day (e.g. rate
  limits, holidays)? Possibly — chose 1 to match the compiled prompt's own
  `cron: "0 9 * * *"` (daily) and because false positives here are cheap
  (a dashboard warning a human can dismiss), while false negatives
  (silently stale for 6+ days, the observed failure) are what actually
  hurt. Documented as a next-step tuning question below, not hidden.

## Security Review

Two TS source files touched (`ledger/src/index.ts`, `cli/src/index.ts`,
`cli/src/tui.ts`) plus two test files. Pure date-string arithmetic on
data already read from the local filesystem; no new dependency, no
network call, no filesystem/permission scope change, no model call, no
change to `appendRow`/`verifyLedger`'s write/validation contract. Nothing
in the reward-hack/promotion-gate surface. Not a protected path per
`automerge.yml`'s own regex.

## Scan Findings

1. **witness**: `@dream-machine/witness` itself is unaffected and untested
   by tonight's change (no report/commit-hash interaction) — confirmed by
   inspection, not assumed.
2. **verify**: `ledger verify`'s 9 pre-existing structural errors on the
   real `main` ledger (compound verdicts, `evaluated=partial`, all from
   the `df9ff40` bulk direct-edit) remain unfixed by design — PR #59
   already proposes the write-path fix; re-implementing it here would be
   the exact duplicate-direction failure this report is about. Recommend
   it as the PR a human labels `automerge-safe` first, being the smallest,
   oldest, most-reviewed candidate in the backlog.

## Competitors

| System | Cross-run memory mechanism | Grade | Relevance to tonight |
| --- | --- | --- | --- |
| Sakana AI Scientist | Per-run write-up + idea archive on disk, no explicit staleness/freshness check on the archive itself | B (paper + public repo, not independently reproduced by me) | Same blind spot in principle: an archive nobody prunes/dates can silently stop being consulted |
| OpenHands (formerly OpenDevin) | Task history + memory condenser, session-scoped; long-horizon cross-session memory is an active area, not durable-file-based | B (official docs/repo) | Doesn't rely on a git-mergeable durable file, so doesn't share this exact failure mode — but has its own (session memory compaction can drop earlier findings) |
| DSPy / GEPA | Optimizer keeps a Pareto/reflection trace across compile iterations *within* one optimization run | B (official repo/paper) | Trace is versioned in-memory per run, not dependent on an external merge event — structurally immune to "PR never merged" staleness |
| SWE-agent | Per-episode trajectory logs; no cross-episode durable ledger by default | B (official repo) | No direct analogue; each episode is independent, so there's no "stale shared memory" to go wrong, but also no learning-signal carryover at all |
| AutoGPT lineage | Long-term memory via vector store, updated per-step, no separate git-mergeable ledger | C (varies widely by fork; not independently checked) | Vector memory updates immediately (no PR gate), so wouldn't reproduce this specific failure — but has its own consistency risks (unbounded growth, no verify step) |

None of the five surveyed systems binds its cross-run memory to a
human-gated git merge the way this repo's ADR-0001 design does, so none of
them has *this* exact failure mode by construction — which is itself the
finding: coupling "durable memory" to "human-approved merge" while running
fully autonomously creates a starvation condition none of the competitors
share, because none of them require a merge (human or automatic) to persist
a lesson.

## Witness

`dream-machine witness stamp` hashes this exact file's raw bytes, so the
stamp cannot be written *inside* the file it stamps without invalidating
itself against the committed bytes (the same self-reference issue the
2026-08-13 report first flagged). The stamp is therefore computed over this
file frozen exactly as it reads at this point, and published instead in the
PR description and the `LEDGER.md` row, both of which point back at this
file (committed at `docs/dream-cycle/2026-09-01-ledger-signals-report.md`)
by path and session commit. Anyone can independently reproduce it:

```bash
sha256sum docs/dream-cycle/2026-09-01-ledger-signals-report.md   # REPORT_HASH
printf '%s%s' "$REPORT_HASH" "7933c3599abe22df5290f4609d1f93f598feb3de" | sha256sum
# must equal the WITNESS value published in the PR body and LEDGER.md
```

Reproduce the finding and the fix:
1. `git checkout 7933c3599abe22df5290f4609d1f93f598feb3de && npm ci && npm run build && npx vitest run` → 98/98 green (baseline).
2. Apply this PR's diff, rebuild, `npx vitest run` → 107/107 green (candidate).
3. `node packages/cli/dist/bin.js ledger signals --path docs/dream-cycle/LEDGER.md` → `ledgerStale: true`, `daysSinceLastRow` growing by 1 for every day this PR stays unmerged.

## Recommendation

**ACCEPT** for human review (draft PR only — this session never merges or
self-labels `automerge-safe`). This is a tiny, single-surface, fully
reversible visibility addition with a real, reproduced, non-synthetic
finding behind it. Three concrete next steps for future nights:

1. **Architectural, not tonight's scope**: decide (ADR) whether nightly
   ledger rows should ever be committed to `main` outside a PR merge —
   e.g. a narrowly-scoped direct-append-only bot commit for the ledger row
   alone — given the auto-merge path has fired 0 times in 99 runs and the
   PR backlog is now 27 open drafts.
2. A human should apply `automerge-safe` to PR #59 (oldest, smallest,
   already-reviewed ledger-write-path fix in the backlog) to test the
   guarded auto-merge path end-to-end for the first time ever.
3. Wire the same `today`/staleness check into STEP 2's "load accumulated
   evidence" instruction text (a `compile`-package change, out of scope
   tonight to keep this candidate to one conceptual change) so the
   *compiled prompt itself* tells a future night to widen its GitHub
   PR/issue search radius once `ledgerStale` is true, instead of relying
   on the model noticing via manual archaeology as this session did.
