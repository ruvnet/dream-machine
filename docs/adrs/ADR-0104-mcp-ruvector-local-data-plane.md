# ADR-0104: Use RuVector as the local evidence plane behind a capability-minimal MCP facade

- **Status**: Proposed
- **Date**: 2026-09-04
- **Related**: ADR-0001, ADR-0100, ADR-0103
- **Deciders**: ruv
- **Tags**: ruvector, rvf, wasm, mcp, resource-uri, sse, privacy, local-first

## 1. Context

The edge program needs local longitudinal memory for physiology summaries,
reports, experiment assignments, outcomes, candidates, and evidence receipts.
It also needs a narrow interface for a local model, Codex Desktop, and the
stationary WebUI. These are different responsibilities: a memory store must not
become an actuator or a general command bus.

The current `@dream-machine/memory` implementation probes for
`@ruvector/wasm` but still uses `FlatMemory`. An explicit `ruvector-rvf` request
can report that label while retaining flat-memory behavior. The code comments
acknowledge that the real binding is not wired. This program therefore treats a
real RuVector adapter as new work and makes backend identity part of the
acceptance evidence.

RuVector 0.2.40 is the latest stable GitHub release at this decision date. It
requires Node.js 20 or newer and exposes a read-only MCP profile for selected
MetaHarness operations. The Dream Machine workspace currently supports Node.js
18 through 22, so the edge service must either have a Node.js 20 boundary or
wait for a deliberate workspace engine migration.

The current MCP specification supports stdio and Streamable HTTP. A Streamable
HTTP response may use request-scoped server-sent events. The former paired HTTP
and permanent SSE transport is legacy and is not the basis of this design.

## 2. Decision

### 2.1 Separate authoritative stores by representation

The UNO Q Linux service owns encrypted, local stores with versioned encoders:

| Store | Representation | Purpose | Default retention |
|---|---|---|---|
| `physiology.rvdb` | Numeric signal windows | Comparable breathing, movement, environment, and state | Detailed windows for 24 hours, aggregates for 13 months |
| `reports.rvdb` | Local text embeddings | User language, themes, feelings, and entities | 30 days unless explicitly retained |
| `episodes.rvdb` | Night-level vectors | Matched experiment context and outcomes | 13 months |
| `policies.rvf` | Signed manifests and receipts | Candidate lineage, expiry, promotion, and rollback | Content-free receipts for 24 months |

An encoder name, version, dimension, distance metric, normalization rule, and
input-schema digest are immutable within each store. A change creates a new
store or an explicit, witnessed migration. RuVector learning occurs only from
closed outcomes and explicit feedback, never from retrieval alone.

Raw audio is not stored. Raw radar and CSI are disabled by default. A temporary
calibration capture requires a separate consent scope and deletion deadline.

### 2.2 Keep native memory authoritative and WASM subordinate

The native Linux service is the authoritative data plane. RuVector WASM may
power a redacted browser cache and portable offline inspection. The browser
copy is bounded, disposable, non-authoritative, and cannot contain raw reports,
raw physiology, consent tokens, policy signing material, or actuator state.

The browser never reports a native or RVF backend unless it has completed a
write, reopen, search, and digest-verification test using that backend. Fallback
to flat memory changes the declared backend and produces a visible degradation
receipt.

### 2.3 Define a project-local `ruv://` namespace

`ruv://` is a Dream Machine resource convention, not a claim of a universal
RuVector protocol. The canonical machine readable registry is
[`../contracts/edge-v1/mcp-registry.json`](../contracts/edge-v1/mcp-registry.json).
Version one includes these templates:

```text
ruv://dream-machine/v1/devices/{deviceId}/status
ruv://dream-machine/v1/subjects/self/consent/current
ruv://dream-machine/v1/subjects/self/nights/{nightId}/summary
ruv://dream-machine/v1/subjects/self/nights/{nightId}/signals/{windowId}
ruv://dream-machine/v1/subjects/self/nights/{nightId}/apple-watch/summary
ruv://dream-machine/v1/subjects/self/nights/{nightId}/apple-watch/quality
ruv://dream-machine/v1/subjects/self/apple-watch/sync-status
ruv://dream-machine/v1/experiments/{experimentId}/protocol
ruv://dream-machine/v1/policies/active
ruv://dream-machine/v1/candidates/{candidateId}/receipt
ruv://dream-machine/v1/cues/{ticketId}/receipt
ruv://dream-machine/v1/evidence/{digest}
ruv://dream-machine/v1/benchmarks/latest
ruv://dream-machine/v1/schemas/{name}/{version}
```

Every representation contains `schemaVersion`, `observedAt`, `source`,
`confidenceQ15` when meaningful, `evidenceLevel`, `privacyClass`, and a content digest. A strict URI
parser rejects traversal, encoded separators, invalid identifiers, extra path
segments, query-based authority changes, fragments, and unknown templates.

### 2.4 Expose proposal and explanation tools only

The model-visible MCP surface is:

| Tool | Effect |
|---|---|
| `dream_status` | Read redacted health, mute, and arm state |
| `dream_session_query` | Read a bounded summary or timeline |
| `dream_memory_search` | Search redacted local summaries |
| `dream_intention_set` | Store an awake, confirmed intention |
| `dream_report_record` | Store and display a morning report revision |
| `dream_experiment_preview` | Run deterministic counterfactual replay |
| `dream_cue_propose` | Create a non-authoritative proposal |
| `dream_mute` | Move toward the safe muted state |
| `dream_receipt_export` | Export user-selected evidence |

