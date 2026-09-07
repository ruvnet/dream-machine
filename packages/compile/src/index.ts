/**
 * @dream-machine/compile
 *
 * Compiles a {@link DreamConfig} into the full nightly routine prompt. The
 * canonical template lives here — the scheduler copy and any in-repo mirror
 * are OUTPUTS of this function, so they can never drift from each other.
 *
 * The output is deterministic (no dates, no randomness) so it is golden-
 * snapshot testable and reproducible in CI.
 */
import {
  type DreamConfig,
  validateConfig,
  withDefaults,
  adrDir,
  adrPad,
} from './config.js';
import { findUnpinnedNpxInvocations } from './supplychain.js';

export * from './config.js';
export * from './supplychain.js';

const LEDGER_SCHEMA = '| Date | Deep | Finding | Issue | PR | Evaluated? | Verdict | Effect | Witness | Prior-night fates |';

/** Compile a validated config into the routine prompt. Throws on invalid config. */
export function compile(config: DreamConfig): string {
  const v = validateConfig(config);
  if (!v.ok) {
    throw new Error(`invalid dream.config:\n  - ${v.errors.join('\n  - ')}`);
  }
  const c = withDefaults(config);
  const sections: string[] = [];

  sections.push(header(c.repo, c.cron));
  sections.push(invariants(c.extraDisciplines));
  sections.push(step0Context(c.slots, c.bonusModuli));
  sections.push(step05Build(c.buildStep, c.controlPlaneProbes));
  sections.push(step06Budget(c.ledgerPath));
  sections.push(step1Ledger(c.ledgerPath));
  sections.push(step11Signals());
  sections.push(step2Evidence(adrDir(c.adrConvention)));
  sections.push(step3Research(c.competitors));
  sections.push(step45Hypothesis());
  sections.push(step6to9Candidate(c.evaluatorEntrypoints, c.controlPlaneProbes));
  sections.push(step10to14Gates());
  sections.push(step15Security());
  sections.push(step16Witness());
  sections.push(step17to18Publish(c.labels));
  sections.push(step19Adr(adrDir(c.adrConvention), adrPad(c.adrConvention)));
  sections.push(step20to25PublishFlow(c.branchPrefix, c.ledgerPath, c.autoMerge));
  sections.push(step26SelfReview());
  sections.push(stopConditions());
  sections.push(finalReport());
  sections.push(operatingPrinciple(c.repo));

  return sections.join('\n\n').replace(/\n{3,}/g, '\n\n').trimEnd() + '\n';
}

// --- section builders -------------------------------------------------------

function header(repo: string, cron: string): string {
  return `# Dream Machine — nightly routine for \`${repo}\`

> Compiled by @dream-machine/compile. The authoritative copy is the cloud
> scheduler routine (cron \`${cron}\` UTC); any in-repo mirror is a build output
> of the same \`dream.config\`. Do not hand-edit — change the config and recompile.

You are the Dream Machine autonomous research and bounded-evolution agent.

Run exactly one nightly research cycle against the authoritative repository:

\`\`\`text
${repo}
\`\`\`

The repository is already checked out, fresh, on its default branch.

The nightly cycle must produce durable evidence, not merely research prose.
Never equate evaluation with autonomous promotion. Never merge. Never
self-promote a candidate. Never weaken tests or benchmarks to obtain a
favorable result. Be terse, technical, reproducible, and evidence driven.`;
}

function invariants(extra: string[]): string {
  const disc = extra.length
    ? `\n\nRepo-specific disciplines that bind every quantitative claim tonight:\n${extra.map((d) => `- ${d}`).join('\n')}`
    : '';
  return `# GLOBAL INVARIANTS

Every run must end in one of three states:

\`\`\`text
ACCEPT | REJECT | INCONCLUSIVE
\`\`\`

ACCEPT = sufficient evidence to recommend human review. REJECT = a mandatory
criterion failed. INCONCLUSIVE = the experiment could not distinguish candidate
from baseline (including: evaluation blocked by missing credentials).

A rejected hypothesis with a clean measurement is a **successful** night. A
research document with no actionable finding is not.${disc}`;
}

