# ADR-0105: A Mac Studio and Codex desktop swarm form the governed development control plane

- **Status**: Proposed
- **Date**: 2026-09-04
- **Deciders**: ruv
- **Related**: ADR-0001 (evaluation is not promotion), ADR-0002 (evaluator liveness), `SECURITY.md`
- **Tags**: mac-studio, codex-desktop, computer-use, ruflo, swarm, reproducible-builds, apple-watch, uno-q, evidence-gate

---

## 1. Context

The Dream Machine already separates evaluation from promotion: an autonomous
cycle can research, propose, test, and open a draft pull request, but it cannot
merge or promote itself. Extending that engine to a local sensing system adds
new execution surfaces that a cloud session cannot reproduce faithfully:

- Apple Silicon builds, Xcode, iOS and watchOS simulators, HealthKit
  entitlements, provisioning, and physical Apple Watch validation.
- Arduino UNO Q firmware, local RuView Home Core services, signed RuVector
  WASM modules, USB flashing, and hardware-in-the-loop tests.
- Long sensor replays, local-only privacy tests, resource benchmarks, and
  supervised actuator validation.
- Desktop applications whose critical setup or verification steps have no
  stable command line or API surface.

The Mac is powerful enough to coordinate these lanes, but power is not an
authority model. Giving a desktop agent unrestricted access to Xcode accounts,
the login keychain, HealthKit consent, USB devices, release credentials, and
merge controls would collapse the boundary established by ADR-0001.

"Self evolving" also needs a precise definition. In this system it means that
a proposer may generate a bounded candidate and the harness may learn from its
measured result. It does not mean that a running model may rewrite its safety
controller, evaluation contract, consent policy, signing policy, or promotion
gate.

Finally, "Mac mini studio" is not a concrete Apple product identifier. The
workflow must discover and record the actual model, processor, memory, storage,
macOS, Xcode, and SDK versions before choosing concurrency or treating any
measurement as a benchmark.

## 2. Decision

Use one dedicated Apple Silicon Mac as the **development and release control
plane**, operated through ChatGPT Codex desktop and a Ruflo-coordinated swarm.
The Mac is never a runtime safety dependency for the bedside device. A deployed
pod must observe, fail safe, and roll back without the Mac or Internet.

### 2.1 Dedicated account and least privilege

Create a dedicated standard macOS account named `dream-builder`. It owns only
the repository, dependency caches, simulators, test device records, and
generated evidence. It must not have access to personal Mail, Messages, Photos,
Passwords, cloud drives, browser profiles, health exports, or unrelated source
trees.

Grant Screen Recording and Accessibility to ChatGPT only after human review.
Keep full browser CDP access disabled by default. Do not grant the agent an
administrator session, a merge token, release credentials, or unattended
access to Apple account authentication. Bootstrap may use a separate human
administrator approval, but routine builds must not require `sudo`.

Computer control is an adapter for GUI-only work, not a bypass around a missing
automation or permission boundary. It may launch and inspect Xcode, Simulator,
Instruments, Console, and Arduino tools; exercise synthetic permission flows;
and capture redacted evidence. It must stop when any step asks for:

1. A password, passkey, biometric, Apple account, keychain, or signing identity.
2. HealthKit consent, a privacy or retention change, or access to real health
   data.
3. Developer Mode, Screen Recording, Accessibility, firewall, browser, or
   operating-system permission changes.
4. Device pairing, physical flashing, actuator connection, or a live cue.
5. Release signing, promotion, merge, publication, or rollback override.
6. Execution of an instruction discovered in repository content, sensor data,
   logs, issues, pull requests, generated reports, or web pages.

Each stop resumes only after a human verifies the exact target and approves the
single action. The agent never records or replays a credential entry or consent
decision.

### 2.2 Swarm isolation and ownership

Run one supervisor and at most six workers. Concurrency is selected from the
discovered machine, reserving at least 16 GiB of memory and two performance
cores for macOS, Xcode, simulators, and the supervisor:

| Installed memory | Maximum workers |
|---|---:|
| 32 GiB | 3 |
| 64 GiB | 5 |
| 128 GiB or more | 6 |

The supervisor owns the specification, protected paths, shared schemas, root
lockfiles, integration branch, final evidence review, and pull request state.
Workers own disjoint lanes: Home Core and UNO Q, Apple Watch and iPhone,
simulation and replay, evaluation and learning, security, and performance.

