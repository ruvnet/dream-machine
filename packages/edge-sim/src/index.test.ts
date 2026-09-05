import { describe, expect, it } from 'vitest';
import { encodeTicket, type UnsignedCueTicketV1 } from '@dream-machine/edge-contracts';
import {
  FakeMcuSafetyController, VirtualClock, createSimulationFixture, createSimulationPolicy,
  digest, runSimulation, syntheticRadar, type SimulationPolicy,
} from './index.js';

const fixture = (policy?: SimulationPolicy) => {
  const value = createSimulationFixture(1, policy);
  expect(value.arm()).toBe(true);
  return value;
};
const hash = 'f'.repeat(64);
const identifier = 'f'.repeat(32);

describe('nonactuating virtual clock', () => {
  it('is monotonic, deterministic and rejects uint64 overflow', () => {
    const clock = new VirtualClock(0n);
    const values: bigint[] = [];
    const unsubscribe = clock.onAdvance((_before, after) => values.push(after));
    clock.advance(12n); clock.advance(0n); unsubscribe(); clock.advance(2n);
    expect(values).toEqual([12n, 12n]);
    expect(clock.nowUs).toBe(14n);
    expect(() => clock.advance(-1n)).toThrow();
    expect(() => clock.advance(1n << 64n)).toThrow();
    expect(() => new VirtualClock(-1n)).toThrow();
  });
});

describe('physical events are simulated and never automatic', () => {
  it('boots silent and requires OBSERVE followed by physical confirm', () => {
    const f = createSimulationFixture();
    expect(f.controller.hardwareActuation).toBe(false);
    expect(f.controller.armState).toBe('DISARMED');
    expect(f.controller.simulatePhysicalConfirm()).toBe(false);
    expect(f.controller.simulatePhysicalArm()).toBe(false);
    f.refresh();
    expect(f.controller.armState).toBe('DISARMED');
    expect(f.controller.simulatePhysicalArm()).toBe(true);
    expect(f.controller.armState).toBe('OBSERVE');
    expect(f.controller.virtualGateOpen).toBe(false);
    expect(f.controller.simulatePhysicalConfirm()).toBe(true);
    expect(f.controller.armState).toBe('ARMED');
    expect(f.controller.virtualGateOpen).toBe(false);
  });
  it('mute cannot resume through heartbeats or a session end', () => {
    const f = fixture();
    f.submit(); f.controller.mute(); f.refresh(); f.controller.endSession();
    expect(f.controller.armState).toBe('MUTED');
    expect(f.controller.virtualGateOpen).toBe(false);
    expect(f.controller.simulatePhysicalArm()).toBe(false);
    expect(f.controller.simulatePhysicalAcknowledgement()).toBe(true);
    expect(f.controller.armState).toBe('DISARMED');
    expect(f.arm()).toBe(true);
  });
  it('watchdog latches fault and needs maintenance plus physical acknowledgement', () => {
    const f = fixture(); f.submit(); f.controller.watchdogExpired(); f.refresh();
    expect(f.controller.armState).toBe('FAULT');
    expect(f.controller.simulatePhysicalAcknowledgement()).toBe(false);
    expect(f.controller.simulateMaintenanceAndPhysicalAcknowledgement(false)).toBe(false);
    expect(f.controller.simulateMaintenanceAndPhysicalAcknowledgement(true)).toBe(true);
    expect(f.controller.armState).toBe('DISARMED');
    expect(f.controller.virtualGateOpen).toBe(false);
  });
  it('revocation is terminal for this immutable consent fixture', () => {
    const f = fixture(); f.submit(); f.controller.revokeConsent(); f.refresh();
    expect(f.controller.armState).toBe('MUTED');
    expect(f.controller.consentEpoch).toBe(2);
    expect(f.controller.virtualGateOpen).toBe(false);
    f.controller.simulatePhysicalAcknowledgement();
    expect(f.controller.simulatePhysicalArm()).toBe(false);
  });
});

