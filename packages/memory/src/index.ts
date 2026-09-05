/**
 * @dream-machine/memory
 *
 * Deterministic memory over prior dream nights. RuVector's optional wasm
 * package is probed for availability, but an RVF adapter is not implemented.
 * Auto mode uses the flat-file backend even when the module is available.
 * When the module is ABSENT, auto mode remains a deterministic flat-file backend
 * with keyword scoring — never an error (the ADR-150 optional-augmentation
 * invariant: a `MODULE_NOT_FOUND` is a graceful no-op, not a failure).
 *
 * An explicit request for the unimplemented RVF backend fails instead of
 * claiming vector storage or HNSW recall that never executed.
 */

import { scoreTerms, selectRecallHits } from './selection.js';

/** One remembered dream night. */
export interface DreamNight {
  date: string;
  deep: string;
  finding: string;
  verdict: string;
  witness?: string;
  /** Free-text detail folded into the searchable content. */
  detail?: string;
}

export interface RecallHit {
  night: DreamNight;
  /** 0..1 similarity/relevance. */
  score: number;
}

export interface DreamMemory {
  readonly backend: 'ruvector-rvf' | 'flat-file';
  remember(night: DreamNight): Promise<void>;
  recall(query: string, k?: number): Promise<RecallHit[]>;
  all(): Promise<DreamNight[]>;
}

export interface OpenOptions {
  /** Force a backend (mostly for tests). 'auto' probes for ruvector. */
  backend?: 'auto' | 'flat-file' | 'ruvector-rvf';
  /** In-memory store (no fs) — used by tests and ephemeral runs. */
  inMemory?: boolean;
  /** Path to the flat-file store or RVF container. */
  path?: string;
  /** Injected loader for the ruvector module (tests). */
  loadRuvector?: () => Promise<unknown>;
}

/** Hard resource ceilings, not tunable by untrusted callers. Byte limits use UTF-8. */
export const MEMORY_LIMITS = Object.freeze({
  records: 10_000,
  fileBytes: 16 * 1024 * 1024,
  recordBytes: 64 * 1024,
  fieldBytes: 32 * 1024,
  queryBytes: 4096,
  queryTerms: 128,
  results: 1000,
  pendingOperations: 256,
});

/** The replacement exists, but its directory entry could not be crash-synced. */
export class MemoryCommitUncertainError extends Error {
  readonly committed = true;

  constructor(cause: unknown) {
    super('Memory replacement committed but directory synchronization failed; inspect the store before retrying', { cause });
    this.name = 'MemoryCommitUncertainError';
  }
}

const requiredFields = ['date', 'deep', 'finding', 'verdict'] as const;
const optionalFields = ['witness', 'detail'] as const;
const allowedFields = new Set<string>([...requiredFields, ...optionalFields]);

/** Validate without invoking accessors, and detach the caller's mutable object. */
function snapshotNight(value: unknown): DreamNight {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError('Memory record must be a plain object');
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new TypeError('Memory record must be a plain object');
  }
  const descriptors = Object.getOwnPropertyDescriptors(value);
  if (Object.getOwnPropertySymbols(value).length || Object.keys(descriptors).some((key) => !allowedFields.has(key))) {
    throw new TypeError('Memory record contains an unsupported field');
  }
  const result: Record<string, string> = {};
  for (const key of [...requiredFields, ...optionalFields]) {
    const property = descriptors[key];
    const required = (requiredFields as readonly string[]).includes(key);
    if (!property && !required) continue;
    if (!property || !('value' in property)) throw new TypeError(`Memory record ${key} must be a string`);
    if (!required && property.value === undefined) continue;
    if (typeof property.value !== 'string') throw new TypeError(`Memory record ${key} must be a string`);
    if (Buffer.byteLength(property.value, 'utf8') > MEMORY_LIMITS.fieldBytes) {
      throw new RangeError(`Memory record ${key} exceeds the field byte limit`);
    }
    result[key] = property.value;
  }
  if (Buffer.byteLength(JSON.stringify(result), 'utf8') > MEMORY_LIMITS.recordBytes) {
    throw new RangeError('Memory record exceeds the record byte limit');
  }
  return result as unknown as DreamNight;
}

