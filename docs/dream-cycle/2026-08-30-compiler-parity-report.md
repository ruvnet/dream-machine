# Compiler-Parity SOTA Report — 2026

## TL;DR

Tonight's rotation (slot 0, DAYINT 20260830 % 5 = 0): DEEP=compiler-parity,
SCAN=config-schema,golden-snapshots. Finding: the compiled nightly prompt's
STEP 17–18 unconditionally instructs `gh gist create --public` for gist
publication with no fallback path, and no other tool is offered. This is a
compiler↔runtime parity bug — the compiled instructions assume tooling
(`gh` CLI) that this repository's own actual nightly-runner environment does
not have, and has never had. It was observed and worked around ad hoc once
already (2026-08-13, `GIST=LOCAL`, see `docs/dream-cycle/2026-08-13-security-adversarial-report.md`
lines 229–234), then rediscovered again tonight — proof the gap survives
between nights because the *compiler* was never corrected, only the *session's
behavior*. Fixed by making STEP 17–18 describe gist publication as
best-effort across whatever gist tooling actually exists (`gh`, an MCP gist
tool, or neither → `GIST=LOCAL`), matching the fallback already proven safe
twice. `EVALUATED=yes` on the real evaluator (`npx vitest run`, 98→99 tests,
0 regressions).

## What's new

- `packages/compile/src/index.ts`, `step17to18Publish()`: STEP 17–18 no longer
  hard-codes `gh gist create --public` as the only path. It now says to use
  whichever gist-creation capability the environment actually provides, and
  makes explicit that having neither `gh` nor an MCP gist tool is NOT a
  FALLBACK/stop condition — it degrades to `GIST=LOCAL` (report committed
  into the PR) and the cycle continues, exactly as this repo's own history
  already required twice.
- `packages/compile/src/index.test.ts`: new test
  `'treats missing gist tooling as best-effort, not a stop condition'`
  asserting `GIST=LOCAL`, `not FALLBACK`, and the removal of the old
  unconditional `gh gist create` sentence — pins the fix so it can't silently
  regress.
- Golden snapshot regenerated (`packages/compile/src/__snapshots__/index.test.ts.snap`)
  to match the new STEP 17–18 wording — the only change in the snapshot diff.

## Competitors (gist/artifact-publication tooling assumptions)

| System | How it handles an unavailable publication/artifact tool | Grade |
|---|---|---|
| Sakana AI "The AI Scientist" | Writes LaTeX/PDF papers to local disk as the primary artifact; no dependency on a specific external publish API for the core loop | A (official repo/paper) |
| OpenHands (OpenDevin) | Actions run inside a sandboxed runtime with an explicit action/observation contract; a missing tool surfaces as an `ErrorObservation`, not a silent hang | A (official docs) |
| SWE-agent | Tool calls are declared in a YAML "tool bundle" the agent must actually have; missing tools are a config-time error, not a runtime assumption baked into the prompt | B (official repo, config semantics inferred) |
| DSPy/GEPA | Metric/optimizer pipeline has no hard dependency on any single external publishing tool; artifacts are local by default | B (absence confirmed via official docs) |
| AutoGPT-lineage | Community failure catalog repeatedly documents agents assuming a tool/API is present and failing silently or hallucinating success when it isn't | C (matches tonight's exact failure mode before the fix) |

## Hypothesis (frozen before implementation)

> Given the Dream Machine's own self-hosted nightly compiler, when STEP 17–18
> of the compiled prompt is changed from unconditionally requiring
> `gh gist create --public` to describing gist publication as best-effort
> across whatever tool the environment actually provides (with an explicit
> `GIST=LOCAL` fallback), then future nights running in a `gh`-less,
> MCP-tool environment (as this one is, confirmed via `which gh` → absent and
> a live tool search returning no gist-creation MCP tool) should no longer
> need to improvise the fallback from first principles each time, relative to
> the current baseline where the fallback exists only as one-off prose in a
> single past report — subject to: no other step's semantics change, all
> existing tests stay green, and the invariants (ACCEPT/REJECT/INCONCLUSIVE,
> no self-merge, no fabricated GIST_URL) are untouched.

## Benchmarks / Evaluation Receipt

