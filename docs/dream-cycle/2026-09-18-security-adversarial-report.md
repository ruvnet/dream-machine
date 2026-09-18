# Security-Adversarial SOTA Report — 2026-09-18

## TL;DR

A CI governance gate that was deliberately fixed on 2026-08-28 (issue #43 /
PR #46) was silently reintroduced by an unrelated feature branch six days
later and has sat on `main` unnoticed since 2026-09-05, because the audit
data it would misfire on happens to be clean right now. `.github/workflows/ci.yml`
carried **two** `npm audit`-gating jobs: `dependency-security` (correct —
gates only on production-reachable high/critical via `--omit=dev` +
`dream-machine audit-gate`) and a duplicate `dependency-audit` (bare
`npm audit --audit-level=high`, no `--omit=dev`, would fail CI on a
dev-toolchain-only advisory — the exact false-positive class #46 removed).
Removed the duplicate job; added a generalizing governance regression test
(`scripts/ci-audit-policy.test.mjs`) that scans every workflow file for the
bug class, verified with a negative control against the pre-fix file.

## What's new (this surface, 2026)

- Grade A (first-hand, this repo's own git history): merge commits that
  independently re-add previously-fixed governance/CI logic are a
  recurring failure class here — PR #96 ("repair union-merge damage across
  ledger, cli, compile and witness") already fixed this pattern in four
  packages; this report finds the same pattern live in `.github/workflows/ci.yml`,
  outside PR #96's scope.
- Grade A (official npm docs / directly observed CLI behavior): `npm audit
  --audit-level=<sev>` sets exit-code severity threshold over whatever
  dependency graph the preceding `npm ci` installed; it does not implicitly
  respect `--omit=dev` unless passed explicitly. A bare invocation always
  audits the full graph including devDependencies.
- Grade A (this session's live repro): extracting `.github/workflows/ci.yml`
  at baseline commit `3edd426` and classifying every `npm audit` line
  confirms the `dependency-audit` job's line is gating (`--audit-level=`
  present), unscoped (no `--omit=dev`), and non-report-only (no `|| true`)
  — the precise shape of the bug #46 fixed.

## Hypothesis (frozen before evaluation)

> Given `.github/workflows/ci.yml` at commit `3edd426` (main tip), when a
> dev-toolchain-only high/critical `npm audit` finding exists, then the
> `dependency-audit` job's bare `npm audit --audit-level=high` step fails
> the job (non-zero exit), contradicting the repo's own documented and
> tested policy (`dependency-security` / `audit-gate` / ADR-0002) that only
> production-reachable findings should gate CI — a regression of issue #43
> reintroduced by commit `d16a776` (2026-09-04, merged `0d24709`
> 2026-09-05). Removing the duplicate job and adding a text-based governance
> test that scans all workflow files for an un-scoped, gating `npm audit`
> invocation should restore single-source-of-truth policy, with zero
> regressions in the existing 697-test suite (616 vitest + 81 governance).
> Not modified after evaluation began.

## Competitors (unchanged context, no new external research applicable)

| Project | Relevant practice | Grade | Applicability here |
|---|---|---|---|
| Sakana AI Scientist | Automated paper-writing + experiment loop; no CI-policy self-audit reported | B | Not directly comparable — this finding is repo-infrastructure, not research methodology |
| OpenHands | Sandboxed agentic CI actions; emphasizes least-privilege workflow permissions | B | Same spirit as this repo's `permissions: contents: read` on `ci.yml` — no gap found there tonight |
| DSPy/GEPA | Optimizes prompts/pipelines against a frozen metric; explicit anti-reward-hacking checks | A (official repo/docs) | This repo's own promotion gate (STEP 10-14) mirrors GEPA's "don't let the optimizer edit its own scorer" discipline — applied here as "don't let a merge silently edit the audit policy" |
| SWE-agent | Issue-to-PR agent; relies on CI as ground truth for candidate correctness | B | Directly relevant: if CI's own gating policy is internally contradictory, an agent (or a human) trusting "CI is green" gets a weaker signal than believed — motivates this fix |
| AutoGPT lineage | General autonomous loops; historically weak on durable cross-run memory | B | Analogous to this repo's own `ledgerStale` finding (2026-09-01, PR #62) — a governance policy that isn't continuously re-verified drifts silently, exactly as observed here |

## Evaluation Receipt

Real evaluator: `npm test` (`vitest run && npm run test:governance`), plus
`npm run typecheck`, `npm run build`, `npm run lint`, `npm run
check:edge-contracts`, `npm run check:development-policy` — baseline then
candidate, identical commands, same machine/session.

| | Baseline `3edd426` | Candidate |
|---|---|---|
| vitest | 616/616 | 616/616 |
| governance (`node --test scripts/*.test.mjs`) | 81/81 | 84/84 (+3) |
| typecheck | clean | clean |
| build (`tsc -b` × 6 workspaces) | clean | clean |
| lint (`eslint packages`) | clean | clean |
| `check:edge-contracts` | 4 schemas / 14 resources / 14 tools (unchanged) | unchanged |
| `check:development-policy` | `{"findings":[],"verdict":"ACCEPT"}` | unchanged |
| `.github/workflows/ci.yml` YAML validity (`python3 -c "yaml.safe_load(...)"`) | 5 jobs (incl. duplicate `dependency-audit`) | 4 jobs: `test`, `software-evidence`, `dependency-security`, `no-optional-deps` |

Live repro (pre-fix, negative control): running the new test's own
classifier logic against `git show 3edd426:.github/workflows/ci.yml`
flags `npm audit --audit-level=high` as an offender (`gates=true
scoped=false reportOnly=false`); running it against the candidate's
`ci.yml` returns zero offenders. The new test module is exercised both
ways — this session did not just assert the fix is correct, it
demonstrated the test would have failed on the bug it targets.

## Darwin Results

`DARWIN=not-applicable`. One CI job removed + one governance test file
added — no meaningful mutable population for bounded generations×children
search (ADR-0002 precedent, reaffirmed by #99/#100's same reasoning).
Also declined to invoke the `darwin` evaluator entrypoint itself
(`npx @metaharness/darwin`, still unpinned on `main` — flagged supply-chain
risk in `dream.config.json`, ≥3 prior nights, human decision pending,
deliberately not re-flagged a 4th time on top of #90/#91/#99).

## Evidence

OBSERVATION (grade A, first-hand git archaeology) / OBSERVATION (grade A,
live repro, both pre- and post-fix) / MEASUREMENT (test/build/lint deltas
above) / INFERENCE (this repo's "union-merge silently resurrects a fixed
governance bug" failure class, per PR #96 precedent, now confirmed in a
file PR #96 did not touch) / DECISION (remove duplicate job, add scanning
regression test covering all workflow files, not just `ci.yml`) /
REJECTION (three alternative candidate directions investigated and
declined — see below). No inference stored as a measurement.

## Reward-Hack Check

The new governance test does not merely assert "no offending line exists
in the current file" (which a future careless merge could defeat by
deleting the assertion along with re-adding the bug) — it is a *scanning*
test over `readdirSync(.github/workflows)`, so it covers every current and
future workflow file, not just `ci.yml`. A third "sanity" test asserts the
scanner actually finds ci.yml's two known real `npm audit` lines, so the
other two assertions cannot pass vacuously (e.g., from a typo'd regex that
matches nothing). Verified against a negative control (pre-fix `ci.yml`)
before trusting the positive result on the candidate.

## Security Review

This is itself a security-CI-policy finding, so treated adversarially:
- **What was actually lost by removing `dependency-audit`?** Its
  `npm ci --ignore-scripts` install-time hardening is not unique — every
  other job that runs before it in the pipeline (`test`, `no-optional-deps`)
  already runs a plain `npm ci` with scripts enabled, so the overall CI
  supply-chain-exposure surface is unchanged by this removal.
- **Fail-open risk in the surviving gate?** `classifyAuditGate` (used by
  `dependency-security`) returns `verdict: 'malformed'` → exit code 2 (not
  0) on any report it cannot parse, so a corrupted/empty audit report fails
  closed, not open.
- **Scope of this diff**: `.github/workflows/*` and `scripts/*.test.mjs`
  only. No change to `dream.config.json` (`autoMerge` remains `false`), no
  change to any package's runtime code, no change to `automerge-guard.mjs`
  or its protected-path list (issue #99 / PR #100's domain, left
  untouched to avoid duplicating that still-open candidate).
- No prompt-injection surface: this candidate does not touch any
  LLM-facing code path (`scripts/dream-nightly.mjs` was read and audited
  tonight — its `execFileSync` calls all use argv arrays, not shell
  strings, and the ledger library's `escapeCell` already sanitizes
  pipe/newline characters in LLM-generated `finding` text before it
  reaches `docs/dream-cycle/LEDGER.md` — no gap found, not shipped as a
  change).

## Scan Findings

**redblue**: adversarially probed "does CI actually enforce the policy it
documents" — found and closed a real contradiction between two jobs
auditing the same dependency graph under different (incompatible) rules.
**supply-chain**: the contradiction was specifically about *dependency*
audit gating — a dev-toolchain-only advisory could silently turn CI red
again (a availability/noise regression, not a code-exposure one; the
production-reachable gate itself was never broken).

## Gist

No `gh` CLI, no Gist-creation MCP tool available this session.
`GIST=LOCAL` — this report is committed at
`docs/dream-cycle/2026-09-18-security-adversarial-report.md` in the PR.

## Next steps (3 concrete)

1. A human should decide whether to pin `evaluatorEntrypoints.darwin`
   (`npx @metaharness/darwin`) to an exact version or vendor it as a real
   dependency — flagged repeatedly (#19/#40/#84/#68/#99), never actioned;
   this report deliberately does not re-flag it a 5th time, only points at
   it as the standing highest-leverage open item on this surface.
2. Review and merge issue #99 / PR #100 (automerge-guard `PROTECTED`
   enumeration drift) — an independent ACCEPT-graded candidate from
   2026-09-08 that has sat unreviewed for 10 days; this report deliberately
   avoided duplicating it.
3. Consider whether `scripts/ci-audit-policy.test.mjs`'s text-scanning
   approach should eventually be replaced by an actual YAML-aware workflow
   linter (e.g. `actionlint`) as a dev dependency — today's fix matches
   this repo's existing text/regex-based governance-test style
   (`check-edge-contracts.mjs`, `mission.mjs policy`), but a real parser
   would close the residual gap where a multi-line YAML block scalar could
   evade a single-line regex.

## Witness

```
report_sha256 : 83ae958958b35fbfe2b013f484dbdb1864fd3e64e67db149fd72335c08858611
session_commit: 3edd426f6c9c4b1e80235f7447dc863e749345cc
witness       : 49c4dbe278be6a0bc90a358af0d9235d4d2ac3ad7243fdad71d686e4e9b8c970
```

(computed via `node packages/cli/dist/bin.js witness stamp <report>
<commit>`, on pre-Witness-section content, same convention as prior
nights, e.g. issue #99/PR #100.) Reproduce:

```bash
REPORT_HASH=$(sha256sum <report-file> | awk '{print $1}')
printf '%s%s' "$REPORT_HASH" 3edd426f6c9c4b1e80235f7447dc863e749345cc | sha256sum | awk '{print $1}'
# must equal 49c4dbe278be6a0bc90a358af0d9235d4d2ac3ad7243fdad71d686e4e9b8c970
```
