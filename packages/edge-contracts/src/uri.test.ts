import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { parseDreamResourceUri, ResourceUriError } from './uri.js';

const prefix = 'ruv://dream-machine/v1/';
const id = '1'.repeat(32);
const digest = 'a'.repeat(64);
const supported = [
  ['device_status', `devices/${id}/status`],
  ['consent_current', 'subjects/self/consent/current'],
  ['apple_watch_sync_status', 'subjects/self/apple-watch/sync-status'],
  ['experiment_protocol', `experiments/${id}/protocol`],
  ['active_policy', 'policies/active'],
  ['candidate_receipt', `candidates/${id}/receipt`],
  ['cue_receipt', `cues/${id}/receipt`],
  ['evidence', `evidence/${digest}`],
  ['latest_benchmarks', 'benchmarks/latest'],
  ['schema', 'schemas/observation/v1'],
] as const;

describe('canonical prototype resource URI subset', () => {
  it.each(supported)('recognizes %s with no authority implied', (name, path) => {
    const parsed = parseDreamResourceUri(prefix + path);
    expect(parsed.name).toBe(name);
    expect(parsed.canonicalUri).toBe(prefix + path);
    expect(Object.isFrozen(parsed)).toBe(true);
    expect(Object.isFrozen(parsed.params)).toBe(true);
    expect(parsed).not.toHaveProperty('authorized');
    expect(parsed).not.toHaveProperty('privacyClass');
  });

  it('exposes only existing registry templates and exact variable bindings', () => {
    const registry = JSON.parse(readFileSync(new URL('../../../docs/contracts/edge-v1/mcp-registry.json', import.meta.url), 'utf8'));
    for (const [name, path] of supported) {
      const parsed = parseDreamResourceUri(prefix + path);
      const resource = registry.resources.find((row: { name: string }) => row.name === name);
      let expanded = resource.uriTemplate as string;
      for (const [key, value] of Object.entries(parsed.params)) expanded = expanded.replace(`{${key}}`, value);
      expect(expanded).toBe(prefix + path);
    }
    expect(parseDreamResourceUri(prefix + `devices/${id}/status`).params).toEqual({ deviceId: id });
  });

  it.each(['observation', 'cue-proposal', 'safety-decision', 'evolution-candidate'])('admits existing schema %s under explicit prototype v1', name => {
    expect(parseDreamResourceUri(`${prefix}schemas/${name}/v1`).params).toEqual({ name, version: 'v1' });
  });

  it.each([
    'https://dream-machine/v1/policies/active', 'RUV://dream-machine/v1/policies/active', 'ruv://Dream-Machine/v1/policies/active',
    'ruv://evil@dream-machine/v1/policies/active', 'ruv://dream-machine:80/v1/policies/active', 'ruv://dream-machine.evil/v1/policies/active',
    'ruv://dream-machine/v2/policies/active', 'ruv://dream-machine/v1/policies/active#fragment', 'ruv://dream-machine/v1/policies/active?scope=all',
    prefix + 'policies/active/', prefix + 'policies//active', prefix + 'policies/../policies/active', prefix + 'policies/./active',
    prefix + 'policies/%61ctive', prefix + 'policies/%2e%2e/active', prefix + 'policies/%252e%252e/active',
    prefix + 'policies/%2Factive', prefix + 'policies/%5cactive', prefix + 'policies/%C0%AFactive', prefix + 'policies/%00active',
    prefix + 'policies/%', prefix + 'policies/active\n', prefix + 'policies/active\u0000', prefix + 'policies/active\\',
    prefix + 'policies/аctive', prefix + 'policies/active/more', prefix + 'policies',
    prefix + `devices/${'0'.repeat(32)}/status`, prefix + `devices/${'A'.repeat(32)}/status`, prefix + `devices/${'1'.repeat(31)}/status`,
    prefix + `evidence/${'a'.repeat(63)}`, prefix + 'schemas/unknown/v1', prefix + 'schemas/observation/1', prefix + 'schemas/observation/v2',
    prefix + 'subjects/self/nights/2026-09-05/summary', prefix + `subjects/self/nights/${id}/signals/${id}`,
    prefix + 'subjects/self/nights/2026-09-05/apple-watch/summary', prefix + 'subjects/self/nights/2026-09-05/apple-watch/quality',
    prefix + 'a'.repeat(513),
  ])('rejects invalid, aliased, or unresolved URI %s', uri => {
    expect(() => parseDreamResourceUri(uri)).toThrow(ResourceUriError);
  });

  it('rejects nonstring input without leaking values in errors', () => {
    expect(() => parseDreamResourceUri(null as unknown as string)).toThrow(ResourceUriError);
    expect(() => parseDreamResourceUri(prefix + 'sensitive')).toThrow('Invalid or unsupported Dream Machine resource URI');
  });
});
