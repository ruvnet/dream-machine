# Compiler-Parity SOTA Report — 2026

## TL;DR

Tonight's rotation (slot 0, `DAYINT 20261015 % 5 = 0`): `DEEP=compiler-parity`,
`SCAN=config-schema,golden-snapshots`. No bonus deep-dive (`20261015 % 25 =
15`, `% 75 = 65`, neither 0).

`dream.config.json`'s optional `autoMerge?: boolean` field had **zero type
validation** in `validateConfig()` (`packages/compile/src/config.ts`).
`withDefaults()`'s `config.autoMerge ?? false` only substitutes a default for
`undefined`/`null` — any other value passes through unchanged — and
`packages/compile/src/index.ts`'s `step20to25PublishFlow()` reads it as a
bare JS truthy/falsy condition: `autoMerge ? <guarded-auto-merge-ENABLED
text> : <human-review-only text>`. Live-reproduced: `autoMerge: "no"` (a
string) is JS-truthy, so `validateConfig()` returned `ok: true` and
`compile()` wrote **"guarded auto-merge ENABLED for this target"** into this
self-hosting system's own authoritative nightly control prompt — the
opposite of what a config author writing `"no"` would expect. Exactly the
same inversion-on-a-truthy-non-boolean defect class already fixed for
`buildStep.degradeOnWasmFailure` (issue #142/PR #143, ACCEPT, landed), but
here on the field that governs whether a future night's compiled prompt
describes guarded auto-merge as enabled or describes human review as
mandatory.

**Checked for duplication before claiming it.** This repo's compiler-parity
slot has a long lineage of `validateConfig()` type-hardening PRs (#105,
#111, #127, #142/#143, #152, #164/#165) — none touches `autoMerge`. An
independent adversarial-critic subagent separately grepped the whole repo,
`docs/dream-cycle/LEDGER.md`, and GitHub issues/PRs for "autoMerge" and
confirmed zero prior hits. Not a duplicate of the open, unrelated
`evaluatorEntrypoints` shape-validation gap tracked in PR #152, nor of the
unrelated shallow-clone `BASELINE_COMMIT` fragility tracked in issue
#149/PR #150 (which this session also independently rediscovered first,
via its own fresh shallow checkout failing 3 governance tests — see
Evaluation Receipt — before finding it already filed and choosing not to
re-propose it).

## What's new

`packages/compile/src/config.ts` (`validateConfig()`): one new check,
mirroring the existing `buildStep.degradeOnWasmFailure` guard —

```ts
if (config.autoMerge !== undefined && typeof config.autoMerge !== 'boolean') {
  errors.push('autoMerge must be a boolean');
}
```

`packages/compile/src/index.test.ts`: +7 tests — non-boolean rejection
(`'no'`, `'false'`, `0`, `1`, `'true'`), boolean acceptance (`true`,
`false`), optional-omission, plus three `compile()`-level tests proving the
real-world consequence: a truthy non-boolean previously compiled the
guarded-auto-merge-ENABLED policy text; the default (omitted) and explicit
`true` cases render the expected policy text post-fix.

+11/-0 net lines across both files — well under the 300-line target, one
conceptual change.

## Competitors (how other config-validation systems handle a boolean-typed optional field from untrusted/hand-authored JSON)

| System | Handling | Grade |
|---|---|---|
| JSON Schema `"type": "boolean"` | The standard, spec-level mechanism for rejecting any non-boolean value (string, number, null) for a boolean-typed property — exactly the shape this fix adds by hand | A (spec) |
| Zod / Ajv / io-ts (common JS/TS runtime validators) | All treat a type mismatch on a declared-boolean field as a first-class validation error, not a silent truthy/falsy coercion; not fetched live tonight, reported from established prior knowledge, not verified against current docs | B (vendor, not live-checked this session) |
| This repo's own prior fix for the identical defect class | `buildStep.degradeOnWasmFailure` (issue #142/PR #143, ACCEPT, landed on `main`) — same `typeof v !== 'boolean'` shape, same root cause (a `?? default` only catching `undefined`/`null`, then a bare truthy read downstream) | A (first-hand, this repo's own landed code, directly inspected) |

## Hypothesis (frozen before implementation)

