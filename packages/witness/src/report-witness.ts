/**
 * @dream-machine/witness — report-embedded witnesses.
 *
 * `stamp`/`verify` in `./index.js` hash whatever bytes they are given, which
 * is correct but easy to misuse: authoring a report by (1) hashing a draft,
 * (2) pasting the resulting triple into the report's own "## Witness"
 * section, then (3) committing the file, hashes bytes that no longer exist —
 * the committed file (with the triple inserted) hashes to something else.
 * Every reader who tries to reproduce the published values from the
 * committed artifact then fails, because the input they hash (the final
 * file) was never the input that produced the published hash (the pre-
 * insertion draft).
 *
 * This module defines a canonical exclusion transform that closes that gap:
 * the report's trailing `## Witness` section (and only that section) is
 * excluded from hashing, so the triple can be computed once, embedded in the
 * report, and reproduced from the exact committed file forever after —
 * without needing to preserve an intermediate, unpublished byte sequence.
 */
import { stamp, verify, normalizeCommit, type Witness, type CommitSha } from './index.js';

/** The exact heading line a report's trailing witness section starts with. */
export const WITNESS_HEADING = '## Witness';

export interface Split {
  /** Bytes to hash: everything before the Witness heading, trailer-normalized. */
  canonical: string;
  /** Raw text of the Witness section (heading through EOF), or null if absent. */
  witnessSection: string | null;
}

/**
 * Collapse trailing whitespace/newlines to exactly one newline. Cosmetic
 * spacing immediately before the Witness heading (one blank line vs three)
 * must not change the canonical hash.
 */
function canonicalizeTrailer(s: string): string {
  return s.replace(/\s+$/u, '') + '\n';
}

/**
 * Split a report into its canonical (hashable) prefix and its trailing
 * Witness section. Exactly one `## Witness` heading (on its own line, exact
 * match, no leading/trailing spaces on the line) is expected; more than one
 * is ambiguous and rejected rather than silently picking the first or last.
 */
export function splitAtWitnessSection(report: string): Split {
  const lines = report.split('\n');
  const headingIndices: number[] = [];
  lines.forEach((line, i) => {
    if (line === WITNESS_HEADING) headingIndices.push(i);
  });
  if (headingIndices.length > 1) {
    throw new Error(
      `report has ${headingIndices.length} "${WITNESS_HEADING}" headings at lines ` +
        `${headingIndices.map((i) => i + 1).join(', ')}; expected exactly one`,
    );
  }
  if (headingIndices.length === 0) {
    return { canonical: canonicalizeTrailer(report), witnessSection: null };
  }
  const idx = headingIndices[0];
  return {
    canonical: canonicalizeTrailer(lines.slice(0, idx).join('\n')),
    witnessSection: lines.slice(idx).join('\n'),
  };
}

/** Compute the witness triple over a report's canonical (pre-Witness-section) bytes. */
export function stampReport(report: string, sessionCommit: CommitSha): Witness {
  const { canonical } = splitAtWitnessSection(report);
  return stamp(canonical, sessionCommit);
}

/**
 * Verify a report against an explicitly supplied commit + claimed witness,
 * hashing only the canonical (pre-Witness-section) bytes. Use this when the
 * expected commit and witness are known independently of the report text
 * (e.g. a CI check comparing against the PR's real head commit).
 */
export function verifyReportBytes(
  report: string,
  sessionCommit: CommitSha,
  claimedWitness: string,
): { ok: boolean; expected: Witness; reason?: string } {
  let canonical: string;
  try {
    canonical = splitAtWitnessSection(report).canonical;
  } catch (e) {
    return {
      ok: false,
      expected: { reportHash: '', sessionCommit, witness: '' },
      reason: (e as Error).message,
    };
  }
  return verify(canonical, sessionCommit, claimedWitness);
}

/** The three fields a report's Witness section publishes, as parsed text. */
export interface ParsedWitnessSection {
  reportHash: string;
  sessionCommit: string;
  witness: string;
}

