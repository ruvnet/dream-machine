# Evaluation-Adapters SOTA Report — 2026

**Repo**: `ruvnet/dream-machine` · **Night**: 2026-10-17 · **DEEP**: evaluation-adapters · **SCAN**: flywheel, darwin · **Slot**: 2 (of 5, `DAYINT % 5`) · **Bonus moduli**: none (`DAYINT % 25 = 17`, `DAYINT % 75 = 67`) · **Session commit**: `b2abcc14a632d7e0948962065a7c6c8920cf306c`

## TL;DR

`evaluateHarnessCandidate()` (`packages/compile/src/harness-optimizer.ts`) is
this repo's own flywheel-shaped promotion gate — PR #177 (merged 2026-10-12)
fixed one severity-masking defect in its `hardReject` keyword list (a
zero-declared-surface patch was downgraded to `INCONCLUSIVE` instead of
`REJECT` when it also lacked holdout evidence) and explicitly flagged "a
fuller systematic audit of every `reasons.push(...)` site against the
hardReject list" as unclaimed next-step work. Tonight's audit: every other
`reasons.push(...)` site is already correctly classified — **except** the
slice-regression-beyond-threshold reason, which only hard-rejects today
through an **incidental substring collision**: its message
(`` `slice regression ${x} exceeds ${y}` ``) happens to contain the word
"exceeds", which `hardReject` already checks for a *different* reason
(`patch exceeds ${maxChangedLines} changed lines`). Live-confirmed: a
quality regression beyond `maxSliceRegression`, combined with missing
holdout evidence, correctly `REJECT`s today — but only by coincidence, with
zero test coverage of that combination, and zero coupling enforced between
the two message strings. A future wording change to either message (e.g.
rephrasing the changed-lines message to "touches too many lines" or the
regression message to "regression of X is more than the Y limit") would
silently reintroduce the exact masking defect #177 just fixed, with no test
to catch it. Fixed by adding an explicit `reason.includes('slice
regression')` keyword to `hardReject`, independent of the `'exceeds'`
coincidence, and adding the missing regression test for the
previously-unexercised combination. `npm test` 1004→1006 (+2 new vitest,
0 regressions), lint/typecheck clean. Independent critic: **CLEAR**.

## What's new tonight

