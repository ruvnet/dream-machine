# Security-Adversarial SOTA Report — 2026-09-28

## Rotation
Slot 3 (`DAYINT % 5`, DAYINT=20260928) → DEEP=`security-adversarial`, SCAN=`redblue,supply-chain`. No bonus modulus hit (`20260928 % 25 = 3`, `% 75 = 53`). Session commit (baseline): `9ebc9b66cfdd7f5d9f11ffafa5675239c58a456c` (`main`, fast-forwarded clean from origin, `npm ci && npm run build` clean — no wasm/NAPI degradation to record).

## Ledger Check
`docs/dream-cycle/LEDGER.md` on `main` ends at the 2026-09-22 row (`daysSinceLastRow=6`, `ledgerStale=true` per `ledger signals` — expected: each night's row lands on `main` only once its PR merges, and the last 5 nights' PRs, including 2026-09-27's PR #137, remain open/draft). `ledger signals` output:
```json
{"zeroMergeStreak":true,"duplicateDirections":["harden anchored replay json evidence reject"],"lowScoreStreak":false,"blockedEvalStreak":false,"nightsConsidered":14,"distinctDatesInWindow":14,"lastRowDate":"2026-09-22","daysSinceLastRow":6,"ledgerStale":true,"reviewBacklogSize":null}
```
`zeroMergeStreak=true` is the CLI's unverified worst-case default (no `--merged` supplied). Ground-truth cross-check via `mcp__github__pull_request_read` on PR #100 (2026-09-08, security-adversarial's own prior finding) shows it **merged 2026-09-26** — the streak claim is stale, consistent with the same measurement-quality gap this ledger has flagged repeatedly since 2026-09-09/2026-09-20 (issue #9/#15/#27/#89 lineage). Not re-litigated a 5th time tonight. Live open-PR check (`list_pull_requests`, state=open): 3 open (`#137` 2026-09-27 evaluation-adapters, `#101`/`#98` old portfolio-cycle drafts) → `reviewBacklogSize≈1` real dream-cycle candidate PR outstanding, biasing tonight toward a small, easily-reviewable candidate (consistent with `zeroMergeStreak` bias regardless of its staleness).

Prior `security-adversarial` nights reviewed in full before starting: 2026-08-13 (`redblue` baseline), 2026-08-18 (unpinned-`npx` detector introduced), 2026-08-28 (`#45`/`#46`, npm audit CI gating, merged), 2026-09-03 (`#68`, independent re-derivation cross-check, REJECT — duplicate-direction), 2026-09-08 (`#99`/`#100`, automerge-guard PROTECTED enumeration, **merged 2026-09-26**, issue `#99` itself still open — a human housekeeping gap, not tonight's to fix), 2026-09-18 (`#119`/`#120`, duplicate CI audit-gate job, **merged**, confirmed live in `git log` at commit `36954d0`).

## Learning Signals
`duplicateDirections` names one prior repeated finding ("harden anchored replay json evidence reject") — unrelated to tonight's surface, not applicable. The unpinned-`npx` supply-chain detector direction has already crossed the ≥3-repeat threshold in prior nights (2026-08-18/2026-09-03/2026-09-08 hardening rounds) — tonight does **not** repeat another round of the same `npx`/`npm exec` hardening; instead it targets a genuinely new, previously-unexamined part of the same threat model (alternate ad-hoc-execution tools), which is a distinct direction, not a duplicate.

## Deep Dive
`findUnpinnedNpxInvocations` (`packages/compile/src/supplychain.ts`) has been through 3 nights of adversarial hardening against bypasses of its `npx`/`npm exec` trigger detection (floating dist-tags, `-p`/`--package` indirection, local/git-path exclusions — see file history). All of that hardening assumes the ad-hoc-execution tool is spelled `npx` or `npm exec`. Live repro at baseline confirms it is not the only such tool:

```
$ node -e "console.log(findUnpinnedNpxInvocations(['bunx @metaharness/darwin evolve'], {}))"
[]   # should flag @metaharness/darwin as unpinned — same resolve-latest-from-registry risk as npx
$ node -e "console.log(findUnpinnedNpxInvocations(['pnpm dlx @metaharness/darwin evolve'], {}))"
[]   # same
$ node -e "console.log(findUnpinnedNpxInvocations(['yarn dlx @metaharness/darwin evolve'], {}))"
[]   # same
```

`pnpm dlx` and `yarn dlx` are documented by pnpm/Yarn as resolving a package fresh from the registry at invocation time (not lockfile-governed); Bun's own docs describe `bunx` as "equivalent to `npx`". This repo's own `dream.config.json` does not currently use any of the three (verified: `grep -i 'dlx\|bunx' -r .` finds no matches outside this fix's own files) — like issue `#68`'s "latent gap" framing, this is proactive coverage-widening of the detector's *class* of protection, not an active exploit on today's config.

## Hypothesis (frozen before implementation)
> Given `findUnpinnedNpxInvocations`'s trigger set (`npx`, `npm exec`) applied to a `controlPlaneProbes`/`evaluatorEntrypoints` command string that instead uses `pnpm dlx <pkg>`, `yarn dlx <pkg>`, or `bunx <pkg>` with no exact-semver pin, the invocation is not detected, despite carrying the identical unpinned-resolution risk. Adding `pnpm dlx`/`yarn dlx`/`bunx` as additional single-package triggers into the same extraction/pinning pipeline should close this gap with zero regression across the 24 pre-existing tests, and zero change in behavior for any command not using one of the new trigger tokens.

Not modified after evaluation began.

## Candidate
`packages/compile/src/supplychain.ts` (+32/−6): new `matchTrigger(tokens, i)` helper unifying `npx`/`bunx` (1-token), `npm exec`/`pnpm dlx`/`yarn dlx` (2-token) trigger recognition, reusing the existing, unmodified `extractPackageSpecs`/`isUnpinned`/`isLocalOrRemoteSpec`. `packages/compile/src/supplychain.test.ts` (+60/−0... net, after the post-critique revision below): 10 new passing tests + 1 `describe.skip` block (3 tests) documenting a confirmed-but-unfixed gap (see Reward-Hack Check). One conceptual change (widen the trigger set); 92 changed lines total across 2 files.

## Evaluation Receipt
Real evaluator: `npm test` (`vitest run && npm run test:governance`), this repo's own `bench` entrypoint. Baseline vs. candidate, identical commands, same checkout.

| | Baseline (`main@9ebc9b6`) | Candidate |
|---|---|---|
| vitest | 755 | 765 passed + 3 skipped (768 total) |
| governance | 150 | 150 (unchanged) |
| Total (executed) | 905 | 915 |
| `npm run typecheck` | clean | clean |
| `npm run lint` | clean | clean |
| `npm run build` (8 packages) | clean | clean |

Live pre/post-fix proof (see Deep Dive for pre-fix repro):
```
$ node -e "...post-fix..."
bunx unpinned (post-fix): [{"source":"controlPlaneProbes[0]","command":"bunx @metaharness/darwin evolve","packageSpec":"@metaharness/darwin"}]
pnpm dlx unpinned (post-fix): [{"source":"controlPlaneProbes[0]","command":"pnpm dlx @metaharness/darwin evolve","packageSpec":"@metaharness/darwin"}]
yarn dlx unpinned (post-fix): [{"source":"controlPlaneProbes[0]","command":"yarn dlx @metaharness/darwin evolve","packageSpec":"@metaharness/darwin"}]
pnpm install (should NOT flag): []
```
No false positive on `pnpm install`/`yarn add` (no `dlx` token) or local-file invocations.

## Baseline
Parent commit `9ebc9b66cfdd7f5d9f11ffafa5675239c58a456c` (`main`), rebuilt clean, 905/905 tests green, lint/typecheck clean.

## Darwin Lineage
`DARWIN=declined`. `rm -rf .metaharness && npx --yes @metaharness/darwin evolve . --sandbox mock` was blocked by this session's own execution sandbox policy (denied as "Code from External" — an unpinned, registry-resolved package). This is independent, real-world corroborating evidence for tonight's own finding: a live control refused to execute exactly the unpinned-ad-hoc-execution pattern this report is about. Consistent with PR `#100`'s prior-night precedent of declining to invoke the `darwin` entrypoint for the same reason (would contradict the candidate's own reasoning) — also, as in that precedent, a single trigger-matching helper function has no meaningful mutable population for bounded generation×children search (ADR-0002).

## Evidence
- OBSERVATION (grade A, first-hand code read + live `node -e` repro at baseline `9ebc9b6`): `bunx`/`pnpm dlx`/`yarn dlx` unpinned invocations of `@metaharness/darwin` all return `[]` (undetected).
- OBSERVATION (grade A, official docs: pnpm `dlx`, Yarn Berry `dlx`, Bun `bunx` — cross-checked live by an independent critic subagent via direct fetch, not just implementer's claim): all three resolve an unpinned package from the registry at invocation time, same threat class as `npx`.
- MEASUREMENT: 905 → 915 executed tests (10 new passing + 3 documenting-gap skips), 0 regressions; lint/typecheck/build clean.
- MEASUREMENT (post-fix live repro): all three previously-blind triggers now correctly flagged; no false positive introduced on `install`/`add`/local-file paths.
- INFERENCE (independent adversarial critic subagent, separate context, full repo read access): verdict **NOT CLEAR** — confirmed the core claim correct, confirmed the new tests are not tautological (reverted the fix, watched exactly the 4 new positive tests fail, restored byte-for-byte), confirmed no false positive on the probe set it was given — but found two real issues (see Reward-Hack Check).
- DECISION: ship the trigger-set widening (net-positive, closes 3 real previously-100%-blind gaps for the common single-package case) but do **not** claim ACCEPT — `critic_clear` fails the promotion gate.
- REJECTION: declined to attempt a general flag-tolerant trigger-matching fix for Finding A tonight (see Reward-Hack Check) — scoped out as a distinct, larger piece of work rather than bolted on under time pressure; declined to repeat a 4th round of `npx`/`npm exec`-only hardening (already ≥3x per STEP 1.1) since tonight's direction is genuinely new (alternate tools), not a duplicate.

## Reward-Hack Check
Independent adversarial-critic subagent (separate context, full repo read access, ran real commands against the live working tree, not just static reading): **NOT CLEAR**. Findings, both independently re-verified by this session (not merely trusted):

1. **Real unresolved detection bypass** (confirmed live): a global CLI flag placed *before* the subcommand defeats the exact-adjacent-token trigger match — `yarn --cwd . dlx cowsay hi` → `[]`, `pnpm --silent dlx cowsay hi` → `[]`. This pattern **pre-dates tonight's diff**: `npm --loglevel=silent exec cowsay` → `[]` on `main` before this change too. Tonight's candidate extends the same weak `tokens[i+1] === trigger` design to the two new triggers without adding tolerance for it. Not fixed tonight (see Candidate/comment); disclosed in-code, and as a `describe.skip` block of 3 failing-if-enabled tests (`packages/compile/src/supplychain.test.ts`) rather than silently omitted, so the gap is provable and trivially re-checkable by a future night.
2. **Corrected a factually wrong code comment**: the first draft claimed Yarn's `dlx` multi-package form was a comma-separated list (`yarn dlx a,b cmd`) and that it was an unhandled non-goal. The critic fetched Yarn's actual CLI docs and found the real syntax is repeated `-p`/`--package` flags (`yarn dlx -p a -p b cmd`), which the pre-existing shared `extractPackageSpecs` **already handles correctly** — verified live: `findUnpinnedNpxInvocations(['yarn dlx -p typescript -p ts-node@1.2.3 ts-node'], {})` → flags `typescript` only, correctly, not `ts-node`. The comment was corrected and a passing regression test added for the real syntax.
3. **Minor, disclosed, not blocking**: `npm exec -- pnpm dlx cowsay` produces a spurious extra finding (`pnpm` itself, from the `--` end-of-options marker) alongside the correct `cowsay` finding — a pre-existing `extractPackageSpecs` quirk (over-reports, does not under-report), not introduced or worsened by tonight's diff, not fixed tonight.

No benchmark/gold data touched, no cherry-picked assertions, no evaluator exploit, no hidden cost, no undocumented cache, no threshold changed. The critic explicitly checked for test tautology (reverted the fix, confirmed exactly the 4 new positive tests fail, restored the file byte-for-byte) — **passed**, not vacuous.

## Security Review
No credential, network, or trust-boundary surface added — pure string/array scanning, no I/O. The widened trigger set is a strict superset of detection surface for the common case; nothing previously flagged becomes unflagged. Finding A (global-flag bypass) is a false-negative gap in a detector, not an exploitable vulnerability introduced by this diff — worst case, an operator's `dream.config.json` command using an atypical flag order goes unflagged, same residual risk class as before tonight for `npm exec`. `OPENROUTER_API_KEY` present; correctly unused (no LLM-calling code touched).

## Regression Analysis
0 pre-existing tests modified or removed. All 905 baseline tests pass unchanged; 10 new passing vitest tests added, 3 new skipped tests added (deliberately, to document Finding A without failing CI on a known, disclosed gap). `npm run lint`/`npm run typecheck`/`npm run build` clean.

## ADR
None — a detector trigger-set extension, not a new architectural decision, schema, or promotion-policy change. Matches the precedent of every prior single-file `security-adversarial`/`compiler-parity` fix on this ledger (e.g. `#100`, `#127`).

## Gist
`GIST=LOCAL` — no `gh` CLI or gist-creation MCP tool available this session. Full report committed at `docs/dream-cycle/2026-09-28-security-adversarial-report.md`.

## Issue
(filled after creation — see PR body)

## Witness

```
report_sha256 : 32965ae10579d8dc088a71724ea65e858ba591caffde4c5930137a340c554961
session_commit: 9ebc9b66cfdd7f5d9f11ffafa5675239c58a456c
witness       : 6c359b44165820db9ed3fecc24cca8d77bf167f88ac32459936b42d93db1c43f
```

Computed over this file's canonical bytes (everything above this heading,
trailing whitespace collapsed to one newline) — reproducible from the
committed file with no unavailable intermediate bytes. Verify:

```bash
dream-machine witness verify-report docs/dream-cycle/2026-09-28-security-adversarial-report.md --commit 9ebc9b66cfdd7f5d9f11ffafa5675239c58a456c
```

## Recommendation
`evaluated: yes` / `verdict: REJECT` — not because the core finding is wrong (3 real, previously-100%-blind detection gaps for `bunx`/`pnpm dlx`/`yarn dlx` are genuinely closed for the common case, confirmed by an independent critic and by direct doc cross-checks), but because that same independent critic found a concrete, reproducible, unresolved detection bypass (Finding A) in the code as shipped, which fails the `critic_clear` promotion-gate condition. Concretely, for a human reviewer:
1. The PR is still worth merging on its own terms — it strictly increases coverage for the common case and fixes a real, if narrow, blind spot, with 0 regressions.
2. Finding A (global-flag-before-subcommand bypass, also affecting the pre-existing `npm exec` trigger) is a distinct, real, disclosed follow-up — tracked via the `describe.skip` block in `supplychain.test.ts` and this report, not via a new issue tonight (kept minimal per `duplicateDirections` discipline; a future `security-adversarial` night can flip the `.skip` to `it` once it lands a flag-aware fix).
3. Issue `#99` (2026-09-08 automerge-guard finding) has a merged fix (`PR #100`, merged 2026-09-26) but the issue itself is still open on GitHub — a one-click human housekeeping item, unrelated to and not fixed by tonight's candidate.
