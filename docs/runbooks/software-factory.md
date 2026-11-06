# Software factory operator runbook

The factory is a bounded host agent workflow. The command line tools support research collection, compiled instructions, rendering and evidence checks. They do not run a continuous agent or independently enforce a remote provider's billing limit.

## Session procedure

1. Start the authorized scheduled host agent with a clean isolated worktree of the approved target repository. Exclude npm, PyPI and other publication credentials. Provide only scoped research and inference access.
2. Run `node scripts/software-factory.mjs research factory.config.json --out DIR` and review source freshness, licensing and relevance. Prefer primary sources. Select at most one candidate with a concrete customer or maintenance benefit.
3. Run `node scripts/software-factory.mjs compile factory.config.json --research DIR/research.json --out PROMPT.md`. This produces a factory supplement to combine with the existing `dream-machine compile dream.config.json` output. The host agent executes the combined instructions using the existing Dream Machine pipeline.
4. Record baseline before mutation. Implement and run at most two optimization rounds. Treat $10 as a ceiling, not additional spending authorization; any existing lower budget prevails. Enforce the authorized inference budget and a 45 minute session limit on the host. The CLI does not enforce provider billing. Unknown prices or untrackable costs block paid execution. Run held out evaluation and the existing `npm run check` in addition to targeted checks.
5. Run `node scripts/software-factory.mjs render INPUT.json --out DIR`. Review generated README, proposed ADR, animated SVG and gist text. Render output is a draft even when supplied results claim success.
6. Run `node scripts/software-factory.mjs verify EVIDENCE.json factory.config.json`. Retain provenance and complete logs with secrets redacted. A passing structural gate cannot authenticate worker claims by itself.
7. Open a draft PR containing the implementation, documentation and evidence. Before publishing a public gist, inspect its exact contents for credentials, private data, internal references and security findings. Report vulnerabilities privately under SECURITY.md.
8. After independent review and required checks, the owner-authorized coordinator may merge the exact head and use the separate trusted release workflow to publish an exact version from reviewed main. Verify the registry tarball and provenance. Never provide publication tokens to an implementation worker.

## Renderer input

`repo` is the exact npm package name, not a repository URL. `sources` accepts HTTPS URL strings or objects with `title` and `url`. `results` accepts observation strings or JSON objects; these are rendered as unverified observations. The renderer never approves a release.

```json
{
  "repo": "@ruvnet/example",
  "title": "Measured retrieval improvement",
  "hypothesis": "A candidate may reduce latency without reducing recall.",
  "sources": [{"title": "Primary research", "url": "https://example.org/paper"}],
  "results": [{"metric": "p95_ms", "baseline": 10, "candidate": 8, "status": "unverified observation"}]
}
```

## Operational validation

Scheduling, model inference, spending enforcement and publication must be validated on the actual host. Do not infer that any of them are active merely because these tools exist. Success means one reproducible improvement within limits, existing checks passed, a draft PR available and no leaked secrets. Reject candidates that regress a protected metric, fail tests or lack evidence; retain the failed experiment report for future research.

## Schedule integration

Upgrade the existing RuV Portfolio Improvement schedule at 02:00 America/Toronto daily rather than creating another timer. Schedule changes require verification in the scheduler; this runbook is not proof that the change has been applied.

## Trusted release setup

Configure npm trusted publishing for repository `ruvnet/dream-machine`, workflow `release.yml` and environment `npm-release`. Configure and externally verify required reviewers for that GitHub environment. These settings are external controls; a repository file cannot prove that reviewers or npm trust are configured.

Automatic release may run only after human review and merge to main, with the correct exact version tag pointing to the reviewed commit. Candidates remain draft PRs. Treat every publication failure as an error and verify the published version and provenance before reporting success. Publication credentials remain absent from candidate workers.

## Public gist publication

The `gist-plan` command takes a JSON object with `report` (the reviewed public
Markdown), `repo` (`ruvnet/dream-machine`) and a full `commit` SHA. It writes the
exact GitHub request and prints its digest. After inspecting the content, run
`gist-publish` with that digest. Publication revalidates the report, checks that
`gh` authenticates as `ruvnet`, reconciles prior matching gists and returns the
canonical URL. It accepts no token argument. Run only under the schedule's
exclusive repository lease: GitHub does not provide an atomic create-if-absent
operation, so simultaneous publishers on different hosts must be excluded.

```bash
node scripts/software-factory.mjs gist-plan public-report-input.json --out gist-request.json
node scripts/software-factory.mjs gist-publish gist-request.json --digest REVIEWED_SHA256
```

A digest binds reviewed bytes; it does not prove that a person reviewed them.
Credential pattern checks are supplemental. The host must separately confirm
that all outgoing content is public, non-sensitive and suitable for publication.
An uncertain response must be reconciled before retrying. Missing `ruvnet` gist
permission leaves the draft available and never substitutes another account.

Stable package publication requires manual workflow dispatch with `dry_run`
false and a matching stable version tag. Pushing a prerelease version tag may
publish to `next` after the configured environment review and all checks pass.
No research or candidate worker may create release tags or modify this policy. The owner-authorized coordinator may perform exact-head merges and prerelease publication after independent review and required checks.

## Authorized ruOS npm publishing

Use `python3 scripts/ruos-npm-publish.py preflight` on the credential-owning desktop.
The adapter returns identity metadata only. After exact artifact inspection and
installed-package validation, run `publish TARBALL EXPECTED_SHA256 VERSION`.
The adapter accepts only the Dream Machine prerelease package and publishes to
`next` with lifecycle scripts disabled. NPM_TOKEN stays in memory on the owning
desktop and no unrelated key enters the npm child. Never copy the binding or token
to ChatGPT, another computer or GitHub secrets. Registry integrity is independently
verified; this token route does not claim GitHub OIDC provenance.
