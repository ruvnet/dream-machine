#!/usr/bin/env node
/** Local development harness. No network server, device driver, signing or deployment action. */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdir, readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { arch, platform, totalmem } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { performance } from 'node:perf_hooks';
import { createEvidenceBundle, lockfileInventory, stableJson, verifyEvidenceBundle } from './mission-evidence.mjs';

export const ROOT = fileURLToPath(new URL('../', import.meta.url));
const EVIDENCE_ROOT = join(ROOT, '.dream', 'evidence');

export function runFixed(command, args, { root = ROOT, timeout = 120_000, maxBuffer = 8 * 1024 * 1024 } = {}) {
  try {
    return { status: 0, stdout: execFileSync(command, args, { cwd: root, timeout, maxBuffer,
      encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, CI: '1', NO_COLOR: '1' } }) };
  } catch (error) {
    return { status: typeof error.status === 'number' ? error.status : null,
      stdout: typeof error.stdout === 'string' ? error.stdout : '', failure: error.signal ? 'interrupted-or-timed-out' : 'command-failed' };
  }
}

function publicVersion(command, args) {
  const result = runFixed(command, args, { timeout: 10_000, maxBuffer: 64 * 1024 });
  // Never publish full command errors, paths, environment or signing identities.
  const version = result.status === 0 ? result.stdout.match(/\b\d+\.\d+(?:\.\d+)?(?:[-+][a-zA-Z0-9.]+)?\b/)?.[0] : undefined;
  return { available: Boolean(version), version: version ?? null };
}

export function doctor(profile = 'software') {
  assert(['software', 'mac'].includes(profile), 'unknown doctor profile');
  const node = process.versions.node.split('.').map(Number);
  const supported = (node[0] === 22 && node[1] >= 13) || node[0] === 24;
  const tools = { npm: publicVersion('npm', ['--version']), git: publicVersion('git', ['--version']) };
  if (profile === 'mac') {
    tools.xcode = publicVersion('xcodebuild', ['-version']);
    tools.rust = publicVersion('rustc', ['--version']);
    tools.arduino = publicVersion('arduino-cli', ['version']);
  }
  const missing = Object.entries(tools).filter(([, value]) => !value.available).map(([name]) => name);
  if (!supported) missing.push('supported-node');
  if (profile === 'mac' && (platform() !== 'darwin' || arch() !== 'arm64')) missing.push('apple-silicon-mac');
  return { schemaVersion: 'dream.doctor.v1', profile, platform: platform(), arch: arch(), node: process.versions.node,
    memoryGiB: Math.floor(totalmem() / (1024 ** 3)), tools, missing,
    verdict: missing.length ? 'INCONCLUSIVE' : 'ACCEPT', hardwareActuation: false,
    caveat: 'availability-only-not-device-permissions-provenance-or-hardware-validation' };
}

