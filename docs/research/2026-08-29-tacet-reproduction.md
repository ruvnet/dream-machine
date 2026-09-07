# Tacet reproduction protocol

Source: arXiv 2608.27451, submitted 2026 08 27.

Upstream reference implementation: `abuach/tacet-python`, pinned commit `8fe2761950ac2330566538aa06d04e660f62401e`, MIT license.

Evidence class: strong theory plus originating implementation. The metatheory is machine checked in Lean 4, but Dream Machine has not independently reproduced the empirical case studies or verified integration assumptions.

## Reproduction

1. Run the upstream gates at the pinned commit.
2. Reproduce the SWE Bench Verified and BIG Bench Hard case studies.
3. Create null Dream Machine simulations with no real candidate improvement and repeated adaptive comparisons.
4. Compare current promotion logic, a fixed family correction, and sequential validity accounting.
5. Inject known effects of increasing size and measure power as well as false discoveries.

## Metrics

Report number of claims attempted, number affordable, number supported, false discoveries, false discovery ratio, true positive rate, sample footprint, cluster structure, runtime overhead, storage overhead, and all mechanism refusals.

## Adversarial cases

1. Outcome selected samples presented as preregistered.
2. Paired observations tested as independent.
3. Repository clustered observations treated as independent instances.
4. Reordered claims after outcome inspection.
5. Early stopping after favorable evidence.
6. Resetting the validity pool between nightly runs.
7. Evaluator mutation after registration.

## Acceptance gate

Do not use this for promotion until upstream results reproduce at the pinned commit and null simulations remain within the configured false discovery bound. The gate must refuse malformed design assumptions and must not allow an agent to reset experimental history by creating a new run identifier.
