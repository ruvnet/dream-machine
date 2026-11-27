# Evaluation-Adapters SOTA Report — 2026

**Repo**: `ruvnet/dream-machine` · **Night**: 2026-11-27 · **DEEP**: evaluation-adapters · **SCAN**: flywheel, darwin · **Slot**: 2 (of 5, `DAYINT % 5`) · **Bonus moduli**: none (`DAYINT % 25 = 2`, `DAYINT % 75 = 27`) · **MODE**: RESEARCH-ONLY · **Session commit**: `71d607bea6608180b8c41980dc5386526d3f1f16`

## MODE rationale (STEP 1.5)

20 open `dream/*` candidate PRs tonight — well over `implementationTrack.reviewBacklogLimit=6`.
Checked every still-draft, non-`routine-self-review` candidate in `created_at` order:

| PR | Shape | Why not eligible for CONSOLIDATE tonight |
|---|---|---|
| #98, #101 | multi-repo portfolio branches | not single-surface candidate PRs in the sense this mode means (unbroken precedent, reaffirmed by #192's own 2026-11-23 comment) |
| #161 | developer-experience, draft, ACCEPT | already carries `<!-- dream-consolidate: 71d607b… -->` from 2026-11-10 |
| #189 | ledger-signals, draft, ACCEPT | already carries the same marker from 2026-11-18 |
| #192 | evaluation-adapters, draft, ACCEPT | already carries the same marker from 2026-11-23 |

