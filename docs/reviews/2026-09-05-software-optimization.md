# Software optimization completion review

Date: 2026-09-05. PR: 75. Scope: nonactuating software prototype.

## Outcome

Implemented the first executable software tranche on top of review commit
`d16a776d9fd8239f82fe8a11afedf1da0cbd80fa`: strict ticket/URI contracts,
deterministic controller simulation, durable bounded memory, fixed mission
commands, adversarial evidence verification, CI integration and ADR-0106.

The optimization preserves exact keyword retrieval results. The measured
selection-only median improved from 1.6964 ms to 0.7558 ms, about 2.24 times faster,
on 10,000 synthetic records with k=5. These are descriptive Linux measurements,
not an end-to-end, Mac, browser, Arduino or sleep efficacy claim.

This is not completion of the full Home Core program. Real RuVector, MCP service,
Apple bridge, firmware, physical sensing and cueing remain unimplemented here.
No merge, release, signing with production keys, flashing or actuation occurred.

## Executed evidence

| Check | Observed result |
| --- | --- |
| Supported runtimes | `npm run check` passed on Node 22.23.2 and 24.19.0 |
| Unit tests | 368 passing across 11 files |
| Native governance/harness tests | 78 passing |
| Package builds | Eight passing, source typecheck independent of build output |
| Lint | Passing |
| Coverage, configured package scope | 94.51% statements, 90.82% branches, 95.12% functions, 96.38% lines |
| Architecture contract gate | Four schemas; 12,795 uint64 comparisons; 3,674 string vectors across 22 definitions; 14 resources/tools |
| Full simulator, seed 43 | 1,000,000 malformed submissions; 10,000 restarts; 30 synthetic scenario groups |
| Simulator assertions | 3,030,330 checks; zero invariant failures; zero malformed tickets accepted |
| Parser requests through controller | 1,010,060 actual calls |
| Independent random-byte parser smoke | 1,000,000 rejected inputs, zero accepted, seed 43 |
| Parser timing | 15,000 raw samples in 30 batches; descriptive p50 0.009404 ms, p99 0.024417 ms |
| Full/production dependency audits | Both zero known findings for the queried lockfile |
| Ruflo 3.25.6 source scan | Zero findings reported; scanner coverage is not a security proof |
| Ruflo secret scan | No detections in the 60 files reported by that scan |
| License inventory | 220 components, no unknown license strings; legal approval remains separate |
| Evidence smoke/full runs | Ten artifact manifests verified; full readiness intentionally inconclusive |
| Local Markdown references | 29 links checked across 13 selected files |
| Mac doctor from this environment | Inconclusive: Linux x64; target Mac, Xcode, Rust and Arduino tooling absent |

The configured Vitest coverage scope excludes native `.mjs` harness scripts;
their 78 tests are separate. Coverage percentages are not whole-repository or
hardware coverage. The million-case campaigns contain repeated structural
families and are not one million independent attack classes or a formal proof.

## Digests and scope

Lockfile SHA256:
`61f6d4d7e31a064afac7a352bfcd7ed8a5d7d19ea83ac513f09d716bbeccdfcf`

Full synthetic fixture digest, reproduced in two invocations:
`2540bed9f13601b2c1c25204de1b35cc72078e2722144014a738eda44ec02b2a`

Random-byte fuzz corpus digest:
`aa0f4d5b0ad251d02295869667784cdcaf3fccdf0533508b8d510e055a8588aa`

Precommit full evidence manifest SHA256:
`63e9178f33860e93bc77cb43586e4bafb535d5d518dbc90ace888474cd5938f5`

That local bundle was produced while the implementation worktree was dirty. It
correctly marks source provenance inconclusive and must not be represented as a
clean-commit release attestation. The CI evidence job reruns the same harness on
the submitted commit and requires clean source. Its artifact name identifies
the tested commit. Remote results must be checked on that revision, not inherited
from the prior green PR.

## Independent review and corrections

Separate implementation owners handled wire contracts, simulation, memory and
schema precision. Independent read-only review found and drove these fixes:

