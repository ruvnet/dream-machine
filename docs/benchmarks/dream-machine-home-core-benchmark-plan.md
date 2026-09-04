# Dream Machine Home Core benchmark and acceptance contract

**Status:** Proposed and unmeasured

**Date:** 2026-09-04
**Baseline commit:** `7933c3599abe22df5290f4609d1f93f598feb3de`

Every number in this document is a gate or measurement plan unless it is
explicitly labeled as an observed repository baseline. Passing a synthetic test
does not establish clinical efficacy, sleep-stage accuracy, or dream influence.

## 1. Benchmark principles

1. Freeze the task, dataset, seeds, metrics, evaluator, exclusions, and resource
   budget before comparing a candidate.
2. Keep nightly and participant groups intact. Never split windows from one
   night across train and test.
3. Compare against the fixed policy, current champion, and one simpler adaptive
   baseline. A system is not state of the art because it contains more components.
4. Report absolute values, deltas, uncertainty, failed runs, exclusions, and nulls.
5. Run safety and privacy gates before benefit or throughput metrics. A safety
   failure cannot be offset by higher utility.
6. Separate Mac Studio development results from UNO Q target results.
7. Run five warmups followed by at least thirty measured iterations for latency
   and throughput. Report median, p95, p99, dispersion, host load, temperature,
   power context, versions, and exact command.
8. Disable unrelated work, record cache state, and either pin performance cores
   or report scheduler variability. Do not compare shared CI timing with an
   isolated local benchmark.
9. Bind every result to source commit, dataset digest, configuration digest,
   toolchain fingerprint, and artifact digest.
10. A missing evaluator, unavailable device, insufficient sample, or unstable
    measurement yields `INCONCLUSIVE`.

## 2. Benchmark environments

### Development control plane

Phase zero records the exact Mac model, Apple silicon generation, CPU and GPU
cores, memory, storage, macOS, Xcode, thermal state, power mode, Node.js, Rust,
Arduino CLI, and Ruflo versions. "Mac mini studio" is not a reproducible hardware
identifier and cannot be used in a performance claim.

### Bedside target

The target record includes UNO Q SKU, RAM, eMMC, Debian image, kernel, governor,
STM32 firmware, carrier, storage, power supply, radar firmware, external CSI node,
audio interface, amplifier, light and haptic drivers, enclosure, and ambient
temperature. The initial target is the 4 GB UNO Q variant.

### Apple target

Record iPhone and Watch model, battery health, region, operating-system build,
app build, connection state, Low Power Mode, debugger state, and native sleep
tracking configuration. Battery trials use release or TestFlight builds detached
from Xcode.

## 3. Observed repository baseline

On the baseline commit in the current Linux workspace:

| Check | Result |
|---|---|
| `npm ci` | Completed |
| `npm run build` | Passed |
| `npm test` | 98 of 98 passed across seven files |
| `npm run lint` | Passed |
| `npm run typecheck` | Failed with TS18002 because root `tsconfig.json` has an empty file set |
| Ruflo secret scan | 40 files scanned, no secret detected |
| Ruflo deep dependency scan | Eight development-tool candidates: two critical, one high, three medium, and two low; affected versions confirmed but critical and high exploit paths are disabled in the current CLI-only workflow |
| Ruflo dedicated dependency scan | Reported zero findings; conflicts with the deep all-type scan and verified upstream advisories and is not accepted as clearance |
| Ruflo CVE list | Reported no known dependency vulnerability; conflicts with verified upstream advisories and is not accepted as clearance |
| Ruflo STRIDE scan | One medium URL candidate; rejected as a false positive because it is the inert standard W3C DOM namespace literal in vendored Three.js |
| `npm audit --omit=dev --json` | Passed with zero findings across 13 production dependencies |
| Full `npm audit --json` | Inconclusive because it did not complete within 45 seconds |

These results establish repository behavior only. They do not validate any
planned edge component. The full finding-by-finding disposition and mandatory
P1 upgrade gate are in the
[dependency adjudication](../security/dependency-adjudication-2026-09-04.md).

## 4. Contract and parser benchmarks

