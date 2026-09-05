# Dream Machine Home Core threat model

**Status:** Proposed security design and release gate

**Date:** 2026-09-04
**Scope:** Mac Studio build control plane, Dream Machine repository, iPhone and
optional Apple Watch, Arduino UNO Q Linux and STM32 planes, RuView Home Core,
RuVector, MCP, WebUI, local network, sensors, and research actuators.

This document is a security and safety engineering plan, not a medical or legal
certification. The first release is an adult, single-occupant, opt-in personal
research system. It must not diagnose, treat, decode, or control dreams.

## 1. Security objective

The system may observe local signals and propose bounded experiments. It must
preserve confidentiality and user control, continue operating without the
Internet, and prevent any untrusted principal from directly energizing output.
A compromised Linux root process can still request an otherwise allowed cue
during a physically armed session. The independent MCU must reject requests
outside the signed envelope and enforce hard physical ceilings, freshness,
dose, and mute even in that case. This guarantee is conditional on proving that
the MPU cannot replace or debug the enforcing MCU firmware or bypass its output
gates. Arduino's stock MCU programming path originates on Linux, so two chips
alone do not establish that isolation. The trusted MCU and driver path is a
residual safety boundary; redundant hardware ceilings, supervision, and fault
injection bound rather than erase its risk.

The security invariant is:

```text
untrusted observation or model output
  -> typed proposal with no authority
  -> native deterministic broker
  -> signed short-lived ticket
  -> independent microcontroller verification
  -> physical output or silence
```

Silence is the failure mode. A signature establishes integrity and identity; it
does not make a compromised Linux host trustworthy. The microcontroller repeats
the immutable physical checks and controls the hardware enable lines.

## 2. Current repository posture

Read-only inspection of `main` at
`7933c3599abe22df5290f4609d1f93f598feb3de` identified these program blockers:

1. `main` has no branch protection and no repository ruleset.
2. The repository has a large unmerged backlog with competing ADR numbers and
   several overlapping evaluation proposals.
3. `dream.config.json` contains unpinned `npx` evaluator entrypoints; open PR #19
   tracks the supply-chain risk.
4. Baseline `dream.config.json` enables `autoMerge` while promotion and merge
   are described as human decisions. This architecture branch disables it;
   protected paths, required human review, and repository rules remain P0 gates.
5. CI builds TypeScript packages, but the root `npm run typecheck` command fails
   independently because the committed root `tsconfig.json` has an empty file
   set.
6. The current memory package does not implement a real RuVector backend and can
   misrepresent a flat implementation after an explicit backend request.
7. The static site is outside ESLint coverage and has no browser security test.
8. Dependency results must be reproduced on the final branch. Existing issue
   #37 and open PR #46 show that a production audit gate is not yet settled.
9. Ruflo 3.25.6 deep dependency scanning reported eight candidates in
   development tooling: two critical, one high, three medium, and two low.
   Upstream advisory review confirmed affected installed versions behind the
   Vitest, Vite, esbuild, and ESLint findings. The critical and high exploit
   paths require UI, browser, API, development-server, or Windows modes that the
   current repository does not use. They are bounded residual risks, not false
   positives or production findings.
10. `npm audit --omit=dev --json` completed with zero production findings across
    13 production dependencies. The full development audit did not complete
    within 45 seconds, so the upstream adjudication remains authoritative for
    this pull request. The exact evidence and mandatory P1 upgrade gate are in
    [the dependency adjudication](dependency-adjudication-2026-09-04.md).
11. The dedicated Ruflo dependency scan and CVE listing returned zero findings,
    conflicting with the deep all-type scan and verified upstream advisories;
    they are not treated as clearance. The only STRIDE scanner result is an
    inert W3C DOM namespace literal in vendored Three.js, not a network request.

No physical runtime, Apple bridge, MCP server, or actuator exists on `main`, so
this threat model defines required controls before those capabilities are added.

## 3. Assets and data classes

| Class | Examples | Default handling |
|---|---|---|
| P0 public | Source, public ADRs, schemas, signed release metadata | May enter Git and CI |
| P1 internal | Device manifest, non-identifying calibration, performance summaries | Local and access controlled; redacted CI fixture allowed |
| P2 personal | Derived respiration, movement, room conditions, presence, night summary | Encrypted locally; no third-party model context |
| P3 intimate | HealthKit samples, dream reports, raw voice, raw radar or CSI, identity linkage | Explicit consent, minimal retention, no Git, CI, cloud log, or generic MCP resource |
| S0 secret | Signing keys, pairing keys, local session tokens, recovery material | Non-exportable or offline where possible; never placed in prompts, logs, screenshots, or repository files |

