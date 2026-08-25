# Compiler-Parity SOTA Report — 2026

## TL;DR
`validateConfig()` in `@dream-machine/compile` never validates the object
form of `adrConvention` (`{ pad: number; dir: string }`). A malformed value —
confirmed live tonight — silently compiles into a corrupted STEP 19 ADR path
in the nightly routine prompt (e.g. an absolute filesystem-root path), with
`npm test` staying green and `dream-machine compile` reporting success. Added
validation that rejects a non-positive-integer `pad` or an empty/non-string
`dir` before `compile()` ever runs.

Also surfaced tonight, out of scope for this candidate but load-bearing for
every future night: `docs/dream-cycle/LEDGER.md` on `main` has only 1 row.
8 of the last 9 real dream-cycle nights (2026-08-14 through 2026-08-24, PRs
#9/#11/#15/#17/#19/#21/#24/#27) opened real draft PRs that each append a
ledger row on their *own* branch, but since none has been merged, none of
those rows exist on `main`. Every "learning signal" computed by any of those
9 nights — including tonight, before this was checked — was computed against
a near-empty ledger. See Ledger Check in tonight's issue for the full audit
and recommendation.

## What's new
- **Finding (Grade A, first-hand, reproduced live tonight):**
  ```
  $ node -e "
    const { adrDir, adrPad } = require('./packages/compile/dist/config.js');
    const bad = { pad: -1, dir: '' };
    console.log(adrDir(bad), adrPad(bad));
    console.log(adrDir(bad) + '/ADR-000N-dream-cycle-foo.md');
  "
  '' -1
  /ADR-000N-dream-cycle-foo.md
  ```
  `validateConfig()` (`packages/compile/src/config.ts`) checks `repo`, `cron`,
  `slots`, and `bonusModuli` keys, but has zero checks for `adrConvention`.
  `adrDir()`/`adrPad()` (same file) trust the object form's `dir`/`pad`
  fields verbatim. `compile()`'s `step19Adr()` then string-concatenates
  `${adrDir}/${example}-dream-cycle-<surface>-<slug>.md` with no guard, so an
  empty `dir` produces a leading-slash absolute path and a non-positive `pad`
  silently clamps to a 1-digit example via `Math.max(0, pad - 1)` — both
  wrong, neither caught by `dream-machine compile`'s existing "throws on
  invalid config" contract.
- **Context:** this is the same DEEP=compiler-parity/SCAN=config-schema
  surface as 2026-08-15 (issue #10 / PR #11, still open/draft), which added
  golden-snapshot coverage for this repo's own `dream.config.json` and left
  three concrete next-steps: (1) `scan.length !== 2` enforcement — still
  open, not attempted tonight (deliberately: changing accepted `scan` shapes
  is a broader behavior change, not a "config was silently accepted despite
  being malformed" bug); (2) **`adrConvention` object-form validation — this
  candidate**; (3) cron minimum-interval enforcement — since picked up by PR
  #24 (2026-08-21, still open/draft). No other open dream-cycle PR touches
  `adrConvention` or this validation gap.

## Competitors / prior art
| Project | Approach to config schema validation | Grade |
|---|---|---|
| Terraform | HCL type constraints + `validation` blocks reject malformed provider config at `terraform validate`, before any plan/apply touches derived paths | B (public docs) |
| ESLint flat config | `defineConfig`/schema validation rejects malformed nested option objects at load time, not at first use | B |
| Zod / io-ts (TS ecosystem) | Runtime schema validation of object-shaped config fields is the standard idiom for exactly this "optional structured field, only string literals validated" gap | B |
| This repo's own ADR-0001 §5 Test Contract | Requires config validation to catch malformed input before compile; item 1 already covers `repo`/`cron`/`slots` — this candidate closes the gap for the one field (`adrConvention`) that has a structured object form and was never covered | A (first-hand, this repo's own ADR + code) |

## Hypothesis (frozen before implementation)
Given a `dream.config.json` using the object-form `adrConvention: {pad, dir}`,
when `validateConfig()` is extended to reject a non-positive-integer `pad` or
an empty/non-string `dir` before `compile()` runs, then a malformed
`adrConvention` is caught as a structured `ValidationResult` error at
`dream-machine compile` time instead of silently producing a corrupted STEP
19 ADR path in the compiled routine prompt (verified live tonight:
`{pad:-1,dir:''}` → `/ADR-000N-dream-cycle-foo.md`), subject to: 0 change to
the compiled output of any config using the string forms (`'3-digit'` /
`'4-digit'`) or an already-valid object form, 0 regressions in the existing
100 tests, and the check only fires when `adrConvention` is the object form
(the string-literal forms stay untouched).

## Benchmark corpus
Real evaluator: `npm test` (vitest), this repo's own `bench` entrypoint.

## Evaluation
See Evaluation Receipt in the PR body.

## Security Review
No new exec/network/credential/filesystem-write surface. `validateConfig()`
is a pure function over an already-parsed in-memory object; the new branch
only reads `pad`/`dir` and pushes strings onto the existing `errors` array —
no new I/O, no new dependency, no LLM calls (N/A for prompt injection). The
only filesystem interaction anywhere in the candidate is the pre-existing
`readFileSync` in the *unrelated* self-hosted-config test added by PR #11 on
2026-08-15 — untouched by this diff. `io.exec` and all evaluator entrypoints
are unaffected; least-privilege posture unchanged.

## Witness
```
report_sha256 : b09a2e921182290766daeb9b3d95b43cb7fe6287906850a3f95363c88d07fd5f
session_commit: 8ce385786faa5e63cc0e7105cc6e96f663a51f07
witness       : d49585309470536df0c3452675a2d087b6f901b21193cc94999ac52ce1d72588
```
Verify (5 steps, coreutils only):
```bash
curl -sL <RAW_GIST_URL> -o report.md   # or use the committed report path
REPORT_HASH=$(sha256sum report.md | awk '{print $1}')
printf '%s%s' "$REPORT_HASH" "8ce385786faa5e63cc0e7105cc6e96f663a51f07" | sha256sum | awk '{print $1}'
# ^ must equal the witness above
```
`report_sha256` is computed against this file's content *before* this
Witness section was filled in (STEP 16's own hash-then-rewrite order — same
convention as PRs #7 and #11). Confirmed tonight via `dream-machine witness
verify` against the committed report copy.

## Next steps (not attempted tonight)
1. `scan.length !== 2` strictness (PR #11's remaining next-step) — a
   behavior-widening change, not a pure validation-gap fix; needs its own
   hypothesis since it changes what configs are *accepted*, not just catches
   malformed ones.
2. Reconcile `docs/dream-cycle/LEDGER.md` on `main` against the 8 currently-
   open dream-cycle draft PRs (#9,#11,#15,#17,#19,#21,#24,#27) — either by
   merging the review backlog, or by teaching `dream-machine ledger signals`
   to accept rows sourced from open PR bodies via `--extra-rows-file`, so
   signal computation isn't silently blind to unmerged history. Flagged as
   the single highest-leverage finding of the whole audit; deliberately not
   attempted as tonight's tiny/one-parameter candidate.
3. Apply the same object-form-validation treatment to `bonusModuli` values
   (currently only the *keys* are checked to be integers; the *values*
   — free-form surface-name strings — are unchecked, though lower risk since
   they only ever appear in generated prose, never a filesystem path).
