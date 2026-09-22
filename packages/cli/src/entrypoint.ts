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
