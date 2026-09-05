# ADR 0006: Root Cause Security Patch Evaluation

Status: Proposed
Date: 2026-09-04
Tracks: ruvnet/dream-machine#76

## Context

Autonomous repair can appear successful when the original proof of concept stops crashing even though the vulnerability remains. PatchBench, arXiv:2609.04075, submitted 2026-09-03, reports that original-PoC-only validation inflates agent solve rate by 1.83 times on average across 11 evaluated agents. The originating team also reports historical-fix similarity in 25 percent of agent patches and a recurring tendency to suppress the observed crash rather than repair the underlying vulnerability. RuV has not independently reproduced those results.

Dream Machine already requires frozen evaluators and held-out promotion. Security repair needs a stricter reusable contract because a single triggering crash is an especially weak proxy for the protected property.

## Decision

Add a deterministic root-cause security patch evaluation contract to `@dream-machine/witness`.

Before candidate outcomes are visible, the evaluator freezes:

1. vulnerability class
2. root-cause oracle identity
3. transformed or transplanted attack case identities
4. legitimate negative-control identities

The candidate evidence records the original PoC outcome, all frozen transformed attack outcomes, all negative controls, an independent root-cause oracle result, the regression-suite result, and optional historical-patch similarity telemetry.

Promotion fails closed when any frozen case is missing, any unexpected post-outcome case appears, a transformed attack remains successful, a negative control regresses, the root-cause oracle fails, or the regression suite fails. The contract is canonically hashed so equivalent case order produces the same digest.

Patch similarity is telemetry, not an automatic rejection criterion. A correct independent repair may legitimately resemble a historical patch. Similarity should trigger provenance review rather than become a proxy for correctness.

Every verdict explicitly carries `authority: none`. Evaluation success never grants runtime or merge authority.

## Security and governance

The evaluator owns case identities and results. Candidate code must not generate or alter its own oracle result. Evaluator changes after candidate outcomes become visible create a new experiment family. Attack payloads remain in the independent evaluation corpus rather than model-facing documentation.

## Benchmark

MetaHarness issue 281 compares crash-only validation, crash plus regression tests, and the root-cause contract on frozen seeded vulnerability-repair tasks. Report apparent solve rate, root-cause solve rate, false promotion, legitimate patch rejection, evaluator time, model cost, patch similarity, regressions, and exact reproduction steps.

Promotion requires at least 50 percent lower false security promotion than the stronger existing evaluator while legitimate patch acceptance stays within three absolute percentage points.

## Rollback

The implementation is additive to the witness package and changes no existing Dream Machine promotion path by default. Removing the module and export restores previous behavior. No persistent-state migration is required.