Derived data remains at least as sensitive as the source when it can reveal
health, sleep, household presence, emotion, or identity. Embeddings are not
anonymized merely because they are vectors.

Proposed retention defaults:

1. Microphone ring buffer: ten seconds in volatile memory.
2. Raw radar or CSI calibration capture: off; one encrypted night when separately
   consented; delete within 24 hours.
3. Five-second derived windows: 24 hours, then aggregate.
4. Raw normalized HealthKit observations: 30 days.
5. Night summaries and outcome records: 13 months.
6. Content-free policy and safety receipts: 24 months.
7. Signing audit records: retained for the lifetime of the device release.

The user can delete each class independently. Deletion propagates through
derived indexes, browser caches, phone outboxes, backups, and pending transfers,
then writes a content-free receipt.

## 4. Trust boundaries and principals

| Principal or boundary | Trust | Allowed authority |
|---|---|---|
| Sleeping user | Cannot provide new consent | Previously approved session only |
| Awake local user | Trusted for explicit decisions after authentication | Consent, preview, mute, export, human promotion |
| Local language model | Untrusted proposer | Read redacted resources and create proposals |
| Codex Desktop computer control | Untrusted automation with visible UI access | Build and inspect; no credentials, signing, flashing, promotion, or merge |
| Browser and WebUI | Untrusted request source | Authenticated local read, proposal, and safe mute |
| RuVector and memory | Trusted for stored evidence after verification | Retrieval only; not consent or physical authority |
| RuView Home Core plugin | Sandboxed, signed, still untrusted for actuation | Read bounded features and propose |
| Native cue broker | High-trust deterministic service | Mint a ticket inside a fixed envelope |
| UNO Q Linux root | Potentially compromisable | Cannot bypass the MCU gate only after independent programming, debug, and gate isolation is demonstrated; otherwise observe only |
| STM32 safety controller | Small trusted computing base | Final actuator authorization and hardware gating |
| iPhone companion | Trusted after physical pairing | Read consented HealthKit data and sign local batches |
| Apple Watch | Advisory evidence source | No direct pod or actuator authority |
| Local network peer | Untrusted | No access until mutually authenticated and authorized |
| Update supplier and package registry | Untrusted input | Candidate artifact only until digest, provenance, and tests pass |

## 5. Threat actors

1. Malicious or compromised package maintainer.
2. Nearby network attacker or spoofed Bonjour service.
3. Local malware on the Mac, iPhone, browser, or UNO Q Linux plane.
4. Prompt injection embedded in a repository, issue, web page, dream report,
   health metadata, sensor label, or imported RVF bundle.
5. Faulty or reward-hacking optimizer seeking metric improvement.
6. Curious household member, bystander, or second bed occupant.
7. Remote attacker after an accidental network exposure.
8. Authorized user making an unsafe configuration mistake.
9. Hardware fault, corrupted clock, replay, power interruption, or thermal fault.
10. Insider with build access attempting an unauthorized release.

## 6. Prioritized risk register

Likelihood and impact use a one-to-five scale. A score of 15 or higher blocks
hardware cueing until the listed control and test are complete.