const FIELD_RE = {
  reportHash: /report_sha256\s*:\s*([0-9a-fA-F]{64})/,
  sessionCommit: /session_commit\s*:\s*([0-9a-fA-F]{7,40})/,
  witness: /\bwitness\s*:\s*([0-9a-fA-F]{64})/,
};

/**
 * Parse the published `report_sha256` / `session_commit` / `witness` fields
 * out of a report's own Witness section text. Returns null if the section is
 * absent or any field is missing/malformed — never throws.
 */
export function parseWitnessSection(witnessSection: string | null): ParsedWitnessSection | null {
  if (!witnessSection) return null;
  const reportHash = witnessSection.match(FIELD_RE.reportHash)?.[1];
  const sessionCommit = witnessSection.match(FIELD_RE.sessionCommit)?.[1];
  const witness = witnessSection.match(FIELD_RE.witness)?.[1];
  if (!reportHash || !sessionCommit || !witness) return null;
  return { reportHash: reportHash.toLowerCase(), sessionCommit: sessionCommit.toLowerCase(), witness: witness.toLowerCase() };
}

/**
 * Fully self-contained verification: parse the published triple out of the
 * report's own Witness section, recompute it from the report's canonical
 * bytes, and compare — no external inputs required beyond the committed
 * file itself. If `expectedCommit` is given, also reject a report whose
 * published `session_commit` does not match it (catching a report edited to
 * declare a different commit than the one it was actually reviewed at).
 */
export function verifyReportSelfContained(
  report: string,
  expectedCommit?: CommitSha,
): { ok: boolean; reason?: string; expected?: Witness; published?: ParsedWitnessSection } {
  let split: Split;
  try {
    split = splitAtWitnessSection(report);
  } catch (e) {
    return { ok: false, reason: (e as Error).message };
  }
  if (!split.witnessSection) {
    return { ok: false, reason: `report has no "${WITNESS_HEADING}" section` };
  }
  const published = parseWitnessSection(split.witnessSection);
  if (!published) {
    return {
      ok: false,
      reason: 'Witness section is present but missing/malformed report_sha256, session_commit, or witness field',
    };
  }
  if (expectedCommit !== undefined) {
    let normalizedExpected: string;
    try {
      normalizedExpected = normalizeCommit(expectedCommit);
    } catch (e) {
      return { ok: false, reason: (e as Error).message, published };
    }
    if (published.sessionCommit !== normalizedExpected) {
      return {
        ok: false,
        reason: `report declares session_commit ${published.sessionCommit}, expected ${normalizedExpected}`,
        published,
      };
    }
  }
  const result = verify(split.canonical, published.sessionCommit, published.witness);
  if (!result.ok) {
    return { ok: false, reason: result.reason, expected: result.expected, published };
  }
  if (result.expected.reportHash !== published.reportHash) {
    return {
      ok: false,
      reason: 'published report_sha256 does not match the hash recomputed from the report\'s own canonical bytes',
      expected: result.expected,
      published,
    };
  }
  return { ok: true, expected: result.expected, published };
}

/** Render a ready-to-paste `## Witness` section for a freshly stamped report. */
export function renderWitnessSection(w: Witness, reportPath?: string): string {
  const verifyCmd = reportPath
    ? `sha256sum ${reportPath} | awk '{print $1}'  # then strip the "${WITNESS_HEADING}" section per splitAtWitnessSection before comparing`
    : `dream-machine witness verify-report <committed-report-file>`;
  return [
    WITNESS_HEADING,
    '',
    '```',
    `report_sha256 : ${w.reportHash}`,
    `session_commit: ${w.sessionCommit}`,
    `witness       : ${w.witness}`,
    '```',
    '',
    'Computed over this file\'s canonical bytes (everything above this heading,',
    'trailing whitespace collapsed to one newline) — reproducible from the',
    'committed file with no unavailable intermediate bytes. Verify:',
    '',
    '```bash',
    verifyCmd,
    '```',
  ].join('\n');
}
