import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  hashExperimentManifest,
  verifyClaimEvidence,
  type ClaimSpec,
  type EvidenceRecord,
  type ExperimentManifest,
} from './claim-receipt.js';

function digest(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

const MANIFEST: ExperimentManifest = {
  experimentId: 'claim-receipt-repro',
  protocolVersion: 'cr-ruv-1',
  committedAt: '2026-09-03T12:00:00.000Z',
  assignments: [{ id: 'a-1' }, { id: 'a-2' }],
};

const CLAIM: ClaimSpec = {
  claimId: 'quality-improved',
  requiredFieldGroups: ['outcome', 'cost'],
  requireOpenedFieldGroups: ['outcome'],
};

function completeEvidence(): EvidenceRecord[] {
  return [
    { assignmentId: 'a-1', fieldGroup: 'outcome', digest: digest('a1-outcome'), opened: true, terminal: true },
    { assignmentId: 'a-1', fieldGroup: 'cost', digest: digest('a1-cost'), opened: false, terminal: false },
    { assignmentId: 'a-2', fieldGroup: 'outcome', digest: digest('a2-outcome'), opened: true, terminal: true },
    { assignmentId: 'a-2', fieldGroup: 'cost', digest: digest('a2-cost'), opened: false, terminal: false },
  ];
}

describe('claim-relative evidence receipts', () => {
  it('passes complete claim-sufficient evidence and never carries authority', () => {
    const expected = hashExperimentManifest(MANIFEST);
    const receipt = verifyClaimEvidence(MANIFEST, expected, CLAIM, completeEvidence());
    expect(receipt.status).toBe('PASS');
    expect(receipt.authority).toBe('none');
    expect(receipt.evidenceDigest).toMatch(/^[0-9a-f]{64}$/);
  });

  it('normalizes assignment ordering in the committed manifest digest', () => {
    const reordered: ExperimentManifest = {
      ...MANIFEST,
      assignments: [...MANIFEST.assignments].reverse(),
    };
    expect(hashExperimentManifest(reordered)).toBe(hashExperimentManifest(MANIFEST));
  });

  it('returns INCONCLUSIVE_COVERAGE when one committed assignment lacks terminal evidence', () => {
    const records = completeEvidence();
    records[2] = { ...records[2]!, terminal: false };
    const receipt = verifyClaimEvidence(MANIFEST, hashExperimentManifest(MANIFEST), CLAIM, records);
    expect(receipt.status).toBe('INCONCLUSIVE_COVERAGE');
    expect(receipt.missingTerminalAssignments).toEqual(['a-2']);
  });

  it('returns INCONCLUSIVE_SUFFICIENCY when a claim-required field is omitted', () => {
    const records = completeEvidence().filter(
      (record) => !(record.assignmentId === 'a-2' && record.fieldGroup === 'cost'),
    );
    const receipt = verifyClaimEvidence(MANIFEST, hashExperimentManifest(MANIFEST), CLAIM, records);
    expect(receipt.status).toBe('INCONCLUSIVE_SUFFICIENCY');
    expect(receipt.missingFields).toEqual(['a-2/cost']);
  });

  it('returns INCONCLUSIVE_SUFFICIENCY when a required private opening is withheld', () => {
    const records = completeEvidence();
    records[0] = { ...records[0]!, opened: false };
    const receipt = verifyClaimEvidence(MANIFEST, hashExperimentManifest(MANIFEST), CLAIM, records);
    expect(receipt.status).toBe('INCONCLUSIVE_SUFFICIENCY');
    expect(receipt.missingOpenings).toEqual(['a-1/outcome']);
  });

  it('invalidates evidence for an assignment outside the committed universe', () => {
    const records = completeEvidence();
    records.push({
      assignmentId: 'a-3',
      fieldGroup: 'outcome',
      digest: digest('undeclared'),
      opened: true,
      terminal: true,
    });
    const receipt = verifyClaimEvidence(MANIFEST, hashExperimentManifest(MANIFEST), CLAIM, records);
    expect(receipt.status).toBe('INVALID');
    expect(receipt.reason).toMatch(/undeclared assignment/);
  });

  it('invalidates duplicate evidence identities rather than selecting one', () => {
    const records = completeEvidence();
    records.push({ ...records[0]! });
    const receipt = verifyClaimEvidence(MANIFEST, hashExperimentManifest(MANIFEST), CLAIM, records);
    expect(receipt.status).toBe('INVALID');
    expect(receipt.reason).toMatch(/duplicate evidence identity/);
  });

  it('invalidates a rewritten manifest when the independently anchored digest is unchanged', () => {
    const expected = hashExperimentManifest(MANIFEST);
    const rewritten: ExperimentManifest = {
      ...MANIFEST,
      assignments: [{ id: 'a-1' }],
    };
    const receipt = verifyClaimEvidence(rewritten, expected, CLAIM, completeEvidence().slice(0, 2));
    expect(receipt.status).toBe('INVALID');
    expect(receipt.reason).toMatch(/manifest digest mismatch/);
  });

  it('invalidates malformed evidence digests', () => {
    const records = completeEvidence();
    records[0] = { ...records[0]!, digest: 'deadbeef' };
    const receipt = verifyClaimEvidence(MANIFEST, hashExperimentManifest(MANIFEST), CLAIM, records);
    expect(receipt.status).toBe('INVALID');
    expect(receipt.reason).toMatch(/64 lowercase hex/);
  });

  it('invalidates a claim that asks to open a field it did not require', () => {
    const invalidClaim: ClaimSpec = {
      claimId: 'bad-claim',
      requiredFieldGroups: ['outcome'],
      requireOpenedFieldGroups: ['cost'],
    };
    const receipt = verifyClaimEvidence(
      MANIFEST,
      hashExperimentManifest(MANIFEST),
      invalidClaim,
      completeEvidence(),
    );
    expect(receipt.status).toBe('INVALID');
    expect(receipt.reason).toMatch(/must also be required/);
  });

  it('invalidates noncanonical manifest timestamps', () => {
    const noncanonical: ExperimentManifest = {
      ...MANIFEST,
      committedAt: '2026-09-03T12:00:00Z',
    };
    const receipt = verifyClaimEvidence(noncanonical, '0'.repeat(64), CLAIM, completeEvidence());
    expect(receipt.status).toBe('INVALID');
    expect(receipt.reason).toMatch(/canonical ISO-8601/);
  });
});
