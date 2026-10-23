import { createHash, sign, verify } from 'node:crypto';

// Research-only CPU renderer. No I/O, actuator, policy execution or automatic promotion.
export const VERSION = 'virtual-view.v1';
export const POLICY = Object.freeze({ uncertaintyM: 0.01, maxAgeMs: 100,
  maxDriftM: 0.02, maxUncertaintyM: 0.1, maxAddedLatencyMs: 150 });
const assert = (ok, message) => { if (!ok) throw new TypeError(message); };
const finite = (x, lo, hi) => Number.isFinite(x) && x >= lo && x <= hi;
const id = x => typeof x === 'string' && /^[A-Za-z0-9._:-]{1,128}$/.test(x);
export const hash = x => createHash('sha256').update(x).digest('hex');
export function canonical(x, depth = 0, budget = { nodes: 0 }) {
  assert(depth <= 12 && ++budget.nodes <= 20000, 'JSON budget');
  if (typeof x === 'string') assert(x.length <= 4096, 'string budget');
  if (x === null || typeof x === 'boolean' || typeof x === 'string') return JSON.stringify(x);
  if (typeof x === 'number') { assert(Number.isFinite(x), 'nonfinite'); return JSON.stringify(x); }
  if (Array.isArray(x)) {
    assert(x.length <= 1024 && Reflect.ownKeys(x).length === x.length + 1, 'array budget/shape');
    const parts = [];
    for (let i = 0; i < x.length; i++) {
      const d = Object.getOwnPropertyDescriptor(x, String(i));
      assert(d && 'value' in d && d.enumerable, 'array accessor/hole');
      parts.push(canonical(d.value, depth + 1, budget));
    }
    return '[' + parts.join(',') + ']';
  }
  assert(x && Object.getPrototypeOf(x) === Object.prototype, 'plain JSON required');
  const keys = Reflect.ownKeys(x);
  assert(keys.length <= 64 && keys.every(k => typeof k === 'string' && k.length <= 128), 'object budget');
  return '{' + keys.sort().map(k => {
    const d = Object.getOwnPropertyDescriptor(x, k);
    assert('value' in d && d.enumerable, 'object accessor');
    return JSON.stringify(k) + ':' + canonical(d.value, depth + 1, budget);
  }).join(',') + '}';
}
function validate(s) {
  assert(s?.schema === VERSION && id(s.sceneId) && id(s.requestId) && id(s.policyId), 'identity');
  assert(s.frame === 'room_enu' && ['SYNTHETIC', 'CODE', 'MEASURED'].includes(s.proof), 'frame/proof');
  assert(Number.isSafeInteger(s.nowMs) && Number.isSafeInteger(s.observedMs) && s.observedMs >= 0 && s.nowMs >= s.observedMs, 'clock');
  assert(Number.isSafeInteger(s.revision) && s.revision >= 0, 'revision');
  assert(['static', 'held', 'transition'].includes(s.contact), 'contact');
  assert(Array.isArray(s.objects) && s.objects.length >= 2 && s.objects.length <= 256, 'object budget');
  const seen = new Set();
  for (const o of s.objects) {
    assert(id(o.id) && !seen.has(o.id), 'duplicate/invalid object'); seen.add(o.id);
    for (const key of ['observed', 'predicted', 'size']) {
      assert(Array.isArray(o[key]) && o[key].length === 3 && o[key].every(n => finite(n, key === 'size' ? 0.000001 : -1000, 1000)), key);
    }
    assert(finite(o.uncertaintyM, 0, 100) && id(o.sourceReceipt), 'uncertainty/provenance');
  }
  assert(id(s.target) && id(s.reference) && s.target !== s.reference && seen.has(s.target) && seen.has(s.reference), 'relation');
  assert(['x', 'y', 'z'].includes(s.physicalAxis), 'physical view axis');
}
function config(p) {
  assert(Object.keys(p).sort().join() === Object.keys(POLICY).sort().join(), 'policy fields');
  for (const k of Object.keys(POLICY)) assert(finite(p[k], Number.EPSILON, POLICY[k]), 'policy may only tighten defaults');
  assert(p.uncertaintyM <= p.maxUncertaintyM, 'uncertainty thresholds');
}

