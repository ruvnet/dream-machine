# Security-Adversarial / Supply-Chain SOTA Report — 2026

**Repo:** ruvnet/dream-machine · **Date:** 2026-08-18 · **Slot:** 3 (DAYINT % 5)
**DEEP:** security-adversarial · **SCAN:** redblue, supply-chain
**Session commit (baseline):** `8ce385786faa5e63cc0e7105cc6e96f663a51f07`

## TL;DR

`dream.config.json#evaluatorEntrypoints.darwin` — this repo's own real, live Darwin
evaluator entrypoint — is `npx @metaharness/darwin evolve --sandbox mock`, with no
version pin. `npx` resolves the npm registry's `latest` dist-tag fresh on every
invocation and is not governed by this repo's `package-lock.json` (that package isn't
even a declared dependency). Live evidence tonight: `@metaharness/darwin` has shipped
4 published versions and was last published 3 days ago (2026-08-15). Grade-A/B research
confirms this is a live, current attack class (maintainer-account-compromise → malicious
publish → auto-executed by every unpinned `npx` caller), not a hypothetical. Tonight's
candidate adds a pure detector wired into the prompt compiler so every future compiled
nightly routine surfaces this exposure automatically, before an autonomous agent (like
this one) blindly executes an unpinned entrypoint. Detection only — remediation
(pinning/vendoring) is left to human review, matching this repo's ADR-0002 precedent.

## What's New

- New pure module `packages/compile/src/supplychain.ts`:
  `findUnpinnedNpxInvocations(controlPlaneProbes, evaluatorEntrypoints)`.
- Wired into `packages/compile/src/index.ts`'s `step6to9Candidate` section — the
  compiled prompt now includes a `**Supply-chain warning**` block naming any
  offending entrypoint, with no change to which commands are actually executed.
- Honors `npx --package=<spec>` / `-p <spec>` (the flag that overrides which package
  npx actually resolves, independent of the bin-name token on the command line),
  scans `npm exec` as an npx alias, and correctly excludes local-path and git/URL
  package specs (not a registry-`latest` risk).
- 17 new tests (`supplychain.test.ts` ×14, `index.test.ts` ×3), 0 removed/modified.

## Competitors (how peers handle unpinned dynamic tool execution)

| Project | Practice | Grade |
|---|---|---|
| Sakana AI Scientist | No documented entrypoint-pinning discipline found; runs experiment code from generated/cloned sources | C |
| OpenHands | Runtime images are version-tagged (Docker digest pinning for the sandbox), but agent-invoked shell tools are not systematically scanned for unpinned `npx`/`pip run` style calls | C |
| DSPy/GEPA | No evaluator-entrypoint supply-chain check found in official docs | C |
| SWE-agent / SWE-bench | Uses pinned, versioned Docker images per task instance; does not address ad-hoc `npx` invocations because its harness doesn't shell out to arbitrary npm packages | B |
| AutoGPT lineage | Historically broad, unsandboxed exec surface; no known built-in unpinned-invocation detector | C |

No competitor documents a comparable "detect the compiled instructions' own unpinned
dynamic-resolution commands before an agent executes them" step. Closest general
prior art: OWASP's NPM Security Cheat Sheet explicit guidance to pin `npx pkg@version`
instead of `npx pkg@latest` (Grade A, official, cheatsheetseries.owasp.org).

## Hypothesis (frozen before implementation)

> Given a compiled nightly routine prompt whose `evaluatorEntrypoints`/
> `controlPlaneProbes` embed literal shell commands invoking `npx <pkg>` with no
> pinned version, when a pure, deterministic detector classifies each such command
> as PINNED (has an explicit `@<semver>`) vs UNPINNED (no version, or pinned only to
> a floating dist-tag like `@latest`) and this detector is wired into the `compile`
> step to emit a visible warning for every unpinned entrypoint, then every future
> compiled nightly prompt should surface this known supply-chain exposure
> automatically, before an autonomous agent executes it — subject to: no change to
> any existing test, no change to the actual entrypoint commands executed tonight
> (detection only, not remediation), and the detector must be pure/deterministic and
> free of false positives/negatives against this repo's real `dream.config.json`.

Not modified after evaluation began.

## Benchmarks / Evaluation Receipt

Real evaluator: `npm test` (vitest), this repo's own `bench` entrypoint.

