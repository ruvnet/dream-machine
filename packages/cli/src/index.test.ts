import { describe, it, expect } from 'vitest';
import { run, parseArgs, VERSION, type IO } from './index.js';
import { renderDashboard, displayWidth, pad } from './tui.js';
import { run, parseArgs, parsePendingFindings, VERSION, type IO } from './index.js';
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

describe('parsePendingFindings', () => {
  it('splits a pipe-separated list and trims each entry', () => {
    expect(parsePendingFindings('finding one| finding two | finding three')).toEqual([
      'finding one',
      'finding two',
      'finding three',
    ]);
  });
  it('preserves commas inside a finding — real PR titles routinely contain them', () => {
    // e.g. PR #27's real title: "developer-experience: thread real merge
    // state into zero-merge learning signal (cli, tui)" — a naive
    // comma-split would fracture this into a bogus extra "finding".
    expect(parsePendingFindings('developer-experience: thread state into signal (cli, tui)')).toEqual([
      'developer-experience: thread state into signal (cli, tui)',
    ]);
  });
  it('returns undefined for absent or bare-boolean flags (no behavior change)', () => {
    expect(parsePendingFindings(undefined)).toBeUndefined();
    expect(parsePendingFindings(true)).toBeUndefined();
  });
  it('returns undefined for an empty string', () => {
    expect(parsePendingFindings('')).toBeUndefined();
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
  it('signals wires io.now() through as `today`, flagging a stale ledger', async () => {
    const io = mockIO({ 'L.md': ledgerMd }); // ledgerMd's newest row is dated 2026-08-14
    io.now = () => '2026-08-20';
    const r = await run(['ledger', 'signals', '--path', 'L.md'], io);
    const signals = JSON.parse(r.out);
    expect(signals.lastRowDate).toBe('2026-08-14');
    expect(signals.daysSinceLastRow).toBe(6);
    expect(signals.ledgerStale).toBe(true);
  });
  it('signals defaults zeroMergeStreak to a worst-case true without --merged, even for a real PR', async () => {
    const r = await run(['ledger', 'signals', '--path', 'L.md'], mockIO({ 'L.md': ledgerMd }));
    expect(JSON.parse(r.out).zeroMergeStreak).toBe(true);
  });
  it('signals reports zeroMergeStreak=false once --merged names the window\'s PR', async () => {
    const r = await run(['ledger', 'signals', '--path', 'L.md', '--merged', '181'], mockIO({ 'L.md': ledgerMd }));
    expect(JSON.parse(r.out).zeroMergeStreak).toBe(false);
  });
  it('signals --merged tolerates a leading # and surrounding whitespace in the CSV', async () => {
    const r = await run(['ledger', 'signals', '--path', 'L.md', '--merged', ' #181 , 999'], mockIO({ 'L.md': ledgerMd }));
    expect(JSON.parse(r.out).zeroMergeStreak).toBe(false);
  });
  it('signals --merged naming only an unrelated PR leaves zeroMergeStreak true', async () => {
    const r = await run(['ledger', 'signals', '--path', 'L.md', '--merged', '999'], mockIO({ 'L.md': ledgerMd }));
    expect(JSON.parse(r.out).zeroMergeStreak).toBe(true);
  });
  it('signals composes --merged with the existing `today` staleness wiring', async () => {
    const io = mockIO({ 'L.md': ledgerMd });
    io.now = () => '2026-08-20';
    const r = await run(['ledger', 'signals', '--path', 'L.md', '--merged', '181'], io);
    const signals = JSON.parse(r.out);
    expect(signals.zeroMergeStreak).toBe(false);
    expect(signals.ledgerStale).toBe(true);
  });
  it('signals rejects a value-less --merged with a clear usage error, not a crash', async () => {
    const r = await run(['ledger', 'signals', '--path', 'L.md', '--merged'], mockIO({ 'L.md': ledgerMd }));
    expect(r.code).toBe(1);
    expect(r.err).toContain('--merged expects a comma-separated PR number list');
    expect(r.err).not.toContain('is not a function');
  it('signals --pending folds in open-PR findings for duplicate-direction detection', async () => {
    const solo = appendRow(emptyLedger(), sampleRow({ finding: 'zero merge streak reported false when pr merged' }));
    const io = mockIO({ 'L.md': solo });
    const withoutPending = await run(['ledger', 'signals', '--path', 'L.md'], io);
    expect(JSON.parse(withoutPending.out).duplicateDirections).toEqual([]);
    const withPending = await run(
      [
        'ledger',
        'signals',
        '--path',
        'L.md',
        '--pending',
        'zero merge streak reported false when cli lacks it|zero merge streak reported false when tui lacks it',
      ],
      io,
    );
    expect(JSON.parse(withPending.out).duplicateDirections.some((d: string) => d.includes('zero merge streak'))).toBe(
      true,
    );
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
  it('append rejects an invalid verdict and does not write', async () => {
    const io = mockIO();
    const r = await run(
      ['ledger', 'append', '--path', 'L.md', '--deep', 'perf', '--finding', 'x', '--verdict', 'ACCEPT / INCONCLUSIVE'],
      io,
    );
    expect(r.code).toBe(1);
    expect(r.err).toContain('verdict');
    expect(io.files['L.md']).toBeUndefined();
  });
  it('append rejects an invalid evaluated value and does not write', async () => {
    const io = mockIO();
    const r = await run(
      ['ledger', 'append', '--path', 'L.md', '--deep', 'perf', '--finding', 'x', '--evaluated', 'partial'],
      io,
    );
    expect(r.code).toBe(1);
    expect(r.err).toContain('evaluated');
    expect(io.files['L.md']).toBeUndefined();
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

  it('reports stale-state (exit 3), distinct from blocked, for a leftover-state collision', async () => {
    const io = mockIOWithExec(async () => ({
      code: 1,
      stdout: '',
      stderr: 'Error: darwin: autonomous or generated child id already exists: g1_v0',
    }));
    const r = await run(['verify-entrypoint', 'darwin', '--cmd', 'npx @metaharness/darwin evolve . --sandbox mock'], io);
    expect(r.code).toBe(3);
    expect(r.out).toContain('darwin: stale-state');
  });
});

describe('self-hosted dream.config.json — darwin entrypoint contract', () => {
  it('is idempotently re-runnable: required <repo> positional present, state reset before each invocation', async () => {
    const { readFile } = await import('node:fs/promises');
    const raw = await readFile(new URL('../../../dream.config.json', import.meta.url), 'utf8');
    const config = JSON.parse(raw);
    const darwin: string = config.evaluatorEntrypoints.darwin;
    // Regression guard for the 2026-09-02 finding: `npx @metaharness/darwin evolve` requires
    // a `<repo>` positional (bare `--sandbox mock` silently consumes `--sandbox` as it), and
    // persists generation/child ids under `.metaharness/` in the target directory — a second
    // invocation in the same checkout without clearing that directory first always fails.
    expect(darwin).toMatch(/\bevolve\s+\.\s/);
    expect(darwin).toMatch(/rm\s+-rf\s+\.metaharness\s+&&/);
  });
});

describe('audit-gate', () => {
  it('exits 0 (clear) for a production-scoped report with 0 findings', async () => {
    const report = JSON.stringify({ metadata: { vulnerabilities: { info: 0, low: 0, moderate: 0, high: 0, critical: 0, total: 0 } } });
    const r = await run(['audit-gate', '--path', 'audit.json'], mockIO({ 'audit.json': report }));
    expect(r.code).toBe(0);
    expect(r.out).toContain('audit-gate: clear');
  });

  it('exits 1 (blocked) for a report with a critical finding', async () => {
    const report = JSON.stringify({ metadata: { vulnerabilities: { info: 0, low: 0, moderate: 0, high: 0, critical: 1, total: 1 } } });
    const r = await run(['audit-gate', '--path', 'audit.json'], mockIO({ 'audit.json': report }));
    expect(r.code).toBe(1);
    expect(r.out).toContain('audit-gate: blocked');
    expect(r.out).toContain('critical=1');
  });

  it('exits 2 (malformed) for unparseable JSON, never silently passing', async () => {
    const r = await run(['audit-gate', '--path', 'audit.json'], mockIO({ 'audit.json': 'not json' }));
    expect(r.code).toBe(2);
    expect(r.err).toContain('could not read/parse');
  });

  it('errors without --path', async () => {
    const r = await run(['audit-gate'], mockIO());
    expect(r.code).toBe(1);
    expect(r.err).toContain('usage:');
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
  it('shows a ledger-stale warning when `today` is far past the last row', () => {
    const md = appendRow(emptyLedger(), sampleRow({ date: '2026-08-01' }));
    const frame = renderDashboard(md, { noColor: true, today: '2026-08-20' });
    expect(frame).toContain('ledger stale');
    expect(frame).toContain('19d since last row');
  });
  it('omits the ledger-stale warning when `today` is not supplied', () => {
    const md = appendRow(emptyLedger(), sampleRow({ date: '2026-08-01' }));
    const frame = renderDashboard(md, { noColor: true });
    expect(frame).not.toContain('ledger stale');
  });
  it('tui command wires io.now() into the staleness check', async () => {
    const md = appendRow(emptyLedger(), sampleRow({ date: '2026-08-01' }));
    const io = mockIO({ 'L.md': md });
    io.now = () => '2026-08-20';
    const r = await run(['tui', '--path', 'L.md', '--no-color'], io);
    expect(r.out).toContain('ledger stale');
  });
  it('renderDashboard clears the zero-merge warning when mergedPrNumbers confirms the ledger PR merged', () => {
    const md = appendRow(emptyLedger(), sampleRow({ pr: '#181' }));
    const frame = renderDashboard(md, { noColor: true, mergedPrNumbers: new Set(['181']) });
    expect(frame).not.toContain('zero merges');
    expect(frame).toContain('signals nominal');
  });
  it('tui --merged clears the zero-merge warning end-to-end', async () => {
    const md = appendRow(emptyLedger(), sampleRow({ pr: '#181' }));
    const r = await run(['tui', '--path', 'L.md', '--no-color', '--merged', '181'], mockIO({ 'L.md': md }));
    expect(r.code).toBe(0);
    expect(r.out).not.toContain('zero merges');
  });
  it('tui rejects a value-less --merged with a clear usage error, not a crash', async () => {
    const md = appendRow(emptyLedger(), sampleRow());
    const r = await run(['tui', '--path', 'L.md', '--merged'], mockIO({ 'L.md': md }));
    expect(r.code).toBe(1);
    expect(r.err).toContain('--merged expects a comma-separated PR number list');

  it('displayWidth matches .length for plain ASCII (no regression)', () => {
    expect(displayWidth('hello world')).toBe('hello world'.length);
    expect(displayWidth('')).toBe(0);
  });

  it('displayWidth counts CJK/fullwidth code points as 2 columns', () => {
    expect(displayWidth('性能改善')).toBe(8); // 4 CJK ideographs
    expect(displayWidth('a性b')).toBe(4); // 1 + 2 + 1
  });

  it('displayWidth counts a surrogate-pair emoji as 2 columns, not 2x UTF-16 length', () => {
    const rocket = '🚀'; // U+1F680, 2 UTF-16 code units, 1 code point
    expect(rocket.length).toBe(2);
    expect(displayWidth(rocket)).toBe(2);
  });

  it('displayWidth ignores embedded ANSI SGR codes', () => {
    expect(displayWidth('\x1b[31mred\x1b[0m')).toBe(3);
  });

  it('pad does not silently drop a literal newline when truncating (regression: tokenizer must not exclude line terminators)', () => {
    // Newline sits well inside the n-1 visible-width budget, so it must survive truncation.
    const s = 'aaa' + '\n' + 'b'.repeat(20);
    const out = pad(s, 10);
    expect(out).toContain('\n');
    expect(out).toContain('…');
  });

  it('keeps every box line at identical display width when Finding contains CJK text (regression for issue #8)', () => {
    let md = emptyLedger();
    md = appendRow(md, sampleRow({ finding: '性能改善：レイテンシを削減する提案について' }));
    const frame = renderDashboard(md, { noColor: true });
    const lines = frame.split('\n');
    const widths = new Set(lines.map((l) => displayWidth(l)));
    expect(widths.size).toBe(1); // every line — including the CJK row — is the same real column width
  });

  it('truncates a long wide-character Finding to exactly the target width with a single ellipsis', () => {
    let md = emptyLedger();
    md = appendRow(md, sampleRow({ finding: '性'.repeat(40) }));
    const frame = renderDashboard(md, { noColor: true });
    const lines = frame.split('\n');
    const widths = new Set(lines.map((l) => displayWidth(l)));
    expect(widths.size).toBe(1);
    const findingLine = lines.find((l) => l.includes('…'));
    expect(findingLine).toBeDefined();
    expect(findingLine!.split('…').length - 1).toBe(1); // exactly one ellipsis
  });
});
