# Security-Adversarial / Supply-Chain SOTA Report — 2026-09-03

**Repo:** ruvnet/dream-machine · **Slot:** 3 (`DAYINT % 5`, DAYINT=20260903)
**DEEP:** security-adversarial · **SCAN:** redblue, supply-chain
**Session commit (baseline):** `7933c3599abe22df5290f4609d1f93f598feb3de`

## TL;DR

Tonight's rotation slot is identical to 2026-08-18's: `dream.config.json`'s
`darwin` evaluator entrypoint (`npx @metaharness/darwin evolve --sandbox mock`)
has no version pin, so it resolves the npm registry's `latest` dist-tag fresh on
every invocation. Before implementing, this session checked open GitHub state
(not just the local ledger, which is stale on `main` — see "A second finding"
below) and found that **PR #19 (2026-08-18) already ships a more thorough
detector for exactly this problem**, plus **PR #40 (2026-08-27) already ships a
`verify-entrypoints` CLI aggregator**. Both are open, unmerged drafts.

Rather than open a third competing implementation, this session built the same
detector from scratch locally, put it through three independent rounds of
adversarial critique, and cross-checked the result against PR #19's shipped
code. That cross-check found a real, reproducible gap in PR #19's `isUnpinned`:
a bare major or major.minor tag (`@1`, `@1.6`) passes as "pinned" because the
check only verifies the version segment starts with a digit, not that it's a
full exact `major.minor.patch`. Reported as a review comment on PR #19 with
repro + suggested fix. **No new PR opened for the code** — see Recommendation.

## What's New

- Independent local re-implementation of an unpinned-`npx` detector
  (`isUnpinnedNpx` in `packages/cli/src/entrypoint.ts`, not committed — see
  Recommendation), taken through three rounds of adversarial critique by a
  fresh subagent each round:
  - Round 1 found: floating dist-tags (`@latest`/`@next`) and bare
    major/major.minor (`@1`, `@1.6`) passing as pinned; only the first `npx`
    in a chained command inspected; `sh -c "npx …"` indirection invisible to
    the position-anchored regex. All three fixed.
  - Round 2 found: npx's own `-p`/`--package` flag can install a second,
    unpinned package alongside a pinned-looking primary spec. Fixed by
    treating any `-p`/`--package` use as unpinned outright rather than
    attempting to parse multi-package installs.
  - Round 3: no further bypass found across `--no-install`/`-n`/`-c`/`-q`/`-y`,
    chained/piped/`sh -c`-wrapped commands, and `-p`/`--package` in both space
    and `=` forms — confirmed clear to ship, as a standalone module.
  - Full local diff retained (not committed to `main`; see Recommendation):
    `packages/cli/src/entrypoint.ts` (+`isUnpinnedNpx`), wired into a new
    `verify-entrypoints` CLI command in `packages/cli/src/index.ts` that
    statically audits pinning before ever executing an entrypoint — an
    unpinned `npx` entrypoint is never auto-exec'd, only reported with a
    manual-review pointer to the existing `verify-entrypoint` command.
- Cross-check against PR #19's shipped `packages/compile/src/supplychain.ts`:
  found the bare-major/minor bypass described above. PR #19's already-fixed
  `--package=`/`-p`/`npm exec`/local-path handling (from its own prior
  critic round) is solid — no new issue found there.
- One review comment posted on PR #19 with the repro and a suggested fix
  (`https://github.com/ruvnet/dream-machine/pull/19#issuecomment-5523579122`).

## A second finding: the local ledger is stale, and this session almost repeated known work because of it

`docs/dream-cycle/LEDGER.md` on `main` currently ends at the 2026-08-26 row.
Issue #61 / PR #62 (2026-09-01, `ledger-signals`) already reports this exact
staleness (rows for nights after 2026-08-26 exist only inside their own
unmerged draft PRs, never landed on `main`), and `ledger signals` still
reports `zeroMergeStreak: true` over the 6 most recent nights considered.
STEP 1 of the compiled routine says to read `docs/dream-cycle/LEDGER.md` —
doing only that, tonight's session would not have known PR #19/#40 exist.
The GitHub issue/PR listing (via the GitHub MCP tools available this session)
was what actually surfaced them. This is not a new finding — #61/#62 already
cover it — but tonight is fresh, reproducible confirmation of the exact
failure mode #61 predicts: a nightly session working from the ledger alone
would have opened a third redundant implementation. Recorded here as
supporting evidence, not as a new candidate (already tracked).

