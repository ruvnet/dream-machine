import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  emptyLedger,
  parseLedger,
  appendRow,
  renderRow,
  verifyLedger,
  learningSignals,
  verdictStats,
  escapeCell,
  LEDGER_COLUMNS,
  type LedgerRow,
} from './index.js';

function row(over: Partial<LedgerRow> = {}): LedgerRow {
  return {
    date: '2026-08-13',
    deep: 'security-adversarial',
    finding: 'add indirect prompt injection family',
    issue: '#180',
    pr: '#181',
    evaluated: 'yes',
    verdict: 'ACCEPT',
    effect: 'n=6',
    witness: '398c71a6',
    priorFates: 'first night',
    ...over,
  };
}

describe('ledger round-trip', () => {
  it('empty ledger has the 10-column header + divider', () => {
    const l = emptyLedger();
    expect(l).toContain('| Date |');
    expect(l).toContain('Prior-night fates');
    expect(LEDGER_COLUMNS).toHaveLength(10);
    expect(parseLedger(l).rows).toHaveLength(0);
  });

  it('append then parse recovers the row', () => {
    const l = appendRow(emptyLedger(), row());
    const { rows, warnings } = parseLedger(l);
    expect(warnings).toEqual([]);
    expect(rows).toHaveLength(1);
    expect(rows[0].verdict).toBe('ACCEPT');
    expect(rows[0].finding).toBe('add indirect prompt injection family');
  });

  it('append adds EXACTLY one row and keeps the schema (property)', () => {
    let l = emptyLedger();
    for (let i = 0; i < 25; i++) {
      const before = parseLedger(l).rows.length;
      l = appendRow(l, row({ date: `2026-08-${String((i % 28) + 1).padStart(2, '0')}` }));
      const after = parseLedger(l).rows.length;
      expect(after).toBe(before + 1);
    }
    expect(parseLedger(l).rows).toHaveLength(25);
    // Header still intact and unique.
    expect((l.match(/\| Date \|/g) ?? []).length).toBe(1);
  });

  it('appends to a ledger that had no trailing newline', () => {
    const l = appendRow('| Date | Deep | Finding | Issue | PR | Evaluated? | Verdict | Effect | Witness | Prior-night fates |\n| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |', row());
    expect(parseLedger(l).rows).toHaveLength(1);
  });

  it('bootstraps a header when appending to empty string', () => {
    const l = appendRow('', row());
    expect(l).toContain('| Date |');
    expect(parseLedger(l).rows).toHaveLength(1);
  });
});

describe('cell escaping', () => {
  it('escapes pipes and newlines so a row cannot break the table', () => {
    const l = appendRow(emptyLedger(), row({ finding: 'a | b\nc' }));
    expect(parseLedger(l).rows).toHaveLength(1);
    expect(renderRow(row({ finding: 'a | b' }))).toContain('a \\| b');
    expect(escapeCell('x\ny')).toBe('x y');
  });
});

describe('verifyLedger', () => {
  it('accepts a valid ledger', () => {
    const l = appendRow(appendRow(emptyLedger(), row()), row({ date: '2026-08-14', verdict: 'REJECT' }));
    const r = verifyLedger(l);
    expect(r.ok).toBe(true);
    expect(r.rowCount).toBe(2);
  });

  it('flags an out-of-range verdict', () => {
    const l = appendRow(emptyLedger(), row({ verdict: 'MAYBE' }));
    const r = verifyLedger(l);
    expect(r.ok).toBe(false);
    expect(r.errors.join()).toMatch(/verdict/);
  });

  it('flags a bad date and bad evaluated value', () => {
    const l = appendRow(emptyLedger(), row({ date: 'yesterday', evaluated: 'perhaps' }));
    const r = verifyLedger(l);
    expect(r.errors.join()).toMatch(/date/);
    expect(r.errors.join()).toMatch(/evaluated/);
  });

  it('flags a missing header', () => {
    const r = verifyLedger('just some text, no table');
    expect(r.ok).toBe(false);
    expect(r.errors.join()).toMatch(/header/);
  });
});

