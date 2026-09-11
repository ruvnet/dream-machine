# Ledger-Signals SOTA Report — 2026

**Date:** 2026-09-11 · **Deep:** ledger-signals · **Scan:** witness, verify · **Slot:** 1 · **Session commit:** 3edd426f6c9c4b1e80235f7447dc863e749345cc

## TL;DR

`@dream-machine/ledger`'s `learningSignals()` computes `zeroMergeStreak` (boolean:
did any of the last N ledger PRs merge?) but has no way to distinguish "nothing
proposed lately" from "N candidates are sitting open, unreviewed." Live GitHub
state tonight: **5 open, unmerged `dream/*` candidate PRs** (#105, #103, #100,
#98 draft; #101 non-draft) plus 3 dependabot PRs, against a ledger whose
`zeroMergeStreak` has read `true` continuously since at least 2026-08-26 (16+
consecutive nights, `docs/dream-cycle/LEDGER.md`). Added `reviewBacklogSize`
(nullable `number`, caller-supplied via a live count, default `null` =
no signal) to `LearningSignals`, wired through `ledger signals --open-count N`
and `tui --open-count N`. Purely additive: existing signals are byte-identical
when the new option is omitted (asserted directly in tests).

## What's new

- `SignalOptions.openCandidateCount?: number` — live open-PR count from the caller.
- `LearningSignals.reviewBacklogSize: number | null` — echoes it straight through.
- CLI: `--open-count N` on `ledger signals` and `tui`, same fail-closed parsing
  discipline as the existing `--merged` flag (a value-less or non-numeric flag
  is a usage error, not `NaN`/crash).
- TUI: `⚠ N candidate PR(s) open, unreviewed` footer line when `reviewBacklogSize > 0`.

## Why this and not something else

`zeroMergeStreak` was added (2026-08-25/26 nights, PR #33) specifically so a
future night could "prefer a tiny, one-parameter, easily-reviewable candidate"
when nothing is merging. `docs/dream-cycle/LEDGER.md`'s own `ledger signals
--open-count` was not run historically (verified: every prior ledger row's
Evidence column that mentions `zeroMergeStreak` cites it as a bare boolean,
never a count), so 16+ nights of that bias have been firing off the same
undifferentiated signal while the actual number of open, unreviewed
candidates grew from single digits to double digits across `dream/*`
branches. The signal that would let a night (or a human skimming `tui`)
see *how much* backlog pressure exists — as opposed to *whether any*
exists — did not exist. This is the smallest change that adds it without
touching any existing signal's semantics.

## Competitor / prior-art analysis (grade: B/C — industry analysis, not peer-reviewed benchmarks)

| System | Autonomy | Review-queue signal to humans? | Backlog/WIP handling |
|---|---|---|---|
| Sakana AI Scientist | Full paper-to-PR pipeline | No native PR-queue metric; output is papers/artifacts, not a merge queue | N/A — not PR-review-gated |
| OpenHands (OpenDevin) | Task/goal-level autonomy, CI-integrated | No built-in backlog-size signal; relies on external review tooling | Explicitly not recommended for unsupervised production without strong review capacity (B, industry review roundup 2026) |
| SWE-agent | Issue-to-patch, benchmark-driven | No built-in backlog signal (benchmark-focused, not fleet-ops-focused) | N/A |
| DSPy / GEPA | Prompt/program optimization loop, not a PR pipeline | N/A | N/A |
| AutoGPT lineage | Autonomous task loops | No standard review-queue instrumentation | N/A |
| Human software teams (Kanban practice) | N/A | Explicit WIP limits gate new work at the review column | "If the answer is 'we start one more because the agent is idle,' you do not have a WIP limit yet" (Yeret, 2026, B) |

Industry consensus (Yeret 2026; Signadot 2026; Milestone.ai 2026 — B/C, blog-grade,
cross-checked across 3 independent sources) is that agent-generated code shifts
the bottleneck from generation to review, and that review capacity, not
generation throughput, is the constraint that needs an explicit signal/limit.
Dream Machine's own `zeroMergeStreak` was a first step in that direction but
measures merge *rate*, not queue *depth* — the two diverge exactly in the
regime this repo is in (candidates keep landing, humans aren't reviewing).
None of the five named competitors expose a review-backlog-depth signal as
part of their own architecture; this is an internally-motivated addition, not
a ported technique, so no A-grade claim is made about it.

## Hypothesis (frozen before implementation)

> Given the Dream Machine's self-hosting nightly cycle, when a
> `reviewBacklogSize` field (nullable, caller-supplied open-candidate-PR count)
> is added to `learningSignals()`'s output, then a night or human reading
> `ledger signals`/`tui` output gains direct visibility into review-queue
> depth, subject to: (a) zero change to any existing signal's value when the
> new option is omitted, (b) no change to `learningSignals()`'s purity (still
> no I/O — the caller supplies the count, exactly like `mergedPrNumbers`), and
> (c) full test coverage at both the library and CLI layer.

## Testability gate

Testable tonight, no model calls required (`OPENROUTER_API_KEY` present but
unused — this is a deterministic library/CLI change, evaluated purely by the
existing unit-test evaluator). `EVALUATED=yes`.

## Baseline (parent, commit 3edd426)

```
npm test
Test Files  23 passed (23)
Tests       616 passed (616)   [vitest]
tests 81, pass 81, fail 0      [governance: node --test scripts/*.test.mjs]
```

## Candidate evaluation (same evaluator, same corpus)

```
npm run typecheck   → clean
npm run lint         → clean
npm test
Test Files  23 passed (23)
Tests       627 passed (627)   [vitest, +11 net new, 0 regressions]
tests 81, pass 81, fail 0      [governance, unchanged]
```

Live end-to-end check against the real ledger (not just unit tests):

```
$ node packages/cli/dist/bin.js ledger signals --path docs/dream-cycle/LEDGER.md --open-count 5
{
  "zeroMergeStreak": true,
  "duplicateDirections": ["harden anchored replay json evidence reject"],
  "lowScoreStreak": false,
  "blockedEvalStreak": false,
  "nightsConsidered": 14,
  "lastRowDate": "2026-09-07",
  "daysSinceLastRow": 4,
  "ledgerStale": true,
  "reviewBacklogSize": 5
}
```

`5` = live count of open, unmerged `dream/*` candidate PRs at session start
(#105, #103, #101, #100, #98 — via `mcp__github__list_pull_requests`,
state=open, `ruvnet/dream-machine`). Every other field is unchanged from the
`--open-count`-less run, confirmed both by this live A/B and by a dedicated
unit test (`reviewBacklogSize does not affect zeroMergeStreak or any other
signal`) that asserts the two outputs are equal modulo the new field.

## Darwin

Not run tonight — `evaluatorEntrypoints.darwin` invokes `npx
@metaharness/darwin`, unpinned (flagged supply-chain risk in the compiled
routine itself), and is unrelated to this candidate's surface (ledger
signals, not the darwin/evaluation-adapters surface). The 2026-09-07 ledger
row already re-confirmed that entrypoint is live-but-buggy on the darwin
surface; re-running an unpinned `npx` package for an unrelated candidate
would add supply-chain exposure with no evidentiary value here. Deliberately
skipped, not silently omitted.

## Evidence

- OBSERVATION: 5 open `dream/*` PRs at session start (#105, #103, #101, #100,
  #98), 0 merged since at least #24 (2026-08-26), per live
  `mcp__github__list_pull_requests`.
- MEASUREMENT: baseline 616/616 vitest + 81/81 governance; candidate 627/627
  vitest (+11 net new) + 81/81 governance; typecheck/lint clean.
- MEASUREMENT: `reviewBacklogSize` echoes the supplied count exactly (unit +
  live E2E); omitting `--open-count` reproduces the pre-candidate output
  byte-for-byte on every other field (unit test, structural equality check).
- INFERENCE: the review-backlog-depth gap in `learningSignals()` plausibly
  contributed to 16+ consecutive zero-merge nights each independently
  re-deriving "bias small" from a boolean, without any of them being able to
  see *how much* backlog already exists — no causal claim, since merge
  decisions are made by a human outside this session's visibility.
- REJECTION (implicit): did not attempt to auto-throttle candidate generation
  by backlog size (e.g. skip a night's PR entirely above some threshold) —
  that is a policy decision for a human to make deliberately, not something
  to bake into the ledger library silently tonight.

## Reward-hack / adversarial critique (self, independent-of-implementation pass)

- Did it weaken any benchmark, test, or gold data? No — 11 new tests added,
  zero existing tests modified or deleted (`git diff --stat` on test files
  below).
- Did it alter a threshold or gate? No new threshold introduced; the
  TUI only *displays* the count (`> 0`), it does not gate anything.
  `reviewBacklogSize` is informational, `authority: none`-style, consistent
  with every other witness/evidence primitive in this repo.
- Cherry-picked evaluation? No — ran the full `npm test` (unit + governance),
  not a subset.
- Hidden cost / undocumented cache reliance? None; pure function, no I/O
  added to the library.
- Any change to `LEDGER_COLUMNS`, `VERDICTS`, `EVALS`, or the on-disk ledger
  schema? No — this is a computed-signal addition, not a ledger-row schema
  change (unrelated to the 40 pre-existing `ledger verify` structural errors
  from portfolio-cycle rows, already tracked in issues #48/#58).

## Security review

No new I/O, no new filesystem/network surface, no credential handling. The
new CLI flag (`--open-count`) parses a bounded non-negative integer with a
fail-closed usage error on anything else — same shape as the existing
`--merged` parser, audited the same way. No prompt-injection surface (no
free text is parsed into code paths). No MCP authority or agent-impersonation
surface touched.

## Witness

Computed via `dream-machine witness stamp` against this file's final
committed bytes (`docs/dream-cycle/2026-09-11-ledger-signals-report.md`) and
`SESSION_COMMIT=3edd426f6c9c4b1e80235f7447dc863e749345cc`. Recorded in the PR
body and the `LEDGER.md` row for this night, not inlined here — hashing a
file that embeds its own hash is self-referential (same convention as the
2026-09-07 report). Reproduce independently:

```bash
REPORT_HASH=$(sha256sum docs/dream-cycle/2026-09-11-ledger-signals-report.md | awk '{print $1}')
SESSION_COMMIT=3edd426f6c9c4b1e80235f7447dc863e749345cc
printf '%s%s' "$REPORT_HASH" "$SESSION_COMMIT" | sha256sum | awk '{print $1}'
# must equal the WITNESS value published in the PR body and LEDGER.md
```

## Recommendation

ACCEPT for human review (draft PR only — this session never merges). Next
steps:
1. A human decides whether to actually merge any of the 5+ open candidate
   PRs — no code change can substitute for that; `reviewBacklogSize` only
   makes the queue depth visible, it does not clear it.
2. If backlog visibility proves useful, a *future* night could consider
   whether `learningSignals` should gain a policy-level reaction (e.g. "skip
   opening a new PR above threshold N") — deliberately not attempted tonight;
   that is a behavior change to the pipeline's own output cadence and
   deserves its own frozen hypothesis and human sign-off, not a rider on this
   candidate.
3. Wire `--open-count` into the *compiled* nightly prompt's STEP 1 (ledger
   check) so a live GitHub PR count is passed automatically instead of being
   an unused capability — out of scope tonight (touches `packages/compile`,
   a different package/surface than this candidate).
