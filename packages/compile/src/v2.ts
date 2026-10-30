/**
 * Dream Cycle v2 section builders: deep SOTA research, research/implement/
 * consolidate mode selection, periodic routine self-review, and ready-on-accept
 * PRs. Every builder here is only reached when its config field is present, so
 * a v1 config compiles byte-identically (see the golden snapshots).
 *
 * None of these sections may relax a v1 invariant. They add obligations
 * (more sources, an attack pass, a forecast to score) and move work between
 * modes; merge authority, the promotion gate and the critic are untouched.
 */
import type { ImplementationTrack, ResearchDepth, SelfReview } from './config.js';

/** The surface name a self-review night runs under. */
export const SELF_REVIEW_SURFACE = 'routine-self-review';

/** Surfaces the self-review night may never change (ADR-0103 §2.2 analogue for the routine). */
export const ROUTINE_CONSTITUTION = [
  'GLOBAL INVARIANTS and the three-verdict rule',
  'the promotion gate and "evaluation is not promotion"',
  'the merge policy, autoMerge, prMode and the ready-for-review predicate (including self-review PRs staying draft)',
  'the CONSOLIDATE limits: never merge, never close, never force-push',
  'the independent critic and reward-hack checks',
  'evaluator entrypoints, corpora, gold answers and thresholds',
  'witness computation, ledger schema, and the rule that a ledger row is always written',
  'implementationTrack.reviewBacklogLimit and selfReview.everyDays',
  'researchDepth floors may be raised, never lowered',
  'config validation (packages/compile/src/config.ts), the v1 golden snapshots and packages/compile/src/v2.test.ts',
  'this constitution list itself',
] as const;

export function v2Budget(ledgerPath: string): string {
  return `# STEP 0.6: BUDGET

Research is **protected**: a full STEP 3 (all passes, every role, the source
floors) is not the thing to shrink when the night runs long. It is the cheapest
phase and the one the operator judges the night by. Evaluation is bounded by the
STEP 12 caps. If effort runs long, cut from the END of the pipeline first
(fewer Darwin generations, a smaller corpus, a lighter adversarial pass). If
research itself must be shortened, say so explicitly in the gist and issue;
never ship a thinner research section that looks the same as a thorough one.
The one invariant that survives budget pressure: STEP 25 (ledger update) always
happens. A forced stop is recorded as \`HALT: budget\` in \`${ledgerPath}\`.`;
}

/** The marker a CONSOLIDATE night leaves so the same PR is not re-picked at the same base. */
export const CONSOLIDATE_MARKER = 'dream-consolidate';

export function v2ModeSelection(track: ImplementationTrack, branchPrefix: string): string {
  return `# STEP 1.5: MODE SELECTION — CONSOLIDATE, RESEARCH-ONLY, IMPLEMENT OR RESEARCH

A ledger read from the default branch is survivorship-biased: a night's row
lands only when its PR merges, so unreviewed drafts are invisible to it. Measure
the real pipeline first (skip the live calls in FALLBACK and use RESEARCH):

\`\`\`bash
gh pr list --state open --search 'head:${branchPrefix}' --json number,isDraft,createdAt,headRefName,title
dream-machine ledger outcomes --merged "<merged PR numbers>" --closed "<closed-unmerged>" --open "<open PR numbers>" --open-count <open candidate count>
dream-machine ledger backlog  --merged "<merged PR numbers>" --closed "<closed-unmerged>" --open "<open PR numbers>"
\`\`\`

If the \`dream-machine\` CLI is not installed in this checkout, compute the
same numbers by hand from \`gh\` and the ledger: the open candidate count, and
merged / (merged + closed-unmerged + open) over candidate PRs. Never estimate.

Pick exactly one MODE, in this order:

1. **CONSOLIDATE** when open candidate PRs ≥ ${track.reviewBacklogLimit} and at least
   one is *eligible*: still a draft, verdict ACCEPT in the PR's own Evaluation
   Receipt (not \`main\`'s ledger, which cannot see it), not a
   \`${SELF_REVIEW_SURFACE}\` PR, and carrying no
   \`<!-- ${CONSOLIDATE_MARKER}: <default-branch SHA> -->\` comment for the
   current default-branch SHA posted by this routine's own account (ignore
   markers from anyone else). Open no new candidate. Take the oldest eligible
   PR. Merge the default branch into it (merge commit; never rebase, never
   force-push), re-run the real evaluator on the exact new head, run a fresh
   independent critic and reward-hack check on the new diff, and refresh its
   Evaluation Receipt and Witness. Mark it ready for review only if all three
   hold: ACCEPT still holds, every required check on the new head is green, and
   the critic is clear. Otherwise say exactly why in a PR comment and leave it
   draft. Either way, post one comment carrying the marker with tonight's
   default-branch SHA, so the next night moves on. Never close and never merge.
   Skip STEPS 2–9 and 17–24 (no new research, candidate or PR); run 10–16 on the
   refreshed PR, then STEP 25.
2. **RESEARCH-ONLY** when open candidate PRs ≥ ${track.reviewBacklogLimit} and none
   is eligible. The review queue is full and every draft is already current, so
   opening anything else only adds to it. Run STEPS 2–4 and 15–18 (full deep
   research, gist and issue), open no PR, and record the finding with
   \`evaluated=no\` so it enters the implementation backlog.
3. **IMPLEMENT** when \`ledger backlog\` is non-empty: tonight's candidate is the
   oldest backlog finding. STEP 3 becomes a SOTA refresh of that finding: confirm
   the technique is still current against at least 3 primary sources, then
   freeze its hypothesis and build it. Still exactly one candidate.
4. **RESEARCH** otherwise: the full pipeline.

Print \`MODE=<CONSOLIDATE|RESEARCH-ONLY|IMPLEMENT|RESEARCH>\` with the measured
open count, \`pipelineMergeRate\` and backlog size. Prefix the ledger Finding
with \`[consolidate #N]\`, \`[research-only]\` or \`[implement <date>]\` when not
RESEARCH, and report MODE in the FINAL REPORT. The STEP 25 ledger row is always
written: a CONSOLIDATE night commits it on the refreshed PR's branch (it reaches
the default branch only if that PR merges, so also state it in the issue); a
RESEARCH-ONLY night commits it on a \`${branchPrefix}<DATE>-ledger\` branch and
reports the branch name.`;
}

