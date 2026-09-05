import { createHash } from 'node:crypto';

const HEX64 = /^[0-9a-f]{64}$/;
const COMMIT_RE = /^[0-9a-f]{7,40}$/;
const MAX_ARTIFACTS = 4096;
const MAX_GAPS = 4096;
const MAX_PATH_LENGTH = 512;

export type ReconstructionArtifactSource =
  | 'trajectory'
  | 'repository'
  | 'completion'
  | 'generated-dependency';

export type ReconstructionGapReason =
  | 'not-observed'
  | 'dependency-unresolved'
  | 'secret-redacted'
  | 'binary-unavailable';

export interface ReconstructionArtifact {
  /** Normalized relative POSIX path. Raw content is intentionally excluded. */
  path: string;
  /** sha256 of the artifact bytes, lowercase hex. */
  contentDigest: string;
  /** Where this artifact came from. Inferred sources never become recovered evidence. */
  source: ReconstructionArtifactSource;
  /** Whether the reconstructed task requires this artifact. */
  required: boolean;
  /** Whether the artifact has been independently checked against its declared source. */
  verified: boolean;
}

export interface ReconstructionGap {
  /** Normalized relative POSIX path that could not be reconstructed. */
  path: string;
  reason: ReconstructionGapReason;
  required: boolean;
}

export interface EnvironmentReconstructionManifest {
  schemaVersion: 1;
  /** sha256 of the immutable source trajectory or trace bundle. */
  trajectoryDigest: string;
  /** Optional source repository commit when the trajectory is repository-bound. */
  sourceCommit?: string;
  /** Optional digest of the pinned base image or environment root. */
  baseImageDigest?: string;
  artifacts: ReconstructionArtifact[];
  gaps: ReconstructionGap[];
}

export interface EnvironmentReconstructionReceipt {
  schemaVersion: 1;
  manifestDigest: string;
  trajectoryDigest: string;
  taskSufficient: boolean;
  recoveredArtifacts: number;
  inferredArtifacts: number;
  verifiedArtifacts: number;
  gaps: number;
  requiredGaps: number;
  /** Structural reconstruction evidence never grants execution authority. */
  authority: 'none';
}

const ARTIFACT_SOURCES = new Set<ReconstructionArtifactSource>([
  'trajectory',
  'repository',
  'completion',
  'generated-dependency',
]);

const GAP_REASONS = new Set<ReconstructionGapReason>([
  'not-observed',
  'dependency-unresolved',
  'secret-redacted',
  'binary-unavailable',
]);

const INFERRED_SOURCES = new Set<ReconstructionArtifactSource>([
  'completion',
  'generated-dependency',
]);

function assertDigest(value: string, field: string): void {
  if (!HEX64.test(value)) {
    throw new Error(`${field} must be a lowercase 64 character sha256 digest`);
  }
}

function assertPath(value: string, field: string): void {
  if (value.length === 0 || value.length > MAX_PATH_LENGTH) {
    throw new Error(`${field} must be between 1 and ${MAX_PATH_LENGTH} characters`);
  }
  if (value.includes('\0') || value.startsWith('/') || value.startsWith('\\') || value.includes('\\')) {
    throw new Error(`${field} must be a relative POSIX path`);
  }
  const parts = value.split('/');
  if (parts.some((part) => part.length === 0 || part === '.' || part === '..')) {
    throw new Error(`${field} must be normalized and may not contain empty, dot, or parent segments`);
  }
}