| | Baseline (parent, commit `8ce3857`) | Candidate |
|---|---|---|
| Test files | 7 | 8 |
| Tests | 96 | 113 (+17, 0 removed, 0 modified) |
| Result | 96 passed | 113 passed |
| Build (`tsc -b` across all 6 packages) | clean | clean |

Live end-to-end receipt: recompiling this repo's actual `dream.config.json` with the
candidate code adds exactly a 3-line `**Supply-chain warning**` block naming
`evaluatorEntrypoints.darwin` — verified with `diff` against the pre-candidate
compiled output (`git diff` reproducible, see PR).

Darwin evaluator entrypoint probed live tonight (`npx @metaharness/darwin evolve
--sandbox mock`): LIVE, exit 0, produced a real leaderboard + lineage. `DARWIN=not-
applicable` for this candidate itself — a single, already-minimal pure detector
function has no meaningful mutable population for bounded generations×children
search, same rationale as the 2026-08-13 precedent (ADR-0002).

## Evidence

- OBSERVATION (grade A, first-hand): `npm view @metaharness/darwin version` → `0.9.2`;
  `npm view @metaharness/darwin versions --json` → `["0.8.3","0.9.0","0.9.1","0.9.2"]`;
  `npm view @metaharness/darwin time.modified` → `2026-08-15T13:50:27.504Z` (3 days
  before tonight); `npm view @metaharness/darwin dist-tags --json` → only `latest`
  exists, no stable/pinned tag. `npm view @metaharness/darwin maintainers` →
  single maintainer `ruvnet <ruv@ruv.net>`.
- OBSERVATION (grade A/B, web research 2026-08-18): the Shai-Hulud/Miasma npm worm
  lineage has repeatedly compromised maintainer GitHub/npm accounts and
  self-propagated via fresh malicious publishes since late 2025, most recently
  2026-08-04 against a ~127M-weekly-download package family (Aikido Security,
  grade B, cross-checked against Trend Micro/Unit42/Splunk coverage of the same
  campaign — grade B). At least 444 packages across 1381 versions have been hit.
- OBSERVATION (grade A, official): OWASP NPM Security Cheat Sheet
  (cheatsheetseries.owasp.org) states explicitly that `npx` does not consult the
  lockfile and recommends `npx pkg@<version>` instead of `npx pkg@latest`.
- MEASUREMENT: baseline 96/96 tests, candidate 113/113 tests, 0 regressions (see
  Benchmarks above).
