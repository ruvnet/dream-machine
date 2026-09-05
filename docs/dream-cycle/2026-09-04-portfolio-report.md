# Dream Machine portfolio report — 2026-09-04

## Executive result

- Inventory: 316 owned repositories; 214 public, 102 private, 0 archived, 11 empty.
- Search indexing: 278 indexed and 38 unindexed.
- Default-branch activity since 2026-09-03: 8 commits across 4 public repositories. Private activity was 0 repositories and 0 commits in aggregate.
- Open-state scan: GitHub returned 100 open pull requests and 100 open issues at connector caps; both totals are lower bounds.
- Deep cohort: Core Memory, RuView, Ruflo, MetaHarness, and RuVector.
- Verdict distribution: 0 ACCEPT, 1 REJECT, 4 INCONCLUSIVE.
- Actions: five exact-head PR reviews, this existing Dream draft PR reused for evidence, zero new issues, implementation PRs, direct pushes, merges, releases, or automerge changes.

No private repository identity, finding, branch, issue, commit, dependency, or activity detail is included in this report.

## Contract and prioritization

The default branch of `ruvnet/dream-machine` was read first at
`7933c3599abe22df5290f4609d1f93f598feb3de`. Binding sources were
`README.md`, `SECURITY.md`, `dream.config.json`, ADR-0001,
`packages/compile/src/index.ts`, CI, manifests, and the main ledger.

Selection followed the configured 35/30/10/10/10/5 weighting with
security/functionality overrides. The cohort was selected for an HTTP
authentication boundary, sensing provenance, semantic ranking, MCP-registration
security coverage, and signed state-root integrity. RVM PR #63 received a
rotation scan but was not counted as a sixth deep review.

## Repository 1 — Core Memory

### Frozen hypothesis

PR #51 authenticates before body consumption, rejects unsupported expectations,
and closes unauthenticated requests, thereby bounding pre-authentication HTTP
work without breaking valid MCP traffic.

### Baseline, candidate, and critique

- Candidate: draft PR #51 at `ee1ef7ac1fb764a111bb1a9b34a9fedd772bb9ed`.
- The patch moves authentication ahead of JSON body parsing and adds raw-socket
  tests for partial, chunked, oversized, malformed, Expect, and disconnect cases.
- Exact-head CI and dependency/repository audit pass; 56 tests are reported.
- The Security workflow is red because CodeQL cannot publish its result with the
  current integration permissions. This is a workflow-configuration failure,
  not evidence that the code is clean.
- The path still waits for potentially expensive authentication before rejecting
  a declared over-limit `Content-Length`; a fast header-only refusal and a
  bounded-concurrency slow-auth test remain appropriate acceptance gates.
- Reward-hack check: passing raw request tests is not treated as a substitute for
  successful CodeQL or rate-limit/concurrency evidence.

Acceptance threshold: exact-head CodeQL green, all raw-socket tests retained, a
no-body-read declared-length refusal before authentication, and a bounded slow-
authentication concurrency test.

**INCONCLUSIVE**

## Repository 2 — RuView

### Frozen hypothesis

PR #1794 makes client simulation explicit opt-in, emits zero fabricated frames
while unavailable by default, and prevents reconnect races from creating parallel
sockets or mislabeling stale data as live.

### Baseline, candidate, and critique

- Candidate: PR #1794 at `fbecae4e0244eef2d5333e8049777bc2c20e4c48`.
- The source defaults simulation off, adds stale/unreachable banners, and uses
  epoch plus in-flight guards around asynchronous ticket minting and reconnects.
- Seven runtime UI files change, but no test file changes.
- All four exact-head workflow groups require maintainer authorization; no unit,
  browser, accessibility, build, or security receipt is attributable to the head.
- Hardware/accuracy claims are explicitly outside this UI-only hypothesis.
- Reward-hack check: visual labels and source inspection are not accepted as proof
  that every race or reconnect path emits zero synthetic frames.

Acceptance threshold: exact-head browser/unit tests for default and explicit
simulation modes, two concurrent starts, stop-during-ticket-mint, superseded
socket close, retry-ceiling recovery, failed status probes, zero generated frames
without opt-in, and persistent stale/unreachable labeling.

**INCONCLUSIVE**

## Repository 3 — Ruflo

### Frozen hypothesis

