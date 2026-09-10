/**
 * Evidence freshness: does a candidate's evaluation receipt still describe the
 * tree it is about to be promoted into?
 *
 * Reproduced 2026-09-07 (backlog-landing night). PR #11 was evaluated on
 * 2026-08-15 against `dream.config.json` as it stood that day, asserting
 * `withDefaults(selfConfig).autoMerge === true` and golden-snapshotting the
 * compiled prompt. Its own evaluation was honest and passed. Three weeks later
 * the repository deliberately set `autoMerge: false`, and the compiled prompt
 * legitimately evolved. When the PR finally landed, `main` went red on two
 * tests — not because the diff was wrong, but because the *environment the
 * evidence was collected in* had moved underneath it.
 *
 * The load-bearing detail is that **git merged #11 cleanly**. There was no
 * conflict, because `dream.config.json` was never in #11's diff. It was in
 * #11's *read set*: a file the evaluation depended on but did not modify.
 *
 *   git protects the WRITE set. Nothing here protected the READ set.
 *
 * Every gate in this repository freezes a policy *before* outcomes are visible
 * (see `discovery-evidence.ts`, `claim-receipt.ts`) and then treats the
 * resulting receipt as timeless. That is safe while a candidate lands the same
 * night. It is not safe across a 30-PR, three-week backlog, which is exactly
 * the regime this repository operates in.
 *
 * This module makes the read set an explicit, digest-anchored part of the
 * evidence, and re-verifies it at promotion time.
 *
 * Deliberate non-goals, because getting these wrong makes the gate useless:
 *
 * - **A moved base commit is NOT staleness.** `main` advances constantly; a
 *   gate that fires whenever HEAD != baseCommit fires always, gets ignored, and
 *   protects nothing. `baseCommitMoved` is reported as context, never as a
 *   stale verdict on its own.
 * - **Age is NOT the primary signal.** A three-week-old candidate whose
 *   dependencies never moved is still valid; a one-day-old candidate whose
 *   dependencies moved is not. Age is an optional secondary bound for callers
 *   who want one, not the mechanism.
 * - **This module performs no I/O.** It never reads files, git, or the network.
 *   The caller supplies observed digests, so the same pure function is usable
 *   in CI, in a promotion gate, and in tests. Consistent with the rest of
 *   `@dream-machine/witness`.
 *
 * Like every other receipt in this package, a FRESH verdict is evidence that
 * the evaluation still applies. It is never authority to merge anything.
 */

import { createHash } from 'node:crypto';

/** Upper bound on declared dependencies, so a malformed policy cannot pin CPU. */
export const MAX_EVIDENCE_DEPENDENCIES = 4_096;
/** Upper bound on a single repo-relative path, well past any real one. */
export const MAX_EVIDENCE_PATH_LENGTH = 1_024;
/** Upper bound on the optional age budget, in days. */
export const MAX_EVIDENCE_AGE_DAYS = 3_650;

export type FreshnessStatus = 'FRESH' | 'STALE' | 'INDETERMINATE' | 'INVALID';

/**
 * One member of the evidence's read set: a path the evaluation depended on,
 * plus the digest of its content at the time the evidence was collected.
 *
 * Digests only. Raw file content never enters a receipt.
 */
export interface EvidenceDependency {
  /** Repository-relative path. Never absolute, never traversing. */
  path: string;
  /** SHA-256 of the path's content when the evidence was produced. */
  digest: string;
}

/** Frozen when the candidate is evaluated, before any promotion decision. */
export interface EvidenceFreshnessPolicy {
  /** Stable identity for this candidate's evidence. */
  policyId: string;
  /** The commit the evaluation actually ran against. */
  baseCommit: string;
  /** Canonical ISO 8601 timestamp of the evaluation. */
  evaluatedAt: string;
  /**
   * The declared read set: every path whose content the evaluation's result
   * depends on. This is deliberately broader than the diff -- config the tests
   * load, fixtures they compare against, schemas they validate with.
   */
  dependencies: readonly EvidenceDependency[];
  /**
   * Reject an empty read set. An undeclared read set is not evidence that a
   * candidate has no environmental dependencies; it is evidence that nobody
   * looked. Default true, because the silent-empty case is precisely how this
   * gate would get quietly defeated.
   */
  requireDeclaredDependencies: boolean;
  /** Optional secondary bound. Omit for no age limit -- drift is the real gate. */
  maxAgeDays?: number;
}

/** Taken at promotion time, against the tree the candidate would land in. */
export interface EvidenceFreshnessObservation {
  /** The commit the candidate would be promoted into. */
  headCommit: string;
  /** Canonical ISO 8601 timestamp of this observation. */
  observedAt: string;
  /** The same declared paths, digested against the current tree. */
  dependencies: readonly EvidenceDependency[];
}

