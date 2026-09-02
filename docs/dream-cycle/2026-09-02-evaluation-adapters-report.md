# Evaluation-Adapters SOTA Report — 2026

**Repo**: `ruvnet/dream-machine` · **Night**: 2026-09-02 · **DEEP**: evaluation-adapters · **SCAN**: flywheel, darwin · **Slot**: 2 (of 5) · **Session commit**: `7933c3599abe22df5290f4609d1f93f598feb3de`

## TL;DR

`dream.config.json`'s `darwin` evaluator entrypoint is unsafe to re-run inside a single
checkout: `npx @metaharness/darwin evolve . --sandbox mock` persists generation/child
ids under `.metaharness/` in the working directory, and a second invocation without
clearing that directory first deterministically fails (`exit 1`,
`already exists: g1_v0`). STEP 5-9 of this repo's own compiled nightly prompt runs an
evaluator at least twice per candidate (parent, then candidate); STEP 0.5's own
"probe what is actually available" instruction invites a discovery-time invocation
too. The fix: reset `.metaharness/` immediately before each invocation, and give the
pipeline's own entrypoint classifier (ADR-0002) a distinct verdict for this failure
mode so it is never mistaken for a broken evaluator or a candidate regression.

## What's new

- Confirmed (fresh, this session) that the darwin entrypoint as committed on `main`
  still has the pre-existing `<repo>` positional bug independently found and fixed
  in open PR #40 (`npx @metaharness/darwin evolve --sandbox mock` swallows
  `--sandbox` as the positional).
- **New finding, not covered by #40**: even the *corrected* command
  (`evolve . --sandbox mock`) is not safely re-invocable in the same checkout.
  Reproduced live, twice, before any fix:
  ```
  $ npx @metaharness/darwin evolve . --sandbox mock   # 1st run
  Winner: g2_v5 ... exit 0
  $ npx @metaharness/darwin evolve . --sandbox mock   # 2nd run, same dir
  Error: darwin: autonomous or generated child id already exists: g1_v0
  exit 1
  ```
- Root cause, read from the vendored package source
  (`@metaharness/darwin@0.10.2`, `dist/evolve.js`): `workRoot` (`.metaharness/`)
  defaults to the current working directory and is not namespaced or reset per
  invocation; the `Archive` guard throws on any id collision.
- `classifyEntrypointResult` (ADR-0002) would file this under the generic
  `blocked` verdict — same bucket as "missing credentials" or "package not
  found" — actively hiding the real cause from STEP 10-14's reward-hack /
  evaluator-reliability check.

## Competitors (context, grade C — informs, does not alone justify)

| Project | Relevant practice | Grade |
|---|---|---|
| Sakana AI "The AI Scientist" | Its own reward-hacking incident (an autonomous loop rewriting its own timeout) is exactly why evaluator-result classification, not just evaluator exit codes, matters — the negative precedent already cited in ADR-0001 §6. | B (public postmortem) |
| SWE-agent | Fresh-container-per-episode execution sidesteps this whole class of stale-state bug; dream-machine's ephemeral nightly checkout does too, but only *between* nights — not within one. | C |
| OpenHands | Sandboxed, disposable per-task containers for eval runs. | C |
| DSPy/GEPA | Optimizer loops assume a re-runnable, idempotent metric function; non-idempotent evaluators are a known failure class in that literature. | C |
| AutoGPT lineage | N/A to this finding. | C |

## Frozen hypothesis (before implementation)

> Given `dream.config.json`'s `darwin` evaluator entrypoint, when the command is
> corrected to include the required `<repo>` positional **and** prefixed with a
> reset of its own persistent working-state directory (`rm -rf .metaharness`),
> then two consecutive invocations of that command in the same checkout should
> both succeed (exit 0), whereas today — both on the as-committed command and on
> a positional-only fix — the second invocation deterministically fails and would
> be misclassified as generic `blocked` by the pipeline's own entrypoint
> classifier. Subject to: no change to the vendored `@metaharness/darwin`
> package; no weakening of `classifyEntrypointResult`'s existing `live` /
> `suspicious-silent` / `blocked` distinctions; `npm test` stays green with 0
> regressions.

## Candidates considered (5, scored 1-5 on fit/novelty/testability/measurability/production-value/reviewability)

