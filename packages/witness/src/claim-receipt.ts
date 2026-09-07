import { createHash } from 'node:crypto';

/** Maximum assignments accepted by a single committed experiment manifest. */
export const MAX_CLAIM_RECEIPT_ASSIGNMENTS = 10_000;
/** Maximum evidence records accepted by a single verification call. */
export const MAX_CLAIM_RECEIPT_RECORDS = 100_000;

/** A member of the experiment universe committed before outcomes are observed. */
export interface ExperimentAssignment {
  /** Stable opaque assignment identifier. */
  id: string;
}

/** The immutable experiment universe against which omissions are evaluated. */
export interface ExperimentManifest {
  /** Stable experiment family identifier. */
  experimentId: string;
  /** Version of the protocol/evaluator contract used for this experiment. */
  protocolVersion: string;
  /** Canonical ISO-8601 timestamp recorded before candidate outcomes are visible. */
  committedAt: string;
  /** Complete set of committed assignments. Order is not semantically meaningful. */
  assignments: readonly ExperimentAssignment[];
}

/** One retained piece of typed evidence. Raw private evidence is intentionally excluded. */
export interface EvidenceRecord {
  /** Assignment this evidence belongs to. */
  assignmentId: string;
  /** Claim-visible semantic field group, for example `outcome` or `cost`. */
  fieldGroup: string;
  /** SHA-256 digest of the retained evidence bytes. */
  digest: string;
  /** Whether an auditor-visible opening for this record is available. */
  opened: boolean;
  /** Whether this record proves terminal completion for the assignment. */
  terminal: boolean;
}

/** Evidence requirements for one inferential or accounting claim. */
export interface ClaimSpec {
  /** Stable claim identifier. */
  claimId: string;
  /** Field groups that must exist for every committed assignment. */
  requiredFieldGroups: readonly string[];
  /** Required groups whose private evidence must additionally be opened. */
  requireOpenedFieldGroups?: readonly string[];
  /** Whether every committed assignment requires terminal evidence. Default true. */
  requireTerminalCoverage?: boolean;
}

/** Claim-relative verifier result. */
export type ClaimStatus =
  | 'PASS'
  | 'INVALID'
  | 'INCONCLUSIVE_COVERAGE'
  | 'INCONCLUSIVE_SUFFICIENCY';

/** Deterministic verification receipt. This receipt carries evidence, never authority. */
export interface ClaimVerification {
  /** Claim-relative verifier status. */
  status: ClaimStatus;
  /** Explicit reminder that this object cannot authorize execution. */
  authority: 'none';
  /** Canonical digest of the committed experiment universe. */
  manifestDigest: string;
  /** Canonical digest of the claim requirements. */
  claimDigest: string;
  /** Canonical digest of the supplied evidence records. Empty only for malformed evidence. */
  evidenceDigest: string;
  /** Committed assignments missing terminal evidence. */
  missingTerminalAssignments: string[];
  /** Required assignment/field pairs that are absent. */
  missingFields: string[];
  /** Required assignment/field pairs whose private evidence was not opened. */
  missingOpenings: string[];
  /** Human-readable reason for INVALID or INCONCLUSIVE results. */
  reason?: string;
}

const HEX64 = /^[0-9a-f]{64}$/;
const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9._:/@-]{0,255}$/;

function sha256Hex(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

function compareAscii(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function validateId(value: string, name: string): void {
  if (!SAFE_ID.test(value)) {
    throw new Error(`${name} must be 1-256 safe identifier characters`);
  }
}

function canonicalTimestamp(value: string): string {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) {
    throw new Error('committedAt must be a valid ISO-8601 timestamp');
  }
  const canonical = new Date(parsed).toISOString();
  if (canonical !== value) {
    throw new Error(`committedAt must be canonical ISO-8601, expected ${canonical}`);
  }
  return canonical;
}

function uniqueSorted(values: readonly string[], name: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    validateId(value, name);
    if (seen.has(value)) {
      throw new Error(`${name} contains duplicate ${value}`);
    }
    seen.add(value);
    out.push(value);
  }
  return out.sort(compareAscii);
}

/**
 * Compute the canonical manifest digest.
 *
 * Assignment order is normalized so equivalent committed universes hash identically.
 */
