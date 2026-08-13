#!/usr/bin/env node
/**
 * Prepare the `dream-machine` CLI for a self-contained npm publish.
 *
 * The `@dream-machine/*` engine modules are not published under an npm org, so
 * the CLI is shipped as a single package with those modules BUNDLED in. This
 * script:
 *   1. bundles src/bin.ts and src/index.ts (inlining the workspace deps) with esbuild,
 *   2. rewrites packages/cli/package.json to drop the @dream-machine/* deps,
 *
 * Run from the repo root. Restore the dev manifest with `git checkout packages/cli/package.json`
 * (or the saved .bak) after publishing.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, copyFileSync } from 'node:fs';

const CLI = 'packages/cli';

function esbuild(entry, outfile) {
  execFileSync(
    'npx',
    ['esbuild', `${CLI}/src/${entry}`, '--bundle', '--platform=node', '--format=esm', '--target=node18', `--outfile=${CLI}/dist/${outfile}`, '--log-level=warning'],
    { stdio: 'inherit' },
  );
}

esbuild('bin.ts', 'bin.js');
esbuild('index.ts', 'index.js');

const pkgPath = `${CLI}/package.json`;
copyFileSync(pkgPath, `${CLI}/package.json.bak`);
const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
delete pkg.dependencies; // bundled — no runtime deps
delete pkg.types; // bundle ships no type declarations
pkg.main = 'dist/index.js';
writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');

console.log('prepared dream-machine for standalone publish (deps bundled, manifest rewritten)');
