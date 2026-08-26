import { describe, expect, it } from 'vitest';
import {
  certifyCompletion,
  hashJson,
  hashTrace,
  verifyCompletionCertificate,
  type CompletionClaim,
  type TraceEvidence,
} from './termination.js';

const trace: TraceEvidence[] = [
  {
    id: 'build',
    scope: 'repo:read',
    kind: 'tool',
    sequence: 1,
    inputHash: 'a'.repeat(64),
    outputHash: 'b'.repeat(64),
  },
  {
    id: 'test',
    scope: 'repo:test',
    kind: 'receipt',
    sequence: 2,
    inputHash: 'c'.repeat(64),
    outputHash: 'd'.repeat(64),
  },
];

const claim: CompletionClaim = {
  id: 'tests.passed',
  valueHash: hashJson({ passed: 179 }),
  evidenceIds: ['test'],
  allowedScopes: ['repo:test'],
};

const replay = (_claim: CompletionClaim, evidence: readonly TraceEvidence[]) => ({
  passed: evidence[0]?.id === 'test' ? 179 : 0,
});

describe('evidence carrying termination', () => {
  it('issues a deterministic certificate when every claim closes under replay', () => {
    const first = certifyCompletion('task-1', [claim], trace, replay);
    const second = certifyCompletion('task-1', [claim], trace, replay);

    expect(first.status).toBe('COMPLETE');
    expect(first.failures).toEqual([]);
    expect(first.certificate).toEqual(second.certificate);
    expect(first.certificate?.traceHash).toBe(hashTrace(trace));
    expect(first.certificate?.certificateHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('rejects missing evidence rather than emitting a partial certificate', () => {
    const decision = certifyCompletion(
      'task-2',
      [{ ...claim, evidenceIds: ['missing'] }],
      trace,
      replay,
    );

    expect(decision.status).toBe('RECOVER');
    expect(decision.certificate).toBeUndefined();
    expect(decision.failures[0]?.reason).toBe('missing-evidence');
  });

  it('rejects evidence outside the claim scope', () => {
    const decision = certifyCompletion(
      'task-3',
      [{ ...claim, allowedScopes: ['repo:read'] }],
      trace,
      replay,
    );

    expect(decision.status).toBe('RECOVER');
    expect(decision.failures[0]?.reason).toBe('out-of-scope-evidence');
  });

  it('rejects a replay that cannot reconstruct the claimed value', () => {
    const decision = certifyCompletion('task-4', [claim], trace, () => ({ passed: 178 }));

    expect(decision.status).toBe('RECOVER');
    expect(decision.failures[0]?.reason).toBe('replay-mismatch');
  });

  it('rejects duplicate evidence ids in the recorded trace', () => {
    const decision = certifyCompletion('task-5', [claim], [...trace, { ...trace[1] }], replay);

    expect(decision.status).toBe('RECOVER');
    expect(decision.failures.some((failure) => failure.reason === 'duplicate-evidence-id')).toBe(true);
  });

  it('detects trace mutation when verifying a prior certificate', () => {
    const issued = certifyCompletion('task-6', [claim], trace, replay);
    expect(issued.status).toBe('COMPLETE');
    expect(issued.certificate).toBeDefined();

    const mutated = trace.map((evidence) => ({ ...evidence }));
    mutated[0]!.outputHash = 'e'.repeat(64);
    const verified = verifyCompletionCertificate(issued.certificate!, mutated, replay);

    expect(verified.status).toBe('RECOVER');
    expect(verified.failures[0]?.detail).toMatch(/trace hash/);
  });

  it('rejects claims with no evidence and malformed value hashes', () => {
    const empty = certifyCompletion('task-7', [{ ...claim, evidenceIds: [] }], trace, replay);
    const malformed = certifyCompletion('task-8', [{ ...claim, valueHash: 'abc' }], trace, replay);

    expect(empty.failures[0]?.reason).toBe('empty-evidence');
    expect(malformed.failures[0]?.reason).toBe('malformed-value-hash');
  });

  it('turns replay exceptions into RECOVER without emitting a certificate', () => {
    const decision = certifyCompletion('task-9', [claim], trace, () => {
      throw new Error('replay unavailable');
    });

    expect(decision.status).toBe('RECOVER');
    expect(decision.certificate).toBeUndefined();
    expect(decision.failures[0]?.reason).toBe('replay-failed');
    expect(decision.failures[0]?.detail).toContain('replay unavailable');
  });

  it('never emits a partial certificate when one of multiple claims is unsupported', () => {
    const buildClaim: CompletionClaim = {
      id: 'build.completed',
      valueHash: hashJson({ completed: true }),
      evidenceIds: ['build'],
      allowedScopes: ['repo:read'],
    };
    const decision = certifyCompletion(
      'task-10',
      [buildClaim, { ...claim, evidenceIds: ['missing'] }],
      trace,
      (current, evidence) =>
        current.id === 'build.completed'
          ? { completed: evidence[0]?.id === 'build' }
          : replay(current, evidence),
    );

    expect(decision.status).toBe('RECOVER');
    expect(decision.certificate).toBeUndefined();
    expect(decision.failures.some((failure) => failure.claimId === 'tests.passed')).toBe(true);
  });
});
