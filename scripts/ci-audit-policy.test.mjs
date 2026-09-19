import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import test from 'node:test';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const WORKFLOWS_DIR = join(ROOT, '.github/workflows');

/**
 * Regression guard for the 2026-09-18 finding: an independent branch
 * (commit d16a776, merged 0d24709 on 2026-09-05) reintroduced a bare
 * `npm audit --audit-level=high` CI step ("dependency-audit" job in
 * ci.yml) that re-gated CI on dev-toolchain-only findings — the exact
 * regression issue #43 / PR #46 fixed on 2026-08-28 by adding the
 * `dependency-security` job (production-scoped via `--omit=dev` and the
 * `audit-gate` CLI). The two branches evolved the same concern in
 * parallel and a merge kept both; it went unnoticed because the
 * dev-toolchain dependency graph happened to be clean when the merge
 * landed, so neither job's behavior visibly diverged in CI logs.
 *
 * This test does not re-implement a YAML parser — it reads each
 * workflow file's `run:` lines as text and flags any `npm audit`
 * invocation that sets a gating `--audit-level=` threshold without
 * either scoping to `--omit=dev` (production-only, this repo's actual
 * policy) or explicitly opting out of gating (`|| true`, report-only).
 *
 * Regression guard, round 2 (2026-09-19 review): a shell line
 * continuation (`npm audit \` on one line, `--audit-level=high` on the
 * next) split the offending flags across lines and evaded the original
 * line-by-line scan — a synthetic adversarial workflow using that form
 * passed all three tests below pre-fix. `collapseContinuations` joins a
 * trailing backslash-newline (and its leading indentation) into the
 * preceding line before any scan runs, so a multiline shell command is
 * classified exactly like its single-line equivalent.
 */
function collapseContinuations(text) {
  return text.replace(/\\[ \t]*\r?\n[ \t]*/g, ' ');
}

function workflowFiles() {
  return readdirSync(WORKFLOWS_DIR)
    .filter((f) => f.endsWith('.yml') || f.endsWith('.yaml'))
    .map((f) => join(WORKFLOWS_DIR, f));
}

function auditInvocations(text) {
  return collapseContinuations(text)
    .split(/\r?\n/)
    .filter((line) => !line.trim().startsWith('#'))
    .filter((line) => /npm audit\b/.test(line));
}

test('no CI workflow gates on an un-scoped, un-guarded `npm audit --audit-level`', () => {
  const offenders = [];
  for (const file of workflowFiles()) {
    const text = readFileSync(file, 'utf8');
    for (const line of auditInvocations(text)) {
      const gatesOnSeverity = /--audit-level=/.test(line);
      const scopedToProd = /--omit[= ]dev/.test(line);
      const reportOnly = /\|\|\s*true\s*$/.test(line.trim());
      if (gatesOnSeverity && !scopedToProd && !reportOnly) {
        offenders.push(`${file}: ${line.trim()}`);
      }
    }
  }
  assert.deepEqual(offenders, []);
});

test('production-scoped audit output is always classified through `audit-gate`, never a bare exit code', () => {
  for (const file of workflowFiles()) {
    const text = readFileSync(file, 'utf8');
    for (const line of auditInvocations(text)) {
      if (/--omit[= ]dev/.test(line) && !/\|\|\s*true\s*$/.test(line.trim())) {
        assert.ok(
          text.includes('audit-gate'),
          `${file} scopes an audit to --omit=dev but the workflow never runs \`audit-gate\` on it: ${line.trim()}`,
        );
      }
    }
  }
});

test('a shell line-continuation cannot split `npm audit` from a gating `--audit-level` past the scanner', () => {
  // The adversarial form a real reviewer found bypassing the round-1 scanner:
  // the flags are on the physical line after `npm audit \`, so a per-line
  // regex never sees them on the same line as the command.
  const adversarial = [
    'jobs:',
    '  x:',
    '    steps:',
    '      - run: |',
    '          npm audit \\',
    '            --audit-level=high',
  ].join('\n');
  const lines = auditInvocations(adversarial);
  assert.equal(lines.length, 1, `expected the continuation to collapse into one invocation, got: ${JSON.stringify(lines)}`);
  assert.ok(/--audit-level=/.test(lines[0]), 'collapsed line must carry the gating flag');
  assert.ok(!/--omit[= ]dev/.test(lines[0]) && !/\|\|\s*true\s*$/.test(lines[0].trim()), 'fixture must be a genuine offender (unscoped, non-report-only)');
});

test('sanity: this test actually finds the two known npm audit invocations in ci.yml', () => {
  const text = readFileSync(join(WORKFLOWS_DIR, 'ci.yml'), 'utf8');
  const lines = auditInvocations(text);
  assert.equal(lines.length, 2, `expected exactly 2 npm audit invocations in ci.yml, found ${lines.length}: ${JSON.stringify(lines)}`);
  assert.ok(lines.some((l) => l.includes('|| true') && !l.includes('--omit')));
  assert.ok(lines.some((l) => l.includes('--omit=dev')));
});
