import { describe, expect, it } from 'vitest';
import {
  canonicalJson,
  createAnchoredReplay,
  finalizeAnchoredReplay,
  traceDigest,
  verifyReplayPrefix,
  type TraceEvent,
} from './trace-replay.js';

const trace: TraceEvent[] = [
  { id: 'e0', step: 0, kind: 'input', input: { task: 'repair auth' } },
  { id: 'e1', step: 1, kind: 'tool', actor: 'researcher', output: { file: 'auth.ts' } },
  { id: 'e2', step: 2, kind: 'symptom', actor: 'tester', output: { status: 500 } },
  { id: 'e3', step: 3, kind: 'repair', actor: 'coder', output: { patch: 'old' } },
];

describe('canonicalJson', () => {
  it('sorts object keys so equivalent evidence hashes identically', () => {
    expect(canonicalJson({ z: 1, a: { y: 2, x: 3 } })).toBe(
      canonicalJson({ a: { x: 3, y: 2 }, z: 1 }),
    );
  });

  it('fails closed on undefined and non-finite numbers', () => {
    expect(() => canonicalJson({ a: undefined })).toThrow(/undefined/);
    expect(() => canonicalJson({ a: Number.NaN })).toThrow(/non-finite/);
  });

  it('rejects ambiguous values that are not plain JSON evidence', () => {
    const sparse = new Array(2);
    sparse[1] = 'evidence';
    expect(() => canonicalJson(sparse)).toThrow(/dense/);
    expect(() => canonicalJson(new Date('2026-08-28T00:00:00Z'))).toThrow(/plain JSON object/);
    expect(() => canonicalJson(new Map([['status', 500]]))).toThrow(/plain JSON object/);

    const symbol = Symbol('hidden');
    expect(() => canonicalJson({ visible: true, [symbol]: 'secret' })).toThrow(/symbol key/);
  });

  it('rejects accessors without invoking untrusted evidence code', () => {
    let reads = 0;
    const evidence = Object.defineProperty({}, 'status', {
      enumerable: true,
      get() {
        reads += 1;
        return 500;
      },
    });

    expect(() => canonicalJson(evidence)).toThrow(/data property/);
    expect(reads).toBe(0);
  });
});

describe('anchored trace replay', () => {
  it('binds the exact prefix, anchor, suffix, and full trace', () => {
    const plan = createAnchoredReplay(trace, 'e2');
    expect(plan.anchorId).toBe('e2');
    expect(plan.anchorStep).toBe(2);
    expect(plan.prefixLength).toBe(2);
    expect(plan.prefixDigest).toBe(traceDigest(trace.slice(0, 2)));
    expect(plan.originalSuffixDigest).toBe(traceDigest(trace.slice(3)));
    expect(plan.originalTraceDigest).toBe(traceDigest(trace));
  });

  it('accepts only an exact reconstructed prefix', () => {
    const plan = createAnchoredReplay(trace, 'e2');
    expect(verifyReplayPrefix(plan, trace.slice(0, 2))).toEqual({ ok: true });

    const mutated = structuredClone(trace.slice(0, 2));
    mutated[1].output = { file: 'different.ts' };
    expect(verifyReplayPrefix(plan, mutated)).toEqual({
      ok: false,
      reason: 'reconstructed prefix digest differs from anchored prefix',
    });
  });

  it('rejects a moved or modified anchor', () => {
    const plan = createAnchoredReplay(trace, 'e2');
    expect(() =>
      finalizeAnchoredReplay(plan, trace.slice(0, 2), { ...trace[2], step: 4 }, []),
    ).toThrow(/anchor identity or step/);

    expect(() =>
      finalizeAnchoredReplay(
        plan,
        trace.slice(0, 2),
        { ...trace[2], output: { status: 200 } },
        [],
      ),
    ).toThrow(/anchor evidence differs/);
  });

  it('creates a deterministic receipt for a regenerated suffix', () => {
    const plan = createAnchoredReplay(trace, 'e2');
    const suffix: TraceEvent[] = [
      { id: 'r3', step: 3, kind: 'repair', actor: 'coder', output: { patch: 'new' } },
      { id: 'r4', step: 4, kind: 'verify', actor: 'tester', output: { status: 200 } },
    ];

    const first = finalizeAnchoredReplay(plan, trace.slice(0, 2), trace[2], suffix);
    const second = finalizeAnchoredReplay(plan, trace.slice(0, 2), trace[2], structuredClone(suffix));

    expect(first).toEqual(second);
    expect(first.regeneratedSteps).toBe(2);
    expect(first.regeneratedSuffixDigest).toBe(traceDigest(suffix));
  });

  it('rejects suffix events that cross the anchor boundary or reuse immutable ids', () => {
    const plan = createAnchoredReplay(trace, 'e2');

    expect(() =>
      finalizeAnchoredReplay(plan, trace.slice(0, 2), trace[2], [
        { id: 'r2', step: 2, kind: 'repair' },
      ]),
    ).toThrow(/at or before the anchor/);

    expect(() =>
      finalizeAnchoredReplay(plan, trace.slice(0, 2), trace[2], [
        { id: 'e1', step: 3, kind: 'repair' },
      ]),
    ).toThrow(/reuses immutable event id/);
  });

  it('rejects duplicate ids, non-monotonic steps, and missing anchors', () => {
    expect(() => createAnchoredReplay([trace[0], { ...trace[1], id: 'e0' }], 'e0')).toThrow(
      /duplicate event id/,
    );
    expect(() => createAnchoredReplay([trace[1], trace[0]], 'e0')).toThrow(/strictly increasing/);
    expect(() => createAnchoredReplay(trace, 'missing')).toThrow(/does not exist/);
  });
});
