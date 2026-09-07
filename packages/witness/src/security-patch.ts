import { createHash } from 'node:crypto';

/** One precommitted binary evaluator case. */
export interface SecurityCaseResult {
  /** Stable evaluator-owned case identity. */
  id: string;
  /** Whether the candidate produced the required safe outcome for this case. */
  passed: boolean;
}

/** Frozen evaluator universe for one autonomous vulnerability-repair experiment. */
export interface SecurityPatchContract {
  /** Stable vulnerability class, for example CWE-787. */
  vulnerabilityClass: string;
  /** Stable identifier for the independently reviewed root-cause oracle. */
  rootCauseOracleId: string;
  /** Exact transformed or transplanted exploit cases required for promotion. */
  transformedCaseIds: readonly string[];
  /** Exact negative controls that must preserve legitimate behavior. */
  negativeControlIds: readonly string[];
}

/** Candidate outcomes collected by an evaluator that the candidate cannot modify. */
export interface SecurityPatchEvidence {
  /** Whether the original proof of concept no longer violates the protected property. */
  originalPocBlocked: boolean;
  /** Results for the frozen transformed attack universe. */
  transformedCases: readonly SecurityCaseResult[];
  /** Results for the frozen legitimate-behavior controls. */
  negativeControls: readonly SecurityCaseResult[];
  /** Independent root-cause oracle result. */
  rootCauseSatisfied: boolean;
  /** Existing regression suite result. */
  regressionSuitePassed: boolean;
  /** Optional similarity to a historical/reference patch, in the closed interval [0, 1]. */
  patchSimilarity?: number;
}

/** Deterministic promotion decision for a security patch candidate. */
export interface SecurityPatchVerdict {
  /** Whether all frozen security and compatibility requirements passed. */
  accepted: boolean;
  /** Reasons that prevented promotion. Empty only when accepted. */
  reasons: string[];
  /** Canonical digest of the frozen evaluation contract. */
  contractDigest: string;
  /** Security evidence never grants runtime authority. */
  authority: 'none';
  /** Patch similarity telemetry when supplied by the evaluator. */
  patchSimilarity?: number;
}

function uniqueSorted(values: readonly string[], field: string): string[] {
  const normalized = values.map((value) => value.trim());
  if (normalized.some((value) => value.length === 0)) {
    throw new Error(`${field} contains an empty identifier`);
  }
  const unique = new Set(normalized);
  if (unique.size !== normalized.length) {
    throw new Error(`${field} contains duplicate identifiers`);
  }
  return [...unique].sort();
}

/** Compute the deterministic digest of a frozen security-patch evaluation contract. */
export function securityPatchContractDigest(contract: SecurityPatchContract): string {
  const vulnerabilityClass = contract.vulnerabilityClass.trim();
  const rootCauseOracleId = contract.rootCauseOracleId.trim();
  if (!vulnerabilityClass) throw new Error('vulnerabilityClass is required');
  if (!rootCauseOracleId) throw new Error('rootCauseOracleId is required');

  const canonical = JSON.stringify({
    vulnerabilityClass,
    rootCauseOracleId,
    transformedCaseIds: uniqueSorted(contract.transformedCaseIds, 'transformedCaseIds'),
    negativeControlIds: uniqueSorted(contract.negativeControlIds, 'negativeControlIds'),
  });
  return createHash('sha256').update(canonical).digest('hex');
}

function resultMap(results: readonly SecurityCaseResult[], field: string): Map<string, boolean> {
  const map = new Map<string, boolean>();
  for (const result of results) {
    const id = result.id.trim();
    if (!id) throw new Error(`${field} contains an empty identifier`);
    if (map.has(id)) throw new Error(`${field} contains duplicate result for ${id}`);
    map.set(id, result.passed);
  }
  return map;
}

function compareUniverse(
  required: readonly string[],
  observed: Map<string, boolean>,
  field: string,
  reasons: string[],
): void {
  const requiredSet = new Set(required);
  for (const id of required) {
    if (!observed.has(id)) reasons.push(`${field}: missing ${id}`);
    else if (!observed.get(id)) reasons.push(`${field}: failed ${id}`);
  }
  for (const id of observed.keys()) {
    if (!requiredSet.has(id)) reasons.push(`${field}: unexpected ${id}`);
  }
}

/**
 * Evaluate a candidate security patch against a precommitted root-cause contract.
 *
 * The original PoC becoming harmless is necessary but never sufficient. Every
 * transformed case, negative control, root-cause oracle, and regression gate
 * must also pass. Any evaluator-universe mismatch fails closed.
 */
export function evaluateSecurityPatch(
  contract: SecurityPatchContract,
  evidence: SecurityPatchEvidence,
): SecurityPatchVerdict {
  const transformedRequired = uniqueSorted(contract.transformedCaseIds, 'transformedCaseIds');
  const negativeRequired = uniqueSorted(contract.negativeControlIds, 'negativeControlIds');
  const transformed = resultMap(evidence.transformedCases, 'transformedCases');
  const negative = resultMap(evidence.negativeControls, 'negativeControls');
  const reasons: string[] = [];

  if (!evidence.originalPocBlocked) reasons.push('original proof of concept still violates the property');
  if (!evidence.rootCauseSatisfied) reasons.push('root-cause oracle did not pass');
  if (!evidence.regressionSuitePassed) reasons.push('regression suite did not pass');
  compareUniverse(transformedRequired, transformed, 'transformedCases', reasons);
  compareUniverse(negativeRequired, negative, 'negativeControls', reasons);

  if (evidence.patchSimilarity !== undefined) {
    if (!Number.isFinite(evidence.patchSimilarity) || evidence.patchSimilarity < 0 || evidence.patchSimilarity > 1) {
      throw new Error('patchSimilarity must be a finite number in [0, 1]');
    }
  }

  const base = {
    accepted: reasons.length === 0,
    reasons,
    contractDigest: securityPatchContractDigest(contract),
    authority: 'none' as const,
  };
  return evidence.patchSimilarity === undefined
    ? base
    : { ...base, patchSimilarity: evidence.patchSimilarity };
}
