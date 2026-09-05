# ADR-0103: Govern self-learning, self-optimization, and self-evolution as separate authority levels

- **Status**: Proposed
- **Date**: 2026-09-04
- **Related**: ADR-0001, ADR-0100, ADR-0104, open PRs #30, #35, #42, #52, #71, and #74
- **Deciders**: ruv
- **Tags**: autogenous, contrastive-learning, evolution, metaharness, latentmesh, promotion, rollback, safety

## 1. Context

Dream Machine already establishes that evaluation is not promotion and that an
autonomous cycle never merges. The edge program extends that rule to a system
which observes intimate signals and may eventually request a physical cue.
Vague claims of a system that is "self-learning, self-evolving, and
self-optimizing" are unsafe unless each term names a different state transition,
authority, evaluator, and rollback path.

The current repository does not contain an Autogenous adapter, a bedside policy
runtime, a causal experiment service, a physical safety controller, or a real
RuVector-backed memory. Autogenous describes a governed evolution contract but
also labels the integrated control plane a research prototype. LatentMesh has a
useful authenticated, replay-resistant transport, while its direct latent-state
communication experiments did not move downstream decisions. Neither project
is evidence that an adaptive bedside loop already exists.

Personal dream influence also creates an unusually easy reward-hacking path. A
policy can increase report recall by waking the user, increase apparent theme
incorporation by asking leading questions, or overfit a changing season. A
representation model can find similar nights but cannot establish that a cue
caused an outcome. Causal promotion therefore requires randomized controls and
sleep-preservation gates outside the optimizer.

## 2. Decision

### 2.1 Define four authority levels

| Level | Meaning | Permitted effect | Promotion authority |
|---|---|---|---|
| Learning | Update local observations, embeddings, calibration, and uncertainty | Better description and retrieval | Deterministic ingestion policy |
| Optimization | Select among pre-authorized actions inside a signed numeric envelope | A policy choice, including silence | Bounded policy evaluator |
| Evolution | Propose a new typed artifact or bounded parameter set | Candidate only | MetaHarness evidence gate plus human approval |
| Deployment | Activate a signed accepted artifact in an inactive release slot | Runtime behavior changes | Human release controller |

No level inherits the authority of the next level. A candidate with perfect
fitness cannot deploy itself. An accepted software candidate cannot arm an
actuator. A policy with an accepted benefit result cannot change its safety
envelope.

### 2.2 Freeze a non-evolvable constitution

The following surfaces are immutable at runtime and protected in repository
review:

1. Consent semantics, expiration, revocation, and deletion.
2. Physical arming, mute, abort, watchdog, and fail-silent behavior.
3. Audio, light, haptic, thermal, electrical, and cumulative exposure ceilings.
4. Allowed user population, excluded conditions, and single-occupant rules.
5. Data classification, retention, encryption, and network-egress policy.
6. Evaluator code, frozen controls, holdouts, statistical thresholds, and reward-hack tests.
7. Witness, signing, provenance, capability, protected-path, and merge policy.
8. Candidate authority, release keys, rollback target, and deployment permissions.
9. The prohibition on advertising, third-party goals, political content, coercion,
   subliminal persuasion, and generated speech during sleep.

Changing one of these surfaces requires a separately reviewed ADR, an explicit
threat-model update, new tests, and human-signed release approval.

### 2.3 Limit the first-year mutation grammar

Autogenous or Darwin may propose one change per candidate from this allowlist:

1. A feature weight used to retrieve comparable nights.
2. A representation version with a frozen input and output schema.
3. A timing bin inside an already approved opportunity window.
4. A cue identity from the awake-previewed, signed local library.
5. A cue-spacing increase or intensity decrease.
6. A model-routing or compute-budget parameter that cannot change the result of
   the safety gate.
7. A redacted WebUI explanation or visualization policy.

Intensity increases, duration increases, new modalities, new tools, new data
sources, new network destinations, new code capabilities, and changes to any
constitutional surface are not automatic mutations.

The canonical candidate envelope is
[`../contracts/edge-v1/evolution-candidate.schema.json`](../contracts/edge-v1/evolution-candidate.schema.json).
It carries immutable `envelopeDigest` and `evaluationContractDigest` values;
the proposer cannot name or omit fitness gates. JSON Schema bounds types and
ranges. A deterministic semantic validator additionally enforces direction,
library membership, vector dimension, opportunity-window containment, and no
authority change.

### 2.4 Use contrastive learning for matching, not causal claims

The contrastive learner may construct positive pairs from the same person under
similar bedtime, environment, signal quality, and state estimates. Hard negative
pairs preserve context while changing cue, outcome, or time period. It produces
retrieval embeddings, out-of-distribution scores, and uncertainty estimates.

The causal layer independently assigns cue, sham, or silence at the night or
opportunity level. Windows from one night cannot be split across train and test.
Every result reports absolute rates, uncertainty, exclusions, and null outcomes.
The morning report remains canonical; a language model may structure it but not
rewrite it.

### 2.5 Separate proposer, evaluator, promoter, and actuator

```text
closed episodes
  -> RuVector retrieval and causal dataset
  -> Autogenous or Darwin typed proposal
  -> schema and authority validator
  -> chronological replay
  -> adversarial and reward-hack evaluation
  -> shadow mode with no actuation
  -> prospective randomized comparison
  -> ACCEPT | REJECT | INCONCLUSIVE
  -> human-signed deployment candidate
  -> inactive slot and rollback drill
```

MetaHarness owns evidence assembly and verdict production. Dream Machine owns the
workflow and durable ledger. The runtime owns only an active signed policy
pointer. The independent controller owns physical enforcement.

### 2.6 Make silence a first-class action and baseline