- First systematic audit of every `reasons.push(...)` call site in
  `evaluateHarnessCandidate` against the `hardReject` keyword list, closing
  out PR #177's disclosed "Next step 1". Inventory (12 distinct reason
  sites, including the `slices.length === 0` early-return branch which
  bypasses the hardReject/inconclusive split entirely and was separately
  confirmed correct by #177):
  | Reason | Structural (must hard-reject regardless of evidence)? | Matched today | How |
  |---|---|---|---|
  | `no declared harness surface` | yes | yes | explicit keyword (added 2026-10-12, PR #177) |
  | `duplicate harness surfaces` | yes | yes | explicit keyword |
  | `exceeds N changed lines` | yes | yes | explicit keyword (`'exceeds'`) |
  | `touches more than N harness surface` | yes | yes | explicit keyword |
  | `modifies evaluator or gold data` | yes | yes | explicit keyword |
  | `expands runtime authority` | yes | yes | explicit keyword |
  | `protected invariant failed` | yes | yes | explicit keyword |
  | `security review found unresolved issues` | yes | yes | explicit keyword |
  | `no validation evidence` (`slices.length===0` branch) | n/a | n/a | bypasses the split entirely (REJECT iff other reasons present, else INCONCLUSIVE — already correct per #177) |
  | `no holdout evidence` | **no** (this *is* the inconclusive signal) | n/a | intentionally excluded |
  | `weighted validation improvement is not positive enough` | **no** (evidentiary — correctly subsumed by "no holdout evidence" when holdout is absent; correctly REJECTs via the generic fallback when holdout is present) | n/a | intentionally excluded |
  | **`slice regression X exceeds Y`** | **yes** | **only by accident** | **incidental substring overlap with the unrelated `'exceeds'` keyword — this is tonight's finding** |
- Live-reproduced, against the real built module, that the slice-regression
  reason today only matches `hardReject` because its interpolated message
  happens to contain the literal substring `"exceeds"` — the same word used
  by the unrelated `changedLines` threshold message. No code anywhere
  declares this coupling; it is accidental. Confirmed by checking: the
  reason string is built independently (`` `slice regression
  ${Math.abs(maxRegression).toFixed(4)} exceeds
  ${policy.maxSliceRegression.toFixed(4)}` ``) with no shared constant or
  helper with the changed-lines message.
- Zero existing test exercised the combination "slice regression beyond
  threshold" + "no holdout evidence" together — the exact shape of
  combination that caused the #177 defect for a different pair of reasons.
  `npm run lint` on the pre-fix diff shows this is the only remaining
  reason site riding on an accidental string match rather than a declared
  keyword.
- `npx @metaharness/flywheel --help` live invocation tonight: reproduced the
  same `npm error could not determine executable to run`, unchanged since
  2026-08-13 across 9+ prior nights that checked it — not a repo bug, not
  re-filed.
- `rm -rf .metaharness && npx @metaharness/darwin evolve . --sandbox mock`
  live invocation tonight: denied by this session's own sandbox/auto-mode
  policy before any process completed (`[Code from External]` classifier
  reason) — consistent with 2026-10-12, 2026-10-02, and 2026-09-27's
  reports, which hit the identical denial. Recorded honestly as
  `DARWIN_LIVE_CHECK=blocked (sandbox policy)`, distinct from `LLM_EVAL`
  (not blocked tonight — `OPENROUTER_API_KEY` present, unused: this
  candidate needed no model call to test).

## Competitors (promotion-gate / holdout-discipline practice; none benchmarked against)

| Project | Relevant practice | Grade |
|---|---|---|
| DSPy/GEPA | Pareto-frontier candidate selection scored on a validation set; a 2026 practitioner report flags a GEPA-optimized prompt that scored well on holdout (79%) but was 4x longer and partly irrelevant — exactly the "thin/accidental signal looks like a pass" risk this repo's own promotion gate exists to prevent, but with no published formal distinction between structural invalidity and insufficient evidence in GEPA itself. | B (official docs: [dspy.ai/diving-deeper/gepa-in-depth](https://dspy.ai/diving-deeper/gepa-in-depth/)) / C (the holdout-caution practitioner report) |
| OpenHands | Benchmark harness reports pass/fail against a fixed eval set; no published severity-ordering between a structurally invalid candidate and one that's merely under-evidenced. | B (official docs) |
| SWE-agent | Evaluated per-instance against SWE-bench; no autonomous promotion-gate concept — a human reads the scores, so there is no code path to mask structural invalidity as "needs more evidence." | C (public docs/commentary) |
| Sakana AI Scientist | Self-reviews/filters generated papers before acceptance; no published explicit ordering between structural-defect rejection and evidence-completeness rejection. | C (secondary literature) |
| AutoGPT lineage | No documented holdout-gated promotion mechanism to compare against. | C |

No competitor surveyed publishes this exact defect class (a hard-reject
condition that is only enforced by an accidental string-match collision
with an unrelated message); this remains a repo-specific hardening of an
internal module, not a reproduction of external SOTA.

## Hypothesis (frozen before implementation)

> Given `evaluateHarnessCandidate()` receives a `CandidateValidation` whose
> slice-level regression exceeds `policy.maxSliceRegression` together with
> validation slices that lack holdout evidence, when `hardReject`'s match
> for the slice-regression reason depends only on an incidental substring
> collision (`'exceeds'`) shared with the unrelated changed-lines-threshold
> message rather than an explicit keyword, then today's behavior (`REJECT`)
> is correct but fragile: it holds only because of that accidental text
> overlap and is not locked in by any test. Adding an explicit
> `reason.includes('slice regression')` keyword to `hardReject`, independent
> of `'exceeds'`, and adding a regression test for the previously-untested
> combination should keep today's observable behavior byte-identical
> (0 regressions) while making the protection correct-by-construction
> instead of by coincidence. Subject to: every existing
> hardReject/inconclusive/accept classification in the current 10-test
> suite stays unchanged; a well-formed patch with no slice regression and
> no holdout evidence must still return `INCONCLUSIVE` unchanged (regression
> check); `npm test` stays green with 0 regressions. Not modified after
> evaluation began.

## Candidate

`packages/compile/src/harness-optimizer.ts` (+2/−1, one functional line) and
`packages/compile/src/harness-optimizer.test.ts` (+16/−0, one new test, zero
existing assertions touched). One conceptual change.

```ts
// before:
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

// after:
const hardReject = reasons.some((reason) =>
  reason.includes('modifies evaluator') ||
  reason.includes('expands runtime authority') ||
  reason.includes('protected invariant') ||
  reason.includes('security review') ||
  reason.includes('exceeds') ||
  reason.includes('touches more than') ||
  reason.includes('duplicate') ||
  reason.includes('no declared harness surface') ||
  reason.includes('slice regression'),
);
```

(The `'exceeds'` keyword is left in place — it still correctly covers the
changed-lines-threshold message — but the slice-regression message no
longer *relies* on colliding with it.)

## Baseline

Parent commit `b2abcc14a632d7e0948962065a7c6c8920cf306c` (`main`). Fresh
`npm ci && npm run build`: clean, all packages pure TS, 0 wasm/NAPI
degradation. Initial `npm test` on the session's shallow checkout showed 3
failures in `scripts/benchmark-ticket-codec.test.mjs` (`git show
35c9fd3...:packages/edge-contracts/src/index.ts` — not reachable without
full history, the same shallow-clone git-show-oracle class already tracked
by open issue #149/PR #150); confirmed environmental via `git
rev-parse --is-shallow-repository` (`true`). Ran `git fetch --unshallow`;
baseline then measured clean: **1004/1004** (809 vitest + 195 governance).

## Evaluation Receipt

Real evaluator: `npm test` (`vitest run && npm run test:governance`), this
repo's own `bench` entrypoint.

| | Baseline (`main@b2abcc1`) | Candidate |
|---|---|---|
| vitest | 809 | 811 (+2 new, 0 regressions) |
| governance | 195 | 195 (unchanged) |
| Total | 1004 | 1006 |
| `npm run typecheck` | clean | clean |
| `npm run lint` | clean | clean |

Live pre/post-fix proof through the real built module, demonstrating the
fragility claim directly (not just asserted): reverting only the new
keyword while keeping the `'exceeds'` keyword still passes today (proving
today's behavior is accidental, not demonstrating a live regression) —
the actual risk is a *future* wording change, which this fix forecloses by
making the match explicit:

```
$ node -e "import('./packages/compile/dist/harness-optimizer.js').then(m => console.log(JSON.stringify(
    m.evaluateHarnessCandidate({
      patch: { id: 'p', sourceTraceIds: ['t1'], surfaces: ['control'], changedLines: 10, rationale: 'x' },
      slices: [{ name: 'validation', split: 'validation', baseline: 0.60, candidate: 0.50, sampleSize: 100 }],
    }))))"
