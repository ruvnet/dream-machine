# Ledger-Signals SOTA Report — 2026

## TL;DR
`dream-machine ledger append` — the operator-facing command every nightly run
actually uses to persist state — performed zero validation of `--verdict`/
`--evaluated` before writing, while `ledger verify` (and the `Verdict`/
`Evaluated` TypeScript types) enforce a strict 3-value / 3-value enum. In the
repo's own committed `docs/dream-cycle/LEDGER.md`, 5 of the 6 real rows
already violate that enum (`"ACCEPT / INCONCLUSIVE"`, `evaluated: "partial"`,
etc.) — `ledger verify` fails with 9 structural errors against the ledger the
Dream Machine is supposed to trust as its only durable cross-night memory.
Candidate: reject an out-of-range `--verdict`/`--evaluated` at write time in
the CLI, so the append path can no longer create data its own verifier
rejects.

## What's new
Self-hosting repos ship an engine and are also the engine's own subject.
The interesting finding here isn't external SOTA — it's an internal
write/read consistency gap: the writer (`ledger append`) and the reader
(`ledger verify`) disagreed about what a valid row is, and nothing caught
it for 5 consecutive nights. This is the generic "the tool that appends
audit data doesn't validate against the schema the tool that checks audit
data enforces" bug class — relevant to any agent system with an append-only
ledger/journal.

## Competitors (grade C — direction only, not implementation-justifying)
- **Sakana AI Scientist** — similarly logs experiment provenance to a
  structured record; public writeups don't detail whether the logger
  validates against the same schema its own report-parsing step expects.
- **OpenHands** — trajectory logs are schema'd but produced by a single
  code path (no separate CLI-vs-library split), so this class of drift is
  structurally less likely there.
- **DSPy/GEPA** — the optimizer's trace/history objects are constructed
  in-process (Python objects, not appended text), so there's no analogous
  markdown/CLI write path to drift from a validator.
- **SWE-agent** — trajectory `.traj` files are dumped verbatim from the
  agent's action log; no external "verify" step comparable to
  `ledger verify` was found in the public repo, so this failure mode isn't
  even guarded against there.
- **AutoGPT lineage** — memory backends are typically permissive
  key/value or vector stores with no schema enforcement at all, i.e. the
  same class of gap but with no verifier to ever surface it.

## Hypothesis (frozen before evaluation)
> Given the dream-machine CLI's `ledger append` subcommand, when it validates
> `--verdict` and `--evaluated` against the same enums `ledger verify`
> already enforces (rejecting an out-of-range value with a non-zero exit and
> no file write, instead of silently writing it), then future ledger rows
> will never fail structural verification on those two fields, without
> changing `appendRow`'s existing permissive library-level behavior (which
> is intentionally tested to accept any string so `verifyLedger` has
> something to catch) or regressing any existing test.

## Benchmarks / Evaluation
Real evaluator: `npm test` (vitest), plus a direct reproduction of the exact
failure pattern found in the committed ledger.

**Baseline (parent, commit 7933c35, before candidate):**
```
$ node packages/cli/dist/bin.js ledger append --path /tmp/b.md \
    --deep perf --finding x --verdict "ACCEPT / INCONCLUSIVE"
appended row to /tmp/b.md (verdict=ACCEPT / INCONCLUSIVE)
$ echo $?
0
```
Silently writes a row that immediately fails `ledger verify`. 98/98 tests
green (pre-existing suite, unrelated to this bug).

**Candidate:**
```
$ node packages/cli/dist/bin.js ledger append --path /tmp/c.md \
    --deep perf --finding x --verdict "ACCEPT / INCONCLUSIVE"
ledger append: refusing to write an invalid row:
  - verdict "ACCEPT / INCONCLUSIVE" not in ACCEPT|REJECT|INCONCLUSIVE
$ echo $?
1
(file not created)
```
102/102 tests green (98 pre-existing + 4 new: 2 unit tests for the new
`validateRowFields` export, 2 CLI-level tests for the refuse-and-don't-write
path). 0 regressions. `npm run lint` clean, `npm run typecheck` clean.

`ledger verify docs/dream-cycle/LEDGER.md` still reports the same 9 historical
errors before and after — the candidate does not rewrite history (correctly;
that would be evidence tampering, not a fix). It only prevents new drift.

## Darwin
Ran `npx @metaharness/darwin evolve --sandbox mock` (available, installed
transparently, exit 0). Its leaderboard operates over generic
`contextBuilder`/`toolPolicy`/`retryPolicy`/`planner`/`reviewer` mock
components — it is not wired to this repo's actual packages, so its output
(winner `g2_v5`, +0.110 over baseline) is **not evidence about this
candidate** and is not cited as such. Recorded honestly as a scan finding
instead: the `darwin` evaluator entrypoint is "live" per
`verify-entrypoint` classification but has no adapter connecting it to
`packages/*` — Darwin cannot meaningfully evaluate a real dream-machine
candidate yet. Not in scope to fix tonight (candidate stayed <300 lines,
one conceptual change); flagged as a next-step.

