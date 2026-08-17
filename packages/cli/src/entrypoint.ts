/**
 * Entrypoint-liveness classification.
 *
 * Reproduced 2026-08-13 (security-adversarial night, SCAN=redblue): running
 * `npx @metaharness/redblue <any subcommand>` — the exact command this repo's
 * own `dream.config.json` documents as the SCAN=redblue evaluator entrypoint —
 * exits 0 with zero bytes on both stdout and stderr, for every subcommand
 * tried. The package's CLI guards its dispatch with the classic ESM idiom
 * `import.meta.url === \`file://${process.argv[1]}\``, which fails once the
 * executable is reached through the symlink npm/npx always create for a
 * package's `bin` entry, so the dispatch body silently never runs. Exit 0 +
 * silence is indistinguishable from "ran clean, zero findings" to anything
 * that only checks the exit code — exactly what STEP 5-9 of the compiled
 * nightly prompt would otherwise do. Any evaluator entrypoint result should
 * route through here before the pipeline is allowed to record EVALUATED=yes.
 *
 * Follow-up (2026-08-17, evaluation-adapters night): issue #6 recommended
 * wiring `dream.config.json#evaluatorEntrypoints` through this classifier
 * automatically, but flagged that piping a repo-modifiable config value into
 * `child_process.exec` (a shell) first would be a real injection risk. This
 * module's `tokenizeCommand` + the CLI's `execFile`-based IO close that gap:
 * config-sourced commands run without shell interpretation.
 */

export interface ExecResult {
  code: number;
  stdout: string;
  stderr: string;
}

export type EntrypointVerdict = 'live' | 'suspicious-silent' | 'blocked';

export interface EntrypointCheck {
  verdict: EntrypointVerdict;
  code: number;
  reason: string;
}

/**
 * Split a config-sourced command string into an argv array, so it can be run
 * via `execFile` (no shell) instead of `exec` (`/bin/sh -c`). Handles the
 * shapes this repo's own `evaluatorEntrypoints` actually use: plain
 * whitespace-separated words, and double-quoted segments that must stay one
 * argument (e.g. `--cmd "some arg"`). Not a general shell-grammar parser —
 * config values here are commands like `npm test`, never scripts.
 */
export function tokenizeCommand(cmd: string): string[] {
  const tokens: string[] = [];
  const re = /"([^"]*)"|(\S+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(cmd)) !== null) {
    tokens.push(m[1] !== undefined ? m[1] : m[2]);
  }
  return tokens;
}

/** Classify a completed entrypoint invocation. Pure — no I/O. */
export function classifyEntrypointResult(r: ExecResult): EntrypointCheck {
  if (r.code !== 0) {
    return {
      verdict: 'blocked',
      code: r.code,
      reason: r.stderr.trim() || `exited ${r.code} with no stderr`,
    };
  }
  if (r.stdout.trim() === '' && r.stderr.trim() === '') {
    return {
      verdict: 'suspicious-silent',
      code: r.code,
      reason:
        'exit 0 with empty stdout and stderr — indistinguishable from "ran clean, zero findings"; ' +
        'do not record EVALUATED=yes from this result alone',
    };
  }
  return { verdict: 'live', code: r.code, reason: 'produced output' };
}