| ID | Threat | L | I | Score | Required control and evidence |
|---|---|---:|---:|---:|---|
| T01 | Model, MCP, or WebUI reaches an actuator | 4 | 5 | 20 | No actuator tool; native broker; MCU recheck; reachability and capability tests |
| T02 | Optimizer improves recall by waking the user | 4 | 5 | 20 | Silence arm; awakening hard gate; randomized control; frozen outcome rubric; reward-hack replay |
| T03 | Computer control follows injected instructions or exposes credentials | 4 | 5 | 20 | Dedicated macOS account; untrusted-content rule; stop conditions; no secrets or merge token; recorded human gates |
| T04 | False state estimate triggers repeated cues | 4 | 4 | 16 | MCU-visible safety snapshot; calibrated probabilities; quality floor; cue cap; refractory period; arousal veto; fail silent |
| T05 | Malicious update or dependency enters the device | 3 | 5 | 15 | Exact pins; lockfiles; SBOM; provenance; sandboxed replay; signed bundle; inactive slot |
| T06 | Intimate health or report data leaves the local boundary | 3 | 5 | 15 | Data minimization; encryption; no analytics; egress firewall and packet capture; redaction tests |
| T07 | Harmful or manipulative cue content is introduced | 3 | 5 | 15 | Awake preview; MCU-selected immutable asset; local allowlist; content digest; no generated sleep speech; policy and claim review |
| T08 | Consent is stale, ambiguous, or supplied while asleep | 3 | 5 | 15 | Awake consent epoch; expiration; physical arming; sleeping speech never changes consent |
| T09 | Local network replay or spoofed phone controls the pod | 3 | 4 | 12 | Physical pairing; pinned certificate; signed batch; sequence; nonce; replay cache; repair on mismatch |
| T10 | Second occupant is observed or stimulated | 3 | 4 | 12 | Single-occupant prototype; occupancy ambiguity means silence; no raw audio; physical placement review |
| T11 | Compromised Linux root bypasses logical limits or substitutes cue content | 2 | 5 | 10 | STM32-owned cue bytes and enable lines, duplicated hard limits, watchdog, physical mute, boot-off state |
| T12 | Corrupt timestamp or sequence causes stale action | 3 | 4 | 12 | Monotonic clocks; boot ID; two-second ticket horizon; strict sequence; clock uncertainty gate |
| T13 | Firmware, light, haptic, amplifier, or power fault causes injury | 2 | 5 | 10 | Current, thermal, duration and duty limits; certified supply; hardware fuse; supervised envelope testing |
| T14 | Imported bundle abuses parser or exhausts resources | 3 | 4 | 12 | Size and depth bounds; strict schemas; signature after bounded parse; fuzzing; quarantine |
| T15 | Evidence, holdout, or scorer is altered to force promotion | 3 | 5 | 15 | Frozen digests; independent judges; blind assignment; protected paths; human review; replay receipt |
| T16 | Marketing turns research into diagnosis or covert manipulation | 3 | 5 | 15 | Claim allowlist and tests; explicit research labeling; legal review; ban third-party goals |
| T17 | Hostile MPU replaces or debugs the integrated STM32 safety controller | 3 | 5 | 15 | Exact board programming, debug, memory, key, and gate isolation proof; human interlocked updates; external safety controller if isolation cannot be demonstrated |

## 7. STRIDE analysis

### Spoofing

Phone and pod pairing requires a physical action, a 60-second one-time secret,
and certificate fingerprint confirmation. The iPhone signs batches with a
device-bound key. STM32 tickets bind device, boot, policy, firmware, consent
epoch, sequence, monotonic validity, and asset digest. MCP principals have
separate identities and capability sets.

### Tampering

Release bundles, policies, cue assets, firmware, evidence, and health batches are
content addressed and signed. Any digest mismatch fails closed. RuVector stores
retain encoder and schema digests. Policy and evidence logs are append-only with
hash chaining. Mutable cached verdicts are never accepted as replay evidence.

### Repudiation

Every proposal, denial, ticket, actuation, model-visible call, consent revision,
import, deletion, candidate, promotion decision, rollback, flash, and release has
a pseudonymous receipt. Receipts record principals and content digests but omit
raw private content. A Dream Machine witness binds each evidence bundle to its
source commit.

### Information disclosure

Nightly operation has no WAN dependency. Runtime firewall policy denies public
egress and DNS. MCP is loopback-only by default. Browser resources are redacted
and non-authoritative. P2, P3, and S0 data never enter Git, CI, Ruflo shared
memory, third-party model context, screenshots, or crash reporting.

### Denial of service

All parsers, queues, resource queries, streams, and vector searches have byte,
count, time, and concurrency limits. Queue overflow stops collection visibly; it
does not discard evidence silently. Linux failure leaves outputs off. The MCU
watchdog closes hardware gates. Storage exhaustion reserves enough space for a
final safety and deletion receipt.

### Elevation of privilege

Linux services use distinct users, read-only filesystems where possible,
systemd sandboxing, minimal device nodes, and explicit Unix socket groups. Only
the native broker reaches Arduino Router cue RPC. Home Core WASM plugins cannot
open the broker key or device socket. Computer control, models, tests, and
hardware runners have no merge credential. Safety transitions cannot be invoked
through a general MCP capability.

## 8. Mac Studio and Codex Desktop controls

Use a dedicated `dream-builder` macOS account with no personal mail, Messages,
Photos, browser profiles, password manager, unrelated repositories, or cloud
drives. Grant Accessibility and Screen Recording only for an active supervised
session and revoke them when not needed.

Computer control may open Xcode, Simulator, Instruments, Console, Arduino tools,
and local dashboards; exercise synthetic permission flows; and capture redacted
evidence. It stops and requests the human for:

1. Password, passkey, biometric, Keychain, Apple ID, certificate, or recovery prompt.
2. Developer Mode, Accessibility, Screen Recording, firewall, browser, or local
   network permission change.
