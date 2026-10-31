# CLI Developer-Experience SOTA Report — 2026

## TL;DR
`packages/cli/src/index.ts`'s `freshness stamp --max-age` flag computed `Number(maxAgeRaw)` directly on a value that can be the parser's sentinel boolean `true` (a value-less flag). `Number(true) === 1`, a valid positive safe integer, so a bare `--max-age` silently froze the evidence-freshness promotion-gate policy at the strictest possible bound (`maxAgeDays: 1`) instead of raising the usage error every sibling numeric flag in the same file (`--open-count`, `--since-row`) already gives. Fixed with a `parseMaxAgeDays()` helper mirroring the existing precedent exactly, plus an upper-bound check (found by an independent critic) that unifies all out-of-range rejections at a single CLI-level exit code instead of letting large values leak one layer deeper into the witness library's own, differently-shaped error.

## What's New
This is the fourth night in a row's worth of "value-less flag silently coerces to a truthy/numeric sentinel" bug class found in this exact file (`packages/cli/src/index.ts`), but a genuinely new instance: issue #160/PR #161 (2026-10-09, open, unreviewed) hardened nine `(flags.X as string) || fallback` *string*-flag call sites; this finding is a distinct code shape — a numeric flag computed via `Number(flag)` directly, where `Number(true) === 1` passes as a "valid" value rather than needing a truthy-string fallback at all. Read #161's full diff before starting; confirmed `--max-age` (line ~657 pre-fix) is not among its nine sites and remains unconverted on current `main`.

## Competitors
| Project | Relevant practice | Grade |
|---|---|---|
| Commander.js | option requiring a value throws `error: option '--x <value>' argument missing` at parse time — never silently truthy | A (official docs) |
| clap (Rust) | `value_parser!` rejects a flag with no value for any typed option; same fail-closed default | A (official docs) |
| yargs | `.number('max-age')` coerces a missing value to `NaN`... which is *also* a footgun (fails differently, not better) — not a counterexample, a corroborating case | A (official docs, independently verified) |
| This repo's own precedent | `parseMergedPrNumbers`/`parseOpenCandidateCount`/`parseSinceRow`/`parseLegacyDigest` (same file, PR #109/#111-era) already ship exactly this fail-closed shape for four other flags | — (first-party, not external) |

No external research was needed beyond confirming the general pattern (grade A, official docs for Commander/clap) — the defect and its fix are both first-party, matching an established in-repo precedent.

## Hypothesis (frozen before implementation)
Given `dream-machine freshness stamp` invoked with `--max-age` as a value-less flag (nothing after it, or another `--flag` immediately after, so `parseArgs` yields the boolean `true`) or with an out-of-range numeric string, the current code either (a) silently accepts `maxAgeDays: 1` (the `true` case) or (b) accepts any value `Number()` can parse and defers range checking to `@dream-machine/witness`'s `normalizedMaxAgeDays`, producing a different exit code (2) and message shape than this file's own sibling flags (1). Replacing the inline `Number(maxAgeRaw)` with a `parseMaxAgeDays()` helper — same fail-closed shape as `parseOpenCandidateCount`/`parseSinceRow`, bounds mirroring `MAX_EVIDENCE_AGE_DAYS` from `@dream-machine/witness` — should reject both cases at the CLI layer with one consistent usage error and exit code, with zero behavior change for any valid numeric `--max-age`.

## Evaluation Receipt
Real evaluator: `npm test` (`vitest run && npm run test:governance`), measured live by stashing the candidate diff for the baseline run and restoring it for the candidate run — not inferred from logs.

| | vitest | governance | typecheck | lint |
|---|---|---|---|---|
| Baseline (`main@b2abcc1`) | 809 passed | 195 passed | clean | clean |
| Candidate | 812 passed (+3 new, 0 regressions) | 195 passed (unchanged) | clean | clean |

Live pre/post-fix repro (exact commands, run against the real built CLI):
```
# BASELINE (pre-fix)
$ node packages/cli/dist/bin.js freshness stamp --base deadbeef --paths package.json --max-age
{ ... "maxAgeDays": 1 ... }   # silently the strictest possible policy, exit 0

# CANDIDATE (post-fix)
$ node packages/cli/dist/bin.js freshness stamp --base deadbeef --paths package.json --max-age
error: --max-age expects an integer in [1, 3650] days, e.g. --max-age 14   # exit 1

$ node packages/cli/dist/bin.js freshness stamp --base deadbeef --paths package.json --max-age 14
{ ... "maxAgeDays": 14 ... }   # exit 0, unchanged for valid input

$ node packages/cli/dist/bin.js freshness stamp --base deadbeef --paths package.json --max-age 9999999
error: --max-age expects an integer in [1, 3650] days, e.g. --max-age 14   # exit 1 (was exit 2, library-level, before the critic-found follow-up)
```
Diff: `packages/cli/src/index.ts` (+16/-2: one new `parseMaxAgeDays` helper + a 3-line call-site swap + one new import) and `packages/cli/src/index.test.ts` (+34, three new tests). 62 lines total, well under the 300-line target, one conceptual change.

