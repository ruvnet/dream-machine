import assert from 'node:assert/strict';
import test from 'node:test';
import { withReference, fixtures, differential, timings, BASELINE_COMMIT } from './benchmark-ticket-codec.mjs';

test('pinned reviewed reference matches golden, integer widths and seeded mutations', async () => {
  await withReference(async (reference, provenance, candidate) => {
    assert.equal(provenance.commit, BASELINE_COMMIT);
    assert.equal(Object.keys(provenance.sources).length, 2);
    const corpus = await fixtures(reference, candidate);
    assert.equal(corpus.length, 13);
    const first = differential(reference, candidate, corpus, 1000, 43);
    assert(first.accepted > 0 && first.rejected > 0);
    assert.equal(first.mismatches, 0);
    assert.deepEqual(differential(reference, candidate, corpus, 1000, 43), first);
    assert.notEqual(differential(reference, candidate, corpus, 1000, 44).corpusSha256, first.corpusSha256);
    for (const count of [-1, 0, NaN, 1.5, 1_000_001]) assert.throws(() => differential(reference, candidate, corpus, count));
    for (const seed of [0, -1, NaN, 0x1_0000_0000]) assert.throws(() => differential(reference, candidate, corpus, 1, seed));
    assert.throws(() => differential(reference, candidate, [], 1));
    for (const invalid of [[new Uint8Array(769)], [new Uint8Array()], [null], new Array(1), [new Uint8Array(new SharedArrayBuffer(1))]]) {
      assert.throws(() => differential(reference, candidate, invalid, 1));
      assert.throws(() => timings(reference, candidate, invalid));
    }
  });
});

test('independent copies reject mutation even when the other implementation would undo it', async () => {
  await withReference(async (reference, _provenance, candidate) => {
    const corpus = await fixtures(reference, candidate);
    const mutator = { ...reference, decodeTicket(bytes) {
      const decoded = reference.decodeTicket(bytes); bytes[25] ^= 1; return decoded;
    } };
    const restorer = { ...candidate, decodeTicket(bytes) { bytes[25] ^= 1; return candidate.decodeTicket(bytes); } };
    assert.throws(() => differential(mutator, restorer, corpus, 1), /mutated its independent input/);
    assert.throws(() => differential(reference, { ...candidate, decodeTicket(bytes) {
      const decoded = candidate.decodeTicket(bytes); bytes[25] ^= 1; return decoded;
    } }, corpus, 1), /mutated its independent input/);
    const buffers = corpus.map((bytes) => Buffer.from(bytes));
    const snapshots = buffers.map((bytes) => Buffer.from(bytes));
    differential(reference, candidate, buffers, 1000);
    assert.deepEqual(buffers, snapshots);
  });
});

test('comparison fails when the reference accepts different values', async () => {
  await withReference(async (reference, _provenance, candidate) => {
    const corpus = await fixtures(reference, candidate);
    const faulty = { ...reference, decodeTicket: (bytes) => ({ ...reference.decodeTicket(bytes), reasonCode: 0 }) };
    assert.throws(() => differential(faulty, candidate, corpus, 1));
    assert.throws(() => differential({ ...reference, decodeTicket() { throw new Error('unexpected'); } }, candidate, corpus, 1));
    const timing = timings(reference, candidate, corpus, { batches: 10, batchSize: 100 });
    assert.equal(timing.samples.referenceBatchUs.length, 10);
    assert.equal(timing.operationsPerImplementation, 1000);
    assert.equal(timing.claimVerdict, 'INCONCLUSIVE');
    assert(Number.isFinite(timing.medianSpeedup) && timing.medianSpeedup > 0);
    assert.throws(() => timings(reference, candidate, corpus, { batches: 1 }));
    assert.throws(() => timings(reference, candidate, corpus, { batchSize: Infinity }));
  });
});