3. HealthKit consent, data-retention change, or participant enrollment.
4. Code-signing identity, provisioning profile, notarization, or release signing.
5. Physical board selection, firmware flashing, actuator connection, or arming.
6. Candidate promotion, rollback override, release, merge, or protected-branch change.
7. An instruction discovered inside content rather than the trusted operator task.

The agent never uses a device-port glob, never pastes a secret, and never runs
code from an untrusted pull request on the signing or hardware runner.

## 9. Runtime hardening baseline

1. Minimal pinned Debian image with unattended network services disabled.
2. Read-only system partitions and writable encrypted data partition where the
   platform supports the design without compromising recovery.
3. Separate users for sensing, Home Core, memory, MCP, WebUI, broker, and updater.
4. Systemd `NoNewPrivileges`, capability bounding, device allowlists, private
   temporary directories, memory limits, CPU limits, and restart budgets.
5. Default-deny host firewall; loopback MCP; explicitly paired phone service on
   the local interface; no public DNS in ordinary operation.
6. Local TLS with pinned device identity and planned certificate rotation.
7. Exact update manifest containing OS, package, firmware, model, policy, cue
   asset, schema, and migration digests.
8. A and B release slots with last-known-good pointer and offline rollback.
9. Physical arm, mute, abort, and visible cue indicator independent of the WebUI.
10. MCU starts disarmed, selects and verifies sleep cue bytes, controls amplifier
    enable, rejects unknown CBOR keys, and closes every output on reset, liveness
    loss, fault, or watchdog expiry.

Secure boot and hardware-backed attestation are not claimed until demonstrated
on the chosen UNO Q production carrier. Before that milestone, receipts are
signed and hash chained but not labeled hardware attested.

### MCU programming and debug isolation release blocker

