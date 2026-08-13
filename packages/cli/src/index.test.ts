import { describe, it, expect } from 'vitest';
import { run, parseArgs, VERSION, type IO } from './index.js';
import { renderDashboard } from './tui.js';
import { appendRow, emptyLedger, type LedgerRow } from '@dream-machine/ledger';
import { stamp } from '@dream-machine/witness';

function mockIO(files: Record<string, string> = {}): IO & { files: Record<string, string> } {
  const store = { ...files };
  return {
    files: store,
    readFile: async (p) => {
      if (!(p in store)) throw new Error(`ENOENT ${p}`);
      return store[p];
    },
    writeFile: async (p, c) => {
      store[p] = c;
    },
    now: () => '2026-08-13',
    env: {},
  };
}

const sampleRow = (o: Partial<LedgerRow> = {}): LedgerRow => ({
  date: '2026-08-13',
  deep: 'security-adversarial',
  finding: 'add indirect prompt injection',
  issue: '#180',
  pr: '#181',
  evaluated: 'yes',
  verdict: 'ACCEPT',
  effect: 'n=6',
  witness: '398c71a6',
  priorFates: '-',
  ...o,
});

describe('parseArgs', () => {
  it('parses positionals, --k v, --k=v, and bare flags', () => {
    const { _, flags } = parseArgs(['compile', 'a.json', '--out', 'x.md', '--env=e1', '--no-color']);
    expect(_).toEqual(['compile', 'a.json']);
    expect(flags.out).toBe('x.md');
    expect(flags.env).toBe('e1');
    expect(flags['no-color']).toBe(true);
  });
});

describe('help / version', () => {
  it('help with no args', async () => {
    const r = await run([], mockIO());
    expect(r.code).toBe(0);
    expect(r.out).toContain('dream-machine');
    expect(r.out).toContain('never merges');
  });
  it('version', async () => {
    const r = await run(['version'], mockIO());
    expect(r.out.trim()).toBe(VERSION);
  });
  it('unknown command exits 1', async () => {
    const r = await run(['frobnicate'], mockIO());
    expect(r.code).toBe(1);
    expect(r.err).toContain('unknown command');
  });
});

describe('init', () => {
  it('prints a config to stdout', async () => {
    const r = await run(['init', '--repo', 'acme/widget'], mockIO());
    expect(r.code).toBe(0);
    expect(JSON.parse(r.out).repo).toBe('acme/widget');
  });
  it('writes a config file', async () => {
    const io = mockIO();
    const r = await run(['init', '--repo', 'acme/widget', '--out', 'dream.config.json'], io);
    expect(r.code).toBe(0);
    expect(JSON.parse(io.files['dream.config.json']).repo).toBe('acme/widget');
  });
});

describe('compile', () => {
  it('compiles a config to a prompt', async () => {
    const io = mockIO();
    await run(['init', '--repo', 'acme/widget', '--out', 'c.json'], io);
    const r = await run(['compile', 'c.json'], io);
    expect(r.code).toBe(0);
    expect(r.out).toContain('nightly routine for `acme/widget`');
  });
  it('writes compiled prompt to --out', async () => {
    const io = mockIO();
    await run(['init', '--repo', 'a/b', '--out', 'c.json'], io);
    const r = await run(['compile', 'c.json', '--out', 'PROMPT.md'], io);
    expect(r.code).toBe(0);
    expect(io.files['PROMPT.md']).toContain('GLOBAL INVARIANTS');
  });
  it('rejects an invalid config', async () => {
    const io = mockIO({ 'bad.json': JSON.stringify({ repo: 'nope' }) });
    const r = await run(['compile', 'bad.json'], io);
    expect(r.code).toBe(1);
    expect(r.err).toContain('invalid config');
  });
});

describe('schedule', () => {
  it('emits routine JSON', async () => {
    const io = mockIO();
    await run(['init', '--repo', 'a/b', '--out', 'c.json'], io);
    const r = await run(['schedule', 'c.json', '--env', 'env_1'], io);
    expect(r.code).toBe(0);
    const body = JSON.parse(r.out);
    expect(body.job_config.ccr.environment_id).toBe('env_1');
  });
});

describe('ledger', () => {
  const ledgerMd = appendRow(appendRow(emptyLedger(), sampleRow()), sampleRow({ date: '2026-08-14', verdict: 'REJECT' }));

  it('verify OK', async () => {
    const r = await run(['ledger', 'verify', '--path', 'L.md'], mockIO({ 'L.md': ledgerMd }));
    expect(r.code).toBe(0);
    expect(r.out).toContain('ledger OK');
  });
  it('verify flags a bad verdict', async () => {
    const bad = appendRow(emptyLedger(), sampleRow({ verdict: 'MAYBE' }));
    const r = await run(['ledger', 'verify', '--path', 'L.md'], mockIO({ 'L.md': bad }));
    expect(r.code).toBe(1);
    expect(r.err).toContain('verdict');
  });
  it('stats', async () => {
    const r = await run(['ledger', 'stats', '--path', 'L.md'], mockIO({ 'L.md': ledgerMd }));
    expect(JSON.parse(r.out).ACCEPT).toBe(1);
    expect(JSON.parse(r.out).REJECT).toBe(1);
  });
  it('signals', async () => {
    const r = await run(['ledger', 'signals', '--path', 'L.md'], mockIO({ 'L.md': ledgerMd }));
    expect(JSON.parse(r.out)).toHaveProperty('zeroMergeStreak');
  });
  it('append writes a row (bootstraps ledger if missing)', async () => {
    const io = mockIO();
    const r = await run(
      ['ledger', 'append', '--path', 'L.md', '--deep', 'perf', '--finding', 'x', '--verdict', 'INCONCLUSIVE'],
      io,
    );
    expect(r.code).toBe(0);
    expect(io.files['L.md']).toContain('| perf |');
  });
});

