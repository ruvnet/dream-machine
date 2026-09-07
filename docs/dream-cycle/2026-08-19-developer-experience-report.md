# Dream Cycle 2026-08-19 — developer-experience (cli,tui)

## Rotation
DEEP=developer-experience, SCAN=cli,tui (slot 4, `20260819 % 5 = 4`). No bonus
deep dive (`% 25 = 19`, `% 75 = 19`).

## Ledger Check
`docs/dream-cycle/LEDGER.md` has 1 real row (2026-08-13). Live GitHub state
for the last 6 dream-cycle nights (via `mcp__github__pull_request_read`):

| Date | Deep | Issue | PR | Fate |
| --- | --- | --- | --- | --- |
| 2026-08-13 | security-adversarial | #6 (CLOSED) | #7 | **MERGED** |
| 2026-08-14 | developer-experience | #8 (OPEN) | #9 | OPEN (draft, unmerged) |
| 2026-08-15 | compiler-parity | #10 (OPEN) | #11 | OPEN (draft, unmerged, mergeable=clean) |
| 2026-08-16 | ledger-signals | #14 (OPEN) | #15 | OPEN (draft, unmerged) |
| 2026-08-17 | evaluation-adapters | #16 (OPEN) | #17 | OPEN (draft, unmerged) |
| 2026-08-18 | security-adversarial | #18 (OPEN) | #19 | OPEN (draft, unmerged) |

Note: `docs/dream-cycle/LEDGER.md` on `main` still shows only the 2026-08-13
row because every subsequent night's ledger-append commit lives on its own
unmerged `dream/...` branch (per STEP 20-25, the ledger row is committed
alongside that night's PR). This is a known, already-tracked gap — see
issue #14 / PR #15 ("ledger-signals: zeroMergeStreak permanently
miscalibrated") — not a new finding tonight.

## Learning Signals
`dream-machine ledger signals` on the real (1-row) ledger: `zeroMergeStreak:
true`. Known-miscalibrated per #14 (only sees 1 row, doesn't know PR #7
merged) — real state is 1 merged / 6 total recent dream-cycle PRs, still a low
merge rate. Consistent with STEP 1.1's intent even though the literal signal
is stale: biased tonight's pick to a tiny, one-conceptual-change,
easily-reviewable candidate. `duplicateDirections: []`, `lowScoreStreak:
false`, `blockedEvalStreak: false`.

## Deep Dive
Issue #8 (2026-08-14, same DEEP surface, 5 nights ago) reproduced live but
explicitly left unfixed: `packages/cli/src/tui.ts`'s `pad()` measured content
width via `.length` on the ANSI-stripped string — i.e. raw UTF-16 code
units, not real terminal display columns. Any ledger `Finding`/`Deep` text
containing CJK, fullwidth, or emoji characters under-pads, breaking the
dashboard's box-drawing alignment (right border drifts or the row overflows).
Latent on the real ledger today (no row has non-ASCII content yet) but
reproduces immediately with a synthetic CJK row.

Reproduced again tonight (grade A, first-hand):
```
$ node packages/cli/dist/bin.js tui --path /tmp/cjk-ledger.md --no-color
```
with a `Finding` of `性能改善：レイテンシを削減する提案について` — pre-fix, the row's
right border drifted relative to every other line in the box.

## Hypothesis
Given a ledger row whose `Finding`/`Deep`/`Verdict` text contains wide
(CJK/fullwidth) or emoji Unicode characters, when the TUI dashboard's `pad()`
measures and truncates content using a real Unicode-aware display-width
function instead of raw UTF-16 `.length`, then every rendered dashboard line
should stay exactly `W` display columns wide (no broken right border, no
premature wrap) — relative to the current `.length`-based implementation,
which under-pads wide-character rows — subject to: ASCII-only ledgers render
byte-identical output to today, all existing tests stay green, and
truncation of long `Finding` text still ends in a single `…` landing at
exactly the target width. Frozen before implementation; not modified after
evaluation began.

