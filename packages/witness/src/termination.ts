/**
 * Evidence-Carrying Termination (ECT) primitive.
 *
 * A caller may declare COMPLETE only when every required claim is bound to
 * recorded, in-scope trace evidence and a deterministic closed replay over only
 * that evidence reconstructs the claimed value hash.
 *
 * This certifies support in the supplied trace under the caller's replay
 * function. It does not certify external truth, safety, or authorization.
 */
import { createHash } from 'node:crypto';

export type JsonPrimitive = null | boolean | number | string;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

export interface TraceEvidence {
  /** Stable identifier unique within a trace. */
  id: string;
  /** Capability or data scope under which the evidence was produced. */
  scope: string;
  /** Tool, observation, receipt, or other evidence kind. */
  kind: string;
  /** Monotonic sequence number in the recorded trace. */
  sequence: number;
  /** Hash of the tool input or observed input. */
  inputHash: string;
  /** Hash of the tool output or observed output. */
  outputHash: string;
  /** Optional non-authoritative labels. */
  metadata?: Record<string, string>;
}

export interface CompletionClaim {
  /** Stable claim identifier, for example `benchmark.result`. */
  id: string;
  /** SHA-256 of the canonical JSON value the claim asserts. */
  valueHash: string;
  /** Evidence ids sufficient to replay this claim. */
  evidenceIds: string[];
  /** Scopes from which evidence may legally support this claim. */
  allowedScopes: string[];
}

export interface CertifiedClaim extends CompletionClaim {
  /** Canonical hash of the exact evidence subset used for closed replay. */
  evidenceHash: string;
}

export interface CompletionCertificate {
  version: 1;
  taskId: string;
  /** Hash of the complete ordered trace, binding the certificate to one run. */
  traceHash: string;
  claims: CertifiedClaim[];
  /** Hash of all certificate fields except this field. */
  certificateHash: string;
}

export interface CompletionFailure {
  claimId: string;
  reason:
    | 'empty-claims'
    | 'duplicate-evidence-id'
    | 'missing-evidence'
    | 'empty-evidence'
    | 'out-of-scope-evidence'
    | 'malformed-value-hash'
    | 'replay-failed'
    | 'replay-mismatch';
  detail: string;
}

export type ReplayClaim = (claim: CompletionClaim, evidence: readonly TraceEvidence[]) => JsonValue;

export interface CompletionDecision {
  status: 'COMPLETE' | 'RECOVER';
  certificate?: CompletionCertificate;
  failures: CompletionFailure[];
}

const HEX64 = /^[0-9a-f]{64}$/;

/** Deterministic JSON encoding used for all ECT hashes. */
export function canonicalJson(value: JsonValue): string {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') {
    return JSON.stringify(value);
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('canonical JSON rejects non-finite numbers');
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(',')}]`;
  }
  const entries = Object.entries(value).sort(([a], [b]) => a.localeCompare(b));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(',')}}`;
}

export function hashJson(value: JsonValue): string {
  return createHash('sha256').update(canonicalJson(value)).digest('hex');
}

function evidenceToJson(e: TraceEvidence): JsonValue {
  return {
    id: e.id,
    inputHash: e.inputHash,
    kind: e.kind,
    metadata: e.metadata ?? {},
    outputHash: e.outputHash,
    scope: e.scope,
    sequence: e.sequence,
  };
}

export function hashTrace(trace: readonly TraceEvidence[]): string {
  const ordered = [...trace].sort((a, b) => a.sequence - b.sequence || a.id.localeCompare(b.id));
  return hashJson(ordered.map(evidenceToJson));
}

/**
 * Attempt to close a task with an evidence-carrying certificate.
 *
 * The replay function receives only the evidence explicitly cited by a claim;
 * it cannot inspect the rest of the trace through this API. A failure returns
 * RECOVER and never emits a partial certificate.
 */
