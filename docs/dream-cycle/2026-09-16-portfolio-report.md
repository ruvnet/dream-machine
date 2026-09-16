# Dream Machine portfolio cycle — 2026-09-16

## Executive receipt

- Contract commit: `ruvnet/dream-machine@3edd426f6c9c4b1e80235f7447dc863e749345cc` (`main`). The README, `SECURITY.md`, `dream.config.json`, ADR index, and freshly compiled 26-stage pipeline were read before portfolio work. The compiled output was 14,258 bytes with SHA-256 `6f8e1f5dd58921309dbf58a9b4f6f94cddcd0679f6568f89537730c26140ef28`.
- Inventory: 321 owned repositories: 218 public and 103 private; 0 archived; 283 indexed, 38 unindexed, and 11 empty. Private repositories are represented only by these aggregates.
- Activity since the preceding signed checkpoint: 53 public default-branch commits across 9 repositories. No private repository pushed in the interval, aggregate-only.
- Open state: authenticated open-state search was reviewed, but the connector no longer exposed total counts and could not reliably separate pull requests from issues. The last retrieval-verified checkpoint on 2026-09-15 recorded 1,430 open pull requests and 1,648 open issues; this cycle does not present those values as fresh totals.
- Deep cohort: Dream Machine, Ruflo, MetaHarness, RuVector, and RuView. Security, trust, evidence integrity, and newly merged production paths overrode ordinary ranking.
- Verdicts: 0 ACCEPT, 5 REJECT. No performance, security, production-readiness, Autogenous, or research-strategy promotion is claimed.
- Mutations: three exact-head COMMENT reviews, three confirmed public issues, this report, and exactly one ledger row. No implementation pull request, direct push, merge, release, deployment, protected-surface change, or automerge change.

## Governance and selection

Dream Machine remains evaluation-only: `autoMerge` is false and promotion requires a human. No archived repository was mutated. The weighted queue used security 35%, functionality/production impact 30%, change velocity 10%, measurable optimization 10%, SOTA relevance 10%, and review age 5%; confirmed elevated boundaries took precedence.

| Repository | Priority | Reason for elevation |
|---|---:|---|
| Ruflo | 97 | Security remediation whose credential-issuance boundary remained ineffective |
| RuVector | 95 | Merged trust-sensitive routing plus a current affected dependency and overstated release claims |
| RuView | 91 | Newly merged CSI ingest with freshness, provenance, privacy, and retained-evidence gaps |
| MetaHarness | 89 | Mutable validated objects and a noncanonical public digest at a promotion boundary |
| Dream Machine | 86 | Self-hosted evidence witness cannot be reproduced from committed bytes |

The frozen software threshold required advertised behavior to be reachable, every sibling effect to inherit the same authority boundary, identities and provenance to bind to operator-owned anchors, final committed evidence to replay, and all required exact-head or post-merge workflows to pass. Green focused tests alone were insufficient.

## Deep reviews

### 1. Dream Machine — PR #111