## Candidate
+~120/-4 in `packages/cli/src/tui.ts` (new `codePointWidth`/`displayWidth`
functions, `pad()` rewritten to use them) + test additions in
`packages/cli/src/index.test.ts`. One conceptual change: real Unicode
display-width instead of raw string length, for both padding and
truncation. `displayWidth` is exported for direct unit testing. Truncation
also now walks by code point (can't land mid surrogate-pair) and preserves
any ANSI codes that follow the cut point instead of raw-index-slicing a
string that may contain embedded escape sequences.

## Baseline
Parent commit `8ce385786faa5e63cc0e7105cc6e96f663a51f07`, 96/96 tests
passing, clean build.

## Evaluation Receipt
Real evaluator: `npm test` (vitest), this repo's own `bench` entrypoint. Two
runs: pre-critique-fix (102/102) and post-critique-fix (103/103, +1 for the
newline-preservation regression test added below).

| | Baseline (`8ce3857`) | Candidate (final) |
|---|---|---|
| Tests | 96 | 103 (+7, 0 removed/modified) |
| Result | 96 passed | 103 passed |
| Build | clean (6 packages) | clean (6 packages) |

**Credentials reality check**: `OPENROUTER_API_KEY` is present tonight —
`LLM_EVAL` is not blocked. This candidate makes no model calls regardless;
verified entirely by the real test suite plus a live manual repro.

## Darwin Lineage
Not run — `DARWIN=not-applicable`. Same judgment as the 08-13/08-14/08-15
nights for a single, small, pure-function change: no meaningful mutable
population for bounded Darwin's search over a width-classification table
with exhaustive branch structure. `npx @metaharness/darwin --version`
confirmed available tonight (`0.9.2`), so this is a scope decision, not an
availability blocker.

## Evidence
- OBSERVATION (grade A, first-hand, reproduced live): pre-fix, a CJK
  `Finding` breaks the dashboard's right-border alignment.
- MEASUREMENT: `npm test` 96/96 → 102/102, 0 regressions.
- MEASUREMENT: `displayWidth('🚀')` (a 2-UTF16-unit, 1-code-point emoji) = 2,
  vs. the old code's implicit count of 2 raw UTF-16 units — coincidentally
  equal for this single case, but the underlying mechanism was wrong
  (verified against a CJK string where the old and new measurements diverge:
  4 CJK ideographs = `.length` 4 vs. real display width 8).
- MEASUREMENT: every line of a rendered dashboard containing a long CJK
  `Finding` (truncated) has identical `displayWidth`, confirmed by test.
- INFERENCE→OBSERVATION (found during adversarial critique, see below):
  `verdictColor()` in the same file reads the module-level `C` object
  directly instead of the no-color-aware `c` proxy, so `--no-color` mode
  leaks a raw ANSI escape for the verdict color. Confirmed pre-existing (git
  stash to parent commit, same leak reproduces identically) — not introduced
  tonight. Flagged, not fixed (see Reward-Hack Check and Scan Findings).
- DECISION: ship the width fix; leave the `verdictColor`/no-color leak as a
  disclosed follow-up rather than scope-creeping tonight's one conceptual
  change.

## Reward-Hack Check
Independent critic (separate subagent, no shared context — given the literal
diff and full repo read access). **Verdict: CLEAR** of reward-hacking. Scope
confirmed clean (only `tui.ts` + its test file), no new exec/network/fs/dep
surface, no test weakened or self-referentially-vacuous — two assertions
(`displayWidth('性能改善')===8`, `displayWidth('🚀')===2`) are ground-truthed
against known terminal widths, not just internal round-tripping.

Two issues surfaced by the critic:
1. `pad(s, n)` for `n<=0` on non-empty input still emits a 1-column `'…'`
   instead of a 0-width result. **Not fixed** — pre-existing behavior
   (identical in the old `.slice(0, Math.max(0,n-1))+'…'`), not a regression,
   and no real call site ever passes `n<=0` (all five call sites use
   hardcoded positive widths: 11/20/14/28/76).
2. The truncation-branch tokenizer (`.` without dotAll) silently dropped
   literal newlines from the token stream — a genuine new divergence from
   the old raw-index `.slice()`, which preserved such bytes verbatim
   regardless of truncation. **Fixed**: `TOKEN_RE`'s `.` → `[^]` (matches any
   code point including line terminators, still one full code point under
   the `u` flag). Regression test added (`packages/cli/src/index.test.ts`,
   "pad does not silently drop a literal newline..."). Re-ran the real
   evaluator after the fix: 103/103, 0 regressions.

