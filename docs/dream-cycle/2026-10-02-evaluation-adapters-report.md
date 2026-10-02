# Evaluation-Adapters SOTA Report — 2026

**Repo**: `ruvnet/dream-machine` · **Night**: 2026-10-02 · **DEEP**: evaluation-adapters · **SCAN**: flywheel, darwin · **Slot**: 2 (of 5, `DAYINT % 5`) · **Bonus moduli**: none (`DAYINT % 25 = 2`, `DAYINT % 75 = 52`) · **Session commit**: `23a577082aad39750051dc7ef0ec9d0d72900adf`

## TL;DR

`classifyEntrypointResult()` (`packages/cli/src/entrypoint.ts`) is the shared
liveness classifier every configured `evaluatorEntrypoints` value routes
through, including this repo's own `bench` entrypoint (`npm test` →
`vitest run && npm run test:governance`). On a nonzero exit it only ever read
`r.stderr` for its human-readable `reason`, falling back to the literal string
`"exited N with no stderr"` whenever stderr was empty — regardless of what
`r.stdout` contained. Live-confirmed tonight: Node's built-in `node --test`
runner (the real process backing the governance half of `bench`) writes its
**entire** TAP report — including every failure's assertion diff, location,
and stack trace — to stdout, and leaves stderr at 0 bytes, even on a failing,
nonzero-exit run. So the one failure mode this classifier exists to surface
clearly (`blocked`) was, for this repo's own primary evaluator, reporting the
least informative message available ("no stderr") while discarding a fully
detailed diagnostic that was sitting one field away. Fixed by falling back to
`(stdout) <trimmed stdout>` when stderr is empty on a nonzero exit. `npm test`
769→773 vitest (+4 new), 150 governance unchanged, 0 regressions. Independent
critic: CLEAR (one disclosed, non-blocking note on reason-field exposure
scope).

## What's new tonight

- Independently discovered and empirically confirmed (not inferred from
  reading code) that `node --test` — half of this repo's own real evaluator —
  sends 100% of its output, pass or fail, to stdout and 0 bytes to stderr.
  Verified with a throwaway failing test file run both standalone
  (`node --test`) and through `npm run test:governance`.
- This is a different defect, in a different function, from the currently
  open PR #137 (`bin.ts`'s `execFile` catch-block losing `err.message` on a
  *spawn* failure, e.g. `ENOENT`). PR #137's fix does not touch
  `classifyEntrypointResult` and does not change this night's finding: its
  fallback only activates when `err.code` is non-numeric; a normal nonzero
  exit from a completed `npm test` run has a numeric `code`, so PR #137's
  fix is inert for the exact case fixed tonight. Read #137's full diff before
  starting to confirm no overlap.
- Live, real-CLI reproduction through the actual built binary
  (`dream-machine verify-entrypoint`), not just the unit test: pre-fix
  reported `blocked (exit 1) — exited 1 with no stderr`; post-fix reports the
  full TAP failure body, assertion, and stack trace, prefixed `(stdout)`.

## Competitors (none benchmarked against; context only)

| System | Grade | Relevant precedent |
| --- | --- | --- |
| Sakana AI Scientist | C | No public documentation of a dedicated liveness/diagnostic classifier distinguishing which stream carries the real failure reason; failures are generally surfaced as raw combined output. |
| OpenHands | B | Structured action/observation loop with exit-code handling, but no publicly documented per-stream diagnostic-recovery logic for a tool that puts failure detail on stdout instead of stderr. |
| DSPy/GEPA | B | Assumes a deterministic Python-callable metric function with a direct return value, sidestepping the child-process stdout/stderr ambiguity this finding is about entirely. |
| SWE-agent | B | Containerized action execution typically surfaces full combined output to the agent context rather than classifying per-stream, so this specific stdout-vs-stderr information loss would not occur in that model. |
| AutoGPT lineage | C | Broad shell-out surfaces with limited structured result classification; no comparable stream-aware diagnostic precedent. |

Hypothesis stands on this repo's own live reproduction, not on external
benchmarking — the bug is specific to this classifier's contract, not a
general industry pattern.