## Hypothesis (frozen before evaluation)

> Given a from-scratch, independent implementation of an unpinned-`npx`
> supply-chain detector, subjected to three rounds of adversarial critique by
> a fresh reviewer each round, the implementation should either (a) converge
> on a bypass-free detector, and/or (b) surface bypasses also present in any
> existing, already-open implementation of the same idea — in which case the
> higher-value action is reporting the cross-check, not shipping a duplicate.
> Not modified after evaluation began.

## Evaluation Receipt

Real evaluator: `npm test` (vitest), this repo's own `bench` entrypoint, run
against the local (uncommitted) candidate before the decision to withhold it:

| | Baseline (`7933c35`) | Local candidate (uncommitted) |
|---|---|---|
| Tests | 98 | 116 (+18, 0 removed, 0 modified) |
| Result | 98 passed | 116 passed |
| Build (`tsc -b` × 6 packages) | clean | clean |
| Lint (`eslint packages`) | clean | clean |

Live receipt against this repo's real `dream.config.json`, before reverting:

```text
$ node packages/cli/dist/bin.js verify-entrypoints dream.config.json
bench: live (exit 0) — produced output
darwin: SKIPPED — unpinned npx package, supply-chain policy forbids auto-exec — npx @metaharness/darwin evolve --sandbox mock
  review the package, then: dream-machine verify-entrypoint darwin --cmd "npx @metaharness/darwin evolve --sandbox mock"
exit=1
```

After the redundancy discovery, the working tree was reverted to a clean
baseline (`git checkout --`) — no code candidate is committed on `main` or any
branch tonight. The full local diff (290 lines) is retained as scratch
evidence for this report's claims but intentionally not shipped, per
Recommendation.

## Darwin Results

