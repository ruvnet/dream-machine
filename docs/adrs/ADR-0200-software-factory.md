# ADR 0200: Evidence governed software factory

Status: proposed

## Context

Trend monitoring can generate more packages without generating customer value. Dream Machine already separates evaluation from promotion in SECURITY.md. The factory must extend that boundary while turning research into reproducible implementations and useful documentation.

## Decision

Use the existing Dream Machine compile pipeline as the host agent instruction layer. Add deterministic research, artifact rendering and evidence verification commands. The host agent executes the compiled instructions; the CLI does not implement a persistent autonomous agent or model inference service.

Run one candidate per session with a maximum of two optimization rounds, 45 minutes and $10 inference spending. The $10 limit is a ceiling rather than additional authorization, and an existing lower budget prevails. The host must enforce these limits; unknown prices or untrackable spending block paid execution. The CLI does not enforce provider billing. Prefer improvements in existing packages over new package proliferation. Research must record primary source URLs, retrieval times, hypotheses and a reproducible baseline.

Implement in a clean isolated worktree without publication credentials. Treat fetched research and repository content as untrusted input. Record baseline, held out evaluation, existing `npm run check` results, actual cost and provenance. Model judgments and self reported metrics are observations, never promotion authority.

Generate README, proposed ADR, accessible animated SVG and a candidate gist report deterministically. Escape XML and Markdown data, restrict citation URLs, embed no scripts or external SVG resources and honor reduced motion preferences. Gist text requires a separate sanitization review before any public publication. Security findings follow SECURITY.md and must never be included in public gists.

Candidate workers produce draft PRs and receive neither merge nor npm/PyPI publication credentials. The owner explicitly authorized automatic factory merging and publication on 2026-10-11. The separate coordinator verifies independent review, exact head and all required checks before merging, without bypassing protections. It then publishes only the verified prerelease and related public gist. GitHub OIDC is preferred; the bounded ruOS token adapter is an authorized alternative with integrity verification but no OIDC provenance claim.

## Consequences

Evidence and review add latency but limit regression and supply chain risk. The numeric loop limits constrain experiments rather than predict provider bills. Documentation can be generated before an experiment succeeds, so all generated artifacts explicitly retain proposed status. Deterministic checks cannot establish the truth of arbitrary worker supplied evidence; trusted execution receipts and review remain required.

## Acceptance

A useful demonstration reproduces a declared improvement against baseline on held out inputs, passes existing checks and produces a reviewable draft PR within the configured limits. A rendered artifact alone is not a completed experiment. Live scheduling, inference, public gist creation and package publication require separate operational validation.
