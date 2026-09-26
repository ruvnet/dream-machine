# Developer Experience SOTA Report — 2026

Dream Cycle 2026-09-09 · DEEP=`developer-experience` · SCAN=`cli`,`tui` · SLOT=4

## TL;DR

`renderDashboard(ledgerMd, { noColor: true })` in `packages/cli/src/tui.ts` still
leaked a raw ANSI SGR color escape in the verdict column, 21 nights after PR #21
(2026-08-19) explicitly flagged it as a known, unfixed follow-up
("`verdictColor()` bypasses the no-color proxy"). Reproduced live tonight against
current `main` (`3edd426`) before touching any code. Fixed by threading the
`noColor`-aware color map (`c`) into `verdictColor()` instead of letting it close
over the always-colored module constant (`C`). Small, deterministic, no
evolvable population — no Darwin run, consistent with this repo's own precedent
for single-function pure fixes.

## What's New

- **Bug**: `verdictColor(v: string): string` (pre-fix) returned `C.green` /
  `C.red` / `C.yellow` / `C.gray` unconditionally — the module-level, always-on
  ANSI palette — regardless of `renderDashboard`'s `noColor` option, which
  builds a separate `c` (either `C` itself, or a `Proxy` that maps every color
  key to `''`) specifically so `--no-color` output is byte-clean for piping,
  snapshotting, or non-tty consumption.
- **Why it matters for this repo specifically**: this TUI is this Dream Machine's
  own operator-facing dashboard (`dream-machine tui --no-color`), and
  `--no-color` output is exactly the mode a CI log, a snapshot test, or a
  screen-reader-friendly render depends on being ANSI-free. A partial leak is
  worse than no `--no-color` support at all, because callers trust the flag.
- **Fix**: `verdictColor(v, c)` now takes the resolved color map as a parameter;
  its one call site passes the same `c` the rest of `renderDashboard` already
  uses. Zero other direct `C.xxx` references remain inside `renderDashboard` or
  its helpers (confirmed by grep, both before writing the fix and by an
  independent critic afterward).

## Competitor / Prior-Art Rows (how other agentic dev-tool dashboards treat color-safety)

| Project | No-color / plain-output handling | Grade | Relevance |
|---|---|---|---|
| Sakana AI Scientist | CLI progress output is plain-text by default; no dedicated ANSI-proxy abstraction observed in its public reporting pipeline | C (public repo inspection, not independently benchmarked tonight) | Shows a simpler alternative design (skip color entirely) that structurally can't leak |
| OpenHands (formerly OpenDevin) | Terminal UI uses `rich`/`textual`-style rendering with theme-aware color; plain-mode output paths are a known recurring source of un-swept color-code issues in `rich`-based tools generally | C (general ecosystem knowledge, not a specific reproduced finding in their repo tonight) | Same class of bug (a color helper bypassing the plain-mode wrapper) is a recognized footgun across `rich`/ANSI-wrapper-style TUIs, not unique to this repo |
| DSPy / GEPA | Evaluation/optimization logs are structured (JSON/plain) rather than ANSI-decorated tables; the color-leak class of bug doesn't apply because there's no colorized table renderer in the hot path | B (documented output format) | Suggests one durable fix direction: keep the machine-readable log path (`ledger append`, `witness stamp`) entirely separate from the human-facing colorized `tui`, which this repo already does |
| SWE-agent | Terminal trajectory viewer supports a `--yolo`/plain trace mode; color is applied via a single wrapper function per rendered line, reducing (but per public issue history, not eliminating) the same bypass risk | C (single-source, not reproduced tonight) | Same architectural lesson as this fix: route *every* color call through one no-color-aware chokepoint, never a second hardcoded palette reference |

All four rows above are prior-art context for the general failure class (a
color-formatting helper skipping the plain/no-color wrapper), not independent
verification of this repo's specific bug — that was reproduced first-hand,
live, tonight (grade A).

## Hypothesis (frozen before implementation)

Given `renderDashboard(ledgerMd, { noColor: true })`, when `verdictColor()` is
changed to resolve its return value through the same no-color-aware color map
(`c`) that every other cell in the same row already uses — instead of closing
over the raw, always-colored `C` constant — then `renderDashboard`'s
`noColor: true` output should contain **zero** ANSI escape sequences for any
verdict value (`ACCEPT`, `REJECT`, `INCONCLUSIVE`, or any other string,
including a `HALT: budget` row), while `noColor: false` (or omitted) output
stays byte-identical to today. Subject to: 0 regressions in the existing
suite, and the change confined to `verdictColor`'s color-source dispatch (no
palette value changes).

Confirmed.

