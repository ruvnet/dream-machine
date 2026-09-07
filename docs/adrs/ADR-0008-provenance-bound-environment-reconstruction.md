# ADR 0008: Provenance Bound Environment Reconstruction

Status: Proposed

Date: 2026-09-05

Related: issue 80

## Context

Agent trajectories often contain enough file operations and tool evidence to rebuild part of the environment in which a task was solved. Recent work on Terminal Universe reports that replaying trajectory evidence and completing missing environment state can create a large corpus of reusable executable environments. This is potentially useful for Dream Machine, MetaHarness, RVForge, Core Memory, and Ruflo because a completed trajectory can become a reproducible evaluation surface rather than a one time transcript.

The security problem is provenance collapse. A reconstruction system may mix three very different facts:

1. bytes directly observed in a trajectory,
2. bytes recovered from an authoritative repository,
3. bytes inferred or synthesized to make the environment run.

If those classes are merged, a plausible completion can be mistaken for historical ground truth. A reconstructed environment can then pass tests for the wrong reason, contaminate training data, or become an unsafe execution substrate.

## Decision

Dream Machine will represent reconstruction as a metadata only manifest and deterministic receipt before any environment is materialized or executed.

Each artifact carries a normalized relative path, sha256 content digest, provenance class, required flag, and independent verification flag. Missing artifacts are represented explicitly as gaps rather than silently synthesized away.

The first implementation lives in `@dream-machine/witness` because it is an evidence binding primitive. It does not read raw artifact bytes, materialize files, execute commands, authorize tools, or mutate the source workspace.

## Provenance classes

`trajectory` means the artifact is recoverable from the immutable source trajectory.

`repository` means the artifact is recoverable from a separately identified authoritative repository state.

`completion` means an inference process proposed the artifact.

`generated-dependency` means a dependency completion process generated or resolved the artifact without direct source recovery.

The final two classes are inferred. They never become recovered evidence merely because a verifier later accepts the overall task.

## Invariants

1. The source trajectory digest is mandatory and immutable.
2. Digests are lowercase sha256 values.
3. Repository commits, when present, are explicit and validated.
4. Paths are normalized relative POSIX paths. Absolute paths, backslashes, dot segments, parent segments, duplicate paths, and path overlap between artifacts and gaps fail closed.
5. Resource bounds are enforced before canonicalization.
6. A required gap makes the reconstruction insufficient.
7. A required unverified artifact makes the reconstruction insufficient.
8. Any unverified inferred artifact makes the reconstruction insufficient.
9. Canonical manifest digest is stable across artifact and gap ordering.
10. Receipts contain metadata and digests only, never raw source file content or secrets.
11. Every receipt carries `authority: none`.
12. Structural sufficiency never authorizes environment execution. RVM remains the authority boundary.

## Security analysis

### Path escape

A reconstruction manifest is attacker controlled until validated. Relative path validation prevents direct absolute path and parent traversal writes. A future materializer must repeat or consume the same validated representation and must still use a sandbox root.

### Provenance laundering

Completion output is permanently distinguishable from recovered evidence. Verification can establish that an inferred artifact is compatible with a task, but does not rewrite its source class.

### Secret recovery

The receipt stores no bytes. A future reconstruction adapter must classify redacted secrets as gaps and must not attempt credential recovery or secret synthesis.

### Resource exhaustion

Artifact and gap counts plus path lengths are bounded. Materializers will need separate byte, file count, CPU, memory, wall clock, and process limits.

### Execution authority

A valid reconstruction receipt is evidence only. It cannot grant a tool, process, network, filesystem, credential, or deployment capability. Any later execution is separately evaluated by RVM.

## Benchmark

MetaHarness issue 285 Track A freezes at least 100 held out trajectories and compares:

1. raw trajectory replay,
2. deterministic provenance bound reconstruction,
3. completion assisted reconstruction.

Record source and candidate commits, environment versions, seeds, sample size, reconstruction success, exact artifact provenance coverage, task verifier success, false reconstruction rate, synthesized as recovered errors, missing dependency rate, latency, model tokens, model cost, storage, environment size, failures, regressions, and reproduction commands.

Adversarial cases include path traversal, duplicate paths, missing required files, forged digests, completion artifacts presented as recovered state, secret redaction, binary gaps, oversized manifests, and conflicting repository evidence.

## Promotion gate

The primitive can advance only after all repository tests and security checks are green and MetaHarness reproduction reports:

1. at least 90 percent exact provenance coverage on reconstructable files,
2. zero path escapes,
3. zero inferred artifacts misclassified as recovered evidence,
4. at least 20 percent more reusable verified tasks per source trajectory,
5. no more than 10 percent additional orchestration cost,
6. no execution authority expansion.

A null result is acceptable and should stop further reconstruction architecture if raw replay performs within variance at lower cost.

## Migration and rollback

This change is additive. No existing witness format, ledger row, evaluator, workspace, or training corpus changes. Removing the reconstruction module and its export returns the package to current behavior. No stored production state requires migration.

## Cross stack reuse

Dream Machine uses receipts for self improvement evidence.

MetaHarness uses manifests to reproduce evaluation environments.

RVForge can later package only independently validated manifests.

Core Memory can index receipt metadata without storing raw files.

Ruflo can emit trajectory evidence but cannot upgrade provenance classes.

RVM remains the only authority layer for executing a reconstructed environment.
