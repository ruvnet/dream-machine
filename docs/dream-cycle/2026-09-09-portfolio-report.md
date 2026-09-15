# Dream constellation portfolio report — 2026-09-09

## Contract and scope

The cycle started by fetching `ruvnet/dream-machine` default branch `main` at `3edd426f6c9c4b1e80235f7447dc863e749345cc`. The execution contract was read before portfolio work:

- `README.md` — `355222b4f9ef7e46c199d903e74fa24223f33e4d`
- `SECURITY.md` — `1663f995e80a3088e46fa6fa6633351ad934a959`
- `dream.config.json` — `c17b00036f11b09cb0999f5142089c84252531f9`
- `docs/adr/ADR-0001-governance-and-authorization.md` — `5770eac0d4ba6634897c0da982fb5c200f8b6a51`
- ADR index — `6a9877e7fa2842e247da2a1e2cd61143f61a77c3`
- compiled pipeline source `packages/compile/src/index.ts` — `e2c16ad1d34fd942dabce23dcc84ab47dcfa8efe`
- `package-lock.json` — `78d1b0e7556323a1fb5313ee7eff6830e51f5081`

The human-only merge authority, fail-closed evidence rules, draft-PR policy, and one-verdict-per-hypothesis rule were preserved. No merge, release, deployment, direct push to a default branch, automerge change, credential use, production probe, or archived-repository modification occurred.

## Portfolio inventory

All owned repositories were paginated as four pages of 100, 100, 100, and 19 repositories. The portfolio now contains 319 repositories: 217 public and 102 private. None are archived; 281 are indexed, 38 unindexed, and 11 empty. rGi and APx are the two new public repositories since the prior inventory. Private repositories are represented only by aggregate counts.

Observed activity since `2026-09-08T07:00:00Z` is a lower bound: 13 default-branch commits across four public repositories. Private activity was seven commits in one repository, aggregate-only. Open-state searches reached connector caps at at least 100 pull requests and at least 100 issues.

The five-repository cohort was frozen before candidate outcomes using security 35%, functionality and production impact 30%, velocity 10%, measurable optimization 10%, SOTA 10%, review age 5%, plus neglected-repository rotation. Critical findings would have overridden ranking; none was confirmed.

## Deep cohort and frozen hypotheses

### 1. Dream Machine — future-safe protected paths

Research hypothesis: current GitHub immutable-workflow guidance plus exact effect-boundary inspection will show that a segment-safe package rule is stronger than a maintained package-name enumeration without broadening eligibility. Query set: immutable Actions, protected path evaluation, regex overmatch, future-workspace simulation. Inclusion: GitHub documentation, exact-head source/tests/workflows. Exclusion: generic supply-chain advice and result-only claims. Holdout: a synthetic future package name and a near-prefix non-package path. Expected information gain: determine whether the guard is protect-by-construction. Budget: one generation, 15 minutes. Promotion threshold: every package subtree denied, clean controls unchanged, full CI/security green.

Software hypothesis: PR #100 makes every current or future `packages/<name>` path ineligible for automerge without changing non-package behavior.

Exact head: `edc0eb00a607757d804a93620aae93a6333bc3f0`. The live guard reproduction changes a package candidate from eligible to `protected-path`. Coverage rises from 14 to 15 guard tests, explicitly including a synthetic future package; all 616 tests and 82 governance tests pass, with build and lint clean. CI run 34209362093 and CodeQL run 34209362154 passed. The expression is anchored and segment-bounded, so `packages-other` is not overmatched. Repository automerge remains disabled, so the accepted result is dormant hardening, not evidence of an automated merge. The PR's own hypothesis was written after implementation; this review's hypothesis was independently frozen before inspecting the outcome.

**ACCEPT**

### 2. MetaHarness — settings-aware MCP risk scoring

Research hypothesis: the current MCP tool security contract and a schema/source contradiction search will establish whether settings-only registrations must count as enabled, without double-counting compliant policy evidence. Query set: MCP registration surfaces, tool security requirements, scanner-to-score data flow, clean and compliant controls. Inclusion: MCP 2026-07-28, exact source/tests/workflows. Exclusion: vendor marketing and policy claims without reachable code. Holdout: settings-only, `.mcp.json`, compliant policy, clean template, and double-count case. Expected information gain: distinguish registration detection from enforcement. Budget: one generation, 15 minutes. Threshold: all holdouts correct, no score regression, exact CI/security/real-tool workflows green.

Software hypothesis: PR #298 routes OIA scoring through the authoritative MCP scanner so settings-only and `.mcp.json` registrations are recognized without false positives or duplicate penalties.

