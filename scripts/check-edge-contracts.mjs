#!/usr/bin/env node
/** Offline architecture gate. This is not a broker, MCP server, or MCU verifier. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

export const REPOSITORY_ROOT = fileURLToPath(new URL('../', import.meta.url));
export const SCHEMA_NAMES = ['observation', 'cue-proposal', 'safety-decision', 'evolution-candidate'];
export const PRINCIPALS = ['local_human', 'local_service', 'local_model', 'cloud_model'];
const UINT64_MAX = (1n << 64n) - 1n;
const ID = '1'.repeat(32);
const DIGEST = 'a'.repeat(64);
const STAMP = '2026-09-04T00:00:00Z';
const PRIVACY = {
  P0: [PRINCIPALS, [], []],
  P1: [PRINCIPALS.slice(0, 3), ['cloud_model'], []],
  P2: [PRINCIPALS.slice(0, 2), ['local_model'], ['cloud_model']],
  P3: [['local_service'], ['local_human'], ['local_model', 'cloud_model']],
};
// Independent privilege ceilings for the frozen v1 surface, not server authorization.
const RESOURCES = {
  device_status: ['devices/{deviceId}/status', 'P1', true],
  consent_current: ['subjects/self/consent/current', 'P2', true],
  night_summary: ['subjects/self/nights/{nightId}/summary', 'P2', true],
  night_signal_window: ['subjects/self/nights/{nightId}/signals/{windowId}', 'P3', false],
  apple_watch_summary: ['subjects/self/nights/{nightId}/apple-watch/summary', 'P2', false],
  apple_watch_quality: ['subjects/self/nights/{nightId}/apple-watch/quality', 'P2', false],
  apple_watch_sync_status: ['subjects/self/apple-watch/sync-status', 'P1', true],
  experiment_protocol: ['experiments/{experimentId}/protocol', 'P1', false],
  active_policy: ['policies/active', 'P1', true],
  candidate_receipt: ['candidates/{candidateId}/receipt', 'P1', false],
  cue_receipt: ['cues/{ticketId}/receipt', 'P2', false],
  evidence: ['evidence/{digest}', 'P2', false],
  latest_benchmarks: ['benchmarks/latest', 'P1', false],
  schema: ['schemas/{name}/{version}', 'P0', false],
};
const TOOLS = {
  dream_status: ['none', 4, 'dream.read.status'],
  dream_session_query: ['none', 3, 'dream.read.session'],
  dream_memory_search: ['none', 3, 'dream.read.memory'],
  dream_intention_set: ['none', 2, 'dream.write.intention'],
  dream_report_record: ['none', 2, 'dream.write.report'],
  dream_experiment_preview: ['none', 4, 'dream.run.preview'],
  dream_cue_propose: ['none', 3, 'dream.write.proposal'],
  dream_mute: ['stop_only', 4, 'dream.safety.stop'],
  dream_receipt_export: ['export_only', 2, 'dream.export.request'],
  apple_watch_status: ['none', 3, 'dream.apple.read.status'],
  apple_watch_sync_now: ['none', 2, 'dream.apple.sync.request'],
  apple_watch_request_live_session: ['local_confirmation_request', 2, 'dream.apple.live.request'],
  apple_watch_stop_live_session: ['stop_only', 4, 'dream.apple.live.stop'],
  apple_watch_delete_data: ['delete_only', 2, 'dream.apple.delete.request'],
};
const FORBIDDEN = ['arm', 'resume', 'cue_execute', 'ticket_mint', 'safety_limit_raise',
  'firmware_install', 'network_destination_add', 'consent_change', 'candidate_promote',
  'release_sign', 'pull_request_merge'];
const PLAN_INVARIANTS = ['evaluation-is-not-promotion', 'model-has-no-actuator-authority',
  'memory-has-no-actuator-authority', 'consent-and-safety-cannot-self-evolve',
  'no-cloud-required-for-nightly-operation', 'all-candidates-have-parent-expiry-evidence-and-rollback',
  'accept-reject-or-inconclusive-only', 'human-signs-flashes-promotes-and-merges'];

function exactKeys(value, keys, label) {
  assert(value && typeof value === 'object' && !Array.isArray(value), `${label}: expected object`);
  assert.deepEqual(Object.keys(value).sort(), [...keys].sort(), `${label}: unexpected key set`);
}

function uniqueStrings(value, label, allowEmpty = false) {
  assert(Array.isArray(value) && (allowEmpty || value.length > 0), `${label}: expected array`);
  assert(value.every((entry) => typeof entry === 'string' && entry.length > 0), `${label}: expected strings`);
  assert.equal(new Set(value).size, value.length, `${label}: duplicate value`);
}

function exactMembers(value, expected, label) {
  uniqueStrings(value, label, expected.length === 0);
  assert.deepEqual([...value].sort(), [...expected].sort(), `${label}: contract drift`);
}

export function loadInputs(root = REPOSITORY_ROOT) {
  const read = (path) => JSON.parse(readFileSync(resolve(root, path), 'utf8'));
  return {
    schemas: Object.fromEntries(SCHEMA_NAMES.map((name) =>
      [name, read(`docs/contracts/edge-v1/${name}.schema.json`)])),
    registry: read('docs/contracts/edge-v1/mcp-registry.json'),
    plan: read('docs/plans/home-core-edge-work-breakdown.json'),
  };
}

export function compileSchemas(schemas) {
  exactKeys(schemas, SCHEMA_NAMES, 'schemas');
  const ajv = new Ajv2020({ strict: true, allErrors: true, validateFormats: true,
    coerceTypes: false, useDefaults: false, removeAdditional: false });
  addFormats(ajv);
  return Object.fromEntries(SCHEMA_NAMES.map((name) => {
    const schema = schemas[name];
    assert.equal(schema.$schema, 'https://json-schema.org/draft/2020-12/schema');
    assert.equal(schema.$id, `https://ruv.net/dream-machine/schemas/edge-v1/${name}.schema.json`);
    assert.equal(schema.additionalProperties, false, `${name}: exact envelope required`);
    return [name, ajv.compile(schema)];
  }));
}

/** Checks only relations expressible without a device, active policy, or private data. */
export function validateProjection(validators, name, value) {
  assert(Object.hasOwn(validators, name), 'unknown schema');
  const valid = validators[name](value);
  assert(valid, `${name}: ${JSON.stringify(validators[name].errors)}`);
  if (name === 'cue-proposal') {
    assert(BigInt(value.earliestMonotonicUs) < BigInt(value.latestMonotonicUs), 'proposal timing order');
    assert(value.rampMs <= value.durationMs, 'proposal ramp exceeds duration');
  }
  if (name === 'safety-decision' && value.decision === 'authorize') {
    const ticket = value.ticket;
    const issued = BigInt(ticket.issuedMonotonicUs);
    const notBefore = BigInt(ticket.notBeforeMonotonicUs);
    const expires = BigInt(ticket.expiresMonotonicUs);
    assert(issued <= notBefore && notBefore < expires, 'ticket timing order');
    assert(expires - issued <= 2_000_000n, 'ticket horizon exceeds two seconds');
    assert(ticket.rampMs <= ticket.durationMs, 'ticket ramp exceeds duration');
    assert.equal(Buffer.from(ticket.signature, 'base64url').toString('base64url'), ticket.signature,
      'noncanonical signature encoding');
  }
  if (name === 'evolution-candidate') {
    assert(Date.parse(value.createdAt) < Date.parse(value.expiresAt), 'candidate expiry order');
    const { path, from, to } = value.mutation;
    if (path === 'policy.minimumCueSpacingSeconds') assert(to >= from, 'spacing cannot decrease');
    if (path === 'policy.maximumIntensityQ15') assert(to <= from, 'intensity cannot increase');
    if (path === 'retrieval.featureWeights') assert.equal(to.length, from.length, 'feature dimension drift');
  }
  return true;
}

