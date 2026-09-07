import { createHash } from 'node:crypto';

export type DiscoveryCriterion =
  | 'controls'
  | 'falsification'
  | 'robustness'
  | 'cross_dataset_generalization'
  | 'reproducibility';

export type DiscoveryEvidenceStatus = 'PASS' | 'FAIL';
export type DiscoveryVerdictStatus = 'PASS' | 'REJECTED' | 'INCONCLUSIVE' | 'INVALID';

/** Frozen before candidate outcomes are visible. */
export interface DiscoveryEvidencePolicy {
  /** Stable policy identity for this experiment family. */
  policyId: string;
  /** Versioned evaluation protocol, independent of the candidate. */
  protocolVersion: string;
  /** Canonical ISO 8601 timestamp recording when the policy was frozen. */
  committedAt: string;
  /** SHA 256 digest of the preregistered hypothesis or objective. */
  hypothesisDigest: string;
  /** Exact scientific checks required before promotion can be considered. */
  requiredCriteria: readonly DiscoveryCriterion[];
  /** Require criterion evidence to come from an evaluator independent of the candidate. */
  requireIndependentEvidence: boolean;
  /** Minimum independent repetitions required per criterion. Defaults to one. */
  minReplicates?: number;
}

/** Bounded evidence about one frozen scientific criterion. Raw research content is not stored here. */
export interface DiscoveryEvidenceObservation {
  criterion: DiscoveryCriterion;
  /** SHA 256 digest of the evidence artifact or evaluator output. */
  evidenceDigest: string;
  /** Whether the frozen criterion passed its preregistered check. */
  status: DiscoveryEvidenceStatus;
  /** Whether the observation came from an evaluator isolated from candidate mutation. */
  independent: boolean;
  /** Number of independent repetitions represented by this observation. */
  replicates: number;
}

/** Deterministic scientific evidence readiness receipt. This is evidence, never authority. */
export interface DiscoveryEvidenceReceipt {
  status: DiscoveryVerdictStatus;
  authority: 'none';
  policyDigest: string;
  evidenceDigest: string;
  missingCriteria: DiscoveryCriterion[];
  failedCriteria: DiscoveryCriterion[];
  nonIndependentCriteria: DiscoveryCriterion[];
  insufficientReplicateCriteria: DiscoveryCriterion[];
  reason?: string;
}

const HEX64 = /^[0-9a-f]{64}$/;
const ID_RE = /^[A-Za-z0-9][A-Za-z0-9._:/@-]{0,127}$/;
const MAX_CRITERIA = 16;
const MAX_REPLICATES = 1_000_000;
const ALLOWED_CRITERIA = new Set<DiscoveryCriterion>([
  'controls',
  'falsification',
  'robustness',
  'cross_dataset_generalization',
  'reproducibility',
]);

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function requireId(value: string, field: string): string {
  const normalized = value.trim();
  if (!ID_RE.test(normalized)) {
    throw new Error(`${field} must be a nonempty bounded identifier`);
  }
  return normalized;
}

function requireDigest(value: string, field: string): string {
  if (!HEX64.test(value)) throw new Error(`${field} must be 64 lowercase hex characters`);
  return value;
}

function requireCanonicalTimestamp(value: string, field: string): string {
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString() !== value) {
    throw new Error(`${field} must be canonical ISO 8601 with milliseconds and Z`);
  }
  return value;
}

function normalizedCriteria(values: readonly DiscoveryCriterion[]): DiscoveryCriterion[] {
  if (values.length === 0) throw new Error('requiredCriteria must not be empty');
  if (values.length > MAX_CRITERIA) throw new Error(`requiredCriteria exceeds ${MAX_CRITERIA} items`);
  for (const value of values) {
    if (!ALLOWED_CRITERIA.has(value)) throw new Error(`requiredCriteria contains unknown criterion ${String(value)}`);
  }
  const unique = new Set(values);
  if (unique.size !== values.length) throw new Error('requiredCriteria contains duplicates');
  return [...unique].sort();
}

function normalizedMinReplicates(value: number | undefined): number {
  const resolved = value ?? 1;
  if (!Number.isSafeInteger(resolved) || resolved < 1 || resolved > MAX_REPLICATES) {
    throw new Error(`minReplicates must be an integer in [1, ${MAX_REPLICATES}]`);
  }
  return resolved;
}

/** Canonical digest of the discovery policy frozen before candidate outcomes. */
export function discoveryEvidencePolicyDigest(policy: DiscoveryEvidencePolicy): string {
  if (typeof policy.requireIndependentEvidence !== 'boolean') {
    throw new Error('requireIndependentEvidence must be boolean');
  }
  const canonical = JSON.stringify({
    policyId: requireId(policy.policyId, 'policyId'),
    protocolVersion: requireId(policy.protocolVersion, 'protocolVersion'),
    committedAt: requireCanonicalTimestamp(policy.committedAt, 'committedAt'),
    hypothesisDigest: requireDigest(policy.hypothesisDigest, 'hypothesisDigest'),
    requiredCriteria: normalizedCriteria(policy.requiredCriteria),
    requireIndependentEvidence: policy.requireIndependentEvidence,
    minReplicates: normalizedMinReplicates(policy.minReplicates),
  });
  return sha256(canonical);
}

