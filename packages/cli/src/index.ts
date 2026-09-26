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
  legacyPrefixDigest,
  VERDICTS,
  EVALS,
  type LedgerRow,
} from '@dream-machine/ledger';
import {
  stamp,
  verify,
  verifySteps,
  stampReport,
  verifyReportBytes,
  verifyReportSelfContained,
  evaluateEvidenceFreshness,
  evidenceFreshnessPolicyDigest,
  type EvidenceDependency,
  type EvidenceFreshnessPolicy,
} from '@dream-machine/witness';
import { serializeRoutine, scheduleInstructions } from '@dream-machine/schedule';
import { renderDashboard } from './tui.js';
import { classifyEntrypointResult, tokenizeCommand, looksLikeCompoundCommand, type ExecResult } from './entrypoint.js';
import { classifyAuditGate } from './auditgate.js';
import {
  evaluateDocuments,
  invalidInputReceipt,
  receiptExitCode,
} from './ruos-evaluation.mjs';

export const VERSION = '0.1.1';

export interface IO {
  readFile(path: string): Promise<string>;
  /** Read a bounded, non-symlink evidence file when the host supports it. */
  readEvidenceFile?(path: string): Promise<string>;
  writeFile(path: string, content: string): Promise<void>;
  now(): string; // YYYY-MM-DD
  env: Record<string, string | undefined>;
  /** Run a shell command and capture its result. Optional: not every IO needs it. */
  exec?(cmd: string): Promise<ExecResult>;
  /**
   * Run a file with argv, no shell involved. Optional: not every IO needs it.
   * Used by `verify-entrypoints` so a config-sourced command string never
   * reaches a shell — see `tokenizeCommand` in entrypoint.ts.
   */
  execFile?(file: string, args: string[]): Promise<ExecResult>;
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

/**
 * Parse `--pending "finding one|finding two"` into a finding list for
 * `learningSignals`'s `pendingFindings` option (pipe-separated open-PR
 * titles/findings, supplied by the caller after a live GitHub check).
 * Pipe, not comma, matches LEDGER.md's own field separator (`escapeCell`
 * already strips raw `|` from anything that becomes a ledger cell) and
 * survives real PR titles/findings, which very often contain commas.
 * A boolean (bare `--pending`) or absent flag safely yields `undefined`.
 */
export function parsePendingFindings(raw: string | boolean | undefined): string[] | undefined {
  if (typeof raw !== 'string') return undefined;
  const findings = raw
    .split('|')
    .map((s) => s.trim())
    .filter(Boolean);
  return findings.length ? findings : undefined;
}

const HELP = `☾ dream-machine — nightly, evidence-gated repository evolution

Usage: dream-machine <command> [options]

Commands:
  init [--repo owner/name] [--out dream.config.json]   Scaffold a dream.config
  compile [config] [--out FILE]                        Compile config → routine prompt
  schedule [config] [--out FILE] [--env ID]            Emit the /schedule routine body
  ledger verify   [--path LEDGER.md] [--since-row N] [--legacy-digest HEX]
                                                       Structurally verify a ledger
                                                         (--since-row: only enforce rows >= N;
                                                         omitted → every row, today's default.
                                                         --legacy-digest: anchor the grandfathered
                                                         rows 1..N-1 to their exact content (see
                                                         ledger legacy-digest) — a mismatch fails
                                                         closed and enforces every row, since
                                                         --since-row alone trusts a row NUMBER, not
                                                         content, and can be defeated by inserting a
                                                         row before the boundary)
  ledger legacy-digest --path L --since-row N          Print the sha256 digest of rows 1..N-1, to
                                                         pass as ledger verify's --legacy-digest
  ledger signals  [--path L] [--merged "7,12"] [--pending "f1|f2"]
                                                       Print STEP 1.1 learning signals
                                                         (--merged: known-merged PR numbers;
                                                         omitted → zeroMergeStreak defaults
                                                         to a worst-case, unverified true)
  ledger stats    [--path LEDGER.md]                   Verdict distribution
  ledger append   --path L --date .. --deep .. ...     Append one row
  witness stamp   <report-file> <commit>               Compute the witness triple
  witness verify  <report-file> <commit> <witness>     Verify a claimed witness
  witness verify-report <report-file> [--commit sha]   Self-contained: verify a report against
                                                         its own embedded "## Witness" section
  verify-entrypoint <label> --cmd "<command>"           Classify an evaluator entrypoint's liveness
  verify-entrypoints [config]                           Classify every evaluatorEntrypoints entry
                                                         (execFile, never a shell — no manual retyping)
  tui             [--path LEDGER.md] [--no-color] [--merged "7,12"]  Render the dashboard
  audit-gate      --path <npm-audit.json>               Gate on high/critical findings in an audit report
  ruos verify <observation-or-pair.json> <policy.json>  Verify a governed ruOS receipt
  freshness stamp --base <sha> --paths "a,b" [--out F]  Freeze the evidence read set at evaluation time
  freshness verify --policy <file> --head <sha>         Re-verify that read set against the promotion target
                                                         (exit 0 FRESH, 1 STALE, 2 indeterminate/invalid)
  version | --version                                  Print version
  help    | --help                                     This help

The Dream Machine never merges. Evaluation is not promotion — a human decides.
Docs: https://ruvnet.github.io/dream-machine/`;

/**
 * Parse `--merged "7,#12, 30"` into a bare-number Set for `learningSignals`'
 * `mergedPrNumbers` option. `parseArgs` turns a value-less `--merged`
 * (nothing after it, or another flag right after) into the boolean `true`,
 * not a string — that case throws a clear usage error instead of an opaque
 * "flag.split is not a function" crash. Omitted entirely → `undefined`,
 * preserving today's worst-case-default `zeroMergeStreak` behavior.
 */
function parseMergedPrNumbers(flag: string | boolean | undefined): Set<string> | undefined {
  if (flag === undefined) return undefined;
  if (typeof flag !== 'string') {
    throw new Error('--merged expects a comma-separated PR number list, e.g. --merged "7,12"');
  }
  const nums = flag
    .split(',')
    .map((s) => s.trim().replace(/^#/, ''))
    .filter(Boolean);
  return new Set(nums);
}

/**
 * Parse `--since-row N` into `verifyLedger`'s `sinceRow` option: a 1-indexed
 * row number to start enforcement from. Same fail-closed shape as `--merged`
 * — a value-less flag or a non-integer value is a usage error, not `NaN` or
 * silent full-ledger enforcement. Omitted entirely → `undefined` (verify
 * every row, today's default behavior, unchanged).
 */
function parseSinceRow(flag: string | boolean | undefined): number | undefined {
  if (flag === undefined) return undefined;
  const n = typeof flag === 'string' ? Number(flag) : NaN;
  if (!Number.isInteger(n) || n < 1) {
    throw new Error('--since-row expects a positive integer row number, e.g. --since-row 38');
  }
  return n;
}

/**
 * Parse `--legacy-digest HEX` into `verifyLedger`'s `legacyPrefixDigest`
 * option: a 64-char lowercase sha256 hex digest. Same fail-closed shape as
 * `--since-row` — a value-less flag or a malformed hex value is a usage
 * error. Omitted entirely → `undefined` (ordinal-only `sinceRow` trust,
 * today's default behavior, unchanged).
 */
function parseLegacyDigest(flag: string | boolean | undefined): string | undefined {
  if (flag === undefined) return undefined;
  if (typeof flag !== 'string' || !/^[0-9a-f]{64}$/.test(flag)) {
    throw new Error('--legacy-digest expects a 64-char lowercase sha256 hex digest');
  }
  return flag;
}

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
        if (sub === 'legacy-digest') {
          const sinceRow = parseSinceRow(flags['since-row']);
          if (sinceRow === undefined) {
            sink.error('ledger legacy-digest: --since-row N is required');
            return { code: 1, out: sink.out, err: sink.err };
          }
          const { rows } = parseLedger(md);
          sink.log(legacyPrefixDigest(rows, sinceRow));
          return { code: 0, out: sink.out, err: sink.err };
        }
        if (sub === 'verify') {
          const sinceRow = parseSinceRow(flags['since-row']);
          const legacyDigest = parseLegacyDigest(flags['legacy-digest']);
          const r = verifyLedger(md, { sinceRow, legacyPrefixDigest: legacyDigest });
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
          const mergedPrNumbers = parseMergedPrNumbers(flags.merged);
          const pendingFindings = parsePendingFindings(flags.pending as string | undefined);
          sink.log(
            JSON.stringify(
              learningSignals(rows, { today: io.now(), mergedPrNumbers, pendingFindings }),
              null,
              2,
            ),
          );
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
          if (!VERDICTS.includes(row.verdict)) {
            sink.error(`ledger append: verdict "${row.verdict}" not in ${VERDICTS.join('|')}`);
            return { code: 1, out: sink.out, err: sink.err };
          }
          if (!EVALS.includes(row.evaluated)) {
            sink.error(`ledger append: evaluated "${row.evaluated}" not in ${EVALS.join('|')}`);
            return { code: 1, out: sink.out, err: sink.err };
          }
          const next = appendRow(md, row);
          await io.writeFile(path, next);
          sink.log(`appended row to ${path} (verdict=${row.verdict})`);
          return { code: 0, out: sink.out, err: sink.err };
        }
        sink.error('ledger: expected sub-command verify|signals|stats|append|legacy-digest');
        return { code: 1, out: sink.out, err: sink.err };
      }

      case 'witness': {
        const sub = _[1];
        if (sub === 'stamp') {
          const file = _[2];
          const commit = _[3];
          if (!file || !commit) {
            sink.error('usage: dream-machine witness stamp <report-file> <commit> [--report]');
            return { code: 1, out: sink.out, err: sink.err };
          }
          const report = await io.readFile(file);
          // --report: hash canonical (pre-"## Witness"-section) bytes, so the
          // triple is reproducible after the section is pasted into the file —
          // see @dream-machine/witness's report-witness module (issue #112).
          const w = flags.report ? stampReport(report, commit) : stamp(report, commit);
          sink.log(`report_sha256 : ${w.reportHash}`);
          sink.log(`session_commit: ${w.sessionCommit}`);
          sink.log(`witness       : ${w.witness}`);
          sink.log('');
          if (flags.report) {
            sink.log(`# Paste this section (heading through end) at the end of ${file}, then verify with:`);
            sink.log(`dream-machine witness verify-report ${file} --commit ${w.sessionCommit}`);
          } else {
            sink.log(verifySteps());
          }
          return { code: 0, out: sink.out, err: sink.err };
        }
        if (sub === 'verify') {
          const [, , file, commit, claimed] = _;
          if (!file || !commit || !claimed) {
            sink.error('usage: dream-machine witness verify <report-file> <commit> <witness> [--report]');
            return { code: 1, out: sink.out, err: sink.err };
          }
          const report = await io.readFile(file);
          const r = flags.report ? verifyReportBytes(report, commit, claimed) : verify(report, commit, claimed);
          if (r.ok) {
            sink.log('✓ witness VALID — report is bound to this commit');
            return { code: 0, out: sink.out, err: sink.err };
          }
          sink.error(`✗ witness INVALID — ${r.reason}`);
          sink.error(`  expected: ${r.expected.witness}`);
          return { code: 1, out: sink.out, err: sink.err };
        }
        if (sub === 'verify-report') {
          const file = _[2];
          const expectedCommit = flags.commit as string | undefined;
          if (!file) {
            sink.error('usage: dream-machine witness verify-report <report-file> [--commit <sha>]');
            return { code: 1, out: sink.out, err: sink.err };
          }
          const report = await io.readFile(file);
          const r = verifyReportSelfContained(report, expectedCommit);
          if (r.ok) {
            sink.log('✓ witness VALID — report is self-contained and bound to its declared commit');
            sink.log(`  session_commit: ${r.published?.sessionCommit}`);
            return { code: 0, out: sink.out, err: sink.err };
          }
          sink.error(`✗ witness INVALID — ${r.reason}`);
          return { code: 1, out: sink.out, err: sink.err };
        }
        sink.error('witness: expected sub-command stamp|verify|verify-report');
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
        const code =
          check.verdict === 'live'
            ? 0
            : check.verdict === 'blocked'
              ? 1
              : check.verdict === 'suspicious-silent'
                ? 2
                : 3; // stale-state
        return { code, out: sink.out, err: sink.err };
      }

      case 'verify-entrypoints': {
        // Trust boundary (unlike audit-gate's policy file below, deliberately not
        // hardened against a hostile config): dream.config.json is repo-committed,
        // PR-reviewed config, never runtime-attacker-controlled — same boundary PR
        // #17/#40 already established for this exact entrypoint automation. execFile
        // (never a shell) still applies regardless, so a config value containing shell
        // metacharacters can't act as a shell operator even if that boundary were ever
        // wrong. Not proven shell-safe on Windows: `execFile('npm'|'npx', …)` resolves
        // through the platform's `.cmd`/`.bat` shim, which Node internally re-spawns via
        // `cmd.exe` (see nodejs/node CVE-2024-27980) — this repo's nightly runner is
        // Linux-only, so out of scope tonight, flagged for anyone porting this command.
        const configPath = _[1] ?? 'dream.config.json';
        if (!io.execFile) {
          sink.error('verify-entrypoints: this IO has no execFile() — cannot run commands');
          return { code: 1, out: sink.out, err: sink.err };
        }
        let config: DreamConfig;
        try {
          config = await loadConfig(io, configPath);
        } catch (e) {
          sink.error(`verify-entrypoints: failed to load ${configPath}: ${(e as Error).message}`);
          return { code: 1, out: sink.out, err: sink.err };
        }
        const entries = Object.entries(config.evaluatorEntrypoints ?? {});
        if (entries.length === 0) {
          sink.log('verify-entrypoints: no evaluatorEntrypoints configured');
          return { code: 0, out: sink.out, err: sink.err };
        }
        let worst = 0;
        for (const [label, rawValue] of entries) {
          // Every configured key gets a report line and counts toward the aggregate
          // exit code — a non-string/blank value is reported blocked, never silently
          // dropped from the pass (2026-09-18, PR #116 review).
          if (typeof rawValue !== 'string' || rawValue.trim() === '') {
            sink.log(
              `${label}: blocked (exit 1) — evaluatorEntrypoints.${label} is not a configured command string`,
            );
            worst = Math.max(worst, 1);
            continue;
          }
          const argv = tokenizeCommand(rawValue);
          const [file, ...args] = argv;
          if (!file) {
            sink.log(`${label}: blocked (exit 1) — empty command after tokenizing ${JSON.stringify(rawValue)}`);
            worst = Math.max(worst, 1);
            continue;
          }
          if (looksLikeCompoundCommand(argv)) {
            // Fail closed rather than dispatch argv[0] with the rest of a multi-command
            // string as its arguments — see looksLikeCompoundCommand's own doc comment
            // for the live repro (this repo's own darwin entry). Nothing is executed.
            sink.log(
              `${label}: blocked (exit 1) — compound command (contains a shell control operator: ` +
                `${argv.filter((t) => t === '&&' || t === '||' || t === ';' || t === '|' || t === '&').join(', ')}); ` +
                'verify-entrypoints runs one command per entry, never a shell — split this entry into a single ' +
                'command, or verify its pieces individually via verify-entrypoint',
            );
            worst = Math.max(worst, 1);
            continue;
          }
          const result = await io.execFile(file, args);
          const check = classifyEntrypointResult(result);
          sink.log(`${label}: ${check.verdict} (exit ${check.code}) — ${check.reason}`);
          const code =
            check.verdict === 'live'
              ? 0
              : check.verdict === 'blocked'
                ? 1
                : check.verdict === 'suspicious-silent'
                  ? 2
                  : 3; // stale-state
          worst = Math.max(worst, code);
        }
        return { code: worst, out: sink.out, err: sink.err };
      }

      case 'audit-gate': {
        const path = flags.path as string | undefined;
        if (!path) {
          sink.error('usage: dream-machine audit-gate --path <npm-audit.json>');
          return { code: 1, out: sink.out, err: sink.err };
        }
        let report: unknown;
        try {
          report = JSON.parse(await io.readFile(path));
        } catch (e) {
          sink.error(`audit-gate: could not read/parse ${path}: ${(e as Error).message}`);
          return { code: 2, out: sink.out, err: sink.err };
        }
        const r = classifyAuditGate(report);
        sink.log(
          `audit-gate: ${r.verdict} — ${r.reason} ` +
            `(critical=${r.critical} high=${r.high} moderate=${r.moderate} low=${r.low})`,
        );
        const code = r.verdict === 'clear' ? 0 : r.verdict === 'blocked' ? 1 : 2;
        return { code, out: sink.out, err: sink.err };
      }

      case 'ruos': {
        if (_[1] !== 'verify' || !_[2] || !_[3] || _.length !== 4) {
          sink.error('usage: dream-machine ruos verify <observation-or-pair.json> <trusted-policy.json>');
          return { code: 1, out: sink.out, err: sink.err };
        }
        let receipt;
        try {
          const read = io.readEvidenceFile ?? io.readFile;
          const input = JSON.parse(await read(_[2]));
          const policy = JSON.parse(await read(_[3]));
          receipt = evaluateDocuments(input, policy);
        } catch {
          receipt = invalidInputReceipt();
        }
        sink.log(JSON.stringify(receipt));
        return { code: receiptExitCode(receipt), out: sink.out, err: sink.err };
      }

      /**
       * Evidence freshness gate (see `@dream-machine/witness/evidence-freshness`).
       *
       * `stamp` freezes the read set at evaluation time; `verify` re-digests
       * those same paths against the tree a candidate would land in. The CLI
       * owns all I/O so the witness primitive stays pure.
       */
      case 'freshness': {
        const sub = _[1];
        const sha256Hex = async (content: string): Promise<string> =>
          (await import('node:crypto')).createHash('sha256').update(content).digest('hex');

        if (sub === 'stamp') {
          const base = flags.base as string | undefined;
          const pathsFlag = flags.paths as string | undefined;
          if (!base || !pathsFlag) {
            sink.error(
              'usage: dream-machine freshness stamp --base <sha> --paths "a.json,b/c.ts" [--id ID] [--max-age DAYS] [--out FILE]',
            );
            return { code: 2, out: sink.out, err: sink.err };
          }
          const paths = pathsFlag
            .split(',')
            .map((p) => p.trim())
            .filter(Boolean);
          const dependencies: EvidenceDependency[] = [];
          for (const path of paths) {
            try {
              dependencies.push({ path, digest: await sha256Hex(await io.readFile(path)) });
            } catch (e) {
              sink.error(`freshness stamp: cannot read declared dependency ${path}: ${(e as Error).message}`);
              return { code: 2, out: sink.out, err: sink.err };
            }
          }
          const maxAgeRaw = flags['max-age'];
          const policy: EvidenceFreshnessPolicy = {
            policyId: (flags.id as string) || 'dream-cycle-candidate',
            baseCommit: base,
            evaluatedAt: new Date(`${io.now()}T00:00:00.000Z`).toISOString(),
            dependencies,
            requireDeclaredDependencies: true,
            ...(maxAgeRaw === undefined ? {} : { maxAgeDays: Number(maxAgeRaw) }),
          };
          let policyDigest: string;
          try {
            policyDigest = evidenceFreshnessPolicyDigest(policy);
          } catch (e) {
            sink.error(`freshness stamp: ${(e as Error).message}`);
            return { code: 2, out: sink.out, err: sink.err };
          }
          const doc = JSON.stringify({ policy, policyDigest }, null, 2);
          const out = flags.out as string | undefined;
          if (out) {
            await io.writeFile(out, doc + '\n');
            sink.log(`freshness stamp: wrote ${out} (policyDigest ${policyDigest})`);
          } else {
            sink.log(doc);
          }
          return { code: 0, out: sink.out, err: sink.err };
        }

        if (sub === 'verify') {
          const policyPath = flags.policy as string | undefined;
          const head = flags.head as string | undefined;
          if (!policyPath || !head) {
            sink.error('usage: dream-machine freshness verify --policy <file> --head <sha>');
            return { code: 2, out: sink.out, err: sink.err };
          }
          let doc: { policy: EvidenceFreshnessPolicy; policyDigest: string };
          try {
            doc = JSON.parse(await io.readFile(policyPath));
          } catch (e) {
            sink.error(`freshness verify: could not read/parse ${policyPath}: ${(e as Error).message}`);
            return { code: 2, out: sink.out, err: sink.err };
          }
          // Validate and anchor the policy BEFORE touching the filesystem.
          // The policy file is untrusted input: without this, a crafted policy
          // could name `../../etc/hosts` and make us read (and confirm the
          // existence of) paths outside the repository, even though the receipt
          // would later come back INVALID. Fail closed, then read.
          let anchoredDigest: string;
          try {
            anchoredDigest = evidenceFreshnessPolicyDigest(doc.policy);
          } catch (e) {
            sink.error(`freshness verify: malformed policy in ${policyPath}: ${(e as Error).message}`);
            return { code: 2, out: sink.out, err: sink.err };
          }
          if (anchoredDigest !== doc.policyDigest) {
            sink.error(
              'freshness verify: policy digest mismatch — the read set was rewritten after it was stamped',
            );
            return { code: 2, out: sink.out, err: sink.err };
          }

          // A declared path that no longer exists is simply not observed; the
          // receipt then reports it as missing (INDETERMINATE), never FRESH.
          const observedDeps: EvidenceDependency[] = [];
          const absent: string[] = [];
          for (const dependency of doc.policy?.dependencies ?? []) {
            try {
              observedDeps.push({ path: dependency.path, digest: await sha256Hex(await io.readFile(dependency.path)) });
            } catch {
              absent.push(dependency.path);
            }
          }
          const receipt = evaluateEvidenceFreshness(doc.policy, doc.policyDigest, {
            headCommit: head,
            observedAt: new Date(`${io.now()}T00:00:00.000Z`).toISOString(),
            dependencies: observedDeps,
          });
          sink.log(JSON.stringify(receipt, null, 2));
          if (absent.length > 0) {
            sink.error(`freshness verify: declared dependencies no longer present: ${absent.join(', ')}`);
          }
          if (receipt.status === 'STALE') {
            sink.error(
              `freshness verify: STALE — the evidence no longer describes this tree ` +
                `(drifted: ${receipt.driftedPaths.join(', ') || 'none'}${receipt.ageExceeded ? '; age budget exceeded' : ''}). Re-evaluate before promoting.`,
            );
          }
          const code = receipt.status === 'FRESH' ? 0 : receipt.status === 'STALE' ? 1 : 2;
          return { code, out: sink.out, err: sink.err };
        }

        sink.error('usage: dream-machine freshness <stamp|verify> ...');
        return { code: 2, out: sink.out, err: sink.err };
      }

      case 'tui': {
        const path = (flags.path as string) || 'docs/dream-cycle/LEDGER.md';
        let md = '';
        try {
          md = await io.readFile(path);
        } catch {
          md = emptyLedger();
        }
        sink.log(
          renderDashboard(md, {
            noColor: flags['no-color'] === true,
            repo: flags.repo as string | undefined,
            today: io.now(),
            mergedPrNumbers: parseMergedPrNumbers(flags.merged),
          }),
        );
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
