# ADR-0100: Separate the Dream Machine control plane from the bedside runtime and actuator safety authority

- **Status**: Proposed
- **Date**: 2026-09-04
- **Related**: ADR-0001 (evaluation is not promotion), ADR-0002 (evaluator liveness), proposed edge-runtime program
- **Deciders**: rUv; Dream Machine maintainers
- **Tags**: edge-runtime, trust-boundary, safety, local-first, capability-manifest, self-learning, self-optimization, human-promotion

## 1. Context

The current Dream Machine is a TypeScript engine for repository research,
evaluation, witnessed evidence, and human-reviewed promotion. It is not a
bedside device runtime. The proposed program adds a local system that can learn
from room and wearable signals, estimate personal sleep context, and propose
bounded audio, light, or haptic cues. Development and evaluation may run on an
Apple-silicon Mac using Codex Desktop and a Ruflo swarm; the deployed system is
expected to run locally on an Arduino UNO Q-class Linux and microcontroller
pair, with RuView Home Core as a possible integration substrate.

That expansion crosses a hard boundary. Repository mutation is reversible
software work. A bedside actuator can disturb sleep or create physical and
privacy harm. A model, vector-memory result, generated skill, browser tool, MCP
client, or self-optimization loop must therefore never possess direct actuator
authority.

The repository also does not currently implement the capabilities that the
program intends to compose. In particular:

- `@dream-machine/memory` probes for RuVector but still executes the flat-file
  backend; a real RuVector/RVF storage path is not wired.
- There is no bedside runtime, UNO Q firmware, RuView Home Core adapter,
  HealthKit bridge, signed deployment path, device capability manifest, or
  independent actuator safety controller.
- MCP is mentioned in security guidance, but the repository does not ship an
  MCP server, SSE transport, or `ruv://` resource implementation.
- Autogenous, LatentMesh, contrastive learners, and MetaHarness are not device
  authority mechanisms. If integrated, they remain candidate-generation,
  simulation, or evaluation components.