describe('gate scheduling and health race boundaries', () => {
  it('accepts a signed ticket and closes exactly at duration', () => {
    const f = fixture();
    expect(f.submit().decision).toBe('accepted');
    expect(f.controller.virtualGateOpen).toBe(true);
    f.clock.advance(19_999n);
    expect(f.controller.virtualGateOpen).toBe(true);
    f.clock.advance(1n);
    expect(f.controller.virtualGateOpen).toBe(false);
    expect(f.controller.receipts.at(-1)).toMatchObject({ decision: 'completed', atMonotonicUs: '1020000' });
  });
  it('schedules a future cue without opening early', () => {
    const f = fixture();
    expect(f.submit({ notBeforeMonotonicUs: '1010000' }).decision).toBe('accepted');
    expect(f.controller.virtualGateOpen).toBe(false);
    f.clock.advance(9999n); expect(f.controller.virtualGateOpen).toBe(false);
    f.clock.advance(1n); expect(f.controller.virtualGateOpen).toBe(true);
  });
  it('a scheduled cue cannot open at the exact heartbeat expiry', () => {
    const f = fixture();
    expect(f.submit({ notBeforeMonotonicUs: '1075000' }).decision).toBe('accepted');
    f.clock.advance(75_000n);
    expect(f.controller.virtualGateOpen).toBe(false);
    expect(f.controller.armState).toBe('FAULT');
    expect(f.controller.receipts.at(-1)).toMatchObject({ decision: 'cancelled', reason: 'heartbeat_lost', atMonotonicUs: '1075000' });
  });
  it('heartbeat loss closes midcue at the deadline, even on a large clock jump', () => {
    const f = fixture(); f.submit({ durationMs: 200 }); f.clock.advance(1_000_000n);
    expect(f.controller.virtualGateOpen).toBe(false);
    expect(f.controller.receipts.at(-1)).toMatchObject({ decision: 'cancelled', atMonotonicUs: '1075000' });
    f.refresh(); expect(f.controller.armState).toBe('FAULT');
  });
  it('heartbeat renewal never extends the signed cue expiry', () => {
    const f = fixture(); f.submit({ durationMs: 100, expiresMonotonicUs: '1100000' });
    for (let i = 0; i < 4; i += 1) { f.clock.advance(25_000n); f.refresh(); }
    expect(f.controller.virtualGateOpen).toBe(false);
    expect(f.controller.receipts.at(-1)).toMatchObject({ decision: 'completed', atMonotonicUs: '1100000' });
  });
  it('sensor staleness closes while healthy heartbeats continue', () => {
    const f = fixture(); f.submit({ durationMs: 500 });
    for (let i = 0; i < 10; i += 1) { f.clock.advance(25_000n); f.controller.heartbeat(BigInt(2 + i)); }
    expect(f.controller.armState).toBe('FAULT');
    expect(f.controller.receipts.at(-1)).toMatchObject({ reason: 'stale_sensor', atMonotonicUs: '1250000' });
  });
  it.each(['dropout', 'multiple_occupants'] as const)('immediately vetoes %s while output is open', mode => {
    const f = fixture(); f.submit(); f.refresh(mode);
    expect(f.controller.virtualGateOpen).toBe(false);
    expect(f.controller.armState).toBe('FAULT');
    f.refresh(); expect(f.controller.armState).toBe('FAULT');
  });
  it('rejects a replayed heartbeat and sensor frame', () => {
    const f = fixture(); f.submit(); f.controller.heartbeat(1n);
    expect(f.controller.armState).toBe('FAULT'); expect(f.controller.virtualGateOpen).toBe(false);
    const g = fixture(); g.submit(); g.controller.setSnapshot(g.controller.snapshot!);
    expect(g.controller.armState).toBe('FAULT'); expect(g.controller.virtualGateOpen).toBe(false);
  });
  it('rejects a numeric runtime heartbeat instead of silently coercing it', () => {
    const f = fixture(); f.submit(); f.controller.heartbeat(2 as unknown as bigint);
    expect(f.controller.armState).toBe('FAULT'); expect(f.controller.virtualGateOpen).toBe(false);
  });
  it('rejects a corrupted sensor digest', () => {
    const f = fixture();
    f.controller.setSnapshot({ ...syntheticRadar(f.clock, 2n), stateDigest: hash });
    expect(f.controller.armState).toBe('FAULT');
  });
  it('malformed runtime sensor input and NaN cannot leave output open', () => {
    const f = fixture(); f.submit();
    f.controller.setSnapshot(null as unknown as ReturnType<typeof syntheticRadar>);
    expect(f.controller.armState).toBe('FAULT'); expect(f.controller.virtualGateOpen).toBe(false);
    const g = fixture(); g.submit();
    const snapshot = syntheticRadar(g.clock, 2n);
    const { stateDigest: _stateDigest, ...body } = { ...snapshot, heartBpm: NaN };
    g.controller.setSnapshot({ ...body, stateDigest: digest(JSON.stringify(body)) });
    expect(g.controller.armState).toBe('FAULT'); expect(g.controller.virtualGateOpen).toBe(false);
  });
  it('a disposed controller can never resume after its clock subscription is removed', () => {
    const f = fixture(); f.submit(); f.controller.dispose();
    expect(f.controller.virtualGateOpen).toBe(false);
    expect(f.controller.simulateMaintenanceAndPhysicalAcknowledgement(true)).toBe(false);
    f.controller.reboot(); f.refresh();
    expect(f.controller.simulatePhysicalArm()).toBe(false);
  });
  it('rejects a second concurrent cue and closes the first', () => {
    const f = fixture(); expect(f.submit().decision).toBe('accepted');
    expect(f.submit()).toMatchObject({ decision: 'rejected', reason: 'cue_in_progress' });
    expect(f.controller.virtualGateOpen).toBe(false);
    expect(f.controller.receipts.map(value => value.decision)).toEqual(['accepted', 'cancelled', 'rejected']);
  });
});

