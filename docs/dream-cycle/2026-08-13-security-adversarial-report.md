# Security-Adversarial / Supply-Chain SOTA Report — 2026

## TL;DR

Tonight's SCAN=redblue probe of this repo's own declared evaluator entrypoint
(`npx @metaharness/redblue`, per `dream.config.json`) reproduced a real,
100%-reliable silent failure: the command exits 0 with **zero bytes** on both
stdout and stderr, for every subcommand tried. Root cause: `@metaharness/redblue`'s
CLI guards its dispatch with the classic-but-broken ESM idiom
`import.meta.url === \`file://${process.argv[1]}\``, which fails once the binary
is reached through the symlink `npm`/`npx` always create for a package's `bin`
entry — so the dispatch body never runs. Exit 0 + silence is indistinguishable
from "ran clean, zero findings" to anything that trusts the exit code alone —
which is exactly what this repo's own compiled nightly prompt (STEP 5-9) would
otherwise do for the SCAN=redblue evaluator. Candidate: a small, tested,
deterministic entrypoint-liveness classifier (`classifyEntrypointResult`) and a
`dream-machine verify-entrypoint` CLI command so this pipeline (and any future
one composing @metaharness packages) can distinguish LIVE / BLOCKED /
SUSPICIOUS-SILENT before ever recording `EVALUATED=yes`.

## What's new

- First-hand reproduction (grade A — not sourced, directly executed tonight)
  that `npx -y @metaharness/redblue <init|run|attack|help|bare|--version>` all
  produce 0-byte stdout, 0-byte stderr, exit 0.
- Root-caused to `dist/cli/index.js`'s `isMain` guard via direct inspection of
  the installed package source (`~/.npm/_npx/*/node_modules/@metaharness/redblue/dist/cli/index.js`
  line ~489): `const isMain = import.meta.url === \`file://${process.argv[1]}\`;`
  — the well-known npm-bin-symlink footgun.
- Confirmed this repo's own `dream.config.json:17` documents exactly this
  broken invocation (`"redblue": "npx @metaharness/redblue"`) as the
  SCAN=redblue evaluator entrypoint that every future security-adversarial
  night is instructed to trust.
- Also found (same probe) `"flywheel": "npx @metaharness/flywheel"` is broken
  for a different, *loud* reason: the package ships no `bin` field at all, so
  npx fails immediately with a visible error — safe (fails loud), unlike
  redblue's silent failure, but still a stale/incorrect entrypoint doc.
- Confirmed `@metaharness/darwin` is genuinely invocable (`npx -y
  @metaharness/darwin evolve|bench|security`), but the intuitive `--version`
  flag is *not* recognized and exits 1 with usage text — correctly classified
  tonight as `blocked` (visible reason), not `live` and not `suspicious-silent`.

## Hypothesis (frozen before implementation)

> Given a nightly pipeline that shells out to third-party evaluator
> entrypoints and trusts their exit code as a pass/fail signal, when a
> deterministic `classifyEntrypointResult` function is interposed between the
> raw exec result and the pipeline's `EVALUATED=yes/no/blocked` decision, then
> it should correctly separate LIVE (real output, exit 0) from BLOCKED
> (nonzero exit, has a reason) from SUSPICIOUS-SILENT (exit 0, zero output on
> both streams) — a distinction the raw exit code alone cannot make — subject
> to: no change to any existing test, no change to the `bench: npm test`
> evaluator's own behavior, and the classifier must be pure/deterministic
> (no I/O, no clock, no randomness).

## Benchmarks / Evaluation

Real evaluator: `npm test` (vitest), this repo's own `bench` entrypoint —
the only evaluator entrypoint confirmed genuinely live tonight.

| | Baseline (parent, commit 3de0107) | Candidate (working tree) |
|---|---|---|
| Test files | 6 | 7 (+`entrypoint.test.ts`) |
| Tests | 85 | 96 (+11, 0 removed, 0 modified) |
| Result | 85 passed | 96 passed |
| Duration | 930ms | 1.21s |

