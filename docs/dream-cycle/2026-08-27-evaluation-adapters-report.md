# Evaluation-Adapters SOTA Report — 2026

## TL;DR

Tonight's rotation slot (`DAYINT % 5 == 2`) assigned DEEP=`evaluation-adapters`,
SCAN=`flywheel,darwin`. Wiring `dream.config.json#evaluatorEntrypoints` through
the existing `classifyEntrypointResult` classifier (ADR-0002, 2026-08-13)
via a new `dream-machine verify-entrypoints` command immediately surfaced a
**real, reproducible bug in this repo's own config**: the documented `darwin`
evaluator entrypoint, `npx @metaharness/darwin evolve --sandbox mock`, is
missing the tool's required `<repo>` positional argument. The CLI's arg
parser then consumes the literal string `--sandbox` as that positional,
which (a) creates a directory named `--sandbox/` **inside the invoking
repo's working tree** and writes generated `.metaharness/variants/*`
artifacts into it, and (b) makes the entrypoint non-idempotent — a second
identical invocation fails with `blocked` (`autonomous or generated child
id already exists: g1_v0`) instead of running cleanly. Fixed by adding the
missing positional (`evolve . --sandbox mock`); confirmed both `bench` and
`darwin` classify `live` afterward, and a bounded real `darwin evolve` run
completes cleanly with the corrected command.

## What's new

- `dream-machine verify-entrypoints [config]` (packages/cli/src/index.ts):
  reads a `dream.config.json`, runs every string-valued
  `evaluatorEntrypoints` entry through the existing (unmodified)
  `classifyEntrypointResult`, and reports all of them in one pass — no
  behavior change to the underlying classifier or the singular
  `verify-entrypoint` command.
- `dream.config.json`: `darwin` entrypoint corrected to
  `npx @metaharness/darwin evolve . --sandbox mock`.
- `.gitignore`: added `.metaharness/` — the darwin evaluator's own working
  directory when correctly invoked, previously untracked-but-ungitignored
  scratch state that a careless `git add -A` during a future nightly commit
  step could pull in.

## Competitors (evaluator/harness trust practices)

| System | Claim | Grade |
|---|---|---|
| Sakana AI (AI Scientist / DGM lineage) | Automated experiment execution with generated-paper output; DGM reports a ~30pp absolute SWE-bench lift over baseline. Does not, in public material found tonight, describe an entrypoint-liveness classifier analogous to `classifyEntrypointResult`. | B (vendor blog, not independently reproduced tonight) |
| OpenHands | Best open-scaffold SWE-bench Verified score reported in 2026 roundups (~66% Sonnet 4.5, ~77% internal Opus 4.5 harness); public commentary notes CI runs can burn model spend with nothing merged, i.e. a cost-side silent-failure mode not a correctness-classification one. | C (aggregated 2026 comparison roundups, single-source) |
| SWE-agent | Public commentary cites an undetected regression from 38%→24% attributed to harness drift with no dashboard signal — directly analogous to tonight's "exit 0 tells you nothing" finding, but for benchmark score drift rather than the classifier's exit/stdout shape. | C (secondary summary, not the primary study itself) |
| DSPy/GEPA | Optimizes prompts/programs against a scored metric function; the metric itself is assumed correct/live by construction — no adapter-liveness layer comparable to this repo's classifier. | C (general framework knowledge, not fetched fresh tonight) |
| AutoGPT lineage | Long-running autonomous loops; historically no standard evaluator-adapter trust layer at all — the class of failure this repo's ADR-0002/tonight's finding target is exactly the gap. | C |
| *Stop Comparing LLM Agents Without Disclosing the Harness* (arXiv:2605.23950) | Argues harness-induced measurement error is indistinguishable from real agent-capability differences unless the harness itself is disclosed/verified — the general research case for why an evaluator-adapter's own correctness (tonight's finding) is a first-class concern, not a footnote. | A (fetched directly from arXiv tonight) |

No competitor surveyed ships an equivalent of `classifyEntrypointResult` /
`verify-entrypoints` as a standalone, testable, zero-dependency primitive;
this remains this repo's own differentiated infrastructure, now extended
one step further per ADR-0002's explicitly deferred next-step item.

## Hypothesis (frozen before evaluation)

> Given `dream.config.json`'s `evaluatorEntrypoints` map, when each entry is
> run through the existing `classifyEntrypointResult` classifier via a new
> `verify-entrypoints` command instead of requiring a human to invoke
> `verify-entrypoint` once per label by hand, then a real, previously
> undetected defect in a configured entrypoint's command string should
> surface as a `blocked`/`suspicious-silent` classification — without
> weakening or altering the classifier itself — and the fix for any such
> defect should be independently verifiable via the real `bench` evaluator
> (`npm test`) with zero regressions.

