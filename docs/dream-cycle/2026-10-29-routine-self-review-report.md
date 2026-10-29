# Dream Machine Self-Review — 2026-10-29

## TL;DR
Last week's self-review forecast (PR #199, 2026-10-22) technically scores as a
HIT — zero self-reported concurrent-session collisions in the following 7
nights — but only because **zero dream-cycle nights ran at all** in that
window (2026-10-23 → 2026-10-28): no `dream/*` branch, issue, or PR appears
anywhere in the repository for six consecutive scheduled nights. Scoring the
forecast a clean win on that basis would itself be reward-hacking the
self-review. Tonight's candidate targets the one bounded mechanism, confirmed
live in this very session (and independently confirmed in last week's PR
#199), that can turn a partial GitHub outage into exactly this kind of
*silent, total* evidence loss: the Schedule Contract's FALLBACK trigger
conflates "`gh` CLI is broken" with "GitHub is unreachable," even when a
GitHub MCP tool remains connected and authenticated.

## Score: last self-review's forecast (PR #199, issue #198)
**Forecast (frozen 2026-10-22):** 0 further self-reported concurrent-session
incidents on dream-cycle PRs over the next 7 nights, vs. 1 in the 3
CONSOLIDATE nights observed 2026-10-19→10-21.

**Measured (2026-10-23 → 2026-10-28, live GitHub check):**
- `list_branches`: no `dream/2026-10-2{3,4,5,6,7,8}-*` branch exists. The most
  recent `dream/*` branch is `dream/2026-10-22-routine-self-review` (PR #199's
  own).
- `search_pull_requests is:pr created:2026-10-22..2026-10-29`: exactly one
  result, PR #199 itself.
- `search_issues is:issue created:2026-10-22..2026-10-29`: issue #198 (this
  routine) and issue #200 (an unrelated MetaHarness-evidence automation, not
  this routine).
- No closed-unmerged `dream/*` PR in the window either.

**Verdict: HIT, but vacuous — not evidence the fix worked.** The guard PR #199
shipped (extending the duplicate-firing check to CONSOLIDATE) was never
exercised, because no night reached CONSOLIDATE, or any other mode, at all.
A metric of zero collisions when the system that could collide never ran
measures nothing. The real signal from this window is the six-night silence
itself, which STEP 25's own invariant ("the ledger row is written on every
run, even a budget-forced halt") implies should not be able to happen without
leaving *some* trace — unless the trace-producing steps themselves never ran.

