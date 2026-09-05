import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, mkdir, readFile, writeFile, symlink, unlink, stat, cp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { createEvidenceBundle, verifyEvidenceBundle, stableJson, validateManifest, sha256, lockfileInventory, MAX_ARTIFACT_BYTES } from './mission-evidence.mjs';
import { ROOT, parseMissionArgs, inspectDevelopmentPolicy, developmentPolicy, doctor, runFixed } from './mission.mjs';

const source = { commit: 'a'.repeat(40), dirty: false, lockSha256: 'b'.repeat(64) };
const gates = [{ name: 'physical-release', verdict: 'INCONCLUSIVE', reason: 'hardware-unmeasured' }];
const fixture = () => ({ source, gates, artifacts: { 'result.json': { synthetic: true, hardwareActuation: false } } });
async function bundle() {
  const root = await mkdtemp(join(tmpdir(), 'dream-evidence-test-'));
  return createEvidenceBundle(join(root, 'run-test'), fixture());
}

test('project JSON sorts objects, preserves array order, and rejects lossy values', () => {
  assert.equal(stableJson({ z: [2, 1], a: true }), '{"a":true,"z":[2,1]}\n');
  const cycle = {}; cycle.self = cycle;
  for (const invalid of [undefined, NaN, Infinity, 1n, new Date(), cycle, new Array(1), { a: undefined }]) assert.throws(() => stableJson(invalid));
  const sparse = new Array(1); sparse.extra = 'lost';
  assert.throws(() => stableJson(sparse));
});

test('project JSON never executes getters in objects or arrays', () => {
  let called = false;
  for (const value of [{}, []]) {
    Object.defineProperty(value, Array.isArray(value) ? '0' : 'field', { enumerable: true, get() { called = true; return 1; } });
    assert.throws(() => stableJson(value));
  }
  assert.equal(called, false);
});

test('project JSON avoids array species, map overrides and hidden properties', () => {
  let calls = 0;
  for (const name of ['map', 'constructor', Symbol.species]) {
    const value = [1];
    Object.defineProperty(value, name, { get() { calls++; return Array; } });
    assert.throws(() => stableJson(value));
  }
  const hidden = { a: 1 }; Object.defineProperty(hidden, 'lost', { value: 2 });
  assert.throws(() => stableJson(hidden));
  assert.equal(calls, 0);
});

test('new bundle verifies integrity while hardware release remains inconclusive', async () => {
  const result = await bundle();
  const verified = await verifyEvidenceBundle(result.directory, result.manifestSha256);
  assert.equal(verified.integrityVerdict, 'ACCEPT');
  assert.equal(verified.verdict, 'INCONCLUSIVE');
  assert.equal(verified.deployment, 'blocked');
  assert.equal(verified.hardwareActuation, false);
  assert.equal((await verifyEvidenceBundle(result.directory)).authenticity, 'UNVERIFIED');
  if (process.platform !== 'win32') {
    assert.equal((await stat(result.directory)).mode & 0o777, 0o700);
    assert.equal((await stat(join(result.directory, 'manifest.json'))).mode & 0o777, 0o600);
  }
  await assert.rejects(createEvidenceBundle(result.directory, fixture()));
  await assert.rejects(verifyEvidenceBundle(result.directory, 'c'.repeat(64)));
});

test('intact evidence containing failed gates cannot report acceptance', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dream-evidence-reject-'));
  const result = await createEvidenceBundle(join(root, 'run-test'), { ...fixture(), gates: [...gates, { name: 'tests', verdict: 'REJECT', reason: 'failed' }] });
  const verified = await verifyEvidenceBundle(result.directory, result.manifestSha256);
  assert.equal(verified.integrity, 'PASS');
  assert.equal(verified.verdict, 'REJECT');
});

for (const mutation of ['corrupt', 'missing', 'extra', 'duplicate-key', 'noncanonical', 'symlink']) {
  test(`bundle rejects ${mutation} artifact or manifest`, async () => {
    const result = await bundle();
    const artifact = join(result.directory, 'result.json');
    const manifest = join(result.directory, 'manifest.json');
    if (mutation === 'corrupt') await writeFile(artifact, '{}\n');
    if (mutation === 'missing') await unlink(artifact);
    if (mutation === 'extra') await writeFile(join(result.directory, 'unexpected'), 'x');
    if (mutation === 'noncanonical') await writeFile(manifest, JSON.stringify(result.manifest, null, 2));
    if (mutation === 'duplicate-key') await writeFile(manifest, stableJson(result.manifest).replace('{', '{"authority":"none",'));
    if (mutation === 'symlink') { await unlink(artifact); await symlink(manifest, artifact); }
    await assert.rejects(verifyEvidenceBundle(result.directory));
  });
}

test('FIFO artifact fails promptly instead of blocking before file type validation', { skip: process.platform === 'win32' }, async () => {
  const result = await bundle();
  const path = join(result.directory, 'result.json');
  await unlink(path);
  execFileSync('mkfifo', [path]);
  const program = `import {verifyEvidenceBundle} from ${JSON.stringify(new URL('./mission-evidence.mjs', import.meta.url).href)}; try {await verifyEvidenceBundle(process.argv[1]);process.exitCode=3;}catch{process.exitCode=0;}`;
  assert.doesNotThrow(() => execFileSync(process.execPath, ['--input-type=module', '-e', program, result.directory], { timeout: 3000 }));
});