Exact head: `e37c51140630c22099b4d234d69100cbfcacd239`. Package tests rise from 572 to 587 passed with two skipped; root OIA integration rises from nine to ten; TypeScript is clean. The settings-only, `.mcp.json`, compliant-policy, clean-control, and no-double-count cases are present. CI 34280285262, Security 34280285207, and Real Tools 34280285197 all passed. Acceptance is limited to detection and scoring; it does not prove generated templates enforce default-deny policy or repair the separately tracked full-root-suite and release-ordering debt. Latest inspected release: v0.4.4, published 2026-08-10.

**ACCEPT**

### 3. RuVector — deterministic static minimum cut

Research hypothesis: exact source, native/WASM parity, representative scaling, and required workspace evidence will distinguish a useful deterministic primitive from an end-to-end compaction improvement. Query set: deterministic global min-cut, canonical tie-breaking, sparse graphs, native/WASM parity, workspace completion. Inclusion: exact implementation, ADR, tests, benchmarks, workflows, primary algorithm research. Exclusion: single-number speed claims without baseline or complete workflow evidence. Holdout: sparse/non-contiguous graphs, multiple sizes, cross-target parity, Workspace CI. Expected information gain: separate primitive correctness from product benefit. Budget: one generation, 20 minutes. Threshold: complete repeatable partitions, material speedup, no native/WASM/workspace regression.

Software hypothesis: PR #972 provides complete deterministic static Stoer-Wagner partitions, material improvement over the current dynamic path, and full workspace compatibility.

Exact head: `f380cd3faaecf73490c563326256ad6e9e3edb1b`. The reported 19-vertex comparison is 0.099 ms versus 835 ms, approximately 8,421 times faster, with zero empty static partitions versus 66% empty dynamic outputs. On an 84-memory corpus, static is 64.7–73.6 times faster than dynamic, but remains 43.8–46.9 times slower than the baseline and produces no bridge-rate gain; the PR correctly retains the compaction result as negative evidence. Native, WASM-dedup, regression, supply-chain, formatting, and clippy workflows passed. Required Workspace CI run 34200670407 was cancelled, and the benchmark remains single-host/small-graph evidence. Latest inspected release: ruvector-v0.2.40, published 2026-07-29.

**INCONCLUSIVE**

### 4. Ruflo — durable hive identity

Research hypothesis: the MCP state-handle contract plus schema-to-handler tracing will establish whether the init-returned identity survives reloads and whether configuration claims match actual persistence. Query set: init/status state flow, legacy migration, schema/handler parity, persistence semantics, dispatch separation. Inclusion: MCP 2026-07-28, exact source/tests/workflows, existing issue history. Exclusion: CLI help claims without effect-path evidence. Holdout: legacy state without `hiveId`, reload/status, `persist:false`, and independent dispatch behavior. Expected information gain: separate the ID fix from adjacent state and dispatch defects. Budget: one generation, 20 minutes. Threshold: exact identity after reload, legacy compatibility, full CI, no misleading persistence response.

Software hypothesis: PR #3241 gives `hive-mind_init` and later `hive-mind_status` one durable ID across reloads while preserving legacy state compatibility.

Exact head: `cdae71792af7106d5f3e7b911209b9b279e27fae`. The generated ID is stored before the state write, status returns it, and a legacy fallback remains. The focused suite passes 108/108. Cross-Agent run 34314531691, CodeQL 34314531668, Verification 34314531666, CVE 34314531677, V3 CI 34314531797, and CI/CD 34314531944 all passed. The ID hypothesis passes.

Adversarial review found a separate reachable functionality defect: the input schema omits `persist`, the response reports `persist: false` when supplied, but init still calls `saveHiveState` unconditionally. Existing issue #655 was materially updated with schema, no-write, reload, legacy, and cross-platform gates. The issue's larger dispatch-bridge remainder is also independent of this ID fix. Latest inspected release: v3.38.23, published 2026-09-07.

**ACCEPT**

### 5. rGi — active finite-prior discovery

Research hypothesis: current value-of-information research plus replay/provenance inspection will determine whether the active selector reduces acquisition cost without hiding errors, tuning against its final benchmark, or importing a general-capability claim. Query set: Bayesian experimental design, finite-prior active selection, benchmark leakage, seeded controls, durable reservation, RVF replay. Inclusion: primary research within 90 days, exact source/ADRs/evidence/workflows, stacked-parent provenance. Exclusion: AGI/generalization claims from synthetic public fixtures. Holdout: unseen target split, repeated random seeds, interrupted resume, wrong-answer and abstention accounting, end-to-end cost. Expected information gain: distinguish a useful bounded primitive from an external capability claim. Budget: one generation, 25 minutes. Threshold: lower acquisition cost, zero added wrong answers, no capability loss, deterministic signed replay, strict budgets, untouched holdout.

