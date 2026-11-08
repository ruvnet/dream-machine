/** Opt-in observer for Ruflo's async ModelRouter. Never installs a runtime hook. */
import { createHash } from 'node:crypto';
import { performance } from 'node:perf_hooks';

const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const actions = new Set(['recommend_weak', 'recommend_strong', 'abstain']);

const validVector = value => Array.isArray(value) && value.length > 0 && value.length <= 1024 &&
  value.every(x => typeof x === 'number' && Number.isFinite(x) && Math.abs(x) <= 1e12);
function modelIdentity(value) {
  if (!value || Object.keys(value).sort().join(',') !== 'artifactDigest,layer,model,position,revision' ||
      typeof value.model !== 'string' || !value.model.length || value.model.length > 200 ||
      !/^[a-f0-9]{40}$/.test(value.revision) || !/^[a-f0-9]{64}$/.test(value.artifactDigest) ||
      !Number.isInteger(value.layer) || value.layer < 0 || value.position !== 'last_prompt_token') {
    throw new TypeError('invalid model identity');
  }
  return [value.model, value.revision, value.artifactDigest, value.layer, value.position];
}

/** O(d) scoring of an independently fitted Python bank; no fitting or authority. */
export function createLeashProbe(bank, calibration) {
  const { weight, bias, identity } = structuredClone(bank);
  const threshold = calibration?.threshold;
  const expected = modelIdentity(identity);
  if (!validVector(weight) || !Number.isFinite(bias) || !Number.isFinite(threshold)) {
    throw new TypeError('invalid fitted probe');
  }
  const probe = context => {
    if (!validVector(context?.activation) || context.activation.length !== weight.length ||
        modelIdentity(context.identity).some((x, i) => x !== expected[i])) {
      throw new TypeError('activation identity changed; recalibrate');
    }
    const score = weight.reduce((sum, x, i) => sum + x * context.activation[i], bias);
    if (!Number.isFinite(score)) throw new TypeError('non-finite score');
    return { action: score > threshold ? 'recommend_strong' : 'recommend_weak', score, authorized: false };
  };
  // JS-native fingerprint; not presented as Python's differently encoded digest.
  Object.defineProperty(probe, 'fingerprint', { value: hash({ weight, bias, identity, threshold }) });
  return probe;
}

export function createRufloShadow(router, { probe, timeoutMs = 25, maxReceipts = 256 } = {}) {
  if (typeof router?.route !== 'function' || typeof probe !== 'function' ||
      !Number.isFinite(timeoutMs) || timeoutMs <= 0 || timeoutMs > 150 ||
      !Number.isInteger(maxReceipts) || maxReceipts < 1 || maxReceipts > 4096) {
    throw new TypeError('invalid shadow configuration');
  }
  const receipts = [];
  let pending = false;
  return {
    get receipts() { return structuredClone(receipts); },
    // Shadow metadata is separate from the exact upstream arguments.
    async routeWithShadow(metadata, ...args) {
      const started = performance.now();
      const original = await router.route(...args);
      const routed = performance.now();
      const receipt = { schema: 1, mode: 'shadow', authorized: false, suggestedRoute: null,
        originalRouteMs: routed - started, status: 'invalid_input' };
      if (typeof probe.fingerprint === 'string' && /^[a-f0-9]{64}$/.test(probe.fingerprint)) {
        receipt.probeFingerprint = probe.fingerprint;
      }
      try {
        if (typeof args[0] !== 'string' || args[0].length > 1_000_000 ||
            !['haiku', 'sonnet', 'opus'].includes(original?.model) ||
            !metadata || typeof metadata.permitted !== 'boolean' || typeof metadata.drift !== 'boolean' ||
            typeof metadata.taskId !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(metadata.taskId)) {
          throw new TypeError('invalid metadata');
        }
        Object.assign(receipt, { taskHash: hash(args[0]), taskIdHash: hash(metadata.taskId),
          originalModel: original.model });
        if (!metadata.permitted || metadata.drift) {
          receipt.status = 'abstain'; receipt.suggestedRoute = 'abstain';
        } else if (pending) {
          receipt.status = 'busy_abstain';
        } else {
          if (!validVector(metadata.activation)) {
            throw new TypeError('invalid activation');
          }
          // No raw prompt, original result, reasoning, permissions, or mutable
          // metadata reference enters the observer. Probe must validate identity.
          const context = structuredClone({ activation: metadata.activation, identity: metadata.identity });
          receipt.inputHash = hash(context);
          pending = true;
          const controller = new AbortController();
          let timer;
          const work = Promise.resolve().then(() => probe(context, { signal: controller.signal }))
            .then(value => ({ kind: 'result', value }), () => ({ kind: 'probe_error' }))
            .finally(() => { pending = false; });
          try {
            const outcome = await Promise.race([work, new Promise(resolve => {
              timer = setTimeout(() => resolve({ kind: 'timeout_advisory' }), timeoutMs);
            })]);
            receipt.status = outcome.kind;
            if (outcome.kind === 'result') {
              if (outcome.value?.authorized !== false || !actions.has(outcome.value?.action)) {
                receipt.status = 'probe_error';
              } else {
                receipt.status = 'ok'; receipt.suggestedRoute = outcome.value.action;
              }
            }
          } finally {
            clearTimeout(timer); controller.abort();
          }
        }
      } catch {
        // Never expose exception prose, prompt text or observer output.
        receipt.suggestedRoute = null;
      } finally {
        receipt.shadowMs = performance.now() - routed;
        receipts.push(receipt);
        if (receipts.length > maxReceipts) receipts.shift();
      }
      return original;
    },
  };
}
