# ADR-0004: Evidence carrying termination for agent completion

Status: Proposed

Date: 2026-08-26

Related: arXiv:2608.23623, `@dream-machine/witness`

## Context

Tool using agents frequently terminate because a model predicts that the task is done. That decision can be wrong even when every individual tool call was valid. A completion critic can also accept a plausible final answer that is not actually supported by the recorded execution trace.

The August 26, 2026 Evidence Carrying Termination work tests a stricter boundary: COMPLETE is permitted only when each required answer claim is bound to valid in scope evidence and a deterministic replay reconstructs the asserted value. The reported held out study produced zero premature unsupported terminations for ECT versus 40 of 66 for the faithful controller baseline, while supported completion stayed within a prespecified noninferiority margin. These are originating team results and must be independently reproduced before performance claims are adopted by Dream Machine.

Dream Machine already has witness hashes, evaluator gates, ledgers, and provenance. The missing primitive is a claim level completion certificate that binds a task result to a specific trace and rejects unsupported closure.

## Decision

Add an additive Evidence Carrying Termination primitive to `@dream-machine/witness`.

A completion claim contains:

1. a stable claim identifier
2. the SHA 256 hash of the canonical claimed value
3. the exact evidence identifiers required to reconstruct it
4. the scopes from which supporting evidence is permitted

A trace evidence record contains a stable identifier, scope, kind, sequence, input hash, output hash, and optional nonauthoritative metadata.

The runtime may emit COMPLETE only when all required claims pass all gates:

1. every cited evidence identifier exists exactly once in the trace
2. each cited record is within the claim scope
3. the claim has at least one supporting record
4. a deterministic replay that receives only the cited records reconstructs the claimed value hash
5. the resulting certificate binds all claims to the canonical hash of the complete trace

Any failure returns RECOVER and emits no partial completion certificate.

The certificate proves support in the recorded trace under the caller supplied replay function. It does not prove external truth, safety, policy compliance, or authority. RVM or another authoritative runtime remains responsible for capability enforcement.

## Consequences

Positive consequences:

1. unsupported completion becomes mechanically rejectable rather than a model judgment
2. completion evidence can be independently replayed and audited
3. the same primitive is reusable by Dream Machine, MetaHarness, Ruflo, RVM, RVF, and Core Memory receipts
4. certificate generation adds no model dependency
5. rollback is trivial because the change is additive and has no data migration

Costs and limitations:

1. callers must define deterministic claim replay functions
2. a replay can reproduce an incorrect tool result, so external truth is not guaranteed
3. trace scope labels are only meaningful if authority is enforced elsewhere
4. hashes hide values but do not themselves provide confidentiality or authenticity
5. large traces may require separate retention and content addressed storage

## Alternatives considered

### LLM completion critic

Rejected as the only gate because the critic can accept plausible but unsupported outcomes and adds inference cost and latency.

### Final answer schema validation

Rejected because structural validity does not show that answer claims descend from execution evidence.

### Full formal proof system

Deferred. Kernel checked proofs can provide stronger guarantees but add substantially more implementation and integration cost. ECT is a small deterministic substrate that can later carry formally verified receipts.

## Test contract

The implementation must have deterministic tests proving:

1. valid trace and replay produce a stable certificate
2. missing evidence forces RECOVER
3. out of scope evidence forces RECOVER
4. replay mismatch forces RECOVER
5. duplicate evidence identifiers force RECOVER
6. trace mutation invalidates a prior certificate
7. empty evidence and malformed value hashes are rejected

Before this ADR is accepted, run a matched fault injection benchmark against the current completion path. Report baseline and candidate unsafe completion, supported completion, recovery rate, runtime overhead, trace size, and failure categories. No external performance claim is adopted until reproduced.

## Security and governance

Completion evidence must never grant authority. An agent cannot broaden an evidence scope, issue its own capability grant, or convert peer confidence into runtime permission. Sensitive trace values should remain outside the certificate and be referenced by content hash. Signed receipts can be layered on top through RVF or RVM.

## Rollback

Remove `packages/witness/src/termination.ts`, its tests, the export from `packages/witness/src/index.ts`, and this ADR. No schema or data migration is required.

## References

Jason Liu, "When May an Agent Stop? Evidence Carrying Termination for Tool Using LLMs," arXiv:2608.23623, announced August 26, 2026.
