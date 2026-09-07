# ADR-0102: Apple Watch HealthKit local bridge with retrospective default and research-only live sensing

- **Status**: Proposed
- **Date**: 2026-09-04
- **Deciders**: ruv
- **Related**: ADR-0100, ADR-0101, `docs/contracts/edge-v1/README.md`
- **Tags**: apple-watch, healthkit, watchos, ios, watch-connectivity, local-first, privacy, ruvector, advisory-sensor, research
- **Scope**: Apple Watch observations, the companion iPhone bridge, local delivery to the bedside runtime, and the boundary between wearable evidence and actuation

---

## 1. Context

Dream Machine can benefit from a wearable reference signal when it estimates
sleep context and evaluates how a person responds over months. Apple Watch can
contribute sleep stages, heart rate, heart-rate variability, respiratory rate,
sleeping wrist temperature, oxygen saturation on supported devices, and motion
features collected by a foreground or appropriately entitled watchOS app.

Those data do not form a deterministic real-time control channel. HealthKit
read authorization is intentionally opaque, the HealthKit store may be
unreadable while the iPhone is locked, overnight metrics can be post-processed,
WatchConnectivity background delivery is opportunistic, and hardware or
regional restrictions can remove individual metrics. A wearable can therefore
strengthen a state estimate but cannot establish consent, authorize a cue, or
replace bedside sensing and the independent actuator safety controller defined
by ADR-0100 and ADR-0101.

Apple platform policy creates another boundary for a self-evolving system. An
App Store application may adapt data, representations, and bounded model
parameters, but it may not download or execute code that changes application
functionality. Autogenous or another generator may propose a new Apple client,
model, or policy on the Mac Studio build plane; a human-reviewed signed release
must deliver executable changes.

This ADR separates two product modes:

1. **Post-night mode** imports authorized Apple Watch observations from
   HealthKit on the companion iPhone after the night. It is the production
   default and does not require a custom watchOS application.
2. **Live research mode** runs an explicitly started watchOS collection
   session for motion and higher-frequency heart-rate evidence. It is a
   separately gated research lane, not a production dependency.

### 1.1 Evidence boundary

| Capability or constraint | Status on 2026-09-04 | Consequence for this ADR |
|---|---|---|
| HealthKit stores health and fitness data from iPhone, Apple Watch, and authorized applications | Verified in Apple HealthKit documentation | Read Apple Watch observations through the iPhone HealthKit store in the default mode |
| HealthKit exposes sleep-analysis categories including awake, Core, Deep, and REM | Verified in Apple HealthKit documentation | Preserve source categories and timestamps; do not claim laboratory sleep staging accuracy |
| HealthKit observer queries can request background delivery, and anchored queries return incremental inserts and deletions | Verified in Apple HealthKit documentation | Use an observer as a wake-up signal and an anchored query as the source of data |
| An application cannot determine whether a person denied HealthKit read access | Verified in Apple authorization documentation | Represent a missing read as unavailable or not observed, never as a known denial |
| The HealthKit store is encrypted while the device is locked and a read can fail with `errorDatabaseInaccessible` | Verified in Apple privacy and error documentation | Complete the background callback, record deferred work, and retry after protected data becomes available |
| `HKWorkoutSession` produces higher-frequency heart-rate samples and requires the workout-processing background mode on watchOS | Verified in Apple workout documentation | Evaluate it only in an explicit research build; do not use it as a hidden generic background keepalive |
| A smart-alarm `WKExtendedRuntimeSession` can run in the background for a bounded 30-minute window | Verified in Apple WatchKit documentation | It may support a final wake window experiment but cannot provide full-night runtime |
| WatchConnectivity interactive messages require reachability; background application-context, user-info, and file transfers are not immediate | Verified in Apple WatchConnectivity documentation | Buffer, sequence, acknowledge, and tolerate delay; never place WatchConnectivity in the safety path |
| Sleeping wrist temperature requires supported hardware and several qualifying nights; oxygen saturation varies by hardware, age, and region | Verified in Apple support documentation | Capability-detect these metrics and encode absence as `null`, not zero |
| HealthKit data may not be used for advertising or general-purpose data mining, and human-subject health research requires consent and independent ethics review | Verified in Apple App Review Guidelines | Keep processing local, purpose-bound, consented, deletable, and non-advertising |
| A Dream Machine iOS companion, watchOS research target, secure local bridge, and Apple Health RuVector adapter exist | Proposed by this ADR | Implement and pass this ADR's test contract before describing them as shipped |

