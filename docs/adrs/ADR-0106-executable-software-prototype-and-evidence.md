# ADR-0106: Executable software prototype and bounded evidence

Status: Implemented for the software prototype; hardware and research acceptance remain blocked.

Date: 2026-09-05

Related: ADR-0100 through ADR-0105; ADR-0001; ADR-150.

## Context

Architecture documents and a green repository build cannot demonstrate a working
edge controller. Conversely, implementing a simulator does not validate real
firmware, human sleep research or safety. We need an executable middle layer that
can falsify software invariants without obtaining hardware authority.

The target Mac is not available in this Linux session. Real RuVector integration,
an authenticated MCP service, Apple entitlements and physical output calibration
remain separate work. Calling placeholders implemented would conceal those gates.

## Decision

Implement two private workspace packages and a local development harness. Keep
the contract label `edge-v1-prototype`. No network listener, hardware driver,
credential acquisition, production signing, flashing, merge or promotion action
is introduced.

| Component | Implemented responsibility | Explicit exclusion |
| --- | --- | --- |
| `edge-contracts` | Bounded canonical CBOR, exact ticket fields, Ed25519 verification, URI identity parsing | Firmware conformance, authorization or live key provisioning |
| `edge-sim` | Virtual time, synthetic observations, replay and dose limits, latched stops, bounded receipts | Real timing, sleep staging, calibrated output or authenticated persistence |
| `memory` | Durable bounded keyword history and exact top K selection | Implemented RVF, vector similarity, encryption or multi-process writes |
| `scripts/mission.mjs` | Fixed build/test commands, preflight, audits, synthetic runs and evidence bundles | OS sandbox, desktop permission management or release authority |

### Strict ticket boundary

The codec implements the proposed integer-key CBOR map, integer-only numeric
fields, minimal length encodings, exact byte widths, ordered keys and no trailing
data. It preserves uint64 values without JavaScript numeric rounding and rejects
indefinite containers, tags, floats, duplicate keys, unknown fields and invalid
time relationships. Admission is bounded to 768 bytes; the largest currently
valid ticket is 439 bytes. The signature covers the unsigned map, not a mutable
JSON representation. Tests use a publicly documented RFC 8032 fixture key only.

Successful signature verification does not authorize a cue. State, policy,
device, boot, consent, challenge, freshness, uncertainty, sequence, dose, asset
and sensor conditions are independently evaluated by the simulator. The parser
fuzzer reports actual iterations and corpus digests; it is deterministic smoke
fuzzing, not a coverage-guided campaign or an independent language implementation.

### Stop state is monotonic until its own recovery conditions pass

`FAULT` cannot be downgraded by mute. A corrupted dose checkpoint independently
blocks acknowledgement, arm, confirm and acceptance, even if an intermediate
state changes. Invalid tickets close the virtual output and latch a fault.
Challenge consumption and dose reservation occur synchronously before acceptance.
Bounded caches fail closed rather than evicting unexpired replay protection.

Physical events in this package are named simulation APIs. They must never be
exposed as MCP tools. Checkpoints and receipts use unkeyed hashes to detect
accidental corruption; a writer who recomputes those hashes can forge them.
They therefore cannot be substituted for sealed dose storage or signed MCU
receipts. Every receipt and summary identifies synthetic evidence and no physical
authority. A synthetic night is a small scenario group, not a usable human night.

### URI parser is deliberately incomplete

ADR-0104 freezes fourteen resource templates, but does not yet define all
placeholder grammars. This prototype resolves ten templates. The four routes
requiring `nightId` or `windowId` are rejected until their identity, timezone,
privacy and retention semantics are approved. Schema retrieval recognizes the
four existing schema names and the prototype `v1` version only.

Only a strict canonical ASCII subset is accepted. Encoded aliases are rejected,
not normalized into authority. The parser does not implement MCP transports,
subscriptions, authentication, authorization, request scoped SSE, or model access.
Registry existence and successful URI parsing never imply a running MCP server.

### Evidence is bounded, immutable by convention and independently verifiable

Each run creates a new private directory with exclusive writes. Artifact filenames
are flat and allowlisted by grammar. The manifest is written last. A partial run
cannot pass verification. Limits are 32 artifacts, 8 MiB per artifact, 32 MiB
aggregate, and 128 KiB for the manifest. Reads reject special files and final
symlinks, are nonblocking and bounded, and reject unexpected directory entries.

Project JSON is sorted-key, finite, plain data only. It is not a general RFC 8785
implementation. Verification checks exact manifest encoding, source identity,
artifact bytes and hashes. An expected manifest digest is an external trust input;
it is not a signature. Without a trusted digest, authenticity is unverified.
Even with it, an intact rejected run remains rejected and hardware readiness
remains inconclusive. No manifest may certify physical release in this prototype.

The containing directory must belong to a trusted local account. This is not a
hostile filesystem service: concurrent replacement of ancestors, hard-link
attacks by the same account and privileged writers are outside its trust model.
Hashing detects changes only relative to a separately trusted digest. Bundles
are not encrypted, crash-durable signed archives, or replacements for a release
ledger. Only synthetic data and sanitized public tool versions are included.

Run artifacts contain doctor results, simulation, random-byte fuzzing, raw
descriptive parser and memory timing samples, dependency results, license
inventory, CycloneDX SBOM, declared development policy and build/test exit status.
Real firmware, network isolation, hardware receipts, Apple result bundles and
clinical evidence are absent and remain blocked, rather than fabricated.

### Offline and policy claims are narrowly scoped

`bootstrap` executes a lockfile install with lifecycle scripts disabled. Its
optional offline flag uses a primed npm cache. `run --offline` skips the advisory
refresh and marks that gate inconclusive. Neither flag disables the host network
or proves dependency code cannot use it. Independent OS egress denial remains a
required target-Mac test.

The development policy statically inspects the root declared test configuration.
It requires explicit disabled API and UI, rejects browser configuration, exposed
server flags, dynamic overrides and ambiguous default exports. It is a tripwire,
not a JavaScript sandbox or a proof about every script in a hostile repository.
Only already reviewed source should be executed by this local harness.

### Relevance optimization preserves meaning

Memory selection retains exact score and insertion-order tie semantics while
replacing full sorting with O(n log k) selection and O(k) auxiliary storage.
An independent full-sort oracle validates equality. Benchmarks alternate both
implementations on identical cached inputs and include all raw samples. They
exclude file I/O, preprocessing and admission checks. No timing threshold or
shared-host result establishes target hardware latency or clinical benefit.

## Consequences and completion boundary

The software tranche is complete only when supported Node 22 and 24 checks,
adversarial regressions, full synthetic corpora, evidence tampering tests and
independent review pass on the submitted tree. CI accepts this software subset
explicitly while preserving inconclusive physical, licensing and benchmark gates.
Dependency advisory checks run in a separate online lane.

The bedside system is not complete. Next gates require the actual Mac, approved
toolchains and account, real RuVector write/reopen/query tests, authenticated MCP,
Apple bridge, firmware, independent controller isolation, calibrated wired audio,
and prospective human research. Autonomous optimization cannot weaken these gates.