| ID | Workload | Release gate |
|---|---|---|
| C01 | One million generated observation, proposal, safety-decision, ticket, HealthKit envelope, MCP, URI, RVF, and update inputs | Zero crash, hang, unbounded allocation, or unauthorized acceptance |
| C02 | Cross-language golden vectors in TypeScript, Rust, Swift, and STM32 host build | Byte-identical canonical payload and identical accept or reject reason |
| C03 | Duplicate, unknown, missing, oversized, noncanonical, replayed, expired, future, wrong-boot, wrong-policy, and wrong-consent fields | All rejected without clamping or repair |
| C04 | Resource URI mutation corpus | Zero traversal, encoded-separator, authority, or template bypass |
| C05 | Prompt-injection corpus in every text and metadata field | Zero tool, policy, network, signing, or actuator authority change |

The corpus generator and seeds are versioned. Adding a production parser adds a
corpus family before that parser can be released.

## 5. Safety-controller benchmarks

| ID | Metric | Initial gate |
|---|---|---|
| S01 | Native broker safety-decision latency | p99 below 50 ms on loaded UNO Q |
| S02 | State-window close to MCU dispatch | p99 below one second |
| S03 | Ticket verification to hardware schedule | p99 below 10 ms on STM32 |
| S04 | Ticket validity horizon | At most two seconds and monotonic only |
| S05 | Dedicated broker-liveness loss to all gates off | Below 100 ms or the measured hardware-safe bound, whichever is stricter |
| S06 | Physical mute or abort to all gates off | Below 100 ms |
| S07 | Reboot, Linux loss, MCU reset, full disk, clock fault, damaged policy, and watchdog | Ten thousand sequences, zero unsafe activation |
| S08 | Malformed cue requests | One million requests, zero out-of-envelope authorization |
| S09 | Long-run HIL | Seven consecutive eight-hour runs, zero duplicate cue, safety violation, data corruption, or unexplained reset |
| S10 | Rollback | Previous signed release active and verified within 60 seconds |
| S11 | Audio asset substitution, corruption, or peripheral hang | Zero unapproved content and gate closed within S05 |
| S12 | Stale, ambiguous, missing, or low-quality MCU safety snapshot | Every sleep cue denied with a specific receipt |

Measure actual sound pressure at the pillow, optical output, haptic acceleration,
current, temperature, duration, ramp, and cumulative duty cycle. Software values
alone are not physical safety evidence.

## 6. Signal and state benchmarks

The first release estimates opportunity, quality, and arousal. It does not claim
radar is equivalent to polysomnography or that radar alone reliably identifies REM.

| ID | Metric | Initial gate |
|---|---|---|
| G01 | Usable signal windows | Above 85 percent across 14 observation nights |
| G02 | State epoch computation | Each 30-second epoch completes in under one second |
| G03 | Event loss | Below 0.1 percent with induced restart and partition |
| G04 | Clock uncertainty | Explicit on every source; frames above the profile limit are excluded |
| G05 | Opportunity precision | Above 90 percent against the declared reference for the tested population |
| G06 | Calibration | Report balanced accuracy, sensitivity by state, specificity, Brier score, and expected calibration error |
| G07 | Occupancy ambiguity | Second occupant, bed exit, or uncertainty always produces silence |
| G08 | Arousal veto | Detected movement or instability cancels the cycle and is receipt backed |

G05 is a research target, not a release assertion. Results are stratified by
night, position, body type, bedding, room, device placement, and signal-quality
bin. Apple Watch is an optional reference and not ground truth; a laboratory
subset requires PSG or validated EEG and EOG.

## 7. RuVector and retrieval benchmarks

### Dataset

Create frozen synthetic sets at 1,000, 10,000, and 100,000 episodes, plus a
deidentified local set when consent permits. Ground-truth neighbors derive from
known generator factors and a blinded semantic rubric. Query groups cover common,
rare, adverse, out-of-distribution, deleted, migrated, and corrupt-index cases.

### Gates

1. Recall at 10 is at least 0.90 at 100,000 episodes.
2. Query latency is below 25 ms at p95 on UNO Q for the approved index size.
3. The eight-hour runtime uses no more than 2.5 GB resident memory on a 4 GB UNO Q
   and does not swap.
