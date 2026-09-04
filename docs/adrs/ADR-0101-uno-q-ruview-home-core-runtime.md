# ADR-0101: Governed edge runtime on Arduino UNO Q with RuView HOMECORE

- **Status**: Proposed
- **Date**: 2026-09-04
- **Deciders**: ruv
- **Related**: ADR-0001, `docs/contracts/edge-v1/README.md`
- **Tags**: edge, arduino-uno-q, ruview, homecore, ruvector, mcp, safety, offline, physical-actuation
- **Scope**: The bedside edge appliance, its Mac Studio build plane, and the boundary between adaptive software and physical outputs

---

## 1. Context

The current Dream Machine is a config driven engine for evidence gated
repository evolution. It freezes a hypothesis, evaluates a bounded candidate,
records evidence, and leaves promotion to a human. The proposed bedside Dream
Machine applies the same discipline to a physical system that observes local
signals over months and may deliver sound, light, or vibration cues.

Physical action makes the existing promotion boundary more important, not less.
A model that can both learn a policy and execute that policy can reward hack the
measurement, bypass consent, or exceed a safe output envelope. “Self learning”,
“self optimizing”, and “self evolving” therefore need precise meanings:

1. **Self learning** means updating local representations and a personal
   baseline from consented observations.
2. **Self optimizing** means selecting parameters inside an approved policy
   envelope and only after replay and shadow evaluation.
3. **Self evolving** means generating candidate code, models, or policies on
   the Mac Studio build plane. A candidate cannot install itself, promote
   itself, weaken an evaluator, or change a safety invariant.

This ADR extends ADR-0001's principle into the physical world:

> Learning is not actuation. Evaluation is not promotion. A human promotes a
> signed release, and an independent controller authorizes every physical cue.

### 1.1 Evidence boundary

The table separates capabilities verified in current upstream documentation
from adapters and performance that this project still has to implement and
measure.

| Capability | Status on 2026-09-04 | Consequence for this ADR |
|---|---|---|
| UNO Q combines a Qualcomm Dragonwing QRB2210 with four Cortex A53 cores at 2 GHz running Debian and an STM32U585 at up to 160 MHz with 2 MB flash and 786 kB SRAM running Arduino on Zephyr | Verified in Arduino hardware documentation | Use Debian for adaptive services and the STM32 for deterministic safety and I/O |
| The 4 GB UNO Q variant provides 4 GB LPDDR4 RAM and 32 GB eMMC | Verified in the Arduino product documentation | Select this variant for HOMECORE, RuView, RuVector, MCP, and local WebUI concurrency |
| Arduino Router exposes MessagePack RPC through `/var/run/arduino-router.sock`, supports service discovery, and permits multiple Linux clients to call MCU functions | Verified in Arduino Router documentation | Use it for bounded control messages, heartbeats, sensor summaries, and receipts; do not claim an unmeasured latency guarantee |
| UNO Q exposes a maker UART, two DAC outputs, six PWM outputs, USB audio support, and analog audio endpoints on the JMISC connector | Verified in the Arduino user manual and datasheet | Use UART for radar and MCU outputs for safety gates, light, and haptic control; choose the final audio carrier only after hardware validation |
| RuView documents HOMECORE state, history, automations, signed Wasm plugins, voice hooks, HomeKit support, CSI sensing, and governed evidence | Verified as an upstream RuView repository capability | Compose upstream packages and binaries; deployment and resource behavior on UNO Q remain proposed until measured |
| Seeed MR60BHA2 exposes presence, distance, breathing, and heart estimates; documented vital sensing range is up to 1.5 m and presence range is up to 6 m | Verified in Seeed documentation | Use as the first contactless sensor, with explicit quality flags and no medical claim |
| ESP32 C6 exposes WiFi CSI APIs in ESP IDF | Verified in Espressif documentation | Use one or more external C6 or S3 nodes for optional CSI sensing |
| The UNO Q WCBN3536A WiFi module exposes CSI suitable for RuView | Not documented by Arduino | Treat the onboard radio as networking only; never make onboard CSI an architectural dependency |
| A Dream Machine edge profile, signed cue protocol, `ruv://` MCP resources, UNO Q bundle, and hardware safety firmware exist | Proposed by this ADR | Implement and pass this ADR's test contract before describing them as shipped |

### 1.2 Objective

Build an offline first appliance that can:

1. Observe breathing, motion, presence, ambient state, and optional external
   CSI without a camera.
