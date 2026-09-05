import assert from 'node:assert/strict';
import test from 'node:test';
import {
  checkAll, compileSchemas, loadInputs, positiveFixtures, SCHEMA_NAMES,
  validatePlan, validateProjection, validateRegistry, validateUint64Definitions,
} from './check-edge-contracts.mjs';

const inputs = loadInputs();
const validators = compileSchemas(inputs.schemas);
const fixtures = positiveFixtures();
const copy = (value) => structuredClone(value);

function rejects(name, mutate, pattern) {
  const value = copy(fixtures[name]);
  mutate(value);
  assert.throws(() => validateProjection(validators, name, value), pattern);
}

test('all architecture inputs pass one deterministic offline gate', () => {
  const result = checkAll(inputs);
  assert.deepEqual(result, checkAll(inputs));
  assert.equal(result.schemas, 4);
  assert.equal(result.resources, 14);
  assert.equal(result.tools, 14);
  assert.equal(result.engineerDays, 120);
  assert.equal(result.criticalPathWorkdays, 88);
  assert.equal(result.throughP6EngineerDays, 82);
  assert.equal(result.throughP6CriticalPathWorkdays, 50);
});

test('strict schema compilation rejects ignored keywords and disables coercion', () => {
  const schemas = copy(inputs.schemas);
  schemas.observation.typoMinimum = 1;
  assert.throws(() => compileSchemas(schemas), /unknown keyword/);
  rejects('observation', (value) => { value.qualityQ15 = '32767'; });
  assert.equal(typeof fixtures.observation.sequence, 'string');
});

for (const name of SCHEMA_NAMES) {
  test(`${name}: positive fixture validates without mutating the input`, () => {
    const value = copy(fixtures[name]);
    assert.equal(validateProjection(validators, name, value), true);
    assert.deepEqual(value, fixtures[name]);
  });
  test(`${name}: unknown envelope keys fail closed`, () => {
    rejects(name, (value) => { value.actuatorAuthority = 'arm'; });
  });
  test(`${name}: every required envelope field is enforced`, () => {
    for (const field of Object.keys(fixtures[name])) {
      rejects(name, (value) => { delete value[field]; });
    }
  });
}

test('uint64 ranges agree with BigInt for all boundaries and fixed-seed inputs', () => {
  assert(validateUint64Definitions(inputs.schemas) > 4000);
  const schemas = copy(inputs.schemas);
  schemas.observation.$defs.uint64.pattern = '^[0-9]+$';
  assert.throws(() => validateUint64Definitions(schemas), /uint64 boundary/);
  for (const value of [18446744073709551615n, 9007199254740993n, 0n]) {
    const observation = copy(fixtures.observation);
    observation.sequence = String(value);
    assert(validateProjection(validators, 'observation', observation));
  }
  for (const sequence of [0, 1, 9007199254740992, '18446744073709551616', '-1', '01', '1e3', '1\n']) {
    rejects('observation', (value) => { value.sequence = sequence; });
  }
});

test('observation rejects raw strings, private addresses, secrets, malformed IDs and times', () => {
  for (const mutate of [
    (value) => { value.values.respiration_bpm = 'private journal'; },
    (value) => { value.values.heart_bpm = Infinity; },
    (value) => { value.values.heart_bpm = NaN; },
    (value) => { value.values['../private'] = 1; },
    (value) => { value.rawRef = 'file:///private/raw.csi'; },
    (value) => { value.rawRef = `ruv://dream-machine/v1/evidence/${'a'.repeat(64)}`; },
    (value) => { value.privacyClass = 'S0'; },
    (value) => { value.evidenceLevel = 'clinically_validated'; },
    (value) => { value.bootId = '0'.repeat(32); },
    (value) => { value.bootId = 'A'.repeat(32); },
    (value) => { value.bootId += '\n'; },
    (value) => { value.flags = ['stale', 'stale']; },
    (value) => { value.flags = ['unregistered']; },
    (value) => { value.qualityQ15 = 32768; },
    (value) => { value.clockUncertaintyMs = -1; },
    (value) => { value.observedAt = '2026-02-30T00:00:00Z'; },
    (value) => { value.observedAt = '2026-09-04T00:00:00+00:00'; },
    (value) => { value.provenance.signingKey = 'forbidden'; },
  ]) rejects('observation', mutate);
  for (const privacyClass of ['P0', 'P1', 'P2', 'P3']) {
    const value = copy(fixtures.observation);
    value.privacyClass = privacyClass;
    assert(validateProjection(validators, 'observation', value));
  }
});

