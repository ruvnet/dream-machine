# Compiler-Parity SOTA Report — 2026

## TL;DR

`validateConfig()` in `@dream-machine/compile` checks that a rotation slot's
`scan` array has `length >= 1` and that `deep` is truthy, but never checks
that individual `scan` entries (or `deep`) are non-blank strings. A
config with an empty-string or whitespace-only slot surface passes
validation cleanly and then silently compiles a malformed nightly-routine
prompt: `SCAN=,tests` (dangling leading comma, blank surface) or
`DEEP=   ` (whitespace deep-dive name with no visible content). This is the
same defect class as prior ACCEPTed compiler-parity fixes on this repo's
own `main` — the cron minute field (PR #24), `adrConvention` shape
(issue #28/PR #29), and `bonusModuli` values (issue #78/PR #79), all three
already merged — extended to the one remaining unchecked field group in the
same validator.

**Correction note (mid-session):** this session initially built its
candidate on a stale local `main` ref (`7933c35`) that had diverged from the
real `origin/main` (`3edd426`) by roughly 50 commits, including several
compiler-parity fixes this session's earlier evidence-gathering had (wrongly)
recorded as still open. The divergence was caught via `mergeable_state:
dirty` on the opened PR, immediately after which the branch was merged onto
the real `origin/main`, every claim re-verified against the true merged
history, and all counts below re-measured against the correct base. The
underlying finding (blank `slots[].deep`/`scan[]` entries pass validation)
remained true and non-duplicate against the real history; only this
session's situational-awareness claims needed correction, not the code fix.

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
first-hand reproduction against this repo's own code, which is what the
ACCEPT verdict rests on, not the competitor table.

## Hypothesis (frozen before implementation)

> Given a `dream.config` whose `slots[i].scan` array contains an empty-string
> or whitespace-only entry, or whose `slots[i].deep` is a whitespace-only
> string, when `validateConfig()` is extended to reject blank surface names
> in both fields, then `validateConfig` should report `ok: false` with a
> specific per-slot error for such configs, and `compile()` should never
> again be reachable with a blank `SCAN=` segment or blank `DEEP=` line for
> any config that passes validation — subject to: 0 regressions on the
> existing (later confirmed: 616 vitest + 81 governance = 697) tests, no
> change to any currently-valid config's validation result or compiled
> output (self-hosted `dream.config.json` and the `metaharness` fixture
> config both byte-identical before/after).

## Benchmarks / Evaluation

Real evaluator: `npm test` (`vitest run && npm run test:governance`).

Baseline, true `origin/main @ 3edd426` (verified via a clean `git worktree`
+ `npm ci` + build, not inferred from a stale local ref): **616 vitest +
81 governance = 697/697 green**.

Candidate (this branch, merged onto `3edd426`): **619 vitest + 81
governance = 700/700 green (+3, 0 regressions)**.

Live pre-fix reproduction (grade A, first-hand, this session, against the
real `3edd426` source before the fix was written):

```
$ node -e "... cfg.slots[0].scan = ['', 'tests']; validateConfig(cfg) ..."
validation: {"ok":true,"errors":[],"warnings":[]}
compiled SCAN line -> "   SCAN=,tests"

$ node -e "... cfg.slots[1].deep = '   '; validateConfig(cfg) ..."
validation (whitespace deep): {"ok":true,"errors":[],"warnings":[]}
compiled DEEP line -> "1: DEEP=   "
```

Self-hosted `dream.config.json` compile output confirmed byte-identical
before/after via a clean baseline `git worktree` rebuild (it was already
well-formed, so no behavior change for the real config).

## Witness

See STEP 16 below (this file's own witness section, rewritten post-stamp,
recomputed after the merge onto the true `origin/main`).

## Next steps

1. Extend `validateConfig`'s existing per-slot loop to reject blank
   (`''`/whitespace-only) `scan` entries and tighten `deep`'s truthiness
   check to also reject whitespace-only strings — one conceptual change,
   reusing the established per-field-blank-check pattern already merged
   for `bonusModuli` values and `adrConvention`'s shape.
2. Add regression tests mirroring the existing `validateConfig` test
   block's style (merged neighbors: "rejects an empty bonus modulus
   value", "rejects a whitespace-only adrConvention.dir").
3. Independently double-check any future night's "prior work" claims
   against a fresh `git fetch origin main` before trusting a long-lived
   local checkout — this session's own stale-base incident is worth
   recording as a `developer-experience`/`ledger-signals` candidate for a
   future night: nothing in the compiled routine prompt currently tells
   the agent to distrust a pre-provisioned local `main` that merely
   *looks* like it tracks `origin/main`.

---

## Witness

```
report_sha256 : 1c9ec5548ffab1370fadcaf24961a5779b0eaf52690b9314a6483d5e572bec2b
session_commit: 3edd426f6c9c4b1e80235f7447dc863e749345cc
witness       : 2a3fe805af29fc4895d301ae8272ee94423a9af80e34fbc5a18e4fb50a0805e6
```

Verify (5 steps, coreutils only): take this file's content up to (not
including) this `## Witness` section's leading `---`, `sha256sum` it — must
equal `report_sha256` above. Then `printf '%s%s' "<that hash>"
"3edd426f6c9c4b1e80235f7447dc863e749345cc" | sha256sum` — must equal
`witness` above. Reproduced live this session via
`node packages/cli/dist/bin.js witness stamp <prewitness-file>
3edd426f6c9c4b1e80235f7447dc863e749345cc`.
