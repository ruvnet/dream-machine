import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import test from 'node:test';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const WORKFLOWS_DIR = join(ROOT, '.github/workflows');

/**
 * Regression guard for the 2026-09-19 review finding on PR #120: GitHub
 * documents a full 40-character commit SHA as the only immutable Action
 * reference — a version tag (`@v7`) or branch can be force-moved by the
 * Action's publisher (or, if the publisher's account is compromised, by an
 * attacker) to point at different code without the workflow file changing
 * at all. This test enforces SHA-pinning only for `.github/workflows/ci.yml`
 * (the file `scripts/ci-audit-policy.test.mjs`'s sibling candidate touched)
 * — extending it to every workflow in the repo is a separate, larger change
 * left for a future night.
 */
const PINNED_ACTION = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+@[0-9a-f]{40}$/;

function usesLines(text) {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => !l.startsWith('#'))
    .map((l) => l.match(/^-?\s*uses:\s*(\S+)/))
    .filter(Boolean)
    .map((m) => m[1]);
}

test('every external Action reference in ci.yml is pinned to a full 40-char commit SHA', () => {
  const text = readFileSync(join(WORKFLOWS_DIR, 'ci.yml'), 'utf8');
  const refs = usesLines(text);
  const unpinned = refs.filter((r) => !PINNED_ACTION.test(r));
  assert.deepEqual(unpinned, [], `ci.yml has unpinned Action reference(s): ${JSON.stringify(unpinned)}`);
});

test('sanity: ci.yml actually declares external Action references for the pinning test to check', () => {
  const text = readFileSync(join(WORKFLOWS_DIR, 'ci.yml'), 'utf8');
  const refs = usesLines(text);
  assert.ok(refs.length >= 9, `expected at least 9 \`uses:\` lines in ci.yml, found ${refs.length}: ${JSON.stringify(refs)}`);
});