### 1.2 Objective

Build a local bridge that can:

1. Import authorized Apple Watch observations without requiring cloud service
   or account infrastructure.
2. Preserve timestamp, source, revision, quality, deletion, and consent
   provenance through normalization and RuVector storage.
3. Resume safely after phone lock, process termination, delayed Apple
   processing, Watch disconnection, pod disconnection, duplicate delivery, or
   schema change.
4. Provide an opt-in research path for low-bandwidth live motion and heart-rate
   features without making that path a product or actuator dependency.
5. Support longitudinal learning while keeping wearable data advisory and all
   adaptive changes inside signed, reviewable policy bounds.

### 1.3 Non-goals

This program does not diagnose sleep or cardiovascular conditions, reproduce
polysomnography, guarantee a sleep stage in real time, infer a HealthKit
permission decision, use Apple Watch as an emergency monitor, command an
actuator from the Watch, write generated conclusions back to HealthKit, upload
health data to a public service, or use a workout session to obtain undeclared
background execution.

## 2. Decision

### 2.1 Make post-night iPhone HealthKit import the default

The iPhone companion reads only the data types that a person enables and that
are necessary for the selected local feature:

| HealthKit type | Default | Expected timing | Dream Machine use |
|---|---:|---|---|
| `HKCategoryTypeIdentifier.sleepAnalysis` | On | Retrospective | Episode boundaries and reference stage labels |
| `HKQuantityTypeIdentifier.heartRate` | On | Periodic and retrospective | Personal overnight range and radar calibration |
| `HKQuantityTypeIdentifier.heartRateVariabilitySDNN` | On | Sparse and retrospective | Longitudinal recovery context with coverage flag |
| `HKQuantityTypeIdentifier.respiratoryRate` | On | Retrospective | Personal overnight range and radar calibration |
| `HKQuantityTypeIdentifier.appleSleepingWristTemperature` | Off until selected and supported | Retrospective after device baseline | Slow contextual feature, never a cue trigger |
| `HKQuantityTypeIdentifier.oxygenSaturation` | Off until selected and supported | Sparse and hardware-dependent | Optional research context, never a cue trigger |

The application requests read access after an in-context explanation. It does
not request HealthKit write access in the first implementation. Each metric has
its own toggle, purpose text, retention statement, current observation status,
and deletion control. A missing metric remains a typed absence with an
explanation that the application cannot distinguish unavailable data from a
read decision.

`HealthObserverRegistry` registers exactly one `HKObserverQuery` per enabled
type at application launch and enables HealthKit background delivery. An
observer callback carries no sample payload. It schedules a serialized
`HKAnchoredObjectQuery` for that type, using an encrypted local
`HKQueryAnchor`. The importer performs one atomic transaction:

1. Read inserts and `HKDeletedObject` tombstones after the current anchor.
2. Validate and normalize the delta.
3. Encrypt and persist a delivery batch and its candidate next anchor.
4. Commit the batch and next anchor together.
5. Call the observer completion handler promptly, including on a deferred or
   recoverable failure.

Concurrent or repeated callbacks collapse onto the same per-type actor. A
process crash commits both the durable batch and its anchor or neither. The
receiver implements idempotency because network delivery remains at least once.

The importer also runs when the application becomes active and when protected
data becomes available. These foreground reconciliation paths are mandatory;
background delivery is an optimization rather than a completeness assumption.

### 2.2 Preserve revisioned nights rather than invent one final record

The bridge stores source observations before deriving a canonical timeline.
It does not destructively merge overlapping Apple or third-party sleep samples.
The deterministic night assembler:

1. Stores timestamps in UTC plus the observed time-zone offset.
2. Uses `HKMetadataKeyTimeZone` when present and records an explicit fallback
   when it is absent.
3. Groups sleep intervals separated by at most 90 minutes into an episode.
4. Assigns the night identifier from the local date on which the principal
   episode ends.
5. Marks a night provisional until two hours after the latest episode end and
   at least 15 minutes after its latest source update.
6. Creates a new monotonic revision for late inserts, source corrections, or
   deletions and deterministically recomputes affected derived features.
7. Associates every derived feature with its transform version, source set,
   coverage ratio, and quality flags.

RuVector may retain a long-lived summary or embedding only after the night is
eligible for learning. A provisional revision may support a user-visible
summary but does not become a positive or negative contrastive exemplar.

