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
 */

export interface ExecResult {
  code: number;
  stdout: string;
  stderr: string;
}

export type EntrypointVerdict = 'live' | 'suspicious-silent' | 'blocked' | 'stale-state';

export interface EntrypointCheck {
  verdict: EntrypointVerdict;
  code: number;
  reason: string;
}

// Reproduced 2026-09-02 (evaluation-adapters night, SCAN=flywheel,darwin): running
// `npx @metaharness/darwin evolve . --sandbox mock` twice in the same checkout — the
// exact baseline-then-candidate pattern STEP 5-9 of the compiled nightly prompt uses —
// fails the second time with exit 1 and `Error: darwin: autonomous or generated child
// id already exists: g1_v0`. The entrypoint is live; it is the target directory's
// `.metaharness/` working state (generation/child ids) that persisted from the first
// run and collided with the second. Left classified as generic `blocked`, this reads as
// an evaluator outage or a candidate regression — neither is true. A dedicated verdict
// keeps that distinction visible instead of forcing the pipeline to guess.
const STALE_STATE_RE = /already exists/i;

/**
 * Tokenize a command string into argv for `execFile` (no shell). Reproduced
 * 2026-08-17 (evaluation-adapters night, SCAN=flywheel,darwin): the only
 * existing way to run an `evaluatorEntrypoints` value is `verify-entrypoint
 * <label> --cmd "<command>"`, hand-retyped per entrypoint. Auto-feeding a
 * config-sourced command string into `child_process.exec` (a shell) would
 * let shell metacharacters in that string (`&&`, `;`, `|`, backticks) run as
 * shell operators, not literal argv text — safe only as long as a human
 * retypes each command by hand. This tokenizer is the safe alternative:
 * split on whitespace, honoring double-quoted segments as one token (minimal
 * quoting — sufficient for this repo's own `evaluatorEntrypoints` values;
 * single-quote/escaped-quote handling is a documented non-goal, not silently
 * mishandled). This is a *correctness* boundary, not a security one: because
 * `execFile` never involves a shell, a mis-split token can only make a
 * command fail or run a different-than-intended argv — it can never let a
 * shell metacharacter act as an operator. Known gaps, adversarially
 * reviewed 2026-09-17, not fixed (would need a real shell-lexer for input
 * this repo's own two configured entrypoints never produce): a
 * backslash-escaped quote (`echo "a\"b"`) does not unescape; a quote
 * embedded mid-token (`a"b c"d`) is not special, only a token that *starts*
 * with `"` is; a leading empty-quoted token (`'"" build'` → `['', 'build']`)
 * makes `verify-entrypoints` report "empty command" and silently drop the
 * real argument that followed it, instead of running `build`.
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

const SHELL_CONTROL_OPERATORS = new Set(['&&', '||', ';', '|', '&']);

/**
 * True if a tokenized command's argv contains a shell control operator as a
 * standalone token — i.e. the original string was actually multiple shell
 * commands chained together, not one command with arguments. Confirmed as a
 * real, live bug 2026-09-18 (PR #116 review, repo owner): this repo's own
 * `dream.config.json` darwin entry is exactly this shape — `rm -rf
 * .metaharness && npx @metaharness/darwin evolve . --sandbox mock`.
 * `tokenizeCommand` correctly never shell-interprets `&&` (it's just another
 * inert token, per `execFile`'s no-shell guarantee), but blindly dispatching
 * argv[0] as the executable and the rest as its args — the naive reading of
 * a tokenized command — silently misfires on a string like this: `rm`
 * becomes the executable, and `-rf .metaharness && npx @metaharness/darwin
 * evolve . --sandbox mock` (a bare `.` among them) becomes its argv. `npx`
 * never runs; `rm` runs instead, with garbage arguments including the
 * current directory. This check exists so `verify-entrypoints` can refuse
 * the whole entry instead of executing anything for it. Deliberately a
 * denylist of exact separator tokens (not a shell grammar) — matches this
 * module's own established minimal-quoting scope. Inherits tokenizeCommand's
 * whitespace-only splitting: an operator only counts if it is its own token
 * (`cmd1 ; cmd2`), not glued to a neighbor (`cmd1;cmd2`) — every
 * evaluatorEntrypoints value observed in this repo uses spaced operators.
 */
export function looksLikeCompoundCommand(argv: string[]): boolean {
  return argv.some((t) => SHELL_CONTROL_OPERATORS.has(t));
}

/** Classify a completed entrypoint invocation. Pure — no I/O. */
export function classifyEntrypointResult(r: ExecResult): EntrypointCheck {
  if (r.code !== 0) {
    const stderr = r.stderr.trim();
    if (STALE_STATE_RE.test(stderr)) {
      return {
        verdict: 'stale-state',
        code: r.code,
        reason:
          `${stderr || `exited ${r.code} with no stderr`} — this looks like local state left over from a ` +
          "prior invocation (e.g. a working directory the tool doesn't reset itself), not a broken " +
          'entrypoint or a candidate regression. Clear that state and re-run before recording a verdict.',
      };
    }
    return {
      verdict: 'blocked',
      code: r.code,
      reason: stderr || `exited ${r.code} with no stderr`,
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
