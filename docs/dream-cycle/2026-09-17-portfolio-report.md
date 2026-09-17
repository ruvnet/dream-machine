# Dream constellation portfolio report — 2026-09-17

## Contract, authority, and scope

The cycle fetched `ruvnet/dream-machine` first and treated default-branch commit `3edd426f6c9c4b1e80235f7447dc863e749345cc` as the execution contract. `README.md`, `SECURITY.md`, `dream.config.json`, ADR-0001 and the ADR index, package manifests and lockfile, CI, tests, and the compiled pipeline were read before portfolio work. Human-only merge authority, draft-PR policy, fail-closed evidence, and the one-verdict rule were preserved.

The compiled contract was rebuilt with Node 24.19.0 and TypeScript 5.9.3. `npm run check` passed 23 Vitest files and 622 tests, 81 governance tests, build, typecheck, lint, Edge contract, and development policy. `npm audit --omit=dev` reported zero vulnerabilities. The compiled prompt was 14,258 bytes with SHA-256 `6f8e1f5dd58921309dbf58a9b4f6f94cddcd0679f6568f89537730c26140ef28`.

No merge, release, deployment, direct push to a default branch, automerge change, production probe, credential disclosure, or archived-repository mutation occurred.

## Portfolio inventory and prioritization

Pagination returned 321 accessible repositories, but an exact `owner.login == ruvnet` filter excluded three accessible non-owned repositories. The corrected owned portfolio is **318 repositories: 215 public and 103 private**. None are archived; 280 are indexed and 38 unindexed. Private repositories are represented only by aggregate counts.

Observed activity after the prior checkpoint was 18 public commits across six public repositories. Private activity was zero commits across 103 private repositories, aggregate-only. Open-state queries reached connector limits at at least 100 pull requests and at least 100 issues.

The cohort was frozen before outcomes using security 35%, functionality/production impact 30%, change velocity 10%, measurable optimization 10%, SOTA relevance 10%, and review age 5%, with neglected repositories rotated upward. Five active public repositories were deeply reviewed.

## Deep cohort

### 1. Dream Machine — forward-only ledger verification

