export type FailureCategory =
  | 'planning'
  | 'tool'
  | 'memory'
  | 'verification'
  | 'recovery'
  | 'resource'
  | 'security'
  | 'unknown';

export type HarnessSurface = 'prompt' | 'tool' | 'control' | 'memory' | 'skill' | 'subagent';

export interface FailureTrace {
  id: string;
  benchmark: string;
  category: FailureCategory;
  summary: string;
  split: 'train' | 'validation' | 'holdout';
  weight?: number;
}

export interface FailureCluster {
  key: string;
  benchmark: string;
  category: FailureCategory;
  traceIds: string[];
  totalWeight: number;
}

export interface HarnessPatch {
  id: string;
  sourceTraceIds: string[];
  surfaces: HarnessSurface[];
  changedLines: number;
  modifiesEvaluator?: boolean;
  expandsAuthority?: boolean;
  rationale: string;
}

export interface ValidationSlice {
  name: string;
  split: 'validation' | 'holdout';
  baseline: number;
  candidate: number;
  sampleSize: number;
  direction?: 'higher' | 'lower';
}

export interface CandidateValidation {
  patch: HarnessPatch;
  slices: ValidationSlice[];
  invariantFailures?: string[];
  securityFindings?: string[];
}

export interface HarnessOptimizationPolicy {
  maxChangedLines: number;
  maxSurfaces: number;
  requireHoldout: boolean;
  minWeightedImprovement: number;
  maxSliceRegression: number;
  complexityPenalty: number;
}

export interface CandidateDecision {
  patchId: string;
  verdict: 'ACCEPT' | 'REJECT' | 'INCONCLUSIVE';
  score: number;
  weightedImprovement: number;
  reasons: string[];
}

export interface HarnessSelection {
  selected?: CandidateDecision;
  decisions: CandidateDecision[];
}

export const DEFAULT_OPTIMIZATION_POLICY: HarnessOptimizationPolicy = {
  maxChangedLines: 300,
  maxSurfaces: 1,
  requireHoldout: true,
  minWeightedImprovement: 0,
  maxSliceRegression: 0.02,
  complexityPenalty: 0.002,
};

export function clusterFailureTraces(traces: FailureTrace[]): FailureCluster[] {
  const clusters = new Map<string, FailureCluster>();

  for (const trace of traces) {
    if (!trace.id.trim()) throw new Error('failure trace id must be non-empty');
    if (!trace.benchmark.trim()) throw new Error(`failure trace ${trace.id}: benchmark must be non-empty`);
    const key = `${trace.benchmark}::${trace.category}`;
    const current = clusters.get(key) ?? {
      key,
      benchmark: trace.benchmark,
      category: trace.category,
      traceIds: [],
      totalWeight: 0,
    };
    current.traceIds.push(trace.id);
    current.totalWeight += trace.weight ?? 1;
    clusters.set(key, current);
  }

  return [...clusters.values()]
    .map((cluster) => ({ ...cluster, traceIds: [...cluster.traceIds].sort() }))
    .sort((a, b) => b.totalWeight - a.totalWeight || a.key.localeCompare(b.key));
}

function normalizedDelta(slice: ValidationSlice): number {
  if (!Number.isFinite(slice.baseline) || !Number.isFinite(slice.candidate)) {
    throw new Error(`validation slice ${slice.name}: metrics must be finite`);
  }
  if (!Number.isInteger(slice.sampleSize) || slice.sampleSize <= 0) {
    throw new Error(`validation slice ${slice.name}: sampleSize must be a positive integer`);
  }
  const delta = slice.candidate - slice.baseline;
  return slice.direction === 'lower' ? -delta : delta;
}

export function evaluateHarnessCandidate(
  candidate: CandidateValidation,
  policy: HarnessOptimizationPolicy = DEFAULT_OPTIMIZATION_POLICY,
): CandidateDecision {
  const reasons: string[] = [];
  const { patch } = candidate;

  if (patch.changedLines < 0 || !Number.isInteger(patch.changedLines)) {
    throw new Error(`patch ${patch.id}: changedLines must be a non-negative integer`);
  }
  if (patch.surfaces.length === 0) reasons.push('patch has no declared harness surface');
  if (new Set(patch.surfaces).size !== patch.surfaces.length) reasons.push('patch declares duplicate harness surfaces');
  if (patch.changedLines > policy.maxChangedLines) reasons.push(`patch exceeds ${policy.maxChangedLines} changed lines`);
  if (patch.surfaces.length > policy.maxSurfaces) reasons.push(`patch touches more than ${policy.maxSurfaces} harness surface`);
  if (patch.modifiesEvaluator) reasons.push('patch modifies evaluator or gold data');
  if (patch.expandsAuthority) reasons.push('patch expands runtime authority');
  if ((candidate.invariantFailures?.length ?? 0) > 0) reasons.push('protected invariant failed');
  if ((candidate.securityFindings?.length ?? 0) > 0) reasons.push('security review found unresolved issues');

  const slices = candidate.slices;
  if (slices.length === 0) {
    return {
      patchId: patch.id,
      verdict: reasons.length ? 'REJECT' : 'INCONCLUSIVE',
      score: Number.NEGATIVE_INFINITY,
      weightedImprovement: 0,
      reasons: reasons.length ? reasons : ['no validation evidence'],
    };
  }

  const hasHoldout = slices.some((slice) => slice.split === 'holdout');
  if (policy.requireHoldout && !hasHoldout) reasons.push('no holdout evidence');

  let weighted = 0;
  let totalWeight = 0;
  let maxRegression = 0;
  for (const slice of slices) {
    const delta = normalizedDelta(slice);
    weighted += delta * slice.sampleSize;
    totalWeight += slice.sampleSize;
    maxRegression = Math.min(maxRegression, delta);
  }
  const weightedImprovement = totalWeight ? weighted / totalWeight : 0;
  if (maxRegression < -policy.maxSliceRegression) {
    reasons.push(`slice regression ${Math.abs(maxRegression).toFixed(4)} exceeds ${policy.maxSliceRegression.toFixed(4)}`);
  }
  if (weightedImprovement <= policy.minWeightedImprovement) {
    reasons.push('weighted validation improvement is not positive enough');
  }

  const hardReject = reasons.some((reason) =>
    reason.includes('modifies evaluator') ||
    reason.includes('expands runtime authority') ||
    reason.includes('protected invariant') ||
    reason.includes('security review') ||
    reason.includes('exceeds') ||
    reason.includes('touches more than') ||
    reason.includes('duplicate'),
  );
  const inconclusive = reasons.includes('no holdout evidence');
  const complexity = patch.changedLines / Math.max(1, policy.maxChangedLines);
  const score = weightedImprovement - complexity * policy.complexityPenalty;

  return {
    patchId: patch.id,
    verdict: hardReject ? 'REJECT' : inconclusive ? 'INCONCLUSIVE' : reasons.length ? 'REJECT' : 'ACCEPT',
    score,
    weightedImprovement,
    reasons,
  };
}

export function selectHarnessUpdate(
  candidates: CandidateValidation[],
  policy: HarnessOptimizationPolicy = DEFAULT_OPTIMIZATION_POLICY,
): HarnessSelection {
  const decisions = candidates.map((candidate) => evaluateHarnessCandidate(candidate, policy));
  const accepted = decisions
    .filter((decision) => decision.verdict === 'ACCEPT')
    .sort((a, b) => b.score - a.score || b.weightedImprovement - a.weightedImprovement || a.patchId.localeCompare(b.patchId));
  return { selected: accepted[0], decisions };
}
