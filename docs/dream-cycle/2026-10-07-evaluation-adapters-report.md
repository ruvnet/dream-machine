# Evaluation-Adapters SOTA Report — 2026

## TL;DR
`verify-entrypoints` (PR #116, 2026-09-17) automates liveness classification of this
repo's own `dream.config.json#evaluatorEntrypoints`. A 2026-09-18 review hardening
(`looksLikeCompoundCommand`) made it refuse *any* config value containing a shell
control-operator token outright, to avoid naively dispatching `argv[0]` with a
multi-command string's remainder as its arguments. That fix was correct but
over-broad: this repo's own real `darwin` entrypoint —
`rm -rf .metaharness && npx @metaharness/darwin evolve . --sandbox mock` — is
exactly that shape, so the automation this repo built specifically to avoid manual
`verify-entrypoint --cmd` retyping could **never** classify its own darwin entry as
anything but a fixed `blocked (exit 1) — compound command`, live, every single night,
regardless of whether darwin itself was healthy. Tonight adds `splitAndChain()`: a
narrow, safe extension that recognizes a command chained *only* by `&&` (no other
operator, no empty segment) and runs each segment in order via `execFile` — never a
shell — short-circuiting on the first nonzero exit, exactly like a real shell's `&&`.
Live-verified against the real `dream.config.json`: `darwin` now classifies `live`.

## What's new
- `entrypoint.ts`: `splitAndChain(argv): string[][] | null` — pure, no I/O.
- `index.ts`'s `verify-entrypoints`: when `looksLikeCompoundCommand` is true, try
  `splitAndChain` first; only fall back to full refusal if it returns `null`
  (any operator other than `&&` present, or any empty segment).
- Other operators (`;`, `|`, `||`, `&`) and malformed `&&`-chains are still refused
  outright, unchanged from the prior behavior — this is additive, not a relaxation
  of the general compound-command guard.

## Competitors (evaluator-adapter liveness / compound-command handling)
| Project | Relevant practice | Grade |
|---|---|---|
| OpenHands | Sandboxed action executor; actions are typically single commands dispatched through its own action schema, not raw shell strings — doesn't need this problem. | B (official docs) |
| SWE-agent | Container-isolated bash tool; commands run through an actual shell inside the container, so `&&` is shell-interpreted by design — different trust model (full shell, not argv-exec). | C (public docs/commentary) |
| DSPy/GEPA | In-process Python metric functions; no shell-string evaluator-entrypoint concept at all. | A (official docs — architecturally sidesteps the class of bug) |
| Sakana AI Scientist | Sandboxed generated-code execution; no published mechanism for safely running a trusted multi-step shell pipeline without a shell. | C (secondary literature) |
| AutoGPT lineage | Historically broader shell-out surface, no documented argv-safe chain execution. | C |

No competitor surveyed publishes an `execFile`-only, no-shell implementation of `&&`
chaining; this remains a repo-specific hardening, not a reproduction of external SOTA.

## Hypothesis (frozen before implementation)
> Given `dream.config.json`'s own `evaluatorEntrypoints.darwin` value is an `&&`-chain
> (`rm -rf .metaharness && npx @metaharness/darwin evolve . --sandbox mock`), when
> `verify-entrypoints` gains `splitAndChain()` — recognizing a command chained *only*
> by `&&` with no empty segment, and running each resulting segment via `execFile` in
> order, short-circuiting on the first nonzero exit — then `verify-entrypoints` run
> against this repo's real config should classify `darwin` as `live` (or another real
> verdict) instead of a fixed `blocked: compound command`, subject to: any other
> control operator (`;`, `|`, `||`, `&`) present anywhere in the command, or any
> leading/trailing/doubled `&&` producing an empty segment, must still be refused
> outright exactly as before (fail closed, not guessed); a plain non-compound command's
> behavior is byte-identical to before; `npm test` stays green with 0 regressions.

## Benchmarks / Evaluation
Real evaluator: `npm test` (`vitest run && npm run test:governance`), this repo's own
`bench` entrypoint.

| | Baseline (`main@23a5770`) | Candidate |
|---|---|---|
| vitest | 769 | 778 (+9 new, 0 regressions) |
| governance | 150 | 150 (unchanged) |
| Total | 919 | 928 |
| typecheck | clean | clean |
| lint | clean | clean |