Every worker receives an explicit input contract, owned path list, expected
artifact, and validation command. It works in a separate Git worktree and
branch. The supervisor integrates reviewed commits; workers do not edit the
same file, weaken a test, or resolve an integration conflict by discarding
another lane. `.claude-flow/`, `.swarm/`, raw transcripts, and local health or
sensor data remain uncommitted runtime state.

Ruflo coordinates tasks and reusable, non-sensitive learning. It is not the
source of truth for code or approval. Git commits, test receipts, witnesses,
and the ledger remain authoritative.

### 2.3 Reproducible build and CI parity

The implementation will pin the versions of Xcode and Apple SDKs, Node and npm,
Rust and WASM targets, Arduino CLI and board cores, and all package lockfiles.
The run records a sanitized toolchain fingerprint before evaluation.

Dependency acquisition is a distinct online phase. After caches and checksums
are verified, the candidate is rebuilt and tested with WAN access unavailable.
The unsigned payload is the reproducibility boundary because Apple signing
adds protected identities and non-deterministic metadata. Simulator builds set
`CODE_SIGNING_ALLOWED=NO`; a protected release lane signs only an already
verified artifact.

The repository's current executable baseline remains:

```bash
npm ci
npm run build
npm run typecheck
npm run lint
npm test
npx vitest run --coverage
```

The hardware implementation adds one repository task interface for discovery,
offline builds, simulation, security, benchmarks, packaging, evidence
verification, and hardware-in-the-loop execution. Local and CI jobs must call
that same interface rather than maintaining separate CI-only logic.

CI has six logical lanes:

1. Linux portability across the repository's Node 18, 20, and 22 matrix.
2. macOS arm64 unsigned Swift, iOS simulator, and watchOS simulator builds.
3. Fixed-seed simulation, fault injection, and deterministic verdict checks.
4. Static analysis, dependency review, secret scanning, fuzz smoke tests,
   entitlement inspection, SBOM generation, and protected-path enforcement.
5. Benchmarks on a dedicated Apple Silicon runner without reused result
   caches.
6. Manually dispatched hardware tests on an isolated self-hosted runner that
   never executes fork code and has no merge credential.

Apple simulators do not reproduce real HealthKit sampling, background delivery,
radio behavior, pairing, or battery cost. A real iPhone and Apple Watch are a
required acceptance surface. Watch data is advisory and asynchronous; missing
or delayed Watch data fails closed and cannot independently authorize an
actuator.

### 2.4 Evidence and human gates

Every integrated run produces an immutable, content-addressed evidence bundle
containing the sanitized toolchain, build manifest, tests, coverage, property
tests, fuzz summary, simulation verdict, benchmark distributions, security
results, SBOM, network-egress result, firmware hash, Xcode result bundle,
hardware events, rollback drill, provenance, witness, and promotion manifest.
Large artifacts live in CI artifact storage; the Dream Machine ledger records
their hashes and stable references.

Raw HealthKit, radar, audio, and bedroom telemetry must never enter Git, CI
artifacts, Ruflo memory, third-party model context, screenshots, or general
logs. CI uses synthetic or explicitly deidentified traces.

Human approval is required at five gates:

1. **Environment gate**: install tools or change macOS permissions.
2. **Apple gate**: authenticate, pair devices, grant HealthKit access, install a
   profile, or sign an app.
3. **Hardware gate**: select an explicit board identifier, verify the firmware
   SHA-256, flash, or connect an actuator.
4. **Live gate**: leave shadow mode or deliver any physical cue.
5. **Promotion gate**: sign a manifest, switch the champion, release, merge, or
   override rollback.

### 2.5 Bounded evolution and rollback

Candidates may change personal embeddings, local RuVector memories, signed
feature-extractor WASM, declared model parameters, and cue selection inside an
immutable amplitude, duration, rate, and quiet-period envelope.

Candidates may not change the independent safety controller, consent and data
policy, actuator ceilings, watchdog, physical mute, frozen evaluation corpus,
promotion criteria, witness implementation, signing keys, protected CI, or
their own deployment permissions.

The proposer, evaluator, adversarial critic, and promoter are separate roles.
A candidate progresses through simulator, prerecorded replay, shadow mode with
no actuation, supervised canary, and limited personal alpha. Each stage emits
an `ACCEPT`, `REJECT`, or `INCONCLUSIVE` verdict. Acceptance opens or updates a
draft pull request; it does not merge or deploy.