4. Write, close, reopen, query, delete, backup, restore, and index-corruption tests
   preserve or explicitly quarantine every committed record.
5. Backend telemetry reports the implementation that executed. A flat fallback
   cannot report `ruvector-rvf`.
6. Encoder or dimension mismatch fails closed and requires witnessed migration.
7. Deleted episodes disappear from native search, graph edges, browser cache,
   backup, and model-visible resources within the deletion SLO.

Compare native RuVector, the current deterministic flat baseline, and the
redacted WASM browser subset. Browser speed does not substitute for native
durability or policy integrity.

## 8. MCP and WebUI benchmarks

| ID | Metric | Initial gate |
|---|---|---|
| M01 | Read resource latency | p95 below 100 ms for cached summary and below 500 ms for bounded search |
| M02 | Concurrent local sessions | 20 clients without memory growth after disconnect |
| M03 | Subscription recovery | No duplicate logical event and gap explicitly reported |
| M04 | Oversized or slow request | Deadline and byte limit enforced without starving safety services |
| M05 | Authorization | Complete principal by tool by resource negative matrix passes |
| M06 | Origin and DNS rebinding | All unapproved origins and host changes rejected |
| M07 | Privacy | No P2, P3, or S0 value in generic events, browser storage, logs, or screenshots |
| M08 | Actuator reachability | No model-visible tool or resource reaches ticket minting or hardware output |

Request-scoped SSE and explicit resource subscriptions are measured separately.
A permanent legacy `/sse` endpoint is absent in production.

## 9. Apple bridge benchmarks

### Retrospective production path

1. Normalize, encrypt, and persist 10,000 synthetic samples in under two seconds
   at p95 on the minimum supported iPhone.
2. A reachable pod acknowledges 1,000 samples within five seconds at p95 after
   transmission begins.
3. Ten thousand crash injections yield zero missing committed event and zero
   duplicate pod record.
4. A HealthKit deletion reaches the pod within 60 seconds after observer or
   foreground reconciliation starts while protected data and the paired pod are
   available.
5. Five matched nights show no more than two percentage points of median Watch
   battery regression because the production path requires no custom Watch app.
6. Missing or delayed Apple data never suppresses radar safety and never
   authorizes a cue.

HealthKit observer delay is reported but not gated because the operating system
does not promise a callback schedule. The transfer clock starts when observer
or foreground reconciliation actually begins with protected data and pod
connectivity available.

### Optional live research path

1. Five-second feature windows arrive within two seconds of close at p95 while
   the counterpart is reachable.
2. Clock uncertainty remains below one second at p95 and below three seconds for
   any same-night fusion.
3. Frame completeness is at least 99 percent without induced outage.
4. After a 30-minute outage, at least 99.5 percent of buffered frames arrive
   within ten minutes of reconnection.
5. A ten-hour session fits in the fixed encrypted Watch outbox.
6. Additional median Watch battery drain is no more than 25 percentage points
   versus native sleep tracking across five matched nights.
7. Stop, revocation, serious thermal state, or low battery ends collection within
   five seconds.
8. Live mode remains disabled unless App Review feasibility and research
   governance are recorded.

## 10. Reliability, privacy, and energy benchmarks

| ID | Metric | Initial gate |
|---|---|---|
| R01 | Nightly runtime completion | Above 99 percent over observation period |
| R02 | Safe restart | Safety state within one second; observation resumed within 30 seconds |
| R03 | WAN egress | Zero public DNS query and zero unexpected connection in 24-hour capture |
| R04 | Local deletion | User content deleted within 60 seconds after all local devices are reachable |
| R05 | Power | Report idle, observation, inference, cue, and update watts; no unbounded thermal throttling |
| R06 | Storage | One year projected aggregate below the approved encrypted partition budget |
| R07 | Offline endurance | Seven eight-hour runs without Internet and without functionality loss |
| R08 | Queue pressure | Bounded degradation and explicit gaps; no silent data loss |

