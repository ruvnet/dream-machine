import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { digest } from './ruos-evaluation.mjs';
import { pngFixture } from './ruos-test-fixtures.mjs';

const root = resolve(import.meta.dirname, '..');

function run(command, args, cwd) {
  return spawnSync(command, args, { cwd, encoding: 'utf8', timeout: 60_000,
    env: { ...process.env, npm_config_audit: 'false', npm_config_fund: 'false' } });
}

function evidence(now = Date.now()) {
  const policy = { schemaVersion: 1, bindings: { candidateCommit: 'a'.repeat(40),
    baseCommit: 'b'.repeat(40), sourceCommit: 'c'.repeat(40), evaluatorDigest: 'd'.repeat(64),
    runNonce: 'packaged-cli-test', machineId: 'isolated-test', workloadDigest: 'e'.repeat(64),
    environmentDigest: 'f'.repeat(64) }, expectedTenant: 'test-tenant', assertionIds: ['visible'],
    caseIds: ['journey'], ttlMs: 60_000, maxFutureSkewMs: 1_000, minSamples: 1,
    maxLatencyRegression: 0, maxCostRegression: 0, maxSuccessDrop: 0 };
  const bytes = pngFixture();
  const observation = { schemaVersion: 1, arm: 'baseline', executedCommit: policy.bindings.baseCommit,
    completionVersion: 1, completionVerified: true, bindings: { ...policy.bindings,
      policyDigest: digest(policy) }, timestampMs: now, status: 'ok', exitCode: 0,
    tenant: { id: policy.expectedTenant, verified: true }, assertions: [{ id: 'visible', pass: true }],
    screenshot: { encoding: 'base64', mime: 'image/png', data: bytes.toString('base64'),
      sha256: createHash('sha256').update(bytes).digest('hex') }, humanTakeover: false,
    contaminated: false, cases: [{ id: 'journey', samples: 1, latencyMs: 1, cost: 0,
      successRate: 1 }] };
  return { policy, observation };
}

test('npm-packed CLI exposes the stable ruos verifier and rejects malformed image evidence', () => {
  const dir = mkdtempSync(join(tmpdir(), 'dream-ruos-pack-'));
  try {
    const pkg = join(dir, 'package');
    const consumer = join(dir, 'consumer');
    mkdirSync(join(pkg, 'dist'), { recursive: true });
    mkdirSync(consumer);
    const build = run(join(root, 'node_modules/.bin/esbuild'), [join(root, 'packages/cli/src/bin.ts'),
      '--bundle', '--platform=node', '--format=esm', '--target=node18',
      `--outfile=${join(pkg, 'dist/bin.js')}`, '--log-level=warning'], root);
    assert.equal(build.status, 0, build.stderr);
    const manifest = JSON.parse(readFileSync(join(root, 'packages/cli/package.json'), 'utf8'));
    delete manifest.dependencies;
    delete manifest.types;
    manifest.files = ['dist'];
    manifest.main = 'dist/bin.js';
    writeFileSync(join(pkg, 'package.json'), `${JSON.stringify(manifest, null, 2)}\n`);
    const packed = run('npm', ['pack', pkg, '--pack-destination', dir, '--json'], root);
    assert.equal(packed.status, 0, packed.stderr);
    const tarball = join(dir, readdirSync(dir).find((name) => name.endsWith('.tgz')));
    writeFileSync(join(consumer, 'package.json'), '{"private":true,"type":"module"}\n');
    const installed = run('npm', ['install', '--ignore-scripts', '--package-lock=false', tarball], consumer);
    assert.equal(installed.status, 0, installed.stderr);

    const { policy, observation } = evidence();
    const input = join(consumer, 'observation.json');
    const trusted = join(consumer, 'policy.json');
    writeFileSync(input, JSON.stringify(observation));
    writeFileSync(trusted, JSON.stringify(policy));
    const cli = join(consumer, 'node_modules/.bin/dream-machine');
    const accepted = run(cli, ['ruos', 'verify', input, trusted], consumer);
    assert.equal(accepted.status, 0, accepted.stderr);
    assert.equal(JSON.parse(accepted.stdout).status, 'ACCEPT');
    assert.equal(JSON.parse(accepted.stdout).authority, 'none');

    const invalid = pngFixture({ corruptIdatCrc: true });
    observation.screenshot.data = invalid.toString('base64');
    observation.screenshot.sha256 = createHash('sha256').update(invalid).digest('hex');
    writeFileSync(input, JSON.stringify(observation));
    const rejected = run(cli, ['ruos', 'verify', input, trusted], consumer);
    assert.equal(rejected.status, 1, rejected.stderr);
    assert.ok(JSON.parse(rejected.stdout).reasons.includes('INVALID_SCREENSHOT'));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
