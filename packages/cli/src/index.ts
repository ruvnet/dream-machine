/**
 * dream-machine CLI — command dispatch.
 *
 * `run(argv)` is pure-ish: it takes args + an injectable filesystem/io surface
 * and returns an exit code + captured stdout/stderr, so every command is unit
 * testable without spawning a process. `bin.ts` wires it to the real process.
 */
import { compile, defaultConfig, validateConfig, type DreamConfig } from '@dream-machine/compile';
import {
  parseLedger,
  verifyLedger,
  appendRow,
  emptyLedger,
  learningSignals,
  verdictStats,
  type LedgerRow,
} from '@dream-machine/ledger';
import { stamp, verify, verifySteps } from '@dream-machine/witness';
import { serializeRoutine, scheduleInstructions } from '@dream-machine/schedule';
import { renderDashboard } from './tui.js';
import { classifyEntrypointResult, type ExecResult } from './entrypoint.js';

export const VERSION = '0.1.1';

export interface IO {
  readFile(path: string): Promise<string>;
  writeFile(path: string, content: string): Promise<void>;
  now(): string; // YYYY-MM-DD
  env: Record<string, string | undefined>;
  /** Run a shell command and capture its result. Optional: not every IO needs it. */
  exec?(cmd: string): Promise<ExecResult>;
}

export interface RunResult {
  code: number;
  out: string;
  err: string;
}

function makeSink() {
  let out = '';
  let err = '';
  return {
    log: (s = '') => {
      out += s + '\n';
    },
    error: (s = '') => {
      err += s + '\n';
    },
    get out() {
      return out;
    },
    get err() {
      return err;
    },
  };
}

/** Minimal flag parser: --key val, --key=val, --bool, positionals. */
export function parseArgs(argv: string[]): { _: string[]; flags: Record<string, string | boolean> } {
  const _: string[] = [];
  const flags: Record<string, string | boolean> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const eq = a.indexOf('=');
      if (eq !== -1) {
        flags[a.slice(2, eq)] = a.slice(eq + 1);
      } else {
        const next = argv[i + 1];
        if (next && !next.startsWith('--')) {
          flags[a.slice(2)] = next;
          i++;
        } else {
          flags[a.slice(2)] = true;
        }
      }
    } else {
      _.push(a);
    }
  }
  return { _, flags };
}

const HELP = `☾ dream-machine — nightly, evidence-gated repository evolution

Usage: dream-machine <command> [options]

Commands:
  init [--repo owner/name] [--out dream.config.json]   Scaffold a dream.config
  compile [config] [--out FILE]                        Compile config → routine prompt
  schedule [config] [--out FILE] [--env ID]            Emit the /schedule routine body
  ledger verify   [--path LEDGER.md]                   Structurally verify a ledger
  ledger signals  [--path LEDGER.md]                   Print STEP 1.1 learning signals
  ledger stats    [--path LEDGER.md]                   Verdict distribution
  ledger append   --path L --date .. --deep .. ...     Append one row
  witness stamp   <report-file> <commit>               Compute the witness triple
  witness verify  <report-file> <commit> <witness>     Verify a claimed witness
  verify-entrypoint <label> --cmd "<command>"           Classify an evaluator entrypoint's liveness
  tui             [--path LEDGER.md] [--no-color]      Render the dashboard
  version | --version                                  Print version
  help    | --help                                     This help

The Dream Machine never merges. Evaluation is not promotion — a human decides.
Docs: https://ruvnet.github.io/dream-machine/`;

async function loadConfig(io: IO, path: string): Promise<DreamConfig> {
  const raw = await io.readFile(path);
  return JSON.parse(raw) as DreamConfig;
}

