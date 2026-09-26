import { describe, it, expect } from 'vitest';
import {
  splitAtWitnessSection,
  stampReport,
  verifyReportBytes,
  verifyReportSelfContained,
  parseWitnessSection,
  renderWitnessSection,
  WITNESS_HEADING,
} from './report-witness.js';

const COMMIT = '3edd426f6c9c4b1e80235f7447dc863e749345cc';

function buildReport(body: string, commit: string = COMMIT): string {
  const draft = `${body}\n`;
  const w = stampReport(draft, commit);
  return draft + '\n' + renderWitnessSection(w) + '\n';
}

describe('splitAtWitnessSection', () => {
  it('returns the whole (trailer-normalized) report when no Witness section exists — missing-section case', () => {
    const r = splitAtWitnessSection('# Report\n\nbody text\n');
    expect(r.witnessSection).toBeNull();
    expect(r.canonical).toBe('# Report\n\nbody text\n');
  });

  it('splits at the heading and keeps it out of the canonical bytes', () => {
    const r = splitAtWitnessSection(`# Report\n\nbody\n\n${WITNESS_HEADING}\n\nstuff\n`);
    expect(r.canonical).toBe('# Report\n\nbody\n');
    expect(r.witnessSection).toBe(`${WITNESS_HEADING}\n\nstuff\n`);
  });

  it('collapses cosmetic blank-line spacing before the heading — newline/encoding case', () => {
    const tight = splitAtWitnessSection(`# Report\n\nbody\n${WITNESS_HEADING}\nx\n`);
    const loose = splitAtWitnessSection(`# Report\n\nbody\n\n\n\n${WITNESS_HEADING}\nx\n`);
    expect(tight.canonical).toBe(loose.canonical);
  });

  it('throws on a duplicate Witness heading — duplicate-section case', () => {
    const dup = `# Report\n\nbody\n\n${WITNESS_HEADING}\n\nfirst\n\n${WITNESS_HEADING}\n\nsecond\n`;
    expect(() => splitAtWitnessSection(dup)).toThrow(/2 "## Witness" headings/);
  });

  it('does not match an indented or trailing-space heading (must be exact)', () => {
    const r = splitAtWitnessSection(`# Report\n\n${WITNESS_HEADING} \n\nbody\n`);
    expect(r.witnessSection).toBeNull();
  });
});

describe('stampReport / verifyReportBytes', () => {
  it('round-trips: the committed (post-insertion) file verifies against the pre-insertion stamp — positive case', () => {
    const draft = '# Compiler-Parity Report\n\nfinding text\n';
    const w = stampReport(draft, COMMIT);
    const committed = draft + '\n' + renderWitnessSection(w) + '\n';
    // The whole point of the canonical exclusion transform: re-stamping the
    // FINAL committed file (which now contains the Witness section) yields
    // the identical triple, because the section is excluded from hashing.
    const w2 = stampReport(committed, COMMIT);
    expect(w2).toEqual(w);
    expect(verifyReportBytes(committed, COMMIT, w.witness).ok).toBe(true);
  });

  it('rejects a single-byte mutation of the canonical content — mutation case', () => {
    const committed = buildReport('# Report\n\nfinding text');
    const mutated = committed.replace('finding text', 'finding texu');
    const w = stampReport(committed, COMMIT);
    expect(verifyReportBytes(mutated, COMMIT, w.witness).ok).toBe(false);
  });

  it('is insensitive to a mutation strictly inside the Witness section itself', () => {
    const committed = buildReport('# Report\n\nfinding text');
    const w = stampReport(committed, COMMIT);
    const mutatedTrailer = committed + '\nsome reviewer appended a trailing note\n';
    // Appending after the section doesn't change the heading-delimited split,
    // so the canonical bytes — and therefore the witness — are unaffected.
    expect(verifyReportBytes(mutatedTrailer, COMMIT, w.witness).ok).toBe(true);
  });
});

describe('parseWitnessSection', () => {
  it('extracts all three fields from a rendered section', () => {
    const w = stampReport('body\n', COMMIT);
    const parsed = parseWitnessSection(renderWitnessSection(w));
    expect(parsed).toEqual({ reportHash: w.reportHash, sessionCommit: w.sessionCommit, witness: w.witness });
  });

  it('returns null for a missing section', () => {
    expect(parseWitnessSection(null)).toBeNull();
  });

  it('returns null when a field is absent — missing-section (partial) case', () => {
    expect(parseWitnessSection(`${WITNESS_HEADING}\n\nreport_sha256 : ${'a'.repeat(64)}\n`)).toBeNull();
  });
});

describe('verifyReportSelfContained', () => {
  it('verifies a committed report using only the file itself — positive case', () => {
    const committed = buildReport('# Compiler-Parity Report\n\nfinding text');
    const r = verifyReportSelfContained(committed);
    expect(r.ok).toBe(true);
    expect(r.published?.sessionCommit).toBe(COMMIT);
  });

  it('fails clearly when the report has no Witness section — missing-section case', () => {
    const r = verifyReportSelfContained('# Report\n\nno witness here\n');
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/no ".*Witness" section/);
  });

  it('fails when the Witness section is malformed', () => {
    const r = verifyReportSelfContained(`# Report\n\nbody\n\n${WITNESS_HEADING}\n\nnot the right fields\n`);
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/malformed/);
  });

  it('rejects a duplicate Witness heading', () => {
    const committed = buildReport('# Report\n\nbody');
    const dup = committed + `\n${WITNESS_HEADING}\n\nanother\n`;
    const r = verifyReportSelfContained(dup);
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/headings/);
  });

  it('rejects a mutation of the canonical content even though the section itself is untouched', () => {
    const committed = buildReport('# Report\n\nfinding text');
    const mutated = committed.replace('finding text', 'DIFFERENT TEXT');
    const r = verifyReportSelfContained(mutated);
    expect(r.ok).toBe(false);
  });

  it('rejects a report whose published witness was copied from a different canonical body (the exact PR #111 bug)', () => {
    const draft = '# Compiler-Parity Report\n\noriginal draft body\n';
    const w = stampReport(draft, COMMIT); // stamped BEFORE the section existed
    // Author then edits the body after stamping — the historical bug.
    const committedWithEditedBody =
      '# Compiler-Parity Report\n\nEDITED after stamping\n' + '\n' + renderWitnessSection(w) + '\n';
    const r = verifyReportSelfContained(committedWithEditedBody);
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/does not match|mismatch/);
  });

  it('binds to an expected commit and rejects a declared-commit mismatch', () => {
    const committed = buildReport('# Report\n\nbody', COMMIT);
    const otherCommit = 'a'.repeat(40);
    const r = verifyReportSelfContained(committed, otherCommit);
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/expected/);
  });

  it('accepts when the expected commit matches the declared one', () => {
    const committed = buildReport('# Report\n\nbody', COMMIT);
    expect(verifyReportSelfContained(committed, COMMIT).ok).toBe(true);
  });
});
