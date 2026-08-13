# Dream Machine — ADR Index

Architecture Decision Records for `ruvnet/dream-machine`. Naming convention:
`ADR-NNNN-kebab-case-slug.md` (four-digit padding). Each ADR follows the shape:
Title / Status / Date / Related → Context → Decision → Consequences →
Alternatives Considered → Test Contract → References.

| ADR | Title | Status |
|-----|-------|--------|
| [ADR-0001](./ADR-0001-dream-machine-engine.md) | The Dream Machine engine — a config-driven, evidence-gated nightly evolution loop composed from the ruvnet stack | Accepted (v0.1.0 shipped) |
| [ADR-0002](./ADR-0002-dream-cycle-security-adversarial-entrypoint-liveness.md) | Evaluator entrypoints must be classified live/blocked/suspicious-silent before an EVALUATED verdict is recorded | Proposed |

## How to amend

- Edits to a Proposed ADR happen in PRs that reference the ADR number.
- A ratified ADR (`Status: Accepted`) is amended by a follow-on ADR
  (`Status: Supersedes ADR-NNNN`), never edited in place.
- New ADRs append to the series — they do not renumber.
- Cross-references use the ADR number, not the slug, so renames don't break links.
