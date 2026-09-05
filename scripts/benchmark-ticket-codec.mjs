/** Reproducible comparison against reviewed public source, not a hardware claim. */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash, createPublicKey } from 'node:crypto';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir, cpus } from 'node:os';
import { join, resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ts from 'typescript';

export const BASELINE_COMMIT = '35c9fd31ec0369f1c4b0ac7d5eda13d766bbb8cf';
const ROOT = fileURLToPath(new URL('../', import.meta.url));
const hash = (value) => createHash('sha256').update(value).digest('hex');
const typedArrayPrototype = Object.getPrototypeOf(Uint8Array.prototype);
const intrinsic = (name, value) => Object.getOwnPropertyDescriptor(typedArrayPrototype, name).get.call(value);

function normalizeCorpus(corpus) {
  assert(Array.isArray(corpus) && corpus.length > 0 && corpus.length <= 32, 'fixture count');
  const normalized = [];
  for (let index = 0; index < corpus.length; index++) {
    const value = corpus[index];
    assert(value instanceof Uint8Array, 'fixture byte type');
    const length = intrinsic('byteLength', value);
    const buffer = intrinsic('buffer', value);
    assert(length > 0 && length <= 768 && !(buffer instanceof SharedArrayBuffer), 'fixture byte bound');
    normalized.push(Uint8Array.from(new Uint8Array(buffer, intrinsic('byteOffset', value), length)));
  }
  return normalized;
}

/** Only the fixed reviewed commit is executable; no arbitrary revision argument. */
export async function withReference(run) {
  const directory = await mkdtemp(join(tmpdir(), 'dream-codec-reference-'));
  try {
    const sources = {}, candidateSources = {};
    await writeFile(join(directory, 'package.json'), '{"type":"module"}', { mode: 0o600 });
    for (const group of ['reference', 'candidate']) {
      await mkdir(join(directory, group), { mode: 0o700 });
    for (const name of ['index', 'uri']) {
      const path = `packages/edge-contracts/src/${name}.ts`;
      const source = group === 'reference'
        ? execFileSync('git', ['show', `${BASELINE_COMMIT}:${path}`],
          { cwd: ROOT, encoding: 'utf8', timeout: 10000, maxBuffer: 256 * 1024 })
        : await readFile(join(ROOT, path), 'utf8');
      assert(Buffer.byteLength(source) <= 256 * 1024, 'source byte bound');
      (group === 'reference' ? sources : candidateSources)[path] = hash(source);
      const compiled = ts.transpileModule(source, { fileName: `${name}.ts`, reportDiagnostics: true,
        compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } });
      assert(!compiled.diagnostics?.some((item) => item.category === ts.DiagnosticCategory.Error), 'reference transpilation failed');
      await writeFile(join(directory, group, `${name}.js`), compiled.outputText, { mode: 0o600 });
    }
    }
    const reference = await import(pathToFileURL(join(directory, 'reference', 'index.js')).href);
    const candidate = await import(pathToFileURL(join(directory, 'candidate', 'index.js')).href);
    return await run(reference, { commit: BASELINE_COMMIT, sources, candidateSources, compiler: ts.version }, candidate);
  } finally {
    // Only this invocation's mkdtemp directory, never a caller-supplied path.
    await rm(directory, { recursive: true, force: false });
  }
}

export async function fixtures(reference, candidate) {
  const fixture = JSON.parse(await readFile(join(ROOT, 'packages/edge-contracts/fixtures/public-ticket.json'), 'utf8'));
  const golden = { ...fixture.unsignedTicket, signature: fixture.signatureBase64url };
  const integers = ['0', '23', '24', '255', '256', '65535', '65536', '4294967295',
    '4294967296', '9007199254740992', '9223372036854775808', '18446744073709551615'];
  const tickets = [golden, ...integers.map((sequence, index) => {
    const issued = BigInt(sequence) > 2_000_000n ? BigInt(sequence) - 2_000_000n : 0n;
    return { ...golden, sequence, issuedMonotonicUs: issued.toString(), notBeforeMonotonicUs: issued.toString(),
      expiresMonotonicUs: (issued + 2_000_000n).toString(), reasonCode: [0, 23, 24, 255, 256, 65535][index % 6],
      consentEpoch: index % 2 ? 4294967295 : 1, modality: ['audio', 'light', 'haptic'][index % 3] };
  })];
  const bytes = tickets.map((ticket) => reference.encodeTicket(ticket));
  const publicKey = createPublicKey({ key: Buffer.from(`302a300506032b6570032100${fixture.publicKeyHex}`, 'hex'), format: 'der', type: 'spki' });
  for (let index = 0; index < tickets.length; index++) {
    assert.deepEqual(candidate.encodeTicket(tickets[index]), bytes[index]);
    assert.deepEqual(candidate.decodeTicket(bytes[index]), reference.decodeTicket(bytes[index]));
    assert.equal(candidate.verifyTicket(tickets[index], publicKey), reference.verifyTicket(tickets[index], publicKey));
  }
  assert(candidate.verifyTicket(golden, publicKey), 'public golden signature');
  return bytes;
}

