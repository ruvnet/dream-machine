# Edge contracts prototype

Status: `edge-v1-prototype`. No hardware, physical output, or complete Edge
Contract v1 conformance is claimed. This private workspace package provides a
small, inspectable boundary for simulated development without new dependencies.

## Scope and invariants

Input is an exact `CueTicketV1` JSON object or at most 768 CBOR bytes. Output is
canonical CBOR, the exact JSON projection, or signature validity. Malformed
data fails closed with `TicketFormatError`; verification returns `false`.

The codec follows [the existing numeric key table](../../docs/contracts/edge-v1/README.md#6-cueticketv1)
and [JSON ticket schema](../../docs/contracts/edge-v1/safety-decision.schema.json).
Keys 0 through 22 form the Ed25519 message. Key 23 contains the signature.
There is no JSON signing fallback, signing API, private key store, network
client, controller, or actuator implementation.

`verifyTicket` proves only that an Ed25519 public key verifies these exact
structurally valid bytes. It does **not** check key authorization, current
device/boot, consent, active policy, firmware, challenge consumption, replay,
current time, sensor quality, arm state, asset membership, or dose limits.
Those checks belong to a separately governed controller. A valid signature
alone must never open an output gate.

## API

```ts
import {
  encodeTicketPayload, encodeTicket, decodeTicket, verifyTicket,
  type CueTicketV1, type UnsignedCueTicketV1,
} from '@dream-machine/edge-contracts';
import type { KeyObject } from 'node:crypto';

// caller owns this already received signed ticket and authorized public key
function inspect(ticket: CueTicketV1, publicKey: KeyObject) {
  const wire = encodeTicket(ticket);
  const decoded = decodeTicket(wire);
  return { decoded, signatureValid: verifyTicket(decoded, publicKey) };
}

function payload(unsigned: UnsignedCueTicketV1): Uint8Array {
  return encodeTicketPayload(unsigned);
}
```

`encodeTicketPayload` accepts exactly 23 fields, not an object containing an
extra `signature`. Unsigned input can be produced with object rest:
`const { signature, ...unsigned } = ticket`. The function does not sign it.

Fields use lowercase 128 bit identifiers, lowercase SHA256 digests, decimal
uint64 strings, integer Q15, and `audio | light | haptic` JSON modalities.
Signatures are exactly 86 canonical unpadded base64url characters. Fixed
lengths and decimal round trips reject terminal newline aliases that JavaScript
regular expression `$` anchors alone can admit. Plain data properties are
snapshotted before verification; accessors and unexpected fields are rejected.

## Parser design

1. Check the byte bound and copy the unshared input once.
2. Require a definite map containing exactly 24 keys.
3. Read each known key in numeric order, with its exact value type and bound.
4. Reject nonminimal CBOR arguments, tags, floats, negatives, indefinite
   lengths, unknown/duplicate/missing keys, and trailing bytes.
5. Validate JSON integer limits, identifier rules, temporal relations, and
   `rampMs <= durationMs` before returning any ticket.

No recursion, arbitrary CBOR nesting, map allocation proportional to declared
lengths, or unbounded byte strings are accepted. All uint64 work uses `BigInt`.
The parser never converts uint64 fields through JavaScript `number`.
The largest simultaneous valid field encodings occupy 439 bytes, below the
768 byte transport ceiling. Callers must separately bound JSON ingress before
parsing it; this package does not implement an HTTP body parser.

Temporal checks are `issued <= notBefore < expires` and a maximum
2,000,000 microsecond issue-to-expiry horizon. Current-time freshness and
monotonically increasing sequence checks are intentionally separate stateful
controller responsibilities.

## Prototype resource URI subset

`parseDreamResourceUri(uri)` returns frozen `{ name, canonicalUri, params }`.
It conveys identity only, not authorization, privacy permission, grants, scope,
resource existence, or MCP server availability.

The matcher accepts only canonical ASCII strings starting with
`ruv://dream-machine/v1/`. It never invokes a URL normalizer. Queries,
fragments, credentials, ports, percent aliases, Unicode, empty path segments,
dot segments, separators embedded in identifiers, and unknown routes fail.
This deliberately narrower prototype subset is **not** a claim of full RFC3986
or the eventual UTF8 URI parser conformance.

| Registry name | Accepted placeholder grammar |
|---|---|
| `device_status` | Nonzero lowercase 32 hex `deviceId` |
| `consent_current` | No placeholders |
| `apple_watch_sync_status` | No placeholders |
| `experiment_protocol` | Nonzero lowercase 32 hex `experimentId` |
| `active_policy` | No placeholders |
| `candidate_receipt` | Nonzero lowercase 32 hex `candidateId` |
| `cue_receipt` | Nonzero lowercase 32 hex `ticketId` |
| `evidence` | Lowercase 64 hex `digest` |
| `latest_benchmarks` | No placeholders |
| `schema` | Existing filename stem and literal prototype version `v1` |

Schema names are `observation`, `cue-proposal`, `safety-decision`, and
`evolution-candidate`. The existing registry and ADR0104 do not freeze a
`nightId`/`windowId` grammar or night boundary timezone. All four night/window
routes remain deliberately unsupported. Do not treat a date or arbitrary string
as a night identity until that separate contract is accepted. The schema version
token `v1` is a local prototype decision, not an upstream naming standard.

## Reproduce validation

From the repository root:

```sh
npm run build --workspace @dream-machine/edge-contracts
npx vitest run packages/edge-contracts/src
npx eslint packages/edge-contracts/src
```

The checked-in [public fixture](./fixtures/public-ticket.json) has a manually
assembled canonical CBOR payload, fixed signature, and RFC8032 section 7.1
TEST 1 key material. **The private seed is deliberately public test data. Never
use it in any deployment or safety policy.** Runtime code neither imports this
fixture nor provides signing helpers. The fixture is not evidence of an
independent second-language implementation or MCU agreement.

| Requirement | Executable evidence |
|---|---|
| Exact keys, type bounds, and deterministic representation | Golden payload/wire, every uint64 encoding boundary, malformed encoding cases |
| Exact signature coverage and only Ed25519 public keys | Frozen signature, every-field tampering, wrong message/key/algorithm cases |
| Bounded parsing and failure closure | Every truncation, all 256 trailing bytes, oversize/shared memory rejection |
| Canonical JSON and time/ramp relations | Alias, newline, zero identifier, overflow, accessor, and semantic negative tests |
| URI identity without normalization or authority | Registry compatibility plus traversal, ambiguity, and unsupported route negatives |
| Reproducible parser smoke corpus | Fixed-seed random bytes plus canonical ticket mutations and exact reencoding invariant |

`runTicketParserFuzz` is exported through
`@dream-machine/edge-contracts/fuzz`. It accepts a nonzero uint32 seed, 1 through
1,000,000 iterations, and an optional canonical wire fixture. It returns corpus
SHA256, acceptance/rejection counts, and seed. Any accepted byte string must
reencode identically. This is bounded deterministic smoke fuzzing, **not** a
coverage-guided campaign, sanitizer result, proof of parser completeness, or
physical safety test. Valid structural mutations can retain invalid signatures;
fuzz acceptance does not claim cryptographic verification.

## Remaining gates and rollback

Owner: edge protocol/controller maintainers. Remaining gates include frozen
schemas for other wire messages, independent Rust/C vectors, hardware parser
fuzzing, physical isolation and timing fixtures, and a controller implementation
with all authority checks. No production or human sleep release is authorized.

The package is private, additive, and dependency-free. Rollback consists of
removing prototype consumers and the package; it writes no durable data and
does not install firmware. Do not reinterpret a parser error or missing package
as permission to use a less strict ticket path.
