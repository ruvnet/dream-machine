import { arch, cpus, platform } from 'node:os';
import { performance } from 'node:perf_hooks';
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  hashExperimentManifest,
  verifyClaimEvidence,
  type ClaimSpec,
  type EvidenceRecord,
  type ExperimentManifest,
} from './claim-receipt.js';

const SAMPLE_SIZE = 1_000;
const WARMUP_RUNS = 10;
const MEASURED_RUNS = 40;
const SEED = 'claim-receipt-bench-v1';

function digest(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function percentile(values: number[], fraction: number): number {
  const ordered = [...values].sort((left, right) => left - right);
  const index = Math.min(ordered.length - 1, Math.floor(ordered.length * fraction));
  return ordered[index]!;
}

function genericAssignmentPresence(
  manifest: ExperimentManifest,
  records: readonly EvidenceRecord[],
): boolean {
  const present = new Set(records.map((record) => record.assignmentId));
  return manifest.assignments.every((assignment) => present.has(assignment.id));
}

function fixture(): {
  manifest: ExperimentManifest;
  claim: ClaimSpec;
  evidence: EvidenceRecord[];
  manifestDigest: string;
} {
  const assignments = Array.from({ length: SAMPLE_SIZE }, (_, index) => ({
    id: `a-${String(index).padStart(4, '0')}`,
  }));
  const manifest: ExperimentManifest = {
    experimentId: 'claim-receipt-scale',
    protocolVersion: 'cr-ruv-1',
    committedAt: '2026-09-03T12:00:00.000Z',
    assignments,
  };
  const claim: ClaimSpec = {
    claimId: 'quality-and-cost',
    requiredFieldGroups: ['outcome', 'cost'],
    requireOpenedFieldGroups: ['outcome'],
  };
  const evidence: EvidenceRecord[] = assignments.flatMap(({ id }) => [
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
  return { manifest, claim, evidence, manifestDigest: hashExperimentManifest(manifest) };
}

describe('claim receipt deterministic benchmark', () => {
  it('reports scale latency and catches faults generic assignment presence misses', () => {
    const { manifest, claim, evidence, manifestDigest } = fixture();
    const beforeHeap = process.memoryUsage().heapUsed;

    for (let index = 0; index < WARMUP_RUNS; index += 1) {
      expect(verifyClaimEvidence(manifest, manifestDigest, claim, evidence).status).toBe('PASS');
      expect(genericAssignmentPresence(manifest, evidence)).toBe(true);
    }

    const candidateMs: number[] = [];
    const baselineMs: number[] = [];
    for (let index = 0; index < MEASURED_RUNS; index += 1) {
      let started = performance.now();
      const candidate = verifyClaimEvidence(manifest, manifestDigest, claim, evidence);
      candidateMs.push(performance.now() - started);
      expect(candidate.status).toBe('PASS');

      started = performance.now();
      expect(genericAssignmentPresence(manifest, evidence)).toBe(true);
      baselineMs.push(performance.now() - started);
    }

    const targetId = manifest.assignments[Math.floor(SAMPLE_SIZE / 2)]!.id;
    const findRecord = (fieldGroup: string): number =>
      evidence.findIndex(
        (record) => record.assignmentId === targetId && record.fieldGroup === fieldGroup,
      );
    const outcomeIndex = findRecord('outcome');
    const costIndex = findRecord('cost');
    expect(outcomeIndex).toBeGreaterThanOrEqual(0);
    expect(costIndex).toBeGreaterThanOrEqual(0);

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
    const rewrittenManifest: ExperimentManifest = {
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
    let genericFalsePasses = 0;
    let candidateFalsePasses = 0;
    for (const attack of attacks) {
      if (genericAssignmentPresence(attack.manifest, attack.evidence)) genericFalsePasses += 1;
      if (
        verifyClaimEvidence(attack.manifest, manifestDigest, claim, attack.evidence).status ===
        'PASS'
      ) {
        candidateFalsePasses += 1;
      }
    }

    const afterHeap = process.memoryUsage().heapUsed;
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
        falsePasses: genericFalsePasses,
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

    console.log(`CLAIM_RECEIPT_BENCH ${JSON.stringify(report)}`);
    expect(genericFalsePasses).toBeGreaterThan(0);
    expect(candidateFalsePasses).toBe(0);
  });
});
