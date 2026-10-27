#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, copyFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
const run = (cmd, args, cwd) => execFileSync(cmd, args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 120000, maxBuffer: 8 * 1024 * 1024 }).trim();
const semver = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?$/;
export function validatePolicy(version, ref, event, dryRun) {
  if (!semver.test(version)) throw Error('Invalid release semver');
  if (!['push', 'workflow_dispatch'].includes(event)) throw Error('Unsupported release event');
  if (event === 'push' && !version.includes('-')) throw Error('Stable publication requires explicit manual dispatch');
  if (event === 'push' || !dryRun) {
    if (ref !== `refs/tags/v${version}`) throw Error('Publish requires matching version tag');
  }
  return version.includes('-') ? 'next' : 'latest';
}
export function inspect(bytes, version) {
  const tar = gunzipSync(bytes, { maxOutputLength: 32 * 1024 * 1024 });
  const files = new Map();
  let ended = false;
  for (let offset = 0; offset + 512 <= tar.length;) {
    const header = tar.subarray(offset, offset + 512);
    if (header.every(v => v === 0)) {
      if (offset + 1024 > tar.length || !tar.subarray(offset).every(v => v === 0) || tar.length % 512 !== 0) throw Error('Invalid tar end or trailing data');
      ended = true;
      break;
    }
    const string = (a, b) => header.subarray(a, b).toString().split('\0')[0];
    const checksumText = string(148, 156).trim();
    if (!/^[0-7]+$/.test(checksumText)) throw Error('Invalid tar checksum');
    const checksum = header.reduce((sum, byte, i) => sum + (i >= 148 && i < 156 ? 32 : byte), 0);
    if (checksum !== parseInt(checksumText, 8)) throw Error('Tar checksum mismatch');
    const name = string(0, 100), prefix = string(345, 500), type = string(156, 157);
    const sizeText = string(124, 136).trim();
    if (!/^[0-7]+$/.test(sizeText)) throw Error('Invalid tar size');
    const size = parseInt(sizeText, 8);
    if (prefix || !['0', ''].includes(type) || !['package/package.json', 'package/README.md', 'package/LICENSE', 'package/dist/bin.js', 'package/dist/index.js', 'package/dist/software-factory.mjs', 'package/dist/factory/core.mjs', 'package/dist/factory/artifacts.mjs', 'package/dist/factory/gist.mjs'].includes(name) || files.has(name)) throw Error(`Disallowed tar entry: ${name}`);
    if (offset + 512 + size > tar.length) throw Error('Truncated tar');
    const body = tar.subarray(offset + 512, offset + 512 + size).toString();
    if (/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|npm_[A-Za-z0-9]{30,}|gh[pousr]_[A-Za-z0-9]{30,}|sk-[A-Za-z0-9]{32,}/.test(body)) throw Error('Possible credential in package');
    files.set(name, body);
    offset += 512 + Math.ceil(size / 512) * 512;
  }
  if (!ended) throw Error('Missing tar end blocks');
  if (files.size !== 9) throw Error('Missing release files');
  const pkg = JSON.parse(files.get('package/package.json'));
  if (pkg.name !== 'dream-machine' || pkg.version !== version || pkg.scripts || pkg.dependencies || pkg.bin?.['dream-machine'] !== 'dist/bin.js' || pkg.bin?.['dream-machine-factory'] !== 'dist/software-factory.mjs') throw Error('Invalid packed manifest');
  return { sha256: createHash('sha256').update(bytes).digest('hex'), integrity: `sha512-${createHash('sha512').update(bytes).digest('base64')}` };
}
async function main() {
  const [command, expected] = process.argv.slice(2);
  const out = resolve('release-artifact');
  if (command === 'stage') {
    const pkg = JSON.parse(readFileSync('packages/cli/package.json'));
    const version = pkg.version;
    const tag = validatePolicy(version, process.env.GITHUB_REF || 'local', process.env.GITHUB_EVENT_NAME || 'workflow_dispatch', process.env.DRY_RUN !== 'false');
    run('git', ['merge-base', '--is-ancestor', 'HEAD', 'origin/main']);
    const stage = mkdtempSync(join(tmpdir(), 'dream-pack-'));
    mkdirSync(join(stage, 'dist/factory'), { recursive: true });
    for (const file of ['bin.js', 'index.js', 'software-factory.mjs', 'factory/core.mjs', 'factory/artifacts.mjs', 'factory/gist.mjs']) copyFileSync(`packages/cli/dist/${file}`, join(stage, 'dist', file));
    copyFileSync('README.md', join(stage, 'README.md'));
    copyFileSync('LICENSE', join(stage, 'LICENSE'));
    delete pkg.scripts; delete pkg.dependencies; delete pkg.types;
    writeFileSync(join(stage, 'package.json'), JSON.stringify(pkg, null, 2));
    mkdirSync(out, { recursive: true });
    const packed = JSON.parse(run('npm', ['pack', '--ignore-scripts', '--json', '--pack-destination', out], stage));
    const path = join(out, packed[0].filename);
    const hashes = inspect(readFileSync(path), version);
    const smoke = mkdtempSync(join(tmpdir(), 'dream-install-'));
    run('npm', ['install', '--ignore-scripts', '--no-audit', '--no-fund', '--prefix', smoke, path], smoke);
    const reported = run('node', [join(smoke, 'node_modules/.bin/dream-machine'), 'version']);
    if (reported !== version) throw Error(`CLI version mismatch: ${reported}`);
    const help = run('node', [join(smoke, 'node_modules/.bin/dream-machine-factory'), '--help']);
    if (!help.includes('factory')) throw Error('Factory CLI smoke failed');
    const receipt = { name: pkg.name, version, tag, filename: packed[0].filename, ...hashes };
    writeFileSync(join(out, 'receipt.json'), JSON.stringify(receipt, null, 2));
    console.log(hashes.sha256);
  } else if (command === 'publish') {
    const receipt = JSON.parse(readFileSync(join(out, 'receipt.json')));
    if (!/^[a-f0-9]{64}$/.test(expected || '')) throw Error('Missing trusted artifact digest');
    if (receipt.filename !== `dream-machine-${receipt.version}.tgz`) throw Error('Invalid artifact filename');
    const file = join(out, receipt.filename);
    const hashes = inspect(readFileSync(file), receipt.version);
    if (hashes.sha256 !== expected || hashes.integrity !== receipt.integrity) throw Error('Artifact digest mismatch');
    const tag = validatePolicy(receipt.version, process.env.GITHUB_REF, process.env.GITHUB_EVENT_NAME, false);
    async function registry() {
      const res = await fetch(`https://registry.npmjs.org/dream-machine/${receipt.version}`, { signal: AbortSignal.timeout(15000) });
      if (res.status === 404) return null;
      if (!res.ok) throw Error(`Registry verification failed: HTTP ${res.status}`);
      return (await res.json()).dist?.integrity;
    }
    const existing = await registry();
    if (existing && existing !== hashes.integrity) throw Error('Version already exists with DIFFERENT bytes');
    if (!existing) {
      const npmVersion = run('npm', ['--version']).split('.').map(Number);
      if (npmVersion[0] < 11 || (npmVersion[0] === 11 && (npmVersion[1] < 5 || (npmVersion[1] === 5 && npmVersion[2] < 1)))) throw Error('npm trusted publishing requires npm >=11.5.1');
      try { run('npm', ['publish', file, '--ignore-scripts', '--provenance', '--access', 'public', '--tag', tag]); }
      catch { throw Error('npm publish failed. Configure npm trusted publisher for this repository, release.yml, and npm-release environment; no token fallback is used.'); }
    }
    for (let attempt = 0; attempt < 12; attempt++) {
      if (await registry() === hashes.integrity) { console.log(`Verified published dream-machine@${receipt.version} integrity`); return; }
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
    throw Error('Published registry integrity not confirmed within 60 seconds');
  } else throw Error('Usage: factory-release.mjs stage | publish <trusted-sha256>');
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main().catch(error => { console.error(error.message); process.exitCode = 1; });