/** Conservative tripwire for the declared harness, not an OS sandbox. */
export function inspectDevelopmentPolicy(pkg, configText) {
  // Doctor/bootstrap must load on a fresh checkout before dependencies exist.
  const ts = createRequire(import.meta.url)('typescript');
  const findings = [];
  for (const name of Object.keys({ ...pkg.dependencies, ...pkg.devDependencies })) {
    if (/^@vitest\/(?:ui|browser(?:-|$))/.test(name)) findings.push('prohibited-development-package');
  }
  for (const script of Object.values(pkg.scripts ?? {})) {
    if (typeof script !== 'string' || /(?:--(?:host|api|ui|browser)(?:[=\s]|$)|\besbuild\b[^\n]*\bserve\b)/.test(script)) findings.push('prohibited-development-script');
  }
  const ast = ts.createSourceFile('vitest.config.ts', configText, ts.ScriptTarget.Latest, true);
  const exports = ast.statements.filter(ts.isExportAssignment);
  const configExport = exports.length === 1 && !exports[0].isExportEquals ? exports[0].expression : undefined;
  let calls = 0;
  function fields(object) {
    const result = new Map();
    for (const prop of object.properties) {
      if (!ts.isPropertyAssignment(prop) || (!ts.isIdentifier(prop.name) && !ts.isStringLiteral(prop.name))) {
        findings.push('dynamic-config-property'); continue;
      }
      const name = prop.name.text;
      if (result.has(name)) findings.push('duplicate-config-property');
      result.set(name, prop.initializer);
    }
    return result;
  }
  function visit(node) {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'defineConfig') {
      calls++;
      const config = node.arguments[0];
      if (node !== configExport || node.arguments.length !== 1 || !config || !ts.isObjectLiteralExpression(config)) { findings.push('dynamic-test-config'); return; }
      const configFields = fields(config);
      const test = configFields.get('test');
      if (!test || !ts.isObjectLiteralExpression(test)) { findings.push('missing-static-test-config'); return; }
      const testFields = fields(test);
      for (const field of ['api', 'ui']) {
        if (testFields.get(field)?.kind !== ts.SyntaxKind.FalseKeyword) findings.push(`${field}-must-be-explicitly-disabled`);
      }
      if (testFields.has('browser')) findings.push('dynamic-or-browser-test-config');
      if (['server', 'plugins'].some((field) => configFields.has(field))) findings.push('unreviewed-test-server-extension');
    }
    ts.forEachChild(node, visit);
  }
  visit(ast);
  if (calls !== 1 || ast.parseDiagnostics.length) findings.push('ambiguous-test-config');
  return { verdict: findings.length ? 'REJECT' : 'ACCEPT', findings: [...new Set(findings)].sort(),
    scope: 'declared-harness-configuration-only' };
}

export async function developmentPolicy() {
  return inspectDevelopmentPolicy(JSON.parse(await readFile(join(ROOT, 'package.json'), 'utf8')),
    await readFile(join(ROOT, 'vitest.config.ts'), 'utf8'));
}

function sourceRevision(lockSha256) {
  const revision = runFixed('git', ['rev-parse', 'HEAD']);
  const status = runFixed('git', ['status', '--porcelain=v1']);
  assert(revision.status === 0 && /^[a-f0-9]{40}\n?$/.test(revision.stdout), 'source revision unavailable');
  assert(status.status === 0, 'source status unavailable');
  return { commit: revision.stdout.trim(), dirty: Boolean(status.stdout.trim()), lockSha256 };
}

function audit() {
  const result = runFixed('npm', ['audit', '--json'], { timeout: 90_000 });
  try {
    const data = JSON.parse(result.stdout);
    const counts = data.metadata?.vulnerabilities;
    assert([0, 1].includes(result.status) && !data.error && counts && Number.isSafeInteger(counts.total));
    return { verdict: counts.total === 0 ? 'ACCEPT' : 'REJECT', counts, source: 'npm-advisory-endpoint',
      queriedAt: new Date().toISOString(), dependencies: data.metadata.dependencies };
  } catch { return { verdict: 'INCONCLUSIVE', reason: 'advisory-service-unavailable-or-invalid' }; }
}

async function simulator(options) {
  const { runSimulation } = await import('../packages/edge-sim/dist/index.js');
  return runSimulation({ seed: options.seed, nights: options.full ? 30 : 2,
    malformedCases: options.full ? 1_000_000 : 1000, restartCases: options.full ? 10_000 : 100 });
}