`DARWIN=not-applicable`. A single detector function/CLI command has no
meaningful mutable population for bounded generations×children search (same
rationale as ADR-0002 and PR #19's own 2026-08-18 precedent).

## Evidence

- OBSERVATION (grade A, first-hand, GitHub MCP `list_issues`/`list_pull_requests`):
  30 open issues, 29 open PRs on `ruvnet/dream-machine` as of tonight; issue
  #18/PR #19 (2026-08-18) and issue #39/PR #40 (2026-08-27) both already
  target this exact rotation slot's finding.
- OBSERVATION (grade A, first-hand, `pull_request_read get_diff` on PR #19):
  `isUnpinned` at `packages/compile/src/supplychain.ts` returns `false`
  (pinned) for `versionOf('@metaharness/darwin@1')` since `/^\d/.test('1')`
  is `true` — logically traced, not merely asserted; the same trace confirms
  PR #19 correctly flags today's actual `dream.config.json` (no `@` at all).
- MEASUREMENT: local candidate 98→116 tests, 0 regressions, 3 critic rounds
  (round 1: 3 bypasses found and fixed; round 2: 1 bypass found and fixed;
  round 3: none found).
- MEASUREMENT: `ledger signals` → `{"zeroMergeStreak":true,"duplicateDirections":[],
  "lowScoreStreak":false,"blockedEvalStreak":false,"nightsConsidered":6}`.
  `duplicateDirections: []` despite the direct duplication found tonight is
  itself consistent with #32's already-tracked "can't see still-open PRs" gap.
- INFERENCE: opening a third parallel implementation of the same detector
  would add reviewer burden, not reduce uncertainty, given `zeroMergeStreak`
  is already `true` and two prior candidates for this exact finding are
  already unreviewed.
- DECISION: withhold the code candidate; report the cross-check as a PR #19
  review comment instead; record tonight's cycle via this report + ledger row
  only (docs-only PR, no code diff).
- REJECTION: the code candidate itself — not because it is wrong (it passed 3
  adversarial rounds clean), but because it duplicates already-pending,
  more-thorough work. See Recommendation.

## Reward-Hack Check

N/A in the conventional sense — no code candidate ships tonight, so there is
no benchmark/gold-answer/threshold surface to have gamed. The one adjacent
question — did withholding a working, tested candidate constitute "hiding a
result" — is addressed by publishing the full local diff's existence, test
counts, and the PR #19 review comment; nothing about tonight's work is
suppressed, only not merged into `main`/a new branch.

## Security Review

No prompt injection surface (no LLM calls in this candidate's evaluation
path). No credential exposure. No filesystem/network I/O beyond the existing
`compile`/config-read pattern already reasoned about in PR #19's and
ADR-0002's security sections. The `-p`/`--package` npx-flag class of bypass
(round 2 above) is itself a security-relevant finding: npx can silently
install a *second* package beyond the one that looks pinned on the command
line, independent of dream-machine's own code — relayed to PR #19's thread
since its detector has the same blind spot in principle (it does not special-
case `-p`/`--package` at all; today's real config doesn't use that flag, so
this is a latent gap, not an active miss, same caveat as the bare-major one).

## Scan Findings

**redblue**: not re-probed tonight (no new evidence to justify revisiting
the 2026-08-13 `suspicious-silent` finding; STEP 2 discipline).

**supply-chain**: this report's whole subject. Distinct contribution from
2026-08-18/PR #19: not a new detector, but adversarial *verification* of an
existing one, finding one real residual gap (floating major/minor tags) via
independent re-derivation rather than direct code review alone.

## Competitors

Unchanged from the 2026-08-18 survey (Sakana AI Scientist, OpenHands,
DSPy/GEPA, SWE-agent/SWE-bench, AutoGPT lineage — none document a comparable
unpinned-dynamic-resolution detector); no new competitor evidence gathered
tonight, since tonight's work is a cross-check of existing in-repo work
rather than new external research.

## Gist

No gist-creation MCP tool available this session (GitHub access is via the
GitHub MCP server, which has no Gist API; no `gh` CLI installed). This report
is committed instead, `GIST=LOCAL`, consistent with every prior night's
fallback.

## Witness

```
report_sha256 : (computed via `dream-machine witness stamp`, see PR/ledger)
session_commit: 7933c3599abe22df5290f4609d1f93f598feb3de
witness       : (see PR description / LEDGER.md row)
```

Verify: `sha256sum docs/dream-cycle/2026-09-03-security-adversarial-report.md`,
then `printf '%s%s' "<that hash>" "7933c3599abe22df5290f4609d1f93f598feb3de" | sha256sum`
must equal the witness value published in the PR body and `LEDGER.md`.

## Recommendation

`evaluated: yes` (a real candidate was built and evaluated) / `verdict:
REJECT` — not because the candidate failed, but because it is superseded by
already-open, more complete work (PR #19 + PR #40). Recommended next steps
for a human:

1. Fix PR #19's `isUnpinned` to require a full exact-semver match
   (`/^\d+\.\d+\.\d+(?:[-+][\w.]+)?$/` against the version segment, not just
   a leading-digit check) before merging — repro + suggested diff posted on
   the PR thread tonight.
2. Consider merging PR #19 and/or PR #40 — both are complete, tested,
   evaluated, and address a real, live exposure in this repo's own config.
   Neither depends on the other; PR #40's `verify-entrypoints` currently has
   no pinning awareness of its own, so if merged alone it would still
   auto-exec the unpinned `darwin` entrypoint — worth a maintainer decision
   on whether to land PR #19's detector first, or combine the two ideas in
   whichever PR merges last.
3. Not tonight's scope, already tracked (#32/#33, #61/#62): the ledger being
   stale on `main` (rows trapped in unmerged branches) and `duplicateDirections`
   not seeing already-open PRs both directly contributed to tonight almost
   repeating existing work. No new action needed beyond what #32/#61 already
   propose.