describe('learning signals', () => {
  it('detects a zero-merge streak when no PR is known-merged', () => {
    let l = emptyLedger();
    for (let i = 0; i < 14; i++) l = appendRow(l, row({ pr: `#${100 + i}`, verdict: 'INCONCLUSIVE' }));
    const { rows } = parseLedger(l);
    const s = learningSignals(rows, { mergedPrNumbers: new Set() });
    expect(s.zeroMergeStreak).toBe(true);
  });

  it('clears the zero-merge streak when a PR merged', () => {
    let l = emptyLedger();
    for (let i = 0; i < 14; i++) l = appendRow(l, row({ pr: `#${100 + i}` }));
    const { rows } = parseLedger(l);
    const s = learningSignals(rows, { mergedPrNumbers: new Set(['105']) });
    expect(s.zeroMergeStreak).toBe(false);
  });

  it('detects duplicate directions repeated >= 3 times', () => {
    let l = emptyLedger();
    for (let i = 0; i < 3; i++) l = appendRow(l, row({ finding: 'improve router calibration loop' }));
    l = appendRow(l, row({ finding: 'totally different thing here' }));
    const { rows } = parseLedger(l);
    const s = learningSignals(rows);
    expect(s.duplicateDirections.some((d) => d.includes('router'))).toBe(true);
  });

  it('detects a low-score streak (last 3 < 5)', () => {
    const { rows } = parseLedger(appendRow(emptyLedger(), row()));
    expect(learningSignals(rows, { recentScores: [7, 4, 3, 2] }).lowScoreStreak).toBe(true);
    expect(learningSignals(rows, { recentScores: [7, 4, 6] }).lowScoreStreak).toBe(false);
  });

  it('detects a blocked-eval streak', () => {
    let l = emptyLedger();
    for (let i = 0; i < 5; i++) l = appendRow(l, row({ evaluated: 'blocked', verdict: 'INCONCLUSIVE' }));
    const { rows } = parseLedger(l);
    expect(learningSignals(rows).blockedEvalStreak).toBe(true);
  });

  it('is not stale by default (no `today` supplied)', () => {
    const { rows } = parseLedger(appendRow(emptyLedger(), row({ date: '2026-08-01' })));
    const s = learningSignals(rows);
    expect(s.lastRowDate).toBe('2026-08-01');
    expect(s.daysSinceLastRow).toBeNull();
    expect(s.ledgerStale).toBe(false);
  });

  it('flags a ledger stale once real nights have passed since the last row', () => {
    // The observed real-world shape: main's ledger stopped at 2026-08-26 while
    // the nightly cron kept opening (unmerged) PRs for six more days.
    const { rows } = parseLedger(appendRow(emptyLedger(), row({ date: '2026-08-26' })));
    const s = learningSignals(rows, { today: '2026-09-01' });
    expect(s.daysSinceLastRow).toBe(6);
    expect(s.ledgerStale).toBe(true);
  });

  it('is not stale the same day, or one day later, by default threshold', () => {
    const { rows } = parseLedger(appendRow(emptyLedger(), row({ date: '2026-08-26' })));
    expect(learningSignals(rows, { today: '2026-08-26' }).ledgerStale).toBe(false);
    expect(learningSignals(rows, { today: '2026-08-27' }).ledgerStale).toBe(false);
    expect(learningSignals(rows, { today: '2026-08-28' }).ledgerStale).toBe(true);
  });

  it('takes the newest valid date across rows, ignoring an unparseable one', () => {
    let l = appendRow(emptyLedger(), row({ date: '2026-08-20' }));
    l = appendRow(l, row({ date: 'yesterday' }));
    l = appendRow(l, row({ date: '2026-08-25' }));
    const { rows } = parseLedger(l);
    const s = learningSignals(rows, { today: '2026-08-25' });
    expect(s.lastRowDate).toBe('2026-08-25');
    expect(s.ledgerStale).toBe(false);
  });

  it('has no staleness signal on an empty ledger', () => {
    const s = learningSignals([], { today: '2026-08-25' });
    expect(s.lastRowDate).toBeNull();
    expect(s.daysSinceLastRow).toBeNull();
    expect(s.ledgerStale).toBe(false);
  });

  it('counts pending (still-open PR) findings toward duplicateDirections', () => {
    // Only 1 merged row + 2 pending (open, unmerged) PR findings sharing the
    // same opening words — none alone would cross the >= 3 threshold from
    // rows or pendingFindings in isolation, but together they should.
    const { rows } = parseLedger(
      appendRow(emptyLedger(), row({ finding: 'zero merge streak reported false when pr merged' })),
    );
    const s = learningSignals(rows, {
      pendingFindings: [
        'zero merge streak reported false when cli lacks ground truth',
        'zero merge streak reported false when tui lacks a flag',
      ],
    });
    expect(s.duplicateDirections.some((d) => d.includes('zero merge streak'))).toBe(true);
  });

  it('does not flag duplicates from pendingFindings alone below threshold', () => {
    const { rows } = parseLedger(emptyLedger());
    const s = learningSignals(rows, {
      pendingFindings: ['zero merge streak reported false when pr merged'],
    });
    expect(s.duplicateDirections).toEqual([]);
  });

  it('omitting pendingFindings leaves duplicateDirections unchanged (default behavior)', () => {
    let l = emptyLedger();
    for (let i = 0; i < 3; i++) l = appendRow(l, row({ finding: 'improve router calibration loop' }));
    const { rows } = parseLedger(l);
    expect(learningSignals(rows).duplicateDirections).toEqual(learningSignals(rows, {}).duplicateDirections);
  });

  describe('distinctDatesInWindow', () => {
    it('equals nightsConsidered when every windowed row has a distinct date', () => {
      let l = emptyLedger();
      for (let i = 0; i < 5; i++) l = appendRow(l, row({ date: `2026-08-${String(i + 1).padStart(2, '0')}` }));
      const { rows } = parseLedger(l);
      const s = learningSignals(rows, { window: 5 });
      expect(s.nightsConsidered).toBe(5);
      expect(s.distinctDatesInWindow).toBe(5);
    });

    it('is smaller than nightsConsidered when a date is re-appended (the observed real-ledger shape)', () => {
      let l = emptyLedger();
      l = appendRow(l, row({ date: '2026-08-27', pr: 'portfolio draft' }));
      l = appendRow(l, row({ date: '2026-08-27', pr: '#37' })); // re-appended once the real PR number was known
      l = appendRow(l, row({ date: '2026-08-28' }));
      const { rows } = parseLedger(l);
      const s = learningSignals(rows, { window: 3 });
      expect(s.nightsConsidered).toBe(3);
      expect(s.distinctDatesInWindow).toBe(2);
    });

    it('ignores unparseable dates, same as lastRowDate', () => {
      let l = emptyLedger();
      l = appendRow(l, row({ date: '2026-08-20' }));
      l = appendRow(l, row({ date: 'yesterday' }));
      const { rows } = parseLedger(l);
      const s = learningSignals(rows, { window: 2 });
      expect(s.nightsConsidered).toBe(2);
      expect(s.distinctDatesInWindow).toBe(1);
    });

    it('is 0 on an empty ledger', () => {
      const s = learningSignals([]);
      expect(s.distinctDatesInWindow).toBe(0);
    });

    it('matches a frozen snapshot of the real ledger: last 14 rows cover fewer than 14 distinct dates', () => {
      // Fixture: docs/dream-cycle/LEDGER.md as it stood on 2026-09-21, frozen
      // into __fixtures__ rather than read from the live path — that file
      // gains a new row every night this pipeline runs, which would silently
      // shift this window and break an exact-value assertion. The frozen
      // snapshot re-appends several nights (2026-08-27, -28, -29, -30) once
      // their real PR number became known, so nightsConsidered=14 has always
      // overstated real calendar-night coverage — this is the bug this field
      // surfaces, pinned against real (not synthetic) production data.
      const md = readFileSync(join(import.meta.dirname, '__fixtures__/2026-09-21-ledger-snapshot.md'), 'utf8');
      const { rows } = parseLedger(md);
      const s = learningSignals(rows);
      expect(s.nightsConsidered).toBe(14);
      expect(s.distinctDatesInWindow).toBeLessThan(s.nightsConsidered);
      expect(s.distinctDatesInWindow).toBe(11);
    });

    it('never exceeds nightsConsidered, against the live ledger path (invariant, not a pinned value)', () => {
      // Companion to the frozen-snapshot test above: this one reads the live,
      // nightly-growing docs/dream-cycle/LEDGER.md and asserts only the
      // invariant that holds for any content, so it stays green as the real
      // ledger keeps changing.
      const md = readFileSync(join(import.meta.dirname, '../../../docs/dream-cycle/LEDGER.md'), 'utf8');
      const { rows } = parseLedger(md);
      const s = learningSignals(rows);
      expect(s.distinctDatesInWindow).toBeLessThanOrEqual(s.nightsConsidered);
    });
  });
});

describe('verdictStats', () => {
  it('counts verdicts', () => {
    let l = emptyLedger();
    l = appendRow(l, row({ verdict: 'ACCEPT' }));
    l = appendRow(l, row({ verdict: 'REJECT' }));
    l = appendRow(l, row({ verdict: 'INCONCLUSIVE' }));
    l = appendRow(l, row({ verdict: 'INCONCLUSIVE' }));
    const s = verdictStats(parseLedger(l).rows);
    expect(s).toEqual({ ACCEPT: 1, REJECT: 1, INCONCLUSIVE: 2, other: 0 });
  });
});
