# Compiler-Parity & UI-Management-Console SOTA Report — 2026

## TL;DR

Tonight's rotation (slot 0, `DAYINT 20261125 % 5 = 0`): `DEEP=compiler-parity`,
`SCAN=config-schema,golden-snapshots`. Bonus (`20261125 % 25 = 0`):
`+ui-management-console`. (`% 75 = 25`, not 0 — `self-hosting-review` does
not apply tonight.)

**MODE=RESEARCH-ONLY** (STEP 1.5). 19 open `dream/*` candidate PRs tonight
(well over `implementationTrack.reviewBacklogLimit=6`), `main` static at
`71d607bea6608180b8c41980dc5386526d3f1f16` since 2026-11-10 (#209). The three
drafts otherwise eligible for CONSOLIDATE — #161 (2026-11-10), #189
(2026-11-18), #192 (2026-11-23) — each already carry a
`<!-- dream-consolidate: 71d607b... -->` marker for *tonight's exact SHA* from
a prior night, so none is eligible. Per STEP 1.5 rule 2, this runs STEPS 2–4
and 15–18 only: full deep research, gist, issue. No PR, no candidate diff,
no ledger-row Evaluated=yes tonight.

After a close read of `packages/compile/src/{config.ts,index.ts,v2.ts}`
(the compiler-parity surface itself has been mined ~20 times already — see
SOTA delta below) with the specific goal of finding one *new*, *unclaimed*
defect: none found. `autoMerge`'s unvalidated-boolean gap (the one
remaining obviously-missing per-field check) is already claimed by open PR
#184 (issue #183). This itself is evidence for tonight's selected finding:
the field-by-field, hand-imagined-input validation strategy that has
produced ~10 ACCEPT rows over 3 months is visibly running out of new
instances to hand-find, which is the actual research finding below.

## What's new (SOTA delta vs. the last compiler-parity reports)

The 2026-09-30 report (`docs/dream-cycle/2026-09-30-compiler-parity-report.md`)
fixed `buildStep.cmd`/`degradeOnWasmFailure`; the 2026-10-10 report fixed the
backtick/newline fence-break class across 10 fields, in 3 independent-critic
rounds. Both explicitly named their own fix as "the Nth instance of the same
defect class" and both left "is there a *systematic* way to close this class,
not just the next instance" as an implicit open question — never stated as
its own candidate, because both nights were IMPLEMENT nights building one
instance at a time. Searched `docs/dream-cycle/` for `fast-check`,
`quickcheck`, `property-based`, `fuzz`: zero hits. Searched open issues/PRs
for the same terms: zero hits. **This generalization has never been
proposed on this repo.** That is tonight's SOTA delta.

## Competitors

