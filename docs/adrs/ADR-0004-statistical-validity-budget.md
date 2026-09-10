# ADR 0004: Statistical validity budget for adaptive self improvement

Status: Proposed

Date: 2026 08 29

## Context

Dream Machine repeatedly proposes, measures, rejects, and revisits candidate improvements. This adaptive loop creates a multiple comparison problem even when every individual benchmark is honestly executed. Repeated testing against the same evidence can eventually manufacture an apparently significant winner.

Tacet, arXiv 2608.27451, formalizes a useful control boundary. Analyses declare their artifact unit and dependence structure before reading outcomes, separate free descriptive estimation from priced inferential claims, track whether selection consulted outcomes, and refuse claims that use the wrong statistical mechanism or exceed a sequential validity budget. The accompanying reference implementation and Lean mechanization are MIT licensed. The reference implementation is pinned for reproduction at commit 8fe2761950ac2330566538aa06d04e660f62401e.

## Decision

Add a statistical validity gate to Dream Machine promotion evidence. Do not reimplement Tacet statistics from scratch in TypeScript until the upstream behavior is independently reproduced.

A promotion experiment must declare before outcome observation:

1. artifact unit
2. cluster unit and functional dependencies when applicable
3. primary comparison
4. allowed secondary comparisons
5. directionality
6. significance family or validity pool
7. maximum sample count and stopping rule
8. immutable evaluator identity

Descriptive metrics remain free to record. A claim that a candidate beats baseline is inferential and must pass the configured validity mechanism.

## Invariants

1. Outcome selected samples cannot later be presented as preregistered confirmatory evidence.
2. Repeated nightly comparisons spend from a persistent validity budget rather than resetting alpha every run.
3. Paired or clustered artifacts cannot silently use an independent sample test.
4. Changing evaluator, artifact unit, cluster definition, stopping rule, or claim family invalidates the prior registration for promotion purposes.
5. Rejected and inconclusive experiments remain recorded and continue to count toward adaptive search provenance.
6. Statistical validity never replaces effect size, regression, security, provenance, or authority gates.
7. The external reference implementation is optional and isolated. Failure or incompatibility must fail closed for promotion claims, not for descriptive research.

## Integration

Dream Machine stores the experiment declaration before candidate evaluation. MetaHarness runs statistical reproduction independently. Witness records bind declaration digest, evaluator digest, sample identity, comparison result, and validity decision. Core Memory retains the family history across nights. RVM remains the authority boundary and does not accept statistical confidence as execution permission.

## Validation plan

Reproduce the upstream Tacet case studies at the pinned commit. Then replay historical Dream Machine experiments through three conditions:

A. current promotion evidence

B. fixed family correction

C. sequential validity budget with outcome selection tracking

Measure accepted claims, false positives under shuffled labels, power on injected effects, runtime overhead, storage overhead, and disagreement cases.

## Acceptance gate

The gate must reject all deliberately invalid paired or clustered mechanisms in the test corpus, identify outcome selected samples, preserve declared valid strong effects, and keep false discovery under the configured bound in null simulations. Promotion latency overhead should remain negligible relative to model evaluation.

## Rollback

Disable inferential promotion and continue recording descriptive metrics. No experimental history may be deleted to restore budget.