- INFERENCE: a single-maintainer, correctly-scoped, non-typosquatted package (this
  repo's own 2026-08-13 supply-chain scan conclusion for `@metaharness/*`) is still
  fully exposed to this class of attack, because the exposure is about *pinning*,
  not *identity* — the two are independent risk dimensions.
- DECISION: ship the detector as a compile-time warning (visibility), not a silent
  auto-pin (remediation stays a human/PR decision) — consistent with ADR-0002's
  "classify, never silently trust or silently fix" precedent.

## Reward-Hack Check (independent critic, separate agent context)

**Verdict: CLEAR** of reward-hacking after one fix-and-reverify round.
Independent critic (fresh subagent, not this candidate's author) verified the diff
directly (`git diff`, file reads, its own `npx vitest run`), confirmed no
gold/threshold/gate/automerge-protected path was touched, and confirmed the golden
snapshot test was untouched (the existing fixture has no `npx` entrypoint, so the new
code path is exercised only by new, honestly-separate test configs, not by mutating
the golden fixture). It flagged real correctness bugs, not reward-hacking:

1. **False positive**: `npx --package=@metaharness/darwin@0.9.2 darwin-evolve` (pinned)
   was incorrectly flagged, because the original code took the *next* token after
   `npx` as the package spec rather than honoring `--package=`.
2. **False negative (serious)**: `npx --package=@metaharness/darwin run@1.0` (genuinely
   unpinned) produced zero findings, because the bin-name token `run@1.0` was checked
   instead of the actual `--package=` value.
3. **Scope gap**: `npm exec @metaharness/darwin` (npm's own alias for `npx`, same
   floating-resolution risk) was never scanned — only the literal `npx` token matched.
4. **Misleading message**: `npx ./scripts/tool.js` (a local file, no registry
   involved) was flagged with text claiming it "resolves the registry `latest`
   dist-tag", which is false for a local-path invocation.

All four were reproduced live by the critic against the actual function (not just
reasoned about), fixed in `packages/compile/src/supplychain.ts`
(`extractPackageSpec` now honors `--package=`/`-p`/`--package <spec>`;
`isLocalOrRemoteSpec` excludes local/git/URL specs; the `npx` match now also accepts
`npm exec`), and independently re-verified tonight by re-running the critic's exact
four repro command strings directly against the rebuilt code (see PR — all four now
resolve correctly). Six new regression tests lock in the fixes. Full suite re-run
after the fix: 113/113 passed, 0 regressions, clean build.

## Security Review

No prompt injection surface (no LLM calls in this candidate). No tool/MCP authority
change. No credential exposure — the detector only reads `dream.config.json` string
fields already loaded by the existing `compile()` call, no new file/network access.
No filesystem or network I/O added (`findUnpinnedNpxInvocations` and
`extractPackageSpec`/`isUnpinned`/`isLocalOrRemoteSpec` are pure string functions).
No change to `io.exec`/`verify-entrypoint`'s shell-exec path — this candidate adds
detection text to the generated prompt only; it does not touch what actually gets
executed. No agent impersonation, no benchmark/ledger poisoning (ledger and corpus
files untouched by this diff). Supply-chain exposure is the subject of the finding,
not introduced by it — the candidate reduces (does not increase) blind trust in an
unpinned entrypoint by surfacing it before an agent relies on its result.

## Scan Findings

**redblue**: not independently re-probed tonight (candidate scope stayed on
supply-chain per the frozen hypothesis; re-running the identical 2026-08-13
`suspicious-silent` finding without new evidence would be a rediscovery, not a new
measurement — explicitly avoided per STEP 2's "do not rediscover a failed direction
unless new evidence justifies reopening it").

**supply-chain**: this report's whole subject — `evaluatorEntrypoints.darwin`'s
unpinned `npx @metaharness/darwin` invocation is a live, current exposure (evidence
above). New: this is a *pinning* gap, orthogonal to the *identity* finding
(no typosquat/dependency-confusion risk) the 2026-08-13 scan already closed for the
same package family — both can be true at once, and only the second was addressed
before tonight.

## Gist

No gist-creation MCP tool is available in this session (no `gh` CLI either). Report
committed instead at `docs/dream-cycle/2026-08-18-security-adversarial-report.md`.
`GIST=LOCAL`.

## Witness

`dream-machine witness stamp` hashes this exact file's raw bytes, so the stamp
cannot be written *inside* the file it stamps (editing the file after hashing
would invalidate the hash against the committed bytes — same self-reference
issue already documented in `docs/dream-cycle/2026-08-13-security-adversarial-report.md`).
The stamp is therefore computed over this file frozen exactly as it reads at
this point, and published instead in the PR description and the LEDGER.md row,
both of which point back at this file (committed at
`docs/dream-cycle/2026-08-18-security-adversarial-report.md`) by path and
session commit. Anyone can independently reproduce it:

```bash
sha256sum docs/dream-cycle/2026-08-18-security-adversarial-report.md   # REPORT_HASH
printf '%s%s' "$REPORT_HASH" "8ce385786faa5e63cc0e7105cc6e96f663a51f07" | sha256sum
# must equal the WITNESS value published in the PR body and LEDGER.md
```

## 3 Concrete Next Steps

1. **Human decision on remediation**: pin `dream.config.json#evaluatorEntrypoints.darwin`
   to an exact version (e.g. `npx @metaharness/darwin@0.9.2 evolve --sandbox mock`), or
   vendor `@metaharness/darwin` as a real, lockfile-pinned `devDependency` and invoke it
   via `node_modules/.bin/` instead of `npx`. This candidate intentionally does not do
   this itself (detection vs. remediation stays separated, human-decided).
2. **Extend the detector's scope check** to `controlPlaneProbes`/`evaluatorEntrypoints`
   entries that use `pip run`/`uvx`/`bunx`-style equivalents if/when this repo's
   evaluators grow beyond the npm ecosystem — out of scope tonight (no such entrypoint
   exists yet), tracked here so a future night doesn't have to rediscover the pattern.
3. **Re-probe `npx @metaharness/redblue`** on a future security-adversarial night to
   check whether the 2026-08-13 `suspicious-silent` finding still reproduces on
   `redblue@0.1.6` (current registry version, confirmed tonight) — skipped tonight to
   keep this candidate's scope to exactly one conceptual change.