/** Deterministic freshness receipt. Carries evidence, never authority. */
export interface EvidenceFreshnessReceipt {
  status: FreshnessStatus;
  authority: 'none';
  policyDigest: string;
  observationDigest: string;
  /** Declared paths whose content changed since evaluation. The #11 signal. */
  driftedPaths: string[];
  /** Declared paths absent from the observation -- unverifiable, not fresh. */
  missingPaths: string[];
  /** Observed paths never declared -- the observation does not match the policy. */
  unexpectedPaths: string[];
  /** Whole days between evaluation and observation, or null if unmeasurable. */
  ageDays: number | null;
  /** True only when an explicit `maxAgeDays` was set and exceeded. */
  ageExceeded: boolean;
  /** Informational: HEAD differs from the evaluated base. Never stale on its own. */
  baseCommitMoved: boolean;
  reason?: string;
}

const HEX64 = /^[0-9a-f]{64}$/;
const COMMIT_RE = /^[0-9a-f]{7,64}$/;
const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9._:/@-]{0,255}$/;
const MS_PER_DAY = 86_400_000;

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function requireId(value: string, field: string): string {
  if (typeof value !== 'string') throw new Error(`${field} must be a string`);
  const normalized = value.trim();
  if (!SAFE_ID.test(normalized)) throw new Error(`${field} must be a nonempty bounded identifier`);
  return normalized;
}

function requireDigest(value: string, field: string): string {
  if (typeof value !== 'string' || !HEX64.test(value)) {
    throw new Error(`${field} must be 64 lowercase hex characters`);
  }
  return value;
}

function requireCommit(value: string, field: string): string {
  if (typeof value !== 'string' || !COMMIT_RE.test(value)) {
    throw new Error(`${field} must be a lowercase hex commit sha`);
  }
  return value;
}

function requireCanonicalTimestamp(value: string, field: string): string {
  if (typeof value !== 'string') throw new Error(`${field} must be a string`);
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString() !== value) {
    throw new Error(`${field} must be canonical ISO 8601 with milliseconds and Z`);
  }
  return value;
}

/**
 * Repo-relative, non-traversing, bounded. A policy naming `/etc/shadow` or
 * `../../secrets` is malformed, not merely unusual: the read set is a claim
 * about this repository's tree, and anything outside it cannot be re-verified
 * against a promotion target.
 */
function requirePath(value: string, field: string): string {
  if (typeof value !== 'string') throw new Error(`${field} must be a string`);
  const normalized = value.trim();
  if (normalized.length === 0) throw new Error(`${field} must not be empty`);
  if (normalized.length > MAX_EVIDENCE_PATH_LENGTH) {
    throw new Error(`${field} exceeds ${MAX_EVIDENCE_PATH_LENGTH} characters`);
  }
  if (normalized.startsWith('/') || /^[A-Za-z]:[\\/]/.test(normalized)) {
    throw new Error(`${field} must be repository-relative, not absolute`);
  }
  if (normalized.includes('\\')) throw new Error(`${field} must use forward slashes`);
  if (normalized.split('/').some((segment) => segment === '..')) {
    throw new Error(`${field} must not traverse outside the repository`);
  }
  if (normalized.includes('\0')) throw new Error(`${field} must not contain a null byte`);
  return normalized;
}

/** Deterministic, duplicate-free, sorted read set. */
function normalizedDependencies(
  dependencies: readonly EvidenceDependency[],
  field: string,
): EvidenceDependency[] {
  if (!Array.isArray(dependencies)) throw new Error(`${field} must be an array`);
  if (dependencies.length > MAX_EVIDENCE_DEPENDENCIES) {
    throw new Error(`${field} exceeds ${MAX_EVIDENCE_DEPENDENCIES} entries`);
  }
  const seen = new Set<string>();
  const normalized = dependencies.map((dependency) => {
    if (dependency === null || typeof dependency !== 'object') {
      throw new Error(`${field} contains a non-object entry`);
    }
    const path = requirePath(dependency.path, `${field} path`);
    if (seen.has(path)) throw new Error(`${field} contains duplicate path ${path}`);
    seen.add(path);
    return { path, digest: requireDigest(dependency.digest, `${field} digest for ${path}`) };
  });
  return normalized.sort((left, right) => (left.path < right.path ? -1 : left.path > right.path ? 1 : 0));
}

function normalizedMaxAgeDays(value: number | undefined, field: string): number | null {
  if (value === undefined) return null;
  if (!Number.isSafeInteger(value) || value < 1 || value > MAX_EVIDENCE_AGE_DAYS) {
    throw new Error(`${field} must be an integer in [1, ${MAX_EVIDENCE_AGE_DAYS}]`);
  }
  return value;
}

/**
 * Canonical digest of the freshness policy frozen at evaluation time.
 *
 * Anchoring this digest independently (in the PR body, the ledger row, a
 * witness stamp) is what stops a stale candidate from simply rewriting its own
 * read set at promotion time to make the drift disappear.
 */
