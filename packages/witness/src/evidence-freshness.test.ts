import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  evaluateEvidenceFreshness,
  evidenceFreshnessPolicyDigest,
  MAX_EVIDENCE_DEPENDENCIES,
  type EvidenceFreshnessObservation,
  type EvidenceFreshnessPolicy,
} from './evidence-freshness.js';

function digest(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

const POLICY: EvidenceFreshnessPolicy = {
  policyId: 'dream-machine-pr-11',
  baseCommit: '8ce3857',
  evaluatedAt: '2026-08-15T09:16:50.000Z',
  dependencies: [
    { path: 'dream.config.json', digest: digest('autoMerge:true') },
    { path: 'packages/compile/src/index.ts', digest: digest('compile-v1') },
  ],
  requireDeclaredDependencies: true,
};

function observation(overrides: Partial<EvidenceFreshnessObservation> = {}): EvidenceFreshnessObservation {
  return {
    headCommit: 'a2ea670',
    observedAt: '2026-09-07T16:45:00.000Z',
    dependencies: [
      { path: 'dream.config.json', digest: digest('autoMerge:true') },
      { path: 'packages/compile/src/index.ts', digest: digest('compile-v1') },
    ],
    ...overrides,
  };
}

describe('evidence freshness', () => {
  it('is FRESH when every declared dependency still has its evaluated content', () => {
    const receipt = evaluateEvidenceFreshness(POLICY, evidenceFreshnessPolicyDigest(POLICY), observation());
    expect(receipt.status).toBe('FRESH');
    expect(receipt.authority).toBe('none');
    expect(receipt.driftedPaths).toEqual([]);
    expect(receipt.policyDigest).toMatch(/^[0-9a-f]{64}$/);
    expect(receipt.observationDigest).toMatch(/^[0-9a-f]{64}$/);
  });

  // The regression this whole module exists for.
  it('reproduces PR #11: a clean merge whose READ SET drifted is STALE', () => {
    // dream.config.json was never in #11's diff -- git merged it without a
    // conflict -- but the evaluation read it, and it changed underneath.
    const drifted = observation({
      dependencies: [
        { path: 'dream.config.json', digest: digest('autoMerge:false') },
        { path: 'packages/compile/src/index.ts', digest: digest('compile-v1') },
      ],
    });
    const receipt = evaluateEvidenceFreshness(POLICY, evidenceFreshnessPolicyDigest(POLICY), drifted);
    expect(receipt.status).toBe('STALE');
    expect(receipt.driftedPaths).toEqual(['dream.config.json']);
    expect(receipt.authority).toBe('none');
  });

  it('does NOT call a candidate stale merely because main moved', () => {
    // The over-conservative gate this module deliberately is not: HEAD always
    // differs from the evaluated base in a live repo.
    const receipt = evaluateEvidenceFreshness(
      POLICY,
      evidenceFreshnessPolicyDigest(POLICY),
      observation({ headCommit: 'ffffffe' }),
    );
    expect(receipt.baseCommitMoved).toBe(true);
    expect(receipt.status).toBe('FRESH');
  });

  it('does NOT call an old candidate stale when its dependencies never moved', () => {
    const receipt = evaluateEvidenceFreshness(
      POLICY,
      evidenceFreshnessPolicyDigest(POLICY),
      observation({ observedAt: '2027-08-15T09:16:50.000Z' }),
    );
    expect(receipt.ageDays).toBeGreaterThan(300);
    expect(receipt.ageExceeded).toBe(false);
    expect(receipt.status).toBe('FRESH');
  });

  it('honours an explicit age bound as a secondary gate', () => {
    const bounded: EvidenceFreshnessPolicy = { ...POLICY, maxAgeDays: 7 };
    const receipt = evaluateEvidenceFreshness(
      bounded,
      evidenceFreshnessPolicyDigest(bounded),
      observation(),
    );
    expect(receipt.ageDays).toBe(23);
    expect(receipt.ageExceeded).toBe(true);
    expect(receipt.status).toBe('STALE');
  });

  it('is INDETERMINATE, never FRESH, when a declared dependency was not observed', () => {
    const receipt = evaluateEvidenceFreshness(
      POLICY,
      evidenceFreshnessPolicyDigest(POLICY),
      observation({ dependencies: [{ path: 'dream.config.json', digest: digest('autoMerge:true') }] }),
    );
    expect(receipt.status).toBe('INDETERMINATE');
    expect(receipt.missingPaths).toEqual(['packages/compile/src/index.ts']);
  });

  it('is INDETERMINATE when the observation carries paths the policy never declared', () => {
    const receipt = evaluateEvidenceFreshness(
      POLICY,
      evidenceFreshnessPolicyDigest(POLICY),
      observation({
        dependencies: [
          ...observation().dependencies,
          { path: 'packages/ledger/src/index.ts', digest: digest('ledger') },
        ],
      }),
    );
    expect(receipt.status).toBe('INDETERMINATE');
    expect(receipt.unexpectedPaths).toEqual(['packages/ledger/src/index.ts']);
  });

  it('reports drift ahead of age when both are present', () => {
    const bounded: EvidenceFreshnessPolicy = { ...POLICY, maxAgeDays: 1 };
    const receipt = evaluateEvidenceFreshness(
      bounded,
      evidenceFreshnessPolicyDigest(bounded),
      observation({
        dependencies: [
          { path: 'dream.config.json', digest: digest('autoMerge:false') },
          { path: 'packages/compile/src/index.ts', digest: digest('compile-v1') },
        ],
      }),
    );
    expect(receipt.status).toBe('STALE');
    expect(receipt.driftedPaths).toEqual(['dream.config.json']);
    expect(receipt.ageExceeded).toBe(true);
  });

  it('canonicalizes dependency ordering so the digest is order-independent', () => {
    const reordered: EvidenceFreshnessPolicy = {
      ...POLICY,
      dependencies: [...POLICY.dependencies].reverse(),
    };
    expect(evidenceFreshnessPolicyDigest(reordered)).toBe(evidenceFreshnessPolicyDigest(POLICY));

    const expected = evidenceFreshnessPolicyDigest(POLICY);
    const forward = evaluateEvidenceFreshness(POLICY, expected, observation());
    const backward = evaluateEvidenceFreshness(
      POLICY,
      expected,
      observation({ dependencies: [...observation().dependencies].reverse() }),
    );
    expect(backward.observationDigest).toBe(forward.observationDigest);
  });

  describe('adversarial', () => {
    it('invalidates a policy rewritten after the digest was anchored', () => {
      // The attack this gate must survive: a stale candidate silently drops the
      // dependency that drifted so nothing is left to detect.
      const expected = evidenceFreshnessPolicyDigest(POLICY);
      const rewritten: EvidenceFreshnessPolicy = {
        ...POLICY,
        dependencies: [{ path: 'packages/compile/src/index.ts', digest: digest('compile-v1') }],
      };
      const receipt = evaluateEvidenceFreshness(rewritten, expected, observation());
      expect(receipt.status).toBe('INVALID');
      expect(receipt.reason).toMatch(/policy digest mismatch/);
    });

    it('rejects an empty read set when dependencies are required', () => {
      const empty: EvidenceFreshnessPolicy = { ...POLICY, dependencies: [] };
      const receipt = evaluateEvidenceFreshness(empty, evidenceFreshnessPolicyDigest(empty), observation());
      expect(receipt.status).toBe('INVALID');
      expect(receipt.reason).toMatch(/declares no dependencies/);
    });

    it('rejects absolute paths and traversal in the read set', () => {
      for (const path of ['/etc/shadow', '../../secrets.env', 'a/../../b', 'C:\\Windows\\x']) {
        expect(() =>
          evidenceFreshnessPolicyDigest({ ...POLICY, dependencies: [{ path, digest: digest('x') }] }),
        ).toThrow();
      }
    });

    it('rejects duplicate declared paths', () => {
      expect(() =>
        evidenceFreshnessPolicyDigest({
          ...POLICY,
          dependencies: [
            { path: 'dream.config.json', digest: digest('a') },
            { path: 'dream.config.json', digest: digest('b') },
          ],
        }),
      ).toThrow(/duplicate path/);
    });

    it('rejects backdated observations', () => {
      const receipt = evaluateEvidenceFreshness(
        POLICY,
        evidenceFreshnessPolicyDigest(POLICY),
        observation({ observedAt: '2026-08-01T00:00:00.000Z' }),
      );
      expect(receipt.status).toBe('INVALID');
      expect(receipt.reason).toMatch(/precedes evaluatedAt/);
    });

    it('rejects malformed digests, commits, timestamps and identifiers', () => {
      expect(() =>
        evidenceFreshnessPolicyDigest({ ...POLICY, policyId: '' }),
      ).toThrow(/policyId/);
      expect(() =>
        evidenceFreshnessPolicyDigest({ ...POLICY, baseCommit: 'ZZZZ' }),
      ).toThrow(/baseCommit/);
      expect(() =>
        evidenceFreshnessPolicyDigest({ ...POLICY, evaluatedAt: '2026-08-15' }),
      ).toThrow(/evaluatedAt/);
      expect(() =>
        evidenceFreshnessPolicyDigest({
          ...POLICY,
          dependencies: [{ path: 'a.json', digest: 'NOTAHEXDIGEST' }],
        }),
      ).toThrow(/64 lowercase hex/);
    });

    it('rejects untrusted runtime values that bypass the TypeScript types', () => {
      const bad = [
        { ...POLICY, requireDeclaredDependencies: 'yes' as unknown as boolean },
        { ...POLICY, dependencies: 'not-an-array' as unknown as EvidenceFreshnessPolicy['dependencies'] },
        { ...POLICY, dependencies: [null] as unknown as EvidenceFreshnessPolicy['dependencies'] },
        { ...POLICY, maxAgeDays: 0 },
        { ...POLICY, maxAgeDays: -1 },
        { ...POLICY, maxAgeDays: 1.5 },
        { ...POLICY, maxAgeDays: Number.NaN },
      ];
      for (const policy of bad) {
        expect(() => evidenceFreshnessPolicyDigest(policy as EvidenceFreshnessPolicy)).toThrow();
      }
    });

    it('bounds the read set so a malformed policy cannot pin CPU', () => {
      const huge = Array.from({ length: MAX_EVIDENCE_DEPENDENCIES + 1 }, (_, i) => ({
        path: `packages/p${i}.ts`,
        digest: digest(`d${i}`),
      }));
      expect(() => evidenceFreshnessPolicyDigest({ ...POLICY, dependencies: huge })).toThrow(
        /exceeds 4096 entries/,
      );
    });

    it('never throws out of evaluate, returning an INVALID receipt instead', () => {
      const receipt = evaluateEvidenceFreshness(
        POLICY,
        evidenceFreshnessPolicyDigest(POLICY),
        null as unknown as EvidenceFreshnessObservation,
      );
      expect(receipt.status).toBe('INVALID');
      expect(receipt.authority).toBe('none');
    });

    it('holds no raw file content -- digests and paths only', () => {
      const secret = 'SUPER_SECRET_TOKEN_VALUE';
      const policy: EvidenceFreshnessPolicy = {
        ...POLICY,
        dependencies: [{ path: '.env.example', digest: digest(secret) }],
      };
      const receipt = evaluateEvidenceFreshness(policy, evidenceFreshnessPolicyDigest(policy), {
        headCommit: 'a2ea670',
        observedAt: '2026-09-07T16:45:00.000Z',
        dependencies: [{ path: '.env.example', digest: digest('rotated') }],
      });
      expect(JSON.stringify(receipt)).not.toContain(secret);
      expect(receipt.status).toBe('STALE');
    });
  });
});