async function benchmark() {
  const { createSimulationFixture } = await import('../packages/edge-sim/dist/index.js');
  const { decodeTicket } = await import('../packages/edge-contracts/dist/index.js');
  // Fixture API supplied by simulator; no external device or private signing key.
  const fixture = createSimulationFixture();
  const bytes = fixture.bytes;
  assert(bytes instanceof Uint8Array, 'simulator benchmark fixture unavailable');
  for (let i = 0; i < 500; i++) decodeTicket(bytes);
  const samples = [];
  const batchSize = 500;
  for (let batch = 0; batch < 30; batch++) {
    for (let i = 0; i < batchSize; i++) {
      const start = performance.now();
      decodeTicket(bytes);
      samples.push(performance.now() - start);
    }
  }
  const sorted = [...samples].sort((a, b) => a - b);
  const quantile = (p) => sorted[Math.ceil(p * sorted.length) - 1];
  return { schemaVersion: 'dream.benchmark.smoke.v1', workload: 'typescript-cbor-decode', samplesMs: samples,
    batchSize, batches: 30, p50Ms: quantile(0.5), p95Ms: quantile(0.95), p99Ms: quantile(0.99),
    verdict: 'INCONCLUSIVE', claimVerdict: 'INCONCLUSIVE', reason: 'shared-host-correlated-samples-not-target-hardware', hardwareActuation: false };
}

export function parseMissionArgs(argv) {
  const { values, positionals } = parseArgs({ args: argv, allowPositionals: true, strict: true, options: {
    full: { type: 'boolean', default: false }, offline: { type: 'boolean', default: false },
    profile: { type: 'string', default: 'software' }, seed: { type: 'string', default: '1' },
    bundle: { type: 'string' }, expected: { type: 'string' },
  } });
  const command = positionals[0] ?? 'doctor';
  assert(positionals.length <= 1 && ['doctor', 'bootstrap', 'test', 'policy', 'security', 'simulate', 'benchmark', 'run', 'verify'].includes(command), 'unknown mission command');
  assert(/^[1-9][0-9]{0,9}(?![\s\S])/.test(values.seed) && Number(values.seed) <= 0xffffffff, 'seed outside uint32');
  assert(['software', 'mac'].includes(values.profile), 'unknown profile');
  if (values.bundle !== undefined) assert(/^run-[a-z0-9-]{1,60}(?![\s\S])/.test(values.bundle), 'invalid bundle directory');
  if (values.expected !== undefined) assert(/^[a-f0-9]{64}(?![\s\S])/.test(values.expected), 'invalid expected digest');
  if (values.offline) assert(['bootstrap', 'run'].includes(command), '--offline applies only to bootstrap or run');
  if (values.full) assert(['simulate', 'run'].includes(command), '--full applies only to simulate or run');
  if (command === 'verify') assert(values.bundle, 'verify requires --bundle');
  else assert(values.bundle === undefined && values.expected === undefined, 'bundle flags require verify');
  return { command, ...values, seed: Number(values.seed) };
}