## Security Review
Pure string/regex logic in `packages/cli/src/tui.ts`. No new exec, network,
filesystem, or credential surface. No new dependency (dependency-free, per
the file's own docstring). No LLM calls (N/A for prompt injection). No
evaluator/gate/threshold file touched. The newly-discovered `verdictColor`
no-color leak is a display-fidelity bug, not a security issue (no data
exfiltration path — it only affects whether a raw ANSI sequence appears in
otherwise-plain stdout).

## Scan Findings
**cli** — no new defect found tonight beyond what's already tracked (`ledger
signals --merged` wiring gap: #8/#9, unmerged; `Prior-night fates` token
parsing: #14/#15, unmerged; `execFile` vs shell: #16/#17, unmerged; unpinned
`npx` supply-chain: #18/#19, unmerged). CLI surface (`index.ts`, `bin.ts`,
320+37 lines) reviewed, stable.

**tui** — two findings: (1) `pad()`'s `.length`-based width — **fixed
tonight**. (2) `verdictColor()` bypasses the `noColor` proxy, leaking a raw
ANSI escape into `--no-color` output whenever a row's verdict is
ACCEPT/REJECT/INCONCLUSIVE — **found, not fixed**, recommended as next
night's `developer-experience`/`tui` candidate. This one directly undermines
the file's own stated purpose ("dependency-free... can be snapshot-tested...
without a terminal" — a leaking color code breaks byte-exact snapshot
testing of `--no-color` output).

## Competitors
See `/tmp/dream-gist-2026-08-19.md` ("Competitors") for the full graded
table: SWE-agent (C), OpenHands (B), DSPy/GEPA (B, N/A — no TUI component),
Sakana AI Scientist (B, different design point — line-oriented logs, not
fixed-width boxes), AutoGPT lineage (C, same failure shape reported in
community forks). This repo's own issue #8 (grade A, first-hand) is the
strongest evidence.

## Gist
Committed as `/tmp/dream-gist-2026-08-19.md` (session-local; no `gh gist
create` / gist tool available in this environment, consistent with every
prior night). `GIST=LOCAL`.

## Witness
```
report_sha256 : b3f64b5641107de39d60bd35bd2798f1492cef7876b8199a725a097fe46288a9
session_commit: 8ce385786faa5e63cc0e7105cc6e96f663a51f07
witness       : 25a4b37f6cc3ddfafb2479be3106e289bdfc27557c9f9376e9ed8bd452bb5488
```
Verify: `sha256sum docs/dream-cycle/2026-08-19-developer-experience-report.md`
won't reproduce this exact hash (it was computed on the pre-Witness-section
content per STEP 16's own hash-then-rewrite order — same convention as prior
nights). `printf '%s%s' "b3f64b5641107de39d60bd35bd2798f1492cef7876b8199a725a097fe46288a9" "8ce385786faa5e63cc0e7105cc6e96f663a51f07" | sha256sum`
must equal the witness above.

## Recommendation
`evaluated: accepted` — human review of the draft PR. Follow-ups not done
tonight (disclosed, not silently dropped): (1) fix `verdictColor()` to
respect `--no-color` (found tonight, see Scan Findings); (2) issue #8's
still-open design question about whether `renderDashboard` should accept
precomputed merge-state; (3) extend `displayWidth()` to real grapheme-cluster
segmentation if a future ledger row needs exact multi-codepoint ZWJ-emoji
width (today's per-codepoint approximation is directionally correct but not
a full Unicode text-segmentation implementation).
