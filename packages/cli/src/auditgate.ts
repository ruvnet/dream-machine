/**
 * Dependency-security gate — classify `npm audit --json` output before CI
 * trusts it.
 *
 * Closes the gap in issue #43: `npm ci` can report critical/high findings
 * while CI stays green, because nothing parses the audit output. Reproduced
 * 2026-08-28 (security-adversarial night, SCAN=supply-chain): a fresh
 * `npm ci` on this repo's own lockfile surfaces 8 findings (2 critical, 1
 * high, 3 moderate, 2 low), all inside the vitest/vite/esbuild/eslint dev
 * toolchain — `npm audit --omit=dev --json` independently confirms 0 of
 * them are reachable from the published/production dependency graph
 * (`metadata.dependencies.prod: 13`, `vulnerabilities: {}`).
 *
 * This module does not re-derive production reachability itself — npm's own
 * `--omit=dev` dependency-graph walk is the authoritative source (re-
 * implementing that graph walk here would risk exactly the false-negative
 * class of bug PR #19's critic caught in a hand-rolled classifier). It only
 * gates deterministically on the counts npm already computed, against the
 * report the caller chooses to run it on.
 */

export interface NpmAuditMetadata {
  vulnerabilities?: {
    info?: number;
    low?: number;
    moderate?: number;
    high?: number;
    critical?: number;
    total?: number;
  };
  dependencies?: {
    prod?: number;
    dev?: number;
    optional?: number;
    peer?: number;
    peerOptional?: number;
    total?: number;
  };
}

export interface NpmAuditReport {
  auditReportVersion?: number;
  metadata?: NpmAuditMetadata;
}

export type AuditGateVerdict = 'clear' | 'blocked' | 'malformed';

export interface AuditGateResult {
  verdict: AuditGateVerdict;
  high: number;
  critical: number;
  low: number;
  moderate: number;
  reason: string;
}

/**
 * Classify an already-parsed `npm audit --json` report. Pure — no I/O, no
 * process exit. Callers decide the report's scope (e.g. `--omit=dev`) by
 * choosing which audit invocation produced it; this function only reads
 * `metadata.vulnerabilities` counts and never blocks on `low`/`moderate`,
 * matching issue #43's proposal: fail on reachable high/critical, report
 * (never fail) on everything below that.
 */
export function classifyAuditGate(report: unknown): AuditGateResult {
  const metadata = (report as NpmAuditReport | null | undefined)?.metadata;
  const counts = metadata?.vulnerabilities;
  if (
    !counts ||
    typeof counts.high !== 'number' ||
    typeof counts.critical !== 'number' ||
    typeof counts.low !== 'number' ||
    typeof counts.moderate !== 'number'
  ) {
    return {
      verdict: 'malformed',
      high: 0,
      critical: 0,
      low: 0,
      moderate: 0,
      reason:
        'report has no metadata.vulnerabilities counts (info/low/moderate/high/critical) — ' +
        'not a recognized `npm audit --json` (auditReportVersion 2) shape; refusing to silently pass',
    };
  }
  const { high, critical, low, moderate } = counts;
  if (high > 0 || critical > 0) {
    return {
      verdict: 'blocked',
      high,
      critical,
      low,
      moderate,
      reason: `${critical} critical + ${high} high finding(s) in this audit scope`,
    };
  }
  return {
    verdict: 'clear',
    high,
    critical,
    low,
    moderate,
    reason:
      low + moderate > 0
        ? `0 high/critical; ${moderate} moderate + ${low} low reported but not gated (classify separately before trusting them)`
        : '0 findings at any severity',
  };
}
