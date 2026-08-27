# 2026-08-26 research note: evidence carrying completion

## Finding

A new agent termination result, arXiv:2608.23623, treats COMPLETE as a certifiable state transition rather than a model opinion. Each required answer claim must cite in-scope trace evidence and deterministic closed replay must reconstruct the claimed value.

## Evidence classification

Originating-team report, announced August 26, 2026. The paper reports a locked synthetic study and a fresh prespecified held-out study. Dream Machine has not independently reproduced the headline safety deltas.

## Reported result

The held-out study reports 0 of 66 premature unsupported terminations for ECT versus 40 of 66 for the faithful controller. Supported completion was 97 of 132 versus 92 of 132 and met the paper's stated noninferiority margin. Recovery succeeded in 18 of 66 trajectories, with 17 subsequently completing with support.

## RuV mapping

The primitive is directly reusable by Dream Machine, MetaHarness, Ruflo, RVM, RVF, and Core Memory. Dream Machine already provides run witnesses and evaluator gates. ECT adds claim-level closure at the terminal boundary.

## Contradiction result

ECT does not prove correctness of the external world. A tool can return a wrong value and deterministic replay can faithfully reproduce that wrong value. The primitive therefore belongs below semantic judgment but above raw model completion. It should be paired with independent evaluators, policy enforcement, and signed provenance where required.

## Candidate implementation

This branch adds a deterministic implementation to `@dream-machine/witness` with no model dependency and no data migration. It rejects missing evidence, empty evidence, scope violations, malformed hashes, duplicate trace identifiers, replay failures, replay mismatches, and post-certificate trace mutation.

## Benchmark status

Structural tests are included. A matched baseline-versus-ECT fault-injection benchmark remains required before adopting the paper's performance claims. The benchmark must report unsafe completion, supported completion, recovery rate, runtime overhead, trace size, failure categories, sample size, and reproduction steps.

## Rollback

The change is additive. Delete the ECT source, test file, export, research note, and ADR to restore prior behavior.
