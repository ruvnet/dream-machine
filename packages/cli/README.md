<div align="center">

# ☾ dream-machine

### One honest cycle, every single night.

**A config-driven engine for nightly, cloud-scheduled, evidence-gated repository evolution.**

[![npm](https://img.shields.io/npm/v/dream-machine?color=8b5cf6&label=npm)](https://www.npmjs.com/package/dream-machine)
[![docs](https://img.shields.io/badge/docs-live-22d3ee)](https://ruvnet.github.io/dream-machine/)
[![license](https://img.shields.io/badge/license-MIT-e879f9)](https://github.com/ruvnet/dream-machine/blob/main/LICENSE)

</div>

> **Freeze the model. Evolve the harness.**
> _Evaluation is not promotion_ — the machine never merges; a human does.

```bash
npx dream-machine init --repo owner/name --out dream.config.json
npx dream-machine compile dream.config.json --out PROMPT.md
```

---

The Dream Machine wakes up in an isolated cloud session once a night, forms **one
falsifiable hypothesis** about your repository, measures it against the repo's
real evaluators, and writes down what it learned — whether or not the answer was
the one it hoped for. Then it goes back to sleep, leaving behind a gist, an
issue, a **draft** PR, and one durable ledger row.

```
ledger → research → frozen hypothesis → concrete candidate → baseline
  → evaluation → adversarial critique → bounded Darwin evolution
  → flywheel evidence → witness → issue → draft PR → durable ledger row
```

Every night ends in exactly one verdict — **`ACCEPT`**, **`REJECT`**, or
**`INCONCLUSIVE`** — never a fourth, never silence. A rejected hypothesis with a
clean measurement is a **successful** night. The engine optimizes for shrinking
tomorrow's search space, not for producing PRs.

## Commands

| Command | What it does |
|---|---|
| `dream-machine init --repo owner/name` | scaffold a `dream.config.json` |
| `dream-machine compile <config> --out PROMPT.md` | compile the config → the full routine prompt |
| `dream-machine schedule <config> --env <id>` | emit the cloud `/schedule` routine body |
| `dream-machine ledger verify\|signals\|stats\|append` | work the 10-column `LEDGER.md` |
| `dream-machine witness stamp\|verify` | reproducible `sha256(sha256(report)+commit)` provenance |
| `dream-machine tui` | the nightly dashboard, in your terminal |

```text
☾ dream-machine tui
╭──────────────────────────────────────────────────────────────────────────╮
│ ☾ DREAM MACHINE  ·  ruvnet/dream-machine                                   │
├──────────────────────────────────────────────────────────────────────────┤
│ nights 6   ● 3 accept   ● 1 reject   ● 2 inconclusive                      │
├──────────────────────────────────────────────────────────────────────────┤
│ DATE        DEEP                 VERDICT        FINDING                    │
│ 2026-08-19  compiler-parity      INCONCLUSIVE   config schema gaps         │
│ 2026-08-18  developer-experience ACCEPT         tui verdict panel          │
│ …                                                                          │
├──────────────────────────────────────────────────────────────────────────┤
│ evaluation is not promotion · the machine never merges · a human does      │
╰──────────────────────────────────────────────────────────────────────────╯
```

## Zero dependencies

This CLI **bundles** the engine modules — `@dream-machine/compile`,
`@dream-machine/ledger`, `@dream-machine/witness`, `@dream-machine/schedule` —
so `npx dream-machine` has no runtime dependencies to install. Prefer the
modules directly? They're published standalone under the
[`@dream-machine`](https://www.npmjs.com/org/dream-machine) scope.

## Composes the ruvnet stack (optional)

The evaluation-heavy stages delegate to packages that already own them — and a
night without any of them is a _degraded_ night, not a failed one:
[`@metaharness/flywheel`](https://www.npmjs.com/package/@metaharness/flywheel)
(promotion gate),
[`@metaharness/darwin`](https://www.npmjs.com/package/@metaharness/darwin)
(bounded evolution),
[`@metaharness/redblue`](https://www.npmjs.com/package/@metaharness/redblue)
(adversarial critique), and
[`@ruvector/rvf-wasm`](https://www.npmjs.com/package/@ruvector/rvf-wasm) (RVF
semantic memory over past nights).

## Links

- **Website, walkthrough & live dashboard** → https://ruvnet.github.io/dream-machine/
- **Source & the nightly it runs on itself** → https://github.com/ruvnet/dream-machine
- **Why it's built this way (ADR-0001)** → [design record](https://github.com/ruvnet/dream-machine/blob/main/docs/adrs/ADR-0001-dream-machine-engine.md)

MIT © [rUv](https://github.com/ruvnet)
