# Developer-Experience SOTA Report — 2026

## TL;DR

Tonight's SCAN=cli probe of this repo's own `dream-machine ledger signals`
command reproduced a real, first-hand, self-referential bug: the CLI never
wires actual GitHub merge state into `learningSignals()`, so the
`zeroMergeStreak` field — the exact STEP 1.1 signal this pipeline's compiled
prompt uses to decide whether to "bias to a tiny, one-parameter, easily
reviewable candidate" — is structurally incapable of returning `false`
whenever the trailing window contains at least one real PR reference. It is a
worst-case default silently presented as a verified reading. Proof, not
speculation: running `dream-machine ledger signals` against tonight's real
`docs/dream-cycle/LEDGER.md` reports `zeroMergeStreak: true`, even though
`mcp__github__pull_request_read` on PR #7 (the only PR in that ledger)
confirms it as `"merged": true, "merged_by": "ruvnet"` at
`2026-08-13T22:05:44Z`. Candidate: an optional `--merged "7,12"` flag on
`ledger signals` that threads known-merged PR numbers into the library's
existing (already-correct) `learningSignals(rows, { mergedPrNumbers })`
option — the library was never the bug, the CLI wiring was.

## What's new

- First-hand reproduction (grade A) that `node packages/cli/dist/bin.js
  ledger signals` against this repo's real ledger reports
  `zeroMergeStreak: true` for a night whose PR is independently confirmed
  merged via the GitHub API.
- Root-caused: `packages/cli/src/index.ts`'s `ledger signals` handler calls
  `learningSignals(rows)` with no second argument, so
  `packages/ledger/src/index.ts`'s `opts.mergedPrNumbers` is always
  `undefined`, which forces the `!merged || prsInWindow.every(...)` branch to
  short-circuit `true` for any window containing a real PR number. The
  `@dream-machine/ledger` library itself is correct and already accepts
  `mergedPrNumbers` — confirmed by its own passing unit tests
  (`packages/ledger/src/index.test.ts`, `describe('learning signals')`) — the
  defect is entirely in the CLI's failure to surface that option.
  `renderDashboard` (the TUI) has the identical gap for the same reason, but
  is explicitly out of scope tonight (see Reward-Hack Check).
- Also found and fixed before finalizing (adversarial self-critique, see
  below): the naive first cut of the `--merged` flag crashed with
  `mergedFlag.split is not a function` on a value-less `--merged` (parseArgs
  turns a flag with nothing after it, or another flag immediately after it,
  into the boolean `true`, not a string) — the exact class of parser footgun
  this repo's own `verify-entrypoint --cmd` guard (added the night before,
  PR #7) was built to catch for a different flag.
- Also found (SCAN=tui, not fixed tonight — see Recommendation): `tui.ts`'s
  `pad()` measures string width with `.length` after stripping ANSI codes,
  which is UTF-16-code-unit width, not terminal display width. A ledger
  `Finding` cell containing CJK text or an emoji renders the dashboard's
  right-hand border out of alignment — reproduced live tonight (see Scan
  Findings).

## Hypothesis (frozen before implementation)

