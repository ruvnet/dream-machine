# Security-Adversarial / Supply-Chain SOTA Report — 2026-09-08

**Repo:** ruvnet/dream-machine · **Slot:** 3 (`DAYINT % 5`, DAYINT=20260908)
**DEEP:** security-adversarial · **SCAN:** redblue, supply-chain
**Session commit (baseline):** `3edd426f6c9c4b1e80235f7447dc863e749345cc`

## TL;DR

`scripts/automerge-guard.mjs`'s `PROTECTED` path list — the sole filter deciding
whether a future auto-merge-eligible PR is allowed to touch source code without
mandatory human review — enumerated five workspace packages by name
(`compile`, `ledger`, `witness`, `memory`, `schedule`) instead of protecting the
whole `packages/` tree. Three packages that shipped after that list was written
were never added: `cli`, `edge-contracts`, `edge-sim`. Verified live against
tonight's baseline: a synthetic PR touching only `packages/cli/src/bin.ts` (the
actual CLI executable this repo's own tooling runs for `ledger append`,
`witness stamp`, `compile`, `verify-entrypoints`) was classified
`eligible: true` by `evaluateGuard`, identical to a harmless docs change.
Fixed by replacing the five-name enumeration with a blanket
`^packages\/[^/]+` match — every current and future package is protected by
construction, closing the whole class of "forgot to add the new package"
drift rather than patching today's three instances.

## What's New

- Live repro against `scripts/automerge-guard.mjs` at baseline `3edd426`:
  `protectedPath('packages/cli/src/bin.ts')` → `false`; same for
  `index.ts`, `entrypoint.ts`, `tui.ts` under `packages/cli/src`, and for
  `packages/edge-contracts/src/index.ts` / `packages/edge-sim/src/index.ts`.
  `evaluateGuard` on a synthetic PR touching only `packages/cli/src/bin.ts`
  returned `{"eligible":true,"reason":"separate-human-review-required"}` —
  the same "eligible" verdict a trivial README PR gets.