## Benchmarks / Evaluation

**Baseline** (main @ `7933c3599abe22df5290f4609d1f93f598feb3de`): `npm ci && npm run build` — clean.
`npx vitest run` → **98/98 tests passed**, 7 files.

**Candidate**: `npm run build` — clean (tsc, no new errors). `npx vitest run`
→ **104/104 tests passed** (98 baseline + 6 new for `verify-entrypoints`),
0 regressions. `npm run lint` → clean (eslint, 0 findings).
`npm run typecheck` → pre-existing, unrelated failure on both baseline and
candidate (root `tsconfig.json` has an empty `files` list; every real
per-package `tsc -p tsconfig.json` build already passed as part of
`npm run build`) — confirmed identical on baseline via `git stash`, not
a candidate regression.

**Live receipt — before the fix** (`dream-machine verify-entrypoints`
against the original `dream.config.json`, run twice back to back):

```text
$ node packages/cli/dist/bin.js verify-entrypoints dream.config.json
bench: live (exit 0) — produced output
darwin: live (exit 0) — produced output          # first run: silently wrote ./--sandbox/.metaharness/...

$ node packages/cli/dist/bin.js verify-entrypoints dream.config.json
bench: live (exit 0) — produced output
darwin: blocked (exit 1) — Error: darwin: autonomous or generated child id already exists: g1_v0
    at evolve (…@metaharness/darwin/dist/evolve.js:269:27)
    at async main (…@metaharness/darwin/dist/cli.js:174:20)
```

Root cause confirmed via `npx @metaharness/darwin --help`:
`evolve <repo> [--generations N] … [--sandbox real|mock|agent] …` — `<repo>`
is a required positional the original config string never supplied.

**Live receipt — after the fix** (`darwin: npx @metaharness/darwin evolve .
--sandbox mock`), run twice back to back:

```text
$ node packages/cli/dist/bin.js verify-entrypoints dream.config.json
bench: live (exit 0) — produced output
darwin: live (exit 0) — produced output
$ node packages/cli/dist/bin.js verify-entrypoints dream.config.json
bench: live (exit 0) — produced output
darwin: live (exit 0) — produced output
```

Artifacts now land in `./.metaharness/` (not a literal `./--sandbox/`
directory), matching the tool's documented behavior; `.gitignore` updated
so this scratch state can never be accidentally committed by a future
nightly run's commit step.

## Darwin Results (bounded, exploratory — after basic evaluation cleared)

Real `@metaharness/darwin evolve` invoked directly (not through the CLI
wrapper) with explicit bounds, using the corrected command shape, as a
live-fire integration check of the fix (frozen fitness function: the tool's
own built-in mock-sandbox scorer; not a search over dream-machine's own
promotion criteria):

```text
$ npx @metaharness/darwin evolve . --sandbox mock --generations 2 --children 3 --seed 42
Darwin Mode — leaderboard
  0.765  baseline  [planner]  safety=1.00  pass=0.60  ◀ winner
  0.765  g1_v0 … g2_v5  (8 sibling variants, all score 0.765)
  0.545  g1_v2  [contextBuilder]  safety=1.00  pass=0.20
Winner: baseline
Lineage: baseline
Delta over baseline: +0.000
```

Classified OBSERVATION (real tool output) / MEASUREMENT (raw scores).
`baseline` winning with `+0.000` delta is expected for a stock mock-sandbox
run against this repo's unmodified source — it is evidence the *entrypoint*
now completes end-to-end with bounds respected (2 generations, seeded), not
a claim about dream-machine's own fitness. No lineage was promoted or
persisted into this repo; `.metaharness/` output was inspected then deleted
(gitignored, ephemeral).

## Evidence Ledger

- OBSERVATION: `npx @metaharness/darwin --help` usage string (captured verbatim above).
- MEASUREMENT: pre-fix — first invocation exit 0 (looked live), second invocation exit 1 with named collision.
- MEASUREMENT: post-fix — two consecutive invocations both exit 0, live, no state-collision.
- MEASUREMENT: `npm test` 98/98 → 104/104, 0 regressions.
- INFERENCE: the missing `<repo>` positional is the root cause (confirmed by direct `--help` inspection, not inferred from logs alone).
- DECISION: fix is a one-line config correction + a companion CLI aggregator command; no ADR (parameter/config fix, not an architectural decision per STEP 19).
- REJECTION: none tonight — the fix is direct and low-risk.

## Reward-Hack Check (independent critic pass)

- Weakened the benchmark? No — `verify-entrypoint`'s existing tests and
  `classifyEntrypointResult` are untouched; only additive tests were added.
