# SWE Prime trajectory selection experiment

Source: arXiv 2608.27449, submitted 2026 08 27.

Evidence class: originating team report. No Dream Machine reproduction yet.

## Finding

Successful trajectories are not automatically good learning data. SWE Prime reports that selecting only 10 percent of successful software engineering trajectories using process quality, result quality, and representativeness, then masking low value or risky semantic segments from the training loss, outperformed training on the full resolved set. Reported relative gains reach 12.2 percent on SWE Bench Pro and 24.2 percent on SWE Bench Verified.

## RuV experiment

Do not add a new training subsystem. Add a selection gate in front of existing Dream Machine and MetaHarness learning paths.

Rank completed trajectories using evidence already available in receipts:

1. task outcome quality
2. process efficiency
3. unnecessary or repeated actions
4. security or policy risk
5. evaluator integrity
6. novelty and representativeness relative to accepted history
7. causal contribution of segments where anchored replay evidence exists

Keep full trajectories for provenance. Only selected trajectories and selected semantic segments may contribute to skill distillation, memory mutation, or supervised learning.

## Benchmark

Compare three conditions with the same base model, tasks, budget, seeds, and evaluator:

A. all successful trajectories

B. top 10 percent trajectories by result score only

C. multi factor trajectory selection plus segment masking

Report held out task success, tokens, training examples, training time, GPU time, regression slices, security failures, and variance.

## Acceptance gate

Graduate only if condition C beats the stronger of A and B on held out tasks by at least 5 absolute percentage points or preserves task success while reducing training tokens or GPU time by at least 50 percent. No selected segment may contain a known policy violation, evaluator mutation, or authority expansion.

A negative result is valuable. If result only selection matches the multi factor gate, reject the extra complexity.