Silence is always available, requires no exploration budget, and wins any tie.
Exploration is capped at ten percent of eligible nights. Automatic candidate
generation stays disabled until at least thirty usable observation-only nights
exist. Only one generated candidate may be active at a time, and at most one
human approved bounded policy can be promoted per month after the research gate
is enabled.

Generated candidate exposures count against that ten percent budget. Fourteen
exposures therefore require at least 140 eligible nights, before exclusions or
missed opportunities; matched controls may come from the remaining eligible
nights. The 70 night P8 study is a different, frozen, human approved randomized
audio protocol with separate consent and allocation. It cannot self modify and
does not exempt generated candidates from the exploration cap.

### 2.7 Require a staged promotion envelope

A candidate advances only through all applicable stages:

1. Static schema, authority, and content validation.
2. At least one million malformed-policy and cue-ticket adversarial cases.
3. Replay over at least thirty chronologically held-out usable nights.
4. Seven usable nights in shadow mode with no physical effect.
5. At least fourteen eligible prospective exposures and fourteen matched controls.
6. Posterior probability of predefined benefit above 0.95.
7. Estimated probability of sleep harm below 0.05.
8. No regression in safety, privacy, reliability, energy, or deletion behavior.
9. Human review of the evidence bundle and exact diff.
10. Inactive-slot deployment followed by a verified rollback drill.

Missing data, inconsistent clocks, evaluator disagreement, insufficient power,
and unavailable controls produce `INCONCLUSIVE`, never an inferred pass.

Research completion is distinct from promotion: a valid negative or inconclusive
report completes a study without deploying its candidate. A safety failure
requires remediation before a related profile can proceed. Independent practical
profiles need their own safety and evidence gates, not positive dream results.

### 2.8 Restrict LatentMesh to transport experiments

LatentMesh may be evaluated for authenticated, delay-tolerant communication with
optional remote room or environmental nodes. Exact safety fields and policy
digests remain lossless. Semantic compression may carry only non-authoritative
summaries. Direct latent-state transfer is not a decision input unless it beats a
plain structured-message baseline on a preregistered behavioral outcome. It is
never placed in the cue authorization path.

## 3. Consequences

The system can improve locally over months without granting generated artifacts
new authority. Every change has a parent, evidence, expiry, and rollback target.
The design is slower than unrestricted online learning: the first meaningful
personal policy comparison requires roughly seventy eligible nights, and a
candidate needs additional shadow and controlled exposure. That delay is the
cost of distinguishing adaptation from sleep fragmentation and seasonal drift.

The system may still learn immediately for retrieval and calibration. It simply
cannot convert that learning into expanded physical authority. "SOTA" is an
earned benchmark result against a fixed schedule, current champion, and simpler
adaptive baseline, not an architecture label.

The repository must not depend on unmerged experimental PRs. Concepts from open
PRs may be referenced, but implementations are integrated later through a
versioned adapter once their contracts are accepted.

## 4. Alternatives Considered

- **Unrestricted online reinforcement learning**. Rejected because reward
  hacking, nonstationarity, sparse subjective feedback, and physical output make
  safe exploration impossible to justify.
- **Contrastive embeddings as the causal engine**. Rejected because similarity
  does not identify the effect of a cue.
- **Automatic merge after MetaHarness acceptance**. Rejected because it violates
  ADR-0001 and collapses evaluator and promoter authority.
- **Model-controlled actuator tools**. Rejected because prompt injection and
  policy errors would cross directly into physical output.
- **Direct latent-state coordination by default**. Rejected because LatentMesh's
  current experiments do not demonstrate downstream decision benefit.
- **No adaptation**. Rejected because bounded longitudinal calibration and
  retrieval can create real value without authority expansion.

## 5. Test Contract

This ADR is satisfied when:

1. Machine-readable schemas and the semantic validator reject every candidate
   with an authority delta, unknown or out-of-direction mutation, missing
   parent, envelope or evaluation contract, missing expiry, or missing rollback.
2. Property tests generate at least one million candidate and cue inputs with
   zero unauthorized physical approvals.
3. Changing a constitutional path fails protected-path CI and cannot be labeled
   as automatically mergeable.
4. A deterministic replay demonstrates `ACCEPT`, `REJECT`, and `INCONCLUSIVE`,
   including evaluator disagreement and missing-control cases.
5. A candidate cannot see holdout labels, mutate the evaluator, rewrite the
   morning report, or select only favorable nights.
6. Silence wins ties and any safety uncertainty.
7. Promotion requires distinct proposer, evaluator, and human promoter identities.
8. Rollback restores and verifies the previous signed artifact within sixty seconds.
9. A LatentMesh adapter preserves exact fields, rejects replay, and is removed if
   it cannot beat structured transport on the frozen acceptance metric.
10. Every accepted candidate emits a content-addressed evidence bundle and a
    Dream Machine witness without deploying or merging itself.

## 6. References

- [Autogenous repository and honest status](https://github.com/ruvnet/autogenous)
- [RuVector 0.2.40 release](https://github.com/ruvnet/RuVector/releases/tag/ruvector-v0.2.40)
- [LatentMesh 0.2.0 release and null result](https://github.com/ruvnet/LatentMesh/releases/tag/v0.2.0)
- [Dream Machine PR #30, trace-driven harness optimizer](https://github.com/ruvnet/dream-machine/pull/30)
- [Dream Machine PR #42, anchored trace replay](https://github.com/ruvnet/dream-machine/pull/42)
- [Dream Machine PR #52, statistical validity budget](https://github.com/ruvnet/dream-machine/pull/52)
- [Dream Machine PR #71, claim-relative evidence receipts](https://github.com/ruvnet/dream-machine/pull/71)
- [Dream Machine PR #74, failure attribution before mutation](https://github.com/ruvnet/dream-machine/pull/74)