function queryTerms(query: string): string[] {
  if (typeof query !== 'string') throw new TypeError('Memory query must be a string');
  if (Buffer.byteLength(query, 'utf8') > MEMORY_LIMITS.queryBytes) throw new RangeError('Memory query exceeds the byte limit');
  const terms = query.toLowerCase().split(/\s+/).filter((term) => term.length > 1);
  if (terms.length > MEMORY_LIMITS.queryTerms) throw new RangeError('Memory query exceeds the term limit');
  return terms;
}

function validateK(k: number): void {
  if (!Number.isSafeInteger(k) || k < 0 || k > MEMORY_LIMITS.results) {
    throw new RangeError(`Memory k must be an integer between 0 and ${MEMORY_LIMITS.results}`);
  }
}

function searchableText(n: DreamNight): string {
  return `${n.deep} ${n.finding} ${n.verdict} ${n.detail ?? ''}`.toLowerCase();
}

/** Deterministic keyword relevance in [0,1] — the fallback scorer. */
export function keywordScore(query: string, text: string): number {
  const terms = queryTerms(query);
  if (typeof text !== 'string') throw new TypeError('Memory search text must be a string');
  if (Buffer.byteLength(text, 'utf8') > MEMORY_LIMITS.recordBytes * 2) throw new RangeError('Memory search text exceeds the byte limit');
  return scoreTerms(terms, text);
}

// Queues are removed when idle. The key canonicalizes parents, never the final file.
interface OperationQueue { tail: Promise<void>; pending: number }
const diskQueues = new Map<string, OperationQueue>();

function hasCode(error: unknown, code: string): boolean {
  return error !== null && typeof error === 'object' && 'code' in error && error.code === code;
}

/** Flat-file / in-memory backend. Always available. */
class FlatMemory implements DreamMemory {
  readonly backend = 'flat-file' as const;
  private nights: DreamNight[] = [];
  private texts: string[] = [];
  private storedBytes = 2;
  private path?: string;
  private readonly inMemory: boolean;
  private readonly queue: OperationQueue = { tail: Promise.resolve(), pending: 0 };

  constructor(opts: OpenOptions) {
    this.path = opts.path;
    this.inMemory = opts.inMemory ?? !opts.path;
    if (!this.inMemory && (typeof this.path !== 'string' || !this.path || this.path.includes('\0'))) {
      throw new TypeError('Disk memory requires a nonempty path without null bytes');
    }
  }

  async initialize(): Promise<void> {
    if (!this.inMemory) {
      const { resolve, dirname, basename, join } = await import('node:path');
      const { realpath, lstat } = await import('node:fs/promises');
      const requested = resolve(this.path!);
      let parent = dirname(requested);
      const suffix = [basename(requested)];
      for (;;) {
        try {
          // Resolve existing parent aliases (including macOS /var), but never
          // realpath the final file: a final symlink must still fail at load.
          const canonicalParent = await realpath(parent);
          if (!(await lstat(canonicalParent)).isDirectory()) throw new Error('Memory store parent must be a directory');
          this.path = join(canonicalParent, ...suffix);
          return;
        } catch (error) {
          if (!hasCode(error, 'ENOENT')) throw error;
          // A dangling parent symlink is not an absent directory to create.
          try {
            await lstat(parent);
            throw new Error('Memory store parent cannot be resolved; dangling symlinks are not supported', { cause: error });
          } catch (parentError) {
            if (!hasCode(parentError, 'ENOENT')) throw parentError;
          }
          const ancestor = dirname(parent);
          if (ancestor === parent) throw error;
          suffix.unshift(basename(parent));
          parent = ancestor;
        }
      }
    }
  }

