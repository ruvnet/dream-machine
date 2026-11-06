# Software factory implementation receipt

Date: 2026-10-11

Status: locally validated implementation candidate. Not merged, deployed or published to npm.

## Implemented

* Bounded primary-source collection and provenance records.
* Factory instructions for the existing Dream Machine host agent pipeline.
* README, proposed ADR, accessible animated SVG and public gist draft generation.
* Evidence assessment that never grants publication authority.
* Gist request validation, ruvnet identity verification, reconciliation and exact-content retry reuse.
* Separate build and OIDC publication jobs, exact tarball inspection and registry integrity verification.
* Packaged dream-machine-factory CLI in dream-machine 0.2.0-next.0.

## Measured validation

`npm run check` passed: 806 Vitest tests and 187 Node governance/contract tests.
The 28 new focused factory tests are included in that total. Source typecheck,
build, lint, Edge contracts and development policy checks also passed.

`npm audit --audit-level=high` reported zero known vulnerabilities on the locked
dependency graph. This is a dated advisory lookup, not proof of absence of defects.

The staged tarball installed in a fresh temporary directory with lifecycle scripts
disabled. Both the existing version command and new factory help command passed.
Tarball allowlist contains exactly nine files. The staged artifact was not published.

SVG XML parsed and a static 1000 by 400 preview rendered successfully with sharp.
Motion CSS and reduced-motion rules have regression coverage. A live browser motion
test was unavailable because this executor has no installed Playwright browser.

Independent review identified and resolved gist sanitization bypass, sequential
publication duplication, stable release dispatch and nonfinite measurement issues.
Concurrent gist writers still require the documented exclusive coordinator lease.
Credential pattern scanning supplements, and does not replace, publication review.

## Live research retrieval

* https://huggingface.co/api/daily_papers : error; retrieved 2026-10-11T16:35:20.018Z
* https://api.github.com/repos/ruvnet/ruflo/releases?per_page=5 : ok; retrieved 2026-10-11T16:35:20.018Z; SHA256 5f22ce1f3e220a44ad0412c0dba5a5110aaf783e59f580aac525f6edfe89ce37
* https://export.arxiv.org/api/query?search_query=all%3Asoftware%20agents&start=0&max_results=5&sortBy=submittedDate&sortOrder=descending : ok; retrieved 2026-10-11T16:35:20.018Z; SHA256 fed76111c682bfa528fd9cc7ccedd95d4173371919318bc9b4af67d4976c660a

GitHub releases and arXiv were retrieved. The Hugging Face daily feed failed the
bounded retrieval check. No missing source was fabricated. Retrieval does not
establish SOTA, benchmark improvement or novelty. No paid inference or GPU jobs ran.

## Staging integrity

{
  "name": "dream-machine",
  "version": "0.2.0-next.0",
  "tag": "next",
  "filename": "dream-machine-0.2.0-next.0.tgz",
  "sha256": "f03242200e44afb238aff679ee97d9333997af0787145cd35e5ca766deb17827",
  "integrity": "sha512-bfxbAnr6WCQeZpF9X74RkEcs0bQQlUIgbVx1LJ2/CLtDflClZYBaYShGbsAtGlmsgPx8Qoy3I8cgPRSo+hmlMA=="
}

## Activation requirements

1. Independently review and merge the exact factory revision under existing repository policy.
2. Verify main branch protection, required reviews and npm-release environment restrictions.
3. Configure npm trusted publisher for ruvnet/dream-machine, release.yml, npm-release.
4. Use an authorized ruvnet GitHub identity with gist permission. The observed Work Desktop gh login is proffesor-for-testing and has no repository push permission. No alternate identity was used for writes.
5. Run the scheduled host agent against reviewed source, respecting existing budget and exclusive ownership.

Source tools support the workflow. The scheduled host agent performs implementation,
testing and optimization; there is no background daemon or provider budget enforcement
inside the CLI. Stable publication requires explicit manual dispatch. Candidate
workers cannot merge or create release tags. Existing portfolio cadence is preserved.

## Acceptance command

```bash
npm ci --ignore-scripts
npm run check
node --test scripts/factory-core.test.mjs scripts/factory-artifacts.test.mjs scripts/factory-release.test.mjs scripts/software-factory.test.mjs
```

Operational acceptance remains one independently reproduced improvement from a
new source through a reviewed PR and an integrity-verified npm prerelease with its
related public gist, inside the existing authorized budget. It is not yet demonstrated.
