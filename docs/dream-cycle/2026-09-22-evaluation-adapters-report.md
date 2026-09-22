# Evaluation-Adapters SOTA Report — 2026

**Repo**: `ruvnet/dream-machine` · **Night**: 2026-09-22 · **DEEP**: evaluation-adapters · **SCAN**: flywheel, darwin · **Slot**: 2 (of 5, `DAYINT % 5`) · **Bonus moduli**: none (`DAYINT % 25 = 22`, `DAYINT % 75 = 47`) · **Session commit**: `aa931caad5dd0108253645bba0ab1481ad7da0ee`

## TL;DR

`classifyEntrypointResult()` (`packages/cli/src/entrypoint.ts`) is the shared
liveness classifier every configured `evaluatorEntrypoints` value routes
through — `bench` (`npm test`), `darwin`, and any future `flywheel`/`redblue`
entry alike. Its `stale-state` verdict exists for exactly one documented case
(2026-09-02): `npx @metaharness/darwin evolve . --sandbox mock` re-run in the
same checkout fails with `child id already exists`, which is leftover local
state, not a real failure. The regex implementing that carve-out,
`/already exists/i`, matches the bare English phrase anywhere in stderr —
not darwin's message specifically. Reproduced live tonight on baseline
`main@aa931ca`: any unrelated entrypoint failure whose stderr happens to
contain "already exists" (a plausible `bench`/`npm test` assertion message,
e.g. `user 'alice' already exists`) is silently reclassified from a genuine
`blocked` failure into `stale-state`, with pipeline guidance to "clear state
and re-run" — actively encouraging the nightly loop to discard a real
regression signal as benign noise. Narrowed the regex to the actual
documented darwin message shape (`child id already exists`); the one
first-hand repro of that message in this repo (2026-09-02 report) still
classifies `stale-state`; the false-positive case now correctly classifies
`blocked`. `npm test` 785 → 787 (+2 new, 0 regressions). Independent critic:
CLEAR.

