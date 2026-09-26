/**
 * Strict ruOS evidence evaluator shared by the source-tree compatibility CLI
 * and the packaged dream-machine CLI. Hashes bind evidence; they do not
 * authenticate the collector or grant promotion authority.
 */
import { createHash } from 'node:crypto';
import { Buffer } from 'node:buffer';
import { inflateSync } from 'node:zlib';

const MAX_CANONICAL_NODES = 10_000;
const MAX_IMAGE_BYTES = 12 * 1024 * 1024;
const MAX_DECODED_IMAGE_BYTES = 64 * 1024 * 1024;
const MAX_PIXELS = 16_777_216;

function canonical(value) {
  let nodes = 0;
  const seen = new Set();
  const walk = (v, depth) => {
    if (++nodes > MAX_CANONICAL_NODES || depth > 32) throw new Error('INVALID_JSON_VALUE');
    if (v === null || typeof v === 'boolean' || typeof v === 'string') return JSON.stringify(v);
    if (typeof v === 'number' && Number.isFinite(v)) return JSON.stringify(v);
    if (!v || typeof v !== 'object' || seen.has(v)) throw new Error('INVALID_JSON_VALUE');
    seen.add(v);
    let out;
    if (Array.isArray(v)) {
      if (Object.getPrototypeOf(v) !== Array.prototype || Object.getOwnPropertySymbols(v).length ||
          Object.keys(v).length !== v.length || Object.getOwnPropertyNames(v).length !== v.length + 1) {
        throw new Error('INVALID_JSON_VALUE');
      }
      const parts = [];
      for (let i = 0; i < v.length; i++) {
        const d = Object.getOwnPropertyDescriptor(v, String(i));
        if (!d || !Object.hasOwn(d, 'value')) throw new Error('INVALID_JSON_VALUE');
        parts.push(walk(d.value, depth + 1));
      }
      out = `[${parts.join(',')}]`;
    } else {
      if (Object.getPrototypeOf(v) !== Object.prototype || Object.getOwnPropertySymbols(v).length) {
        throw new Error('INVALID_JSON_VALUE');
      }
      const keys = Object.keys(v).sort();
      if (Object.getOwnPropertyNames(v).length !== keys.length ||
          keys.some((k) => !Object.hasOwn(Object.getOwnPropertyDescriptor(v, k), 'value'))) {
        throw new Error('INVALID_JSON_VALUE');
      }
      out = `{${keys.map((k) => `${JSON.stringify(k)}:${walk(v[k], depth + 1)}`).join(',')}}`;
    }
    seen.delete(v);
    return out;
  };
  return walk(value, 0);
}

export const digest = (value) => createHash('sha256').update(canonical(value)).digest('hex');
const hash = (value) => createHash('sha256').update(value).digest('hex');
const object = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const exact = (v, keys) => object(v) && Object.keys(v).every((k) =>
  keys.includes(k) && Object.hasOwn(Object.getOwnPropertyDescriptor(v, k), 'value'));
const hex = (v, n) => typeof v === 'string' && new RegExp(`^[a-f0-9]{${n}}$`).test(v);
const token = (v) => typeof v === 'string' && /^[A-Za-z0-9_.:/@-]{1,200}$/.test(v);
const nonnegative = (v) => typeof v === 'number' && Number.isFinite(v) && v >= 0;
const ids = (v) => Array.isArray(v) && v.length > 0 && v.length <= 1000 &&
  v.every(token) && new Set(v).size === v.length;
const bindingKeys = ['candidateCommit', 'baseCommit', 'sourceCommit', 'evaluatorDigest',
  'runNonce', 'machineId', 'workloadDigest', 'environmentDigest'];

function validPolicy(p) {
  return exact(p, ['schemaVersion', 'bindings', 'expectedTenant', 'assertionIds', 'caseIds',
    'ttlMs', 'maxFutureSkewMs', 'minSamples', 'maxLatencyRegression', 'maxCostRegression',
    'maxSuccessDrop']) && p.schemaVersion === 1 && exact(p.bindings, bindingKeys) &&
    bindingKeys.every((k) => k.endsWith('Commit') ? hex(p.bindings[k], 40) :
      k.endsWith('Digest') ? hex(p.bindings[k], 64) : token(p.bindings[k])) &&
    token(p.expectedTenant) && ids(p.assertionIds) && ids(p.caseIds) &&
    ['ttlMs', 'maxFutureSkewMs', 'maxLatencyRegression', 'maxCostRegression', 'maxSuccessDrop']
      .every((k) => nonnegative(p[k])) &&
    p.ttlMs > 0 && p.ttlMs <= 86_400_000 && p.maxFutureSkewMs <= 60_000 &&
    p.maxLatencyRegression <= 1 && p.maxCostRegression <= 1 && p.maxSuccessDrop <= 1 &&
    Number.isSafeInteger(p.minSamples) && p.minSamples > 0 && p.minSamples <= 1_000_000;
}