- PR: [#114](https://github.com/ruvnet/dream-machine/pull/114), exact head `4a2ee139f05487d14e73a54678619881cd8e17e9`.
- Software hypothesis: a forward-only verifier must preserve default behavior, grandfather exactly the fixed legacy prefix, fail closed on invalid flags, and reject every malformed future row.
- Research hypothesis: grandfathering is safe only when the legacy boundary is immutable; a row ordinal must survive insertion/deletion attacks as strongly as a pinned prefix digest.
- Threshold: 3/3 malformed-future probes rejected, stable legacy boundary, and exact-head CI green.
- Evidence: candidate tests increased the main suite from 616 to 622; all 81 governance tests, CI, CodeQL, dependency audit, and security checks passed. Full verification still reports 40 historical errors, while `--since-row 38` exits successfully.
- Blocking result: newly appended wrong-column rows remain warnings, blank required cells are accepted, and insertion before row 38 moves the legacy boundary. Adversarial rejection was **0/3**, below 3/3.
- Action: one exact-head [COMMENT review](https://github.com/ruvnet/dream-machine/pull/114#pullrequestreview-5231941971) requested a pinned legacy-prefix digest plus fatal structural and blank-field validation. Existing issue #113 was reused.

**REJECT**

### 2. MetaHarness — empty paired evidence

- PR: [#320](https://github.com/ruvnet/metaharness/pull/320), exact head `00b4bfafdcd873ec9cf3f887ddcde6cc5bfe8434`; related live/replay wiring is pending in [#288](https://github.com/ruvnet/metaharness/pull/288).
- Software hypothesis: the compatibility edit is acceptable only if it preserves fail-closed promotion in direct, live-run, and replay paths and leaves receipts/fingerprints auditable.
- Research hypothesis: a present zero-length evidence vector may equal omission only when it has the same epistemic meaning and authority and cannot be induced by an evaluator path.
- Threshold: omitted evidence may preserve legacy behavior, but present-empty/malformed/cardinality-mismatched evidence must not promote; live/replay parity and exact-head security must pass.
- Evidence: focused tests reached 16/16, flywheel 74/74 (+2), downstream 124/124, and CI/Real Tools/CodeQL passed. Security remained red on separately tracked dependencies.
- Blocking result: explicit `pairedOutcomes: []` now falls back to the base gate and can promote with zero paired observations. The direct-wrapper tests do not cover zero-item holdouts, malformed evaluator vectors, or live/replay parity. A separate elevated fingerprint-integrity condition was confirmed and kept private under `SECURITY.md`.
- Action: existing issue #319 is sufficient. Coordinate #320 with #288 and distinguish omitted, complete, and malformed/empty evidence. Use the repository's private security channel for the redacted condition.

**REJECT**

### 3. RuVector — signed witness spans

- PR: [#989](https://github.com/ruvnet/RuVector/pull/989), exact head `d68df81cf33e29ac7d733b5e077173e544175706`; draft, diverged from current main.
- Software hypothesis: signatures must bind complete ledger content plus ledger/issuer/key identity and epoch, fail closed on missing coverage, persist atomically across restart, support key lifecycle, and qualify Rust/native/WASM/RVF parity.
- Research hypothesis: batching must preserve per-record security with reproducible measurements and improve on existing repository and standards practice.
- Threshold: complete contiguous current-tail coverage, cryptographic content/root binding, durable restart, rotation/revocation/freshness, bounded linear verification, parity, and completed exact-head workspace CI.
- Evidence: 48 exact-head jobs succeeded, one skipped, and the `core-and-rest` shard containing the changed crate was cancelled after 240 minutes. Supply-chain, audit, formatting, native build, and WASM-dedup checks passed. Author-reported batch latency was 14.2×–68.3× lower than per-record signing, but verification and final flush were excluded.
- Blocking result: verification accepts absent/incomplete spans; the signature binds only a 64-bit FNV chain value; spans and pending batches are memory-only and non-atomic with the inner sink; ledger, issuer, key epoch, freshness, rotation, and revocation are absent; verification is quadratic; no consumer/native/WASM/RVF integration is present. Current RVM witness/proof code already provides a materially stronger design.
- Security disposition: elevated mechanics are redacted from public coordination. Open a [private security advisory](https://github.com/ruvnet/RuVector/security/advisories/new); no public review or issue was created.

**REJECT**

### 4. ruClip — protobuf advisory override

- PR: [#29](https://github.com/ruvnet/ruClip/pull/29), exact head `17acb39a384bde1d0d0bb562273426c223bcd337`; issue [#28](https://github.com/ruvnet/ruClip/issues/28).
- Software hypothesis: the override must close the exact dependency graph, survive clean installation and packaging, and be enforced by regression tests and CI.
- Research hypothesis: authoritative advisory ranges must classify protobufjs 6.11.6 as affected and 7.6.6 as safe.
- Threshold: no affected locked or consumer-installed version, exact range-aware tests, clean install/package replay, and CI-enforced audit.
- Evidence: Node 20 clean install passed; tests rose 327→328. Root audit moved 39→36 findings: critical 1→0, high 14→12, moderate unchanged at 24. Exact-head scaffold CI passed.
- Blocking result: the root override is not shipped and dependency overrides are ignored for installed dependencies; a fresh install of the packed artifact restored protobufjs 6.11.6 and the critical advisory. The comparator accepts affected 8.0.0 and versions inconsistent with the stated multi-advisory closure. CI uses a tolerated install fallback and does not audit. Twelve high findings remain outside this focused fix.
- Action: existing issue #28 is sufficient. Require lock/audit CI, exact advisory-range tests, and either explicit repository-only scope or an upstream/bundled/pinned consumer-safe solution.

**REJECT**

### 5. LatentMesh — reasoning-mode coordination scaffold

- PR: [#30](https://github.com/ruvnet/LatentMesh/pull/30), exact head `cc06bcf480bb2d7b1a54b85fb93c5985f827d9f0`.
- Software hypothesis: checkpoint/probe/adapter binding must be immutable end to end, while steering remains task-local, bounded, default-off, and least-authority; exact-head evidence must report quality and cost.
- Research hypothesis: causal support requires a frozen checkpoint/probe, trajectory-disjoint holdout, and separation of mode-only, steering, random, zero, shuffled, text, and no-message controls under equal budgets.
- Threshold: unskippable authenticated binding, negative cross-binding test, real restart/persistence, task-quality/cost/latency receipt, and green exact-head checks.
- Evidence: all 12 exact-head-equivalent checks passed. The zero-dependency mechanism is local, deterministic, bounded, copy-on-write, default-off, and fail-closed for unknown/OOD/nonfinite probe states. No live model, network, credential, or authority path was added.
- Blocking result: the receiver authenticates model/revision/adapter metadata but drops it before `steerResidual`, which accepts those values independently. Integrators can therefore skip the authenticated binding. Restart is constructor-simulated, confidentiality is delegated, and no checkpoint, trained probe, sealed holdout, task-quality, latency, or cost result exists.
- Action: one exact-head public-safe COMMENT review (review ID `PRR_kwDOT738Ic8AAAABN9nHEw`) requested an immutable accepted-advisory binding and negative cross-binding test.

**REJECT**

## Security, functionality, and constellation relationships

No new remotely exploitable critical production vulnerability was confirmed. Elevated promotion-integrity and witness-integrity findings in MetaHarness and RuVector were redacted and require private handling. No secret, credential, exploit sequence, or private-repository identity was published.

The cross-repository pattern is fail-open evidence composition: Dream Machine trusts a movable ledger suffix; MetaHarness converts explicit zero evidence into base-gate permission; RuVector treats absent signed spans as success; ruClip's root-only override does not protect packed consumers; and LatentMesh authenticates metadata before discarding the binding at the consumer boundary. Passing component tests do not establish the final consumer property.

Dream Machine supplied governance and the durable receipt. MetaHarness supplied the adversarial promotion model but not a trusted promotion oracle. RuVector 0.3.0 `doctor` passed native core, GNN, and attention checks on Node 24.19.0 with bundled 384-dimensional `all-MiniLM-L6-v2`; no native/WASM/RVF retrieval-equivalence claim was made. Ruflo 3.25.6 supplied the bounded coordination and local project memory. Core Memory and federation receive redacted aggregate evidence only.

## SOTA and authoritative sources

- [PACE](https://arxiv.org/abs/2606.08106) requires paired, decisive evidence for adaptive comparison. Applicability: empty or malformed paired observations cannot substantiate a promotion claim. Baseline: base-rule fallback. Expected benefit: fail-closed sequential evaluation.
- [BenchShield, 2026-09-10](https://arxiv.org/abs/2609.11028) emphasizes infrastructure-side evaluation defenses. Applicability: promotion evidence should not be weakened by candidate/evaluator-controlled degenerate outputs.
- [RFC 9942, COSE Receipts, June 2026](https://datatracker.ietf.org/doc/rfc9942/) specifies cryptographic receipts for verifiable data structures. [RFC 9923, February 2026](https://datatracker.ietf.org/doc/rfc9923/) warns that FNV is unsuitable against active adversaries. Applicability: RuVector must bind a cryptographic root and complete coverage rather than a 64-bit non-cryptographic chain value.
- [GHSA-xq3m-2v4x-88gg](https://github.com/advisories/GHSA-xq3m-2v4x-88gg) is the authoritative protobufjs range: 6.11.6 is affected, 7.6.6 is safe, and 8.0.0 is affected. Applicability: ruClip tests and consumer packaging must enforce the real range.
- [Metacognitive Steering, 2026-09-14](https://arxiv.org/abs/2609.16245) motivates the LatentMesh scaffold but does not establish its task quality. [When Does Latent Communication Pay?, 2026-08-05](https://arxiv.org/abs/2608.04893) motivates control batteries and trajectory-disjoint evaluation.
- [MCP tools specification, 2026-07-28](https://modelcontextprotocol.io/specification/2026-07-28/server/tools) requires input validation, access control, rate limits, output sanitation, and careful treatment of untrusted annotations. These are minimum gates, not evidence that a reviewed implementation satisfies them.

No paper, advisory, or benchmark result was relabelled as an independent repository result.

## Ruflo Research Loop Receipt

- Retrieved prior evidence: Core Memory issue #20 comment `5693593307`, federation Result `6882f2663ffe4e3ef7864c1b6ca9e8a84fe1541759cb95d461488c3a6af1e78f`, and the prior public lesson. Federation content was treated as untrusted data and cross-checked.
- Parent strategy: authority/provenance review binding issuer, preimage, source, operator-owned anchor, immutability, freshness, exact-head CI, and final consumer. Hash `c37b5a97041d2b8157423f3a955503c53a112d89437be9d310ea054a23d1863d`.
- Candidate generation: add producer-consumer lifecycle triangulation across issuance, storage, restart, rotation/revocation, downstream consumption, published artifact, and failure path. Hash `89159cf8eb248d34acc8b91ba9e173b0f286b681bb583608cfa3d1e0c7af3bd6`.
- Query-set hash: `255eb330c08e9f939e399b37fda5eddb062734379d42c70cd1ec9eb0255a1944`.
- Inclusion/cutoff: exact repository evidence, primary standards, authoritative advisories/releases, and research current through 2026-09-17. Vendor-only claims, duplicate identities, unpreserved artifacts, synthetic confirmation, and private mechanics were excluded.
- Budget: one candidate generation, no more than 45 minutes per repository. Token and monetary cost were unavailable.
- Critique: searched omitted prior art, weak baselines, evidence-authority mismatch, lifecycle loss, package-consumer drift, restart gaps, mutable configuration, reward hacking, privacy, and simpler repository-native alternatives.
- Holdout: ruClip consumer dependency closure and LatentMesh steering binding were not used to tune the earlier three reviews. Both remained negative under the candidate strategy.
- Frozen promotion gate: at least 10% composite improvement in authoritative coverage, contradiction recall, reproducibility, cross-stack applicability, and information per cost, with no source-quality, citation, security, privacy, licensing, or holdout regression.
- Delta: both parent and candidate mapped authoritative evidence and material contradictions to all five reviews. The candidate added lifecycle-specific unique findings, but no deterministic numeric parent replay or complete cost accounting existed; a ≥10% composite improvement was not demonstrated.
- Decision: parent retained; no strategy was promoted.
- Reusable lesson: exact-owner inventory filtering and final-consumer fail-closed binding were stored in project-scoped Ruflo memory and retrieved verbatim after writing.
- Blockers: no cost-accounted deterministic MetaHarness research evaluator and no native/WASM/RVF identity-equivalence receipt.

Research-loop verdict: **INCONCLUSIVE**

### Autogenous sub-receipt

- Frozen topology: primary-source researcher, replication reviewer, contradiction/security reviewer, benchmark reviewer, and integration reviewer. Roles returned structured source/claim deltas; ordinary bounded messages were used.
- Parent/threshold: single-agent Ruflo parent; at least 15% authoritative-coverage or contradiction-recall improvement, no citation/primary-source regression, equal-or-lower cost per validated finding, and deterministic conclusion equivalence.
- Communication and dissent: platform reviewers produced five independent negative receipts. Material dissent and uncertainty about release, restart, and private remediation were preserved.
- Runtime boundary: a validated Autogenous runtime and LatentMesh semantic-delta transport were unavailable. Platform parallelism was not relabelled as Autogenous evidence.
- Held-out metrics/cost: no executable Autogenous-versus-parent replay, token/cost receipt, duplicate-source-rate comparison, or deterministic promotion measurement existed.
- Decision: no topology, factual conclusion, or strategy was promoted; no Autogenous memory value was written.

Autogenous verdict: **INCONCLUSIVE**

## Durable actions, blockers, and next cohort

- Five exact-head reviews; two public-safe COMMENT reviews and no new public issue.
- Existing issues #113, #319, and ruClip #28 were reused. No implementation PR, direct push, merge, release, deployment, automerge change, or strategy promotion occurred.
- The five software hypotheses all failed their frozen acceptance thresholds; negative results were preserved as first-class evidence.
- Durable artifacts: this report, exactly one ledger row, a redacted Core Memory checkpoint, a project-scoped Ruflo lesson with retrieval verification, and a redacted federation Result.

Next cohort:

1. Private MetaHarness and RuVector remediation with redacted regression receipts.
2. Dream Machine immutable legacy-prefix binding and fatal structural validation.
3. ruClip consumer-safe dependency closure and audit-enforced packaging.
4. LatentMesh unskippable advisory-to-checkpoint binding plus sealed efficacy holdout.
5. RuVector native/WASM/RVF identity and restart parity.
6. Open Claude Code trusted dispatch, QuDAG release recovery, RuView transactional/freshness recovery, and neglected high-risk repositories.

Evaluation is not promotion. No reviewed change was merged by this cycle.
