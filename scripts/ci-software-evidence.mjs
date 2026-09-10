import assert from 'node:assert/strict';
import { main } from './mission.mjs';
import { stableJson } from './mission-evidence.mjs';

// This CI wrapper accepts ONLY the software subset. It cannot promote hardware
// or turn omitted advisory/benchmark/license evidence into an accepted claim.
const result = await main(['run', '--full', '--offline', '--seed', '43']);
assert.equal(result.verdict, 'INCONCLUSIVE');
assert.equal(result.softwareChecks, 'ACCEPT');
assert.equal(result.hardwareActuation, false);
assert.equal(result.deployment, 'blocked');
assert.equal(result.verification.integrityVerdict, 'ACCEPT');
for (const name of ['tests', 'simulation', 'source']) {
  assert.equal(result.gates.find((gate) => gate.name === name)?.verdict, 'ACCEPT', `${name} software gate failed`);
}
for (const name of ['dependencies', 'licenses', 'benchmark-claims', 'physical-release']) {
  assert.equal(result.gates.find((gate) => gate.name === name)?.verdict, 'INCONCLUSIVE', `${name} must remain unproven`);
}
process.stdout.write(stableJson(result));
