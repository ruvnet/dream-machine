import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { evaluateGuard, inspectPullRequest, protectedPath, validPath } from './automerge-guard.mjs';

const repository = 'ruvnet/dream-machine';
const expected = { repository, number: 75, headSha: 'a'.repeat(40), baseSha: 'b'.repeat(40), baseRef: 'main' };
const pr = {
  number: 75, state: 'open', draft: false, changed_files: 1,
  labels: [{ name: 'automerge-safe' }],
  head: { sha: expected.headSha, repo: { full_name: repository } },
  base: { sha: expected.baseSha, ref: 'main', repo: { full_name: repository } },
};
const file = (filename = 'README.md', extra = {}) => ({ filename, status: 'modified', ...extra });
const input = (extra = {}) => ({
  config: { repo: repository, autoMerge: true }, expected,
  pullRequest: structuredClone(pr), currentPullRequest: structuredClone(pr),
  pages: [[file()]], ...extra,
});

test('eligibility remains a separate human review, never merge permission', () => {
  assert.deepEqual(evaluateGuard(input()), { eligible: true, reason: 'separate-human-review-required' });
});

test('missing, malformed, false and truthy nonboolean configuration all deny', () => {
  for (const config of [undefined, null, {}, { autoMerge: false }, { autoMerge: 'true' }, { autoMerge: 1 }, []]) {
    assert.equal(evaluateGuard(input({ config })).eligible, false);
  }
  assert.equal(evaluateGuard(input({ config: { repo: 'other/repository', autoMerge: true } })).eligible, false);
});

test('current repository config disables eligibility without querying GitHub', () => {
  const config = JSON.parse(readFileSync(new URL('../dream.config.json', import.meta.url), 'utf8'));
  assert.equal(config.autoMerge, false);
  assert.deepEqual(inspectPullRequest({ config, api() { throw new Error('must not query'); } }),
    { eligible: false, reason: 'configuration-disabled' });
});

test('all constitutional paths, manifests, tooling and tests require human review', () => {
  const paths = [
    'docs/contracts/edge-v1/cue-proposal.schema.json', 'docs/adrs/ADR-0103-governed-self-evolution.md',
    'docs/benchmarks/plan.md', 'docs/security/threat.md', 'docs/plans/plan.json',
    'docs/runbooks/mac.md', 'benchmarks/run.rs', 'benchmark/run.ts', 'dream.config.json',
    '.github/workflows/automerge.yml', 'scripts/automerge-guard.mjs', 'SECURITY.md', 'AGENTS.md',
    'packages/new/package.json', 'package-lock.json', 'Cargo.toml', 'nested/Cargo.lock',
    'pnpm-lock.yaml', '.npmrc', '.gitmodules', 'pyproject.toml', 'requirements-dev.txt',
    'packages/compile/src/config.ts', 'packages/witness/src/index.ts', 'packages/ledger/src/index.ts',
    'packages/memory/src/index.ts', 'packages/schedule/src/index.ts', 'src/safety.ts',
    'src/gate.ts', 'src/threshold.ts', 'src/promotion.ts', 'src/evaluator.ts', 'src/scorer.ts',
    'src/consent.ts', 'src/actuator.ts', 'src/capability.ts', 'src/holdout.ts',
    'src/arming.ts', 'src/watchdog.ts', 'src/retention.ts', 'src/auth.ts',
    'src/rollback.ts', 'src/provenance.ts', 'src/deploy.ts', 'vitest.config.ts',
    'tsconfig.json', 'packages/cli/tsconfig.json', 'packages/cli/src/index.test.ts',
    'edge/runtime.rs', 'firmware/main.c',
  ];
  for (const path of paths) {
    assert.equal(protectedPath(path), true, path);
    assert.equal(evaluateGuard(input({ pages: [[file(path)]] })).reason, 'protected-path', path);
  }
});

test('both sides of renames and copies are checked', () => {
  for (const status of ['renamed', 'copied']) {
    assert.equal(evaluateGuard(input({ pages: [[file('README.md', {
      status, previous_filename: 'docs/contracts/policy.json',
    })]] })).reason, 'protected-path');
    assert.equal(evaluateGuard(input({ pages: [[file('docs/contracts/policy.json', {
      status, previous_filename: 'README.md',
    })]] })).reason, 'protected-path');
    assert.equal(evaluateGuard(input({ pages: [[file('README.md', { status })]] })).eligible, false);
  }
});

test('malformed paths cannot evade policy or inject workflow output', () => {
  for (const path of ['', null, '../README.md', '/README.md', 'a//b', 'a/./b', 'a/../b',
    'a\\b', 'README.md\n::warning::injected', 'README.md\u0000', '-README.md', 'sécurité.md', 'a'.repeat(4097)]) {
    assert.equal(validPath(path), false, String(path));
    assert.equal(evaluateGuard(input({ pages: [[file(path)]] })).eligible, false);
  }
});