`main` has not moved since `71d607bea6608180b8c41980dc5386526d3f1f16` (2026-11-10, PR #209), so every marker above still covers tonight's exact SHA. No draft is eligible → **MODE=RESEARCH-ONLY**: run STEPS 2–4 + 15–18, open no PR, file one issue, append one ledger row with `evaluated=no`. Measured open count: 20. `pipelineMergeRate`: not recomputed live tonight (RESEARCH-ONLY does not touch `ledger outcomes`'s external-fate inputs; ADR-0011 measured 0.608 on 2026-10-18 including the open queue — treat as stale, not reused as a live number). Backlog: non-empty (see "What's new" below) but IMPLEMENT is lower-priority than RESEARCH-ONLY per STEP 1.5's fixed order.

## STEP 2 — accumulated evidence loaded

- `docs/dream-cycle/{2026-09-02,09-07,09-17,09-22,10-12}-evaluation-adapters-report.md` — read in full.
- `packages/compile/src/harness-optimizer.ts` + `.test.ts` (133 lines, 10 tests) — read in full, not just reports.
- `docs/adrs/ADR-0003-trace-driven-harness-optimization.md` ("Trace-driven harness optimization with held-out promotion gates", Proposed, 2026-08-25) — this is the actual design ADR for `evaluateHarnessCandidate`/`selectHarnessUpdate`, cited by ADR-0011 as "ADR-0003" without qualification; note there are **two** ADR-0003 files (`anchored-trace-replay` and `trace-driven-harness-optimization`, a pre-existing numbering collision, out of scope to fix tonight — flagged as a next step). ADR-0003 explicitly says: *"the first version does not generate patches or perform semantic trace diagnosis"* and frames the primitive as deliberately standalone, reusable by "Dream Machine, MetaHarness, Ruflo, and Darwin-style bounded evolution" — i.e. non-wiring was partly a designed-in deferral, not pure oversight, which matters for how candidate (a) below is scored.
- `docs/adrs/ADR-0011-dream-cycle-v2-deep-research-and-routine-self-review.md` and `docs/adrs/ADR-0103-governed-self-evolution.md` — the promotion-gate discipline this SCAN probes.
- Live grep confirms **the zero-call-site finding from 2026-10-12 is still true tonight**: `evaluateHarnessCandidate`/`selectHarnessUpdate` have no importers anywhere outside `harness-optimizer.ts`/`.test.ts`.
- PR #192 (2026-10-17, this same surface, open/draft/ACCEPT) already did a chunk of the "systematic `hardReject` audit" that #177's 2026-10-12 report left as future work — and its own 2026-11-23 CONSOLIDATE round found a real gap in *that* PR's own regression tests (the 2 tests pinned output, not mechanism — fixed same night, commit `b156e7d`). This is directly relevant: it is a **live, local instance** of exactly the "unused/ungamed-tested validator" failure mode this report researches below, not just literature.

## PASS 1 — DISCOVER

| # | Source | Venue/date | Grade | What it establishes |
|---|---|---|---|---|
| 1 | Zhang, Hu, Lu, Lange, Clune, "Darwin Gödel Machine: Open-Ended Evolution of Self-Improving Agents," arXiv:2505.22954 | ICLR 2026 (submitted 2025-05-29) | A | Archive-admission is the closest real analog to a "promotion gate": a modified agent is tested on a coding benchmark *before* being admitted to the archive — admission is itself the wiring point. No agent variant that isn't benchmark-tested ever becomes a parent for further mutation. |
| 2 | Agrawal et al., "GEPA: Reflective Prompt Evolution Can Outperform Reinforcement Learning," arXiv:2507.19457 | ICLR 2026 oral (2025-07) | A | **Directly on point for the holdout question**: GEPA's own docs state `valset` defaults to `trainset` when not explicitly supplied — i.e. the framework *has* a train/held-out split concept but silently collapses to zero holdout unless the caller wires a separate `valset` in. Same failure shape this repo's `requireHoldout` flag exists to prevent, confirmed live in a real, widely-used optimizer, not hypothetical. |
| 3 | Google Cloud, AlphaEvolve Developer Guide — "Evaluator implementation patterns," "Quantify the optimization target," "Logical architecture of an evaluation harness for AlphaEvolve" | Official vendor docs, GA 2026-07 per InfoQ | A | Evaluation cascade (cheap checks first, full eval only for survivors); failed validation returns a large negative score explicitly "to guard against reward hacking"; scoring must be deterministic in the harness, never delegated to the model. A field report in the same doc set describes a literal reward-hacking incident: a naive latency-only fitness score caused the evolved program to skip blur rendering entirely for a huge but fake speedup, fixed by adding a structural-fidelity (SSIM) metric. |
| 4 | "RewardHackingAgents: Benchmarking Evaluation Integrity for LLM ML-Engineering Agents," arXiv:2603.11337 | 2026-03 | B | Separates two compromise vectors explicitly: evaluator tampering vs. train/test leakage. Trust regimes deny train-time reads of held-out files; attempted reads are logged as denied — i.e. holdout protection is enforced structurally (deny-by-construction), not just by a boolean flag the way this repo's `requireHoldout: boolean` is. |
| 5 | "EvilGenie: A Reward Hacking Benchmark," arXiv:2511.21654 | 2025-11 | B | Built on LiveCodeBench with held-out unit tests + test-file-edit detection; finds an LLM judge detects most reward hacking but held-out tests alone give only "minimal improvement" — i.e. a holdout split is necessary but not sufficient; detection also needs to check *how* the candidate passed, not just *that* it passed. Relevant caveat for any future wiring of `evaluateHarnessCandidate`: passing slices is not proof of non-gaming by itself. |
| 6 | "Reward Hacking Challenges Oversight of Autonomous Research Agents," arXiv:2609.28614 | 2026-09 | B | Direct test-set leakage is the single most common hack family across models; "all baseline-exceeding tasks expose an evaluation set, so leakage is unusually easy to attempt" — supports keeping `evaluateHarnessCandidate` as a pure, input-only function with no filesystem access of its own (true today — it never reads a corpus, only the structured `CandidateValidation` object it's handed). |
| 7 | "SpecBench: Measuring Reward Hacking in Long-Horizon Coding Agents," arXiv:2605.21384 | 2026-05 | B | Reports proxy-reality gaps that *widen* with more optimization steps (73.8% of Kernel-Bench, 46.8% of ALE-Bench optimizations show proxy gains without real gains) — relevant to Darwin-bounded evolution (SCAN=darwin): a 3-generation Darwin run compounds this risk faster than a single bugfix night does, reinforcing why `DARWIN=not-applicable` has been the correct call on this surface every time so far (#116/#127/#132/#137/#145/#154/#167/#176/#192 — no evolvable population exists here yet). |
| 8 | Sculley, Holt, Golovin, Davydov, Phillips, Ebner, Chaudhary, Young, Crespo, Dennison, "Hidden Technical Debt in Machine Learning Systems," NeurIPS 2015 | NeurIPS 2015 (official proceedings) | A | Foundational, not recent (>12mo, cited for mechanism not novelty): "undeclared consumers... a consumer that is not known about is effectively invisible, and a change ... can unexpectedly impact that consumer." This is the generic shape of the zero-call-site finding — a well-tested component with **no declared caller** is structurally easy to forget, independent of how well-written it is. |

**Source-floor check**: 8 distinct primary sources ✓ (≥8 required). Recent-dated (within 12 months of 2026-11-27): #4 (2026-03), #5 (2025-11), #6 (2026-09), #7 (2026-05) = 4 ✓ (≥3 required). Honest gap: I could not find a named, citable pattern specifically titled "built-but-unwired validator" in the ML-engineering literature (search for "orphaned module"/"unwired component" + MLOps came up empty of a named pattern) — source #8 is the closest rigorous treatment and is cited for mechanism, not as direct precedent for naming the pattern.

## SOTA delta

The 2026-10-12 report on this surface did **not** run a dedicated SOTA literature pass (it went straight from live repro to a one-line fix). This is the first dedicated DISCOVER pass specifically on the "promotion-gate wiring + gate-gaming" question for this surface. Net new since then: (1) GEPA's own documented `valset=trainset` default is a live, non-hypothetical instance of the exact "holdout defeated by default" failure class; (2) AlphaEvolve's official docs now publicly document a real reward-hacking incident (the blur-skipping speedup) and name "evaluator tampering" as an explicit guard target; (3) three reward-hacking-specific benchmarks (RewardHackingAgents, EvilGenie, arXiv:2609.28614) have appeared since PR #30 (2026-08) shipped `harness-optimizer.ts`, none of which existed when ADR-0003 was written.

## Competitors

| System | Does it have an analogous gate, and how is it wired? |
|---|---|
| **Darwin Gödel Machine** | Yes — wired by construction. Benchmark-testing happens *at* the archive-admission boundary; there is no code path to add an untested variant to the parent pool. No equivalent of "built but not called" is possible because the gate and the mutation loop are the same loop. |
| **AlphaEvolve** | Yes — wired, and explicitly documented as hardened against gaming after a real incident (the SSIM fix). The evaluator is mandatory infrastructure the user must supply before any evolution runs at all; there is no "optional gate nobody calls" state. |
| **DSPy / GEPA** | Partially — the gate (train/val separation) exists in the API but is **not enforced**: `valset` silently defaults to `trainset`, so holdout protection is opt-in, not default-on. This is the closest real-world sibling of this repo's situation: a mechanism that exists but needs the caller to wire it correctly, and silently degrades (not errors) when they don't. Open gap, solved-by-opt-in only. |
| **SWE-agent** | Not applicable by design. It is a single-shot issue-resolving scaffold evaluated externally (SWE-bench harness runs outside the agent, after the fact); it does not self-modify its own harness, so there is no internal promotion gate to wire in the first place. Deliberately out of scope for that architecture, not an oversight. |
| **AutoGPT lineage** | Open gap, arguably worse than this repo's state: no standard held-out evaluation or promotion gate at all in the general AutoGPT-style autonomous-loop pattern; "did the last change help" is typically unmeasured rather than measured-but-unused. |

## Candidates (scored 1–5 on fit / novelty / testability / measurability / production-value / reviewability)

| # | Candidate | fit | novelty | testability | measurability | prod-value | reviewability | Σ/30 | imports external technique? |
|---|---|---|---|---|---|---|---|---|---|
| a | Wire `evaluateHarnessCandidate` into a real pipeline call site (e.g. a STEP 10–14 Darwin/adversarial-gate entrypoint) | 3 | 2 | 3 | 3 | 5 | 2 | 18 | no (internal) |
| b | Continue PR #192's systematic `hardReject`-keyword audit across all 8 keywords, ad hoc | 4 | 2 | 4 | 3 | 3 | 4 | 20 | no (internal) |
| **c** | **New governance test: ablate each of the 8 `hardReject` keywords independently and assert the verdict actually depends on it (generalizing what #192's critic found/fixed for `'slice regression'` alone into a durable, reusable check)** | **5** | **4** | **5** | **4** | **3** | **5** | **26** | **yes — AlphaEvolve's "guard against gaming" + Sculley's "undeclared consumer" framing** |
| d | Add policy/threshold provenance: hash `HarnessOptimizationPolicy` into the evidence/witness record so thresholds can't silently drift between baseline and candidate runs | 3 | 4 | 3 | 2 | 3 | 3 | 18 | yes — Darwin Gödel Machine's archive-admission-as-gate framing |
| e | Add a cheap "reachability" governance test asserting the module is imported from *somewhere* outside its own test file (tripwire against the exact 3-nights-running zero-call-site finding) | 4 | 3 | 5 | 5 | 2 | 5 | 24 | no (internal) |

**Selected: (c)**. It scores highest, is a genuine single-conceptual-change (one new governance test file, mirroring the existing `scripts/witness-corpus.test.mjs` pattern), imports a real external lesson (AlphaEvolve's documented gaming incident + the generic Sculley mechanism) rather than just patching one more internal defect, and — critically — does **not** duplicate PR #192, which fixed its *one* instance (`'slice regression'`) ad hoc but left the other 7 keywords unchecked for the same tautology risk. (e) scored close behind and is cheaper, but a reachability tripwire only proves the function is *called*, not that calling it is safe from the gaming pattern #192 already found once; (c) is the more load-bearing of the two and should be implemented first if a future night does both. (a)'s score is capped by ADR-0003's own stated deferral — wiring it into a real pipeline stage is a larger, legitimately separate design decision (which stage? what inputs? does Darwin's bounded-evolution loop even produce `HarnessPatch`-shaped candidates yet? — no), not a single-night candidate.

## PASS 2 — DEEPEN (top 2: c, d)

**(c) Keyword-independence governance test.**
- Algorithm: for each of the 8 `hardReject` disjuncts in `evaluateHarnessCandidate`, construct a minimal `CandidateValidation` fixture whose *only* triggered reason is that keyword's condition (e.g. `modifiesEvaluator: true` alone, all other fields clean/passing), call `evaluateHarnessCandidate`, assert `verdict === 'REJECT'`; then call again with that one condition suppressed (e.g. `modifiesEvaluator: false`) and assert the verdict is **not** REJECT for that reason (either ACCEPT or INCONCLUSIVE, but the specific reason string must be absent). A keyword fails the test if the second call still rejects *for a different reason that happens to co-occur with the first* — exactly the `'exceeds'`/`'slice regression'` collision #192 found.
- Complexity: O(k) fixtures for k=8 keywords today; each fixture is a handful of field assignments, no corpus/IO. Scales fine to dozens of keywords; would need a small combinatorial-independence framework only if keywords started depending on *combinations* of fields rather than single conditions (not the case today).
- Failure modes: a fixture that accidentally triggers two conditions at once would produce a false pass (test says "independent" when it isn't) — must assert `reasons` has exactly one entry matching the target keyword's own string before trusting the ablation, which (c)'s design already requires.
- Production constraint: none — pure addition to `packages/compile/src/harness-optimizer.test.ts` or a new governance file, zero production code path changed by the test itself (production code only changes if the test discovers and then fixes a real gap, which is out of scope for RESEARCH-ONLY / a future IMPLEMENT night's job).
- Concrete baseline/metric/threshold for a future IMPLEMENT night: baseline = current 10 tests in `harness-optimizer.test.ts`, all passing; candidate = baseline + 8 new ablation cases (one per keyword); metric = count of keywords that fail the ablation (i.e. verdict doesn't actually depend on that keyword alone); threshold = **0 failing keywords required for ACCEPT** (any failure is itself the finding, structurally identical to what #192 fixed for one keyword — so this candidate might legitimately conclude REJECT-of-current-state/new-bug-found rather than a clean ACCEPT, which is a valid, useful outcome per the global invariant that "a rejected hypothesis with a clean measurement is a successful night").

**(d) Policy/threshold provenance hashing.**
- Algorithm: at evaluation time, compute `sha256(JSON.stringify(policy))` and attach it to the `CandidateDecision` (or to the evidence/witness record wrapping it), so any future comparison across nights can detect a threshold change (e.g. `maxSliceRegression` drifting from 0.02 to 0.05) even if no one remembers to mention it in a PR body.
- Complexity: O(1) per evaluation; trivial to add.
- Failure modes/limits: proves a threshold *changed*, not that the change was good or bad — it's a detection aid, not a gate by itself; also not clear which evidence artifact should carry the hash today, since `evaluateHarnessCandidate` has no caller yet (scored lower than (c) partly for this reason — it would be provenance for a thing nothing calls).
- Not selected as tonight's primary candidate because its production value is contingent on (a) happening first; freezing provenance for an unwired function has no live blast radius to protect yet. Recorded as backlog, order: (c), then (e), then (a) [which would make (d) immediately relevant].

## PASS 3 — ATTACK (self-adversarial, run directly, no separate critic subagent available tonight under RESEARCH-ONLY time budget)

- **Already solved here?** Partially, for exactly one of 8 keywords (`'slice regression'`, fixed by PR #192 commit `b156e7d` on 2026-11-23) — but that fix was ad hoc (reword the message, strengthen that one test) with no generic test preventing recurrence for the other 7 keywords or future new ones. The candidate survives because it closes the *general* mechanism, not the one instance.
- **Falsifiable?** Yes — the hypothesis below predicts a specific, checkable count (0 or more keywords failing ablation) and is wrong if every one of the other 7 keywords turns out already load-bearing on inspection (a legitimate possible outcome, not assumed away).
- **Gameable?** Low risk — the test operates on fixed, hand-constructed fixtures, not on live benchmark data a future candidate patch could influence; there's no corpus to poison.
- **Leaks evaluation data?** No — `evaluateHarnessCandidate` takes no filesystem/network input; the whole surface is in-memory.
- **Simpler alternative?** Repeat #192's approach — ask an independent critic subagent to manually attack each keyword by hand, every time any of them is touched. Rejected: this is exactly the "relies on a human/agent remembering to check" failure Sculley's "undeclared consumer" framing warns about; a mechanical test is strictly more durable than a review habit.
- **Survives scale?** At 8 keywords, yes trivially; flagged as a caveat (not a blocker) that if this keyword list grows into the dozens, pairwise-independence assumptions should be revisited — not a concern tonight.
- **Verdict**: candidate (c) survives the attack unchanged; no change to selection.

## Frozen Hypothesis

> Given `evaluateHarnessCandidate()`'s 8 `hardReject` reason keywords in `packages/compile/src/harness-optimizer.ts`, when a new governance test ablates each keyword independently — removing only that keyword's triggering condition from an otherwise-minimal, single-reason `CandidateValidation` fixture and re-evaluating — then every keyword's verdict should flip away from `REJECT` once its own condition is removed (proving it is load-bearing, not shadowed by another already-hardReject reason's substring, the way `'exceeds'` shadowed `'slice regression'` until PR #192); any keyword that fails this ablation is a new, previously undisclosed instance of the exact bug class #192 found and fixed for one keyword, and should be reported as such — without weakening, removing, or altering any of the 10 existing passing tests in `harness-optimizer.test.ts`, and without changing `evaluateHarnessCandidate`'s observable behavior for any input the current suite already exercises.

Frozen before any implementation; not modified after this point. **Not evaluated tonight** — RESEARCH-ONLY mode (STEPS 5–14 skipped by design; 20 open candidate PRs already exceed the review backlog limit). Filed to the implementation backlog via the issue below for a future IMPLEMENT night, per STEP 1.5 rule 3.

## Benchmarks / Evaluation

Not attempted tonight (RESEARCH-ONLY). No fabricated numbers. The concrete baseline/metric/threshold a future IMPLEMENT night needs is specified under PASS 2 (c) above: baseline 10/10 passing tests in `harness-optimizer.test.ts`, candidate = +8 ablation cases, threshold = 0 keywords failing ablation for a clean ACCEPT (a nonzero count is itself a valid, reportable finding).

## Security Review (STEP 15)

No security-sensitive surface touched tonight — no code changed, no credentials, no new tool/MCP authority, no filesystem/network access pattern introduced. The *researched* surface (`evaluateHarnessCandidate`) is itself security-relevant by design (it exists partly to reject patches that `expandsAuthority` or fail `securityFindings`), but tonight's output is research prose + one frozen hypothesis for future implementation, not a code change, so there is nothing here for an independent critic or reward-hack check to clear (STEP 10's promotion gate does not apply — RESEARCH-ONLY produces no candidate to promote).

## Witness

```
report_sha256 : 52758f2a3854e8bda6374899ade2ae751406dae0bb49716ba8f058a18c8c2f5c
session_commit: 71d607bea6608180b8c41980dc5386526d3f1f16
witness       : ef20b13be2bdb435e5a55695caca89c0c98dc3fda4ff3c113a65b3814ace69cb
```

Computed over this file's canonical bytes (everything above this heading,
trailing whitespace collapsed to one newline). Reproduce:

```bash
dream-machine witness verify-report docs/dream-cycle/2026-11-27-evaluation-adapters-report.md --commit 71d607bea6608180b8c41980dc5386526d3f1f16
```

## Next steps (3, concrete)

1. **IMPLEMENT candidate (c)** on a future evaluation-adapters night: add the 8-way keyword-ablation governance test to `packages/compile/src/harness-optimizer.test.ts` (or a new `harness-optimizer-keyword-independence.test.ts`); report however many keywords (0–7, excluding the already-fixed `'slice regression'`) fail ablation as the night's actual finding.
2. **Fix the duplicate `ADR-0003` filename collision** (`ADR-0003-anchored-trace-replay.md` and `ADR-0003-trace-driven-harness-optimization.md` both claim number 0003) — a compiler-parity or developer-experience night's job, not evaluation-adapters; flagged here since it surfaced during STEP 2 evidence-loading.
3. **Re-score candidate (a)** (wiring `evaluateHarnessCandidate` into a real pipeline stage) once Darwin's bounded-evolution loop actually produces `HarnessPatch`-shaped candidates somewhere in this repo's own pipeline — today there is no producer, so picking a call site would be speculative; revisit when/if that changes, and only then build (d) (policy provenance) on top of it.