## Evidence
- OBSERVATION: `node ... ledger verify docs/dream-cycle/LEDGER.md` → 9
  errors, rows 2–6 (real, pre-existing, committed data).
- MEASUREMENT: baseline `ledger append` with an out-of-range verdict → exit
  0, row written (reproduces the observed drift mechanism).
- MEASUREMENT: candidate `ledger append` with the same input → exit 1, no
  write.
- MEASUREMENT: `npx vitest run` — 98 baseline / 102 candidate, 0 regressions.
- INFERENCE: the 5 non-conforming historical rows are explained by this gap
  (append never validated; whatever produced those rows — likely a broader
  multi-repo "portfolio" ledger process, given rows 2–6 reference many
  repos outside `ruvnet/dream-machine` — used compound verdict strings and
  "partial" that this repo's schema never allowed).
- DECISION: candidate ACCEPTed for human review; not merged; not
  self-promoted.

## Reward-Hack Check (independent critic pass)
- Weakened a benchmark or test? No — added tests, tightened behavior.
- Altered gold data? No corpus/gold data exists for this candidate; none
  touched.
- Cherry-picked a favorable metric? No — used the repo's real evaluator
  (`npm test`) unmodified, plus a direct reproduction of the reported bug.
- Exploited the evaluator or hid cost? No.
- Touched a threshold, gate, or safety boundary? No — mirrors an existing
  enum (`VERDICTS`/`EVALS`) already enforced by `verifyLedger`; did not
  invent a new threshold.
- Relied on an undocumented cache? No.
- Corpus predates tonight and could have gone soft? N/A — no corpus.

## Security Review
No prompt-injection, credential, or cross-agent surface touched. Change is
confined to two TypeScript files (`packages/ledger/src/index.ts`,
`packages/cli/src/index.ts`) adding pure input validation; no new
filesystem/network scope, no new dependency, no permission expansion.
`OPENROUTER_API_KEY` is present in the environment (`LLM_EVAL` not
blocked) but this candidate makes no model calls, so it is out of scope for
tonight's finding regardless. Note for whoever reads the raw session
transcript: an earlier diagnostic command echoed the live key value to
stdout — that key must be treated as compromised and rotated; it was not
written to any committed file, ledger row, gist, issue, or PR body.

## Scan Findings

### witness
`witness stamp`/`witness verify` (`packages/witness`) are unaffected by
tonight's candidate and pass their existing 14 tests unchanged. No gap
found there tonight — clean.

### verify
Confirmed and closed the write/read gap above. Residual, not fixed tonight
(explicitly out of scope — would require deciding a migration policy for 5
already-committed non-conforming rows, which is a maintainer call, not an
autonomous one): the 5 historical non-conforming rows still fail `ledger
verify` and will keep doing so until a human either amends the schema to
allow the multi-repo "portfolio" shape those rows actually used, or accepts
them as a permanently grandfathered exception. Recommend the human decide
which, then either fix the historical rows in a follow-up PR or teach
`verifyLedger` to accept a documented exception list.

## Next steps
1. Maintainer decision: should the ledger schema (`Verdict`/`Evaluated`
   enums) be extended to represent partial/multi-repo nights, or should
   nightly runs be constrained to always report a single clean verdict for
   `ruvnet/dream-machine` only (as this compiled prompt already specifies)?
   Rows 2–6 predate that constraint being explicit.
2. Wire a real adapter from `npx @metaharness/darwin evolve` into
   `packages/*` so bounded Darwin can generate meaningful lineages for this
   repo's own candidates instead of a disconnected mock leaderboard.
3. Rotate the OPENROUTER_API_KEY that was echoed to this session's stdout
   during credential discovery (see Security Review).

## Witness
```
session_commit : 7933c3599abe22df5290f4609d1f93f598feb3de
report_sha256   : 3299ec2db414f126b817b674829fdcc6804e2e9f29c90d5207b8c02bb5efbcb2
witness         : 3082c5d57aefaa0d24bb9e10e00cc48f4919c5ccc327162d166459071a91ffd3
```
(`report_sha256` is the sha256 of this file's content *before* this Witness
section was filled in, matching the state the CLI stamped.)

Verify (5 steps, coreutils only):
```bash
git checkout 7933c3599abe22df5290f4609d1f93f598feb3de -- .   # or fetch the gist raw URL
REPORT_HASH=$(sha256sum dream-gist-2026-08-31.md | awk '{print $1}')
printf "%s%s" "$REPORT_HASH" "7933c3599abe22df5290f4609d1f93f598feb3de" | sha256sum | awk '{print $1}'
# must equal: 3082c5d57aefaa0d24bb9e10e00cc48f4919c5ccc327162d166459071a91ffd3
```
Equivalently: `node packages/cli/dist/bin.js witness verify <report> <commit> <witness>`.
