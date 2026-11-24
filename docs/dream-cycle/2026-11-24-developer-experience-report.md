# Developer Experience SOTA Report — 2026

Dream Cycle 2026-11-24 · DEEP=`developer-experience` · SCAN=`cli`,`tui` · SLOT=4 (`20261124 % 5 == 4`)
MODE=`RESEARCH-ONLY` (STEP 1.5): 19 open `dream/*` candidate PRs tonight (well over
`implementationTrack.reviewBacklogLimit=6`, ground-truthed via `search/issues`:
42 merged / 8 closed-unmerged / 19 open → `pipelineMergeRate=0.618`,
`reviewBacklogSize=19`). Checked every draft, non-`routine-self-review` PR in
`created_at` order: #98/#101 are multi-repo portfolio branches, excluded by
unbroken precedent (not single-surface candidates in the sense this mode
means); #161, #189 and #192 are each still draft with `ACCEPT` in their own
Evaluation Receipt, but every one of them already carries a
`<!-- dream-consolidate: 71d607bea6608180b8c41980dc5386526d3f1f16 -->` marker
for tonight's exact default-branch SHA (#161 from 2026-11-10, #189 from
2026-11-18, #192 from 2026-11-23 — `main` has not moved since #209 landed on
2026-11-10). No eligible draft remains, so per STEP 1.5 rule 2 tonight opens
no new candidate PR and no new consolidation: full deep research only, with
the finding recorded `evaluated=no` into the implementation backlog.

## TL;DR

`packages/cli/src/index.ts`'s own `stringFlag()` helper — added in PR #161
(2026-10-09) specifically to make a bare, value-less flag (e.g. `--out` with
nothing after it) fail with a clear `error: --X requires a value` instead of
silently becoming the boolean `true` — was applied to only 10 of the ~22
call sites that share the exact same unguarded idiom, `flags.X as string |
undefined`. Two independent consolidation-night critics (2026-10-30 and
2026-11-23, on PR #161 and PR #192 respectively) already live-reproduced
concrete instances of the remaining gap and disclosed them in PR comments,
but **no issue has been filed for the gap itself** — only the original,
narrower issue #160 exists, scoped to the 10 sites #161 already converts.
Tonight's architecture review enumerates the full remaining surface (9
distinct call sites, 3 previously undisclosed) and finds the failure mode is
not uniform: it ranges from silent artifact corruption, to an uncaught
`TypeError` crash, to a misleading non-usage-error exit — worse than the
single "silently writes `true`" framing either prior critic used. This is
the same whack-a-mole pattern PR #161's own two consolidation rounds already
demonstrated for the original 10 sites' near-neighbors: patching sites one
at a time, found by a critic each round, is not converging. Tonight's
candidate (not implemented — RESEARCH-ONLY) proposes moving arity ownership
into the parser itself, the same place established CLI libraries put it.

## What's New (vs. the 2026-09-19/2026-08-29/2026-08-19 developer-experience reports)

Prior developer-experience nights fixed independent, single-function bugs
(`tui.ts` Unicode width, `verdictStats().other` not rendered, ledger
`--verdict`/`--evaluated` enum validation). This is the first
developer-experience night whose own prior-night output (PR #161, itself a
developer-experience-surface fix) is the subject: the fix shipped a reusable
guard but did not reach every call site it was named after, and two later
*consolidation* nights (not developer-experience slots) already caught and
disclosed instances of this without ever being able to act on it — STEP
1.5's CONSOLIDATE mode re-evaluates the existing diff, it cannot open a new
one. Tonight is the first developer-experience slot to land on this surface
since PR #161 shipped, so it is the first opportunity to turn those two
disclosures into a tracked, scoped finding rather than leaving them stranded
in PR comments that nobody but this ledger's own night-to-night memory will
ever re-read.

## Architecture Review (live, this session)

`grep -n "as string | undefined\|as string)" packages/cli/src/index.ts`
against tonight's exact head (`71d607b`) finds the unguarded idiom still
live at 9 call sites `stringFlag()` never reached, each independently
checked for its actual runtime behavior on a bare flag (`node
packages/cli/dist/bin.js <cmd> --flag` with nothing after `--flag`):

