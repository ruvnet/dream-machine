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

## CONSOLIDATE Refresh (2026-10-20)

Tonight's nightly cycle (DEEP=`compiler-parity`, SLOT=0) measured 19 open
`dream/*` PRs (`gh pr list --state open --search 'head:dream/'` equivalent via
GitHub MCP) — 16 real draft candidates (excluding #98/#101, cross-repo
"portfolio" bookkeeping PRs with no Evaluation Receipt structure, and #137,
not a draft). Live ground-truth PR-fate classification across every `dream/*`
PR ever opened (git `merge-base --is-ancestor` plus `git log main`'s
squash-merge `(#N)` suffixes, not the previously-documented-unreliable
`list_pull_requests.merged` field): 39 merged / 7 closed-unmerged / 19 open
(65 total). Fed as `--merged`/`--closed`/`--open`/`--open-count` into
`dream-machine ledger outcomes` (which separately tracks only the PR numbers
named in the ledger's own 47 historical rows): `pipelineMergeRate=0.596`,
`reviewBacklogSize=19`, `ledgerStale=true` (`daysSinceLastRow=8`). `ledger
backlog` returned exactly
one unimplemented accept-closed-unmerged finding (2026-08-18, issue #18,
unpinned-npx darwin entrypoint) — not acted on tonight: STEP 1.5 mode
priority is CONSOLIDATE > RESEARCH-ONLY > IMPLEMENT > RESEARCH, and
CONSOLIDATE's own precondition (≥6 open candidates, ≥1 eligible) already held.

Selected **MODE=CONSOLIDATE**. Checked every one of the 16 draft candidates'
own Evaluation Receipts for eligibility (draft + own-verdict ACCEPT + not
routine-self-review + no `dream-consolidate` marker for tonight's SHA): #139
(2026-09-28, oldest) is ineligible — its own receipt states verdict REJECT
(unresolved critic finding, widen-detector candidate). **#141 (2026-09-29) is
the oldest eligible PR** — draft, own-receipt ACCEPT, not self-review, no
existing marker (`pull_request_read`'s comment list for #141 is empty). All
15 other open candidates were also checked and are ACCEPT/eligible, but #141
is oldest and only one candidate is refreshed per CONSOLIDATE night. Per STEP
1.5, STEPS 2-9 and 17-24 are skipped (no new research, candidate, or PR);
only STEPS 10-16 are re-run against the refreshed head, below.

- Merged `main` (`3fc3222d2e5566a203331d3686c4d2eaf06713a8`) into this PR's
  own branch (`dream/2026-09-29-developer-experience`, tip `579d873`) with one
  ordinary merge commit, `f84fa392` — never rebased, never force-pushed.
  Clean merge, no conflicts. `git diff main HEAD -- packages/cli/src/index.ts
  packages/cli/src/index.test.ts` shows the merged head differs from `main`
  by exactly this candidate's own original diff (+9/−1 in `index.ts`, +10 in
  `index.test.ts`) — nothing else touches either file.
- Rebuilt clean (`npm ci && npm run build`, 8 packages, 0 wasm/NAPI
  degradation). Re-ran the real evaluator on the exact merged head, and,
  isolated in a separate `git worktree` of plain `main`, on the unmerged
  baseline — both measured directly, not inferred from logs:

  | | Baseline (`main@3fc3222`, isolated worktree) | Candidate (merged head, `f84fa392`) |
  |---|---|---|
  | vitest | 886 | 887 (+1 new, 0 regressions) |
  | governance | 195 | 195 (unchanged) |
  | `npm run lint` | clean | clean |
  | `npm run typecheck` | clean | clean |

  (An earlier in-session vitest run was contaminated by a background research
  subagent concurrently checking out/merging this same working tree before
  this measurement's own isolated-worktree baseline was taken — resolved by
  re-measuring `main` from a clean `git worktree add`, not inferred.)
- Live-reproduced the candidate's own behavior again on the merged head:
  `tui --no-color extra` → 0 ANSI-bearing lines (fixed); bare `--no-color` →
  0 (unchanged); no flag at all → 20 lines leak ANSI (expected baseline,
  unaffected by anything merged into `main` since 2026-09-29).
- **Fresh independent-critic adversarial review, tonight's refreshed diff**
  (full detail in the amended Reward-Hack Check section below): dispatched
  as a genuinely separate subagent with zero authorship context, given only
  the diff and told to be adversarial — not a same-session self-review.
  **Verdict: CLEAR.**
- **Verdict: ACCEPT still holds.** No regression, no merge conflict, critic
  CLEAR, required local checks (tests/lint/typecheck) all green on the exact
  merged head. Marking this PR ready for human review.

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

**2026-10-20 CONSOLIDATE refresh addendum** — a genuinely independent
subagent critic (separate context, given only the diff
`packages/cli/src/index.ts`/`index.test.ts` between `main` and the merged
head, no authorship framing) re-reviewed the exact merged-head diff:
**CLEAR**. Independently: (1) confirmed the bug mechanism live by reading
`parseArgs` directly, not trusting the diff's own comment; (2) confirmed
`flags.help`/`flags.version`/`flags.report` already use bare truthy checks
elsewhere in the same file, so this fix is a consistency fix, not a new
convention; (3) ran `packages/cli/src/index.test.ts` live, 106/106 green;
(4) non-tautology proof — reverted only the fixed line, confirmed the new
test fails with the real ANSI leak visible in the failure output, restored
the file via `git checkout --` and confirmed `git status --porcelain` clean
afterward; (5) confirmed no gold/benchmark/threshold file touched (diff is
exactly 2 files); (6) confirmed no security-relevant surface change; (7)
independently re-probed `--no-color=false` (still forces color off — a
pre-existing truthy-string quirk shared with `--report=false`, not a new
inconsistency, same conclusion as the original 2026-09-29 critic), `--no-color`
twice, `--no-color` as the last argv token, and `--no-color` combined with
`--merged` — no new bypass found. No fixture/threshold/gold-answer touched;
no test weakened to pass a blocked case (none was blocked).

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

**Refreshed 2026-10-20** (CONSOLIDATE night; supersedes the original
2026-09-29 triple — sha256 `abd3fe43b6a62dc33dd66eed369a21ed6a794b75d536c3de2ce5981c5acc169c`
over the pre-refresh file, commit `9ebc9b66cfdd7f5d9f11ffafa5675239c58a456c`,
witness `b2886295a6f4c06fa75c9c91998d4f00d0e93c8767c5de51bbd9cc6e941edd52` —
cited in prose here, not as a parseable block, so `verify-report`'s
single-triple extraction finds only the current one below):

```
report_sha256 : b944777360b2e4260ec9a1f7322d944fbba81ea025b2d617ad63ab6e2f8e7339
session_commit: 3fc3222d2e5566a203331d3686c4d2eaf06713a8
witness       : 48b99bd1dab42fb3f2c9d791ecf0c44f59fd4f2bb1b464ca8c516f36e78d867f
```

Computed over this file's canonical bytes (everything above the first
`## Witness` heading, trailing whitespace collapsed to one newline) —
reproducible from the committed file with no unavailable intermediate bytes.
Reproduce:

```bash
node packages/cli/dist/bin.js witness verify-report docs/dream-cycle/2026-09-29-developer-experience-report.md --commit 3fc3222d2e5566a203331d3686c4d2eaf06713a8
```

## Recommendation

`evaluated: accepted` — sufficient evidence to recommend human review.
**2026-10-20 update**: ACCEPT still holds after tonight's CONSOLIDATE
refresh (merged `main`, re-evaluated, fresh independent critic CLEAR) — this
PR is marked ready for human review tonight. This session never merges.
**Next steps**:

1. Consider a declared-boolean-flag list in `parseArgs` itself (`yargs`/
   `minimist`-style) so the whole `--flag=false`-is-still-truthy and
   `--flag <stray>` ambiguity class closes for every current and future
   boolean flag at once, not one call site at a time. Deliberately **not**
   done tonight — broader surface, higher review risk, not this candidate's
   one conceptual change.
2. 15 other open dream-cycle candidate PRs remain unreviewed as of
   2026-10-20 (`reviewBacklogSize=19` across all open `dream/*` PRs,
   `pipelineMergeRate≈0.596`); human review bandwidth, not evidence quality,
   is the pipeline's bottleneck.
3. `LEDGER.md` on `main` is 8 days stale (last row 2026-10-12) even though
   `dream/*` branches exist through 2026-10-18 — rows just never merge
   because their PRs stay open. Not this slot's surface (ledger-signals is
   slot 1), recorded for completeness only.