export function validateRegistry(registry) {
  exactKeys(registry, ['schemaVersion', 'protocolDate', 'resourceScheme', 'resourceAuthority',
    'principalClasses', 'audiencePolicyByPrivacyClass', 'resources', 'tools', 'forbiddenToolEffects'], 'registry');
  assert.equal(registry.schemaVersion, 'dream.mcp.registry.v1');
  assert.match(registry.protocolDate, /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(new Date(registry.protocolDate).toISOString().slice(0, 10), registry.protocolDate);
  assert.equal(registry.resourceScheme, 'ruv');
  assert.equal(registry.resourceAuthority, 'dream-machine');
  exactMembers(registry.principalClasses, PRINCIPALS, 'principals');
  exactKeys(registry.audiencePolicyByPrivacyClass, Object.keys(PRIVACY), 'privacy policy');
  for (const [privacy, [defaults, grants, denied]] of Object.entries(PRIVACY)) {
    const policy = registry.audiencePolicyByPrivacyClass[privacy];
    exactKeys(policy, ['default', 'explicitGrant', 'denied'], privacy);
    exactMembers(policy.default, defaults, `${privacy} defaults`);
    exactMembers(policy.explicitGrant, grants, `${privacy} grants`);
    exactMembers(policy.denied, denied, `${privacy} denied`);
    exactMembers([...policy.default, ...policy.explicitGrant, ...policy.denied], PRINCIPALS, `${privacy} partition`);
  }
  assert(Array.isArray(registry.resources), 'resources must be array');
  exactMembers(registry.resources.map((entry) => entry.name), Object.keys(RESOURCES), 'resources');
  const templates = [];
  for (const resource of registry.resources) {
    exactKeys(resource, ['name', 'uriTemplate', 'privacyClass', 'modelVisibleByDefault', 'subscribable'], resource.name);
    const [path, privacy, subscribable] = RESOURCES[resource.name];
    assert.equal(resource.uriTemplate, `ruv://dream-machine/v1/${path}`, `${resource.name} URI`);
    assert.equal(resource.privacyClass, privacy, `${resource.name} privacy`);
    assert.equal(resource.subscribable, subscribable, `${resource.name} subscription`);
    assert.equal(resource.modelVisibleByDefault,
      registry.audiencePolicyByPrivacyClass[privacy].default.includes('local_model'), `${resource.name} audience`);
    // Canonical templates contain only literal path segments or whole placeholders.
    for (const segment of path.split('/')) {
      assert(/^(?:[a-z][a-z0-9-]*|\{[A-Za-z][A-Za-z0-9]*\})$/.test(segment), 'unsafe URI template segment');
    }
    templates.push(resource.uriTemplate.replace(/\{[^}]+\}/g, '{}'));
  }
  uniqueStrings(templates, 'resource template shapes');
  assert(Array.isArray(registry.tools), 'tools must be array');
  exactMembers(registry.tools.map((entry) => entry.name), Object.keys(TOOLS), 'tools');
  for (const tool of registry.tools) {
    exactKeys(tool, ['name', 'effect', 'authority', 'allowedPrincipalClasses', 'requiredScope'], tool.name);
    const [authority, principalCount, scope] = TOOLS[tool.name];
    assert.equal(tool.authority, authority, `${tool.name} authority`);
    assert.equal(tool.requiredScope, scope, `${tool.name} scope`);
    exactMembers(tool.allowedPrincipalClasses, PRINCIPALS.slice(0, principalCount), `${tool.name} principals`);
    assert(typeof tool.effect === 'string' && tool.effect.trim().length > 0, `${tool.name} effect`);
  }
  exactMembers(registry.forbiddenToolEffects, FORBIDDEN, 'forbidden effects');
  return { resources: registry.resources.length, tools: registry.tools.length };
}