PR #3169 replaces token-Jaccard redundancy scoring with embedding-cosine MMR and
improves semantic diversity without reducing relevance, compatibility, privacy,
or release quality.

### Baseline, candidate, and critique

- Candidate: draft PR #3169 at `0a4c03462a31a80d89622b4ebf97b64c6677f0cd`.
- The focused fixture distinguishes a lexical low-overlap paraphrase from a truly
  different topic; the candidate changes the selected second result.
- Five of six exact-head workflow groups are red. One memory test still fails and
  the broader TypeScript baseline remains red.
- The PR bundles an unrelated Dream backlog workflow with the ranking change.
- The three-item synthetic fixture provides no representative relevance,
  diversity, duplicate-rate, latency, or memory measurement.
- Reward-hack check: a hand-sized fixture can be optimized directly and is not a
  substitute for a frozen retrieval corpus.

Acceptance threshold: split the workflow change, restore required CI/typechecks,
and publish a frozen representative-corpus comparison of Recall/nDCG, diversity,
duplicate rate, p50/p95 latency, and memory overhead, including malformed and
dimension-mismatched embeddings plus output-leakage checks.

**REJECT**

## Repository 4 — MetaHarness

### Frozen hypothesis

PR #276 makes threat-model and scan-MCP output agree for policy, standard MCP,
and Claude settings registrations without dropping or inventing servers.

### Baseline, candidate, and critique

- Candidate: draft PR #276 at `52e752372fb827722655099f9fba7c07c6266d88`.
- Focused evidence reports 563 tests passing with 2 skipped, downstream integration
  82/82, root integration 31/31, clean TypeScript, and green CI plus Real Tools.
- The adversarial loop caught and corrected a dropped `.mcp.json` path before the
  current head, providing useful MetaHarness self-critique evidence.
- The required Security workflow is red because the locked production dependency
  audit contains unresolved critical/high aggregate signals. Details are withheld
  from this public report and require private reachability/affected-version triage.
- Existing issues #275 and #280 remain the right records for sibling coverage gaps.
- Reward-hack check: focused parser consistency is not generalized into a broad
  security-clean or release-ready claim.

Acceptance threshold: privately triage or patch the locked dependency signals,
make exact-head Security green, preserve the consistency corpus, and add a
conflicting duplicate-registration case with deterministic precedence.

**INCONCLUSIVE**

## Repository 5 — RuVector

### Frozen hypothesis

PR #959 reduces state-root signing work by approximately the configured interval,
bounds staleness to `interval - 1`, preserves tamper detection, and keeps latest-
anchor verification effectively O(1).

### Baseline, candidate, and measured delta

- Candidate: draft PR #959 at `9d666d9798e16c2edc81e9e7b88ff2625ca282df`.
- The committed benchmark uses 5,000 writes at intervals 1/8/32/128/512 with exact
  anchor counts and staleness, 400 tamper trials per run, and verification within
  approximately 1.04-1.07x. Interval 512 reports about 0.2% of interval-1 signing
  work, close to the falsifiable 1/512 expectation.
- Thirty focused receipt tests pass; native, WASM-dedup, regression, supply-chain,
  formatting, and clippy gates pass.
- Required Workspace CI was cancelled.
- The public append API assumes monotonically increasing `write_count` but does
  not reject duplicate or decreasing values. Insertion order can therefore diverge
  from logical order, invalidating latest-at-or-before and staleness claims.
- The anchor log is in-process/non-durable and no external-witness claim is accepted.
- Reward-hack check: benchmark speed and tamper trials do not compensate for an
  unenforced ordering invariant, cancelled workspace gate, or absent durability.

Acceptance threshold: fail closed on duplicate/decreasing counts; test ordering,
restart/reload, and concurrency; rerun the frozen benchmark; prove native/WASM
serialization and verification parity; and obtain green exact-head Workspace CI.

**INCONCLUSIVE**

## Security findings

- No new remotely exploitable critical/high production vulnerability was confirmed.
- Core Memory's authentication-first boundary remains draft and cannot be accepted
  while CodeQL is configuration-blocked and the pre-auth concurrency envelope is
  unmeasured.
- MetaHarness has unresolved locked production dependency signals. Public detail is
  intentionally redacted; affected-version and reachable-path confirmation belong
  in a private advisory.
