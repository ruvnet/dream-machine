# RuV portfolio weekly evidence receipt — 2026-09-28

## Decision

**INCONCLUSIVE.** The first W40 weekly evidence edition is reproducible and reviewable, but it is not independently reviewed or merged. No learning, retrieval improvement, novelty, release, deployment, or delivered customer value is promoted.

## Frozen outcome

Hypothesis: a public-only weekly edition can project the last seven receipts and current exact-main validation into one canonical record set, readable Markdown, normalized SQLite, and a genuine native RVF container while preserving exact identity, source hashes, logical idempotency, and the repository's source/binary separation.

Owner: authenticated RuV portfolio process. Baselines: Dream Machine `9ebc9b66cfdd7f5d9f11ffafa5675239c58a456c`; ruvnet/ruvnet `765f4ed581f2c56a7d4cdaad7b278df90b4d59bb`; Core Memory W39 snapshot `8ea74991af244fba209edffb818def83154ae64b`; Core Memory adapter candidate `e91cb15efd32a037fd941639404d8793f8466d68`. Full compute/API cost remains unknown. Rollback is non-promotion and removal of the isolated W40 branches; W39 and exact/FTS retrieval remain intact.

## Portfolio and due outcomes

Pagination found 325 accessible owned public repositories, none archived and 11 empty. The current connection did not expose a complete private inventory, so private activity is not reported as zero and no private identity appears here.

The last seven completed public receipts were reviewed. No new seven- or thirty-day deadline matured in that window. Dream Machine PR 125 remains merged but live ruOS adoption, authoritative desktop completion, latency, cost, and customer outcomes remain unverified. The carried retrieval forecast is not due until 2027-01-23.

## Weekly edition

Core Memory draft PR [#137](https://github.com/ruvnet/core-memory/pull/137) contains eight stable claims and five source identities. The complete binary bundle is preserved at immutable snapshot commit [`1322dad4674f7276b1d95b971f1f3d436bb9468c`](https://github.com/ruvnet/core-memory/tree/1322dad4674f7276b1d95b971f1f3d436bb9468c/docs/weekly/2026-W40). The public RuV orientation is staged on branch [`docs/2026-W40-evidence`](https://github.com/ruvnet/ruvnet/tree/docs/2026-W40-evidence) pending independent review; it was not pushed to main.

Validation passed: unique IDs; no orphan evidence; SQLite integrity and foreign-key checks; identical claim IDs and source hashes across projections; native RVF reopen using `@ruvector/rvf` 0.3.4 / native 0.2.3; exact numeric-ID lookup; and a same-week logical rebuild with zero duplicate records. Eight representative smoke queries each returned the intended claim in exact, FTS5, and RVF top three. The queries derive from the catalog and are not an untouched quality benchmark, so no retrieval gain is claimed. The RVF projection is a 256-dimensional L2-normalized deterministic hashed-token baseline, not a learned embedding.

Measured final-build resources: 6.46 ms build time, 49,479,680-byte peak RSS, 6,291,456-byte RSS delta, 8,856-byte RVF, and 102,400-byte SQLite. Exact/FTS/RVF query p50 was 0.069/0.131/0.089 ms and p95 was 0.686/0.206/0.107 ms; RVF cold open was 0.500 ms. These single-environment timings are descriptive, not a promotion benchmark.

## New finding

On exact ruvnet main, both marketplace schemas, dependency locks, package closure, and `npm audit` pass; audit reports zero vulnerabilities across 94 dependencies. The Node 24 host suite passes 15/16 because it invokes a fixed snapshot with the wall clock while asserting current-only wording. On 2026-09-28 the 2026-09-22 snapshot is correctly stale, so runtime behavior fails closed while the non-hermetic test fails. This is confirmed backlog, not a security bypass; no implementation candidate was attempted during the weekly documentation edition.

Dream Machine rebuilt successfully, compiled the current config into a 14,258-byte routine, and passed 150/150 governance tests. Ruflo read-only security and secret scans reported zero findings. No high or critical public vulnerability was confirmed.

## Research and integration boundaries

No research-routing strategy changed and no reusable lesson was promoted. The available evidence does not provide two independently reproduced tasks. Autogenous, LatentMesh, KGE, and a held-out retrieval comparison were not run or relabeled as evidence. The private harness progress Site was left unchanged. No ruOS user-journey change was proposed, so no desktop execution was attempted.

## Blockers and next action

Independent review is absent. Core Memory PR 130 remains open and unreviewed; its CI and continuation checks pass, while the security workflow is red because repository CodeQL upload is disabled. PR 137 is stacked on that adapter branch and cannot be publication-ready before the prerequisite is reviewed. The RuVnet host test needs a frozen `now` or an expectation that branches on freshness state.

Next action: independently review PR 130, then replay PR 137 from its exact head and run `node scripts/weekly-evidence/verify-v2.mjs docs/weekly/2026-W40`. Separately fix the RuVnet test by passing a deterministic clock without weakening stale-data behavior.

No issue, merge, main-branch push, release, deployment, Site update, permission change, strategy promotion, or private disclosure occurred.
