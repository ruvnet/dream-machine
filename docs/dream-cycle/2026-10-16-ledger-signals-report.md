# Ledger-Signals / Witness-Verify SOTA Report — 2026

## Rotation

Slot 1 (`DAYINT % 5`, DAYINT=20261016) → DEEP=`ledger-signals`, SCAN=`witness,verify`. No bonus modulus hit (`% 25` = 16, `% 75` = 66). Session commit (baseline, after `git fetch --unshallow`): `b2abcc14a632d7e0948962065a7c6c8920cf306c`.

## Ledger Check

`docs/dream-cycle/LEDGER.md` last row 2026-10-12 (`daysSinceLastRow=4`). Fresh checkout was shallow (`git rev-parse --is-shallow-repository` → `true`, only 59 local commits) — this is itself the exact defect class already tracked by issue #149/PR #150 (open, draft, `mergeable_state: dirty`); unshallowed via `git fetch --unshallow` before any measurement, same handling as several prior nights.

`dream-machine ledger signals` (no flags): `zeroMergeStreak: true` — the tool's own documented worst-case default (`--merged` omitted). Ground-truthed via `mcp__github__pull_request_read` on PR #177: `merged: true`, `merged_by: ruvnet`, `merged_at: 2026-10-12T15:45:01Z`. **`zeroMergeStreak` is actually `false`** (last merge 4 days ago, not zero). `search_pull_requests` confirms 39 total dream/* merges historically. `reviewBacklogSize`: 16 open, unmerged `dream/*` PRs (#98,#101,#137,#139,#141,#145,#148,#150,#152,#154,#156,#158,#161,#180,#182,#184) — none overlap tonight's candidate file.

Checked #149/#150 (shallow-clone git-show oracle) in full: correctly withheld by prior nights as already-filed/already-fixed-but-unmerged — not re-litigated.

Checked the two most recent ledger-signals-surface PRs in full to avoid duplication: #145 (2026-10-01, `splitRow` pipe-unescape bug, issue #144) and #154 (2026-10-06, `blockedEvalStreak` missing majority conjunct, issue #153) — both still open/draft/unmerged, their described defects **still present on current `main`** (confirmed by reading `packages/ledger/src/index.ts` lines 54-58 and 411-414 directly). Both already filed with open fixes; not re-proposed.