- RuVector's state-root ordering invariant is not enforced by its public append API;
  no durable or externally witnessed integrity claim is accepted.
- Ruflo and RuView cannot receive release/security acceptance with required exact-
  head workflows red or unauthorized.
- No secret, active exploit, credential test, production probe, or protected-
  surface change was performed.

## SOTA sources and applicability

1. MCP Authorization Security Considerations, 2026-07-28:
   https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization/security-considerations
   Applicability: validate inbound tokens before processing and keep access tokens
   bound to the intended MCP resource; supports Core Memory's auth-first gate.
2. MCP Tools, 2026-07-28:
   https://modelcontextprotocol.io/specification/2026-07-28/server/tools
   Applicability: servers must validate inputs, enforce access controls, rate-limit,
   sanitize output, and clients should use timeouts/audit logs; supports the Core
   Memory and MetaHarness acceptance thresholds.
3. IETF Internet-Draft `draft-dogru-cedulon-08`, 2026-09-03:
   https://datatracker.ietf.org/doc/html/draft-dogru-cedulon-08
   Applicability: signed checkpoints require out-of-band trust and external witness
   evidence for suppression/equivocation claims. This is a current draft, not an
   endorsed standard; it supports withholding a durable-transparency claim for
   RuVector's in-process anchor log.
4. Khan et al., “DF-RAG: Query-Aware Diversity for Retrieval-Augmented Generation,”
   submitted 2026-01-23: https://arxiv.org/abs/2601.17212
   Applicability: directly motivates query-aware MMR and reports benchmark-level
   QA gains, but falls outside the preferred 90-day window. No newer primary MMR
   evaluation was found this run, so Ruflo must establish value on its own frozen
   corpus rather than inherit the paper's results.

## Constellation relationships

- Dream Machine supplies the execution contract, evidence ledger, and verdict gates.
- Core Memory is both a reviewed authorization boundary and the aggregate-only
  coordination sink; no signed federation persistence is claimed.
- MetaHarness supplies the adversarial parser-consistency loop, but promotion is
  blocked by the repository's security gate.
- Ruflo supplies the retrieval/execution substrate; the candidate semantic MMR path
  requires representative evaluation and a clean release envelope.
- RuVector/RuVector WASM supply signed retrieval/state evidence; ordering, parity,
  workspace CI, and external-witness boundaries remain explicit gates.
- RuView consumes sensor state in the browser; synthetic provenance must remain
  machine-readable, opt-in, and regression-tested before release.
- RVM PR #63 defines an authorization-equivalence evaluation contract and remains a
  future bridge between Core Memory authority receipts and effectful execution.

## Commands and evidence

- Inventory: authenticated GitHub pagination, four 100-repository pages.
- Open state: authenticated GitHub PR and issue search; each reached 100-result cap.
- Activity: changed-repository search followed by default-branch commit enumeration.
- Exact-head PR, patch, manifest, lockfile, security policy, repository instruction,
  workflow, and workflow-run inspection was performed for the five candidates.
- The connector exposed no runnable checkout. Pinned Ruflo 3.25.6 scans, local
  lockfile-aware secret/dependency/STRIDE scans, real RuView browser/hardware tests,
  MetaHarness dependency reachability, Core Memory socket-load tests, and fresh
  RuVector native/WASM benchmark replay could not be executed.

## Actions, blockers, and owners

- Exact-head reviews added to Core Memory #51, RuView #1794, Ruflo #3169,
  MetaHarness #276, and RuVector #959.
- Existing issues #50, #1764, #3168, #275/#280, and candidate PRs were reused; no
  duplicate issue was created.
- Reused Dream draft PR #62 for this report and exactly one ledger row.
- Maintainers own workflow authorization/configuration and private-advisory triage.
  Candidate authors own exact-head regression receipts and benchmark reruns.
- Core Memory's governed federation endpoint was not exposed; only a redacted
  GitHub aggregate checkpoint can be written and verified.

## Next cohort

1. Core Memory PR #51 exact-head CodeQL and authentication-load recovery.
2. RuVector state-anchor monotonicity plus Workspace CI/native-WASM parity.
3. MetaHarness dependency triage and exact-head Security recovery.
4. Ruflo representative MMR benchmark after splitting the CI change.
5. RuView browser provenance tests and firmware issue #1764 single-owner UDP path.

