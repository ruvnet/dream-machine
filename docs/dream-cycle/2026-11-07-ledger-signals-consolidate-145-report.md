# Dream Cycle Consolidation — 2026-11-07

MODE=CONSOLIDATE (STEP 1.5). DEEP=evaluation-adapters, SCAN=flywheel,darwin
(slot 2) — tonight's slot assignment, superseded for action by CONSOLIDATE
mode per STEP 1.5's own precedence rule. 18 open candidate PRs measured live
(`gh api repos/.../pulls`, head ref `startswith('dream/')`, ground truth)
>= `implementationTrack.reviewBacklogLimit` (6).

## Eligibility scan (oldest first)

Checked every open draft candidate PR, oldest created_at first, against the
four CONSOLIDATE eligibility criteria (still draft; ACCEPT in its own
Evaluation Receipt — not `main`'s ledger; not a `routine-self-review` PR; no
`<!-- dream-consolidate: <SHA> -->` marker for today's default-branch SHA
`71d607bea6608180b8c41980dc5386526d3f1f16`):

- **#98** (`docs: portfolio evidence`, 2026-09-08): excluded. Its Evaluation
  Receipt reports a compound outcome — "one ACCEPT, one REJECT, three
  INCONCLUSIVE" across five unrelated multi-repo portfolio findings — not a
  single PR-level ACCEPT verdict the criterion can anchor on.
