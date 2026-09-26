# Ledger-Signals / Verify SOTA Report — 2026

**Date:** 2026-09-16 · **Deep:** ledger-signals · **Scan:** witness, verify · **Slot:** 1 (`20260916 % 5`) · **Session commit:** 3edd426f6c9c4b1e80235f7447dc863e749345cc

## TL;DR

`ledger verify` on the real, committed `docs/dream-cycle/LEDGER.md` reports
**40 structural errors across 37 rows** (out-of-enum `Verdict`/`Evaluated`
values from pre-single-repo-schema "portfolio" nights — rows 2–6, 9–12,
17–28). This is known, triaged debt: issues #48 and #58 (2026-08-29,
2026-08-31 nights) already root-caused it and explicitly recommended a CI
`ledger verify` gate as a *second* step, deliberately deferred because a
full-file gate would fail CI today against that legacy debt. Both issues
were closed "completed" on 2026-09-07 — but the 40 errors are still live on
`main` right now; nobody actually shipped the gate. Meanwhile GitHub ground
truth (`pull_request_read`, not the unreliable `list_pull_requests.merged`
boolean — see Evidence) shows the "zero merges ever" narrative several
recent nights repeated is stale: a ~1-hour bulk-merge event on 2026-09-07
(16:22–17:22 UTC) merged roughly 35 previously-stuck PRs, including #48's
and #58's own fixes (#49, #58's superseding work) and this repo's core
ledger/witness hardening. Since then: **9 days, 0 new merges, 8 open
unreviewed `dream/*` candidate PRs (#98, #100, #101, #103, #105, #109,
#111)**, so the *current* backlog problem is real, just not the one the
"16+ consecutive zeroMergeStreak nights" framing implies.

Tonight's candidate: unblock the CI gate issue #48 deferred. `verifyLedger`
gains an optional `sinceRow` baseline (`ledger verify --since-row N`) that
grandfathers rows before `N` and enforces every row at/after it. CI now runs
`ledger verify --since-row 38` — the 37 legacy rows stay grandfathered
exactly as before, but this candidate's own new ledger row (row 38) and every
row appended after it must validate, closing the loop issue #48 opened and
left half-finished.

## What's new

- `packages/ledger/src/index.ts`: `verifyLedger(markdown, { sinceRow? })` —
  errors below `sinceRow` are suppressed; `rowCount` is unaffected (still
  counts every row); omitting the option is byte-identical to today.
- `packages/cli/src/index.ts`: `ledger verify --since-row N`, same
  fail-closed integer-parsing discipline as the existing `--merged` flag
  (value-less or non-numeric → usage error, not `NaN`/crash).
- `.github/workflows/ci.yml`: new step, `ledger verify --path
  docs/dream-cycle/LEDGER.md --since-row 38` — the first CI enforcement of
  ledger structural integrity this repo has ever had.

## Why this and not something else

Considered and rejected:
1. **Repair the 37 legacy rows to fit the single-repo schema.** Issue #48
   explicitly left this as a human decision ("Repair or accept-as-historical
   -wart"); the human's 2026-09-07 closure-without-repair is the closest
   thing to an answer on record, and rewriting historical evidence rows to
   satisfy today's schema would falsify the record of what actually
   happened those nights (some really were multi-repo portfolio cycles).
   Out of scope for an autonomous session regardless — evidence is not
   supposed to un-happen.
2. **Extend the `Verdict`/`Evaluated` enums to accept the compound
   `"ACCEPT / REJECT / INCONCLUSIVE"` / `"partial"` shapes.** Issue #58
   raised this as option (a) vs. (b) (schema vs. contract) and didn't
   resolve it. Loosening the enum this session would silently accept the
   exact drift `ledger append` was hardened against (#48/#49) — the
   single-repo `dream-cycle` schema this compiled prompt now specifies is
   the one entry point (STEP 25) still writes, so loosening it protects
   nothing and reduces detection power everywhere else (`ledger signals`,
   `tui`). Rejected.
3. **PR #109's `reviewBacklogSize` direction** (open, unmerged, not
   reviewed as of tonight) is adjacent but orthogonal — it's a
   caller-supplied visibility signal for review-queue depth, not a
   structural-integrity gate. Not duplicated; if anything, tonight's finding
   updates its own "16+ consecutive zeroMergeStreak nights" framing (see
   Evidence) — flagged as a review comment on #109, not re-litigated here.
4. **A `--since-row` baseline** (implemented): closes exactly the gap #48
   named, at minimal risk — the 37 legacy rows are provably unaffected
   (identical `verifyLedger()` output when `sinceRow` is omitted), and the
   new gate is provably non-vacuous (fails today if pointed at row 2).

## Hypothesis (frozen before implementation)

> Given `docs/dream-cycle/LEDGER.md`'s 37 historical rows carrying 40
> known/accepted structural violations, when `verifyLedger` gains an
> optional `sinceRow` parameter that restricts enforcement to rows at or
> after it, and CI wires `ledger verify --since-row 38`, then a future
> malformed ledger row (including this candidate's own row 38) is caught by
> CI without requiring repair of the 37 grandfathered legacy rows —
> subject to: omitting `sinceRow` reproduces today's full-file behavior
> exactly (byte-identical `VerifyResult`), the new CLI flag follows the
> existing `--merged` fail-closed parsing convention, and the full existing
> suite (616 tests) stays green with zero regressions.

## Testability gate

Testable tonight, no model calls required (`OPENROUTER_API_KEY` present but
unused — deterministic library/CLI/CI change). `EVALUATED=yes`.

## Baseline (parent, commit 3edd426, `git stash` before implementing)

```
npx vitest run
Test Files  23 passed (23)
Tests       616 passed (616)
```

## Candidate evaluation (same evaluator, same corpus)

```
npm run typecheck    → clean
npm run build         → clean (all 8 workspace packages)
npm run lint          → clean
npx vitest run
Test Files  23 passed (23)
Tests       622 passed (622)   [+6 net new, 0 regressions]
npm run test:governance
tests 81, pass 81, fail 0      [unchanged]
```

Live end-to-end replay against the real, committed `docs/dream-cycle/LEDGER.md`
(not just unit tests):

```
$ node packages/cli/dist/bin.js ledger verify --path docs/dream-cycle/LEDGER.md
✗ ledger has 40 error(s)                              # unchanged default behavior

$ node packages/cli/dist/bin.js ledger verify --path docs/dream-cycle/LEDGER.md --since-row 38
✓ ledger OK — 37 rows                                 # grandfathered, exit 0

$ node packages/cli/dist/bin.js ledger verify --path docs/dream-cycle/LEDGER.md --since-row 2
✗ ledger has 40 error(s)                              # proves the gate is non-vacuous, not a rubber stamp

$ node packages/cli/dist/bin.js ledger verify --path docs/dream-cycle/LEDGER.md --since-row abc
error: --since-row expects a positive integer row number, e.g. --since-row 38   # exit 1, fail-closed
```

## Darwin

Not run. `evaluatorEntrypoints.darwin` invokes unpinned `npx
@metaharness/darwin` (flagged supply-chain risk by the compiled routine
itself, re-confirmed live-buggy by the 2026-09-07 ledger row). Unrelated to
this candidate's surface; running it would add supply-chain exposure for no
evidentiary value. Deliberately skipped, not silently omitted.

## Evidence

- OBSERVATION: `ledger verify` on real `LEDGER.md` → 40 errors, rows
  2–6,9–12,17–28 (21 distinct rows, some with both a bad verdict and a bad
  evaluated value).
- OBSERVATION (grade A, first-hand): issues #48 and #58 already root-caused
  this and proposed the same CI-gate direction tonight ships; both closed
  "completed" 2026-09-07 without the gate landing — confirmed by re-running
  `ledger verify` moments before writing this report and getting the same
  40 errors.
- OBSERVATION (grade A, first-hand, via `mcp__github__pull_request_read`,
  ground truth — NOT `list_pull_requests`, whose `merged` boolean field
  reads `false` on every single PR checked tonight, including ones with a
  populated `merged_at` timestamp, e.g. #97/#96/#95/#93/#91/#89/#87/#84/...;
  this exact `list_pull_requests` unreliability was already flagged by the
  2026-09-06 ledger row): a bulk-merge event on 2026-09-07 between
  16:22–17:22 UTC (plus a few dependabot merges at 17:14–17:22) merged
  approximately 35 previously-open PRs across every dream-cycle surface,
  including #49/#58's superseding fixes, #24, #33, #42, #46, #62, #65, #79,
  #89, #91, #93, #95, #96, #97, and many portfolio/docs/dependabot PRs.
- OBSERVATION: since that burst, 0 further merges and 8 open, unreviewed
  `dream/*`/portfolio-adjacent candidate PRs accumulated over 9 nights
  (#98, #100, #101, #103, #105, #109, #111) — `ledger signals`'
  `daysSinceLastRow` on the real ledger reads 9 (`lastRowDate=2026-09-07`,
  today=2026-09-16), confirming the ledger-staleness detector (#61/#62,
  2026-09-01 night) is itself accurately reporting this gap right now.
- MEASUREMENT: baseline 616/616 → candidate 622/622 vitest (+6 net new, 0
  regressions); 81/81 governance unchanged; typecheck/lint clean; witness
  101/101 unaffected (scan finding, no gap found tonight — see Scan
  Findings).
- MEASUREMENT: live replay above — `--since-row 38` clears the real ledger
  (37 rows, 0 errors); `--since-row 2` still reproduces all 40 errors,
  proving the new gate is not a rubber stamp; bad flag input fails closed.
- INFERENCE: the "zeroMergeStreak=true, 16+ consecutive nights" framing
  several recent draft PRs (including open #109) repeat is misleading as of
  tonight — it's an artifact of `ledger signals` always being invoked
  without `--merged` (worst-case default, explicitly documented as
  "unverified" in the CLI's own help text), not a re-verified fact. The
  *current*, ground-truth state is: one large catch-up merge 9 days ago,
  then silence — a reviewer-availability pattern, not a permanent
  zero-merge state. Recorded as INFERENCE, not re-derived as a new
  `learningSignals` field tonight (that's PR #109's surface, already open;
  a review comment there is the right-sized action, not a competing
  candidate — see Recommendation).
- DECISION: ship the `--since-row` CI gate (closes #48's deferred step);
  do not touch the 37 legacy rows; do not modify `zeroMergeStreak`'s
  semantics or #109's candidate.

## Reward-hack / adversarial critique (self, independent-of-implementation pass)

- Weakened any benchmark, test, or gold data? No — purely additive (6 new
  tests, 0 existing tests modified or deleted).
- Altered a threshold to manufacture a pass? The `sinceRow=38` baseline
  *is* a threshold, but it is transparent, documented in both the code
  comment and the CI step, chosen as "current row count + 1" (not tuned to
  hide any specific violation), and independently reproducible by anyone
  who runs `ledger verify` against the same commit. It does not touch or
  reinterpret the 40 existing errors' meaning — it only scopes which rows
  the CI gate enforces, exactly as issue #48 itself proposed.
- Cherry-picked corpus? No — full `npm test` (vitest + governance) run,
  not a subset; live check against the real committed ledger, not a mock.
- Exploited the evaluator? No — same `npm test`/`vitest run` CI already uses.
- Hidden cost or undocumented cache? No — `verifyLedger` is still a pure
  function; the new option only changes which row indices contribute
  errors.
- Any change to `LEDGER_COLUMNS`, `VERDICTS`, `EVALS`, or the on-disk row
  schema? No.

## Security review

No new dependency, no new filesystem/network surface beyond the existing
`ledger verify` read of `LEDGER.md` (already CI-adjacent via other steps),
no credential handling. The CI step is read-only (no `ledger append`, no
mutation). `--since-row` is a bounded, fail-closed positive-integer parser,
audited the same way as the existing `--merged` parser. No prompt-injection
surface (no free text reaches a code path). No MCP authority or
agent-impersonation surface touched. `list_pull_requests`'s unreliable
`merged` field (see Evidence) is a data-quality finding, not a security
finding — flagged for awareness, no code in this repo can fix a third-party
API's field semantics.

## Scan Findings

**verify** — the deep dive itself (above): CI never ran `ledger verify`;
issue #48/#58's proposed gate was never shipped despite both issues being
closed "completed."

**witness** — `packages/witness` (`stamp`/`verify`) unaffected: 101/101
tests pass unchanged, no code touched. No gap found tonight (matches the
2026-08-31 night's same-surface finding).

## Competitors (grade C — general framing only, not the justification for this candidate)

The candidate is justified entirely by first-hand in-repo evidence (the 40
live errors, the two previously-closed-but-unshipped issues); this table is
context, not support. SWE-agent, OpenHands, DSPy/GEPA, and Sakana AI
Scientist typically validate their own run logs against a schema the same
code path that writes them also enforces (typed objects constructed by the
harness), so a writer/reader schema split like `ledger append` vs. `ledger
verify` historically had is close to the AutoGPT-lineage anti-pattern
previously named in issue #48. None of the five publicly document a
"grandfather old violations, enforce forward" CI pattern specifically;
that's a generic software-engineering technique (comparable to ESLint's
`--max-warnings` baselining or Git's `--since` log filtering), not a
competitor-sourced idea, so no A-grade claim is made about novelty.

## Gist

`GIST=LOCAL` — no `gh` binary and no gist-creation MCP tool available this
session (matches repo precedent throughout; GitHub API access via
`mcp__github__*` worked fine for everything else). Report committed at
`docs/dream-cycle/2026-09-16-ledger-signals-report.md`.

## Witness

Computed via `dream-machine witness stamp` against this file's final
committed bytes and `SESSION_COMMIT=3edd426f6c9c4b1e80235f7447dc863e749345cc`.
Recorded in the PR body and `LEDGER.md` row for tonight (hashing a file
that embeds its own hash is self-referential — same convention as prior
nights). Reproduce independently:

```bash
REPORT_HASH=$(sha256sum docs/dream-cycle/2026-09-16-ledger-signals-report.md | awk '{print $1}')
SESSION_COMMIT=3edd426f6c9c4b1e80235f7447dc863e749345cc
printf '%s%s' "$REPORT_HASH" "$SESSION_COMMIT" | sha256sum | awk '{print $1}'
# must equal the WITNESS value published in the PR body and LEDGER.md
```

## Recommendation

`evaluated: accepted` for human review of the draft PR (small, deterministic,
no LLM calls, 622/622 + 81/81 tests green, 106-line diff, provably
non-vacuous gate). Not attempted tonight, explicitly:
1. Repair or reclassify the 37 legacy rows — human decision (per #48/#58),
   unchanged tonight.
2. Re-verify/refresh `zeroMergeStreak`'s framing across open PRs (#109 in
   particular) with the ground-truth 2026-09-07 bulk-merge evidence above —
   flagged as a review comment on #109, not a competing candidate.
3. Review and merge (or close) the 8 currently-open `dream/*`/related
   candidate PRs (#98, #100, #101, #103, #105, #109, #111) — a human
   decision this session cannot make; `reviewBacklogSize` (#109, still
   unmerged) would make this depth visible automatically once shipped.
4. Wire a live `--merged`/`--open-count` GitHub check into the compiled
   nightly prompt's STEP 1 itself (packages/compile), so future nights stop
   relying on `ledger signals`' worst-case unverified default — out of
   scope tonight (different package/surface).