## Darwin Lineage
`DARWIN=not-applicable` — a single validation-shape fix to one CLI flag has no evolvable population or fitness landscape to search (same judgment this repo's ledger already recorded for #103/#122/#141/#160's own class of fix). Confirmed the entrypoint itself is still live: `npx --yes @metaharness/darwin --version` resolved and printed real usage output tonight (unlike several prior nights where the session's own sandbox policy denied the invocation outright) — recorded as a control-plane liveness check only, not evidence for or against this candidate.

## Evidence
OBSERVATION (grep for the other hardened `parse*` helpers in the same file; `--max-age` not among them) → OBSERVATION (live repro, pre-fix: bare `--max-age` → `maxAgeDays: 1`, exit 0) → HYPOTHESIS (frozen, above) → MEASUREMENT (809/195 baseline → 812/195 candidate, live stash/pop before-after) → MEASUREMENT (live post-fix repro, all three cases) → INFERENCE (independent adversarial critic, separate subagent context) → DECISION (one critic-found non-blocking gap adopted: upper-bound check) → MEASUREMENT (re-run full suite green after the follow-up) → DECISION (ship; verdict ACCEPT).

## Reward-Hack Check
Independent adversarial critic (separate subagent context, no authorship stake, read the actual diff via `/tmp/candidate.diff` plus the full surrounding file and the witness-package validation it mirrors — not a paraphrase): **CLEAR**, with one non-blocking gap, which was adopted and fixed before shipping (see Evidence above). Critic confirmed: the fix closes the hole for the boolean-`true` case and for whitespace/leading-zero/`+`/scientific-notation numeric strings (all sane, matching the file's existing permissive-`Number()` convention, not a new footgun); no existing test assertion, fixture, golden value, or threshold was touched; the "valid --max-age" test is not tautological (drives the real `run()` → `parseArgs` → `parseMaxAgeDays` → `evidenceFreshnessPolicyDigest` → `io.writeFile` path, asserted against the written JSON); no regression for any previously-valid numeric input. Full re-run after adopting the follow-up: `npx vitest run packages/cli/src/index.test.ts` → 104/104 passed.

## Security Review
Pure in-memory CLI argument validation — no new I/O, network, filesystem, or credential surface. The change can only newly *reject* input that previously succeeded silently; it can never newly *accept* something previously rejected (strictly more restrictive). The validated field (`maxAgeDays`) gates `@dream-machine/witness`'s evidence-freshness promotion check — a silently-accepted `maxAgeDays: 1` would have made that gate spuriously stricter (never a bypass), but still masked an operator mistake instead of surfacing it, which is the actual harm this closes. No prompt-injection, MCP-authority, or cross-agent surface touched.

## Scan Findings
**cli**: this report's whole subject. Confirmed via direct `grep` that no other call site in `index.ts` performs a bare `Number(flags.X)` on a potentially-boolean flag value outside the four already-hardened helpers and this one — the class is now fully closed in this file (pending #161's broader string-flag fix landing separately).
**tui**: no tui.ts code touched tonight; read in full as part of SLOT=4's scan and found no new defect beyond the two already disclosed in issue #160 (`tui --repo` renders the literal word "true", and `verify-entrypoint --cmd`'s requiredness check bypass) — not re-filed, not fixed, left exactly as #160 disclosed them to avoid competing with that open PR.

