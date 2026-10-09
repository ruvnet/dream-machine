# Developer-Experience SOTA Report — 2026

## TL;DR

Tonight's rotation (slot 4, `DAYINT 20261009 % 5 = 4`): `DEEP=developer-experience`,
`SCAN=cli,tui`. No bonus deep-dive (`20261009 % 25 = 9`, `% 75 = 59`, neither 0).

`packages/cli/src/index.ts`'s minimal flag parser (`parseArgs`) represents a
value-less flag (`--date` immediately followed by another `--flag`, or at
the end of argv) as the boolean `true`, not a string. Eight call sites in
the same file read an optional string flag with the idiom `(flags.foo as
string) || fallback` — when `flags.foo` is that boolean `true`, `true ||
fallback` evaluates to `true` (truthy), so the sentinel silently survives as
if it were the user's real value. Three live-reproduced, pre-fix failure
modes, all exit 0 (no error at all):

- `ledger append --date` (no value) wrote the literal Markdown cell `| true
  |` into `LEDGER.md` — this repo's own single source of cross-night
  durable memory (see `GLOBAL INVARIANTS` in the compiled nightly prompt).
- `ledger verify --path` / `tui --path` (no value, trailing) silently
  treated the real ledger as "not found," fell back to an empty ledger, and
  reported `✓ ledger OK — 0 rows` — a false all-clear that masks the real
  ledger entirely instead of erroring.
- `init --repo` (no value) baked `"repo": true` into the generated
  `dream.config.json`.

**Ledger check performed.** `docs/dream-cycle/LEDGER.md` on `main` holds 52
rows, last dated row 2026-09-30 (`daysSinceLastRow=9`, `ledgerStale=true`).
Unlike several prior nights' documented false-negative pattern, tonight this
is **genuinely accurate, not a stale-signal artifact**: this session's own
`SESSION_COMMIT` (`23a5770`) is the exact merge commit of the last ledger
row (#143); `git log --oneline` shows zero commits landed on `main` after
it. `dream-machine ledger signals --open-count 10` confirms
`zeroMergeStreak=true`, `reviewBacklogSize=10` (ground truth: 10 open,
unmerged `dream/*` candidate PRs — #137, #139, #141, #145, #148, #150, #152,
#154, #156, #158 — via `list_pull_requests`; 3 more open PRs, #159
(dependabot) and #98/#101 (a separate docs/portfolio program), are not
dream-cycle candidates). **No duplicate-direction risk**: read PR #141
(`developer-experience`, open, `--no-color` defeated by a stray trailing
positional via the too-strict `=== true` check on that *one* flag) and PR
#150 (`security-adversarial`, open, the shallow-clone `BASELINE_COMMIT`
git-show fix — itself live-reproduced again on this session's own fresh
shallow checkout before deepening it) in full; neither touches this bug
class (a bare flag parsing to `true` and silently surviving a `||`
default).

**Credentials reality check:** `OPENROUTER_API_KEY` is present this
session. `LLM_EVAL=not-applicable` (not `blocked`) — the candidate is a
deterministic CLI argument-validation fix with no model-calling surface;
tonight's local `gh` CLI has an invalid `GH_TOKEN` (`gh auth status` fails),
but the GitHub MCP tool suite is authenticated and working
(`get_me` → `ruvnet`), so remote issue/PR publication is **not** FALLBACK —
only gist creation has no working path (`GIST=LOCAL`).

## What's new

- `packages/cli/src/index.ts`: one new helper, `stringFlag(flag, name,
  fallback)` — returns `fallback` when the flag is absent (`undefined`),
  throws a clear `Error` when it's present but not a string (the
  bare-flag-boolean case). Mirrors this same file's own existing precedent
  (`parseMergedPrNumbers`/`parseOpenCandidateCount`/`parseSinceRow`/
  `parseLegacyDigest`), which already use this exact "undefined → fallback,
  else must be a string, else throw" shape for other flags. Applied at nine
  call sites: `init --repo`/`--out`, `compile --out`, `schedule --out`,
  `ledger <sub> --path` (shared by verify/signals/stats/append/
  legacy-digest), all 10 of `ledger append`'s string fields (date/deep/
  finding/issue/pr/evaluated/verdict/effect/witness/priorFates), `tui
  --path`, and `freshness stamp --id` (added in a second pass — see Reward-
  Hack Check).