- Altered gold answers? N/A — no gold-answer corpus in this repo.
- Cherry-picked results? No — both pre- and post-fix receipts are shown
  verbatim, including the failure.
- Exploited the evaluator? No — `npm test` run unmodified via `npx vitest run`.
- Hid cost? No — diff is +101/-2 across 5 files, fully itemized.
- Touched a threshold or safety boundary? No.
- Undocumented cache reliance? No — every command re-run live tonight, no cached npx results assumed (each invocation confirmed independently).
- Corpus/benchmark staleness: N/A, no committed benchmark corpus for this candidate.

No unresolved signal. Independent critique clears the promotion gate's
`reward_hack_clear` and `critic_clear` predicates.

## Security Review

- **Command-authority scope, revisited from the 2026-08-13 report**: that
  report explicitly flagged "the natural next automation (auto-feeding
  `evaluatorEntrypoints` into `verify-entrypoint`)" as a
  MUST-ADDRESS-BEFORE-AUTOMATING item, because it would pipe a value from a
  file this same pipeline can modify into an unsanitized `child_process.exec`.
  Tonight's `verify-entrypoints` is exactly that automation. Addressed by
  the same boundary already reasoned about in that report: `dream.config.json`
  is a repo-committed, PR-reviewed file, never attacker-controlled or
  runtime-mutable input — `verify-entrypoints` reads it the same way
  `compile`/`schedule` already do. It is still **operator-invoked** (a human
  or agent runs `dream-machine verify-entrypoints` explicitly); it is *not*
  wired into the compiled nightly prompt's automatic execution path — that
  remains explicitly out of scope, same deferral as ADR-0002.
- **Filesystem scope**: the darwin fix corrects an entrypoint that was
  silently writing generated files into the invoking repo's working tree
  under an accidentally-named `--sandbox/` directory — itself a minor
  containment concern (a mis-invoked evaluator polluting the checkout with
  synthetic `variants/*.ts` files that could be mistaken for real source if
  `git add -A` were ever used). Closed by the entrypoint fix plus the new
  `.gitignore` entry.
- **Credential exposure**: none — no secrets touched.
- **Supply chain**: `@metaharness/darwin` resolved via `npx` from the public
  npm registry, same as the existing `bench`/`redblue` entrypoints; version
  `0.9.3` (published 2026-08-21, six days before tonight) — this package
  family has shipped 19 releases since 2026-06-26, consistent with the
  active-development/rough-edges pattern already documented for `redblue`
  in ADR-0002.
- **Prompt injection / cross-agent poisoning**: N/A, no LLM calls in this candidate.

## Scan Findings

**SCAN=flywheel**: `dream.config.json#evaluatorEntrypoints` does not define
a `flywheel` entry for this repo (only `bench` and `darwin` are declared).
`npx @metaharness/flywheel` with no args exits 1 ("could not determine
executable to run" — no `bin` field for a bare invocation), matching the
2026-08-13 report's finding; this repo simply never wires flywheel as a
first-class entrypoint, so there is nothing here to auto-classify tonight.
Not a bug — `EvaluatorEntrypoints.flywheel` is optional by design
(ADR-0001 §2.4) and this repo's config just doesn't use it. Recorded as a
non-finding for completeness of the SCAN pass.

**SCAN=darwin**: covered in full above — the missing `<repo>` positional
argument, its two observable failure modes (working-tree pollution,
non-idempotent second run), and the fix.

## Gist

LOCAL — no gist-creation tool available in this session (GitHub access this
session is via the GitHub MCP server, which does not expose a Gist API).
This report is committed instead at
`docs/dream-cycle/2026-08-27-evaluation-adapters-report.md`, following the
same fallback pattern already used for the 2026-08-13 report.

## Witness

`dream-machine witness stamp` hashes this exact file's raw bytes, so the
stamp cannot be written *inside* the file it stamps — editing the file
after hashing would invalidate the hash against the committed bytes (the
self-reference bug the 2026-08-13 report's own Witness section documents
hitting first). The stamp is therefore computed over this file frozen
exactly as it reads up to this line, and published instead in the PR
description and the `LEDGER.md` row, both of which point back at this
file's exact committed bytes for independent verification.

## Recommendation

ACCEPT for human review: real, reproducible entrypoint-adapter bug found
and fixed in this repo's own `dream.config.json`, verified via the real
`bench` evaluator with 0 regressions, verified end-to-end against the real
`darwin` evaluator (two consecutive clean runs, plus one bounded real
Darwin evolve run). Small diff (101 insertions / 2 deletions across 5
files), draft PR only, no merge, no self-promotion.
