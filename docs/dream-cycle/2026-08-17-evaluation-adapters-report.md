# Evaluation-Adapters SOTA Report — 2026

**Repo**: `ruvnet/dream-machine` · **Night**: 2026-08-17 · **Rotation**: slot 2 (DAYINT % 5) → DEEP=`evaluation-adapters`, SCAN=`flywheel,darwin`. No bonus modulus (DAYINT % 25 = 17, % 75 = 17).

## TL;DR

Closed a real, previously-flagged security gap: `dream.config.json#evaluatorEntrypoints` (`bench`, `darwin`) was documentation only — a human had to manually retype each command into `verify-entrypoint --cmd "..."` to get a liveness classification. 2026-08-13's session (issue #6, ADR-0002) recommended auto-wiring the config through the classifier but explicitly deferred it, flagging that piping a config-sourced string into `child_process.exec` (a shell) first would be a real injection vector. Tonight ships that deferred work safely: a new `verify-entrypoints [config]` command tokenizes each configured command into an argv array and runs it via `execFile` (no shell), so shell metacharacters in a config value (`&&`, `$()`, `;`) become inert literal arguments instead of executable syntax. +170/−3 lines, 5 files, one conceptual change.

## What's new

- `tokenizeCommand()` (`packages/cli/src/entrypoint.ts`) — pure argv tokenizer (whitespace split + double-quote segments).
- `IO.execFile?(argv: string[])` — new optional IO capability, alongside the existing `IO.exec?(cmd: string)`.
- `dream-machine verify-entrypoints [config]` — reads `evaluatorEntrypoints` from a dream.config, tokenizes + `execFile`s each configured command, classifies via the existing (2026-08-13) `classifyEntrypointResult`, prints one line per entrypoint, exits with the worst verdict's code (0 live / 1 blocked / 2 suspicious-silent).
- `bin.ts` wires `execFile` via Node's `child_process.execFile` (promisified) — genuinely shell-free, not exec-with-escaping.
- The existing manual `verify-entrypoint --cmd` command (human-typed, shell-based) is untouched — the risk it carries was already assessed as acceptable in ADR-0002 (trusted local CLI flag, no config-sourced input) and stays that way.

## Competitor comparison (how other agent/eval harnesses execute config/tool commands)