### 2.3 Keep Apple Watch advisory at every authority boundary

Every wearable event has `authority: "none"`. It can contribute to:

1. Offline comparison between radar estimates and wearable reference values.
2. Per-person baselines, coverage models, and sensor-reliability weights.
3. Post-night outcome features for a consented experiment.
4. Shadow evaluation of a candidate fusion or cue-selection policy.

It cannot establish presence, arm a session, satisfy a minimum local signal
quality requirement by itself, authorize or schedule a cue, expand an
actuator envelope, modify consent, promote a model, or suppress a hardware
fault. Missing or contradictory wearable data lowers evidence quality and
never selects the more permissive action.

The independent policy and MCU safety planes accept no Watch-specific command
type. The only path from a Watch observation to physical output is a future
human-promoted policy that consumes a versioned derived feature and still
passes the local sensor, consent, dose, timing, and hardware gates in ADR-0101.

### 2.4 Isolate live watchOS collection as an opt-in research lane

Live research collection is compiled behind
`DREAM_MACHINE_LIVE_WATCH_RESEARCH`, uses a separate scheme and entitlement
review, and remains disabled in a production capability manifest. Starting a
session requires explicit confirmation on both the iPhone and Watch for that
night. It cannot be scheduled silently by an agent, MCP client, voice command,
automation, or prior consent.

The feasibility implementation may use `HKWorkoutSession` with
`HKLiveWorkoutBuilder` for heart rate and Core Motion for movement. The product
must describe the session honestly, show a persistent collection state, offer
stop controls on both devices, and end on consent expiry, user stop, Watch
unpairing, session error, serious thermal state, or low battery. It must not
hide or misclassify a workout merely to retain execution time.

Raw motion stays on the Watch. The first research profile samples device motion
at 25 Hz, falling to 10 Hz under a declared power-degradation policy, and emits
one aggregate every five seconds:

1. Acceleration root mean square.
2. Jerk root mean square.
3. Rotation-rate root mean square.
4. Posture-change count.
5. Motion sample coverage.
6. Last and mean heart rate when delivered by HealthKit.
7. Battery level, thermal state, and collection quality flags.
8. Wall-clock timestamp, Watch uptime, clock-sync identifier, and estimated
   clock uncertainty.

`WCSession.sendMessageData` is used only when the iPhone is reachable and the
message is small. A missing acknowledgement falls back to queued
`transferUserInfo` delivery. Each frame has a session identifier and monotonic
sequence. The iPhone deduplicates frames and returns the highest contiguous
sequence through interactive acknowledgement or application context.

The Watch persists an encrypted, bounded outbox large enough for one 10-hour
session, initially 8 MiB. If it cannot retain a new frame without losing an
unacknowledged frame, it stops live collection, records a terminal gap, and
shows the failure. It never silently overwrites research data.

A smart-alarm `WKExtendedRuntimeSession` may be tested as a separate final
30-minute wake-window mode. It does not satisfy full-night collection and is
not used to imply live access to Apple-derived sleep stages, HRV, respiratory
rate, wrist temperature, or oxygen saturation. Those remain retrospective.

### 2.5 Use explicit versioned schemas

The implementation uses Protocol Buffers shared by Swift and the bedside
runtime. It avoids maps in signed messages and rejects unknown fields in the
signed envelope. The iPhone serializes once and signs those exact payload
bytes. The pod verifies the signature over the received bytes before parsing
and never reserializes a message to verify it. Protocol Buffer semantic
equivalence is not treated as canonical byte equivalence across languages.

The normalized post-night observation is logically equivalent to:

```text
AppleHealthObservationV1 {
  schema                 "dream.apple-health.observation.v1"
  event_id               UUID
  sample_ref             HMAC(pairing_key, healthkit_sample_uuid)
  subject_id             local pseudonymous identifier
  consent_epoch          uint64
  night_id               local date identifier
  night_revision         uint32
  metric                 sleep_stage | heart_rate | hrv_sdnn |
                         respiratory_rate | sleeping_wrist_temperature |
                         oxygen_saturation
  start_unix_ms           int64
  end_unix_ms             int64
  timezone_offset_min     int32
  numeric_value           optional finite double
  categorical_value       optional awake | core | deep | rem | asleep_unspecified
  unit_ucum                optional /min | ms | Cel | %
  source_kind             apple_watch | other_wearable | manual | unknown
  source_ref              pairing-scoped HMAC
  algorithm_revision      optional bounded string
  transform_version       bounded string
  quality_flags           repeated enum
  coverage_ratio          optional double in [0, 1]
  authority               constant "none"
}
```