Real evaluator: `npx vitest run` (this repo's own `bench` entrypoint).

- Baseline (parent, commit `7933c3599abe22df5290f4609d1f93f598feb3de`):
  `Test Files 7 passed (7)`, `Tests 98 passed (98)`.
- Candidate (same commit + this diff, pre-build verified with
  `npm run build -w packages/compile && npx vitest run`, then full
  `npm run build && npx vitest run`):
  `Test Files 7 passed (7)`, `Tests 99 passed (99)` (98 baseline + 1 new
  pinning test). Zero regressions, zero flaky reruns.
- Golden-snapshot diff is exactly the STEP 17–18 paragraph; nothing else in
  the 13.5KB compiled prompt moved (`git diff` on the snapshot file confirms
  a single contiguous hunk).
- Self-hosting closure check: re-ran
  `node packages/cli/dist/bin.js compile dream.config.json --out /tmp/tonight-prompt-v2.md`
  after the fix and confirmed the repository's own real `dream.config.json`
  (not just the test fixture) now emits the corrected STEP 17–18 text —
  this is the same prompt this very session compiled and is executing.

Evidence grade: A (first-party, reproducible in this repo, no external
claim).

## Darwin Results

Not run. Bounded Darwin is gated on "only after basic evaluation clears,
only if available"; `npx @metaharness/darwin evolve --sandbox mock` was not
invoked because tonight's change is a documentation/prompt-text fix inside
the compiler with no numeric objective to evolve against (a wording change
has no fitness landscape). Recording the skip explicitly rather than
fabricating a lineage.

## Evidence

- OBSERVATION: `which gh` → not found; live `ToolSearch` for "gist create" →
  no MCP gist-creation tool in this session's toolset.
- OBSERVATION: `docs/dream-cycle/2026-08-13-security-adversarial-report.md`
  independently hit the identical gap 17 nights ago and improvised the same
  `GIST=LOCAL` fallback this candidate now encodes into the compiler.
- MEASUREMENT: `npx vitest run` 98/98 → 99/99, 0 regressions (exact command
  output captured above).
- DECISION: encode the fallback into `@dream-machine/compile` itself (the
  single source of truth per this repo's own header comment: "Do not
  hand-edit — change the config and recompile") rather than leaving it as
  per-night improvisation.

## Reward-Hack Check

Independent-critic pass (self-adversarial, since no second agent was
spawned — recorded as a limitation): checked for (a) weakened benchmark —
no assertions were removed, one was added, the only removed text is the
golden snapshot's byte-for-byte copy of the now-superseded STEP 17–18
paragraph, which is the expected artifact of a deliberate, documented wording
change, not a loosened invariant; (b) altered gold answers — none exist for
this surface; (c) cherry-picking — the new test explicitly asserts the OLD
unconditional sentence is gone (`not.toMatch`), so a revert would be caught;
(d) exploited evaluator — none, `vitest` ran unmodified; (e) hidden cost —
none, change is ~10 lines; (f) threshold changes — none; (g) undocumented
cache — none. No unresolved signal.

## Security Review

No security-sensitive surface touched: no prompt-injection vector changed
(the compiled prompt text is more explicit, not more permissive), no
tool/MCP authority granted or removed, no credential path touched, no
filesystem/network scope changed, no agent-impersonation surface, no
benchmark/memory poisoning vector (the golden snapshot is regenerated
deterministically from source, not hand-edited). Least-privilege unaffected.

## Scan Findings

**config-schema** — `validateConfig()` in `packages/compile/src/config.ts`
still does not validate `EvaluatorEntrypoints` values are non-empty strings,
`labels`/`competitors`/`extraDisciplines` are string arrays, or that
`DreamSlot.scan` has exactly 2 entries (the type says
`[string, string] | string[]`, but only `< 1` is checked, as a warning, not
an error). Two open, unmerged PRs already target adjacent schema gaps
(`#29` adrConvention pad/dir, `#40`/`#39` evaluatorEntrypoint positional
arg) — not re-filed tonight to avoid duplicating in-flight work; flagged
here as still-open scan surface for a future compiler-parity night once #29
and #40 land or are closed.

**golden-snapshots** — the single existing snapshot
(`packages/compile/src/__snapshots__/index.test.ts.snap`) covers only the
`metaharness` fixture config with `autoMerge` toggled inline in a separate
non-snapshotted test; there is no golden snapshot of this repo's *own*
`dream.config.json` compiled output, so a future regression in the
self-hosted prompt (the one actually executed nightly) would only be caught
indirectly through the fixture snapshot. Noted as a next step, not fixed
tonight (would be a second, separable candidate).

## Witness

See below — computed over this exact file's frozen bytes and the session
commit, per this repo's own `ADR-0001` self-reference discipline (the stamp
cannot be embedded inside the file it stamps).

## Recommendation

Human review of the draft PR. `EVALUATED=yes`, `VERDICT=ACCEPT` (candidate
is a real fix to a real, twice-reproduced parity gap; positive effect on the
compiled prompt's correctness in this repo's actual execution environment;
tests green with zero regressions; no reward-hacking; no security concern).
Two follow-ups explicitly NOT done tonight (next steps, not silently
dropped):
1. Add a golden snapshot of the repository's own `dream.config.json`
   compiled output (not just the `metaharness` fixture) so a self-hosting
   regression is caught directly.
2. Tighten `validateConfig()` for `EvaluatorEntrypoints`/`labels`/
   `competitors`/`extraDisciplines`/`DreamSlot.scan` cardinality — deferred
   to avoid duplicating in-flight PRs #29 and #39/#40.