Software hypothesis: PR #5 reduces acquisition cost on frozen finite priors without added wrong answers or capability loss, and emits bounded signed RVF evidence replayable across native and WASM paths.

Exact head: `a34dc8198da4275078f788e310c02bb1badf9009`. Verify run 34301649490 passed, and stacked parent #4 passed exact-head run 34299527752. Reported paired evidence is 2,394 versus 2,318 correct answers, 149 versus 147 fully solved targets, zero wrong answers in both arms, and synthetic acquisition cost 444 versus 731, a 39.3% reduction. All 769 checkpoint resumes match. The selector kernel is 5.13 times faster than the Map reference, while initialization is slower at 4,342 ms versus 3,408 ms; no end-to-end speedup is accepted. Bounds, abstention, reservation-before-callback, signatures, and native/WASM replay are represented in the software envelope.

The 187 public finite-prior targets are development evidence rather than an untouched holdout, the random control has one seed, callback execution remains trusted and unmetered, and the change is stacked on open parents rather than main. The frozen holdout gate therefore did not complete.

**INCONCLUSIVE**

## Security and functionality

No new remotely exploitable critical or high production vulnerability was confirmed. No secret, exploit instruction, or private-repository detail was published.

Dream Machine's package guard and MetaHarness's MCP registration detection improve supply-chain and policy visibility within their tested envelopes. Ruflo's misleading `persist:false` behavior is a confirmed functionality defect, not a claimed remote exploit. RuVector's required workspace remains unverified. rGi explicitly documents that reviewed child-process permissions are not hostile-code or network containment.

Runnable checkouts were unavailable. Therefore pinned Ruflo 3.25.6 deep/static/quality scans, `npm audit`, `cargo audit`, secret scanning, STRIDE generation, local reachability tests, and fresh RuVector native/WASM/RVF replay did not run. Exact-head source and GitHub workflows were used instead. This degradation grants no additional security-acceptance claim.

## SOTA and authoritative sources

