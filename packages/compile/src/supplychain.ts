/**
 * Supply-chain: unpinned `npx` invocation detection.
 *
 * Reproduced 2026-08-18 (security-adversarial night, SCAN=supply-chain): this
 * repo's own `dream.config.json#evaluatorEntrypoints.darwin` is
 * `npx @metaharness/darwin evolve --sandbox mock` — no version pin. `npx`
 * resolves against the registry's `latest` dist-tag fresh on every invocation;
 * it does not consult (or get governed by) `package-lock.json`, so pinning a
 * repo's *own* dependency tree does nothing to constrain what an unpinned
 * `npx` call executes. `@metaharness/darwin` has published 4 versions in its
 * history and was last published 3 days before tonight — evidence the "latest"
 * an unpinned invocation resolves to is neither static nor rare to change.
 * Live, current precedent for the blast radius: the Shai-Hulud/Miasma npm worm
 * lineage has repeatedly compromised maintainer accounts and self-propagated
 * via fresh publishes since late 2025, most recently 2026-08-04 (~127M
 * weekly-download package family). None of that requires a typosquat or a
 * dependency-confusion name collision — a single-maintainer, correctly-scoped
 * package (which is exactly what this repo's own supply-chain scan on
 * 2026-08-13 concluded `@metaharness/*` is) is still fully exposed if that
 * maintainer's publish credential is ever compromised, because nothing here
 * pins what gets executed.
 *
 * This module only detects and surfaces the exposure — it does not remediate
 * it. Pinning `dream.config.json`'s actual entrypoints, or vendoring
 * `@metaharness/*` as real lockfile-pinned dependencies, is a repo-owner
 * decision left to human review (same "classify, don't silently trust or
 * silently fix" precedent as ADR-0002).
 */

import type { EvaluatorEntrypoints } from './config.js';

export interface UnpinnedNpxFinding {
  /** Where the command came from, e.g. "evaluatorEntrypoints.darwin" or "controlPlaneProbes[1]". */
  source: string;
  /** The full shell command string it was found in. */
  command: string;
  /**
   * The `npx` package spec token that is not pinned to an exact version, e.g.
   * "@metaharness/darwin", "cowsay@latest" or "cowsay@1.6". One finding per
   * unpinned spec, so a `--package a@1.2.3 --package b` line yields one finding for `b`.
   */
  packageSpec: string;
}

/**
 * True if a package spec is a local path or a direct git/URL reference —
 * not a registry lookup, so "resolves `latest` from the registry" does not
 * apply and it must never be flagged.
 */
function isLocalOrRemoteSpec(packageSpec: string): boolean {
  return (
    packageSpec.startsWith('.') ||
    packageSpec.startsWith('/') ||
    packageSpec.startsWith('~') ||
    packageSpec.includes('://') ||
    packageSpec.startsWith('git+') ||
    packageSpec.startsWith('github:')
  );
}

/**
 * An exact semver version: `major.minor.patch`, optionally followed by a
 * prerelease (`-beta.1`) and/or build (`+sha.5`) suffix, per semver.org. This is
 * the only spec shape that names one immutable published artifact.
 *
 * Deliberately rejected, because npm resolves each of them against whatever the
 * registry holds at invocation time: partial versions (`1`, `1.6` — npm reads
 * these as the ranges `1.x.x` / `1.6.x`), x-ranges and wildcards (`1.x`, `1.2.*`),
 * operator ranges (`^1.2.3`, `~1.2.3`, `>=1.2.3`, `=1.2.3`), hyphen/or ranges,
 * a leading `v`, and dist-tags (`latest`, `next`, anything non-numeric).
 */
const EXACT_SEMVER =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(-[0-9A-Za-z-]+(\.[0-9A-Za-z-]+)*)?(\+[0-9A-Za-z-]+(\.[0-9A-Za-z-]+)*)?$/;

