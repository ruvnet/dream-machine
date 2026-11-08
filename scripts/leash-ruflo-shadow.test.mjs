import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createLeashProbe, createRufloShadow } from './leash-ruflo-shadow.mjs';

const metadata = () => ({ taskId: 'public:test', permitted: true, drift: false,
  activation: [1, 2], identity: { model: 'contract-fixture' } });
const answer = () => ({ model: 'sonnet', reasoning: 'PRIVATE_REASONING', extension: { preserved: true } });

test('local linear scorer binds model identity, threshold and detached bank', () => {
  const identity = { model: 'fixture', revision: 'a'.repeat(40), artifactDigest: 'b'.repeat(64),
    layer: 1, position: 'last_prompt_token' };
  const bank = { weight: [2, -1], bias: 1, identity };
  const probe = createLeashProbe(bank, { threshold: 1 });
  bank.weight[0] = 0;
  assert.equal(probe({ activation: [1, 2], identity }).action, 'recommend_weak');
  const result = probe({ activation: [2, 2], identity });
  assert.equal(result.score, 3); assert.equal(result.action, 'recommend_strong');
  assert.equal(result.authorized, false); assert.match(probe.fingerprint, /^[a-f0-9]{64}$/);
  assert.throws(() => probe({ activation: [2, 2], identity: { ...identity, revision: 'c'.repeat(40) } }));
  assert.throws(() => probe({ activation: [Infinity, 2], identity }));
  assert.throws(() => createLeashProbe(bank, { threshold: NaN }));
});

test('preserves async original result identity, receiver, arguments and private fields', async () => {
  const result = answer(), embedding = [3, 4];
  let calls = 0;
  const router = { async route(...args) {
    assert.equal(this, router); calls++; assert.deepEqual(args, ['PRIVATE_PROMPT', embedding]); return result;
  } };
  const shadow = createRufloShadow(router, { probe: async context => {
    assert.deepEqual(Object.keys(context).sort(), ['activation', 'identity']);
    context.activation[0] = 999;
    return { authorized: false, action: 'recommend_strong', prose: 'IGNORED' };
  } });
  const meta = metadata();
  assert.equal(await shadow.routeWithShadow(meta, 'PRIVATE_PROMPT', embedding), result);
  assert.equal(calls, 1); assert.equal(meta.activation[0], 1);
  assert.equal(shadow.receipts[0].suggestedRoute, 'recommend_strong');
  const serialized = JSON.stringify(shadow.receipts);
  for (const value of ['PRIVATE_PROMPT', 'PRIVATE_REASONING', 'IGNORED', 'contract-fixture']) assert.ok(!serialized.includes(value));
});

test('permission and drift abstain without invoking probe', async () => {
  const shadow = createRufloShadow({ route: async () => answer() }, { probe: () => { throw Error('must not run'); } });
  for (const meta of [{ ...metadata(), permitted: false }, { ...metadata(), drift: true }]) {
    await shadow.routeWithShadow(meta, 'public');
    assert.equal(shadow.receipts.at(-1).suggestedRoute, 'abstain');
    assert.equal(shadow.receipts.at(-1).authorized, false);
  }
});

test('failures and authorizing output cannot change original route', async () => {
  for (const probe of [() => { throw Error('PRIVATE'); }, () => ({ authorized: true, action: 'recommend_strong' })]) {
    const result = answer();
    const shadow = createRufloShadow({ route: async () => result }, { probe });
    assert.equal(await shadow.routeWithShadow(metadata(), 'public'), result);
    assert.equal(shadow.receipts[0].suggestedRoute, null);
    assert.equal(shadow.receipts[0].status, 'probe_error');
  }
});

test('timeout bounds async waiting and retains a single pending slot', async () => {
  const shadow = createRufloShadow({ route: async () => answer() }, {
    probe: () => new Promise(() => {}), timeoutMs: 5, maxReceipts: 1,
  });
  await shadow.routeWithShadow(metadata(), 'public');
  assert.equal(shadow.receipts[0].status, 'timeout_advisory');
  await shadow.routeWithShadow(metadata(), 'public');
  assert.equal(shadow.receipts.length, 1); assert.equal(shadow.receipts[0].status, 'busy_abstain');
  const detached = shadow.receipts; detached[0].authorized = true;
  assert.equal(shadow.receipts[0].authorized, false);
});

test('original rejection propagates unchanged and invalid metadata is contained', async () => {
  const error = Error('original error');
  const failing = createRufloShadow({ route: async () => { throw error; } }, { probe: () => {} });
  await assert.rejects(failing.routeWithShadow(metadata(), 'public'), value => value === error);
  const result = answer();
  const shadow = createRufloShadow({ route: async () => result }, { probe: () => {} });
  assert.equal(await shadow.routeWithShadow(null, 'public'), result);
  assert.equal(shadow.receipts[0].status, 'invalid_input');
});
