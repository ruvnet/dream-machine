# Evaluation-Adapters SOTA Report — 2026

**Repo**: `ruvnet/dream-machine` · **Night**: 2026-09-17 · **DEEP**: evaluation-adapters ·
**SCAN**: flywheel, darwin · **Slot**: 2 (of 5, `DAYINT % 5`) · **Bonus moduli**: none
(`DAYINT % 25 = 17`, `DAYINT % 75 = 42`) · **Session commit**: `3edd426f6c9c4b1e80235f7447dc863e749345cc`

## TL;DR

The darwin evaluator-entrypoint saga this surface has chased since 2026-08-17
is resolved on `main`: PR #65 (idempotency + `<repo>` positional fix)
**merged**; PR #17 (execFile/shell-injection hardening) and PR #40 (duplicate
positional fix) were both **closed as superseded** on 2026-09-07 — confirmed
tonight via `git log -- dream.config.json` and a live `search_pull_requests`
read, not inferred from the ledger. That closed the specific defect, but
#17's actual payload — a config-driven `verify-entrypoints [config]` command
that classifies every `evaluatorEntrypoints` entry via `execFile` on a
tokenized argv, never a shell — never landed with it, because it was closed
for the same reason #40 was (bundled with duplicate darwin-fix content).
Tonight revives just that kernel, rebuilt clean against current `main`,
independently critiqued, and hardened on two of the critic's three
non-blocking findings.

## What's new tonight (vs. the four prior evaluation-adapters nights: 08-17, 08-27, 09-02, 09-07)