The following are never model tools: arm, resume from fault, play a cue, mint a
ticket, raise a limit, install firmware, add a network destination, change
consent, promote a candidate, sign a release, or merge a pull request.

`dream_cue_propose` returns a schema-validated proposal and explanation. A
separate native broker may convert that proposal into a signed, short-lived
ticket only after deterministic consent, policy, state, content, dose, and
experiment checks. The microcontroller independently revalidates it.

### 2.5 Use local transports with explicit identities

1. Stdio is the default for a model and server in the same process boundary.
2. Same-device services use a permissioned Unix domain socket.
3. The WebUI and Codex Desktop use Streamable HTTP on loopback through an
   authenticated local session or an explicit SSH tunnel.
   A Codex session that sends content to remote inference is classified as a
   `cloud_model`; loopback transport does not make its inference local. It may
   receive P0 and explicitly granted redacted P1 data, never P2 or P3.
4. The server validates `Origin`, rejects DNS rebinding, limits body and stream
   size, enforces deadlines, and binds to loopback by default.
5. Request-scoped SSE is allowed for progress. Resource subscriptions are
   explicit, bounded, resumable, and redacted.
6. A legacy `/sse` endpoint is absent in production.
7. Each call records principal, tool, argument digest, result digest, policy
   decision, latency, and privacy class without recording raw private content.

### 2.6 Treat every retrieved value as data, never instruction

Dream reports, sensor labels, HealthKit metadata, resource content, browser
input, and imported RVF files are untrusted data. They cannot add tools, alter a
system prompt, select a network destination, change a policy, or invoke an
actuator. The MCP server applies capability checks before parsing application
content and applies output redaction before returning it.

### 2.7 Pin and verify external components

The integration manifest records exact package or commit digests, licenses,
transitive dependencies, SBOMs, and clean-room doctor output for RuVector,
RuView, MetaHarness, Autogenous, and optional LatentMesh. A version range is not
a release pin. Upstream updates are candidates which pass the same replay,
security, performance, and rollback gates as local changes.

## 3. Consequences

The local model and WebUI gain useful memory and explanations without receiving
physical authority. Memory can degrade honestly when RuVector is unavailable.
Separating stores reduces accidental cross-use but adds migration and backup
work. Node.js 20 becomes the minimum for the edge service even while the core
workspace continues testing Node.js 18.

Request-scoped streams are less convenient than a global telemetry feed, but
they reduce cross-session leakage and resource exhaustion. Raw data remains
available only through explicit research tooling outside the ordinary MCP
surface.

## 4. Alternatives Considered

- **Use the current `FlatMemory` and label it RuVector**. Rejected because
  telemetry would claim a capability that did not execute.
- **Put every data type in one vector store**. Rejected because dimensions,
  encoders, retention, and access rules differ.
- **Make the browser database authoritative**. Rejected because lifecycle,
  scale, origin isolation, and secret handling are weaker than the native
  service.
- **Expose a generic shell or cue tool through MCP**. Rejected because it
  collapses the model and actuator trust boundaries.
- **Use the legacy permanent SSE transport**. Rejected because the current MCP
  transport is Streamable HTTP or stdio.
- **Cloud-host the memory for convenience**. Rejected for the first product
  because offline operation and intimate-data minimization are core value.

## 5. Test Contract

This ADR is satisfied when:

1. A real RuVector integration passes create, write, close, reopen, query,
   delete, corrupt-index, and backup-restore tests; backend telemetry matches the
   implementation used.
2. Changing an encoder, dimension, metric, normalization rule, or schema digest
   cannot open an existing store without an explicit migration.
3. At 100,000 synthetic episodes, recall at 10 is at least 0.90 against a frozen
   truth set and query latency is below 25 milliseconds at p95 on the target UNO Q.
4. Every `ruv://` template has positive, negative, traversal, encoding, and
   authorization tests shared across native and WASM implementations.
5. Prompt injections in reports and metadata cannot change tools, policies,
   destinations, or actuator state.
6. MCP binds only to loopback by default, validates Origin, enforces its
   allowlist, rejects oversized messages, and survives subscription disconnects.
7. A 24-hour packet capture during ordinary operation contains zero public DNS
   queries and zero unexpected outbound connections.
8. Browser storage contains only the approved redacted subset and can be deleted
   without affecting authoritative policy or consent state.
9. RuVector absence produces an explicit flat-memory degradation receipt and an
   `INCONCLUSIVE` result for benchmarks requiring semantic recall.
10. No MCP request, resource, or subscription can mint a cue ticket or directly
    reach an actuator.

## 6. References

- [RuVector 0.2.40 release](https://github.com/ruvnet/RuVector/releases/tag/ruvector-v0.2.40)
- [RuVector repository](https://github.com/ruvnet/RuVector)
- [RuView repository](https://github.com/ruvnet/RuView)
- [Model Context Protocol transports](https://modelcontextprotocol.io/specification/2026-07-28/basic/transports)
- [Model Context Protocol resources](https://modelcontextprotocol.io/specification/2026-07-28/server/resources)
- [`@dream-machine/memory` current implementation](../../packages/memory/src/index.ts)
