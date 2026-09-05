# Edge safety simulator

`@dream-machine/edge-sim` is an executable, deterministic, nonactuating simulator.
It exercises the Edge Contract v1 ticket parser and authorization invariants
without hardware, network, serial, filesystem, wall clock, or real signing keys.
Its `virtualGateOpen` is a boolean in memory, never an output device.

## What is implemented

1. A uint64 microsecond virtual clock with deterministic timer boundaries.
2. Explicit `DISARMED → OBSERVE → ARMED` simulated physical events, latched
   `MUTED` and `FAULT`, simulated maintenance, and terminal disposal.
3. Synthetic radar observations, packet dropout and multiple occupants.
4. Canonical CBOR decoding and Ed25519 verification through
   `@dream-machine/edge-contracts`, using publicly documented fixture keys.
5. Device, boot, firmware, policy, experiment, consent, proposal, challenge,
   sequence, snapshot, confidence, asset and modality validation.
6. Signed time windows, bounded clock uncertainty, heartbeat loss, stale sensor
   veto, explicit cooldown, conservative cumulative dose, and atomic synchronous
   challenge consumption and dose reservation.
7. Bounded challenge, accepted ticket, dose, and retained receipt storage.
   Capacity exhaustion closes and latches the virtual output. Unexpired accepted
   ticket identities are never silently evicted in the same boot.
8. Deterministic mutation and restart corpora with actual parser submission
   counters. Every malformed input is submitted from `ARMED`, so an earlier
   fault cannot hide an unauthorized acceptance.

The local fake API deliberately exposes `simulatePhysicalArm` and other
simulation events for tests. These functions are not MCP tools or firmware
commands and must not be wired to physical devices. A successful simulator
result cannot authorize a real cue.

## Example

After the root build:

```js
import { createSimulationFixture, runSimulation } from '@dream-machine/edge-sim';

const fixture = createSimulationFixture(43);
fixture.arm(); // Synthetic physical arm AND confirm events only.
const receipt = fixture.submit();
console.log(receipt.evidenceLevel); // simulated
console.log(fixture.controller.hardwareActuation); // false, always
fixture.clock.advance(20_000n);
console.log(fixture.controller.virtualGateOpen); // false
fixture.controller.dispose();

const result = runSimulation({
  seed: 43,
  nights: 30,
  malformedCases: 1_000_000,
  restartCases: 10_000,
});
console.log(JSON.stringify(result, null, 2));
```

`runSimulation` defaults to three synthetic night scenarios, 256 malformed
submissions and 32 restarts. `nights` is the number of small, deterministic
scenario groups. It is **not** an eight hour physiology simulation, real sleep
data, chronologically held out usable nights, or research exposure evidence.
The result has bounded summary fields and a SHA256 digest of the exact generated
fixture bytes and relevant receipt heads. It contains no timing benchmark claims.

The result distinguishes three scopes:

| Field | Meaning |
| --- | --- |
| `verdict` | `ACCEPT` only when requested software scenario coverage is nonzero and every checked invariant passes; `REJECT` for failed assertions; `INCONCLUSIVE` for absent coverage |
| `hardwareGate.verdict` | Always `INCONCLUSIVE`, with physical evidence blocked |
| `researchGate.verdict` | Always `INCONCLUSIVE`, with real nights, controls and exposures absent |
| `executed.parserRequests` | Actual calls to the Edge v1 ticket parser through the controller |
| `executed.invariantsChecked` | Actual individual checks performed by this invocation |
| `mutationFamilies` | Actual submissions grouped by generated fault family |
| `malformedCounters` | Actual rejects, signature work and bounded cache occupancy |

Mutation families cover truncation, trailing bytes, indefinite maps, negative
keys, signature corruption, oversize envelopes, CBOR tags and seeded bit
mutations. Many cases share structures; one million submissions do **not** imply
one million unique security equivalence classes or a formal proof. The runner
does not generate malformed policies; policy configuration rejection is covered
by focused unit tests and remains separate from the million ticket corpus.

## Deliberate conservatism

Any invalid submitted ticket closes the virtual output and latches `FAULT`, even
if another cue was previously accepted. This models fail closed behavior, not
availability under hostile traffic. A live transport will require independently
reviewed authentication, rate limits and denial of service isolation.

A future cue starts only at its exact signed start; late arrival is rejected.
Its full requested duration must fit the signed expiry. Dose reserves the full
duration even when the cue is cancelled early. This can overcount exposure but
cannot release consumed budget through a cancellation race. Simultaneous cues
are rejected. All state changes occur in one synchronous JavaScript operation;
this is not evidence of atomicity in MCU interrupts or concurrent firmware.

## Provenance and limits

`SimulatedGateReceipt` is a project local, unsigned, hash chained record. It
explicitly says `evidenceLevel: "simulated"`, `hardwareActuation: false` and
`SIMULATION_ONLY_NO_PHYSICAL_AUTHORITY`. It is **not** `CueReceiptV1`, not a signed
hardware receipt, and not proof of acoustic, optical, vibration or electrical
output. The chain sequence spans the simulation controller lifetime, including
simulated boots; this intentionally differs from the live boot scoped receipt
contract. A bounded tail retains previous hash links but cannot verify a pruned
prefix without an external checkpoint.

The dose checkpoint detects accidental fixture corruption with an unkeyed
SHA256 hash. It is not authenticated persistent storage and is not resistant to
a malicious writer who can recompute the digest. The virtual global monotonic
clock survives a simulated reboot; actual power loss, clock recovery and sealed
dose persistence remain hardware gates. Invalid dose checkpoints latch a fault
that cannot be cleared by the fake self test or exported as a fresh checkpoint.

The default audio parameters are arbitrary bounded **test constants**, not
human exposure limits. Light and haptic are disabled. Public deterministic
fixture identities and Ed25519 material violate live unpredictability and trust
requirements by design. Never trust these keys or policy hashes in production.
The simulated policy digest is over the explicitly ordered simulator JSON,
not a claim of full canonical `SafetyPolicyV1` implementation.

No dream influence, sleep staging, medical efficacy, human safety, UNO Q
isolation, power loss recovery, real latency or RuView deployment is measured.
Those require the independent gates in ADR 0101 and ADR 0103.