| # | Candidate | Fit | Novel | Testable | Measurable | Prod-value | Review | Total |
|---|---|---|---|---|---|---|---|---|
| 1 | **Selected**: reset `.metaharness/` before each darwin invocation + classify the collision distinctly | 5 | 4 | 5 | 5 | 4 | 5 | 28 |
| 2 | Re-fix the `<repo>` positional bug (duplicate #40, already open/unreviewed) | 5 | 1 | 5 | 5 | 3 | 5 | 24 |
| 3 | Add `evaluatorEntrypoints.flywheel` to config (currently unset; package not installed) | 2 | 2 | 2 | 1 | 1 | 4 | 12 |
| 4 | Generalize `EvaluatorEntrypoints` schema with a `resetPaths[]` field, wired through the CLI's exec layer | 4 | 4 | 3 | 3 | 3 | 2 | 19 |
| 5 | Wrap `darwin evolve` in a new `dream-machine darwin run` subcommand that owns state lifecycle end-to-end | 3 | 3 | 3 | 3 | 3 | 2 | 17 |

Candidate #2 scores nearly as high but is explicitly excluded: PR #40 (open,
`mergeable_state: clean`, based on this exact commit) already contains that fix
with its own full receipt trail; re-deriving it here would just be a second
unreviewed PR touching the same line for no new evidence. Candidate #1 is scoped
to not depend on #40 landing first — it independently re-derives the positional
fix as a *prerequisite* (the state-collision bug is unreachable without it) and
is written up to be trivially rebased/deduped against #40 by a human reviewer,
whichever lands first. Candidate #4 was considered as the more "engine-level"
fix (a reusable `resetPaths` primitive per ADR-0001's toolkit philosophy) but
scored lower on reviewability for a zero-merge-streak night — see below — and
was set aside as a natural follow-up if this class of bug recurs for another
entrypoint.

## Learning signals applied (`dream-machine ledger signals`)

```json
{ "zeroMergeStreak": true, "duplicateDirections": [], "lowScoreStreak": false, "blockedEvalStreak": false, "nightsConsidered": 6 }
```

`zeroMergeStreak: true` — no PR opened by this pipeline has merged since #24
(2026-08-26); 7+ candidate PRs since then (#33, #40, #46, #49, #55, #59, #62)
remain open, draft, unreviewed. Per STEP 1.1 this biases selection toward a
tiny, one-parameter, easily-reviewable candidate — reflected in the final
diff size (see Evaluation Receipt) and in explicitly ruling out the
higher-novelty, higher-blast-radius candidate #4 for tonight.

## Evaluation Receipt

**Baseline** (`main` @ `7933c3599abe22df5290f4609d1f93f598feb3de`, this session's
own start state): `npm ci && npm run build` clean. `npx vitest run` → **98/98**.
`npx @metaharness/darwin evolve --sandbox mock` (as committed) — confirmed still
broken (missing positional, per PR #40's own receipt, re-confirmed live this
session via `npx @metaharness/darwin --help`).

**Candidate**: `npm run build` clean (no new type errors). `npx vitest run` →
**102/102** (+4 new tests, 0 regressions). `npm run lint` → clean.

**Live integration receipt** (real invocations, not inferred from logs; darwin
package `0.10.2`, fetched via `npx`, sandbox `mock` — no LLM calls):
```
$ rm -rf .metaharness
$ rm -rf .metaharness && npx @metaharness/darwin evolve . --sandbox mock   # run A
Winner: g2_v5   Delta over baseline: +0.110   exit 0
$ rm -rf .metaharness && npx @metaharness/darwin evolve . --sandbox mock   # run B, same checkout
Winner: g2_v5   Delta over baseline: +0.110   exit 0
$ rm -rf .metaharness && npx @metaharness/darwin evolve . --sandbox mock   # run C
Delta over baseline: +0.110   exit 0
```
Three consecutive real invocations in the same checkout, all live, all exit 0 —
vs. the pre-fix behavior where the second invocation always failed.

## Darwin Lineage (bounded, exploratory — the entrypoint's own internal search, observed as part of verifying the fix, not a search over dream-machine's own promotion criteria)

Default `evolve` invocation (no `--generations`/`--children` override): 10
variants across 3 generations, winner `g2_v5` (`contextBuilder` mutation
surface), `pass=0.80` vs. baseline `pass=0.60`, `safety=1.00` preserved. This
result was reproduced identically across all three runs (deterministic default
seed) — itself corroborating evidence that the state directory, not the search
itself, was the source of the run-to-run failure. No lineage promoted by this
session; darwin's own promotion criteria are internal to the vendored package
and out of scope for tonight's finding.

## Evidence

- OBSERVATION: `npx @metaharness/darwin evolve --sandbox mock` (as committed)
  fails with a positional-arg error, matching PR #40's independently-recorded
  finding.
- OBSERVATION: `npx @metaharness/darwin evolve . --sandbox mock` run twice in
  the same checkout — 1st exit 0, 2nd exit 1, `already exists: g1_v0`.
- INFERENCE: root cause is `.metaharness/`'s persisted generation/child ids
  (confirmed by reading the vendored `evolve.js` source: `workRoot` defaults to
  CWD, `Archive` throws `already exists` on id collision).
- MEASUREMENT: candidate fix (`rm -rf .metaharness &&` prefix) → 3/3 consecutive
  live runs, exit 0 each time; `npx vitest run` 98→102, 0 regressions.
- DECISION: ship the config fix + `.gitignore` entry + a distinct
  `stale-state` classifier verdict (not an ADR — a parameter/config
  correction plus a small, backward-compatible classifier extension, not an
  architectural decision per STEP 19).

## Reward-Hack Check

No benchmark weakened, no gold data touched or exists for this surface, no
cherry-picking (both the pre-fix and post-fix receipts are shown verbatim
above), no evaluator exploit, no hidden cost, no safety/threshold boundary
touched. The new `stale-state` verdict is strictly additive — it narrows an
existing nonzero-exit branch of `classifyEntrypointResult` by pattern (`/already
exists/i`) into a more specific, MORE conservative classification (still a
failure, still non-`live`, exit code 3 vs. the old blanket 1) — it does not
make any previously-`blocked` result read as `live`. Clears
`reward_hack_clear` / `critic_clear`.

## Security Review

Same accepted boundary PR #40 already documents and this repo's 2026-08-13
report first established: `evaluatorEntrypoints` values are repo-committed,
PR-reviewed config, never runtime-attacker-controlled, and `verify-entrypoint`
is operator-invoked only — not wired into the compiled nightly prompt's
automatic execution path. The `rm -rf .metaharness` prefix is scoped to a
single, now-gitignored, package-owned scratch directory name; it does not
touch source, tests, gold data, or anything outside that directory. No
credentials, no LLM calls, no new network surface, no change to
`classifyEntrypointResult`'s `live`/`suspicious-silent` boundary (the
regression tests added in this PR assert the new branch is additive, not a
relaxation).

## Regression Analysis

0 regressions: 98 baseline tests pass unmodified; 4 new tests added (2
classifier-level, 1 CLI exit-code-level, 1 config-contract level); no existing
test touched, weakened, or removed; lint clean; build clean.

## ADR

None — a parameter/config correction plus a small, additive classifier
extension, not an architectural decision (STEP 19 exclusion). If this class of
bug recurs for another `evaluatorEntrypoints` value (candidate #4 above), an
ADR proposing a general `resetPaths` primitive would be the right escalation.

## Gist

LOCAL — no gist-creation tool available this session (no `gh` CLI; GitHub
access this session is via MCP tools scoped to `ruvnet/dream-machine`, which
have no gist-creation capability). Full report retained at
`docs/dream-cycle/2026-09-02-evaluation-adapters-report.md` (committed with
this PR), matching the convention PR #40 already established for the same
constraint.

## Witness

`WITNESS = sha256(sha256(this report) + SESSION_COMMIT)`, computed by
`dream-machine witness stamp` against this file's final committed content.
The specific `report_sha256` / `session_commit` / `witness` values are
recorded in the PR body and the ledger row for this night (not inlined here,
since embedding a hash of this file inside itself would be self-referential).

Reproduce independently (5 steps, coreutils only):

```bash
curl -sL <RAW_URL_OF_THIS_FILE> -o report.md
REPORT_HASH=$(sha256sum report.md | awk '{print $1}')
SESSION_COMMIT=7933c3599abe22df5290f4609d1f93f598feb3de
printf "%s%s" "$REPORT_HASH" "$SESSION_COMMIT" | sha256sum | awk '{print $1}'
# ^ this value MUST equal the published WITNESS
```

## Recommendation

`evaluated: accepted` — human review requested. Draft PR only; the session
never merges or self-promotes. If PR #40 lands first, this PR's redundant
positional-arg line trivially rebases away, leaving only the state-reset +
classifier addition.
