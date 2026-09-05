/** Prototype URI identity parsing only. A match does not authorize a read. */
export type DreamResourceName =
  | 'device_status' | 'consent_current' | 'apple_watch_sync_status'
  | 'experiment_protocol' | 'active_policy' | 'candidate_receipt'
  | 'cue_receipt' | 'evidence' | 'latest_benchmarks' | 'schema';

export interface ParsedDreamResourceUri {
  readonly name: DreamResourceName;
  readonly canonicalUri: string;
  readonly params: Readonly<Record<string, string>>;
}

export class ResourceUriError extends Error {
  constructor() { super('Invalid or unsupported Dream Machine resource URI'); this.name = 'ResourceUriError'; }
}

const PREFIX = 'ruv://dream-machine/v1/';
const SCHEMAS = new Set(['observation', 'cue-proposal', 'safety-decision', 'evolution-candidate']);
const ROUTES: readonly (readonly [DreamResourceName, string])[] = [
  ['device_status', 'devices/{deviceId}/status'],
  ['consent_current', 'subjects/self/consent/current'],
  ['apple_watch_sync_status', 'subjects/self/apple-watch/sync-status'],
  ['experiment_protocol', 'experiments/{experimentId}/protocol'],
  ['active_policy', 'policies/active'],
  ['candidate_receipt', 'candidates/{candidateId}/receipt'],
  ['cue_receipt', 'cues/{ticketId}/receipt'],
  ['evidence', 'evidence/{digest}'],
  ['latest_benchmarks', 'benchmarks/latest'],
  ['schema', 'schemas/{name}/{version}'],
];

function validParam(name: string, value: string): boolean {
  switch (name) {
    case 'deviceId': case 'experimentId': case 'candidateId': case 'ticketId':
      return value.length === 32 && /^(?!0{32}$)[a-f0-9]{32}$/.test(value);
    case 'digest': return value.length === 64 && /^[a-f0-9]{64}$/.test(value);
    // Existing schema file names plus an explicit prototype version token.
    case 'name': return SCHEMAS.has(value);
    case 'version': return value === 'v1';
    default: return false;
  }
}

/**
 * Accepts only a canonical ASCII subset, without URL normalization or decoding.
 * Night/window placeholders remain unsupported until their grammar is frozen.
 * Percent aliases are rejected, including otherwise harmless encoded literals.
 */
export function parseDreamResourceUri(uri: string): ParsedDreamResourceUri {
  if (typeof uri !== 'string' || uri.length > 512 || !uri.startsWith(PREFIX)) throw new ResourceUriError();
  const path = uri.slice(PREFIX.length);
  if (!path || /[^a-z0-9/-]/.test(path)) throw new ResourceUriError();
  const segments = path.split('/');
  if (segments.some(segment => segment.length === 0)) throw new ResourceUriError();
  for (const [name, route] of ROUTES) {
    const template = route.split('/');
    if (template.length !== segments.length) continue;
    const params: Record<string, string> = Object.create(null);
    let matches = true;
    for (let i = 0; i < template.length; i++) {
      const element = template[i];
      if (element.startsWith('{')) {
        const parameter = element.slice(1, -1);
        if (!validParam(parameter, segments[i])) { matches = false; break; }
        params[parameter] = segments[i];
      } else if (element !== segments[i]) { matches = false; break; }
    }
    if (matches) return Object.freeze({ name, canonicalUri: uri, params: Object.freeze(params) });
  }
  throw new ResourceUriError();
}
