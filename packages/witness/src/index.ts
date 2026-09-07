/**
 * @dream-machine/witness
 *
 * The Dream Machine's provenance stamp. Every nightly report is bound to the
 * exact commit it ran against by a double hash:
 *
 *     REPORT_HASH = sha256(report_bytes)
 *     WITNESS     = sha256(REPORT_HASH_hex || SESSION_COMMIT)
 *
 * This is intentionally trivial to reproduce by hand — the whole point is that
 * anyone can re-derive `WITNESS` from the public gist and the commit sha and
 * confirm the report was not altered after the fact. See {@link verifySteps}.
 */
import { createHash } from 'node:crypto';

export * from './claim-receipt.js';

/** A 40-char lowercase hex git commit sha (short shas of >=7 also accepted). */
export type CommitSha = string;

/** The output of stamping a report. */
export interface Witness {
  /** sha256 of the raw report bytes, lowercase hex. */
  reportHash: string;
  /** The session commit the report was bound to. */
  sessionCommit: CommitSha;
  /** sha256(reportHash || sessionCommit), lowercase hex — the witness stamp. */
  witness: string;
}

const HEX64 = /^[0-9a-f]{64}$/;
const COMMIT_RE = /^[0-9a-f]{7,40}$/;

function sha256Hex(input: string | Uint8Array): string {
  return createHash('sha256').update(input).digest('hex');
}

/**
 * Compute the report hash from raw report content (a gist / report markdown).
 * Bytes are hashed exactly as given; callers are responsible for reading the
 * file without transformation (no newline normalization).
 */
export function hashReport(report: string | Uint8Array): string {
  return sha256Hex(report);
}

/**
 * Stamp a report against a session commit, producing the witness triple.
 * @throws if the commit is not a plausible git sha.
 */
export function stamp(report: string | Uint8Array, sessionCommit: CommitSha): Witness {
  const commit = normalizeCommit(sessionCommit);
  const reportHash = hashReport(report);
  const witness = sha256Hex(reportHash + commit);
  return { reportHash, sessionCommit: commit, witness };
}

/**
 * Recompute the witness from a report hash (not the raw report) + commit.
 * Used by verifiers who already have the published REPORT_HASH.
 */
export function witnessFromHash(reportHash: string, sessionCommit: CommitSha): string {
  if (!HEX64.test(reportHash)) {
    throw new Error(`reportHash must be 64 hex chars, got ${reportHash.length} chars`);
  }
  return sha256Hex(reportHash + normalizeCommit(sessionCommit));
}

/**
 * Verify a claimed witness against the raw report + commit. Returns a detailed
 * result rather than throwing, so callers can report exactly which step failed.
 */
export function verify(
  report: string | Uint8Array,
  sessionCommit: CommitSha,
  claimedWitness: string,
): { ok: boolean; expected: Witness; reason?: string } {
  let expected: Witness;
  try {
    expected = stamp(report, sessionCommit);
  } catch (e) {
    return {
      ok: false,
      // Best-effort echo so the caller still sees inputs.
      expected: { reportHash: hashReport(report), sessionCommit, witness: '' },
      reason: (e as Error).message,
    };
  }
  const claimed = claimedWitness.trim().toLowerCase();
  if (!HEX64.test(claimed)) {
    return { ok: false, expected, reason: 'claimed witness is not 64 hex chars' };
  }
  if (claimed !== expected.witness) {
    return { ok: false, expected, reason: 'witness mismatch — report or commit differs from what was stamped' };
  }
  return { ok: true, expected };
}

/** Normalize/validate a commit sha (lowercased, hex-only). */
export function normalizeCommit(sessionCommit: CommitSha): CommitSha {
  const c = sessionCommit.trim().toLowerCase();
  if (!COMMIT_RE.test(c)) {
    throw new Error(`session commit must be 7–40 hex chars, got "${sessionCommit}"`);
  }
  return c;
}

/**
 * The human-runnable 5-step verification procedure, as text. Published in
 * every gist's Witness section so anyone can reproduce it with coreutils.
 */
export function verifySteps(gistRawUrl = '<RAW_GIST_URL>'): string {
  return [
    '# Verify this Dream Machine report (5 steps, coreutils only):',
    `curl -sL ${gistRawUrl} -o report.md`,
    'REPORT_HASH=$(sha256sum report.md | awk \'{print $1}\')',
    'printf "%s%s" "$REPORT_HASH" "$SESSION_COMMIT" | sha256sum | awk \'{print $1}\'',
    '# ^ this value MUST equal the published WITNESS',
  ].join('\n');
}

export * from './security-patch.js';
export * from './reconstruction.js';