The live aggregate is logically equivalent to:

```text
AppleWatchLiveFrameV1 {
  schema                  "dream.apple-watch.live-frame.v1"
  session_id              UUID
  sequence                uint64
  subject_id              local pseudonymous identifier
  consent_epoch           uint64
  window_start_unix_ms    int64
  window_end_unix_ms      int64
  watch_uptime_ns         uint64
  clock_sync_id           UUID
  clock_uncertainty_ms    finite double >= 0
  mean_heart_rate_bpm     optional finite double
  last_heart_rate_bpm     optional finite double
  acceleration_rms_g      finite double >= 0
  jerk_rms_g_per_sec      finite double >= 0
  rotation_rms_rad_sec    finite double >= 0
  posture_change_count    uint32
  motion_coverage_ratio   double in [0, 1]
  battery_percent         uint8 in [0, 100]
  thermal_state           nominal | fair | serious | critical
  quality_flags           repeated enum
  authority               constant "none"
}
```

The iPhone-to-pod batch is logically equivalent to:

```text
AppleHealthBatchV1 {
  schema                  "dream.apple-health.batch.v1"
  batch_id                UUID
  bridge_id               local pseudonymous identifier
  subject_id              local pseudonymous identifier
  consent_epoch           uint64
  created_unix_ms         int64
  previous_batch_hash     optional bytes32
  observations            repeated AppleHealthObservationV1
  live_frames             repeated AppleWatchLiveFrameV1
  deleted_sample_refs     repeated bytes32
}

SignedEnvelopeV1 {
  key_id                  bounded string
  payload                 serialized AppleHealthBatchV1 bytes
  signature_p256          bytes
}
```

Validation rejects non-finite numbers, inverted or excessive intervals,
timestamps beyond the declared skew allowance, unknown required enums,
undeclared units, duplicate identifiers with different content, unsupported
schemas, oversized messages, expired consent epochs, invalid signatures, and
replayed batches. Broad physiological range checks create quality flags or
reject structurally impossible values; they do not make medical judgments.

### 2.6 Bridge through the paired iPhone over an authenticated local channel

The Apple Watch does not connect directly to UNO Q or RuView HOMECORE. The
paired iPhone is the privacy, authorization, persistence, and protocol bridge.

The bedside service advertises `_dreammachine._tcp` through Bonjour. The iOS
application declares `NSLocalNetworkUsageDescription` and the exact Bonjour
service type. Pairing requires a physical action on the pod and a one-time QR
code or short code that binds the service identity and certificate
fingerprint. The invitation expires after 60 seconds.

The iPhone creates a P256 signing key in Secure Enclave where supported, with
a `ThisDeviceOnly` Keychain fallback. The pod stores the public key and consent
scope. Connections use TLS 1.3 with the paired pod certificate pinned. Every
batch is additionally signed, sequence checked, hash chained, and idempotent.
The transport accepts only the selected Bonjour service and does not fall back
to a public hostname, cellular interface, public IP address, or unpinned
certificate.

WatchConnectivity supplies paired-device transport, not end-to-end authority.
The live Watch target uses a separate per-installation session key in its
Keychain. The iPhone verifies sequence and authentication, normalizes the
frame, and signs the pod batch with the iPhone bridge key. The pod never treats
a Watch frame as a command.

The iPhone stores pending batches in an authenticated-encryption envelope with
Data Protection enabled. The initial outbox ceiling is 128 MiB. A candidate
HealthKit anchor advances only after its batch is durably committed locally.
If the outbox reaches its ceiling, the bridge pauses anchor advancement and
informs the person instead of losing an unacknowledged delta. HealthKit remains
the source of truth for later reconciliation.

### 2.7 Minimize, isolate, and delete health data

The privacy defaults are:

1. No account and no public Internet dependency.
2. No CloudKit, iCloud document, remote analytics, advertising SDK, remote
   crash payload, or third-party health export.
3. No raw HealthKit UUID, serial number, stable Apple device identifier, raw
   motion stream, journal text, or health value in ordinary logs.
4. Pairing-scoped pseudonyms so separate installations cannot be correlated.
5. Proposed raw normalized retention of 30 days and derived local-summary
   retention of 400 days, both visible and configurable before learning begins.
