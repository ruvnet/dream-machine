# Dream Cycle Consolidation — 2026-10-21

MODE=CONSOLIDATE (STEP 1.5). DEEP=ledger-signals, SCAN=witness,verify (slot 1).
19 open candidate PRs measured live (`search_pull_requests`, ground truth) ≥
`implementationTrack.reviewBacklogLimit`; oldest eligible draft was PR #145
(still draft, ACCEPT in its own Evaluation Receipt, not a routine-self-review
PR, no `dream-consolidate` marker for today's default-branch SHA). Per
ADR-0011 this is the first night the v2 engine's CONSOLIDATE mode fires.
No new research, candidate, issue, or PR opened tonight (STEPS 2-9 and 17-24
skipped as specified).

## Action

Merged `main` (`3fc3222d2e5566a203331d3686c4d2eaf06713a8`) into
`dream/2026-10-01-ledger-signals` with an ordinary merge commit (never
rebase, never force-push): `169623f95561a3dd11d0faf5259c68ba5825a6fc`. One
textual conflict, in `docs/dream-cycle/LEDGER.md` — both sides had appended
rows after the PR's own 2026-10-01 row; resolved by chronological
concatenation (2026-10-01 row, then main's 2026-10-10/11/12 rows), a pure
append with no content loss on either side. All other files (including
`packages/ledger/src/index.ts`, where main had independently added
`directionKey` prefix-stripping and the outcome-metrics/backlog module)
auto-merged cleanly with zero overlap against this candidate's
`splitRow`/`escapeCell` change.

## Re-evaluation on the new head (`169623f`)

Real evaluator: `npm test` (`vitest run && npm run test:governance`).

| | Baseline (`main@3fc3222`) | New PR head (`169623f`) |
|---|---|---|
| vitest | 889 | 889 (0 regressions) |
| governance | 195 | 195 (0 regressions) |
| `npm run lint` | clean | clean |
| `npm run typecheck` | clean | clean |
| `npm run build` (8 packages) | clean | clean |

Live re-repro of the original finding directly against the rebuilt
`@dream-machine/ledger` dist on the new head: `appendRow` on a finding
containing a literal `|` round-trips through `parseLedger` byte-identical,
`warnings: []` — the fix is intact post-merge. `ledger verify --since-row 56`
(the rows appended after the legacy grandfathered prefix, now including both
this PR's row and main's three newer rows) reports `OK — 54 rows`, 0 new
structural errors.

## Fresh independent critic (this consolidation round)

Diffed `23a577082aad39750051dc7ef0ec9d0d72900adf..origin/main` for
`packages/ledger/src/index.ts`: the only intervening change is
`directionKey`'s mode-tag stripping and the new `OutcomeMetrics`/backlog
functions (PR #167, #176's wiring) — neither touches `splitRow`, `escapeCell`,
or the pipe-tokenizer this candidate's hypothesis is about. No gold data,
threshold, or benchmark corpus touched by the merge; no undocumented cache;
no hidden cost. Reward-hack check: **CLEAR** — nothing in the consolidation
step weakens a test, alters a gold answer, or narrows the original 9-case
adversarial sweep from PR #145's own round.

Darwin: `DARWIN=not-applicable`, unchanged from the original round (single
conceptual change, no evolvable population).

## CI on the pushed head (`169623f`)

8 of 9 checks green: `guard`, `CodeQL`/`analyze`, `test (22)`, `test (24)`,
`no-optional-deps`, `software-evidence`, `dependency-security` — all
`success`. One red: `dependency-audit` (`npm audit --audit-level=high`),
**failure**.

Ruled out as this PR's: reproduced the identical single finding (`vite`
8.3.0–8.3.2 → `launch-editor` GHSA-698v-4r3x-3vcv / GHSA-r825-w8mm-5pxw /
GHSA-587h-7wmj-h5pm, high) on a fresh, independent clone of `main` at
`3fc3222` with zero candidate diff applied — `npm ci --ignore-scripts && npm
audit --audit-level=high` fails identically. This is a dev-toolchain
transitive advisory already present on the default branch, unrelated to the
ledger-parsing change this PR evaluates. No existing issue or PR addresses it
(`search_issues` for `launch-editor`/`vite`/`audit`: 0 results). Per the
CI-red rule, a failure in code unrelated to the change is named rather than
fixed from this PR when no existing fix can be ported and none is proposed
here tonight — `npm audit fix --force` would bump `vite` outside its stated
range, a separate, unevaluated change out of scope for a ledger-parsing
consolidation and not this candidate's to absorb. Left for a future
`security-adversarial` night.

## Decision

Not all required checks are green on the pushed head. Per STEP 1.5: ACCEPT
still holds and the critic is clear, but the all-green condition does not,
so PR #145 **stays draft**, not marked ready for review.

## Witness

```
report_sha256 : e6996d557ed6968a508df1d495f507ee2955eb3ec9524f2a5f696cd822add26c
session_commit: 169623f95561a3dd11d0faf5259c68ba5825a6fc
witness       : 5e39a12326f0f2d58c2a58c93d702d34b6fc0028ac228fec2a06893eaf5cdf96
```
Reproduce: `dream-machine witness verify-report docs/dream-cycle/2026-10-21-ledger-signals-consolidate-145-report.md --commit 169623f95561a3dd11d0faf5259c68ba5825a6fc`