- Root cause: `PROTECTED`'s package-path entry was
  `/^packages\/(?:compile|ledger|witness|memory|schedule)(?:\/|$)/i` — an
  allowlist-of-*blocked*-packages that must be kept in sync by hand every
  time a package is added. `packages/cli` (present since the CLI package's
  creation), `packages/edge-contracts` and `packages/edge-sim` (added by
  PR #75, "governed edge simulation and optimized local memory") were never
  added to it. `packages/cli/src/auditgate.ts` happened to be caught anyway
  by the unrelated `gate` keyword substring match — a coincidence, not
  coverage, and `bin.ts`/`index.ts`/`entrypoint.ts`/`tui.ts` in the same
  package have no such lucky substring.
- Fix: `packages/(?:compile|ledger|witness|memory|schedule)` →
  `packages/[^/]+` in `scripts/automerge-guard.mjs`. Strictly widens the
  match (every previously-protected package path is still matched by the
  broader pattern); removes the maintenance burden that caused the drift.
- New regression test (`scripts/automerge-guard.test.mjs`): asserts
  `protectedPath` and `evaluateGuard` treat `packages/cli/src/{bin,index,
  entrypoint,tui}.ts`, `packages/edge-contracts/src/index.ts`,
  `packages/edge-sim/src/index.ts`, and a synthetic
  `packages/anything-not-yet-invented/src/index.ts` as protected — the last
  one specifically to test the *general* fix (protect-by-construction), not
  just today's three known instances.

## Why this wasn't already found

Checked prior nights before implementing (STEP 2 discipline): no prior
`docs/dream-cycle/` report or ADR names `automerge-guard.mjs`'s `PROTECTED`
list as a finding — only incidental mentions confirming an *unrelated*
candidate's own diff didn't touch a protected path (2026-09-06's
`ledger-signals` report). `git log` on `scripts/automerge-guard.mjs` and
`.github/workflows/automerge.yml` shows one prior hardening commit ("fix:
enforce human governance and validate Home Core contracts") that produced
today's 14-test adversarial suite (path traversal, workflow-command
injection, TOCTOU across file-list pagination, fork/head/base drift, both
sides of renames/copies) — thorough against *malicious PR metadata*, but
never re-examined against *its own protected-package enumeration* going
stale as the workspace grew. `mcp__github__search_issues` for
`automerge-guard PROTECTED cli` returned zero results. Not a repeat of the
`security-adversarial` deep dive's most recent findings, which were the
unpinned-`npx` `darwin` entrypoint (2026-08-18 PR #19, 2026-08-27 PR #40,
2026-09-03 local-only cross-check, 2026-09-05 PR #84 "supersedes #19" — four
independent implementations of the same finding, all still open/closed
unmerged) — `ledger signals`' `duplicateDirections` output plus this
session's own review of all 50+ historical dream-cycle PRs confirms that
finding has already crossed the ≥3-repeat learning-signal threshold
(STEP 1.1), so tonight deliberately did not open a fifth. This finding is a
different mechanism (protected-path enumeration drift, not entrypoint
pinning) with zero prior implementations found.

## Hypothesis (frozen before evaluation)

> Given `scripts/automerge-guard.mjs`'s current `PROTECTED` package-path
> pattern (an explicit five-name enumeration), when a synthetic PR touches
> only a source file under a workspace package absent from that enumeration
> (`packages/cli`, `packages/edge-contracts`, `packages/edge-sim`), then
> `evaluateGuard` will return `eligible: true` — a false-negative on
> "protected path" — for a package as sensitive as any already-enumerated
> one. Replacing the enumeration with a blanket `packages/[^/]+` match should
> make every current and synthetic future package name protected, with zero
> change to any currently-protected classification and zero regression in
> the 14 pre-existing adversarial tests. Not modified after evaluation began.

## Candidate

`scripts/automerge-guard.mjs` (+6/-1 line): one regex line, `packages/(?:
compile|ledger|witness|memory|schedule)` → `packages/[^/]+`, plus an
explanatory comment. `scripts/automerge-guard.test.mjs` (+19 lines): one new
test asserting the three real previously-unprotected paths, their sibling
files, and one synthetic never-yet-invented package name are all now
`protectedPath === true` and yield `evaluateGuard(...).reason ===
'protected-path'`. Total diff: 24 lines, one conceptual change, no other
files touched.

## Baseline

`3edd426f6c9c4b1e80235f7447dc863e749345cc` (session start, `main` tip).
`node --test scripts/automerge-guard.test.mjs`: 14/14 pass. Full suite:
`npx vitest run` → 616/616 pass (23 files); `npm run test:governance`
(`node --test scripts/*.test.mjs`) → 81/81 pass. `npm run lint` (`eslint
packages`) → clean. `npm run build` (tsc -b × 8 packages) → clean.

## Evaluation Receipt

Real evaluator: this repo's own `bench` entrypoint (`npm test` = `vitest run
&& npm run test:governance`), run identically on baseline then candidate.

| | Baseline (`3edd426`) | Candidate |
|---|---|---|
| vitest | 616 passed / 616 | 616 passed / 616 |
| governance (`node --test scripts/*.test.mjs`) | 81 passed / 81 | 82 passed / 82 (+1 new) |
| `automerge-guard.test.mjs` alone | 14/14 | 15/15 |
| Build (`tsc -b` × 8 packages) | clean | clean |
| Lint (`eslint packages`) | clean | clean (unchanged; `scripts/` is out of the repo's own lint scope on both baseline and candidate — verified via `git stash`) |

Live repro, before the fix (`git stash`, re-run):

```text
$ node -e '... evaluateGuard({ config:{repo,autoMerge:true}, ..., pages:[[{filename:"packages/cli/src/bin.ts",status:"modified"}]] })'
{"eligible":true,"reason":"separate-human-review-required"}
```

After the fix, identical input:

```text
{"eligible":false,"reason":"protected-path"}
```

No inference from logs — receipts are the direct `node --test` / `vitest`
exit output plus the `evaluateGuard` return value reproduced above.

## Darwin Results

`DARWIN=not-applicable`. A one-line regex widening plus one regression test
has no meaningful mutable population for bounded generations×children
search — same rationale as ADR-0002 and every prior single-fix
security-adversarial night (2026-08-13, 2026-08-18, 2026-08-28, 2026-09-03).
Also declined to invoke the `darwin` evaluator entrypoint itself
(`npx @metaharness/darwin evolve . --sandbox mock`) tonight: it is the
unpinned-`npx` command already flagged by this compiled routine's own
supply-chain warning (resolves the registry `latest` dist-tag fresh on every
invocation, no lockfile governance) — running it would apply exactly the
kind of ungoverned execution this session's candidate is hardening against.

## Evidence

- OBSERVATION (grade A, first-hand, direct code read): `scripts/
  automerge-guard.mjs` line 16 enumerated 5 of 8 workspace packages
  (`ls packages/` → `cli, compile, edge-contracts, edge-sim, ledger, memory,
  schedule, witness`).
- OBSERVATION (grade A, first-hand, `node -e` repro against the real
  module): `protectedPath('packages/cli/src/bin.ts') === false` and
  `evaluateGuard(...).eligible === true` for a synthetic bin.ts-only PR, at
  baseline commit `3edd426`.
- OBSERVATION (grade A, first-hand, `mcp__github__list_pull_requests` +
  `search_issues`): zero existing open PR or issue names this finding; the
  guard file's own git history shows one prior hardening commit, not a
  second pass over package-list staleness.
- MEASUREMENT: baseline 616 vitest + 81 governance tests green; candidate
  616 vitest + 82 governance tests green (+1, 0 removed, 0 modified);
  `automerge-guard.test.mjs` 14→15; lint and build both clean before and
  after.
- INFERENCE: because `PROTECTED`'s package clause was a name-enumeration
  rather than a directory-blanket match, every future new package under
  `packages/` will repeat this exact drift unless a human remembers to
  extend the list — the blanket-match fix removes that recurring
  maintenance dependency rather than closing only the three currently-known
  instances.
- DECISION: ship the blanket-match fix; do not additionally special-case
  `cli`/`edge-contracts`/`edge-sim` by name (that would just recreate the
  same enumeration-drift risk for the *next* new package).
- REJECTION: continuing the unpinned-`npx` `darwin` entrypoint line of work
  (4 prior independent implementations, `duplicateDirections`-eligible,
  ≥3-repeat learning signal triggered) and the `zeroMergeStreak`/
  `mergedPrNumbers` measurement-quality line of work (PRs #9, #15, #27, #89 —
  4 prior independent implementations, all closed unmerged) — both rejected
  tonight specifically to avoid a 5th duplicate direction, per STEP 1.1.

## Reward-Hack Check

No benchmark/gold-answer/threshold surface exists for this candidate to
game: `automerge-guard.test.mjs` is itself part of the changed surface (the
candidate adds a test, it does not touch an external corpus), and the new
test explicitly includes a synthetic, never-real package name
(`packages/anything-not-yet-invented`) specifically so the fix cannot be
verified by a candidate that only special-cases the three known-bad paths
by name — an independent critic re-running `protectedPath` against
`packages/some-other-future-package/src/x.ts` (not in the test file at all)
confirms `true` without being told to.

## Security Review

This candidate's whole subject is a security-authorization surface. Direct
findings:
- **Fixed**: `packages/cli`, `packages/edge-contracts`, `packages/edge-sim`
  now human-review-gated like every other package, closing the
  false-`eligible` gap identified above.
- **Confirmed not a regression path**: the widened regex only adds matches
  (`[^/]+` is a superset of the five literal alternatives it replaces); no
  path that was protected before this change becomes unprotected.
- **Confirmed still inert today**: `dream.config.json`'s `autoMerge: false`
  means `evaluateGuard`/`inspectPullRequest` short-circuit to
  `blocked('configuration-disabled')` before any of this logic runs (see
  `scripts/automerge-guard.test.mjs`'s own "current repository config
  disables eligibility without querying GitHub" test, unchanged and still
  passing) — this fix hardens the guard for if/when a human ever flips that
  flag, it does not change tonight's actual runtime behavior, and the
  `.github/workflows/automerge.yml` workflow itself remains read-only
  (`contents: read`, `pull-requests: read`, base-only checkout, no `gh pr
  merge`/`--auto`/write scopes — reverified against the unchanged workflow
  file tonight).
- No prompt injection surface (no LLM call in this candidate's evaluation
  path). No credential exposure in the diff itself. **Adjacent observation,
  not part of this candidate**: earlier tonight, this session's own shell
  history briefly echoed the live `OPENROUTER_API_KEY` value into this
  session's transcript via an unquoted `${VAR:-default}` bash expansion
  (`echo "...${OPENROUTER_API_KEY:+yes}${OPENROUTER_API_KEY:-no}"` prints
  the real value when the variable is set, not just "yes"/"no" as intended)
  — a redblue-relevant credential-handling mistake by the *agent running
  this routine*, not a defect in `ruvnet/dream-machine`'s own code, so it is
  recorded here as evidence rather than shipped as a code candidate. No
  repository script or CI workflow was found to contain the same unquoted-
  fallback pattern (`grep` across `.github/workflows/`, `scripts/`, and
  `docs/` for comparable `${VAR:+...}${VAR:-...}` idioms near credential-
  sounding names found none) — this is flagged as an operational finding
  about the runner, not a repo vulnerability, and is not evaluated or
  witnessed as a code change.

## Regression Analysis

0 pre-existing tests modified or removed. 616 vitest tests unchanged; 81→82
governance tests (1 new, additive only). Lint and build both clean,
identical to baseline. The new test's synthetic
`packages/anything-not-yet-invented` case specifically guards against a
future narrow "just add cli/edge-contracts/edge-sim by name" patch silently
reintroducing the same drift class.

## ADR

None. This is a bug fix to an existing governance guard's path-matching
logic — closing a coverage gap, not introducing a new invariant, schema, or
promotion-policy decision. Matches the precedent set by #9/#15/#27's own
"not architectural" reasoning and 2026-09-06's report for the same class of
additive, non-architectural CLI/tooling change.

## Scan Findings

**redblue**: this report's whole subject — an adversarial "what would a
malicious or careless PR author try" probe against `automerge-guard.mjs`,
which found and fixed a real authorization-boundary gap (untested-by-name
packages silently outside the protected set).

**supply-chain**: not the unpinned-`npx` finding (rejected above, ≥3-repeat).
Adjacent supply-chain framing: the fixed gap meant a compromised or
careless dependency update touching only `packages/cli` — the package whose
compiled output (`packages/cli/dist/bin.js`) every one of this repo's own
tooling invocations executes, including tonight's own `ledger append` /
`witness stamp` — could in principle have qualified for reduced review under
a future auto-merge policy without ever being named in the protected list.

## Competitors

Unchanged from prior security-adversarial nights' survey (Sakana AI
Scientist, OpenHands, DSPy/GEPA, SWE-agent/SWE-bench, AutoGPT lineage — none
publish a comparable self-hosted auto-merge-eligibility guard with this
repo's specific protected-path design); no new competitor research
conducted tonight since this finding is a first-party code-authorization
gap, not a technique adopted from external research.

## Gist

No `gh` CLI installed this session; GitHub access is via the GitHub MCP
server, which has no Gist-creation tool. `GIST=LOCAL`, consistent with every
prior night's fallback (2026-08-30 PR #55 precedent). This report file is
committed into the PR as the durable artifact.

## Witness

```
report_sha256 : df6d6d724e3e7c33c8775bd3fe6b1efbb622e96690d3c64cba4a47b492453927
session_commit: 3edd426f6c9c4b1e80235f7447dc863e749345cc
witness       : 62387b948fc8b67dc6763013dda0de18e22c9bbc2b79ad87aee7c0cf5295ef1b
```

Verify: `sha256sum docs/dream-cycle/2026-09-08-security-adversarial-report.md`
won't reproduce `report_sha256` above — it was computed on the pre-Witness-
section content per STEP 16's own hash-then-rewrite order (same convention
as prior nights, e.g. 2026-08-19's report). What anyone can reproduce:
`printf '%s%s' "df6d6d724e3e7c33c8775bd3fe6b1efbb622e96690d3c64cba4a47b492453927" "3edd426f6c9c4b1e80235f7447dc863e749345cc" | sha256sum`
must equal `62387b948fc8b67dc6763013dda0de18e22c9bbc2b79ad87aee7c0cf5295ef1b`
(computed via `node packages/cli/dist/bin.js witness stamp <file> <commit>`
before this section was rewritten).

## Recommendation

`evaluated: yes` / `verdict: ACCEPT` — real, reproducible gap found and
fixed with a minimal, generalizing diff; 0 regressions across 698 total
tests (616 vitest + 82 governance); lint and build clean; independent
synthetic-package test guards against a narrow re-patch reintroducing the
same drift class. Recommended next steps for a human:

1. Merge this PR (or hand-apply, per this repo's established pattern) —
   tiny, reviewable, additive-only diff, matching the `zeroMergeStreak`-
   driven bias toward small candidates (STEP 1.1).
2. Independently of tonight's fix: consider whether `evaluateGuard`'s other
   filename-keyword list (`safety|gate|threshold|...`) has the same
   enumeration-drift risk as the package-path list did — not evaluated
   tonight (would be a second, separate candidate; flagged for a future
   night or human review, not shipped here to keep this diff to one
   conceptual change).
3. Not tonight's scope, already tracked: the unpinned-`npx` `darwin`
   entrypoint (PRs #19/#40/#84, 4th independent implementation) and the
   `zeroMergeStreak` measurement-quality gap (PRs #9/#15/#27/#89, 4th
   independent implementation) both remain open/closed-unmerged; per
   STEP 1.1's ≥3-repeat rule, no 5th duplicate was opened for either
   tonight. A human deciding to merge any one of the existing candidates
   for either finding would be higher-leverage than another new attempt.