  private serialize<T>(operation: () => Promise<T>): Promise<T> {
    const queue = this.inMemory ? this.queue : diskQueues.get(this.path!) ?? { tail: Promise.resolve(), pending: 0 };
    if (queue.pending >= MEMORY_LIMITS.pendingOperations) {
      return Promise.reject(new RangeError('Memory operation queue is full; await pending operations before retrying'));
    }
    queue.pending += 1;
    const result = queue.tail.then(operation);
    const complete = () => {
      queue.pending -= 1;
      if (!this.inMemory && queue.pending === 0 && diskQueues.get(this.path!) === queue) diskQueues.delete(this.path!);
    };
    queue.tail = result.then(complete, complete);
    if (!this.inMemory) diskQueues.set(this.path!, queue);
    return result;
  }

  private async load(): Promise<void> {
    if (this.inMemory) return;
    const { open, lstat } = await import('node:fs/promises');
    const { constants } = await import('node:fs');
    let handle;
    try {
      const state = await lstat(this.path!);
      if (!state.isFile()) throw new Error('Memory store must be a regular file, not a symlink or device');
      handle = await open(this.path!, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0) | (constants.O_NONBLOCK ?? 0));
    } catch (error) {
      if (!hasCode(error, 'ENOENT')) throw error;
      this.setNights([]);
      return;
    }
    let raw: string;
    try {
      const state = await handle.stat();
      if (!state.isFile()) throw new Error('Memory store must be a regular file');
      if (state.size > MEMORY_LIMITS.fileBytes) throw new RangeError('Memory store exceeds the file byte limit');
      // A bounded read prevents a changing file from growing an unbounded readFile buffer.
      const bytes = Buffer.alloc(Math.min(state.size + 1, MEMORY_LIMITS.fileBytes + 1));
      let count = 0;
      while (count < bytes.length) {
        const { bytesRead } = await handle.read(bytes, count, bytes.length - count, count);
        if (bytesRead === 0) break;
        count += bytesRead;
      }
      if (count > state.size) throw new Error('Memory store changed during read; retry after stopping other writers');
      if (count !== state.size) throw new Error('Memory store was truncated during read');
      raw = new TextDecoder('utf-8', { fatal: true }).decode(bytes.subarray(0, count));
    } finally {
      await handle.close();
    }
    const records: unknown = JSON.parse(raw);
    if (!Array.isArray(records)) throw new TypeError('Memory store must contain an array');
    if (records.length > MEMORY_LIMITS.records) throw new RangeError('Memory store exceeds the record count limit');
    this.setNights(records.map(snapshotNight));
  }

  private setNights(nights: DreamNight[]): void {
    this.nights = nights;
    this.texts = nights.map(searchableText);
    this.storedBytes = 2 + nights.reduce((sum, night) => sum + Buffer.byteLength(JSON.stringify(night), 'utf8'), 0)
      + Math.max(0, nights.length - 1);
  }

  private async persist(next: readonly DreamNight[]): Promise<void> {
    if (this.inMemory) return;
    const raw = JSON.stringify(next);
    const { open, mkdir, rename, unlink, lstat } = await import('node:fs/promises');
    const { dirname, basename, join } = await import('node:path');
    const { randomUUID } = await import('node:crypto');
    const directory = dirname(this.path!);
    await mkdir(directory, { recursive: true, mode: 0o700 });
    if (!(await lstat(directory)).isDirectory()) throw new Error('Memory store parent must be a directory, not a symlink');
    const temporary = join(directory, `.${basename(this.path!)}.${randomUUID()}.tmp`);
    const handle = await open(temporary, 'wx', 0o600);
    let committed = false;
    try {
      await handle.writeFile(raw, 'utf8');
      await handle.sync();
      await handle.close();
      try {
        if (!(await lstat(this.path!)).isFile()) throw new Error('Memory store must be a regular file, not a symlink or device');
      } catch (error) {
        if (!hasCode(error, 'ENOENT')) throw error;
      }
      await rename(temporary, this.path!);
      committed = true;
      // Windows does not expose portable directory fsync through Node. POSIX
      // callers get explicit commit uncertainty rather than a silent fsync failure.
      if (process.platform !== 'win32') {
        try {
          const parent = await open(directory, 'r');
          try { await parent.sync(); } finally { await parent.close(); }
        } catch (error) {
          throw new MemoryCommitUncertainError(error);
        }
      }
    } finally {
      // close() is idempotent. Cleanup failure must not hide the original error.
      await handle.close().catch(() => undefined);
      if (!committed) await unlink(temporary).catch(() => undefined);
    }
  }

  async remember(night: DreamNight): Promise<void> {
    const snapshot = snapshotNight(night);
    return this.serialize(async () => {
      await this.load();
      if (this.nights.length >= MEMORY_LIMITS.records) throw new RangeError('Memory store exceeds the record count limit');
      const nextBytes = this.storedBytes + Buffer.byteLength(JSON.stringify(snapshot), 'utf8') + (this.nights.length > 0 ? 1 : 0);
      if (nextBytes > MEMORY_LIMITS.fileBytes) throw new RangeError('Memory store exceeds the file byte limit');
      const next = [...this.nights, snapshot];
      await this.persist(next);
      this.nights = next;
      this.storedBytes = nextBytes;
      this.texts.push(searchableText(snapshot));
    });
  }

  async recall(query: string, k = 5): Promise<RecallHit[]> {
    const terms = queryTerms(query);
    validateK(k);
    return this.serialize(async () => {
      await this.load();
      return selectRecallHits(this.nights, this.texts, terms, k);
    });
  }

  async all(): Promise<DreamNight[]> {
    return this.serialize(async () => {
      await this.load();
      return this.nights.map((night) => ({ ...night }));
    });
  }
}