6. Immediate collection stop on local revocation and explicit controls to
   delete pending iPhone data, Watch research data, pod observations, derived
   features, and RuVector embeddings.
7. HealthKit deletions produce signed tombstones. The pod removes the source
   record and recomputes dependent summaries and embeddings instead of leaving
   an orphaned derived fact.
8. Export is local, deliberate, encrypted, and separate from the normal MCP
   model context.

Apple health and fitness data are purpose-bound. They are not used for
advertising, marketing, sale, insurance, identity enrichment, unrelated model
training, or population-level mining. If a protocol constitutes human-subject
research, live collection remains disabled until the consent form, risks,
withdrawal procedure, confidentiality plan, contact, and independent ethics
approval are recorded.

The iOS and watchOS targets include accurate purpose strings and a
`PrivacyInfo.xcprivacy` manifest. The iPhone target enables the HealthKit and
HealthKit Background Delivery capabilities. The research Watch target enables
HealthKit, declares `NSMotionUsageDescription`, and enables
`workout-processing` only if the approved live implementation uses an actual
workout session.

### 2.8 Expose summaries and control state through least-privilege MCP resources

The canonical registry is
[`../contracts/edge-v1/mcp-registry.json`](../contracts/edge-v1/mcp-registry.json).
The Apple profile may expose:

```text
ruv://dream-machine/v1/subjects/self/nights/{nightId}/apple-watch/summary
ruv://dream-machine/v1/subjects/self/nights/{nightId}/apple-watch/quality
ruv://dream-machine/v1/subjects/self/apple-watch/sync-status
```

Raw health observations require a separate local consent scope and are not
placed in a general model prompt. SSE or Streamable HTTP notifications contain
resource identifiers, revision, coverage, and state only, never raw health
values.

The proposed MCP tools are `apple_watch_status`, `apple_watch_sync_now`,
`apple_watch_request_live_session`, `apple_watch_stop_live_session`, and
`apple_watch_delete_data`. Requesting a live session returns a pending local
confirmation and cannot start collection. Stopping and muting are always
safety-favored. Imported strings and metadata are typed data and can never be
interpreted as MCP instructions, prompts, resource identifiers, or executable
content.

### 2.9 Bound learning and self-optimization

RuVector stores validated observations, versioned derived summaries, coverage,
and provenance as distinct records. The contrastive learner may compare:

1. The person's current night with that person's historical baseline.
2. Radar estimates with time-aligned Watch reference observations.
3. Cue and no-cue outcomes in a predeclared experiment.
4. Candidate sensor-reliability weights against a held-out time period.

It may update personal baselines, embeddings, confidence calibration, and
parameters inside a signed envelope. It may not use a provisional night as a
promotion result, fill missing values with confident predictions, change
retention or consent, increase cue intensity or duration, modify an evaluator,
download executable Apple code, or promote a candidate. Autogenous changes to
the Swift client, schema, or transform return to the Mac Studio build, replay,
security, benchmark, review, and signed-release workflow.

## 3. Failure modes and required behavior

| Failure | Detection | Required behavior |
|---|---|---|
| HealthKit store is locked | `errorDatabaseInaccessible` or protected data unavailable | Mark work deferred, call the observer completion handler, and retry on unlock or foreground reconciliation |
| Read access is absent or data do not exist | Empty authorized query result | Report `not_observed`; do not infer denial, zero, normality, or sensor failure |
| Observer callback repeats or overlaps | Per-type actor already running | Coalesce work and rely on the anchor and sample reference for idempotency |
| Application crashes between read and persistence | Incomplete local transaction | Commit both encrypted batch and next anchor or neither, then replay safely |
| Apple delivers a late correction | Insert or deletion after a provisional night | Create a new night revision and recompute dependent features |
| HealthKit source sample is deleted | `HKDeletedObject` from anchored query | Send a tombstone, remove the raw pod record, and recompute derived state |
| Watch cannot reach iPhone | `WCSession.isReachable == false` or send error | Queue a background transfer, retain the Watch outbox, and mark live quality degraded |
| iPhone cannot reach Watch | Reachability or activation change | Continue post-night mode; never block bedside safety or retrospective HealthKit import |
| Pod is offline | Bonjour absence, connection failure, or missing receipt | Retain encrypted iPhone outbox with backoff and foreground retry |
| Outbox is full | Capacity check before commit | Pause cursor advancement or live collection visibly; never overwrite unacknowledged data |
| Batch is duplicated or reordered | Batch identifier, hash chain, and receiver journal | Return the original receipt for a duplicate and quarantine an invalid chain |
| Clock uncertainty exceeds 3 seconds | Periodic four-timestamp phone and Watch exchange | Mark frame unsuitable for same-night timing while retaining it for coarse retrospective analysis |
| Watch battery falls below 20 percent | Local battery monitor | End live collection, persist a terminal event, and leave native sleep tracking undisturbed |
| Thermal state becomes serious or critical | Process thermal state | Stop live research collection within five seconds at either state, persist a terminal event, and record the reason |
| Pairing or certificate changes | Key identifier or pinned fingerprint mismatch | Refuse the connection and require a new physical pairing ceremony |
| Consent epoch is stale | Receiver scope comparison | Reject the payload and create no RuVector event |
| Schema, range, size, or signature is invalid | Strict parser and verifier | Reject or quarantine metadata, create no observation, and expose no actuator effect |
| Apple changes an algorithm or source revision | Source revision differs from prior data | Preserve provenance, start a new calibration segment, and prevent silent baseline mixing |
| Live research capability is unavailable | Missing hardware, entitlement, session, or approval | Disable the lane and retain fully functional post-night mode |