## Testability Gate → Candidate → Baseline → Evaluation

**Testable tonight**: yes — pure, deterministic, no credentials, no model
calls required.

**Candidate**: `packages/cli/src/tui.ts` — `verdictColor(v: string): string`
→ `verdictColor(v: string, c: typeof C): string`, body changed from `C.green`
etc. to `c.green` etc.; the one call site (`renderDashboard`'s row-rendering
loop) now passes `c`. +2 regression tests in
`packages/cli/src/index.test.ts` (one asserting zero ANSI escapes anywhere in
`noColor: true` output across four verdict values including a non-enum
`HALT: budget` string; one asserting the colored path is unchanged — still
emits `\x1b[32m`/`\x1b[31m` for ACCEPT/REJECT). One conceptual change, ~6
line diff to source + 16 lines of tests.

**Baseline**: parent `main @ 3edd426f6c9c4b1e80235f7447dc863e749345cc`
(`npm ci && npm run build` clean, no wasm/NAPI packages in this workspace).
`npx vitest run` → 616/616. `npm run test:governance` → 81/81. Total
697/697 green.

**Evaluation Receipt** — real evaluator (`npm test` = `vitest run && npm run
test:governance`):

| | Baseline (`3edd426`) | Candidate |
|---|---|---|
| vitest | 616 passed | 618 passed (+2, 0 removed/modified) |
| governance | 81 passed | 81 passed |
| Total | 697 | 699 |
| Lint | clean | clean |
| Build | clean (7 packages) | clean (7 packages) |

