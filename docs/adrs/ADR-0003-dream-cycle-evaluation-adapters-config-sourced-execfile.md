# ADR-0003: Config-sourced evaluator entrypoints must execute via `execFile` (argv array), never a shell

- **Status**: Proposed
- **Date**: 2026-08-17
- **Related**: ADR-0002 (defines `classifyEntrypointResult`; §2/§3 explicitly deferred auto-wiring `evaluatorEntrypoints` and named the shell-injection precondition for doing so safely)
- **Deciders**: dream-cycle nightly session (evaluation-adapters, SCAN=flywheel/darwin), 2026-08-17
- **Tags**: dream-cycle, evaluation-adapters, security, evaluator-trust, witness-every-quantitative-claim

## 1. Context

ADR-0002 (2026-08-13) shipped `classifyEntrypointResult` and a manual
`verify-entrypoint <label> --cmd "<command>"` command, but explicitly deferred
auto-wiring `dream.config.json#evaluatorEntrypoints` through it — issue #6's
Reward-Hack Check flagged the reason: `IO.exec` runs via `child_process.exec`
(`/bin/sh -c`), safe only because `cmd` came from a human-typed CLI flag. The
"natural next automation" (issue #6's words) — feeding config-sourced values
into that same exec path — would pipe a repo-modifiable string into an
unsanitized shell, a CWE-78 command-injection shape, and issue #6 said this
"MUST be addressed (allowlist or `execFile` with argv array) before anyone
wires that automation."

Tonight is that automation: `verify-entrypoints [config]` reads
`evaluatorEntrypoints` directly from a dream.config and runs every configured
command without a human retyping it. This ADR records the precondition ADR-0002
deferred, now that it's actually being built.

## 2. Decision

Config-sourced evaluator-entrypoint commands are tokenized into an argv array
(`tokenizeCommand`, `packages/cli/src/entrypoint.ts`) and executed via
`child_process.execFile` (`IO.execFile`, wired in `bin.ts`) — never
`child_process.exec`. `execFile` does not spawn `/bin/sh`; the tokenized argv
is passed straight to the target binary, so shell metacharacters in a config
value (`&&`, `;`, `` $() ``, `|`) are received as literal argument text, not
executable syntax.

This is a repo-wide invariant going forward, not just this command's
implementation detail: **any future code path that runs a command sourced from
a config file, ledger row, or other non-human-typed input must use
`IO.execFile`, never `IO.exec`.** The existing manual `verify-entrypoint --cmd`
command is the one carved-out exception — its input is a human-typed local CLI
flag, the exact case ADR-0002 already assessed as low-risk, and it is left
unchanged tonight.

## 3. Consequences

- **Closes ADR-0002's deferred precondition.** `evaluatorEntrypoints` can now
  be auto-wired without reintroducing the injection shape ADR-0002 flagged.
- **New `IO.execFile?` capability**, optional and additive — `IO.exec?` is
  untouched, every existing IO/test fake unaffected (confirmed: baseline 96
  tests → candidate 105, 0 removed/modified).
- **`tokenizeCommand` is intentionally minimal** (whitespace split +
  double-quoted segments) — sufficient for this repo's own config values
  (`npm test`, `npx @metaharness/darwin evolve --sandbox mock`), not a general
  shell-grammar parser. A config value needing single-quotes or escaping would
  need the tokenizer extended first; not built preemptively.
- **Does not sandbox the entrypoint process itself** — `execFile` still runs
  the real binary with real filesystem/network access, same as `exec` did.
  This ADR closes the shell-injection layer, not the "should evaluator
  entrypoints run in a container" question (out of scope; a much larger,
  protected-path change per `.github/workflows/automerge.yml`'s own guard
  list, and not what issue #6 asked for).

## 4. Alternatives Considered

- **Allowlist of permitted commands/binaries** (the other option issue #6
  named). Rejected for tonight: requires deciding and maintaining an allowlist
  policy (which binaries, which flags) with no current evidence of what that
  should contain beyond the 2 entrypoints this repo configures today;
  `execFile` fully closes the injection vector with less new policy surface.
  Worth revisiting if `evaluatorEntrypoints` grows to include less-trusted
  sources.
- **Sanitize/escape the string before passing to `exec`.** Rejected: shell
  quoting/escaping is a well-known footgun (the exact class of bug this repo's
  own tests now probe for in `tokenizeCommand`'s metacharacter test) — safer
  to never construct a shell string at all than to escape one correctly.
- **Full container sandbox per entrypoint invocation** (OpenHands/SWE-agent's
  approach, researched tonight — see the committed report's Competitor table).
  Rejected for tonight: correct long-term direction, but a materially larger
  change (new infra dependency, protected-path territory) than this candidate's
  scope; the classifier + execFile pairing is the cheapest correct primitive
  available at this repo's current scale.

## 5. Test Contract

1. `tokenizeCommand` is pure (no I/O) and unit-tested: plain whitespace
   commands, double-quoted segments, and — the security-relevant case — shell
   metacharacters (`&&`, `` $() ``) verified to tokenize as literal argv text,
   not re-split as shell syntax (`packages/cli/src/entrypoint.test.ts`).
2. `dream-machine verify-entrypoints` round-trips real `execFile` results
   through the existing classifier, aggregates to the worst verdict's exit
   code, and reports a clean no-op when a config has no
   `evaluatorEntrypoints` (`packages/cli/src/index.test.ts`).
3. Live receipt against this repo's real `dream.config.json` tonight: `bench`
   → live, `darwin` → live — matches hand-verified ground truth.
4. Live injection-safety receipt (not a unit test, an actual subprocess run):
   a config value `"npm test && rm -rf /"` / `"echo hi && touch PWNED"`
   produces no shell side effect — `&&` arrives as literal argv text to a
   single process, confirmed by absence of the marker file. Full transcript in
   `docs/dream-cycle/2026-08-17-evaluation-adapters-report.md`.
5. No pre-existing test weakened, removed, or modified; `npm test` baseline
   96/96 → candidate 105/105, 0 regressions.

## 6. References

- ADR-0002 §2, §3 (the deferred precondition this ADR closes).
- Issue #6 (2026-08-13), Reward-Hack Check section — the original flag.
- CWE-78 (OS Command Injection) mitigation guidance: `execFile`/`spawn` with
  an argv array vs `exec`'s shell string — cross-checked tonight across
  SecureFlag's Node.js OS-command-injection reference, nodejs-security.com's
  secure-coding guide, and the ESLint `eslint-plugin-security`
  `detect-child-process` rule docs (Grade B, cross-checked, non-fabricated).
- NVIDIA Developer Blog, "Practical Security Guidance for Sandboxing Agentic
  Workflows and Managing Execution Risk" (2026) — cross-repo context on where
  comparable agent frameworks (OpenHands) do and don't apply sandboxing to
  config/hook-driven process execution (Grade B, vendor technical blog,
  cross-checked against the framework's own architecture docs).
- DSPy/GEPA official docs (`dspy.ai`) — comparison point: in-process metric
  functions have no analogous shell surface at all (Grade A, official docs,
  fetched directly).