2. Learn a local, longitudinal baseline in RuVector without uploading raw
   bedroom data.
3. Evaluate bounded cue proposals against replay, safety, and experiment
   policy.
4. Deliver only authorized low voltage audio, light, or haptic cues.
5. Expose status, evidence, and proposals to Codex desktop and the local WebUI
   through a narrow MCP surface.
6. Generalize to practical and exotic edge sensing uses by changing signed
   profiles and adapters, not the safety boundary.

### 1.3 Non goals

This program does not diagnose or treat disease, guarantee dream induction,
operate mains voltage loads near a bed, perform covert sensing, expose raw
biometrics to an AI host by default, or permit an autonomous model to arm,
resume, install, promote, or expand an actuator envelope.

## 2. Decision

### 2.1 Separate the build, adaptive, policy, and safety planes

The system has four authority domains.

| Plane | Runs on | Authority | Explicitly forbidden |
|---|---|---|---|
| Build and evidence plane | Mac Studio with Codex desktop and a Ruflo swarm | Build, simulate, fuzz, benchmark, create candidate releases, and witness evidence | Release signing, direct bedtime actuation, silent promotion, secret extraction, protected gate edits without review |
| Adaptive plane | UNO Q Debian | Signal fusion, HOMECORE state, RuVector memory, local inference, contrastive learning, replay, shadow evaluation | Direct GPIO, amplifier enable, safety key access, policy promotion |
| Deterministic policy plane | Isolated native service on UNO Q Debian | Validate consent, confidence, experiment assignment, cumulative dose, approved asset hash, and policy hash; sign a short lived cue ticket | Arbitrary model execution, arbitrary shell execution, policy mutation, direct actuator access |
| Safety plane | STM32U585 on Zephyr | Verify tickets, require physical arm state, enforce immutable bounds, schedule timers, gate outputs, stop on any fault, return receipts | Network access, learning, dynamic plugin loading, unbounded allocation |

The adaptive plane may create a `CueProposal`. Only the deterministic policy
plane may create a `CueTicket`. Only the STM32 may open an output gate. The
contract is defined in `docs/contracts/edge-v1/README.md`.

This four domain view refines ADR 0100's three plane model. The adaptive and
deterministic policy domains are separate subdivisions of its bedside cognition
plane. The Mac maps to its build and evidence control plane, and the STM32 maps
to its actuator safety plane. An awake human release controller alone signs and
activates a release bundle.

### 2.2 Linux and MCU split

The Debian side owns:

1. RuView signal ingestion and normalization.
2. HOMECORE state, history, automations, voice, and signed Wasm extensions.
3. RuVector episodic memory, baseline retrieval, and contrastive exemplars.
4. Candidate generation, replay, shadow execution, and evidence scoring.
5. The deterministic cue broker, local MCP server, WebUI, packaging agent, and
   audit log.

The STM32 side owns:

1. The direct MR60BHA2 UART parser in the production configuration.
2. Source sequence numbers, monotonic timestamps, bounded safety sensor
   snapshots, and single use clock challenges.
3. A strict deterministic CBOR parser, proposal binding, and Ed25519 ticket verification.
4. The physical arm and mute state, policy digest, consent epoch, replay
   window, modality ceilings, cooldown, and cumulative cue budget.
5. Hardware timer scheduling, immutable audio asset selection and playback,
   amplifier enable, warm light PWM, haptic driver enable, watchdog, and fail
   safe shutdown.
6. A receipt for every accepted or rejected ticket.

Arduino Router is used for small MessagePack RPC requests and responses. Bulk
CSI does not traverse it. Final cue onset is scheduled from the STM32 monotonic
clock so Linux scheduling jitter is not part of the final timing loop.

### 2.3 Use two radar integration modes behind one contract

The first development mode uses the Seeed MR60BHA2 kit with its included XIAO
ESP32 C6 over local USB serial or an isolated ESPHome path. This reduces bring
up risk and exercises the normalized sensor contract.

The production reference mode connects the MR60BHA2 UART directly to the
STM32U585 at the documented 3.3 V logic level and uses a dedicated, adequately
sized 3.3 V regulator. Linux receives bounded summaries through Arduino Router;
it is not the source of the MCU safety snapshot. Firmware version and effective serial parameters are
recorded at boot because upstream module revisions have used different serial
settings. The driver must not silently guess.

The mounting fixture keeps the subject's chest within the documented 1.5 m
vital sensing range. Installation calibration tests fans, moving curtains,
reflective metal, bed partners, pets, vibration, and empty room behavior. Each
sample carries presence, quality, missing value, and interference flags. A
missing estimate is `null`; it is never converted to zero or a confident state.

