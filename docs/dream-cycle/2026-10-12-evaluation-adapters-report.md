# Evaluation-Adapters SOTA Report — 2026

**Repo**: `ruvnet/dream-machine` · **Night**: 2026-10-12 · **DEEP**: evaluation-adapters · **SCAN**: flywheel, darwin · **Slot**: 2 (of 5, `DAYINT % 5`) · **Bonus moduli**: none (`DAYINT % 25 = 12`, `DAYINT % 75 = 62`) · **Session commit**: `074dcb0058a6ce56383e6cb555f4bb33b7c2257e`

## TL;DR

`evaluateHarnessCandidate()` (`packages/compile/src/harness-optimizer.ts`, PR #30,
"trace driven harness optimizer with held out promotion gates") is this repo's
own flywheel-shaped promotion gate for harness patches — the direct code analog
of the "evaluation-is-not-promotion" discipline SCAN=flywheel exists to probe.
Live-confirmed tonight: a **structurally invalid** patch that declares **zero**
harness surfaces (`patch.surfaces.length === 0`, same class of defect as
declaring *too many* surfaces, which already hard-rejects) is downgraded to
`INCONCLUSIVE` instead of `REJECT` whenever it also happens to lack holdout
evidence — because `'patch has no declared harness surface'` was absent from
the `hardReject` keyword list, so the `inconclusive` (`no holdout evidence`)
branch is checked first and wins. Fixed by adding the missing keyword to the
`hardReject` check — one line, no change to any other classification path.
`npm test` 1001→1004 (+3 new vitest, 0 regressions), lint/typecheck clean.
Independent critic: **CLEAR**, one disclosed non-blocking note (an inaccurate
rationale in my own draft comment about *why* the duplicate-surfaces case
doesn't share this bug), fixed same session.

## What's new tonight

- First test coverage of `evaluateHarnessCandidate`'s severity-ordering logic
  for the zero-declared-surface case; the existing suite (8 tests) never
  combined "no declared surface" with "no holdout evidence" in one candidate.
- Live reproduction against the real built module
  (`packages/compile/dist/harness-optimizer.js`), not inferred from reading
  the source: a patch with `surfaces: []`, one validation-only slice (positive
  delta, no holdout) returned
  `{"verdict":"INCONCLUSIVE","score":0.3999...,"reasons":["patch has no declared harness surface","no holdout evidence"]}`
  pre-fix — a near-passing score (0.4) for a candidate that is not a borderline
  call at all, it is invalid. Post-fix, the identical input returns
  `{"verdict":"REJECT", ...}` with the same reasons, same score.
- Confirmed (first via my own repro, then independently re-confirmed by the
  adversarial critic subagent) that the symmetric *duplicate*-surfaces case
  does **not** share the bug — but for a different reason than I initially
  believed and wrote in my first draft comment: `'duplicate'` is already its
  own, independent `hardReject` keyword (not newly added tonight), unrelated
  to `maxSurfaces`. My first draft claimed duplicates were only saved by
  incidentally also tripping `maxSurfaces`; the critic constructed a
  counter-example (`surfaces: ['tool','tool']`, `maxSurfaces: 2`, so
  `touches more than` never fires) and got `REJECT` anyway, proving the
  `'duplicate'` keyword alone is sufficient and my rationale was wrong. Fixed
  the code comment same session before finalizing.
- Also checked (critic-verified) the `slices.length === 0` early-return branch
  (lines ~142-150) for the same class of bug: it does not have it — that
  branch returns `reasons.length ? REJECT : INCONCLUSIVE` directly, bypassing
  the hardReject/inconclusive split entirely, so any structural-defect reason
  there already forces REJECT.
- `npx @metaharness/darwin ...` / `npx @metaharness/flywheel --help` live
  invocation: `flywheel --help` reproduced the same "could not determine
  executable to run" result recorded on every prior night that checked it
  (unchanged upstream defect, not re-filed). A direct `darwin evolve` live run
  was denied by this session's own sandbox policy before any process
  completed (consistent with 2026-10-02's and 2026-09-27's reports) —
  recorded as `DARWIN_LIVE_CHECK=blocked (sandbox policy, not credentials)`,
  distinct from `LLM_EVAL`, which was **not** blocked tonight
  (`OPENROUTER_API_KEY` present, unused — this candidate needed no model call
  to test).

## Competitors (promotion-gate / holdout-discipline practice; none benchmarked against)

| Project | Relevant practice | Grade |
|---|---|---|
| DSPy/GEPA | Pareto-frontier candidate selection over a frozen validation/holdout split; a candidate with a malformed program structure is filtered before scoring, never scored and then downgraded to "needs more data." | A (official docs/paper — architecturally separates structural validity from statistical significance) |
| OpenHands | Benchmark harness reports pass/fail against a fixed eval set; no published promotion-gate with a severity-ordering between "structurally invalid" and "insufficient evidence." | B (official docs) |
| SWE-agent | Evaluated per-instance against SWE-bench; no autonomous multi-candidate promotion-gate concept at all — a human reads the scores. | C (public docs/commentary) |
| Sakana AI Scientist | Self-reviews/filters generated papers before acceptance, but no published explicit "structural validity must hard-fail regardless of evidence completeness" ordering. | C (secondary literature) |
| AutoGPT lineage | No documented holdout-gated promotion mechanism; broader autonomy, little published evaluation-gate structure to compare against. | C |

No competitor surveyed publishes the exact severity-ordering bug class found
here; this remains a repo-specific correctness fix to an internal module, not
a reproduction of external SOTA.

## Hypothesis (frozen before implementation)

> Given `evaluateHarnessCandidate()` receives a `CandidateValidation` whose
> patch declares zero harness surfaces (`patch.surfaces.length === 0`,
> already flagged via `reasons.push('patch has no declared harness surface')`)
> together with validation slices that lack holdout evidence, when the
> `hardReject` keyword list does not include that structural-invalidity
> reason, then the function currently returns `verdict: 'INCONCLUSIVE'`
> (via the `no holdout evidence` short-circuit) instead of `REJECT`; adding
> `'no declared harness surface'` to the `hardReject` match should make it
> return `REJECT` instead, subject to: a zero-surface patch that *does* have
> holdout evidence must still correctly return `REJECT` (unchanged — already
> works via the generic `reasons.length` fallback); a patch with a
> non-empty, non-duplicate surface set and no holdout evidence must still
> return `INCONCLUSIVE` unchanged (regression check); every other existing
> hardReject/inconclusive/accept classification in the current 8-test suite
> must stay byte-identical; `npm test` stays green with 0 regressions. Not
> modified after evaluation began.

## Candidate

`packages/compile/src/harness-optimizer.ts` (+13/−1, one functional line plus
an explanatory comment) and `packages/compile/src/harness-optimizer.test.ts`
(+31/−0, three new tests, zero existing assertions touched). One conceptual
change.

```ts
// before:
const hardReject = reasons.some((reason) =>
  reason.includes('modifies evaluator') ||
  reason.includes('expands runtime authority') ||
  reason.includes('protected invariant') ||
  reason.includes('security review') ||
  reason.includes('exceeds') ||
  reason.includes('touches more than') ||
  reason.includes('duplicate'),
);

// after:
const hardReject = reasons.some((reason) =>
  reason.includes('modifies evaluator') ||
  reason.includes('expands runtime authority') ||
  reason.includes('protected invariant') ||
  reason.includes('security review') ||
  reason.includes('exceeds') ||
  reason.includes('touches more than') ||
  reason.includes('duplicate') ||
  reason.includes('no declared harness surface'),
);
```

## Baseline

Parent commit `074dcb0058a6ce56383e6cb555f4bb33b7c2257e` (`main`). Fresh
`npm ci && npm run build`: clean, all packages pure TS, 0 wasm/NAPI
degradation. Initial `npm test` on the session's shallow checkout showed 3
failures in `scripts/benchmark-ticket-codec.test.mjs` (`git show
35c9fd3...:packages/edge-contracts/src/index.ts` — not reachable without full
history); confirmed environmental, not a repo defect — the same shallow-clone
git-show-oracle class already tracked by open issue #149/PR #150. Ran `git
fetch --unshallow`; baseline then measured clean: **1001/1001** (806 vitest +
195 governance).

## Evaluation Receipt

Real evaluator: `npm test` (`vitest run && npm run test:governance`), this
repo's own `bench` entrypoint.

| | Baseline (`main@074dcb0`) | Candidate |
|---|---|---|
| vitest | 806 | 809 (+3 new, 0 regressions) |
| governance | 195 | 195 (unchanged) |
| Total | 1001 | 1004 |
| `npm run typecheck` | clean | clean |
| `npm run lint` | clean | clean |

Live pre/post-fix proof through the real built module (not inferred from unit
tests alone):

```
$ node -e "import('./packages/compile/dist/harness-optimizer.js').then(m => console.log(JSON.stringify(
    m.evaluateHarnessCandidate({
      patch: { id: 'bad-patch', sourceTraceIds: ['t1'], surfaces: [], changedLines: 10, rationale: 'x' },
      slices: [{ name: 'validation', split: 'validation', baseline: 0.5, candidate: 0.9, sampleSize: 50 }],
    }))))"