## Rotation Note
Tonight's slot (`DAYINT % 5` = 3) maps to `DEEP=security-adversarial, SCAN=redblue,supply-chain`. That surface's single detector (`packages/compile/src/supplychain.ts`'s `findUnpinnedNpxInvocations`) has now been the subject of narrow bypass-widening findings across at least four prior nights (#68 floating-tag, #99 automerge-guard-adjacent, #138 pnpm dlx/yarn dlx/bunx, #149 shallow-clone oracle, #157 npm-global-flag bypass) — none of those five PRs are merged. Per STEP 1.1's learning signal ("a finding repeated in ≥3 prior nights → rotate to the next slot's DEEP surface"), this session rotated to slot 4 (`DEEP=developer-experience, SCAN=cli,tui`) rather than add a sixth narrow variant to an already-saturated, unreviewed surface. `ledger signals` doesn't automatically see this pattern (`duplicateDirections` only scans merged rows on `main`, and none of these five PRs landed there) — this rotation decision was made by reading the open-issue history directly, not the tool's own output.

## Ledger Check
Last row: 2026-10-12 (evaluation-adapters, PR #177, ACCEPT, **confirmed merged** 2026-10-12T15:45:01Z — ground-truthed via `pull_request_read`, `merged: true`). `ledger signals --path docs/dream-cycle/LEDGER.md` (no flags) reports `zeroMergeStreak=true` — the CLI's unverified worst-case default; ground-truthed false: PR #177 merged yesterday. Re-run with `--merged "177,167,165,143,132,129,127,122,121,120,116,114,111,109,105,103,100" --open-count 11`: `zeroMergeStreak=false`, `ledgerStale=false` (daysSinceLastRow=1), `reviewBacklogSize=11`. The 11 open, unmerged `dream/*` candidate PRs (#137,#139,#141,#145,#148,#150,#152,#154,#156,#158,#161) — excluding #98/#101, which `#160` already classified as a separate docs/portfolio program, not dream-cycle candidates — are a severe review backlog; checked every one of their titles/bodies for overlap with tonight's candidate before starting (none touch `freshness stamp` or `parseMaxAgeDays`/`MAX_EVIDENCE_AGE_DAYS`).

## Build / Control-Plane
Fresh checkout, `npm ci && npm run build`: clean, no wasm/NAPI degradation (pure-TS workspace, nothing to degrade). `gh auth status`: `GH_TOKEN` invalid this session (`FALLBACK=true` for `gh`-specific operations) — GitHub read/write handled instead via the `mcp__github__*` tool surface, which authenticated successfully (used throughout for issue/PR history). `OPENROUTER_API_KEY` is set (`LLM_EVAL` not blocked tonight), though this candidate needed no model-calling evaluation stage. Repo checkout was shallow by default; `git fetch --unshallow` was required before the full governance suite passed (0 failures after) — this is the already-tracked issue #149/PR #150 shallow-clone class, not re-filed.

## Recommendation
`evaluated: yes` / `verdict: ACCEPT`. All promotion-gate conditions clear: evaluation complete, effect positive (silent-corruption bug closed, consistent exit codes across the whole `maxAgeDays` validation range), no material regression (809→812 vitest, 195 governance unchanged), tests green, reward-hack clear (independent critic, one follow-up adopted), critic clear, witness valid (below, self-contained), receipt reproducible (exact commands given above). Human review requested for merge — this session never self-merges.

## Next Steps
1. Review and merge #161 (broader string-flag class) and this PR — both are small, mechanical, and non-overlapping.
2. Consider a repo-wide lint rule or a shared `numericFlag()`/`stringFlag()` wrapper so new flags can't reintroduce either class by construction, instead of relying on finding each instance by inspection night after night.
3. The `security-adversarial`/`supply-chain` surface (`findUnpinnedNpxInvocations`) needs a human triage pass across its five open PRs before another night adds a sixth variant — the cat-and-mouse detector-widening game has diminishing returns without someone deciding whether to pin/vendor `@metaharness/*` instead (the repo's own code comment already names this as the real fix, deferred to human judgment).

## Consolidation refresh — 2026-10-31

MODE=CONSOLIDATE (STEP 1.5): 21 open `dream/*` candidate PRs tonight, well over `implementationTrack.reviewBacklogLimit=6`. The seven nearer-the-front eligible drafts — #145, #148, #150, #152, #154, #158, #161 — each already carry a `dream-consolidate` marker for today's exact default-branch SHA (`3fc3222`) from seven preceding nights (`main` has not moved since `#196`, landed 2026-10-19). This PR was the oldest still-eligible draft (still draft, ACCEPT in its own Evaluation Receipt, not a `routine-self-review` PR) carrying no prior consolidate marker at all. #139 is REJECT and excluded; #98/#101 are multi-repo portfolio branches, not single-surface dream-cycle candidates; #137/#141/#156 are already out of draft.

**Action.** Merged `main` (`3fc3222d2e5566a203331d3686c4d2eaf06713a8`) into this branch with an ordinary merge commit (`63f51fc`, never rebase, never force-push). Auto-merge was clean — **zero textual conflicts**, including in `docs/dream-cycle/LEDGER.md` and `packages/cli/src/index.ts`/`index.test.ts` (this candidate's only files), despite substantial intervening `main` history on both (the Dream Cycle v2 engine landing in #195/#196, plus PR #167's ledger changes). Confirmed `grep -n parseMaxAgeDays packages/cli/src/index.ts` shows the candidate's helper and its one call site intact post-merge.

**Re-evaluation on the new head.** Real evaluator (`npm test`), measured independently in an isolated `git worktree` on bare `main@3fc3222`: vitest 886/886, governance 195/195. On this branch's merged head: vitest 889/889 (+3, this candidate's own tests, 0 regressions), governance 195/195 unchanged. `npm run typecheck`/`npm run lint`/`npm run build` (8 packages) all clean, no wasm/NAPI degradation. (First `npm test` run on this session's shallow checkout showed the standard 3 pre-existing `BASELINE_COMMIT`-unreachable governance failures — resolved with `git fetch --unshallow`, not a code change; confirmed identical class as issue #149/open PR #150, not duplicated here.)

**Fresh critic + reward-hack pass (this round)**, dispatched as a separate-context subagent with no authorship stake, given only the isolated candidate diff (`packages/cli/src/index.ts` + `index.test.ts` vs `origin/main`) and the live repository: **CLEAR**. It independently built a second worktree at bare `main`, live-reproduced the pre-fix silent-corruption bug (`--max-age` with no value, or immediately followed by another flag, wrote `maxAgeDays: 1`/exit 0) and the pre-fix inconsistent-exit-code bug (an out-of-range value failed one layer deeper in `@dream-machine/witness` at exit 2, a different shape than this file's own usage errors), then confirmed both are closed on the post-fix tree: value-less/adjacent-flag/non-numeric/out-of-range inputs all now reject uniformly at exit 1 with one clear message; `--max-age 1` and `--max-age 3650` (exact boundaries) and `--max-age 14` all still succeed unchanged. It ran `npm test` itself and observed the same counts reported above (889/889 vitest, 195/195 governance). It confirmed via `git diff origin/main...HEAD` that the diff is net-additive to tests (zero existing assertions deleted or weakened) and that the upper bound is imported from `@dream-machine/witness`'s own `MAX_EVIDENCE_AGE_DAYS` constant rather than a hand-duplicated literal, so it cannot drift from the library's own bound. No gold data, threshold, or benchmark corpus touched by the merge or the original diff.

**Darwin.** `DARWIN=blocked` — this session's own sandbox permission classifier denied `npx --yes @metaharness/darwin@0.12.0 --version` outright as "Code from External," before any invocation ran. Not worked around; same precedent as PRs #139/#150/#148's prior rounds. Not required for this verdict (optional, "only if available").

**CI expected on the pushed head.** `guard`, `test` (both Node versions), `dependency-security` (production-scoped `npm audit --omit=dev --audit-level=high`: reproduced locally, 0 vulnerabilities), `no-optional-deps`, `software-evidence`, and CodeQL (`analyze`) expected green (all reproduced equivalently above). **Red, pre-existing, not this PR's:** `dependency-audit` (full dev-inclusive `npm audit --audit-level=high`) — reproduced locally against this exact head's lockfile: `git diff origin/main -- package.json package-lock.json` from this branch is empty (0 lines), so the lockfile is byte-identical to `main`'s. Same pre-existing, already-tracked `vite@8.3.0-8.3.2`/`launch-editor` high-severity advisory (plus assorted moderate ESLint-toolchain advisories) as issue #197 (opened 2026-10-21 against PR #145, still open, no fix PR exists yet to port — a semver-range-breaking `vite`/`eslint` bump is out of scope for this single-function CLI-validation fix). Not re-filing a duplicate issue; not fixing it from this PR.

**Decision.** ACCEPT still holds and the fresh critic is clear, but not every required check on the new head is expected green (`dependency-audit`, for the pre-existing reason above) — per STEP 1.5, this PR **stays draft**. Ledger row appended on this branch: `docs/dream-cycle/LEDGER.md` (2026-10-31); it reaches `main` only if this PR merges, so also stated in issue #179.

No merge, no close, no force-push, no self-promotion, no candidate scope change.

Original-round witness (`main@b2abcc1`, superseded by the refreshed triple below, which covers this entire file including this paragraph): `report_sha256 0b13cd0a…`, `witness 9b1074fd…`.

## Witness
```
report_sha256 : 87301968aa6bb6553abd172f6e0dc42b5706317642d3dc568037f36aafb5906b
session_commit: 63f51fc4e765afd49b534147d7cb67e0dc4566cb
witness       : af25d9001f3d3b0377afdb4c6ef52e24cf0660a16ff856edab1c97773e77e147
```
Reproduce: `node packages/cli/dist/bin.js witness verify-report docs/dream-cycle/2026-10-13-developer-experience-report.md --commit 63f51fc4e765afd49b534147d7cb67e0dc4566cb`
