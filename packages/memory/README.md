# Deterministic dream memory

This package is an implemented, bounded keyword store. `auto` may detect an
optional RuVector module, but it still reports `backend: 'flat-file'`. An explicit
`ruvector-rvf` request fails until a real adapter passes its persistence and
query contract. Module availability is not evidence of vector retrieval.

## Use

```ts
import { openMemory, MemoryCommitUncertainError } from '@dream-machine/memory';

const memory = await openMemory({ backend: 'auto', path: './private/nights.json' });
try {
  await memory.remember({
    date: '2026-09-05',
    deep: 'research',
    finding: 'Replay candidate requires independent evidence',
    verdict: 'INCONCLUSIVE',
  });
} catch (error) {
  if (error instanceof MemoryCommitUncertainError) {
    // The replacement already happened. Inspect the store before retrying;
    // blind retry can duplicate this append. Never log private record content.
    throw error;
  }
  throw error;
}

const hits = await memory.recall('independent evidence', 5);
```

`inMemory: true` never accesses a file. Omitting a path defaults to in memory;
explicit `inMemory: false` requires a path. Existing valid array files need no
migration. New writes use compact JSON and do not retain formatting.

`all()` and `recall()` return detached records. `remember()` captures a detached
snapshot before waiting on earlier calls. The four required fields are strings;
`witness` and `detail` are optional strings. Unknown keys, nonplain objects,
accessors, symbols and malformed persisted records are rejected. Legacy string
dates and verdicts are preserved; this package does not validate domain claims
or interpret a stored witness as verified provenance.

## Resource and relevance contract

| Boundary | Hard maximum | Failure |
| --- | ---: | --- |
| Records | 10,000 | Reject append or disk load |
| Serialized store | 16 MiB UTF-8 | Reject append or disk load |
| Serialized record | 64 KiB UTF-8 | Reject record |
| Each field | 32 KiB UTF-8 | Reject record |
| Query | 4,096 bytes UTF-8 | Reject query |
| Search terms | 128 | Reject query |
| Requested results | Integer 0 through 1,000 | Reject invalid count |
| Pending operations per owner/path | 256 | Reject with backpressure; retry after awaiting earlier operations |

These are exported as the frozen `MEMORY_LIMITS` constant. Limits reject rather
than truncate or silently evict. The store byte limit also applies in memory.
The public `keywordScore()` helper bounds its input text to 128 KiB.
Concurrent callers must handle queue backpressure. Avoid submitting an unbounded
batch of appends without awaiting earlier calls.

Relevance is the proportion of query terms present as substrings in the lower
case concatenation of `deep`, `finding`, `verdict` and `detail`. Query terms of
one character or less are ignored. Repeated query terms retain their existing
weight. `keywordScore()` retains its existing contract of accepting already
normalized search text. An empty effective query scores zero; scores are finite
and in `[0, 1]`. Ties use insertion order. There is no semantic, causal, clinical
or vector similarity claim.

The production selection kernel keeps at most `k` ranked hits instead of sorting
every matching record. Selection uses O(n log k) comparison work and O(k)
auxiliary result memory, plus the stored records and cached text. Final ordering
is identical to a full stable sort. In memory, normalized text is cached and
terms are parsed once per query. Disk operations reload and validate the bounded
file first, preserving correctness across separate handles at additional I/O
and JSON parsing cost. This is not an indexed on-disk vector engine.

## Persistence and concurrency rules

1. Canonicalize the nearest existing parent directory at open time, then append
   any missing directory suffix and the unchanged final filename. Existing
   parent aliases, including macOS `/var` aliases, resolve to the same owner.
   The final file is never resolved through `realpath`. Parent permission errors
   and dangling parent symlinks fail explicitly. Serialize operations in
   submission order; matching canonical paths share an in-process queue and
   idle queues are released.
2. Reload the file before each disk operation. Only `ENOENT` means an empty
   store. Parse errors, invalid UTF-8, unexpected shapes, permissions, file
   growth, truncated reads, devices and symlinks fail explicitly.
3. Validate the next snapshot and all limits before mutation.
4. Create a unique exclusive temporary file in the destination directory with
   mode `0600`, write the entire snapshot, flush the file, and close it.
5. Recheck the destination type and atomically rename the temporary file.
   Newly created parent directories request mode `0700`.