function normalizedEvidence(
  observations: readonly DiscoveryEvidenceObservation[],
  required: readonly DiscoveryCriterion[],
): DiscoveryEvidenceObservation[] {
  if (observations.length > MAX_CRITERIA) throw new Error(`observations exceeds ${MAX_CRITERIA} items`);
  const requiredSet = new Set(required);
  const seen = new Set<DiscoveryCriterion>();
  const normalized: DiscoveryEvidenceObservation[] = [];

  for (const observation of observations) {
    if (!ALLOWED_CRITERIA.has(observation.criterion)) {
      throw new Error(`observation contains unknown criterion ${String(observation.criterion)}`);
    }
    if (!requiredSet.has(observation.criterion)) {
      throw new Error(`observation contains undeclared criterion ${observation.criterion}`);
    }
    if (seen.has(observation.criterion)) {
      throw new Error(`observation contains duplicate criterion ${observation.criterion}`);
    }
    if (observation.status !== 'PASS' && observation.status !== 'FAIL') {
      throw new Error(`status for ${observation.criterion} must be PASS or FAIL`);
    }
    if (typeof observation.independent !== 'boolean') {
      throw new Error(`independent for ${observation.criterion} must be boolean`);
    }
    seen.add(observation.criterion);
    if (!Number.isSafeInteger(observation.replicates) || observation.replicates < 1 || observation.replicates > MAX_REPLICATES) {
      throw new Error(`replicates for ${observation.criterion} must be an integer in [1, ${MAX_REPLICATES}]`);
    }
    normalized.push({
      criterion: observation.criterion,
      evidenceDigest: requireDigest(observation.evidenceDigest, `evidenceDigest for ${observation.criterion}`),
      status: observation.status,
      independent: observation.independent,
      replicates: observation.replicates,
    });
  }

  return normalized.sort((a, b) => a.criterion.localeCompare(b.criterion));
}

function emptyReceipt(reason: string): DiscoveryEvidenceReceipt {
  return {
    status: 'INVALID',
    authority: 'none',
    policyDigest: '',
    evidenceDigest: '',
    missingCriteria: [],
    failedCriteria: [],
    nonIndependentCriteria: [],
    insufficientReplicateCriteria: [],
    reason,
  };
}

/**
 * Evaluate whether a discovery claim has the preregistered evidence needed to
 * enter a promotion decision. A PASS does not establish scientific truth and
 * never grants runtime authority.
 */
export function evaluateDiscoveryEvidence(
  policy: DiscoveryEvidencePolicy,
  expectedPolicyDigest: string,
  observations: readonly DiscoveryEvidenceObservation[],
): DiscoveryEvidenceReceipt {
  try {
    const policyDigest = discoveryEvidencePolicyDigest(policy);
    requireDigest(expectedPolicyDigest, 'expectedPolicyDigest');
    if (policyDigest !== expectedPolicyDigest) return emptyReceipt('policy digest mismatch');

    const required = normalizedCriteria(policy.requiredCriteria);
    const minReplicates = normalizedMinReplicates(policy.minReplicates);
    const evidence = normalizedEvidence(observations, required);
    const byCriterion = new Map(evidence.map((observation) => [observation.criterion, observation]));

    const missingCriteria = required.filter((criterion) => !byCriterion.has(criterion));
    const failedCriteria = evidence
      .filter((observation) => observation.status === 'FAIL')
      .map((observation) => observation.criterion);
    const nonIndependentCriteria = policy.requireIndependentEvidence
      ? evidence.filter((observation) => !observation.independent).map((observation) => observation.criterion)
      : [];
    const insufficientReplicateCriteria = evidence
      .filter((observation) => observation.replicates < minReplicates)
      .map((observation) => observation.criterion);

    const evidenceDigest = sha256(JSON.stringify(evidence));
    let status: DiscoveryVerdictStatus = 'PASS';
    if (failedCriteria.length > 0 || nonIndependentCriteria.length > 0) status = 'REJECTED';
    else if (missingCriteria.length > 0 || insufficientReplicateCriteria.length > 0) status = 'INCONCLUSIVE';

    return {
      status,
      authority: 'none',
      policyDigest,
      evidenceDigest,
      missingCriteria,
      failedCriteria,
      nonIndependentCriteria,
      insufficientReplicateCriteria,
    };
  } catch (error) {
    return emptyReceipt(error instanceof Error ? error.message : 'invalid discovery evidence');
  }
}
