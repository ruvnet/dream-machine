import test from 'node:test';
import assert from 'node:assert/strict';
import { collectRuosPreflight, inspectRuosPreflight } from './ruos-preflight.mjs';

const image = { content: [{ type: 'image', mimeType: 'image/png', data: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a4ioAAAAASUVORK5CYII=' }] };
const success = { structuredContent: { status: 'ok', exitCode: 0, completionVersion: 1, completionVerified: true } };

test('actual ruOS null exit plus SUCCESS prose never passes preflight', () => {
  const receipt = inspectRuosPreflight({ structuredContent: { status: 'ok', exitCode: null, stdout: 'secret-value\nSUCCESS' } }, image);
  assert.equal(receipt.verdict, 'INCONCLUSIVE');
  assert.deepEqual(receipt.reasons, ['EXIT_CODE_MISSING', 'COMPLETION_UNVERIFIED']);
  assert.ok(receipt.screenshotSha256);
  assert.equal(JSON.stringify(receipt).includes('secret-value'), false);
  assert.equal(receipt.mergeEligible, false);
});

test('pixels must be returned, not a URL or dimensions or corrupt bytes', () => {
  for (const screenshot of [null, { structuredContent: { image: { width: 1280 } } }, { content: [{ type: 'image', mimeType: 'image/png', data: 'https://example.com/image.png' }] }]) {
    assert.equal(inspectRuosPreflight(success, screenshot).verdict, 'INCONCLUSIVE');
  }
});

test('successful readiness grants no tenant, workload, or merge claim', () => {
  const receipt = inspectRuosPreflight(success, image);
  assert.equal(receipt.verdict, 'ACCEPT');
  assert.equal(receipt.scope, 'transport-readiness-only');
  assert.equal(receipt.authority, 'none');
  assert.equal(receipt.mergeEligible, false);
  assert.ok(receipt.limitations.includes('not-tenant-isolation-proof'));
});

test('numeric exit from legacy unverified transport cannot pass', () => {
  assert.deepEqual(inspectRuosPreflight({ structuredContent: { status: 'ok', exitCode: 0, stdout: 'SUCCESS' } }, image).reasons, ['COMPLETION_UNVERIFIED']);
});

test('collector uses exactly two fixed scoped reads and redacts transport failures', async () => {
  const calls = [];
  const receipt = await collectRuosPreflight(async (name, args) => {
    calls.push([name, args]);
    if (name === 'desktop_exec') throw new Error('Bearer secret');
    return image;
  }, 'evaluation-desktop');
  assert.deepEqual(calls, [
    ['desktop_exec', { machine: 'evaluation-desktop', command: 'true', timeout_secs: 15 }],
    ['computer_screenshot', { machine: 'evaluation-desktop' }],
  ]);
  assert.equal(receipt.verdict, 'INCONCLUSIVE');
  assert.equal(JSON.stringify(receipt).includes('Bearer'), false);
});

test('invalid machine never reaches transport and string exit codes fail', async () => {
  await assert.rejects(collectRuosPreflight(() => assert.fail(), 'x;whoami'), /INVALID_MACHINE/);
  assert.equal(inspectRuosPreflight({ structuredContent: { status: 'ok', exitCode: '0' } }, image).verdict, 'INCONCLUSIVE');
});

test('JSON fallback is supported but ambiguous blocks and isError cannot pass', () => {
  assert.equal(inspectRuosPreflight({ content: [{ type: 'text', text: JSON.stringify(success.structuredContent) }] }, image).verdict, 'ACCEPT');
  assert.equal(inspectRuosPreflight({ ...success, isError: true }, image).verdict, 'INCONCLUSIVE');
});

test('malformed MCP content returns inconclusive without throwing', () => {
  for (const content of [{}, null, 42, [null]]) {
    assert.equal(inspectRuosPreflight({ content }, { content }).verdict, 'INCONCLUSIVE');
  }
});
