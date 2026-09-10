import { arch, cpus, platform } from 'node:os';
import { performance } from 'node:perf_hooks';
import { createHash } from 'node:crypto';
import {
  hashExperimentManifest,
  verifyClaimEvidence,
} from '../packages/witness/dist/claim-receipt.js';

const SAMPLE_SIZE = 1_000;
const WARMUP_RUNS = 25;
const MEASURED_RUNS = 100;
const SEED = 'claim-receipt-bench-v1';

function digest(value) {
  return createHash('sha256').update(value).digest('hex');
}

function percentile(values, fraction) {
  const ordered = [...values].sort((left, right) => left - right);
  const index = Math.min(ordered.length - 1, Math.floor(ordered.length * fraction));
  return ordered[index];
}

function genericAssignmentPresence(manifest, records) {
  const present = new Set(records.map((record) => record.assignmentId));
  return manifest.assignments.every((assignment) => present.has(assignment.id));
}

const assignments = Array.from({ length: SAMPLE_SIZE }, (_, index) => ({
  id: `a-${String(index).padStart(4, '0')}`,
}));
const manifest = {
  experimentId: 'claim-receipt-scale',
  protocolVersion: 'cr-ruv-1',
  committedAt: '2026-09-03T12:00:00.000Z',
  assignments,
};
const claim = {
  claimId: 'quality-and-cost',
  requiredFieldGroups: ['outcome', 'cost'],
  requireOpenedFieldGroups: ['outcome'],
};
const evidence = assignments.flatMap(({ id }) => [
  {
    assignmentId: id,
    fieldGroup: 'outcome',
    digest: digest(`${SEED}:${id}:outcome`),
    opened: true,
    terminal: true,
  },
  {
    assignmentId: id,
    fieldGroup: 'cost',
    digest: digest(`${SEED}:${id}:cost`),
    opened: false,
    terminal: false,
  },
]);
const manifestDigest = hashExperimentManifest(manifest);

for (let index = 0; index < WARMUP_RUNS; index += 1) {
  const receipt = verifyClaimEvidence(manifest, manifestDigest, claim, evidence);
  if (receipt.status !== 'PASS') throw new Error(`warmup failed: ${receipt.status}`);
  if (!genericAssignmentPresence(manifest, evidence)) throw new Error('baseline warmup failed');
}

const candidateMs = [];
const baselineMs = [];
const beforeHeap = process.memoryUsage().heapUsed;
for (let index = 0; index < MEASURED_RUNS; index += 1) {
  let started = performance.now();
  const receipt = verifyClaimEvidence(manifest, manifestDigest, claim, evidence);
  candidateMs.push(performance.now() - started);
  if (receipt.status !== 'PASS') throw new Error(`candidate failed: ${receipt.status}`);

  started = performance.now();
  if (!genericAssignmentPresence(manifest, evidence)) throw new Error('baseline failed');
  baselineMs.push(performance.now() - started);
}
const afterHeap = process.memoryUsage().heapUsed;

const targetId = assignments[Math.floor(SAMPLE_SIZE / 2)].id;
const outcomeIndex = evidence.findIndex(
  (record) => record.assignmentId === targetId && record.fieldGroup === 'outcome',
);
const costIndex = evidence.findIndex(
  (record) => record.assignmentId === targetId && record.fieldGroup === 'cost',
);
const missingTerminal = evidence.map((record, index) =>
  index === outcomeIndex ? { ...record, terminal: false } : record,
);
const missingField = evidence.filter((_, index) => index !== costIndex);
const withheldOpening = evidence.map((record, index) =>
  index === outcomeIndex ? { ...record, opened: false } : record,
);
const malformedDigest = evidence.map((record, index) =>
  index === outcomeIndex ? { ...record, digest: 'deadbeef' } : record,
);
const undeclared = [
  ...evidence,
  {
    assignmentId: 'a-extra',
    fieldGroup: 'outcome',
    digest: digest('undeclared'),
    opened: true,
    terminal: true,
  },
];
const rewrittenManifest = {
  ...manifest,
  assignments: manifest.assignments.slice(0, SAMPLE_SIZE - 1),
};
const attacks = [
  { manifest, evidence: missingTerminal },
  { manifest, evidence: missingField },
  { manifest, evidence: withheldOpening },
  { manifest, evidence: malformedDigest },
  { manifest, evidence: undeclared },
  { manifest: rewrittenManifest, evidence },
];
let baselineFalsePasses = 0;
let candidateFalsePasses = 0;
for (const attack of attacks) {
  if (genericAssignmentPresence(attack.manifest, attack.evidence)) baselineFalsePasses += 1;
  if (verifyClaimEvidence(attack.manifest, manifestDigest, claim, attack.evidence).status === 'PASS') {
    candidateFalsePasses += 1;
  }
}

const report = {
  benchmark: SEED,
  sampleSize: SAMPLE_SIZE,
  evidenceRecords: evidence.length,
  warmupRuns: WARMUP_RUNS,
  measuredRuns: MEASURED_RUNS,
  environment: {
    node: process.version,
    platform: platform(),
    arch: arch(),
    cpu: cpus()[0]?.model ?? 'unknown',
  },
  genericPresence: {
    p50Ms: percentile(baselineMs, 0.5),
    p95Ms: percentile(baselineMs, 0.95),
    falsePasses: baselineFalsePasses,
    attacks: attacks.length,
  },
  claimReceipt: {
    p50Ms: percentile(candidateMs, 0.5),
    p95Ms: percentile(candidateMs, 0.95),
    falsePasses: candidateFalsePasses,
    attacks: attacks.length,
  },
  heapDeltaBytes: afterHeap - beforeHeap,
};

console.log(`CLAIM_RECEIPT_PRODUCTION_BENCH ${JSON.stringify(report)}`);

if (candidateFalsePasses !== 0) {
  throw new Error(`candidate false passes: ${candidateFalsePasses}`);
}
