# Dream Machine — ADR Index

Architecture Decision Records for `ruvnet/dream-machine`. Naming convention:
`ADR-NNNN-kebab-case-slug.md` (four-digit padding). Each ADR follows the shape:
Title / Status / Date / Related → Context → Decision → Consequences →
Alternatives Considered → Test Contract → References.

| ADR | Title | Status |
|-----|-------|--------|
| [ADR-0001](./ADR-0001-dream-machine-engine.md) | The Dream Machine engine — a config-driven, evidence-gated nightly evolution loop composed from the ruvnet stack | Accepted (v0.1.0 shipped) |
| [ADR-0002](./ADR-0002-dream-cycle-security-adversarial-entrypoint-liveness.md) | Evaluator entrypoints must be classified live/blocked/suspicious-silent before an EVALUATED verdict is recorded | Proposed |
| [ADR-0005](./ADR-0005-failure-attribution-before-mutation.md) | Attribute failure before mutation | Proposed |
| [ADR-0006](./ADR-0006-root-cause-security-patch-evaluation.md) | Root cause security patch evaluation | Proposed |
| [ADR-0007](./ADR-0007-claim-relative-evidence-receipts.md) | Claim-relative evidence receipts bind sufficiency and committed experiment coverage without granting authority | Proposed |
| [ADR-0008](./ADR-0008-provenance-bound-environment-reconstruction.md) | Provenance bound environment reconstruction | Proposed |
| [ADR-0100](./ADR-0100-edge-runtime-trust-boundaries.md) | Separate the Dream Machine control plane from the bedside runtime and actuator safety authority | Proposed |
| [ADR-0101](./ADR-0101-uno-q-ruview-home-core-runtime.md) | Governed edge runtime on Arduino UNO Q with RuView HOMECORE | Proposed |
| [ADR-0102](./ADR-0102-apple-watch-healthkit-local-bridge.md) | Apple Watch HealthKit local bridge with retrospective default and research-only live sensing | Proposed |
| [ADR-0103](./ADR-0103-governed-self-evolution.md) | Govern self-learning, self-optimization, and self-evolution as separate authority levels | Proposed |
| [ADR-0104](./ADR-0104-mcp-ruvector-local-data-plane.md) | Use RuVector as the local evidence plane behind a capability-minimal MCP facade | Proposed |
| [ADR-0105](./ADR-0105-mac-studio-codex-swarm-control-plane.md) | A Mac Studio and Codex desktop swarm form the governed development control plane | Proposed |
| [ADR-0106](./ADR-0106-executable-software-prototype-and-evidence.md) | Executable software prototype and bounded evidence | Implemented for software prototype; hardware and research blocked |

## How to amend

- Edits to a Proposed ADR happen in PRs that reference the ADR number.
- A ratified ADR (`Status: Accepted`) is amended by a follow-on ADR
  (`Status: Supersedes ADR-NNNN`), never edited in place.
- New ADRs append to the series — they do not renumber.
- Cross-references use the ADR number, not the slug, so renames don't break links.