describe('witness', () => {
  it('stamp prints the triple', async () => {
    const io = mockIO({ 'r.md': 'report body' });
    const r = await run(['witness', 'stamp', 'r.md', '68402755f017e0df5f493c6ee608218420540d17'], io);
    expect(r.code).toBe(0);
    expect(r.out).toContain('witness       :');
  });
  it('verify accepts a genuine stamp and rejects a forgery', async () => {
    const report = 'genuine report';
    const commit = '68402755f017e0df5f493c6ee608218420540d17';
    const w = stamp(report, commit);
    const io = mockIO({ 'r.md': report });
    const ok = await run(['witness', 'verify', 'r.md', commit, w.witness], io);
    expect(ok.code).toBe(0);
    const bad = await run(['witness', 'verify', 'r.md', commit, 'a'.repeat(64)], io);
    expect(bad.code).toBe(1);
    expect(bad.err).toContain('INVALID');
  });
});

describe('verify-entrypoint', () => {
  function mockIOWithExec(exec: IO['exec']): IO {
    return { ...mockIO(), exec };
  }

  it('reports live for a command that produces output and exits 0', async () => {
    const io = mockIOWithExec(async () => ({ code: 0, stdout: 'ok', stderr: '' }));
    const r = await run(['verify-entrypoint', 'bench', '--cmd', 'npm test'], io);
    expect(r.code).toBe(0);
    expect(r.out).toContain('bench: live');
  });

  it('reports blocked for a nonzero exit', async () => {
    const io = mockIOWithExec(async () => ({
      code: 1,
      stdout: '',
      stderr: 'npm error could not determine executable to run',
    }));
    const r = await run(['verify-entrypoint', 'flywheel', '--cmd', 'npx @metaharness/flywheel'], io);
    expect(r.code).toBe(1);
    expect(r.out).toContain('flywheel: blocked');
  });

  it('reports suspicious-silent (not live) for exit 0 with no output', async () => {
    const io = mockIOWithExec(async () => ({ code: 0, stdout: '', stderr: '' }));
    const r = await run(['verify-entrypoint', 'redblue', '--cmd', 'npx @metaharness/redblue'], io);
    expect(r.code).toBe(2);
    expect(r.out).toContain('redblue: suspicious-silent');
    expect(r.out).toContain('do not record EVALUATED=yes');
  });

  it('errors without --cmd', async () => {
    const io = mockIOWithExec(async () => ({ code: 0, stdout: '', stderr: '' }));
    const r = await run(['verify-entrypoint', 'redblue'], io);
    expect(r.code).toBe(1);
    expect(r.err).toContain('usage:');
  });

  it('rejects an unquoted multi-word --cmd instead of silently truncating it', async () => {
    // Regression test: `verify-entrypoint redblue --cmd npx @metaharness/redblue` (no
    // quotes/`=`) used to let --cmd absorb only "npx" and silently drop
    // "@metaharness/redblue" as a stray positional — running bare `npx` (which prints its
    // own usage text and exits 0) then misreported a false "live" verdict for the exact
    // silent-failure this tool exists to catch.
    const io = mockIOWithExec(async () => ({ code: 0, stdout: 'npx usage text', stderr: '' }));
    const r = await run(['verify-entrypoint', 'redblue', '--cmd', 'npx', '@metaharness/redblue'], io);
    expect(r.code).toBe(1);
    expect(r.err).toContain('unexpected extra argument');
    expect(r.out).not.toContain('live');
  });

  it('errors when the IO has no exec()', async () => {
    const r = await run(['verify-entrypoint', 'redblue', '--cmd', 'echo hi'], mockIO());
    expect(r.code).toBe(1);
    expect(r.err).toContain('no exec()');
  });
});

describe('tui', () => {
  it('renders a dashboard from a ledger', async () => {
    const md = appendRow(emptyLedger(), sampleRow());
    const r = await run(['tui', '--path', 'L.md', '--no-color'], mockIO({ 'L.md': md }));
    expect(r.code).toBe(0);
    expect(r.out).toContain('DREAM MACHINE');
    expect(r.out).toContain('security-adversarial');
    expect(r.out).toContain('never merges');
  });
  it('renderDashboard handles an empty ledger', () => {
    const frame = renderDashboard(emptyLedger(), { noColor: true });
    expect(frame).toContain('no dream nights yet');
  });
  it('shows a zero-merge warning', () => {
    let md = emptyLedger();
    for (let i = 0; i < 14; i++) md = appendRow(md, sampleRow({ pr: `#${i}`, verdict: 'INCONCLUSIVE' }));
    const frame = renderDashboard(md, { noColor: true });
    expect(frame).toContain('zero merges');
  });
});
