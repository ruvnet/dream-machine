# Compiler-Parity SOTA Report — 2026

## TL;DR

`validateConfig()` in `@dream-machine/compile` checks that a rotation slot's
`scan` array has `length >= 1` and that `deep` is truthy, but never checks
that individual `scan` entries (or `deep`) are non-blank strings. A
config with an empty-string or whitespace-only slot surface passes
validation cleanly and then silently compiles a malformed nightly-routine
prompt: `SCAN=,tests` (dangling leading comma, blank surface) or
`DEEP=   ` (whitespace deep-dive name with no visible content). This is the
same defect class as three prior ACCEPTed compiler-parity nights — the cron
minute field (PR #24, merged), `adrConvention` shape (issue #28/PR #29,
open), and `bonusModuli` values (issue #78/PR #79, open) — extended to the
one remaining unchecked field group in the same validator.

## What's new

Nothing external — this is an internal-only, self-hosting finding scoped to
this repo's own `@dream-machine/compile` package, discovered by systematically
walking every field `validateConfig` does *not* check against every field the
compiled template actually interpolates unescaped.

## Competitors (how comparable systems guard config→prompt compilation)

| System | Guard against blank/degenerate structured-config fields | Grade |
|---|---|---|
| Sakana AI Scientist | Config loaded via Hydra/OmegaConf; relies on YAML schema + Python type hints, no explicit blank-string rejection in the loop-config path (community reports of silent empty-list bugs in structured configs) | C (community reports, not audited firsthand) |
| OpenHands | Its `config.toml` loader validates types via Pydantic, which by default treats an empty `str` as a *valid* string unless `min_length=1` is set per field | B (public docs/source, cross-checked against pydantic defaults) |
| DSPy/GEPA | GEPA's mutation/config surface is typically Python objects, not a serialized schema boundary, so this exact class (JSON config → templated prompt with unchecked blank fields) doesn't directly apply | C (inference from public repo structure) |
| SWE-agent | YAML task configs are loaded via a schema class; empty-string fields in list-typed config keys are not rejected by default in observed configs | C (single-source, not independently reproduced) |
| AutoGPT lineage | JSON/YAML agent configs historically accepted blank list entries silently (well-known class of "empty step" bugs in early AutoGPT forks) | C (community/single-source) |

No competitor evidence is graded A — this finding is validated entirely by
first-hand reproduction against this repo's own code (see Evaluation below),
which is what the ACCEPT verdict below rests on, not the competitor table.

## Hypothesis (frozen before implementation)

> Given a `dream.config` whose `slots[i].scan` array contains an empty-string
> or whitespace-only entry, or whose `slots[i].deep` is a whitespace-only
> string, when `validateConfig()` is extended to reject blank surface names
> in both fields (mirroring the existing non-empty check pattern already
> used for `slot.deep`'s truthiness and `bonusModuli` keys), then
> `validateConfig` should report `ok: false` with a specific per-slot error
> for such configs, and `compile()` should never again be reachable with a
> blank `SCAN=` segment or blank `DEEP=` line for any config that passes
> validation — subject to: 0 regressions on the existing 98 tests, no change
> to any currently-valid config's validation result or compiled output
> (self-hosted `dream.config.json` and the `metaharness` fixture config both
> byte-identical before/after).

## Benchmarks / Evaluation

Real evaluator: `npm test` (vitest, 98 tests on baseline `HEAD=7933c35`).
Live pre-fix reproduction (grade A, first-hand, this session):

```
$ node -e "... cfg.slots[0].scan = ['', 'tests']; validateConfig(cfg) ..."
validation: {"ok":true,"errors":[],"warnings":[]}
compiled SCAN line -> "   SCAN=,tests"

$ node -e "... cfg.slots[1].deep = '   '; validateConfig(cfg) ..."
validation (whitespace deep): {"ok":true,"errors":[],"warnings":[]}
compiled DEEP line -> "1: DEEP=   "
```

Both are config states no repo maintainer would author on purpose, but
nothing in the schema, the CLI, or CI rejects them — and if `dream.config.json`
for any Dream-Machine-managed repo (this one included) is hand-edited and a
scan/deep field accidentally lands blank (e.g. a bad find/replace, a JSON
array reformat, a merge conflict resolved wrong), the nightly routine
silently degrades instead of failing loud.

## Witness

See STEP 16 below (this file's own witness section, rewritten post-stamp).

## Next steps

1. Extend `validateConfig`'s existing per-slot loop to reject blank
   (`''`/whitespace-only) `scan` entries and tighten `deep`'s truthiness
   check to also reject whitespace-only strings — one conceptual change,
   reusing the established per-field-blank-check pattern.
2. Add regression tests mirroring the existing `validateConfig` test block's
   style (`rejects a non-integer bonus modulus key` neighbor).
3. Do **not** duplicate the two already-open, already-ACCEPTed sibling
   findings in this same file (issue #28/PR #29 `adrConvention` shape,
   issue #78/PR #79 `bonusModuli` values) — both remain open for human
   review; this candidate is scoped to the one remaining gap in the same
   validator, not a re-submission of either.

---

## Witness

```
report_sha256 : 196cd963b339a38e4cb2bffd697ef2967c1e931fc7a8f670e980066c4290e37b
session_commit: 7933c3599abe22df5290f4609d1f93f598feb3de
witness       : 2eae81eb6c138360f60e395e06d33cce59cc4cfe5f511c91f4878601505d3036
```

Verify (5 steps, coreutils only): take this file's content up to (not including)
this `## Witness` section's leading `---`, `sha256sum` it — must equal
`report_sha256` above. Then `printf '%s%s' "<that hash>" "7933c3599abe22df5290f4609d1f93f598feb3de" | sha256sum` — must equal `witness` above. Reproduced live this session via `node packages/cli/dist/bin.js witness stamp <prewitness-file> 7933c3599abe22df5290f4609d1f93f598feb3de`.