describe('strict tickets, bindings, time and replay', () => {
  const cases: [Partial<UnsignedCueTicketV1>, string][] = [
    [{ deviceId: identifier }, 'identity_mismatch'], [{ bootId: identifier }, 'boot_mismatch'],
    [{ firmwareSha256: hash }, 'firmware_mismatch'], [{ policySha256: hash }, 'policy_mismatch'],
    [{ experimentId: identifier }, 'experiment_mismatch'], [{ consentSha256: hash }, 'consent_revoked'],
    [{ consentEpoch: 2 }, 'consent_revoked'], [{ challengeId: identifier }, 'challenge_unknown_or_consumed'],
    [{ proposalSha256: hash }, 'proposal_mismatch'], [{ stateDigest: hash }, 'low_signal_quality'],
    [{ confidenceQ15: 1 }, 'low_signal_quality'], [{ confidenceQ15: 32767 }, 'low_signal_quality'],
    [{ assetSha256: hash }, 'asset_denied'], [{ modality: 'light' }, 'asset_denied'],
    [{ intensityQ15: 4097 }, 'intensity_denied'], [{ durationMs: 1001 }, 'duration_denied'],
    [{ rampMs: 0 }, 'ramp_denied'], [{ rampMs: 501, durationMs: 600 }, 'ramp_denied'],
    [{ notBeforeMonotonicUs: '1000000', expiresMonotonicUs: '1010000' }, 'cue_window_invalid'],
    [{ issuedMonotonicUs: '1000001', notBeforeMonotonicUs: '1000001' }, 'too_early'],
  ];
  it.each(cases)('rejects signed override %j with %s', (overrides, reason) => {
    const f = fixture();
    expect(f.submit(overrides)).toMatchObject({ decision: 'rejected', reason });
    expect(f.controller.virtualGateOpen).toBe(false);
    expect(f.controller.armState).toBe('FAULT');
  });
  it('parses before crypto and matches identity before crypto', () => {
    const f = fixture(); f.controller.submit(Uint8Array.of(0xa0));
    expect(f.controller.counters.signatureVerifications).toBe(0);
    f.submit({ deviceId: identifier });
    expect(f.controller.counters.signatureVerifications).toBe(0);
  });
  it('a nonbyte runtime submission closes a currently open gate', () => {
    const f = fixture(); f.submit();
    expect(f.controller.submit(null as unknown as Uint8Array)).toMatchObject({ reason: 'malformed' });
    expect(f.controller.virtualGateOpen).toBe(false);
  });
  it('rejects modified signature even with a matching public fixture identity', () => {
    const f = fixture(); const ticket = f.makeTicket();
    const bytes = Buffer.from(ticket.signature, 'base64url'); bytes[0] ^= 1;
    expect(f.controller.submit(encodeTicket({ ...ticket, signature: bytes.toString('base64url') }))).toMatchObject({ reason: 'signature_invalid' });
  });
  it('rejects expiry and late start without clamping', () => {
    const f = fixture(); const ticket = f.makeTicket({ expiresMonotonicUs: '1020000' });
    f.clock.advance(20_000n);
    expect(f.controller.submit(encodeTicket(ticket))).toMatchObject({ reason: 'expired' });
    const g = fixture(); const late = g.makeTicket(); g.clock.advance(1n);
    expect(g.controller.submit(encodeTicket(late))).toMatchObject({ reason: 'cue_window_invalid' });
  });
  it('rejects an overly uncertain challenge', () => {
    const f = fixture();
    const proposalSha256 = digest('uncertain-proposal');
    const challengeId = f.controller.issueChallenge(proposalSha256, 5001n)!;
    expect(f.submit({ proposalSha256, challengeId })).toMatchObject({ reason: 'clock_uncertain' });
  });
  it('rejects consumed challenges and ticket identifiers', () => {
    const f = fixture(); const ticket = f.makeTicket();
    expect(f.controller.submit(encodeTicket(ticket)).decision).toBe('accepted');
    expect(f.controller.submit(encodeTicket(ticket))).toMatchObject({ reason: 'challenge_unknown_or_consumed' });
    const g = fixture(); const previous = g.makeTicket(); g.controller.submit(encodeTicket(previous));
    g.controller.endSession(); g.clock.advance(2_000_000n); g.arm();
    expect(g.submit({ ticketId: previous.ticketId })).toMatchObject({ reason: 'replay' });
  });
  it('rejects equal or lower sequences with new challenges', () => {
    for (const sequence of ['0', '1']) {
      const f = fixture(); f.submit(); f.controller.endSession(); f.clock.advance(2_000_000n); f.arm();
      expect(f.submit({ sequence })).toMatchObject({ reason: 'replay' });
    }
  });
  it('fail closes when challenge capacity is full without evicting live entries', () => {
    const f = fixture(createSimulationPolicy({ challengeCapacity: 1 }));
    expect(f.controller.issueChallenge(hash)).not.toBeNull();
    expect(f.controller.issueChallenge(hash)).toBeNull();
    expect(f.controller.armState).toBe('FAULT');
    expect(f.controller.counters.challengeEntries).toBe(1);
  });
  it('expired challenges can be pruned but never reused', () => {
    const f = fixture(createSimulationPolicy({ challengeCapacity: 1 }));
    const old = f.controller.issueChallenge(hash);
    f.controller.endSession(); f.clock.advance(500001n);
    const fresh = f.controller.issueChallenge(hash);
    expect(fresh).not.toBeNull(); expect(fresh).not.toBe(old);
    expect(f.controller.counters.challengeEntries).toBe(1);
  });
  it('fail closes on ticket cache capacity without losing replay state', () => {
    const f = fixture(createSimulationPolicy({ ticketCapacity: 1 }));
    f.submit(); f.controller.endSession(); f.clock.advance(2_000_000n); f.arm();
    expect(f.submit()).toMatchObject({ reason: 'replay_or_dose_cache_full' });
    expect(f.controller.counters.ticketEntries).toBe(1);
  });
});