function result(status, reasons) {
  return { schemaVersion: 1, status, reasons: [...new Set(reasons)].sort(), authority: 'none',
    mergeEligible: false, scope: 'observation-contract', performanceImprovementClaimed: false,
    policyDigest: null, observationDigest: null, baselineDigest: null, candidateDigest: null,
    evaluatedAtMs: null, validUntilMs: null };
}

let crcTable;
function crc32(bytes) {
  if (!crcTable) {
    crcTable = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      crcTable[n] = c >>> 0;
    }
  }
  let c = 0xffffffff;
  for (const byte of bytes) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/**
 * Validate and fully inflate a bounded, non-interlaced PNG screenshot.
 * JPEG is deliberately unsupported until a maintained decoder is available;
 * marker-only parsing cannot establish pixels.
 */
export function validateImageBytes(bytes, mime) {
  if (!Buffer.isBuffer(bytes) || bytes.length < 57 || bytes.length > MAX_IMAGE_BYTES ||
      mime !== 'image/png' || !bytes.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex'))) {
    return false;
  }
  let pos = 8;
  let width = 0;
  let height = 0;
  let bitsPerPixel = 0;
  let ihdr = false;
  let iend = false;
  let sawIdat = false;
  let idatEnded = false;
  const idat = [];
  const allowedCritical = new Set(['IHDR', 'PLTE', 'IDAT', 'IEND']);
  while (pos + 12 <= bytes.length && !iend) {
    const length = bytes.readUInt32BE(pos);
    if (length > MAX_IMAGE_BYTES || length > bytes.length - pos - 12) return false;
    const typeStart = pos + 4;
    const dataStart = pos + 8;
    const crcStart = dataStart + length;
    const type = bytes.toString('ascii', typeStart, dataStart);
    if (!/^[A-Za-z]{4}$/.test(type)) return false;
    if (bytes.readUInt32BE(crcStart) !== crc32(bytes.subarray(typeStart, crcStart))) return false;
    const data = bytes.subarray(dataStart, crcStart);
    if (!ihdr) {
      if (type !== 'IHDR' || length !== 13) return false;
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      const bitDepth = data[8];
      const colorType = data[9];
      const validDepths = { 0: [1, 2, 4, 8, 16], 2: [8, 16], 3: [1, 2, 4, 8], 4: [8, 16], 6: [8, 16] };
      const channels = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 };
      if (!width || !height || width * height > MAX_PIXELS ||
          !validDepths[colorType]?.includes(bitDepth) || data[10] !== 0 || data[11] !== 0 ||
          data[12] !== 0) return false;
      bitsPerPixel = channels[colorType] * bitDepth;
      ihdr = true;
    } else if (type === 'IHDR' || (type.charCodeAt(0) & 32) === 0 && !allowedCritical.has(type)) {
      return false;
    } else if (type === 'IDAT') {
      if (idatEnded) return false;
      sawIdat = true;
      idat.push(data);
    } else {
      if (sawIdat) idatEnded = true;
      if (type === 'IEND') {
        if (length !== 0 || !sawIdat) return false;
        iend = true;
      }
    }
    pos = crcStart + 4;
  }
  if (!ihdr || !iend || pos !== bytes.length) return false;
  const rowBytes = Math.ceil(width * bitsPerPixel / 8);
  const decodedLength = (rowBytes + 1) * height;
  if (!Number.isSafeInteger(decodedLength) || decodedLength <= 0 || decodedLength > MAX_DECODED_IMAGE_BYTES) {
    return false;
  }
  try {
    const decoded = inflateSync(Buffer.concat(idat), { maxOutputLength: decodedLength });
    if (decoded.length !== decodedLength) return false;
    for (let row = 0; row < height; row++) if (decoded[row * (rowBytes + 1)] > 4) return false;
    return true;
  } catch {
    return false;
  }
}

function screenshotValid(s) {
  if (!exact(s, ['encoding', 'mime', 'data', 'sha256']) || s.encoding !== 'base64' ||
      typeof s.data !== 'string' || s.data.length > 16 * 1024 * 1024 ||
      !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(s.data)) return false;
  const bytes = Buffer.from(s.data, 'base64');
  return hex(s.sha256, 64) && hash(bytes) === s.sha256 && validateImageBytes(bytes, s.mime);
}