| Site | Behavior on bare flag (live-confirmed tonight) | Failure class |
|---|---|---|
| `schedule --env` (×2 read sites, `index.ts:336,342`) | Bakes `"environment_id": true` into the compiled routine body / `scheduleInstructions` text | **Silent artifact corruption** (already disclosed, PR #161 2026-10-30 comment) |
| `witness verify-report --commit` (`:485`) | `expectedCommit = true`; always mismatches a real SHA string → spurious `INVALID` verdict even for a genuinely valid report | **Silent false-negative** (newly found tonight) |
| `verify-entrypoint --cmd` (`:506`) | `!cmd` is `false` (bare flag is truthy) so the usage check is bypassed; `io.exec(true)` is called with a boolean, not a command string | **Misleading non-usage exit** (already disclosed, PR #161 2026-11-10 comment) |
| `audit-gate --path` (`:621`) | `!path` bypassed; `io.readFile(true)` throws inside a try/catch that reports a generic "could not read/parse" error, masking that the real problem is a missing flag value | **Confusing (non-clear) error** (newly found tonight) |
| `freshness stamp --base`/`--paths` (`:673-674`) | Both checks bypassed (truthy); `pathsFlag.split(',')` on a boolean throws an **uncaught** `TypeError: pathsFlag.split is not a function` | **Uncaught crash** (newly found tonight — worse than #161/#192's disclosed instances, which were all non-crashing) |
| `freshness stamp --out` (`:711`) | `io.writeFile(true, doc)` — behavior is I/O-backend-dependent, uncaught in the real `node:fs`-backed CLI | **Uncaught crash / undefined I/O behavior** (newly found) |
| `freshness verify --policy`/`--head` (`:722-723`) | Both checks bypassed; `io.readFile(policyPath)` with `policyPath === true` throws uncaught | **Uncaught crash** (newly found) |
| `ledger dashboard --repo` (`:799`) | `repo: true` passed straight into `renderDashboard`'s options | **Silent artifact corruption** (newly found) |

Contrast: `parsePendingFindings()` (`:127`, used by `ledger signals
--pending`) is the one site in the file that *does* defend against this —
its signature is explicitly `raw: string | boolean | undefined` and it
returns `undefined` for a non-string input rather than ever treating `true`
as data. It was written correctly from the start (2026-08-26, PR #33),
before `stringFlag()` existed, by a different, narrower mechanism (a type
guard at the call site) — proof this repo already independently arrived at
"never trust `flags.X` to be a string without checking" once; the gap is
that the lesson was applied locally, not structurally.

## Competitor / Prior-Art Rows (how other agentic dev tools' own CLIs own flag arity)

| Project | How it handles a flag given with no value | Grade | Relevance |
|---|---|---|---|
| Sakana AI Scientist, OpenHands, SWE-agent, AutoGPT lineage | All four surface their CLI via Python `argparse` (or a thin wrapper over it) for the entry scripts that drive agent runs; `argparse`'s `action='store'` (the default) raises `error: argument --X: expected one argument` and exits 2 *before any application code runs* when a flag is given with nothing after it — this is `argparse` library behavior, not something each project wrote itself | B (standard-library documented behavior, not independently reproduced against each project's exact CLI tonight) | The comparison that matters: these four projects get fail-closed arity checking for free from their parser choice; `dream-machine`'s hand-rolled ~20-line `parseArgs()` (`index.ts:93-115`) does not enforce arity at all — every call site is individually responsible, which is exactly the class of bug tonight catalogs |
| DSPy / GEPA | CLI entry points are thin and mostly used as library code from Python scripts/notebooks rather than a flag-heavy CLI surface; where a CLI exists it is also `argparse`-based | C (general ecosystem knowledge, not reproduced tonight) | Same free-fail-closed-arity property as the row above, for the same underlying reason (parser choice, not a deliberate CLI-UX decision this project made) |
| clap (Rust, the reference implementation for "value_parser" design) | A flag declared to take a value (no `.action(ArgAction::SetTrue)`) that appears with nothing after it is a parse error raised by the derive macro's generated code, before `main()`'s logic runs; `TypedValueParser`/`value_parser!` bind the value's *type* to the flag's *declaration site*, not to each read site | A (official docs, reproducible from the published cookbook example) | Names the exact architectural fix tonight's candidate proposes: arity and type belong with the flag's *declaration*, once, not scattered across every place it's read |
| 2026-era typed TypeScript CLI frameworks (Stricli/Bloomberg, cmd-ts, Effect CLI) | Each independently converged on moving flag type/arity declaration out of the handler body and into a single typed schema/signature the framework itself enforces before the handler runs | B (official docs/vendor blog posts, not independently benchmarked against each other) | Three unrelated TypeScript projects reaching the same structural conclusion in the same ~18-month window is itself evidence this is the current default direction for CLI design in this exact language, not an idiosyncratic choice |
| POSIX.1-2024 (Issue 8), Base Definitions §12.2 Utility Syntax Guidelines | Guideline 7: "Option-arguments should not be optional." The standard's own rationale for `getopt()` requires that when a mandatory option-argument is absent, the utility "shall behave as specified in its description for an omitted option-argument" — i.e., the omission must be handled explicitly, by design, not fall through to undefined behavior | A (official standard text, directly quoted) | Fifty years of POSIX practice agrees with clap/Stricli/cmd-ts on the *outcome* (a missing option-argument must be a defined, not an accidental, behavior) even though POSIX predates all of them — this is not a fad, it is the oldest and the newest sources agreeing |

No "none" row was needed — all five rows have direct prior art.

## Candidates (5, scored 1–5: fit / novelty / testability / measurability / production-value / reviewability)

1. **Finish the whack-a-mole**: apply the existing `stringFlag()` helper to
   the remaining 9 sites, one by one, as PR #161's two consolidation critics
   already started to do piecemeal. **5/1/5/5/3/5.** Internal-only (no
   external technique). Lowest risk, smallest diff — but this is the
   *third* time this exact approach has been tried on this exact file
   (original PR #161, then independently re-found in the 2026-10-30 and
   2026-11-23 consolidation rounds) and each time a critic found the
   previous round's site-enumeration incomplete. Nothing about doing it a
   fourth time changes why the first three were incomplete.
2. **Adopt a typed CLI framework wholesale** (Stricli or cmd-ts): replace
   `parseArgs()`/the `switch (cmd)` dispatcher with a framework that infers
   flag types from the handler signature. **2/4/3/3/4/1.** Imports an
   external technique (2026-era TypeScript CLI design). Fails the <300-line
   target badly — this touches all 22 command branches plus adds a runtime
   dependency to a package that currently has none, a far larger
   "conceptual change" than one finding should be.
3. **Require `--flag=value` syntax for every string flag** (POSIX-guideline
   literalism: eliminate the "did the user forget the value" ambiguity by
   banning the space-separated form for flags prone to this). **2/2/4/4/2/3.**
   Imports an external technique (POSIX Guideline 7 read maximally
   strictly). Breaks every existing invocation documented in `HELP`, every
   CI workflow, and every PR body in this repo's own ledger that uses
   `--path LEDGER.md` space-separated form — a real backward-compatibility
   regression for a cosmetic standards purity gain.
4. **Per-flag typed combinator declared at each command's flag list**
   (lightweight internal primitive modeled on cmd-ts/Effect CLI's "the type
   lives with the declaration" principle, but hand-rolled, zero new
   dependency): each command declares e.g. `requireString(flags, 'env')`
   inline at the top of its case block, replacing the raw cast. **4/4/5/5/5/3.**
   Imports an external technique (type-driven flag declaration). Closes the
   whole class in one pass since every site is touched mechanically by the
   same search-and-replace, but the diff still only recovers to "slightly
   newer whack-a-mole" — arity knowledge still lives at 22 separate call
   sites, just now expressed identically at each one instead of
   inconsistently.
5. **Move arity ownership into `parseArgs()` itself**: pass `parseArgs()` a
   declared set of flag names this invocation's command expects as
   string-valued (or, conservatively, check this once immediately after the
   call, before the `switch`, using a small per-command manifest), so a
   bare flag that's declared string-valued throws/returns a structured
   error *before* any handler logic runs at all — mirroring clap's
   `TypedValueParser` and `argparse`'s `action='store'` default.
   **5/3/5/5/5/4.** Imports an external technique (parser-owns-arity, the
   one point of convergence across clap, argparse, Stricli, cmd-ts, Effect
   CLI, and POSIX's rationale text). Smallest diff that closes the *entire*
   class structurally: callers that currently do
   `flags.X as string | undefined` simply stop needing the cast, because
   the parser guarantees it by the time the handler runs.

**Selected: Candidate 5**, over Candidate 4 (the closer runner-up) because
root-causing arity at the parser is strictly smaller than redeclaring it at
every one of 22 sites, and over Candidate 1 because three rounds of
Candidate 1 already measurably failed to converge on this exact file.
Candidates 2 and 3 lost on reviewability/compatibility as scored above.

## PASS 2 — Deepen (top 2: Candidates 5 and 4)

**Candidate 5 — parser-owned arity.**
*Algorithm*: `parseArgs(argv, { stringFlags: Set<string> })` (signature
addition, default empty set = fully backward compatible with every existing
call site that doesn't pass it). When flag `a.slice(2)` is in `stringFlags`
and the next token is absent or itself starts with `--`, `parseArgs` returns
a structured `{ error: { flag, reason: 'missing-value' } }` discriminant
instead of silently writing `true`. Each `case` block passes its own
command's string-flag-name list (already enumerable exhaustively from
tonight's architecture review) and checks the discriminant once, immediately,
with one shared error-formatting helper — replacing ~22 individual `as
string | undefined` casts with ~22 one-line declarations of *which flags are
string flags*, which is data, not logic.
*Complexity*: O(flag count) per invocation, identical to today.
*Failure modes if implemented carelessly*: a flag name present in two
commands with different arity (string in one, boolean in another — audited
tonight, none currently exist, but the manifest must be per-command, not
global, or a future addition could silently inherit the wrong arity); a
real boolean flag (`--no-color`, `--help`, `--version`) must never appear in
a command's `stringFlags` set, since `--no-color` is correctly read via
`flags['no-color'] === true` (`:797`) and would break if coerced.
*Baseline/metric/threshold*: baseline = today's 9 catalogued failure
instances (1 TypeError crash class ×3 sites, 1 confusing-non-usage-error
class ×1 site, 1 silent-corruption class ×3 sites, 1 silent-false-negative
class ×1 site, 1 already-fixed-by-#161 class as the non-regression check);
metric = all 9 produce an identical, clear `error: --X requires a value`
exit-1/2 message with zero state written; threshold = 0 regressions on the
10 sites #161 already fixed, 0 behavior change on every real boolean flag.

**Candidate 4 — per-site typed combinator** (runner-up, for contrast).
*Algorithm*: a `requireString(flags, name, usage): string` helper (an
evolution of PR #161's own `stringFlag()`, generalized with a usage-string
parameter) called inline at each of the 22 sites. *Complexity*: identical
O(flag count), but arity knowledge is duplicated 22 times instead of
declared once. *Failure mode*: identical bug class risk as Candidate 1 if a
23rd command is added later and its author doesn't know the convention
exists — Candidate 5's manifest-at-`parseArgs()` approach is at least
discoverable by reading one function's signature; Candidate 4's convention
is discoverable only by reading an existing call site and copying it, the
exact discovery path that produced today's 9-of-22 gap in the first place.

## PASS 3 — Attack (independent critique of Candidate 5)

- **Already solved here?** No — only 10/22 sites; this is the first
  proposal to fix it at the parser rather than at call sites.
- **Falsifiable?** Yes: for each of the 9 catalogued sites, a before/after
  CLI invocation with the bare flag either still corrupts/crashes
  (falsified) or produces the clear usage error (confirmed).
- **Gameable?** Low surface — pure argument-parsing logic, no evaluator,
  benchmark, or gold-answer contact.
- **Leaks evaluation data?** No.
- **Simpler alternative?** Candidate 1 (whack-a-mole) is simpler per-PR but
  has a *proven, measured* non-convergence track record on this exact file
  (three independent discovery rounds, each finding the prior round's site
  list incomplete) — "simpler" here is not "sufficient," which is itself
  the critique's strongest point against it.
- **Survives adversarial/scale input?** The critical adversarial case is a
  real boolean flag being misdeclared as string-valued (or vice versa) in
  the per-command manifest — this is a real, disclosed risk for any
  implementation night, **not a reason to reject the architecture**, but a
  concrete acceptance-test requirement: an implementation must include a
  negative-control test enumerating every currently-boolean flag
  (`--no-color`, `--help`, `--version`, bare `--merged`/`--open-count` on
  `ledger dashboard` which are read via `parseMergedPrNumbers`/
  `parseOpenCandidateCount` — both already defensively typed like
  `parsePendingFindings`, confirmed tonight) and asserting none of them is
  present in any command's `stringFlags` set.
- **Verdict**: survives. Disclosed as a required acceptance test for
  whichever future night implements this, not a blocker for proposing it.

Grade note: every external claim above is graded A/B/C per source in the
competitor table; none is C-grade-alone-justifying-implementation — the
live architecture review (grade A, reproduced this session) is the
independent confirmation this finding stands on, with the external sources
providing the *design direction*, not the evidence the bug exists.

## Hypothesis (frozen before this report's Evidence/Security sections)

> Given `packages/cli/src/index.ts`'s 9 remaining unguarded `flags.X as
> string | undefined` call sites (`schedule --env` ×2, `witness
> verify-report --commit`, `verify-entrypoint --cmd`, `audit-gate --path`,
> `freshness stamp --base`/`--paths`/`--out`, `freshness verify
> --policy`/`--head`, `ledger dashboard --repo`), when flag arity is moved
> from each call site into a single declared string-flag-name manifest
> checked once inside (or immediately after) `parseArgs()` — mirroring the
> point of convergence across clap's `TypedValueParser`, Python
> `argparse`'s default `store` action, 2026-era typed TypeScript CLI
> frameworks (Stricli/cmd-ts/Effect CLI), and POSIX.1-2024's Utility Syntax
> Guideline 7 — then every one of the 9 sites should produce a single,
> consistent `error: --X requires a value` usage error at exit 1 or 2 with
> zero state written and zero uncaught exceptions on a bare flag, while
> every currently-correct invocation (the 10 sites PR #161 already
> converted, and every real boolean flag: `--no-color`, `--help`,
> `--version`, `--merged`, `--open-count`) stays byte-identical, subject to
> a required negative-control test proving no boolean flag is ever
> misclassified as string-valued. Not modified after this report's
> Evidence/Security sections were written.

This candidate is **not implemented tonight** (MODE=RESEARCH-ONLY opens no
PR); it is recorded below with `evaluated=no` so a future `developer-experience`
or general implementation night can pick it up via STEP 1.5's IMPLEMENT
mode, with this report as its frozen starting hypothesis.

## Evidence

OBSERVATION (full `as string | undefined`/`as string)` call-site inventory
against tonight's exact head, 9 sites found) → OBSERVATION (each of the 9
live-invoked with a bare flag against the real built CLI, tonight,
`node packages/cli/dist/bin.js`) → MEASUREMENT (3 of 9 are previously
undisclosed uncaught-`TypeError` crashes — a more severe failure class than
either prior consolidation-round critic's disclosed instances) →
MEASUREMENT (1 of 9 is a previously undisclosed silent false-negative in
`witness verify-report`) → INFERENCE (external SOTA survey: clap/argparse/
Stricli/cmd-ts/Effect-CLI/POSIX all place arity ownership at the parser, not
the call site) → INFERENCE (three independent attempts at the call-site-
level fix on this exact file have each been found incomplete by the next
reviewer) → HYPOTHESIS (frozen above) → DECISION (RESEARCH-ONLY: record,
do not implement, per STEP 1.5).

## Reward-Hack Check (of this report, not a candidate diff — none exists tonight)

No diff to reward-hack tonight (RESEARCH-ONLY opens no PR, touches no code,
test, threshold, or gold file). The applicable check is honesty of the
research claims themselves: all 9 call-site behaviors above were
live-invoked against the real, freshly built `packages/cli/dist/bin.js` on
this session's exact checkout (`71d607b`) before being written down — none
is inferred from reading the source alone. `npm test` (`npx vitest run &&
npm run test:governance`) was run live tonight and is unchanged by this
report (908 vitest + 2 pre-existing skipped + 197 governance = 1105+2,
identical to the counts independently reported by PR #192's own
2026-11-23 consolidation comment on this same commit) — no test was
touched, so this is a baseline confirmation, not an evaluation.

## Security Review

No credential, network, or filesystem-write surface was touched tonight
(research only). Directly relevant to the *finding itself*, though:
`verify-entrypoint --cmd` passes its value to `io.exec(cmd)` — today, a bare
`--cmd` passes the literal boolean `true` into that call, not attacker
-controlled string data, so this specific instance is not itself an
argument-injection vector (CWE-88) today. It is adjacent to that risk class:
the broader CVE/advisory survey tonight (CVE-2025-54795, Claude Code CLI
argument injection; the dbt MCP server's CVE-2025-40948; Repomix's
`--remote-branch` subprocess-argument-injection report) all describe the
*general* hazard of unvalidated CLI argument values reaching a subprocess
boundary. `verify-entrypoint`'s own command string already comes from
`dream.config.json`'s `evaluatorEntrypoints`, a file this session's own
compiler already validates (ADR-0011-era `findUnpinnedNpxInvocations`/
`matchTrigger` work, PRs #19/#84/#139/#158) — that control-plane boundary is
out of scope for tonight's finding, which is about flag-arity confusion
inside the CLI's own argument parser, not about the trustworthiness of the
command string once it is a real string. Noted for a future security-
adversarial night as a "is the exec surface fully covered" cross-check, not
claimed or evaluated here.

## Scan Findings (`cli`, `tui`)

- **`cli` scan**: the 9-site inventory above is this scan's primary finding.
  Secondary observation: `parseMergedPrNumbers`/`parseOpenCandidateCount`
  (used by `ledger dashboard --merged`/`--open-count`) were checked and are
  already defensively typed like `parsePendingFindings` — not part of the
  gap.
- **`tui` scan**: `packages/cli/src/tui.ts`'s `renderDashboard` and
  `statLine` (sites of the three most recent prior developer-experience
  fixes: width-aware padding, `other` bucket, `--no-color` ANSI leak) were
  re-read in full tonight; no new defect found. `verdictColor`'s `--no-color`
  fix (PR #103, merged) and the `other`-bucket fix (PR #122, merged) are
  both confirmed present and correct on tonight's head.

## Witness

Computed over this file's content *before* this section was filled in (this
repo's own hash-then-rewrite convention).

```
report_sha256 : f35c559b199c452e27b4c97c6c4c7a1a7624f7b3d24bec8af6e311a9ed04d250
session_commit: 71d607bea6608180b8c41980dc5386526d3f1f16
witness       : eb52fa2a1239465ce3d2c87fac5ca8f1daca6a5b66b3b2bf61e33b10830e0842
```

Computed with `@dream-machine/witness`'s canonical-exclusion transform
(`dream-machine witness stamp <file> <commit> --report`): hashes everything
in this file strictly before this `## Witness` heading, so the triple is
reproducible from the exact committed artifact forever after (issue #112's
fix, not a hash-then-discard draft). Reproduce (coreutils-free, uses the
repo's own tool):
```bash
# 1. Obtain this exact report (committed at
#    docs/dream-cycle/2026-11-24-developer-experience-report.md — GIST=LOCAL,
#    no gh CLI gist capability this session (GH_TOKEN invalid) and no
#    gist-creation MCP tool found; GitHub MCP access itself works fine
#    (get_me/issue/PR tools all succeeded tonight), so FALLBACK=false —
#    gist publication is simply best-effort and unavailable, not blocked by auth).
node packages/cli/dist/bin.js witness verify-report \
  docs/dream-cycle/2026-11-24-developer-experience-report.md \
  --commit 71d607bea6608180b8c41980dc5386526d3f1f16
# 2. Confirm it prints "✓ witness VALID — report is self-contained and bound to its declared commit".
```

## Next Steps (concrete)

1. File an issue for the full 9-site gap (this report → issue tonight),
   superseding/cross-referencing #160 (which only covers the original
   10-site scope #161 already converts) and the two consolidation-round PR
   comments that disclosed parts of it (#161's 2026-10-30/2026-11-10
   comments, #192's 2026-11-23 comment) so the finding has a durable home
   independent of PR-comment archaeology.
2. A future `developer-experience` (or `IMPLEMENT`-mode) night should build
   Candidate 5 (parser-owned arity manifest), with the negative-control test
   enumerated in PASS 3 as a hard acceptance requirement, not an optional
   follow-up.
3. Once implemented, re-audit whether `freshness verify`'s and `audit-gate`'s
   crash-class failures (uncaught `TypeError`, not even a clean non-zero
   exit with a message) have ever actually fired in a real CI run — if CI
   has silently been swallowing uncaught exceptions as generic failures,
   that is a second, distinct finding about this repo's own error-reporting
   surface, out of scope to investigate tonight.
