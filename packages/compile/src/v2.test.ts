import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  compile,
  validateConfig,
  defaultConfig,
  ROUTINE_CONSTITUTION,
  SELF_REVIEW_SURFACE,
  CONSOLIDATE_MARKER,
  type DreamConfig,
} from './index.js';

const v1: DreamConfig = defaultConfig('acme/widget');
const v2: DreamConfig = {
  ...v1,
  researchDepth: { minPrimarySources: 8, minRecentSources: 3, externalCandidates: 2 },
  implementationTrack: { reviewBacklogLimit: 6 },
  selfReview: { everyDays: 7 },
  prMode: 'ready-on-accept',
};

describe('v2 validation', () => {
  it('accepts a full v2 config', () => {
    expect(validateConfig(v2)).toMatchObject({ ok: true });
  });

  it.each([
    [{ researchDepth: { minPrimarySources: 0, minRecentSources: 0, externalCandidates: 0 } }, /minPrimarySources/],
    [{ researchDepth: { minPrimarySources: 3, minRecentSources: 4, externalCandidates: 0 } }, /minRecentSources/],
    [{ researchDepth: { minPrimarySources: 3, minRecentSources: 1, externalCandidates: 6 } }, /externalCandidates/],
    [{ researchDepth: { minPrimarySources: 3, minRecentSources: 1, externalCandidates: 1, extra: 1 } }, /unknown fields: extra/],
    [{ researchDepth: 'deep' }, /researchDepth must be an object/],
    [{ implementationTrack: { reviewBacklogLimit: 0 } }, /reviewBacklogLimit/],
    [{ implementationTrack: { reviewBacklogLimit: 2.5 } }, /reviewBacklogLimit/],
    [{ selfReview: { everyDays: 1 } }, /everyDays/],
    [{ selfReview: [] }, /selfReview must be an object/],
    [{ prMode: 'auto-merge' }, /prMode/],
    [{ scheduleContract: 'yes' }, /scheduleContract must be a boolean/],
    [{ selfReview: { everyDays: 7, configSource: 'not a source' } }, /configSource/],
    [{ selfReview: { everyDays: 7, configSource: 'a/b:x`y' } }, /configSource/],
    [{ branchPrefix: 'dream/$(id)' }, /branchPrefix may contain only/],
    [{ branchPrefix: "dream/'x" }, /branchPrefix may contain only/],
  ])('rejects %j', (patch, msg) => {
    const r = validateConfig({ ...v1, ...(patch as Partial<DreamConfig>) });
    expect(r.ok).toBe(false);
    expect(r.errors.join('\n')).toMatch(msg);
  });
});