export function certifyCompletion(
  taskId: string,
  claims: readonly CompletionClaim[],
  trace: readonly TraceEvidence[],
  replay: ReplayClaim,
): CompletionDecision {
  const failures: CompletionFailure[] = [];
  if (claims.length === 0) {
    failures.push({
      claimId: '*',
      reason: 'empty-claims',
      detail: 'at least one completion claim is required',
    });
  }
  const byId = new Map<string, TraceEvidence>();

  for (const e of trace) {
    if (byId.has(e.id)) {
      failures.push({
        claimId: '*',
        reason: 'duplicate-evidence-id',
        detail: `evidence id ${e.id} appears more than once`,
      });
    } else {
      byId.set(e.id, e);
    }
  }

  const certified: CertifiedClaim[] = [];

  for (const claim of claims) {
    if (!HEX64.test(claim.valueHash)) {
      failures.push({
        claimId: claim.id,
        reason: 'malformed-value-hash',
        detail: 'valueHash must be 64 lowercase hex characters',
      });
      continue;
    }
    if (claim.evidenceIds.length === 0) {
      failures.push({ claimId: claim.id, reason: 'empty-evidence', detail: 'claim cites no evidence' });
      continue;
    }

    const subset: TraceEvidence[] = [];
    let claimInvalid = false;
    for (const evidenceId of claim.evidenceIds) {
      const evidence = byId.get(evidenceId);
      if (!evidence) {
        failures.push({
          claimId: claim.id,
          reason: 'missing-evidence',
          detail: `evidence ${evidenceId} is absent from the trace`,
        });
        claimInvalid = true;
        continue;
      }
      if (!claim.allowedScopes.includes(evidence.scope)) {
        failures.push({
          claimId: claim.id,
          reason: 'out-of-scope-evidence',
          detail: `evidence ${evidenceId} has scope ${evidence.scope}`,
        });
        claimInvalid = true;
        continue;
      }
      subset.push(evidence);
    }
    if (claimInvalid) continue;

    const orderedSubset = [...subset].sort((a, b) => a.sequence - b.sequence || a.id.localeCompare(b.id));
    let replayed: JsonValue;
    try {
      replayed = replay(claim, orderedSubset);
    } catch (error) {
      failures.push({
        claimId: claim.id,
        reason: 'replay-failed',
        detail: error instanceof Error ? error.message : String(error),
      });
      continue;
    }

    const replayHash = hashJson(replayed);
    if (replayHash !== claim.valueHash) {
      failures.push({
        claimId: claim.id,
        reason: 'replay-mismatch',
        detail: `expected ${claim.valueHash}, replay produced ${replayHash}`,
      });
      continue;
    }

    certified.push({
      ...claim,
      evidenceIds: [...claim.evidenceIds],
      allowedScopes: [...claim.allowedScopes],
      evidenceHash: hashJson(orderedSubset.map(evidenceToJson)),
    });
  }

  if (failures.length > 0 || certified.length !== claims.length) {
    return { status: 'RECOVER', failures };
  }

  const traceHash = hashTrace(trace);
  const body: JsonValue = {
    version: 1,
    taskId,
    traceHash,
    claims: certified.map((claim) => ({
      id: claim.id,
      valueHash: claim.valueHash,
      evidenceIds: claim.evidenceIds,
      allowedScopes: claim.allowedScopes,
      evidenceHash: claim.evidenceHash,
    })),
  };
  const certificate: CompletionCertificate = {
    version: 1,
    taskId,
    traceHash,
    claims: certified,
    certificateHash: hashJson(body),
  };
  return { status: 'COMPLETE', certificate, failures: [] };
}

/** Verify a previously issued certificate against a trace and replay function. */
export function verifyCompletionCertificate(
  certificate: CompletionCertificate,
  trace: readonly TraceEvidence[],
  replay: ReplayClaim,
): CompletionDecision {
  const claims: CompletionClaim[] = certificate.claims.map(({ id, valueHash, evidenceIds, allowedScopes }) => ({
    id,
    valueHash,
    evidenceIds,
    allowedScopes,
  }));
  const decision = certifyCompletion(certificate.taskId, claims, trace, replay);
  if (decision.status !== 'COMPLETE' || !decision.certificate) return decision;

  if (decision.certificate.traceHash !== certificate.traceHash) {
    return {
      status: 'RECOVER',
      failures: [{ claimId: '*', reason: 'replay-mismatch', detail: 'trace hash differs from certificate' }],
    };
  }
  if (decision.certificate.certificateHash !== certificate.certificateHash) {
    return {
      status: 'RECOVER',
      failures: [{ claimId: '*', reason: 'replay-mismatch', detail: 'certificate hash mismatch' }],
    };
  }
  return decision;
}