/** Deterministic decision and conceptual SVG; all coordinates are metres, ENU. */
export function planView(snapshot, policy = POLICY) {
  canonical(snapshot); canonical(policy);
  validate(snapshot); config(policy);
  const s = snapshot;
  const drift = Math.max(...s.objects.map(o => Math.hypot(...o.observed.map((n, i) => n - o.predicted[i]))));
  const target = s.objects.find(o => o.id === s.target);
  const ref = s.objects.find(o => o.id === s.reference);
  const uncertainty = Math.max(target.uncertaintyM, ref.uncertaintyM);
  let reason = s.nowMs - s.observedMs > policy.maxAgeMs ? 'stale' :
    s.contact === 'transition' ? 'contact_transition' :
    drift > policy.maxDriftM ? 'drift' :
    uncertainty > policy.maxUncertaintyM ? 'geometry_unreliable' : null;
  if (reason) return { decision: 'BLOCK', reason, driftM: drift, axis: null, svg: null };
  if (uncertainty < policy.uncertaintyM) return { decision: 'SKIP', reason: 'confident', driftM: drift, axis: null, svg: null };
  // Choose the complementary orthographic plane revealing the largest relative offset.
  const axes = { x: [1, 2], y: [0, 2], z: [0, 1] };
  const candidates = Object.keys(axes).filter(a => a !== s.physicalAxis).map(axis => ({ axis,
    score: Math.hypot(...axes[axis].map(i => target.observed[i] - ref.observed[i])) }));
  candidates.sort((a, b) => b.score - a.score || a.axis.localeCompare(b.axis));
  const axis = candidates[0].axis;
  const [u, v] = axes[axis];
  const extent = Math.max(0.1, ...s.objects.flatMap(o => [u, v].map(i => Math.abs(o.observed[i] - ref.observed[i]) + o.size[i] / 2)));
  const scale = 110 / extent;
  const shapes = [...s.objects].sort((a, b) => a.id.localeCompare(b.id)).map(o => {
    const x = 128 + (o.observed[u] - ref.observed[u] - o.size[u] / 2) * scale;
    const y = 128 - (o.observed[v] - ref.observed[v] + o.size[v] / 2) * scale;
    return `<rect x="${x.toFixed(6)}" y="${y.toFixed(6)}" width="${(o.size[u] * scale).toFixed(6)}" height="${(o.size[v] * scale).toFixed(6)}" fill="none" stroke="${o.id === s.target ? '#ff9500' : '#0088cc'}"/><text x="${x.toFixed(6)}" y="${y.toFixed(6)}" font-size="8">${o.id}</text>`;
  }).join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256"><rect width="256" height="256" fill="white"/>${shapes}<text x="4" y="250" font-size="9">CONCEPTUAL ${axis.toUpperCase()} VIEW / NO ACTION AUTHORITY</text></svg>`;
  return { decision: 'RENDER', reason: 'uncertain_relation', driftM: drift, axis, svg };
}

/** Caller supplies an in-memory Ed25519 key and a monotonic clock. */
export function broker(snapshot, { privateKey, policy = POLICY, clock = () => performance.now() }) {
  assert(privateKey?.asymmetricKeyType === 'ed25519', 'Ed25519 signer required');
  const start = clock();
  canonical(snapshot); // Bound untrusted structure before cloning.
  const input = structuredClone(snapshot);
  const frozenPolicy = { ...policy };
  const result = planView(input, frozenPolicy);
  const payload = { version: VERSION, authority: 'none', input, policy: frozenPolicy,
    decision: result.decision, reason: result.reason, axis: result.axis,
    svgSha256: result.svg === null ? null : hash(result.svg) };
  const bytes = Buffer.from(canonical(payload));
  const receipt = { payload, signature: sign(null, bytes, privateKey).toString('base64') };
  const elapsedMs = clock() - start;
  assert(finite(elapsedMs, 0, Number.MAX_SAFE_INTEGER), 'invalid monotonic clock');
  // Includes validation, rendering, receipt serialization and signing. Late views are NEVER released.
  const timedOut = elapsedMs >= frozenPolicy.maxAddedLatencyMs;
  return { decision: timedOut ? 'BLOCK' : result.decision, reason: timedOut ? 'deadline' : result.reason,
    svg: timedOut ? null : result.svg, receipt, elapsedMs, authority: 'none' };
}

