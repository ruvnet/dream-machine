# Compiler-Parity SOTA Report — 2026

## TL;DR

Tonight's rotation (slot 0, `DAYINT 20260920 % 5 = 0`): `DEEP=compiler-parity`,
`SCAN=config-schema,golden-snapshots`. No bonus deep-dive (`20260920 % 25 =
20`, `% 75 = 45`, neither 0).

`validateConfig()` in `@dream-machine/compile` defaults `ledgerPath` and
`branchPrefix` only via `config.ledgerPath ?? 'docs/dream-cycle/LEDGER.md'`
(and the equivalent for `branchPrefix`). `??` only substitutes on
`null`/`undefined` — an explicit empty string `""` is neither, so it survives
`withDefaults()` untouched and gets string-interpolated directly into the
compiled prompt. Reproduced live tonight: `ledgerPath: ''` compiles cleanly
and emits `` recorded as `HALT: budget` in ``. `` and `` Read ``. If missing,
create it with: `` (dangling empty backticks in two STEP sections);
`branchPrefix: ''` compiles cleanly and emits `` Branch `<DATE>-<surface>` ``
— the branch-prefix segment silently vanishes rather than erroring. This is
the same defect class as three already-merged compiler-parity fixes on this
repo (cron minute field #24, `adrConvention` shape #29, `bonusModuli` values
#79) and was explicitly named as an unfixed next step in PR #111's own
"Scan Findings" section (2026-09-15, still open): *"`ledgerPath`/
`branchPrefix` are `string`-typed but only checked for presence via `??`, so
an empty string silently survives into a broken compiled path."*

**Ledger check performed:** `docs/dream-cycle/LEDGER.md` on `main` holds 39
rows (last dated row 2026-09-07); `dream-machine ledger signals --merged
<44 real merged PR numbers, fetched live via search_pull_requests>` reports
`zeroMergeStreak=false` (44 PRs have genuinely merged into `main` since
2026-08-13 — the multi-night `zeroMergeStreak=true` narrative from earlier
nights is now stale) but `ledgerStale=true`, `daysSinceLastRow=13`. That
staleness is real (≥10 PRs merged since the last ledger row landed) but is a
`ledger-signals`-surface finding, out of scope for tonight's `compiler-parity`
slot — flagged, not fixed, below.

**Duplicate-direction check (critical, done before writing any code):**
fetched all open PRs (`list_pull_requests`/`search_pull_requests`, `gh`
unavailable this session — GitHub MCP tools used instead, not a `FALLBACK`
night for GitHub state) and read #105 and #111 in full (`pull_request_read`
`get_diff`), the two other open `compiler-parity`/`config-schema` PRs:
- #105 (2026-09-10, open draft): fixes blank/whitespace `slots[].deep` and
  `slots[].scan[]` entries, plus non-array `scan`. Does not touch
  `ledgerPath`/`branchPrefix`.
- #111 (2026-09-15, open draft): fixes bare-string-instead-of-array
  `labels`/`competitors`/`extraDisciplines`/`controlPlaneProbes`. Does not
  touch `ledgerPath`/`branchPrefix` — its own report explicitly named that
  gap as next-step 2, unclaimed by any other open PR or issue (confirmed via
  `search_issues` for `ledgerPath OR branchPrefix OR buildStep`: only
  returns issues #104/#110, the parents of #105/#111, which merely *mention*
  the gap, not fix it).

Tonight's candidate is scoped to exactly that unclaimed gap, avoiding any
overlap with #105 or #111.

## What's new

- `packages/compile/src/config.ts`, `validateConfig()`: two new checks,
  structurally identical to the existing `adrConvention.dir` check three
  lines above them —
  `config.ledgerPath !== undefined && (typeof config.ledgerPath !== 'string'
  || config.ledgerPath.trim().length === 0)` → `ledgerPath must be a
  non-empty string`, and the same shape for `branchPrefix`. `!== undefined`
  preserves optionality: an omitted field still validates `ok:true` and
  `withDefaults()` still applies its default.
- `packages/compile/src/index.test.ts`: 10 new tests (`it.each` over both
  fields) — rejects empty, rejects whitespace-only, accepts absent (default
  applies), accepts well-formed; plus 2 `compile()`-level tests asserting it
  *throws* a clean `invalid dream.config: - ledgerPath/branchPrefix must be
  a non-empty string` error instead of silently compiling broken output.
- No snapshot touched: this repo's own `dream.config.json` sets both fields
  to well-formed non-empty strings (`docs/dream-cycle/LEDGER.md`, `dream/`),
  so the golden snapshot and the self-hosted compile output are unaffected.

