# ADR 0011: Dream Cycle v2 — protected deep research, mode selection, and scored routine self-review

Status: Proposed

Date: 2026-10-18

Related: ADR-0001 (the nightly loop), ADR-0003 (trace-driven harness optimization), ADR-0010 (evidence freshness), ADR-0103 (governed self-evolution)

## Context

Measured on 2026-10-18 against `main` @ b2abcc1. Ledger rows are reproducible
from the repo; PR fates and counts come from the GitHub pulls API at that time and
are not stored in the repo.

| Measurement | Value | How |
|---|---|---|
| Distinct nights in `LEDGER.md` on `main` | 37 | `ledger outcomes` |
| Merge rate seen from `main`'s ledger | 0.969 | ledger PRs with known fate |
| Open `dream/*` candidate PRs, all draft | 19 (oldest 2026-09-08) | `gh` pulls API (external, not in repo) |
| Merge rate including the open queue | 0.608 | `ledger outcomes --open-count 19` with external fates |
| Last merged `dream/*` PR | #177, merged 2026-10-12 | `gh` pulls API (external, not in repo) |

Three problems follow.

1. **The loop cannot see its own bottleneck.** A night's ledger row reaches
   `main` only when its PR merges, so the ledger is survivorship-biased. Every
   STEP 1.1 signal is computed over the nights that succeeded. The nightly
   routine kept adding a draft PR per night to a queue no one was draining.
2. **Research drifted inward.** Recent findings are almost all defects in this
   repository's own validators and signals (see the ledger since 2026-09-19).
   Those are real fixes, but the template's budget line ("research < half the
   total") and its single research pass give a night no reason to import an
   external technique. Ruflo's Dream Cycle v3.1 hit the same failure and
   rewrote its budget to protect research.
3. **Self-improvement is unscored.** Nothing changes the routine based on its
   own outcomes, and nothing checks whether a past routine change helped.

Prior art. The Darwin Gödel Machine (Zhang et al., arXiv:2505.22954, ICLR 2026)
self-modifies coding agents and keeps a change only when it is empirically
validated on benchmarks, retaining an archive of variants. AlphaEvolve
(Google DeepMind, 2025) pairs LLM-proposed program changes with automated
evaluators as the selection signal. The AI Scientist-v2 (Yamada et al.,
arXiv:2504.08066) structures experimentation as agentic tree search. All three
make the evaluator, not the proposer, decide what survives. This ADR applies
that to the routine itself, under ADR-0103's rule that evolution produces
candidates only.

## Decision

Add four opt-in `dream.config` fields. Absent fields compile byte-identically to
v1, which the existing golden snapshots enforce.

1. **`researchDepth`** `{ minPrimarySources, minRecentSources, externalCandidates }`.
   STEP 3 becomes three passes (DISCOVER, DEEPEN, ATTACK) with source floors, a
   SOTA delta against the last report on the same surface, a reason for every
   empty competitor row, and a quota of candidates that import an external
   technique. STEP 0.6 protects research: overruns are cut from the end of the
   pipeline first.
2. **`implementationTrack`** `{ reviewBacklogLimit }`. A new STEP 1.5 measures
   the real pipeline (`ledger outcomes --open-count`, `ledger backlog`) and picks
   one MODE in order:
   - **CONSOLIDATE** when open candidates ≥ the limit and an eligible PR exists
     (draft, ACCEPT, not a self-review PR, not yet consolidated at the current
     default-branch SHA). Refresh it against `main`, re-evaluate, re-run the
     critic and reward-hack check, and mark it ready only if all three hold. A
     marker comment records the SHA so the next night moves on. Nothing new is
     opened.
   - **RESEARCH-ONLY** when the queue is over the limit and nothing is eligible:
     full research, gist and issue, no PR; the finding enters the backlog.
   - **IMPLEMENT** when unimplemented findings exist: build the oldest after a
     SOTA refresh. Findings whose PR is still open are in flight and excluded.
   - **RESEARCH** otherwise.