Live end-to-end, against the real `dream.config.json`, run twice in a row (proving
the chain's own `rm -rf .metaharness &&` prefix keeps it idempotent, same as before):
```
$ node packages/cli/dist/bin.js verify-entrypoints dream.config.json
bench: live (exit 0) — produced output
darwin: live (exit 0) — &&-chain, all 2 segments ran: produced output
$ node packages/cli/dist/bin.js verify-entrypoints dream.config.json   # run again
bench: live (exit 0) — produced output
darwin: live (exit 0) — &&-chain, all 2 segments ran: produced output
```
`git status --porcelain` after both runs: clean (`.metaharness/` gitignored, no stray
artifacts). Baseline-vs-candidate measured live (not inferred from logs): candidate
diff applied/reverted via `git diff`/working tree, same commands run both times.

Darwin bounded run (supporting evidence only — not evaluated as the code candidate):
`rm -rf .metaharness && npx --yes @metaharness/darwin evolve . --sandbox mock`
reachable and exercised live as part of control-plane discovery; see Darwin Lineage.

## Reward-Hack Check
Independent adversarial critic (separate subagent, fresh context, full repo read
access, instructed to try to break the candidate, no shared authoring state) reviewed
the diff against the exact pre-existing tests it replaces, checked && short-circuit
correctness and edge cases (empty chain, non-executed loop, mixed operators, no-space
`a&&b`), and ran the test suite independently.

**Verdict: CLEAR**, with one real but non-security, low-severity gap found and fixed
same session: `splitAndChain`'s original empty-segment guard checked segment *length*
only, so a quoted empty token between two `&&`s (`a && "" && b` → `[['a'], [''], ['b']]`)
slipped through as a length-1 segment whose sole token is `''` — a falsy executable
name that the single-command path already guards against (`if (!file)`) but this new
chain path did not. Fixed by changing the guard from `s.length === 0` to `!s[0]`
(rejects both an empty array and a `['']` array identically), with a dedicated
regression test (`returns null for a quoted-empty-token segment`). `execFile` is
never shell-invoked regardless, so the pre-fix gap was never shell-exploitable — at
worst it produced an `ENOENT`-class failure with a less-clear message than the
single-command path's explicit "empty command" diagnostic — but it is a real
inconsistency with this module's own stated fail-closed posture, correctly not
waved off. Confirmed: the two pre-existing tests that were replaced (`refuses a
shell-metacharacter config value...`, `refuses this repo's own real darwin entry...`)
had their *behavior* assertions updated, not their *safety invariant* weakened — the
property both old and new tests enforce ("never dispatch an executable with the
wrong/garbage arguments") still holds, now exercised by assertions on the exact
per-segment `file`/`args` pairs `execFile` receives.

## Security Review
No new credential, network, or MCP-authority surface. `execFile` is still never
given a shell (unchanged) — only the literal `&&` token is interpreted, and only in
this process, never passed to a shell or reinterpreted by the child. The property
the original `looksLikeCompoundCommand` hardening protected — "never dispatch an
executable with the wrong/garbage arguments" — is preserved: each `&&` segment gets
its own correctly-tokenized argv, computed once and never mixed with another
segment's tokens. Any operator this code doesn't have exact, narrow semantics for
(`;`, `|`, `||`, `&`) is still refused outright, unchanged. Trust boundary unchanged
from prior nights: `dream.config.json` is repo-committed, PR-reviewed configuration,
never runtime-attacker-controlled.

## Darwin Lineage
`DARWIN=not-applicable` for the code candidate itself — a classifier/dispatch-layer
change with a fixed input/output contract, no evolvable population to fitness-search
(same precedent as every prior single-conceptual-change night on this surface: #65,
#91, #116, #132, #137, #148). The *entrypoint* itself (not the candidate) was
exercised live via the real `verify-entrypoints` run above, which is the direct
subject of tonight's finding.

## Consolidate Refresh — 2026-10-27

Mode: CONSOLIDATE (STEP 1.5, ADR-0011). Selected as the oldest eligible open draft
PR out of 20 open `dream/*` candidate PRs (review queue well over the 6-PR limit;
`pipelineMergeRate` ≈ 0.591, 39 merged / 66 candidate). Eligibility: draft, own
Evaluation Receipt already ACCEPT, surface ≠ `routine-self-review`, no
`dream-consolidate` marker for tonight's SHA. The original 2026-10-07 ACCEPT verdict
is unchanged by this refresh — this section adds evidence, it does not re-litigate
the hypothesis.

**Merge.** `main`@`3fc3222d2e5566a203331d3686c4d2eaf06713a8` merged into
`dream/2026-10-07-evaluation-adapters`@`d5ecc971cda16474e2b1b494e4dc8652bc7314ce`
via merge commit (never rebased, never force-pushed). One textual conflict:
`docs/dream-cycle/LEDGER.md` (append-only; resolved by concatenating both sides'
rows in date order — no row content changed). `packages/cli/src/entrypoint.ts` and
its test file: zero independent changes on `main` since this PR's original base
(`23a5770`). `packages/cli/src/index.ts`/`index.test.ts`: ~65 unrelated lines (the
`ledger outcomes`/`ledger backlog` subcommands from ADR-0011) — confirmed by direct
diff, not inference, to share no function, import, or code path with
`verify-entrypoints`/`splitAndChain`/`tokenizeCommand`.

**Re-evaluation.** Real evaluator (`npm test` = `vitest run && npm run
test:governance`), fresh `npm ci && npm run build` (0 wasm/NAPI degradation), then
`git fetch --unshallow` to clear the known environmental shallow-clone
`git show <sha>` oracle failure in `benchmark-ticket-codec.test.mjs` (same class as
issue #149/PR #150 — confirmed via `git rev-parse --is-shallow-repository`, not
assumed) which otherwise fails 3 unrelated governance tests on any fresh checkout:

| | Baseline (`main`@`3fc3222`) | Candidate (merged head) |
|---|---|---|
| vitest | 886 | 895 (+9 new, 0 regressions) |
| governance | 195 | 195 (unchanged) |
| Total | 1081 | 1090 |
| lint / typecheck | clean | clean |

Baseline measured in an isolated `git worktree` on bare `main`@`3fc3222`, same
fresh-checkout procedure, to avoid any cross-contamination with the candidate
branch's build artifacts.

Live re-repro against the real, now-drifted `dream.config.json` (its
`evaluatorEntrypoints.darwin` is now version-pinned and carries `-y`:
`rm -rf .metaharness && npx -y @metaharness/darwin@0.12.0 evolve . --sandbox mock`
— a different literal string than this PR was originally authored and tested
against on 2026-10-07):

```
$ node packages/cli/dist/bin.js verify-entrypoints dream.config.json
bench: live (exit 0) — produced output
darwin: live (exit 0) — &&-chain, all 2 segments ran: produced output
```

Identical on a second run (idempotent); `git status --porcelain` clean after both.

**Fresh independent critic.** Separate subagent, no shared authoring context,
instructed to try to break this exact diff against the drifted config. Verdict:
**CLEAR**. Hand-traced and live-executed `splitAndChain` against the pinned/`-y`
darwin string and confirmed it segments correctly; confirmed every
`verify-entrypoints` dispatch path is `execFile` with no `shell: true` (the one real
shell wrapper, `io.exec`, is reachable only from the separate, human-typed
`verify-entrypoint --cmd` command, never from `dream.config.json`); re-confirmed the
reward-hack check (the two "updated" pre-existing tests are a legitimate behavior
change, net +9 tests, no narrowed coverage); re-confirmed the merge-drift analysis
above independently rather than trusting this section's claim. One disclosed,
non-blocking, pre-existing gap: no single test feeds the exact current pinned/`-y`
darwin string through `splitAndChain` end-to-end (existing coverage uses the
pre-pin string); the live CLI repro above exercises it instead. Not fixed in this
refresh — CONSOLIDATE mode re-evaluates and re-critiques, it does not add new
functional commits beyond the merge itself.

**Promotion gate**, re-applied: evaluation_complete ∧ effect_positive ∧
significance_sufficient ∧ no_material_regression ∧ tests_green ∧ reward_hack_clear
∧ critic_clear ∧ witness_valid ∧ receipt_reproducible — all hold.
**ACCEPT confirmed, unchanged.**

## Witness

```
report_sha256 : 4164eaf662c7199b6569509d7a84da638ef52aa8b651a9724d1aff742b9d1ef5
session_commit: 3fc3222d2e5566a203331d3686c4d2eaf06713a8
witness       : ad8436fe77bad1e33cb79900889e689ef7e4d04e0716f5d2aa08105afa8cfa56
```

Computed over this file's canonical bytes (everything above this heading, trailing
whitespace collapsed to one newline) — reproducible from the committed file with no
unavailable intermediate bytes. Supersedes the 2026-10-07 triple (superseded, not
deleted, per the Consolidate Refresh section above). Verify:

```bash
dream-machine witness verify-report docs/dream-cycle/2026-10-07-evaluation-adapters-report.md --commit 3fc3222d2e5566a203331d3686c4d2eaf06713a8
```

## Next steps
1. If/when `dream.config.json` ever adds a `flywheel` or `redblue` entrypoint whose
   command is also an `&&`-chain, `verify-entrypoints` now handles it the same way —
   no further code change needed; flagged for completeness, not acted on tonight
   (no such entry exists yet).
2. `splitAndChain`'s `&&`-only scope is deliberate (documented non-goal: `;`/`|`/`||`/`&`
   have different semantics this module does not reimplement). If a future
   entrypoint genuinely needs e.g. `;` (unconditional sequencing), that is a separate,
   not-yet-justified extension — do not preemptively build it.
3. `tokenizeCommand`'s existing whitespace-only operator-token scope (documented since
   2026-08-17) still means `a&&b` (no surrounding spaces) is not recognized as compound
   at all — inherited, unchanged, not this night's surface to fix.