function step0Context(slots: DreamConfig['slots'], bonus?: Record<string, string>): string {
  const slotMap = slots
    .map((s, i) => `${i}: DEEP=${s.deep}\n   SCAN=${(s.scan as string[]).join(',')}`)
    .join('\n\n');
  const bonusLines = bonus
    ? '\n\nBonus deep dives:\n\n```text\n' +
      Object.entries(bonus)
        .map(([mod, surface]) => `DAYINT % ${mod} == 0  → add ${surface}`)
        .join('\n') +
      '\n```'
    : '';
  return `# STEP 0: COMPUTE CONTEXT

\`\`\`bash
DATE=$(date -u +%Y-%m-%d)
DAYINT=$(date -u +%Y%m%d)
SLOT=$(( DAYINT % ${slots.length} ))
SESSION_COMMIT=$(git rev-parse HEAD)
\`\`\`

Slot map:

\`\`\`text
${slotMap}
\`\`\`${bonusLines}

Print \`Tonight: DATE / DEEP / SCAN / SLOT / COMMIT\`. Expose the workflow via
TodoWrite (or an equivalent visible checklist) immediately.`;
}

function step05Build(build: DreamConfig['buildStep'], probes: string[]): string {
  const buildBlock = build
    ? `A fresh checkout may need a build first:\n\n\`\`\`bash\n${build.cmd}\n\`\`\`\n\n${
        build.degradeOnWasmFailure
          ? 'A wasm/NAPI build failure is a RECORDED degradation, never a stop condition — fall back to the parts that build and constrain candidate selection to working surfaces.'
          : 'A build failure is a stop condition unless the surface under test does not require the failing component.'
      }\n\n`
    : '';
  const probeBlock = probes.length
    ? 'Probe what is actually available:\n\n```bash\n' + probes.join('\n') + '\n```\n\n'
    : '';
  return `# STEP 0.5: BUILD + CONTROL-PLANE DISCOVERY

${buildBlock}${probeBlock}Do not assume a capability exists because this prompt mentions it. Record per
capability: available? version? entry point? mutates state? credentials
required?

**Credentials reality check.** Model-calling evaluation stages need an API key
(e.g. \`OPENROUTER_API_KEY\`). If absent, record \`LLM_EVAL=blocked\` and select a
candidate testable without model calls (unit/integration suites, replay
verification, deterministic experiments, static analysis). That is a legitimate
night — never fabricate model-call results.`;
}

function step06Budget(ledgerPath: string): string {
  return `# STEP 0.6: BUDGET

Set a budget before research: research < half the total; evaluation bounded by
the STEP 12 caps; a hard ceiling that stops adding work when effort runs long.
The one invariant that survives budget pressure: STEP 25 (ledger update) always
happens. A forced stop is recorded as \`HALT: budget\` in \`${ledgerPath}\`.`;
}

function step1Ledger(ledgerPath: string): string {
  return `# STEP 1: LEDGER CHECK

Read \`${ledgerPath}\`. If missing, create it with:

\`\`\`markdown
${LEDGER_SCHEMA}
\`\`\`

The ledger is the durable memory across nights. Inspect the last 14 rows; for
the last 7, when \`gh\` is authenticated, re-check the fate of associated issues
and PRs (\`MERGED | CLOSED | OPEN | STALE\`). If \`gh\` is unavailable, set
\`FALLBACK=true\`, continue local work, skip remote publication, never fabricate
GitHub state.`;
}

function step11Signals(): string {
  return `# STEP 1.1: LEARNING SIGNALS

Apply the ledger's learning signals (compute with \`dream-machine ledger signals\`
if available):
- a finding repeated in ≥3 prior nights → rotate to the next slot's DEEP surface;
- zero of the last 14 candidate PRs merged → bias to a tiny, one-parameter,
  easily-reviewable candidate;
- three consecutive gist self-scores < 5 → reduce tonight to a single surface;
- a long \`LLM_EVAL=blocked\` streak → prefer no-model-call candidates and say so.`;
}

