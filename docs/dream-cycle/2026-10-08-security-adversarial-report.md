# Supply-Chain Detector Hardening SOTA Report — 2026

## TL;DR
This repo's own `findUnpinnedNpxInvocations` (the detector that flags unpinned `npx`/`npm exec` calls as a supply-chain risk — the same class of risk this repo's own `evaluatorEntrypoints.darwin` carries) had a disclosed-but-unfixed bypass: a global `npm` flag between `npm` and `exec` (e.g. `npm --loglevel=silent exec pkg`, `npm -s exec pkg`) defeated the exact-adjacent-token match, so the invocation went entirely undetected. Live-confirmed on current `main` before any fix. Fixed with a 19-line helper that tolerates self-contained flag tokens between `npm` and `exec`, with the remaining residual gap (separate-token flag values) explicitly disclosed via a named, skipped regression test rather than silently left unexamined.

## What's new
- `findNpmExecIndex()`: walks forward from `npm`, skipping tokens that look like flags (`-*`), until it finds `exec` or a non-flag token (no match). Replaces the old exact `tokens[i+1] === 'exec'` check.
- Disclosed residual gap #1 (unfixed, named skipped test): a flag whose value is a separate following token (e.g. `--prefix /tmp exec`) still bypasses detection — fixing it without a full npm-flag-arity table risks misreading the real `exec` token as some other flag's value.
- Disclosed residual gap #2 (found by an independent critic reviewing this candidate, non-blocking): the converse — a separate-token flag value that is itself the literal string `exec` (e.g. `npm --registry exec install pkg`) is misread as the subcommand, producing a spurious finding against a real subcommand's own operand. This can only ever over-report, never under-report, so it is not a security regression, just a disclosed noise risk.

## Competitors / prior art (graded)
| Tool | Approach to this class of risk | Grade |
| --- | --- | --- |
| OpenSSF Scorecard — `Pinned-Dependencies` check | Scans CI workflow YAML for unpinned Action refs and (more coarsely) shell-invoked package managers; does not do token-level CLI parsing of arbitrary config-embedded command strings the way this repo's detector does | B (official, cross-checked via web search 2026-10-08) |
| OpenSSF Scorecard — `Dangerous-Workflow` check | Focused on `pull_request_target` + script-injection patterns, a different (but related) CWE-88-adjacent class | B |
| Socket.dev / Snyk CLI | Dependency-graph and install-script risk scoring; neither specifically parses ad-hoc shell command strings embedded in an arbitrary config file the way this repo's `evaluatorEntrypoints`/`controlPlaneProbes` scan does | C (vendor docs, not independently re-verified this session) |
| Semgrep supply-chain / CodeQL `js/command-line-injection` | General command-injection detection; a flag-interposition bypass of a custom tokenizer is a known failure mode of hand-rolled argv scanners generally (CWE-88, argument injection), not specific tooling for this exact repo pattern | B |
| This repo's own prior nights (#99/#100, #119/#120, #138/#139, #149/#150) | Same self-audit methodology, same file/detector family, each finding independently reproduced live before fixing | A (first-party, reproduced) |

No tool surveyed does exactly what this repo's detector does (parse arbitrary human-authored command strings in a JSON config for unpinned-registry-resolution risk); the closest prior art (Scorecard's Pinned-Dependencies) operates one layer up, on YAML Action refs, not on free-text shell tokens. This confirms the repo's own custom tokenizer is filling a real, non-redundant gap — and inherits the known fragility class (CWE-88-style argument-injection bypasses of hand-rolled parsers) that general-purpose scanners don't fully solve either.

## Hypothesis (frozen before implementation)
> Given `findUnpinnedNpxInvocations`'s npm-exec trigger match (`tokens[i]==='npm' && tokens[i+1]==='exec'`), when a global npm flag (`--loglevel=silent`, `-s`, `--yes`, or stacked combinations thereof) appears between `npm` and `exec` in a command string, the invocation is not detected as an unpinned-npx risk — identical in kind to the gap PR #139 disclosed-but-left-unfixed for the trigger set it was widening. Making the npm-exec trigger match tolerant of intervening self-contained flag tokens (while leaving `npx` detection, `--package`/`-p` extraction, and the exact-semver pin logic untouched) should close this gap with zero false positives on commands where `exec` never appears as a subcommand, and zero regressions in the existing 769 vitest / 150 governance tests.

## Benchmarks / Evaluation Receipt
Real evaluator: `npm test` (`vitest run && node --test scripts/*.test.mjs`), run live, twice, on this session's own checkout (`git stash` / `git stash pop` around the candidate diff — not simulated, not inferred from logs):

| | vitest | governance |
| --- | --- | --- |
| Baseline (parent, `main@23a5770`) | 769 passed | 150 passed |
| Candidate | 776 passed + 1 skipped (disclosed gap) | 150 passed (unchanged) |