## 4. Consequences

1. The first useful Apple integration is an iPhone companion rather than a
   watchOS application. This reduces power, background-runtime, transport, and
   App Review risk.
2. The production system gains longitudinal reference evidence but cannot use
   Apple-derived sleep stages to time a cue in the same night. Bedside radar
   remains the real-time source.
3. The bridge remains complete under delayed background execution because it
   reconciles from durable HealthKit anchors when the application next runs.
4. Source deletion and late processing make a night revisioned rather than
   immutable. Downstream embeddings and experiments must bind a revision.
5. A live research lane adds an Apple application, signing, entitlement,
   WatchConnectivity, battery, App Review, and human-research burden. It is
   justified only if measured information gain exceeds that cost.
6. Local-only processing avoids a cloud health-data service but still requires
   strong local authorization, encryption, deletion, and shared-household
   isolation.
7. Watch data can improve radar calibration and longitudinal learning without
   creating a single point of failure or an actuator authority path.
8. Apple client self-evolution remains a governed release process. Runtime
   learning cannot rewrite the signed application or expand its declared
   capabilities.

## 5. Alternatives considered

### 5.1 Make an all-night watchOS application mandatory

Rejected. The default data already arrive through HealthKit on iPhone, while a
mandatory Watch process increases battery use, signing complexity, background
runtime risk, and installation friction.

### 5.2 Use `HKWorkoutSession` as an invisible full-night keepalive

Rejected. Workout processing is intended for a declared workout, can alter
sensor behavior and battery use, and must not be abused merely to obtain
background execution. A transparent research session may be evaluated, but it
does not become the production default without Apple-policy and study approval.

### 5.3 Use a smart-alarm extended runtime session for the whole night

Rejected. Apple's smart-alarm mode supplies a bounded 30-minute background
window, not arbitrary overnight execution.

### 5.4 Connect Apple Watch directly to the bedside pod

Rejected. HealthKit authorization and the complete retrospective store are on
Apple platforms, Watch network execution is constrained, and direct transport
would duplicate pairing and privacy logic. The companion iPhone is the bridge.

### 5.5 Upload to a cloud API and let the pod download data

Rejected as the default. It adds an account, Internet dependency, remote
attack surface, privacy disclosure, retention jurisdiction, and service
availability to a system whose core value is local learning.

### 5.6 Stream raw accelerometer and gyroscope samples

Rejected. Five-second local aggregates retain the initial sleep-movement
signal while greatly reducing power, bandwidth, storage, and biometric detail.
Raw capture may exist only in a separately consented validation protocol with
short retention.

### 5.7 Let a Watch state or gesture command a cue

Rejected. Watch observations and transport are delayed and optional, and a
wearable does not possess actuator authority. A Watch can request stop or mute
because those transitions reduce risk.

### 5.8 Write Dream Machine conclusions back to HealthKit

Rejected for the first implementation. Generated sleep conclusions could be
mistaken for measured health facts, require write authorization, and complicate
deletion and provenance. Local summaries remain in Dream Machine.

### 5.9 Do not support a wearable

Retained as a valid deployment profile. Radar-only operation must remain fully
functional. Apple Watch is an optional calibration and longitudinal evidence
source, not a system requirement.