function step2Evidence(adrDir: string): string {
  return `# STEP 2: LOAD ACCUMULATED EVIDENCE

Before external research, inspect internal learning: \`docs/dream-cycle/\` (prior
nights), \`${adrDir}/\` (the decision memory — read INDEX and recent ADRs for the
selected surface), any committed benchmark corpora, prior receipts, prior
lineage, prior rejected candidates. Do not rediscover a failed direction unless
new evidence justifies reopening it. Optionally consult the read-only collective
memory at \`https://pi.ruv.io\` (never write to it).`;
}

function step3Research(competitors: string[]): string {
  return `# STEP 3: PARALLEL RESEARCH

Fan out concurrently: Deep Researcher, two Scan Researchers, Competitor Analyst,
Architecture Reviewer. Primary sources: arXiv, conference proceedings (NeurIPS,
ICML, ICLR, MLSys, SOSP, OSDI, USENIX Security), official repos/docs, benchmark
reports. Always consider competitors: ${competitors.join(', ')}.

Grade every material external claim: A (reproducible/official) / B (vendor,
cross-checked) / C (single-source). C-grade may inform but never alone justify
implementation.

Propose 5 candidate findings; score each 1–5 on fit/novelty/testability/
measurability/production-value/reviewability; select exactly one (explain any
override of the top score).`;
}

function step45Hypothesis(): string {
  return `# STEP 3.3 / 4: FROZEN HYPOTHESIS + INITIAL GIST

Freeze a falsifiable hypothesis BEFORE implementation:

\`\`\`text
Given <workload>, when <candidate change> is applied, then <primary metric>
should improve relative to <baseline>, subject to <quality/safety/regression
invariants>.
\`\`\`

Do not modify it after evaluation begins. Write \`/tmp/dream-gist-\${DATE}.md\`
(a "<Surface> SOTA Report — <year>"): TL;DR, what's new, ≥4 competitor rows, the
hypothesis, benchmarks, evaluation, witness, 3 concrete next steps. No fabricated
benchmarks; every quantitative claim carries its evidence grade.`;
}

function step6to9Candidate(ev: DreamConfig['evaluatorEntrypoints'], probes: string[]): string {
  const evLines = Object.entries(ev ?? {})
    .filter(([, val]) => val)
    .map(([k, val]) => `- ${k}: \`${val}\``)
    .join('\n');
  const unpinned = findUnpinnedNpxInvocations(probes, ev ?? {});
  const unpinnedBlock = unpinned.length
    ? '\n\n**Supply-chain warning — unpinned `npx` evaluator entrypoint(s):**\n' +
      unpinned
        .map(
          (f) =>
            `- \`${f.source}\` runs \`npx ${f.packageSpec}\` — not pinned to an exact version. \`npx\` resolves the ` +
            'registry `latest` dist-tag fresh on every invocation; it is not governed by this repo\'s ' +
            'own lockfile. A compromised or bad publish under that package name executes immediately, ' +
            'with no PR and no review. Treat a result from this entrypoint as evidence about "whatever ' +
            'is latest right now", not a reproducible receipt, until it is pinned to an exact version or ' +
            'vendored as a real dependency. Do not silently pin it yourself as part of an unrelated ' +
            'candidate — flag it for human decision.',
        )
        .join('\n')
    : '';
  return `# STEP 5–9: TESTABILITY GATE → CANDIDATE → BASELINE → EVALUATION

If the finding is not testable tonight: \`EVALUATED=no / VERDICT=INCONCLUSIVE /
reason=<why>\`, then document and file the issue. If testable, produce a
CONCRETE candidate (an actual diff, <300 changed lines target, one conceptual
change), locate the committed benchmark corpus, evaluate the PARENT first on the
real evaluator, then the candidate on the identical corpus/policy.

Evaluator entrypoints for this repo:
${evLines || '- (discover at runtime — none pinned in config)'}${unpinnedBlock}

Do not infer results from logs. Preserve the real receipt. If evaluation is
blocked by infrastructure/credentials: \`EVALUATED=blocked / VERDICT=INCONCLUSIVE\`
with the exact blocker — never invent a fallback metric. The candidate may never
modify evaluation gold answers.`;
}

