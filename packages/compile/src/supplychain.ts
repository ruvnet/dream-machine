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
  /** The bare `npx` package spec token, e.g. "@metaharness/darwin" or "cowsay@latest". */
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

/** True if a package spec has no version pin, or is pinned to a floating dist-tag. */
function isUnpinned(packageSpec: string): boolean {
  const withoutScope = packageSpec.startsWith('@') ? packageSpec.slice(1) : packageSpec;
  const atIndex = withoutScope.indexOf('@');
  if (atIndex === -1) return true;
  const version = withoutScope.slice(atIndex + 1);
  // A real version pin starts with a digit (npm semver, no leading "v"). Anything else
  // (empty, "latest", "next", a range like ">=1.0.0") is still a floating resolution.
  return version === '' || !/^\d/.test(version);
}

/**
 * Find the package spec `npx`/`npm exec` would resolve for one invocation
 * starting at `tokens[start]` (the token right after the trigger). Honors
 * `--package=<spec>` / `--package <spec>` / `-p <spec>` — npx's own flag for
 * naming a *different* package than the one on the command line (e.g.
 * `npx --package=@metaharness/darwin@0.9.2 darwin-evolve`, where the bin name
 * `darwin-evolve` is not the package spec at all). Falls back to the first
 * non-flag token when no `--package`/`-p` is present.
 */
function extractPackageSpec(tokens: string[], start: number): string | undefined {
  for (let j = start; j < tokens.length; j++) {
    const t = tokens[j];
    if (t === '--package' || t === '-p') return tokens[j + 1];
    if (t.startsWith('--package=')) return t.slice('--package='.length);
    if (t.startsWith('-')) continue; // some other flag, e.g. -y — keep scanning
    return t; // first non-flag token with no --package override
  }
  return undefined;
}

/**
 * Scan `controlPlaneProbes` and `evaluatorEntrypoints` command strings for
 * `npx <pkg>` / `npm exec <pkg>` invocations lacking an exact version pin.
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
      const packageSpec = extractPackageSpec(tokens, i + (isNpmExec ? 2 : 1));
      if (packageSpec && !isLocalOrRemoteSpec(packageSpec) && isUnpinned(packageSpec)) {
        findings.push({ source, command, packageSpec });
      }
    }
  }
  return findings;
}