No pre-existing test was touched, weakened, or removed. Diff: 2 new files
(`entrypoint.ts` 51 lines, `entrypoint.test.ts` 39 lines) + 3 modified files
(113 changed lines) = 203 changed lines total, one conceptual change
(includes a post-critique fix — see Reward-Hack Check).

Live receipt — `dream-machine verify-entrypoint` run against this repo's real
`dream.config.json` evaluatorEntrypoints tonight:

```
$ node packages/cli/dist/bin.js verify-entrypoint redblue --cmd "npx -y @metaharness/redblue"
redblue: suspicious-silent (exit 0) — exit 0 with empty stdout and stderr —
  indistinguishable from "ran clean, zero findings"; do not record
  EVALUATED=yes from this result alone
$ echo $?
2

$ node packages/cli/dist/bin.js verify-entrypoint flywheel --cmd "npx -y @metaharness/flywheel"
flywheel: blocked (exit 1) — npm error could not determine executable to run
$ echo $?
1

$ node packages/cli/dist/bin.js verify-entrypoint darwin --cmd "npx -y @metaharness/darwin --version"
darwin: blocked (exit 1) — usage: metaharness-darwin <evolve|bench|security> ...
$ echo $?
1

$ node packages/cli/dist/bin.js verify-entrypoint bench --cmd "npm test --silent"
bench: live (exit 0) — produced output
$ echo $?
0

$ node packages/cli/dist/bin.js verify-entrypoint redblue --cmd npx @metaharness/redblue
verify-entrypoint: unexpected extra argument(s) ["@metaharness/redblue"] — did you
  forget to quote --cmd? usage: dream-machine verify-entrypoint <label> --cmd "<command>"
$ echo $?
1
```

All classifications match ground truth verified by hand tonight, including
the post-critique fix (last block: an unquoted `--cmd` is now a hard usage
error instead of silently truncating to a false "live" verdict).

## Darwin (bounded evolution)

Not run. There is no evolvable population for a single, already-minimal, pure
classification function with three closed-form output branches — bounded
Darwin's generations×children search space requires a mutable candidate
population, which a one-function utility with an exhaustive branch structure
doesn't meaningfully have. Recorded as `DARWIN=not-applicable`, not a stop
condition.

## Evidence

- OBSERVATION: `npx -y @metaharness/redblue <any arg>` → 0-byte stdout, 0-byte
  stderr, exit 0. Reproduced 7 times across different subcommands tonight.
- OBSERVATION: installed package source at
  `dist/cli/index.js` line ~489 uses `import.meta.url === \`file://${process.argv[1]}\`}`
  as its `isMain` guard.
- MEASUREMENT: `npm test` — 85/85 (baseline) → 95/95 (candidate), 0 regressions.
- INFERENCE: the `isMain` comparison fails specifically because `npx`/`npm`
  install the package's `bin` entry as a symlink, and `process.argv[1]`
  (argv path) vs `import.meta.url` (URL, resolved through the symlink)
  diverge in exactly the scenario documented in nodejs/node#57616 (Grade B,
  fetched directly).
- DECISION: ship the classifier + CLI command as a small, tested, orthogonal
  addition; do not attempt to patch `@metaharness/redblue` itself (out of
  repo scope — that's `ruvnet/agent-harness-generator`, not
  `ruvnet/dream-machine`).

## Reward-Hack Check