function evaluateObservationRaw(o, p, nowMs = Date.now()) {
  const reject = [];
  const missing = [];
  if (!validPolicy(p) || !nonnegative(nowMs)) return result('REJECT', ['INVALID_POLICY']);
  let policyDigest;
  try { policyDigest = digest(p); } catch { return result('REJECT', ['INVALID_POLICY']); }
  if (!object(o)) return result('INCONCLUSIVE', ['MISSING_OBSERVATION']);
  if (!exact(o, ['schemaVersion', 'arm', 'executedCommit', 'completionVersion', 'completionVerified',
    'bindings', 'timestampMs', 'status', 'exitCode', 'tenant', 'assertions', 'screenshot',
    'humanTakeover', 'contaminated', 'cases'])) reject.push('INVALID_SCHEMA');
  if (o.completionVersion !== 1 || o.completionVerified !== true) missing.push('MISSING_COMPLETION_PROVENANCE');
  if (o.schemaVersion !== 1) reject.push('INVALID_SCHEMA');
  if (!['baseline', 'candidate'].includes(o.arm)) reject.push('INVALID_PAIR_ARMS');
  else if (o.executedCommit !== p.bindings[o.arm === 'baseline' ? 'baseCommit' : 'candidateCommit']) reject.push('EXECUTED_COMMIT_MISMATCH');
  if (!object(o.bindings)) missing.push('MISSING_BINDINGS');
  else if (!exact(o.bindings, [...bindingKeys, 'policyDigest'])) reject.push('BINDING_MISMATCH');
  else if ([...bindingKeys, 'policyDigest'].some((k) => o.bindings[k] !==
    (k === 'policyDigest' ? policyDigest : p.bindings[k]))) reject.push('BINDING_MISMATCH');
  if (o.timestampMs === undefined) missing.push('MISSING_TIMESTAMP');
  else if (!nonnegative(o.timestampMs) || o.timestampMs > nowMs + p.maxFutureSkewMs) reject.push('INVALID_TIMESTAMP');
  else if (nowMs - o.timestampMs > p.ttlMs) missing.push('STALE_OBSERVATION');
  if (o.status === undefined || o.exitCode === undefined || o.exitCode === null) missing.push('MISSING_EXECUTION_RESULT');
  else if (o.status !== 'ok' || o.exitCode !== 0) reject.push('EXECUTION_FAILED');
  if (object(o.tenant) && !exact(o.tenant, ['id', 'verified'])) reject.push('INVALID_SCHEMA');
  if (!object(o.tenant) || o.tenant.verified !== true) missing.push('UNVERIFIED_TENANT');
  if (object(o.tenant) && o.tenant.id !== undefined && o.tenant.id !== p.expectedTenant) reject.push('TENANT_MISMATCH');
  if (object(o.tenant) && o.tenant.id === undefined) missing.push('MISSING_TENANT');
  for (const key of ['humanTakeover', 'contaminated']) {
    if (o[key] === true) reject.push(key === 'humanTakeover' ? 'HUMAN_TAKEOVER' : 'CONTAMINATED');
    else if (o[key] !== false) missing.push('MISSING_ISOLATION_EVIDENCE');
  }
  if (!Array.isArray(o.assertions)) missing.push('MISSING_ASSERTIONS');
  else if (o.assertions.length > 1000) reject.push('INVALID_ASSERTIONS');
  else {
    const seen = new Set();
    for (const a of o.assertions) {
      if (!exact(a, ['id', 'pass']) || !p.assertionIds.includes(a.id) || seen.has(a.id)) {
        reject.push('INVALID_ASSERTIONS'); continue;
      }
      seen.add(a.id);
      if (a.pass === false) reject.push('ASSERTION_FAILED');
      else if (a.pass !== true) missing.push('INCOMPLETE_ASSERTIONS');
    }
    if (p.assertionIds.some((id) => !seen.has(id))) missing.push('MISSING_ASSERTIONS');
  }
  if (o.screenshot === undefined || o.screenshot === null) missing.push('MISSING_SCREENSHOT');
  else if (!screenshotValid(o.screenshot)) reject.push('INVALID_SCREENSHOT');
  if (!Array.isArray(o.cases)) missing.push('MISSING_CASES');
  else if (o.cases.length > 1000) reject.push('INVALID_CASES');
  else {
    const seen = new Set();
    for (const c of o.cases) {
      if (!exact(c, ['id', 'samples', 'latencyMs', 'cost', 'successRate']) ||
          !p.caseIds.includes(c.id) || seen.has(c.id)) { reject.push('INVALID_CASES'); continue; }
      seen.add(c.id);
      if (!Number.isSafeInteger(c.samples) || c.samples < 0 ||
          !['latencyMs', 'cost', 'successRate'].every((k) => nonnegative(c[k])) || c.successRate > 1) {
        reject.push('INVALID_METRICS');
      } else if (c.samples < p.minSamples) missing.push('INSUFFICIENT_SAMPLES');
    }
    if (p.caseIds.some((id) => !seen.has(id))) missing.push('MISSING_CASES');
  }
  return result(reject.length ? 'REJECT' : missing.length ? 'INCONCLUSIVE' : 'ACCEPT', [...reject, ...missing]);
}