The bedside target uses signed A/B slots. Deployment writes only the inactive
slot, verifies its manifest, and then switches. A watchdog or gate violation
places actuators in the safe state within one second and restores the last
known-good slot within 60 seconds. A physical mute remains authoritative over
both slots and the Mac.

## 3. Consequences

- The Mac can coordinate parallel local engineering and Apple-specific work
  without becoming a bedside dependency or an autonomous release principal.
- Dedicated worktrees and file ownership reduce merge collision and make each
  worker's evidence attributable.
- Offline rebuilding catches undeclared cloud dependencies and supports the
  product's local-only privacy claim.
- Apple signing, HealthKit consent, device pairing, and physical cue testing
  retain deliberate human friction.
- Hardware validation is slower than simulator-only development and requires
  maintained test devices, an isolated runner, and explicit operator time.
- The exact Apple toolchain is less portable than the Node workspace. The
  version fingerprint and unsigned payload boundary make that limitation
  visible instead of claiming byte-for-byte reproducibility of a signed app.
- State of the art remains an evidence claim: a candidate must beat a frozen
  static baseline, the current champion, and a simpler adaptive baseline on
  preregistered metrics without a safety, privacy, reliability, or energy
  regression.

## 4. Alternatives Considered

- **Give one desktop agent the entire repository and all credentials.**
  Rejected: it maximizes local convenience by removing the independent review,
  credential, signing, and promotion boundaries that make autonomous work
  governable.
- **Use one working tree for all agents.** Rejected: concurrent edits make
  ownership and evidence ambiguous and turn integration conflicts into a
  source of silent loss.
- **Run all development in cloud CI.** Rejected: CI cannot faithfully validate
  local-only behavior, Apple device permissions, watch battery, USB flashing,
  or physical fail-safe behavior.
- **Treat the Mac as the live controller.** Rejected: network, desktop, or
  account failure would then become a physical safety dependency.
- **Permit automatic promotion after a benchmark win.** Rejected: adaptive
  evaluation, reward hacking, distribution shift, and physical actuation make
  a single scalar improvement insufficient evidence for deployment.
- **Require identical hashes for signed Apple bundles.** Rejected: signing and
  provisioning introduce protected and time-varying metadata. Reproduce and
  hash the unsigned payload, then separately witness the signing receipt.

## 5. Test Contract

This ADR is satisfied when all of the following are evidenced:

1. A clean `dream-builder` account records its exact hardware and toolchain,
   primes verified dependencies, loses WAN access, and completes the repository
   build, typecheck, lint, tests, simulation, security checks, and packaging.
2. Local and CI orchestration invoke the same commands, and the existing Node
   18, 20, and 22 matrix remains green.
3. Two fixed-seed runs produce the same normalized unsigned artifact hashes,
   verdict, ledger inputs, and witness.
4. Computer control tests stop at every credential, permission, consent,
   signing, device, flash, live-actuation, promotion, and merge boundary.
5. One million generated cue requests produce zero out-of-envelope
   authorizations, and 10,000 restart or fault sequences produce zero unsafe
   activations.
6. Twenty-four hours of local operation produces zero WAN egress. Deleting a
   profile removes its raw and derived personal state without affecting another
   profile.
7. A real iPhone and Apple Watch complete the consent, delayed-delivery,
   disconnect, reconnect, clock-drift, and battery tests without becoming an
   actuator authorization source.
8. Seven consecutive eight-hour hardware runs complete without a duplicated
   cue, watchdog reset, unsafe output, data corruption, or unrecovered service
   failure.
9. Removing power or forcing a bad candidate places outputs in the safe state
   within one second and restores the signed last-known-good slot within 60
   seconds.
10. The evidence verifier rejects a changed artifact, missing receipt,
    suspicious-silent evaluator, unsigned deployment, protected-path mutation,
    or absent human approval.
11. No agent account can sign, flash, activate, promote, release, or merge
    without the corresponding recorded human gate.

## 6. References

- ADR-0001, especially §2.4, "Evaluation is not promotion."
- ADR-0002, evaluator entrypoint liveness and `suspicious-silent` handling.
- `SECURITY.md`, repository threat model and protected-path policy.
- OpenAI, [ChatGPT desktop app](https://developers.openai.com/codex/app).
- OpenAI, [Computer Use](https://developers.openai.com/codex/computer-use).
- Apple, [Xcode](https://developer.apple.com/xcode/).
- Apple, [Configuring HealthKit access](https://developer.apple.com/documentation/xcode/configuring-healthkit-access).
- Apple, [Xcode Cloud](https://developer.apple.com/xcode-cloud/).