# BASELINE (pre-fix):
{"patchId":"bad-patch","verdict":"INCONCLUSIVE","score":0.3999...,"reasons":["patch has no declared harness surface","no holdout evidence"]}
# CANDIDATE (post-fix):
{"patchId":"bad-patch","verdict":"REJECT","score":0.3999...,"reasons":["patch has no declared harness surface","no holdout evidence"]}
```

Darwin entrypoint (SCAN item, supporting evidence only — not the code
candidate): `npx @metaharness/darwin evolve . --sandbox mock` denied by this
session's own sandbox policy before any process completed —
`DARWIN_LIVE_CHECK=blocked (sandbox policy)`, not fabricated, not worked
around with an alternate tool/host/encoding. `npx @metaharness/flywheel
--help` reproduced "could not determine executable to run", same as every
prior night that checked it.

## Darwin Lineage

`DARWIN=not-applicable` — a one-line classifier-keyword fix with a fixed
input/output contract has no evolvable population to fitness-search, same
precedent as every single-conceptual-change night on this surface (#65, #91,
#116, #132, #137, #148, #156).

## Evidence

OBSERVATION (`evaluateHarnessCandidate`'s `hardReject` keyword list omits
`'no declared harness surface'`) → OBSERVATION (live repro via the real built
module: zero-surface + no-holdout candidate returns INCONCLUSIVE, score
0.3999, pre-fix) → MEASUREMENT (same input returns REJECT post-fix,
identical reasons/score) → MEASUREMENT (1001→1004 tests, 0 regressions,
lint/typecheck clean) → INFERENCE (independent critic subagent, separate
context, adversarial instructions) → DECISION (critic: CLEAR, one disclosed
non-blocking note on an inaccurate code-comment rationale) → DECISION
(comment corrected same session, full suite re-verified green) → DECISION
(verdict ACCEPT).

## Reward-Hack Check

Independent adversarial-critic subagent (separate context, full repo read
access, explicitly instructed to try to break the candidate, not to rubber-
stamp it): **CLEAR**, one disclosed non-blocking note.

What the critic independently verified, empirically:
1. Inventoried every `reasons.push(...)` call site in the file (12 distinct
   reason strings) and confirmed `'no declared harness surface'` is a
   substring of exactly one of them — not overbroad, not accidentally
   matching any other current or plausible reason text.
2. Ran the file's test suite (10/10 pass), then reverted *only* the one-line
   keyword addition while keeping the new tests, and confirmed the new
   "zero surfaces + no holdout" test fails (reports INCONCLUSIVE, not
   REJECT) against the unfixed code — ruling out a tautological test that
   would pass regardless of the fix.
3. Confirmed the diff is purely additive to the test file (+31/−0, zero
   existing assertions touched) and the only functional change is the one
   `||` clause plus its comment — no gold data, threshold, or unrelated test
   touched; no scope creep beyond the single conceptual change.
4. Checked the `slices.length === 0` early-return branch for the same bug
   class and confirmed it is not vulnerable (bypasses the hardReject/
   inconclusive split entirely).
5. **Found and I fixed same session**: my own first-draft code comment
   claimed the duplicate-surfaces case avoids this bug "because it
   independently always also trips `maxSurfaces`" — factually wrong.
   `'duplicate'` was already its own standalone `hardReject` keyword before
   tonight's diff, with no dependency on `maxSurfaces`; the critic proved
   this by constructing `surfaces: ['tool','tool']` with `maxSurfaces: 2`
   (so `'touches more than'` is never pushed) plus no holdout evidence, and
   still got `REJECT`. Corrected the comment to state the true, verified
   reason (zero surfaces simply had no reason string of its own in the
   hardReject list at all, unlike duplicates) before finalizing.

No benchmark/gold data exists for this pure classification function; no
evaluator exploit possible (the function being fixed is not itself an
evaluator, it classifies evaluation results); no hidden cost (no new
dependency); no undocumented cache; no threshold value changed — only a
keyword-match predicate gained one more disjunct. `reward_hack_clear` /
`critic_clear`.

## Security Review

`evaluateHarnessCandidate` is a pure function: no I/O, no process execution,
no credential or network surface, no change in trust boundary. The practical
stakes of this fix are about **promotion-gate correctness**, not exploit
surface: `evaluateHarnessCandidate`/`selectHarnessUpdate` are exported but
currently have **zero call sites** anywhere in `packages/cli` or the compiled
nightly prompt (confirmed via repo-wide grep) — this flywheel-shaped gate is
not yet wired into the pipeline this repo's own STEP 12-14 actually runs. So
tonight's fix has zero live blast radius today; its value is in correctness-
hardening a promotion-gate primitive before it is ever wired up, consistent
with "evaluation-is-not-promotion" — a severity-masking bug in exactly this
kind of gate is the shape of defect that matters most once it is live.
Flagged as Next Step 2 below, not expanded into tonight's single-change
candidate.

## Regression Analysis

0 pre-existing tests modified or removed. All 1001 baseline tests
(806 vitest + 195 governance) pass unchanged; 3 new vitest tests added
(zero-surface+no-holdout now REJECTs, zero-surface+holdout unaffected
regression check, non-empty-surface+no-holdout unaffected regression check).
`npm run lint` / `npm run typecheck` clean. `npm run build` clean, no
wasm/NAPI degradation to record tonight.

## ADR

None — a one-line keyword-classification bug fix to an existing, already-
documented promotion-gate function, not a new architectural decision or
repo-wide invariant. Matches the precedent of every prior single-file
evaluation-adapters fix on this ledger (#65, #91, #116, #132, #137, #148,
#156).

## Scan Findings

**SCAN=darwin**: live invocation denied by this session's own sandbox policy
before completion (see Evaluation Receipt). Not worked around with an
alternate tool/host/encoding; recorded honestly as blocked, consistent with
2026-10-02's and 2026-09-27's reports, which hit the identical sandbox denial.
No code change proposed for this scan item tonight beyond the compound-&&-
chain fix already pending, unmerged, in open PR #156.

**SCAN=flywheel**: `evaluatorEntrypoints.flywheel` remains unset;
`@metaharness/flywheel --help` still reproduces "could not determine
executable to run" (`npm error could not determine executable to run`),
unchanged since 2026-08-13 across 8+ prior nights that checked it. Not a bug
in this repo; not re-filed. Tonight's actual candidate lives in this repo's
*own* flywheel-shaped promotion-gate code (`harness-optimizer.ts`), which is
in scope for this slot and is where the real, fixable, repo-owned defect was
found.

**Ledger-signals cross-check** (not this slot's surface, recorded for
completeness only): ground-truth `search_pull_requests` found 38 `dream/*`
PRs confirmed merged (most recent #167, 2026-10-11 — yesterday), so
`zeroMergeStreak=false`, contradicting the `ledger signals` CLI tool's own
unverified default (`true`, no `--merged` given) — the same known false-
negative pattern flagged on 10+ prior nights. `reviewBacklogSize` ≈ 17 open,
unmerged `dream/*`/maintenance candidate PRs (#98, #101, #137, #139, #141,
#145, #148, #150, #152, #154, #156, #158, #159, #161, #163, #168, #175), 3 of
which (#137, #148, #156) are on this exact evaluation-adapters surface and
were read in full tonight to confirm no overlap with tonight's candidate.
`ledgerStale=false` (`daysSinceLastRow=1`).

## Gist

`GIST=LOCAL` — no `gh` CLI gist capability (`gh auth status` reports an
invalid `GH_TOKEN`) and no gist-creation MCP tool available this session
(GitHub access here is via MCP tools scoped to `ruvnet/dream-machine`, which
expose no Gist API). Per STEP 17-18 this is not `FALLBACK` — this committed
report is the durable artifact.

## Witness

```
report_sha256 : 629f36cde05f01a5b6ad701596285e062614fa8f51c96dbbcc3a81b27f8c36cc
session_commit: 074dcb0058a6ce56383e6cb555f4bb33b7c2257e
witness       : 6fb594bd01e09a8ed25b67833f50601a8b27c772bc202ccce4c84f48b74af9e4
```

Computed over this file's canonical bytes (everything above this heading,
trailing whitespace collapsed to one newline) — reproducible from the
committed file with no unavailable intermediate bytes. Verify:

```bash
dream-machine witness verify-report docs/dream-cycle/2026-10-12-evaluation-adapters-report.md --commit 074dcb0058a6ce56383e6cb555f4bb33b7c2257e
```

## Recommendation

`evaluated: accepted` — human review requested (draft PR, never self-merged,
no `automerge-safe` label applied). **Next steps**:

1. Audit `evaluateHarnessCandidate` for any other reason string that is
   structural (not evidence-dependent) but missing from `hardReject` — tonight
   fixed the one live-reproduced case (zero surfaces); a fuller systematic
   audit of every `reasons.push(...)` site against the hardReject list is
   useful future work, not expanded into tonight's single-conceptual-change
   candidate.
2. `evaluateHarnessCandidate`/`selectHarnessUpdate` are exported but have
   zero call sites anywhere in `packages/cli` or the compiled nightly
   prompt — this flywheel-shaped promotion gate is not yet wired into the
   pipeline STEP 12-14 actually runs. Out of scope to wire up tonight (would
   not be a single conceptual change); flagged for a future compiler-parity
   or evaluation-adapters night, and is the reason tonight's fix, while
   correct, currently has zero live blast radius.
3. PRs #137 (bin.ts execFile spawn diagnostics), #148 (classifyEntrypointResult
   stdout fallback), and #156 (darwin's own `&&`-chain classification) remain
   open/draft on this same evaluation-adapters surface, read in full tonight,
   no overlap with this candidate's file (`harness-optimizer.ts` is untouched
   by any of them) — get them reviewed/merged.
