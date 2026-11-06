import { generateKeyPairSync } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { broker, replay } from './virtual-view-broker.mjs';

// Optional local RuView adapter path; never downloads code or discovers credentials.
const keys = generateKeyPairSync('ed25519');
const adapter = process.argv[2] ? (await import(pathToFileURL(resolve(process.argv[2])).href))
  .createVirtualViewAdapter({ broker, privateKey: keys.privateKey, enabled: true }) : null;
const scene = { schema: 'virtual-view.v1', sceneId: 'bench', requestId: 'bench', policyId: 'frozen-fixture',
  revision: 1, frame: 'room_enu', proof: 'SYNTHETIC', nowMs: 1000, observedMs: 999,
  contact: 'static', target: 'o0', reference: 'o1', physicalAxis: 'x',
  objects: Array.from({ length: 256 }, (_, i) => ({ id: `o${i}`, observed: [i / 100, i % 3, 0.1],
    predicted: [i / 100, i % 3, 0.1], size: [0.01, 0.01, 0.01], uncertaintyM: 0.015, sourceReceipt: `fixture:${i}` })) };
const times = [];
let replayed = 0, released = 0;
for (let i = 0; i < 1100; i++) {
  scene.requestId = `bench:${i}`;
  const start = performance.now();
  const r = adapter ? adapter.observe(scene) : broker(scene, keys);
  const elapsed = performance.now() - start;
  if (!replay(r.receipt, keys.publicKey).valid) throw Error('replay failed');
  if (i >= 100) { times.push(elapsed); replayed++; if (r.svg) released++; }
}
times.sort((a, b) => a - b);
console.log(JSON.stringify({ evidence: 'MEASURED_LOCAL_SOFTWARE_SYNTHETIC_SCENES', node: process.version,
  samples: times.length, objects: 256, warmup: 100, p50Ms: times[499], p95Ms: times[949], maxMs: times.at(-1),
  replayed, released, ruviewAdapter: Boolean(adapter), hardwareTrials: 0, authority: 'none' }, null, 2));
if (times[949] >= 150 || replayed !== 1000) process.exitCode = 1;
