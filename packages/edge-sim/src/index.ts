import { createHash, createPrivateKey, createPublicKey, sign, type KeyObject } from 'node:crypto';
import {
  decodeTicket, encodeTicket, encodeTicketPayload, verifyTicket,
  type CueTicketV1, type UnsignedCueTicketV1,
} from '@dream-machine/edge-contracts';

/** These keys are PUBLIC FIXTURES. They must never be accepted by a physical controller. */
const PUBLIC_FIXTURE_SEED = '000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f';
const U64_MAX = (1n << 64n) - 1n;
export const SIMULATION_ONLY = 'SIMULATION_ONLY_NO_PHYSICAL_AUTHORITY' as const;
export const digest = (value: string | Uint8Array): string => createHash('sha256').update(value).digest('hex');
const id = (value: string): string => digest(value).slice(0, 32);

export type ArmState = 'DISARMED' | 'OBSERVE' | 'ARMED' | 'MUTED' | 'FAULT';
export type Modality = CueTicketV1['modality'];
export type Verdict = 'ACCEPT' | 'REJECT' | 'INCONCLUSIVE';

export class VirtualClock {
  #now: bigint;
  #listeners = new Set<(before: bigint, after: bigint) => void>();
  constructor(initialUs = 1_000_000n) {
    if (typeof initialUs !== 'bigint' || initialUs < 0n || initialUs > U64_MAX) throw new RangeError('clock out of uint64 range');
    this.#now = initialUs;
  }
  get nowUs(): bigint { return this.#now; }
  advance(deltaUs: bigint): void {
    if (typeof deltaUs !== 'bigint' || deltaUs < 0n || this.#now + deltaUs > U64_MAX) throw new RangeError('clock cannot reverse or overflow');
    const before = this.#now;
    this.#now += deltaUs;
    for (const listener of this.#listeners) listener(before, this.#now);
  }
  onAdvance(listener: (before: bigint, after: bigint) => void): () => void {
    this.#listeners.add(listener);
    return () => { this.#listeners.delete(listener); };
  }
}

export interface SimulatedSafetySnapshot {
  evidenceLevel: 'simulated';
  observedMonotonicUs: string;
  sequence: string;
  occupants: number;
  qualityQ15: number;
  respirationBpm: number | null;
  heartBpm: number | null;
  flags: string[];
  stateDigest: string;
}

/** Synthetic numbers exercise quality logic. They do not model dream or sleep physiology. */
export function syntheticRadar(
  clock: VirtualClock, sequence: bigint, seed = 1, mode: 'normal' | 'dropout' | 'multiple_occupants' = 'normal',
): SimulatedSafetySnapshot {
  if (!Number.isSafeInteger(seed) || typeof sequence !== 'bigint' || sequence < 0n || sequence > U64_MAX) throw new RangeError('invalid fixture input');
  const body = {
    evidenceLevel: 'simulated' as const,
    observedMonotonicUs: clock.nowUs.toString(), sequence: sequence.toString(),
    occupants: mode === 'multiple_occupants' ? 2 : mode === 'dropout' ? 0 : 1,
    qualityQ15: mode === 'normal' ? 30000 : 0,
    respirationBpm: mode === 'normal' ? 12 + Math.abs(seed % 6) : null,
    heartBpm: mode === 'normal' ? 55 + Math.abs(seed % 15) : null,
    flags: mode === 'normal' ? [] : [mode === 'dropout' ? 'packet_loss' : 'multiple_subjects'],
  };
  return { ...body, stateDigest: digest(JSON.stringify(body)) };
}

export interface SimulationPolicy {
  minimumConfidenceQ15: number;
  sensorMaxAgeUs: bigint;
  heartbeatTimeoutUs: bigint;
  challengeMaxAgeUs: bigint;
  maxClockUncertaintyUs: bigint;
  challengeCapacity: number;
  ticketCapacity: number;
  doseCapacity: number;
  receiptRetention: number;
  rollingWindowUs: bigint;
  modalities: Record<Modality, {
    enabled: boolean; assets: readonly string[]; maxIntensityQ15: number;
    maxDurationMs: number; minRampMs: number; maxRampMs: number;
    cooldownUs: bigint; maxCumulativeMs: number;
  }>;
}

export function createSimulationPolicy(overrides: Partial<SimulationPolicy> = {}): SimulationPolicy {
  const modality = (name: Modality, enabled: boolean) => ({
    enabled, assets: [digest(`simulated-${name}-asset`)], maxIntensityQ15: 4096,
    maxDurationMs: 1000, minRampMs: 5, maxRampMs: 500, cooldownUs: 1_000_000n, maxCumulativeMs: 5000,
  });
  return {
    minimumConfidenceQ15: 24000, sensorMaxAgeUs: 250_000n, heartbeatTimeoutUs: 75_000n,
    challengeMaxAgeUs: 500_000n, maxClockUncertaintyUs: 5000n,
    challengeCapacity: 256, ticketCapacity: 4096, doseCapacity: 256, receiptRetention: 128,
    rollingWindowUs: 86_400_000_000n,
    modalities: { audio: modality('audio', true), light: modality('light', false), haptic: modality('haptic', false) },
    ...overrides,
  };
}

function policyJson(policy: SimulationPolicy): string {
  return JSON.stringify(policy, (_key, value: unknown) => typeof value === 'bigint' ? value.toString() : value);
}

function freezePolicy(policy: SimulationPolicy): Readonly<SimulationPolicy> {
  for (const key of ['challengeCapacity', 'ticketCapacity', 'doseCapacity', 'receiptRetention'] as const) {
    if (!Number.isSafeInteger(policy[key]) || policy[key] < 1 || policy[key] > 100_000) throw new RangeError(`invalid ${key}`);
  }
  if (!Number.isInteger(policy.minimumConfidenceQ15) || policy.minimumConfidenceQ15 < 0 || policy.minimumConfidenceQ15 > 32767) throw new RangeError('invalid quality floor');
  for (const key of ['sensorMaxAgeUs', 'heartbeatTimeoutUs', 'challengeMaxAgeUs', 'maxClockUncertaintyUs', 'rollingWindowUs'] as const) {
    if (typeof policy[key] !== 'bigint' || policy[key] <= 0n || policy[key] > U64_MAX) throw new RangeError(`invalid ${key}`);
  }
  const modalities = {} as SimulationPolicy['modalities'];
  for (const name of ['audio', 'light', 'haptic'] as const) {
    const source = policy.modalities[name];
    if (!source || typeof source.enabled !== 'boolean' || source.assets.length < 1 || source.assets.length > 256 || source.assets.some(asset => !/^[a-f0-9]{64}$/.test(asset))) throw new RangeError('invalid modality assets');
    for (const field of ['maxIntensityQ15', 'maxDurationMs', 'minRampMs', 'maxRampMs', 'maxCumulativeMs'] as const) {
      if (!Number.isSafeInteger(source[field]) || source[field] < 0) throw new RangeError(`invalid modality ${field}`);
    }
    if (source.maxIntensityQ15 > 32767 || source.maxDurationMs < 1 || source.maxDurationMs > 60000 || source.minRampMs > source.maxRampMs || source.maxRampMs > 10000 || source.maxRampMs > source.maxDurationMs || source.maxCumulativeMs < source.maxDurationMs || typeof source.cooldownUs !== 'bigint' || source.cooldownUs < 0n || source.cooldownUs > U64_MAX) throw new RangeError('invalid modality bounds');
    modalities[name] = Object.freeze({ ...source, assets: Object.freeze([...source.assets]) });
  }
  return Object.freeze({ ...policy, modalities: Object.freeze(modalities) });
}

export interface SimulatedReceipt {
  kind: 'SimulatedGateReceipt';
  evidenceLevel: 'simulated';
  hardwareActuation: false;
  safetyAuthority: typeof SIMULATION_ONLY;
  receiptSequence: number;
  bootId: string;
  atMonotonicUs: string;
  ticketSha256: string | null;
  ticketId: string | null;
  decision: 'accepted' | 'rejected' | 'cancelled' | 'completed';
  reason: string;
  armState: ArmState;
  virtualGateOpen: boolean;
  previousReceiptSha256: string | null;
  receiptSha256: string;
}

interface Challenge { issuedUs: bigint; uncertaintyUs: bigint; proposalSha256: string }
interface Dose { modality: Modality; untilUs: string; durationMs: number }
export interface SimulatedDoseCheckpoint {
  kind: 'SimulatedDoseCheckpoint';
  policySha256: string;
  dose: Dose[];
  checkpointSha256: string;
}
interface PendingCue { ticket: CueTicketV1; ticketSha256: string; start: bigint; end: bigint }

/** No GPIO, serial, network, hardware keys, file IO, timer IO, or live cue API exists here. */
export class FakeMcuSafetyController {
  readonly evidenceLevel = 'simulated' as const;
  readonly hardwareActuation = false as const;
  readonly safetyAuthority = SIMULATION_ONLY;
  readonly policy: Readonly<SimulationPolicy>;
  readonly deviceId: string;
  readonly firmwareSha256 = digest('simulation-not-firmware');
  readonly experimentId: string;
  readonly consentSha256: string;
  readonly policySha256: string;
  readonly publicKey: KeyObject;
  #bootId: string;
  #bootCounter = 0;
  #state: ArmState = 'DISARMED';
  #virtualGateOpen = false;
  #sensor: SimulatedSafetySnapshot | null = null;
  #lastSensorSequence = -1n;
  #lastHeartbeat: bigint | null = null;
  #lastHeartbeatSequence = -1n;
  #consentValid = true;
  #consentEpoch = 1;
  #challenges = new Map<string, Challenge>();
  #tickets = new Set<string>();
  #highestSequence = -1n;
  #challengeCounter = 0;
  #dose: Dose[] = [];
  #persistentDoseValid = true;
  #pending: PendingCue | null = null;
  #receipts: SimulatedReceipt[] = [];
  #receiptCount = 0;
  #receiptHead: string | null = null;
  #parserRequests = 0;
  #signatureVerifications = 0;
  #accepted = 0;
  #rejected = 0;
  #clock: VirtualClock;
  #unsubscribe: () => void;
  #disposed = false;

  constructor(clock: VirtualClock, publicKey: KeyObject, policy = createSimulationPolicy(), seed = 1, checkpoint?: SimulatedDoseCheckpoint) {
    this.#clock = clock;
    this.policy = freezePolicy(policy);
    this.publicKey = publicKey;
    this.deviceId = id(`sim-device-${seed}`);
    this.#bootId = id(`sim-boot-${seed}-0`);
    this.experimentId = id(`sim-experiment-${seed}`);
    this.consentSha256 = digest(`sim-consent-${seed}`);
    // This synthetic policy hash is not RFC8785 SafetyPolicyV1 conformance.
    this.policySha256 = digest(policyJson(this.policy));
    this.#unsubscribe = clock.onAdvance((before, after) => this.#onAdvance(before, after));
    if (checkpoint !== undefined) this.#restoreDose(checkpoint);
  }

  get armState(): ArmState { return this.#state; }
  get bootId(): string { return this.#bootId; }
  get consentEpoch(): number { return this.#consentEpoch; }
  get virtualGateOpen(): boolean { return this.#virtualGateOpen; }
  get snapshot(): SimulatedSafetySnapshot | null { return this.#sensor ? structuredClone(this.#sensor) : null; }
  get receipts(): SimulatedReceipt[] { return structuredClone(this.#receipts); }
  get counters() {
    return {
      parserRequests: this.#parserRequests, signatureVerifications: this.#signatureVerifications,
      acceptedTickets: this.#accepted, rejectedTickets: this.#rejected, receipts: this.#receiptCount,
      retainedReceipts: this.#receipts.length, receiptHead: this.#receiptHead,
      challengeEntries: this.#challenges.size, ticketEntries: this.#tickets.size, doseEntries: this.#dose.length,
    };
  }

  dispose(): void { this.#disposed = true; this.#cancel('disposed', 'FAULT'); this.#unsubscribe(); }

  setSnapshot(snapshot: SimulatedSafetySnapshot): void {
    if (snapshot === null || typeof snapshot !== 'object' || Array.isArray(snapshot)) {
      this.#cancel('invalid_sensor_snapshot', 'FAULT'); return;
    }
    const { stateDigest, ...body } = snapshot;
    let valid: boolean;
    try {
      valid = snapshot.evidenceLevel === 'simulated' && stateDigest === digest(JSON.stringify(body)) &&
        Object.keys(snapshot).sort().join(',') === 'evidenceLevel,flags,heartBpm,observedMonotonicUs,occupants,qualityQ15,respirationBpm,sequence,stateDigest' &&
        /^(0|[1-9][0-9]*)$/.test(snapshot.sequence) && BigInt(snapshot.sequence) > this.#lastSensorSequence && BigInt(snapshot.sequence) <= U64_MAX &&
        /^(0|[1-9][0-9]*)$/.test(snapshot.observedMonotonicUs) && BigInt(snapshot.observedMonotonicUs) <= this.#clock.nowUs &&
        Number.isInteger(snapshot.qualityQ15) && snapshot.qualityQ15 >= 0 && snapshot.qualityQ15 <= 32767 &&
        Number.isInteger(snapshot.occupants) && snapshot.occupants >= 0 && snapshot.occupants <= 100 &&
        Array.isArray(snapshot.flags) && snapshot.flags.length <= 16 && snapshot.flags.every(flag => typeof flag === 'string' && flag.length <= 64) &&
        (snapshot.respirationBpm === null || Number.isFinite(snapshot.respirationBpm) && snapshot.respirationBpm > 0) &&
        (snapshot.heartBpm === null || Number.isFinite(snapshot.heartBpm) && snapshot.heartBpm > 0);
    } catch { valid = false; }
    if (!valid) { this.#cancel('invalid_sensor_snapshot', 'FAULT'); return; }
    this.#sensor = structuredClone(snapshot);
    this.#lastSensorSequence = BigInt(snapshot.sequence);
    if (this.#state === 'ARMED' && !this.#sensorHealthy(this.#clock.nowUs)) this.#cancel('low_signal_quality', 'FAULT');
  }

  heartbeat(sequence: bigint): void {
    if (typeof sequence !== 'bigint' || sequence < 0n || sequence > U64_MAX || sequence <= this.#lastHeartbeatSequence) {
      this.#cancel('heartbeat_replay', 'FAULT'); return;
    }
    this.#lastHeartbeat = this.#clock.nowUs;
    this.#lastHeartbeatSequence = sequence;
    // Recovery never changes arm state.
  }

  simulatePhysicalArm(): boolean {
    if (this.#disposed || !this.#persistentDoseValid || this.#state !== 'DISARMED' || !this.#consentValid || !this.#sensorHealthy(this.#clock.nowUs)) return false;
    this.#state = 'OBSERVE'; return true;
  }
  simulatePhysicalConfirm(): boolean {
    if (this.#disposed || !this.#persistentDoseValid || this.#state !== 'OBSERVE' || !this.#consentValid || !this.#sensorHealthy(this.#clock.nowUs) || !this.#heartbeatHealthy(this.#clock.nowUs)) return false;
    this.#state = 'ARMED'; return true;
  }
  mute(): void { this.#cancel('cancelled_by_user', 'MUTED'); }
  endSession(): void {
    if (this.#state === 'MUTED' || this.#state === 'FAULT') return;
    this.#cancel('session_ended', 'DISARMED');
  }
  simulatePhysicalAcknowledgement(): boolean {
    if (this.#disposed || !this.#persistentDoseValid || this.#state !== 'MUTED') return false;
    this.#state = 'DISARMED'; return true;
  }
  simulateMaintenanceAndPhysicalAcknowledgement(selfTestPassed: boolean): boolean {
    if (this.#disposed || this.#state !== 'FAULT' || !selfTestPassed || !this.#consentValid || !this.#persistentDoseValid) return false;
    this.#state = 'DISARMED'; return true;
  }
  revokeConsent(): void { this.#consentValid = false; this.#consentEpoch += 1; this.#cancel('consent_revoked', 'MUTED'); }
  watchdogExpired(): void { this.#cancel('watchdog_expired', 'FAULT'); }

  issueChallenge(proposalSha256: string, uncertaintyUs = 1000n): string | null {
    if (!/^[a-f0-9]{64}$/.test(proposalSha256) || typeof uncertaintyUs !== 'bigint' || uncertaintyUs < 0n || uncertaintyUs > U64_MAX) { this.#cancel('invalid_challenge', 'FAULT'); return null; }
    for (const [key, value] of this.#challenges) if (this.#clock.nowUs - value.issuedUs > this.policy.challengeMaxAgeUs) this.#challenges.delete(key);
    if (this.#challenges.size >= this.policy.challengeCapacity) { this.#cancel('challenge_cache_full', 'FAULT'); return null; }
    const challengeId = id(`${this.#bootId}-challenge-${++this.#challengeCounter}`);
    this.#challenges.set(challengeId, { issuedUs: this.#clock.nowUs, uncertaintyUs, proposalSha256 });
    return challengeId;
  }

  submit(bytes: Uint8Array): SimulatedReceipt {
    this.#parserRequests += 1;
    const ticketSha256 = bytes instanceof Uint8Array ? digest(bytes) : digest('simulated-nonbyte-submission');
    let ticket: CueTicketV1;
    try { ticket = decodeTicket(bytes); }
    catch { return this.#reject('malformed', null, ticketSha256); }
    if (ticket.deviceId !== this.deviceId) return this.#reject('identity_mismatch', ticket, ticketSha256);
    if (ticket.bootId !== this.#bootId) return this.#reject('boot_mismatch', ticket, ticketSha256);
    if (ticket.firmwareSha256 !== this.firmwareSha256) return this.#reject('firmware_mismatch', ticket, ticketSha256);
    if (ticket.policySha256 !== this.policySha256) return this.#reject('policy_mismatch', ticket, ticketSha256);
    if (ticket.experimentId !== this.experimentId) return this.#reject('experiment_mismatch', ticket, ticketSha256);
    if (!this.#consentValid || ticket.consentEpoch !== this.#consentEpoch || ticket.consentSha256 !== this.consentSha256) return this.#reject('consent_revoked', ticket, ticketSha256);
    const challenge = this.#challenges.get(ticket.challengeId);
    if (!challenge) return this.#reject('challenge_unknown_or_consumed', ticket, ticketSha256);
    this.#signatureVerifications += 1;
    if (!verifyTicket(ticket, this.publicKey)) return this.#reject('signature_invalid', ticket, ticketSha256);
    if (ticket.proposalSha256 !== challenge.proposalSha256) return this.#reject('proposal_mismatch', ticket, ticketSha256);
    const now = this.#clock.nowUs;
    const issued = BigInt(ticket.issuedMonotonicUs), start = BigInt(ticket.notBeforeMonotonicUs), expiry = BigInt(ticket.expiresMonotonicUs);
    if (now < issued || issued < challenge.issuedUs) return this.#reject('too_early', ticket, ticketSha256);
    if (now >= expiry) return this.#reject('expired', ticket, ticketSha256);
    if (now - challenge.issuedUs > this.policy.challengeMaxAgeUs || challenge.uncertaintyUs > this.policy.maxClockUncertaintyUs) return this.#reject('clock_uncertain', ticket, ticketSha256);
    if (BigInt(ticket.sequence) <= this.#highestSequence || this.#tickets.has(ticket.ticketId)) return this.#reject('replay', ticket, ticketSha256);
    if (!this.#sensorHealthy(now) || ticket.stateDigest !== this.#sensor?.stateDigest || ticket.confidenceQ15 < this.policy.minimumConfidenceQ15 || ticket.confidenceQ15 > (this.#sensor?.qualityQ15 ?? 0)) return this.#reject('low_signal_quality', ticket, ticketSha256);
    if (this.#disposed || !this.#persistentDoseValid || this.#state !== 'ARMED') return this.#reject(this.#state === 'FAULT' || !this.#persistentDoseValid || this.#disposed ? 'fault' : 'not_armed', ticket, ticketSha256);
    if (!this.#heartbeatHealthy(now)) return this.#reject('heartbeat_lost', ticket, ticketSha256);
    if (this.#pending) return this.#reject('cue_in_progress', ticket, ticketSha256);
    const bounds = this.policy.modalities[ticket.modality];
    if (!bounds.enabled || !bounds.assets.includes(ticket.assetSha256)) return this.#reject('asset_denied', ticket, ticketSha256);
    if (ticket.intensityQ15 > bounds.maxIntensityQ15) return this.#reject('intensity_denied', ticket, ticketSha256);
    if (ticket.durationMs > bounds.maxDurationMs) return this.#reject('duration_denied', ticket, ticketSha256);
    if (ticket.rampMs < bounds.minRampMs || ticket.rampMs > bounds.maxRampMs) return this.#reject('ramp_denied', ticket, ticketSha256);
    const end = start + BigInt(ticket.durationMs) * 1000n;
    // Do not silently truncate a policy-approved duration or start late.
    if (start < now || end > expiry) return this.#reject('cue_window_invalid', ticket, ticketSha256);
    this.#pruneDose(now);
    const sameModality = this.#dose.filter(dose => dose.modality === ticket.modality);
    if (sameModality.some(dose => start < BigInt(dose.untilUs) + bounds.cooldownUs)) return this.#reject('cooldown', ticket, ticketSha256);
    if (sameModality.reduce((total, dose) => total + dose.durationMs, 0) + ticket.durationMs > bounds.maxCumulativeMs) return this.#reject('dose_budget', ticket, ticketSha256);
    if (this.#tickets.size >= this.policy.ticketCapacity || this.#dose.length >= this.policy.doseCapacity) return this.#reject('replay_or_dose_cache_full', ticket, ticketSha256);
    // Single synchronous critical section: no asynchronous dispatch before replay and dose reservation.
    this.#challenges.delete(ticket.challengeId);
    this.#tickets.add(ticket.ticketId);
    this.#highestSequence = BigInt(ticket.sequence);
    this.#dose.push({ modality: ticket.modality, untilUs: end.toString(), durationMs: ticket.durationMs });
    this.#pending = { ticket, ticketSha256, start, end };
    this.#virtualGateOpen = start === now;
    this.#accepted += 1;
    return this.#record('accepted', 'ok', ticket, ticketSha256, now);
  }

  exportSimulatedDoseCheckpoint(): SimulatedDoseCheckpoint {
    if (!this.#persistentDoseValid) throw new Error('unreadable dose state cannot produce a valid checkpoint');
    const body = { kind: 'SimulatedDoseCheckpoint' as const, policySha256: this.policySha256, dose: structuredClone(this.#dose) };
    return { ...body, checkpointSha256: digest(JSON.stringify(body)) };
  }

  reboot(checkpoint = this.exportSimulatedDoseCheckpoint()): void {
    this.#cancel('reboot', 'DISARMED');
    this.#bootId = id(`${this.deviceId}-reboot-${++this.#bootCounter}`);
    this.#challenges.clear(); this.#tickets.clear(); this.#highestSequence = -1n;
    this.#lastHeartbeat = null; this.#lastHeartbeatSequence = -1n;
    this.#sensor = null; this.#lastSensorSequence = -1n;
    // Virtual global time is retained to test dose continuity; this is not real reboot clock recovery.
    this.#restoreDose(checkpoint);
  }

  #restoreDose(checkpoint: SimulatedDoseCheckpoint): void {
    try {
      const { checkpointSha256, ...body } = checkpoint;
      if (body.kind !== 'SimulatedDoseCheckpoint' || body.policySha256 !== this.policySha256 || checkpointSha256 !== digest(JSON.stringify(body)) || !Array.isArray(body.dose) || body.dose.length > this.policy.doseCapacity) throw new Error('integrity');
      for (const dose of body.dose) {
        if (!['audio', 'light', 'haptic'].includes(dose.modality) || !/^(0|[1-9][0-9]*)$/.test(dose.untilUs) || BigInt(dose.untilUs) > U64_MAX || !Number.isInteger(dose.durationMs) || dose.durationMs < 1 || dose.durationMs > this.policy.modalities[dose.modality].maxDurationMs) throw new Error('dose');
      }
      this.#dose = structuredClone(body.dose);
      this.#persistentDoseValid = true;
    } catch { this.#persistentDoseValid = false; this.#state = 'FAULT'; this.#virtualGateOpen = false; }
  }

  #sensorHealthy(at: bigint): boolean {
    return this.#sensor !== null && this.#sensor.occupants === 1 && this.#sensor.flags.length === 0 &&
      this.#sensor.qualityQ15 >= this.policy.minimumConfidenceQ15 &&
      this.#sensor.respirationBpm !== null && this.#sensor.heartBpm !== null &&
      at >= BigInt(this.#sensor.observedMonotonicUs) && at - BigInt(this.#sensor.observedMonotonicUs) < this.policy.sensorMaxAgeUs;
  }
  #heartbeatHealthy(at: bigint): boolean {
    return this.#lastHeartbeat !== null && at >= this.#lastHeartbeat && at - this.#lastHeartbeat < this.policy.heartbeatTimeoutUs;
  }
  #pruneDose(at: bigint): void {
    this.#dose = this.#dose.filter(dose => at < BigInt(dose.untilUs) + this.policy.rollingWindowUs);
  }
  #onAdvance(_before: bigint, after: bigint): void {
    if (this.#state !== 'ARMED') return;
    const heartbeatDeadline = (this.#lastHeartbeat ?? 0n) + this.policy.heartbeatTimeoutUs;
    const sensorDeadline = BigInt(this.#sensor?.observedMonotonicUs ?? '0') + this.policy.sensorMaxAgeUs;
    const healthDeadline = heartbeatDeadline < sensorDeadline ? heartbeatDeadline : sensorDeadline;
    const healthReason = heartbeatDeadline <= sensorDeadline ? 'heartbeat_lost' : 'stale_sensor';
    const pending = this.#pending;
    if (pending && pending.start < healthDeadline && pending.start <= after) this.#virtualGateOpen = true;
    if (pending && pending.end <= after && pending.end < healthDeadline) {
      this.#virtualGateOpen = false; this.#pending = null;
      this.#record('completed', 'ok', pending.ticket, pending.ticketSha256, pending.end);
    }
    if (healthDeadline <= after) this.#cancel(healthReason, 'FAULT', healthDeadline);
  }
  #cancel(reason: string, state: ArmState, at = this.#clock.nowUs): void {
    const pending = this.#pending;
    this.#virtualGateOpen = false; this.#pending = null;
    // Stop requests cannot downgrade a fault into the weaker mute acknowledgement path.
    this.#state = this.#state === 'FAULT' && state === 'MUTED' ? 'FAULT' : state;
    if (pending) this.#record('cancelled', reason, pending.ticket, pending.ticketSha256, at);
  }
  #reject(reason: string, ticket: CueTicketV1 | null, ticketSha256: string): SimulatedReceipt {
    this.#rejected += 1;
    // Invalid submissions are deliberately denial-of-service safe: they latch a closed fault.
    this.#cancel(reason, 'FAULT');
    return this.#record('rejected', reason, ticket, ticketSha256, this.#clock.nowUs);
  }
  #record(decision: SimulatedReceipt['decision'], reason: string, ticket: CueTicketV1 | null, ticketSha256: string | null, at: bigint): SimulatedReceipt {
    const body = {
      kind: 'SimulatedGateReceipt' as const, evidenceLevel: 'simulated' as const, hardwareActuation: false as const,
      safetyAuthority: SIMULATION_ONLY, receiptSequence: ++this.#receiptCount, bootId: this.#bootId,
      atMonotonicUs: at.toString(), ticketSha256, ticketId: ticket?.ticketId ?? null,
      decision, reason, armState: this.#state, virtualGateOpen: this.#virtualGateOpen,
      previousReceiptSha256: this.#receiptHead,
    };
    const receipt = { ...body, receiptSha256: digest(JSON.stringify(body)) };
    this.#receiptHead = receipt.receiptSha256;
    this.#receipts.push(receipt);
    if (this.#receipts.length > this.policy.receiptRetention) this.#receipts.shift();
    return structuredClone(receipt);
  }
}

export function createSimulationFixture(seed = 1, policy = createSimulationPolicy()) {
  if (!Number.isSafeInteger(seed)) throw new RangeError('seed must be a safe integer');
  const privateKey = createPrivateKey({ key: Buffer.from(`302e020100300506032b657004220420${PUBLIC_FIXTURE_SEED}`, 'hex'), format: 'der', type: 'pkcs8' });
  const publicKey = createPublicKey(privateKey);
  const clock = new VirtualClock();
  const controller = new FakeMcuSafetyController(clock, publicKey, policy, seed);
  let sensorSequence = 0n, heartbeatSequence = 0n, ticketSequence = 0n;
  const refresh = (mode: Parameters<typeof syntheticRadar>[3] = 'normal') => {
    controller.setSnapshot(syntheticRadar(clock, ++sensorSequence, seed, mode));
    controller.heartbeat(++heartbeatSequence);
  };
  const arm = () => { refresh(); return controller.simulatePhysicalArm() && controller.simulatePhysicalConfirm(); };
  const makeTicket = (overrides: Partial<UnsignedCueTicketV1> = {}): CueTicketV1 => {
    const sequence = ++ticketSequence;
    const proposalSha256 = digest(`sim-proposal-${seed}-${sequence}`);
    const challengeId = controller.issueChallenge(proposalSha256);
    if (challengeId === null) throw new Error('simulated challenge unavailable');
    const ticket: UnsignedCueTicketV1 = {
      version: 1, ticketId: id(`sim-ticket-${seed}-${sequence}`), proposalSha256,
      deviceId: controller.deviceId, bootId: controller.bootId, challengeId,
      policySha256: controller.policySha256, firmwareSha256: controller.firmwareSha256,
      experimentId: controller.experimentId, consentSha256: controller.consentSha256,
      consentEpoch: controller.consentEpoch, sequence: sequence.toString(),
      issuedMonotonicUs: clock.nowUs.toString(), notBeforeMonotonicUs: clock.nowUs.toString(),
      expiresMonotonicUs: (clock.nowUs + 2_000_000n).toString(),
      stateDigest: controller.snapshot?.stateDigest ?? digest('missing-snapshot'), confidenceQ15: 28000,
      modality: 'audio', assetSha256: policy.modalities.audio.assets[0], intensityQ15: 1024,
      durationMs: 20, rampMs: 5, reasonCode: 1, ...overrides,
    };
    return { ...ticket, signature: sign(null, encodeTicketPayload(ticket), privateKey).toString('base64url') };
  };
  const submit = (overrides: Partial<UnsignedCueTicketV1> = {}) => controller.submit(encodeTicket(makeTicket(overrides)));
  return { clock, controller, publicKey, refresh, arm, makeTicket, submit,
    get bytes(): Uint8Array { return encodeTicket(makeTicket()); },
    signFixtureTicket: (ticket: UnsignedCueTicketV1): CueTicketV1 => ({ ...ticket, signature: sign(null, encodeTicketPayload(ticket), privateKey).toString('base64url') }) };
}

export interface SimulationOptions { seed?: number; nights?: number; malformedCases?: number; restartCases?: number }

/** Counts are incremented only where the real parser or restart operation executes. */
export function runSimulation(options: SimulationOptions = {}) {
  const { seed = 1, nights = 3, malformedCases = 256, restartCases = 32 } = options;
  for (const [name, value] of Object.entries({ seed, nights, malformedCases, restartCases })) {
    if (!Number.isSafeInteger(value) || value < 0 || value > (name === 'malformedCases' ? 10_000_000 : name === 'seed' ? Number.MAX_SAFE_INTEGER : 100_000)) throw new RangeError(`invalid ${name}`);
  }
  if (seed + nights + 2 > Number.MAX_SAFE_INTEGER) throw new RangeError('derived fixture seed overflow');
  const fixtureHash = createHash('sha256');
  let invariantsChecked = 0, invariantFailures = 0, malformedExecuted = 0, restartsExecuted = 0;
  const check = (condition: boolean) => { invariantsChecked += 1; if (!condition) invariantFailures += 1; };
  const malformed = createSimulationFixture(seed);
  malformed.arm();
  const valid = encodeTicket(malformed.makeTicket());
  let random = (seed || 1) >>> 0;
  const next = () => { random ^= random << 13; random ^= random >>> 17; random ^= random << 5; return random >>> 0; };
  const families: Record<string, number> = {};
  for (let i = 0; i < malformedCases; i += 1) {
    const family = i % 8;
    let bytes: Uint8Array;
    if (family === 0) bytes = valid.slice(0, next() % valid.length);
    else if (family === 1) { bytes = new Uint8Array(valid.length + 1); bytes.set(valid); bytes[bytes.length - 1] = next() & 255; }
    else if (family === 2) { bytes = valid.slice(); bytes[0] = 0xbf; }
    else if (family === 3) { bytes = valid.slice(); bytes[2] = 0x20; }
    else if (family === 4) { bytes = valid.slice(); bytes[bytes.length - 1] ^= 1 + (next() % 255); }
    else if (family === 5) { bytes = new Uint8Array(769 + (next() % 8)); bytes.set(valid); }
    else if (family === 6) { bytes = Uint8Array.from([0xc0, ...valid]); }
    else { bytes = valid.slice(); const offset = 4 + (next() % (valid.length - 4)); bytes[offset] ^= 1 + (next() % 255); }
    const names = ['truncated', 'trailing', 'indefinite', 'negative_key', 'signature_mutation', 'oversize', 'tagged', 'seeded_bit_mutation'];
    families[names[family]] = (families[names[family]] ?? 0) + 1;
    // Every malformed input is tested from ARMED, never hidden by an earlier latched fault.
    if (malformed.controller.armState === 'FAULT') {
      malformed.controller.simulateMaintenanceAndPhysicalAcknowledgement(true);
      malformed.controller.simulatePhysicalArm();
      malformed.controller.simulatePhysicalConfirm();
    }
    check(malformed.controller.armState === 'ARMED');
    fixtureHash.update(bytes);
    const receipt = malformed.controller.submit(bytes);
    malformedExecuted += 1;
    check(receipt.decision === 'rejected');
    check(malformed.controller.virtualGateOpen === false);
  }
  const restart = createSimulationFixture(seed + 1);
  restart.arm();
  const stale = encodeTicket(restart.makeTicket());
  for (let i = 0; i < restartCases; i += 1) {
    restart.controller.reboot();
    restartsExecuted += 1;
    check(restart.controller.armState === 'DISARMED' && !restart.controller.virtualGateOpen);
    restart.refresh();
    const receipt = restart.controller.submit(stale);
    fixtureHash.update(receipt.receiptSha256);
    check(receipt.decision === 'rejected' && receipt.reason === 'boot_mismatch');
    check(!restart.controller.virtualGateOpen);
  }
  const nightResults: { night: number; observationEvidence: 'simulated'; accepted: number; dropoutStopped: boolean; multipleOccupantsStopped: boolean; verdict: Verdict }[] = [];
  let nightParserRequests = 0;
  for (let night = 0; night < nights; night += 1) {
    const fixture = createSimulationFixture(seed + night + 2);
    check(fixture.arm());
    const accepted = fixture.submit();
    check(accepted.decision === 'accepted' && fixture.controller.virtualGateOpen);
    fixture.clock.advance(5000n);
    fixture.refresh('dropout');
    const dropoutStopped = !fixture.controller.virtualGateOpen && fixture.controller.armState === 'FAULT';
    check(dropoutStopped);
    fixture.refresh();
    check(fixture.controller.armState === 'FAULT');
    check(fixture.controller.simulateMaintenanceAndPhysicalAcknowledgement(true));
    check(fixture.arm());
    fixture.clock.advance(2_000_000n);
    check(fixture.controller.armState === 'FAULT');
    check(fixture.controller.simulateMaintenanceAndPhysicalAcknowledgement(true));
    check(fixture.arm());
    check(fixture.submit().decision === 'accepted');
    fixture.refresh('multiple_occupants');
    const multipleOccupantsStopped = !fixture.controller.virtualGateOpen && fixture.controller.armState === 'FAULT';
    check(multipleOccupantsStopped);
    nightParserRequests += fixture.controller.counters.parserRequests;
    fixtureHash.update(fixture.controller.counters.receiptHead ?? '');
    nightResults.push({ night: night + 1, observationEvidence: 'simulated', accepted: fixture.controller.counters.acceptedTickets, dropoutStopped, multipleOccupantsStopped, verdict: dropoutStopped && multipleOccupantsStopped ? 'ACCEPT' : 'REJECT' });
    fixture.controller.dispose();
  }
  const malformedCounters = malformed.controller.counters, restartCounters = restart.controller.counters;
  malformed.controller.dispose(); restart.controller.dispose();
  return {
    schemaVersion: 1, kind: 'DreamMachineNonactuatingSimulation', evidenceLevel: 'simulated',
    safetyAuthority: SIMULATION_ONLY, hardwareActuation: false,
    verdict: (invariantFailures === 0 && malformedCases > 0 && restartCases > 0 && nights > 0 ? 'ACCEPT' : invariantFailures > 0 ? 'REJECT' : 'INCONCLUSIVE') as Verdict,
    verdictScope: 'software simulator assertions only; not policy promotion or hardware readiness',
    hardwareGate: { verdict: 'INCONCLUSIVE' as Verdict, blocked: true, reason: 'Independent controller isolation, real timing, calibrated output, physical mute, dose persistence and human reference evidence are unmeasured.' },
    researchGate: { verdict: 'INCONCLUSIVE' as Verdict, reason: 'Synthetic night scenarios are not usable held-out human nights, shadow evidence, prospective exposures or controls.' },
    seed, requested: { nights, malformedCases, restartCases },
    executed: { syntheticNightScenarios: nightResults.length, malformedCases: malformedExecuted, restartCases: restartsExecuted, parserRequests: malformedCounters.parserRequests + restartCounters.parserRequests + nightParserRequests, invariantsChecked, invariantFailures },
    fixtureSha256: fixtureHash.digest('hex'), mutationFamilies: families,
    malformedCounters, restartCounters, nightResults,
  };
}