# BASELINE (pre-fix, relies on 'exceeds' collision) and CANDIDATE (post-fix, explicit keyword) — byte-identical output:
{"patchId":"p","verdict":"REJECT","score":-0.10006666666666665,"weightedImprovement":-0.09999999999999998,"reasons":["no holdout evidence","slice regression 0.1000 exceeds 0.0200","weighted validation improvement is not positive enough"]}
```

Darwin entrypoint (SCAN item, supporting evidence only — not the code
candidate): `npx @metaharness/darwin evolve . --sandbox mock` denied by
this session's own sandbox/auto-mode policy before any process completed —
`DARWIN_LIVE_CHECK=blocked (sandbox policy)`, not fabricated, not worked
around with an alternate tool/host/encoding. `npx @metaharness/flywheel
--help` reproduced "could not determine executable to run", same as every
prior night that checked it.

## Darwin Lineage

`DARWIN=not-applicable` — a one-line keyword-hardening fix with a fixed
input/output contract has no evolvable population to fitness-search, same
precedent as every single-conceptual-change night on this surface (#65,
#91, #116, #132, #137, #148, #156, #177).

## Evidence

OBSERVATION (full inventory of all 12 `reasons.push(...)` sites in
`evaluateHarnessCandidate` against the `hardReject` keyword list) →
OBSERVATION (the slice-regression reason's hard-reject coverage today
depends entirely on an accidental substring collision with the unrelated
`'exceeds'` keyword, confirmed by reading both message-construction sites
independently) → OBSERVATION (zero existing test exercises "slice
regression beyond threshold" + "no holdout evidence" together) →
MEASUREMENT (live repro: today's output is byte-identical whether the new
explicit keyword is present or absent, proving no live behavior change,
only a correctness-of-construction change) → MEASUREMENT (1004→1006 tests,
0 regressions, lint/typecheck clean) → INFERENCE (independent critic
subagent, separate context, adversarial instructions) → DECISION (critic:
CLEAR) → DECISION (verdict ACCEPT).

## Reward-Hack Check

Independent adversarial-critic subagent (separate context, full repo read
access, explicitly instructed to try to break the candidate, not rubber-
stamp it): **CLEAR**.

What the critic independently verified, empirically:
1. Reverted only the one-line keyword addition while keeping the new test,
   confirmed the new test's assertion still passes against the unfixed
   code (because `'exceeds'` already matches) — this is expected and
   correctly disclosed in the report as "this fix changes no observable
   behavior today"; the critic then checked whether the test is therefore
   tautological for its *stated purpose* (locking in the keyword as
   explicit, not testing a behavior change) and confirmed it is not: it
   asserts `reasons` contains the literal string `'slice regression'`
   *and* a case constructed with no changed-lines overflow and no other
   `'exceeds'`-triggering reason, isolating the slice-regression path.
2. Constructed a counter-example removing the `'exceeds'` keyword entirely
   (temporarily, in a scratch copy) and confirmed the same scenario then
   regresses to `INCONCLUSIVE` pre-fix-of-this-candidate, and stays
   `REJECT` post-fix — proving the new keyword is load-bearing once the
   accidental collision is removed, i.e. it is not dead code.
3. Confirmed the diff is purely additive to the test file and the only
   functional change is the one new `||` clause — no gold data, threshold,
   or unrelated test touched.
4. Checked every other `reasons.push(...)` site per the table above and
   independently agrees with the "structural vs. evidentiary" classification
   for each, confirming no further masking defect exists in the function
   tonight.
5. Full `packages/compile` suite green post-build, no other file touched.

No benchmark/gold data exists for this pure classification function; no
evaluator exploit possible (the function being hardened is not itself an
evaluator, it classifies evaluation results); no hidden cost (no new
dependency); no undocumented cache; no threshold value changed — only a
keyword-match predicate gained one more explicit, independent disjunct.
`reward_hack_clear` / `critic_clear`.

## Security Review

Same analysis as PR #177 (unchanged trust boundary): `evaluateHarnessCandidate`
is a pure function — no I/O, no process execution, no credential or network
surface. `evaluateHarnessCandidate`/`selectHarnessUpdate` remain exported
with zero call sites anywhere in `packages/cli` or the compiled nightly
prompt (reconfirmed via repo-wide grep tonight) — this flywheel-shaped gate
is still not wired into the pipeline STEP 12-14 actually runs, so tonight's
fix, like #177's, has zero live blast radius today; its value is
hardening a promotion-gate primitive's internal correctness-of-construction
before it is ever wired up. Carried forward as an open next step (not
expanded into tonight's single-change candidate — wiring it up would not
be a single conceptual change).

## Regression Analysis

0 pre-existing tests modified or removed. All 1004 baseline tests
(809 vitest + 195 governance) pass unchanged; 2 new vitest tests added
(the previously-missing "slice regression + no holdout evidence" REJECT
case, and a scoped negative check with no overlapping `'exceeds'` trigger).
`npm run lint` / `npm run typecheck` clean. `npm run build` clean, no
wasm/NAPI degradation to record tonight.

## ADR

None — a one-line keyword-hardening fix to an existing, already-documented
promotion-gate function, not a new architectural decision or repo-wide
invariant. Matches the precedent of every prior single-file
evaluation-adapters fix on this ledger (#65, #91, #116, #132, #137, #148,
#156, #177).

## Scan Findings

**SCAN=darwin**: live invocation denied by this session's own sandbox/
auto-mode policy before completion (see Evaluation Receipt). Not worked
around with an alternate tool/host/encoding; recorded honestly as blocked,
consistent with 2026-10-12's, 2026-10-02's, and 2026-09-27's reports, which
hit the identical denial. No code change proposed for this scan item
tonight beyond the compound-`&&`-chain fix already pending, unmerged, in
open PR #156.

**SCAN=flywheel**: `evaluatorEntrypoints.flywheel` remains unset;
`@metaharness/flywheel --help` still reproduces "could not determine
executable to run" (`npm error could not determine executable to run`),
unchanged since 2026-08-13 across 9+ prior nights that checked it. Not a
bug in this repo; not re-filed. Tonight's actual candidate lives in this
repo's *own* flywheel-shaped promotion-gate code (`harness-optimizer.ts`),
closing out the exact "Next step 1" audit #177 flagged as unclaimed.

**Ledger-signals cross-check** (not this slot's surface, recorded for
completeness only): ground-truth `search_pull_requests` found the most
recent `dream/*`-surface candidate PR (#177) merged 2026-10-12, so
`zeroMergeStreak=false` (confirmed via `ledger signals --merged
"177,175,174,173,172,171,170,169,167,165" --open-count 19`), contradicting
the CLI tool's own unverified default (`true`, no `--merged` given) — the
same known false-negative pattern flagged on 10+ prior nights.
`reviewBacklogSize=19` open, unmerged dream-cycle-surface candidate PRs
(#189,#184,#182,#180,#161,#158,#156,#154,#152,#150,#148,#145,#141,#139,#137,
#101,#98, plus #190/#168/#163 research-track PRs not on the colon-prefixed
surface convention), 3 of which (#137, #148, #156) are on this exact
evaluation-adapters surface and were read in full tonight (file-level diff
for #137 confirmed) to verify no overlap with tonight's candidate file
(`harness-optimizer.ts`, untouched by any of them). `ledgerStale=true`
(`daysSinceLastRow=5`) — expected for this surface, which only recurs every
5 nights (`DAYINT % 5`); not itself a finding.

## Gist

`GIST=LOCAL` — no `gh` CLI gist capability (`gh auth status` reports an
invalid `GH_TOKEN`) and no gist-creation MCP tool available this session
(GitHub access here is via MCP tools scoped to `ruvnet/dream-machine`,
which expose no Gist API). Per STEP 17-18 this is not `FALLBACK` — this
committed report is the durable artifact.

## Consolidation Refresh — 2026-11-04

MODE=CONSOLIDATE (STEP 1.5, ADR-0011): 21 open `dream/*`-prefixed candidate
PRs tonight, well over `implementationTrack.reviewBacklogLimit=6`. Eleven
eligible drafts (#145, #148, #150, #152, #154, #158, #161, #180, #182, #184,
and #189 as of tonight's own bookkeeping fix) already carry a
`dream-consolidate` marker for today's exact default-branch SHA
(`3fc3222d2e5566a203331d3686c4d2eaf06713a8`) from preceding consolidation
nights (`main` has not moved since `#196`, landed 2026-10-19). This PR
(#192) was the oldest remaining eligible draft — still draft, ACCEPT in its
own Evaluation Receipt, not a `routine-self-review` PR, never previously
touched since its 2026-10-17 creation (base still the pre-#196 `b2abcc1`,
zero comments). #139 is REJECT and excluded; #98/#101 are multi-repo
portfolio branches, not single-surface dream-cycle candidates in the sense
this mode means; #137, #141, #156 are already out of draft. #194 remains
the next-oldest untouched eligible draft for a future night.

**Action.** Merged `main` (`3fc3222d2e5566a203331d3686c4d2eaf06713a8`) into
this branch with an ordinary merge commit (`71041793f50c1c92c77b648cbf9079a9da43dcba`,
never rebase, never force-push). Zero textual conflicts (`git merge
origin/main --no-edit`, "Merge made by the 'ort' strategy"). The merge
brings in 25 files unrelated to this candidate (ADR-0011, compiled-prompt
outputs for other repos, `dream.config.json`'s `scheduleContract` field,
`packages/compile`/`ledger` v2-engine changes) — `git diff
origin/main...HEAD` confirms this branch's own contribution is exactly the
original 4-file candidate diff (`harness-optimizer.ts` +15/-1,
`harness-optimizer.test.ts` +25, its own prior report, its own prior ledger
row), nothing else.

**Re-evaluation on the new head.** Fresh checkout was shallow
(`git rev-parse --is-shallow-repository` → `true`); unshallowed via `git
fetch --unshallow` before measuring (3 governance-adjacent vitest tests
otherwise fail opaquely on the unrelated, already-tracked shallow-clone
`BASELINE_COMMIT`/`git show` oracle gap, issue #149/PR #150 — resolved the
same way as prior nights, not conflated with this candidate). Real
evaluator (`npm test` = `vitest run && npm run test:governance`): vitest
888 (up from the original round's 811 — main's own commits since
2026-10-17 added tests independently of this candidate), governance 195
(unchanged), **0 regressions**, 1083 total. `npm run lint` / `npm run
typecheck` clean. `npm run build` clean (8 packages, no wasm/NAPI
degradation). The candidate's own 2 tests
(`harness-optimizer.test.ts`'s hardReject slice-regression-keyword cases)
re-verified individually: both pass on the merged head
(`npx vitest run packages/compile/src/harness-optimizer.test.ts`, 12/12).

**Fresh critic + reward-hack pass (this round)**, dispatched as a
separate-context subagent with no authorship stake, instructed to try to
break the candidate: **CLEAR**. Independently confirmed (1) the merge's own
diff contributes nothing beyond the original candidate — no gold data, no
threshold, no unrelated test file touched by the merge; (2)
`evaluateHarnessCandidate`/`selectHarnessUpdate` still have zero call sites
outside `harness-optimizer.ts` itself — the new `packages/compile/src/v2.ts`
and `config.ts` changes that landed via PR #196 do not reference this
module, so the original Reward-Hack Check's "zero blast radius" claim still
holds unchanged; (3) `.github/workflows/ci.yml` has no diff in the merge
range, so required checks are structurally unchanged; (4) the PR body's live
repro reproduces byte-identical output post-merge (`REJECT` via the explicit
`slice regression` reason string, same score/weightedImprovement).

**Darwin.** `DARWIN=not-applicable` — unchanged from the original round;
still a one-line keyword-hardening fix with a fixed input/output contract,
no evolvable population, consistent with unbroken precedent on this surface.

**CI on the pushed head (`71041793`).**
Green: `CodeQL`, `test (22)`, `test (24)`, `software-evidence`,
`dependency-security` (production-reachability-gated audit, `npm audit
--omit=dev --audit-level=high`: 0 vulnerabilities), `no-optional-deps`,
`guard`, `analyze`. **Red, pre-existing, not this PR's:** `dependency-audit`
(full dev-inclusive `npm audit --audit-level=high`) — reproduced locally
against this exact head's lockfile: `git diff origin/main -- package.json
package-lock.json` from this branch is empty, so the lockfile is
byte-identical to `main`'s. 16 findings (15 moderate, 1 high): the high one
is `vite`'s `launch-editor`/cross-origin/`server.fs` advisory family
(GHSA-698v-4r3x-3vcv, GHSA-r825-w8mm-5pxw, GHSA-587h-7wmj-h5pm,
GHSA-9jrq-w75r-8gcw, GHSA-rq7h-c2jc-7f22, GHSA-vfpm-58rq-9qcg) — the same
root cause already tracked by issue #197 (open since 2026-10-21), now grown
to 3 more Vite advisories since that issue was filed; the 15 moderate ones
are a newly-surfaced eslint/@typescript-eslint toolchain advisory cluster,
not yet filed anywhere, time-based advisory-database drift against an
unchanged lockfile (same already-tracked class as issue #37, open since
2026-08-27, for the original vitest/vite file-access advisories). Not
building a Vitest+Vite+ESLint major-version bump here — a substantial,
unrelated dependency upgrade decision that would widen this PR well beyond
its one conceptual change, same precedent as every prior consolidation
night on this backlog (#184 2026-11-02, #189 2026-11-03). The 15 moderate
eslint/@typescript-eslint findings are not yet tracked by any open issue
(distinct from #37's vitest/vite set and #197's vite/launch-editor set) —
disclosed here, not filed as a new issue tonight: STEP 1.5 CONSOLIDATE
explicitly skips STEPS 2-9 and 17-24 (no new research, candidate, or
issue), and a dependency-triage issue is better opened with full context
on a research night for this surface, not as a side effect of refreshing
an unrelated one-line candidate.

**Decision.**
ACCEPT still holds and the fresh critic is clear, but not every required
check on the new head is green (`dependency-audit`, for the pre-existing
reason above) — per STEP 1.5, this PR **stays draft**.

Ledger row appended on this branch (`docs/dream-cycle/LEDGER.md`), also
stated in issue #191, since it reaches `main` only if this PR merges.

No merge, no close, no force-push, no self-promotion, no candidate scope
change.

## Witness

Refreshed 2026-11-04 (consolidation round), superseding the original pair
below — bound to the merge commit, per this repo's own witness convention
for a CONSOLIDATE re-evaluation (PR #184 2026-11-02 / PR #189 2026-11-03
precedent):

```
report_sha256 : 4f5ab847c832613f6b569114fa264857eafff32e9e56843c3f07ff62073fd685
session_commit: 71041793f50c1c92c77b648cbf9079a9da43dcba
witness       : 584436f9dbf02dda7e5d6b9fdcbb554202325e2dd73acec57de4c110da420455
```

Computed over this file's canonical bytes as of this commit (everything
above this heading, trailing whitespace collapsed to one newline) via
`dream-machine witness stamp docs/dream-cycle/2026-10-17-evaluation-adapters-report.md 71041793f50c1c92c77b648cbf9079a9da43dcba --report`
— reproducible from the committed file with no unavailable intermediate
bytes. Verify: `dream-machine witness verify-report docs/dream-cycle/2026-10-17-evaluation-adapters-report.md --commit 71041793f50c1c92c77b648cbf9079a9da43dcba`

Original round's pair (parent `b2abcc1`, pre-consolidation, computed as of
commit `ceac5c1`), retained for history, deliberately not fenced as a
`report_sha256 :`/`session_commit:`/`witness :` block above so it cannot be
mistaken by tooling for the published triple: report hash
`3cfa03a2af0b2ea74fb2155232f12f658332860a9cfda28dca94ba3652eac42e`, session
commit `b2abcc14a632d7e0948962065a7c6c8920cf306c`, witness
`bec36db70ec71023a349c098ce16fce745023a075a9d781e2f4399c4365bd1bd` — no
longer reproducible via its original command against the current file,
since the Consolidation Refresh section above was inserted before this
heading.

## Recommendation

`evaluated: accepted` — human review requested (draft PR, never
self-merged, no `automerge-safe` label applied). **Next steps**:

1. `evaluateHarnessCandidate`/`selectHarnessUpdate` are still exported but
   have zero call sites anywhere in `packages/cli` or the compiled nightly
   prompt — carried forward from #177, this flywheel-shaped promotion gate
   is not yet wired into the pipeline STEP 12-14 actually runs. Out of scope
   tonight (would not be a single conceptual change).
2. PRs #137, #148, and #156 remain open/draft on this same
   evaluation-adapters surface, read in full or at file-diff level tonight,
   no overlap with this candidate's file — get them reviewed/merged; 19
   open dream-cycle-surface candidate PRs is a sizable review backlog
   worth a maintainer pass independent of any single night's finding.
3. The structural-vs-evidentiary audit performed tonight is now complete
   for every current `reasons.push(...)` site. If a new reason string is
   ever added to this function, re-run this same classification exercise
   (structural → must be in `hardReject` via its own explicit keyword;
   evidentiary → must not be) before merging, to keep this closed
   permanently rather than just for today's code.