## 6. Benchmark gates

### 6.1 Post-night production gate

| Measure | Gate | Measurement boundary |
|---|---:|---|
| Normalize, encrypt, and durably enqueue 10,000 synthetic samples | Less than 2 seconds at p95 | Oldest supported physical iPhone, excluding OS callback delay |
| Deliver and acknowledge a 1,000-sample batch on a healthy local network | Less than 5 seconds at p95 | First connection attempt to verified receipt |
| Recovery under randomized process termination | Zero missing committed events and zero duplicate receiver records across 10,000 injected crash points | Query, transaction, upload, receipt, and cleanup boundaries |
| Source-deletion propagation | Less than 60 seconds after observer or foreground reconciliation begins while protected data and pod connectivity are available | Reconciliation start to verified pod receipt |
| Incremental receiver idempotency | 100 percent consistent receipts for 100,000 duplicate or reordered batches | Pod ingest journal |
| Public network privacy | Zero public IP connections and zero public DNS queries in 24 hours | Packet capture of iPhone application and pod bridge |
| Added Watch battery cost | No more than 2 percentage points median across five matched nights | Native sleep tracking with and without post-night bridge enabled |
| Advisory boundary | Zero dependency paths from Apple schemas or bridge packages to an actuator driver | Static architecture test and runtime capability matrix |

HealthKit background callback delay is recorded as an operational distribution,
not a release gate, because Apple does not guarantee delivery timing. The
deletion latency gate begins only when observer or foreground reconciliation
actually starts and protected data plus pod connectivity are available.

### 6.2 Live research gate

| Measure | Gate | Measurement boundary |
|---|---:|---|
| Five-second aggregate arrival while reachable | Less than 2 seconds at p95 after window close | Watch frame close to pod receipt |
| Clock alignment | Less than 1 second uncertainty at p95 and no frame above 3 seconds used for same-night fusion | Periodic four-timestamp exchanges |
| Frame completeness without induced outage | At least 99 percent | Ten-hour physical-device session |
| Recovery after a 30-minute transport outage | At least 99.5 percent of retained frames received within 10 minutes of reconnection | Watch outbox through pod receipt |
| Watch outbox capacity | One 10-hour session within 8 MiB | Serialized encrypted frames and journal |
| Watch memory | Less than 50 MiB peak with no jetsam or session termination | Physical-device Instruments run |
| Additional Watch battery drain | No more than 25 percentage points median versus native sleep tracking across five matched nights | Release build, disconnected from debugger, start battery at least 80 percent |
| Stop behavior | Sampling ends within 5 seconds of user stop, consent revocation, serious or critical thermal state, or low-battery trigger | Physical device receipt and signpost trace |
| Invalid-frame safety | Zero accepted frames and zero actuator effects from 1,000,000 malformed, unsigned, stale, replayed, or oversized frames | Swift and bedside fuzz targets |

Failure of a live gate leaves post-night mode available and keeps the live
capability disabled. Aggregate information gain is measured against radar-only
state estimates before the additional Watch burden is accepted.

## 7. Test contract

This ADR is satisfied only when the repository and device lab retain evidence
for all of the following:

1. Cross-language golden vectors prove that a fixed reference Swift payload is
   decoded and validated identically by Swift and the bedside runtime, and that
   both verify and hash the exact received bytes. Re-encoding is compared for
   semantics only and is never part of signature verification.
2. Unit tests use an injected `HealthStoreClient`; correctness does not depend
   on the simulator producing realistic health samples.
3. Anchor transaction tests inject termination before and after every durable
   write and prove that a delta and its next anchor commit together or neither
   commits.
4. Observer tests cover repeated registration, simultaneous callbacks, empty
   results, locked store, permission-opacity behavior, late samples, source
   correction, and `HKDeletedObject` propagation.
5. Night-assembly tests cover overlapping sources, manual samples, missing time
   zone metadata, daylight-saving transitions, cross-time-zone travel, split
   sleep, naps, late revisions, and deletion-driven recomputation.
6. Transport tests cover inactive and unreachable counterparts, duplicate and
   reordered Watch frames, queued background transfer, phone and Watch reboot,
   full outboxes, pod outage, corrupt receipts, IPv4, IPv6, Bonjour rename,
   multiple spoofed services, certificate mismatch, and key rotation.