describe('v2 compile', () => {
  const p = compile(v2);

  it('is opt-in: a v1 config compiles without any v2 section', () => {
    const p1 = compile(v1);
    for (const marker of ['STEP 1.5', 'STEP 1.6', 'PASS 3, ATTACK', 'gh pr ready', 'protected']) {
      expect(p1).not.toContain(marker);
    }
    expect(compile({ ...v1, prMode: 'draft' })).toBe(p1);
    expect(compile({ ...v1, scheduleContract: false })).toBe(p1);
    expect(p1).not.toContain('# SCHEDULE CONTRACT');
  });

  it('is deterministic', () => {
    expect(compile(v2)).toBe(p);
  });

  it('renders the research floors, delta, attack pass and external-candidate quota', () => {
    expect(p).toContain('at least 8 distinct primary sources');
    expect(p).toContain('At least 3\nmust be dated within 12 months');
    expect(p).toContain('SOTA delta');
    expect(p).toContain('PASS 3, ATTACK');
    expect(p).toContain('At least 2\nmust import a technique');
    expect(p).not.toContain('research < half the total');
  });

  it('orders modes CONSOLIDATE > RESEARCH-ONLY > IMPLEMENT > RESEARCH with the configured limit', () => {
    const i = (s: string) => p.indexOf(s);
    expect(p).toContain('open candidate PRs ≥ 6');
    expect(i('**CONSOLIDATE**')).toBeLessThan(i('**RESEARCH-ONLY**'));
    expect(i('**RESEARCH-ONLY**')).toBeLessThan(i('**IMPLEMENT**'));
    expect(i('**IMPLEMENT**')).toBeLessThan(i('4. **RESEARCH**'));
    expect(p).toContain('--open-count');
  });

  // Reviewer findings: CONSOLIDATE must make progress, never mark a
  // self-review PR ready, use the full ready predicate, and never fall through
  // to opening a new PR while the queue is over the limit.
  it('constrains CONSOLIDATE eligibility, progress and the ready predicate', () => {
    expect(p).toContain("still a draft, verdict ACCEPT in the PR's own Evaluation");
    expect(p).toContain("posted by this routine's own account");
    expect(p).toContain(`\`${SELF_REVIEW_SURFACE}\` PR`);
    expect(p).toContain(`<!-- ${CONSOLIDATE_MARKER}: <default-branch SHA> -->`);
    expect(p).toContain('run a fresh\n   independent critic and reward-hack check');
    expect(p).toContain('Never close and never merge.');
    expect(p).toContain('open no PR');
    expect(p).not.toContain('fall through to IMPLEMENT');
  });

  it('single-quotes the branch prefix in the gh search', () => {
    expect(p).toContain("--search 'head:dream/'");
  });

  it('gives self-review explicit precedence over MODE', () => {
    expect(p).toContain("takes precedence over\nSTEP 1.5's MODE");
  });

  it('retitles the publish step for ready-on-accept only', () => {
    expect(p).toContain('PUSH → PR → LEDGER');
    expect(compile(v1)).toContain('PUSH → DRAFT PR → LEDGER');
  });

  it('schedules the self-review night and lists the full constitution', () => {
    expect(p).toContain(`EPOCHDAY % 7 == 0\` → DEEP=${SELF_REVIEW_SURFACE}`);
    expect(p).not.toContain('DAYINT % 7');
    for (const c of ROUTINE_CONSTITUTION) expect(p).toContain(`- ${c}`);
    expect(p).toContain('Score the last forecast first');
  });

  it('marks ready only on ACCEPT and keeps self-review PRs draft', () => {
    expect(p).toContain('Only when VERDICT=ACCEPT');
    expect(p).toContain('gh pr ready');
    expect(p).not.toContain('even a significant result stays draft');
  });

  it('renders the schedule contract when enabled', () => {
    const pc = compile({ ...v2, scheduleContract: true });
    expect(pc).toContain('# SCHEDULE CONTRACT');
    expect(pc).toContain('dream/<DATE>-*');
    expect(pc).toContain('/tmp/schedule-receipts.jsonl');
  });

  it('routes an external self-review to a proposal PR in the target repo', () => {
    const pe = compile({ ...v2, selfReview: { everyDays: 7, configSource: 'ruvnet/dream-machine:targets/a.dream.json' } });
    expect(pe).toContain('lives outside this checkout');
    expect(pe).toContain('docs/dream-cycle/self-review/<DATE>.md');
    expect(p).not.toContain('lives outside this checkout');
  });

  it('puts the v2 knobs a self-review could abuse into the constitution', () => {
    const c = ROUTINE_CONSTITUTION.join('\n');
    for (const k of ['prMode', 'reviewBacklogLimit', 'everyDays', 'never lowered', 'never force-push', 'v2.test.ts']) {
      expect(c).toContain(k);
    }
  });

  // The v2 sections add obligations; they must never drop a v1 safety line.
  it('preserves every v1 invariant line', () => {
    for (const line of [
      'Never merge.',
      'Never\nself-promote a candidate',
      'Never weaken tests or benchmarks',
      'evaluation is not promotion',
      'Assign an INDEPENDENT critic',
      'unresolved reward-hacking',
      'The session never self-merges',
      'STEP 25 (ledger update) always',
      'never fabricate',
    ]) {
      expect(p).toContain(line);
    }
  });
});

// Tripwire for the constitution's "floors may be raised, never lowered": a
// self-review night that lowers this repo's floors must also edit this file,
// which the constitution lists, so the change is REJECT and visible in review.
describe('self-hosted v2 floors (ADR-0011 baseline)', () => {
  const self: DreamConfig = JSON.parse(readFileSync(join(process.cwd(), 'dream.config.json'), 'utf8'));
  it('keeps research floors at or above 8/3/2', () => {
    expect(self.researchDepth?.minPrimarySources).toBeGreaterThanOrEqual(8);
    expect(self.researchDepth?.minRecentSources).toBeGreaterThanOrEqual(3);
    expect(self.researchDepth?.externalCandidates).toBeGreaterThanOrEqual(2);
  });
  it('keeps the review limit, self-review cadence and PR mode as set by a human', () => {
    expect(self.implementationTrack?.reviewBacklogLimit).toBe(6);
    expect(self.selfReview?.everyDays).toBe(7);
    expect(self.prMode).toBe('ready-on-accept');
    expect(self.autoMerge).toBe(false);
  });
});