function assertManifest(manifest: EnvironmentReconstructionManifest): void {
  if (manifest.schemaVersion !== 1) {
    throw new Error(`unsupported reconstruction schema version: ${String(manifest.schemaVersion)}`);
  }
  assertDigest(manifest.trajectoryDigest, 'trajectoryDigest');
  if (manifest.sourceCommit !== undefined && !COMMIT_RE.test(manifest.sourceCommit)) {
    throw new Error('sourceCommit must be 7 to 40 lowercase hexadecimal characters');
  }
  if (manifest.baseImageDigest !== undefined) {
    assertDigest(manifest.baseImageDigest, 'baseImageDigest');
  }
  if (manifest.artifacts.length > MAX_ARTIFACTS) {
    throw new Error(`artifacts exceeds maximum of ${MAX_ARTIFACTS}`);
  }
  if (manifest.gaps.length > MAX_GAPS) {
    throw new Error(`gaps exceeds maximum of ${MAX_GAPS}`);
  }

  const paths = new Set<string>();
  for (const artifact of manifest.artifacts) {
    assertPath(artifact.path, 'artifact.path');
    if (paths.has(artifact.path)) {
      throw new Error(`duplicate reconstruction path: ${artifact.path}`);
    }
    paths.add(artifact.path);
    assertDigest(artifact.contentDigest, `artifact ${artifact.path} contentDigest`);
    if (!ARTIFACT_SOURCES.has(artifact.source)) {
      throw new Error(`unsupported artifact source for ${artifact.path}`);
    }
    if (typeof artifact.required !== 'boolean' || typeof artifact.verified !== 'boolean') {
      throw new Error(`artifact ${artifact.path} required and verified must be booleans`);
    }
  }

  for (const gap of manifest.gaps) {
    assertPath(gap.path, 'gap.path');
    if (paths.has(gap.path)) {
      throw new Error(`reconstruction path cannot be both artifact and gap: ${gap.path}`);
    }
    paths.add(gap.path);
    if (!GAP_REASONS.has(gap.reason)) {
      throw new Error(`unsupported gap reason for ${gap.path}`);
    }
    if (typeof gap.required !== 'boolean') {
      throw new Error(`gap ${gap.path} required must be boolean`);
    }
  }
}

function canonicalManifest(manifest: EnvironmentReconstructionManifest): string {
  const artifacts = [...manifest.artifacts]
    .sort((a, b) => a.path.localeCompare(b.path))
    .map((artifact) => ({
      path: artifact.path,
      contentDigest: artifact.contentDigest,
      source: artifact.source,
      required: artifact.required,
      verified: artifact.verified,
    }));
  const gaps = [...manifest.gaps]
    .sort((a, b) => a.path.localeCompare(b.path))
    .map((gap) => ({ path: gap.path, reason: gap.reason, required: gap.required }));

  return JSON.stringify({
    schemaVersion: 1,
    trajectoryDigest: manifest.trajectoryDigest,
    sourceCommit: manifest.sourceCommit ?? null,
    baseImageDigest: manifest.baseImageDigest ?? null,
    artifacts,
    gaps,
  });
}

/**
 * Produce a deterministic metadata-only receipt for a reconstructed environment.
 *
 * The function validates provenance structure but never executes reconstructed
 * commands or reads artifact content. A sufficient reconstruction is still only
 * evidence; callers must pass any later execution through the normal RVM policy.
 */
export function createEnvironmentReconstructionReceipt(
  manifest: EnvironmentReconstructionManifest,
): EnvironmentReconstructionReceipt {
  assertManifest(manifest);

  const manifestDigest = createHash('sha256').update(canonicalManifest(manifest)).digest('hex');
  const recoveredArtifacts = manifest.artifacts.filter(
    (artifact) => artifact.source === 'trajectory' || artifact.source === 'repository',
  ).length;
  const inferredArtifacts = manifest.artifacts.length - recoveredArtifacts;
  const verifiedArtifacts = manifest.artifacts.filter((artifact) => artifact.verified).length;
  const requiredGaps = manifest.gaps.filter((gap) => gap.required).length;
  const hasRequiredUnverified = manifest.artifacts.some(
    (artifact) => artifact.required && !artifact.verified,
  );
  const hasUnverifiedInference = manifest.artifacts.some(
    (artifact) => INFERRED_SOURCES.has(artifact.source) && !artifact.verified,
  );

  return {
    schemaVersion: 1,
    manifestDigest,
    trajectoryDigest: manifest.trajectoryDigest,
    taskSufficient: requiredGaps === 0 && !hasRequiredUnverified && !hasUnverifiedInference,
    recoveredArtifacts,
    inferredArtifacts,
    verifiedArtifacts,
    gaps: manifest.gaps.length,
    requiredGaps,
    authority: 'none',
  };
}
