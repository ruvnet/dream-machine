# Evaluation-Adapters SOTA Report — 2026

**Repo**: `ruvnet/dream-machine` · **Night**: 2026-09-07 · **DEEP**: evaluation-adapters · **SCAN**: flywheel, darwin · **Slot**: 2 (of 5, `DAYINT % 5`) · **Bonus moduli**: none (`DAYINT % 25 = 7`, `DAYINT % 75 = 32`) · **Session commit**: `c4c2d8ed94a22fbc5edd77306ce1056793eb3c07`

## TL;DR

Tonight's assigned surface (`evaluatorEntrypoints.darwin`, the exact command
`npx @metaharness/darwin evolve --sandbox mock` in this repo's own
`dream.config.json`) has already been found broken, and independently fixed,
**three separate times** by prior nightly sessions — 2026-08-17 (PR #17,
execFile/shell-injection hardening + `verify-entrypoints`), 2026-08-27 (PR #40,
the missing `<repo>` positional), and 2026-09-02 (PR #65, the resulting
`.metaharness/` state-collision on re-invocation, built explicitly on top of
#40). All three are `state: open`, `draft: true`, `merged: false`. None has
landed. I reproduced the underlying bug fresh, live, against tonight's actual
`main` (`c4c2d8e`) before touching any of this — it is still exactly as broken
as all three reports describe. Shipping a fourth independent fix for the same
two-line config defect would not reduce uncertainty about this repository; it
would only add a fourth conflicting diff to a merge queue that already isn't
clearing. Tonight's contribution is: fresh confirmation the bug is still live
on current `main`, a **new** finding none of the three prior reports flagged
(the as-committed command doesn't just fail loudly — it *exits 0* and silently
writes real artifacts into a bogus `./--sandbox/` directory in the repo working
tree, which `classifyEntrypointResult` currently reports as `live`), a
consolidating review comment on PR #65 (the most complete of the three)
recommending merge order, and a documented **REJECT** of opening a fourth
duplicate fix PR.

## What's new tonight (vs. the three prior evaluation-adapters nights)

- **Fresh live reproduction against `c4c2d8e`** (not inferred from the prior
  reports' logs): `npx --yes @metaharness/darwin evolve --sandbox mock`, run
  from the repo root exactly as `dream.config.json` specifies it today:
  ```text
  $ npx --yes @metaharness/darwin evolve --sandbox mock
  Darwin Mode — leaderboard
    0.875  g2_v5  [contextBuilder]  safety=1.00  pass=0.80 ◀ winner
    ...
  Winner: g2_v5
  Delta over baseline: +0.110
  Artifacts: /home/user/dream-machine/--sandbox/.metaharness
  EXIT=0
  ```
  `git status --porcelain` immediately after: `?? --sandbox/` — a real,
  untracked directory was written into the repo working tree by the
  as-committed evaluator entrypoint. (Directory removed after capturing this
  evidence; not committed.)
- **New angle, not raised by #17/#40/#65**: this run's exit code is **0**, and
  its stdout is non-empty. Run through the existing (unmodified)
  `classifyEntrypointResult` (ADR-0002), that is a `live` verdict — the exact
  verdict a genuinely-correct invocation would also get. The classifier has no
  way to distinguish "ran correctly against this repo" from "silently ran
  against the wrong target and dumped scratch state into the working tree."
  #40 and #65 both document the *second*-invocation failure (`blocked` /
  proposed `stale-state`) in detail; neither flags that the *first*
  invocation's silent misdirection is invisible to the classifier they're
  both extending. This is real, fresh evidence — not a fix, a gap in what the
  existing fixes cover.
- **Confirmed all three fix PRs are now stale relative to `main`**: their base
  SHAs (`8ce3857`, `7933c359`, `7933c359`) sit far behind current `main`
  (`c4c2d8e`); `pull_request_read get_status` on PR #65's head returns
  `total_count: 0` checks — CI never ran on it. None is a one-command rebase
  away from mergeable; a human will need to actually resolve conflicts, not
  just click merge.

## Frozen hypothesis (before any action tonight)

> Given three independently-authored, still-open PRs (#17, #40, #65) already
> contain fixes for `dream.config.json`'s `darwin` evaluator entrypoint
> defect, when the defect is re-reproduced fresh against tonight's actual
> `main` commit, it will reproduce identically to all three prior reports
> (same missing-positional root cause), confirming no fix has landed and a
> fourth independent fix would be pure duplication — subject to: the
> reproduction must be a real, live invocation (not inferred from old logs),
> and the existing `npm test` suite must stay green with 0 regressions
> regardless of whether any code changes ship tonight.

## Candidates considered (5, scored 1–5 on fit/novelty/testability/measurability/production-value/reviewability)

| # | Candidate | Fit | Novel | Testable | Measurable | Prod-value | Review | Total |
|---|---|---|---|---|---|---|---|---|
| 1 | **Selected**: confirm bug live on `main`, withhold a 4th duplicate fix, consolidate via PR review comment | 5 | 4 | 5 | 5 | 4 | 5 | 28 |
| 2 | Re-fix the `<repo>` positional + state-reset directly on `main` (duplicates #40+#65) | 5 | 1 | 5 | 5 | 3 | 2 | 21 |
| 3 | Rebase PR #65 onto current `main` myself and push to its branch | 3 | 2 | 4 | 4 | 3 | 2 | 18 |
| 4 | Add a static (no-exec) compile-time linter rule detecting this exact `npx @metaharness/darwin evolve` positional-arg shape, in `packages/compile/src/supplychain.ts` | 3 | 4 | 3 | 2 | 2 | 3 | 17 |
| 5 | Add `evaluatorEntrypoints.flywheel` to config (still unset; package still has no usable `bin`, unchanged since 2026-08-13/08-17/08-27) | 1 | 1 | 1 | 1 | 1 | 3 | 8 |

Candidate #2 is excluded for the reason stated throughout: it is the same fix
#40/#65 already contain, a third time, with no new evidence to justify
reopening a direction three sessions have already closed. Candidate #3
(rebasing someone else's open PR onto current `main` and force-pushing to
its branch) was considered and rejected: this session did not author #65,
rewriting another PR's branch history is exactly the kind of action reserved
for the PR's own author/a human reviewer, not an unrelated nightly session —
a review comment recommending the rebase is the appropriate-authority
substitute. Candidate #4 (a static positional-arg linter, generalizing the
existing `findUnpinnedNpxInvocations` supply-chain-detector pattern to also
flag missing required positionals for known `npx` tool grammars) is a
genuinely novel, non-duplicate angle and scored respectably, but was set
aside for tonight: it requires hardcoding one specific vendor CLI's argument
grammar (`@metaharness/darwin evolve <repo>`) into a general-purpose compile
step, which the existing supply-chain module deliberately avoids doing for
any single tool; flagged below as a legitimate next-step candidate rather
than implemented under tonight's zero-merge-streak-driven bias toward the
smallest reviewable action.

## Learning signals applied (`dream-machine ledger signals`)

```json
{
  "zeroMergeStreak": true,
  "duplicateDirections": [],
  "lowScoreStreak": false,
  "blockedEvalStreak": false,
  "nightsConsidered": 14,
  "lastRowDate": "2026-09-05",
  "daysSinceLastRow": 2,
  "ledgerStale": true
}
```

`zeroMergeStreak: true` confirmed directly against GitHub tonight (not just
the local ledger): 0 dream-cycle PRs merged since #24 (2026-08-26); ~30 open
draft PRs. `duplicateDirections: []` from the tool is a **false negative** —
the tool only sees `main`'s own `LEDGER.md` (14 rows), and none of #17/#40/#65
ever landed a ledger row there (their rows exist only on their own unmerged
branches). This is itself worth recording as a scan finding (below): the
learning-signals duplicate-detector is blind to rediscovery across unmerged
branches, which is exactly how the same darwin-entrypoint bug got
independently "fixed" three times without any session seeing the prior two.
`ledger verify` also reports 17 structural errors across `main`'s current 14
rows (compound `ACCEPT / REJECT / INCONCLUSIVE` verdicts and `evaluated:
partial` values from earlier portfolio-style nights) — a real, already-tracked
finding (issues #48/#58, PRs #49/#59, also open/unmerged); not re-implemented
tonight for the same reason as the darwin fix (duplicate direction, three
nights deep already: 08-29, 08-31, and referenced again 09-01).

## Testability gate / Evaluation Receipt

**Real evaluator** (`bench: npm test`), baseline = tonight's actual starting
state, `main @ c4c2d8ed94a22fbc5edd77306ce1056793eb3c07`:

```text
$ npm ci && npm run build       # clean, no wasm/NAPI degradation
$ npx vitest run                # 16 files, 491 tests passed
$ npm run test:governance       # node --test scripts/*.test.mjs, 81 tests passed
```
Total: **572/572 tests green** (491 vitest + 81 governance), 0 failures —
this is tonight's real baseline, confirmed before any investigation began.

**Darwin entrypoint, live** (the actual evaluator entrypoint under
`SCAN=darwin`, not a mock): `npx --yes @metaharness/darwin --help` resolves a
real, current package (`evolve <repo> [...] --sandbox real|mock|agent` usage
string) — confirms this is a genuinely live npm package, not a placeholder.
`npx --yes @metaharness/darwin evolve --sandbox mock`, the exact string
`dream.config.json` ships today, reproduces the bug live (see "What's new"
above): exit 0, artifacts silently written to `./--sandbox/.metaharness`, no
sign of anything wrong from the exit code alone.

No code candidate was implemented or shipped tonight (see Reward-Hack Check
and Promotion Gate below for why "implement nothing new, on purpose" is the
evaluated candidate). `EVALUATED=yes` — a real evaluator ran, against a real
live entrypoint, tonight, first-hand.

## Darwin Lineage

Not run as a bounded search tonight — no candidate cleared basic evaluation to
promote into Darwin (STEP 10-14 gate: bounded Darwin only runs "only after
basic evaluation clears"; tonight's evaluated candidate is "ship nothing,"
which has no lineage to evolve). The live `darwin evolve` invocation captured
above is control-plane/evidence-gathering, not a fitness search over this
repo's own promotion criteria — consistent with how all three prior
evaluation-adapters nights (08-17, 08-27, 09-02) also treated it.

## Evidence

- OBSERVATION: `npx --yes @metaharness/darwin --help` usage string, captured
  live tonight — `evolve <repo> [...]` requires a positional `<repo>`.
- OBSERVATION: `npx --yes @metaharness/darwin evolve --sandbox mock` (the
  command exactly as committed in tonight's `dream.config.json`) exits 0,
  writes `./--sandbox/.metaharness/*` into the repo working tree, reproduced
  live against `main @ c4c2d8e`.
- OBSERVATION: PRs #17 (2026-08-17), #40 (2026-08-27), #65 (2026-09-02) each
  independently found and fixed a piece of this same defect; all three remain
  `open`/`draft`/`merged: false`; PR #65's head has 0 recorded CI check runs.
- INFERENCE: a `live` exit-0 verdict from `classifyEntrypointResult` does not
  distinguish this silently-misdirected run from a genuinely correct one —
  a gap not addressed by any of the three existing fixes.
- MEASUREMENT: `npm test` equivalent (vitest + governance) — 572/572 green,
  unchanged from repo state (no candidate shipped, so no delta to measure).
- DECISION: withhold a fourth duplicate fix PR; post a consolidating review
  comment on PR #65 (most complete of the three) recommending merge order;
  record tonight's finding as REJECT (of the "ship another fix" candidate),
  not INCONCLUSIVE (the investigation itself was fully testable and complete).

## Reward-Hack Check (independent-critic framing, self-disclosed — no second agent instance spawned tonight)

Did tonight's candidate ("implement nothing new; consolidate instead") weaken
any benchmark, alter gold answers, cherry-pick, exploit the evaluator, hide
cost, touch a threshold, or rely on an undocumented cache? No — by
construction, since no code shipped, none of these apply to a "ship nothing"
candidate. The one thing an independent critic should press on: is "ship
nothing" itself a reward-hack against the pipeline's own bias toward
producing PRs? No — the compiled prompt's own final operating principle is
explicit that the pipeline is "not a nightly content generator" and that a
rejected hypothesis with a clean measurement is a successful night; shipping
a fourth conflicting diff onto an already-unreviewed queue would actively
work against "making tomorrow's search space smaller," which is the actual
optimization target. `reward_hack_clear` / `critic_clear`.

## Security Review

No new code, no new execution surface, no credentials, no LLM calls tonight.
The live `darwin` reproduction was run directly in a shell for evidence
capture (not through any repo automation path) and its scratch output
(`--sandbox/`) was deleted immediately after capture, never committed. The
underlying security-relevant fact already on record (PR #17/ADR-0003):
`evaluatorEntrypoints` values are repo-committed, PR-reviewed config, never
attacker-controlled — unchanged tonight, nothing new to add.

## Promotion Gate

**ACCEPT requires ALL of**: evaluation_complete ∧ effect_positive ∧
significance_sufficient ∧ no_material_regression ∧ tests_green ∧
reward_hack_clear ∧ critic_clear ∧ witness_valid ∧ receipt_reproducible.
Tonight fails `effect_positive` by construction — there is no candidate
proposing a positive effect; the evaluated proposition ("ship a fourth
duplicate fix") was evaluated and rejected on its merits (duplication, not a
defect in the fix itself). **Verdict: REJECT.** This is a REJECT of tonight's
candidate action, not a claim that the darwin entrypoint bug is fine as-is —
it is not; #17/#40/#65 already carry adequate, unmerged fixes.

## Scan Findings

**SCAN=darwin**: covered in full above.

**SCAN=flywheel**: `dream.config.json#evaluatorEntrypoints` still has no
`flywheel` key (unchanged since 2026-08-13/08-17/08-27's identical finding);
`npx --yes @metaharness/flywheel` still has no bare `bin` entry point. Not a
new finding, not a bug — `EvaluatorEntrypoints.flywheel` is optional by
design (ADR-0001) and this repo's config simply doesn't use it. Recorded for
SCAN completeness only.

**Meta-finding (surfaced by tonight's investigation, not a formal SCAN
dimension)**: `learningSignals().duplicateDirections` cannot see findings
whose ledger rows only exist on unmerged branches — main's `LEDGER.md` has no
row at all for the 08-17, 08-27, or 09-02 evaluation-adapters nights, because
none of their PRs merged. This is the concrete mechanism behind tonight's
triplicate-fix discovery and is worth a future night's attention (e.g.
extending `learningSignals` to also scan open-PR titles/bodies via the GitHub
API, not just `main`'s ledger) — flagged as a next step, not implemented
tonight (would itself be a second, larger candidate competing for the same
tiny-diff budget this zero-merge-streak night is biased toward).

## ADR

None. Tonight's action (confirm + consolidate + withhold) is not an
architectural decision — no new component, interface, or repo-wide invariant
is proposed (STEP 19 exclusion).

## Consolidation action taken

Posted one review comment on PR #65 (`ruvnet/dream-machine#65`) — the most
complete of the three open fixes (explicitly built on top of #40's
positional-arg fix) — summarizing: main is still unfixed as of `c4c2d8e`;
recommended merge order is #65 first (supersedes #40), then #17 separately
(orthogonal execFile/shell-injection hardening, no line overlap); noted PR
#65's head has 0 recorded CI checks and is based on a `main` SHA now dozens
of commits behind current `main`, so a rebase will be needed regardless of
merge order.

## Gist

LOCAL — no gist-creation tool available this session (GitHub access here is
via MCP tools scoped to `ruvnet/dream-machine`, which expose no Gist API).
Report committed instead at
`docs/dream-cycle/2026-09-07-evaluation-adapters-report.md`, matching the
fallback convention every prior evaluation-adapters night already used.

## Witness

Computed via `dream-machine witness stamp` against this file's final
committed bytes and `SESSION_COMMIT=c4c2d8ed94a22fbc5edd77306ce1056793eb3c07`.
Recorded in the PR body and the `LEDGER.md` row for this night (not inlined
here — hashing a file that embeds its own hash is self-referential, the same
issue the 2026-08-13 report first documented working around). Reproduce
independently:

```bash
REPORT_HASH=$(sha256sum docs/dream-cycle/2026-09-07-evaluation-adapters-report.md | awk '{print $1}')
SESSION_COMMIT=c4c2d8ed94a22fbc5edd77306ce1056793eb3c07
printf '%s%s' "$REPORT_HASH" "$SESSION_COMMIT" | sha256sum | awk '{print $1}'
# must equal the WITNESS value published in the PR body and LEDGER.md
```

## Recommendation

`evaluated: rejected` (the "ship a fourth fix" candidate) — human review
requested for the consolidation, not for new code. Concrete next steps for a
human or a future night:
1. Rebase and land PR #65 (supersedes #40's positional fix, adds the
   state-reset + `stale-state` classifier verdict), then separately land PR
   #17 (execFile/shell-injection hardening — no line overlap with #65).
2. Once either lands, extend `classifyEntrypointResult` to catch tonight's
   new finding: an exit-0 run whose stdout mentions an `Artifacts:` path
   outside the invoking repo's own working directory should not classify as
   plain `live` — flagged here, not implemented (would conflict with #65's
   own in-flight `EntrypointVerdict` changes).
3. Extend `learningSignals().duplicateDirections` to also scan open PR
   titles/bodies (via the GitHub API), not just `main`'s own `LEDGER.md`, so
   a fourth night can't independently rediscover this same defect again.