describe('persistent conservative dose reservations', () => {
  it('reserves the full requested dose even when a cue is cancelled', () => {
    const policy = createSimulationPolicy();
    policy.modalities.audio.maxDurationMs = 20;
    policy.modalities.audio.maxRampMs = 20;
    policy.modalities.audio.maxCumulativeMs = 20;
    const f = fixture(policy); f.submit(); f.controller.mute();
    f.controller.simulatePhysicalAcknowledgement(); f.clock.advance(2_000_000n); f.arm();
    expect(f.submit()).toMatchObject({ reason: 'dose_budget' });
  });
  it('enforces cooldown relative to reserved end time', () => {
    const f = fixture(); f.submit(); f.clock.advance(20_000n); f.refresh();
    expect(f.submit()).toMatchObject({ reason: 'cooldown' });
  });
  it('preserves dose through restart and rejects tickets from the previous boot', () => {
    const f = fixture(); const old = f.makeTicket(); f.controller.submit(encodeTicket(old));
    const before = f.controller.exportSimulatedDoseCheckpoint();
    f.controller.reboot();
    expect(f.controller.armState).toBe('DISARMED'); expect(f.controller.virtualGateOpen).toBe(false);
    expect(f.controller.exportSimulatedDoseCheckpoint()).toEqual(before);
    f.arm(); expect(f.controller.submit(encodeTicket(old))).toMatchObject({ reason: 'boot_mismatch' });
  });
  it('unreadable persistent state cannot reset the budget or clear with a self test', () => {
    const f = fixture(); f.submit();
    const bad = { ...f.controller.exportSimulatedDoseCheckpoint(), checkpointSha256: hash };
    f.controller.reboot(bad);
    expect(f.controller.armState).toBe('FAULT');
    expect(f.controller.simulateMaintenanceAndPhysicalAcknowledgement(true)).toBe(false);
    expect(f.controller.counters.doseEntries).toBe(1);
    const fresh = new FakeMcuSafetyController(f.clock, f.publicKey, createSimulationPolicy(), 1, bad);
    expect(fresh.armState).toBe('FAULT');
    fresh.dispose();
  });
  it('mute cannot downgrade an integrity fault and bypass persistent dose validity', () => {
    const f = fixture();
    const checkpoint = f.controller.exportSimulatedDoseCheckpoint();
    f.controller.reboot({ ...checkpoint, checkpointSha256: '0'.repeat(64) });
    f.controller.mute();
    expect(f.controller.armState).toBe('FAULT');
    expect(f.controller.simulatePhysicalAcknowledgement()).toBe(false);
    expect(f.arm()).toBe(false);
    expect(f.controller.simulatePhysicalConfirm()).toBe(false);
    expect(f.submit()).toMatchObject({ decision: 'rejected', reason: 'fault' });
    expect(f.controller.virtualGateOpen).toBe(false);
    expect(() => f.controller.exportSimulatedDoseCheckpoint()).toThrow();
  });
  it('mute cannot downgrade a watchdog fault into the weaker recovery path', () => {
    const f = fixture(); f.controller.watchdogExpired(); f.controller.mute();
    expect(f.controller.armState).toBe('FAULT');
    expect(f.controller.simulatePhysicalAcknowledgement()).toBe(false);
    expect(f.arm()).toBe(false);
    expect(f.controller.simulateMaintenanceAndPhysicalAcknowledgement(true)).toBe(true);
  });
  it('prunes only outside the full rolling dose window', () => {
    const policy = createSimulationPolicy({ rollingWindowUs: 3_000_000n });
    policy.modalities.audio.maxDurationMs = 20; policy.modalities.audio.maxRampMs = 20; policy.modalities.audio.maxCumulativeMs = 20;
    const f = fixture(policy); f.submit(); f.controller.endSession();
    f.clock.advance(3_020_000n); f.arm();
    expect(f.submit().decision).toBe('accepted');
    expect(f.controller.counters.doseEntries).toBe(1);
  });
  it('policy is copied and deeply frozen', () => {
    const policy = createSimulationPolicy(); const f = fixture(policy);
    policy.modalities.audio.maxIntensityQ15 = 32767;
    expect(f.controller.policy.modalities.audio.maxIntensityQ15).toBe(4096);
    expect(() => { f.controller.policy.modalities.audio.assets = [hash]; }).toThrow();
  });
  it.each([
    { challengeCapacity: 0 }, { ticketCapacity: -1 }, { receiptRetention: 0 },
    { heartbeatTimeoutUs: 0n }, { minimumConfidenceQ15: 32768 },
  ])('rejects invalid immutable policy %s', overrides => {
    expect(() => createSimulationFixture(1, createSimulationPolicy(overrides))).toThrow();
  });
});

