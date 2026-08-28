# Portfolio Dream cycle — 2026-08-28

## Governance

Execution followed the default branch contract in README.md, SECURITY.md,
dream.config.json, ADR-0001, and the compiled pipeline. Evaluation was not
promotion: no merge, automerge, protected-branch write, package publication,
credential use, or production probe occurred. Critical and high vulnerability
details are excluded. Private repositories appear only as aggregates.

## Inventory and activity

- 311 owned repositories were enumerated with pagination: 210 public and 101
  private; 0 archived and 11 empty.
- Code-search metadata: 273 indexed and 38 unindexed.
- Since 2026-08-27T06:54:00Z, six public default branches produced 21 commits:
  LatentMesh 8, RuVector 8, RuView 2, Open Claude Code 1, Ruflo 1, and SPARC 1.
- Private default-branch activity: 0 repositories and 0 commits, aggregate only.
- Deep review was capped at five repositories: Dream Machine, Ruflo, RuView,
  RuCelium, and MetaHarness.

## Frozen hypotheses and verdicts

### ruvnet/dream-machine

**Hypothesis.** Anchored replay evidence accepts only unambiguous plain JSON,
so semantically different or executable object shapes cannot collapse to the
same canonical digest; acceptance requires exact regression tests, build, lint,
the full test suite, CI, and CodeQL.

**Baseline.** PR #42 canonicalized ordinary objects but accepted sparse arrays,
non-plain objects such as Date and Map, symbol-keyed data, and accessor
properties. Those shapes could be omitted or collapsed by canonicalization.

**Candidate.** Existing draft PR #42 was updated at
`9bf018c47cc179ae9002cd62e74db93cf1d88f62` to reject sparse or extended
arrays, non-plain objects, symbols, non-enumerable properties, and accessors.
The accessor regression proves the getter is not invoked.

**Evidence.**

- `npm ci`: pass
- `npm run build`: pass
- `npm run lint`: pass
- `npm test -- --run`: 108/108 pass; two new adversarial tests
- CI run 33150021211: pass
- CodeQL run 33150021171: pass
- Ruflo 3.25.6 secret scan: 42 files, zero secrets
- Ruflo 3.25.6 STRIDE scan: six witness files, no indicators

**ACCEPT**

### ruvnet/ruflo

**Hypothesis.** PR #3119 makes union-strategy hybrid retrieval weight-sensitive
with weighted reciprocal-rank fusion while preserving all other strategies and
passing the exact package and workspace gates.

**Baseline.** The declared weights were unused. The candidate's author-side
fixed-state test reportedly discriminates the structured-weight case and
reports 461/462 package tests, with one stated pre-existing sandbox failure.

**Evidence gate.** On exact head `b901326c`, all install-dependent workflows
failed before build or test. The root manifest requests unpublished
`@claude-flow/mcp@3.0.0-alpha.10`, and the v3 lockfile still records alpha.9.
Existing issues #3095 and #3101 already track this. CodeQL alone passed.
The review also requires finite non-negative weights and deterministic ties.

**INCONCLUSIVE**

### ruvnet/RuView

**Hypothesis.** PR #1731 supplies a working dashboard against the paired
RuCelium head, accurately rendering sensing, domain state, ingestion, and fused
room-state data without hardware claims.

**Evidence gate.** The dashboard calls `GET /api/rf-context`. The paired
RuCelium PR #3 does not register that route or implement the response schema.
Every observed RuView workflow ended `action_required`; no independent
cross-repository contract test or physical evidence exists.

**REJECT**

### ruvnet/RuCelium

**Hypothesis.** PR #3 provides the dashboard's required read contract with
GET-only CORS while preserving the browser confidentiality boundary for all
unrelated gateway data.

**Evidence gate.** The branch adds no `/api/rf-context` route and applies
`Access-Control-Allow-Origin: *` to the entire router, including observation,
event, peer, and federation GET surfaces. The gateway listens on all interfaces
by default, so browser-origin isolation is a real boundary even when the HTTP
API lacks application authentication. CI ended `action_required`.

**REJECT**

### ruvnet/metaharness