1. Corrupt dose state could escape FAULT through mute and acknowledgement. Fault
   severity now survives mute, and independent dose-validity guards block every
   acknowledgement, arming, confirmation and acceptance path. The exact exploit
   now remains FAULT with a closed virtual output.
2. Static development policy could be bypassed with computed/quoted properties
   and a decoy configuration. Default-export identity, static keys, duplicate
   checks and explicit disabled API/UI are now regression tested.
3. A top-level compiler import prevented fresh-checkout bootstrap. Dependency
   loading is now lazy; doctor works without node_modules.
4. Evidence serialization could execute caller-owned array getters. It now
   iterates validated data descriptors without array methods or species access.
5. Manifest identifiers could be coerced from arrays. Exact string types, field
   sets and bounded values are required.
6. FIFO input could block verification before file checks. Bounded nonblocking
   regular-file reads and directory iteration reject special and excessive input.
7. Integrity success could be confused with release success. Separate integrity
   verdicts preserve rejected gates and always block hardware release.
8. Memory parent aliases could split owner queues. Nearest existing parents are
   canonicalized, missing suffixes preserved, and final symlinks still rejected.
9. Schema precision now includes explicit lengths and strict terminal assertions.
   The alleged baseline JavaScript newline bypass was not reproducible on either
   tested runtime; this is defense in depth, not a confirmed vulnerability fix.

## Ticket codec optimization follow-up

The parser now reads bounded CBOR integer arguments directly through Buffer's
unsigned big-endian methods, avoids temporary field-array slices, and skips only
the redundant snapshot of the private object that the decoder itself constructs.
Input bytes are still copied before parsing. Public object snapshotting, every
semantic check, Ed25519 verification, byte limits and fail-closed error behavior
remain unchanged.

Comparison is bound to reviewed commit
`35c9fd31ec0369f1c4b0ac7d5eda13d766bbb8cf`. The harness compiles that commit and
the candidate with the same TypeScript version, tests public golden data and all
CBOR integer widths, then compares independent input copies. Mutation attempts
are detected immediately. Its fixed seed 43 corpus produced zero differences
over 1,000,000 cases on both Node 22.23.2 and Node 24.19.0.

On this shared Linux host, median batch-mean decode time fell from 11.27 to 7.71
microseconds per operation on Node 24, a 1.46 times throughput improvement. Node
22 fell from 11.85 to 7.85 microseconds, a 1.51 times improvement. Each timing
path performed 30,000 decodes across 30 alternating batches. Raw batch samples
are emitted by `npm run benchmark:codec`.

These are descriptive shared-host measurements, not confidence-bounded latency,
single-call tail latency, firmware timing or hardware evidence. The differential
uses related TypeScript implementations and therefore is not independent
cross-language conformance. Its result remains `INCONCLUSIVE` for release and
hardware claims even when behavior matches exactly.

## Remaining acceptance gates

1. Review and merge the exact revision manually. The base branch's old privileged
   workflow remains in force until the governance change is merged; do not apply
   the automatic merge label during transition.
2. Run Mac preflight, approve exact SDK/toolchain versions and independently deny
   network egress for reproducibility checks. An offline CLI flag is not a firewall.
3. Implement real RuVector persistence/query and authenticated MCP transport. Ten
   URI templates are parsable; four night/window grammars remain unresolved.
4. Implement and validate Apple, UNO Q, RuView and independent controller lanes.
5. Demonstrate T17/S13 debug/flash/output isolation, sealed dose recovery, physical
   mute and calibrated outputs before any supervised human cue.
6. Preserve memory's single-owner process requirement. Interprocess writers,
   hostile path replacement and final-name case aliases remain unsupported.
7. Run prospective research separately. Synthetic nights cannot establish dream
   influence, sleep-stage accuracy, human safety or permission to promote.

## Reproduce

Follow [software-mission.md](../runbooks/software-mission.md). The full local
command is `node scripts/mission.mjs run --full --seed 43`. Expected overall exit
is 2 while required gates remain inconclusive. `scripts/ci-software-evidence.mjs`
accepts only its explicitly checked software subset and preserves the blockers.
