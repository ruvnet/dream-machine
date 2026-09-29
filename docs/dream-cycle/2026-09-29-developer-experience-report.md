# Developer-Experience CLI Flag Parsing SOTA Report — 2026

Nightly Dream Cycle, 2026-09-29. DEEP=`developer-experience`, SCAN=`cli`,`tui`,
SLOT=4 (`20260929 % 5 == 4`). No bonus deep dive (`20260929 % 25 == 4`,
`% 75 == 54`).

## Rotation

DEEP=`developer-experience` · SCAN=`cli`,`tui` · SLOT=4. Session commit at
start: `9ebc9b66cfdd7f5d9f11ffafa5675239c58a456c` (`main`, PR #135 merged).

## Ledger Check

`docs/dream-cycle/LEDGER.md` on `main` (37 rows, last row 2026-09-22,
`daysSinceLastRow: 7`, `ledgerStale: true` per `ledger signals`). No `gh` CLI
in this session; GitHub MCP tools available and authenticated
(`get_me` → `ruvnet`). Ground truth from `git log --oneline main` (not the
`list_pull_requests.merged` field, a previously-documented unreliable
signal in this environment — see PR #103/#122's own Ledger Check sections):
the last 7 ledger rows' PRs (#114, #116, #120, #122, #127, #129, #132) are
**all merged into `main`**. `ledger signals`' own `zeroMergeStreak: true` is
the tool's worst-case unverified default (no `--merged` supplied), not
ground truth, matching the recurring false-negative this ledger has flagged
on multiple prior nights.

Checked `list_pull_requests` (state=open): 4 open drafts — #139
(security-adversarial, 2026-09-28, REJECT), #137 (evaluation-adapters,
2026-09-27, ACCEPT, modifies `packages/cli/src/bin.ts` — disjoint file from
tonight's candidate), #101 and #98 (portfolio cycles, unrelated repos/surface).
**Zero open developer-experience PRs** — no duplication risk for tonight's
slot. Checked open issues labeled `developer-experience`: #102 and #121, both
already fixed on `main` (PRs #103, #122 merged) — stale issue state, not
re-filed tonight since no code action remains.

## Deep Dive

`packages/cli/src/index.ts`'s minimal `parseArgs()` implements greedy
`--flag value` consumption: any token after `--flag` that does not itself
start with `--` becomes that flag's **string** value; only a missing next
token or one starting with `--` yields the boolean `true`. Every boolean-ish
flag consumer in this file correctly treats that ambiguity with a **truthy**
check — `flags.help`, `flags.version`, `flags.report` — except one: the `tui`
command's `noColor: flags['no-color'] === true` (line 754, pre-fix) used
**strict equality** against the literal `true`.

Live repro on `main@9ebc9b6` (pre-fix):

```
$ node packages/cli/dist/bin.js tui --path docs/dream-cycle/LEDGER.md --no-color extra
```

emits full ANSI SGR sequences (`\x1b[38;5;99m…`) throughout — identical to
omitting `--no-color` entirely — despite the explicit request.
`parseArgs(['tui','--path','L.md','--no-color','extra'])` confirms
`flags['no-color'] === 'extra'` (a string), not `true`. This reopens the
exact user-visible symptom PR #103 (2026-09-09) already fixed for a different
root cause (`verdictColor()` internally bypassing the no-color proxy) — this
time the leak comes from the argument parser, not the renderer.

## Hypothesis (frozen before implementation)

> Given `dream-machine tui --no-color <stray-positional>` (a trailing token
> after `--no-color` that does not itself start with `--`), when the `tui`
> command's `noColor` check is widened from strict `flags['no-color'] === true`
> to a truthy test (matching this same file's own established pattern for
> `flags.help` / `flags.version` / `flags.report`), then `--no-color` should
> suppress all ANSI output regardless of any trailing string value, while
> every already-passing scenario (bare `--no-color`, `--no-color` followed by
> another `--flag`, `--no-color` omitted) stays byte-identical.

Not modified after evaluation began.

## Candidate

`packages/cli/src/index.ts` (+9/−1): `noColor: flags['no-color'] === true` →
`noColor: Boolean(flags['no-color'])`, plus an explanatory comment.
`packages/cli/src/index.test.ts` (+10): one new regression test. 19 changed
lines across 2 files, one conceptual change.

## Baseline

Parent commit `9ebc9b66cfdd7f5d9f11ffafa5675239c58a456c` (`main`), rebuilt
clean (`npm ci && npm run build`, 8 packages, no wasm/NAPI degradation),
905/905 tests green (755 vitest + 150 governance).

## Evaluation Receipt

Real evaluator: `npm test` (`vitest run && npm run test:governance`).

| | Baseline (`main@9ebc9b6`) | Candidate |
|---|---|---|
| vitest | 755 | 756 (+1 new, 0 regressions) |
| governance | 150 | 150 (unchanged) |
| Total | 905 | 906 |
| `npm run typecheck` | clean | clean |
| `npm run lint` | clean | clean |
| `npm run build` | clean (8 packages) | clean (8 packages) |

Live pre/post-fix proof (`git stash` isolating just the one-line fix, rebuild,
repro, restore, rebuild):

```
# BASELINE (pre-fix): --no-color extra
20 lines containing raw ANSI escapes (\x1b[...m)

# CANDIDATE (post-fix): --no-color extra
0 lines containing ANSI escapes

# both: bare --no-color → 0 ANSI escapes (unchanged, already correct)
```

## Darwin Lineage

`DARWIN=not-applicable` — a one-line boolean-coercion widening has no
evolvable population to fitness-search; same judgment as every prior
single-conceptual CLI/TUI fix on this ledger (#21, #103, #122). Darwin's own
evaluator entrypoint (`npx @metaharness/darwin`) also remains unpinned —
already flagged as an open supply-chain finding on PR #139 tonight's sibling
surface; not re-invoked here to avoid running unpinned external code for a
candidate that doesn't need it.

## Evidence

OBSERVATION (grade A, live: grepped every boolean-flag consumer in
`index.ts`, confirmed `--no-color` is the only one using strict `=== true`)
→ OBSERVATION (grade A, live repro: pre-fix `--no-color extra` leaks ANSI)
→ MEASUREMENT (grade A, 905→906 tests, 0 regressions) → MEASUREMENT (grade A,
live post-fix repro: 0 ANSI bytes for both the stray-positional and bare
cases) → INFERENCE (independent critic subagent, separate context) →
DECISION (verdict ACCEPT, ship the truthy-check widening).

## Reward-Hack Check

Independent adversarial-critic subagent (separate context, no shared
authoring state): **CLEAR**. Verified empirically, not on faith:
1. Reproduced the bug independently by reverting only the fixed line,
   rebuilding, and re-running the live CLI — confirmed 20 ANSI-bearing lines
   pre-fix, 0 post-fix; restored the fix and left the tree in the correct
   post-fix state.
2. Ran the full suite (906/906) plus the `tui` subset (28/28) directly;
   confirmed every previously-passing invocation shape (`--no-color` alone,
   `--no-color` + another `--flag`, `--no-color` omitted) is byte-identical
   before and after.
3. Investigated the `--no-color=false` edge case explicitly: `Boolean("false")`
   is `true` in JS, so `--no-color=false` still forces color off — arguably
   surprising taken alone, but independently confirmed this is **not a new
   inconsistency**: `flags.report`'s pre-existing truthy check has the
   identical behavior for `--report=false` today, unrelated to this diff.
   The fix extends an existing, already-present codebase convention (plain
   truthiness on `parseArgs` string values) to the one flag that had been
   special-cased with strict equality — not a new defect class.
4. Confirmed the diff touches only two files, no gold data/thresholds/
   benchmark corpus touched, and the new test is non-tautological (fails
   cleanly against pre-fix code, passes against the fix).
5. No security-sensitive surface change.

## Security Review

No credential, network, or trust-boundary surface added or changed. Pure CLI
argument-coercion logic affecting only terminal ANSI color output. No LLM
calls in this path (`OPENROUTER_API_KEY` present in the environment,
correctly unused for this candidate — the DX/CLI/TUI surface tonight required
no model-calling evaluation stage). No MCP/tool-authority change, no
filesystem/network scope change.

## Scan Findings (cli, tui)

1. **cli**: this finding itself — `flags['no-color'] === true` was the sole
   strict-equality boolean-flag check in `index.ts`; now consistent with
   `flags.help`/`flags.version`/`flags.report`.
2. **cli**: confirmed via the critic's independent review that
   `--no-color=false` inherits the same pre-existing truthiness quirk as
   `--report=false` — a real, disclosed, **not fixed tonight** limitation of
   the whole hand-rolled `parseArgs` (no flag is typed as boolean-vs-string;
   see Next Steps §1). Scoping tonight's fix to the one-line inconsistency
   avoids conflating two different-sized changes in one candidate.
3. **tui**: no other direct bypass of the no-color-aware path remains in
   `renderDashboard`/`verdictColor` (confirmed by PR #103, unaffected by this
   diff, which only changes what value is threaded into `renderDashboard`'s
   `noColor` option, not the renderer itself).

## Competitors

| Tool | Approach to boolean-flag/value ambiguity | Grade |
|---|---|---|
| `commander` (official docs) | Explicit option definitions declare arity; a no-arg boolean option structurally never consumes the next token | A |
| `yargs` (official docs) | `.boolean('no-color')` explicitly types the flag so a following bare token is parsed as a positional, not a value | A |
| `minimist` (README, single-source inspection) | Same greedy-consumption ambiguity as this repo's parser unless the flag is pre-declared in a `boolean: [...]` list | B |
| Rust `clap` (official docs) | `ArgAction::SetTrue` flags cannot take a value at all; this bug class is unrepresentable | A |

`dream-machine`'s hand-rolled `parseArgs` is closest to bare `minimist`
without a declared-boolean list — a known, documented ambiguity class in that
ecosystem, not a novel discovery, but real and previously unfixed here for
this one flag.

## Gist

`GIST=LOCAL` — no `gh` CLI or gist-creation MCP tool available this session
(consistent with every prior night). Full report committed at
`docs/dream-cycle/2026-09-29-developer-experience-report.md`.

## Witness

```
report_sha256 : abd3fe43b6a62dc33dd66eed369a21ed6a794b75d536c3de2ce5981c5acc169c
session_commit: 9ebc9b66cfdd7f5d9f11ffafa5675239c58a456c
witness       : b2886295a6f4c06fa75c9c91998d4f00d0e93c8767c5de51bbd9cc6e941edd52
```

Computed over this file's canonical bytes (everything above this heading,
trailing whitespace collapsed to one newline) — reproducible from the
committed file with no unavailable intermediate bytes. Verify:

```bash
dream-machine witness verify-report docs/dream-cycle/2026-09-29-developer-experience-report.md --commit 9ebc9b66cfdd7f5d9f11ffafa5675239c58a456c
```

## Recommendation

`evaluated: accepted` — sufficient evidence to recommend human review. Draft
PR to follow; this session never merges. **Next steps**:

1. Consider a declared-boolean-flag list in `parseArgs` itself (`yargs`/
   `minimist`-style) so the whole `--flag=false`-is-still-truthy and
   `--flag <stray>` ambiguity class closes for every current and future
   boolean flag at once, not one call site at a time. Deliberately **not**
   done tonight — broader surface, higher review risk, not this candidate's
   one conceptual change.
2. Get PR #137 (2026-09-27, `bin.ts` execFile diagnostics, ACCEPT, disjoint
   file from tonight's candidate) and #139 (2026-09-28, supply-chain detector
   widening, REJECT with a disclosed residual gap) reviewed or closed — both
   remain open/draft, unrelated to tonight's fix, no conflict.
3. `LEDGER.md` on `main` is 7 days stale (last row 2026-09-22) even though
   `dream/*` branches exist through 2026-09-28 — rows just never merge
   because their PRs stay open. Not this slot's surface (ledger-signals is
   slot 1), recorded for completeness only, consistent with how prior nights
   handled the same observation.