`duplicateDirections`: `[]` (the 2026-10-11 dedupe-by-night fix, PR #167, is merged and present in current code — confirmed in `packages/ledger/src/index.ts` lines 394-402).

## Deep Dive

Manually audited every file under `docs/dream-cycle/` for `## Witness` heading count (grep `^## Witness$`). Exactly one file, `2026-09-10-compiler-parity-report.md`, has **two** such lines (93, 118). Live repro:

```
$ node packages/cli/dist/bin.js witness verify-report docs/dream-cycle/2026-09-10-compiler-parity-report.md --commit 3edd426f6c9c4b1e80235f7447dc863e749345cc
✗ witness INVALID — report has 2 "## Witness" headings at lines 93, 118; expected exactly one
```

Root cause: the file predates `splitAtWitnessSection`/`witness verify-report` (added 2026-09-15, PR #111, closing issue #112). Its first occurrence (line 93) is a forward-reference placeholder — "See STEP 16 below (this file's own witness section, rewritten post-stamp...)" — written mid-document before the real trailing section (line 118), not a genuine second section. Independently confirmed by hand that the originally-published `report_sha256` (`1c9ec5548ffab1370fadcaf24961a5779b0eaf52690b9314a6483d5e572bec2b`) **is** correctly reproducible: hashing the file's bytes up to, and including, the trailing newline immediately before the final `\n---\n\n## Witness\n` marker reproduces it exactly. This is a tool false-positive on an already-correct report, not a corrupted one.

Scoped the finding across the whole corpus first, to avoid either under- or over-building: ran `witness verify-report` (no `--commit`) against every report containing a `## Witness` heading. Only the one file above throws the "ambiguous headings" error. ~24 other files also fail self-verification, but for an entirely different, already-partially-known reason — they predate, or don't follow, the file-embedded-triple convention PR #111 introduced (either declaring "see PR description, never embedded in the file" or "hashed before the Witness section was filled in" — both deliberate, disclosed, now-superseded conventions). That is a separate, much larger conceptual change and explicitly **not** built tonight (see Recommendation / Next Steps) — conflating the two would turn a one-conceptual-change fix into a sprawling one.

No existing corpus-wide `witness verify-report` regression gate exists anywhere in the repo (`grep -rl docs/dream-cycle scripts/ packages/*/src/*.test.ts` finds no such check) — this exact false-positive could recur silently on any future report with a stray heading-shaped line, with nothing to catch it before a human stumbles on it.

## Hypothesis (frozen before implementation)

Given the committed report corpus under `docs/dream-cycle/`, when a new governance test iterates every file and asserts any file with more than one literal `## Witness` heading line is on an explicit, documented, hash-verified grandfather list (and that the list contains no stale/unreproducible entry), then the test should **fail today** (before the grandfather entry exists) specifically pointing at `2026-09-10-compiler-parity-report.md`'s ambiguous heading, and **pass** once that one entry is added — without changing `splitAtWitnessSection`'s existing fail-closed ambiguity behavior (a separate, already-passing test, `report-witness.test.ts`'s "throws on a duplicate Witness heading" / "rejects a duplicate Witness heading", deliberately locks that in for a genuinely adversarial duplicate-heading case and must not be touched), and without editing any already-merged historical report's content. `npm test` must stay green with 0 regressions. Confirmed; not amended after evaluation began.

## Candidate

New file only: `scripts/witness-corpus.test.mjs` (+105 lines, 0 deletions, 1 file). Three `node:test` cases, wired automatically into the existing `npm run test:governance` (`node --test scripts/*.test.mjs`) glob — no `package.json` change needed.

1. `no committed report has more than one "## Witness" heading unless explicitly grandfathered` — scans every `docs/dream-cycle/*.md` file, fails listing any offender not in the grandfather map.
2. `the grandfather list names no file that no longer needs it` — fails if an entry's file now has ≤1 heading (stale-entry detection).
3. `every grandfathered report's witness is still independently reproducible by hand` — generic/data-driven over every `GRANDFATHERED_MULTI_HEADING` entry (not hardcoded to one filename): re-derives the hash from each entry's own `trailingMarker` + the file's current bytes and compares to its `expectedReportHash`. A future entry added without a matching, re-derivable hash fails here mechanically — deliberately mirroring `@dream-machine/ledger`'s `legacyPrefixDigest` fail-closed-on-mismatch design for its own row-count grandfather boundary, per an independent critic's review (see Reward-Hack Check).

The grandfather map currently has exactly one entry: `2026-09-10-compiler-parity-report.md`, with an inline comment stating the real cause (forward-reference placeholder predating the tool) — never a bare "unexplained" exemption.

## Baseline

Parent commit `b2abcc14a632d7e0948962065a7c6c8920cf306c` (`main`, this session's checkout after `git fetch --unshallow`). Measured live before writing the candidate file (nothing to stash — the file did not exist yet): `npm test` → 809 vitest + 195 governance = 1004 passed, 0 failed. `npm run lint` / `npm run typecheck` clean. `npm run build` (8 packages) clean, no wasm/NAPI degradation.

## Evaluation Receipt

Real evaluator: `npm test` (`vitest run && npm run test:governance`), run live before (file absent) and after (file present) on this session's own checkout.

| | Baseline | Candidate |
|---|---|---|
| vitest | 809 | 809 (unchanged, 0 regressions) |
| governance (`node --test scripts/*.test.mjs`) | 195 | 198 (+3 new, 0 regressions) |
| Total | 1004 | 1007 |
| `npm run lint` | clean | clean |
| `npm run typecheck` | clean | clean |

**Non-tautology proof (3 independent negative controls, each then restored and re-verified byte-identical via diff + `git status --porcelain`):**
1. Emptied the grandfather map → test 1 fails, naming `2026-09-10-compiler-parity-report.md (2 headings)` exactly.
2. Added a second (real, single-heading) filename to the grandfather map → test 2 fails, naming the stale entry.
3. Added a fabricated grandfather entry with a wrong `expectedReportHash` → tests 2 **and** 3 both fail closed, naming the bad entry (this is the exact scenario an independent critic flagged — see below — now mechanically caught).
4. Corrupted the real entry's `expectedReportHash` to `'0'.repeat(64)` → test 3 fails with the mismatch.

**Credentials reality check**: `OPENROUTER_API_KEY` is present tonight — `LLM_EVAL` is not blocked. This candidate makes no model calls regardless; verified entirely by the real test suite and direct cryptographic re-derivation.

## Darwin Results

`DARWIN=not-applicable`. Entrypoint probed live: `npx --yes @metaharness/darwin --version` responds with its usage banner (reachable, not blocked) — consistent with the repo's already-tracked unpinned-`npx` supply-chain note (not this candidate's to fix). A single new regression test over a fixed, already-committed document corpus has no evolvable population or numeric fitness objective to search — same judgment as every prior one-conceptual-change fix on this surface (#116/#127/#132/#137/#145/#154/#167/#176).

## Evidence

OBSERVATION (manual corpus audit: exactly one file has 2 "## Witness" headings) → OBSERVATION (live repro: `witness verify-report` throws "ambiguous") → OBSERVATION (byte-level hand reproduction proves the published hash is correct; this is a tool false-positive, not a corrupted report) → OBSERVATION (scoped: ~24 other files fail self-verification for an unrelated, already-partially-known convention-drift reason — explicitly out of scope) → HYPOTHESIS (frozen above) → MEASUREMENT (1004→1007 tests live before/after, 0 regressions) → MEASUREMENT (4 live negative controls prove non-tautology, each restored and diff-verified) → INFERENCE (independent critic subagent, separate context, own reproduction) → DECISION (critic: CLEAR + 1 disclosed non-blocking design gap) → DECISION (gap closed same session: grandfather map made generic/hash-verified per entry) → DECISION (re-verified green post-fix) → DECISION (ship; verdict ACCEPT).

## Reward-Hack Check

Independent adversarial critic (separate subagent context, no authorship stake, instructed to try to break the candidate and find reward-hacking): **CLEAR**, with one disclosed, non-blocking structural gap found and then closed same session.

- Confirmed the diff is purely additive: `git status --porcelain` showed exactly one line (the new file) throughout; `git diff --stat` empty; no existing test, fixture, gold answer, or threshold anywhere in the repo touched (`packages/witness/src/report-witness.test.ts`'s duplicate-heading-rejection tests independently re-read in full and confirmed unweakened).
- Independently reproduced the grandfathered file's hash from scratch, with its own throwaway script (not trusting this candidate's own assertion): confirmed `1c9ec5548ffab1370fadcaf24961a5779b0eaf52690b9314a6483d5e572bec2b` exactly.
- Independently proved non-tautology by emptying the grandfather set itself and re-running, then restoring and diffing byte-identical.
- **Gap found**: the first-draft grandfather list was a bare `Set<string>` of filenames — tests 1/2 would pass for a *future* fabricated entry with a plausible-sounding comment but no actual proof its exemption is still warranted, unlike `@dream-machine/ledger`'s `legacyPrefixDigest`, which mechanically fails closed on a content mismatch for its own grandfather boundary. **Closed same session**: the grandfather list is now a `Map` carrying each entry's own byte marker + expected hash, and the reproducibility test is generic/data-driven over every entry (not hardcoded to one filename) — re-verified by constructing the critic's own named attack (a second, fabricated entry with a wrong hash) and confirming it now fails tests 2 and 3 mechanically, before being removed and the file restored to its real, single-entry state.
- No gold data, threshold, or evaluator config touched. No undocumented cache. No hidden cost (one new, independent test file; no change to any existing module's runtime behavior).

## Security Review

No prompt-injection, MCP-authority, or credential surface touched. No new filesystem-write surface: the test only reads (`readdirSync`/`readFileSync`) under the fixed, repo-relative `docs/dream-cycle/` path resolved via `fileURLToPath(new URL(...))` — no user-controllable path input, no traversal surface. No network or `child_process`/`exec` surface — pure string comparison (`===`, `indexOf`/`lastIndexOf`, no regex, so no ReDoS exposure on file content) plus `node:crypto`'s `createHash`. No production/runtime code path changed — touched surface is new test infrastructure only. The one disclosed design limitation (grandfather-entry authenticity relies on code review, not solely on the mechanical check) is addressed above, not glossed over.

## Scan Findings

**witness**: `witness verify-report` false-positives ("ambiguous... expected exactly one") on an already-legitimate, independently-reproducible historical report because of a pre-tooling forward-reference use of the literal heading text. Fixed tonight with a narrow, explicit, hash-verified grandfather mechanism — not by weakening `splitAtWitnessSection`'s deliberate fail-closed ambiguity behavior, which stays exactly as conservative as before for any genuinely ambiguous future report.

**verify**: no existing corpus-wide verification gate existed for this tool at all — `npm test`/`test:governance` previously had zero coverage asserting the committed report corpus stays verifiable. Tonight adds the first such gate, scoped to the one defect class discovered; the much larger "older convention can't self-verify" gap (~24 files) is scanned, confirmed, and explicitly deferred (see Recommendation), not silently left unmentioned.

## Competitors

- **SLSA / in-toto** (grade A, official docs, confirmed via live search): the standard pattern gates CI on verifier success rather than treating it as informational — the posture this candidate gives `witness verify-report` for the first time.
- **Sigstore/cosign** (grade A, official docs): `cosign verify-attestation` is a mandatory pre-release gate in documented reference pipelines, not best-effort.
- **Sakana AI Scientist / OpenHands / DSPy-GEPA / SWE-agent / AutoGPT lineage**: none publish a comparable self-referential, file-embedded provenance triple to benchmark against (checked via live web search, grade A sources only); no hits for a corpus-regression angle on any of the five — reported as evidence-absent, not inferred.

## Gist

`GIST=LOCAL` — no `gh` CLI gist capability this session (`GH_TOKEN` invalid; `gh auth status` confirms) and no gist-creation MCP tool available. GitHub MCP access itself works fine (`get_me`, issue/PR tools all succeeded) — `FALLBACK=false`. Full report committed at this file.

## Witness

```
report_sha256 : 34e07d7b29706b44ece0b62e5843a32c7bf1b4ee8848b1cb7027ccbf20a13238
session_commit: b2abcc14a632d7e0948962065a7c6c8920cf306c
witness       : 3fc2fa96d63069b3d20d36e1ce3a519c0cee9c1b24bb99e5694eadbb40291bb3
```

Computed over this file's canonical bytes (everything above this heading,
trailing whitespace collapsed to one newline) via
`dream-machine witness stamp docs/dream-cycle/2026-10-16-ledger-signals-report.md b2abcc14a632d7e0948962065a7c6c8920cf306c --report`
— reproducible from the committed file with no unavailable intermediate
bytes. Verify: `dream-machine witness verify-report docs/dream-cycle/2026-10-16-ledger-signals-report.md --commit b2abcc14a632d7e0948962065a7c6c8920cf306c`

## Recommendation

`evaluated: yes` / `verdict: ACCEPT`. All promotion-gate conditions clear: evaluation complete (live before/after on the real evaluator), effect positive (a real false-positive closed, durable new regression coverage added), significance sufficient (deterministic test addition, non-tautology proven by 4 live negative controls), no material regression (809/198, 0 regressions elsewhere, lint/typecheck clean), tests green, reward-hack clear (independent critic, one gap found and closed same session), critic clear, witness valid (below), receipt reproducible (exact commands given throughout). Human review requested for merge — this session never self-merges.

**Next steps (not built tonight, scope deliberately bounded to one conceptual change):**
1. The larger, already-partially-known gap — most pre-2026-09-15 (and several even after) reports use a since-superseded convention (hash-before-insert, or never embedding the triple at all) and so cannot self-verify via `witness verify-report` for reasons unrelated to tonight's ambiguous-heading class — is a legitimate future `ledger-signals`/`witness,verify` candidate: either grandfather them explicitly (this candidate's own pattern, scaled up with real per-entry hashes) or retroactively re-stamp them under their original session commits (the issue #112 precedent already set on 2026-09-15), but that is a larger, separate conceptual change.
2. Consider whether the compiled nightly prompt's STEP 26 self-review should itself run `witness verify-report` on the night's own freshly-committed report, catching this exact defect class the moment it's introduced rather than nights later via manual audit.
3. `ledger signals`' `--merged`/`--open-count` ground-truthing flags already exist (issue #8/PR #7, shipped) but nothing in the compiled prompt instructs a future night to actually pass live-checked values — tonight did this by hand (see Ledger Check). Wiring that into STEP 1.1's own instructions is a distinct, future compiler-parity-surface candidate.
4. Issue #144/PR #145 (`splitRow` pipe-unescape) and issue #153/PR #154 (`blockedEvalStreak` majority conjunct) remain open/draft, their defects still live on `main` — read in full tonight to confirm no overlap with this candidate's file, not re-fixed.