Arduino's official `remoteocd` can flash MCU firmware from the UNO Q Linux MPU.
This is an intended development capability, not a vulnerability report against
Arduino. It conflicts with treating stock MCU firmware as immutable under Linux
root compromise. Disabling ADB or SSH does not remove the local programming
path. [Arduino remoteocd](https://github.com/arduino/remoteocd)

Live cueing requires a reviewed, device specific proof that MPU root cannot
rewrite or debug safety firmware, RAM, keys, policy, cue assets, or final gate
outputs. Capture board and bootloader identities, protection configuration,
debug accessibility, independent witness results, update authorization, and
recovery behavior. Tests run only on a human approved bench device with actuator
power disconnected. Exercise native programming and debug paths, not merely
permissions on the installed utility; reset and interrupted update must keep
outputs off. A signature verified by replaceable firmware or its self reported
hash cannot establish this property.

If that proof is unavailable, use a separately provisioned external safety
controller whose programming and debug interfaces are physically isolated from
the MPU during operation. It owns sensor freshness, cue bytes, mute, dose, and
final enable; update mode requires a human physical interlock and disconnected
actuator power. Irreversible lock or fuse changes require a separate hardware
review. Until either design passes T17, only observation and simulation are
eligible, with actuator power disconnected. Signed receipts remain useful for
integrity but do not waive this physical release gate.

## 10. Health, consent, and misuse controls

1. Adult, consenting, single-occupant use only in the first prototype.
2. No use while driving, operating equipment, caring for another person, or when
   immediate alertness is required.
3. Exclude people unable to provide informed consent and pause on illness,
   medication change, intoxication, unusual sleep disruption, or distress.
4. Audio launches first. Light and haptic require independent protocols and
   hardware ceilings. Electrical, vestibular, magnetic, ultrasound, pressure,
   scent, and thermal actuation are not consumer capabilities in this program.
5. No generated spoken content during sleep. Every cue is reviewed while awake,
   locally stored, content addressed, and revocable.
6. Maximum three initial audio exposures per night, at least ten minutes apart,
   with an arousal veto and cumulative-duration cap.
7. Any serious adverse report disables stimulation pending human review.
8. The product language is dream-theme support and personal research, not dream
   reading, dream control, diagnosis, treatment, or guaranteed benefit.
9. Cognitum's Las Vegas base makes Nevada consumer-health-data review a release
   gate. FTC health-breach obligations and Apple HealthKit requirements are also
   reviewed before an external pilot.
10. EU deployment requires a separate review of AI Act Article 5 manipulation
    boundaries and applicable privacy obligations. Consent does not excuse a
    harmful manipulative design.

## 11. Verification program

### Source and supply chain

1. Secret scan across tracked files and the staged diff.
2. Dependency audit with a captured advisory database timestamp.
3. CodeQL, language linters, compiler warnings, license policy, and SBOM.
4. Exact-package provenance and clean-room install test.
5. Reject unpinned runtime `npx`, install scripts without review, unsigned
   bundles, mutable image tags, and unexpected generated binaries.

### Parser and capability tests

1. One million malformed observation, proposal, decision, ticket, health-batch,
   URI, MCP, RVF, and update inputs with no crash or unauthorized accept.
2. Duplicate, unknown, missing, noncanonical, oversized, deeply nested, replayed,
   expired, future, wrong-boot, wrong-policy, and wrong-consent cases.
3. Capability-reachability test proving there is no graph from model, browser,
   Watch, memory, plugin, or sensor principal to an actuator.
4. Prompt-injection corpus across every textual input and metadata field.
5. Fault injection for power, full disk, damaged index, key loss, clock drift,
   service restart, MCU reset, phone delay, and network partition.

### Privacy and network tests

1. Twenty-four-hour packet capture during the full offline operating cycle.
2. Public DNS, public IP, analytics, crash upload, and cloud endpoint detection.
3. Artifact and log search for P2, P3, and S0 fixtures.
4. A user-initiated deletion drill across phone, Watch, pod, RuVector, browser
   cache, backup, and pending transfer completes within sixty seconds after all
   devices are reachable. A HealthKit source deletion uses the separate clock
   that starts when observer or foreground reconciliation actually begins with
   protected data and pod connectivity available.
5. Local network spoof, certificate mismatch, replay, downgrade, and DNS
   rebinding tests.

### Physical safety tests

1. Boot, shutdown, power loss, Linux crash, broker crash, heartbeat loss, and MCU
   reset all leave physical outputs off.
2. Independent measurement of speaker level, light output, haptic acceleration,
   current, temperature, duration, ramp, and cumulative duty cycle.
3. Ten thousand restart and fault sequences and seven supervised eight-hour HIL
   runs with zero duplicate cue and zero safety violation.
4. Physical mute and abort work without Linux, network, browser, model, or phone.
5. T17 attempts from hostile MPU root cannot replace, debug, halt, or bypass the
   deployed safety controller or its final gates. Independent instrumentation
   witnesses reset and rejected or interrupted update behavior. Missing device
   access or isolation evidence is `INCONCLUSIVE`, not a live release pass.

## 12. Vulnerability and incident response

1. Safety incidents immediately latch the device in `FAULT`, revoke the active
   experimental policy, preserve content-free evidence, and require physical
   human review.
2. Security incidents disable imports and updates without deleting evidence.
3. Compromised release keys are revoked through an offline root process and do
   not authorize a weaker firmware or policy version.
4. Affected data classes and devices are enumerated before notification.
5. Public disclosure follows the repository `SECURITY.md`; sensitive details use
   GitHub Security Advisories or the published security contact.
6. The release checklist includes Nevada consumer-health-data, FTC Health Breach
   Notification Rule, Apple platform, and applicable research notification review.

## 13. Release gate

Hardware cueing remains disabled until all of the following are true:

1. Branch protection or a repository ruleset enforces required checks and human review.
2. No confirmed critical or high production vulnerability remains open.
3. Every T01 through T08 control has executable passing evidence.
4. The independent STM32 controller and hardware enable are demonstrated on the
   exact board and firmware hash.
5. Packet capture shows zero unexpected egress.
6. A rollback restores the verified previous release within sixty seconds.
7. Consent, physical mute, abort, deletion, and serious-adverse-event drills pass.
8. A human reviews and signs the exact evidence bundle, firmware, policy, and cue assets.
9. T17 programming, debug, and output gate isolation passes on the exact
   production controller, or an external independent controller passes the same
   contract. Host hardening or signed self reports alone cannot satisfy it.

## References

- [Repository security policy](../../SECURITY.md)
- [Nevada Revised Statutes Chapter 603A](https://www.leg.state.nv.us/nrs/nrs-603a.html)
- [FTC Health Breach Notification Rule guidance](https://www.ftc.gov/business-guidance/resources/complying-ftcs-health-breach-notification-rule-0)
- [FDA General Wellness guidance, January 2026](https://www.fda.gov/regulatory-information/search-fda-guidance-documents/general-wellness-policy-low-risk-devices)
- [EU AI Act consolidated text, Article 5](https://eur-lex.europa.eu/eli/reg/2024/1689)
- [Apple HealthKit privacy](https://developer.apple.com/documentation/healthkit/protecting-user-privacy)
- [Arduino UNO Q documentation](https://docs.arduino.cc/hardware/uno-q/)
- [Arduino remoteocd: Linux MPU firmware programming modes](https://github.com/arduino/remoteocd)
- [RuView](https://github.com/ruvnet/RuView)
- [RuVector](https://github.com/ruvnet/RuVector)
- [Autogenous](https://github.com/ruvnet/autogenous)