### 2.4 Use external ESP32 nodes for optional CSI

The onboard UNO Q WiFi radio remains a network interface because Arduino does
not document a CSI capture API for it. One or more ESP32 C6 or S3 nodes run a
pinned RuView compatible firmware and send versioned binary frames to a
dedicated UDP listener on the Debian side.

Each frame includes node identifier, boot identifier, source sequence,
transmitter timestamp or TSF where available, channel metadata, payload length,
checksum, and firmware hash. The listener rejects malformed lengths, duplicate
sequences, unsupported schemas, and implausible timestamps. It records packet
loss and clock uncertainty as data quality, not as hidden transport noise.

### 2.5 Gate every physical output independently

Awake preview may render audio on Debian through a USB audio adapter. The first
sleep cue is a short immutable asset stored in MCU controlled flash and rendered
by an MCU timer or audio peripheral. The STM32 verifies and selects the asset,
then controls a low voltage amplifier enable. A later digest verified external
flash path may support a larger cue library. Linux rendered content is excluded
from sleep cue profiles until it cannot substitute bytes during a valid gate.

Warm light uses an STM32 PWM output, a current limited driver, a diffuser, and
an independently measured lux ceiling at the pillow. Haptic output uses a low
voltage driver with an independent enable and bounded acceleration, duration,
and duty cycle. No mains loads, ultrasonic emitters, high intensity strobes,
or head mounted vibration are part of the reference design.

The MCU powers up with every output disabled. It closes all gates after the
ticket window, on broker heartbeat loss, on reset, on watchdog expiry, on
physical mute, or on any parse, signature, clock, consent, policy, asset,
sequence, budget, or sensor quality error. It rejects out of range values
instead of silently clamping them.

HomePod is an optional HomeKit and Siri surface through HOMECORE. It may expose
status, stop, or noncritical announcements. It is not the experimental cue
actuator because the project cannot independently bound its onset latency,
offline behavior, or hardware mute path.

### 2.6 Compose HOMECORE rather than reimplement it

Dream Machine owns edge profiles, contracts, evidence gates, replay,
promotion policy, MCP resources, and receipts. RuView owns RF adapters and
HOMECORE. RuVector owns local semantic memory. Autogenous or Darwin may propose
bounded candidates. The project consumes pinned upstream releases and records
their hashes; it does not copy those runtimes into this repository.

The proposed HOMECORE adapter publishes derived, explicitly nonmedical entities:

| Entity | Purpose |
|---|---|
| `sensor.dream_respiration_rate` | Contactless estimate with confidence and source |
| `sensor.dream_heart_rate_estimate` | Contactless estimate with confidence and source |
| `sensor.dream_signal_quality` | Current quality, coverage, and interference flags |
| `binary_sensor.dream_bed_presence` | Bounded presence state |
| `binary_sensor.dream_cue_armed` | Read only physical arm state |
| `sensor.dream_policy_version` | Active signed policy digest |
| `event.dream_cue_receipt` | Accepted or rejected cue evidence |
| `button.dream_stop` | Safety favored transition to MUTED |

Signed Wasm plugins may read bounded features and emit proposals. Only the
native cue broker receives the Arduino Router capability. `stop` always moves
toward a safer state. Resuming after MUTED or FAULT requires physical presence.

### 2.7 Expose a local MCP observation and proposal surface

The local server implements the current MCP stdio and Streamable HTTP
transports. Streamable HTTP binds to loopback and is reached from the Mac
through an SSH tunnel. A reply may use request scoped SSE. A legacy permanent
`/sse` endpoint is disabled by default.

The custom `ruv://` scheme follows RFC 3986 and is used for status, session
summaries, baselines, policy, receipts, evidence, benchmarks, and schemas. Raw
radar, raw CSI, journal text, and signing material are not resources. The model
may query, search, preview, propose, mute, and export evidence. It may not
execute a cue, arm, resume, change a safety cap, install firmware, or promote a
candidate.

### 2.8 Package one signed offline bundle

The Mac Studio build emits a content addressed ARM64 bundle containing:

1. Pinned HOMECORE and RuView artifacts.
2. Dream Machine edge services and schemas.
3. STM32 firmware.
4. Approved models, cue assets, and safety policy.
5. A CycloneDX or SPDX SBOM, checksums, provenance, and release signature.

