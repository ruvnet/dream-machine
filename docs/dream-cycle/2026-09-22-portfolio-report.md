# Dream constellation portfolio report — 2026-09-22

## Contract and scope

The cycle began from `ruvnet/dream-machine` default branch `main` at `aa931caad5dd0108253645bba0ab1481ad7da0ee`. Before portfolio work, the current `README.md`, `SECURITY.md`, `dream.config.json`, ADR index and ADR-0107, ruOS evaluation runbook, package manifests and lockfile, CI, tests, and compiled pipeline were read as the execution contract. The compiled routine contained 322 lines and 14,258 bytes with SHA-256 `6f8e1f5dd58921309dbf58a9b4f6f94cddcd0679f6568f89537730c26140ef28`.

The human-only merge boundary, private-aggregate rule, fail-closed evidence gates, five-repository limit, exact-head validation, and one-verdict-per-hypothesis rule were preserved. No merge, deployment, release, default-branch push, automerge change, production probe, credential use, archived-repository mutation, or public disclosure of private-repository detail occurred.

Dream main passed 645/645 Vitest tests, 140/140 governance tests, typecheck, build, lint, edge-contract checks, development policy, and a production dependency audit with zero vulnerabilities. The first governance run encountered three 10-second `git show` timeouts while a shallow object was fetched; after the pinned object became available, the three tests and the complete check passed. A pinned, read-only Ruflo 3.25.6 standard scan reported zero findings.

## Portfolio inventory and prioritization

All exact-owner repositories were paginated as 100, 100, 100, and 22 entries: **322 repositories**, comprising 219 public and 103 private. None are archived; 284 are indexed, 38 unindexed, and 11 empty. Private repositories appear only as aggregate counts.

Observed activity since the previous verified federation checkpoint was 12 public default-branch commits across three repositories. Private activity was eight commits across two repositories, aggregate-only. Open-state searches reached connector limits at at least 100 pull requests and at least 100 issues.

Selection used security 35%, functionality and production impact 30%, change velocity 10%, measurable optimization 10%, SOTA relevance 10%, and review age 5%, with neglected-repository rotation and critical-risk override. The cohort was frozen before outcomes: Dream Machine #129, MetaHarness #341, Ruflo #3395, post-merge RuVector #1010, and RuView #1984. Existing issues and PRs covered all confirmed actions, so no duplicate issue or implementation branch was created.

## Deep reviews

### 1. Dream Machine PR #129 — ledger rows versus calendar nights

Frozen software hypothesis: `distinctDatesInWindow` and the TUI make last-N-night signals accurate while preserving existing output, rejecting malformed/reordered/duplicate date evidence safely, and remaining usable from the clean packed CLI.