/**
 * Probe for a usable ruvector wasm module. Returns the module or null.
 * Never throws — a missing/broken optional dep is a graceful null.
 */
export async function probeRuvector(
  loader?: () => Promise<unknown>,
): Promise<unknown | null> {
  const load =
    loader ??
    (async () => {
      // Indirect specifier so bundlers/TS don't hard-require the optional dep.
      const spec = '@ruvector/wasm';
      return import(/* @vite-ignore */ spec);
    });
  try {
    const mod = await load();
    return mod ?? null;
  } catch {
    return null;
  }
}

/**
 * Open a DreamMemory. Auto mode probes optional module availability and returns
 * the implemented flat-file backend. Explicit RVF requests fail until the real
 * adapter passes its write, reopen, query and digest-verification contract.
 */
export async function openMemory(opts: OpenOptions = {}): Promise<DreamMemory> {
  const want = opts.backend ?? 'auto';
  if (!['auto', 'flat-file', 'ruvector-rvf'].includes(want)) throw new TypeError('Unknown memory backend');
  let ruvectorAvailable = false;

  if (want === 'ruvector-rvf' || want === 'auto') {
    const mod = await probeRuvector(opts.loadRuvector);
    if (mod) {
      if (want === 'ruvector-rvf') {
        throw new Error('ruvector-rvf backend is not implemented; use auto or flat-file');
      }
      // Availability is not proof of an executing adapter.
      ruvectorAvailable = true;
    }
    if (want === 'ruvector-rvf') {
      throw new Error('ruvector-rvf backend requested but @ruvector/wasm is not installed');
    }
  }
  const flat = new FlatMemory(opts);
  await flat.initialize();
  if (ruvectorAvailable) {
    // This is module availability only, not an executing adapter.
    (flat as unknown as { _ruvectorAvailable: boolean })._ruvectorAvailable = true;
  }
  return flat;
}
