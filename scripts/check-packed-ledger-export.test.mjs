/**
 * Packed-consumer gate for @dream-machine/ledger.
 *
 * Every prior test in this repo exercises the ledger through the npm
 * workspace, which symlinks packages/ledger straight into node_modules.
 * That path never notices when a package's shipped surface (package.json
 * `files`/`exports`/`main` + the dist/ they point at) is missing something
 * the rest of the code relies on — which is exactly how the real published
 * `@dream-machine/ledger@0.1.0` on npm has sat frozen at its 2026-08-13
 * day-one state ever since: EVALS, VERDICTS, learningSignals, and
 * verifyLedger were all added later and never shipped, because nothing ever
 * consumed the package the way an outside `npm install` would (caught in
 * review on PR #129).
 *
 * This gate packs the CURRENT local source with `npm pack` and installs
 * that tarball into an isolated directory outside the workspace, then
 * imports it exactly as an external consumer would. It is deliberately
 * offline (no real registry fetch) so it stays deterministic in CI: it
 * proves "if this were published right now, consuming it would work",
 * which is the regression this gate can actually own. It does NOT prove
 * the real npm registry is current — that requires an actual `npm publish`
 * decision, which is a human call, not a candidate diff (see the
 * companion issue filed alongside this PR).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const REPO_ROOT = fileURLToPath(new URL('../', import.meta.url));
const LEDGER_DIR = join(REPO_ROOT, 'packages/ledger');

test('a packed `npm pack` tarball of @dream-machine/ledger exports EVALS/VERDICTS/learningSignals when installed in isolation', { timeout: 60_000 }, async () => {
  const workDir = mkdtempSync(join(tmpdir(), 'dream-machine-packed-ledger-'));
  try {
    const packOut = execFileSync('npm', ['pack', '--silent', '--pack-destination', workDir], {
      cwd: LEDGER_DIR,
      encoding: 'utf8',
    }).trim();
    const tarballName = packOut.split('\n').pop();
    const tarballPath = join(workDir, tarballName);

    const installDir = join(workDir, 'consumer');
    mkdirSync(installDir, { recursive: true });
    execFileSync('npm', ['init', '--yes'], { cwd: installDir, encoding: 'utf8' });
    // --no-save / no workspace: this is a plain isolated install of the tarball,
    // not a workspace `file:` link, so it exercises exactly what an external
    // `npm install @dream-machine/ledger` consumer would see.
    execFileSync('npm', ['install', tarballPath, '--no-audit', '--no-fund'], {
      cwd: installDir,
      encoding: 'utf8',
    });

    const pkgEntry = join(installDir, 'node_modules/@dream-machine/ledger/dist/index.js');
    const mod = await import(pathToFileURL(pkgEntry).href);

    assert.ok(Array.isArray(mod.EVALS) && mod.EVALS.includes('yes'), 'EVALS must be exported from the packed tarball');
    assert.ok(Array.isArray(mod.VERDICTS) && mod.VERDICTS.includes('ACCEPT'), 'VERDICTS must be exported from the packed tarball');
    assert.equal(typeof mod.learningSignals, 'function');
    assert.equal(typeof mod.verifyLedger, 'function');
    assert.equal(typeof mod.parseLedger, 'function');
    assert.equal(typeof mod.appendRow, 'function');

    // Exercise the actually-exported functions end to end, not just presence.
    const md = mod.appendRow(mod.emptyLedger(), {
      date: '2026-09-22',
      deep: 'ledger-signals',
      finding: 'packed-consumer smoke',
      issue: '#128',
      pr: '#129',
      evaluated: 'yes',
      verdict: 'ACCEPT',
      effect: 'n/a',
      witness: 'deadbeef',
      priorFates: '-',
    });
    const { rows } = mod.parseLedger(md);
    assert.equal(mod.verifyLedger(md).ok, true);
    assert.equal(mod.learningSignals(rows).distinctDatesInWindow, 1);
  } finally {
    rmSync(workDir, { recursive: true, force: true });
  }
});