/**
 * True unless the package spec carries an exact `major.minor.patch` pin. No
 * version, a partial version, a range, or a dist-tag all count as unpinned.
 */
function isUnpinned(packageSpec: string): boolean {
  const withoutScope = packageSpec.startsWith('@') ? packageSpec.slice(1) : packageSpec;
  const atIndex = withoutScope.indexOf('@');
  if (atIndex === -1) return true;
  return !EXACT_SEMVER.test(withoutScope.slice(atIndex + 1));
}

/**
 * Find every package spec `npx`/`npm exec` would install for one invocation
 * starting at `tokens[start]` (the token right after the trigger). Honors
 * `--package=<spec>` / `--package <spec>` / `-p <spec>` — npx's own flag for
 * naming a *different* package than the one on the command line (e.g.
 * `npx --package=@metaharness/darwin@0.9.2 darwin-evolve`, where the bin name
 * `darwin-evolve` is not the package spec at all). The flag may repeat
 * (`npx -p a@1.2.3 -p b cmd` installs both `a` and `b`), so every occurrence is
 * collected; a pinned first `--package` must not hide an unpinned second one.
 * npx's own option parsing ends at the first positional token (the command it
 * runs), so flags after that belong to the command and are not scanned. With no
 * `--package`/`-p` at all, that first positional token is the package spec.
 */
function extractPackageSpecs(tokens: string[], start: number): string[] {
  const specs: string[] = [];
  for (let j = start; j < tokens.length; j++) {
    const t = tokens[j];
    if (t === '--package' || t === '-p') {
      const spec = tokens[j + 1];
      if (spec) specs.push(spec);
      j += 1; // the value is consumed; keep scanning for further --package flags
      continue;
    }
    if (t.startsWith('--package=')) {
      const spec = t.slice('--package='.length);
      if (spec) specs.push(spec);
      continue;
    }
    if (t.startsWith('-')) continue; // some other npx flag, e.g. -y — keep scanning
    if (specs.length === 0) specs.push(t); // first positional with no --package override
    break; // the command starts here; anything after it is the command's own argv
  }
  return specs;
}

/**
 * Scan `controlPlaneProbes` and `evaluatorEntrypoints` command strings for
 * `npx <pkg>` / `npm exec <pkg>` invocations lacking an exact `major.minor.patch`
 * version pin (see `isUnpinned` for what counts as exact).
 * Pure — no I/O, no network. Local paths (`npx ./script.js`) and direct
 * git/URL specs are never flagged — they don't resolve against the registry's
 * floating `latest`, so the risk this function detects doesn't apply to them.
 */
export function findUnpinnedNpxInvocations(
  controlPlaneProbes: string[],
  evaluatorEntrypoints: EvaluatorEntrypoints,
): UnpinnedNpxFinding[] {
  const sources: Array<[string, string]> = [
    ...controlPlaneProbes.map((cmd, i): [string, string] => [`controlPlaneProbes[${i}]`, cmd]),
    ...(Object.entries(evaluatorEntrypoints) as Array<[string, string | undefined]>)
      .filter((e): e is [string, string] => Boolean(e[1]))
      .map(([key, cmd]): [string, string] => [`evaluatorEntrypoints.${key}`, cmd]),
  ];

  const findings: UnpinnedNpxFinding[] = [];
  for (const [source, command] of sources) {
    const tokens = command.split(/\s+/).filter(Boolean);
    for (let i = 0; i < tokens.length; i++) {
      const isNpx = tokens[i] === 'npx';
      const isNpmExec = tokens[i] === 'npm' && tokens[i + 1] === 'exec';
      if (!isNpx && !isNpmExec) continue;
      for (const packageSpec of extractPackageSpecs(tokens, i + (isNpmExec ? 2 : 1))) {
        if (!isLocalOrRemoteSpec(packageSpec) && isUnpinned(packageSpec)) {
          findings.push({ source, command, packageSpec });
        }
      }
    }
  }
  return findings;
}
