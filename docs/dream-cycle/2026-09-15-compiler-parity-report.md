# Compiler-Parity SOTA Report — 2026

**Correction note (post-review, see issue #112):** the review left on PR #111
correctly found that this report's originally published `report_sha256`/
`witness` were computed over a pre-insertion draft, not the final committed
bytes — an evidence-integrity defect, not a claim that `validateConfig`'s
fix was wrong. Fixed by adding a canonical exclusion transform
(`@dream-machine/witness`'s new `report-witness` module: hash everything
above this file's trailing `## Witness` heading, so inserting that section
afterward never changes the hash) plus a new `witness verify-report`
CLI command that self-verifies a committed report with no external inputs.
This file's Witness section below is the corrected, reproducible one. Also
corrected in this pass: the diff-size claim (was "29/39 lines", the real
`git diff --numstat` count is 23 source / 29 test lines) and the competitor
table (added source identities, with an explicit caveat that none are
pinned to an exact version).

## TL;DR
`validateConfig` in `@dream-machine/compile` checks presence but never checks
*type* for four `string[]`-typed `dream.config` fields: `labels`,
`competitors`, `extraDisciplines`, `controlPlaneProbes`. A bare-string
authoring mistake (forgetting the `[...]` brackets — an extremely natural
JSON typo) sails through `validateConfig` as `ok:true`, then crashes
`compile()` with an opaque `TypeError` (`labels.map is not a function`,
`competitors.join is not a function`, etc.) deep inside a section builder
instead of a clean, actionable `invalid dream.config` error.

## What's new
This is the fourth self-hosting compiler-parity hardening pass in this
lineage, and it deliberately narrows around an adjacent open PR discovered
mid-session:
- 2026-08-25 (#28/#29, ACCEPT, merged): `adrConvention` object form had zero
  field validation → could compile a corrupted ADR path.
- 2026-09-05 (#78/#79, ACCEPT, merged): `bonusModuli` values were never
  validated (only keys) → could compile a dangling "add " line.
- 2026-09-10 (#104/#105, open draft, unmerged): `slots[i].scan`/`deep`
  entries were never checked for *blank/whitespace* values within an
  already-array field → could compile a dangling `SCAN=,tests` or blank
  `DEEP=` line. Its own reward-hack check explicitly flagged the fields
  fixed tonight (`labels`, `competitors`, `extraDisciplines`,
  `controlPlaneProbes`) as out-of-scope, "a legitimate next-night
  direction."
- Tonight: originally scoped to include a *type* check on `slots[i].scan`
  too (a bare string instead of an array crashes `s.scan.join`/`s.scan.map`
  the same way) — but PR #105 already owns that exact `config.slots.forEach`
  block with its own blank-entry loop (`s.scan.forEach`, which itself would
  still crash — `TypeError: s.scan.forEach is not a function` — if `scan`
  is a bare string, since #105 only checked `.length`, not array-ness).
  Rather than ship a second, overlapping change to the same lines (merge-
  conflict and duplicate-direction risk), this candidate is scoped to the
  four fields #105 does not touch, and a review comment is left on #105
  flagging the residual `scan`-type gap for whoever picks that PR up next.

## Competitors (evidence grade)
| Project | Source identity / version checked | Config validation approach | Grade |
|---|---|---|---|
| LangGraph | `langgraph` docs, "Low Level Concepts" / schema section, as published at langchain-ai.github.io/langgraph (checked 2026-09-15; no pinned release tag recorded — flagged below) | Pydantic schema validation, type-checked at load | A (official docs) |
| DSPy/GEPA | `dspy` GitHub repo (`stanfordnlp/dspy`), `Signature`/`Module` type-hint machinery in the public source tree (checked 2026-09-15; no pinned commit/tag recorded — flagged below) | Python type hints + runtime `isinstance` checks | A (official repo) |
| SWE-agent | `SWE-agent` GitHub repo (`SWE-agent/SWE-agent`), `config/` YAML schema loader in the public source tree (checked 2026-09-15; no pinned commit/tag recorded — flagged below) | JSON Schema validation via `pydantic` | A (official repo) |
| CrewAI | `crewai` public docs (docs.crewai.com), Pydantic-based `Agent`/`Task` config models (checked 2026-09-15; no pinned release recorded — flagged below) | Pydantic models, rejects wrong-typed fields at construction | B (official docs, not independently reproduced) |

**Source-identity caveat (added after review #112's "add source identities/
versions" request):** none of the four rows above were pinned to an exact
release tag or commit sha at authoring time — each is "the public
docs/repo as it read on 2026-09-15," not a reproducible artifact the way
this report's own compiler-parity finding is. Treat the identity column as
"where to look," not as a citation precise enough to re-derive the grade
independently; a future pass that re-grades these should pin an exact
tag/commit for each.

Common pattern across all four: a config field declared as a list type is
validated as a list *before* use, never trusted from raw JSON/YAML. This
repo's `validateConfig` does that for scalar fields (`repo`, `cron`) and for
`adrConvention`/`bonusModuli` (post-#29/#79), and (pending #105 review) for
blank entries within `slots[].scan`/`deep` — but, before tonight, not for
type confusion on `labels`/`competitors`/`extraDisciplines`/
`controlPlaneProbes`.

## Hypothesis (frozen before implementation)
Given a `dream.config.json` where `labels`, `competitors`,
`extraDisciplines`, or `controlPlaneProbes` (each typed `string[]`) is
malformed as a bare string, when `validateConfig` is extended to require
these fields be actual arrays of non-empty strings, then `compile()` on
that malformed config should return a clean validation error (matching the
existing `invalid dream.config: - ...` shape) instead of throwing an
unhandled `TypeError`, with zero regressions on the full test suite and a
byte-identical compiled prompt for the well-formed, self-hosted
`dream.config.json`.

## Benchmarks / Evaluation
- **Baseline repro (parent, pre-candidate):** live-reproduced all four
  crashes via `node -e` against the built `packages/compile/dist/index.js`
  on session commit `3edd426`:
  - `labels: "dream-cycle"` → `validateConfig.ok=true`, `compile()` throws
    `TypeError: labels.map is not a function`
  - `competitors: "LangGraph"` → `ok=true`, throws `competitors.join is not
    a function`
  - `extraDisciplines: "adr-250"` → `ok=true`, throws `extra.map is not a
    function`
  - `controlPlaneProbes: "npm test"` → `ok=true`, throws `probes.join is not
    a function`
  - (also reproduced, but deliberately left unfixed tonight — see above:
    `slots[0].scan: "config-schema"` → `ok=true`, throws `s.scan.join is
    not a function`)
  - Grade: A (reproducible against this repo's own built artifact, not a
    vendor claim).
- **Full baseline suite:** `npm test` → 23 test files / 616 vitest tests +
  81 governance tests, all green, 0 failures.
- **Candidate suite:** 626 vitest (+10) + 81 governance, all green, 0
  regressions (0 pre-existing tests modified or removed — verified by
  diffing the test file).
- **Self-hosted config:** `node packages/cli/dist/bin.js compile
  dream.config.json` byte-identical before/after (already well-formed, so
  no behavior change for the real config — matches #29/#79/#105 precedent).

## Evaluation
Real evaluator: `npm test` (`vitest run && npm run test:governance`), run
parent-then-candidate on identical files. `npm run typecheck` and `npm run
lint` both clean on the candidate. `npm run check:edge-contracts` and `npm
run check:development-policy` also run clean (unaffected by this change,
included for completeness).

## Reward-Hack Check
Self-critiqued against the same checklist #105 used: no gold data touched
(this package ships no benchmark corpus), no threshold changed, no test
`.only`/`.skip`, no existing assertion weakened — diff is purely additive:
`git diff 3edd426..HEAD --numstat` on the `validateConfig` candidate itself
shows `packages/compile/src/config.ts` +23/-0 and
`packages/compile/src/index.test.ts` +29/-0 (corrected from this report's
first draft, which mis-stated 29/39 — see the correction note at the top).
Both new tests-fail-before/pass-after checked live (see repro above). No
undocumented cache. Scope was actively *narrowed* mid-session specifically
to avoid touching code #105 already owns — the opposite of reward-hacking
toward a bigger diff.

Independently re-verified by a fresh subagent critic with no shared
authoring context (own worktree, own reproduction from the parent commit):
confirmed the crash is real for all four fields, confirmed the fix resolves
it, reran the full suite (626 vitest + 81 governance, matching this
report), reverted only `config.ts` and confirmed 9 of the 10 new tests fail
without it (the 10th documents unrelated pre-existing behavior), and
checked edge cases (`null`, non-string elements, whitespace-only elements,
empty array) behave as intended. Verdict: reward-hack check CLEAR.

## Security Review
Pure input-validation tightening inside an existing validator — no new I/O,
no LLM/prompt-injection surface, no MCP/tool-authority change, no credential
exposure, no filesystem/network-scope change. Strictly narrows what
previously validated `ok:true`; cannot newly accept anything previously
rejected.

The post-review witness fix (`report-witness` module) is also low-risk:
pure string parsing/hashing on already-local files, no new I/O or network
surface, no change to `@dream-machine/witness`'s existing `stamp`/`verify`
primitives (additive module only). It intentionally does not change what
counts as a *valid* witness cryptographically — it only fixes which bytes
get hashed, so a report stamped under the old convention that happens to
already be self-consistent still verifies.

## Next steps
1. `slots[i].scan` type-confusion (bare string instead of array) still
   crashes both `validateConfig` itself (via #105's `s.scan.forEach`, once
   merged) and `compile()` (via `s.scan.join`, on current `main`) — flagged
   as a PR #105 review comment tonight rather than fixed here; whoever
   lands #105 should add an array-type check ahead of the blank-entry loop.
2. Extend the same array-type check to `ledgerPath`/`branchPrefix`
   (currently `string`-typed but only checked for presence via `??`, so an
   empty string silently survives into a broken compiled path — a *silent*
   corruption rather than a crash, different enough in symptom to warrant
   its own frozen hypothesis and receipt).
3. Consider a single schema-driven validator (e.g. a small declarative
   field-spec table: name → {required, type, elementType}) to close this
   whole class at once instead of one-field-at-a-time hardening across four
   separate nights (#29, #79, #105, tonight) — a design-level change that
   belongs in its own reviewable PR, not bundled into a <300-line bugfix.
4. `docs/adrs/INDEX.md` has two pairs of duplicate ADR numbers (ADR-0003,
   ADR-0004 each used twice) — a docs-housekeeping defect independent of
   tonight's candidate, flagged for a future developer-experience or
   compiler-parity night.
5. Issue #112's acceptance criteria also ask for migration guidance for
   pre-existing reports stamped under the old (unreproducible) convention:
   those reports' published triples cannot be verified against their
   committed bytes and should be treated as unverifiable legacy evidence,
   not silently upgraded to "valid" — a follow-up documentation pass, not
   done in this PR (which is scoped to compiler-parity, not the witness
   package's docs).

## Witness

```
report_sha256 : 77e60d893bf35b8b4618414fbc40b1263c9638b000a84715ddd52de3088b7cca
session_commit: 3edd426f6c9c4b1e80235f7447dc863e749345cc
witness       : 0b2feb632125eafaf94b442df6d52db160bd849b33f4a3e95d8b7a725a08f2c0
```

Computed over this file's canonical bytes — everything above this heading,
trailing whitespace collapsed to one newline — using the new
`@dream-machine/witness` `report-witness` module (issue #112's fix, this
same PR). Unlike the report's first draft, this triple is reproducible
directly from the committed file with no unavailable intermediate bytes:
inserting this section after computing the hash cannot change it, because
the canonicalization excludes everything from this heading onward. Verify:

```bash
dream-machine witness verify-report docs/dream-cycle/2026-09-15-compiler-parity-report.md --commit 3edd426f6c9c4b1e80235f7447dc863e749345cc
```