| System | What it does re: self-governing / self-modifying instructions | Relevance |
|---|---|---|
| **Sakana AI Scientist / Darwin Gödel Machine** | DGM is a coding agent that rewrites its *own* code to improve itself, raising its SWE-bench score from 20%→50% across generations (ICLR 2026, revised March 2026). Its stated safety posture is sandboxed execution, human oversight, and **traceability of every self-modification** — directly analogous to this repo's witness/ledger chain, but DGM mutates its own source directly; it has no separate "compiled instruction prompt" layer, so the fence-escape/injection class this repo keeps finding (a config value corrupting the *text* a future run is told to follow) has no DGM analogue — its risk surface is code mutation, not prompt-template mutation. | Evidence grade **A** (arxiv.org/abs/2505.22954, ICLR 2026) |
| **OpenHands (+ CodeAct v2.1)** | Scored ~51% on the same SWE-bench slice (reported as the strongest open baseline DGM compares against). Config-driven agent definitions (YAML/JSON "microagents") are interpolated into prompts at runtime, structurally the same class of risk this repo's `compile()` has — but OpenHands' own public threat modeling of that specific path is not documented in what this search surfaced. | Grade **B** (secondary report on A-grade benchmark; microagent-injection claim is this session's own structural inference, not sourced) |
| **SWE-agent / AutoGPT lineage** | Benchmarked as baselines in the above literature; neither publishes a template-injection-specific defense for their own config/prompt-assembly layer in anything this search found. A "none" row for template-injection hardening specifically — plausible explanation: their config surfaces are smaller (single repo, no multi-slot rotation/bonus-modulus DSL), so the attack surface this repo's `compile()` has (a rich, many-field DSL rendered into markdown that a *future autonomous run* is told to follow exactly) is largely unique to Dream Machine's own design, not absent from competitors by solved-ness. | Grade **C** (absence-of-evidence, not evidence-of-absence) |
| **DSPy/GEPA** | GEPA (reflective prompt evolution) optimizes *prompts themselves* as the evolvable artifact, with its own evaluation/selection loop — closest published analogue to "evolve the harness, not just the code," which is this repo's own `ADR-0011` framing. GEPA's optimization targets prompt *content* for task performance, not safety-of-compilation (i.e., it assumes the renderer is already trusted); it does not address adversarial/malformed inputs to a prompt *compiler*. | Grade **B** (established technique, widely cross-referenced, but not independently re-read in full this session) |

## Candidates (5 proposed, scored 1–5 fit/novelty/testability/measurability/production-value/reviewability)

| # | Candidate | Fit | Novelty | Testability | Measurability | Prod-value | Reviewability | Total |
|---|---|---|---|---|---|---|---|---|
| **1 (selected)** | Property-based fuzz-invariant harness for `compile()` (import `fast-check`/PBT from the compiler-testing literature) | 5 | 4 | 5 | 5 | 4 | 4 | **27** |
| 2 | Adversarial red-team harness for `compile()`'s markdown boundaries, modeled on QueryIPI's "poisoned tool description" methodology (spoofed STEP headings / fake verdict lines, not just fence-breaks) | 4 | 4 | 3 | 3 | 3 | 3 | 20 |
| 3 | ui-management-console: static, zero-server read-only HTML dashboard (`dream-machine dashboard build` → `docs/dream-cycle/dashboard/index.html` from `LEDGER.md` + PR state), modeled on provenance-tagged agent-PR review-dashboard patterns | 3 | 3 | 4 | 3 | 3 | 4 | 20 |
| 4 | AgentGuard-style execution-guardrail: learn a "normal nightly-trajectory" profile from the 58 ledger rows and flag anomalous runs | 2 | 4 | 2 | 2 | 3 | 2 | 15 |
| 5 | `evaluatorEntrypoints` key-enum validation (reject unknown keys, not just fence-breaks) | 3 | 1 | 4 | 3 | 2 | 4 | 17 (deprioritized: collides with open, unmerged PR #152's declared scope — duplicate-direction risk, not re-proposed) |

Two candidates (#1, #2) import an external technique rather than fix an
internal defect, meeting the `researchDepth.externalCandidates` floor.
Candidate #1 selected: highest score, zero collision with any of the 19 open
PRs (checked each title/surface against "fuzz", "property", "fast-check" —
none), testable with zero model calls (works under `LLM_EVAL=blocked`),
and directly answers the pattern surfaced in "What's new" above — the
field-by-field strategy is visibly running out of new instances.

## Selected finding — frozen hypothesis

> Given `dream.config.json`'s full field surface (every string/string[]/
> object-shaped field `compile()` interpolates into the nightly prompt), when
> a property-based fuzz harness (`fast-check`) generates randomized
> `validateConfig`-passing configs and asserts `compile()`'s output never (a)
> closes or reopens a code fence it did not itself open, (b) contains an
> unescaped markdown heading or backtick-span break outside a field's own
> legitimate content, and (c) fails to round-trip through a markdown parser
> with exactly the section/heading structure the compiler's own section list
> implies, then the harness should find zero surviving counterexamples
> against `validateConfig` as it stands on `main` today, AND should
> deterministically rediscover each of the ~7 already-fixed historical
> fence/shape bugs as a failing property when run against that bug's
> pre-fix parent commit — relative to today's baseline (the hand-written
> `index.test.ts`/`config.ts` unit-test suite, which only covers inputs a
> human already imagined) — subject to: no change to `validateConfig`'s
> existing accept/reject behavior for any currently-tested input, no
> weakening of any existing test, and every discovered counterexample
> committed as a reproducible, seeded regression case (not run ephemerally
> and discarded).

Not modified after this point.

## Benchmarks / Evidence (evidence-graded; nothing fabricated)

| Claim | Value | Grade | Source |
|---|---|---|---|
| Distinct fence/shape-validation bugs hand-found and fixed on this exact compiler-parity surface since 2026-08-13 | ≥7 (adrConvention #29/#79; blank slot fields #105; `string[]` typing #111; ledgerPath/branchPrefix empty-string #127; buildStep.cmd+degradeOnWasmFailure #143; fence-break class across 10 fields #165; autoMerge boolean — open, unmerged, #184) | **A** — this session's own read of `docs/dream-cycle/LEDGER.md` + each PR body, directly reproducible by re-reading the same files | internal |
| DGM self-rewrite raises SWE-bench from 20%→50%; OpenHands+CodeAct v2.1 baseline ~51% | reported | **A** (primary paper) / **B** (51% figure via secondary summary, not independently re-read from the PDF table) | arxiv.org/abs/2505.22954 (ICLR 2026); the-decoder.com summary |
| QueryIPI: poisoned tool descriptions achieve up to 87% attack success on coding agents, beating best baseline (50%) | reported | **B** (summarized from the paper by search, not independently re-read) | arxiv.org/abs/2510.23675 |
| SoK of agentic coding-assistant attacks: 42 techniques catalogued, 30+ disclosed CVEs; conclusion that ad-hoc filtering is insufficient, architectural mitigation needed | reported | **B** | arxiv.org/html/2601.17548 |
| Propilot (property-skeleton PBT for AI/tensor compilers): ~49% redundancy reduction vs. direct LLM-based PBT generation | reported | **B** (secondary summary) | arxiv.org/pdf/2606.06747 |
| A fuzzing framework found 266 previously-unknown bugs across 4 widely-used AI compilers | reported | **B** | ICSE 2026 companion paper (via search summary) |
| Whether `fast-check`-based PBT actually finds a *new, currently-unknown* bug in this repo's `compile()` | **not yet measured** | — | would require building candidate #1 (an IMPLEMENT night) |

No benchmark for tonight's own candidate exists yet — correctly: RESEARCH-ONLY
builds nothing. `EVALUATED=no`, `VERDICT=INCONCLUSIVE` records this
explicitly in the issue and ledger (not a fabricated ACCEPT/REJECT).

## PASS 2 — deepen (top 2: #1 selected, #2 runner-up)

**#1 (fast-check PBT harness).** Algorithm: generate an `Arbitrary<Partial<DreamConfig>>` biased toward the known-dangerous value classes (empty string, lone backtick, bare `\n`/`\r`, a line that is itself a fence marker, long strings, non-ASCII/astral code points, deeply nested objects for `adrConvention`/`researchDepth`/etc.), filter through `validateConfig` (only test inputs that pass, since `compile()` throws otherwise by design), then assert the 3 structural invariants above against `compile()`'s actual output using a markdown parser's AST (not a regex) as the oracle. Complexity: one new file (`packages/compile/src/fuzz.test.ts`), one new devDependency. Failure modes: a generator that never actually reaches the dangerous value classes would pass vacuously — mitigated by requiring it to rediscover every historical bug first (see PASS 3). Production constraint: must run in CI within the existing `npm test` budget — bound `numRuns` and commit a fixed seed for determinism, per `fast-check`'s own `fc.assert(..., { seed, numRuns })` API.

**#2 (QueryIPI-style red-team harness, runner-up).** Algorithm: construct config values that mimic *legitimate-looking but adversarial* compiled content (e.g. a `slots[].deep` value engineered to read like a fresh `# STEP` heading once rendered, exploiting that `checkNoFenceBreak` forbids raw newlines/backticks but not unicode line-separator look-alikes, zero-width characters, or markdown that is syntactically valid without a literal newline — e.g. consecutive non-breaking content that a renderer might still fold). Harder to make falsifiable/measurable tonight (no existing oracle for "looks like a fabricated STEP heading" short of also building the markdown-AST checker from #1), which is why #1 is selected first — #2's methodology is a natural *input generator* to plug into #1's harness later, not a competing implementation.

## PASS 3 — attack the selected candidate

- **Already solved here?** No — grepped `package.json`/`package-lock.json`/source tree for `fast-check`, `quickcheck`, `jsverify`, `fuzz`: zero matches. All existing coverage is hand-enumerated unit tests.
- **Falsifiable?** Yes — the harness either finds a counterexample on `main` or it doesn't, and replay against each historical bug's parent commit is a binary, reproducible oracle.
- **Gameable?** Yes, in one specific way: a generator that only produces values already rejected pre-`validateConfig`, or that never reaches the backtick/newline/fence-line value classes, would report "0 counterexamples" vacuously, looking like a clean ACCEPT with no real coverage. **Mitigation, made part of the frozen hypothesis itself:** the harness is required to *first* reproduce every one of the ~7 historical bugs as a failing property against that bug's own pre-fix commit — a harness that can't rediscover known bugs is rejected outright, before it's trusted to look for new ones. This is the harness's own reward-hack check, built into its acceptance criteria rather than left to a separate critic pass.
- **Leaks evaluation data?** No — net-new test infrastructure; touches no gold data, no threshold, no existing assertion.
- **A simpler alternative?** The status quo itself: keep hand-adding one field-specific check whenever a new instance is noticed. Rejected as the *actual status quo* — it has been running for ~20 nights, mostly on this exact surface, and candidate #1 directly responds to the pattern that strategy is now surfacing diminishing unclaimed instances (tonight's own close read found none). PBT does not replace human judgment about what's dangerous; it mechanizes checking a fixed set of invariants across inputs no one individually imagined, which is a strictly larger claim for comparable future effort.
- **Survives scale / adversarial input?** Partially answerable without building it — flagged explicitly as the first thing an IMPLEMENT night must measure (generated-case count, shrinking quality, CI runtime budget), not assumed.

Survives the attack. Selected.

## Security Review (STEP 15)

This finding is itself about a security-relevant surface: this self-hosting
repo's `compile()` output is the literal, unreviewed instruction set a
future autonomous session (this same routine, tomorrow night) is told to
"follow exactly." The historical bug class here is template/markdown
injection into an agent's own control channel — squarely the indirect-
prompt-injection risk class documented in the QueryIPI and SoK sources
above, just self-inflicted (bad config) rather than externally adversarial
(a hostile tool description). No new surface opened tonight — no code
changed. Recommendation for whoever implements candidate #1: run the new
fuzz harness itself with least privilege (pure function in, string out, no
network/exec), consistent with this repo's existing `config.ts`
validation code, which already has zero I/O surface.

## Scan Findings

- **config-schema**: confirmed (see "What's new") that the one remaining
  unguarded top-level field (`autoMerge`'s boolean type) is already claimed
  by open PR #184/issue #183 — not re-filed. No other unguarded field found
  in `config.ts`'s `validateConfig`/`validateV2` after a full re-read
  tonight.
- **golden-snapshots**: `packages/compile/src/targets.test.ts` and the
  `docs/dream-cycle/compiled/*.md` snapshots are unaffected by a
  RESEARCH-ONLY night (no code changed); spot-checked that
  `ruvnet-dream-machine.md`'s snapshot still matches a fresh
  `node packages/cli/dist/bin.js compile dream.config.json` byte-for-byte
  tonight (same command run at STEP B of this session, output unchanged
  from the build at session start).

## ui-management-console (bonus surface)

Researched (candidate #3 above): this repo has no browser/web UI today,
only `packages/cli/src/tui.ts` (a dependency-free ANSI terminal dashboard
reading the ledger). A minimal, read-only static-HTML build
(`LEDGER.md` + open-PR state → one `index.html`, no server, no new
runtime dependency, in keeping with this repo's zero-infrastructure ethos)
is a coherent, scoped, testable candidate, informed by the human-in-the-loop
/ agent-PR-review-dashboard literature surveyed above (provenance tags,
review-outcome visibility, "review debt" framing). **Not selected tonight**:
with 19 open PRs already 3× over `implementationTrack.reviewBacklogLimit`,
building more visibility *surface* before anyone (human or this routine's
own CONSOLIDATE mode) clears the existing backlog does not reduce
uncertainty about what the review backlog actually needs — it is filed to
the backlog as a candidate for a future night the `bonusModuli` rotation
selects again, not implemented ahead of the compiler-parity candidate.

## Recommendation / Next Steps (for an IMPLEMENT night that picks this backlog item up)

1. Add `fast-check` as a devDependency; write `packages/compile/src/fuzz.test.ts` with an `Arbitrary<Partial<DreamConfig>>` generator biased toward the known-dangerous value classes (empty/whitespace strings, lone backticks, bare `\n`/`\r`, fence-marker lines, long/unicode/astral strings), filtered through `validateConfig`, asserting `compile()`'s output against a markdown-AST oracle (e.g. `mdast-util-from-markdown`) for fence-balance and expected heading structure.
2. Before adding any new assertion, run the harness against each of the ~7 historical pre-fix parent commits (git history for #105, #111, #127, #143, #165's component fixes, #29/#79) and confirm it independently rediscovers each bug — required by this finding's own reward-hack mitigation (PASS 3) before it can be trusted on new input.
3. Wire `npm run test:fuzz` into `test:governance` (or a dedicated CI job) with a bounded, committed seed/`numRuns` for determinism; any discovered-but-unfixed counterexample gets committed as a disclosed `.skip`+comment+filed-issue, following this repo's own precedent (PR #139/#157's disclosure pattern) rather than silently dropped.

## Witness

```
report_sha256 : d7ee9b52bb9db11cff1c1480a3d24569762de30cb76d41911c24233bd74e48f5
session_commit: 71d607bea6608180b8c41980dc5386526d3f1f16
witness       : 3a3c24fb16c1e4721e1c58c0288d62bea9c8919eeb82fdc7a60bdf570652aaf7
```

Computed over this file's canonical bytes (everything above this heading,
trailing whitespace collapsed to one newline) — reproducible from the
committed file with no unavailable intermediate bytes. Verify:

```bash
dream-machine witness verify-report docs/dream-cycle/2026-11-25-compiler-parity-report.md --commit 71d607bea6608180b8c41980dc5386526d3f1f16
```

## Sources

- Sakana AI, "The Darwin Gödel Machine: AI that improves itself by rewriting its own code" / arXiv 2505.22954 (ICLR 2026, rev. March 2026) — https://sakana.ai/dgm/ , https://arxiv.org/abs/2505.22954 — grade A
- "QueryIPI: Query-agnostic Indirect Prompt Injection on Coding Agents," arXiv 2510.23675 (Oct 2025, rev. Jan 2026) — https://arxiv.org/abs/2510.23675 — grade A (paper) / B (87% figure, via search summary)
- "Systematization of Knowledge: Attacks on Agentic Coding Assistants," arXiv 2601.17548 (Jan 2026) — https://arxiv.org/html/2601.17548 — grade B
- "Tensor Algebraic Property Skeletons: Amplifying Property-Based Testing for AI Compilers" (Propilot), arXiv 2606.06747 (June 2026) — https://arxiv.org/pdf/2606.06747 — grade B
- "A Survey of Modern Compiler Fuzzing," arXiv 2306.06884 — https://ar5iv.labs.arxiv.org/html/2306.06884 — grade B
- "Mut4All: Fuzzing Compilers via LLM-Synthesized Mutators Learned from Bug Reports," arXiv 2507.19275 — https://arxiv.org/html/2507.19275v2 — grade B
- "AgentGuard: Learning Execution Guardrails from Anomalous Coding-Agent Trajectories," arXiv 2609.16287 (Sept 2026) — https://arxiv.org/pdf/2609.16287 — grade B
- OWASP Top 10 for LLM Applications 2025 (via HackerOne/Barracuda summaries) — https://www.hackerone.com/ai/owasp-top-10-llms-2025 — grade B
- GitHub Blog, "Agent pull requests are everywhere — here's how to review them" — https://github.blog/ai-and-ml/github-copilot/agent-pull-requests-are-everywhere-heres-how-to-review-them/ — grade B (official vendor blog)
- AWS DevOps & Developer Productivity Blog, "Building a gated review pipeline for AI coding agents on AWS" — https://aws.amazon.com/blogs/devops/building-a-gated-review-pipeline-for-ai-coding-agents-on-aws/ — grade B
- Augment Code, "Optimizing the PR-to-merge loop" (Review Dashboard pattern) — https://augmentcode.com/blog/optimizing-pr-to-merge-loop — grade C (vendor, single-source for this specific claim)
