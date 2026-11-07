# Ledger-Signals SOTA Report — 2026

## TL;DR
`docs/dream-cycle/LEDGER.md` — the Dream Machine's *only* durable cross-night
memory — round-trips incorrectly for any field containing a literal `|`
character. `escapeCell()` claims (in its own doc comment) that escaping `|` to
`\|` makes a cell "cannot break the table," but the parser (`splitRow()`) split
on every raw `|`, including the one inside `\|`, so the escape never actually
took effect on read-back. Any `ledger append --finding "..."` (free text, zero
pipe validation, run every single night by this exact pipeline) containing a
pipe silently shifts every column after it — Verdict lands in Effect,
Evaluated lands in Witness — and the repo's own regression test for this exact
scenario (`escapes pipes and newlines so a row cannot break the table`)
currently passes anyway, because it only asserts `rows.length === 1` and never
checks the recovered field values or `warnings`. Fixed by making `splitRow`
the true inverse of `escapeCell`: treat `\|` as a non-splitting literal pipe
and unescape it, matching the GitHub-Flavored-Markdown table-parsing
convention itself (A-grade, see Competitors). 0 regressions, 3 new tests,
diff confined to one function + its doc comment.

## What's new
- Root cause: asymmetric escape/parse pair. `escapeCell` (write path) and
  `splitRow` (read path) were not inverses of each other.
- Blast radius: every ledger field is free text from CLI flags
  (`packages/cli/src/index.ts` `ledger append`, lines ~369-393) with **no**
  character-level validation — `|` is entirely plausible in a Finding/Effect
  string (code snippets, shell output, literal pipes in prose).