> Given a `dream.config.json` whose `autoMerge` value is present but not a
> boolean (e.g. the string `"no"`, `"false"`, or any other truthy/falsy
> non-boolean), when `validateConfig()` is extended to reject it, then
> `dream-machine compile` should report a structured `ValidationResult`
> error instead of silently compiling a prompt whose STEP 20-25 merge-policy
> section reflects JS truthiness of the raw value rather than the config
> author's intent — subject to: zero behavior change for any well-formed
> boolean value, including this repo's own self-hosted `dream.config.json`
> (`autoMerge: false`), and zero regression in the existing test suite or
> golden snapshots.

Not amended after evaluation began.

## Evaluation Receipt

Real evaluator (`dream.config.json`'s `evaluatorEntrypoints.bench`):
`npm test` (`vitest run && npm run test:governance`).

- **Baseline** (parent `b2abcc1`, this session's own fresh shallow clone):
  `npm test` initially failed 3 of 195 governance tests with an opaque
  `git show`/`fatal: path ... exists on disk, but not in '35c9fd31...'`
  error — this is the already-filed, already-open issue #149/PR #150
  (`BASELINE_COMMIT` git-show oracle on a shallow clone), independently
  reproduced by this session before discovering it was already filed.
  Resolved session-locally via `git fetch --depth=1 origin
  35c9fd31ec0369f1c4b0ac7d5eda13d766bbb8cf` (the exact pinned commit, content-
  addressed, nothing else) so this candidate's own regression count is not
  conflated with that separate, already-tracked defect — same handling
  precedent as the 2026-10-10 report. True baseline: `vitest 809/809
  passed` (25/25 files), `governance 195/195 passed`, 0 failing.
- **Candidate** (this commit, rebuilt `packages/compile`): `vitest
  820/820 passed` (+11, all new), `governance 195/195 passed` (unchanged).
  **0 regressions.**
- `npm run lint` (eslint) → clean, exit 0. `npm run typecheck` (`tsc
  --noEmit`) → clean, exit 0.
- **Live repro, pre-fix vs post-fix**: `validateConfig({...defaultConfig,
  autoMerge: "no"})` → pre-fix `{ok: true, errors: []}`; `compile(...)` on
  that config → pre-fix output contains `"guarded auto-merge ENABLED for
  this target"`. Post-fix: `validateConfig` returns `{ok: false, errors:
  ["autoMerge must be a boolean"]}`; `compile()` throws before any section
  is built.
- **Self-hosted compile output byte-identical**: `node packages/cli/dist/
  bin.js compile dream.config.json --out ...` before and after the fix,
  `diff` exit 0 — this repo's own `autoMerge: false` and this session's own
  STEP B/C `/tmp/tonight-prompt.md` are unaffected. Independently
  re-confirmed by the adversarial critic subagent (separate run, same
  result).

## Baseline

Parent commit `b2abcc14a632d7e0948962065a7c6c8920cf306c` (`main`, this
session's own `SESSION_COMMIT` from STEP 0), measured live via a real
before/after `npm test` run on this session's own checkout, not inferred
from logs.

## Darwin Lineage

`DARWIN=not-applicable` — single validation-shape fix, no evolvable
population or numeric objective, matching unbroken precedent for every
compiler-parity fix of this shape (#29, #79, #105, #111, #127, #142/#143,
#164/#165). `evaluatorEntrypoints.darwin` remains the repo's own
already-flagged unpinned-`npx` entrypoint; not invoked tonight, consistent
with precedent.

## Evidence

- OBSERVATION: `autoMerge?: boolean` had no type check in `validateConfig()`;
  `withDefaults()`'s `?? false` only substitutes for `undefined`/`null`.
- OBSERVATION: `step20to25PublishFlow()` reads `autoMerge` as a bare JS
  truthy/falsy condition selecting between two different compiled merge
  policies.
- MEASUREMENT: live pre-fix `validateConfig`/`compile` calls with
  `autoMerge: "no"` — `ok: true`, compiled "guarded auto-merge ENABLED"
  text; same calls post-fix — structured validation error, `compile()`
  throws.
- MEASUREMENT: baseline 809 vitest/195 governance → candidate 820
  vitest/195 governance (+11, all new), lint/typecheck clean, self-hosted
  output byte-identical both before/after and across the independent
  critic's own separate re-run.
- INFERENCE: grepping the whole repo for every `autoMerge` read site found
  exactly one other consumer, `scripts/automerge-guard.mjs`'s
  `evaluateGuard`/`inspectPullRequest`, which already use **strict
  equality** (`config.autoMerge !== true`) rather than bare truthiness —
  so that CI-facing gate was never exposed to this defect; the one real gap
  was `step20to25PublishFlow()` alone, confirmed by the independent critic's
  own separate grep.
- DECISION: added the minimal `typeof` guard (mirroring
  `degradeOnWasmFailure`'s existing shape) rather than a broader
  `autoMerge`-specific schema, since no other read site needed it.
- REJECTION: did not touch `scripts/automerge-guard.mjs` (already safe,
  confirmed by direct read + independent critic); did not widen scope to
  the unrelated, already-open `evaluatorEntrypoints` shape gap (PR #152) or
  the unrelated, already-open shallow-clone gap (issue #149/PR #150).

## Reward-Hack Check

Independent adversarial critic (separate subagent context, no authorship
stake, instructed to read the live diff and repo state directly, not a
paraphrase): **CLEAR**. Specifically verified, in its own words: no
existing test/threshold/fixture was weakened; `autoMerge: null` is correctly
rejected too (`null !== undefined` and `typeof null !== 'boolean'`), closing
an obvious bypass candidate; grepped the entire repo and found
`scripts/automerge-guard.mjs` is the only other `autoMerge` consumer and
already uses strict `=== true` / `!== true` comparisons, so no other gap
exists; re-ran `npm run build -w packages/compile && npm test` itself
or from scratch, got **820/820 vitest, 195/195 governance, 0 regressions**
independently; re-compiled `dream.config.json` twice and confirmed
byte-identical output; confirmed no fixture/test/doc anywhere intentionally
relies on a non-boolean `autoMerge`; confirmed via its own
`search_issues`/`search_pull_requests` calls against `ruvnet/dream-machine`
that this is not a duplicate (zero matching issues, one unrelated PR hit
on #152). No fixture, gold answer, threshold, or seed was touched at any
point. No test was weakened to pass a blocked case — there was no blocked
case; the critic's verdict was CLEAR on the first pass.

## Security Review

This candidate closes a (low-severity, config-authoring-time) integrity gap
in this self-hosting system's own authoritative control-plane compiler: a
malformed or accidentally-malformed `autoMerge` value could have caused a
future night's compiled prompt to misstate this repo's merge-authority
policy. Pure in-memory type validation — no new I/O, credential, network,
or tool/MCP authority surface. `dream.config.json` is a committed,
nominally human-PR-reviewed file; this defends against that file (or a
future automated dream-cycle candidate that edits it) carrying a malformed
`autoMerge` value, by mistake or otherwise. Confirmed (independently, by
the critic) that the one other real-world consumer of this field
(`scripts/automerge-guard.mjs`, which gates actual CI auto-merge
eligibility) was never exposed to this defect — it already uses strict
boolean equality. This fix does not grant, and could never grant,
auto-merge or self-promotion authority; it only prevents the *textual
description* of that policy in a compiled prompt from silently inverting.

## Regression Analysis

0 regressions: vitest 809→820 (+11, all new), governance 195/195
unchanged. No existing test weakened, no threshold changed, no gold data
touched. Independently re-verified by the critic from a from-scratch
rebuild.

## ADR

None — parameter/validation-shape fix, consistent with every prior
compiler-parity fix of this shape (#29, #79, #105, #111, #127, #142/#143,
#152, #164/#165 — none has an ADR).

## Scan Findings

**config-schema** — `autoMerge` now carries the same type guard every other
boolean-typed optional field (`buildStep.degradeOnWasmFailure`,
`ruosEvaluation.enabled`/`requireScreenshot`) already had. Remaining,
deliberately out-of-scope gaps on this same surface, left to their own
already-open, already-filed issues: `evaluatorEntrypoints` shape/type
validation (issue #151/PR #152) and the `BASELINE_COMMIT` shallow-clone
git-show oracle (issue #149/PR #150) — this session independently
reproduced the latter's exact symptom tonight before discovering it was
already filed, and withheld re-fixing it per STEP 2's "do not rediscover a
failed direction" discipline.

**golden-snapshots** — Both the `metaharness` fixture and this repo's own
real `dream.config.json` golden-snapshot tests are green (820/820 vitest,
195/195 governance); self-hosted output confirmed byte-identical, including
independently by the critic. No drift.

## Recommendation

Human review of the draft PR. `EVALUATED=yes` / `VERDICT=ACCEPT`. All
promotion-gate conditions clear: evaluation complete, effect positive
(silent policy-inversion bug closed, +11 new deterministic tests), no
material regression (809→820, 0 regressions elsewhere), tests green,
reward-hack clear (independent critic, CLEAR on first pass), critic clear,
witness valid (self-contained, verifiable below), receipt reproducible
(exact commands given above). Human review requested for merge — this
session never self-merges.

Next steps explicitly NOT done tonight, left to their own tracked issues:
(1) issue #149/PR #150 (shallow-clone `BASELINE_COMMIT` oracle) remains
open/draft, 12 nights now, independently reproduced again tonight; (2)
issue #151/PR #152 (`evaluatorEntrypoints` shape validation) remains
open/draft; (3) `docs/dream-cycle/LEDGER.md` is 3 days stale on `main`
(`daysSinceLastRow=3`) with `reviewBacklogSize=13` open unmerged `dream/*`
candidate PRs (`#137,#139,#141,#145,#148,#150,#152,#154,#156,#158,#161,
#180,#182`), none overlapping this candidate's file/lines — a
`ledger-signals`/`developer-experience`-surface finding, out of scope for
tonight's `compiler-parity` slot. `zeroMergeStreak=true` is the CLI's
unverified default (no `--merged` supplied); ground-truthed via GitHub
search plus direct inspection of landed source: several recent `closed`
dream-cycle PRs (e.g. #165, #177) are in fact hand-applied and landed on
`main` despite `merged: false` in the GitHub API sense (this repo's
established pattern), so the true recent cadence is non-zero, but a
precise count was not computed tonight (out of scope for this candidate).

## Consolidation refresh — 2026-11-02

MODE=CONSOLIDATE (STEP 1.5, ADR-0011): 21 open `dream/*` candidate PRs
tonight, well over `implementationTrack.reviewBacklogLimit=6`. The nine
nearer-the-front eligible drafts — #145, #148, #150, #152, #154, #158,
#161, #180, #182 — each already carry a `dream-consolidate` marker for
today's exact default-branch SHA (`3fc3222d2e5566a203331d3686c4d2eaf06713a8`)
from the nine preceding consolidation nights (`main` has not moved since
`#196`, landed 2026-10-19). This PR was the oldest still-eligible draft
(still draft, ACCEPT in its own Evaluation Receipt, not a
`routine-self-review` PR) carrying no prior consolidate marker at all.
#139 is REJECT and excluded; #98/#101 are multi-repo portfolio branches,
not single-surface dream-cycle candidates in the sense this mode means;
#137/#141/#156 are already out of draft.

**Action.** Merged `main` (`3fc3222d2e5566a203331d3686c4d2eaf06713a8`) into
this branch with an ordinary merge commit (`f51e51ac530647d0916867d09fe
79848d2d8e84a`, never rebase, never force-push). **Zero textual
conflicts** — including in `docs/dream-cycle/LEDGER.md` (both this
branch's base and `main`'s tip end at the same 2026-10-15 row, since
nothing has merged to `main` since) and in `packages/compile/src/config.ts`
(`main`'s intervening v2-engine history — `researchDepth`,
`implementationTrack`, `selfReview`, `prMode`, `scheduleContract`, a
`branchPrefix` charset check — adds new, non-overlapping fields; this
candidate's `autoMerge` check is untouched, same lines, same context).

**Re-evaluation on the new head.** Real evaluator (`npm test`): vitest
886 (bare `main@3fc3222`) → 897 (+11, this candidate's own tests,
**0 regressions**), governance 195/195 unchanged. `npm run
typecheck`/`npm run lint` clean. `npm run build` clean (8 packages, no
wasm/NAPI degradation). `node packages/cli/dist/bin.js ledger verify
--path docs/dream-cycle/LEDGER.md --since-row 38 --legacy-digest
23b02bfa98b56b374fadfb1b05df25e589dcdeab26143ae6183083d21779426a`: OK, 54
rows. Self-hosted `dream.config.json` compile output byte-identical to
this session's own `/tmp/tonight-prompt.md`. Live repro re-run against
the rebuilt `packages/compile/dist/config.js`/`index.js`:
`autoMerge: "no"`/`null`/`"false"`/`0`/`1` all still rejected with
`"autoMerge must be a boolean"`; `true`/`false`/omitted all still produce
byte-identical compiled policy text.

**Fresh critic + reward-hack pass (this round)**, dispatched as a
separate-context subagent with no authorship stake, given only the
candidate's hypothesis and the live merged repository (not a reread of
the prior verdict): **CLEAR**. Independently confirmed the check is
present and unweakened on the merged head; grepped the whole repo and
confirmed `scripts/automerge-guard.mjs` (the only other `autoMerge`
consumer) already uses strict `=== true`/`!== true` equality, immune by
construction; live-reproduced rejection of `"no"`, `null`, `"false"`, `0`,
`1` and acceptance of `true`/`false`/omitted against the built dist; ran
`npm test` itself (897 vitest + 195 governance, 0 fail) and
`lint`/`typecheck` (both clean); confirmed via `git diff
2d6f2af7ae36e4fed8e069ae9307cb87efa6649d..HEAD` that this candidate's own
two files are byte-identical to the originally reviewed diff (the merge
added zero lines to either); reviewed all 7 original tests individually
and found none tautological; confirmed the self-hosted
`dream.config.json` (`autoMerge: false`, explicit boolean) still compiles
byte-identical. No gold data, threshold, or corpus touched by the merge;
no test weakened.

**Darwin.** `DARWIN=not-applicable` — unchanged from the original round;
still a single validation-shape fix with no evolvable population.

**CI on the pushed head.** Expect `guard`, `test` (both Node versions),
`no-optional-deps`, `software-evidence`, `dependency-security`
(production-scoped `npm audit --omit=dev --audit-level=high`: reproduced
locally, 0 vulnerabilities), and CodeQL green (all reproduced equivalently
above). **Red, pre-existing, not this PR's:** `dependency-audit` (full
dev-inclusive `npm audit --audit-level=high`) — reproduced locally against
this exact head's lockfile: `git diff origin/main -- package.json
package-lock.json` from this branch is empty (0 lines), so the lockfile is
byte-identical to `main`'s. Same pre-existing, already-tracked
`vite@8.3.0-8.3.2`/`launch-editor` high-severity advisory family as issue
#197 (opened 2026-10-21 against PR #145, still open, no fix PR exists yet
to port — a semver-range-breaking `vite` bump is out of scope for this
single-validation-check fix). Not re-filing a duplicate issue; not fixing
it from this PR.

**Decision.** ACCEPT still holds and the fresh critic is clear, but not
every required check on the new head is expected green (`dependency-audit`,
for the pre-existing reason above) — per STEP 1.5, this PR **stays draft**.
Ledger row appended on this branch: `docs/dream-cycle/LEDGER.md`
(2026-11-02) — also stated in issue #183, since it reaches `main` only if
this PR merges.

No merge, no close, no force-push, no self-promotion, no candidate scope
change.

## Consolidation refresh — 2026-11-17

MODE=CONSOLIDATE (STEP 1.5). 19 open `dream/*` candidate PRs tonight,
over `implementationTrack.reviewBacklogLimit=6`. #211/#204/#202/#199 are
`routine-self-review` PRs, excluded by rule. #137/#141/#145/#148/#152/
#154/#156/#180/#182 are already out of draft. #98/#101 are multi-repo
portfolio-format branches, not single-surface dream-cycle candidates
(established precedent, carried forward). #161 already carries a
`dream-consolidate` marker for tonight's exact default-branch SHA
(`71d607bea6608180b8c41980dc5386526d3f1f16` — main has not moved since
the 2026-11-10 round that stamped it). Of the remaining eligible drafts
(#184, #189, #192 — each still draft, ACCEPT in its own Evaluation
Receipt, no marker for tonight's SHA), this PR (#184) is the oldest by
`created_at`.

**Action.** Merged `main` (`71d607bea6608180b8c41980dc5386526d3f1f16`)
into this branch with an ordinary merge commit (`dc58211`, never rebase,
never force-push). One textual conflict in `docs/dream-cycle/LEDGER.md`
(both sides had appended rows since the 2026-11-02 round); resolved by
chronological concatenation (2026-10-15, 10-24, 10-28, 11-02 in date
order) — no row lost or duplicated. `git diff origin/main --stat --
packages/compile/src/config.ts packages/compile/src/index.test.ts` on
the new head is content-identical to the originally reviewed diff
(+11/+31 lines, 2 files, 42 insertions, 0 deletions) — the merge widened
nothing.

**Re-evaluation on the new head.** Real evaluator (`npm test`): bare
`main@71d607b` measured live by temporarily restoring the two candidate
files to their `origin/main` versions — 908 vitest passed + 2 skipped
(910) — then restoring the candidate and re-running: **919 vitest
passed + 2 skipped (921, +11, 0 regressions)**; governance
(`node --test scripts/*.test.mjs`) **197/197 unchanged**.
`npm run lint` / `npm run typecheck` clean. `npm run build` (8 packages)
clean, no wasm/NAPI degradation. Self-hosted `dream.config.json` compile
output byte-identical (`diff -q` against an independent fresh compile on
this same head: identical). Live repro re-run against the rebuilt
`packages/compile/dist/config.js`: `autoMerge` values `"no"`, `"false"`,
`0`, `1`, `null` all still rejected with `autoMerge must be a boolean`;
`true`/`false`/`undefined` all still accepted — unchanged from the
original round.

**Fresh critic + reward-hack pass (this round)**, dispatched as a
separate-context subagent with no authorship stake, instructed to try to
break the candidate from scratch against the live merged repository (not
a reread of any prior verdict): **CLEAR**. It independently probed
`null`/`[]`/`{}`/`NaN`/`Infinity`/`-0` through `validateConfig` (all 6
rejected); grepped every `autoMerge` consumer in the repo and confirmed
`scripts/automerge-guard.mjs`'s two call sites use strict `!== true`
equality and were never exposed to the original bug; ran the full suite,
lint and typecheck itself; and ran a genuine non-tautology check — reverted
`config.ts` to the pre-fix `main` version (test file untouched), confirmed
6 of the 9 new boolean-validation test cases fail against old code, then
restored the file and verified `git status`/`git diff --stat` were
byte-identical to before. One minor, non-blocking note: the tests don't
add an explicit `autoMerge: null` case (independently verified via the
critic's own probe instead) — a documentation-completeness gap, not a
correctness one.

**Darwin.** `DARWIN=not-applicable` — unchanged from every prior round;
still a single validation-shape fix with no evolvable population or
numeric objective. Entrypoint probed live for the record
(`npx --yes @metaharness/darwin@0.12.0 --version`): reachable, prints
usage, not blocked by sandbox policy tonight — but not run against this
candidate, consistent with unbroken precedent (#29, #79, #105, #111,
#127, #142/#143, #152, #164/#165, and every prior consolidation round on
this PR).

**CI on the pushed head.** Will be confirmed live via the GitHub API
after push; see the PR comment for the exact per-check result. Prior
rounds' only persistently red check has been `dependency-audit` (the
full dev-inclusive `npm audit --audit-level=high` job), for a pre-existing,
already-tracked `vite`/`launch-editor` advisory family (issue #197) —
this branch's lockfile remains byte-identical to `main`'s
(`git diff origin/main -- package.json package-lock.json` empty), so any
recurrence here is inherited, not introduced by this candidate or this
merge.

**Decision.** ACCEPT is reconfirmed a second time on tonight's exact
head. Ready-for-review requires ALL of: ACCEPT holds (yes), every
required check green (pending live CI confirmation — see PR comment),
critic clear (yes). Marked ready only if the live CI check bears this
out; otherwise stays draft, stated exactly why in the PR comment. Ledger
row appended on this branch: `docs/dream-cycle/LEDGER.md` (2026-11-17) —
also stated in issue #183, since it reaches `main` only if this PR
merges.

No merge, no close, no force-push, no self-promotion, no candidate scope
change.

## Witness

Refreshed 2026-11-17 (second consolidation round), superseding the
2026-11-02 pair below — bound to tonight's merge commit, not the
original parent, per this repo's own witness convention for a
CONSOLIDATE re-evaluation:

```
report_sha256 : 7cbc4ac19c2a9ca79a5b327eef15c1d16a66d716da703c2be4bf4e83e965b91b
session_commit: dc5821133136c8d60a186ac7108077ad9f78876d
witness       : 1a930f2f3b4efa50940d7290292c924773ca39432c67bd38b81f1821915f4af6
```

2026-11-02 round's pair (merge commit `f51e51ac`), retained for history:
`report_sha256 a4cdfcb7...5cfad`, `witness 1f5e593a...1dab`. Original
round's pair (parent `b2abcc1`, pre-consolidation), retained for history:
`report_sha256 3169cdad...c36cc`, `witness 316c77d1...c886`.

Computed over this file's canonical bytes (everything above this heading,
trailing whitespace collapsed to one newline). Self-verify:

```bash
node packages/cli/dist/bin.js witness verify-report docs/dream-cycle/2026-10-15-compiler-parity-report.md --commit dc5821133136c8d60a186ac7108077ad9f78876d
```