Arduino App Lab is used for bring up. The appliance release uses a Debian
package and hardened systemd units so each service has an explicit user,
filesystem view, device access, memory and CPU limit, restart policy, and audit
log. The system keeps two verified release slots and can return to the previous
slot without deleting the local profile.

Production hardening follows Arduino's documented guidance: set a strong local
password, install signed OS updates during a controlled maintenance window,
disable ADB after provisioning, disable SSH when not in maintenance, bind
services to loopback, use SSH tunneling when remote maintenance is required,
and encrypt private persisted data. The bedtime runtime has no Internet
dependency.

## 3. Consequences

1. A compromised model, Wasm plugin, MCP client, or HOMECORE automation does
   not receive direct GPIO or amplifier authority.
2. The architecture works offline and keeps longitudinal memory in the room.
3. The same edge contract can support practical uses such as occupancy,
   recovery rooms, private elder bed exit observation, and ambient focus, plus
   exploratory uses such as lucid dream cue research or creative incubation.
   Each use still needs its own signed policy and evidence criteria.
4. The design adds hardware, cross language test vectors, provisioning, and
   hardware in the loop work. That cost is deliberate because software only
   sandboxing cannot enforce an output that remains safe after Linux failure.
5. MR60BHA2 and commodity CSI are environmental sensors, not medical devices.
   Coverage and error rates must be measured against an independent reference
   before they influence experiments.
6. The Ed25519 ticket prevents forgery and corruption but does not by itself
   make a compromised Debian root trustworthy. Duplicated MCU limits, physical
   arming, hardware gates, a watchdog, release signatures, and an optional
   secure element provide defense in depth.
7. App Lab is not the production supervisor. This reduces convenience but
   creates an auditable appliance boundary.

## 4. Alternatives Considered

### 4.1 Run every component on Debian and drive GPIO directly

Rejected. A process crash, scheduler stall, model exploit, or root compromise
could leave an output enabled. It also makes the learner and actuator one
authority domain.

### 4.2 Stream audio samples through Arduino Router

Rejected for the reference design. The public RPC documentation does not
establish the bulk throughput or timing guarantee needed for continuous audio.
The MCU selects and renders the first short immutable sleep cue locally; Linux
audio remains an awake preview path.

### 4.3 Depend on HomePod for every cue

Rejected. HomePod remains useful as an optional voice and HomeKit surface, but
it does not provide the independently measured and physically gated output
path required by this ADR.

### 4.4 Capture CSI with the UNO Q onboard radio

Rejected until an official, testable CSI interface is documented. ESP32 C6 and
S3 nodes have explicit CSI support and can be replaced without changing the
UNO Q safety plane.

### 4.5 Let MCP expose direct actuator tools

Rejected. MCP tools are model controlled and the MCP specification recommends
human oversight for sensitive operations. The model receives proposal and
safety favored stop operations only.

### 4.6 Build a custom carrier before validating the loop

Deferred. An MCU controlled short cue store, USB awake preview, development
modules, and an independent witness fixture can validate the contracts and
safety behavior first. A custom carrier is justified after power, signal,
thermal, content integrity, and timing measurements stabilize.

## 5. Implementation sequence

All durations are planning estimates for one Mac Studio, one primary engineer,
and a Ruflo assisted swarm. They are not delivery claims.

| Milestone | Scope | Exit evidence | Estimate |
|---|---|---|---|
| M0, contracts and deterministic simulator | Edge schemas, golden CBOR vectors, fake clock, fake router, fake sensors, fake MCU, policy evaluator | Unit, property, and replay tests pass on macOS and Linux CI | 1 week |
| M1, UNO Q safe output bring up | Router adapter, STM32 state machine, physical arm and mute, amplifier gate, light and haptic test loads | Invalid ticket matrix and power failure tests produce zero unauthorized transitions | 2 weeks |
| M2, sensing | MR60BHA2 bring up, direct UART path, external CSI path, clock alignment, quality model | Eight hour traces, loss report, independent radar comparison, provenance | 2 weeks |
| M3, local intelligence | HOMECORE adapter, RuVector memory, contrastive baseline, MCP, WebUI | Offline integration test, resource access tests, no direct actuator capability | 2 weeks |
| M4, observation pilot | No cue nights, calibration, drift, false state analysis | At least 14 usable nights and a predeclared promotion plan | 2 to 4 weeks |
| M5, audio only experiment | Approved assets, manual nightly arm, randomized or controlled protocol | Safety receipts and outcome report; no automatic policy promotion | At least 30 evaluated nights |
| M6, light and haptic research | Separate modality policies and independent dose measurement | Each modality passes its own safety and effect gate | 4 weeks after M5 gate |
| M7, appliance release | Signed bundle, SBOM, service hardening, offline update, rollback, soak | Reproducible build and full completion matrix | 2 weeks |

