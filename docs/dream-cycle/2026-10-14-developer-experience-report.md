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

## Consolidation refresh — 2026-11-01

MODE=CONSOLIDATE (STEP 1.5, ADR-0011): 19 open `dream/*` candidate PRs tonight,
well over `implementationTrack.reviewBacklogLimit=6`. The eight nearer-the-front
eligible drafts — #145, #148, #150, #152, #154, #158, #161, #180 — each already
carry a `dream-consolidate` marker for today's exact default-branch SHA
(`3fc3222d2e5566a203331d3686c4d2eaf06713a8`) from eight preceding nights (`main`
has not moved since `#196`, landed 2026-10-19). This PR was the oldest
still-eligible draft (still draft, ACCEPT in its own Evaluation Receipt, not a
`routine-self-review` PR) carrying no prior consolidate marker at all. #139 is
REJECT and excluded; #98/#101 are multi-repo portfolio branches, not
single-surface candidates; #137/#141/#156 are already out of draft.

**Action.** Merged `main` (`3fc3222d2e5566a203331d3686c4d2eaf06713a8`) into this
branch with an ordinary merge commit (`1d563fae7975abb8c32f72455404ca47999fba2d`,
never rebase, never force-push). **Zero textual conflicts** — including in
`docs/dream-cycle/LEDGER.md` and `packages/cli/src/index.ts`/`index.test.ts`
(this candidate's only files), despite substantial intervening `main` history
on both (the Dream Cycle v2 engine landing in #195/#196, plus later ledger
outcomes/backlog additions). Confirmed via
`grep -n "typeof cmd" packages/cli/src/index.ts` that the candidate's own fix
(`if (!label || typeof cmd !== 'string' || !cmd)`) is present, unaltered, in the
merged file.

**Re-evaluation on the new head.** Real evaluator (`npm test`): this session's
checkout started shallow — the first run showed the standard 3 pre-existing
`BASELINE_COMMIT`-unreachable governance failures
(`scripts/benchmark-ticket-codec.test.mjs`, `git show <sha>` on a path absent
from the shallow clone); resolved with `git fetch --unshallow` (no code
change), the same already-tracked class as issue #149/open draft PR #150, not
duplicated here. On the unshallowed, merged head: vitest 888/888, governance
195/195, **0 regressions**. `npm run typecheck`/`npm run lint` both clean.
`npm audit --omit=dev --audit-level=high` (the production-scoped gate
`dependency-security`/`audit-gate` actually enforces): 0 vulnerabilities.
Live repro re-run against the rebuilt `packages/cli/dist/bin.js`: bare
`--cmd`, `--cmd` immediately followed by another flag, `--cmd=`, and
`--cmd ""` all still produce the clean `usage:` error at exit 1 with `exec()`
never reached; `verify-entrypoint bench --cmd "npm test"` still reports `live`
unchanged.

**Fresh critic + reward-hack pass (this round)**, dispatched as a
separate-context subagent with no authorship stake, given only the merged
diff and the live repository (not a reread of the prior verdict): **CLEAR**
for this candidate's own scope. It independently confirmed the production
diff is a minimal, additive 2-line change plus two new test blocks, re-ran
`npx vitest run packages/cli/src/index.test.ts` itself (107/107 passed), and
live-reproduced all four bypass/edge cases above against the rebuilt CLI.

**Disclosed, not fixed tonight — corroborates an already-flagged gap.** The
critic found the exact same truthiness-guard bug class (a flag typed
`as string | undefined` with no `typeof === 'string'` check, so a bare flag
leaks the boolean `true` into downstream code) still present, unfixed, at
`audit-gate --path` and `freshness verify --policy` (both confirmed live:
a raw Node `TypeError`/parse error leaks through instead of a clean usage
message) and `freshness stamp --base` (same pattern; downstream validation
happens to reject the boolean today, but via a generic validator message, not
this command's own usage line). This is not a new finding — it is the same
class this report's own "3 concrete next steps" §1 named, and the same class
PR #161's 2026-10-30 consolidation-refresh comment flagged a dozen further
instances of (`schedule --env`, `ledger-signals --pending`,
`witness verify --commit`, among others) — this round independently
rediscovered three of those sites by direct live probing rather than rereading
that comment. CONSOLIDATE mode re-evaluates the existing candidate; it does
not produce or widen one (STEPS 5–9 are skipped), so none of this is fixed
here. No gold/benchmark/threshold/evaluator file was touched by the merge or
by this disclosure.

**Darwin.** `DARWIN=blocked` — this session's own sandbox permission
classifier denied `npx -y @metaharness/darwin@0.12.0 evolve . --sandbox mock`
outright as "Code from External", before any invocation ran. Not worked
around; same precedent as PRs #139/#148/#150/#158's prior rounds. Not required
for this verdict (optional).

**CI expectation on the pushed head.** Expect `guard`, `test` (both Node
versions), `dependency-security`, `no-optional-deps`, `software-evidence`, and
CodeQL green (all reproduced equivalently above). **Red, pre-existing, not
this PR's:** `dependency-audit` (full dev-inclusive `npm audit --audit-level=high`)
— reproduced locally against this exact head's lockfile:
`git diff origin/main -- package.json package-lock.json` from this branch is
empty (0 lines), so the lockfile is byte-identical to `main`'s. Same
pre-existing, already-tracked `vite`/`launch-editor`/`typescript-eslint`
dev-toolchain advisory family as issue #197 (opened 2026-10-21 against PR
#145, still open, no fix PR exists yet to port — a semver-range-breaking
`vite`/`eslint` bump is out of scope for this single-guard CLI-validation
fix). Not re-filing a duplicate issue; not fixing it from this PR.

**Decision.** ACCEPT still holds and the fresh critic is clear for this
candidate's own scope, but not every required check on the new head is
expected green (`dependency-audit`, for the pre-existing reason above) — per
STEP 1.5, this PR **stays draft**. Ledger row appended on this branch:
`docs/dream-cycle/LEDGER.md` (2026-11-01) — also stated in issue #181, since it
reaches `main` only if this PR merges.

No merge, no close, no force-push, no self-promotion, no candidate scope
change.

## Witness

```
report_sha256 : 0c8d18a28574c328ca4d597d151843ebfb7187db4572ddebf7cab3a34c5d1bde
session_commit: 1d563fae7975abb8c32f72455404ca47999fba2d
witness       : 9b7af31531aa9ed52dcaed41a90c481d5c6b6174a192f3ba7925dc1a012faf9f
```

Refreshed 2026-11-01 (consolidation round): now bound to the merge commit
(`1d563fae7975abb8c32f72455404ca47999fba2d`, `main`@`3fc3222` merged into this
branch) rather than the original `b2abcc1` baseline, since the Consolidation
refresh section above is itself part of this file's canonical bytes.
Superseded values from the original round are preserved in PR history, not
repeated here as current. Computed over this file's canonical bytes
(everything above the `## Witness` heading, trailing whitespace collapsed to
one newline) — reproducible from the committed file with no unavailable
intermediate bytes. Verify:

```bash
dream-machine witness verify-report docs/dream-cycle/2026-10-14-developer-experience-report.md --commit 1d563fae7975abb8c32f72455404ca47999fba2d
```

Independent reproduction of the underlying fix: `git checkout b2abcc1 -- packages/cli/src/index.ts`
restores the pre-fix behavior, where `node packages/cli/dist/bin.js verify-entrypoint redblue --cmd`
prints a misleading `blocked` verdict; applying this PR's diff on top restores the correct
`usage:` error.