Several open pull requests propose useful but unmerged concepts: trace-driven
optimization (#30), evidence-carrying termination (#35), anchored trace replay
(#42), persistent statistical validity (#52), claim-relative receipts (#71),
and failure attribution before mutation (#74). This decision references those
concepts as desired evidence properties. It does not assume their code is
present, stable, or approved.

## 2. Decision

Adopt three independently enforceable planes with one-way authority flow.

| Plane | Primary deployment | Responsibilities | Explicitly forbidden |
|---|---|---|---|
| Build and evidence control plane | Mac development host and CI | Build, simulate, test, benchmark, adversarially review, witness evidence, retain receipts, and prepare human promotion decisions | Release signing, real-time bedside control, direct actuator commands, autonomous merge, autonomous deployment |
| Bedside cognition plane | Local Linux application processor | Ingest observations, align time, estimate state, query local memory, select a declared policy, and emit typed `CueProposal` messages | Bypassing the safety controller, expanding its own manifest, treating model confidence as permission |
| Actuator safety plane | Independent microcontroller or equivalently isolated controller | Verify authorization, enforce hard limits, drive actuators, monitor heartbeat, expose physical stop and mute controls, and fail safe | Model inference, semantic memory, remote tool execution, dynamic code generation, policy self-modification |

The build and evidence control plane is the role of Dream Machine. It may
coordinate Codex Desktop, Ruflo, RuVector, Autogenous, LatentMesh,
MetaHarness, deterministic simulators, security scanners, and benchmark
harnesses. Its output is evidence and a candidate release bundle. It does not
promote itself. A human approves a specific, reproducible, signed bundle.

The bedside cognition plane may self-learn only within a signed envelope. It
may update personal baselines, embeddings, confidence calibration, and bounded
policy parameters. It may not modify consent, actuator ceilings, safety code,
promotion criteria, evaluator definitions, network policy, or signing roots.
Self-optimization means choosing or tuning within approved bounds. Self-
evolution means generating versioned candidates for offline replay and review,
not rewriting the live system.

The actuator safety plane is the final authority. Every physical action must be
derived from a fresh, typed `SafetyDecision` that references one
`CueProposal`, the active capability manifest, a monotonic sequence value, and
a short expiry. Missing, stale, replayed, malformed, unsigned, out-of-profile,
or over-limit requests resolve to no actuation. Loss of the cognition-plane
heartbeat resolves to the same safe state. A physical mute or stop control
overrides all software.

This independence is a release prerequisite, not a stock UNO Q guarantee. The
Linux MPU has a development path for programming the integrated STM32.
[ADR-0101](ADR-0101-uno-q-ruview-home-core-runtime.md#production-isolation-prerequisite)
requires independently witnessed debug, flash, and gate isolation, or an
external safety controller, before any physical cue. Signatures verified by
replaceable firmware cannot substitute for this evidence.

### 2.1 Interface and authority rules

The canonical message flow is:

`Observation -> StateEstimate -> CueProposal -> SafetyDecision -> ActuatorCommand`

Each step is append-only evidence. Only the safety plane can create an
`ActuatorCommand`. Models, agents, MCP tools, `ruv://` resources, vector
searches, wearable data, and browser or voice interfaces can supply evidence or
proposals only. They carry `authority: none` by default.

Sensor inputs are untrusted observations. Contradictory sensors lower
confidence; they do not silently select the most permissive interpretation.
Wearable and phone bridges are optional sensor gateways and are not safety
dependencies. If they disconnect, the system degrades to the capabilities that
the local manifest permits with remaining sensors.

### 2.2 Capability manifests and use-case isolation

Every deployment activates exactly one signed capability manifest. A manifest
binds the device identity, profile, software and policy digests, allowed
sensors, allowed actuators, intensity and duration ceilings, duty-cycle limits,
quiet windows, data-retention policy, network policy, expiry, and rollback
target. The runtime cannot widen it. A capability increase requires a new
human-approved manifest and release.

Profiles progress from practical to exotic without inheriting authority:

| Profile | Intended scope | Default actuator authority |
|---|---|---|
| Observe | Passive room and optional wearable sensing, local summaries, data-quality diagnostics | None |
| Assist | User-initiated voice, ambient sound, light, or vibration within conservative wellness limits | Explicitly enumerated, bounded, immediately revocable |
| Research | Consent-bound, protocol-specific closed-loop cue experiments with preregistered endpoints | Disabled until the named protocol and session are armed |
| Explore | Simulated or shadow evaluation of novel contrastive, generative, or multimodal policies | None; a separate decision is required before physical trials |

Selecting a more exotic profile does not implicitly enable more sensors,
network access, data retention, or actuators. Manifests are default deny and
non-transitive. Research and Explore data must not contaminate an Assist policy
without an explicit, witnessed promotion experiment.

### 2.3 Promotion and rollback

A candidate progresses through deterministic unit tests, recorded simulation,
fault injection, privacy and security review, held-out benchmark evaluation,
independent critique, and human approval. The release receipt binds the source
commit, toolchain, dependency lock, model and policy digests, capability
manifest, benchmark corpus, results, known limitations, approver, signature,
and rollback target.

Promotion is staged: simulator, shadow, observe-only hardware, bounded canary,
then declared profile. Any failed invariant blocks promotion regardless of an
aggregate score. Runtime telemetry may trigger rollback to the last signed safe
bundle, but it may not choose or sign a new candidate.

Local operation is the default. Internet access is not required for sensing,
state estimation, memory, safety decisions, actuation, or rollback. Any remote
integration is a separately declared capability with explicit destinations and
cannot become part of the safety-critical path.

## 3. Consequences

- A compromised model, memory index, prompt, MCP server, phone, or Linux
  process cannot directly drive an actuator if the independent controller and
  manifest enforcement remain intact.
- Personal adaptation remains useful while consent, safety limits, and
  deployment authority stay immutable to the learner.
- The Mac host can use substantially more compute for swarm development and
  evaluation without making bedside safety depend on that host.
- Practical sensing and assistive features can ship before experimental dream
  influence policies. Exotic work remains measurable in simulation and shadow
  mode instead of becoming an all-or-nothing product bet.
- The system requires explicit message schemas, signing and key lifecycle,
  clock and replay protection, a hardware watchdog, physical controls, and
  failure-mode tests. This adds engineering cost and some cue latency.
- This ADR creates boundaries, not implementations. Documentation or a green
  repository test cannot be presented as evidence that the hardware path is
  safe.
- The system is a wellness and research platform unless separately validated
  and regulated. It must not claim medical diagnosis, treatment, or guaranteed
  dream outcomes.

## 4. Alternatives Considered

- **One process for inference and actuation.** Rejected because a memory error,
  prompt injection, generated-code defect, or model hallucination would share
  the actuator authority boundary.
- **Cloud-hosted real-time control.** Rejected as the default because network
  loss, remote compromise, data exposure, and service drift would enter the
  bedside safety path. Cloud export may be an optional, non-authoritative
  capability.
- **Direct wearable-to-actuator commands.** Rejected because wearable data is
  delayed, incomplete, user-controlled, and not an authorization token.
- **Automatic deployment after a winning benchmark.** Rejected because an
  evaluator can be incomplete, poisoned, overfit, or statistically invalid.
  Evaluation remains evidence for human promotion.
- **Allow the learner to edit safety limits as personalization.** Rejected.
  Those limits define authority, not preference, and require a new reviewed
  manifest.
- **Wait for every open evidence pull request before defining the boundary.**
  Rejected. The trust boundary is independently necessary. Later accepted
  primitives can strengthen its receipts without changing its authority model.

## 5. Test Contract

This ADR is satisfied only when all of the following are executable and retain
their raw receipts:

1. Static dependency tests prove that model, memory, optimizer, MCP, and sensor
   modules can emit only observations or proposals and cannot import or invoke
   an actuator driver.
2. Contract and fuzz tests submit at least 1,000,000 invalid, stale, replayed,
   unsigned, over-limit, and profile-mismatched requests with zero unauthorized
   actuator commands.
3. Heartbeat loss, cognition-process crash, clock rollback, corrupted state,
   sensor disagreement, and invalid manifest signatures all produce the
   declared safe state. Hardware-in-loop tests measure and publish the maximum
   time to that state before any production claim.
4. The physical stop and mute controls disable output even when the Linux host
   is unresponsive or hostile.
5. Capability-matrix tests prove that Observe and Explore cannot actuate, that
   Research requires an armed protocol and session, and that switching profiles
   cannot retain undeclared capabilities.
6. A 24-hour offline integration run completes sensing, local storage, state
   estimation, allowed policy evaluation, safety enforcement, and rollback with
   zero required Internet egress.
7. Every installed bundle verifies its source, manifest, policy, benchmark,
   approval, and signature receipt. Altering any bound artifact invalidates the
   bundle. Rollback restores the last signed safe bundle without data-schema
   ambiguity.
8. Promotion tests prove that a positive model or benchmark score cannot
   override a failed safety, privacy, statistical-validity, security, or human-
   approval gate.
9. Failure-injection tests demonstrate safe degradation when RuVector,
   wearable data, voice, MCP, the Mac host, or any optional learner is absent.
10. No performance, health, sleep-stage, or dream-influence claim is promoted
    without a named protocol, baseline, sample size, uncertainty, adverse-event
    accounting, and independently reproducible evidence.

## 6. References

- ADR-0001: Dream Machine engine and the evaluation-is-not-promotion boundary.
- ADR-0002: Evaluator entrypoint liveness classification.
- Pull request #30: trace-driven optimization with held-out gates, referenced
  as a candidate concept only.
- Pull requests #35, #42, #52, #71, and #74: proposed completion, replay,
  statistical, receipt, and attribution primitives, referenced without an
  implementation dependency.
- NIST SP 800-193: Platform Firmware Resiliency Guidelines.
- NIST AI RMF 1.0: govern, map, measure, and manage functions for AI risk.
