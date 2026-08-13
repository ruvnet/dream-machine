# ADR-0002: Evaluator entrypoints must be classified live/blocked/suspicious-silent before an EVALUATED verdict is recorded

- **Status**: Proposed
- **Date**: 2026-08-13
- **Related**: ADR-0001 §2.3 ("Evaluation is delegated, never reimplemented"), §2.4 ("the engine must never hard-depend on [evaluation backends]"), §5 Test Contract item 4 (optional-backend degradation)
- **Deciders**: dream-cycle nightly session (security-adversarial, SCAN=redblue/supply-chain), 2026-08-13
- **Tags**: dream-cycle, security-adversarial, supply-chain, evaluator-trust, witness-every-quantitative-claim

## 1. Context

Tonight's SCAN=redblue probe reproduced a real, 100%-reliable failure in
`npx @metaharness/redblue` (the SCAN=redblue evaluator entrypoint this repo's
own `dream.config.json` declares): the command exits `0` with **zero bytes**
on both stdout and stderr, for every subcommand tried. Root cause: the
package's CLI guards its dispatch with `import.meta.url ===
\`file://${process.argv[1]}\``, a comparison that fails once the executable
is reached through the symlink `npm`/`npx` always create for a package's
`bin` entry — so the dispatch body silently never runs.

ADR-0001 §2.3 composes `@metaharness/{flywheel,darwin,redblue}` as the
pipeline's evaluation backends and explicitly says the engine must treat them
as optional (§2.4) — but "optional" was only specified for the *absent*
case (package not installed, no credentials → `LLM_EVAL=blocked`). Nothing in
ADR-0001 addresses the case discovered tonight: a backend that *is* installed,
*is* invoked correctly, and *exits 0* — while having silently done nothing.
An exit code alone cannot distinguish this from a genuine clean pass, and
STEP 5-9 of the compiled nightly prompt ("Do not infer results from logs.
Preserve the real receipt") assumes a human/agent will catch this by hand
every time. Tonight's session did, by accident of manual probing — that is
not a mechanism, it's luck.

## 2. Decision

Ship `@dream-machine/cli`'s `classifyEntrypointResult` (`packages/cli/src/entrypoint.ts`)
as the canonical, deterministic classifier for any evaluator-entrypoint
result in this engine, with three outcomes:

- **live** — exit 0 with non-empty stdout or stderr.
- **blocked** — nonzero exit (the tool ran and told us something is wrong;
  the reason is in stderr).
- **suspicious-silent** — exit 0 with empty stdout *and* empty stderr. Never
  equated with a clean pass; never sufficient on its own to record
  `EVALUATED=yes`.

Exposed tonight as `dream-machine verify-entrypoint <label> --cmd "<command>"`
(exit 0/1/2 respectively, so the classification is scriptable). Any future
wiring that runs `dream.config.json`'s `evaluatorEntrypoints` automatically
(not built tonight — see Consequences) must route the raw exec result through
this classifier before it is allowed to influence a night's `EVALUATED`/
`VERDICT` fields.

## 3. Consequences

- **Extends, not replaces, ADR-0001's optionality principle.** "The engine
  must never hard-depend on [backends]" (ADR-0001 §2.4) now also means: never
  trust a backend's bare exit code as sufficient evidence it did real work.
- **No behavior changed for the `bench: npm test` entrypoint** — it always
  produces real output and classifies `live`, confirmed tonight.
- **This is a detection primitive, not a fix.** It does not patch
  `@metaharness/redblue` (out of this repo's scope — a different repo,
  `ruvnet/agent-harness-generator`) and does not yet auto-wire
  `evaluatorEntrypoints` through the classifier inside the compiled prompt
  itself — that wiring is next-step work, explicitly deferred rather than
  rushed into tonight's already-scoped candidate.
- **New CLI surface** (`verify-entrypoint`) is additive and optional
  (`IO.exec` is `exec?`, so every existing IO/test fake is unaffected).

## 4. Alternatives Considered

- **Patch `@metaharness/redblue` directly.** Rejected for tonight: wrong
  repo/scope (`ruvnet/agent-harness-generator`, not `ruvnet/dream-machine`);
  filed as a follow-up recommendation instead (Node now ships
  `import.meta.main`, stable-track ≥22.18/24.2, as the correct native fix).
- **Silently swallow the redblue failure and move on.** Rejected: violates
  `witness-every-quantitative-claim` — a "the scan passed" claim built on an
  unexamined exit code is exactly the overclaim this repo's own disciplines
  forbid.
- **Hard-fail the whole night when any evaluator entrypoint is
  suspicious-silent.** Rejected: too strong — `suspicious-silent` is a signal
  requiring investigation, not automatically a `REJECT`; a legitimate
  zero-output tool exists in principle, so the classifier flags for review
  (`INCONCLUSIVE`-shaped) rather than asserting failure.

## 5. Test Contract

1. `classifyEntrypointResult` is pure (no I/O, no clock, no randomness) and
   unit-tested for all three verdicts plus the whitespace-only-output edge
   case (`packages/cli/src/entrypoint.test.ts`).
2. `dream-machine verify-entrypoint` round-trips a real exec result through
   the classifier and exits 0/1/2 for live/blocked/suspicious-silent
   respectively (`packages/cli/src/index.test.ts`).
3. Live receipt against this repo's real `dream.config.json`
   `evaluatorEntrypoints` tonight: `bench` → live, `flywheel` → blocked,
   `redblue` → suspicious-silent, `darwin --version` → blocked (wrong flag,
   visible reason) — all four match ground truth verified by hand.
4. No pre-existing test weakened, removed, or modified; `npm test` baseline
   85/85 → candidate 95/95, 0 regressions.

## 6. References

- ADR-0001 §2.3, §2.4, §5(4).
- `nodejs/node#57616` — "Provide an equivalent of require.main for ESM"
  (documents the symlink footgun; Grade B, fetched directly).
- Node.js `import.meta.main` docs (`nodejs.org/api/esm.html`) — the native
  replacement fix (Grade A, fetched directly).
- `pytest` exit code 5 ("no tests were collected") — closest prior art for a
  dedicated "ran clean but did zero real work" signal (Grade B).