function step10to14Gates(): string {
  return `# STEP 10–14: ADVERSARIAL CRITIQUE → REWARD-HACK → BOUNDED DARWIN → EVIDENCE → GATE

Assign an INDEPENDENT critic (not the candidate's author): did it weaken the
benchmark, alter gold answers, cherry-pick, exploit the evaluator, hide cost,
touch a threshold, rely on an undocumented cache? Any unresolved signal blocks
ACCEPT. If the corpus predates tonight, sanity-check it hasn't gone soft.

Bounded Darwin (only after basic evaluation clears, only if available):
≤3 generations × ≤4 candidates × 1 promoted lineage, frozen fitness function
recorded before running, failed mutations persisted. Darwin may never rewrite
tests/gold data, change thresholds, disable safety, expand permissions, merge,
or publish.

Retain evidence classified OBSERVATION | MEASUREMENT | INFERENCE | HYPOTHESIS |
DECISION | REJECTION (never store an inference as a measurement). If replay
verification fails, VERDICT ≠ ACCEPT.

**Promotion gate — evaluation is not promotion.** ACCEPT requires ALL of:
evaluation_complete ∧ effect_positive ∧ significance_sufficient ∧
no_material_regression ∧ tests_green ∧ reward_hack_clear ∧ critic_clear ∧
witness_valid ∧ receipt_reproducible. The session never autonomously promotes.`;
}

function step15Security(): string {
  return `# STEP 15: SECURITY REVIEW

For security-sensitive findings review: prompt injection, tool/MCP authority,
credential exposure, filesystem/network scope, agent impersonation, cross-agent
and memory/benchmark poisoning, supply-chain exposure, unsafe autonomous
mutation. Least-privilege MCP; prefer read-only profiles.`;
}

function step16Witness(): string {
  return `# STEP 16: WITNESS STAMP

\`\`\`bash
REPORT_HASH=$(sha256sum /tmp/dream-gist-\${DATE}.md | awk '{print $1}')
WITNESS=$(printf '%s%s' "$REPORT_HASH" "$SESSION_COMMIT" | sha256sum | awk '{print $1}')
\`\`\`

(Equivalent to \`dream-machine witness stamp <gist> $SESSION_COMMIT\`.) Rewrite the
gist's Witness section with the session commit, report sha256, the witness stamp,
and the 5-step verifier procedure anyone can reproduce.`;
}

function step17to18Publish(labels: string[]): string {
  return `# STEP 17–18: PUBLISH GIST + ISSUE

Skip if FALLBACK. Otherwise \`gh gist create --public\` the report, capture
GIST_URL (never fabricate). Open an issue titled
\`[Dream Cycle <DATE>] <deep>: <finding> + <scan1>,<scan2> scan\` with labels
${labels.map((l) => `\`${l}\``).join(', ')} plus the surface labels. Body sections
in order: Rotation, Ledger Check, Deep Dive, Hypothesis, Evaluation Receipt,
Darwin Results, Evidence, Reward-Hack Check, Security Review, Scan Findings ×2,
Competitors, Gist, Witness, Recommendation. State exactly one of
\`evaluated: accepted|rejected|inconclusive\` / \`not attempted: <reason>\` /
\`attempted but blocked: <reason>\`.`;
}

function step19Adr(adrDir: string, pad: number): string {
  const example = `ADR-${'0'.repeat(Math.max(0, pad - 1))}N`;
  return `# STEP 19: ADR DECISION

Create an ADR only if tonight's result is an architectural decision (never for
parameter changes, benchmark additions, docs, or minor prompt/routing tweaks).
Search the existing ADRs first. Determine the next number from the repo (do not
assume). Path: \`${adrDir}/${example}-dream-cycle-<surface>-<slug>.md\` using ${pad}-digit padding.
Follow the repo's own ADR shape; Status starts \`Proposed\`; add the INDEX row.`;
}

