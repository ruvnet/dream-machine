import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { constants } from 'node:fs';
import { lstat, mkdir, open, opendir, realpath, writeFile } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';

export const MAX_ARTIFACT_BYTES = 8 * 1024 * 1024;
export const MAX_BUNDLE_BYTES = 32 * 1024 * 1024;
export const MAX_ARTIFACTS = 32;
const NAME = /^[a-z][a-z0-9._-]{0,79}(?![\s\S])/;
const HASH = /^[a-f0-9]{64}(?![\s\S])/;
const matches = (value, pattern) => typeof value === 'string' && pattern.test(value);
const VERDICTS = new Set(['ACCEPT', 'REJECT', 'INCONCLUSIVE']);
export const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

/** Project evidence JSON, not a general RFC 8785 or signing implementation. */
export function stableJson(value) {
  const ancestors = new Set();
  function walk(item, depth) {
    assert(depth <= 32, 'evidence nesting limit');
    if (item === null || typeof item === 'string' || typeof item === 'boolean') return JSON.stringify(item);
    if (typeof item === 'number') { assert(Number.isFinite(item), 'nonfinite evidence'); return JSON.stringify(item); }
    assert(item && typeof item === 'object' && !ancestors.has(item), 'invalid or cyclic evidence');
    ancestors.add(item);
    let encoded;
    if (Array.isArray(item)) {
      const descriptors = Object.getOwnPropertyDescriptors(item);
      const length = descriptors.length.value;
      assert(Reflect.ownKeys(item).length === length + 1, 'sparse evidence array or extra property');
      const parts = [];
      for (let index = 0; index < length; index++) {
        const descriptor = descriptors[index];
        assert(descriptor?.enumerable && Object.hasOwn(descriptor, 'value'), 'evidence array getter or hole');
        parts.push(walk(descriptor.value, depth + 1));
      }
      encoded = `[${parts.join(',')}]`;
    } else {
      assert(Object.getPrototypeOf(item) === Object.prototype || Object.getPrototypeOf(item) === null, 'nonplain evidence');
      const keys = Object.keys(item).sort();
      assert(Reflect.ownKeys(item).length === keys.length, 'hidden or symbol evidence property');
      assert(keys.every((key) => Object.getOwnPropertyDescriptor(item, key)?.get === undefined), 'evidence getter');
      encoded = `{${keys.map((key) => `${JSON.stringify(key)}:${walk(item[key], depth + 1)}`).join(',')}}`;
    }
    ancestors.delete(item);
    return encoded;
  }
  return `${walk(value, 0)}\n`;
}

function exactKeys(value, keys) {
  assert(value && typeof value === 'object' && !Array.isArray(value), 'expected object');
  assert.deepEqual(Object.keys(value).sort(), [...keys].sort(), 'unexpected evidence fields');
}

export function validateManifest(value) {
  exactKeys(value, ['schemaVersion', 'kind', 'source', 'environment', 'artifacts', 'gates', 'authority']);
  assert.equal(value.schemaVersion, 'dream.software-evidence.v1');
  assert.equal(value.kind, 'software-prototype');
  assert.equal(value.authority, 'none');
  exactKeys(value.source, ['commit', 'dirty', 'lockSha256']);
  assert(matches(value.source.commit, /^[a-f0-9]{40}(?![\s\S])/), 'source commit');
  assert.equal(typeof value.source.dirty, 'boolean');
  assert(matches(value.source.lockSha256, HASH), 'lock digest');
  exactKeys(value.environment, ['platform', 'arch', 'node']);
  for (const field of Object.values(value.environment)) assert(matches(field, /^[a-zA-Z0-9._-]{1,64}(?![\s\S])/), 'environment identity');
  assert(Array.isArray(value.artifacts) && value.artifacts.length > 0 && value.artifacts.length <= MAX_ARTIFACTS, 'artifact count');
  const names = new Set();
  let total = 0;
  for (const artifact of value.artifacts) {
    exactKeys(artifact, ['name', 'bytes', 'sha256']);
    assert(matches(artifact.name, NAME) && artifact.name !== 'manifest.json' && !names.has(artifact.name), 'artifact name');
    assert(Number.isSafeInteger(artifact.bytes) && artifact.bytes > 0 && artifact.bytes <= MAX_ARTIFACT_BYTES, 'artifact byte bound');
    assert(matches(artifact.sha256, HASH), 'artifact digest');
    names.add(artifact.name);
    total += artifact.bytes;
  }
  assert(total <= MAX_BUNDLE_BYTES, 'bundle byte bound');
  assert(Array.isArray(value.gates) && value.gates.length > 0 && value.gates.length <= 32, 'gate count');
  const gates = new Set();
  for (const gate of value.gates) {
    exactKeys(gate, ['name', 'verdict', 'reason']);
    assert(matches(gate.name, NAME) && !gates.has(gate.name), 'gate name');
    assert(VERDICTS.has(gate.verdict), 'gate verdict');
    assert(matches(gate.reason, /^[a-z0-9._-]{1,120}(?![\s\S])/), 'bounded reason code');
    gates.add(gate.name);
  }
  assert(value.gates.some((gate) => gate.name === 'physical-release' && gate.verdict === 'INCONCLUSIVE'), 'software evidence cannot certify hardware');
  return value;
}