export function differential(reference, candidate, corpus, iterations = 10_000, seed = 43) {
  assert(Number.isSafeInteger(iterations) && iterations >= 1 && iterations <= 1_000_000, 'differential iteration bound');
  assert(Number.isSafeInteger(seed) && seed >= 1 && seed <= 0xffffffff, 'seed bound');
  corpus = normalizeCorpus(corpus);
  let state = seed;
  const next = () => { state ^= state << 13; state ^= state >>> 17; state ^= state << 5; return state >>> 0; };
  const digest = createHash('sha256');
  let accepted = 0, rejected = 0;
  const outcome = (implementation, bytes) => {
    const independent = Uint8Array.from(bytes);
    try { return { accepted: true, ticket: implementation.decodeTicket(independent) }; }
    catch (error) { assert(error instanceof implementation.TicketFormatError, 'unexpected parser exception'); return { accepted: false }; }
    finally { assert.deepEqual(independent, bytes, 'parser mutated its independent input'); }
  };
  for (let index = 0; index < iterations; index++) {
    const valid = corpus[next() % corpus.length];
    let bytes;
    switch (index % 8) {
      case 0: bytes = valid.slice(); break;
      case 1: bytes = valid.slice(); bytes[next() % bytes.length] ^= 1 + next() % 255; break;
      case 2: bytes = valid.slice(0, next() % valid.length); break;
      case 3: bytes = new Uint8Array(next() % 770); for (let i = 0; i < bytes.length; i++) bytes[i] = next() & 255; break;
      case 4: bytes = new Uint8Array(valid.length + 1); bytes.set(valid); bytes[bytes.length - 1] = next() & 255; break;
      case 5: bytes = Uint8Array.from([0xb9, 0, 24, ...valid.subarray(2)]); break;
      case 6: bytes = new Uint8Array(769); bytes.set(valid); break;
      default: bytes = valid.slice(); bytes[next() % bytes.length] = next() & 255;
    }
    const length = Buffer.alloc(2); length.writeUInt16BE(bytes.length);
    digest.update(length); digest.update(bytes);
    const original = bytes.slice();
    const before = outcome(reference, bytes);
    const after = outcome(candidate, bytes);
    assert.deepEqual(after, before, `parser outcome differs at case ${index}`);
    assert.deepEqual(bytes, original, 'parser mutated input');
    if (after.accepted) {
      accepted++;
      assert.deepEqual(candidate.encodeTicket(after.ticket), bytes, 'candidate accepted noncanonical bytes');
      assert.deepEqual(reference.encodeTicket(before.ticket), bytes, 'reference canonical disagreement');
    } else rejected++;
  }
  return { verdict: 'ACCEPT', seed, iterations, accepted, rejected, mismatches: 0, corpusSha256: digest.digest('hex'),
    scope: 'same-source-family-differential-not-independent-conformance' };
}

export function timings(reference, candidate, corpus, { batches = 30, batchSize = 1000 } = {}) {
  assert(Number.isSafeInteger(batches) && batches >= 10 && batches <= 100, 'batch count');
  assert(Number.isSafeInteger(batchSize) && batchSize >= 100 && batchSize <= 10000, 'batch size');
  corpus = normalizeCorpus(corpus);
  const samples = { referenceBatchUs: [], candidateBatchUs: [] };
  let checksum = 0;
  const measure = (implementation) => {
    const start = performance.now();
    for (let i = 0; i < batchSize; i++) {
      const decoded = implementation.decodeTicket(corpus[i % corpus.length]);
      checksum += decoded.reasonCode;
    }
    return (performance.now() - start) * 1000 / batchSize;
  };
  for (let i = 0; i < 5; i++) { measure(reference); measure(candidate); }
  for (let batch = 0; batch < batches; batch++) {
    const operations = [['referenceBatchUs', reference], ['candidateBatchUs', candidate]];
    if (batch % 2) operations.reverse();
    for (const [key, implementation] of operations) samples[key].push(measure(implementation));
  }
  const median = (values) => [...values].sort((a, b) => a - b)[Math.ceil(values.length / 2) - 1];
  const original = median(samples.referenceBatchUs), optimized = median(samples.candidateBatchUs);
  return { batches, batchSize, operationsPerImplementation: batches * batchSize, fixtureCount: corpus.length,
    referenceMedianBatchMeanUsPerOperation: original, candidateMedianBatchMeanUsPerOperation: optimized, medianSpeedup: original / optimized,
    checksum, samples, sampleUnits: 'microseconds-per-operation-averaged-within-each-batch', claimVerdict: 'INCONCLUSIVE',
    scope: 'batch-average-decode-only-shared-host-not-individual-latency-or-hardware-p99' };
}

export async function benchmarkTicketCodec({ full = false } = {}) {
  return withReference(async (reference, baseline, candidate) => {
    const corpus = await fixtures(reference, candidate);
    return { schemaVersion: 'dream.codec-comparison.v1', baseline,
      environment: { node: process.versions.node, platform: process.platform, arch: process.arch, cpu: cpus()[0]?.model ?? 'unknown' },
      differential: differential(reference, candidate, corpus, full ? 1_000_000 : 10_000),
      timing: timings(reference, candidate, corpus), hardwareActuation: false, deployment: 'blocked', verdict: 'INCONCLUSIVE' };
  });
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  try {
    assert(process.argv.length === 2 || (process.argv.length === 3 && process.argv[2] === '--full'), 'invalid arguments');
    process.stdout.write(`${JSON.stringify(await benchmarkTicketCodec({ full: process.argv[2] === '--full' }))}\n`);
    process.exitCode = 2; // Differential pass is not acceptance of a hardware performance claim.
  } catch {
    process.stderr.write('Codec comparison failed: missing pinned baseline, invalid input, or differential mismatch.\n');
    process.exitCode = 1;
  }
}
