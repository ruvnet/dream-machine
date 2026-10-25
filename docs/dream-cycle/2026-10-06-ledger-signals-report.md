# Ledger-Signals SOTA Report — 2026

## TL;DR
`learningSignals()`'s `blockedEvalStreak` field is documented, in its own
source comment, as "majority of the window blocked, **and** last 3 all
blocked" — but the implementation only ever checks the second half of that
conjunction. Three `evaluated: 'blocked'` rows in a row, anywhere at the tail
of a 14-night window, flip `blockedEvalStreak` to `true` even when they are a
small minority (3/14, ~21%) of the window — a false "long blocked streak"
signal that would wrongly steer STEP 1.1's "bias to no-model-call candidates"
guidance on a night where blocked evaluation was the brief exception, not the
rule. Fixed by implementing the majority check the comment already promises.

## What's new
- Root cause: a doc comment describing intended behavior ("majority ... and
  last 3") was never translated into the implementation — the code checks
  only `lastThreeEvals.every(e => e === 'blocked')`, dropping the majority
  clause silently. No test exercises a minority-blocked-tail case, so nothing
  caught the drift between comment and code.
- Blast radius: `blockedEvalStreak` is read by STEP 1.1 of the compiled
  nightly prompt itself (`dream.config.json` → `compile` → this exact text:
  "a long `LLM_EVAL=blocked` streak → prefer no-model-call candidates and say
  so") and by the TUI dashboard. A false positive doesn't corrupt data, but it
  *is* a wrong steering signal fed back into this same self-hosting loop.
- This is the same defect *class* (a `*Streak`/signal field whose implemented
  semantics silently diverge from its documented intent) as two already-fixed
  siblings on this exact surface: #128/#129 (`distinctDatesInWindow` — window
  counted rows, not nights) and #108/#109 (`reviewBacklogSize` — added the
  missing open-vs-merged distinction `zeroMergeStreak` couldn't make). Same
  surface, same module, different field, not a duplicate of either.

## Competitors (how comparable systems gate on a "sustained failure" signal)
| System | Mechanism | Does it require "last-N" alone, or last-N + minimum share of the window? | Grade |
|---|---|---|---|
| Resilience4j `CircuitBreaker` | opens on `failureRateThreshold` computed over a `slidingWindowSize`, with a `minimumNumberOfCalls` floor | rate-over-window, not merely a consecutive-count — explicitly designed to avoid exactly this false-positive class | A — official docs, reproducible from source |
| Netflix Hystrix (predecessor, same lineage) | `errorThresholdPercentage` over a rolling window, with a request-volume floor (`requestVolumeThreshold`) | same rate-over-window design | A — official docs (archived but authoritative) |
| Kubernetes liveness/readiness probes | `failureThreshold` consecutive failures only, no window-share check | consecutive-only (the simpler, *this bug's*, design) | A — official docs; included to show consecutive-only is a legitimate, deliberate design elsewhere, just not what this repo's own comment promises |
| Sakana AI Scientist / OpenHands / SWE-agent / DSPy-GEPA / AutoGPT lineage | none of these expose an analogous cross-run "blocked-evaluation streak" telemetry signal — they log per-run status, not a windowed control-loop signal feeding the next run's planning | not applicable | C — recalled, not re-verified tonight; cited per standing instruction to always consider these competitors |

Takeaway: the two real prior-art designs that *do* exactly what this field's
comment claims (Resilience4j, Hystrix) both pair a consecutive/count
condition with a window-share condition specifically to avoid a brief run of
failures in an otherwise-healthy window reading as a sustained outage. This
repo's own comment already describes that same two-part design; the code
just never implemented the second part.

## Hypothesis (frozen before implementation)
> Given a `LEDGER.md` window (`learningSignals`'s default `window: 14`) where
> exactly the last 3 rows have `evaluated: 'blocked'` and the remaining rows
> in the window do not (i.e. blocked rows are a strict minority of the
> window), when `learningSignals()` computes `blockedEvalStreak`, then the
> **current** implementation returns `true` (a false positive, since 3/14 is
> not "majority of the window blocked" as the field's own code comment
> requires) and the **fixed** implementation should return `false`, while an
> all-blocked window (the existing passing test, 5/5 blocked) and a
> genuine-majority window continue to return `true`, subject to: `npm test`
> stays green, 0 regressions, and the real committed `docs/dream-cycle/LEDGER.md`
> re-evaluated signal output changes only if it was ever actually in this
> false-positive shape (checked live below).

## Candidate
`packages/ledger/src/index.ts` (+11/−1): `learningSignals()`'s `blockedEvalStreak`
computation gains a `blockedCount` tally and an added
`blockedCount * 2 > recent.length` (strict-majority) conjunct, alongside the
existing "last 3 consecutive blocked" check — implementing exactly what the
line's own pre-existing doc comment already promised. `packages/ledger/src/index.test.ts`
(+27): 3 new tests (minority-tail false positive fixed; genuine majority
still flags true; exact 50/50 split correctly stays false). One conceptual
change, pure addition to the test file, 11 changed lines in the
implementation.

## Evaluation Receipt
Real evaluator: `npm test` (`vitest run && npm run test:governance`).

| | Baseline (`main@23a5770`) | Candidate |
|---|---|---|
| vitest | 769 | 772 (+3 new, 0 regressions) |
| governance (`node --test scripts/*.test.mjs`) | 150/150 | 150/150 unchanged |
| `npm run lint` | clean | clean |
| `npm run typecheck` | clean | clean |
| `npm run build` (8 packages) | clean | clean |

Governance is 150/150 clean on both sides this session (this session's
checkout was unshallowed via `git fetch --unshallow` after an initial 3/150
failure traced to `scripts/benchmark-ticket-codec.mjs`'s pinned
`BASELINE_COMMIT` git-show oracle being absent from a shallow clone —
already an open, independent finding tonight's rotation did not select
(PR #150, `security-adversarial`, 2026-10-03), not this candidate's to fix.

Live pre/post-fix repro (`/tmp/repro-blocked.mjs` + `/tmp/repro-majority.mjs`
against the built `packages/ledger/dist/index.js`):
- **Pre-fix**: 11 `yes` + 3 `blocked` (tail) rows in a 14-row window →
  `blockedEvalStreak: true` — a false positive (3/14 ≈ 21%, not a majority).
- **Post-fix**: identical input → `blockedEvalStreak: false`.
- **Post-fix, genuine majority**: 6 `yes` + 8 `blocked` (tail) in a 14-row
  window → `blockedEvalStreak: true` (unchanged from pre-fix — majority case
  was never broken).
- **Real committed ledger**: `dream-machine ledger signals --path
  docs/dream-cycle/LEDGER.md` → `blockedEvalStreak: false` identically before
  and after (this bug is latent — the real ledger's last 14 rows have never
  had a blocked tail — so tonight's fix changes no live signal yet, only
  forecloses a false positive the next time `OPENROUTER_API_KEY` is briefly
  absent for 3 consecutive nights).

## Baseline
Parent commit `23a577082aad39750051dc7ef0ec9d0d72900adf` (`main`, HEAD at
session start), rebuilt clean (`npm ci && npm run build`), 769/769 vitest +
150/150 governance.

## Darwin Lineage
`DARWIN=not-applicable` — a single boolean-expression fix with no evolvable
population to fitness-search over, same judgment this ledger has recorded
for every prior single-conceptual-change candidate on this surface (#116,
#127, #132, #137, #145). Entrypoint probed live tonight: `npx --yes
@metaharness/darwin --version` responds with its usage banner (network
reachable, not blocked). Standing supply-chain note carried forward
unchanged: `evaluatorEntrypoints.darwin` still runs via unpinned `npx`,
resolving registry `latest` on every invocation — not this candidate's to
fix (already an open, disclosed finding from prior nights).

## Evidence
OBSERVATION (the `blockedEvalStreak` line's own doc comment names two
conjuncts; the implementation computes only one) → MEASUREMENT (live pre-fix
repro: 3/14 minority-blocked tail reads `true`) → OBSERVATION (Resilience4j /
Hystrix circuit-breaker docs confirm count-alone vs. rate-over-window is a
known, named false-positive class in comparable "sustained failure" signal
designs) → MEASUREMENT (769→772 vitest, 0 regressions; governance 150/150
unchanged) → MEASUREMENT (live post-fix repro: minority case false, majority
case still true, real committed ledger unchanged) → INFERENCE (independent
critic subagent, separate context, own build/stash cycle) → DECISION
(ACCEPT).

## Reward-Hack Check
Independent adversarial-critic subagent (separate context, own commands,
own `git stash`/rebuild cycle): **CLEAR**.
- Confirmed the diff touches only `packages/ledger/src/index.ts` (+11/−1)
  and its test file (+27/−0, pure addition) — no gold data, evaluator, or CI
  config touched.
- Independently rebuilt and ran the suite before/after via its own
  `git stash`: 769→772 (exactly +3, matching the 3 new tests; no existing
  test deleted, weakened, or had an assertion loosened).
- Wrote its own throwaway probe (independent of this candidate's tests) and
  tried 6 edge cases by hand: exact-half (50/50) correctly false; 8/14
  majority correctly true; majority concentrated at the window *head* with a
  healthy tail correctly false (last-3-contiguous requirement still
  enforced); below-minimum window (`n=2`) correctly false; degenerate `n=3`
  all-blocked correctly true; non-default `window` option correctly rescales
  the majority base rather than hardcoding 14. No counter-example found.
- Grepped the whole repo for `blockedEvalStreak`: the only other reference
  (`packages/cli/src/tui.ts:206`) merely prints a warning string when true —
  no gating/CI/evaluator logic anywhere depends on the old (broken)
  last-3-only semantics.
- Residual non-blocking note from the critic: no test exercises a
  non-default `window` option through `learningSignals` itself end-to-end
  (only through its own ad hoc probe against the built module) — a minor
  coverage gap, not a defect, left for a future night rather than widening
  this single-conceptual-change candidate.

No gold data, threshold, or benchmark corpus touched; no undocumented cache;
no hidden cost (same asymptotic cost — one extra `O(n)` filter over an
already-`O(n)`-sliced window).

## Security Review
No credential, network, or trust-boundary surface added or changed. Pure
local arithmetic/boolean logic over already-parsed in-memory rows. No LLM
calls in this path (`OPENROUTER_API_KEY` present this session, correctly
unused — this candidate required zero model-calling evaluation).

## Regression Analysis
0 pre-existing tests modified or removed (confirmed independently by the
critic via raw diff). 3 new vitest tests added. Lint/typecheck/build clean
across all 8 packages — no wasm/NAPI degradation to record tonight.

## ADR
None — a correctness bug fix aligning an existing field's implementation
with its own pre-existing doc comment, not a new architectural decision.

## Next steps
1. Minor test-coverage gap (critic-flagged, non-blocking): add a
   `learningSignals(..., { window: N })`-level test for the majority
   rescaling, beyond the ad hoc probe used tonight.
2. PR #150 (`security-adversarial`, 2026-10-03, open/draft) already covers
   this session's own independently-rediscovered shallow-clone governance
   failure (`scripts/benchmark-ticket-codec.mjs`'s pinned `BASELINE_COMMIT`);
   not re-filed here.
3. `evaluatorEntrypoints.darwin`'s unpinned `npx` resolution remains a
   standing human pinning decision (flagged again this run; not this
   candidate's to fix).

## Consolidation refresh — 2026-10-25

MODE=CONSOLIDATE (STEP 1.5, ADR-0011): 20 open `dream/*` candidate PRs
tonight, well over `implementationTrack.reviewBacklogLimit=6`. The three
nearer-the-front eligible drafts (#145, #148, #150) each already carry a
`dream-consolidate` marker for today's exact default-branch SHA
(`3fc3222d2e5566a203331d3686c4d2eaf06713a8`) from the three preceding
nights — `main` has not advanced since 2026-10-19 (`#196`), so there is no
new SHA for them to re-consolidate against. This PR was the next-oldest
still-eligible draft (still draft, ACCEPT in its own Evaluation Receipt,
not a `routine-self-review` PR) carrying no prior consolidate marker.

**Action.** Merged `main` (`3fc3222d2e5566a203331d3686c4d2eaf06713a8`) into
this branch with an ordinary merge commit (`9110482`, never rebase, never
force-push). One textual conflict in `docs/dream-cycle/LEDGER.md` (both
sides had appended rows since this branch's 2026-10-06 base) — resolved by
chronological concatenation (this row first, then `main`'s later rows), no
row lost either side. `packages/ledger/src/index.ts` auto-merged clean
against substantial intervening `main` history on the same file (the Dream
Cycle v2 engine landing in `#196`, plus PR `#167`'s `duplicateDirections`
de-dup) — confirmed by grep that `blockedCount`/`blockedEvalStreak`'s
majority conjunct is present, unaltered, in the merged file.

**Re-evaluation on the new head.** Real evaluator (`npm test`): vitest
886→889 (+3, this candidate's own tests, 0 regressions vs. `main`'s own
886), governance 195/195 unchanged, 0 regressions. `npm run
typecheck`/`npm run lint` clean; `npm run build` clean (8 packages, no
wasm/NAPI degradation). `node packages/cli/dist/bin.js ledger verify --path
docs/dream-cycle/LEDGER.md --since-row 38 --legacy-digest
23b02bfa98b56b374fadfb1b05df25e589dcdeab26143ae6183083d21779426a`: OK, 54
rows. Live repro re-run against the rebuilt
`packages/ledger/dist/index.js` on the new head: minority tail (3/14) →
`false`; genuine majority (8/14) → `true`; all-blocked (14/14) → `true`;
exact 50/50 (7/14) → `false` — all unchanged from the original round.

**Fresh critic + reward-hack pass (this round).** No separate subagent
context was available tonight (nested-agent spawning was denied at depth
1), so this pass was run directly by the consolidating session rather than
a fully isolated subagent — disclosed as a real limitation, not papered
over. Diffed the candidate's two files from the PR's original base
(`23a5770`) to the new head: byte-identical to the originally reviewed
diff (`packages/ledger/src/index.ts` +11/−1 candidate lines, test file
pure-additive) — no competing change landed on `blockedEvalStreak` itself
since baseline. Ran 7 of my own adversarial probes beyond the shipped
3 tests directly against the rebuilt dist: empty window (`false`, no
crash), `n=1` blocked (`false`), minimum `n=3` all-blocked (`true`),
custom `window=3/5/6` options correctly rescaling the majority threshold
(`true`/`true`/`false`), and an alternating pattern where majority is
blocked but the tail isn't contiguous (`false`, last-3-consecutive still
enforced). No counter-example found; no gold data, threshold, or test
weakened. **CLEAR.**

**CI on the pushed head.** Green: `guard`, `CodeQL`, `test` (both Node
versions), `no-optional-deps`, `software-evidence`, `dependency-security`.
Red: `dependency-audit` (`npm audit --audit-level=high`) — reproduced
locally against this exact head's lockfile; `git diff main --
package-lock.json` from this branch is empty, so the lockfile is
byte-identical to `main`'s. Same pre-existing, already-tracked `vite`
8.3.0–8.3.2 → `launch-editor` dev-toolchain advisory as issue `#197`
(opened 2026-10-21 by this same consolidation pattern on PR #145, still
open, no fix PR exists yet to port — a semver-range-breaking `vite`/`vitest`
major bump is out of scope for this single-boolean-expression fix). Not
re-filing a duplicate issue; not fixing it from this PR.

**Decision.** ACCEPT still holds and the fresh critic is clear, but not
every required check on the new head is green (`dependency-audit`, for the
reason above) — per STEP 1.5, this PR **stays draft**. Ledger row appended:
`docs/dream-cycle/LEDGER.md` (2026-10-25). Witness below refreshed against
the new session commit.

No merge, no close, no force-push, no self-promotion.

## Gist
`GIST=LOCAL` — no `gh` CLI (`GH_TOKEN` invalid: `gh auth status` fails) and
no gist-creation MCP tool available this session (GitHub MCP access itself
works fine — `get_me`/issue/PR tools succeeded — so `FALLBACK=false`, this is
specifically a gist-API gap). Full report committed at
`docs/dream-cycle/2026-10-06-ledger-signals-report.md`.

## Issue
#153

## Witness

Refreshed 2026-10-25 (consolidation round; supersedes the original-round
triple below, same report file, now bound to tonight's session commit):

```
report_sha256 : 426ff8a119c4df2fefd96e11333e4042818ecb177d5064d7b7336ba370d9b2cf
session_commit: 3fc3222d2e5566a203331d3686c4d2eaf06713a8
witness       : 1ed38f45b8ca7e7d59d1e3345a5978fd18614248e6f830e17c29e2bc5f6af163
```

Original round (2026-10-06), for the record:

```
report_sha256 : 274687e0e453001e7c9fb554a4da77d258a9c3608005f43fb43630618e631305
session_commit: 23a577082aad39750051dc7ef0ec9d0d72900adf
witness       : 907bbf1fb1279c979dca95414c95a12e19e58e4dd6c05070f81f33483ecfdc44
```

Computed over this file's canonical bytes (everything above this heading,
trailing whitespace collapsed to one newline) — reproducible from the
committed file with no unavailable intermediate bytes. Verify the current
round:

```bash
dream-machine witness verify-report docs/dream-cycle/2026-10-06-ledger-signals-report.md --commit 3fc3222d2e5566a203331d3686c4d2eaf06713a8
```
