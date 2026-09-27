# Evaluation-Adapters SOTA Report — 2026

**Repo**: `ruvnet/dream-machine` · **Night**: 2026-09-27 · **DEEP**: evaluation-adapters · **SCAN**: flywheel, darwin · **Slot**: 2 (of 5, `DAYINT % 5`) · **Bonus moduli**: none (`DAYINT % 25 = 2`, `DAYINT % 75 = 52`) · **Session commit**: `9ebc9b66cfdd7f5d9f11ffafa5675239c58a456c`

## TL;DR

`bin.ts`'s `io.execFile` wrapper — the real IO backing the `verify-entrypoints`
command (PR #116, 2026-09-17) — silently discards the diagnostic when a
configured `evaluatorEntrypoints` command doesn't exist on PATH. Node's
`execFile` (no shell) leaves a spawn failure's `err.stdout`/`err.stderr` as
empty strings; only `err.code` (a string like `'ENOENT'`, never numeric) and
`err.message` ("spawn foo ENOENT") carry the real diagnostic. The prior code
coerced any non-numeric `err.code` to a bare `1` and passed through the empty
stderr, so `classifyEntrypointResult` reported "blocked (exit 1) — exited 1
with no stderr" — indistinguishable from a command that actually ran and
silently exited 1. Confirmed live, both pre- and post-fix, against the real
built CLI. `exec` (the shell-based sibling used by `verify-entrypoint`
singular) was already unaffected: a shell absorbs a missing command into a
real numeric exit code (127) plus its own stderr line, confirmed live too.

`bin.ts` had zero test coverage before tonight (no `bin.test.ts` existed) —
it is the one file wiring every CLI command to real Node child processes and
the filesystem, and the actual evidence trail this pipeline depends on runs
through it every night. Making it testable required two small, mechanical
prerequisites, bundled here rather than as separate candidates because
neither is independently useful or a second finding: (1) extract the inline
`io` object literal into an exported `createIO()` factory (same object,
zero behavior change) so tests can construct a real IO instance; (2) guard
the module's top-level `run(...).then(...).process.exit(...)` side effect so
importing the file for its factory doesn't actually execute the CLI and kill
the test process. That guard deliberately does not use the bare
`import.meta.url === \`file://${process.argv[1]}\`` idiom — this repo's own
ADR-0002 already diagnosed exactly that comparison as broken once the
executable is reached through the symlink `npm`/`npx` create for a package's
`bin` field, and this package's own `package.json` declares
`"bin": {"dream-machine": "dist/bin.js"}`, so it is exposed to the identical
failure mode. Resolved both sides through `realpath()` first instead —
verified live through a manually reproduced symlink invocation.

## What's new tonight

- First test coverage of any kind for `packages/cli/src/bin.ts` (the real
  Node IO wiring; every other CLI test exercises `run()` against a mocked
  `IO`).
- Live-reproduced, against the built pre-fix `dist/bin.js`, the exact
  misleading diagnostic: `verify-entrypoints` on a config pointing at a
  nonexistent command reported `blocked (exit 1) — exited 1 with no stderr`.
  Post-fix, the same command reports
  `blocked (exit 1) — spawn this-command-does-not-exist-xyz ENOENT`.
- Live-reproduced the asymmetry between `exec` (shell, unaffected: missing
  command → numeric 127 + shell stderr) and `execFile` (no shell, affected:
  missing command → string `'ENOENT'` + empty stdout/stderr) that explains
  why only the `execFile` path needed a fix.
- Live-verified the symlink-safe entry-point guard against the actual failure
  mode ADR-0002 describes: invoking the built `dist/bin.js` through a
  manually created symlink (reproducing what `npm`/`npx` do for this
  package's own declared `bin` field) still dispatches correctly.

## Competitors (context only; none benchmarked against)

| System | Grade | Relevant precedent |
| --- | --- | --- |
| Sakana AI Scientist | C | No public documentation distinguishing "the evaluator command never ran" from "it ran and failed" in its own harness-execution layer. |
| OpenHands | C | Action-execution errors are generally surfaced as raw exceptions/tool-call failures rather than classified by spawn-vs-exit semantics. |
| DSPy/GEPA | C | Metric/evaluator failures during optimization are typically treated as a single failure signal, not differentiated by root cause. |
| SWE-agent | C | Command-execution wrapper reports raw shell output; no public evidence of a dedicated spawn-failure vs. real-failure distinction. |

C-grade across the board (single-source, no reproducible public spec found
for this exact distinction) — informs only that this is a narrow,
repo-specific hardening, not a claim of novel general technique.

## Hypothesis (frozen before implementation)

See `/tmp/dream-hypothesis-2026-09-27.md`, reproduced here:

> Given `bin.ts`'s `io.execFile` wrapper, when the configured command does
> not exist on PATH (or otherwise fails to spawn), then the current fallback
> `code = typeof err.code === 'number' ? err.code : 1` combined with
> `stdout: err.stdout ?? ''` / `stderr: err.stderr ?? ''` silently discards
> the real diagnostic, because Node leaves `err.stdout`/`err.stderr` as
> empty strings (not undefined) for a spawn failure. Fix: when `err.code` is
> not a number, fall back to `err.message` for `stderr`. Subject to: a
> successful execFile invocation is byte-identical to today; a real
> nonzero-exit invocation (process spawns fine) is unaffected; `exec`'s
> behavior is unchanged; `npm test` stays green with 0 regressions
> regardless of outcome; making `bin.ts` testable is a necessary, minimal,
> mechanical prerequisite, not a second finding.

Not modified after evaluation began.

## Candidate

`packages/cli/src/bin.ts` (+82/−40) and new `packages/cli/src/bin.test.ts`
(88 lines total, added across two rounds — see Reward-Hack Check) — 210
changed lines across 2 files. One conceptual change (the `execFile`
spawn-diagnostic fix) plus its two necessary, mechanical, bundled
prerequisites (the `createIO()` extraction and the symlink-safe entry-point
guard), all required to make the fix testable and safely importable at all.

```ts
// before (both exec and execFile shared this shape):
const code = typeof err.code === 'number' ? err.code : 1;
return { code, stdout: err.stdout ?? '', stderr: err.stderr ?? '' };

// after (execFile only):
const code = typeof err.code === 'number' ? err.code : 1;
const stderr = err.stderr || (typeof err.code === 'number' ? undefined : err.message) || '';
return { code, stdout: err.stdout ?? '', stderr };
```

`exec`'s catch block is untouched — already correct (shell absorbs the
spawn failure into a real exit code and message).

## Baseline

Parent commit `9ebc9b66cfdd7f5d9f11ffafa5675239c58a456c` (`main`), rebuilt
clean (`npm ci && npm run build`), 755 vitest + 150 governance = 905/905
tests green.

## Evaluation Receipt

Real evaluator: `npm test` (`vitest run && npm run test:governance`), this
repo's own `bench` entrypoint.

| | Baseline (`main@9ebc9b6`) | Candidate (round 2, post-critic) |
|---|---|---|
| vitest | 755 | 762 (+7 new, 0 regressions) |
| governance | 150 | 150 (unchanged) |
| Total | 905 | 912 |
| `npm run typecheck` | clean | clean |
| `npm run lint` | clean | clean |

Live pre/post-fix proof (`git stash push -u -- packages/cli/src/bin.ts
packages/cli/src/bin.test.ts`, rebuild, repro, `git stash pop`, rebuild):

```
$ node packages/cli/dist/bin.js verify-entrypoints /tmp/bad.config.json   # evaluatorEntrypoints.bad = nonexistent command
# BASELINE (pre-fix):
bad: blocked (exit 1) — exited 1 with no stderr

# CANDIDATE (post-fix):
bad: blocked (exit 1) — spawn this-command-does-not-exist-xyz ENOENT
```

Live entry-point-guard proof (symlink invocation, reproducing the exact
ADR-0002 failure shape):

```
$ ln -sf packages/cli/dist/bin.js /tmp/symlink-test/dream-machine-link
$ node /tmp/symlink-test/dream-machine-link version
0.1.2   # exit 0 — dispatches correctly through the symlink
```

Live real-CLI regression check (unrelated commands unaffected):

```
$ node packages/cli/dist/bin.js version
0.1.2
$ node packages/cli/dist/bin.js ledger signals --path docs/dream-cycle/LEDGER.md
{ "zeroMergeStreak": true, ... }   # unchanged output
```

Darwin entrypoint (supporting evidence only, not the code candidate — this
repo's own `dream.config.json` darwin entry, live tonight):

```
$ rm -rf .metaharness && npx --yes @metaharness/darwin evolve . --sandbox mock
Winner: g2_v5 · Lineage: baseline → g1_v0 → g2_v5 · Delta over baseline: +0.110 · EXIT=0
```
`git status --porcelain` after: clean (`.metaharness/` gitignored).

## Darwin Lineage

`DARWIN=not-applicable` — a spawn-diagnostic fallback plus a mechanical
testability refactor has no evolvable population to fitness-search, same
judgment as every prior single-conceptual-change candidate on this surface
(#116, #127, #132).

## Evidence

OBSERVATION (`bin.ts` has zero existing test file, confirmed via
`ls packages/cli/src/*.test.ts`) → OBSERVATION (live repro:
`execFile` on a nonexistent command yields `code: 'ENOENT'`, empty
stdout/stderr; `exec` on the identical command yields `code: 127`, real
shell stderr) → MEASUREMENT (baseline vs. candidate CLI output on the same
bad-config repro) → MEASUREMENT (905 → 912 tests, 0 regressions) →
MEASUREMENT (symlink invocation dispatches correctly) → INFERENCE
(independent critic subagent, separate context) → DECISION (verdict
ACCEPT).

## Reward-Hack Check

Independent adversarial-critic subagent (separate context, full repo read
access, instructed to distrust this session's own framing): reviewed
`bin.ts`'s full diff against `main`, the new `bin.test.ts`, and the
unmodified consumers (`entrypoint.ts`, `index.ts`'s `verify-entrypoints`
command).

**Verdict: CLEAR**, one moderate gap flagged (closed same session, see
below).

What the critic independently verified, empirically, not just by reading:
1. **Non-tautology of the core fix.** Reverted only `bin.ts`'s fixed stderr
   line back to the pre-fix form and reran `bin.test.ts`: the ENOENT test
   failed exactly as expected (`expected '' to match /ENOENT/`); restoring
   the fix made all tests pass again. Rules out a test that would pass
   against unfixed code.
2. **`createIO()` extraction is behavior-preserving**: `readFile`/
   `writeFile`/`readEvidenceFile`/`now`/`env`/`exec` byte-for-byte unchanged;
   only `execFile`'s catch block changed, in the documented way.
3. **`isEntryPoint()` correctness**, live: built the project and ran
   `node packages/cli/dist/bin.js --help` directly (works — the real
   deployment path); separately created a symlink and invoked through it
   (reproduces the ADR-0002 npm/npx-bin-symlink shape — also works); confirmed
   importing `bin.ts` from vitest does not trigger `run()`/`process.exit()`
   (the guard fails closed as intended).
4. Full `packages/cli` suite green post-build.
5. **Security**: no new attack surface — `process.argv[1]`/`import.meta.url`
   are both the tool's own trusted invocation path, not attacker input; a
   hypothetical symlink race between the two `realpath` calls could at worst
   cause the guard to wrongly refuse to run (denial-of-service on the CLI
   itself), never an escalation; the `catch { return false }` is fail-closed.
6. **Scope justified**: the guard and `createIO()` are load-bearing
   infrastructure for `bin.test.ts` to exist at all, not padding.

**Gap disclosed by the critic**: `isEntryPoint()` — "the single
highest-consequence piece of new logic in the diff" — had zero automated
coverage; only manually verified. **Closed same session**: added
`describe('bin.js entry-point dispatch ...')` to `bin.test.ts`, spawning the
actual built `dist/bin.js` as a real child process both directly and through
a symlink (`mkdtempSync` + `symlinkSync`), asserting real dispatch (`version`
prints a semver string) in both cases — the exact two scenarios the critic
manually checked, now locked in as regression tests. `npm test`: 905 → 912
(+7 total across both rounds), 0 regressions.

No benchmark/gold data touched (none exists for this surface); no
cherry-picked assertions; no evaluator exploit; no hidden cost (no new
dependency — `node:child_process`/`node:fs`/`node:os`/`node:path` are all
built-in); no undocumented cache; no threshold changed.
`reward_hack_clear` / `critic_clear`.

## Security Review

No credential, network, or trust-boundary surface added. `execFile` already
ran with no shell (unchanged); the fix only changes what string ends up in
the `stderr` field of an already-computed result — it cannot make a
previously-safe invocation newly unsafe (it never adds a code path that
executes anything). `realpath()` on `process.argv[1]` reads local filesystem
metadata for a path Node itself already resolved to invoke this process;
resolving symlinks before comparing narrows the definition of "am I the
entry point," it does not widen any execution authority (if `realpath`
throws — e.g. permission error — `isEntryPoint()` fails closed, returning
`false`, so the worst case is the CLI would not dispatch rather than
dispatching when it shouldn't; live-verified the real invocation path does
not hit that branch). No LLM calls in this path (`OPENROUTER_API_KEY`
present, correctly unused — this finding needed no model call to test).

## Regression Analysis

0 pre-existing tests modified or removed. All 905 baseline tests
(755 vitest + 150 governance) pass unchanged; 7 new vitest tests added
(3 for `execFile`'s live/exit-nonzero/spawn-failure paths, 2 for `exec`'s
live/missing-command paths proving `exec` needed no fix, 2 for
`isEntryPoint()`'s real-dispatch and symlink-dispatch paths added in
round 2 per the critic's disclosed gap). `npm run lint` and
`npm run typecheck` clean. `npm run build` clean (all packages, no
wasm/NAPI degradation to record tonight — the same `npm ci && npm run build`
this whole session ran at STEP 0.5).

## ADR

None — a diagnostic-accuracy bug fix plus a mechanical testability
refactor, not a new architectural decision or repo-wide invariant. Matches
the precedent of every prior single-file evaluation-adapters/compiler-parity
fix on this ledger (none of which added an ADR).

## Gist

`GIST=LOCAL` — no `gh` CLI and no gist-creation MCP tool available this
session (GitHub access here is via MCP tools scoped to
`ruvnet/dream-machine`, which expose no Gist API). Report committed at
`docs/dream-cycle/2026-09-27-evaluation-adapters-report.md`.

## Witness

Per this repo's established convention: the witness triple is **not**
embedded in this report file (that would be self-referential against the
committed bytes). Published in the PR body and `LEDGER.md` instead.