- GitHub's current [secure-use reference](https://docs.github.com/en/actions/reference/security/secure-use) says a full-length commit SHA is the only immutable third-party Action reference and recommends least-privilege tokens. Applicability: Dream Machine's path guard reduces automerge scope, while existing issue #86 still governs mutable workflow references. Baseline: enumerated package names. Expected benefit: future packages inherit protection without policy maintenance.
- The [MCP tools specification dated 2026-07-28](https://modelcontextprotocol.io/specification/2026-07-28/server/tools) requires input validation, access control, rate limiting, sanitized outputs, client result validation, timeouts, and audit logging. It also states that MCP has no protocol-level session and stateful tools should return an explicit handle. Applicability: MetaHarness should conservatively recognize all registration surfaces; Ruflo must persist and validate an explicit hive identity while keeping schema and behavior aligned.
- [Model Discovery Agent](https://arxiv.org/abs/2608.09696), submitted 2026-08-10 and revised 2026-08-25, combines model proposal with Bayesian value-of-information experiment design. Its v4 history explicitly reports correction of a benchmark prompt leak. Applicability: rGi's information-gain selector is directionally aligned, while the correction strengthens the requirement for untouched holdouts and leakage checks. Baseline: fixed-order selection. Expected benefit: lower acquisition cost without importing the paper's model-discovery or SOTA claims.
- SQLite's official [transactional contract](https://www.sqlite.org/transactional.html) states that changes inside one transaction are atomic, isolated, and durable even across interruption. Applicability: rGi's reservation-before-callback structure is the correct ordering, but real cross-process and crash testing remains distinct from an in-process model.
- Recent deterministic min-cut work found during search was outside the preferred 90-day window. It was not used to promote RuVector. The repository's exact algorithm, tests, and benchmarks remain the controlling evidence.

No paper result was imported as a repository result.

## Ruflo research self-learning receipt

Parent strategy SHA-256: `8b81970f34df5b8b469d2aa8454c1977d90413b6a3c3aa98d9854a517378064d`.

Candidate strategy SHA-256: `a8641df5e84c4620d8724598dea6122f32d6cd1ca14dc203fe99b54d8aa76ac2`.

Parent: contract-first exact-head source/workflow inspection, prior-receipt deduplication, authoritative-source search, contradiction and effect-boundary tracing, and manual security/reproducibility critique. Candidate generation: add version-history leak search, schema-versus-handler contract diff, stacked-parent provenance, and untouched-holdout/end-to-end-cost checks. Source cutoff: 2026-09-09. Seeds: repository fixtures only; no new stochastic run. Budget: at most three generations or 45 minutes per repository; one bounded manual generation was used. Frozen promotion threshold: at least 10% composite improvement in authoritative coverage, contradiction recall, reproducibility, cross-stack applicability, and information gained per cost, with no primary-source, citation, safety, privacy, or licensing regression.

Raw manual deltas: external authoritative mapping increased from two of five cohort questions to four of five; three material contradictions or scope limits were retained rather than averaged away—the Ruflo persistence mismatch, rGi's absent untouched holdout, and RuVector's incomplete workspace/end-to-end gate. The candidate added three sources and rejected one out-of-window min-cut source for promotion use. However, connector token/cost was unavailable, the composite could not be deterministically replayed on a held-out research set, and the Ruflo 3.25.6 runtime, durable Ruflo memory, RuVector/RVF retrieval backend, and local MetaHarness evaluator were unavailable. The parent was retained. No memory key, durable lesson write, retrieval verification, or self-learning claim is made. Manual elapsed time was bounded within the cycle; per-repository runtime instrumentation was unavailable.

Research-loop verdict: **INCONCLUSIVE**

## Autogenous sub-receipt

Topology/configuration SHA-256: `a841adc9b429d2862788aa00295ff261a205ac393f838cf78f8ca0c34db9f1b2`.

Frozen topology: primary-source researcher, replication reviewer, contradiction researcher, and security/privacy critic. Communication mode: structured source/claim deltas; LatentMesh semantic-delta communication only if validated. Parent: the single-analyst Ruflo strategy above. Holdout: source/version questions not used to tune routing plus deterministic conclusion replay. Frozen threshold: at least 15% authoritative-coverage or contradiction-recall improvement, no citation or primary-source-ratio regression, equal or lower cost per validated finding, and equivalent deterministic conclusions. Autogenous had no promotion, merge, disclosure, release, deployment, purchasing, credential, or protected-surface authority.

The Autogenous runtime, validated LatentMesh channel, durable Ruflo memory, RuVector retrieval, and local MetaHarness evaluator were unavailable. No parallel topology executed, so wall time by role, tokens/cost, duplicate-source rate, disagreement rate, useful unique findings, false leads, unresolved dissent, held-out delta, deterministic replay, memory write, or retrieval verification could be measured. Manual critique preserved contradictory evidence but cannot be relabeled as Autogenous. The single-agent parent remains in force and no strategy was promoted.

Autogenous verdict: **INCONCLUSIVE**

## Constellation coordination

Dream Machine supplied governance and the durable receipt. MetaHarness supplied exact-head adversarial detection evidence. Ruflo remained the intended research selector and learning memory but was unavailable locally. RuVector native/WASM/RVF evidence was inspected from exact workflows, while fresh local replay was unavailable. rGi consumed pinned RuVector/RVM formats in its own exact-head workflow but did not establish independent execution. Core Memory receives only a redacted aggregate checkpoint; the governed signed-federation endpoint remains unavailable, so no signed-federation claim is made.

## Actions and CI evidence

- Five exact-head COMMENT reviews: [Dream Machine #100](https://github.com/ruvnet/dream-machine/pull/100), [MetaHarness #298](https://github.com/ruvnet/metaharness/pull/298), [RuVector #972](https://github.com/ruvnet/RuVector/pull/972), [Ruflo #3241](https://github.com/ruvnet/ruflo/pull/3241), and [rGi #5](https://github.com/ruvnet/rGi/pull/5).
- One existing issue materially updated: [Ruflo #655](https://github.com/ruvnet/ruflo/issues/655#issuecomment-5596898336).
- Dream Machine CI and CodeQL passed on the reviewed head.
- MetaHarness CI, Security, and Real Tools passed on the reviewed head.
- RuVector six focused/native/WASM/security workflows passed; Workspace CI was cancelled.
- Ruflo all six observed exact-head workflow groups passed.
- rGi PR #5 and stacked parent #4 exact-head Verify workflows passed.
- Zero new implementation issues, zero implementation PRs, zero direct pushes, merges, releases, deployments, automerge changes, or signed-federation claims.

## Blockers and next cohort

Blockers: 38 unindexed repositories; connector caps on open-state searches; unavailable runnable checkouts; unavailable Ruflo, Autogenous, local MetaHarness, RuVector/RVF, and governed Core Memory runtimes; one cancelled Workspace CI; no untouched rGi holdout; and no independent execution/hardware attestation.

Next cohort: APx first review; Ruflo persistence-contract and dispatch-bridge remediation; RuVector Workspace recovery and representative min-cut scaling; rGi preregistered hidden holdout with repeated seeds and end-to-end accounting; Dream evaluator/action pinning; MetaHarness template-policy enforcement; and neglected high-risk repositories.
