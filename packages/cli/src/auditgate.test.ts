import { describe, it, expect } from 'vitest';
import { classifyAuditGate } from './auditgate.js';

// Captured live 2026-08-28 (security-adversarial night) from this repo's real
// lockfile: `npm audit --omit=dev --json`. Zero vulnerabilities — every
// finding in the full (dev-inclusive) report lives in the vitest/vite/esbuild
// dev toolchain, none in the 13 production dependencies.
const REAL_PROD_REPORT_2026_08_28 = {
  auditReportVersion: 2,
  vulnerabilities: {},
  metadata: {
    vulnerabilities: { info: 0, low: 0, moderate: 0, high: 0, critical: 0, total: 0 },
    dependencies: { prod: 13, dev: 269, optional: 51, peer: 0, peerOptional: 0, total: 281 },
  },
};

// Captured live 2026-08-28, dev-inclusive: `npm audit --json` (no --omit).
// This is the report the gate must NOT be pointed at for CI enforcement —
// included here only to prove the gate still classifies it correctly (as
// blocked), so a caller who points it at the wrong scope fails loud, not
// silent.
const REAL_FULL_REPORT_2026_08_28 = {
  auditReportVersion: 2,
  metadata: {
    vulnerabilities: { info: 0, low: 2, moderate: 3, high: 1, critical: 2, total: 8 },
    dependencies: { prod: 13, dev: 269, optional: 51, peer: 0, peerOptional: 0, total: 281 },
  },
};

describe('classifyAuditGate', () => {
  it('clears the real 2026-08-28 production-scoped report (0 findings)', () => {
    const r = classifyAuditGate(REAL_PROD_REPORT_2026_08_28);
    expect(r.verdict).toBe('clear');
    expect(r.high).toBe(0);
    expect(r.critical).toBe(0);
  });

  it('blocks the real 2026-08-28 dev-inclusive report (2 critical, 1 high)', () => {
    const r = classifyAuditGate(REAL_FULL_REPORT_2026_08_28);
    expect(r.verdict).toBe('blocked');
    expect(r.critical).toBe(2);
    expect(r.high).toBe(1);
    expect(r.reason).toContain('2 critical');
    expect(r.reason).toContain('1 high');
  });

  it('clears a report with only low/moderate findings, and says so without blocking', () => {
    const r = classifyAuditGate({
      metadata: { vulnerabilities: { info: 0, low: 3, moderate: 2, high: 0, critical: 0, total: 5 } },
    });
    expect(r.verdict).toBe('clear');
    expect(r.reason).toContain('not gated');
  });

  it('blocks on a single critical with everything else at 0', () => {
    const r = classifyAuditGate({
      metadata: { vulnerabilities: { info: 0, low: 0, moderate: 0, high: 0, critical: 1, total: 1 } },
    });
    expect(r.verdict).toBe('blocked');
    expect(r.critical).toBe(1);
  });

  it('blocks on a single high with everything else at 0', () => {
    const r = classifyAuditGate({
      metadata: { vulnerabilities: { info: 0, low: 0, moderate: 0, high: 1, critical: 0, total: 1 } },
    });
    expect(r.verdict).toBe('blocked');
    expect(r.high).toBe(1);
  });

  it('treats a totally empty object as malformed, not clear', () => {
    const r = classifyAuditGate({});
    expect(r.verdict).toBe('malformed');
  });

  it('treats null/undefined as malformed', () => {
    expect(classifyAuditGate(null).verdict).toBe('malformed');
    expect(classifyAuditGate(undefined).verdict).toBe('malformed');
  });

  it('treats a non-audit JSON shape (e.g. an npm error payload) as malformed, never clear', () => {
    const r = classifyAuditGate({ error: { code: 'E404', summary: 'not found' } });
    expect(r.verdict).toBe('malformed');
  });

  it('treats partially-missing counts (e.g. npm audit v1 legacy shape) as malformed', () => {
    const r = classifyAuditGate({ metadata: { vulnerabilities: { high: 0 } } });
    expect(r.verdict).toBe('malformed');
  });
});
