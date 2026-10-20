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

## Witness

```
report_sha256 : 3169cdad4ee28c9b2fd78f98e1ced4ffd5ff918ca72b3729dc4724aef26cef9a
session_commit: b2abcc14a632d7e0948962065a7c6c8920cf306c
witness       : 316c77d1902ce2bcbe5eab6f13165e41c2385df39279ada2d25fd705e7cec886
```

Computed over this file's canonical bytes (everything above this heading,
trailing whitespace collapsed to one newline). Self-verify:

```bash
node packages/cli/dist/bin.js witness verify-report docs/dream-cycle/2026-10-15-compiler-parity-report.md --commit b2abcc14a632d7e0948962065a7c6c8920cf306c
```