test('proposals cannot grant authority and their timing and ramp remain bounded', () => {
  for (const mutate of [
    (value) => { value.authority = 'actuate'; },
    (value) => { value.durationMs = 60001; },
    (value) => { value.durationMs = 0; },
    (value) => { value.rampMs = value.durationMs + 1; },
    (value) => { value.latestMonotonicUs = value.earliestMonotonicUs; },
    (value) => { value.latestMonotonicUs = '1'; },
    (value) => { value.signature = 'not a broker'; },
  ]) rejects('cue-proposal', mutate);
});

test('authorized and denied decisions use exactly one noncontradictory digest source', () => {
  for (const field of ['proposalDigest', 'consentDigest', 'policyDigest', 'firmwareDigest']) {
    rejects('safety-decision', (value) => { value[field] = 'b'.repeat(64); });
  }
  rejects('safety-decision', (value) => { delete value.ticket; });
  const denied = copy(fixtures['safety-decision']);
  denied.decision = 'deny';
  delete denied.ticket;
  for (const field of ['proposalDigest', 'consentDigest', 'policyDigest', 'firmwareDigest']) denied[field] = 'a'.repeat(64);
  assert(validateProjection(validators, 'safety-decision', denied));
  for (const field of ['proposalDigest', 'consentDigest', 'policyDigest', 'firmwareDigest']) {
    const missing = copy(denied);
    delete missing[field];
    assert.throws(() => validateProjection(validators, 'safety-decision', missing));
  }
  denied.ticket = copy(fixtures['safety-decision'].ticket);
  assert.throws(() => validateProjection(validators, 'safety-decision', denied));
});

test('ticket rejects missing fields, unknown nested data, replay/time widths and excessive horizon', () => {
  for (const field of Object.keys(fixtures['safety-decision'].ticket)) {
    rejects('safety-decision', (value) => { delete value.ticket[field]; });
  }
  for (const mutate of [
    (value) => { value.ticket.extra = 1; },
    (value) => { value.ticket.consentEpoch = 0; },
    (value) => { value.ticket.consentEpoch = 4294967296; },
    (value) => { value.ticket.sequence = '18446744073709551616'; },
    (value) => { value.ticket.issuedMonotonicUs = value.ticket.expiresMonotonicUs; },
    (value) => { value.ticket.notBeforeMonotonicUs = value.ticket.expiresMonotonicUs; },
    (value) => { value.ticket.expiresMonotonicUs = '3000001'; },
    (value) => { value.ticket.rampMs = 501; },
  ]) rejects('safety-decision', mutate);
  const boundary = copy(fixtures['safety-decision']);
  boundary.ticket.expiresMonotonicUs = '3000000';
  assert(validateProjection(validators, 'safety-decision', boundary));
});

test('64 byte signature encoding rejects pad-bit aliases, padding, wrong length and whitespace', () => {
  const canonical = fixtures['safety-decision'].ticket.signature;
  const alias = `${canonical.slice(0, -1)}B`;
  // This previously matched the schema, despite decoding to the same byte sequence.
  assert.deepEqual(Buffer.from(alias, 'base64url'), Buffer.from(canonical, 'base64url'));
  for (const signature of [alias, `${canonical}=`, `${canonical}\n`, canonical.slice(1), 'A'.repeat(87)]) {
    const value = copy(fixtures['safety-decision']);
    value.ticket.signature = signature;
    assert.equal(validators['safety-decision'](value), false, 'schema itself must reject noncanonical signatures');
    rejects('safety-decision', (value) => { value.ticket.signature = signature; });
  }
  for (const lastByte of [0, 1, 2, 3]) {
    const bytes = Buffer.alloc(64);
    bytes[63] = lastByte;
    const value = copy(fixtures['safety-decision']);
    value.ticket.signature = bytes.toString('base64url');
    assert(validateProjection(validators, 'safety-decision', value));
  }
});

