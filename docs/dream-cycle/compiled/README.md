# Compiled dream cycles

Each `.md` here is the full nightly prompt for one scheduled task, compiled from a
config by `@dream-machine/compile`. They are build outputs: never hand-edit them.
Edit the config, then run `node scripts/compile-targets.mjs`.
`packages/compile/src/targets.test.ts` fails CI if a mirror drifts from its config.

| Mirror | Config | Scheduled task |
|---|---|---|
| `ruvnet-dream-machine.md` | `dream.config.json` | Dream Machine Nightly Dream Cycle (compiles itself at run time; no paste needed) |
| `ruvnet-ruflo.md` | `targets/ruvnet-ruflo.dream.json` | Ruflo Nightly Dream Cycle |
| `ruvnet-metaharness.md` | `targets/ruvnet-metaharness.dream.json` | MetaHarness Nightly Dream Cycle |
| `ruvnet-ruclip.md` | `targets/ruvnet-ruclip.dream.json` | RuClip Nightly Dream Cycle |
| `ruvnet-ruvector.md` | `targets/ruvnet-ruvector.dream.json` | ruvector-nightly-research |

## Deploying a change

Paste the mirror's full contents as the prompt of the matching scheduled task.
Do not recreate the task. Recreating it resets its run history, and loses the
repository checkout and credentials the existing task was created with.

## What the hand-written prompts had that the compiled ones do not

The hand-written prompts were reviewed line by line against the template. Repo-specific
constraints were carried into each config's `extraDisciplines`, `competitors`,
`controlPlaneProbes` and `evaluatorEntrypoints`. The remaining differences:

| Target | Not carried over | Why it is acceptable, or what to do |
|---|---|---|
| All | Gist self-score rubric (STEP 1.2) | The template keeps the low-score signal but not the 10-point rubric; add it to the template if it is still used. |
| Ruflo | `DAYINT % 75 == 25` advanced-features bonus | `bonusModuli` fires only on remainder 0. |
| MetaHarness | `DAYINT % 75 == 25` federation bonus | Same limitation. |
| Ruflo, MetaHarness | Explicit Darwin fitness weights and Flywheel replay commands | The template keeps bounded Darwin, a fitness function frozen first, and replay-blocks-ACCEPT; the exact weights are left to the night. |
| RuVector | 12 candidates (now 5), three named Rust variants, RVF/RVM/ruFlo/MCP/edge analyses, 8+8 application lists, the 38-section write-up | The largest change. The engineering constraints (Rust only, no mocks, fair baseline, separate build vs query timing, no cross-methodology comparisons) are kept as disciplines, and the research floor is raised to 10/4/3. The long write-up requirements are dropped. Keep the hand-written prompt for RuVector if that report format is valued more than mode selection and self-review. |
| RuVector | Free topic choice each night | Replaced by a 5-slot rotation over ANN indexing, agent memory, edge/WASM, provenance/security and hybrid retrieval. |

Gained everywhere: protected deep research with source floors, a SOTA delta, the
attack pass, CONSOLIDATE / RESEARCH-ONLY / IMPLEMENT / RESEARCH modes, a weekly
scored self-review, ready-on-ACCEPT PRs, the schedule contract (receipts and
duplicate-firing skip), and one snapshot suite over all five cycles.
