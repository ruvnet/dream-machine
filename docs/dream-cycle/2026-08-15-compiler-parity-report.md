# Compiler-Parity SOTA Report — 2026

## TL;DR
This repo's own `dream.config.json` — the exact file `STEP B` of every nightly
run reads via `dream-machine compile dream.config.json` — has **zero**
regression coverage in `@dream-machine/compile`'s test suite. Every existing
test (`packages/compile/src/index.test.ts`) exercises a synthetic
`metaharness` fixture; nothing snapshots or validates the self-hosted config
that actually drives this repo's nightly routine. Added a golden-snapshot +
validation regression test for the real config, closing the gap.

## What's new
- **Finding (Grade A, first-hand, direct code inspection):**
  `grep -rn "readFileSync\|dream\.config\.json" packages/*/src/*.test.ts`
  returns zero hits against the root config; `packages/compile/src/index.test.ts`
  only ever constructs an inline `metaharness: DreamConfig` object. A future
  change to `validateConfig`/`compile()`/`config.ts` — including changes made
  by a *future dream-cycle candidate on a different slot* (`ledger-signals`,
  `evaluation-adapters`, etc.) — could silently break this repo's own
  production `dream.config.json` (e.g. reject it, or compile a corrupted
  prompt) with `npm test` staying green, because nothing in the suite ever
  touches it. That is a self-hosting-specific compiler-parity risk this
  session's own ADR-0001 §5 Test Contract item 1 does not cover (it only
  requires golden-snapshot testing of *a* config, not *this repo's own*).
- Candidate: a new `describe('self-hosted config (ruvnet/dream-machine)')`
  block reading the real root `dream.config.json` via `node:fs`, asserting
  `validateConfig(cfg).ok === true`, that `compile(cfg)` is deterministic, and
  golden-snapshotting the compiled output — plus a `withDefaults` assertion
  that `autoMerge` resolves `true` (this repo is the one config in the
  wild with `autoMerge: true`, previously untested).

## Competitors / prior art (context, not the justification — the finding is internal)
| Project | Approach to config/compiler self-test | Grade |
|---|---|---|
| Terraform | `terraform validate` + golden `.tfplan` fixtures per real root module in CI | B (public docs, not independently reproduced tonight) |
| ESLint (`eslint-config-*` packages) | Each shareable config is snapshot-tested against its own `eslintrc` in the consuming repo's CI, not just a synthetic fixture | B |
| Kubernetes `kubeval`/`kubeconform` | Validates real manifests in-repo via CI, separate from schema-unit-tests | B |
| Ruflo / MetaHarness nightly prompts (this project's own prior instances, ADR-0001 §1) | Hand-maintained twins; ADR-0001 itself names "drift" as the exact hazard this compiler was extracted to kill — but even post-extraction, nothing tests the *compiled-for-real* config, only the mechanism | A (first-hand, this repo's own ADR) |

## Hypothesis (frozen before implementation)
Given the `@dream-machine/compile` test suite, when a golden-snapshot +
validation test is added that reads this repository's own root
`dream.config.json`, validates it, and snapshots its compiled output, then a
future regression in `validateConfig`/`compile()` that would silently break
*this repo's own* nightly routine gets caught by `npm test`, whereas today it
would not — subject to: the new test adds 0 regressions to the existing 96
tests, stays fully deterministic (no dates/randomness, consistent with the
package's existing determinism guarantee), and does not touch/weaken any
existing assertion or fixture.

## Benchmark corpus
The real evaluator is `npm test` (vitest) — this repo's own `bench`
evaluator entrypoint, run identically on parent and candidate.

## Evaluation
See Evaluation Receipt in the PR body — parent 96/96, candidate 100/100 (+4
new, 0 removed/modified), 0 regressions.

## Witness
```
report_sha256 : 020a3630be4e5a2b7694e2486b084b8c71f832ca86afb4a937aeb028fb6b6bbb
session_commit: 7bbb851d337067d16ede31175896bb5e587a7d22
witness       : cf2f071148a0e16a743ded375417f4bf2749d9c6497e7876f5269aab9635e228
```
Verify: `sha256sum` the published report, then
`printf '%s%s' "<report_sha256>" "7bbb851d337067d16ede31175896bb5e587a7d22" | sha256sum`
must equal the witness above. Confirmed tonight via `dream-machine witness verify` (✓ VALID). Note: `report_sha256` above is computed against this file's content *before* this Witness section was filled in (matching the routine's own STEP 16 order — hash first, then rewrite).

## Next steps (not attempted tonight — scope discipline, zeroMergeStreak bias
toward one tiny reviewable change)
1. Tighten `validateConfig` to enforce `scan.length === 2` (the type says
   `[string,string] | string[]` but only `< 1` is checked, and only as a
   warning) — separate conceptual change, needs its own hypothesis/evaluation.
2. Validate the `adrConvention` object form (`{pad,dir}`) — currently
   zero-validated; a malformed value would silently corrupt STEP 19's ADR
   path in the compiled prompt.
3. Enforce the docstring's claimed cron "minimum interval 1 hour" — `CRON_RE`
   only checks 5-field shape today, not the floor it documents.