- `packages/cli/src/index.test.ts`: 15 new tests — one per converted call
  site proving (a) a bare value-less flag now throws `--X requires a value`
  at exit 1 instead of silently corrupting state, and (b) every existing
  real-value invocation stays byte-identical (the full pre-existing suite
  is unmodified and still green). `ledger append`'s seven simple string
  fields are covered by one parameterized `it.each`.
- Nothing else touched: `--no-color`, `--help`, `--version`, `--report`,
  and `--merged` (via `parseMergedPrNumbers`, already fail-closed) are
  correctly meant to accept or already independently validate a boolean,
  and are untouched.

## Competitors (CLI argument parsers' value-less-flag handling)

| System | How it handles a value-taking option given no value | Grade |
|---|---|---|
| Commander.js (`.option('--date <date>')`) | A flag declared to require a value throws a usage error (`error: option '--date <date>' argument missing`) at parse time rather than silently defaulting — the same fail-closed shape this fix adopts for the hand-rolled parser here. | B (well-documented framework behavior, not independently re-verified live tonight) |
| clap (Rust) | `Arg::new("date").takes_value(true)` without `.required(false)`'s default fallback produces a hard parse error when no value follows; clap's whole design philosophy is "a missing required value is a usage error, never a silent default." | B (general knowledge of a widely-used library's documented design, not re-verified live) |
| yargs | Historically had multiple open GitHub issues about ambiguous boolean/string coercion for options whose type isn't pinned via `.string('date')` — i.e., the same underlying class of bug this repo's hand-rolled parser has, in a much more widely used parser. | C (recollection of community-reported issue pattern, not a specific cited report) |
| This repo's own precedent (`parseMergedPrNumbers` et al., PR #109 and others) | Already established and shipped the exact "undefined → fallback, else must be the right type, else throw" shape for four other flags before tonight — tonight's fix is that same pattern finally applied to the eight/nine call sites that had been missed. | A (first-hand, this repo's own history, re-read in full tonight) |

## Hypothesis (frozen before implementation)

> Given a dream-machine CLI invocation where a flag `parseArgs` represents
> as the boolean `true` (supplied with no following value) reaches a call
> site using the `(flags.foo as string) || fallback` idiom, when each such
> call site is converted to a new `stringFlag()` helper — returning
> `fallback` only when the flag is genuinely absent (`undefined`), throwing
> a clear usage error when it is present but not a string — then every
> bare, value-less instance of that flag should produce an immediate, clear
> `error: --X requires a value` at exit 1 instead of silently corrupting
> persisted state (the ledger, a generated config) or silently masking real
> state (an empty-ledger fallback reported as "OK"), while every
> already-passing invocation with a real string value stays byte-identical.

## Evaluation Receipt

Real evaluator: `npm test` (`vitest run && npm run test:governance`).

| | Baseline (`main@23a5770`) | Candidate |
|---|---|---|
| vitest | 769 passed, 25/25 files | 784 passed (+15 new), 25/25 files, **0 regressions** |
| governance (`node --test scripts/*.test.mjs`) | 150 passed | 150 passed (unchanged) |
| `npm run typecheck` | clean | clean |
| `npm run lint` | clean | clean |

Live repro, pre-fix vs. post-fix, all four confirmed real and confirmed fixed:

```
ledger append --path L.md --date --deep developer-experience --finding repro --verdict INCONCLUSIVE
  pre:  exit 0, wrote "| true | developer-experience | repro | ... |" to L.md
  post: exit 1, "error: --date requires a value, e.g. --date \"...\"", L.md untouched

ledger verify --path
  pre:  exit 0, "✓ ledger OK — 0 rows" (against a real, non-empty ledger on disk)
  post: exit 1, "error: --path requires a value, e.g. --path \"...\""

init --repo
  pre:  exit 0, generated config contains "repo": true
  post: exit 1, "error: --repo requires a value, e.g. --repo \"...\""

freshness stamp --base <sha> --paths <file> --id   (second-pass fix, see below)
  pre:  exit 0 (would have written policy.policyId: true)
  post: exit 1, "error: --id requires a value, e.g. --id \"...\""
```

Real-value sanity checks (same commands, real values) produced byte-identical
output to pre-fix behavior: `ledger append` with a real `--date` value,
`init --repo acme/widget --out cfg.json`, `tui --path L2.md --no-color`.

**Baseline note:** this session's own fresh checkout is shallow
(`git rev-parse --is-shallow-repository` → true); the *first* baseline run
showed 3 unrelated governance failures (`scripts/benchmark-ticket-codec.mjs`'s
pinned `BASELINE_COMMIT` git-show oracle, unreachable on a shallow clone —
exactly PR #150's already-open, unmerged fix for issue #149, re-confirmed
live tonight, not re-fixed here to avoid duplicating #150). `git fetch
--depth=200 origin main` resolved it with no code change; the 769/150 baseline
above is measured *after* that fetch, matching the real parent-commit state.

## Darwin Lineage

`DARWIN=not-applicable`. `npx @metaharness/darwin --version` confirmed the
entrypoint itself is live (resolved `@metaharness/darwin@0.10.3` from the
registry — still unpinned per this repo's own compiled-prompt supply-chain
warning, not re-litigated here). Not invoked for `evolve`: this candidate is
a single validation-shape fix with no numeric objective and no evolvable
population, the same judgment this repo has made for every prior fix of this
exact shape (#103, #122, #141).

## Evidence

- OBSERVATION: `parseArgs` (packages/cli/src/index.ts) represents a
  value-less flag as the boolean `true`; grep confirmed 8 `(flags.X as
  string) || default` call sites with no type check.
- OBSERVATION (live repro ×4, pre- and post-fix): see Evaluation Receipt.
- MEASUREMENT: 769+150 → 784+150 tests, 0 regressions; lint/typecheck clean.
- INFERENCE (independent critic, separate subagent, given only the diff):
  confirmed all four repros genuinely pre-existing and genuinely fixed by
  reverting/restoring `index.ts` under the new tests; confirmed the new
  tests are non-tautological (fail on old code, pass on new); confirmed no
  reward-hacking (purely additive diff, no gold/threshold/test-infra
  change); confirmed the eight originally-claimed call sites were each
  converted correctly (fallback values and error-message flag names match
  1:1); confirmed `--no-color`/`--help`/`--version`/`--report`/`--merged`
  were correctly left untouched; confirmed the "out of scope"
  `audit-gate`/`freshness` claim is accurate for the flags it describes
  (both fail loudly today via downstream type checks, never silently).
- DECISION (post-critic correction): the critic found **one real miss** —
  `freshness stamp --id` (line 675) uses the identical unconverted
  `(flags.id as string) || fallback` shape, and the original "out of scope"
  writeup incorrectly lumped it in with `--base`/`--paths` (which *do* use
  the other, already-safe `if (!x)`-required shape). Fixed in a second pass:
  converted `--id` to `stringFlag` too, added one regression test, re-ran
  the full suite (clean). The scope writeup above is corrected to match.
- REJECTION (disclosed, not fixed tonight — see Security Review and Scan
  Findings): the critic also found a second, *pre-existing, unrelated-shape*
  bug — `verify-entrypoint --cmd` (line ~487) checks requiredness via `if
  (!cmd)`, and a bare trailing `--cmd` parses to `true`, so `!true` is
  `false` and the check is bypassed; the command then tries to `exec(true)`,
  which throws inside `bin.ts`'s own catch and is reported as `blocked (exit
  1) — exited 1 with no stderr` — a plausible-looking "entrypoint is dead"
  verdict that actually means "you forgot to supply `--cmd`'s value." This
  is a different code shape (a bypassed requiredness check, not a silently-
  wrong default) than tonight's fix, was not claimed as fixed by this
  candidate's original scope, and is left as a follow-up to keep tonight's
  diff to one conceptual change — disclosed explicitly below, not silently
  dropped.

## Reward-Hack Check

Independent critic (separate subagent, given only the diff + repo context,
not this report) returned **APPROVE-WITH-FOLLOWUP**, not a bare CLEAR: it
confirmed no reward-hacking (no gold/expected value touched, no threshold
weakened, no test-infra change, purely additive diff) but caught the
`freshness stamp --id` miss described above — a real gap in a diff whose
original framing claimed "every instance of this pattern." That finding is
accepted as correct and fixed in a second pass (see Evidence → DECISION);
the critic's second finding (`verify-entrypoint --cmd`) is a pre-existing,
different-shape bug outside this diff's scope, accepted as a disclosed
follow-up rather than folded in, to avoid scope creep. Re-verified post-fix:
full suite green (784+150), new `--id` test is non-tautological (fails
`exit 1` → would have been `exit 0` pre-fix).

## Security Review

Pure in-memory CLI argument-parsing/validation logic — no new I/O, no
tool/MCP authority granted or removed, no credential path touched. This
session's `OPENROUTER_API_KEY` and GitHub access were used read-only
(`get_me`, `list_pull_requests`, `pull_request_read`, `search_issues`) to
check for duplicate work; neither credential value appears anywhere in this
report, the diff, or any command run. No filesystem/network scope changed,
no agent-impersonation surface, no benchmark/memory-poisoning vector. The
fix is strictly more restrictive than before (rejects inputs that previously
silently succeeded) — it cannot newly *accept* anything that was previously
rejected, so there is no risk of this change loosening any existing gate.

## Scan Findings

**cli** — The independent critic's second finding, disclosed, not fixed
tonight: `verify-entrypoint --cmd` (packages/cli/src/index.ts:487-488)
checks requiredness via `if (!cmd)` rather than a type check; a bare
trailing `--cmd` bypasses it (`!true` is `false`) and silently proceeds to
`exec(true)`, which fails inside `bin.ts`'s own catch and surfaces as a
misleading `blocked (exit 1) — exited 1 with no stderr` — indistinguishable
from a genuinely dead entrypoint. This matters because this exact command
gates the nightly pipeline's own evaluator-liveness check (STEP 0.5); a
typo'd invocation could misreport a live entrypoint as blocked. Recommend a
follow-up applying the same `if (!label || typeof cmd !== 'string')` shape
used elsewhere in this file.

**tui** — Confirmed live, lower severity, disclosed not fixed: `tui --repo`
(a *different* flag than the `--path` fixed tonight) has no `||` fallback at
all (`flags.repo as string | undefined`, direct cast) — a bare `--repo`
parses to `true` and `renderDashboard`'s header interpolates it verbatim
(`☾ DREAM MACHINE  ·  true`), a cosmetic-only display bug (confirmed via
`tui --path L2.md --no-color --repo`), not a data-correctness issue.

## Witness

```
report_sha256 : ef457ff97dd17817f1f1351031c35f923e3edec5dc4dc69b439606287d7973e0
session_commit: 23a577082aad39750051dc7ef0ec9d0d72900adf
witness       : c76e4b1238ea13ac44549c3b1c3af0351c5f75572bb37a405f477533c05c877a
```

Reproduce: `node packages/cli/dist/bin.js witness verify-report docs/dream-cycle/2026-10-09-developer-experience-report.md --commit 23a577082aad39750051dc7ef0ec9d0d72900adf`

`GIST=LOCAL` — no `gh` CLI (`GH_TOKEN` invalid this session) and no
gist-creation MCP tool available. Per the best-effort gist-publication
precedent (2026-08-13 onward), this report is committed into the PR at
`docs/dream-cycle/2026-10-09-developer-experience-report.md` as the durable
artifact instead.

## Recommendation

Human review of the draft PR. `EVALUATED=yes`, `VERDICT=ACCEPT` — three real,
live-reproduced, exit-0 silent state-corruption bugs (ledger write
corruption, ledger/tui false all-clear, config corruption) in this repo's
own CLI, fixed with a small, mechanical, precedent-matching helper; 769+150
→ 784+150 tests (+15), 0 regressions, lint/typecheck clean; independent
critic caught and this session fixed one real scope miss (`--id`) before
shipping, and disclosed (not silently dropped) one pre-existing adjacent gap
(`verify-entrypoint --cmd`) and one cosmetic gap (`tui --repo`) as follow-ups.