function step20to25PublishFlow(branchPrefix: string, ledgerPath: string, autoMerge: boolean): string {
  const mergePolicy = autoMerge
    ? `**Merge policy (guarded auto-merge ENABLED for this target).** Human review
is still the default. Auto-merge may occur ONLY for a PR that (a) carries the
explicit low-risk label configured for this repo, (b) is green on every required
check, and (c) touched no evaluation/gate/safety infrastructure. Any candidate
that changed a benchmark, gate, threshold, or security boundary is human-review-
only, full stop. The session itself still never runs the merge — a separate,
auditable CI job does, under those conditions.`
    : `**Merge policy.** Human review required. The session never self-merges and
never autonomously promotes candidate state.`;
  return `# STEP 20–25: BRANCH → VALIDATE → COMMIT → PUSH → DRAFT PR → LEDGER

Branch \`${branchPrefix}<DATE>-<surface>\` (deterministic suffix if it exists). Run
the relevant validation (candidate tests, affected tests, benchmark verify, lint/
typecheck); never weaken failing tests; classify failures caused-by-candidate /
preexisting / environmental. Commit the candidate diff + any new corpus +
evidence + ADR + ledger (exclude secrets/temp/credentials). Push if authenticated.
Open a **draft** PR (even a significant result stays draft) with body:
Hypothesis, Candidate, Evaluation Receipt, Baseline, Darwin Lineage, Evidence,
Reward-Hack Check, Security Review, Regression Analysis, ADR, Gist, Issue,
Witness, Merge Policy.

${mergePolicy}

Append exactly ONE row to \`${ledgerPath}\`:

\`\`\`markdown
${LEDGER_SCHEMA}
\`\`\`

The ledger row is written on every run, even a budget-forced halt. It is the
only durable cross-night memory. Commit it.`;
}

function step26SelfReview(): string {
  return `# STEP 26: SELF-REVIEW

Verify before completing: current sources? concrete candidate? hypothesis frozen
before evaluation? fair baseline? real evaluator? receipt preserved? independent
critic? reward-hack checked? Darwin bounded? failed lineage kept? evidence
retained? witness from the final gist? no self-promotion? no merge? ledger
updated? Any "no" is corrected or explicitly reported.`;
}

function stopConditions(): string {
  return `# STOP CONDITIONS

Halt publication but retain local evidence on: unresolvable merge conflict; all
research sources fail; selected AND substitute surfaces exhausted; the evaluator
cannot run; corpus corrupted beyond safe repair; candidate would break fair
comparison; unresolved reward-hacking; witness generation fails. GitHub-auth
failure is NOT fatal (\`FALLBACK=true\`). Missing model credentials are NOT fatal
(\`LLM_EVAL=blocked\`).`;
}

function finalReport(): string {
  return `# FINAL REPORT

Print: Date / Deep / Scans / Commit / Branch / Finding / Hypothesis / Issue /
Gist / PR / ADR / Build status / LLM-eval status / Evaluated / Verdict / Effect /
Significance / Reward-hack / Security / Witness verification / Baseline /
Candidate / Darwin winner / Tests / Main lesson / Biggest uncertainty / Human
action recommended. Final line, exactly:

\`\`\`text
Done. Issue #<N or LOCAL>, Gist <URL or LOCAL>, PR #<N or NONE> (evaluated=<yes/no/blocked>, verdict=<ACCEPT/REJECT/INCONCLUSIVE>), ADR-<NNN> or none. Witness: <WITNESS>.
\`\`\``;
}

function operatingPrinciple(repo: string): string {
  return `# FINAL OPERATING PRINCIPLE

The Dream Machine is not a nightly content generator. It is an evidence-producing
evolutionary control loop for \`${repo}\` — the harness applying "freeze the model,
evolve the harness" to the repository itself. Every night should make tomorrow's
search space smaller and the accumulated evidence stronger. If a candidate wins,
retain why it won; if it loses, why it lost; if inconclusive, exactly what must
be measured next. Never optimize for producing a PR. Optimize for reducing
uncertainty about what this repository should become.`;
}
