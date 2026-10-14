# Developer-Experience SOTA Report — 2026

## TL;DR
`dream-machine verify-entrypoint <label> --cmd` silently accepts a bare,
value-less `--cmd` flag (nothing after it, or another `--flag` right after)
and misreports a misleading `blocked` entrypoint-liveness verdict instead of
a usage error. The bug sits on this repo's own nightly-pipeline liveness gate
(`verify-entrypoint`/`verify-entrypoints`), the same command this very
pipeline's STEP 0.5 recommends probing control-plane capabilities with.

## What's new
Three other developer-experience CLI flag-parsing bugs are already filed and
open on this exact surface (PR #180 `--max-age` numeric coercion, PR #161
nine `(flags.X as string) || fallback` call sites, PR #141 `--no-color`
strict-equality leak). This is a fourth, distinct defect: a *requiredness*
check bypassed by a boolean, on a command none of the three above touch.

## Competitor / prior-art rows (grade C — internal precedent, not external
literature; this finding is self-contained to this repo's own CLI code, not
a claim requiring external benchmarking)
| Precedent | What it covers | Grade |
|---|---|---|
| PR #161 (2026-10-09, this repo) | 9 `(flags.X as string) \|\| fallback` sites; explicitly disclosed this exact `verify-entrypoint --cmd` gap as an unclaimed follow-up and never filed it | A (reproducible, same repo) |
| PR #180 (open) | `--max-age`: `Number(true)===1` numeric-coercion bug, same family (bare flag → wrong truthy value), different parser path | A |
| PR #141 (open) | `--no-color === true` strict-equality leak in TUI, different subsystem (rendering, not arg validation) | A |
| Node.js `util.parseArgs` (stdlib) | Its own boolean-vs-string flag typing exists to prevent exactly this class of bug; this repo's hand-rolled `parseArgs` (packages/cli/src/index.ts:88) predates adopting it | A |

## Frozen hypothesis (frozen before any code change)
> Given `dream-machine verify-entrypoint <label> --cmd` invoked with `--cmd`
> as a value-less flag (end of argv, or immediately followed by another
> `--flag`, so `parseArgs` yields `flags.cmd === true`), when the
> requiredness guard at `packages/cli/src/index.ts:465` is changed from
> truthiness (`!cmd`) to a real type check (`typeof cmd !== 'string'`), then
> the invocation should emit the usage error (exit 1, stderr containing
> `usage:`) instead of reaching `io.exec(cmd)` and producing a misleading
> `blocked (exit 1) — exited 1 with no stderr` liveness verdict — with zero
> change in behavior for every other `verify-entrypoint` case (live, blocked
> on a real command, suspicious-silent, stale-state, no-`exec()` IO, and the
> unquoted-multi-word-positional rejection).

## Benchmark / evaluation corpus
Real evaluator: `npx vitest run` (809 tests) + `node --test scripts/*.test.mjs`
(195 governance tests) = 1004/1004 baseline, 0 failures, confirmed on this
commit after `git fetch --unshallow` (the shallow-clone `git show` oracle
failure, issue #149/PR #150, is a known pre-existing/unrelated finding on a
different surface, not touched tonight).

## Evaluation
See Evaluation Receipt in the PR body (live repro against the actual built
`packages/cli/dist/bin.js`, plus an added regression test).

## 3 concrete next steps
1. Audit every other CLI flag this codebase treats as string-required via
   truthiness (`!flag`) rather than `typeof flag !== 'string'` — this is the
   second instance of the pattern (after #161's 9 sites) and may not be the
   last.
2. Consider replacing the hand-rolled `parseArgs` with Node's built-in
   `util.parseArgs`, which distinguishes boolean and string flag types at
   the parser level and would make this entire bug class structurally
   impossible instead of requiring per-call-site vigilance.
3. `classifyEntrypointResult`'s `blocked`/`exited 1 with no stderr` message
   is indistinguishable between "entrypoint is genuinely dead" and "caller
   misused the CLI" — consider having `io.exec` surface a distinguishable
   error shape for non-string commands specifically, as defense in depth
   beyond the input-validation fix.

## Witness

```
report_sha256 : 4c4e85ad532e553be4820ce8494dacd6edf909f04356aaa0bfe32999fbf75c25
session_commit: b2abcc14a632d7e0948962065a7c6c8920cf306c
witness       : 4c8277be28712c3afe9f7ba90f4a02bfe8a8bcf7edfcd099cd5dc057728b5dfd
```

Computed over this file's canonical bytes (everything above this heading,
trailing whitespace collapsed to one newline) — reproducible from the
committed file with no unavailable intermediate bytes. Verify:

```bash
dream-machine witness verify-report docs/dream-cycle/2026-10-14-developer-experience-report.md --commit b2abcc14a632d7e0948962065a7c6c8920cf306c
```

Independent reproduction of the underlying fix: `git checkout b2abcc1 -- packages/cli/src/index.ts`
restores the pre-fix behavior, where `node packages/cli/dist/bin.js verify-entrypoint redblue --cmd`
prints a misleading `blocked` verdict; applying this PR's diff on top restores the correct
`usage:` error.
