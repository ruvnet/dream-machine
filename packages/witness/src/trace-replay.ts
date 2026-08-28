import { createHash } from 'node:crypto';

export interface TraceEvent {
  id: string;
  step: number;
  kind: string;
  actor?: string;
  input?: unknown;
  output?: unknown;
  metadata?: Record<string, unknown>;
}

export interface AnchoredTraceReplay {
  version: 1;
  anchorId: string;
  anchorStep: number;
  prefixLength: number;
  prefixDigest: string;
  anchorDigest: string;
  originalSuffixDigest: string;
  originalTraceDigest: string;
}

export interface ReplayReceipt {
  version: 1;
  anchorId: string;
  prefixDigest: string;
  anchorDigest: string;
  regeneratedSuffixDigest: string;
  combinedTraceDigest: string;
  regeneratedSteps: number;
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

/**
 * Deterministic JSON encoding for trace evidence. Unsupported values fail
 * closed rather than silently changing the evidence being hashed.
 */
export function canonicalJson(value: unknown): string {
  const seen = new WeakSet<object>();

  const encode = (current: unknown): string => {
    if (current === null) return 'null';
    if (typeof current === 'string') return JSON.stringify(current);
    if (typeof current === 'boolean') return current ? 'true' : 'false';
    if (typeof current === 'number') {
      if (!Number.isFinite(current)) throw new Error('trace evidence contains a non-finite number');
      return JSON.stringify(Object.is(current, -0) ? 0 : current);
    }
    if (Array.isArray(current)) {
      if (seen.has(current)) throw new Error('trace evidence contains a cycle');
      const ownKeys = Reflect.ownKeys(current);
      const expectedKeys = [...current.keys()].map(String);
      expectedKeys.push('length');
      if (
        current.some((_, index) => !Object.hasOwn(current, index)) ||
        ownKeys.length !== expectedKeys.length ||
        ownKeys.some((key, index) => key !== expectedKeys[index])
      ) {
        throw new Error('trace evidence array must be dense and contain no extra properties');
      }
      seen.add(current);
      const result = `[${current.map((item) => encode(item)).join(',')}]`;
      seen.delete(current);
      return result;
    }
    if (typeof current === 'object') {
      const object = current as Record<string, unknown>;
      const prototype = Object.getPrototypeOf(object);
      if (prototype !== Object.prototype && prototype !== null) {
        throw new Error('trace evidence object must be a plain JSON object');
      }
      if (seen.has(object)) throw new Error('trace evidence contains a cycle');
      const ownKeys = Reflect.ownKeys(object);
      if (ownKeys.some((key) => typeof key !== 'string')) {
        throw new Error('trace evidence object contains a symbol key');
      }
      for (const key of ownKeys as string[]) {
        const descriptor = Object.getOwnPropertyDescriptor(object, key);
        if (!descriptor?.enumerable || !('value' in descriptor)) {
          throw new Error(`trace evidence property "${key}" must be an enumerable data property`);
        }
      }
      seen.add(object);
      const entries = (ownKeys as string[])
        .sort()
        .map((key) => {
          const item = object[key];
          if (item === undefined) throw new Error(`trace evidence contains undefined at key "${key}"`);
          return `${JSON.stringify(key)}:${encode(item)}`;
        });
      seen.delete(object);
      return `{${entries.join(',')}}`;
    }
    throw new Error(`trace evidence contains unsupported type "${typeof current}"`);
  };

  return encode(value);
}

export function traceDigest(events: readonly TraceEvent[]): string {
  validateTrace(events, { allowEmpty: true });
  return sha256(canonicalJson(events));
}

/**
 * Bind an intervention anchor to an immutable trace prefix. The original suffix
 * digest is retained as evidence but is never replayed as candidate output.
 */
export function createAnchoredReplay(
  events: readonly TraceEvent[],
  anchorId: string,
): AnchoredTraceReplay {
  validateTrace(events);
  const anchorIndex = events.findIndex((event) => event.id === anchorId);
  if (anchorIndex < 0) throw new Error(`anchor "${anchorId}" does not exist in trace`);

  const prefix = events.slice(0, anchorIndex);
  const anchor = events[anchorIndex];
  const suffix = events.slice(anchorIndex + 1);

  return {
    version: 1,
    anchorId: anchor.id,
    anchorStep: anchor.step,
    prefixLength: prefix.length,
    prefixDigest: traceDigest(prefix),
    anchorDigest: sha256(canonicalJson(anchor)),
    originalSuffixDigest: traceDigest(suffix),
    originalTraceDigest: traceDigest(events),
  };
}

/**
 * Verify that replay reconstruction reached the intervention anchor from the
 * exact same causal prefix. A digest match is necessary before regeneration.
 */
export function verifyReplayPrefix(
  plan: AnchoredTraceReplay,
  reconstructedPrefix: readonly TraceEvent[],
): { ok: boolean; reason?: string } {
  try {
    validatePlan(plan);
    validateTrace(reconstructedPrefix, { allowEmpty: true });
  } catch (error) {
    return { ok: false, reason: (error as Error).message };
  }

  if (reconstructedPrefix.length !== plan.prefixLength) {
    return { ok: false, reason: 'reconstructed prefix length differs from anchored prefix' };
  }
  if (traceDigest(reconstructedPrefix) !== plan.prefixDigest) {
    return { ok: false, reason: 'reconstructed prefix digest differs from anchored prefix' };
  }
  return { ok: true };
}

/**
 * Produce a replay receipt only after an exact prefix check. The regenerated
 * suffix must start strictly after the anchor and cannot reuse immutable ids.
 */
export function finalizeAnchoredReplay(
  plan: AnchoredTraceReplay,
  reconstructedPrefix: readonly TraceEvent[],
  anchor: TraceEvent,
  regeneratedSuffix: readonly TraceEvent[],
): ReplayReceipt {
  const prefix = verifyReplayPrefix(plan, reconstructedPrefix);
  if (!prefix.ok) throw new Error(prefix.reason);
  validatePlan(plan);
  validateEvent(anchor);
  validateTrace(regeneratedSuffix, { allowEmpty: true });

  if (anchor.id !== plan.anchorId || anchor.step !== plan.anchorStep) {
    throw new Error('anchor identity or step differs from replay plan');
  }
  if (sha256(canonicalJson(anchor)) !== plan.anchorDigest) {
    throw new Error('anchor evidence differs from replay plan');
  }

  const immutableIds = new Set(reconstructedPrefix.map((event) => event.id));
  immutableIds.add(anchor.id);
  for (const event of regeneratedSuffix) {
    if (event.step <= anchor.step) {
      throw new Error('regenerated suffix contains an event at or before the anchor step');
    }
    if (immutableIds.has(event.id)) {
      throw new Error(`regenerated suffix reuses immutable event id "${event.id}"`);
    }
  }

  const combined = [...reconstructedPrefix, anchor, ...regeneratedSuffix];
  validateTrace(combined);

  return {
    version: 1,
    anchorId: plan.anchorId,
    prefixDigest: plan.prefixDigest,
    anchorDigest: plan.anchorDigest,
    regeneratedSuffixDigest: traceDigest(regeneratedSuffix),
    combinedTraceDigest: traceDigest(combined),
    regeneratedSteps: regeneratedSuffix.length,
  };
}

function validatePlan(plan: AnchoredTraceReplay): void {
  if (plan.version !== 1) throw new Error('unsupported anchored replay version');
  if (!plan.anchorId) throw new Error('replay plan is missing anchor id');
  if (!Number.isInteger(plan.anchorStep) || plan.anchorStep < 0) {
    throw new Error('replay plan anchor step must be a non-negative integer');
  }
  if (!Number.isInteger(plan.prefixLength) || plan.prefixLength < 0) {
    throw new Error('replay plan prefix length must be a non-negative integer');
  }
  for (const [name, digest] of Object.entries({
    prefixDigest: plan.prefixDigest,
    anchorDigest: plan.anchorDigest,
    originalSuffixDigest: plan.originalSuffixDigest,
    originalTraceDigest: plan.originalTraceDigest,
  })) {
    if (!/^[0-9a-f]{64}$/.test(digest)) throw new Error(`${name} must be a sha256 hex digest`);
  }
}

function validateEvent(event: TraceEvent): void {
  if (!event || typeof event !== 'object') throw new Error('trace event must be an object');
  if (!event.id || typeof event.id !== 'string') throw new Error('trace event id must be a non-empty string');
  if (!Number.isInteger(event.step) || event.step < 0) {
    throw new Error(`trace event "${event.id}" step must be a non-negative integer`);
  }
  if (!event.kind || typeof event.kind !== 'string') {
    throw new Error(`trace event "${event.id}" kind must be a non-empty string`);
  }
  canonicalJson(event);
}

function validateTrace(
  events: readonly TraceEvent[],
  options: { allowEmpty?: boolean } = {},
): void {
  if (!Array.isArray(events)) throw new Error('trace must be an array');
  if (events.length === 0 && !options.allowEmpty) throw new Error('trace must contain at least one event');

  const ids = new Set<string>();
  let previousStep = -1;
  for (const event of events) {
    validateEvent(event);
    if (ids.has(event.id)) throw new Error(`trace contains duplicate event id "${event.id}"`);
    if (event.step <= previousStep) throw new Error('trace steps must be strictly increasing');
    ids.add(event.id);
    previousStep = event.step;
  }
}
