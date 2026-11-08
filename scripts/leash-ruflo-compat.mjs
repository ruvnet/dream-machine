/** Local interface check against a reviewed, transpiled upstream ModelRouter. */
import { pathToFileURL } from 'node:url';
import { createRufloShadow } from './leash-ruflo-shadow.mjs';
import assert from 'node:assert/strict';

if (Object.keys(process.env).some(k => /TOKEN|SECRET|PASSWORD|API_KEY/i.test(k))) {
  throw Error('credential-free environment required');
}
for (const flag of ['CLAUDE_FLOW_ROUTER_NEURAL', 'CLAUDE_FLOW_ROUTER_TRAJECTORY', 'CLAUDE_FLOW_ROUTER_PARALLEL']) {
  if (process.env[flag]) throw Error('optional upstream integrations must be disabled');
}
const { ModelRouter } = await import(pathToFileURL(process.argv[2]).href);
const router = new ModelRouter({ statePath: process.argv[3], autoSaveInterval: 100000 });
const upstream = router.route;
let expected, calls = 0;
router.route = async function (...args) {
  calls++;
  expected = await upstream.apply(this, args);
  return expected;
};
const shadow = createRufloShadow(router, { probe: () => {
  throw Error('permission-denied interface test must never call probe');
} });
for (let i = 0; i < 24; i++) {
  const result = await shadow.routeWithShadow({ taskId: `compat:${i}`, permitted: false, drift: false },
    `Explain a unit test for a public parser, case ${i}.`, [0.1, 0.2]);
  assert.equal(result, expected);
  assert.equal(result.routedBy, 'heuristic');
  assert.equal(shadow.receipts.at(-1).suggestedRoute, 'abstain');
}
assert.equal(calls, 24);
console.log(JSON.stringify({ schema: 1, stage: 'UPSTREAM_ROUTER_INTERFACE_ONLY',
  upstreamRevision: '1882006a02487590c8c66a7eec8d7504f6af33c3', calls,
  exactOriginalResultIdentity: true, permissionDeniedProbeCalls: 0,
  providerCalls: 0, productionHookInstalled: false,
  shadowMs: shadow.receipts.map(r => r.shadowMs), promotionAuthorized: false }));
