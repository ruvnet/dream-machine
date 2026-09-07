# Security Policy

## Reporting a vulnerability

Please report security issues privately via GitHub Security Advisories
(**Security → Report a vulnerability**) on this repository, or email
ruv@ruv.net. Do not open a public issue for a suspected vulnerability.

We aim to acknowledge within 72 hours.

## Threat model & design guarantees

The Dream Machine runs an autonomous nightly loop against a repository. Its
safety rests on a small set of invariants, enforced in code and CI:

- **Evaluation is not promotion.** The nightly session never merges and never
  self-promotes candidate state. It only opens *draft* PRs.
- **Human merge authority.** The legacy `automerge.yml` workflow is now a
  read-only policy guard. It cannot merge, enable deferred auto-merge, assign
  labels, or promote artifacts. `autoMerge: false` in the base revision's
  `dream.config.json` disables eligibility. Missing or malformed configuration
  also denies eligibility. Setting the flag to `true` would only permit an
  eligibility assessment, never a merge. Human review and GitHub's configured
  branch protections remain separate requirements.
- **Constitutional path protection.** The guard evaluates the complete,
  paginated file list and both names of renames or copies. It denies protected
  documentation (including ADRs, contracts, benchmarks, research plans and
  threat models), policy tooling, manifests, lockfiles, configuration, tests,
  provenance packages and named safety/authority boundaries. Missing files,
  duplicates, more than 3,000 files, malformed metadata, forks, drafts, missing
  labels and changes to the observed head or base revision deny eligibility.
  This conservative path classifier is not a semantic safety proof; an eligible
  result still requires human review of the exact diff.
- **Least-privilege CI.** Each workflow declares the minimum `permissions:`
  it needs; `contents: read` is the default.
- **Optional dependencies are optional.** The ruvector/RVF wasm backends are
  peer-optional; a missing module is a graceful no-op (verified by the
  `no-optional-deps` CI job).
- **Witnessed provenance.** Every nightly report is bound to its commit by a
  reproducible double-sha256 witness that any third party can re-derive.

## Supply chain

- npm publishes use OIDC provenance (`--provenance`).
- Dependabot watches npm and GitHub Actions.
- CodeQL (`security-extended`) runs on every push, PR, and weekly.

## Merge policy deployment and verification

`pull_request_target` executes only the trusted base revision, never PR code.
The guard installs no dependencies, retains no checkout credentials and uses
only `contents: read` and `pull-requests: read`. API results are data; file names
are not interpolated into shell commands or workflow output.

This change takes effect only after a human merges it into the base branch.
While it is a draft PR, the previous base workflow is still authoritative.
Maintainers must separately inspect and cancel any previously enabled pending
auto-merges, then verify branch protection requires the intended tests and
human approvals. This read-only workflow cannot revoke existing merge requests
or enforce repository administrator settings.

Run `node --test scripts/automerge-guard.test.mjs` to reproduce the policy
regressions. Tests use synthetic GitHub responses, including a protected file
on page two and stale PR metadata. They do not exercise a live merge or prove
that remote branch protections are configured. A blocked eligibility result
is informational and does not prevent a separately authorized human merge.