## Hypothesis (frozen before implementation)

> Given `classifyEntrypointResult()` receives an `ExecResult` from a real
> evaluator-entrypoint failure where the underlying tool (Node's `node --test`,
> the governance half of this repo's own `bench` entrypoint) writes its
> failure diagnostics to stdout and leaves stderr empty, then falling back to
> `r.stdout` (clearly labeled) when `r.stderr` is empty on a nonzero exit
> should surface that diagnostic instead of the current "exited N with no
> stderr", subject to: a failure with real stderr content must produce a
> byte-identical `reason` to today (stdout is never consulted when stderr is
> non-empty); a failure with both streams empty still produces a clear,
> distinct generic message; the existing `stale-state` carve-out (which only
> inspects stderr) is unchanged and runs first; `npm test` stays green with 0
> regressions. Not modified after evaluation began.

## Candidate

`packages/cli/src/entrypoint.ts` (+19/−1) and `packages/cli/src/entrypoint.test.ts`
(+34 new lines, 4 new tests). One conceptual change: a stdout fallback in
`classifyEntrypointResult`'s `blocked` branch, gated strictly behind
`stderr` being empty, plus a slightly broadened both-empty generic message
(`"exited N with no output on either stream"`, was `"...with no stderr"` —
now accurate for both streams, not just one).

```ts
// before:
return {
  verdict: 'blocked',
  code: r.code,
  reason: stderr || `exited ${r.code} with no stderr`,
};

// after:
if (!stderr) {
  const stdout = r.stdout.trim();
  if (stdout) {
    return { verdict: 'blocked', code: r.code, reason: `(stdout) ${stdout}` };
  }
}
return {
  verdict: 'blocked',
  code: r.code,
  reason: stderr || `exited ${r.code} with no output on either stream`,
};
```

## Baseline

Parent commit `23a577082aad39750051dc7ef0ec9d0d72900adf` (`main`, PR #143
already merged — tonight's own ledger row is appended on top of it). Fresh
`npm ci && npm run build`: clean, all packages pure TS, 0 wasm/NAPI
degradation. Initial `npm test` on a shallow checkout showed 3 unrelated
failures in `scripts/benchmark-ticket-codec.test.mjs` (`git show
35c9fd3...:packages/edge-contracts/src/index.ts` — path not in that commit);
confirmed **environmental, not a repo defect**: both `ci.yml` and
`dream-nightly.yml` already set `fetch-depth: 0` specifically for this
"pinned historical codec differential oracle" (their own comment). Ran
`git fetch --unshallow`; baseline then measured clean: **919/919** (769
vitest + 150 governance).

## Evaluation Receipt

Real evaluator: `npm test` (this repo's own `bench` entrypoint — vitest +
governance).

| | Baseline (`main@23a5770`) | Candidate |
| --- | --- | --- |
| vitest | 769 | 773 (+4 new, 0 regressions) |
| governance | 150 | 150 (unchanged) |
| Total | 919 | 923 |
| `npm run typecheck` | clean | clean |
| `npm run lint` | clean | clean |

Live pre/post-fix proof through the real built CLI (not inferred from unit
tests alone):

```
$ node packages/cli/dist/bin.js verify-entrypoint stream-probe --cmd \
    "node --test /tmp/.../stream-check.test.mjs"
# BASELINE (pre-fix):
stream-probe: blocked (exit 1) — exited 1 with no stderr

# CANDIDATE (post-fix):
stream-probe: blocked (exit 1) — (stdout) TAP version 13
# Subtest: intentionally failing to observe which stream node:test writes to
not ok 1 - intentionally failing to observe which stream node:test writes to
  ---
  ...
  error: 'STREAM_PROBE_MARKER\n\n1 !== 2\n'
  ...
```

Stream-separation proof backing the hypothesis itself: `node --test
<failing-file> >out.log 2>err.log` → `out.log` 1040 bytes (full TAP report,
including the failure), `err.log` 0 bytes. Reproduced identically through
`npm run test:governance` on this repo's own real governance suite (27057
stdout bytes, 0 stderr bytes, on a passing run — confirms the pattern holds
for the real entrypoint, not just a synthetic probe).

Darwin entrypoint: **not exercised live tonight** — this session's own
execution-permission classifier denied `npx @metaharness/darwin ...` outright
(`[Code from External]`) on the first attempt, before any invocation
completed. Per the stop-condition policy this is not fabricated and not
worked around (no alternate tool/host/encoding was used to reach the same
outcome); recorded as `DARWIN_LIVE_CHECK=blocked (sandbox policy, not
credentials)` — distinct from `LLM_EVAL`, which was *not* blocked tonight
(`OPENROUTER_API_KEY` present, unused — no LLM-calling evaluator stage was
exercised by this candidate).

## Darwin Lineage

`DARWIN=not-applicable`. A single-branch fallback in one classifier function
has no evolvable population to fitness-search — same precedent as every
other single-conceptual-change night on this surface (#65, #91, #116, #132,
#137).

## Evidence

OBSERVATION (`classifyEntrypointResult`'s `blocked` branch reads only
`r.stderr`) → OBSERVATION (live repro: a deliberately failing `node --test`
file produces 1040 bytes on stdout, 0 on stderr) → OBSERVATION (same pattern
reproduced on this repo's real `npm run test:governance`, 27057/0 bytes) →
MEASUREMENT (pre-fix real-CLI repro: `blocked (exit 1) — exited 1 with no
stderr`) → MEASUREMENT (post-fix real-CLI repro: full TAP diagnostic
surfaced, prefixed `(stdout)`) → MEASUREMENT (919→923 tests, 0 regressions,
4 new) → INFERENCE (independent critic subagent, separate context) →
DECISION (critic: CLEAR, one disclosed non-blocking note — see Security
Review) → DECISION (verdict ACCEPT).

## Reward-Hack Check

Independent adversarial-critic subagent (separate context, full repo read
access): **CLEAR**. Verified via the actual diff (`git diff HEAD`) that the
change is purely additive to `entrypoint.ts` (one new conditional block) and
`entrypoint.test.ts` (four new `it()` blocks); zero existing tests modified,
weakened, or removed. Confirmed the fix checks `r.stderr.trim()` truthiness
generically — not special-cased to any test fixture's literal string — and
that one new test (`'prefers stderr over stdout when both are present'`)
actually *strengthens* the contract (asserts stdout must NOT leak into
`reason` when stderr is present) rather than loosening anything. Confirmed
the only two call sites (`index.ts`'s `verify-entrypoint`/`verify-entrypoints`)
just log `check.reason` and nothing in the repo pattern-matches the exact old
"no stderr" string, so no hidden coupling breaks. No benchmark/gold data
exists for this surface to touch; no evaluator exploit; no hidden cost (zero
new dependencies); no undocumented cache; no threshold changed.
`reward_hack_clear` / `critic_clear`.

## Security Review

`classifyEntrypointResult` never executes anything — it only classifies an
already-completed `ExecResult`; no new network, filesystem, or credential
surface. **Disclosed, non-blocking**: this fix does modestly widen what can
appear in a `blocked` reason — previously only `stderr` content could surface
there; now `stdout` content can too, when `stderr` is empty, with no
truncation or sanitization. This mirrors the trust boundary already applied
to `stderr` in the unchanged branch (same consumer — a human-readable CLI log
line and, via the nightly pipeline, an eventual issue/PR body — same lack of
a size cap), so it is a widening of an existing boundary, not a new class of
exposure. Flagged for the repo owner: if an `evaluatorEntrypoints` command
could ever emit secrets to stdout on failure, that risk now also applies via
this path (it already applied via stderr). No evidence any currently
configured entrypoint (`bench`, `darwin`) does this.

## Regression Analysis

0 pre-existing tests modified or removed. All 919 baseline tests pass
unchanged; 4 new vitest tests added (stdout fallback, stderr-precedence
preserved, both-streams-empty message, stale-state-in-stdout-only scope
documented). `npm run lint` / `npm run typecheck` clean. `npm run build`
clean, no wasm/NAPI degradation to record tonight.

## ADR

None — a diagnostic-completeness fix to an existing classifier's `blocked`
branch, not a new architectural decision or repo-wide invariant. Matches the
precedent of every prior single-file evaluation-adapters fix on this ledger
(#65, #91, #116, #132).

## Scan Findings

**SCAN=darwin**: entrypoint remains correctly `blocked` by
`looksLikeCompoundCommand` when run through `verify-entrypoints` (the
configured value is `rm -rf .metaharness && npx @metaharness/darwin evolve .
--sandbox mock`, a compound command, by design never dispatched — confirmed
live tonight: `bench: live (exit 0)`, `darwin: blocked (exit 1) — compound
command`, both via the real built CLI against the real `dream.config.json`).
A direct, unwrapped live invocation was not obtained tonight — denied by this
session's own sandbox before completion (see Evaluation Receipt). Not the
same gap PR #116/#132/#137 addressed; no code change proposed for this scan
item tonight.

**SCAN=flywheel**: `evaluatorEntrypoints.flywheel` remains unset;
`@metaharness/flywheel` still has no bare `bin` entry point, unchanged since
2026-08-13 across seven prior nights that checked it. Not a bug in this
repo; not re-attempted (external package defect, outside this repo's
control, already assessed low-value repeatedly).

**Ledger-signals cross-check** (not this slot's surface, recorded for
completeness only, same practice as prior nights): `ledger signals --merged
<61 confirmed-merged PR numbers from search_pull_requests>` gives
`zeroMergeStreak=false` (PRs #143, #135, #133, #120, #132, #116 and 55 others
confirmed merged via GitHub ground truth) — the tool's own default (no
`--merged` given) reports the unverified worst-case `true`. `reviewBacklogSize
=6` (open, unmerged `dream/*` candidate PRs: #145, #141, #139, #137, #101,
#98; `#146` is a dependabot PR, not a candidate). `ledgerStale=true`
(`daysSinceLastRow=2`, last row 2026-09-30).

## Gist

`GIST=LOCAL` — no `gh` CLI gist capability or MCP gist-creation tool
available this session (`gh auth status` reports an invalid `GH_TOKEN`;
GitHub access here is via MCP tools scoped to `ruvnet/dream-machine`, which
has no gist API). Per STEP 17-18 this is not `FALLBACK` — this committed
report is the durable artifact.

## Witness

```
report_sha256 : 643ad95981d507ff636d8a14a0525dc59dcff80158f8d4a722414783cdd07272
session_commit: 23a577082aad39750051dc7ef0ec9d0d72900adf
witness       : 29c998e2cef84d47a01469e871f3322d3dc5d7c0622128548b3f276b13c0a57b
```

Computed over this file's canonical bytes (everything above this heading,
trailing whitespace collapsed to one newline) — reproducible from the
committed file with no unavailable intermediate bytes. Verify:

```bash
dream-machine witness verify-report docs/dream-cycle/2026-10-02-evaluation-adapters-report.md --commit 23a577082aad39750051dc7ef0ec9d0d72900adf
```

## Recommendation

`evaluated: accepted` — human review requested (draft PR, never self-merged,
no `automerge-safe` label applied). **Next steps**:

1. **Get PR #137 (2026-09-27, `bin.ts` execFile spawn-diagnostic fix)
   reviewed and merged or closed.** It has been open, draft, CI-green, and
   unreviewed for 5+ days; it does not touch `classifyEntrypointResult` or
   this candidate's diff and can land independently, same surface.
2. **Re-attempt a live, unwrapped darwin invocation under a less restrictive
   sandbox policy** to confirm the entrypoint is still genuinely live
   end-to-end (last first-hand confirmation: 2026-09-22, PR #132's report).
   This session's own execution-permission classifier denied `npx
   @metaharness/darwin ...` outright before any invocation completed —
   recorded honestly as `DARWIN_LIVE_CHECK=blocked`, not worked around.
3. **`LEDGER.md` on `main` is 2 days stale** (last row 2026-09-30) with 6 open,
   unmerged `dream/*` candidate PRs (#145, #141, #139, #137, #101, #98) ahead
   of tonight's — not this slot's surface (ledger-signals is slot 1),
   recorded for completeness only.