The initial engineering estimate is 6 to 15 watts for the bedside appliance.
This is not a pass criterion until the exact board, storage, audio path, and
enclosure are measured.

## 11. Learning and evolution benchmarks

### Comparators

1. Fixed human-approved schedule.
2. Fixed schedule with calibrated state gate.
3. Simple constrained contextual bandit with silence.
4. Current champion policy.
5. One-change Autogenous or Darwin candidate.

### Dataset discipline

1. At least 30 usable observation nights before automatic candidate generation.
2. At least 30 chronological replay nights per candidate.
3. Seven usable shadow nights with no actuation.
4. At least 14 prospective eligible exposures and 14 matched controls before a
   personal policy can advance.
5. The full influence comparison uses 14 baseline, 28 trained-cue, and 28 matched
   control nights.
6. At most ten percent exploration, one active generated candidate at a time,
   and one human approved bounded policy promotion per month.

### Promotion gates

1. Posterior probability of predefined benefit above 0.95.
2. Estimated sleep-harm probability below 0.05.
3. Cue-associated awakening increase below five percentage points.
4. Median wake-after-sleep-onset increase below five minutes.
5. No deterioration in distress, morning sleepiness, reliability, privacy, or energy.
6. Candidate beats its parent on chronological holdout and prospective controls.
7. No evaluator, rubric, holdout, exclusion, authority, or threshold mutation.
8. Any insufficient sample, disagreement, or failed invariant is `INCONCLUSIVE`
   or `REJECT`, never a promotion.

The primary influence metric is preregistered theme presence in the morning
report using a frozen local rubric and periodic blinded review. Dream recall,
lucidity, creativity, and user value are secondary and cannot compensate for
sleep disruption.

## 12. Practical and exotic profile comparisons

Every profile uses a separate signed capability manifest and benchmark. No
profile inherits another profile's data or actuator permissions.

| Profile | Baseline | Candidate value test | Hard boundary |
|---|---|---|---|
| Contactless sleep journal | Manual morning entry | Better completion and retrieval with no privacy loss | No cue actuator |
| Room wellness automation | Fixed thermostat and light schedule | Comfort or energy improvement | No health diagnosis |
| Elder check-in research | Simple presence rule | Fewer false alerts under consented protocol | Not emergency or fall-detection certification |
| Meditation or creativity | Fixed awake audio session | User value under randomized schedule | Awake use only in first release |
| Dream-theme research | Fixed trained audio cue | Theme incorporation with noninferior sleep | No dream-control claim |
| Haptic or light research | Audio champion or sham | Independent benefit and safety | Separate hardware ceiling and consent |
| LatentMesh remote nodes | Exact structured local transport | Better availability or bytes per useful decision | No semantic compression of safety fields |
| Multi-room ambient model | Independent room states | Useful calibrated fusion | No identity inference or cross-person memory |

Electrical, vestibular, ultrasound, magnetic, painful pressure, and automatic
scent delivery remain outside consumer profiles. Adding them requires a new ADR,
risk analysis, independent controller, research protocol, and regulatory review.

## 13. Evidence artifact

Each benchmark run produces:

```text
benchmark-manifest.json
toolchain.json
host.json
dataset-manifest.json
configuration.json
raw-measurements.jsonl
summary.json
tests.junit.xml
security.sarif
network-egress.json
energy.json
exclusions.json
provenance.intoto.jsonl
witness.json
```

The program level `evidence-manifest.json` links this benchmark manifest and
every other applicable completion artifact by SHA 256.

`summary.json` contains no result unless the raw measurement, environment, and
dataset digests resolve. The evidence bundle is immutable after the verdict.

## 14. Completion test

From a clean dedicated Mac account, build unsigned artifacts, disconnect WAN,
run the fixed simulator and security corpus, deploy to the inactive UNO Q slot,
complete a disconnected HIL run, import delayed and deleted HealthKit fixtures,
exercise MCP and WebUI, benchmark RuVector at 100,000 episodes, force a rollback,
and reproduce every digest and verdict. The test passes only if no untrusted
principal can authorize physical output and every unmet evidence condition is
reported as `INCONCLUSIVE` rather than success.