Independent critic (separate agent, not this candidate's author) reviewed the
diff for weakened tests, cherry-picked test cases, threshold tampering, gold
data changes, and command-injection exposure in the new `io.exec` surface.

**Verdict: CLEAR of reward-hacking** — no pre-existing test weakened, no
threshold/gold data touched, only the 5 intended files changed, all
additive. The classifier is general-purpose, not hard-coded to the redblue
string.

**Two real defects were found and fixed before this report was finalized**
(not silently dropped, not shipped as known-broken):

1. **False-positive footgun (fixed)**: an unquoted multi-word `--cmd` (e.g.
   `verify-entrypoint redblue --cmd npx @metaharness/redblue`, no quotes/`=`)
   let `--cmd` silently absorb only `npx` and drop `@metaharness/redblue` as
   an unexamined stray positional — running bare `npx` (prints its own usage,
   exits 0) then produced a false **`live`** verdict for the exact
   silent-failure class this tool exists to catch. Fixed by rejecting any
   extra positional as a hard usage error (`packages/cli/src/index.ts`);
   regression test added (`index.test.ts`, "rejects an unquoted multi-word
   --cmd..."); reverified live against the real `npx` binary tonight.
2. **Type-contract violation + unbounded buffer (fixed)**: `child_process.exec`'s
   maxBuffer-exceeded error sets `error.code` to a string
   (`ERR_CHILD_PROCESS_STDOUT_MAXBUFFER`), not a number, silently violating
   `ExecResult.code: number`; combined with no `maxBuffer` override, a
   verbose `bench: npm test` run could plausibly overflow Node's 1 MiB
   default and get misclassified `blocked` despite being genuinely live.
   Fixed: explicit 10 MiB `maxBuffer` + defensive `typeof err.code ===
   'number'` coercion (`packages/cli/src/bin.ts`).

**One real risk flagged, correctly left unfixed (out of scope tonight, not
silently dropped)**: `io.exec`/`child_process.exec` shells out an
unsanitized string with no allowlist. Not exploitable by tonight's diff
(`cmd` only ever comes from a human-typed CLI flag), but the critic
correctly identified that `dream.config.json#evaluatorEntrypoints` values
flow into the compiled nightly prompt (`packages/compile/src/index.ts`) and
`dream.config.json` itself sets `"autoMerge": true` — so the *natural* next
automation (auto-feeding `evaluatorEntrypoints` into `verify-entrypoint`)
would be piping a value from a file this same pipeline can modify into an
unsanitized shell exec. Recorded as a MUST-ADDRESS-BEFORE-AUTOMATING item in
the filed issue, not built or fixed tonight — building that automation was
never in scope for this candidate.

## Security Review

- **Tool/command-authority scope**: `io.exec` in `bin.ts` shells out via
  `child_process.exec` (uses `/bin/sh -c`). The `cmd` string is only ever
  supplied by a human/agent invoking `dream-machine verify-entrypoint
  <label> --cmd "<command>"` from a trusted local CLI session, or (in future
  wiring, not implemented tonight) read from `dream.config.json`'s
  `evaluatorEntrypoints`, which is a repo-committed, PR-reviewed file — never
  attacker-controllable input at runtime. No new remote/network attack
  surface is introduced tonight; this module does not read `evaluatorEntrypoints`
  automatically yet (candidate is CLI-invoked only, one conceptual change).
- **Credential exposure**: none — the module handles no secrets.
- **Prompt injection / cross-agent poisoning**: N/A — no LLM calls in this
  candidate.
- **Least privilege**: `io.exec` is optional on the `IO` interface (`exec?`),
  so every existing call site (tests, `compile`, `ledger`, `witness`, `tui`)
  is unaffected and requires no new capability.

## Scan Findings

**redblue** — `@metaharness/redblue`'s CLI is a complete silent no-op under
standard `npm`/`npx` bin-symlink invocation (see above). This is upstream,
out of this repo's scope to patch directly, but this repo's own
`dream.config.json` blindly documents the broken invocation as its
SCAN=redblue evaluator entrypoint — that documentation is now stale/misleading
until Notes tonight's finding is acted on (tracked in the filed issue, not
fixed tonight — fixing the config string doesn't fix the underlying tool).

**supply-chain** — `@metaharness/{flywheel,darwin,redblue}` are legitimate,
correctly-scoped, single-maintainer (`ruvnet`) npm packages (verified via
`npm view` + registry HTTP 200 on all three); no typosquat/dependency-confusion
risk found. The real supply-chain risk found tonight is *trust*, not
*identity*: this repo's evaluator wiring has no mechanism to detect that a
correctly-resolved, legitimately-published dependency's CLI silently does
nothing — exactly the gap the candidate closes.

## Competitors

| System | Evaluator/tool-liveness handling | Grade |
|---|---|---|
| Sakana AI "The AI Scientist" | Documents sandboxing unsafe self-modifying code (timeout extension incident); no documented subprocess-liveness check | B |
| OpenHands (OpenDevin) | Docker-sandboxed execution; third-party paper notes "anti-hacking measures disable network access" for outcome verification, not liveness detection specifically | C |
| SWE-agent / SWE-bench | Exit-code-based fail2pass validation; independent study (arXiv:2503.15223) reports ~0.90-0.93 precision, i.e. imperfect — exit code alone is known-lossy | C (secondhand, PDF unread) |
| DSPy/GEPA | Metric-based scoring with feedback; no documented tool-liveness/silent-failure detection | B (absence confirmed via official docs) |
| AutoGPT-lineage | Community failure catalog documents agents self-reporting false success with no independent liveness check | C |
| pytest (prior art, not a competitor) | Ships a dedicated exit code (5) specifically for "ran clean but did zero real work" — the closest existing prior art to tonight's `suspicious-silent` verdict | B |

## Gist

This report. Published as a local artifact (`/tmp/dream-gist-2026-08-13.md`,
committed into the PR as evidence) — no `gh gist create` tonight: this
session has GitHub API access via MCP tools for issues/PRs/branches, but no
gist-creation tool was available. `GIST=LOCAL`.

## Witness

`dream-machine witness stamp` hashes this exact file's raw bytes, so the
stamp cannot be written *inside* the file it stamps (editing the file after
hashing would invalidate the hash against the committed bytes — a
self-reference bug, caught while drafting this report). The stamp is
therefore computed over this file frozen exactly as it reads at this point,
and published instead in the PR description and the LEDGER.md row, both of
which point back at this file (committed at
`docs/dream-cycle/2026-08-13-security-adversarial-report.md`) by path and
session commit. Anyone can independently reproduce it:

```bash
sha256sum docs/dream-cycle/2026-08-13-security-adversarial-report.md   # REPORT_HASH
printf '%s%s' "$REPORT_HASH" "3de01079abe64e4a1f2d3fe3b758523705b3bf47" | sha256sum
# must equal the WITNESS value published in the PR body and LEDGER.md
```

## Recommendation

Human review of the draft PR. Two follow-ups explicitly NOT done tonight
(next-steps, not silently dropped):
1. Wire `evaluatorEntrypoints` from `dream.config.json` through
   `classifyEntrypointResult` automatically inside the compiled nightly
   prompt's STEP 5-9 guidance, so future nights get this check without
   remembering to invoke it by hand.
2. File an upstream issue against `@metaharness/redblue` (out of this repo's
   scope — different repo, `ruvnet/agent-harness-generator`) recommending
   the fix Node.js now ships natively: `import.meta.main` (stable-track,
   Node ≥22.18/24.2), replacing the broken `import.meta.url === file://argv[1]`
   comparison.
3. `docs/dream-cycle/LEDGER.md` rows 3-8 reference issues/PRs (#3, #4, #6, #9,
   #10, #12, #13, #15, #16, #18) and dates (2026-08-14 through 2026-08-19)
   that do not exist on GitHub and postdate tonight (2026-08-13) — confirmed
   via `mcp__github__list_issues`/`list_pull_requests` (0 real issues, only 5
   open dependabot PRs #1-5). These are seed/example rows, not real history.
   Not corrected tonight (out of scope for this candidate) but flagged so a
   future night doesn't try to "re-check the fate" of fictional issues.