### 5.1 Reference prototype BOM

Prices are USD snapshots or planning ranges on 2026-09-04. They exclude the
Mac Studio, Apple Watch, HomePod, tax, shipping, and custom PCB work.

| Component | Quantity | Evidence | Planning cost |
|---|---:|---|---:|
| Arduino UNO Q 4 GB and 32 GB | 1 | Arduino listed price | $79.00 |
| Seeed MR60BHA2 kit | 1 | Seeed listed price | $26.99 |
| ESP32 C6 development node | 1 to 2 | DigiKey listed unit price | $9.00 to $18.00 |
| USB awake-preview adapter, QSPI flash, and MCU audio output parts | 1 set | Planning range; exact parts selected during M1 | $14 to $30 |
| Powered USB C hub, 5 V 3 A supply, and rated cables | 1 set | Planning range; exact parts selected during M1 | $35 to $60 |
| Low voltage amplifier, speaker, hardware enable, and acoustic limiter parts | 1 set | Planning range | $20 to $35 |
| Warm light, current limited driver, diffuser, and lux sensor | 1 set | Planning range | $12 to $25 |
| Haptic driver and low mass actuator | 1 set | Planning range; optional after M5 | $12 to $25 |
| Physical arm, mute, status indicator, wiring, regulator, and enclosure | 1 set | Planning range | $25 to $50 |
| Independent HIL witness with microphone, lux sensor, and accelerometer | 1 | Planning range | $20 to $40 |

The full listed development system is approximately $253 to $389. A reduced
audio first build is approximately $205 to $330 and can omit haptic, warm light,
one CSI node, and modality specific witness sensors. The UNO Q
requires a stable 5 V, 3 A source; external loads require a measured power
budget rather than an assumption that header rails can supply them.

## 6. Test Contract

Quantitative values below are acceptance targets. They are not current
measurements. A target becomes a claim only when a committed report identifies
hardware revision, firmware and software hashes, fixture, sample count, raw
receipt location, and calculation.

### 6.1 Safety invariants

1. Power up, reset, service restart, network loss, and Linux crash leave every
   output gate off.
2. At least 1,000,000 fuzzed or malformed ticket inputs cause zero output
   transitions and no MCU crash, hang, or unbounded memory growth.
3. Invalid signature, wrong device, wrong boot identifier, wrong policy,
   revoked consent epoch, unsupported asset, expired time, future horizon,
   duplicate sequence, excessive duration, excessive intensity, cooldown, and
   cumulative budget cases each reject with a specific receipt.
4. Replaying 10,000 valid tickets actuates at most once per unique ticket.
5. Broker liveness loss closes audio, light, and haptic gates within benchmark
   S05. The initial dedicated liveness timeout is 75 ms; RPC telemetry is not
   the hard shutdown signal.
6. The MCP tool list contains no arm, resume, direct execute, safety mutation,
   firmware installation, or promotion operation.
7. Remote voice, HomeKit, and WebUI can always request stop. None can bypass a
   physical rearm after MUTED or FAULT.

### 6.2 Contract and integration

1. TypeScript, Rust, and STM32 implementations produce byte identical
   deterministic CBOR and Ed25519 golden vectors.
2. A fake Arduino Router verifies request identifiers, timeouts, malformed
   MessagePack, disconnect, restart, and duplicate response behavior.
3. HOMECORE entity values preserve null, confidence, source, clock
   uncertainty, and evidence level end to end.
4. Missing RuVector or a failed learner degrades to observation only. It never
   relaxes safety or invents a baseline.
5. `ruv://` parsing rejects traversal, invalid percent encoding, authority
   confusion, unknown templates, unauthorized private data, and oversized
   identifiers.
6. stdio and loopback Streamable HTTP pass the MCP conformance tests selected
   for the implemented protocol version. Request scoped SSE cancellation ends
   work and does not leave a pending cue proposal active.

### 6.3 Hardware in the loop

1. An independent USB witness, not the device under test, records amplifier
   enable, acoustic onset and level, light onset and lux, and haptic onset and
   acceleration.
2. Valid light and haptic tickets have MCU scheduled onset jitter at or below
   20 ms p99. The complete local cue request to gate path is at or below 100 ms
   p99. Audio onset is at or below 50 ms p99 after the scheduled gate time.