> Given `dream-machine ledger signals`' `zeroMergeStreak` field, which this
> pipeline's own compiled STEP 1.1 explicitly uses to bias candidate
> selection ("zero of the last 14 candidate PRs merged → bias to a tiny,
> one-parameter, easily-reviewable candidate"), when the CLI is given an
> optional `--merged <csv-of-pr-numbers>` flag that threads into
> `learningSignals(rows, { mergedPrNumbers })`, then `zeroMergeStreak` should
> correctly report `false` once the trailing window's PR number is present in
> the supplied merged set, and must continue to report exactly today's
> behavior (worst-case `true` whenever a real PR is present) when `--merged`
> is omitted — subject to: no change to any existing test, no change to
> `learningSignals`'s own pure-function behavior (already correct), the CLI
> must stay dependency-free and make no network/GitHub calls itself (the
> caller supplies merge data it already has), and a malformed or value-less
> `--merged` must fail with a clear usage error, never a crash or a silently
> wrong signal.

## Benchmarks / Evaluation

Real evaluator: `npm test` (vitest), this repo's own `bench` entrypoint —
the only evaluator entrypoint live tonight (see Credentials reality check).

| | Baseline (parent, commit `7bbb851`) | Candidate (working tree) |
|---|---|---|
| Test files | 7 | 7 |
| Tests | 96 | 101 (+5, 0 removed, 0 modified) |
| Result | 96 passed | 101 passed |
| Lint | clean | clean (`npm run lint`, 0 errors) |
| Build | clean (`tsc`, all 6 packages) | clean |

No pre-existing test was touched, weakened, or removed. Diff: 2 files changed,
48 changed lines (28 in `packages/cli/src/index.ts`, incl. the HELP text and
the post-critique usage-error guard; 22 new test cases in
`packages/cli/src/index.test.ts`) — one conceptual change (CLI wiring only;
`@dream-machine/ledger` untouched).

Live receipt — real binary, real ledger, real GitHub ground truth:

```
$ node packages/cli/dist/bin.js ledger signals
{
  "zeroMergeStreak": true,          # WRONG — PR #7 is merged
  "duplicateDirections": [],
  "lowScoreStreak": false,
  "blockedEvalStreak": false,
  "nightsConsidered": 1
}

$ node packages/cli/dist/bin.js ledger signals --merged 7
{
  "zeroMergeStreak": false,         # correct once told PR #7 merged
  "duplicateDirections": [],
  "lowScoreStreak": false,
  "blockedEvalStreak": false,
  "nightsConsidered": 1
}

$ node packages/cli/dist/bin.js ledger signals --merged
ledger signals: --merged expects a comma-separated PR number list, e.g. --merged "7,12"
$ echo $?
1
```

`mergedPrNumbers` was confirmed independently against real GitHub state, not
assumed: `mcp__github__pull_request_read(owner=ruvnet, repo=dream-machine,
pullNumber=7)` → `"merged": true, "merged_by": "ruvnet",
"merged_at": "2026-08-13T22:05:44Z"`.

**Credentials reality check.** `OPENROUTER_API_KEY` is present tonight
(unlike, apparently, some prior nights) — `LLM_EVAL` is not blocked. This
candidate does not call a model regardless: it is a deterministic CLI-wiring
fix, verified entirely by the real `bench: npm test` evaluator and a live,
first-hand GitHub API check. No model-generated claim is made anywhere in
this report.

## Darwin (bounded evolution)

Not run. `DARWIN=not-applicable`. The candidate is a single CLI flag wired
through an already-correct, already-tested library function — there is no
meaningful mutable population for bounded Darwin's generations×children
search to explore (the fix is a closed-form "surface the existing option"
change, not a parameterized behavior with a fitness landscape).

## Evidence

- OBSERVATION: `node packages/cli/dist/bin.js ledger signals` (pre-fix,
  reproduced against the real `docs/dream-cycle/LEDGER.md`) → `"zeroMergeStreak":
  true`.
- OBSERVATION: `mcp__github__pull_request_read` on PR #7 → `"merged": true`,
  `merged_at 2026-08-13T22:05:44Z`.
- INFERENCE: these two observations are jointly inconsistent under the field's
  documented meaning ("no candidate PR merged in the last window nights") —
  the CLI's signal is wrong, not the ledger data.
- MEASUREMENT: `npm test` — 96/96 (baseline) → 101/101 (candidate), 0
  regressions.
- MEASUREMENT: post-fix, `ledger signals --merged 7` → `"zeroMergeStreak":
  false`, matching real GitHub state.
- OBSERVATION (critic pass, pre-fix-of-fix): `ledger signals --merged` (no
  value) → `error: mergedFlag.split is not a function`, exit 1 — a real
  runtime defect in the first draft of the candidate itself.
- MEASUREMENT (post-fix-of-fix): same command → clean usage-error message,
  exit 1, no crash.
- OBSERVATION (SCAN=tui, first-hand): `renderDashboard` on a ledger row whose
  `Finding` cell contains CJK/emoji text renders a table row of length 85
  against a designed width of 80 — the right border is dropped on that line.
  Not fixed tonight — see Recommendation.
- DECISION: ship only the `ledger signals --merged` CLI flag tonight; leave
  `renderDashboard`/TUI untouched (see Reward-Hack Check §2 for why) and leave
  the wide-character `pad()` bug as a documented, reproduced, unfixed
  follow-up.

## Reward-Hack Check

Independent critic pass (same session, adopting an adversarial lens
deliberately separate from the candidate's construction — no second live
agent was available tonight, so this is a self-critique, explicitly flagged
as weaker than the two-agent setup used the night before; see Security
Review for why that's an accepted, not hidden, limitation).

**Verdict: CLEAR of reward-hacking** — no pre-existing test weakened, no
threshold/gold data touched, no benchmark corpus modified, only the intended
2 files changed, default (no-flag) behavior is byte-for-byte identical to
before (verified by the pre-existing `signals` test still passing unchanged).

**One real defect found and fixed before this report was finalized** (not
silently dropped): the first draft's `--merged` flag crashed on a value-less
invocation (`mergedFlag.split is not a function`) because `parseArgs` returns
`true` (boolean), not a string, for a flag with nothing after it. Fixed with
an explicit `flags.merged === true` guard that returns a clear usage error
instead; regression test added
(`'signals rejects a value-less --merged with a clear usage error, not a
crash'`).

**Two things considered and correctly left out of scope tonight, not
silently dropped**:
1. `renderDashboard`/TUI has the identical always-`undefined`-merged gap as
   the CLI did. It is **not** given the same `--merged`-style fix tonight
   because `tui.ts`'s own docstring declares it "a dependency-free ANSI
   dashboard rendered from a ledger" — a pure `ledgerMd string → framebuffer
   string` function, snapshot-tested and turned into an SVG termshot without
   a terminal. Threading external merge-state input into it either breaks
   that purity contract (if sourced from a network call inside the TUI) or
   requires a broader signature change (`renderDashboard(md, {...,
   mergedPrNumbers})`) that's a second conceptual change beyond tonight's
   scope. Flagged as an explicit next step, not fixed.
2. No attempt was made to have the CLI fetch merge state itself (e.g.
   shelling out to `gh` or calling the GitHub API from `bin.ts`). That would
   add a network dependency and credential requirement to a tool whose
   `IO.exec` is already flagged (PR #7's Reward-Hack Check) as carrying an
   unsanitized-shell-exec risk if ever fed config-sourced input — piling a
   second network-facing responsibility onto the same small CLI was judged
   out of scope and the wrong direction; a human/session caller supplying
   already-known merge data via `--merged` keeps the CLI itself
   network-free and deterministic.

## Security Review

- **Tool/command-authority scope**: the new code path is pure string
  parsing (`split(',')`, `trim()`, `replace(/^#/, '')`) building a `Set` —
  no `exec`, no file I/O beyond the pre-existing `--path` read, no new shell
  surface. `--merged`'s value never reaches `io.exec`.
- **Credential exposure**: none — this candidate handles no secrets and adds
  no new credential-consuming code path.
- **Prompt injection / cross-agent poisoning**: N/A — no LLM calls in this
  candidate; `--merged`'s value is caller-supplied plain text, not fetched
  from an untrusted external source inside the tool itself.
- **Self-critique limitation, disclosed not hidden**: PR #7's critique used a
  separate agent as the "independent" critic; tonight's did not (single
  session, no second agent spawned for this specific pass) — the adversarial
  pass above is honestly a self-review, which is weaker than genuine
  independence. It still caught and fixed one real defect (the crash), which
  is evidence it wasn't a rubber stamp, but this limitation is recorded
  rather than glossed over.
- **Least privilege**: the flag is fully optional; every existing call site
  and every existing test is unaffected.

## Scan Findings

**cli** — `dream-machine ledger signals`' `zeroMergeStreak` field was a
worst-case-default masquerading as a verified reading (see TL;DR/Hypothesis
above) — this is the night's deep dive, fixed tonight.

**tui** — `renderDashboard`'s `pad()` helper (`packages/cli/src/tui.ts:28-32`)
measures cell width with `.replace(ansi, '').length`, which is JS string
length (UTF-16 code units), not terminal display width. Reproduced live
tonight: a ledger row with a CJK/emoji `Finding` cell renders at 85 columns
against the box's fixed 80-column design, breaking the right border on that
line. Root cause: wide (East-Asian-width / emoji) characters occupy 2
terminal columns but count as 1 (or, for surrogate-pair emoji, sometimes 2)
JS UTF-16 units — `.length` and terminal width diverge. Not fixed tonight
(would need a wcwidth-style column-width calculation, a second, unrelated
conceptual change from tonight's CLI fix, and no existing ledger row
currently contains non-ASCII text, so the blast radius today is latent, not
active). Recommended as next night's `deep=developer-experience,
scan=tui` candidate if this slot recurs, or filed as a standalone follow-up.

## Competitors

| System | Dashboard/signal verification vs. self-reported drift | Grade |
|---|---|---|
| SWE-agent | Independent reporting shows resolve rate can silently drift from 38% to 24% after a config change "without either failure showing up in a model dashboard" — the same failure shape as tonight's finding (a steering/reporting signal quietly going stale) | C (aggregator summary, secondhand) |
| OpenHands | 77.6% SWE-bench Verified score is a benchmark number, not a live production merge-rate signal; official docs/reviews recommend human review before merging agent-generated changes rather than trusting a dashboard metric | B (vendor + third-party review, cross-checked) |
| Sakana AI "The AI Scientist" | Documents sandboxing concerns for self-modifying/autonomous code; no documented equivalent of a "learning signal" feeding back into candidate-selection bias the way this repo's STEP 1.1 does | B (official docs) |
| DSPy/GEPA | Metric-based optimization with feedback traces; no documented case of an optimizer's own steering metric being wired to a stale/undefined data source | B (absence confirmed via official docs) |
| AutoGPT-lineage | Community reporting describes agents self-reporting success without independent verification (cost/outcome mismatch, e.g. large token spend with nothing merged) — same class of risk (trusting an unverified self-reported signal) this candidate closes for this repo's own tooling | C (aggregator/community, secondhand) |

This repo's own prior night (PR #7, 2026-08-13) is itself the clearest,
first-party evidence for the risk class: the ledger's only real PR was
in fact merged by a human, yet this repo's own steering signal reported the
opposite. This is the strongest evidence tonight — not a competitor claim.

## Gist

This report. No `gh gist create` and no gist-creation MCP tool available in
this session (`gh` CLI itself is also not installed in this environment, per
this repo's own precedent night — PR #7 — and confirmed again tonight).
Report committed at
`docs/dream-cycle/2026-08-14-developer-experience-report.md`. `GIST=LOCAL`.

## Witness

Computed after this file is frozen (self-reference: the stamp hashes this
file's exact committed bytes, so it cannot be written inside the file it
stamps without invalidating itself — same reasoning as the prior night's
report). Published in the PR description and the `LEDGER.md` row instead,
both pointing back at this file by path and session commit. Reproduce with:

```bash
sha256sum docs/dream-cycle/2026-08-14-developer-experience-report.md   # REPORT_HASH
printf '%s%s' "$REPORT_HASH" "<SESSION_COMMIT>" | sha256sum
# must equal the WITNESS value published in the PR body and LEDGER.md
```

## Recommendation

Human review of the draft PR. Explicitly not done tonight (next steps, not
silently dropped):
1. Fix `tui.ts`'s `pad()` to use a real display-width calculation
   (wcwidth-style) instead of `.length`, so non-ASCII `Finding` text doesn't
   break the dashboard's box alignment — reproduced tonight, latent today
   (no existing ledger row has non-ASCII content), documented above.
2. Decide whether `renderDashboard` should accept a `mergedPrNumbers`-style
   option too (making its own `zeroMergeStreak` warning accurate), or whether
   the TUI should instead accept a precomputed `LearningSignals` object from
   its caller rather than recomputing internally — a real design choice,
   deliberately not made unilaterally tonight.
3. This repo's `ledger signals` docs/help text now explains the worst-case
   default explicitly; consider whether the compiled nightly prompt's STEP
   1.1 itself should be updated (via `dream.config.json`/`@dream-machine/compile`)
   to instruct future nights to always pass `--merged` using this session's
   own GitHub check — not done tonight (would touch the compiler/config, a
   second conceptual change).