`npm run typecheck` and `npm run lint`: clean on the candidate. Live pre/post repro (exact commands, exact return values) is in the PR body.

Note: this checkout initially needed `git fetch --unshallow` before any of `npm test` could run cleanly — the pinned-baseline-commit shallow-clone bug is issue #149 / PR #150 (already open, unreviewed), not re-filed here.

## Darwin
`DARWIN=ran` (not blocked this session — contrast with PR #139/#150's prior-night sandbox denials). `rm -rf .metaharness && npx @metaharness/darwin evolve . --sandbox mock` executed end-to-end: 3 generations × 4 variants, mock-sandboxed, winner `g2_v5` (+0.110 over baseline, safety=1.00). This is the repo's generic bounded-evolution demo over the whole working tree in mock mode — it does not specifically evolve tonight's `supplychain.ts` candidate, so it is reported as a control-plane capability check (and, incidentally, live confirmation that `evaluatorEntrypoints.darwin`'s unpinned `npx` call really does resolve a moving target — it fetched `@metaharness/darwin@0.10.3` this run), not as evidence for or against the frozen hypothesis above. Bounded per STEP 10-14 (≤3 generations × ≤4 candidates, 1 promoted lineage); it did not touch tests, gold data, thresholds, or this candidate's files.

## Reward-Hack Check
Independent adversarial critic (separate subagent context, no authorship stake, read the live diff and ran the real test file itself): **CLEAR**, with one additional finding it surfaced (mislabeling risk #2 above), which is now disclosed in both the function's doc comment and a named test. Confirmed: no existing assertion weakened, no fixture/golden logic touched, no cross-contamination between separate `npm` invocations joined by `&&`/`|`, repeated/stacked flags handled correctly, disclosure of gap #1 independently re-verified accurate (not under- or overstated).

## Security Review
Pure string/token scanning, no I/O, no network, no credential surface. Strict widening of detection coverage for the realistic case (self-contained flag tokens); the residual false-negative (gap #1) can only under-report, never silently mask an already-detected risk, and is disclosed rather than hidden. The residual false-positive (gap #2) can only over-report. Neither gap is exploitable to hide a *currently detected* unpinned invocation — both are pre-existing detector-coverage edges, not new attack surface introduced by this diff.

## Scan Findings

**redblue**: No change to any adversarial-evaluation or redblue harness code this run; `darwin`/`bench` entrypoints classified via `verify-entrypoints` (bench: live; darwin: correctly refused as a compound shell command by the execFile-only CLI path, consistent with the repo's own never-a-shell invariant — run manually instead per the prompt's documented fallback).

**supply-chain**: Tonight's whole finding. Additionally reconfirmed live: `evaluatorEntrypoints.darwin`'s own `npx @metaharness/darwin` call resolved a *different* published version (`0.10.3`) than the one recorded in prior nights' reports (`0.9.x` range referenced in PR #139), directly corroborating the repo's long-standing, still-unremediated unpinned-npx finding (`packages/compile/src/supplychain.ts`'s own header comment) — the "latest" target keeps moving. Not fixed tonight (human decision, per that comment); not re-filed as a new issue (already tracked).

## Competitors
See table above.

## Gist
`GIST=LOCAL` — no `gh` CLI (`GH_TOKEN` invalid this session) and no gist-creation MCP tool available. Full report committed at `docs/dream-cycle/2026-10-08-security-adversarial-report.md`.

## Recommendation
ACCEPT for human review. Small (≤60 changed/added lines in the detector + tests), one conceptual change, fully reversible, no production/runtime surface touched, both residual gaps disclosed rather than hidden. Next steps: (1) a future night could add a small npm-flag-arity table to close gap #1 properly if judged worth the complexity; (2) the review backlog itself (9 open, unmerged dream-cycle PRs as of tonight, zero merged since #143 on 2026-09-30) is now the single largest risk to this repo's self-improvement loop — not a code defect, a human-review-throughput problem flagged for the repo owner, consistent with `ledger signals`' `zeroMergeStreak=true`.
## Witness

```
report_sha256 : cd4e9b3dc9167c435aceb5eebdf0a9c3fcd57202d771fbdd13d414e38c45ab35
session_commit: 23a577082aad39750051dc7ef0ec9d0d72900adf
witness       : eeac6e3d1f9ee2887694582eb4a1b3e3ee2a94c26359e95f3858806e6af1d6a9
```

Computed over this file's canonical bytes (everything above this heading,
trailing whitespace collapsed to one newline) — reproducible from the
committed file with no unavailable intermediate bytes. Verify:

```bash
sha256sum docs/dream-cycle/2026-10-08-security-adversarial-report.md | awk '{print $1}'  # then strip the "## Witness" section per splitAtWitnessSection before comparing
```