Live reproduction, pre-fix (stashed candidate, ran against parent):
```
$ node -e "... renderDashboard(md, { noColor: true }) ..."
contains ANSI escape with noColor:true -> true
"est                 [32mACCEPT         "
```
Live reproduction, post-fix:
```
post-fix noColor contains ANSI escape -> false
colored output still has green -> true
```
Self-hosting closure: re-ran `node packages/cli/dist/bin.js compile
dream.config.json` before and after the fix — byte-identical output (this
change doesn't touch the compiler, as expected for a `tui`-scoped fix).

## Darwin Lineage

Not run — `DARWIN=not-applicable`. A single deterministic color-dispatch
parameterization has no evolvable population, same judgment as every prior
`developer-experience`/`compiler-parity` single-function fix in this ledger
(PRs #11, #21, #29, #33, #46).

## Evidence

- OBSERVATION (grade A, first-hand, live): pre-fix `verdictColor()` at
  `packages/cli/src/tui.ts:21-26` (pre-diff) references `C.green`/`C.red`/
  `C.yellow`/`C.gray` directly, not the `c` proxy `renderDashboard` builds at
  its own line 134.
- OBSERVATION (grade A): PR #21's own body (2026-08-19, merged) names this
  exact defect as a known follow-up, explicitly "not fixed" at the time.
- MEASUREMENT (grade A, live): `renderDashboard(md, {noColor:true})` on
  parent `3edd426` emits `\x1b[32m` in its verdict cell; on the candidate it
  does not, across ACCEPT/REJECT/INCONCLUSIVE/`HALT: budget`.
- MEASUREMENT (grade A): `npm test` 697→699, 0 regressions.
- INFERENCE: this is the same architectural footgun class documented in
  public `rich`/ANSI-wrapper ecosystems generally (see competitor rows) — one
  hardcoded-palette reference bypassing the single no-color chokepoint — not
  specific to this codebase's history.
- DECISION: fix by parameter-threading the resolved color map, not by adding
  a second no-color check inside `verdictColor` (which would create a second
  place the "is this no-color?" decision could drift from `renderDashboard`'s).

## Reward-Hack Check

Independent critic (fresh subagent, no shared authoring context, given only
`git diff` + full repo read access): **CLEAR**.
1. Confirmed the bug is real by reading the pre-fix code and reproducing the
   leak directly (not taking the claim on faith).
2. Confirmed the fix fully closes the leak — grepped `packages/cli/src/tui.ts`
   post-fix for any remaining direct `C.xxx` reference inside `renderDashboard`
   or its helpers; zero found.
3. No reward-hacking signals: no weakened/skipped/`.only` tests, no gold-data
   edits, no threshold changes, no evaluator exploitation.
4. Verified by hand that both new tests are bug-exercising: the noColor
   regression test fails against the pre-fix code (reproduced the raw escape)
   and passes post-fix; the colored-path test passes on both (correctly
   proving no regression, not exercising the bug).
5. No regression to colored (`noColor:false`) output — `c === C` in that
   branch, so `verdictColor(v, c)` behaves identically to the old
   `verdictColor(v)`.
6. Scope minimal: 4-line signature/body change + 1-line call-site change in
   source, 2 additive tests. No unrelated code touched.

## Security Review

No security-sensitive surface: no prompt-injection vector (no LLM calls in
this path), no MCP/tool-authority change, no credential exposure, no
filesystem/network scope change, no evaluator/gate/safety-constant touched.
Pure string/ANSI-escape formatting logic.

## Regression Analysis

0 pre-existing tests modified or removed. All 697 baseline tests (616 vitest
+ 81 governance) pass unchanged; 2 new vitest tests added. `npm run lint`
clean across all packages. `npm run build` clean (7 packages, no wasm/NAPI
degradation to record tonight). Self-hosted `dream.config.json` compile
output confirmed byte-identical before/after (out of scope for this `tui`
change, verified anyway per this repo's self-hosting discipline).

## Witness

```
report_sha256 : 69a97031631f19d559ebc5c0d7601d36cb02efa7708fda9776eb1616e7372ebe
session_commit: 3edd426f6c9c4b1e80235f7447dc863e749345cc
witness       : 16c867ef6fc58d714ac698888e99b25e24e6f39a21e45bf4fcc7e03098b23ee0
```

Computed against this file's content *before* this Witness section was filled
in (STEP 16's own hash-then-rewrite order, same convention as every prior
night in this ledger, e.g. PRs #7, #11, #29).

Verify (5 steps, coreutils only):
```bash
# 1. Obtain this exact report file (committed at
#    docs/dream-cycle/2026-09-09-developer-experience-report.md — GIST=LOCAL,
#    no gh/gist-creation tool available this session).
# 2. Reconstruct its pre-Witness-section content (everything above this
#    section, byte-for-byte) into report.md.
REPORT_HASH=$(sha256sum report.md | awk '{print $1}')
# 3. Confirm REPORT_HASH == 69a97031631f19d559ebc5c0d7601d36cb02efa7708fda9776eb1616e7372ebe
printf '%s%s' "$REPORT_HASH" "3edd426f6c9c4b1e80235f7447dc863e749345cc" | sha256sum
# 4. Confirm that output == 16c867ef6fc58d714ac698888e99b25e24e6f39a21e45bf4fcc7e03098b23ee0
# 5. Confirm session_commit (3edd426f6c9c4b1e80235f7447dc863e749345cc) matches
#    the PR's base commit.
```

`GIST=LOCAL` — no `gh` CLI or gist-creation MCP tool available this session
(consistent with every prior night in this ledger). Published as a committed
artifact in the PR instead.

## Next Steps (concrete)

1. **Audit for the same bypass class elsewhere in `tui.ts`**: this fix closed
   the one instance found tonight (`verdictColor`), but any *future* helper
   added to `renderDashboard` that hardcodes `C.xxx` instead of accepting `c`
   would reintroduce the same bug silently. A cheap, durable guard: a unit
   test (already added tonight, generalizable) that renders a dashboard with
   every distinct verdict/finding/date value under `noColor:true` and asserts
   zero `\x1b[` bytes anywhere in the frame — this is a stronger regression
   guard than checking one hardcoded verdict, and should be kept as the
   canonical "no-color contract" test going forward.
2. **Consider a lint rule or code-review checklist item**: "no direct `C.xxx`
   reference outside the `c` construction in `renderDashboard`" — this is
   exactly the kind of drift a human reviewer or a simple grep-based CI check
   could catch before merge, cheaper than relying on a future Dream Cycle
   night to notice the leak again.
3. **zeroMergeStreak / merge-state accuracy (process finding, not a code
   candidate tonight)**: while re-checking the last 7 ledger rows' PR fates
   per STEP 1, the GitHub MCP `list_pull_requests` tool returned `merged:
   false` for every single PR in this repository — including ones with a
   `merged_at` timestamp set and independently confirmed `merged: true` via
   `pull_request_read` (`get`) on PRs #21, #29, #33, #46, #55, #91. This
   reproduces, at the *tool* layer rather than this repo's own code, the
   exact defect class PR #89 already fixed inside `@dream-machine/ledger`'s
   `learningSignals()` (never trust a bulk-list `merged` field; resolve per-PR
   or via an explicit `--merged` list). Recommend future nights always derive
   `--merged` from `merged_at` presence or individual `pull_request_read`
   calls, never from `list_pull_requests`'s own `merged` boolean, until/unless
   that tool's behavior is confirmed fixed upstream. Not actionable as a PR
   against this repo (the defect is in the calling environment's GitHub MCP
   server, out of this repo's blast radius) — recorded here for the ledger's
   cross-night memory instead.