export function validatePlan(plan) {
  assert.equal(plan.schemaVersion, 'dream.mission.plan.v1');
  assert.equal(plan.missionId, 'home-core-edge-program');
  assert.equal(plan.repository, 'ruvnet/dream-machine');
  assert.match(plan.baselineCommit, /^[a-f0-9]{40}$/);
  exactMembers(plan.invariants, PLAN_INVARIANTS, 'mission invariants');
  assert(Array.isArray(plan.phases), 'phases must be array');
  exactMembers(plan.phases.map((phase) => phase.id), Array.from({ length: 10 }, (_, i) => `P${i}`), 'phases');
  const phases = new Map(plan.phases.map((phase) => [phase.id, phase]));
  for (const phase of phases.values()) {
    assert(Number.isSafeInteger(phase.estimatedEngineerDays) && phase.estimatedEngineerDays > 0, `${phase.id} cost`);
    uniqueStrings(phase.dependsOn, `${phase.id} dependencies`, true);
    for (const dependency of phase.dependsOn) {
      assert(phases.has(dependency) && dependency !== phase.id, `${phase.id} unknown or self dependency`);
    }
    if (phase.id !== 'P0') assert(phase.dependsOn.length > 0, `${phase.id} bypasses ratification`);
    for (const field of ['deliverables', 'verification', 'exitCriteria']) uniqueStrings(phase[field], `${phase.id} ${field}`);
    if (Object.hasOwn(phase, 'minimumCalendarNights')) {
      assert(Number.isSafeInteger(phase.minimumCalendarNights) && phase.minimumCalendarNights > 0,
        `${phase.id} research nights`);
    }
  }
  const visiting = new Set();
  const durations = new Map();
  const longestPath = (id) => {
    assert(!visiting.has(id), `dependency cycle at ${id}`);
    if (durations.has(id)) return durations.get(id);
    visiting.add(id);
    const phase = phases.get(id);
    const duration = phase.estimatedEngineerDays + Math.max(0, ...phase.dependsOn.map(longestPath));
    visiting.delete(id);
    durations.set(id, duration);
    return duration;
  };
  const total = [...phases.values()].reduce((sum, phase) => sum + phase.estimatedEngineerDays, 0);
  const criticalPath = Math.max(...[...phases.keys()].map(longestPath));
  const ancestors = new Set();
  const collect = (id) => {
    if (ancestors.has(id)) return;
    ancestors.add(id);
    phases.get(id).dependsOn.forEach(collect);
  };
  collect('P6');
  exactMembers([...ancestors], Array.from({ length: 7 }, (_, i) => `P${i}`), 'P6 dependency closure');
  const throughP6 = [...ancestors].reduce((sum, id) => sum + phases.get(id).estimatedEngineerDays, 0);
  assert.equal(plan.estimates.totalEngineerDays, total, 'total cost drift');
  assert.equal(plan.estimates.p0ThroughP6EngineerDays, throughP6, 'P6 cost drift');
  assert.equal(plan.estimates.p0ThroughP6CriticalPathWorkdays, longestPath('P6'), 'P6 critical path drift');
  assert.equal(plan.estimates.fullCriticalPathWorkdays, criticalPath, 'full critical path drift');
  assert.equal(plan.estimates.excludesResearchCalendarNights, true, 'research nights are not engineering workdays');
  assert(phases.get('P1').exitCriteria.includes('independent-source-typecheck-passes'), 'source typecheck cannot be waived');
  const research = phases.get('P8');
  assert.equal(research.protocolKind, 'frozen-human-approved-randomized-study-not-generated-exploration',
    'fixed human study is not permission for generated exploration');
  assert(Number.isSafeInteger(research.minimumCalendarNights) && research.minimumCalendarNights >= 70,
    'fixed human study requires at least seventy nights');
  // ADR-0103: 14 candidate exposures at a maximum 10% eligible-night allocation.
  assert(Number.isSafeInteger(research.generatedCandidateMinimumEligibleNights)
    && research.generatedCandidateMinimumEligibleNights >= Math.ceil(14 / 0.1),
  'generated candidate requires at least 140 eligible nights, not the seventy-night fixed study');
  exactMembers(research.promotionCriteria, ['posterior-benefit-probability-above-zero-point-nine-five',
    'sleep-harm-probability-below-zero-point-zero-five',
    'cue-associated-awakening-increase-under-five-percentage-points',
    'no-distress-or-next-day-sleepiness-regression'], 'P8 promotion criteria');
  for (const criterion of ['preregistered-report-with-accept-reject-or-inconclusive-verdict',
    'safety-findings-adjudicated-before-any-related-profile-proceeds', 'null-result-never-relabeled-as-promotion']) {
    assert(research.exitCriteria.includes(criterion), `P8 missing ${criterion}`);
  }
  uniqueStrings(plan.completionEvidence, 'completion evidence');
  uniqueStrings(plan.swarm.workers, 'swarm workers');
  assert.equal(plan.swarm.fileOwnershipRule, 'one-owner-per-file');
  assert(!plan.swarm.workers.includes(plan.swarm.coordinator), 'coordinator must be separate');
  assert(Number.isSafeInteger(plan.swarm.requiredFreeMemoryGb) && plan.swarm.requiredFreeMemoryGb > 0);
  assert(Object.keys(plan.swarm.maxConcurrentWorkersByMemoryGb).length > 0, 'missing swarm memory budgets');
  let previous = 0;
  for (const [memory, workers] of Object.entries(plan.swarm.maxConcurrentWorkersByMemoryGb)
    .sort(([a], [b]) => Number(a) - Number(b))) {
    assert(/^[1-9][0-9]*$/.test(memory) && Number(memory) > plan.swarm.requiredFreeMemoryGb, 'memory headroom');
    assert(Number.isSafeInteger(workers) && workers >= previous && workers > 0 && workers <= plan.swarm.workers.length,
      'worker budget exceeds declared workers or is not monotonic');
    previous = workers;
  }
  return { phases: phases.size, engineerDays: total, criticalPathWorkdays: criticalPath,
    throughP6EngineerDays: throughP6, throughP6CriticalPathWorkdays: longestPath('P6') };
}