export function v2SelfReview(sr: SelfReview, ledgerPath: string): string {
  const constitution = ROUTINE_CONSTITUTION.map((c) => `- ${c}`).join('\n');
  const external = sr.configSource
    ? `\n\nThis routine's config lives outside this checkout, at \`${sr.configSource}\`.
Do not try to edit it from here. Deliver the candidate as a proposed config diff
in \`docs/dream-cycle/self-review/<DATE>.md\` (current value, proposed value,
cluster it targets, frozen forecast) on a draft PR in this repository, and say
in the PR that a human must apply it to \`${sr.configSource}\` and recompile.`
    : '';
  return `# STEP 1.6: ROUTINE SELF-REVIEW NIGHT

When \`EPOCHDAY % ${sr.everyDays} == 0\` (\`EPOCHDAY=$(( $(date -u +%s) / 86400 ))\`),
tonight's DEEP surface is
\`${SELF_REVIEW_SURFACE}\` regardless of slot, and it takes precedence over
STEP 1.5's MODE: it is the only night allowed to open a PR while the review queue
is at or above its limit, at most once per ${sr.everyDays} days. The candidate is
a change to this routine (its \`dream.config\` or the compile template), not to
product code.

1. **Score the last forecast first.** Find the previous \`${SELF_REVIEW_SURFACE}\`
   row in \`${ledgerPath}\`; its Effect column holds a frozen forecast. Measure
   it now and record HIT or MISS with the numbers. A missed forecast is evidence
   against that change, and a candidate to revert.
2. **Measure.** \`ledger outcomes\` with live fates and \`--open-count\`; plus,
   for every REJECT, INCONCLUSIVE, closed-unmerged or stale (> 14 days) candidate
   since the last self-review, its stated cause from the issue, PR and critic.
3. **Cluster.** Classify each cause as planning | tool | memory | verification |
   recovery | resource | security | unknown (the taxonomy of
   \`clusterFailureTraces\`). Rank clusters by count.
4. **Candidate.** Exactly one change aimed at the largest cluster, with a
   mechanism you can state in one sentence. Prefer changing a number, a mode
   threshold or a research floor over adding prose.
5. **Forecast.** Freeze before committing: one metric (\`pipelineMergeRate\`,
   review backlog size, research-only nights, REJECT share, or the target
   cluster's count), its current value, the predicted value, and the horizon in
   nights. Write it in the ledger Effect column so the next self-review can
   score it.
6. **Evaluate.** Recompile; update only the self-hosted golden snapshot,
   deliberately, explaining each diff hunk; all tests green.

The routine constitution cannot be changed by a self-review night. A candidate
that touches any of these is REJECT:

${constitution}

A self-review PR always stays human-review-only, whatever \`prMode\` says.${external}`;
}