- **#101** (`docs: portfolio evidence through 2026-09-29`, 2026-09-09):
  meets the four literal criteria (draft; "Verdict: **ACCEPT**, narrowly
  scoped..."; not self-review; no marker for today's SHA) but **overridden**.
  `git merge-tree`/a real worktree merge against `main` conflicts in
  `docs/dream-cycle/LEDGER.md`, and inspection shows the conflict is not an
  ordinary append: this branch's `LEDGER.md` additions use a different,
  older "portfolio" column schema (multi-repo, `owned`-tagged rows tracking
  a broader cadence) than the current single-repo 10-column schema the rest
  of this ledger and tonight's rows use. Mechanically concatenating the two
  would risk silently mixing incompatible row shapes in a file this routine's
  own constitution lists as protected ("ledger schema", STEP 1.6). Resolving
  it correctly requires a scope decision (is 2026-09 portfolio tracking still
  part of this repo's dream-cycle schema at all?) that is out of bounds for a
  mechanical CONSOLIDATE action tonight. Skipped, not fixed; left open for a
  future `routine-self-review` or maintainer call. No remote side effect
  taken on #101 or #98 tonight (no comment posted, no marker written).
- **#145** (`ledger-signals: splitRow doesn't unescape \| from escapeCell`,
  2026-10-01): meets all four criteria. Carries a `dream-consolidate` marker
  from 2026-10-21 for SHA `3fc3222d2e5566a203331d3686c4d2eaf06713a8` — stale
  against tonight's SHA, so still eligible. **Selected.**

## Action

Merged `main` (`71d607bea6608180b8c41980dc5386526d3f1f16`) into
`dream/2026-10-01-ledger-signals` with an ordinary merge commit (never
rebase, never force-push): `59a0dd03c890d41995cc03e0c2a83de622185fb0`. One
textual conflict in `docs/dream-cycle/LEDGER.md`: both sides had appended
rows since the branch's prior (2026-10-21) consolidation, including three
rows (2026-10-10, 2026-10-11, 2026-10-12) that were identical text on both
sides (already carried on this branch from its own 2026-10-21 merge, and
independently present on `main`). Resolved with a byte-level splice (reading
and writing the conflict region as raw bytes, not Python `re.sub`'s
replacement string — a first attempt via `re.sub` silently collapsed a
literal `\\|` to `\|` inside the 2026-10-01 row's own Finding text, which
would have reintroduced a corrupted ledger row while consolidating the exact
PR that fixes ledger pipe-corruption; caught before committing by comparing
raw bytes against `git show cf42b04:...` and redone byte-safe) into nine
distinct rows, sorted chronologically, exact duplicates removed. No content
lost on either side. `packages/ledger/src/index.ts` and all other files
auto-merged clean with zero overlap against this candidate's
`splitRow`/`escapeCell` diff (confirmed via `git diff 71d607b 59a0dd0 --
packages/ledger/src/index.ts`, showing only the original PR #145 diff).

## Re-evaluation on the new head (`59a0dd0`)

Real evaluator: `npm test` (`vitest run && node --test` governance suite),
built from the PR branch's **own** sources (not `main`'s dist — an earlier
check against `main`'s unfixed `@dream-machine/ledger` build gave a false
"malformed row" alarm on the 2026-10-01 row; rebuilding from this branch's
own fixed `splitRow` resolved it cleanly).

| | Baseline (`main@71d607b`) | New PR head (`59a0dd0`) |
|---|---|---|
| vitest | 911 passed, 2 skipped | 911 passed, 2 skipped (0 regressions) |
| governance (`node --test`) | 197 | 197 (0 regressions) |
| `npm run lint` | clean | clean |
| `npm run build` (8 packages, incl. typecheck) | clean | clean |
| self-hosted `dream.config.json` compile output | — | byte-identical to tonight's compiled routine prompt |

Live re-repro of the original finding directly against the rebuilt
`@dream-machine/ledger` dist on the new head: a ledger row whose Finding
contains `|`, `||`, a backslash adjacent to a pipe, and a lone backslash not
escaping a pipe, all round-trip through `appendRow` -> `parseLedger`
byte-identical, `warnings: []`, `wellFormed: [true]` — the fix is intact
post-merge. `ledger verify --path docs/dream-cycle/LEDGER.md --since-row 38
--legacy-digest 23b02bfa98b56b374fadfb1b05df25e589dcdeab26143ae6183083d21779426a`
(this repo's exact CI invocation): `OK — 60 rows`, 0 errors.

## Fresh independent critic (this consolidation round)

Re-derived the escaping argument from scratch rather than trusting the prior
round's clearance: `escapeCell` only ever inserts one backslash directly
before each literal `|` and never touches a pre-existing backslash, so every
`|` in the *decoded* output corresponds to exactly one `\|` 2-byte token in
the *encoded* text, and every backslash not immediately followed by `|` is
untouched content — the encoding is unambiguous and `splitRow`'s greedy
left-to-right `\|`-token scan is its exact inverse. Traced the specific
ambiguous case live (backslash-pipe content `X\|Y` -> `escapeCell` ->
`X\\|Y` -> `splitRow` -> `X\|Y`) byte-by-byte and confirmed it round-trips;
this is the same case the included test `'leaves a lone backslash (not
escaping a pipe) untouched'` and `'round-trips multiple pipes and a pipe
adjacent to a backslash'` cover. No bypass found. Diffed
`71d607b..59a0dd0` for `packages/ledger/src/index.ts`: the merge introduces
zero changes to this file beyond the original PR #145 diff — no gold data,
threshold, or benchmark corpus touched; no undocumented cache; no hidden
cost. Reward-hack check: **CLEAR**.

Darwin: `DARWIN=not-applicable`, unchanged from the original round (single
conceptual change — an escape-aware tokenizer swap in one function — has no
evolvable population or fitness landscape to search, same judgment recorded
for #103/#122/#141/#160/#180/#182). Control-plane liveness check (`npx
@metaharness/darwin@0.12.0 --version`) was blocked by this session's sandbox
policy (external-package execution denied) — recorded as a degradation, not
a stop condition, consistent with STEP 0.5.

## CI on the pushed head (`59a0dd0`)

9/9 checks green: `guard`, `test (22)`, `test (24)`,
`no-optional-deps`, `dependency-security`, `dependency-audit`,
`software-evidence`, `analyze`, `CodeQL` — all `success`. The
`dependency-audit` check that blocked the two prior consolidation rounds on
this PR (2026-10-21, 2026-10-28; pre-existing `vite`/`launch-editor`
high-severity advisory, tracked in issue #197) is now green: `npm audit
--audit-level=high --omit=dev` on current `main` reports 0 vulnerabilities
— the advisory has been resolved upstream or superseded since. Issue #197
left open for the maintainer to close (no comment posted there tonight; out
of scope for this PR's consolidation).

## Decision

ACCEPT still holds, the critic is clear, **and** every required check on the
pushed head is green. Per STEP 1.5, PR #145 is marked **ready for review**
(`gh pr ready`) — not merged, not approved; a human decides from here.

No merge, no close, no force-push, no self-promotion.

## Witness

```
report_sha256 : f5a5f7757d167cb201db593361bc6aefe434d0d07a5d98eee8df6169613e78d4
session_commit: 59a0dd03c890d41995cc03e0c2a83de622185fb0
witness       : 7c719db5a433de3746441fe5a1b5ae24264ca32e0a2791e6c8ba0f6b7a4089f4
```
Reproduce: `dream-machine witness verify-report docs/dream-cycle/2026-11-07-ledger-signals-consolidate-145-report.md --commit 59a0dd03c890d41995cc03e0c2a83de622185fb0`