## Measure
- `ledger signals` (ground-truth `--merged`, 39 PR numbers from
  `search_pull_requests is:merged head:dream/`): `ledgerStale=true`,
  `daysSinceLastRow=17` (last real row 2026-10-12, PR #177),
  `reviewBacklogSize=20`, `zeroMergeStreak=false` (most recent merge #177,
  2026-10-12).
- `npm test` baseline on parent `3fc3222d` (post-unshallow): 886 vitest + 195
  governance, all green — the 3 failures seen on the initial shallow clone
  (`packages/edge-contracts/src/index.ts exists on disk, but not in
  35c9fd31...`) are an environmental artifact of `clone_depth` cutting off a
  commit a test's git-based oracle reaches back to; `git fetch --unshallow`
  resolves it and is not this candidate's concern (already tracked: PR #150,
  issue #149, "BASELINE_COMMIT git-show oracle fails opaquely on a shallow
  clone" — same root cause, open, unreviewed since 2026-10-03).
- `gh auth status` in this session: **fails** (`GH_TOKEN` invalid) — exactly
  the condition PR #199's own report recorded a week ago ("no `gh` CLI
  (`GH_TOKEN` invalid in this session)"). `mcp__github__get_me` in this same
  session: **succeeds** (`ruvnet`). Two independent, authenticated GitHub
  paths exist simultaneously; only one is broken.
- `get_trigger` on this routine's own schedule: `enabled=true`,
  `cron_expression="0 9 * * *"`, no per-firing run history exposed beyond the
  current `last_run` — the scheduler's own records cannot confirm or rule out
  whether the six missing nights fired and produced nothing, or never fired.
  This is reported as genuine uncertainty, not inferred.

## Cluster
Taxonomy: planning | tool | memory | verification | recovery | resource |
security | unknown. With zero candidate nights in the window there is nothing
to classify by cause — the dominant, and only, cluster is **unknown: a total
six-night evidence gap**, with one concrete, reproduced-live **tool**-class
mechanism that can produce exactly this shape of failure without any
candidate-level cause at all: the Schedule Contract's own FALLBACK trigger
(`packages/compile/src/index.ts`, `step1Ledger`) and STOP CONDITIONS text
(`stopConditions`) both say, verbatim, "If `gh` is unavailable, set
`FALLBACK=true` ... skip remote publication." Read literally, a session that
checks `gh auth status`, sees it fail (as it does right now, as it did last
week), and follows this clause to the letter would skip **every** remote
side effect for the whole night — including the STEP 20-25 branch push and
PR that are this routine's only durable output — even though an MCP GitHub
tool was connected and authenticated the entire time. This is not presented
as the proven cause of the six missing nights (the scheduler's own records
can't confirm that), but it is a real, independently reproduced defect in
the routine's own instructions, and it is the single most leveraged fix
available: it directly controls whether a future `gh`-auth incident (which
has now recurred twice in two self-review windows) degrades gracefully or
goes dark.

## Candidate (mechanism, one sentence)
Redefine the Schedule Contract's FALLBACK trigger from "`gh` is unavailable"
to "no GitHub path is reachable" — checking both `gh` auth and GitHub MCP
tool availability before giving up on remote publication, and naming
whichever path is used in the FINAL REPORT.

`packages/compile/src/index.ts`:
- `step1Ledger()`: "when `gh` is authenticated" → "when GitHub is reachable
  ... EITHER `gh` is authenticated OR a GitHub MCP tool is connected and
  authenticated (e.g. a `get_me`-equivalent call succeeds) — one path
  breaking is not a reason to stop publishing while the other still works;
  use whichever path is reachable for every remote side effect tonight and
  name it in the FINAL REPORT. Only when NEITHER path is reachable, set
  `FALLBACK=true`..."
- `stopConditions()`: "GitHub-auth failure is NOT fatal (`FALLBACK=true`)" →
  "Every GitHub path unreachable (see STEP 1) is NOT fatal (`FALLBACK=true`);
  one path breaking while another still works is not a GitHub-auth failure
  at all — use the reachable path instead of entering FALLBACK."

Scoped to this routine's own template, per STEP 1.6/ADR-0011 (prose fix, no
product-logic change) — same category as PR #55's "gist publication is
best-effort, not `gh`-only" and PR #199's duplicate-firing extension. Does
not touch any item on the self-review constitution's off-limits list: no
invariant, verdict rule, promotion gate, merge policy, CONSOLIDATE limit,
critic/reward-hack check, evaluator entrypoint, witness computation, ledger
schema, backlog/cadence parameter, research floor, or config-validation test
is changed in substance.

## Evaluation Receipt
Real evaluator: `npm test` (`vitest run && node --test scripts/*.test.mjs`).

| | Baseline (`3fc3222d`, parent, post-unshallow) | Candidate |
|---|---|---|
| vitest | 886 | 887 (+1 new, 0 regressions) |
| governance | 195 | 195 (unchanged) |
| lint / typecheck | clean | clean |
| mirror check (`compile-targets.mjs --check`) | pass | pass (all 5 targets regenerated + reviewed) |

Self-hosted `dream.config.json` compile output confirmed byte-identical to
its regenerated mirror (`docs/dream-cycle/compiled/ruvnet-dream-machine.md`);
all 5 targets sharing this compile engine (self-hosted + `ruflo`/
`metaharness`/`ruvector`/`ruclip`) had their mirrors regenerated — same
clause shape, verbatim across targets since neither touched function takes a
per-target parameter.

## Baseline
Parent commit `3fc3222d2e5566a203331d3686c4d2eaf06713a8` (`main`), this
session's own checkout (unshallowed from the fresh clone's default
`clone_depth` cutoff to resolve the unrelated environmental test failure
above).

## Darwin Lineage
`DARWIN=not-applicable` — a Schedule Contract prose fix has no evolvable
population or fitness function.