Also live-reconfirmed tonight, unblocked (this session's sandbox allowed one
live `npx @metaharness/darwin evolve . --sandbox mock` invocation before
denying further ones — see Scan Findings): the darwin entrypoint itself is
genuinely live end-to-end on current `main`, closing the `EVALUATED=blocked`
gap the 2026-09-17 night (issue #115 / PR #116) could not close from inside
its stricter sandbox.

## What's new tonight

- Independently re-derived the false-positive risk in `STALE_STATE_RE` — not
  flagged by any prior evaluation-adapters night (2026-09-02, 2026-09-07) or
  by PR #116 (2026-09-17), which touched a different part of the same file
  family (a new `verify-entrypoints` execFile-automation command) without
  revisiting this classifier's own precision.
- Live-reproduced the false positive against the *built* baseline dist
  (`classifyEntrypointResult({code:1, stdout:'', stderr:"Error: user 'alice'
  already exists"})` → `stale-state`) before writing any fix — evidence, not
  inference.
- Fresh live confirmation that the darwin evaluator entrypoint (`rm -rf
  .metaharness && npx @metaharness/darwin evolve . --sandbox mock`, exactly
  as configured in this repo's own `dream.config.json`) runs to completion
  with real leaderboard output on current `main` — something PR #116's own
  session could not obtain (`EVALUATED=blocked`, sandbox denied `npx`
  execution outright). A second and third invocation in the same session were
  denied by this session's own execution-permission classifier
  (`[Code from External]`), so this is one successful live receipt, not a
  determinism study — recorded honestly as such, not overclaimed.

## Competitors (none benchmarked against; context only)

| System | Grade | Relevant precedent |
| --- | --- | --- |
| Sakana AI Scientist | C | No public documentation of evaluator-liveness classification distinguishing genuine failure from harness-state leftovers; failures are generally surfaced raw. |
| OpenHands | B | Sandboxed action executor with structured exit-status handling, but no publicly documented equivalent of a "known benign transient state" verdict class. |
| DSPy/GEPA | B | Optimizer loops assume a deterministic, idempotent metric function; the class of bug here (a stateful external tool leaking process state across re-invocations, then that leak being over-broadly pattern-matched away) is largely orthogonal to DSPy's Python-callable evaluation model. |
| SWE-agent | B | Containerized, ephemeral execution environments sidestep cross-invocation state leakage by construction — the underlying darwin bug this classifier works around would not occur in that model at all. |
| AutoGPT lineage | C | Historically broad shell-out surfaces with limited structured result classification; no comparable precedent. |

Hypothesis stands on this repo's own prior finding (2026-09-02) and tonight's
independent re-derivation, not on external benchmarking.

## Hypothesis (frozen before implementation)

> Given `classifyEntrypointResult()` is the shared liveness classifier for
> every configured `evaluatorEntrypoints` value (not just darwin), when a
> non-darwin entrypoint's own real failure stderr happens to contain the
> generic phrase "already exists" for a reason unrelated to darwin's
> generation/child-id collision, then narrowing `STALE_STATE_RE` from
> `/already exists/i` to the darwin-specific `/\bchild id already exists\b/i`
> should make that failure classify as `blocked` instead of `stale-state`,
> subject to: the exact, only first-hand-documented darwin collision message
> (2026-09-02: `"...child id already exists: g1_v0"`) must still classify as
> `stale-state`, and `npm test` stays green with 0 regressions regardless of
> outcome.

## Candidate

+30/−1 across 2 files. One conceptual change: narrow `STALE_STATE_RE` in
`packages/cli/src/entrypoint.ts` from a bare generic phrase match to the
darwin-specific message shape, plus a doc comment explaining why, plus two
regression tests in `entrypoint.test.ts` (one proving the false-positive is
fixed, one proving the true-positive darwin case still classifies correctly
after the narrowing).

## Baseline

Parent commit `aa931caad5dd0108253645bba0ab1481ad7da0ee` (`main`). Fresh
`npm ci && npm run build`: clean (all packages pure TS, no wasm/NAPI
degradation tonight). `npm test`: **785/785** (645 vitest + 140 governance).

## Evaluation Receipt

Real evaluator: `npm test` (this repo's own `bench` entrypoint — vitest +
governance).

| | Baseline (`main@aa931ca`) | Candidate |
| --- | --- | --- |
| Tests | 785 (645 vitest + 140 governance) | 787 (647 vitest + 140 governance) |
| Result | 785 passed | 787 passed, **+2 new, 0 regressions, 0 modified/removed** |

`npm run lint`: clean. `npm run typecheck`: clean.

Live pre/post-fix proof (not inferred from the tests alone): `git stash push
-- packages/cli/src/entrypoint.ts` (keeping only the new test file), re-ran
`entrypoint.test.ts` — the new false-positive regression test **fails**
(`expected 'stale-state' to be 'blocked'`) against the unmodified baseline
regex, confirming it exercises the real bug direction, not a vacuous
assertion. `git stash pop` restored the fix; full file re-ran 9/9 green.

Darwin live receipt (separate from the code candidate; supporting evidence
for tonight's SCAN=darwin, see Scan Findings):
```
$ npx --yes @metaharness/darwin evolve . --sandbox mock
Darwin Mode — leaderboard
  0.875  g2_v5  [contextBuilder]  safety=1.00  pass=0.80 ◀ winner
  ...
Winner: g2_v5
Lineage: baseline → g1_v0 → g2_v5
Delta over baseline: +0.110
Artifacts: /home/user/dream-machine/.metaharness
EXIT=0
```
`git status --porcelain` immediately after: clean (`.metaharness/` is
gitignored). `verify-entrypoint darwin --cmd "rm -rf .metaharness && npx
@metaharness/darwin evolve . --sandbox mock"` → `darwin: live (exit 0) —
produced output`.

## Darwin Lineage

`DARWIN=not-applicable`. A one-line regex narrowing plus two unit tests has
no evolvable population to fitness-search — same precedent set by prior
evaluation-adapters nights (2026-09-02, 2026-09-17) for CLI/classifier-level
changes.

## Evidence

OBSERVATION (`git log`, prior reports under `docs/dream-cycle/`: darwin
positional-arg + idempotency bugs already fixed and merged via #65; PR #116
open/draft/unmerged, touches a different function in the same file) →
OBSERVATION (`classifyEntrypointResult`'s `STALE_STATE_RE` is a bare generic
phrase, shared across all entrypoints) → MEASUREMENT (live repro against
built baseline dist: unrelated "already exists" stderr → `stale-state`,
confirmed by direct function call, not inference from logs) → MEASUREMENT
(785→787 tests, 0 regressions; pre-fix stash proves the new test exercises
the real bug) → INFERENCE (independent critic subagent, separate context) →
DECISION (critic: CLEAR, one non-blocking residual-risk note on message-shape
drift across future darwin versions, recorded below, not fixed — no second
message shape is documented anywhere in this repo to design against) →
DECISION (verdict ACCEPT).

## Reward-Hack Check

Independent adversarial-critic subagent (separate context): diff is additive
plus one regex narrowing, no benchmark/gold data touched (none exists for
this surface), no cherry-picked assertions, no evaluator exploit, no hidden
cost (zero new dependencies, no network call), no undocumented cache, no
unrelated threshold changed. Both new tests assert on the classifier's real
public contract (`verdict`, `reason`), not mocked internals. `reward_hack_clear`
/ `critic_clear`.

## Security Review

`classifyEntrypointResult` never executes anything itself — it only
classifies an already-completed `ExecResult`. Narrowing the regex strictly
*shrinks* the set of stderr strings that can spoof a benign `stale-state`
verdict; it cannot be used by a compromised/malicious entrypoint to newly
evade `blocked` classification (the reverse risk was the one addressed). No
credentials, no LLM calls, no new network or filesystem surface introduced.
Residual, disclosed (not fixed) limitation: `/\bchild id already exists\b/i`
encodes the *only* first-hand-documented darwin message shape in this repo
(2026-09-02); a future `@metaharness/darwin` release could reword its
collision message (e.g. "child ID already in use") and slip through as
`blocked` instead of `stale-state`. This is not a regression — the prior
broad regex was never uniquely targeted at darwin either — and `blocked` is
the fail-safe direction (a real failure gets surfaced, not silently retried),
so it is flagged for future confirmation against a live darwin re-run, not
treated as a blocker tonight.

## Regression Analysis

0 pre-existing tests modified or removed. All 785 baseline tests pass
unchanged; 2 new tests added (one for the false-positive fix, one confirming
the true-positive darwin case survives the narrowing).

## ADR

None — a precision fix to an existing classifier's pattern-match scope,
disclosed and bounded, not a new repo-wide invariant or component category
(STEP 19 exclusion; parameter/pattern tightening is explicitly out of scope
for an ADR).

## Scan Findings

**SCAN=darwin**: root defects (positional-arg, idempotency/state-collision)
remain fixed on `main` since PR #65 (merged 2026-09-02). Tonight adds a fresh
*live* runtime reconfirmation end-to-end (leaderboard output, winner, delta,
exit 0, clean git status) — closing the `EVALUATED=blocked` gap the
2026-09-17 night (#115/#116) reported from inside a stricter sandbox. A
second and third re-invocation in this same session were denied by this
session's own execution-permission classifier
(`[Code from External]`/`[Untrusted Code Integration]`) before a
determinism/repeatability check could be run — recorded as
`DARWIN_REPEAT_CHECK=blocked`, not fabricated.

**SCAN=flywheel**: `evaluatorEntrypoints.flywheel` remains unset;
`npx --yes @metaharness/flywheel` still exits 1 with `npm error could not
determine executable to run` (no `bin` field) — unchanged since 2026-08-13
across six prior nights that checked it. Not a bug in this repo; not
re-attempted as a candidate (external package defect, outside this repo's
control, already assessed low-value across three prior nights).

## Gist

LOCAL — no gist-creation tool (`gh gist create`, or an MCP gist API) is
available in this session; GitHub access here is via MCP tools scoped to
`ruvnet/dream-machine`. Per STEP 17-18, this is not `FALLBACK` — the report
itself is the durable artifact, committed into tonight's PR.

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
SESSION_COMMIT=aa931caad5dd0108253645bba0ab1481ad7da0ee
printf "%s%s" "$REPORT_HASH" "$SESSION_COMMIT" | sha256sum | awk '{print $1}'
# ^ this value MUST equal the published WITNESS
```

## Recommendation

`evaluated: accepted` — human review requested (draft PR, never self-merged,
no `automerge-safe` label applied). **Next steps**:

1. **Confirm darwin collision-message stability across versions.** This
   session could only capture one live darwin invocation before its own
   sandbox began denying further `npx @metaharness/darwin` executions. A
   future night with an unblocked sandbox should re-run the same command
   twice in the same checkout (the exact repro from 2026-09-02) and confirm
   the collision stderr still contains `child id already exists` verbatim —
   the narrowed regex's only failure mode is silent drift in that exact
   phrase across `@metaharness/darwin` releases.
2. **Get PR #116 (2026-09-17, `verify-entrypoints` execFile automation, all
   CI green, awaiting a post-fix re-review) merged or explicitly closed.**
   It has been open, draft, and unreviewed-since-its-fix for 4+ days; it does
   not touch `classifyEntrypointResult` or this candidate's diff and can land
   independently. Not attempted here — merge decisions are human-only.
3. **`LEDGER.md` on `main` is now 15 days stale** (last row 2026-09-07) even
   though `dream/*` branches exist through 2026-09-21 — rows just never merge
   because their PRs stay open. Confirmed via `ledger signals` tonight; not
   this slot's surface (ledger-signals is slot 1), recorded for completeness
   only, consistent with how the 2026-09-17 night handled the same
   observation.