## Competitors (structured-config default-vs-explicit-empty handling)

| System | How it distinguishes "absent" from "explicitly empty" for a defaulted field | Grade |
|---|---|---|
| Terraform | `variable` blocks with `default` only apply when the key is entirely absent from input; an explicit `""` is a distinct, separately validatable value (`validation` blocks can reject it) | B (public docs) |
| Kubernetes API server | Defaulting webhooks/OpenAPI defaults apply on absence; an explicit empty string in a required-nonempty field (e.g. `metadata.name`) is rejected by admission validation, not silently accepted | B (public docs) |
| Zod (TS ecosystem) | `z.string().min(1).optional()` — the idiomatic construction for exactly this shape: optional (undefined OK) but, if present, must be non-empty; this repo's hand-rolled `?? default` pattern was one check short of the same guarantee | B |
| This repo's own PR #111 (2026-09-15) | Named this exact gap (`ledgerPath`/`branchPrefix`) as an explicit, unimplemented next step in its own report, after fixing the adjacent `string[]`-typed fields | A (first-hand, this repo's own history) |

## Hypothesis (frozen before implementation)

> Given a `dream.config.json` with an explicit empty-string or
> whitespace-only `ledgerPath` or `branchPrefix`, when `validateConfig()` is
> extended to reject such values (mirroring the existing `adrConvention.dir`
> check), then `dream-machine compile` should report a structured
> `ValidationResult` error instead of silently compiling a corrupted ledger
> reference (`` in `` ``) or a branch name silently missing its prefix,
> subject to: an *omitted* `ledgerPath`/`branchPrefix` remains valid and
> still receives its default via `withDefaults()`; zero change to the
> compiled output of this repo's own `dream.config.json` (both fields
> already well-formed); zero regressions in the existing 645 vitest + 140
> governance tests.

## Benchmarks / Evaluation Receipt

Real evaluator: `npm test` (`vitest run && npm run test:governance`), this
repo's own `bench` entrypoint.

- Baseline (parent, session-start commit `aa931ca`): `npx vitest run` → 645
  passed; `npm run test:governance` → 140 passed. Total 785/785.
- Candidate (same commit + this diff): `npx vitest run` → 655 passed (+10,
  matching the 10 new tests exactly); governance unchanged at 140. Total
  795/795, 0 regressions, 0 modified/removed assertions
  (`git diff --numstat`: `config.ts` +6/-0, `index.test.ts` +24/-0 —
  purely additive).
- `npm run typecheck` and `npm run lint`: both clean on the candidate.
- Live pre/post-fix bug reproduction (against the built `packages/compile/
  dist/index.js`):
  ```
  # pre-fix
  validateConfig({...base, ledgerPath: ''})   -> {"ok":true,...}
  compile({...base, ledgerPath: ''})          -> no throw; output contains
    "recorded as `HALT: budget` in ``." and "Read ``. If missing, create it with:"
  validateConfig({...base, branchPrefix: ''}) -> {"ok":true,...}
  compile({...base, branchPrefix: ''})        -> no throw; output contains
    "Branch `<DATE>-<surface>`" (prefix silently dropped)

  # post-fix
  validateConfig({...base, ledgerPath: ''})   -> {"ok":false,"errors":["ledgerPath must be a non-empty string"]}
  compile({...base, ledgerPath: ''})          -> throws "invalid dream.config: ..."
  validateConfig({...base, branchPrefix: '   '}) -> {"ok":false,"errors":["branchPrefix must be a non-empty string"]}
  compile({...base, branchPrefix: '   '})     -> throws "invalid dream.config: ..."
  ```
- Self-hosting closure check: `node packages/cli/dist/bin.js compile
  dream.config.json --out /tmp/tonight-prompt-candidate.md`, diffed
  byte-for-byte against the pre-fix compile of the same file (both
  14258 bytes) — **byte-identical** (expected: this repo's real config's
  `ledgerPath`/`branchPrefix` are already well-formed non-empty strings).

Evidence grade: A (first-party, reproducible in this repo, no external
claim). `LLM_EVAL=not-needed` — `OPENROUTER_API_KEY` is present in this
session's environment but this candidate is a deterministic
unit-testable validation fix with no model-calling evaluation stage.

## Darwin Results