export function positiveFixtures() {
  const ticket = {
    version: 1, ticketId: ID, proposalSha256: DIGEST, deviceId: ID, bootId: ID,
    challengeId: ID, policySha256: DIGEST, firmwareSha256: DIGEST, consentSha256: DIGEST,
    experimentId: ID, consentEpoch: 1, sequence: '1', issuedMonotonicUs: '1000000',
    notBeforeMonotonicUs: '1000100', expiresMonotonicUs: '2000000', stateDigest: DIGEST,
    confidenceQ15: 32767, modality: 'audio', assetSha256: DIGEST, intensityQ15: 100,
    durationMs: 500, rampMs: 100, reasonCode: 0,
    signature: Buffer.alloc(64).toString('base64url'),
  };
  return {
    observation: {
      schemaVersion: 1, sourceId: 'radar_1', sourceKind: 'mr60bha2', bootId: ID,
      sequence: '1', observedAt: STAMP, sourceMonotonicUs: '1000000', ingestedMonotonicUs: '1000001',
      clockUncertaintyMs: 1, qualityQ15: 32767, flags: [], values: { presence: true, respiration_bpm: null },
      evidenceLevel: 'simulated', privacyClass: 'P3',
      provenance: { adapter: 'fixture', adapterVersion: '1.0.0', calibrationId: 'fixture_1', inputDigest: DIGEST },
    },
    'cue-proposal': {
      schemaVersion: 1, proposalId: ID, profileId: 'self', experimentId: ID,
      modality: 'audio', assetSha256: DIGEST, intensityQ15: 100, durationMs: 500, rampMs: 100,
      earliestMonotonicUs: '1000000', latestMonotonicUs: '2000000', stateDigest: DIGEST,
      signalConfidenceQ15: 32767, objective: 'Synthetic awake preview', reasonCode: 'fixture',
      modelDigest: DIGEST, createdBy: 'simulator', authority: 'none',
    },
    'safety-decision': {
      schemaVersion: 1, decisionId: ID, decision: 'authorize', decidedAt: STAMP,
      decidedMonotonicUs: '1000000', reasonCodes: ['fixture'], ticket,
    },
    'evolution-candidate': {
      schemaVersion: 'dream.evolution.candidate.v1', candidateId: ID, parentDigest: DIGEST,
      envelopeDigest: DIGEST, evaluationContractDigest: DIGEST, createdAt: STAMP, proposer: 'simulator',
      mutation: { path: 'policy.minimumCueSpacingSeconds', from: 600, to: 900 }, authorityDelta: 'none',
      expectedBenefit: 'Synthetic spacing fixture', evidenceRefs: [`ruv://dream-machine/v1/evidence/${DIGEST}`],
      expiresAt: '2026-09-05T00:00:00Z', rollbackDigest: DIGEST,
    },
  };
}

