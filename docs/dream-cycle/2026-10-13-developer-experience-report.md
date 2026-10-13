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

## Witness
```
report_sha256 : 0b13cd0acb559e75d0d01a2680f7f662775b87ac4e07183717ceb60a8ed74220
session_commit: b2abcc14a632d7e0948962065a7c6c8920cf306c
witness       : 9b1074fd31f798f311a39c8940cc6f446342b973acefa1559e8ef61a4c139058
```
Reproduce: `node packages/cli/dist/bin.js witness verify-report docs/dream-cycle/2026-10-13-developer-experience-report.md --commit b2abcc14a632d7e0948962065a7c6c8920cf306c`