Exact head `c7c47c374278b0e1af5ab598388868078a20f752` passed 651/651 Vitest tests, 140/140 governance tests, [CI 35582520776](https://github.com/ruvnet/dream-machine/actions/runs/35582520776), and [CodeQL 35582520778](https://github.com/ruvnet/dream-machine/actions/runs/35582520778). The new count is directionally useful.

The boundary still fails. `2026-99-99` and `2026-02-30` pass ledger verification and count as distinct nights. Malformed and out-of-order windows are not surfaced, the singular message renders `1 nights`, and the dashboard header still labels total rows as nights. The candidate ledger contains 38 rows across 22 distinct dates, while the report's frozen-fixture row and duplicate-frequency measurements are inconsistent. A clean install of the actual `dream-machine-0.1.1.tgz` also exits because the published ledger dependency does not export `EVALS`; installing all local workspace packages is not an ordinary consumer replay. [RFC 3339 §5.7](https://www.rfc-editor.org/rfc/rfc3339.html#section-5.7) and [Temporal.PlainDate](https://tc39.es/proposal-temporal/docs/plaindate.html) support strict calendar validity rather than shape-only acceptance.

Action: exact-head [COMMENT review 5274863261](https://github.com/ruvnet/dream-machine/pull/129#pullrequestreview-5274863261), reusing issue #128.

Verdict: **REJECT**

### 2. MetaHarness PR #341 — negative flywheel rendering

Frozen software hypothesis: negative primary values render without throwing, nonnegative output remains byte-identical, malformed and nonfinite evidence fails closed, and the packed artifact matches source behavior.

Exact head `0013c2c6795ffebb21d6482f93c0be3c84e9fa93` fixes the finite-negative `RangeError`. Focused tests passed 76/76; build, typecheck, ESM/CJS loading, packed `@metaharness/flywheel` replay, [CI 35578995451](https://github.com/ruvnet/metaharness/actions/runs/35578995451), and [Real Tools 35578995645](https://github.com/ruvnet/metaharness/actions/runs/35578995645) passed. Nonnegative controls remained byte-identical.

The runtime bundle has no shared numeric schema/domain gate. Nonfinite, oversized, null, string, and object inputs can exit 0 and render as valid points; analysis can report promoted evidence containing nonfinite lift and cost. Required [Security 35578995613](https://github.com/ruvnet/metaharness/actions/runs/35578995613) remains red on pre-existing elevated dependency findings, whose details remain withheld. A clean local Node 24/npm 11 install also exposed lockfile/peer-resolution drift not reproduced by permissive CI fallback. [ECMAScript `String.prototype.repeat`](https://tc39.es/ecma262/2026/multipage/text-processing.html#sec-string.prototype.repeat), [`Number.isFinite`](https://tc39.es/ecma262/2026/multipage/numbers-and-dates.html#sec-number.isfinite), and [RFC 8259 §6](https://www.rfc-editor.org/rfc/rfc8259.html#section-6) support bounded finite numeric handling.

Action: exact-head [COMMENT review 5274863164](https://github.com/ruvnet/metaharness/pull/341#pullrequestreview-5274863164), reusing issue #340.

Verdict: **REJECT**

### 3. Ruflo PR #3395 — EWC EMA direction and durable numeric state

Frozen software hypothesis: the corrected EMA preserves at least 90% of meaningful Fisher signal, reaches the production caller, rejects malformed numerics, survives restart without drift, and is delivered by the real packed consumer.

Exact head `1cc7231503d6762aac45dd08c5b46b20a2c27bf6` repairs the primary direction: after five near-zero updates, baseline retention was approximately `1.01e-8%`, while the candidate retained `95.099%`. Four of four focused tests passed through the production distillation caller. Valid legacy persistence reloaded exactly. Cross-Agent, CodeQL, CVE Audit, Verification, and V3 CI/CD passed; main [CI/CD 35694412969](https://github.com/ruvnet/ruflo/actions/runs/35694412969) was still in progress at the evidence freeze.

Malformed numeric state is not fail-closed. Nonfinite or missing confidence and nonfinite embeddings poison Fisher; JSON persistence converts them to `null`; restart silently converts the learned signal to zero. A nonempty batch with no contributing sample still decays and persists Fisher. Loaded state lacks dimensional, type, finiteness, and nonnegative validation. A clean packed-consumer replay was not established, and the receipt binds the unchanged base commit rather than the source fix or exact head. [EWC++](https://arxiv.org/abs/1801.10112) supports the moving-average direction; [ECMAScript JSON serialization](https://tc39.es/ecma262/multipage/structured-data.html#sec-json.stringify) explains the nonfinite-to-null transition but does not make it safe.

Action: exact-head [COMMENT review 5274863493](https://github.com/ruvnet/ruflo/pull/3395#pullrequestreview-5274863493), reusing issue #3394.

Verdict: **REJECT**

### 4. RuVector PR #1010 / `@ruvector/typesafe` — post-merge consumer qualification

Frozen software hypothesis: the published package produces schema-valid, calibrated typed decisions with deterministic native/WASM parity and an honest quality/latency advantage on repeated and held-out data.

PR head `70cd261f8d556db56fe01b3cd0dd611d02a030a1` merged as `950e1cb7d951c5e7339c32df2d9825088a2a750f`; current main contains no later typesafe implementation change. The clean `@ruvector/typesafe@0.1.0` install and audit passed. Repeated native output was byte-identical; native/WASM labels matched 50/50 with maximum numeric delta about `4e-8`. Over 5,000 warmed test-double decisions, native p95 was 0.0749 ms and WASM p95 0.0511 ms.

The public default is explicitly `hash-bow-256@test-double` with `calibrated:false`, so speed is not quality-comparable to a production model. Across three identical ticket runs it achieved 28.7% accuracy, 0.276 macro-F1, and 0.0911 ECE, versus the repository-frozen Jev replay at 85.3%/0.851/0.0731. Held-out CLINC150, Banking77, and HWU64 accuracy was 34.7–42.6% with ECE 0.3198–0.4153; OOS AUROC was 0.50. The documented [TypeSafe API](https://docs.typesafe.ai/api) failed 5/5 compatibility probes. Typesafe CI, platform builds, supply chain, and regression checks passed, but Workspace CI was cancelled and the benchmark workflow is `--report-only`, allowing failed quality gates to remain green. The release is merged and published, but not integration-ready or verified; no production MetaHarness or Ruflo caller was found.

Action: post-merge [COMMENT review 5274863417](https://github.com/ruvnet/RuVector/pull/1010#pullrequestreview-5274863417). Treat the npm package as experimental until calibrated quality, blocking OOD gates, contract compatibility, version provenance, Workspace CI, and exact packaged native/WASM qualification pass.

Verdict: **REJECT**

### 5. RuView PR #1984 — ESP32-C6 base-MAC digest repair

Frozen software hypothesis: the API replacement removes the reachable width/identity defect across supported targets without ABI, migration, digest-uniqueness, sanitizer, delivery, or hardware-regression risk.

Exact head `1bb586308b92e903a6c1b9a63e6e8581adc34605` makes a source-level correct one-line replacement. ESP-IDF 5.4 and 6.0.2 document a six-byte base-MAC API, while the prior efuse API can use eight-byte EUI-64 behavior on IEEE 802.15.4 targets. A standalone deterministic reproduction preserved its guard and produced three distinct digest prefixes for three distinct six-byte MAC fixtures. Issue #1942 confirms reachable ESP32-C6 user impact in the Mac provisioning anti-swap guard. [ESP-IDF MAC source](https://github.com/espressif/esp-idf/blob/v5.4/components/esp_hw_support/mac_addr.c) and [ESP32-C6 system API](https://docs.espressif.com/projects/esp-idf/en/v5.4/esp32c6/api-reference/system/misc_system_api.html) support the replacement.

The repair is not delivered or qualified. No repository test exercises `device_digest`; all six exact-head workflows required authorization and ran zero jobs; no S3/C6 build, sanitizer, distinct-board vector, migration/retry, or hardware replay ran. The tracked affected 0.8.12 C6 binary and checksum are unchanged, so users flashing the repository-provided image receive no repair.

Action: exact-head [COMMENT review 5274863355](https://github.com/ruvnet/RuView/pull/1984#pullrequestreview-5274863355), reusing issue #1942.

Verdict: **REJECT**

## Security and constellation receipt

No new remotely exploitable critical or high production vulnerability was confirmed. Elevated pre-existing MetaHarness dependency findings remain redacted and require private handling. Automated audits and scans did not detect the reachable calendar, numeric-state, calibration, packaging, and firmware-delivery defects; effect-path and final-consumer replay remained necessary.

Dream Machine supplied governance and durable evidence; MetaHarness supplied adversarial promotion concepts; Ruflo supplied coordination and project-scoped memory; RuVector supplied native/WASM parity evidence and retrieval primitives; Core Memory and the signed federation supplied redacted continuity; ruOS supplied an execution/observation probe. The reusable constellation lesson is that source-level correctness must remain bound through numeric-domain validation, serialization/restart, clean packaging, calibrated outcome, and shipped binary delivery.

Ruflo 3.25.6 initialized project-local hybrid memory with bundled `all-MiniLM-L6-v2`, 384 dimensions, HNSW enabled, and 6/6 checks. The fresh local store contained no prior record, so prior continuity was recovered only from the verified Core Memory and federation receipts. The validated cross-cohort lesson was stored with strict `--no-upsert` under `portfolio-patterns/portfolio-2026-09-22-domain-transition-integrity` and retrieved verbatim. This is a reusable evidence gate, not a promoted research strategy.

## Research Loop Receipt

- Parent: `state-transition-completeness`, previously finding contradictions in 5/5 reviews.
- Candidate: `consumer-calibrated transition tracing`.
- Strategy/config SHA-256: `0c4e95b2b44c7ae4e3ff38c3984b4e31d22907276b2500205e74e2d1adecb713`.
- Source cutoff: 2026-09-22; budget at most 45 minutes per repository.
- Tuning: MetaHarness, Ruflo, RuVector. Holdout: Dream Machine, RuView.
- Frozen gates: authoritative API semantics, exact shipped artifact, durable/restart state, numeric-domain validation, and end-user outcome calibration.
- Promotion threshold: at least 10% composite gain with no accuracy, primary-source-ratio, cost, privacy, security, citation, or licensing regression.

The candidate found useful distinctions between no-crash behavior and semantic fidelity, and between same-process state and restart durability. Authoritative topic coverage stayed 5/5; material contradictions fell from 5/5 to 4/5; all constraints including qualification gaps stayed 5/5; primary-source mapping stayed 5/5. This did not reach the frozen threshold, and an identical costed cross-day holdout was unavailable. The parent was retained; no methodology or factual conclusion was promoted.

Research-loop verdict: **INCONCLUSIVE**

### Autogenous sub-receipt

Parallel roles covered primary sources, replication, falsification/security, benchmark design, and RuV integration mapping using bounded structured messages. A validated Autogenous runtime, LatentMesh semantic-delta transport, replay seed, token/cost counter, duplicate-source rate, and deterministic Autogenous-versus-parent replay were unavailable. Manual/platform parallel analysis was not relabelled as Autogenous or MetaHarness runtime evidence. No memory key was written for a promoted strategy.

Autogenous verdict: **INCONCLUSIVE**

## ruOS governed-evaluation receipt

Current desktop status listed no live heartbeat. The personal Mac was excluded. The dedicated `ruos-ruos-evolution-candidate-8dd713` target returned image bytes for a screenshot, but the fixed harmless `true` probe returned `status: unverified`, `exitCode: null`, `completionVersion: null`, and `completionVerified: false`. Positive stdout was not parsed as success. Without authoritative completion, tenant/workload binding, isolated baseline/candidate states, and the remaining receipt assertions, no live user-journey or integration claim can pass.

ruOS verdict: **INCONCLUSIVE**

## Durable actions and blockers

- [Core Memory checkpoint 5772316427](https://github.com/ruvnet/core-memory/issues/20#issuecomment-5772316427) was written and retrieval-verified.
- Signed federation Result `7e7fafce4a257ad450cc112321152174647d4f7e2d76ef2d115b6286b7a1814e` was retrieval-verified.
- Five exact-head or exact-merge COMMENT reviews were posted: Dream Machine #129, MetaHarness #341, Ruflo #3395, RuVector #1010, and RuView #1984.
- Existing issues #128, #340, #3394, and #1942 were reused without duplicate updates.
- Zero new or materially updated issues, implementation PRs, direct pushes, merges, releases, deployments, automerge changes, or research-strategy promotions.
- No hypothesis passed its evidence gate, so no implementation was created or promoted.

Blockers are strict Dream calendar/package semantics; MetaHarness shared numeric validation and required Security; Ruflo finite persisted-state validation, sample-count handling, package replay, exact receipt, and remaining CI; RuVector calibrated production quality, blocking gates, contract/version provenance, Workspace and packaged parity; RuView target CI, binary rebuild, digest/migration fixtures, and real multi-board replay; and unavailable authoritative ruOS completion.

Next cohort: Dream strict date windows and clean published CLI; MetaHarness shared malformed/nonfinite bundle validation; Ruflo persisted Fisher quarantine and pack/install replay; RuVector calibrated embedder/OOD and exact-main Workspace recovery; RuView rebuilt C6 delivery and multi-board anti-swap replay; private remediation of previously redacted findings; QuDAG release recovery; and neglected high-risk repositories.

Evaluation is not promotion. Nothing was merged or deployed by this cycle.
