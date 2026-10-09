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

## Witness

```
report_sha256 : bcbd53b851ce2e213ddf71215d4b62e9199a7b2d7b12fdf023fa090c277eb752
session_commit: 23a577082aad39750051dc7ef0ec9d0d72900adf
witness       : 3e529171e74805a9a2d22e03a1513a7e01880772355cf7ad939d2a902afb24e5
```

Computed over this file's canonical bytes (everything above this heading, trailing
whitespace collapsed to one newline) — reproducible from the committed file with no
unavailable intermediate bytes. Verify:

```bash
dream-machine witness verify-report docs/dream-cycle/2026-10-07-evaluation-adapters-report.md --commit 23a577082aad39750051dc7ef0ec9d0d72900adf
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