**Hypothesis.** PR #231 rejects every promoted replay bundle whose required
score evidence is absent or mistyped, while preserving all honestly generated
bundles and repository gates.

**Evidence.** Exact head `dd18f14e` validates all required score fields at the
untrusted-bundle boundary. Eight field-deletion mutations cover both baseline
and candidate score objects; three additional mutations cover missing objects
and anchor evidence. Seven committed replay bundles re-verify. CI, Security,
and Real Tools all pass.

**ACCEPT**

## Security and functionality

- No new critical or high vulnerability was confirmed in this cycle.
- Dream Machine issue #37 remains the canonical dependency-remediation record.
  `npm audit` and Ruflo 3.25.6 independently report 2 critical, 1 high,
  3 moderate, and 2 low development-dependency signals on lockfile SHA-256
  `f26d2be9956e7a88b2d9296f08d1cad183c47e81f41fb360e28bd0592fe19064`.
  Normal repository scripts do not expose the affected Vitest UI or Vite
  server, so production reachability remains unconfirmed.
- RuCelium PR #3 received a public medium-confidence browser confidentiality
  review and a required narrow-origin acceptance gate.
- RuView PR #1731 received a cross-repository contract review for the missing
  API route.
- MetaHarness PR #231 closes the previously reviewed fail-open evidence class
  on its draft head. Human review and private-advisory policy still govern
  disclosure and release.
- Ruflo #3095/#3101 remain the portfolio's widest CI blocker.

## SOTA evidence

1. [Repair or Resample?](https://arxiv.org/abs/2608.25920), submitted
   2026-08-26, introduces SymTrace: reconstruct the recorded prefix to an
   intervention anchor and regenerate only the downstream trajectory. It
   directly applies to Dream Machine PR #42. External benchmark results are not
   claimed as local results.
2. [Exact Adaptive Hybrid Retrieval Without Fixed Top-L Cutoffs](https://arxiv.org/abs/2608.07152),
   submitted 2026-08-07, evaluates weighted RRF across changing queries and
   corpus snapshots. It supports Ruflo's rank-fusion direction but also shows
   fixed cutoffs can change fused top-k semantics; Ruflo therefore needs a real
   recall and latency benchmark after CI recovery.
3. The [WHATWG Fetch Standard](https://fetch.spec.whatwg.org/) defines CORS as
   browser-mediated response sharing and warns that wildcard origin is
   appropriate only for resources intended to be readable by arbitrary web
   pages. This is the governing standard for the RuCelium review.

## Constellation relationships

- Dream Machine witness primitives bind causal replay evidence; MetaHarness
  flywheel replay decides whether promotion evidence can be re-executed.
- Ruflo and RuVector provide retrieval and durable semantic-memory candidates,
  but no native/WASM vector backend was introduced because this cycle had no
  measurable retrieval workload requiring it.
- RuView is the sensing and domain-evidence source. RuCelium is intended to
  verify and fuse the resulting event stream. Their current browser integration
  is not accepted until the route, schema, origin policy, and real two-head test
  agree.
- Core Memory coordination is aggregate-only. The governed federation endpoint
  was unavailable, so no signed persistence or federation claim is made.

## Actions and blockers

- Existing draft PR materially updated: Dream Machine #42.
- Existing draft PR accepted after remediation: MetaHarness #231.
- Reviews added: Ruflo #3119, RuView #1731, RuCelium #3, MetaHarness #231, and
  Dream Machine #42.
- New issues: 0. Existing issues were reused.
- Direct pushes to default branches: 0.
- Merges and automerge: 0.
- New portfolio evidence PR: Dream Machine #44.
- Blockers: Ruflo unpublished dependency and lock drift; RuView/RuCelium
  missing API contract and unapproved CI; no physical RF validation; no
  governed Core Memory endpoint; 38 repositories without code-search indexing.

## Next cohort

1. LatentMesh persistent RuVector reopen/restart evidence after its eight-commit
   integration wave.
2. RuVector graph-node 2.1.0 release provenance and full workspace CI.
3. Open Claude Code execution-control boundary after version metadata updates.
4. SPARC packaged ChatGPT-plugin permissions and deterministic release checks.
5. Ruflo plugin trust enforcement plus dependency/lockfile recovery.