describe('simulated receipt provenance and bounded evidence', () => {
  it('uses a verifiable hash chain with no live receipt conformance claim', () => {
    const f = fixture(); f.submit(); f.clock.advance(20_000n);
    const receipts = f.controller.receipts;
    for (let i = 0; i < receipts.length; i += 1) {
      const { receiptSha256, ...body } = receipts[i];
      expect(digest(JSON.stringify(body))).toBe(receiptSha256);
      expect(body.previousReceiptSha256).toBe(i === 0 ? null : receipts[i - 1].receiptSha256);
      expect(body).toMatchObject({ evidenceLevel: 'simulated', kind: 'SimulatedGateReceipt', hardwareActuation: false });
      expect(body).not.toHaveProperty('signature');
    }
  });
  it('bounds receipt storage while counting all submissions', () => {
    const f = createSimulationFixture(1, createSimulationPolicy({ receiptRetention: 2 }));
    for (let i = 0; i < 7; i += 1) f.controller.submit(Uint8Array.of(0));
    expect(f.controller.counters).toMatchObject({ parserRequests: 7, rejectedTickets: 7, receipts: 7, retainedReceipts: 2 });
    expect(f.controller.receipts[0].receiptSequence).toBe(6);
  });
  it('does not let a caller mutate retained receipts', () => {
    const f = fixture(); f.submit(); const receipts = f.controller.receipts; receipts[0].reason = 'tampered';
    expect(f.controller.receipts[0].reason).toBe('ok');
  });
});

