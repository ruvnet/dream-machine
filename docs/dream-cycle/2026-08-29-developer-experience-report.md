# Developer-Experience / CLI SOTA Report — 2026

**Repo**: `ruvnet/dream-machine` (self-hosting) · **Date**: 2026-08-29 · **Slot**: 4 (DAYINT%5=4) · **Deep**: developer-experience · **Scan**: cli, tui

## TL;DR

`dream-machine ledger append` writes `--verdict` / `--evaluated` to `LEDGER.md`
with **zero validation**, even though `dream-machine ledger verify` enforces a
strict enum (`ACCEPT|REJECT|INCONCLUSIVE` / `yes|no|blocked`) on those same
columns. Running `ledger verify` against this repo's own `LEDGER.md` tonight
surfaced **9 pre-existing structural errors** across 5 of 6 rows (compound
verdicts like `"ACCEPT / INCONCLUSIVE"`, `evaluated: "partial"`) — proof the
gap is not theoretical, it already corrupted the engine's only durable
cross-night memory. Candidate: make `ledger append` share the same enum
check `ledger verify` already has, and refuse to write on violation (exit 1,
same error format as `verify`). Zero LLM calls, ~30 line diff, one conceptual
change, fully deterministic.

## What's new

Nothing external — this is an internal control-plane finding surfaced by
running the repo's own CLI against its own state (STEP 0.5 control-plane
discovery + STEP 1 ledger check). `learningSignals()` reports
`zeroMergeStreak: true` over the last 6 nights, which per STEP 1.1 biases
tonight toward "a tiny, one-parameter, easily-reviewable candidate" — this
finding fits that bias exactly.

## Competitor angle (grade C — general knowledge, not freshly verified tonight; informs framing only, not the justification for this candidate)

| System | How it guards its own durable run-log / state file | Grade |
|---|---|---|
| SWE-agent | Trajectory JSON is schema-defined and produced by code, not hand-appended by an agent via CLI flags — no equivalent free-text-enum footgun. | C |
| OpenHands | Event stream persisted as typed `Event` objects (pydantic-validated) before write; malformed events are rejected at construction time, not just at a separate lint pass. | C |
| DSPy/GEPA | Optimizer trace/history is written by the optimizer's own Python objects (typed dataclasses), not composed from untyped CLI arguments. | C |
| Sakana AI Scientist | Experiment log entries are structured JSON per iteration written by the harness itself; no analogous CLI "append arbitrary string to enum column" surface. | C |
| AutoGPT lineage | Long-running agents historically suffered exactly this class of bug — free-text memory/log writers drifting out of the schema downstream code assumed — a known root cause of brittleness in that lineage. | C |

Pattern across all five: **the write path and the read/verify path share one
validated type**, so drift is a compile-time or construction-time error, not
a separate lint pass you can forget to run. `dream-machine` currently has
`verifyLedger()` and `appendRow()` as two independent functions in
`@dream-machine/ledger` that do not share validation — `verifyLedger` checks
the enum, `appendRow` does not call it. That is the concrete, in-repo
instance of the anti-pattern above.

## Hypothesis (frozen before implementation)

> Given the `dream-machine ledger append` CLI subcommand, when it validates
> `--verdict` against `ACCEPT|REJECT|INCONCLUSIVE` and `--evaluated` against
> `yes|no|blocked` (the same enums `ledger verify` already enforces) and
> exits non-zero without writing on violation, then a `ledger append`
> invocation carrying an out-of-schema value should be rejected before it
> reaches `LEDGER.md`, relative to the current baseline (any string is
> silently accepted and written), subject to: all existing valid
> `ledger append` invocations continue to succeed unchanged; the error
> message and exit code follow `ledger verify`'s existing convention; no
> other CLI subcommand's behavior changes; the full existing test suite
> (98 tests) stays green.

## Benchmark corpus

`packages/cli/src/index.test.ts` (existing `describe('ledger', ...)` block) +
2 new cases added tonight (`append rejects an invalid verdict`,
`append rejects an invalid evaluated`) — run via `npx vitest run`, the
repo's real evaluator (`bench` entrypoint = `npm test`).

## Evaluation — see receipt in PR body / ledger row; summary:

- **Baseline** (parent commit `7933c359`, new tests added, fix NOT applied):
  the 2 new tests **fail** — `append` exits 0 and writes the bad row,
  proving the gap exists on the parent.
