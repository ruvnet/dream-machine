/**
 * Cost bound for the freshness gate.
 *
 * This runs on every promotion decision, so it has to be cheap enough that
 * nobody is tempted to skip it -- a gate that costs real time is a gate that
 * gets disabled. The work is O(n log n) in the read set (one sort per side) and
 * O(n) to compare, with no I/O, so the bound below is generous on purpose:
 * it is a regression tripwire against accidental quadratic behaviour, not a
 * hardware claim.
 */
import { createHash } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { describe, expect, it } from 'vitest';
import {
  evaluateEvidenceFreshness,
  evidenceFreshnessPolicyDigest,
  MAX_EVIDENCE_DEPENDENCIES,
  type EvidenceFreshnessPolicy,
} from './evidence-freshness.js';

function digest(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function buildPolicy(size: number): EvidenceFreshnessPolicy {
  return {
    policyId: 'bench-read-set',
    baseCommit: 'abc1234',
    evaluatedAt: '2026-09-01T00:00:00.000Z',
    // Reverse-ordered on purpose so the canonical sort actually does work.
    dependencies: Array.from({ length: size }, (_, i) => ({
      path: `packages/mod-${String(size - i).padStart(5, '0')}/src/index.ts`,
      digest: digest(`content-${i}`),
    })),
    requireDeclaredDependencies: true,
  };
}

function median(values: number[]): number {
  const ordered = [...values].sort((a, b) => a - b);
  return ordered[Math.floor(ordered.length / 2)]!;
}

describe('evidence freshness cost', () => {
  it('verifies a full-size read set well inside a single frame', () => {
    const policy = buildPolicy(MAX_EVIDENCE_DEPENDENCIES);
    const expected = evidenceFreshnessPolicyDigest(policy);
    const observed = {
      headCommit: 'def5678',
      observedAt: '2026-09-07T00:00:00.000Z',
      dependencies: policy.dependencies.map((d, i) =>
        i % 100 === 0 ? { ...d, digest: digest(`drifted-${i}`) } : d,
      ),
    };

    for (let i = 0; i < 5; i++) evaluateEvidenceFreshness(policy, expected, observed);

    const samples: number[] = [];
    for (let i = 0; i < 20; i++) {
      const start = performance.now();
      const receipt = evaluateEvidenceFreshness(policy, expected, observed);
      samples.push(performance.now() - start);
      expect(receipt.status).toBe('STALE');
    }

    const p50 = median(samples);
    // Generous: catches an accidental O(n^2), not a hardware-specific claim.
    expect(p50).toBeLessThan(250);
  });

  it('scales sub-quadratically from 512 to 4096 dependencies', () => {
    const measure = (size: number): number => {
      const policy = buildPolicy(size);
      const expected = evidenceFreshnessPolicyDigest(policy);
      const observed = {
        headCommit: 'def5678',
        observedAt: '2026-09-07T00:00:00.000Z',
        dependencies: policy.dependencies,
      };
      for (let i = 0; i < 3; i++) evaluateEvidenceFreshness(policy, expected, observed);
      const samples: number[] = [];
      for (let i = 0; i < 15; i++) {
        const start = performance.now();
        evaluateEvidenceFreshness(policy, expected, observed);
        samples.push(performance.now() - start);
      }
      return median(samples);
    };

    const small = Math.max(measure(512), 0.01);
    const large = measure(4_096);
    // 8x the input; quadratic would be ~64x. Allow 24x for noise and hashing.
    expect(large / small).toBeLessThan(24);
  });
});