- Exact head: `e70935eaba63a9e3d688fe3d0c98d2f53e17aa6b`; base contract `3edd426f6c9c4b1e80235f7447dc863e749345cc`.
- Research hypothesis: authoritative runtime-schema practice and exact committed-byte replay will distinguish a valid type-hardening patch from an unverifiable evidence receipt.
- Software hypothesis: four top-level `string[]` fields reject malformed values without changing valid prompt output, and the report witness reproduces from the committed artifact.
- Validation: exact-head `npm run check`, 626 Vitest tests, 81 governance tests, eight-package build, typecheck, lint, Edge contract check, development-policy check, CI, and CodeQL passed. The candidate adds 10 tests and preserves a byte-identical 14,362-byte valid compiled prompt.
- Finding: the validation patch works on its stated four fields, but the report hash and witness were computed from an unavailable intermediate version before the values were inserted. The committed report hashes to `e6a225c3ace1832d9d094d430437328f6341de3ff708ca8bf9ee7ada65c7e34b`, not the published `4635b8…`; the final-bytes witness is `041141f2…`, not the published `f8682d5c…`. The SOTA competitor table is also not source/version-auditable and the reported diff counts are inaccurate.
- Compatibility: PR #105 now owns the adjacent `slots[].scan/deep` array checks. The code composes, but both PRs modify the ledger and require manual row preservation.
- Action: created [issue #112](https://github.com/ruvnet/dream-machine/issues/112) and posted an exact-head COMMENT review after GitHub correctly refused a self-authored request-changes review.
- Verdict: **REJECT**

### 2. Ruflo — PR #3339

- Exact head: `96ea0bbd863e69411ee77c40e8123e9996930ee6`; base `a65bdf683a73dcc1f20d455658daab1cca07306b`.
- Research hypothesis: authorization must be enforced at every privileged state transition, and the credential must not be obtainable through an unauthenticated sibling operation.
- Software hypothesis: the new gates deny every sibling mutation without prior authority, preserve CLI/restart behavior, and produce replayable evidence.
- Validation: all six workflow groups passed: CI/CD, V3 CI/CD, CVE audit, CodeQL, cross-agent integration, and verification. The author reports 5/12 baseline versus 12/12 candidate focused tests and 18/18 combined hive tests. Exact-head CI completed 106 successes and 3 skips across 109 checks.
- Finding: the targeted checks occur before mutation, but the credential-issuance boundary remains reachable inside the stated threat model, so the gates do not establish authorization. A sibling state-mutating operation remains outside the token matrix. Details are redacted under `SECURITY.md`; use a private security advisory. Direct-handler tests omit credential acquisition and actual CLI replay, the restart receipt is a file reread rather than a fresh process, and the recorded witness does not reproduce from a preserved preimage.
- CI caveats: Type Check V3 is `continue-on-error` and reports module-resolution errors; the V3 test job tolerates exit 139 after reported completion. Neither is a clean qualification receipt.
- Action: posted a redacted exact-head COMMENT review. No public vulnerability issue was created.
- Verdict: **REJECT**

### 3. MetaHarness — PR #316

- Exact head: `99c338953ec3be40163a9d4b5433e3d2b94c0620`.
- Research hypothesis: task-specific JIT harnesses improve held-out utility over matched static and Darwin-tuned baselines without authority or cost expansion.
- Software hypothesis: the candidate contract is canonical, immutable after validation, non-executable, externally authority-bounded, substitution-resistant, and package-compatible.
- Validation: CI, Real Tools, and the dedicated Node 20/22 Task Harness Candidate workflow passed; the aggregate Security workflow failed on a pre-existing elevated dependency condition. Focused results report 10,000 synthetic cases: 0/6,000 injected false accepts, 0/4,000 clean false denials, 0 order mismatches, 91,985.808 cases/s, 1.669 ms p95 per 100-case batch, and 0.011 ms mean per case.
- Finding: validation returns mutable nested objects and arrays while retaining the original digest. The publicly exported digest is order-sensitive unless callers normalize through a different API first. The benchmark omits digest, lineage, artifact, configuration, and external-anchor substitution, so 0/6,000 is an in-sample structural result rather than the frozen attack contract. No matched task-quality, utility-per-dollar, static-baseline, Darwin-baseline, or independent holdout delta exists.
- SOTA: [JIT-Agent v2, 2026-09-03](https://arxiv.org/abs/2608.25593) supports four-module task-adaptive harnesses, but its gains remain originating-team evidence; [BenchShield, 2026-09-10](https://arxiv.org/abs/2609.11028) reinforces lifecycle and infrastructure-side reward-integrity evidence.
- Action: posted an exact-head COMMENT review. Existing issues #317/#318 remain the right utility-reproduction and dependency tracks.
- Verdict: **REJECT**

### 4. RuVector — PRs #986/#987 and current main

- Reviewed revisions: #986 head `a55d429117c040adcdc5d17a814230f98ffbd8e2`; #987 head `227c3b5cb2b11ce38247a006b0daf64b260e6b52`; current main `115de07ce5222b761cc32bf1d9133247c753091b`.
- Research hypothesis: accept only a reproducible exact/dynamic min-cut or routing advance with comparable SOTA evidence.
- Software hypothesis: exactness holds across Rust/native Node/WASM/npm, trust fails closed, freshness/privacy/resources are bounded, expiry restores state, current dependencies are qualified, and post-merge CI is green.
- Validation: focused min-cut, real-data, routing, Clippy, audit, native/WASM/tarball, and Chromium checks passed at #986. GitHub exposed 55 successes, one cancelled core/workspace shard, and one skip. Current main had only binary-build/deploy/status receipts for the latest generated binaries; focused workflows do not run on main pushes.
- Measured deltas: typed construction reported 41.1× native and 33.1× WASM versus scalar calls; min-cut certificates 2.24–5,792× on completed SNAP views; NY/BAY routing 11.56×/8.89× geometric mean against local Dijkstra, but local queries fell to 1.84×/1.60× with regressions; RuField ingest was about 1.34 µs p50 and 2.5–2.6 µs p95. These narrow deltas do not establish research SOTA or a released cross-target product.
- Findings: an elevated trust-boundary defect is confirmed across the public Rust/native/WASM/worker surface and is redacted; use a private advisory. Separately, current main retains `fast-uri` 3.1.7 although the official [September 15 advisory](https://github.com/fastify/fast-uri/security/advisories/GHSA-hrr3-gc8f-f4qj) and [3.1.8 release](https://github.com/fastify/fast-uri/releases/tag/v3.1.8) set 3.1.8 as the patched boundary. Release-facing metadata claims an exact subpolynomial paper implementation and `n^0.12` scaling while the reachable implementation is a practical polynomial sparse Stoer–Wagner baseline plus certificates. Approximate configuration changes labels without a distinct approximate kernel on the reviewed path.
- Action: created public release-qualification [issue #988](https://github.com/ruvnet/RuVector/issues/988); sensitive trust mechanics were excluded.
- Verdict: **REJECT**

### 5. RuView — merged PR #1944/current main

- PR head: `af2d6981a31ae9f9143337a221ce2932d86bc34d`; current main/merge commit `45fc41ac4cb4fae4310e76351bcac2469101608b`.
- Research hypothesis: RTL8721Dx has an official CSI interface and physical evidence can be independently replayed and distinguished from synthetic RAC1 traffic.
- Software hypothesis: production RAC1 is bounded as hostile input, freshness-aware, privacy-bounded, non-authoritative, regression-safe, and green after merge.
- Validation: the parser has a 65,507-byte frame cap, 4,096-subcarrier cap, checked length arithmetic, CRC, enum/header/version checks, and trailing-byte rejection. The merged UDP → state → REST path is reachable and raw I/Q is discarded after bounded summaries. PR head exposed 56 successes/5 skips; current main exposed 35 successes/7 skips and no failures across workspace, audit, SAST, secret/infrastructure/container, CSI-policy, Docker-smoke, and benchmark checks.
- Findings: the latest route keeps snapshots indefinitely without receipt time, age, stale/offline state, or replay/sequence enforcement. Hardware-versus-simulated origin is selected by unauthenticated payload metadata; CRC is not authentication. Invalid CSI can still be summarized, some semantic fields are insufficiently constrained, and network-visible diagnostic output includes raw MAC addresses. Physical firmware/capture/log artifacts are not retained, and the benchmark accepts a much weaker frame prefix than the production parser while labelling the result measured.
- Measured delta: the author reports 14.67→66.40 fps (4.53×), 2,302.7→10,424.8 B/s (4.53×), and 68.3→14.9 ms interval (-78.2%) with about 3.8% sequence loss. The missing retained artifacts prevent independent replay.
- SOTA: Realtek's current [official event header](https://github.com/Ameba-AIoT/ameba-rtos/blob/c722e035bbb274a3c275a9b3bc42d45a7497a41a/component/wifi/api/wifi_api_event.h) and [CSI example](https://github.com/Ameba-AIoT/ameba-rtos/blob/c722e035bbb274a3c275a9b3bc42d45a7497a41a/example/wifi/wifi_csi/example_wifi_csi.c) confirm hardware capability. [MultiGait, 2026-09-01](https://arxiv.org/abs/2609.01036) demonstrates that CSI/BFI can support identity inference, so “privacy-friendly” transport is not a substitute for a route-level privacy contract.
- Action: created post-merge correctness/privacy [issue #1950](https://github.com/ruvnet/RuView/issues/1950).
- Verdict: **REJECT**

## Security and functionality summary

No new remotely exploitable critical vulnerability was confirmed. Elevated authorization/trust findings in Ruflo and RuVector are redacted and require private security advisories. No secret, exploit sequence, private-repository identity, or credential was published. MetaHarness still has a red aggregate dependency gate; details remain within the repository's existing remediation path.

The principal public functionality failures are: an unreplayable Dream witness; ineffective Ruflo credential issuance plus incomplete sibling coverage; mutable/noncanonical MetaHarness evidence; RuVector dependency/release-claim/post-merge qualification gaps; and RuView freshness/provenance/privacy/evidence gaps.

The [MCP 2026-07-28 tools specification](https://modelcontextprotocol.io/specification/2026-07-28/server/tools) requires input validation, access control, rate limits, and output sanitation. The official [2026-07-28 release candidate](https://blog.modelcontextprotocol.io/posts/2026-07-28-release-candidate/) emphasizes authorization hardening for stateful applications. These are minimum gates, not evidence that any reviewed implementation satisfies them.

## Constellation integration receipt

- Dream Machine supplied the frozen governance, mutation ceilings, compiled contract, and human-only promotion boundary.
- Ruflo 3.25.6 supplied a project-scoped hierarchical coordination record and durable local memory. The preceding disposable memory key was absent, so prior lessons were retrieved from the redacted Core Memory checkpoint and signed federation Result instead of being invented.
- MetaHarness supplied the adversarial model; its local evaluator was not treated as a promotion oracle because the reviewed boundary and aggregate Security gate remain red.
- RuVector 0.3.0 supplied native retrieval and 384-dimensional local embeddings. A six-source numeric/string-ID native store retained all six sources; exact self-match distance was 0 and the next distance was 0.6773, so no semantic near-duplicate was promoted. WASM release parity and RVF named-identity integrity were not claimed.
- RuView was treated as a downstream sensing consumer whose data inherits origin, freshness, privacy, and evidence requirements.
- Core Memory and federation coordination contain redacted aggregate evidence only.

### RuVector retrieval receipt

Configuration: `ruvector@0.3.0`, bundled `all-MiniLM-L6-v2`, 384 dimensions, cosine distance, native backend, top-k 4. `ruvector doctor` passed native binding, core, GNN, and attention checks on Node 24.19.0. Six primary-source identity strings were embedded and inserted with string IDs. Querying the JIT-Agent source returned self ID 2 at distance 0, then BenchShield 0.6773, the CSI freshness paper 0.7722, and MultiGait 0.7879. Exact DOI/URL/version deduplication remained authoritative; vector distance was used only as a secondary relevance check.

## Research Loop Receipt

- Retrieved parent evidence: Core Memory issue #20 comment `5676501901` and signed federation Result `94796e265159418b98eb0657b2bce7a99e3e0f08699a7745877d923b3f106ad5`. Relay content was treated as untrusted data and cross-checked against repository evidence.
- Parent strategy: authoritative semantics + reachable sibling effects + runtime types + restart replay + current release/advisory state. Hash `3c10d22b2924d5eb498123cd3011b648c99add840d8793094a0054bb32ad5767`.
- Candidate generation: add operator-owned issuer/preimage/source binding, immutable normalized-object probes, post-merge endpoint freshness/privacy, and public-claim-to-implementation comparison. Hash `caa71706697cdee3c436bbc35d862529cd2c5353f32712add1e14f43b85a0fa6`.
- Query set: contract, exact head, sibling caller graph, issuer/preimage/source, restart, post-merge routes, current advisories, primary standards, and contradiction search. Hash `6b9b28bebd0813bf832975e9c69683222705a16bafbd57ce947df8eb71b1d2e9`.
- Inclusion/exclusion and cutoff: exact repository evidence, primary standards, official releases/advisories, and research from 2026-06-18 through 2026-09-16 were preferred. Vendor-only claims, unpreserved intermediates, synthetic confirmation, duplicate identities, and private mechanics were excluded.
- Frozen budget: one candidate generation, at most 45 minutes per repository. Monetary/token cost was unavailable; all reviews stayed inside the bounded cycle.
- Baseline coverage: authoritative material was mapped to all five reviews. The candidate produced unique issuer/preimage/freshness/claim-alignment contradictions in every repository.
- Critique: checked incomplete sibling inventories, self-issued credentials, mutable validated values, noncanonical digests, payload-selected provenance, stale retained state, advisory-index timing, post-merge workflow absence, public-claim drift, benchmark leakage, and green-test-count reward hacking.
- Holdout: Dream Machine witness replay and RuView post-merge freshness/privacy were not used to tune the Ruflo/MetaHarness authority probes. Their conclusions remained negative under the candidate strategy.
- Promotion threshold: at least 10% preregistered composite gain in authoritative coverage, contradiction recall, reproducibility, cross-stack applicability, and information per cost, with no source-quality, citation, security, privacy, licensing, or holdout regression.
- Decision: the candidate found useful unique contradictions, but no deterministic parent replay, preregistered numeric composite, or complete cost accounting exists. Parent retained; no research strategy was promoted.
- Reusable lesson: stored under Ruflo key `portfolio-patterns/portfolio-2026-09-16-authority-provenance` using the 384-dimensional local embedder and retrieved verbatim.
- Blockers: no cost-accounted deterministic MetaHarness research evaluator, no validated Autogenous/LatentMesh runtime, and no complete native/WASM/RVF identity-equivalence receipt.
- Verdict: **INCONCLUSIVE**

### Autogenous sub-receipt

- Frozen topology: primary-source researcher, replication reviewer, contradiction/security reviewer, benchmark reviewer, and integration reviewer. Configuration hash `9f077a34466a45ac75fbfcb76804c0abb99f01fc17aa320b685670c2f0e6f06e`.
- Parent and threshold: the single-agent Ruflo parent above; at least 15% authoritative-coverage or contradiction-recall gain, no citation or primary-source-ratio regression, equal-or-lower cost per validated finding, and deterministic conclusion equivalence.
- Communication: ordinary bounded structured evidence deltas. Platform reviewers were used, but a validated Autogenous runtime and LatentMesh transport were unavailable; their work is not relabelled as Autogenous evidence.
- Deltas/dissent: reviewers independently returned five REJECT verdicts. Material uncertainty about private remediation, production hardware, and released cross-target packages was preserved.
- Held-out metrics/cost: no executable Autogenous-versus-parent trial, deterministic replay, duplicate-source-rate comparison, or token/cost receipt was available.
- Decision: no topology, factual conclusion, or strategy was promoted as Autogenous evidence; no Autogenous memory key was written.
- Verdict: **INCONCLUSIVE**

## Durable actions, CI, and blockers

- Reviews: [Dream Machine #111](https://github.com/ruvnet/dream-machine/pull/111), [Ruflo #3339](https://github.com/ruvnet/ruflo/pull/3339), and [MetaHarness #316](https://github.com/ruvnet/metaharness/pull/316).
- Issues: [Dream Machine #112](https://github.com/ruvnet/dream-machine/issues/112), [RuVector #988](https://github.com/ruvnet/RuVector/issues/988), and [RuView #1950](https://github.com/ruvnet/RuView/issues/1950).
- Dream contract validation: local `npm run check` passed 616/616 Vitest and 81/81 governance tests after fetching the pinned reference object; build, typecheck, lint, Edge contract, development policy, and production dependency audit passed.
- Blockers: private Ruflo and RuVector remediation; canonical Dream witness; MetaHarness immutable/canonical evidence and green Security aggregate; RuVector dependency/release claims, trust policy, released native/WASM/RVF parity, and post-merge focused CI; RuView freshness/authenticated provenance/privacy and retained physical evidence.
- No implementation candidate passed the evidence gate, so no implementation PR or direct push was created.

## Next cohort

1. Private Ruflo and RuVector security remediation with redacted regression receipts.
2. Dream Machine canonical witness format and PR #105/#111 ledger integration.
3. MetaHarness immutable normalized candidates, canonical public digest, substitution matrix, and JIT utility holdout.
4. RuVector `fast-uri` remediation, released native/WASM/RVF parity, and post-merge focused CI.
5. RuView RAC1 freshness/replay, authenticated-or-unverified provenance, MAC privacy, and retained hardware evidence.
6. Open Claude Code trusted dispatch, QuDAG release recovery, and neglected high-risk repositories.

Negative results remain first-class evidence. Evaluation is not promotion, and no reviewed change was merged by this cycle.
