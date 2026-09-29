# RuV portfolio outcome receipt — 2026-09-29

## Decision

**ACCEPT — narrowly scoped package-delivery closure.** The accepted Ruflo MCP source remediation is now present in official published artifacts. This decision establishes delivery and bounded package behavior only; it does not establish adoption, production deployment, or customer value.

## Contract and inventory

The Dream Machine execution contract was read first from main at `9ebc9b66cfdd7f5d9f11ffafa5675239c58a456c`: README `6c5fc3d43c20b3b9b84f0a5b99ee6c5e14ac9f81`, SECURITY `1663f995e80a3088e46fa6fa6633351ad934a959`, config `c17b00036f11b09cb0999f5142089c84252531f9`, ADR-0001 `5770eac0d4ba6634897c0da982fb5c200f8b6a51`, evidence-freshness ADR `2e78b1fd994f83994c715d34c150e1838e37cfbc`, and the reviewed ruOS runbook `93704f8d3814d2d281f96ef10377c4ec30e0274d`.

Pagination returned 325 owned repositories: 221 public and 104 private aggregate-only; none archived and 11 empty. Open PR and issue queues were sampled for current risk and existing work reuse. Deep review was limited to Ruflo artifact delivery, Core Memory W40 correction, and the Dream evidence trail.

## Frozen hypothesis

If the official current-tag `@claude-flow/mcp` artifact closes the accepted source-to-registry gap, then:

1. alpha.10 and stable 3.0.0 must install and import from their exact tarballs;
2. alpha.10 must preserve direct argument boundaries in all three shipped helper paths on a no-effect fake `gh` workload;
3. stable 3.0.0 must not publish the affected helper surface;
4. clean installs must report zero npm-audit findings.

The untouched confirmation workload was three benign edge-token cases containing shell-like punctuation but no external effect. Threshold: 3/3 argument-boundary cases, 2/2 clean imports, affected stable helper absent, and zero audit findings.

## Artifact receipt

- `3.0.0-alpha.10`: published 2026-09-27 15:34:16Z; npm shasum `50d52b3544aae00abe4ac5f0ba832d83ff3a12fb`; SHA-256 `cb17b2537a05e7ce26759fcbf622df2e064bf5ef7a67239501fe43b42a97731c`.
- `3.0.0`: published 2026-09-28 20:56:12Z; npm shasum `56e54ca5b0bbad3f8ecab0e5d980251ed12abac5`; SHA-256 `0c44e4e99634cd6e73d3fa64fb9bdb6a5516f9c5db0d1ac9fb56090db179a56d`.
- Current `latest`, `v3alpha`, and `alpha` tags resolve to `3.0.0`.
- Alpha.10 bounded replay: 3/3 pass with literal argument preservation and no marker effect.
- Clean package imports: 2/2 pass; each exposed 50 module exports.
- Clean-install `npm audit`: 0 findings for alpha.10 and stable 3.0.0.
- Stable package surface: affected helper absent.
- No production endpoint, credential, or real GitHub mutation was used.

The repository-approved pinned Ruflo security command was attempted twice and failed before scanning with the same local npx-cache `ENOENT` fingerprint. It is not represented as a passing scan. Package audit and bounded behavior evidence remain valid but narrower.

## Durable correction

Core Memory draft PR [#137](https://github.com/ruvnet/core-memory/pull/137) was updated rather than duplicated. The original 2026-09-27 observation is preserved as superseded and a dated correction was added.

- Source head: `981c9cc3910397e23602d7cdd64019e4284029a3`
- Immutable artifact snapshot: `a253b7221cefe5c63f0792a48f15c7f20b518661`
- Canonical edition: 9 claims, 7 sources
- Verification: SQLite integrity and foreign keys pass; native RVF reopens; exact numeric-ID lookup and source/claim projection parity pass; same-week rebuild has zero duplicate IDs or source hashes.

No new issue or pull request was opened. No merge, deployment, release action, default-branch push, Site change, credential change, or strategy promotion occurred.

## Research and outcome status

No search/routing strategy was changed. Autogenous, KGE, and ruOS were not needed for this package-delivery confirmation. No reusable lesson was promoted because the two-distinct-task gate is not met. The Ruflo remediation is now **verified published**; adoption, error rate, latency, cost, and customer outcomes remain unverified. The next seven-day outcome review is due 2026-10-04 for alpha.10 and 2026-10-05 for stable 3.0.0.

## Runnable acceptance test

```sh
set -eu
tmp=$(mktemp -d)
cd "$tmp"
npm init -y >/dev/null
npm install --ignore-scripts @claude-flow/mcp@3.0.0
npm audit --audit-level=high
node --input-type=module -e "const m=await import('@claude-flow/mcp'); if(!m) process.exit(1)"
test ! -e node_modules/@claude-flow/mcp/.claude/helpers/github-safe.js
```

Owner: Ruflo release maintainer. Rollback: deprecate a faulty published version and retag a previously verified artifact through the authorized release workflow. Cost: local elapsed time recorded by the run; full compute/API cost unknown, never treated as zero. Independent human review remains pending.