export async function main(argv = process.argv.slice(2)) {
  const options = parseMissionArgs(argv);
  if (options.command === 'doctor') return doctor(options.profile);
  if (options.command === 'policy') return developmentPolicy();
  if (options.command === 'bootstrap' || options.command === 'test') {
    const args = options.command === 'test' ? ['run', 'check'] : ['ci', '--ignore-scripts', ...(options.offline ? ['--offline'] : [])];
    const result = runFixed('npm', args, { timeout: 300_000 });
    return { command: options.command, verdict: result.status === 0 ? 'ACCEPT' : 'REJECT', exitCode: result.status,
      detail: result.status === 0 ? 'fixed-command-passed' : 'run-command-directly-for-local-diagnostics' };
  }
  if (options.command === 'security') return audit();
  if (options.command === 'simulate') return simulator(options);
  if (options.command === 'benchmark') return benchmark();
  if (options.command === 'verify') return verifyEvidenceBundle(join(EVIDENCE_ROOT, options.bundle), options.expected);

  const preflight = doctor(options.profile);
  const policy = await developmentPolicy();
  assert(preflight.verdict === 'ACCEPT' && policy.verdict === 'ACCEPT', 'preflight or policy blocked');
  const initialInventory = await lockfileInventory(ROOT);
  const initialSource = sourceRevision(initialInventory.lockSha256);
  const check = runFixed('npm', ['run', 'check'], { timeout: 300_000 });
  assert.equal(check.status, 0, 'repository check failed');
  const simulation = await simulator(options);
  const inventory = await lockfileInventory(ROOT);
  const source = sourceRevision(inventory.lockSha256);
  const sourceChanged = source.commit !== initialSource.commit || source.lockSha256 !== initialSource.lockSha256;
  const parserBenchmark = await benchmark();
  const { benchmarkRecall } = await import('../packages/memory/benchmarks/recall.mjs');
  const memoryBenchmark = benchmarkRecall();
  const { runTicketParserFuzz } = await import('../packages/edge-contracts/dist/fuzz.js');
  const parserFuzz = runTicketParserFuzz(options.seed, options.full ? 1_000_000 : 10_000);
  const sbomResult = runFixed('npm', ['sbom', '--package-lock-only', '--sbom-format', 'cyclonedx']);
  assert.equal(sbomResult.status, 0, 'SBOM command failed');
  const sbom = JSON.parse(sbomResult.stdout);
  assert(sbom.bomFormat === 'CycloneDX', 'invalid SBOM');
  const security = options.offline ? { verdict: 'INCONCLUSIVE', reason: 'offline-advisory-refresh-skipped' } : audit();
  const artifacts = { 'doctor.json': preflight, 'simulation.json': simulation, 'licenses.json': inventory,
    'sbom.cdx.json': sbom, 'development-policy.json': policy, 'security.json': security,
    'parser-fuzz.json': parserFuzz, 'parser-benchmark.json': parserBenchmark, 'memory-benchmark.json': memoryBenchmark,
    'tests.json': { command: 'npm run check', exitCode: check.status, scope: 'software-only' } };
  const gates = [
    { name: 'tests', verdict: 'ACCEPT', reason: 'repository-check-passed' },
    { name: 'simulation', verdict: simulation.verdict, reason: 'synthetic-only' },
    { name: 'source', verdict: sourceChanged ? 'REJECT' : (source.dirty || initialSource.dirty) ? 'INCONCLUSIVE' : 'ACCEPT',
      reason: sourceChanged ? 'source-changed-during-check' : (source.dirty || initialSource.dirty) ? 'uncommitted-source' : 'clean-commit' },
    { name: 'benchmark-claims', verdict: 'INCONCLUSIVE', reason: 'descriptive-shared-host-not-hardware-evidence' },
    { name: 'dependencies', verdict: security.verdict, reason: 'advisory-query-result' },
    { name: 'licenses', verdict: 'INCONCLUSIVE', reason: 'inventory-not-legal-approval' },
    { name: 'physical-release', verdict: 'INCONCLUSIVE', reason: 'hardware-isolation-and-hil-unmeasured' },
  ];
  await mkdir(EVIDENCE_ROOT, { recursive: true, mode: 0o700 });
  const name = `run-${Date.now()}-${randomBytes(4).toString('hex')}`;
  const bundle = await createEvidenceBundle(join(EVIDENCE_ROOT, name), { source, artifacts, gates });
  const verification = await verifyEvidenceBundle(bundle.directory, bundle.manifestSha256);
  return { verdict: gates.some((gate) => gate.verdict === 'REJECT') ? 'REJECT' : 'INCONCLUSIVE',
    softwareChecks: simulation.verdict, bundle: name, manifestSha256: bundle.manifestSha256, verification, gates,
    hardwareActuation: false, deployment: 'blocked' };
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  main().then((result) => {
    process.stdout.write(stableJson(result));
    if (result.verdict === 'REJECT') process.exitCode = 1;
    else if (result.verdict === 'INCONCLUSIVE') process.exitCode = 2;
  }).catch(() => {
    // Do not echo untrusted artifact paths, process errors, secrets or raw data.
    process.stderr.write('Mission blocked: invalid input, missing prerequisite, or failed gate.\n');
    process.exitCode = 1;
  });
}
