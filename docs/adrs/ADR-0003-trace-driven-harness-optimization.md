# ADR-0003: Trace-driven harness optimization with held-out promotion gates

**Status:** Proposed  
**Date:** 2026-08-25  
**Related:** #25, arXiv:2608.23041, arXiv:2608.23552

## Context

Dream Machine already freezes hypotheses, evaluates a parent before a candidate, constrains Darwin search, preserves failures, and separates evaluation from promotion. Two new external systems sharpen the missing primitive.

AutoSaddler treats harness optimization as offline learning over execution failures. It reports gains of 9.0, 9.6, and 10.0 percentage points on GAIA2, SWE-Bench Pro, and Terminal-Bench 2.0. Its ablations favor deep diagnosis, targeted patches, and validation-aware selection over shallow reflection and unconstrained editing.

Prime Agent demonstrates a continual harness that preserves memories, skills, prompts, subagent specifications, and recovery state across trajectories. It reports ARC-AGI-3 RHAE Best@1 rising from 30% to 95.5%, but its runtime is explicitly not a security sandbox. This reinforces the need to separate mutable harness state from authoritative execution controls.

Dream Machine currently expresses these ideas in prompt policy but lacks a reusable programmatic selector that can reject over-broad, evaluator-changing, authority-expanding, or non-generalizing harness patches.

## Decision

Add a deterministic trace-driven harness optimization primitive under `@dream-machine/compile/optimizer`.

The primitive SHALL:

1. cluster failure traces by benchmark and failure category;
2. represent candidate harness changes as explicit patch objects with source traces, target surfaces, changed-line count, evaluator mutation, and authority expansion metadata;
3. require validation evidence and, by default, held-out evidence;
4. reject candidates that modify evaluators, expand runtime authority, violate protected invariants, contain unresolved security findings, exceed the change budget, or regress a validation slice beyond policy;
5. score only candidates that clear those gates, with a small complexity penalty that favors smaller changes;
6. return `ACCEPT`, `REJECT`, or `INCONCLUSIVE` without merging, deploying, or mutating authoritative state.

The initial implementation is intentionally model-independent. Diagnosis and patch generation may be supplied by MetaHarness, Ruflo, or an external model, while selection remains deterministic and auditable.

## Consequences

Positive consequences:

* failure traces become reusable optimization data rather than postmortem prose;
* generalization checks become a first-class promotion input;
* targeted one-surface patches are favored over broad harness rewrites;
* evaluator integrity and authority expansion are explicit hard gates;
* the primitive can be reused by Dream Machine, MetaHarness, Ruflo, and Darwin-style bounded evolution.

Costs and limitations:

* the selector assumes each metric declares whether higher or lower is better;
* an aggregate score cannot prove causal improvement;
* held-out evidence quality still depends on benchmark construction;
* the first version does not generate patches or perform semantic trace diagnosis;
* security isolation remains the responsibility of RVM or an external sandbox.

## Alternatives considered

### Prompt-only optimization

Rejected because prompt text is difficult to test independently and cannot provide a stable API for downstream systems.

### Unconstrained self-editing

Rejected because broad edits create attribution ambiguity, increase reward-hacking risk, and make rollback harder.

### Training-set improvement only

Rejected because it selects trajectory-specific repairs. Held-out evidence is required by default.

### Directly importing AutoSaddler or Prime Agent

Rejected for the first implementation. Both systems contain broader runtime assumptions. The reusable primitive needed by RuV is smaller: deterministic diagnosis inputs, bounded candidate metadata, validation gates, and auditable selection.

## Test contract

The implementation must prove:

1. deterministic failure clustering;
2. acceptance of a targeted patch with positive validation and hold-out evidence;
3. `INCONCLUSIVE` when hold-out evidence is absent;
4. rejection of evaluator mutation and runtime authority expansion;
5. rejection of over-broad edits and protected invariant failures;
6. rejection of material regression on any validation slice;
7. selection of the strongest accepted generalizing patch.

Integration benchmarking must separately report baseline harness, candidate harness, benchmark version, model, workload, seeds, sample size, absolute and relative task success, token and wall-clock cost, variance, failed traces, and security regressions.

## Rollback

The change is additive. Removing the `./optimizer` package export and the two source files fully removes the runtime surface. No persistent data migration is introduced.

## References

* Sungho Park et al., “AutoSaddler: Automatic Harness Optimization with Durable Updates from Agent Execution Traces,” arXiv:2608.23041, submitted 2026-08-24.
* Seth Karten et al., “Prime Agent: A Self-Improving RLM Harness,” arXiv:2608.23552, submitted 2026-08-24.
