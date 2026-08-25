import { describe, expect, it } from 'vitest';
import {
  clusterFailureTraces,
  evaluateHarnessCandidate,
  selectHarnessUpdate,
  type CandidateValidation,
  type FailureTrace,
} from './harness-optimizer.js';

function candidate(overrides: Partial<CandidateValidation> = {}): CandidateValidation {
  return {
    patch: {
      id: 'patch-a',
      sourceTraceIds: ['t1', 't2'],
      surfaces: ['control'],
      changedLines: 40,
      rationale: 'add bounded recovery after a verified tool failure',
    },
    slices: [
      { name: 'validation', split: 'validation', baseline: 0.60, candidate: 0.68, sampleSize: 100 },
      { name: 'holdout', split: 'holdout', baseline: 0.58, candidate: 0.64, sampleSize: 100 },
    ],
    ...overrides,
  };
}

describe('clusterFailureTraces', () => {
  it('groups failure traces by benchmark and category with deterministic ordering', () => {
    const traces: FailureTrace[] = [
      { id: 'b', benchmark: 'swe', category: 'tool', summary: 'tool timeout', split: 'train', weight: 2 },
      { id: 'a', benchmark: 'swe', category: 'tool', summary: 'tool timeout', split: 'train' },
      { id: 'c', benchmark: 'gaia', category: 'memory', summary: 'stale memory', split: 'validation' },
    ];
    const clusters = clusterFailureTraces(traces);
    expect(clusters[0]).toMatchObject({ key: 'swe::tool', totalWeight: 3, traceIds: ['a', 'b'] });
    expect(clusters[1]).toMatchObject({ key: 'gaia::memory', totalWeight: 1, traceIds: ['c'] });
  });
});

describe('evaluateHarnessCandidate', () => {
  it('accepts a targeted patch with positive validation and holdout evidence', () => {
    const decision = evaluateHarnessCandidate(candidate());
    expect(decision.verdict).toBe('ACCEPT');
    expect(decision.weightedImprovement).toBeCloseTo(0.07);
  });

  it('marks a patch inconclusive without holdout evidence', () => {
    const decision = evaluateHarnessCandidate(candidate({
      slices: [{ name: 'validation', split: 'validation', baseline: 0.60, candidate: 0.70, sampleSize: 100 }],
    }));
    expect(decision.verdict).toBe('INCONCLUSIVE');
    expect(decision.reasons).toContain('no holdout evidence');
  });

  it('rejects evaluator modification and authority expansion even when metrics improve', () => {
    const base = candidate();
    const decision = evaluateHarnessCandidate(candidate({
      patch: { ...base.patch, modifiesEvaluator: true, expandsAuthority: true },
    }));
    expect(decision.verdict).toBe('REJECT');
    expect(decision.reasons.join(' ')).toMatch(/evaluator/);
    expect(decision.reasons.join(' ')).toMatch(/authority/);
  });

  it('rejects broad edits and protected invariant failures', () => {
    const base = candidate();
    const decision = evaluateHarnessCandidate(candidate({
      patch: { ...base.patch, surfaces: ['prompt', 'control'], changedLines: 350 },
      invariantFailures: ['sandbox escape regression'],
    }));
    expect(decision.verdict).toBe('REJECT');
    expect(decision.reasons.join(' ')).toMatch(/changed lines/);
    expect(decision.reasons.join(' ')).toMatch(/invariant/);
  });

  it('rejects a candidate with a material regression on one validation slice', () => {
    const decision = evaluateHarnessCandidate(candidate({
      slices: [
        { name: 'validation', split: 'validation', baseline: 0.60, candidate: 0.72, sampleSize: 100 },
        { name: 'holdout', split: 'holdout', baseline: 0.60, candidate: 0.56, sampleSize: 100 },
      ],
    }));
    expect(decision.verdict).toBe('REJECT');
    expect(decision.reasons.join(' ')).toMatch(/slice regression/);
  });
});

describe('selectHarnessUpdate', () => {
  it('selects the strongest accepted generalizing patch', () => {
    const base = candidate();
    const better = candidate({
      patch: { ...base.patch, id: 'patch-b', changedLines: 25 },
      slices: [
        { name: 'validation', split: 'validation', baseline: 0.60, candidate: 0.70, sampleSize: 100 },
        { name: 'holdout', split: 'holdout', baseline: 0.58, candidate: 0.67, sampleSize: 100 },
      ],
    });
    const selection = selectHarnessUpdate([base, better]);
    expect(selection.selected?.patchId).toBe('patch-b');
    expect(selection.decisions).toHaveLength(2);
  });
});
