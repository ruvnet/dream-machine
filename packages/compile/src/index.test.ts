import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { compile, validateConfig, defaultConfig, withDefaults, type DreamConfig } from './index.js';

const metaharness: DreamConfig = {
  repo: 'ruvnet/metaharness',
  cron: '0 8 * * *',
  slots: [
    { deep: 'generator-genome', scan: ['router', 'turn-credit'] },
    { deep: 'flywheel-promotion', scan: ['evals-verticals', 'bench'] },
    { deep: 'darwin-evolution', scan: ['weight-eft', 'learn'] },
    { deep: 'security-adversarial', scan: ['sbom', 'policy'] },
    { deep: 'host-adapters', scan: ['kernel', 'sdk'] },
  ],
  bonusModuli: { '25': 'vertical-packs', '75': 'meta-proxy' },
  buildStep: { cmd: 'npm ci && npm run build', degradeOnWasmFailure: true },
  evaluatorEntrypoints: { bench: 'experiments/*/run.mjs' },
  adrConvention: '3-digit',
  competitors: ['LangGraph', 'AutoGen', 'DSPy/GEPA', 'SWE-bench derivatives'],
  extraDisciplines: ['adr-250-proof-ladder'],
};

describe('validateConfig', () => {
  it('accepts a well-formed config', () => {
    expect(validateConfig(metaharness).ok).toBe(true);
  });
  it('rejects a bad repo', () => {
    expect(validateConfig({ ...metaharness, repo: 'nope' }).ok).toBe(false);
  });
  it('rejects a bad cron', () => {
    expect(validateConfig({ ...metaharness, cron: 'nightly' }).ok).toBe(false);
  });
  it('rejects empty slots', () => {
    const r = validateConfig({ ...metaharness, slots: [] });
    expect(r.ok).toBe(false);
    expect(r.errors.join()).toMatch(/slot/);
  });
  it('rejects a non-integer bonus modulus key', () => {
    expect(validateConfig({ ...metaharness, bonusModuli: { x: 'y' } }).ok).toBe(false);
  });
});

describe('compile', () => {
  const prompt = compile(metaharness);

  it('throws on an invalid config', () => {
    expect(() => compile({ ...metaharness, repo: '' })).toThrow(/invalid dream.config/);
  });

  it('is deterministic (same input → identical output)', () => {
    expect(compile(metaharness)).toBe(prompt);
  });

  it('injects the target repo everywhere it matters', () => {
    expect(prompt).toContain('ruvnet/metaharness');
    expect(prompt).toContain('cron `0 8 * * *`');
  });

  it('contains every rotation slot and its scans', () => {
    for (const s of metaharness.slots) {
      expect(prompt).toContain(`DEEP=${s.deep}`);
      expect(prompt).toContain((s.scan as string[]).join(','));
    }
    expect(prompt).toContain('SLOT=$(( DAYINT % 5 ))');
  });

  it('injects bonus moduli', () => {
    expect(prompt).toContain('DAYINT % 25 == 0');
    expect(prompt).toContain('vertical-packs');
  });

  it('injects competitors, build step, evaluator, extra discipline', () => {
    expect(prompt).toContain('DSPy/GEPA');
    expect(prompt).toContain('npm ci && npm run build');
    expect(prompt).toContain('experiments/*/run.mjs');
    expect(prompt).toContain('adr-250-proof-ladder');
  });

  it('uses the 3-digit ADR convention when configured', () => {
    expect(prompt).toContain('ADR-00N'); // pad 3 → two zeros + N
    expect(prompt).toContain('3-digit padding');
  });

  it('carries the load-bearing invariants verbatim', () => {
    expect(prompt).toContain('ACCEPT | REJECT | INCONCLUSIVE');
    expect(prompt).toContain('evaluation is not promotion');
    expect(prompt).toContain('never self-merges');
    expect(prompt).toMatch(/WITNESS=\$\(printf/);
    expect(prompt).toContain('| Date | Deep | Finding | Issue | PR | Evaluated? | Verdict | Effect | Witness | Prior-night fates |');
  });

  it('contains every pipeline step marker', () => {
    for (const marker of ['STEP 0:', 'STEP 0.5', 'STEP 0.6', 'STEP 1:', 'STEP 1.1', 'STEP 2:', 'STEP 3:', 'STEP 5–9', 'STEP 10–14', 'STEP 15', 'STEP 16', 'STEP 17', 'STEP 19', 'STEP 20', 'STEP 26', 'STOP CONDITIONS', 'FINAL REPORT', 'FINAL OPERATING PRINCIPLE']) {
      expect(prompt).toContain(marker);
    }
  });

  it('describes human-review-only merge policy by default', () => {
    expect(prompt).toContain('Human review required');
    expect(prompt).not.toContain('guarded auto-merge ENABLED');
  });

  it('describes GUARDED auto-merge only when enabled', () => {
    const p = compile({ ...metaharness, autoMerge: true });
    expect(p).toContain('guarded auto-merge ENABLED');
    expect(p).toContain('explicit low-risk label');
    // Even with auto-merge, the session itself never merges.
    expect(p).toContain('session itself still never runs the merge');
  });

  it('emits a 4-digit ADR example for a default config', () => {
    const p = compile(defaultConfig('acme/widget'));
    expect(p).toContain('ADR-000N');
    expect(p).toContain('4-digit padding');
  });

  it('golden-snapshot: metaharness prompt is stable', () => {
    expect(prompt).toMatchSnapshot();
  });
});

describe('defaults', () => {
  it('withDefaults fills ledger path, branch prefix, labels', () => {
    const c = withDefaults(defaultConfig('a/b'));
    expect(c.ledgerPath).toBe('docs/dream-cycle/LEDGER.md');
    expect(c.branchPrefix).toBe('dream/');
    expect(c.labels).toContain('dream-cycle');
  });
});

// This repo self-hosts: its own dream.config.json is what STEP B of every
// nightly run actually compiles. Every other test above exercises a
// synthetic fixture — none of them would catch a regression that broke this
// repo's real, committed config. Read it the same way `dream-machine compile
// dream.config.json` does, and golden-snapshot it.
describe('self-hosted config (ruvnet/dream-machine)', () => {
  const selfConfig: DreamConfig = JSON.parse(
    readFileSync(join(process.cwd(), 'dream.config.json'), 'utf8'),
  );

  it('validates', () => {
    expect(validateConfig(selfConfig).ok).toBe(true);
  });

  it('resolves autoMerge: true (the one config in the wild that enables it)', () => {
    expect(withDefaults(selfConfig).autoMerge).toBe(true);
  });

  it('compiles deterministically', () => {
    expect(compile(selfConfig)).toBe(compile(selfConfig));
  });

  it('golden-snapshot: ruvnet/dream-machine prompt is stable', () => {
    expect(compile(selfConfig)).toMatchSnapshot();
  });
});
