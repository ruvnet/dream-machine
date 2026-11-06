import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { broker, planView, replay, evaluateTrials, POLICY } from './virtual-view-broker.mjs';
const keys = generateKeyPairSync('ed25519');
export function fixture() {
  return { schema: 'virtual-view.v1', sceneId: 'fixture', requestId: 'r1', policyId: 'frozen-policy',
    revision: 1, frame: 'room_enu', proof: 'SYNTHETIC', nowMs: 1000, observedMs: 990,
    contact: 'static', target: 'plug', reference: 'socket', physicalAxis: 'x', objects: [
      { id: 'plug', observed: [0.04, 0.01, 0.05], predicted: [0.04, 0.01, 0.05], size: [0.01, 0.01, 0.02], uncertaintyM: 0.015, sourceReceipt: 'capture:1' },
      { id: 'socket', observed: [0, 0, 0], predicted: [0, 0, 0], size: [0.02, 0.02, 0.01], uncertaintyM: 0.005, sourceReceipt: 'capture:2' }] };
}
test('deterministic complementary SVG and signed replay', () => {
  const s = fixture(); const r = broker(s, keys);
  assert.equal(r.decision, 'RENDER'); assert.notEqual(r.receipt.payload.axis, 'x');
  assert.match(r.svg, /CONCEPTUAL/); assert.equal(replay(r.receipt, keys.publicKey).svg, r.svg);
  assert.deepEqual(broker(s, keys).receipt, r.receipt);
  s.objects[0].observed[0] = 10; assert.equal(replay(r.receipt, keys.publicKey).valid, true);
});
test('confidence skips and every invalid geometry condition blocks', () => {
  for (const [mutate, reason] of [
    [s => s.observedMs = 0, 'stale'], [s => s.contact = 'transition', 'contact_transition'],
    [s => s.objects[0].predicted[0] = 0.2, 'drift'],
    [s => s.objects[0].uncertaintyM = 0.2, 'geometry_unreliable']]) {
    const s = fixture(); mutate(s); const r = broker(s, keys);
    assert.equal(r.decision, 'BLOCK'); assert.equal(r.reason, reason); assert.equal(r.svg, null);
    assert.equal(replay(r.receipt, keys.publicKey).valid, true);
  }
  const s = fixture(); s.objects[0].uncertaintyM = 0.001; assert.equal(planView(s).decision, 'SKIP');
});
test('held geometry must still pass drift; boundary age and drift checked', () => {
  const s = fixture(); s.contact = 'held'; s.observedMs = 900;
  assert.equal(planView(s).decision, 'RENDER'); s.nowMs++; assert.equal(planView(s).reason, 'stale');
});
test('reject nonfinite, malformed, oversized and missing provenance', () => {
  for (const mutate of [s => s.objects[0].observed[0] = NaN,
    s => s.objects[0].size[0] = -1, s => s.objects[1].id = 'plug',
    s => s.objects[0].id = '<script>', s => s.nowMs = 1, s => s.target = 'missing',
    s => s.objects[0].sourceReceipt = '', s => s.objects = Array(257).fill(s.objects[0]),
    s => s.extra = 'x'.repeat(5000)]) {
    const s = fixture(); mutate(s); assert.throws(() => broker(s, keys));
  }
  assert.throws(() => planView(fixture(), { ...POLICY, maxDriftM: 1 }));
});
test('forged signatures, unknown keys and payload mutations fail replay', () => {
  const r = broker(fixture(), keys);
  const bad = structuredClone(r.receipt); bad.payload.input.objects[0].observed[0] = 1;
  assert.equal(replay(bad, keys.publicKey).valid, false);
  assert.equal(replay(r.receipt, generateKeyPairSync('ed25519').publicKey).valid, false);
  bad.signature = ''; assert.equal(replay(bad, keys.publicKey).valid, false);
});
test('getters, sparse arrays and cyclic inputs fail without executing input code', () => {
  const s = fixture(); let reads = 0;
  Object.defineProperty(s, 'extra', { enumerable: true, get() { reads++; return 1; } });
  assert.throws(() => broker(s, keys)); assert.equal(reads, 0);
  const cyclic = fixture(); cyclic.extra = cyclic; assert.throws(() => broker(cyclic, keys));
  const sparse = fixture(); delete sparse.objects[0]; assert.throws(() => broker(sparse, keys));
});
test('late completed work is not released, including exact deadline', () => {
  let t = 0; const r = broker(fixture(), { ...keys, clock: () => t++ * 150 });
  assert.equal(r.reason, 'deadline'); assert.equal(r.svg, null);
  assert.equal(replay(r.receipt, keys.publicKey).valid, true); // planning record, NOT release permission
});
function trials() {
  return ['plug', 'stack', 'drawer'].flatMap(task => ['baseline', 'candidate'].flatMap(arm =>
    Array.from({ length: 50 }, (_, i) => ({ id: `${task}:${arm}:${i}`, task, arm,
      success: i < (arm === 'baseline' ? 20 : 30), addedLatencyMs: 10,
      driftHazard: arm === 'candidate' && i >= 30, blockedBeforeAction: true,
      receiptVerified: true, proof: 'SYNTHETIC' }))));
}
test('synthetic success never establishes hardware acceptance', () => {
  const r = evaluateTrials(trials()); assert.equal(r.criteriaPassed, true); assert.equal(r.verdict, 'INCONCLUSIVE');
  assert.equal(evaluateTrials(trials().map(r => ({ ...r, proof: 'MEASURED' }))).verdict, 'REQUIRES_INDEPENDENT_REVIEW');
});
test('acceptance rejects latency, regression, absent hazards, replay failures and duplicates', () => {
  for (const transform of [
    r => ({ ...r, addedLatencyMs: 150 }), r => ({ ...r, driftHazard: false }),
    r => ({ ...r, receiptVerified: false }), r => ({ ...r, blockedBeforeAction: false }),
    r => ({ ...r, success: r.task === 'drawer' && r.arm === 'candidate' ? false : r.success })]) {
    assert.equal(evaluateTrials(trials().map(transform)).criteriaPassed, false);
  }
  const rows = trials(); rows[1].id = rows[0].id; assert.throws(() => evaluateTrials(rows));
  assert.equal(evaluateTrials(trials().slice(0, 200)).criteriaPassed, false);
});
