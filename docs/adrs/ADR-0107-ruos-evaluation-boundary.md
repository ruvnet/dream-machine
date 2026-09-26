# ADR-0107: Independent ruOS evaluation boundary

Status: Implemented for compiler and receipt contract; live deployment requires external controllers
Date: 2026-09-20
Related: ADR-0010, ADR-0103, ADR-0105

## Context

Research acceptance can outpace integration and does not establish deployed customer value.
Desktop evaluation can expose broken user journeys but screenshots alone do not prove state,
independence, authorization or secure isolation.

## Decision

Add an optional strict `ruosEvaluation` configuration. Omitted configuration preserves existing
compiled output. Enabled evaluation requires a safe dedicated machine identifier, actual screenshots,
and bounded receipt freshness. The compiler specifies frozen baseline, candidate, target, corpus
and external policy bindings with an independent verifier.

The researcher does not control evaluator policy or promotion. A separate controller provisions
isolation and protects evidence creation; a separate promotion service enforces branch protection
and deployment gates. Missing isolation, observation or exit status never yields success. Candidate
code cannot access reusable production sessions or production secrets. Evidence is redacted and
must not cross private/public boundaries. Existing autoMerge defaults remain false.

## Consequences

The contract makes incomplete evidence rejectable without claiming to supply production infrastructure.
Independent execution adds cost and latency; enable it for changed user journeys and reuse clean images,
never mutable sessions. Frozen comparisons reduce attribution ambiguity but cannot guarantee no regressions.

## Alternatives considered

Researcher-authored approval was rejected because it combines evidence generation and release authority.
Screenshots alone were rejected because a rendered success indicator can hide incorrect persisted state.
Mandatory global enablement was rejected because unavailable desktop capabilities would disrupt existing loops.

## Test contract

Default snapshots remain unchanged. Invalid option types, unknown fields, unsafe machine identifiers,
missing screenshot requirements and out-of-bound ages fail validation. Enabled prompts require
independence, exact binding, private evidence handling and fail-closed observation. Live acceptance
requires a separately executed desktop journey and deployment verification.

## References

[Runbook](../runbooks/ruos-improvement-loop.md)