function evaluatePairRaw(b, c, p, nowMs = Date.now()) {
  const br = evaluateObservation(b, p, nowMs);
  const cr = evaluateObservation(c, p, nowMs);
  if (br.status === 'REJECT' || cr.status === 'REJECT') return result('REJECT', [...br.reasons, ...cr.reasons]);
  if (br.status !== 'ACCEPT' || cr.status !== 'ACCEPT') return result('INCONCLUSIVE', [...br.reasons, ...cr.reasons]);
  if (b.arm !== 'baseline' || c.arm !== 'candidate') return result('REJECT', ['INVALID_PAIR_ARMS']);
  const reasons = [];
  for (const id of p.caseIds) {
    const x = b.cases.find((v) => v.id === id);
    const y = c.cases.find((v) => v.id === id);
    if (y.latencyMs > x.latencyMs * (1 + p.maxLatencyRegression)) reasons.push('LATENCY_REGRESSION');
    if (y.cost > x.cost * (1 + p.maxCostRegression)) reasons.push('COST_REGRESSION');
    if (x.successRate - y.successRate > p.maxSuccessDrop + Number.EPSILON) reasons.push('SUCCESS_REGRESSION');
  }
  return result(reasons.length ? 'REJECT' : 'ACCEPT', reasons);
}

const safeDigest = (value) => { try { return digest(value); } catch { return null; } };
function receiptBindings(policy, observations, nowMs) {
  if (!validPolicy(policy) || !nonnegative(nowMs)) return {};
  const policyDigest = safeDigest(policy);
  if (!policyDigest) return {};
  const deadlines = observations.map((o) => object(o) && nonnegative(o.timestampMs) &&
    Number.isFinite(o.timestampMs + policy.ttlMs) ? Math.min(o.timestampMs + policy.ttlMs,
      nowMs + policy.ttlMs) : null);
  return { policyDigest, evaluatedAtMs: nowMs,
    validUntilMs: deadlines.every((v) => v !== null) ? Math.min(...deadlines) : null };
}

export function evaluateObservation(o, p, nowMs = Date.now()) {
  if (safeDigest(p) === null) return result('REJECT', ['INVALID_POLICY']);
  if (o !== undefined && safeDigest(o) === null) return result('REJECT', ['INVALID_SCHEMA']);
  const r = evaluateObservationRaw(o, p, nowMs);
  const bindings = receiptBindings(p, [o], nowMs);
  return { ...r, ...bindings, observationDigest: bindings.policyDigest ? safeDigest(o) : null };
}

export function evaluatePair(b, c, p, nowMs = Date.now()) {
  if (safeDigest(p) === null) return { ...result('REJECT', ['INVALID_POLICY']), scope: 'paired-regression' };
  if ((b !== undefined && safeDigest(b) === null) || (c !== undefined && safeDigest(c) === null)) {
    return { ...result('REJECT', ['INVALID_SCHEMA']), scope: 'paired-regression' };
  }
  const r = evaluatePairRaw(b, c, p, nowMs);
  const bindings = receiptBindings(p, [b, c], nowMs);
  return { ...r, ...bindings, scope: 'paired-regression',
    baselineDigest: bindings.policyDigest ? safeDigest(b) : null,
    candidateDigest: bindings.policyDigest ? safeDigest(c) : null };
}

export function evaluateDocuments(input, policy, nowMs = Date.now()) {
  if (object(input) && ('baseline' in input || 'candidate' in input)) {
    if (!exact(input, ['baseline', 'candidate'])) return result('REJECT', ['INVALID_INPUT']);
    return evaluatePair(input.baseline, input.candidate, policy, nowMs);
  }
  return evaluateObservation(input, policy, nowMs);
}

export function invalidInputReceipt() { return result('REJECT', ['INVALID_INPUT']); }
export function receiptExitCode(receipt) { return receipt.status === 'ACCEPT' ? 0 : receipt.status === 'REJECT' ? 1 : 2; }