export function hashExperimentManifest(manifest: ExperimentManifest): string {
  validateId(manifest.experimentId, 'experimentId');
  validateId(manifest.protocolVersion, 'protocolVersion');
  canonicalTimestamp(manifest.committedAt);
  if (manifest.assignments.length === 0) {
    throw new Error('manifest must contain at least one assignment');
  }
  if (manifest.assignments.length > MAX_CLAIM_RECEIPT_ASSIGNMENTS) {
    throw new Error(`manifest exceeds ${MAX_CLAIM_RECEIPT_ASSIGNMENTS} assignments`);
  }
  const assignmentIds = uniqueSorted(
    manifest.assignments.map((assignment) => assignment.id),
    'assignment id',
  );
  return sha256Hex(
    JSON.stringify({
      experimentId: manifest.experimentId,
      protocolVersion: manifest.protocolVersion,
      committedAt: manifest.committedAt,
      assignmentIds,
    }),
  );
}

/** Compute a canonical digest of claim requirements. */
export function hashClaimSpec(claim: ClaimSpec): string {
  validateId(claim.claimId, 'claimId');
  const requiredFieldGroups = uniqueSorted(claim.requiredFieldGroups, 'requiredFieldGroups');
  if (requiredFieldGroups.length === 0) {
    throw new Error('claim must require at least one field group');
  }
  const requireOpenedFieldGroups = uniqueSorted(
    claim.requireOpenedFieldGroups ?? [],
    'requireOpenedFieldGroups',
  );
  for (const field of requireOpenedFieldGroups) {
    if (!requiredFieldGroups.includes(field)) {
      throw new Error(`opened field ${field} must also be required`);
    }
  }
  return sha256Hex(
    JSON.stringify({
      claimId: claim.claimId,
      requiredFieldGroups,
      requireOpenedFieldGroups,
      requireTerminalCoverage: claim.requireTerminalCoverage ?? true,
    }),
  );
}

interface CanonicalEvidence {
  assignmentId: string;
  fieldGroup: string;
  digest: string;
  opened: boolean;
  terminal: boolean;
}

function canonicalizeEvidence(
  records: readonly EvidenceRecord[],
  assignments: ReadonlySet<string>,
): CanonicalEvidence[] {
  if (records.length > MAX_CLAIM_RECEIPT_RECORDS) {
    throw new Error(`evidence exceeds ${MAX_CLAIM_RECEIPT_RECORDS} records`);
  }
  const seen = new Set<string>();
  const canonical: CanonicalEvidence[] = [];
  for (const record of records) {
    validateId(record.assignmentId, 'evidence assignmentId');
    validateId(record.fieldGroup, 'evidence fieldGroup');
    if (!assignments.has(record.assignmentId)) {
      throw new Error(`evidence references undeclared assignment ${record.assignmentId}`);
    }
    if (!HEX64.test(record.digest)) {
      throw new Error('evidence digest must be 64 lowercase hex characters');
    }
    const key = `${record.assignmentId}\u0000${record.fieldGroup}`;
    if (seen.has(key)) {
      throw new Error(`duplicate evidence identity ${record.assignmentId}/${record.fieldGroup}`);
    }
    seen.add(key);
    canonical.push({
      assignmentId: record.assignmentId,
      fieldGroup: record.fieldGroup,
      digest: record.digest,
      opened: record.opened,
      terminal: record.terminal,
    });
  }
  canonical.sort((left, right) => {
    const assignmentOrder = compareAscii(left.assignmentId, right.assignmentId);
    return assignmentOrder === 0 ? compareAscii(left.fieldGroup, right.fieldGroup) : assignmentOrder;
  });
  return canonical;
}

/** Compute a canonical digest over supplied evidence records. */
export function hashEvidenceRecords(
  manifest: ExperimentManifest,
  records: readonly EvidenceRecord[],
): string {
  hashExperimentManifest(manifest);
  const assignmentIds = new Set(manifest.assignments.map((assignment) => assignment.id));
  const canonical = canonicalizeEvidence(records, assignmentIds);
  return sha256Hex(JSON.stringify(canonical));
}

