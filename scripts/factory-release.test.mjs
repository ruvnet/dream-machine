import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gzipSync, gunzipSync } from 'node:zlib';
import { readFileSync } from 'node:fs';
import { inspect, validatePolicy } from './factory-release.mjs';
function archive(extra = {}, manifest = {}, type = '0') {
  const files = {
    'package/package.json': JSON.stringify({ name: 'dream-machine', version: '1.2.3', bin: { 'dream-machine': 'dist/bin.js', 'dream-machine-factory': 'dist/software-factory.mjs' }, ...manifest }),
    'package/dist/software-factory.mjs': '// factory', 'package/dist/factory/core.mjs': '', 'package/dist/factory/artifacts.mjs': '', 'package/dist/factory/gist.mjs': '',
    'package/README.md': 'Readme', 'package/LICENSE': 'MIT', 'package/dist/bin.js': 'console.log("1.2.3")', 'package/dist/index.js': 'export {};', ...extra,
  };
  const blocks = [];
  for (const [name, text] of Object.entries(files)) {
    const body = Buffer.from(text), head = Buffer.alloc(512);
    head.write(name); head.write(body.length.toString(8).padStart(11, '0'), 124); head.write(type, 156);
    head.fill(32, 148, 156);
    const checksum = head.reduce((sum, byte) => sum + byte, 0);
    head.write(checksum.toString(8).padStart(6, '0') + '\0 ', 148);
    blocks.push(head, body, Buffer.alloc((512 - body.length % 512) % 512));
  }
  return gzipSync(Buffer.concat([...blocks, Buffer.alloc(1024)]));
}
test('semver tag and event gates fail closed', () => {
  assert.equal(validatePolicy('1.2.3', 'refs/tags/v1.2.3', 'workflow_dispatch', false), 'latest');
  assert.equal(validatePolicy('1.2.3-rc.1', 'refs/tags/v1.2.3-rc.1', 'push', false), 'next');
  assert.equal(validatePolicy('1.2.3', 'refs/heads/main', 'workflow_dispatch', true), 'latest');
  for (const args of [['1.2.3', 'refs/tags/v1.2.3', 'push', false], ['1.2.3', 'refs/heads/main', 'push', false], ['1.2.3', 'refs/tags/v1.2.4', 'push', false], ['1.2.3', 'refs/tags/v1.2.3', 'pull_request', false], ['01.2.3', '', 'push', false]]) assert.throws(() => validatePolicy(...args));
});
test('exact allowlisted tarball generates integrity', () => {
  assert.match(inspect(archive(), '1.2.3').integrity, /^sha512-/);
});
test('rejects leaked files, traversal, symlinks and credentials', () => {
  for (const name of ['package/.npmrc', 'package/../secret', 'package/dist/token.txt']) assert.throws(() => inspect(archive({ [name]: 'secret' }), '1.2.3'));
  assert.throws(() => inspect(archive({}, {}, '2'), '1.2.3'));
  assert.throws(() => inspect(archive({ 'package/README.md': 'npm_' + 'a'.repeat(40) }), '1.2.3'));
});
test('rejects wrong package, version and lifecycle scripts', () => {
  for (const manifest of [{ name: 'other' }, { version: '1.2.4' }, { scripts: { preinstall: 'evil' } }, { dependencies: { evil: '*' } }]) assert.throws(() => inspect(archive({}, manifest), '1.2.3'));
});
test('workflow pins actions, separates credentials and uses protected environment', () => {
  const workflow = readFileSync(new URL('../.github/workflows/release.yml', import.meta.url), 'utf8');
  for (const match of workflow.matchAll(/uses: ([^\s]+)/g)) assert.match(match[1], /@[a-f0-9]{40}$/);
  const [build, publish] = workflow.split('\n  publish:');
  assert.ok(!build.includes('id-token: write'));
  assert.ok(publish.includes('environment: npm-release'));
  assert.ok(publish.includes('id-token: write'));
  assert.ok(!publish.includes('npm ci'));
  assert.ok(!workflow.includes('secrets.NPM_TOKEN'));
  assert.ok(build.includes('npm run check'));
  assert.ok(build.includes('npm audit --audit-level=high'));
  assert.ok(build.includes('default: true'));
});

test('rejects malformed checksum, missing end blocks and appended hidden entries', () => {
  const tar = gunzipSync(archive());
  const damaged = Buffer.from(tar); damaged[1] ^= 1;
  assert.throws(() => inspect(gzipSync(damaged), '1.2.3'), /checksum/);
  assert.throws(() => inspect(gzipSync(tar.subarray(0, tar.length - 1024)), '1.2.3'), /end blocks/);
  assert.throws(() => inspect(gzipSync(Buffer.concat([tar, tar])), '1.2.3'), /trailing data/);
});