test('all ten bounded evolution mutations have valid typed fixtures', () => {
  const mutations = [
    ['retrieval.featureWeights', [0.2, 0.8], [0.5, 0.5]],
    ['representation.version', 'v1', 'v2'],
    ['policy.timingBin', 'awake_preview', 'likely_nrem'],
    ['policy.cueId', 'cue1', 'cue2'],
    ['policy.minimumCueSpacingSeconds', 600, 900],
    ['policy.maximumIntensityQ15', 100, 50],
    ['router.modelClass', 'rules', 'tiny_local'],
    ['router.computeBudgetMs', 10, 20],
    ['ui.explanationPolicy', 'minimal', 'standard'],
    ['ui.visualizationPolicy', 'summary', 'contrast'],
  ];
  for (const [path, from, to] of mutations) {
    const value = copy(fixtures['evolution-candidate']);
    value.mutation = { path, from, to };
    assert(validateProjection(validators, 'evolution-candidate', value));
  }
});

test('evolution rejects authority changes, adverse directions, missing rollback and invalid expiry', () => {
  for (const mutate of [
    (value) => { value.authorityDelta = 'raise_limits'; },
    (value) => { value.mutation = { path: 'policy.minimumCueSpacingSeconds', from: 900, to: 600 }; },
    (value) => { value.mutation = { path: 'policy.maximumIntensityQ15', from: 100, to: 101 }; },
    (value) => { value.mutation = { path: 'policy.arm', from: false, to: true }; },
    (value) => { value.mutation = { path: 'retrieval.featureWeights', from: [1], to: [0.5, 0.5] }; },
    (value) => { value.mutation.extra = 'hidden mutation'; },
    (value) => { value.expiresAt = value.createdAt; },
    (value) => { value.expiresAt = '2026-09-03T00:00:00Z'; },
    (value) => { value.evidenceRefs = ['https://external.invalid/collect']; },
    (value) => { value.evidenceRefs = [`ruv://dream-machine/v1/evidence/${'a'.repeat(64)}?token=secret`]; },
    (value) => { delete value.rollbackDigest; },
  ]) rejects('evolution-candidate', mutate);
});

test('registry rejects audience broadening and tool or authority drift', () => {
  for (const mutate of [
    (value) => { value.audiencePolicyByPrivacyClass.P1.default.push('cloud_model'); },
    (value) => { value.audiencePolicyByPrivacyClass.P2.explicitGrant.push('cloud_model'); },
    (value) => { value.audiencePolicyByPrivacyClass.P3.denied = []; },
    (value) => { value.resources.find((entry) => entry.name === 'night_summary').modelVisibleByDefault = true; },
    (value) => { value.resources.find((entry) => entry.name === 'night_signal_window').subscribable = true; },
    (value) => { value.resources.find((entry) => entry.name === 'cue_receipt').privacyClass = 'P0'; },
    (value) => { value.tools.find((entry) => entry.name === 'dream_mute').authority = 'arm'; },
    (value) => { value.tools.find((entry) => entry.name === 'dream_cue_propose').allowedPrincipalClasses.push('cloud_model'); },
    (value) => { value.tools.find((entry) => entry.name === 'dream_report_record').allowedPrincipalClasses.push('local_model'); },
    (value) => { value.tools[0].requiredScope = '*'; },
    (value) => { value.tools[0].name = 'dream_arm'; },
    (value) => { value.forbiddenToolEffects.pop(); },
    (value) => { value.resources.push(copy(value.resources[0])); },
    (value) => { value.protocolDate = '2026-02-30'; },
  ]) {
    const registry = copy(inputs.registry);
    mutate(registry);
    assert.throws(() => validateRegistry(registry));
  }
});

