import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  outcomeMetrics,
  implementationBacklog,
  parseLedger,
  type LedgerRow,
  type PrFate,
} from './index.js';

function row(over: Partial<LedgerRow> = {}): LedgerRow {
  return {
    date: '2026-10-01',
    deep: 'compiler-parity',
    finding: 'some finding',
    issue: '#1',
    pr: '#2',
    evaluated: 'yes',
    verdict: 'ACCEPT',
    effect: '',
    witness: 'abcd1234',
    priorFates: '',
    ...over,
  };
}

const fates = (o: Record<string, PrFate>) => new Map(Object.entries(o));

describe('outcomeMetrics', () => {
  it('counts nights by distinct date and PRs once each (last row wins)', () => {
    const rows = [
      row({ date: '2026-10-01', pr: '#10', verdict: 'INCONCLUSIVE' }),
      row({ date: '2026-10-01', pr: '#10', verdict: 'ACCEPT' }), // re-appended night
      row({ date: '2026-10-02', pr: '#11', verdict: 'ACCEPT' }),
      row({ date: '2026-10-03', pr: 'NONE', evaluated: 'no', verdict: 'INCONCLUSIVE' }),
    ];
    const m = outcomeMetrics(rows, fates({ '10': 'MERGED', '11': 'CLOSED' }));
    expect(m.nights).toBe(3);
    expect(m.prsTracked).toBe(2);
    expect(m.fates.MERGED).toBe(1);
    expect(m.fates.CLOSED).toBe(1);
    expect(m.mergeRate).toBe(0.5);
    expect(m.acceptMergeRate).toBe(0.5);
    expect(m.falseAcceptRate).toBe(0.5);
    expect(m.researchOnlyNights).toBe(1);
  });

  it('returns null rates when nothing is resolved and counts unknown fates', () => {
    const m = outcomeMetrics([row({ pr: '#5' }), row({ date: '2026-10-02', pr: '#6' })]);
    expect(m.mergeRate).toBeNull();
    expect(m.acceptMergeRate).toBeNull();
    expect(m.fates.UNKNOWN).toBe(2);
  });

  it('corrects survivorship bias with the open candidate count', () => {
    const rows = [row({ pr: '#1' }), row({ date: '2026-10-02', pr: '#2' })];
    const m = outcomeMetrics(rows, fates({ '1': 'MERGED', '2': 'MERGED' }), { openCandidateCount: 2 });
    expect(m.mergeRate).toBe(1);
    expect(m.reviewBacklog).toBe(2);
    expect(m.pipelineMergeRate).toBe(0.5);
    expect(outcomeMetrics(rows).pipelineMergeRate).toBeNull();
  });

  it('does not count a night as research-only when a later row for that date has a PR', () => {
    const rows = [row({ pr: 'NONE' }), row({ pr: '#9' })];
    expect(outcomeMetrics(rows).researchOnlyNights).toBe(0);
  });

  it('runs on the real committed ledger without throwing', () => {
    const md = readFileSync(join(process.cwd(), 'docs/dream-cycle/LEDGER.md'), 'utf8');
    const m = outcomeMetrics(parseLedger(md).rows);
    expect(m.nights).toBeGreaterThan(0);
    expect(m.prsTracked).toBeGreaterThan(0);
  });
});

describe('implementationBacklog', () => {
  it('collects not-evaluated, blocked and overturned-accept findings, oldest first', () => {
    const rows = [
      row({ date: '2026-10-03', finding: 'blocked idea alpha', pr: 'NONE', evaluated: 'blocked', verdict: 'INCONCLUSIVE' }),
      row({ date: '2026-10-01', finding: 'research only beta', pr: 'NONE', evaluated: 'no', verdict: 'INCONCLUSIVE' }),
      row({ date: '2026-10-02', finding: 'overturned gamma', pr: '#20', verdict: 'ACCEPT' }),
      row({ date: '2026-10-04', finding: 'merged delta', pr: '#21', verdict: 'ACCEPT' }),
    ];
    const b = implementationBacklog(rows, fates({ '20': 'CLOSED', '21': 'MERGED' }));
    expect(b.map((i) => [i.date, i.reason])).toEqual([
      ['2026-10-01', 'not-evaluated'],
      ['2026-10-02', 'accept-closed-unmerged'],
      ['2026-10-03', 'evaluation-blocked'],
    ]);
  });

  it('drops a finding once the same direction lands on a merged PR', () => {
    const rows = [
      row({ date: '2026-10-01', finding: 'harden replay evidence binding for traces', pr: 'NONE', evaluated: 'no', verdict: 'INCONCLUSIVE' }),
      row({ date: '2026-10-05', finding: 'harden replay evidence binding for traces, implemented', pr: '#30' }),
    ];
    expect(implementationBacklog(rows, fates({ '30': 'MERGED' }))).toEqual([]);
  });

  it('collapses re-appended rows for the same night and skips invalid dates', () => {
    const r = row({ finding: 'dup x', pr: 'NONE', evaluated: 'no', verdict: 'INCONCLUSIVE' });
    expect(implementationBacklog([r, { ...r }, { ...r, date: '2026-02-30' }])).toHaveLength(1);
  });

  it('treats a mode-tagged finding as the same direction as its research row', () => {
    const rows = [
      row({ date: '2026-10-01', finding: 'adopt anchored replay for trace evidence', pr: 'NONE', evaluated: 'no', verdict: 'INCONCLUSIVE' }),
      row({ date: '2026-10-06', finding: '[implement 2026-10-01] adopt anchored replay for trace evidence', pr: '#40' }),
    ];
    expect(implementationBacklog(rows, fates({ '40': 'MERGED' }))).toEqual([]);
  });

  it('excludes findings whose PR is still open or stale (in flight)', () => {
    const rows = [
      row({ date: '2026-10-01', finding: 'blocked but in flight', pr: '#50', evaluated: 'blocked', verdict: 'INCONCLUSIVE' }),
      row({ date: '2026-10-02', finding: 'stale draft finding', pr: '#51', evaluated: 'no', verdict: 'INCONCLUSIVE' }),
    ];
    expect(implementationBacklog(rows, fates({ '50': 'OPEN', '51': 'STALE' }))).toEqual([]);
    expect(implementationBacklog(rows)).toHaveLength(2);
  });

  it('ignores an evaluated REJECT (a clean negative result is not backlog)', () => {
    expect(implementationBacklog([row({ verdict: 'REJECT', pr: 'NONE' })])).toEqual([]);
  });
});