| System | Execution model for evaluator/tool commands | Shell-injection surface | Grade |
|---|---|---|---|
| **OpenHands** | Full Docker container sandbox per session; all bash actions execute inside an isolated runtime reached via a REST `ActionExecutionClient`, not the host shell directly | Sandboxed at the container boundary, but NVIDIA's 2026 review of agentic sandboxing notes many frameworks (OpenHands included, per the review's general finding) only sandbox the *invocation-time* tool call — hooks/MCP-spawned local processes commonly run **outside** the sandbox | B (official docs + cross-checked NVIDIA technical blog) |
| **SWE-agent** | Shells test/build commands into a Docker container per task; the *container* is the isolation boundary, not command-string hygiene | Same class of host-shell risk this repo just closed, pushed down a layer (still string-built commands, just inside a container) | C (architecture recalled from public docs, not re-verified tonight) |
| **DSPy / GEPA** | Metric functions are **in-process Python calls** (`metric(gold, pred, trace=...)` → `Prediction(score=...)`), never shelled-out subprocesses | None — sidesteps this entire vulnerability class by not invoking a shell/process at all for scoring | A (official `dspy.ai` docs, fetched directly tonight) |
| **Sakana AI Scientist** | Runs generated experiment code inside a sandboxed execution environment (Docker-based, per the broader 2026 sandboxing literature for this class of system) | Isolation is container-level; known adjacent research (SandboxEval, RedCode, SandboxEscapeBench) shows container/orchestration misconfiguration remains the live attack surface for this whole system class | B (cross-checked across independent 2026 papers, not this repo's own measurement) |
| **AutoGPT lineage** | Historically shells tool commands with limited sandboxing by default; ecosystem has moved toward pluggable sandboxed executors | Highest surface of this group when run without an added sandbox layer | C (general/single-source recall) |

**Where this repo sits**: no container sandbox exists for `evaluatorEntrypoints` (out of scope tonight — that's a much larger, protected-path change per `.github/workflows/automerge.yml`'s own guard list). Tonight's fix is the cheapest correct primitive available at this repo's current scale: eliminate the shell layer itself for config-sourced commands, which is exactly the CWE-78 mitigation independently corroborated across multiple secure-coding sources tonight (SecureFlag, nodejs-security.com, ESLint `detect-child-process` rule docs — Grade B, cross-checked, non-fabricated).

## Frozen hypothesis (frozen before implementation, not modified after)

> Given `dream.config.json`'s `evaluatorEntrypoints` (`bench`, `darwin`) are config-only documentation requiring manual retyping into `verify-entrypoint --cmd`, when a new `verify-entrypoints` command reads the config and executes each entrypoint via `execFile` on a tokenized argv (never `exec`/a shell), then (a) every configured entrypoint classifies identically to its hand-verified ground truth with zero manual retyping, and (b) a config value containing shell metacharacters must never be shell-interpreted — subject to: no existing test changes, no change to the `bench: npm test` evaluator's own behavior, and the existing manual `verify-entrypoint` command stays untouched.

## Benchmarks / Evaluation

Real evaluator: `npm test` (vitest, this repo's own `bench` entrypoint). Baseline = parent commit `8ce385786faa5e63cc0e7105cc6e96f663a51f07` (`main`, "fix(config): opt darwin evaluator into `--sandbox mock` (#13)").

| | Baseline (8ce3857) | Candidate |
|---|---|---|
| Test files | 7 | 7 |
| Tests | 96 | 105 (+9, 0 removed, 0 modified) |
| Result | 96 passed | 105 passed |

`npm run typecheck`: pre-existing failure on **both** baseline and candidate (`tsconfig.json(1,12): TS18002: The 'files' list in config file ... is empty` — root `tsconfig.json` is `{"files":[],"include":[]}`, a references-only stub; `tsc -b` doesn't resolve project references here). Reproduced on baseline via `git stash` before candidate existed — pre-existing, not caused by tonight's candidate, not fixed tonight (out of scope). `npm run lint`: clean on candidate, 0 errors/warnings.

**Live receipt against this repo's real `dream.config.json` tonight:**
```
$ node packages/cli/dist/bin.js verify-entrypoints dream.config.json
bench: live (exit 0) — produced output
darwin: live (exit 0) — produced output
EXIT=0
```
Matches 2026-08-13's hand-verified ground truth for these two entrypoints exactly (`bench`→live; `darwin`'s command has since been fixed to `evolve --sandbox mock` by commit #13, upgrading it from that night's `blocked` — expected, a config fix landed since, not a regression in tonight's classifier).

**Live injection-safety receipt** (not a unit test — an actual subprocess run, reproducible):
```
$ cat evil.config.json
{"evaluatorEntrypoints":{"bench":"echo hi && touch PWNED"}}
$ node packages/cli/dist/bin.js verify-entrypoints evil.config.json
bench: live (exit 0) — produced output
$ ls PWNED
no - safe
```
`echo` printed `hi && touch PWNED` as **literal stdout** (correctly classified `live` — echo genuinely ran and produced output); no `PWNED` file was created. Had this route through `child_process.exec` (a shell), `&&` would have chained a second command and created the file. This is the concrete failure mode issue #6 flagged as a precondition for auto-wiring; it does not occur.

## Darwin Lineage

`DARWIN=not-applicable`. Ran `npx @metaharness/darwin evolve --sandbox mock` directly tonight as part of control-plane discovery (winner `g2_v5`, `+0.110` over baseline, `safety=1.00` throughout) — confirms the entrypoint itself is genuinely live and produces a real receipt, which is exactly what tonight's `verify-entrypoints darwin` line independently reports. No evolvable population for tonight's own candidate: `tokenizeCommand` is a single pure function with an exhaustive 2-branch grammar (quoted / unquoted token), same shape as 2026-08-13's classifier that also skipped Darwin.

## Evidence

- OBSERVATION: `dream.config.json#evaluatorEntrypoints` had no automatic wiring; `verify-entrypoint` required a human to copy the command string by hand (grade A, direct code read, `packages/cli/src/index.ts` pre-candidate).
- OBSERVATION: issue #6 (2026-08-13) explicitly named this as deferred follow-up work with an explicit precondition ("MUST be addressed... before anyone wires that automation") — grade A, this repo's own prior-night artifact.
- MEASUREMENT: `npm test` 96→105 passed, 0 regressions (grade A, this repo's own real evaluator, reproduced above).
- MEASUREMENT: live `verify-entrypoints` run against real `dream.config.json` — both entrypoints `live`, matching hand-verified ground truth (grade A, first-hand, reproduced above).
- MEASUREMENT: live injection-safety probe — malicious payload produced no side effect (grade A, first-hand, reproduced above).
- INFERENCE (grade B, cross-checked across 3 independent secure-coding sources tonight): `execFile` with an argv array is the standard CWE-78 mitigation for this shape of vulnerability, corroborating the design choice.
- DECISION: ship `verify-entrypoints` as additive-only; leave the manual `verify-entrypoint --cmd` path unchanged (its risk was already assessed and accepted in ADR-0002 for the human-typed-flag case).

## Reward-Hack Check

Independent critic pass (self-critique, disclosed — no second agent instance was spawned tonight; treated with corresponding lower confidence than a truly separate reviewer): only the 5 intended files changed (`entrypoint.ts`, `index.ts`, `bin.ts`, `entrypoint.test.ts`, `index.test.ts`), all additive (+170/−3), no existing test modified or removed, no gold data, no threshold, no evaluator-behavior change for `bench`. Checked for: benchmark weakening (no), gold-answer edits (no), cherry-picking (no — both configured entrypoints reported, not a subset), evaluator exploitation (no — `verify-entrypoints` is a new read-only-of-config classification tool, it doesn't touch `npm test`'s own execution), hidden cost (none — no new dependencies, no network calls beyond what the configured entrypoints themselves already make), threshold changes (none), undocumented caching (none — every `execFile` call is a fresh subprocess). One thing explicitly *not* fixed tonight, flagged as a known limitation: `tokenizeCommand`'s quoting support is minimal (double-quotes only, no escaping, no single-quotes) — sufficient for every command currently in this repo's own config, insufficient as a general shell-grammar parser; documented in the function's own comment rather than over-built for a need that doesn't exist yet.

## Security Review

New execution surface reads only a committed, human-reviewed config file (`dream.config.json` or an explicit path argument) — not runtime user input, not a remote source. The property being hardened: *if* that config is ever fed from a less-trusted source (repo-modifiable, per issue #6's original concern), or a future automation wires it into the compiled nightly prompt itself, the command no longer passes through a shell. No new credentials, no new network calls, no LLM calls (N/A for prompt injection). `execFile` resolves the target binary via `PATH` (confirmed live: `npm`, `npx` both resolved correctly) — same resolution behavior as the existing `exec` path, so no new binary-planting surface beyond what already existed.

## Scan Findings

**flywheel**: `npx @metaharness/flywheel` still has no `bin` field (reproduced tonight, same as 2026-08-13) — fails loudly and immediately, correctly classifies `blocked` when run through either `verify-entrypoint` or the new `verify-entrypoints`. Not present in this repo's current `dream.config.json#evaluatorEntrypoints` (only `bench`, `darwin` are configured), so tonight's live receipt doesn't exercise it directly — confirmed via the standalone command instead. No new finding beyond 2026-08-13's.
**darwin**: genuinely live tonight both directly (`npx @metaharness/darwin evolve --sandbox mock` → real leaderboard, winner `g2_v5`) and through the new `verify-entrypoints` wiring — config fix in commit #13 (`opt darwin evaluator into --sandbox mock`) resolved 2026-08-13's `blocked` (bad flag) classification, as expected; not a regression, a config improvement landing between nights doing exactly what it should.

## Witness

`dream-machine witness stamp` hashes this exact file's raw bytes, so the stamp cannot be written *inside* the file it stamps without invalidating itself (a self-reference bug caught and worked around on 2026-08-13, reused here). The stamp is computed over this file frozen exactly as it reads at this point, and published in the PR description and the LEDGER.md row, both pointing back at this file by path (committed at `docs/dream-cycle/2026-08-17-evaluation-adapters-report.md`) and session commit. Anyone can independently reproduce it:

```bash
sha256sum docs/dream-cycle/2026-08-17-evaluation-adapters-report.md   # REPORT_HASH
printf '%s%s' "$REPORT_HASH" "8ce385786faa5e63cc0e7105cc6e96f663a51f07" | sha256sum
# must equal the WITNESS value published in the PR body and LEDGER.md
```

## Recommendation

`evaluated: accepted` — human review of the draft PR. Concrete next steps:
1. Extend `verify-entrypoints` coverage to `flywheel`/`redblue` once/if this repo's own config adds them (no code change needed — the loop already iterates whatever `evaluatorEntrypoints` keys are present).
2. If `verify-entrypoints` is ever wired automatically into the compiled nightly prompt's own STEP 5-9 guidance (making tonight's tool self-referential), that wiring should itself go through this same `execFile` path, never `exec` — this report is exactly the citable precedent for that decision.
3. `tokenizeCommand`'s minimal quoting (documented limitation above) should gain single-quote + escape support *if and when* a real `evaluatorEntrypoints` value needs it — not preemptively.