3. **`selfReview`** `{ everyDays }`. On `EPOCHDAY % everyDays == 0`, the night's
   candidate is a change to the routine. It first scores the previous
   self-review's frozen forecast (HIT or MISS), clusters recent failure causes
   with the `clusterFailureTraces` taxonomy, changes one thing aimed at the
   largest cluster, and freezes a new forecast in the ledger Effect column. It
   takes precedence over MODE and is the only night that may open a PR while
   the queue is full. A listed routine constitution is out of bounds; touching
   it is REJECT. It covers the invariants, promotion gate, merge policy,
   `prMode` and the ready predicate, the CONSOLIDATE limits, the critic,
   evaluators and thresholds, witness and ledger schema, `reviewBacklogLimit`,
   `everyDays`, config validation, the v1 snapshots, `v2.test.ts`, and the list
   itself. Research floors may be raised, never lowered.
4. **`prMode`** `'draft' | 'ready-on-accept'`. With `ready-on-accept`, a PR is
   marked ready for review only when VERDICT=ACCEPT, required checks on the
   exact head are green, and the critic is clear. Self-review PRs always stay
   draft. The session still never merges.

Two pure functions back STEP 1.5 and 1.6: `outcomeMetrics` (with
`pipelineMergeRate`, which corrects the survivorship bias) and
`implementationBacklog` in `@dream-machine/ledger`, exposed as
`dream-machine ledger outcomes|backlog`.

This repository's own `dream.config.json` enables all four with floors 8/3/2, a
backlog limit of 6, a 7-day self-review, and `ready-on-accept`. It also pins the
darwin entrypoint to `@metaharness/darwin@0.12.0`, clearing the long-standing
unpinned-`npx` warning.

## Consequences

- With 19 open drafts and a limit of 6, the next nights run CONSOLIDATE, one
  PR per night, until every eligible draft is current; then RESEARCH-ONLY until
  humans drain the queue below 6. Backpressure moves to the reviewer: the loop
  stops adding PRs but keeps researching. Expect fewer new PRs and more
  review-ready ones.
- The constitution is enforced by the prompt and by a tripwire test pinning this
  repo's floors, limit, cadence and `prMode`. Neither stops a determined
  proposer; mechanical enforcement (CODEOWNERS or a path-protected check on
  `v2.ts`, `config.ts`, the snapshots and `v2.test.ts`) is a follow-up.
- Research nights cost more tokens. That cost is intended; it is cheaper than
  evaluation and is what the operator reads.
- The self-review cadence uses epoch days because `YYYYMMDD % 7` fires on both
  2026-10-31 and 2026-11-01. The slot rotation still uses `DAYINT %
  slots.length` and has the same month-boundary irregularity; left unchanged
  here to keep v1 output identical.
- A consolidation night merges `main` into a PR branch and pushes. That is a
  write the v1 routine did not make; it uses merge commits only and never
  force-pushes.

## Alternatives Considered

- **Rewrite the template unconditionally.** Rejected: every other target's
  compiled prompt would change without its owner opting in.
- **Auto-merge ACCEPT PRs to drain the queue.** Rejected: violates
  evaluation-is-not-promotion. Ready-for-review moves work to the human queue
  without granting authority.
- **Let the self-review night change any part of the routine.** Rejected: a loop
  that can edit its own gate can grade itself (ADR-0103 §2.2).

## Test Contract

- v1 configs compile byte-identically (existing snapshots unchanged; `prMode:
  'draft'` equals omission).
- v2 validation rejects out-of-range, non-integer, wrong-shape and unknown-field
  values.
- A v2 compile contains every v1 invariant line, the full constitution, mode
  order CONSOLIDATE before IMPLEMENT before RESEARCH, and the ready-on-ACCEPT rule.
- `outcomeMetrics` counts re-appended nights once, returns null rates when
  nothing is resolved, and computes `pipelineMergeRate` only with an open count.
- `implementationBacklog` drops findings whose direction later merged.

## References

- Zhang et al., "Darwin Gödel Machine: Open-Ended Evolution of Self-Improving Agents", arXiv:2505.22954; ICLR 2026 poster https://iclr.cc/virtual/2026/poster/10007327 (grade A: peer-reviewed).
- Yamada et al., "The AI Scientist-v2: Workshop-Level Automated Scientific Discovery via Agentic Tree Search", arXiv:2504.08066 (grade B: preprint with public code).
- Google DeepMind, "AlphaEvolve", May 2025 (grade B: vendor white paper).
- ruvnet/ruflo Dream Cycle v3.1 routine prompt, budget rewrite (internal precedent).
- ruvnet/core-memory issue #187, schedule contract (pinning, receipts, quiet skips).
