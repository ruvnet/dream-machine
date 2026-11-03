import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const REPORTS_DIR = fileURLToPath(new URL('../docs/dream-cycle/', import.meta.url));
const WITNESS_HEADING = '## Witness';

/**
 * Reports whose `## Witness` heading appears more than once, with the reason
 * it is exempt from the "exactly one heading" invariant
 * `@dream-machine/witness`'s `splitAtWitnessSection` enforces, AND the exact
 * byte marker + expected hash that proves the exemption is still warranted.
 * Keyed by filename alone (as `packages/ledger`'s `legacyPrefixDigest`
 * anchors its own row-count-based grandfather boundary to content, not just
 * a count) so a future entry cannot be added without `assertStillReproducible`
 * (below) mechanically re-deriving its hash from the file's current bytes —
 * a stale or fabricated entry fails closed, the same way a legacy-ledger-row
 * content mismatch does. Every entry must name a real, understood cause —
 * never a bare "unexplained".
 */
const GRANDFATHERED_MULTI_HEADING = new Map([
  [
    '2026-09-10-compiler-parity-report.md',
    {
      reason:
        'predates splitAtWitnessSection (added 2026-09-15, PR #111); its first ' +
        '"## Witness" occurrence is a forward-reference placeholder ("See STEP ' +
        '16 below...") inside the body, not a real trailing section — only the ' +
        'second, final occurrence carries the actual triple',
      // Bytes up to, and including, the trailing newline immediately before
      // this exact marker must sha256 to expectedReportHash below.
      trailingMarker: '\n---\n\n## Witness\n',
      expectedReportHash: '1c9ec5548ffab1370fadcaf24961a5779b0eaf52690b9314a6483d5e572bec2b',
    },
  ],
]);

function countWitnessHeadings(markdown) {
  return markdown.split('\n').filter((line) => line === WITNESS_HEADING).length;
}

function reportFiles() {
  return readdirSync(REPORTS_DIR)
    .filter((f) => f.endsWith('.md'))
    .map((f) => ({ name: f, markdown: readFileSync(join(REPORTS_DIR, f), 'utf8') }));
}

test('no committed report has more than one "## Witness" heading unless explicitly grandfathered', () => {
  const offenders = [];
  for (const { name, markdown } of reportFiles()) {
    const count = countWitnessHeadings(markdown);
    if (count > 1 && !GRANDFATHERED_MULTI_HEADING.has(name)) {
      offenders.push(`${name} (${count} headings)`);
    }
  }
  assert.deepEqual(
    offenders,
    [],
    `report(s) with an ambiguous duplicate "## Witness" heading, not on the ` +
      `documented grandfather list (dream-machine witness verify-report would ` +
      `throw "ambiguous... expected exactly one" on these): ${offenders.join(', ')}`,
  );
});

test('the grandfather list names no file that no longer needs it', () => {
  const byName = new Map(reportFiles().map((r) => [r.name, r.markdown]));
  const stale = [];
  for (const name of GRANDFATHERED_MULTI_HEADING.keys()) {
    const markdown = byName.get(name);
    if (markdown === undefined) {
      stale.push(`${name} (file no longer exists)`);
      continue;
    }
    if (countWitnessHeadings(markdown) <= 1) {
      stale.push(`${name} (now has <= 1 heading; remove the grandfather entry)`);
    }
  }
  assert.deepEqual(stale, [], `stale grandfather entries: ${stale.join(', ')}`);
});

test('every grandfathered report\'s witness is still independently reproducible by hand', () => {
  // Generic/data-driven, not hardcoded to one filename: a future entry added
  // to GRANDFATHERED_MULTI_HEADING without a matching, re-derivable hash
  // fails HERE, mechanically — the same fail-closed shape as
  // `@dream-machine/ledger`'s `legacyPrefixDigest` mismatch handling. No
  // entry's exemption rests on an unverified claim.
  const mismatches = [];
  for (const [name, { trailingMarker, expectedReportHash }] of GRANDFATHERED_MULTI_HEADING) {
    const markdown = readFileSync(join(REPORTS_DIR, name), 'utf8');
    const idx = markdown.lastIndexOf(trailingMarker);
    if (idx === -1) {
      mismatches.push(`${name}: trailing marker no longer found`);
      continue;
    }
    const canonical = markdown.slice(0, idx) + '\n';
    const reportHash = createHash('sha256').update(canonical).digest('hex');
    if (reportHash !== expectedReportHash) {
      mismatches.push(`${name}: hash ${reportHash} !== expected ${expectedReportHash}`);
    }
  }
  assert.deepEqual(mismatches, [], `grandfather entries that no longer reproduce: ${mismatches.join('; ')}`);
});
