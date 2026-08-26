# Ledger-Signals SOTA Report — 2026

## TL;DR

Tonight's DEEP=ledger-signals night set out to check STEP 1.1's learning
signals against reality (SCAN=witness,verify) — and found the signals'
biggest gap isn't in their arithmetic, it's in what they can see. Cross-checking
`docs/dream-cycle/LEDGER.md` against real GitHub state (grade A, `mcp__github__*`
tonight) showed the ledger has exactly one row (2026-08-13, PR #7, merged),
while nine draft PRs from subsequent nights (#15, #17, #19, #21, #23, #24,
#27, #29, #30) sit open and unmerged. Two of them — PR #15 (2026-08-16,
"derive zeroMergeStreak from Prior-night fates tokens") and PR #27
(2026-08-24, "thread real merge state into zero-merge learning signal") —
independently propose closely related fixes to the same underlying defect
(`zeroMergeStreak` can't see a real merge). Neither is visible to
`learningSignals()`'s `duplicateDirections` detector, because it only ever
scans rows already merged into `LEDGER.md` on main — by design, the ledger
is durable memory only for nights that landed. Tonight's candidate: an
opt-in `pendingFindings` option (library) and a `--pending` CLI flag so a
future night can feed in still-open PRs' findings and get the *same*,
unchanged duplicate-direction detector to also see them — narrowing the
window in which a third near-duplicate candidate (which tonight's own
research nearly became, before manually checking GitHub) can get written.

## What's new

- First-hand reproduction (grade A): `docs/dream-cycle/LEDGER.md` on main has
  1 row; GitHub has 9 open dream-cycle draft PRs, 0 of them merged
  (`mcp__github__list_pull_requests`/`pull_request_read` tonight).
- PR #15 and PR #27 confirmed independently open, both draft, both targeting
  `zeroMergeStreak`'s blindness to real merge state, neither superseding the
  other.
- Confirmed via direct inspection (`packages/ledger/src/index.ts`) that
  `duplicateDirections` only ever iterates `rows` (parsed `LEDGER.md`) — it
  has no path to see a finding that only exists in an open PR's description.
- **Correction made during tonight's own adversarial critique** (see Reward-Hack
  Check below): an independent reviewer verified that the real PR #15/#27
  title text does **not** share the first-6-word lexical-prefix key the
  detector matches on — so this candidate, as shipped, would **not** actually
  have caught #15-vs-#27 from their raw titles. The mechanism's value is
  narrower and honestly stated below, not overstated.

## Hypothesis (frozen before implementation)

> Given `duplicateDirections` only scans ledger rows already merged into
> `LEDGER.md` on main, when `learningSignals()` gains an optional
> `pendingFindings: string[]` parameter that is folded into the *same*
> first-6-word normalization/counting pipeline already used for merged rows,
> then a direction repeated across merged rows plus still-open PRs' findings
> (>= 3 total occurrences, combined) should be flagged exactly as if all of
> them had already landed — while the default (no `pendingFindings` /
> no `--pending`) path stays byte-for-byte identical to today. Subject to: no
> existing test weakened, no new I/O/network/shell exec, CLI parsing must be
> robust to commas inside real PR titles.

## Benchmarks / Evaluation

Real evaluator: `npm test` (vitest), this repo's own `bench` entrypoint.
`LLM_EVAL` was **not** blocked tonight (`OPENROUTER_API_KEY` present), but
this candidate needed no model calls — it's deterministic string processing,
consistent with STEP 1.1's own bias toward a no-model-call, easily-reviewable
candidate under a demonstrated `zeroMergeStreak=true`.

| | Baseline (parent, commit 074fd1f) | Candidate |
|---|---|---|
| Tests | 96 | 104 (+8, 0 removed, 0 modified) |
| Result | 96 passed | 104 passed |

Baseline reconfirmed via `git stash` + rerun immediately before finalizing
(96/96, matches the pre-candidate count exactly). Diff: 4 files changed,
+130/-9 (post-critique-fix total), one conceptual change (an additive
`pendingFindings` option + `--pending` CLI flag), no pre-existing test
touched.

Live receipt — `dream-machine ledger signals`, before/after `--pending`,
against a synthetic ledger modeled on this repo's own compact Finding style
(not raw PR titles — see the honesty correction above):

```
$ node packages/cli/dist/bin.js ledger signals --path /tmp/synthetic-ledger.md
{ "duplicateDirections": [], ... }   # 1 merged row only, below threshold

$ node packages/cli/dist/bin.js ledger signals --path /tmp/synthetic-ledger.md \
    --pending "zero merge streak signal ignores real pr merge state (cli --merged flag night)|zero merge streak signal ignores real pr merge state (tonight's near-duplicate before catching #15/#27)"
{ "duplicateDirections": ["zero merge streak signal ignores real"], ... }
```

Comma-safety receipt (the defect the independent critic found and this report
documents as fixed, not silently shipped):

```
$ node -e "console.log(require('./packages/cli/dist/index.js').parsePendingFindings(
    'developer-experience: thread real merge state into zero-merge learning signal (cli, tui)'))"
[ 'developer-experience: thread real merge state into zero-merge learning signal (cli, tui)' ]
# unchanged as ONE finding — a comma-splitting parser would have fractured
# this real PR #27 title into a bogus extra "finding" (verified before the fix).
```

## Darwin (bounded evolution)

Not run — `DARWIN=not-applicable`. Same judgment as the 2026-08-13 and
2026-08-24 precedents: a small, pure, closed-form string-processing change
has no evolvable population for bounded Darwin's generations×children search.

## Evidence

- OBSERVATION: `LEDGER.md` on main = 1 row; GitHub = 9 open dream-cycle draft
  PRs, 0 merged (confirmed live via GitHub MCP tonight).
- OBSERVATION: PR #15 and PR #27 both target `zeroMergeStreak`'s blindness to
  real merge state, both still open.
- MEASUREMENT: `npm test` 96/96 (baseline) → 104/104 (candidate), 0 regressions,
  reconfirmed via `git stash`.
- MEASUREMENT: `parsePendingFindings` on real PR #27 title text — 1 finding
  preserved (pipe-delimited), vs. a comma-delimited version that fractures it
  into 3 (defect found + fixed tonight, see Reward-Hack Check).
- INFERENCE: `duplicateDirections`'s first-6-word lexical-prefix matching
  (pre-existing, unchanged by this candidate) does not, by itself, catch
  #15-vs-#27's actual title text — their real findings/titles use different
  opening words. The candidate extends *recall* (pending findings become
  visible to the same detector) without changing or improving the detector's
  underlying *matching precision*, which remains a known, pre-existing
  limitation.
- DECISION: ship the `pendingFindings` option + `--pending` CLI flag as a
  small, opt-in, additive extension; do not attempt to improve lexical
  matching (semantic/fuzzy matching) tonight — that is a materially larger,
  separately-reviewable change, out of scope for a "bias to tiny" night.

## Reward-Hack Check

Independent critic: a fresh subagent (Agent tool, genuinely independent of
this candidate's authoring context) reviewed the diff adversarially.

**Initial verdict: BLOCKED**, with two concrete findings:

1. **Comma-splitting defect**: `parsePendingFindings` split on `,`, and the
   real motivating PR #27 title contains a comma — it would have fractured
   into a bogus 3rd "finding" in production use. Not covered by the original
   tests (a cherry-picked-happy-path gap). **Fixed**: delimiter changed to
   `|` (matches `LEDGER.md`'s own field separator; `escapeCell` already keeps
   raw `|` out of ledger cells), plus a new regression test
   (`packages/cli/src/index.test.ts`, "preserves commas inside a finding").
2. **Overstated motivating claim**: the draft report implied this candidate
   "would have caught #15 vs #27." The critic verified, from the real title
   text, that it would not (see Evidence/INFERENCE above). **Fixed**: this
   report states the honest, narrower claim — extended recall via the
   unchanged existing matching logic, not improved matching.

Both fixes verified: rebuilt, reran `npm test` (104/104, 0 regressions from
the post-fix baseline), and directly re-ran `parsePendingFindings` against
the real PR #27 title to confirm the comma is now preserved.

**Re-reviewed after fixes: CLEAR.** No pre-existing test weakened or removed;
default (`--pending` omitted) path verified byte-identical
(`packages/ledger/src/index.test.ts`, "omitting pendingFindings leaves
duplicateDirections unchanged"); no new I/O, network, shell exec, or
credential surface (pure string parsing only); no threshold, gate, or safety
constant touched (`git diff --stat` confirms only the 4 intended files);
scope limited to `packages/ledger` + `packages/cli` source + their tests.

## Security Review

No new exec/network/credential surface. `parsePendingFindings` and
`directionKey`/`bumpDirection` are pure string operations (split/trim/regex),
no eval, no shell interpolation, no external I/O, no LLM calls in this
candidate. `--pending`'s input is always caller-supplied (a human or a future
night's own GitHub-MCP-sourced PR titles), never attacker-controllable
runtime input, and it only ever feeds a `Map<string,number>` counter — no
code path executes or evaluates the string.

## Regression Analysis

0 pre-existing tests modified or removed. All 96 baseline tests still pass
unchanged; 8 new tests added (3 in `packages/ledger/src/index.test.ts` for
`pendingFindings`, 5 in `packages/cli/src/index.test.ts` for
`parsePendingFindings` + the `--pending` CLI flag, including the
comma-preservation regression test added post-critique).

## ADR

None — this is an additive, opt-in extension to an existing, already-tested
signal-computation function (STEP 1.1), not a new architectural decision.
Same judgment as the PR #15 and PR #27 precedents for adjacent changes in
this exact area. (Extends, doesn't supersede, ADR-0001.)

## Gist

No `gh gist create` / `gh` CLI available in this environment (same as every
prior precedent night). Report committed at
`docs/dream-cycle/2026-08-26-ledger-signals-report.md` instead. `GIST=LOCAL`.

## Witness

See the PR description and `LEDGER.md` row for the computed
`report_sha256` / `session_commit` / `witness` triple and the 5-step verifier
procedure, following the same self-reference-safe pattern established
2026-08-13 (the stamp is computed over this file exactly as committed, then
published *outside* the file, never edited back in afterward).

## Recommendation

Human review of the draft PR. Explicitly NOT done tonight (next steps, not
silently dropped):

1. **The real backlog problem**: 9 open, unmerged dream-cycle draft PRs
   (#15, #17, #19, #21, #23, #24, #27, #29, #30) is the more consequential
   finding tonight, and this candidate does not fix it — it only makes the
   *symptom* (duplicate directions going undetected) more visible for a
   future night that chooses to wire `--pending` in. The actual fix is
   either merging the backlog (a human decision, out of scope for any
   nightly candidate) or a process change to STEP 1/1.1 that automatically
   feeds open-PR titles into `--pending` during STEP 1's fate check. Left
   for a future night or human triage — flagged here so it isn't
   rediscovered from scratch.
2. **Lexical matching stays weak**: `directionKey`'s first-6-word exact-match
   is unchanged and known-fragile (case in point: #15 vs #27 don't match on
   their real titles). A semantic/fuzzy matcher would be a materially larger
   change and belongs in its own frozen hypothesis and evaluation, not
   bundled into tonight's tiny candidate.
3. STEP 1 also calls for re-checking the last 7 ledger rows' issue/PR fate —
   with only 1 real row, that check is trivial tonight (PR #7 confirmed
   merged, issue #6 confirmed closed, both already reflected correctly in
   `LEDGER.md`'s existing `priorFates` text). No action needed.