async function readBounded(path, maxBytes) {
  const handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  try {
    const stat = await handle.stat();
    assert(stat.isFile() && stat.size > 0 && stat.size <= maxBytes, 'artifact type or size');
    // Read only maxBytes + 1 even if a concurrent writer grows the file.
    const buffer = Buffer.alloc(maxBytes + 1);
    let size = 0;
    while (size < buffer.length) {
      const { bytesRead } = await handle.read(buffer, size, buffer.length - size, size);
      if (!bytesRead) break;
      size += bytesRead;
    }
    assert(size <= maxBytes, 'artifact grew above byte bound');
    return buffer.subarray(0, size);
  } finally { await handle.close(); }
}

/** Creates a NEW flat directory. Never overwrites or repairs an old bundle. */
export async function createEvidenceBundle(directory, { source, artifacts, gates }) {
  const names = Object.keys(artifacts).sort();
  const contents = new Map(names.map((name) => [name, Buffer.from(stableJson(artifacts[name]))]));
  const manifest = validateManifest({
    schemaVersion: 'dream.software-evidence.v1', kind: 'software-prototype', authority: 'none',
    source, environment: { platform: process.platform, arch: process.arch, node: process.versions.node },
    artifacts: names.map((name) => ({ name, bytes: contents.get(name).length, sha256: sha256(contents.get(name)) })),
    gates,
  });
  const parent = await realpath(resolve(directory, '..'));
  const destination = join(parent, basename(directory));
  assert(NAME.test(basename(destination)), 'bundle directory name');
  await mkdir(destination, { mode: 0o700 });
  // A partial write has no manifest and cannot pass verification.
  for (const [name, bytes] of contents) await writeFile(join(destination, name), bytes, { flag: 'wx', mode: 0o600 });
  const bytes = Buffer.from(stableJson(manifest));
  await writeFile(join(destination, 'manifest.json'), bytes, { flag: 'wx', mode: 0o600 });
  return { directory: destination, manifestSha256: sha256(bytes), manifest };
}

/** Integrity only. A supplied expected digest is a trust input, not a signature. */
export async function verifyEvidenceBundle(directory, expectedManifestSha256) {
  assert((await lstat(directory)).isDirectory(), 'bundle must be a real directory, not a symlink');
  const root = await realpath(directory);
  const bytes = await readBounded(join(root, 'manifest.json'), 128 * 1024);
  const digest = sha256(bytes);
  if (expectedManifestSha256 !== undefined) assert(matches(expectedManifestSha256, HASH) && digest === expectedManifestSha256, 'manifest trust digest mismatch');
  const manifest = validateManifest(JSON.parse(bytes.toString('utf8')));
  assert.equal(bytes.toString('utf8'), stableJson(manifest), 'manifest must use canonical project JSON');
  const names = [];
  for await (const entry of await opendir(root)) {
    names.push(entry.name);
    assert(names.length <= MAX_ARTIFACTS + 1, 'too many directory entries');
  }
  assert.deepEqual(names.sort(), [...manifest.artifacts.map((entry) => entry.name), 'manifest.json'].sort(), 'unmanifested or missing artifact');
  for (const artifact of manifest.artifacts) {
    const data = await readBounded(join(root, artifact.name), artifact.bytes);
    assert.equal(data.length, artifact.bytes, 'artifact size mismatch');
    assert.equal(sha256(data), artifact.sha256, 'artifact content mismatch');
  }
  return { scope: 'software-evidence-integrity-not-release-authorization', integrity: 'PASS',
    authenticity: expectedManifestSha256 ? 'external-digest-required-trust' : 'UNVERIFIED',
    integrityVerdict: expectedManifestSha256 ? 'ACCEPT' : 'INCONCLUSIVE',
    verdict: manifest.gates.some((gate) => gate.verdict === 'REJECT') ? 'REJECT' : 'INCONCLUSIVE',
    manifestSha256: digest, hardwareActuation: false, deployment: 'blocked', artifactCount: manifest.artifacts.length };
}

export async function lockfileInventory(root) {
  const bytes = await readBounded(join(root, 'package-lock.json'), MAX_ARTIFACT_BYTES);
  const lock = JSON.parse(bytes.toString('utf8'));
  const components = Object.entries(lock.packages ?? {}).filter(([path, pkg]) => path && !pkg.link)
    .map(([path, pkg]) => ({ name: pkg.name ?? path.split('node_modules/').at(-1), version: pkg.version ?? 'unknown',
      license: typeof pkg.license === 'string' ? pkg.license : 'unknown' }))
    .sort((a, b) => a.name.localeCompare(b.name, 'en') || a.version.localeCompare(b.version, 'en'));
  return { lockSha256: sha256(bytes), components, unknownLicenses: components.filter((entry) => entry.license === 'unknown').length,
    licenseApproval: 'human-review-required' };
}