3. Measured peak and cumulative output remain inside the signed policy in every
   valid test and remain at ambient or off in every invalid test.
4. A mechanical breathing phantom proves transport and frequency extraction
   over the configured range. It does not count as biological accuracy proof.
5. A separate quiet single subject comparison targets median absolute error at
   or below 2 breaths per minute and 8 heart beats per minute, at least 80
   percent usable coverage, and explicit abstention outside the documented
   geometry. Failure keeps the signal observational.
6. Direct radar transport and each CSI node complete an eight hour run with no
   process crash. The target is less than 1 percent transport loss for direct
   radar and a documented loss distribution for CSI at 50 frames per second per
   node.

### 6.4 Resource, privacy, and release gates

1. The 4 GB UNO Q completes an eight hour representative soak with total Dream
   Machine resident memory at or below 2.5 GB, p95 CPU at or below two A53 cores,
   no monotonic memory growth above 5 percent after warmup, and no brownout on a
   rated supply.
2. The system reaches observation ready within 120 seconds after power on.
3. A 12 hour bedtime run sends zero packets outside the configured local
   subnet. All essential observation, memory, policy, MCP, and stop behavior
   works with the WAN physically disconnected.
4. Raw radar and CSI are not persisted by default. Enabling the calibration
   ring buffer requires an explicit, expiring local consent and records that
   consent in the evidence log.
5. The release bundle verifies signature, hashes, SBOM, firmware, policy,
   models, and cue assets before activation. A failed check leaves the current
   slot active.
6. Rollback to the previous verified slot completes within 60 seconds and
   preserves the encrypted profile and evidence ledger.
7. Security completion includes dependency audit, secret scan, static analysis,
   ticket and URI fuzzing, network exposure review, threat model review, and a
   clean rescan after every confirmed critical or high fix.

## 7. References

1. [Dream Machine ADR-0001](./ADR-0001-dream-machine-engine.md)
2. [Arduino UNO Q hardware](https://docs.arduino.cc/hardware/uno-q/)
3. [Arduino UNO Q user manual](https://docs.arduino.cc/tutorials/uno-q/user-manual/)
4. [Arduino Router RPC](https://docs.arduino.cc/tutorials/uno-q/routerbridge-multilanguage/)
5. [Arduino UNO Q security hardening guide](https://docs.arduino.cc/tutorials/uno-q/security-hardening-guide/)
6. [Arduino UNO Q power specification](https://docs.arduino.cc/tutorials/uno-q/power-specification/)
7. [Arduino UNO Q 4 GB product page](https://store-usa.arduino.cc/products/uno-q-4gb)
8. [RuView repository and HOMECORE overview](https://github.com/ruvnet/RuView)
9. [RuView HOMECORE Assist and Ruflo ADR](https://github.com/ruvnet/RuView/blob/main/docs/adr/ADR-133-homecore-assist-ruflo.md)
10. [Seeed MR60BHA2 getting started guide](https://wiki.seeedstudio.com/getting_started_with_mr60bha2_mmwave_kit/)
11. [Seeed MR60BHA2 module datasheet](https://files.seeedstudio.com/wiki/mmwave-for-xiao/mr60/datasheet/MR60BHA2_Breathing_and_Heartbeat_Module.pdf)
12. [Seeed MR60BHA2 product page](https://www.seeedstudio.com/MR60BHA2-60GHz-mmWave-Sensor-Breathing-and-Heartbeat-Module-p-5945.html)
13. [Espressif ESP32 C6 WiFi CSI configuration](https://docs.espressif.com/projects/esp-idf/en/stable/esp32c6/api-guides/wifi-driver/wifi-vendor-features.html)
14. [Espressif ESP CSI examples](https://github.com/espressif/esp-csi)
15. [MCP 2026 transports](https://modelcontextprotocol.io/specification/2026-07-28/basic/transports)
16. [MCP 2026 resources](https://modelcontextprotocol.io/specification/2026-07-28/server/resources)
17. [MCP 2026 tools](https://modelcontextprotocol.io/specification/2026-07-28/server/tools)
18. [MCP security best practices](https://modelcontextprotocol.io/docs/2026-07-28/tutorials/security/security_best_practices)
19. [RFC 8949, CBOR](https://www.rfc-editor.org/rfc/rfc8949)
20. [RFC 8032, Ed25519](https://www.rfc-editor.org/rfc/rfc8032)