function invalidReceipt(
  manifestDigest: string,
  claimDigest: string,
  reason: string,
): ClaimVerification {
  return {
    status: 'INVALID',
    authority: 'none',
    manifestDigest,
    claimDigest,
    evidenceDigest: '',
    missingTerminalAssignments: [],
    missingFields: [],
    missingOpenings: [],
    reason,
  };
}

/**
 * Verify whether retained evidence is complete enough for one declared claim.
 *
 * `PASS` means only that the declared evidence is present and bound to the committed
 * assignment universe. It does not establish that the scientific claim is true.
 *
 * The expected manifest digest must come from an independently anchored commitment.
 * A caller that can freely rewrite both the manifest and its expected digest can still
 * launder omissions; that trust boundary belongs to RVM/RVF or an external signer.
 */
export function verifyClaimEvidence(
  manifest: ExperimentManifest,
  expectedManifestDigest: string,
  claim: ClaimSpec,
  records: readonly EvidenceRecord[],
): ClaimVerification {
  let manifestDigest = '';
  let claimDigest = '';
  try {
    manifestDigest = hashExperimentManifest(manifest);
    claimDigest = hashClaimSpec(claim);
  } catch (error) {
    return invalidReceipt(manifestDigest, claimDigest, (error as Error).message);
  }

  if (!HEX64.test(expectedManifestDigest)) {
    return invalidReceipt(manifestDigest, claimDigest, 'expected manifest digest is malformed');
  }
  if (manifestDigest !== expectedManifestDigest) {
    return invalidReceipt(manifestDigest, claimDigest, 'manifest digest mismatch');
  }

  const assignmentIds = manifest.assignments
    .map((assignment) => assignment.id)
    .sort(compareAscii);
  let canonicalEvidence: CanonicalEvidence[];
  try {
    canonicalEvidence = canonicalizeEvidence(records, new Set(assignmentIds));
  } catch (error) {
    return invalidReceipt(manifestDigest, claimDigest, (error as Error).message);
  }
  const evidenceDigest = sha256Hex(JSON.stringify(canonicalEvidence));
  const byIdentity = new Map<string, CanonicalEvidence>(
    canonicalEvidence.map(
      (record) => [`${record.assignmentId}\u0000${record.fieldGroup}`, record] as const,
    ),
  );

  const terminalAssignments = new Set(
    canonicalEvidence.filter((record) => record.terminal).map((record) => record.assignmentId),
  );
  const requireTerminalCoverage = claim.requireTerminalCoverage ?? true;
  const missingTerminalAssignments = requireTerminalCoverage
    ? assignmentIds.filter((assignmentId) => !terminalAssignments.has(assignmentId))
    : [];

  if (missingTerminalAssignments.length > 0) {
    return {
      status: 'INCONCLUSIVE_COVERAGE',
      authority: 'none',
      manifestDigest,
      claimDigest,
      evidenceDigest,
      missingTerminalAssignments,
      missingFields: [],
      missingOpenings: [],
      reason: 'one or more committed assignments lack terminal evidence',
    };
  }

  const requiredFields = [...claim.requiredFieldGroups].sort(compareAscii);
  const openedFields = new Set(claim.requireOpenedFieldGroups ?? []);
  const missingFields: string[] = [];
  const missingOpenings: string[] = [];

  for (const assignmentId of assignmentIds) {
    for (const fieldGroup of requiredFields) {
      const record = byIdentity.get(`${assignmentId}\u0000${fieldGroup}`);
      const identity = `${assignmentId}/${fieldGroup}`;
      if (!record) {
        missingFields.push(identity);
      } else if (openedFields.has(fieldGroup) && !record.opened) {
        missingOpenings.push(identity);
      }
    }
  }

  if (missingFields.length > 0 || missingOpenings.length > 0) {
    return {
      status: 'INCONCLUSIVE_SUFFICIENCY',
      authority: 'none',
      manifestDigest,
      claimDigest,
      evidenceDigest,
      missingTerminalAssignments: [],
      missingFields,
      missingOpenings,
      reason: 'retained evidence is insufficient for the declared claim',
    };
  }

  return {
    status: 'PASS',
    authority: 'none',
    manifestDigest,
    claimDigest,
    evidenceDigest,
    missingTerminalAssignments: [],
    missingFields: [],
    missingOpenings: [],
  };
}