test('registry rejects traversal, encoding, authority, query and template alias changes', () => {
  const canonical = inputs.registry.resources[0].uriTemplate;
  for (const uriTemplate of [
    canonical.replace('dream-machine', 'evil.invalid'),
    canonical.replace('/v1/', '/v1/../v1/'),
    canonical.replace('{deviceId}', '%2Fprivate'),
    canonical.replace('{deviceId}', '%252fprivate'),
    canonical.replace('{deviceId}', '{unknown}'),
    canonical.replace('{deviceId}', '..'),
    canonical.replace('{deviceId}', ''),
    `${canonical}?scope=*`, `${canonical}#raw`,
  ]) {
    const registry = copy(inputs.registry);
    registry.resources[0].uriTemplate = uriTemplate;
    assert.throws(() => validateRegistry(registry));
  }
});

test('work estimates are graph-derived, not phase-array-order dependent', () => {
  const plan = copy(inputs.plan);
  plan.phases.reverse();
  assert.deepEqual(validatePlan(plan), validatePlan(inputs.plan));
});

test('fixed seventy-night research cannot authorize generated candidate exploration or imply promotion', () => {
  for (const mutate of [
    (value) => { value.phases[8].protocolKind = 'generated-candidate-exploration'; },
    (value) => { value.phases[8].generatedCandidateMinimumEligibleNights = 70; },
    (value) => { value.phases[8].generatedCandidateMinimumEligibleNights = 139; },
    (value) => { delete value.phases[8].generatedCandidateMinimumEligibleNights; },
    (value) => { value.phases[8].minimumCalendarNights = 69; },
    (value) => { delete value.phases[8].promotionCriteria; },
    (value) => { value.phases[8].promotionCriteria.pop(); },
    (value) => { value.phases[8].exitCriteria = value.phases[8].promotionCriteria; },
    (value) => { value.phases[1].exitCriteria = ['independent-typecheck-gap-resolved-or-formally-waived']; },
  ]) {
    const plan = copy(inputs.plan);
    mutate(plan);
    assert.throws(() => validatePlan(plan));
  }
});

test('plan rejects cycles, missing dependencies, cost drift, duplicated evidence and excessive workers', () => {
  for (const mutate of [
    (value) => { value.phases[0].dependsOn = ['P9']; },
    (value) => { value.phases[1].dependsOn = ['P10']; },
    (value) => { value.phases[1].dependsOn = ['P1']; },
    (value) => { value.phases[1].dependsOn = ['P0', 'P0']; },
    (value) => { value.phases[1].dependsOn = []; },
    (value) => { value.phases[0].estimatedEngineerDays = 0; },
    (value) => { value.phases[0].estimatedEngineerDays = 1.5; },
    (value) => { value.estimates.totalEngineerDays++; },
    (value) => { value.estimates.fullCriticalPathWorkdays++; },
    (value) => { value.estimates.p0ThroughP6EngineerDays++; },
    (value) => { value.estimates.p0ThroughP6CriticalPathWorkdays++; },
    (value) => { value.estimates.excludesResearchCalendarNights = false; },
    (value) => { value.phases[6].minimumCalendarNights = -1; },
    (value) => { value.completionEvidence.push(value.completionEvidence[0]); },
    (value) => { value.invariants.pop(); },
    (value) => { value.swarm.maxConcurrentWorkersByMemoryGb['32'] = 7; },
    (value) => { value.swarm.requiredFreeMemoryGb = 64; },
    (value) => { value.swarm.fileOwnershipRule = 'any-agent-any-file'; },
  ]) {
    const plan = copy(inputs.plan);
    mutate(plan);
    assert.throws(() => validatePlan(plan));
  }
});