test('zero, missing, partial, duplicated, excessive and malformed file sets deny', () => {
  for (const pages of [undefined, [], [[]], [[file(), file()]], [null], [[null]],
    [[file('README.md', { status: 'unknown' })]], [[file()], [file('CHANGELOG.md')]]]) {
    assert.equal(evaluateGuard(input({ pages })).eligible, false);
  }
  for (const changed_files of [undefined, 0, -1, 1.5, 3001, '1']) {
    assert.equal(evaluateGuard(input({ pullRequest: { ...pr, changed_files } })).eligible, false);
  }
  assert.equal(evaluateGuard(input({
    pullRequest: { ...pr, changed_files: 2 }, currentPullRequest: { ...pr, changed_files: 2 },
    pages: [[file(), file()]],
  })).reason, 'incomplete-file-list');
});

test('pagination checks the last file beyond the first page', () => {
  const pages = [Array.from({ length: 100 }, (_, i) => file(`notes-${i}.md`)), [file('docs/contracts/last.json')]];
  const value = input({ pages, pullRequest: { ...pr, changed_files: 101 }, currentPullRequest: { ...pr, changed_files: 101 } });
  assert.equal(evaluateGuard(value).reason, 'protected-path');
  value.pages[1] = [file('CHANGELOG.md')];
  assert.equal(evaluateGuard(value).eligible, true);
  value.pages = [pages[0]];
  assert.equal(evaluateGuard(value).reason, 'incomplete-file-list');
});

test('draft, unlabeled, fork, wrong repository, head or base drift deny', () => {
  const changes = [
    { draft: true }, { draft: undefined }, { state: 'closed' }, { number: 76 }, { labels: [] },
    { labels: null }, { head: { ...pr.head, sha: 'c'.repeat(40) } },
    { head: { ...pr.head, repo: { full_name: 'outsider/fork' } } },
    { base: { ...pr.base, sha: 'c'.repeat(40) } }, { base: { ...pr.base, ref: 'other' } },
    { base: { ...pr.base, repo: { full_name: 'other/repository' } } }, { changed_files: 2 },
  ];
  for (const change of changes) {
    assert.equal(evaluateGuard(input({ currentPullRequest: { ...pr, ...change } })).eligible, false);
  }
});

test('API adapter only makes three reads and requests complete pagination', () => {
  const calls = [];
  const result = inspectPullRequest({ config: input().config, event: { pull_request: pr }, repository,
    api(args) {
      calls.push(args);
      return args[0].includes('/files?') ? [[file()]] : structuredClone(pr);
    },
  });
  assert.equal(result.eligible, true);
  assert.deepEqual(calls, [
    ['repos/ruvnet/dream-machine/pulls/75'],
    ['repos/ruvnet/dream-machine/pulls/75/files?per_page=100', '--paginate', '--slurp'],
    ['repos/ruvnet/dream-machine/pulls/75'],
  ]);
});

test('metadata changing during file pagination cannot yield eligibility', () => {
  let reads = 0;
  const result = inspectPullRequest({ config: input().config, event: { pull_request: pr }, repository,
    api(args) {
      reads++;
      if (args[0].includes('/files?')) return [[file()]];
      return reads === 3 ? { ...pr, head: { ...pr.head, sha: 'c'.repeat(40) } } : pr;
    },
  });
  assert.equal(result.eligible, false);
});

test('invalid event metadata denies before constructing an API request', () => {
  for (const event of [{}, { pull_request: { ...pr, number: '75; echo invalid' } },
    { pull_request: { ...pr, changed_files: 3001 } }]) {
    const result = inspectPullRequest({ config: input().config, event, repository,
      api() { throw new Error('must not query'); },
    });
    assert.equal(result.eligible, false);
  }
});

test('workflow retains base-only checkout and no merge or label authority', () => {
  const workflow = readFileSync(new URL('../.github/workflows/automerge.yml', import.meta.url), 'utf8');
  assert.match(workflow, /contents: read/);
  assert.match(workflow, /pull-requests: read/);
  assert.match(workflow, /ref: \$\{\{ github\.event\.pull_request\.base\.sha \}\}/);
  assert.match(workflow, /persist-credentials: false/);
  assert.doesNotMatch(workflow, /:\s*write\b|gh pr (?:merge|edit)|--auto|head\.sha|npm (?:ci|install)/);
});

test('CLI errors fail closed without echoing untrusted data', () => {
  const result = spawnSync(process.execPath, [new URL('./automerge-guard.mjs', import.meta.url).pathname], {
    encoding: 'utf8',
    // This rejection path needs no credentials, proxy hooks or inherited Node
    // preload flags. Isolate stderr from host bootstrap warnings as well.
    env: { GITHUB_EVENT_NAME: 'push', GITHUB_OUTPUT: '' },
  });
  assert.equal(result.status, 1);
  assert.deepEqual(JSON.parse(result.stdout), { eligible: false, reason: 'missing-or-invalid-input' });
  assert.equal(result.stderr, '');
});