test('root symlinks, incomplete bundles and excessive directory entries fail closed', async () => {
  const result = await bundle();
  await symlink(result.directory, `${result.directory}-link`);
  await assert.rejects(verifyEvidenceBundle(`${result.directory}-link`));
  const root = await mkdtemp(join(tmpdir(), 'dream-incomplete-test-'));
  await assert.rejects(verifyEvidenceBundle(root));
  await Promise.all(Array.from({ length: 33 }, (_, i) => writeFile(join(result.directory, `extra-${i}`), 'x')));
  await assert.rejects(verifyEvidenceBundle(result.directory), /too many directory entries/);
});

test('manifest rejects names, coercion, unknown fields, bounds and hardware promotion', async () => {
  const { manifest } = await bundle();
  const cases = [
    (v) => { v.source.commit = [v.source.commit]; },
    (v) => { v.source.lockSha256 = [v.source.lockSha256]; },
    (v) => { v.source.commit += '\n'; },
    (v) => { v.artifacts[0].name = '../escape'; },
    (v) => { v.artifacts[0].name = 'x\n'; },
    (v) => { v.artifacts[0].name = 'manifest.json'; },
    (v) => { v.artifacts[0].sha256 = [v.artifacts[0].sha256]; },
    (v) => { v.artifacts[0].bytes = MAX_ARTIFACT_BYTES + 1; },
    (v) => { v.artifacts.push(v.artifacts[0]); },
    (v) => { v.gates[0].verdict = 'ACCEPT'; },
    (v) => { v.authority = 'actuation'; },
    (v) => { v.unexpected = true; },
  ];
  for (const mutate of cases) { const copy = structuredClone(manifest); mutate(copy); assert.throws(() => validateManifest(copy)); }
});

test('lock inventory is bounded and does not claim license approval', async () => {
  const inventory = await lockfileInventory(ROOT);
  assert.equal(inventory.lockSha256, sha256(await readFile(join(ROOT, 'package-lock.json'))));
  assert(inventory.components.length > 0);
  assert.equal(inventory.licenseApproval, 'human-review-required');
});

const config = (fields = 'api: false, ui: false', outer = '') => `export default defineConfig({test:{${fields}}${outer}});`;
test('current development harness policy passes static tripwire', async () => {
  assert.equal((await developmentPolicy()).verdict, 'ACCEPT');
  assert.equal(inspectDevelopmentPolicy({}, config('"api": false, "ui": false')).verdict, 'ACCEPT');
});

for (const [name, text] of Object.entries({
  api: config('api:true,ui:false'), missing: config('ui:false'),
  computed: config('api:false,ui:false,["api"]:true'),
  duplicate: config('api:false,ui:false,api:false'),
  browser: config('api:false,ui:false,"browser":{enabled:true}'),
  plugins: config(undefined, ',"plugins":[]'), spread: config('api:false,ui:false,...extra'),
  dynamic: 'export default defineConfig(makeConfig());',
  decoy: 'const safe=defineConfig({test:{api:false,ui:false}}); export default {test:{api:true}};',
  multiple: `${config()} defineConfig({test:{api:false,ui:false}});`,
  arguments: 'export default defineConfig({test:{api:false,ui:false}},evil);',
})) test(`development policy rejects ${name} config`, () => assert.equal(inspectDevelopmentPolicy({}, text).verdict, 'REJECT'));

test('development policy rejects declared server flags and UI dependencies', () => {
  for (const pkg of [{ scripts: { test: 'vitest --api' } }, { scripts: { test: 'vite --host=0.0.0.0' } }, { devDependencies: { '@vitest/ui': '4.1.11' } }]) {
    assert.equal(inspectDevelopmentPolicy(pkg, config()).verdict, 'REJECT');
  }
});

test('CLI rejects traversal, flag ambiguity and noncanonical seeds', () => {
  assert.equal(parseMissionArgs(['simulate', '--full', '--seed', '4294967295']).seed, 0xffffffff);
  for (const args of [ ['verify'], ['verify', '--bundle', '../escape'], ['verify', '--bundle', 'run-a\n'],
    ['simulate', '--seed', '01'], ['simulate', '--seed', '1\n'], ['simulate', '--seed', '4294967296'],
    ['security', '--offline'], ['doctor', '--full'], ['run', '--expected', 'a'.repeat(64)], ['serve'], ['run', 'extra'] ]) {
    assert.throws(() => parseMissionArgs(args));
  }
});

test('doctor exposes only public tool availability, never hardware validation', () => {
  const result = doctor();
  assert.equal(result.hardwareActuation, false);
  assert.deepEqual(Object.keys(result.tools.git).sort(), ['available', 'version']);
  if (process.platform !== 'darwin') assert.equal(doctor('mac').verdict, 'INCONCLUSIVE');
});

test('doctor can load on a fresh checkout without node_modules', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dream-fresh-checkout-'));
  await mkdir(join(root, 'scripts'));
  for (const name of ['mission.mjs', 'mission-evidence.mjs']) await cp(join(ROOT, 'scripts', name), join(root, 'scripts', name));
  const result = execFileSync(process.execPath, [join(root, 'scripts', 'mission.mjs'), 'doctor'], { encoding: 'utf8', timeout: 15000 });
  assert.equal(JSON.parse(result).verdict, 'ACCEPT');
});

test('fixed child command failures are bounded and do not expose stderr', () => {
  const result = runFixed(process.execPath, ['-e', 'process.stderr.write("private diagnostics");process.exit(7)']);
  assert.equal(result.status, 7);
  assert(!JSON.stringify(result).includes('private diagnostics'));
});
