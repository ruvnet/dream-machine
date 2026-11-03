import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join, basename } from 'node:path';
import { compile, validateConfig, type DreamConfig } from './index.js';

// Every dream cycle the portfolio runs, compiled by one engine. A change to the
// template shows up as a snapshot diff for every target at once, and a stale
// committed mirror (what gets pasted into the scheduler) fails here.
const root = process.cwd();
const targets: Array<[string, string]> = [
  ['ruvnet-dream-machine', 'dream.config.json'],
  ...readdirSync(join(root, 'targets'))
    .filter((f) => f.endsWith('.dream.json'))
    .sort()
    .map((f): [string, string] => [basename(f, '.dream.json'), join('targets', f)]),
];

const INVARIANT_LINES = [
  'Never merge.',
  'Never weaken tests or benchmarks',
  'evaluation is not promotion',
  'Assign an INDEPENDENT critic',
  'STEP 25 (ledger update) always',
  'The session never self-merges',
  '# SCHEDULE CONTRACT',
  'SKIP: already ran',
  'PASS 3, ATTACK',
  'STEP 1.5: MODE SELECTION',
  'STEP 1.6: ROUTINE SELF-REVIEW NIGHT',
];

describe.each(targets)('dream cycle %s', (name, file) => {
  const config: DreamConfig = JSON.parse(readFileSync(join(root, file), 'utf8'));
  const prompt = compile(config);

  it('validates', () => {
    expect(validateConfig(config)).toMatchObject({ ok: true, errors: [] });
  });

  it('carries every invariant and v2 section', () => {
    for (const line of INVARIANT_LINES) expect(prompt).toContain(line);
  });

  it('pins all npx tooling', () => {
    expect(prompt).not.toContain('Supply-chain warning');
    expect(config.autoMerge).toBe(false);
  });

  it('points an external self-review at its own config file', () => {
    if (name === 'ruvnet-dream-machine') {
      expect(config.selfReview?.configSource).toBeUndefined();
    } else {
      expect(config.selfReview?.configSource).toBe(`ruvnet/dream-machine:${file}`);
    }
  });

  it('matches its committed mirror', () => {
    const mirror = readFileSync(join(root, 'docs/dream-cycle/compiled', `${name}.md`), 'utf8');
    expect(mirror).toBe(prompt);
  });

  it('golden-snapshot', () => {
    expect(prompt).toMatchSnapshot();
  });
});
