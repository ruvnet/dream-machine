import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  discoveryEvidencePolicyDigest,
  evaluateDiscoveryEvidence,
  type DiscoveryEvidenceObservation,
  type DiscoveryEvidencePolicy,
} from './discovery-evidence.js';

function digest(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

const POLICY: DiscoveryEvidencePolicy = {
  policyId: 'truth-insight-repro-v1',
  protocolVersion: 'discovery-evidence-v1',
  committedAt: '2026-09-07T12:00:00.000Z',
  hypothesisDigest: digest('frozen scientific objective'),
  requiredCriteria: [
    'controls',
    'falsification',
    'robustness',
    'cross_dataset_generalization',
    'reproducibility',
  ],
  requireIndependentEvidence: true,
  minReplicates: 2,
};

function completeEvidence(): DiscoveryEvidenceObservation[] {
  return POLICY.requiredCriteria.map((criterion) => ({
    criterion,
    evidenceDigest: digest(`evidence:${criterion}`),
    status: 'PASS' as const,
    independent: true,
    replicates: 2,
  }));
}

describe('discovery evidence gate', () => {
  it('passes complete independent evidence without granting authority', () => {
    const receipt = evaluateDiscoveryEvidence(POLICY, discoveryEvidencePolicyDigest(POLICY), completeEvidence());
    expect(receipt.status).toBe('PASS');
    expect(receipt.authority).toBe('none');
    expect(receipt.policyDigest).toMatch(/^[0-9a-f]{64}$/);
    expect(receipt.evidenceDigest).toMatch(/^[0-9a-f]{64}$/);
  });

  it('canonicalizes required criteria and evidence ordering', () => {
    const reorderedPolicy: DiscoveryEvidencePolicy = {
      ...POLICY,
      requiredCriteria: [...POLICY.requiredCriteria].reverse(),
    };
    expect(discoveryEvidencePolicyDigest(reorderedPolicy)).toBe(discoveryEvidencePolicyDigest(POLICY));

    const expected = discoveryEvidencePolicyDigest(POLICY);
    const first = evaluateDiscoveryEvidence(POLICY, expected, completeEvidence());
    const second = evaluateDiscoveryEvidence(POLICY, expected, completeEvidence().reverse());
    expect(second.evidenceDigest).toBe(first.evidenceDigest);
  });

  it('is inconclusive when a required criterion is absent', () => {
    const evidence = completeEvidence().filter((item) => item.criterion !== 'robustness');
    const receipt = evaluateDiscoveryEvidence(POLICY, discoveryEvidencePolicyDigest(POLICY), evidence);
    expect(receipt.status).toBe('INCONCLUSIVE');
    expect(receipt.missingCriteria).toEqual(['robustness']);
  });

  it('rejects a failed scientific criterion', () => {
    const evidence = completeEvidence();
    evidence[0] = { ...evidence[0]!, status: 'FAIL' };
    const receipt = evaluateDiscoveryEvidence(POLICY, discoveryEvidencePolicyDigest(POLICY), evidence);
    expect(receipt.status).toBe('REJECTED');
    expect(receipt.failedCriteria).toEqual([evidence[0]!.criterion]);
  });

  it('rejects non-independent evidence when independence is required', () => {
    const evidence = completeEvidence();
    evidence[1] = { ...evidence[1]!, independent: false };
    const receipt = evaluateDiscoveryEvidence(POLICY, discoveryEvidencePolicyDigest(POLICY), evidence);
    expect(receipt.status).toBe('REJECTED');
    expect(receipt.nonIndependentCriteria).toEqual([evidence[1]!.criterion]);
  });

  it('is inconclusive when replicate evidence is below the frozen minimum', () => {
    const evidence = completeEvidence();
    evidence[2] = { ...evidence[2]!, replicates: 1 };
    const receipt = evaluateDiscoveryEvidence(POLICY, discoveryEvidencePolicyDigest(POLICY), evidence);
    expect(receipt.status).toBe('INCONCLUSIVE');
    expect(receipt.insufficientReplicateCriteria).toEqual([evidence[2]!.criterion]);
  });

  it('invalidates a rewritten policy against the independently anchored digest', () => {
    const expected = discoveryEvidencePolicyDigest(POLICY);
    const rewritten: DiscoveryEvidencePolicy = {
      ...POLICY,
      requiredCriteria: ['controls'],
    };
    const receipt = evaluateDiscoveryEvidence(rewritten, expected, [completeEvidence()[0]!]);
    expect(receipt.status).toBe('INVALID');
    expect(receipt.reason).toMatch(/policy digest mismatch/);
  });

  it('invalidates duplicate observations', () => {
    const evidence = completeEvidence();
    evidence.push({ ...evidence[0]! });
    const receipt = evaluateDiscoveryEvidence(POLICY, discoveryEvidencePolicyDigest(POLICY), evidence);
    expect(receipt.status).toBe('INVALID');
    expect(receipt.reason).toMatch(/duplicate criterion/);
  });

  it('invalidates evidence for a criterion outside the frozen policy', () => {
    const narrow: DiscoveryEvidencePolicy = {
      ...POLICY,
      requiredCriteria: ['controls'],
      minReplicates: 1,
    };
    const evidence: DiscoveryEvidenceObservation[] = [
      {
        criterion: 'controls',
        evidenceDigest: digest('controls'),
        status: 'PASS',
        independent: true,
        replicates: 1,
      },
      {
        criterion: 'robustness',
        evidenceDigest: digest('undeclared'),
        status: 'PASS',
        independent: true,
        replicates: 1,
      },
    ];
    const receipt = evaluateDiscoveryEvidence(narrow, discoveryEvidencePolicyDigest(narrow), evidence);
    expect(receipt.status).toBe('INVALID');
    expect(receipt.reason).toMatch(/undeclared criterion/);
  });

  it('invalidates malformed digests, timestamps, and replicate counts', () => {
    const badPolicy: DiscoveryEvidencePolicy = {
      ...POLICY,
      committedAt: '2026-09-07T12:00:00Z',
    };
    expect(evaluateDiscoveryEvidence(badPolicy, '0'.repeat(64), completeEvidence()).status).toBe('INVALID');

    const evidence = completeEvidence();
    evidence[0] = { ...evidence[0]!, evidenceDigest: 'deadbeef' };
    expect(evaluateDiscoveryEvidence(POLICY, discoveryEvidencePolicyDigest(POLICY), evidence).status).toBe('INVALID');

    const badReplicates = completeEvidence();
    badReplicates[0] = { ...badReplicates[0]!, replicates: 0 };
    expect(evaluateDiscoveryEvidence(POLICY, discoveryEvidencePolicyDigest(POLICY), badReplicates).status).toBe('INVALID');
  });
});