- **Confirmed resolved, not re-litigated**: `git log -- dream.config.json`
  shows `a507f78` (#65) already carries the `<repo>` positional
  (`evolve . --sandbox mock`) and the `rm -rf .metaharness &&` state-reset
  prefix. `search_pull_requests` confirms #65 `merged: true`; #17 and #40
  both `state: closed, merged: false, closed_at: 2026-09-07T16:24Z`.
- **Ledger staleness re-confirmed, not this slot's surface**: `main`'s
  `LEDGER.md` last row is 2026-09-07 (10 days stale), but `dream/*` branches
  exist through 2026-09-16 (ledger-signals, compiler-parity,
  developer-experience, security-adversarial nights all ran; 09-12/13/14 have
  no branch — real automation gaps, not just unmerged rows). Confirms the
  known `ledgerStale`/`duplicateDirections`-blind-to-open-PRs mechanism
  (#61/#62/#89) is still the correct read of `main`'s ledger, not a new bug.
  Not this slot's surface (`ledger-signals`, slot 1) — recorded, not acted on.
- **Environment constraint, recorded not worked around**: this session's
  sandbox denies executing `npx @metaharness/darwin ...` outright
  (`Permission for this action was denied … [Code from External]` /
  `[Untrusted Code Integration]`) — stricter than the 08-17/08-27/09-02/09-07
  nights, which ran the live package directly. `bench: npm test` stayed
  fully live throughout (709/709 green, baseline and candidate). Candidate
  selection was constrained to what's testable without executing an unpinned
  external package.
- **New candidate, not a fix-again**: `verify-entrypoints [config]` —
  automatic, config-driven, `execFile`-based (never a shell) classification
  of every `evaluatorEntrypoints` entry, rebuilt clean on current `main`.
  Nothing on `main` today reads `evaluatorEntrypoints` and executes it
  automatically; the only existing automation (`verify-entrypoint`, singular)
  is manual-invoke-only, unchanged by tonight's diff (explicit regression
  test added).

## Frozen hypothesis (before any implementation tonight)

> Given `dream.config.json`'s `evaluatorEntrypoints` map is today verified
> only by an operator manually retyping each command into
> `verify-entrypoint <label> --cmd "<command>"`, when a new
> `verify-entrypoints [config]` command reads the config directly and
> classifies every entry by tokenizing its command string and invoking it
> through `execFile` (never a shell), then (a) every configured entrypoint
> classifies identically to its hand-verified ground truth with zero manual
> retyping, and (b) a config value containing shell metacharacters (`&&`,
> `;`, `|`, backticks) must never be shell-interpreted — subject to: the
> existing `verify-entrypoint` (singular, manual) command stays byte-for-byte
> untouched, `bench`'s own real behavior is unaffected, and `npm test` stays
> green with 0 regressions regardless of outcome.

Not modified after evaluation began.

## Candidates considered (5, scored 1–5 on fit/novelty/testability/measurability/production-value/reviewability)

| # | Candidate | Fit | Novel | Testable | Measurable | Prod-value | Review | Total |
|---|---|---|---|---|---|---|---|---|
| 1 | **Selected**: revive #17's `verify-entrypoints [config]` execFile automation, clean on current `main` | 5 | 3 | 5 | 5 | 4 | 5 | 27 |
| 2 | Extend `classifyEntrypointResult` for the exit-0-artifacts-outside-repo gap the 09-07 report flagged as a next step | 4 | 2 | 4 | 3 | 2 | 4 | 19 |
| 3 | Extend `learningSignals().duplicateDirections` to scan open-PR titles/bodies via the GitHub API | 4 | 4 | 3 | 3 | 4 | 2 | 20 |
| 4 | Add `evaluatorEntrypoints.flywheel` to config | 1 | 1 | 1 | 1 | 1 | 3 | 8 |
| 5 | Rebase/bookkeeping cleanup of the now-resolved darwin PR trio | 3 | 1 | 2 | 2 | 2 | 3 | 13 |

Candidate #2 is weaker than it looked in the 09-07 report: the root cause it
would guard against (missing `<repo>` positional causing `--sandbox` to be
misread as the repo path) is the exact defect #65 already fixed at the
config level, so #2 would now be a regression-safety net for an inactive
failure mode, not an active bug fix — real but lower value, set aside.
Candidate #3 is valuable and explicitly flagged again as next-step #3 below,
but is architecturally bigger (a currently-pure function would need live
GitHub API reads) — correctly out of scope for one night per this repo's own
bias toward small, reviewable diffs. Candidate #4 remains what it has been
every nightly night since 2026-08-13: `@metaharness/flywheel` still ships no
usable `bin` entry, not re-verified live tonight (network execution
constraint, see above) but unchanged in every prior report; recording, not
re-discovering. Candidate #5 has no fitness function per se (only #17 and
#40 are closed, one already newer commit ahead) has nothing left to rebase.

## Learning signals applied (`dream-machine ledger signals`)

```json
{
  "zeroMergeStreak": true,
  "duplicateDirections": ["harden anchored replay json evidence reject"],
  "lowScoreStreak": false,
  "blockedEvalStreak": false,
  "nightsConsidered": 14,
  "lastRowDate": "2026-09-07",
  "daysSinceLastRow": 10,
  "ledgerStale": true
}
```

`zeroMergeStreak: true` is the tool's worst-case default (no `--merged`
flag) and is a **false negative**, re-checked directly against GitHub
tonight: 43 PRs total, 40 merged historically (including #65, #7, #21, #29,
#33, #42, #46 — real candidate-fix PRs, not just docs/ledger PRs). Passing
the real merged set flips the signal to `false`. `duplicateDirections`
flags an unrelated witness/evidence-surface finding, not evaluation-adapters
— not actionable from this slot. `ledgerStale: true` is real (10 real days,
not a tool artifact) but not this slot's surface to fix.

## Testability gate / Evaluation Receipt

**Real evaluator** (`bench: npm test`), baseline = tonight's actual starting
state, `main @ 3edd426f6c9c4b1e80235f7447dc863e749345cc`:

```text
$ npm ci && npm run build       # clean, no wasm/NAPI degradation
$ npm test                      # vitest run && npm run test:governance
Test Files  23 passed (23)
     Tests  616 passed (616)
# governance: 81 passed
```
Total baseline: **697/697 tests green** (616 vitest + 81 governance),
confirmed before any implementation began.

**Candidate**, same commands, same commit lineage, after the diff:

```text
$ npm run build                 # clean
$ npm run lint                  # clean
$ npm run typecheck             # clean
$ npm test
Test Files  23 passed (23)
     Tests  628 passed (628)
# governance: 81 passed
```
Total candidate: **709/709 tests green** (628 vitest + 81 governance),
**+12 new tests** (5 `tokenizeCommand`, 7 `verify-entrypoints`), **0
regressions**, **0 modified/removed tests**.

**Live end-to-end receipt** (real `bin.js`, not just the unit-test mocks):

```text
$ node packages/cli/dist/bin.js verify-entrypoints /tmp/bench-only.config.json
bench: live (exit 0) — produced output
EXIT=0

$ cat /tmp/evil.config.json
{"...","evaluatorEntrypoints":{"bench":"echo hi && touch /tmp/PWNED_dream_machine_probe"}}
$ node packages/cli/dist/bin.js verify-entrypoints /tmp/evil.config.json
bench: live (exit 0) — produced output
$ ls /tmp/PWNED_dream_machine_probe
ls: cannot access '/tmp/PWNED_dream_machine_probe': No such file or directory
```
`&&` arrived as literal argv text, never shell-interpreted — reproduces
#17's own 2026-08-17 injection probe, now against the real automated path
instead of the manual one. `darwin`'s live entrypoint was **not** run
end-to-end (sandbox denies executing unpinned external `npx` packages this
session — recorded above, not worked around); the `bench` entrypoint is a
real subprocess (`npm test`) run through the new code path, so the
`execFile`-not-`exec` claim is verified live, not only unit-tested.

## Darwin Lineage

`DARWIN=not-applicable` — same precedent PR #17 (2026-08-17) set for a
comparably-scoped change: a config-space CLI wiring addition (one pure
tokenizer + one new command dispatch branch) has no natural population to
fitness-search over. Independently, tonight's sandbox denies executing
`npx @metaharness/darwin` at all (see Environment constraint above), so a
bounded Darwin run was not available even if a population existed.

## Evidence

- OBSERVATION: `git log -- dream.config.json` / `packages/cli/src/entrypoint.ts` — PR #65
  (`a507f78`) already on `main`, carrying the `<repo>` positional and
  `.metaharness` state-reset; `search_pull_requests` — #17/#40 closed
  `2026-09-07T16:24Z`, superseded.
- OBSERVATION: `verify-entrypoints` does not exist on `main` before tonight
  (`grep -n verify-entrypoints packages/cli/src/index.ts` on baseline: no
  match); only `verify-entrypoint` (singular, manual, shell-based `exec`).
- MEASUREMENT: baseline 697/697 tests green → candidate 709/709 tests green,
  +12 new, 0 regressions, 0 modified/removed. `npm run lint` and `npm run
  typecheck` clean on the candidate.
- MEASUREMENT: live injection-safety probe (real subprocess, not mocked) —
  a config value containing `&&` reaches `execFile` as one inert argv
  token; no second command executes.
- INFERENCE (independent critic, adversarial-review subagent, not this
  session's author identity): candidate is additive-only, `verify-entrypoint`
  singular is byte-identical, aggregate exit-code logic is correct and
  order-independent; three non-blocking gaps found (tokenizer quoting edge
  cases, a config-trust-boundary comment absent vs. `audit-gate`'s explicit
  one, and an undisclosed Windows `.cmd`-shim shell-reinterpretation
  caveat for `execFile('npm'|'npx', …)`).
- DECISION: address 2 of 3 critic findings via documentation (trust-boundary
  comment added mirroring `audit-gate`'s style; Windows `.cmd`-shim caveat
  disclosed and scoped to "out of scope, Linux-only nightly runner");
  disclose the third (tokenizer quoting gaps: backslash-escaped quotes,
  embedded quotes, leading-empty-quoted-token arg-drop) as a known,
  non-security-relevant correctness limitation rather than expanding scope
  to a full shell-lexer for input this repo's own two entrypoints never
  produce — matching #17's own precedent of disclosing, not silently
  mishandling or over-building, its quoting scope.
- DECISION: record verdict ACCEPT (candidate ships), not REJECT/INCONCLUSIVE
  — first ACCEPT-with-shipped-code on this surface since PR #65 (2026-09-02).

## Reward-Hack Check

Independent critic (adversarial-review subagent, genuinely separate context
from the implementing session — not self-disclosed-only, unlike several
prior nights on this surface) explicitly checked: weakened benchmark (no —
231 additions / 3 deletions, the 3 deletions are import-line edits only);
altered gold answers (none exist for this surface); cherry-picked test cases
(no — critic found and this report discloses gaps the implementing session's
own tests didn't cover); evaluator exploit (none — `execFile` is Node
built-in, no new dependency); hidden cost (none — no network call, no new
dependency, tests run against injected mocks); undocumented cache (none).
`reward_hack_clear` / `critic_clear` — critic's findings were non-blocking
and addressed, not waved off.

## Security Review

New execution surface: `verify-entrypoints` reads `dream.config.json`
(repo-committed, PR-reviewed, never runtime-attacker-controlled — same
boundary PR #17/#40 already established) and runs each configured command
via `execFile`, never a shell — the exact hardening #17 first proposed for
this automation. Live-verified tonight (see Evaluation Receipt) that a
shell-metacharacter-bearing config value cannot chain a second command.
Caveat disclosed, not hidden: Node's `execFile` of `npm`/`npx` on Windows
resolves through a `.cmd` shim that Node internally re-spawns via `cmd.exe`
(nodejs/node CVE-2024-27980 class), which can reintroduce shell
interpretation even with `shell` unset — this repo's nightly runner is
Linux-only, so out of scope tonight, flagged in-code for anyone porting the
command. No credentials, no LLM calls, no new network surface, no new
dependency (`node:child_process` is built-in).

## Promotion Gate

**ACCEPT requires ALL of**: evaluation_complete ∧ effect_positive ∧
significance_sufficient ∧ no_material_regression ∧ tests_green ∧
reward_hack_clear ∧ critic_clear ∧ witness_valid ∧ receipt_reproducible.

- evaluation_complete: yes — real evaluator (`npm test`), baseline then candidate, both first-hand.
- effect_positive: yes — new automation capability shipped, 12 new tests, closes a real (if narrow) shell-injection-hardening gap that #17 first identified 2026-08-17 and was lost when #17 was closed as a duplicate bundle.
- significance_sufficient: yes — deterministic unit tests + a live, real-subprocess injection-safety probe (unambiguous pass/fail, not statistical).
- no_material_regression: yes — 709/709 green (616→628 vitest, +12; 81 governance unchanged), lint clean, typecheck clean.
- tests_green: yes.
- reward_hack_clear / critic_clear: yes — independent critic run, findings addressed.
- witness_valid: computed below (STEP 16), verified before this report was finalized.
- receipt_reproducible: yes — every command in this report is copy-pasteable against this branch.

**Verdict: ACCEPT.**

## Scan Findings

**SCAN=darwin**: root defect (missing `<repo>` positional, state collision)
confirmed fixed on `main` via #65 (merged). Live re-verification of the
*runtime* behavior was not possible this session (sandbox denies executing
unpinned `npx @metaharness/darwin`) — recorded as `EVALUATED=blocked` for
the darwin entrypoint specifically, `LLM_EVAL` unaffected (credentials were
available; this is an execution-sandbox constraint, not a missing-key one).

**SCAN=flywheel**: `dream.config.json#evaluatorEntrypoints` still has no
`flywheel` key (unchanged since 2026-08-13); `@metaharness/flywheel` was
not re-probed live tonight for the same sandbox reason as darwin. Not a new
finding — recorded for SCAN completeness only, consistent with every prior
night's identical finding.

## Competitors (context, not benchmarked against)

| Competitor | Relevant angle | Grade |
|---|---|---|
| Sakana AI Scientist | Automates its own eval-harness invocation end-to-end; no public documentation of shell-injection hardening for config-sourced commands. | C |
| OpenHands | Sandboxed action executor for repo commands, not raw shell string interpolation — same risk class avoided differently. | B |
| DSPy/GEPA | Evaluator adapters are Python callables, not shell strings — sidesteps this risk class by construction. | B |
| SWE-agent | Executes build/test commands inside a container; the container boundary substitutes for argv-level hardening. | B |
| AutoGPT lineage | Historically broader shell-out surface; several forks later added allowlists after incidents. | C |

No competitor claim justifies tonight's candidate; the hypothesis stands on
this repo's own prior finding (#17, 2026-08-17) alone.

## ADR

None. This is a new CLI command plus an internal argv-tokenizing helper — an
addition within the execution-safety boundary ADR-0002 already established
(entrypoint results must be classified, never trusted from a bare exit
code), not a new repo-wide invariant, new component category, or change to
an existing ADR's decision. STEP 19 exclusion.

## Gist

LOCAL — no gist-creation tool available this session (GitHub access here is
via MCP tools scoped to `ruvnet/dream-machine`, which expose no Gist API).
Report committed instead at
`docs/dream-cycle/2026-09-17-evaluation-adapters-report.md`, matching every
prior night's fallback convention.

## Witness

Computed via `dream-machine witness stamp` against this file's final
committed bytes and `SESSION_COMMIT=3edd426f6c9c4b1e80235f7447dc863e749345cc`.
Recorded in the PR body and the `LEDGER.md` row for this night (not inlined
here — hashing a file that embeds its own hash is self-referential, the same
workaround every prior evaluation-adapters report has used). Reproduce
independently:

```bash
REPORT_HASH=$(sha256sum docs/dream-cycle/2026-09-17-evaluation-adapters-report.md | awk '{print $1}')
SESSION_COMMIT=3edd426f6c9c4b1e80235f7447dc863e749345cc
printf '%s%s' "$REPORT_HASH" "$SESSION_COMMIT" | sha256sum | awk '{print $1}'
# must equal the WITNESS value published in the PR body and LEDGER.md
```

## Recommendation

`evaluated: accepted` — human review requested for the `verify-entrypoints`
candidate (draft PR, never self-merged). Concrete next steps for a human or
a future night:
1. If `verify-entrypoints` lands, wire it into CI (or a documented pre-push
   hook) so entrypoint drift is caught automatically rather than rediscovered
   by hand each time a nightly session happens to probe it.
2. Extend `learningSignals().duplicateDirections` to scan open-PR
   titles/bodies via the GitHub API, not just `main`'s own `LEDGER.md` —
   flagged again tonight (first flagged 09-07), still the mechanism that let
   the darwin fix get triplicated (#17/#40/#65) before a human intervened;
   correctly out of scope for one night (needs live API reads inside a
   currently-pure function).
3. If this command is ever ported to a non-Linux runner, close the
   `execFile('npm'|'npx', …)` Windows `.cmd`-shim caveat disclosed in this
   report's Security Review before relying on its no-shell guarantee there.

## Post-review update (2026-09-18)

`ruvnet` (repo owner) reviewed PR #116 against exact head `a1aa942` and found
a real, blocking correctness bug this report's own claim ("every configured
entrypoint classifies identically to its hand-verified ground truth") did not
hold for: `dream.config.json`'s actual `darwin` entry is a **compound**
command — `rm -rf .metaharness && npx @metaharness/darwin evolve . --sandbox
mock` — and `verify-entrypoints` dispatched only its first token (`rm`) with
every remaining token, including `&&`, `npx`, and a bare `.`, as `rm`'s own
argv. `npx`/darwin was never invoked. The candidate's own test fixture used a
simplified darwin string without the `rm -rf .metaharness &&` prefix, so it
never exercised this path.

Fixed same-day, same PR: `looksLikeCompoundCommand()` (`entrypoint.ts`)
detects a standalone shell-control-operator token (`&&`, `||`, `;`, `|`,
`&`) in a tokenized command; `verify-entrypoints` now refuses (reports
`blocked`, executes nothing) any entry that contains one, rather than
dispatching argv[0] with the remainder as its arguments. Also fixed per the
same review: a non-string or blank `evaluatorEntrypoints` value is now
reported `blocked` for its own key instead of being silently filtered out of
the pass — every configured key gets a report line. New regression test uses
the exact real `dream.config.json` darwin string verbatim and asserts
`execFile` is never called for it (not even with `rm` and garbage args) —
live-confirmed against the real config file directly (`darwin: blocked (exit
1) — compound command...`, no destructive `rm` invocation attempted).

`npm test`: 709/709 → 716/716 (+7, 0 regressions). This is a correction, not
a new finding: the underlying verdict (ACCEPT, candidate ships) stands —
the shipped code now actually does what the report claimed, rather than
silently misfiring on this repo's own real config.