/** Run a dream-machine command. Never throws — errors become {code:1}. */
export async function run(argv: string[], io: IO): Promise<RunResult> {
  const sink = makeSink();
  const { _, flags } = parseArgs(argv);
  const cmd = _[0];

  try {
    if (!cmd || cmd === 'help' || flags.help) {
      sink.log(HELP);
      return { code: 0, out: sink.out, err: sink.err };
    }
    if (cmd === 'version' || flags.version) {
      sink.log(VERSION);
      return { code: 0, out: sink.out, err: sink.err };
    }

    switch (cmd) {
      case 'init': {
        const repo = (flags.repo as string) || 'owner/name';
        const cfg = defaultConfig(repo);
        const json = JSON.stringify(cfg, null, 2);
        const out = (flags.out as string) || '';
        if (out) {
          await io.writeFile(out, json + '\n');
          sink.log(`wrote ${out} for ${repo}`);
        } else {
          sink.log(json);
        }
        return { code: 0, out: sink.out, err: sink.err };
      }

      case 'compile': {
        const cfgPath = _[1] || 'dream.config.json';
        const cfg = await loadConfig(io, cfgPath);
        const v = validateConfig(cfg);
        if (!v.ok) {
          sink.error(`invalid config:\n  - ${v.errors.join('\n  - ')}`);
          return { code: 1, out: sink.out, err: sink.err };
        }
        const prompt = compile(cfg);
        const out = (flags.out as string) || '';
        if (out) {
          await io.writeFile(out, prompt);
          sink.log(`compiled ${cfg.repo} → ${out} (${prompt.length} bytes)`);
        } else {
          sink.log(prompt);
        }
        return { code: 0, out: sink.out, err: sink.err };
      }

      case 'schedule': {
        const cfgPath = _[1] || 'dream.config.json';
        const cfg = await loadConfig(io, cfgPath);
        const body = serializeRoutine(cfg, { environmentId: flags.env as string | undefined });
        const out = (flags.out as string) || '';
        if (out) {
          await io.writeFile(out, body + '\n');
          sink.log(`wrote routine body → ${out}`);
          sink.log('');
          sink.log(scheduleInstructions(cfg, { environmentId: flags.env as string | undefined }));
        } else {
          sink.log(body);
        }
        return { code: 0, out: sink.out, err: sink.err };
      }

      case 'ledger': {
        const sub = _[1];
        const path = (flags.path as string) || 'docs/dream-cycle/LEDGER.md';
        let md = '';
        try {
          md = await io.readFile(path);
        } catch {
          md = emptyLedger();
        }
        if (sub === 'verify') {
          const r = verifyLedger(md);
          if (r.ok) {
            sink.log(`✓ ledger OK — ${r.rowCount} rows`);
            r.warnings.forEach((w) => sink.log(`  ⚠ ${w}`));
            return { code: 0, out: sink.out, err: sink.err };
          }
          sink.error(`✗ ledger has ${r.errors.length} error(s):`);
          r.errors.forEach((e) => sink.error(`  - ${e}`));
          return { code: 1, out: sink.out, err: sink.err };
        }
        if (sub === 'signals') {
          const { rows } = parseLedger(md);
          sink.log(JSON.stringify(learningSignals(rows), null, 2));
          return { code: 0, out: sink.out, err: sink.err };
        }
        if (sub === 'stats') {
          const { rows } = parseLedger(md);
          sink.log(JSON.stringify(verdictStats(rows), null, 2));
          return { code: 0, out: sink.out, err: sink.err };
        }
        if (sub === 'append') {
          const row: LedgerRow = {
            date: (flags.date as string) || io.now(),
            deep: (flags.deep as string) || '',
            finding: (flags.finding as string) || '',
            issue: (flags.issue as string) || 'LOCAL',
            pr: (flags.pr as string) || 'NONE',
            evaluated: (flags.evaluated as string) || 'no',
            verdict: (flags.verdict as string) || 'INCONCLUSIVE',
            effect: (flags.effect as string) || '',
            witness: (flags.witness as string) || '',
            priorFates: (flags.priorFates as string) || '',
          };
          const next = appendRow(md, row);
          await io.writeFile(path, next);
          sink.log(`appended row to ${path} (verdict=${row.verdict})`);
          return { code: 0, out: sink.out, err: sink.err };
        }
        sink.error('ledger: expected sub-command verify|signals|stats|append');
        return { code: 1, out: sink.out, err: sink.err };
      }

      case 'witness': {
        const sub = _[1];
        if (sub === 'stamp') {
          const file = _[2];
          const commit = _[3];
          if (!file || !commit) {
            sink.error('usage: dream-machine witness stamp <report-file> <commit>');
            return { code: 1, out: sink.out, err: sink.err };
          }
          const report = await io.readFile(file);
          const w = stamp(report, commit);
          sink.log(`report_sha256 : ${w.reportHash}`);
          sink.log(`session_commit: ${w.sessionCommit}`);
          sink.log(`witness       : ${w.witness}`);
          sink.log('');
          sink.log(verifySteps());
          return { code: 0, out: sink.out, err: sink.err };
        }
        if (sub === 'verify') {
          const [, , file, commit, claimed] = _;
          if (!file || !commit || !claimed) {
            sink.error('usage: dream-machine witness verify <report-file> <commit> <witness>');
            return { code: 1, out: sink.out, err: sink.err };
          }
          const report = await io.readFile(file);
          const r = verify(report, commit, claimed);
          if (r.ok) {
            sink.log('✓ witness VALID — report is bound to this commit');
            return { code: 0, out: sink.out, err: sink.err };
          }
          sink.error(`✗ witness INVALID — ${r.reason}`);
          sink.error(`  expected: ${r.expected.witness}`);
          return { code: 1, out: sink.out, err: sink.err };
        }
        sink.error('witness: expected sub-command stamp|verify');
        return { code: 1, out: sink.out, err: sink.err };
      }

      case 'verify-entrypoint': {
        const label = _[1];
        const cmd = flags.cmd as string | undefined;
        if (!label || !cmd) {
          sink.error('usage: dream-machine verify-entrypoint <label> --cmd "<command>"');
          return { code: 1, out: sink.out, err: sink.err };
        }
        if (_.length > 2) {
          // An unquoted multi-word --cmd (e.g. `--cmd npx @metaharness/redblue` with no
          // quotes/`=`) gets word-split by the shell before argv reaches us: `--cmd` only
          // absorbs the next single token, and the rest land here as stray positionals.
          // Silently proceeding on a truncated command (e.g. running bare `npx`) can itself
          // produce a false "live" verdict — exactly the failure mode this tool exists to
          // catch — so treat extra positionals as a hard usage error instead.
          sink.error(
            `verify-entrypoint: unexpected extra argument(s) ${JSON.stringify(_.slice(2))} — ` +
              `did you forget to quote --cmd? usage: dream-machine verify-entrypoint <label> --cmd "<command>"`,
          );
          return { code: 1, out: sink.out, err: sink.err };
        }
        if (!io.exec) {
          sink.error('verify-entrypoint: this IO has no exec() — cannot run commands');
          return { code: 1, out: sink.out, err: sink.err };
        }
        const result = await io.exec(cmd);
        const check = classifyEntrypointResult(result);
        sink.log(`${label}: ${check.verdict} (exit ${check.code}) — ${check.reason}`);
        const code = check.verdict === 'live' ? 0 : check.verdict === 'blocked' ? 1 : 2;
        return { code, out: sink.out, err: sink.err };
      }

      case 'tui': {
        const path = (flags.path as string) || 'docs/dream-cycle/LEDGER.md';
        let md = '';
        try {
          md = await io.readFile(path);
        } catch {
          md = emptyLedger();
        }
        sink.log(renderDashboard(md, { noColor: flags['no-color'] === true, repo: flags.repo as string | undefined }));
        return { code: 0, out: sink.out, err: sink.err };
      }

      default:
        sink.error(`unknown command: ${cmd}`);
        sink.error(HELP);
        return { code: 1, out: sink.out, err: sink.err };
    }
  } catch (e) {
    sink.error(`error: ${(e as Error).message}`);
    return { code: 1, out: sink.out, err: sink.err };
  }
}