export function evidenceFreshnessPolicyDigest(policy: EvidenceFreshnessPolicy): string {
  if (policy === null || typeof policy !== 'object') throw new Error('policy must be an object');
  if (typeof policy.requireDeclaredDependencies !== 'boolean') {
    throw new Error('requireDeclaredDependencies must be boolean');
  }
  const canonical = JSON.stringify({
    policyId: requireId(policy.policyId, 'policyId'),
    baseCommit: requireCommit(policy.baseCommit, 'baseCommit'),
    evaluatedAt: requireCanonicalTimestamp(policy.evaluatedAt, 'evaluatedAt'),
    dependencies: normalizedDependencies(policy.dependencies, 'dependencies'),
    requireDeclaredDependencies: policy.requireDeclaredDependencies,
    maxAgeDays: normalizedMaxAgeDays(policy.maxAgeDays, 'maxAgeDays'),
  });
  return sha256(canonical);
}

function emptyReceipt(reason: string): EvidenceFreshnessReceipt {
  return {
    status: 'INVALID',
    authority: 'none',
    policyDigest: '',
    observationDigest: '',
    driftedPaths: [],
    missingPaths: [],
    unexpectedPaths: [],
    ageDays: null,
    ageExceeded: false,
    baseCommitMoved: false,
    reason,
  };
}

/**
 * Re-verify a frozen evidence policy against the tree it would be promoted
 * into.
 *
 * A FRESH verdict means: every path the evaluation declared it depended on
 * still has the exact content it had when the evidence was collected, so the
 * evaluation's conclusion still describes this tree. It does not mean the
 * change is correct, reviewed, or safe -- those are other gates' jobs -- and it
 * never grants authority to merge.
 */
export function evaluateEvidenceFreshness(
  policy: EvidenceFreshnessPolicy,
  expectedPolicyDigest: string,
  observation: EvidenceFreshnessObservation,
): EvidenceFreshnessReceipt {
  try {
    const policyDigest = evidenceFreshnessPolicyDigest(policy);
    requireDigest(expectedPolicyDigest, 'expectedPolicyDigest');
    if (policyDigest !== expectedPolicyDigest) {
      return emptyReceipt('policy digest mismatch');
    }

    if (observation === null || typeof observation !== 'object') {
      throw new Error('observation must be an object');
    }

    const declared = normalizedDependencies(policy.dependencies, 'dependencies');
    if (policy.requireDeclaredDependencies && declared.length === 0) {
      return emptyReceipt('policy declares no dependencies while requireDeclaredDependencies is set');
    }

    const headCommit = requireCommit(observation.headCommit, 'headCommit');
    const observedAt = requireCanonicalTimestamp(observation.observedAt, 'observedAt');
    const observed = normalizedDependencies(observation.dependencies, 'observed dependencies');

    const evaluatedMs = Date.parse(policy.evaluatedAt);
    const observedMs = Date.parse(observedAt);
    if (observedMs < evaluatedMs) {
      return emptyReceipt('observedAt precedes evaluatedAt');
    }
    const ageDays = Math.floor((observedMs - evaluatedMs) / MS_PER_DAY);

    const observedByPath = new Map(observed.map((dependency) => [dependency.path, dependency.digest]));
    const declaredPaths = new Set(declared.map((dependency) => dependency.path));

    const driftedPaths: string[] = [];
    const missingPaths: string[] = [];
    for (const dependency of declared) {
      const current = observedByPath.get(dependency.path);
      if (current === undefined) missingPaths.push(dependency.path);
      else if (current !== dependency.digest) driftedPaths.push(dependency.path);
    }
    const unexpectedPaths = observed
      .map((dependency) => dependency.path)
      .filter((path) => !declaredPaths.has(path));

    const maxAgeDays = normalizedMaxAgeDays(policy.maxAgeDays, 'maxAgeDays');
    const ageExceeded = maxAgeDays !== null && ageDays > maxAgeDays;

    // A moved base commit is the normal case, never a stale verdict by itself.
    const baseCommitMoved = headCommit !== requireCommit(policy.baseCommit, 'baseCommit');

    const observationDigest = sha256(JSON.stringify({ headCommit, observedAt, dependencies: observed }));

    let status: FreshnessStatus;
    if (driftedPaths.length > 0 || ageExceeded) {
      status = 'STALE';
    } else if (missingPaths.length > 0 || unexpectedPaths.length > 0) {
      // Cannot verify what was not observed, and an observation carrying paths
      // the policy never declared is not the observation this policy describes.
      status = 'INDETERMINATE';
    } else {
      status = 'FRESH';
    }

    return {
      status,
      authority: 'none',
      policyDigest,
      observationDigest,
      driftedPaths,
      missingPaths,
      unexpectedPaths,
      ageDays,
      ageExceeded,
      baseCommitMoved,
    };
  } catch (error) {
    return emptyReceipt(error instanceof Error ? error.message : 'invalid evidence freshness input');
  }
}