6. On POSIX, flush the parent directory. If this fails after rename, return
   `MemoryCommitUncertainError` with `committed: true`. A subsequent `all()`
   observes the replaced file; do not blindly retry the append. Windows uses
   the flushed file and atomic replacement without a portable directory flush.
7. If failure occurs before rename, leave the old file unchanged, discard the
   failed candidate, and attempt removal of its temporary file. Failed calls
   do not poison the operation queue. An owner may repair a corrupt file and
   retry without reopening the handle.

Atomic replacement protects against partial JSON becoming the committed store.
File and directory flushes are not a hardware durability certification: behavior
still depends on the filesystem, storage device, mount options and operating
system. Process crashes can leave a private orphan temporary file; the reader
never treats temporary files as committed input. Operators may remove those
files only after confirming that no writer is active.

### Explicit security limits

Use one process and a trusted, owner-controlled local directory. Independent
processes, worker isolates, separate module copies, and hostile concurrent
directory replacement are **not supported writers**. Their queues are not
shared, and there is no interprocess locking or compare-and-swap commit. Put
shared writes behind one owner service or adopt a transactional database before
enabling those deployment patterns. Use a consistent final filename spelling:
case aliases on case-insensitive filesystems are not normalized.

The final file is checked with `lstat` and opened without following a final
symlink on supporting platforms. An existing immediate parent symlink is allowed
at initialization because its directory is canonicalized first. At write time,
the stored canonical immediate directory must not itself be a symlink. This is
not a hardened filesystem service: ancestor directories must be trusted, and
the same user must not replace path components concurrently.
Existing owner directory permissions are not changed. Mode bits are subject to
platform support and do not supply encryption, authenticated integrity, access
control for remote callers, or secure deletion. Do not store raw personal sleep
signals without the enclosing application's approved privacy and retention
policy. Memory content is untrusted evidence and never actuator authority.

## Validation and reproducible benchmark

```sh
npm run build -w packages/memory
npx vitest run packages/memory/src
npx eslint packages/memory
node packages/memory/benchmarks/recall.mjs
```

The benchmark exports `benchmarkRecall()` and `fullSortRecall()`, outputs JSON
with raw timing samples, and checks exact results before timing. The default
fixture uses a fixed seed, 10,000 synthetic records, five distinct queries,
`k = 5`, eight warmup rounds and 40 measured rounds: 200 samples per algorithm.
Operation order alternates each round. Both implementations receive identical
precomputed search text and query terms. Measurements cover selection only,
not disk I/O, preprocessing, admission validation, the browser or an Arduino.
No absolute latency or speedup threshold is asserted in CI.

## SPARC completion trace

Specification: preserve valid keyword behavior while rejecting malformed input,
preventing silent corruption overwrite and lost updates within the supported
single-process deployment, and bounding retained resources and query output.

Pseudocode: snapshot input, queue, load and validate, build a candidate, commit
atomically, publish the new in-process state. A precommit failure leaves the
committed file unchanged. A post-rename flush failure is explicitly uncertain.
Reads run through the same queue and return detached data.

Architecture: retain the interoperable JSON array and use an exact bounded heap.
A native vector index is not introduced without a proven adapter. Atomic rename
costs a complete bounded-file write on each append; the tradeoff favors a small
local night-history store. Cross-process locking and encryption remain outside
this package and must be addressed before expanding deployment scope.

| Requirement | Executable evidence in `src/integrity.test.ts` |
| --- | --- |
| No corrupted-store overwrite | Invalid/truncated JSON, wrong shapes, invalid UTF-8, repaired retry |
| Atomic candidate commit | Rename failure, partial temporary write, temporary fsync failure |
| Honest postcommit failure | Directory fsync uncertainty with committed data visible |
| Supported concurrency | Concurrent remember/read calls, independent handles, parent aliases and missing directory suffixes |
| Private snapshots and file | Input/output mutation, Unicode roundtrip, reopen, mode `0600` |
| File and record limits | Byte caps, Unicode/escaping caps, over-count disk input |
| Query limits and numeric safety | Invalid k, bytes, term caps, empty query, duplicates |
| Exact relevance and deterministic ties | Independent full-sort oracle over seeded records and k boundaries |
| Filesystem abuse boundary | Final symlinks, directories, permission errors, corrupt replacement |

Refinement and completion: the existing optional-module and backend-label tests
remain in `src/index.test.ts`. The implementation adds no runtime dependencies.
Hardware behavior, interprocess writes and physical safety are not validated by
these tests.
