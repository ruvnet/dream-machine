# Developer Experience (CLI/TUI) SOTA Report — 2026

## TL;DR
The Dream Machine's own `learningSignals()` library function already supports
threading real GitHub merge state (`mergedPrNumbers`) into the `zeroMergeStreak`
signal, and is tested at the library level — but neither CLI consumer
(`ledger signals`, `tui`) ever wires it. Every call defaults `mergedPrNumbers`
to `undefined`, which the signal logic treats as "nothing merged," so
`zeroMergeStreak` is **unconditionally true** whenever any PR number appears
in the ledger window, merged or not. Verified live tonight: PR #7 (2026-08-13
night) is `merged` per the GitHub API, yet `dream-machine tui` still renders
"⚠ zero merges in 1 nights". This silently defeats STEP 1.1 of this repo's
own compiled nightly prompt ("zero of the last 14 candidate PRs merged → bias
to a tiny, easily-reviewable candidate") — the bias signal cannot ever turn
off while any PR has been filed.

## What's new
- Confirmed root cause: `packages/cli/src/index.ts` `ledger signals` case
  calls `learningSignals(rows)` with no `SignalOptions`; `packages/cli/src/tui.ts`
  `renderDashboard` calls `learningSignals(rows)` the same way. Neither exposes
  a way to supply merged-PR ground truth, despite `packages/ledger/src/index.ts`
  having carried the `mergedPrNumbers` option (and dedicated tests) since it
  was authored.
- Grade A, first-hand, reproduced tonight:
  `node packages/cli/dist/bin.js tui --path docs/dream-cycle/LEDGER.md` →
  "⚠ zero merges in 1 nights", cross-checked against
  `mcp__github__pull_request_read` on PR #7 → `"merged": true`.

## Competitors (developer-experience / nightly-agent tooling)
| Project | Comparable signal-wiring practice | Grade |
|---|---|---|
| Sakana AI Scientist | No persistent cross-run ledger with GitHub-state-aware signals found in public docs | B |
| OpenHands | Session/task tracking, no PR-merge-aware bias signal documented | C |
| SWE-agent / SWE-bench | Evaluates PRs directly against gold patches; no analogous "merge streak" self-bias concept | C |
| DSPy/GEPA | Optimizer tracks metric history, not external VCS merge state | B |
| pytest | N/A — no cross-run learning signal at all | A (absence confirmed via official docs) |
None of the surveyed competitors implement a "cross-night learning signal
gated on real external merge state" pattern comparable to this repo's own
design intent, so there's no prior art to borrow a fix from — this is a
wiring bug internal to this repo's own architecture, not a missing pattern.

## Hypothesis (frozen before implementation)
Given the compiled STEP 1.1 instruction "zero of the last 14 candidate PRs
merged → bias to a tiny, easily-reviewable candidate," when the `ledger
signals` CLI command and `tui`/`renderDashboard` are extended to optionally
accept real merge-state ground truth (`--merged <csv-of-pr-numbers>` on the
CLI; `mergedPrNumbers` threaded through `DashboardOptions`) and thread it into
the existing, already-tested `learningSignals(rows, { mergedPrNumbers })`
library call, then supplying a ledger whose only PR is known-merged should
report `zeroMergeStreak: false`, while the default (no `--merged` supplied)
must remain byte-for-byte identical to today's behavior — subject to: no
change to `learningSignals`' own pure logic (already correct per its tests),
no weakening of any existing CLI/TUI test (including the existing
"shows a zero-merge warning" test that locks in default behavior with no
merge data supplied), and the change stays purely additive/opt-in.

## Benchmarks / Evaluation
Real evaluator: `npm test` (vitest), this repo's own `bench` entrypoint.
See Evaluation Receipt in the PR/issue body for the baseline → candidate
test count and pass/fail table (committed alongside this report, not
duplicated here to avoid drift between the two).

## Evidence
OBSERVATION: `tui` output shows "zero merges" on a ledger row whose PR is
merged (grade A, reproduced twice: once via CLI, once via GitHub API).
MEASUREMENT: `npm test` baseline vs. candidate pass counts (see receipt).
INFERENCE: this signal has never once been able to report `false` for this
repo's real history, because no caller has ever supplied `mergedPrNumbers`.
DECISION: wire an opt-in `--merged` flag through both CLI consumers.

## Witness
`dream-machine witness stamp` hashes this exact file's raw bytes, so the
stamp cannot be written *inside* the file it stamps (editing the file after
hashing invalidates the hash against the committed bytes — the same
self-reference bug the 2026-08-13 precedent report already caught). The
stamp is computed over this file frozen exactly as it reads at this point,
and published instead in the PR description and the LEDGER.md row, both of
which point back at this file (committed at
`docs/dream-cycle/2026-08-24-developer-experience-report.md`) by path and
session commit. Anyone can independently reproduce it:

```bash
sha256sum docs/dream-cycle/2026-08-24-developer-experience-report.md   # REPORT_HASH
printf '%s%s' "$REPORT_HASH" "<SESSION_COMMIT>" | sha256sum
# must equal the WITNESS value published in the PR body and LEDGER.md
```

No `gh gist create` tonight — no gist-creation tool and no `gh` CLI in this
environment (GitHub API access is via MCP tools for issues/PRs only, same as
the 2026-08-13 precedent). `GIST=LOCAL`.

## Next steps
1. Extend `dream.config.json`'s compiled STEP 1.1 guidance to explicitly
   instruct the agent to pass `--merged` with GitHub-verified PR numbers each
   night (out of scope tonight — a `packages/compile` prompt-template change
   is its own conceptual surface).
2. Consider persisting the last N nights' merged-PR-number ground truth
   locally (e.g. in the ledger itself, or a sidecar file) so a future night
   without live GitHub access can still compute an accurate signal.
3. Audit other `learningSignals`-adjacent CLI/TUI surfaces (`duplicateDirections`,
   `lowScoreStreak`, `blockedEvalStreak`) for the same "library supports it,
   CLI never wires it" gap — `recentScores` (gist self-scores) has an identical
   unwired `SignalOptions` field with no CLI consumer either.