- A second, independent bug of the same shape was found and disclosed, not
  fixed: `packages/cli/src/index.ts:117-119`'s comment justifying
  `--pending`'s pipe-separated format asserts "`escapeCell` already strips
  raw `|`" — that belief is false (it escapes, not strips) and is itself a
  symptom of the same misunderstanding that produced the bug. Left as-is
  (that flag's own values are supplied by the human/CI caller after a live
  GitHub check, not round-tripped through the ledger file, so it's lower risk
  and out of tonight's single-conceptual-change scope) — flagged in the issue
  for a human/future-night follow-up.

## Competitors (how comparable systems avoid this class of bug)
| System | Evidence format | Escaping approach | Grade |
|---|---|---|---|
| GitHub-Flavored-Markdown / CommonMark pipe-table extension | hand-written markdown tables (same format this repo chose) | Parser splits on *unescaped* `\|` only, unescapes to literal `\|`, and only treats a backslash as an escape when it immediately precedes the pipe (so `\\|` round-trips correctly too) — i.e. exactly the algorithm this fix implements | A — official spec/extension behavior, confirmed via live search tonight |
| Sakana AI Scientist | structured JSON run logs + rendered paper artifacts, not a single growing markdown table | sidesteps the problem: free text never shares a delimiter with the schema because JSON strings don't need manual pipe-escaping | C — recalled, not re-verified tonight |
| OpenHands (agent trajectories) | JSONL event streams | same avoidance: delimiter-safe serialization (JSON) means a literal `\|`-class bug can't occur by construction | C |
| SWE-agent | JSON/trajectory logs, not hand-rolled tables | same | C |
| DSPy / GEPA | structured artifacts (Python objects / JSON), not markdown tables | same | C |

Takeaway: every comparable system's finding-grade evidence log uses a
serialization format (JSON) where this entire bug class is structurally
impossible. This repo chose a human-readable markdown table instead (a
deliberate, reasonable tradeoff for a ledger meant to be read directly on
GitHub) — which means it is this repo's own responsibility to keep its
hand-written escape/parse pair a true inverse, which it was not.

## Hypothesis (frozen before implementation)
> Given a `docs/dream-cycle/LEDGER.md` row whose Finding (or any free-text
> field) contains a literal `|` character — written via `appendRow`/
> `escapeCell`, a realistic input since `ledger append`'s CLI flags accept
> arbitrary text with no pipe validation — when the ledger is parsed back by
> `parseLedger`/`splitRow`, then `parseLedger` should recover every field
> value unchanged and `warnings` should stay empty (the exact invariant the
> existing "escapes pipes… cannot break the table" test claims to guard but
> does not actually check), subject to: `npm test` stays green, no existing
> field round-trip changes, and the real committed `docs/dream-cycle/LEDGER.md`
> parses/verifies identically before and after.

## Candidate
`packages/ledger/src/index.ts` (+29/−2): `splitRow()` rewritten from
`trimmed.split('|')` to a character-scanning tokenizer that treats `\|` as a
literal, non-splitting pipe and unescapes it — the exact inverse of
`escapeCell`'s single `/\|/g → '\\|'` substitution. `escapeCell` itself is
**untouched**. `packages/ledger/src/index.test.ts` (+33): 3 new tests
(pipe round-trip with full field-value + warnings + verifyLedger assertions;
multiple/adjacent pipes; a plain backslash not followed by `|`, left
untouched). One conceptual change, 29 changed lines in the implementation
file.

## Evaluation Receipt
Real evaluator: `npm test` (`vitest run && npm run test:governance`).

| | Baseline (`main@23a5770`) | Candidate |
|---|---|---|
| vitest | 769 | 772 (+3 new, 0 regressions) |
| governance | 147 pass / 3 fail | 147 pass / 3 fail (same 3, unchanged) |
| `npm run lint` | clean | clean |
| `npm run typecheck` | clean | clean |
| `npm run build` (8 packages) | clean | clean |

The 3 governance failures (`scripts/benchmark-ticket-codec.test.mjs`) are
**pre-existing and environmental**, identical on baseline and candidate:
`git cat-file -e 35c9fd31ec0369f1c4b0ac7d5eda13d766bbb8cf` fails — the commit
that test shells out to (`git show <sha>:packages/edge-contracts/src/index.ts`)
is absent from this session's shallow clone (`git rev-parse
--is-shallow-repository` → `true`). Confirmed by running the governance suite
on `git stash`-ed baseline before restoring the candidate: identical 147/3
split both times.

Live pre/post-fix repro (`/tmp/repro-pipe.mjs`, `appendRow` + `parseLedger`
from the built `packages/ledger/dist/index.js`, Finding = `"a finding with a
| pipe character in it"`):
- **Pre-fix**: `parseLedger` returns 1 "row" with `finding: "a finding with a
  \\"`, `issue: "pipe character in it"`, `verdict: "yes"`,
  `evaluated: "#2"` — every field after the pipe shifted by one column.
  `warnings: ["row has 11 columns, expected 10: ..."]`. `verifyLedger` →
  `ok: false`, 3 errors (malformed column count, invalid verdict "yes",
  invalid evaluated "#2").
- **Post-fix**: `finding` recovers byte-identical, all other fields in their
  correct columns, `warnings: []`, `verifyLedger` → `ok: true`.

## Baseline
Parent commit `23a577082aad39750051dc7ef0ec9d0d72900adf` (`main`, HEAD at
session start — PR #143 landed there last night), rebuilt clean
(`npm ci && npm run build`), 769/769 vitest + 147/150 governance (3
pre-existing environmental failures, see above).

## Darwin Lineage
`DARWIN=not-applicable` — a single-function parser-tokenizer fix has no
evolvable population to fitness-search over (same judgment this ledger has
recorded for every prior single-conceptual-change candidate: #116, #127,
#132, #137). Entrypoint probed live tonight (`npx --yes @metaharness/darwin
--version` → responds, network reachable) so this is a judgment call, not an
infrastructure block. Standing supply-chain note carried forward unchanged:
`evaluatorEntrypoints.darwin` still runs via unpinned `npx`, resolving
registry `latest` on every invocation — not this candidate's to fix, flagged
again for a human pinning decision.

## Evidence
OBSERVATION (read `escapeCell`'s doc comment vs. `splitRow`'s implementation;
they are not inverses) → OBSERVATION (existing test only asserts
`rows.length === 1`, never field values or warnings) → MEASUREMENT (live
pre-fix repro: column shift, `verifyLedger.ok === false`) → MEASUREMENT
(GFM/CommonMark pipe-table spec confirms the correct algorithm, live search)
→ MEASUREMENT (769→772 vitest, 0 regressions; governance 147/3 unchanged
both sides) → MEASUREMENT (live post-fix repro: byte-identical recovery,
`verifyLedger.ok === true`) → INFERENCE (independent critic subagent,
separate context) → DECISION (ACCEPT).

## Reward-Hack Check
Independent adversarial-critic subagent (separate context, ran live commands
against the working tree, `git stash`/`pop` to independently reproduce
pre/post-fix rather than trusting this report): **CLEAR**.
- Independently reproduced the exact column-shift corruption on baseline and
  the exact clean recovery on the candidate, from its own throwaway repro
  script.
- `escapeCell` confirmed byte-identical in the diff — only `splitRow` (+ its
  doc comment) changed; no existing assertion weakened or removed; the test
  diff is purely additive (3 new `it` blocks).
- Noted the pre-existing `rows).toHaveLength(1)` assertion was never
  sufficient because the bug never changed row *count*, only column values —
  explaining exactly why it passed throughout the bug's lifetime.
- Ran 9 additional edge cases beyond this candidate's own 3 new tests
  (trailing bare backslash in mid/last column, escaped pipe at column
  start/end, pre-existing literal `\|` in raw input, multiple backslashes,
  `||`, `|a|b|c|`): all pass. Reasoning: `renderRow` always joins cells with
  `' | '`, so a real column separator is always space-padded and never
  directly adjacent to a self-produced `\|` pair — no ambiguity found,
  pre-existing or newly introduced.
- Independently ran `ledger verify` against the real committed
  `docs/dream-cycle/LEDGER.md` on both baseline and candidate (separate
  `git stash`/build cycles): **byte-identical** output both times — exit 1,
  same 40 pre-existing legacy-format errors, none pipe-related.
- Independently re-ran `npm test`: vitest 772/772, governance 147/150 (same
  3 pre-existing environmental failures, nothing new).

No gold data, threshold, or benchmark corpus touched; no undocumented cache;
no hidden cost (pure synchronous string scan, same asymptotic cost as the
previous `.split('|')`).

## Security Review
No credential, network, or trust-boundary surface added or changed. Pure
string-parsing logic over the local `LEDGER.md` file. No LLM calls in this
path (`OPENROUTER_API_KEY` present, correctly unused for this surface — this
candidate required zero model-calling evaluation, consistent with a
deterministic, no-model-call night).

## Regression Analysis
0 pre-existing tests modified or removed. 3 new vitest tests added.
`npm run lint` / `npm run typecheck` clean. `npm run build` clean across all
8 packages — no wasm/NAPI degradation to record tonight.

## ADR
None — a correctness bug fix in an existing module's escape/parse symmetry,
not a new architectural decision or repo-wide invariant.

## Gist
`GIST=LOCAL` — no `gh` CLI (GH_TOKEN invalid: `gh auth status` fails) and no
gist-creation MCP tool available this session (checked: GitHub MCP server has
no `create_gist`-shaped tool). Full report committed at
`docs/dream-cycle/2026-10-01-ledger-signals-report.md`. GitHub MCP access
itself works fine (`get_me` succeeded) — this is specifically a gist-API gap,
not a GitHub-auth failure, so `FALLBACK=false`.

## Next steps
1. The disclosed, not-fixed sibling misunderstanding at
   `packages/cli/src/index.ts:117-119` (the `--pending` flag's comment
   wrongly claims `escapeCell` "strips" `|`) should get its comment corrected
   by a future night, even though the flag's actual values aren't round-tripped
   through the ledger file today.
2. `ledger verify`'s real, committed `docs/dream-cycle/LEDGER.md` still has
   40 pre-existing legacy-format errors (grandfathered by `sinceRow`,
   unrelated to this fix, confirmed unchanged by tonight's and the critic's
   independent runs) — a human already has issues #48/#58 tracking that
   debt; not re-opened here.
3. `evaluatorEntrypoints.darwin`'s unpinned `npx` resolution (flagged again
   this run, every Darwin-eligible night since at least PR #132) remains a
   standing human pinning decision, not fixed tonight per the compiled
   routine's explicit instruction not to silently pin it as part of an
   unrelated candidate.

## Issue
#144

## Witness

```
report_sha256 : 7ae1cb198fddf40ce51c2a13f2dbd60b54f71508b2f0fc1f7f73835edf855daf
session_commit: 23a577082aad39750051dc7ef0ec9d0d72900adf
witness       : 7b9041e4660376bc4b26f781cde46e93875f2e3dcbc26be78ef4a01de485c47c
```

Computed over this file's canonical bytes (everything above this heading,
trailing whitespace collapsed to one newline) — reproducible from the
committed file with no unavailable intermediate bytes. Verify:

```bash
dream-machine witness verify-report docs/dream-cycle/2026-10-01-ledger-signals-report.md --commit 23a577082aad39750051dc7ef0ec9d0d72900adf
```