export function v2Research(depth: ResearchDepth, competitors: string[]): string {
  return `# STEP 3: DEEP SOTA RESEARCH (protected)

Fan out concurrently: Deep Researcher, two Scan Researchers, Competitor Analyst,
Architecture Reviewer. Run three passes before any implementation:

**PASS 1, DISCOVER.** Map the current state of the art for tonight's surface.
Cite at least ${depth.minPrimarySources} distinct primary sources (arXiv,
proceedings such as NeurIPS, ICML, ICLR, MLSys, SOSP, OSDI, USENIX Security;
official repos, docs and benchmark reports). At least ${depth.minRecentSources}
must be dated within 12 months of DATE. Record every source as title / venue /
date / URL / grade. Falling short of a floor is reported, not hidden.

**SOTA delta.** Diff against the most recent report on this surface in
\`docs/dream-cycle/\`: what is new since then. If nothing changed after a genuine
search, say "searched <sources>; no material change since <date>".

**Competitors.** Always consider ${competitors.join(', ')}, and look past that
list when tonight's surface has a sharper comparison. Each row states what they
do; a "none" row must say WHY (open gap / solved-but-unpublished / deliberately
avoided for a stated reason).

**Candidates.** Propose 5; score each 1–5 on fit/novelty/testability/
measurability/production-value/reviewability. At least ${depth.externalCandidates}
must import a technique from an external primary source rather than fix an
internal defect. If the selected one is internal-only, explain why each external
candidate lost.

**PASS 2, DEEPEN.** For the top 2 candidates extract algorithm, complexity,
reported numbers with their methodology, failure modes and production
constraints. Define baseline, metric and threshold.

**PASS 3, ATTACK.** An independent critic tries to kill the selected candidate:
already solved here? falsifiable? gameable? leaks evaluation data? a simpler
alternative? survives scale and adversarial input? Only a survivor proceeds;
record the attack and its answers.

Grade every material external claim: A (reproducible/official) / B (vendor,
cross-checked) / C (single-source). C-grade may inform but never alone justify
implementation. Select exactly one candidate (explain any override of the top
score).`;
}

export function v2DraftLine(): string {
  return `Open the PR as a **draft**. Only when VERDICT=ACCEPT, every required check on
the exact pushed head is green, and the independent critic is clear, mark it
ready for review (\`gh pr ready\`) so it enters the human review queue. Every
other verdict, and every \`${SELF_REVIEW_SURFACE}\` PR, stays draft. Ready for
review is not approval; the session never merges. Body:`;
}

export function v2SlotNote(sr: SelfReview | undefined): string {
  // Days since the Unix epoch, not DAYINT: YYYYMMDD jumps by 70 from Oct 31 to
  // Nov 1 (and by 8870 at year end), so `DAYINT % 7` can fire on consecutive
  // days and then skip far longer than a week. EPOCHDAY advances by exactly one.
  return sr
    ? `\n\nSelf-review: \`EPOCHDAY=$(( $(date -u +%s) / 86400 ))\`; when \`EPOCHDAY % ${sr.everyDays} == 0\` → DEEP=${SELF_REVIEW_SURFACE} (overrides the slot; see STEP 1.6).`
    : '';
}

export function v2ScheduleContract(branchPrefix: string): string {
  return `# SCHEDULE CONTRACT

From ruvnet/core-memory (AGENTS.md rule 5; issue #187). It binds every step below.

1. **Receipts.** Before each external side effect (push, PR, PR comment, label,
   issue, gist), append an intent line to \`/tmp/schedule-receipts.jsonl\`:
   \`{"ts","kind":"intent","action","target","inputs_sha256"}\`. After it, append
   \`{"ts","kind":"result","action","target","outcome":"ok|failed|unknown","ref"}\`.
   An \`unknown\` outcome is checked on GitHub before any retry; never repeat a
   side effect that may already have happened. Commit the log beside the night's
   evidence as \`docs/dream-cycle/receipts/<DATE>.jsonl\` and include it in the
   FINAL REPORT.
2. **Duplicate firing.** If origin already has a \`${branchPrefix}<DATE>-*\`
   branch from an earlier run today, make no remote side effects and end with
   \`SKIP: already ran <DATE>\`.
3. **Pinned tooling.** Run external packages only at the exact versions named
   in this prompt; never \`@latest\` or a bare package name. List every external
   tool and version actually used in the FINAL REPORT.`;
}
