# ADR-0003: Anchored trace replay for causal failure experiments

**Status:** Proposed  
**Date:** 2026-08-27  
**Related:** Dream Machine issue #41, ADR-0001, `@dream-machine/witness`

## Context

Long-horizon agent and multi-agent failures are stochastic. Re-running a failed workflow from the beginning changes both the proposed repair and the trajectory that led to the failure. A later success therefore does not establish that the repair caused the improvement.

SymTrace, arXiv:2608.25920, makes this confound explicit. It records a trajectory, chooses an intervention anchor, reconstructs the prefix from recorded evidence, and regenerates only the suffix. The paper reports poor failure reproduction and repair from unguided whole-trajectory reruns and materially higher repair from symptom-driven anchored intervention. Those paper results are external evidence, not yet a RuV reproduction.

Dream Machine already produces provenance witnesses and applies held-out promotion gates. It lacks a small reusable primitive that proves a repair experiment started from the same causal prefix.

## Decision

Add anchored trace replay receipts to `@dream-machine/witness`.

A trace is an ordered sequence of JSON-safe events with unique ids and strictly increasing integer steps. An anchored replay binds:

1. the digest and length of the immutable prefix before the intervention
2. the exact anchor id, step, and evidence digest
3. the digest of the original suffix for audit
4. the digest of the complete original trace

Before regenerated execution can be compared, the reconstructed prefix must match the anchored prefix exactly. The regenerated suffix must begin strictly after the anchor and cannot reuse immutable event ids. A successful finalize operation emits a deterministic receipt for the regenerated suffix and the combined candidate trace.

The implementation uses canonical JSON plus SHA-256 and rejects unsupported or ambiguous evidence such as `undefined`, non-finite numbers, cycles, duplicate ids, and non-monotonic steps.

## Authority boundary

A trace digest proves evidence identity only. It grants no execution capability, tool permission, model permission, network access, filesystem access, deployment right, or promotion right. RVM or another authoritative runtime remains responsible for capability enforcement.

A replay receipt may be an input to Dream Machine evaluation. It can never be sufficient evidence for autonomous merge or deployment.

## Consequences

Positive:

* repair experiments can distinguish a changed downstream intervention from a changed upstream sample
* failed prefixes become reproducible regression fixtures
* the primitive is model- and framework-neutral
* the existing witness package supplies provenance without adding dependencies

Negative:

* exact prefix equality is stricter than semantic equivalence and may reject valid replays when tools emit nondeterministic metadata
* canonicalization requires JSON-safe evidence
* deterministic replay can still fail when external systems cannot reconstruct the same pre-anchor state

For nondeterministic external fields, callers must normalize them before trace creation and preserve both raw evidence and the normalization policy in higher-level provenance. The witness layer will not silently ignore fields.

## Alternatives considered

### Whole trajectory rerun

Rejected as the default repair comparison because upstream resampling changes the experiment.

### Semantic similarity of prefixes

Rejected for the evidence boundary. Similarity is useful for retrieval but cannot prove causal-prefix identity.

### Full deterministic simulator snapshot

Desirable where available but not universal. Anchored trace replay is a smaller primitive that can bind simulator snapshots, tool receipts, or other state evidence without requiring a specific runtime.

### New standalone package

Rejected for the first implementation. The primitive is small, dependency-free, and provenance-oriented, so `@dream-machine/witness` is the narrowest existing home.

## Test contract

The implementation must prove:

* deterministic canonical hashing independent of object key order
* exact prefix acceptance
* mutated prefix rejection
* moved or modified anchor rejection
* suffix boundary enforcement
* immutable id collision rejection
* duplicate and non-monotonic trace rejection
* deterministic receipt generation
* fail-closed behavior for unsupported evidence

Repository CI, type checking, lint, and the existing witness tests must remain green.

## Rollback

The change is additive. Removing the exported trace replay module and this ADR restores prior behavior. It performs no data migration and changes no existing witness format.

## References

* SymTrace: `arXiv:2608.25920`, submitted 2026-08-26
* Dream Machine issue #41