7. Privacy tests inspect the built entitlements, purpose strings, privacy
   manifest, linked SDKs, Keychain accessibility, file protection, logs,
   network destinations, export behavior, and complete deletion graph.
8. Security tests submit at least 1,000,000 invalid envelopes with zero parser
   crashes, zero accepted unauthorized observations, zero MCP instruction
   interpretation, and zero actuator effects.
9. Static dependency tests prove that Apple bridge modules can import only
   observation, persistence, transport, and summary interfaces and cannot
   import the cue broker, ticket signer, MCU RPC client, or actuator driver.
10. Capability-matrix tests prove that radar-only operation remains complete,
    post-night mode cannot start live collection, and only a signed research
    manifest plus same-session local confirmation can enter live mode.
11. Physical-device tests cover the oldest and current supported iPhone, a
    Watch without wrist temperature, a Watch with wrist temperature, an oxygen
    saturation restricted configuration, oldest supported operating systems,
    current stable operating systems, Low Power Mode, phone lock, airplane
    mode, WiFi loss, unpairing, re-pairing, app termination, and OS update.
12. Overnight battery, background, and WatchConnectivity tests run from a
    TestFlight or release build disconnected from Xcode. Simulator or debugger
    behavior is not accepted as production evidence.
13. A 30-night shadow alpha compares radar-only estimates with radar plus Watch
    reference observations, publishes missingness and uncertainty, and makes
    no automatic promotion. A claimed improvement requires a held-out period,
    declared metric, effect size, uncertainty, and adverse-event accounting.
14. End-to-end deletion removes the selected source events, pending batches,
    derived night revisions, RuVector records, embeddings, and MCP resources,
    then returns a signed local receipt without deleting unrelated data.
15. A 24-hour offline test completes import reconciliation, local delivery,
    revision, summary, memory update, status inspection, stop, and deletion
    with zero required Internet egress.

## 8. References

- [Apple HealthKit](https://developer.apple.com/documentation/healthkit)
- [Authorizing access to health data](https://developer.apple.com/documentation/healthkit/authorizing-access-to-health-data)
- [Reading data from HealthKit](https://developer.apple.com/documentation/healthkit/reading-data-from-healthkit)
- [Protecting user privacy](https://developer.apple.com/documentation/healthkit/protecting-user-privacy)
- [HealthKit queries](https://developer.apple.com/documentation/healthkit/queries)
- [HealthKit sleep analysis](https://developer.apple.com/documentation/healthkit/hkcategorytypeidentifier/sleepanalysis)
- [Sleeping wrist temperature](https://developer.apple.com/documentation/healthkit/hkquantitytypeidentifier/applesleepingwristtemperature)
- [HealthKit Background Delivery entitlement](https://developer.apple.com/documentation/bundleresources/entitlements/com.apple.developer.healthkit.background-delivery)
- [Running workout sessions](https://developer.apple.com/documentation/healthkit/running-workout-sessions)
- [HKWorkoutSession](https://developer.apple.com/documentation/healthkit/hkworkoutsession)
- [WatchConnectivity data transfer](https://developer.apple.com/documentation/watchconnectivity/transferring-data-with-watch-connectivity)
- [There and back again: Data transfer on Apple Watch](https://developer.apple.com/videos/play/wwdc2021/10003/)
- [Using extended runtime sessions](https://developer.apple.com/documentation/watchkit/using-extended-runtime-sessions)
- [WKBackgroundModes](https://developer.apple.com/documentation/bundleresources/information-property-list/wkbackgroundmodes)
- [Core Motion](https://developer.apple.com/documentation/coremotion)
- [TN3179: Understanding local network privacy](https://developer.apple.com/documentation/technotes/tn3179-understanding-local-network-privacy)
- [Privacy manifest files](https://developer.apple.com/documentation/bundleresources/privacy-manifest-files)
- [App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- [Track overnight vitals with Apple Watch](https://support.apple.com/en-us/120142)
- [Track nightly wrist temperature on Apple Watch](https://support.apple.com/guide/watch/apd526d20feb/watchos)
- [Measure blood oxygen with Apple Watch](https://support.apple.com/guide/watch/blood-oxygen-apdaf17aa5ef/watchos)
- ADR-0100: Separate the control plane from the bedside runtime and actuator safety authority.
- ADR-0101: Governed edge runtime on Arduino UNO Q with RuView HOMECORE.
- `docs/contracts/edge-v1/README.md`: Versioned bedside observation and cue authority contracts.
