# ADR 0009: Discovery evidence before scientific agent promotion

Status: Proposed

Date: 2026-09-07

Issue: #92

## Context

Dream Machine can already freeze experiment manifests, prove evidence assignment coverage, verify security patch root causes, and preserve environment reconstruction provenance. Those controls answer whether declared evidence exists and whether a bounded evaluator universe was followed. They do not answer whether an open-ended scientific claim performed the discriminating checks needed to deserve promotion.

TruthInsightBench, submitted 2026-09-04, evaluates 40 blind scientific discovery tasks from 40 peer-reviewed studies across 10 domains. On one frozen base model, four coding agent configurations score 58.4 to 60.3 of 100 without statistically reliable pairwise separation. The reported weakness is concentrated in controls, robustness, falsifiability, and cross-dataset generalization rather than basic analysis execution or documentation.

This is relevant to Dream Machine, MetaHarness, Core Memory, RVF, RVM, Cognitum, and autonomous discovery programs. A system can produce complete, replayable evidence for a weak scientific claim. Evidence completeness must therefore remain distinct from evidentiary maturity.

## Decision

Add a deterministic `DiscoveryEvidencePolicy` and `DiscoveryEvidenceReceipt` to `@dream-machine/witness`.

The policy is frozen before candidate outcomes are visible and contains only bounded metadata:

1. stable policy identity
2. protocol version
3. canonical commit timestamp
4. digest of the preregistered hypothesis or objective
5. exact required scientific criteria
6. whether evidence must be independent of candidate mutation
7. minimum replicate count

The first supported criteria are controls, falsification, robustness, cross-dataset generalization, and reproducibility.

Each criterion observation records only its evidence digest, pass or fail state, independence state, and bounded replicate count. Raw datasets, private analyses, prompts, and reports do not enter the receipt by default.

A verdict is one of:

`PASS`: every frozen criterion is present, passed, sufficiently replicated, and independent when required.

`REJECTED`: a criterion failed or violates a frozen independence requirement.

`INCONCLUSIVE`: required evidence is missing or below the frozen replicate minimum.

`INVALID`: the policy digest changed, input is malformed, a criterion is duplicated, or evidence appears for a criterion outside the frozen evaluator universe.

Every receipt has `authority: none`.

## Relationship to existing witness primitives

`ClaimVerification` remains responsible for manifest identity, evidence assignment, required-field coverage, terminal claim coverage, and evidence opening.

`DiscoveryEvidenceReceipt` is a second layer that evaluates the scientific checks attached to a claim. It does not duplicate evidence assignment and it does not claim scientific truth.

The independently anchored policy digest is mandatory. The candidate cannot rewrite the required criteria after seeing results.

## Security properties

1. Policy rewriting fails closed.
2. Duplicate and undeclared criteria fail closed.
3. Evidence digests are validated as lowercase SHA 256 values.
4. Counts are bounded before allocation or aggregation.
5. Canonical timestamps prevent multiple textual encodings of the same nominal freeze time.
6. Receipts contain no execution capability and cannot authorize merge, deployment, data release, physical action, or privilege expansion.
7. Independent evidence is represented explicitly rather than inferred from a model identity string.

The remaining trust boundary is evidence admission. A dishonest evaluator can still assert that an evidence digest represents a valid control. Production use must bind observations to witness-verified evaluator artifacts and, where privileged actions are involved, RVM authorization remains separate.

## Benchmark protocol

Freeze at least 40 blind discovery tasks before evaluation.

Compare three conditions under the same base model, task data, seeds, context budget, and overall evaluator budget:

A. existing Dream Machine promotion evidence only

B. existing evidence plus deterministic discovery evidence gating

C. a TruthInsightBench-compatible scientific maturity scorer as an independent evaluation arm

Record baseline, candidate, workload digest, operating system, runtime versions, model and judge identities, seeds, sample size, criterion-level outcomes, false promotion rate, false rejection rate, task quality, variance, tokens, latency, model cost, failures, regressions, and reproduction commands.

Include deliberately under-supported claims, strong-control claims, missing evidence, malformed evidence, contradictory controls, resource exhaustion attempts, evaluator disagreement, and cross-dataset failures.

## Promotion criteria

The primitive is eligible to advance only when all of the following hold on the frozen benchmark:

1. at least 90 percent of deliberately under-supported claims are prevented from promotion
2. no more than 5 percent of frozen strong-control claims are rejected
3. zero capability or authority expansion occurs
4. deterministic local gate overhead is below 1 percent of total evaluation time, excluding any external scientific judge
5. independent MetaHarness reproduction reaches the same verdict from pinned commits and seeds
6. repository tests, dependency review, and security scanning remain green

## Falsification

A model-generated scientific rubric may add cost without improving validity. If a deterministic checklist performs within variance of a model-based scorer on the blind holdout, retain the deterministic gate and reject the additional model dependency.

A passing discovery receipt may still correspond to a false scientific conclusion. This ADR is an evidence-readiness gate, not a truth certificate.

## Migration

Additive only. No stored receipt or existing promotion record is migrated. Existing promotion behavior remains unchanged until an explicit caller adopts the new gate.

## Rollback

Remove the export or stop calling the gate. No data migration, model migration, or persistent format conversion is required.

## Commercial implication

Cognitum can expose a stronger evidence contract for autonomous research systems: a discovery cannot be promoted merely because an agent ran code and produced a report. The system can prove that predefined controls, falsification, robustness, generalization, and reproducibility requirements were evaluated independently before promotion.