`DARWIN=not-applicable`. `npx @metaharness/darwin evolve --sandbox mock` was
not invoked: this candidate is a single validation-format fix with no
numeric objective and no evolvable population, matching the precedent set
by every prior compiler-parity night of the same shape (#29, #79, #105,
#111). It is also this repo's own compiled prompt's stated position that
this entrypoint is unpinned (`npx` resolves registry `latest` fresh every
run) and any result from it should be treated as evidence about "whatever
is latest right now," not a reproducible receipt — an added reason not to
invoke it for a candidate this narrow.

## Evidence

- OBSERVATION: `grep -n 'ledgerPath\|branchPrefix' packages/compile/src/
  config.ts` (pre-fix) shows both fields used only via `withDefaults()`'s
  `??` fallback, never checked in `validateConfig()`.
- OBSERVATION: live pre-fix repro (above) confirms `??`'s null/undefined-only
  semantics let an explicit `""` survive into the compiled prompt as broken
  output, not merely a theoretical TypeScript-bypass concern.
- OBSERVATION: read PRs #105 and #111 in full via `pull_request_read
  get_diff`; #111's own "Scan Findings" section names this exact gap as an
  unclaimed next step. `search_issues` confirms no open issue targets it
  directly.
- MEASUREMENT: `npm test` 785 → 795 (+10), 0 regressions (captured above,
  independently re-verified by a critic subagent via the stash/rebuild/
  reproduce cycle, see Reward-Hack Check).
- INFERENCE (independent critic, fresh subagent, no shared context):
  confirmed both bugs are real pre-fix and fixed post-fix by stashing the
  diff, rebuilding, and reproducing live; confirmed 6 of the 10 new tests
  fail against the pre-fix code (`46 passed, 6 failed` when only the test
  hunk is applied without the `config.ts` hunk) and all pass post-fix.
- DECISION: land the two checks as additive branches after the existing
  `adrConvention` block, mirroring its exact structural shape.

## Reward-Hack Check

Independent critic (fresh subagent, no shared authoring context, given only
`git diff` + full repo read access) checked and returned **CLEAR**:
(a) weakened benchmark/tests — none, diff is purely additive per
`git diff --numstat` (config.ts +6/-0, index.test.ts +24/-0); (b) altered
gold answers/snapshots — none, no snapshot file touched, self-hosted
compile output confirmed byte-identical before/after; (c) cherry-picking/
tautological tests — checked by applying only the test hunk against pre-fix
`config.ts` and confirming 6 of the 10 new assertions fail (the other 4 —
"leaves optional"/"accepts well-formed" — correctly pass unconditionally,
since they test the *absence* of a false-positive rather than the fix
itself); (d) evaluator exploitation — no vitest config, mock, `.only`/
`.skip`, or timeout touched (`grep` for those patterns in the diff:
empty); (e) hidden cost/scope creep — diff is exactly the stated 30 lines
across exactly the two stated files, deliberately excluding the
structurally-adjacent-but-owned-by-#105/#111 fields; (f) fix correctness —
the `typeof`/`trim().length === 0` check handles a non-string value smuggled
via raw `JSON.parse` (number, array) the same way `adrConvention.dir`'s
existing check does, and correctly leaves an omitted field valid so
`withDefaults()`'s `??` still applies its default (verified via the "leaves
%s optional" tests); (g) security — none, pure function over an in-memory
object, no new I/O.

## Security Review

No security-sensitive surface touched: no prompt-injection vector changed
(the interpolation target is nightly-prompt prose, and after this fix a
malformed value can no longer reach it at all — the change strictly
*narrows* the space of configs that compile successfully), no tool/MCP
authority granted or removed, no credential path touched, no filesystem/
network scope changed (pure in-memory validation, no new I/O), no
agent-impersonation surface, no benchmark/memory-poisoning vector. This
session's environment carries `OPENROUTER_API_KEY` and a GitHub token;
neither was required or used beyond read-only GitHub queries (search/read
PRs and issues, no write) and `mcp__github__get_me` to confirm identity —
no credential was logged, echoed, or included in any committed artifact
(spot-checked: `git diff` and this report contain no token/key material).
Least-privilege posture unaffected.

## Scan Findings

**config-schema** — Beyond tonight's fix, `evaluatorEntrypoints` values
(`bench`/`flywheel`/`darwin`/`redblue`) remain unchecked for non-empty-string
shape, though `step6to9Candidate()`'s `.filter(([, val]) => val)` already
drops falsy (`''`/`undefined`) entries rather than compiling them — lower
severity than `ledgerPath`/`branchPrefix` since it degrades gracefully
(entry silently omitted) rather than corrupting a rendered line. A more
severe, newly-confirmed gap tonight: `buildStep.cmd` is completely
unvalidated, and `step05Build()` interpolates it directly into an *executed*
bash code block (not just descriptive prose). Live repro: `buildStep: {
cmd: undefined, degradeOnWasmFailure: true }` (reachable via a hand-edited
`dream.config.json` missing the `cmd` key, which bypasses the TS type at
runtime the same way every prior fix in this lineage was reachable) compiles
a fenced ```` ```bash\nundefined\n``` ```` block — a future night's STEP 0.5
would literally attempt to run the shell command `undefined`. Not fixed
tonight (`buildStep` is a nested-object field, a different shape than the
flat-string pattern this candidate and #111 share; it deserves its own
frozen hypothesis rather than being folded in opportunistically) — logged
below as the top next-step.

**golden-snapshots** — `packages/compile/src/index.test.ts` carries
golden-snapshot tests for both the `metaharness` fixture and this repo's own
real `dream.config.json`; both green tonight, and the self-hosted output is
confirmed byte-identical to the pre-candidate compile that produced this
very session's own `/tmp/tonight-prompt.md`. No drift.

## Witness

```
report_sha256 : 3e23ed5132972c17b1a8f0b054059b23ce92f2435c7ebe8d3d3e6eb9fdccfdbc
session_commit: aa931caad5dd0108253645bba0ab1481ad7da0ee
witness       : 4c8334e676772717ff9060fbb68e85a75d68b29b1d24de9b26a1b13125399ad1
```

Computed via `dream-machine witness stamp <report> aa931caad5dd0108253645bba0ab1481ad7da0ee`
over this file's frozen bytes *before* this Witness section existed (STEP
16's hash-then-rewrite order — same convention as PRs #7, #11, #55, and
every subsequent compiler-parity night). Verify (coreutils only, no gist
tooling required — report is committed at this path):

```bash
REPORT_HASH=$(sha256sum docs/dream-cycle/2026-09-20-compiler-parity-report.md | awk '{print $1}')
printf '%s%s' "$REPORT_HASH" "aa931caad5dd0108253645bba0ab1481ad7da0ee" | sha256sum | awk '{print $1}'
# ^ will NOT equal the witness above verbatim, since sha256sum now runs over
# the file WITH this section filled in. This is the documented limitation of
# self-referential witnessing (ADR-0001): the authoritative report_sha256 is
# the value computed and printed above at STEP 16 time, not re-derivable
# from the final committed file. Cross-check instead via
# `dream-machine witness verify` against the pre-Witness content, or trust
# the recorded triple as the audit trail. (Open PR #111 proposes a
# canonical-exclusion fix for this exact limitation; not yet on `main`.)
```

`GIST=LOCAL` — no `gh` binary and no gist-creation MCP tool in this session
(`which gh` → not found; `ToolSearch "gist create"` → none). Per the
best-effort gist-publication precedent (2026-08-13, and every compiler-parity
night since), this is not a FALLBACK/stop condition: this report is
committed into the PR as the durable artifact instead.

## Recommendation

Human review of the draft PR. `EVALUATED=yes`, `VERDICT=ACCEPT` (candidate is
a real, reproduced fix to a real silent-corruption gap explicitly named as
an unclaimed next step by PR #111's own report; positive effect on compiled-
prompt correctness for malformed config; 785→795 tests, zero regressions,
zero snapshot drift; independent critic returned CLEAR on reward-hacking and
security; scope explicitly checked against both other open compiler-parity
PRs to avoid duplication). Next steps explicitly NOT done tonight (named,
not silently dropped):

1. `buildStep.cmd` is completely unvalidated and interpolates directly into
   an *executed* bash block — an undefined/missing value compiles the
   literal command `undefined`, worse in kind than the prose-only gaps
   fixed by #29/#79/#105/#111/tonight since it corrupts something actually
   run, not just displayed. Newly confirmed live tonight; this repo's
   single highest-severity open compiler-parity gap.
2. `evaluatorEntrypoints.*` values remain unchecked for non-empty-string
   shape (lower severity — already filtered from output when falsy, so the
   failure mode is a silently-omitted entrypoint line rather than a
   corrupted one).
3. `docs/dream-cycle/LEDGER.md` is stale on `main` (`ledgerStale=true`,
   `daysSinceLastRow=13`, confirmed via `dream-machine ledger signals`
   with the real 44-PR merged list) despite ≥10 PRs merging since the last
   row — a `ledger-signals`-surface finding, carried forward for that
   slot's next rotation (not `compiler-parity`, out of scope tonight).
