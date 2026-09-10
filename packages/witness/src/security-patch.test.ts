import { describe, expect, it } from 'vitest';
import {
  evaluateSecurityPatch,
  securityPatchContractDigest,
  type SecurityPatchContract,
  type SecurityPatchEvidence,
} from './security-patch.js';

const contract: SecurityPatchContract = {
  vulnerabilityClass: 'CWE-787',
  rootCauseOracleId: 'oracle:bounds-check',
  transformedCaseIds: ['xform:layout', 'xform:transplant'],
  negativeControlIds: ['negative:valid-input'],
};

function validEvidence(): SecurityPatchEvidence {
  return {
    originalPocBlocked: true,
    transformedCases: [
      { id: 'xform:layout', passed: true },
      { id: 'xform:transplant', passed: true },
    ],
    negativeControls: [{ id: 'negative:valid-input', passed: true }],
    rootCauseSatisfied: true,
    regressionSuitePassed: true,
    patchSimilarity: 0.21,
  };
}

describe('security patch evaluation', () => {
  it('accepts only complete root-cause evidence', () => {
    const verdict = evaluateSecurityPatch(contract, validEvidence());
    expect(verdict.accepted).toBe(true);
    expect(verdict.reasons).toEqual([]);
    expect(verdict.authority).toBe('none');
    expect(verdict.patchSimilarity).toBe(0.21);
  });

  it('rejects a crash-only patch that misses the root cause and transformed attacks', () => {
    const evidence = validEvidence();
    evidence.rootCauseSatisfied = false;
    evidence.transformedCases = [
      { id: 'xform:layout', passed: false },
      { id: 'xform:transplant', passed: false },
    ];
    const verdict = evaluateSecurityPatch(contract, evidence);
    expect(verdict.accepted).toBe(false);
    expect(verdict.reasons).toContain('root-cause oracle did not pass');
    expect(verdict.reasons).toContain('transformedCases: failed xform:layout');
  });

  it('fails closed when a frozen transformed case is missing', () => {
    const evidence = validEvidence();
    evidence.transformedCases = [{ id: 'xform:layout', passed: true }];
    const verdict = evaluateSecurityPatch(contract, evidence);
    expect(verdict.accepted).toBe(false);
    expect(verdict.reasons).toContain('transformedCases: missing xform:transplant');
  });

  it('fails closed on unexpected evaluator cases', () => {
    const evidence = validEvidence();
    evidence.transformedCases = [
      ...evidence.transformedCases,
      { id: 'xform:post-outcome-added', passed: true },
    ];
    const verdict = evaluateSecurityPatch(contract, evidence);
    expect(verdict.accepted).toBe(false);
    expect(verdict.reasons).toContain('transformedCases: unexpected xform:post-outcome-added');
  });

  it('rejects legitimate-behavior regression', () => {
    const evidence = validEvidence();
    evidence.negativeControls = [{ id: 'negative:valid-input', passed: false }];
    const verdict = evaluateSecurityPatch(contract, evidence);
    expect(verdict.accepted).toBe(false);
    expect(verdict.reasons).toContain('negativeControls: failed negative:valid-input');
  });

  it('rejects a failed regression suite even when security cases pass', () => {
    const evidence = validEvidence();
    evidence.regressionSuitePassed = false;
    expect(evaluateSecurityPatch(contract, evidence).accepted).toBe(false);
  });

  it('rejects duplicate evidence identities', () => {
    const evidence = validEvidence();
    evidence.transformedCases = [
      { id: 'xform:layout', passed: true },
      { id: 'xform:layout', passed: true },
    ];
    expect(() => evaluateSecurityPatch(contract, evidence)).toThrow(/duplicate result/);
  });

  it('rejects invalid similarity telemetry', () => {
    const evidence = validEvidence();
    evidence.patchSimilarity = 1.1;
    expect(() => evaluateSecurityPatch(contract, evidence)).toThrow(/patchSimilarity/);
  });

  it('canonicalizes case order when hashing the frozen contract', () => {
    const reordered: SecurityPatchContract = {
      ...contract,
      transformedCaseIds: [...contract.transformedCaseIds].reverse(),
    };
    expect(securityPatchContractDigest(reordered)).toBe(securityPatchContractDigest(contract));
  });
});
