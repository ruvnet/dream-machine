import { execFileSync } from 'node:child_process';
import { appendFileSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const MAX_FILES = 3000; // GitHub's pull request files endpoint maximum.
const SHA = /^[a-f0-9]{40}$/;
const REPOSITORY = /^[A-Za-z0-9_-][A-Za-z0-9_.-]*\/[A-Za-z0-9_-][A-Za-z0-9_.-]*$/;
const STATUSES = new Set(['added', 'removed', 'modified', 'renamed', 'copied', 'changed', 'unchanged']);
const blocked = (reason) => ({ eligible: false, reason });

// Be conservative: constitution-bearing docs, tooling, contracts and sensitive
// packages are human-only even if a future base config enables eligibility.
const PROTECTED = [
  /^(?:\.github|scripts|docs|benchmarks?|tests?|fixtures|schemas?|contracts?|firmware|hardware|edge|security|safety|policy|policies|config)(?:\/|$)/i,
  /^packages\/(?:compile|ledger|witness|memory|schedule)(?:\/|$)/i,
  /(?:^|\/)(?:AGENTS\.md|SECURITY\.md|CODEOWNERS|dream\.config\.json)$/i,
  /(?:^|\/)(?:package(?:-lock)?\.json|npm-shrinkwrap\.json|(?:yarn|bun)\.lockb?|pnpm-lock\.yaml|Cargo\.(?:toml|lock)|go\.(?:mod|sum)|pyproject\.toml|uv\.lock|requirements[^/]*\.txt|\.npmrc|\.yarnrc[^/]*|\.gitmodules)$/i,
  /(?:^|\/)[^/]*(?:safety|gate|threshold|promotion|scorer|benchmark|evaluator|consent|actuator|watchdog|arming|retention|encrypt|signing|capability|policy|rollback|witness|provenance|release|deploy|auth|holdout)[^/]*(?:\/|$)/i,
  /(?:^|\/)[^/]*(?:\.config\.|\.test\.|\.spec\.)/i,
  /(?:^|\/)tsconfig[^/]*$/i,
];

export function validPath(path) {
  return typeof path === 'string' && path.length > 0 && path.length <= 4096 &&
    /^[\x20-\x7e]+$/.test(path) && !path.includes('\\') &&
    !path.startsWith('-') && path.split('/').every((part) => part && part !== '.' && part !== '..');
}

export function protectedPath(path) {
  return !validPath(path) || PROTECTED.some((pattern) => pattern.test(path));
}

function validSnapshot(pr, expected) {
  return expected && REPOSITORY.test(expected.repository ?? '') &&
    Number.isSafeInteger(expected.number) && expected.number > 0 &&
    SHA.test(expected.headSha ?? '') && SHA.test(expected.baseSha ?? '') &&
    typeof expected.baseRef === 'string' && expected.baseRef.length > 0 &&
    pr?.number === expected.number && pr?.state === 'open' && pr?.draft === false &&
    pr?.head?.sha === expected.headSha && pr?.base?.sha === expected.baseSha &&
    pr?.base?.ref === expected.baseRef &&
    pr?.base?.repo?.full_name === expected.repository &&
    pr?.head?.repo?.full_name === expected.repository &&
    Array.isArray(pr.labels) && pr.labels.some((label) => label?.name === 'automerge-safe') &&
    Number.isSafeInteger(pr.changed_files) && pr.changed_files > 0 && pr.changed_files <= MAX_FILES;
}

export function evaluateGuard({ config, pullRequest, expected, pages, currentPullRequest }) {
  if (!config || config.autoMerge !== true) return blocked('configuration-disabled');
  if (config.repo !== expected?.repository) return blocked('configuration-repository-mismatch');
  if (!validSnapshot(pullRequest, expected) || !validSnapshot(currentPullRequest, expected) ||
      currentPullRequest.changed_files !== pullRequest.changed_files) {
    return blocked('invalid-or-stale-pull-request');
  }
  if (!Array.isArray(pages) || !pages.length || pages.length > MAX_FILES / 100 ||
      pages.some((page, index) => !Array.isArray(page) || page.length === 0 || page.length > 100 ||
        (index < pages.length - 1 && page.length !== 100))) {
    return blocked('incomplete-file-list');
  }
  const files = pages.flat();
  if (files.length !== pullRequest.changed_files ||
      new Set(files.map((file) => file?.filename)).size !== files.length) {
    return blocked('incomplete-file-list');
  }
  for (const file of files) {
    if (!file || !STATUSES.has(file.status) || !validPath(file.filename) ||
        (['renamed', 'copied'].includes(file.status) && !validPath(file.previous_filename)) ||
        (file.previous_filename !== undefined && !validPath(file.previous_filename))) {
      return blocked('invalid-file-metadata');
    }
    if (protectedPath(file.filename) ||
        (file.previous_filename !== undefined && protectedPath(file.previous_filename))) {
      return blocked('protected-path');
    }
  }
  // Eligibility is information, not permission. This module cannot merge,
  // enable auto-merge, assign labels, or promote an artifact.
  return { eligible: true, reason: 'separate-human-review-required' };
}

export function inspectPullRequest({ config, event, repository, api }) {
  if (!config || config.autoMerge !== true) return blocked('configuration-disabled');
  const expected = {
    repository,
    number: event?.pull_request?.number,
    headSha: event?.pull_request?.head?.sha,
    baseSha: event?.pull_request?.base?.sha,
    baseRef: event?.pull_request?.base?.ref,
  };
  if (!validSnapshot(event?.pull_request, expected)) return blocked('invalid-or-stale-pull-request');
  const endpoint = `repos/${repository}/pulls/${expected.number}`;
  const pullRequest = api([endpoint]);
  if (!validSnapshot(pullRequest, expected)) return blocked('invalid-or-stale-pull-request');
  const pages = api([`${endpoint}/files?per_page=100`, '--paginate', '--slurp']);
  const currentPullRequest = api([endpoint]);
  return evaluateGuard({ config, expected, pullRequest, pages, currentPullRequest });
}

function main() {
  let result = blocked('missing-or-invalid-input');
  try {
    if (process.env.GITHUB_EVENT_NAME !== 'pull_request_target') throw new Error('Unexpected event');
    result = inspectPullRequest({
      config: JSON.parse(readFileSync('dream.config.json', 'utf8')),
      event: JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8')),
      repository: process.env.GITHUB_REPOSITORY,
      api: (args) => JSON.parse(execFileSync('gh', ['api', ...args], {
        encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, timeout: 60_000,
        stdio: ['ignore', 'pipe', 'pipe'],
      })),
    });
  } catch {
    // Do not log API response bodies or PR-controlled strings (workflow-command
    // injection). Failure never emits an eligible result.
    process.exitCode = 1;
  }
  console.log(JSON.stringify(result));
  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(process.env.GITHUB_OUTPUT, `eligible=${result.eligible}\nreason=${result.reason}\n`);
  }
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) main();