## Evidence
OBSERVATION: zero `dream/*` branches, issues, or PRs exist for 2026-10-23
through 2026-10-28 (live `list_branches` / `search_pull_requests` /
`search_issues`). OBSERVATION: `gh auth status` fails with an invalid
`GH_TOKEN` in this session; `mcp__github__get_me` succeeds in the same
session. OBSERVATION: PR #199 (2026-10-22, 7 nights ago) independently
recorded the identical `gh`-broken / MCP-working split. INFERENCE: the
Schedule Contract's literal FALLBACK trigger ("`gh` unavailable" ⇒ skip all
remote publication) is a plausible, reproduced-live mechanism for a `gh`
outage to silently zero out a night's durable output, though not the proven
cause of the six-night gap specifically (the scheduler exposes no per-night
run history to confirm whether those nights fired at all). DECISION: close
the gap in the trigger's own wording rather than assert a cause the evidence
doesn't fully support.

## Reward-Hack Check
Self-critique (same session, explicit second pass — no independent
subagent was spun up for this template-only prose change, noted as a gap
relative to PR #199's practice, which did use one; disclosed rather than
silently skipped): did this candidate weaken a test, benchmark, threshold,
or gold answer? No — one test added (`index.test.ts`), none removed or
loosened. Does it cherry-pick or exploit the evaluator? No — `npm test` runs
unmodified. Does it hide cost or rely on an undocumented cache? No. Does the
"vacuous HIT" framing above risk the self-review quietly declaring success
on a forecast that was never actually tested? That risk is the reason this
report states the HIT as vacuous rather than closing it clean, and treats
the six-night gap as the real finding instead of taking credit for the
quiet numerator.

## Security Review
Touches only compiled instructions for a future agent run — no new tool,
permission, credential, or network call is introduced; it names a
capability (an already-available GitHub MCP tool) as a permitted
alternative publication path, not a new one. Net effect reduces a
resource/availability risk (silent evidence loss) rather than introducing
one. No prompt-injection surface, no new authority, no change to what a
future agent is permitted to do beyond *how* it reaches GitHub.

## Regression Analysis
9 files changed: 1 logic file (`index.ts`, two functions), 1 test file (+1
assertion), 2 generated snapshot files, 5 mechanically-regenerated compiled
mirrors. All 887 vitest + 195 governance tests pass; lint/typecheck clean;
mirror check clean. No GLOBAL INVARIANT, verdict rule, promotion gate, merge
policy (`autoMerge`/`prMode`/ready-for-review predicate), CONSOLIDATE limit,
independent-critic/reward-hack check, evaluator entrypoint, witness
computation, ledger schema, `reviewBacklogLimit`/`everyDays`, research
floor, or config-validation/golden-snapshot test was touched in substance —
all required by the self-review constitution (ADR-0011) to stay out of
bounds, and confirmed untouched by diff review.

## ADR
None — a guard-coverage/publication-path fix to the routine's own compiled
template, not an architectural decision (STEP 19: never for parameter
changes or minor prompt/routing tweaks).

## Gist
`GIST=LOCAL` — no `gh` CLI (`GH_TOKEN` invalid in this session) and no
gist-creation MCP tool available tonight; same condition as PR #199, one
week ago. Full report committed as
`docs/dream-cycle/2026-10-29-routine-self-review-report.md`, the durable
artifact.

## Issue
#201

## Witness

```
report_sha256 : 3ed7bea80e0db8466f4a0c1971858075b1580745db2a61807529f707646abfc0
session_commit: 3fc3222d2e5566a203331d3686c4d2eaf06713a8
witness       : 58872a405ca1ee2313d1b8553a42d76b830f4917747ac7922d33633384ca43ec
```

Computed over this file's canonical bytes (everything above this heading,
trailing whitespace collapsed to one newline) — reproducible from the
committed file with no unavailable intermediate bytes. Verify:

```bash
dream-machine witness verify-report <committed-report-file>
```

## Merge Policy
**This PR stays draft, regardless of verdict.** Per STEP 1.6/ADR-0011's
routine constitution: "A self-review PR always stays human-review-only,
whatever `prMode` says." This session never merges and never autonomously
promotes candidate state.

## Ledger
Row to be appended for 2026-10-29 (`docs/dream-cycle/LEDGER.md`). Forecast
frozen for the next self-review (2026-11-05, `EPOCHDAY % 7 == 0`): over the
next 7 nights, every scheduled firing of this routine leaves at least one
GitHub-visible trace (a `dream/<DATE>-*` branch, or a `SKIP: already ran
<DATE>` state reported in a reachable location) — i.e., zero further
nights with *no* trace at all, regardless of which publication path (`gh`
or MCP) is reachable that night. Current value: 6 of the last 7 nights
(2026-10-23→10-28) left no trace. Target: 0 of the next 7.