/** Boundary and fixed-seed corpus are checked against BigInt, never JSON-number rounding. */
export function validateUint64Definitions(schemas) {
  const corpus = new Set(['', '-1', '+1', '01', '00', ' 1', '1 ', '1\n', '1.0', '1e1', '0x1', '١', '９']);
  const add = (value) => corpus.add(value.toString());
  for (let i = 0; i <= 20; i++) {
    const power = 10n ** BigInt(i);
    for (const value of [power - 1n, power, power + 1n, UINT64_MAX - power, UINT64_MAX + power]) add(value);
    // Probe every decimal prefix boundary of UINT64_MAX.
    const boundary = (UINT64_MAX / power) * power;
    for (const delta of [-1n, 0n, 1n]) add(boundary + delta);
  }
  for (const value of [0n, UINT64_MAX - 1n, UINT64_MAX, UINT64_MAX + 1n, 2n ** 53n - 1n, 2n ** 53n + 1n]) add(value);
  let seed = 0x5eedn;
  for (let i = 0; i < 2048; i++) {
    seed = (seed * 6364136223846793005n + 1442695040888963407n) & UINT64_MAX;
    add(seed);
    add(seed + UINT64_MAX + 1n);
  }
  for (const name of SCHEMA_NAMES.filter((entry) => entry !== 'evolution-candidate')) {
    const definition = schemas[name].$defs.uint64;
    assert.equal(definition.type, 'string', `${name} uint64 must stay a string`);
    const pattern = new RegExp(definition.pattern, 'u');
    for (const value of corpus) {
      const expected = /^(?:0|[1-9][0-9]*)$/.test(value) && !/\s/.test(value) && BigInt(value) <= UINT64_MAX;
      assert.equal(pattern.test(value), expected, `${name} uint64 boundary ${JSON.stringify(value)}`);
    }
  }
  return corpus.size;
}

export function checkAll(inputs = loadInputs()) {
  const validators = compileSchemas(inputs.schemas);
  for (const [name, fixture] of Object.entries(positiveFixtures())) validateProjection(validators, name, fixture);
  return { schemas: SCHEMA_NAMES.length, uint64VectorsPerSchema: validateUint64Definitions(inputs.schemas),
    ...validateRegistry(inputs.registry), ...validatePlan(inputs.plan),
    scope: 'offline architecture validation only; no runtime, cryptography, or hardware conformance claim' };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    console.log(JSON.stringify(checkAll(), null, 2));
  } catch (error) {
    console.error(`Edge contract validation failed: ${error.message}`);
    process.exitCode = 1;
  }
}