/** Trusted key is supplied out of band; receipt cannot declare its own trust root. */
export function replay(receipt, publicKey) {
  try {
    assert(publicKey?.asymmetricKeyType === 'ed25519', 'Ed25519 verifier required');
    const p = receipt.payload;
    const bytes = Buffer.from(canonical(p));
    assert(bytes.length <= 300000 && typeof receipt.signature === 'string' && receipt.signature.length === 88, 'receipt size');
    assert(verify(null, bytes, publicKey, Buffer.from(receipt.signature, 'base64')), 'signature');
    const result = planView(p.input, p.policy);
    const expected = { version: VERSION, authority: 'none', input: p.input, policy: p.policy,
      decision: result.decision, reason: result.reason, axis: result.axis,
      svgSha256: result.svg === null ? null : hash(result.svg) };
    assert(canonical(p) === canonical(expected), 'replay mismatch');
    return { valid: true, ...result, authority: 'none' };
  } catch { return { valid: false, authority: 'none' }; }
}

/** Three-task gate; caller must independently verify submitted hardware evidence. */
export function evaluateTrials(rows) {
  assert(Array.isArray(rows) && rows.length > 0 && rows.length <= 100000, 'trial count');
  const ids = new Set(); const tasks = new Map();
  for (const r of rows) {
    assert(id(r.id) && !ids.has(r.id) && id(r.task) && ['baseline', 'candidate'].includes(r.arm), 'trial identity'); ids.add(r.id);
    for (const k of ['success', 'driftHazard', 'blockedBeforeAction', 'receiptVerified']) assert(typeof r[k] === 'boolean', k);
    assert(finite(r.addedLatencyMs, 0, 1e6) && ['SYNTHETIC', 'MEASURED'].includes(r.proof), 'trial evidence');
    if (!tasks.has(r.task)) tasks.set(r.task, { baseline: [], candidate: [] });
    tasks.get(r.task)[r.arm].push(r);
  }
  const deltas = [...tasks].map(([task, arms]) => ({ task, baselineN: arms.baseline.length, candidateN: arms.candidate.length,
    gainPoints: arms.baseline.length && arms.candidate.length ? 100 * (arms.candidate.filter(r => r.success).length / arms.candidate.length - arms.baseline.filter(r => r.success).length / arms.baseline.length) : null }));
  const candidates = rows.filter(r => r.arm === 'candidate');
  const times = candidates.map(r => r.addedLatencyMs).sort((a, b) => a - b);
  const hazards = candidates.filter(r => r.driftHazard);
  const driftRecall = hazards.length ? hazards.filter(r => r.blockedBeforeAction).length / hazards.length : null;
  const p95Ms = times.length ? times[Math.ceil(times.length * 0.95) - 1] : null;
  const complete = tasks.size === 3 && deltas.every(d => d.baselineN >= 50 && d.candidateN >= 50) && hazards.length >= 20;
  const criteriaPassed = complete && deltas.filter(d => d.gainPoints >= 20 - 1e-9).length >= 2 && deltas.every(d => d.gainPoints >= -5 - 1e-9)
    && p95Ms < 150 && driftRecall >= 0.95 && candidates.every(r => r.receiptVerified);
  return { deltas, p95Ms, driftRecall, criteriaPassed,
    verdict: !complete || rows.some(r => r.proof !== 'MEASURED') ? 'INCONCLUSIVE' : criteriaPassed ? 'REQUIRES_INDEPENDENT_REVIEW' : 'REJECT',
    authority: 'none', hardwareEvidenceAuthenticated: false };
}