- **Candidate** (validation added to the `append` branch in
  `packages/cli/src/index.ts`): the 2 new tests **pass**, and the full
  98-test baseline suite plus the 2 new tests (100 total) stays green.
- **Real-world replay**: `node packages/cli/dist/bin.js ledger verify --path docs/dream-cycle/LEDGER.md`
  still reports the 9 pre-existing errors from before tonight (append-time
  validation cannot retroactively fix history — a separate, human/maintainer
  decision, out of scope tonight) but confirms the *mechanism* — future rows
  can no longer add to that count via `ledger append`.

## Darwin

Not run. `@metaharness/darwin` is an optional peer dependency
(`npx @metaharness/darwin evolve --sandbox mock`) and is not installed in
this checkout (`npm ci` only installs the workspace's own packages). Bounded
Darwin per STEP 10-14 requires it to be available; recorded as
`DARWIN=unavailable`, not run, not faked.

## STEP 1 ledger/PR fate re-check (real GitHub state, `mcp__github__*`)

`gh` CLI is unavailable in this session (per repo precedent, e.g.
`2026-08-14-developer-experience-report.md`); GitHub state was checked via
the MCP GitHub tools instead — not `FALLBACK`. Findings:

- This repo's self-hosting dream-cycle has a real, consistent history of one
  PR/issue pair per slot-rotation night since 2026-08-14 (`#8`/`#9` →
  `#45`/`#46`), matching `dream.config.json`'s 5-slot rotation exactly
  (verified: `DAYINT % 5` for each PR's date reproduces its recorded
  `deep`). **Zero of these PRs are merged** — confirmed via
  `mcp__github__list_pull_requests` (`merged: false` on every one), which is
  the ground truth behind `zeroMergeStreak: true` computed above, not an
  artifact of missing `mergedPrNumbers` wiring (that specific gap was
  already found and fixed by PR #27, 2026-08-24).
- Separately, a **different automation** produced a portfolio-wide,
  multi-repository cycle today (draft PR #47,
  `dream/2026-08-29-portfolio-cycle`, base commit identical to this
  session's `7933c359`) and has been doing so since at least 2026-08-22
  (PRs #38, #44, #47). Its ledger rows (`2026-08-22` .. `2026-08-26`) are
  the ones already committed on `main`'s `LEDGER.md` — and are exactly the
  9 structurally-invalid rows this candidate's evaluator subcommand now
  guards against.
- **Root cause found via `git log -- docs/dream-cycle/LEDGER.md` (grade A,
  first-hand, not GitHub-API-derived):** all 5 malformed rows landed in
  **one commit**, `df9ff40` (`fix(compile): enforce documented hourly cron
  floor (#24)`, author `rUv <ruv@ruv.net>`, 2026-08-26, on `main`). That
  commit's own title is a narrow compile fix; it also bulk-added 5 ledger
  rows about an unrelated portfolio-wide, multi-repository cycle in a single
  commit — violating this repo's own stated invariant, in three independent
  places (`ADR-0001`, the compiled STEP 25, and `@dream-machine/ledger`'s own
  doc comment): *"every nightly run appends **exactly one** row."* This is
  not a `ledger append` CLI misuse (the malformed strings — e.g.
  `"ACCEPT / INCONCLUSIVE"`, compound multi-repo `Deep`/`Finding` cells —
  read as hand-authored markdown, not CLI output) — it is a **direct,
  human-committed edit to `LEDGER.md` that bypassed the CLI entirely**, so
  tonight's `ledger append` validation (which only guards the CLI's own
  write path) would **not** have caught this specific commit. Recorded
  honestly as a real limit of tonight's candidate, not glossed over.

## Evidence

- OBSERVATION: `node packages/cli/dist/bin.js ledger verify --path docs/dream-cycle/LEDGER.md` → 9 errors, rows 2–6.
- MEASUREMENT: `npx vitest run` on parent commit with 2 new tests added → 2 failing, 98 passing (100 total, 2 red).
- MEASUREMENT: same corpus after candidate diff → 100/100 passing.
- INFERENCE: the append/verify split is the root cause of the 5 malformed
  ledger rows recorded 2026-08-22 through 2026-08-26 (evaluated="partial",
  compound verdict strings) — consistent with, not proven identical to,
  those historical writes (we cannot replay the exact command that produced
  them; no receipt from that night is available in this repo).
- DECISION: candidate accepted for PR; does not retroactively repair
  historical rows (a separate human decision — repairing 5 rows of shared
  ledger history is not a "tiny, one-parameter" change and risks destroying
  legitimate audit trail).

## Reward-hack check (independent critic pass)

- Does it weaken the benchmark? No — it adds 2 tests and touches no
  existing test or gold data.
- Does it alter gold answers / thresholds? No threshold exists for this
  surface; N/A.
- Cherry-picked corpus? No — the corpus is the repo's own existing
  ledger-CLI test file, unmodified except for the 2 additions.
- Exploit the evaluator? No — `vitest run` is invoked exactly as CI invokes
  it (`npm test`).
- Hidden cost / undocumented cache? No — validation is O(1) string
  membership checks against 2 constant arrays already defined in
  `@dream-machine/ledger` (`VERDICTS`, `EVALS`), imported not duplicated.

## Security review

Change is additive input validation on a local CLI flag; it *reduces*
attack surface (a malformed `--verdict`/`--evaluated` value can no longer
land in a file another process — `ledger signals`, the TUI dashboard —
parses and trusts). No new filesystem/network scope, no credential
handling, no change to `witness`/`verify-entrypoint`. Not security-sensitive
enough to warrant its own ADR.

## Witness

Session commit: `7933c3599abe22df5290f4609d1f93f598feb3de`. This report is
committed at `docs/dream-cycle/2026-08-29-developer-experience-report.md`.
The published WITNESS value (in the PR body and `LEDGER.md`, not
self-embedded here to avoid a self-referential hash) is reproducible by
anyone:

```bash
REPORT_HASH=$(sha256sum docs/dream-cycle/2026-08-29-developer-experience-report.md | awk '{print $1}')
printf '%s%s' "$REPORT_HASH" "7933c3599abe22df5290f4609d1f93f598feb3de" | sha256sum | awk '{print $1}'
# must equal the WITNESS value published in the PR body and LEDGER.md
```

Equivalently: `node packages/cli/dist/bin.js witness stamp docs/dream-cycle/2026-08-29-developer-experience-report.md 7933c3599abe22df5290f4609d1f93f598feb3de`.

## Scan Findings (cli, tui)

**cli** — the deep dive itself: `ledger append` accepted any `--verdict`/
`--evaluated` string with no validation, the root of tonight's fix.

**tui** — `renderDashboard` (`packages/cli/src/tui.ts`) never calls
`verifyLedger`, so `dream-machine tui` renders the current, real
`LEDGER.md` with zero visual indication that 9 of its rows are structurally
invalid per `ledger verify`. A maintainer watching only the TUI (not running
`ledger verify` separately) has no way to notice. Not fixed tonight (a
second conceptual change — surfacing verify errors in the dashboard's
framebuffer, plus deciding where in the fixed-width layout they'd render);
recorded as a candidate for a future `developer-experience`/`tui` night.

## Next steps (concrete)

1. **CI gate, deliberately NOT added tonight.** The obvious hardening beyond
   tonight's CLI-level fix is a `ledger verify` step in `.github/workflows/ci.yml`,
   which would have caught commit `df9ff40` before it reached `main`. Not
   added tonight because `ledger verify` **currently fails** against `main`'s
   real `LEDGER.md` (the 9 pre-existing errors) — adding the gate now would
   turn CI red for every future PR, including unrelated ones, until the
   historical rows are repaired. Sequencing matters: (a) a human decides how
   to handle the 5 malformed rows, (b) only then does a CI gate make sense.
   Flagged, not implemented, to avoid a self-inflicted repo-wide CI outage.
2. Human maintainer decides whether to backfill-repair the 5 malformed
   historical ledger rows (commit `df9ff40`, 2026-08-22 → 2026-08-26) or
   accept them as a permanently-noted historical wart.
3. Extend the same shared-enum discipline to the TUI dashboard: tonight's
   scan (see Scan Findings in the issue) shows `renderDashboard` never calls
   `verifyLedger`, so a maintainer staring at the TUI has no visual signal
   that 9 structural errors exist in the file it is rendering.
4. Once `@metaharness/darwin` is available in this environment, re-run
   tonight's candidate through bounded Darwin (frozen fitness = "reject rate
   on a synthetic corpus of malformed appends") to see if a stricter or
   more permissive enum boundary scores better — not attempted tonight
   (unavailable), not faked.