describe('deterministic mission corpus', () => {
  it('reproduces exact counts and hashes without external IO', () => {
    const options = { seed: 43, nights: 2, malformedCases: 128, restartCases: 10 };
    const first = runSimulation(options), second = runSimulation(options);
    expect(first).toEqual(second);
    expect(first.verdict).toBe('ACCEPT');
    expect(first.hardwareActuation).toBe(false);
    expect(first.executed).toMatchObject({ malformedCases: 128, restartCases: 10, syntheticNightScenarios: 2, parserRequests: 142, invariantFailures: 0 });
    expect(first.hardwareGate.verdict).toBe('INCONCLUSIVE');
    expect(first.researchGate.verdict).toBe('INCONCLUSIVE');
    expect(() => JSON.stringify(first)).not.toThrow();
    expect(Object.values(first.mutationFamilies).reduce((a, b) => a + b, 0)).toBe(128);
    expect(first.malformedCounters.acceptedTickets).toBe(0);
  });
  it('missing coverage never becomes a passing result', () => {
    expect(runSimulation({ nights: 0, malformedCases: 0, restartCases: 0 }).verdict).toBe('INCONCLUSIVE');
  });
  it.each([{ nights: -1 }, { seed: 1.1 }, { malformedCases: 10_000_001 }, { restartCases: Infinity }])('rejects unbounded or malformed run options %j', options => {
    expect(() => runSimulation(options)).toThrow();
  });
  it('exposes a decodable benchmark fixture without network or real credentials', () => {
    expect(createSimulationFixture().bytes).toBeInstanceOf(Uint8Array);
  });
});
