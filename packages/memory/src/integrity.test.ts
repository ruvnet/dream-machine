import * as fs from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MEMORY_LIMITS, MemoryCommitUncertainError, keywordScore, openMemory, type DreamNight } from './index.js';

// Clone the namespace so failure injection does not mutate Node's immutable ESM exports.
vi.mock('node:fs/promises', async (importOriginal) => ({
  ...await importOriginal<typeof import('node:fs/promises')>(),
}));

const night: DreamNight = { date: '2026-09-05', deep: 'security', finding: 'prompt injection', verdict: 'ACCEPT' };
const directories: string[] = [];

async function diskPath(): Promise<string> {
  const directory = await fs.mkdtemp(join(tmpdir(), 'dream-memory-test-'));
  directories.push(directory);
  return join(directory, 'nights.json');
}

afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(directories.splice(0).map((directory) => fs.rm(directory, { recursive: true, force: true })));
});

describe('memory input and snapshot boundaries', () => {
  it('captures caller input before queueing and detaches all returned records', async () => {
    const memory = await openMemory({ backend: 'flat-file', inMemory: true });
    const input = { ...night };
    const pending = memory.remember(input);
    input.finding = 'tampered';
    await pending;
    const first = await memory.all();
    first[0].finding = 'mutated snapshot';
    first.push({ ...night });
    const hit = (await memory.recall('prompt'))[0];
    hit.night.finding = 'mutated hit';
    expect(await memory.all()).toEqual([night]);
  });

  it.each([null, [], 1, 'text', {}, { ...night, finding: 2 }, { ...night, privileged: true }])(
    'rejects malformed records without changing memory: %j', async (value) => {
      const memory = await openMemory({ backend: 'flat-file' });
      await expect(memory.remember(value as DreamNight)).rejects.toThrow(TypeError);
      expect(await memory.all()).toEqual([]);
    },
  );

  it('rejects accessors and inherited fields without executing accessors', async () => {
    const memory = await openMemory({ backend: 'flat-file' });
    const getter = vi.fn(() => 'secret');
    await expect(memory.remember(Object.defineProperty({ ...night }, 'finding', { get: getter }))).rejects.toThrow(TypeError);
    expect(getter).not.toHaveBeenCalled();
    await expect(memory.remember(Object.create(night) as DreamNight)).rejects.toThrow(TypeError);
    await expect(memory.remember({ ...night, [Symbol('hidden')]: 'value' })).rejects.toThrow(TypeError);
  });

  it('keeps optional undefined fields optional and accepts null prototype plain records', async () => {
    const memory = await openMemory({ backend: 'flat-file' });
    await memory.remember(Object.assign(Object.create(null), night, { detail: undefined }));
    expect(await memory.all()).toEqual([night]);
  });

  it('enforces UTF-8 field and complete encoded record limits', async () => {
    const memory = await openMemory({ backend: 'flat-file' });
    await expect(memory.remember({ ...night, detail: '😀'.repeat(MEMORY_LIMITS.fieldBytes / 4 + 1) })).rejects.toThrow(/field byte/);
    await expect(memory.remember({ ...night, finding: 'x'.repeat(MEMORY_LIMITS.fieldBytes), detail: 'y'.repeat(MEMORY_LIMITS.fieldBytes) })).rejects.toThrow(/record byte/);
    // Escaping in the JSON representation counts toward the whole record cap.
    await expect(memory.remember({ ...night, detail: '\u0000'.repeat(MEMORY_LIMITS.fieldBytes) })).rejects.toThrow(/record byte/);
  });

  it.each([NaN, Infinity, -Infinity, -1, 1.5, MEMORY_LIMITS.results + 1, Number.MAX_SAFE_INTEGER])(
    'rejects unsafe result count %s', async (k) => {
      const memory = await openMemory({ backend: 'flat-file' });
      await expect(memory.recall('prompt', k)).rejects.toThrow(RangeError);
    },
  );

  it('bounds query bytes and terms, and returns no hits for empty terms or zero k', async () => {
    const memory = await openMemory({ backend: 'flat-file' });
    await memory.remember(night);
    await expect(memory.recall('😀'.repeat(MEMORY_LIMITS.queryBytes / 4 + 1))).rejects.toThrow(/byte limit/);
    await expect(memory.recall('term '.repeat(MEMORY_LIMITS.queryTerms + 1))).rejects.toThrow(/term limit/);
    await expect(memory.recall(null as unknown as string)).rejects.toThrow(TypeError);
    expect(await memory.recall('prompt', 0)).toEqual([]);
    expect(await memory.recall('  a \t')).toEqual([]);
    expect(keywordScore('', '')).toBe(0);
    expect(keywordScore('prompt prompt missing', 'prompt')).toBe(2 / 3);
    expect(() => keywordScore('prompt', 'x'.repeat(MEMORY_LIMITS.recordBytes * 2 + 1))).toThrow(/byte limit/);
  });

  it('bounds record counts without poisoning the existing store', async () => {
    const memory = await openMemory({ backend: 'flat-file' });
    for (let i = 0; i < MEMORY_LIMITS.records; i += 1) await memory.remember(night);
    await expect(memory.remember(night)).rejects.toThrow(/record count/);
    expect(await memory.all()).toHaveLength(MEMORY_LIMITS.records);
  });

  it('bounds total in-memory bytes separately from record count', async () => {
    const memory = await openMemory({ backend: 'flat-file' });
    const record = { ...night, detail: 'x'.repeat(30_000) };
    const encodedBytes = Buffer.byteLength(JSON.stringify(record));
    const capacity = Math.floor((MEMORY_LIMITS.fileBytes - 1) / (encodedBytes + 1));
    for (let i = 0; i < capacity; i += 1) await memory.remember(record);
    await expect(memory.remember(record)).rejects.toThrow(/file byte/);
    expect(await memory.all()).toHaveLength(capacity);
  });

  it('applies bounded backpressure and recovers after queued operations finish', async () => {
    const memory = await openMemory({ backend: 'flat-file' });
    const pending = Array.from({ length: MEMORY_LIMITS.pendingOperations }, () => memory.remember(night));
    await expect(memory.remember(night)).rejects.toThrow(/queue is full/);
    await Promise.all(pending);
    await memory.remember(night);
    expect(await memory.all()).toHaveLength(MEMORY_LIMITS.pendingOperations + 1);
  });

  it('requires an explicit disk path and rejects unknown runtime backends', async () => {
    await expect(openMemory({ backend: 'flat-file', inMemory: false })).rejects.toThrow(/path/);
    await expect(openMemory({ backend: 'flat-file', inMemory: false, path: 'bad\0path' })).rejects.toThrow(/path/);
    await expect(openMemory({ backend: 'unknown' as 'flat-file' })).rejects.toThrow(/Unknown memory backend/);
  });
});

describe('atomic flat file persistence', () => {
  it('creates a private file, roundtrips Unicode and reopens in another handle', async () => {
    const path = await diskPath();
    const record = { ...night, detail: '呼吸 😴' };
    const memory = await openMemory({ backend: 'flat-file', path });
    expect(await memory.all()).toEqual([]);
    await memory.remember(record);
    const reopened = await openMemory({ backend: 'flat-file', path });
    expect(await reopened.all()).toEqual([record]);
    if (process.platform !== 'win32') expect((await fs.stat(path)).mode & 0o777).toBe(0o600);
    expect(await fs.readdir(directories[0])).toEqual(['nights.json']);
  });

  it('serializes concurrent remember and read calls in submission order', async () => {
    const path = await diskPath();
    const memory = await openMemory({ backend: 'flat-file', path });
    const pending = Array.from({ length: 30 }, (_, i) => memory.remember({ ...night, date: String(i) }));
    const snapshot = memory.all();
    await Promise.all(pending);
    expect((await snapshot).map((record) => record.date)).toEqual(Array.from({ length: 30 }, (_, i) => String(i)));
    const reopened = await openMemory({ backend: 'flat-file', path });
    expect(await reopened.all()).toHaveLength(30);
  });

  it('serializes independent handles using the same resolved path without lost updates', async () => {
    const path = await diskPath();
    const first = await openMemory({ backend: 'flat-file', path });
    const second = await openMemory({ backend: 'flat-file', path: join(directories[0], '.', 'nights.json') });
    await Promise.all(Array.from({ length: 20 }, (_, i) => (i % 2 ? first : second).remember({ ...night, date: String(i) })));
    expect(await first.all()).toEqual(await second.all());
    expect((await first.all()).map((record) => record.date)).toEqual(Array.from({ length: 20 }, (_, i) => String(i)));
  });

  it.each([false, true])('canonicalizes parent aliases into one owner queue (missing suffix: %s)', async (missingSuffix) => {
    await diskPath();
    const realDirectory = join(directories[0], 'real');
    const aliasDirectory = join(directories[0], 'alias');
    await fs.mkdir(realDirectory);
    await fs.symlink(realDirectory, aliasDirectory, 'dir');
    const suffix = missingSuffix ? ['not-created', 'nested', 'nights.json'] : ['nights.json'];
    const first = await openMemory({ backend: 'flat-file', path: join(realDirectory, ...suffix) });
    const second = await openMemory({ backend: 'flat-file', path: join(aliasDirectory, ...suffix) });
    await Promise.all(Array.from({ length: 30 }, (_, i) => (i % 2 ? first : second).remember({ ...night, date: String(i) })));
    const expected = Array.from({ length: 30 }, (_, i) => ({ ...night, date: String(i) }));
    expect(await first.all()).toEqual(expected);
    expect(await second.all()).toEqual(expected);
    const reopened = await openMemory({ backend: 'flat-file', path: join(aliasDirectory, ...suffix) });
    expect(await reopened.all()).toEqual(expected);
    expect((await fs.lstat(aliasDirectory)).isSymbolicLink()).toBe(true);
  });

  it('canonicalizing a parent alias never follows a final file symlink', async () => {
    await diskPath();
    const realDirectory = join(directories[0], 'real');
    const aliasDirectory = join(directories[0], 'alias');
    await fs.mkdir(realDirectory);
    await fs.symlink(realDirectory, aliasDirectory, 'dir');
    const target = join(realDirectory, 'target.json');
    const link = join(realDirectory, 'nights.json');
    await fs.writeFile(target, '[]');
    await fs.symlink(target, link);
    const memory = await openMemory({ backend: 'flat-file', path: join(aliasDirectory, 'nights.json') });
    await expect(memory.remember(night)).rejects.toThrow(/regular file/);
    expect(await fs.readFile(target, 'utf8')).toBe('[]');
    expect((await fs.lstat(link)).isSymbolicLink()).toBe(true);
  });

  it('propagates parent permission errors and rejects dangling parent aliases', async () => {
    const path = await diskPath();
    const realpath = vi.spyOn(fs, 'realpath').mockRejectedValueOnce(Object.assign(new Error('synthetic parent EACCES'), { code: 'EACCES' }));
    await expect(openMemory({ backend: 'flat-file', path })).rejects.toThrow('synthetic parent EACCES');
    realpath.mockRestore();
    const alias = join(directories[0], 'dangling');
    await fs.symlink(join(directories[0], 'absent'), alias, 'dir');
    await expect(openMemory({ backend: 'flat-file', path: join(alias, 'nested', 'nights.json') })).rejects.toThrow(/dangling symlinks/);
    expect((await fs.lstat(alias)).isSymbolicLink()).toBe(true);
  });

  it.each(['', '[', '{"not":"an array"}', '[null]', JSON.stringify([{ ...night, finding: 123 }]), '[{"__proto__":{"polluted":true}}]'])(
    'never replaces a corrupt or invalid store: %j', async (raw) => {
      const path = await diskPath();
      await fs.writeFile(path, raw);
      const memory = await openMemory({ backend: 'flat-file', path });
      await expect(memory.all()).rejects.toThrow();
      await expect(memory.remember(night)).rejects.toThrow();
      expect(await fs.readFile(path, 'utf8')).toBe(raw);
      // Once the owner repairs the source, the failed queue can safely retry.
      await fs.writeFile(path, '[]');
      await memory.remember(night);
      expect(await memory.all()).toEqual([night]);
    },
  );

  it('does not hide invalid UTF-8, file errors or oversized disk input', async () => {
    const path = await diskPath();
    await fs.writeFile(path, Buffer.from([0x5b, 0x22, 0xff, 0x22, 0x5d]));
    const memory = await openMemory({ backend: 'flat-file', path });
    await expect(memory.all()).rejects.toThrow();
    const readError = Object.assign(new Error('synthetic EACCES'), { code: 'EACCES' });
    const open = vi.spyOn(fs, 'open').mockRejectedValueOnce(readError);
    await expect(memory.all()).rejects.toThrow('synthetic EACCES');
    open.mockRestore();
    await fs.truncate(path, MEMORY_LIMITS.fileBytes + 1);
    await expect(memory.remember(night)).rejects.toThrow(/file byte/);
    expect((await fs.stat(path)).size).toBe(MEMORY_LIMITS.fileBytes + 1);
  });

  it('rejects an over-count disk array before attempting a write', async () => {
    const path = await diskPath();
    const raw = JSON.stringify(Array.from({ length: MEMORY_LIMITS.records + 1 }, () => night));
    await fs.writeFile(path, raw);
    const memory = await openMemory({ backend: 'flat-file', path });
    await expect(memory.remember(night)).rejects.toThrow(/record count/);
    expect(await fs.readFile(path, 'utf8')).toBe(raw);
  });

  it('keeps committed bytes and cleans temporary files on rename failure, then retries once', async () => {
    const path = await diskPath();
    const memory = await openMemory({ backend: 'flat-file', path });
    await memory.remember(night);
    const original = await fs.readFile(path, 'utf8');
    const rename = vi.spyOn(fs, 'rename').mockRejectedValueOnce(new Error('synthetic rename failure'));
    await expect(memory.remember({ ...night, date: 'next' })).rejects.toThrow('synthetic rename failure');
    expect(await fs.readFile(path, 'utf8')).toBe(original);
    expect(await memory.all()).toEqual([night]);
    expect(await fs.readdir(directories[0])).toEqual(['nights.json']);
    rename.mockRestore();
    await memory.remember({ ...night, date: 'next' });
    expect((await memory.all()).map((record) => record.date)).toEqual([night.date, 'next']);
  });

  it.each(['writeFile', 'sync'] as const)('preserves the committed file when temporary %s fails', async (method) => {
    const path = await diskPath();
    const memory = await openMemory({ backend: 'flat-file', path });
    await memory.remember(night);
    const original = await fs.readFile(path, 'utf8');
    const originalOpen = fs.open;
    vi.spyOn(fs, 'open').mockImplementation(async (file, flags, mode) => {
      const handle = await originalOpen(file, flags, mode);
      if (flags === 'wx') {
        if (method === 'writeFile') {
          const originalWrite = handle.writeFile.bind(handle);
          vi.spyOn(handle, 'writeFile').mockImplementationOnce(async () => {
            await originalWrite('[partial');
            throw new Error('synthetic partial write failure');
          });
        } else {
          vi.spyOn(handle, 'sync').mockRejectedValueOnce(new Error('synthetic fsync failure'));
        }
      }
      return handle;
    });
    await expect(memory.remember({ ...night, date: 'next' })).rejects.toThrow(/synthetic/);
    expect(await fs.readFile(path, 'utf8')).toBe(original);
    expect(await memory.all()).toEqual([night]);
    expect(await fs.readdir(directories[0])).toEqual(['nights.json']);
  });

  it.skipIf(process.platform === 'win32')('reports post-rename durability uncertainty without hiding committed data', async () => {
    const path = await diskPath();
    const memory = await openMemory({ backend: 'flat-file', path });
    const originalOpen = fs.open;
    vi.spyOn(fs, 'open').mockImplementation(async (file, flags, mode) => {
      const handle = await originalOpen(file, flags, mode);
      if (flags === 'r') vi.spyOn(handle, 'sync').mockRejectedValueOnce(new Error('synthetic directory fsync failure'));
      return handle;
    });
    await expect(memory.remember(night)).rejects.toMatchObject({ name: 'MemoryCommitUncertainError', committed: true });
    expect(MemoryCommitUncertainError.prototype).toBeInstanceOf(Error);
    expect(await memory.all()).toEqual([night]);
    expect(await fs.readdir(directories[0])).toEqual(['nights.json']);
  });

  it('rejects final symlinks and never mutates their targets', async () => {
    const path = await diskPath();
    const target = join(directories[0], 'target.json');
    await fs.writeFile(target, '[]');
    await fs.symlink(target, path);
    const memory = await openMemory({ backend: 'flat-file', path });
    await expect(memory.all()).rejects.toThrow(/regular file/);
    await expect(memory.remember(night)).rejects.toThrow(/regular file/);
    expect(await fs.readFile(target, 'utf8')).toBe('[]');
    expect((await fs.lstat(path)).isSymbolicLink()).toBe(true);
  });

  it('rejects directories used as memory files without replacing them', async () => {
    const path = await diskPath();
    await fs.mkdir(path);
    const memory = await openMemory({ backend: 'flat-file', path });
    await expect(memory.remember(night)).rejects.toThrow(/regular file/);
    expect((await fs.lstat(path)).isDirectory()).toBe(true);
  });

  it('refuses corrupt replacements even after a valid store was read', async () => {
    const path = await diskPath();
    const memory = await openMemory({ backend: 'flat-file', path });
    await memory.remember(night);
    await fs.writeFile(path, '[truncated');
    await expect(memory.remember(night)).rejects.toThrow();
    expect(await fs.readFile(path, 'utf8')).toBe('[truncated');
  });

  it.each(['growth', 'truncation'])('detects %s during the bounded read without committing an append', async (kind) => {
    const path = await diskPath();
    const raw = JSON.stringify([night]);
    await fs.writeFile(path, raw);
    const memory = await openMemory({ backend: 'flat-file', path });
    const originalOpen = fs.open;
    vi.spyOn(fs, 'open').mockImplementation(async (file, flags, mode) => {
      const handle = await originalOpen(file, flags, mode);
      const originalStat = handle.stat.bind(handle);
      vi.spyOn(handle, 'stat').mockImplementationOnce(async () => {
        const state = await originalStat();
        if (kind === 'growth') await fs.appendFile(path, ' ');
        else await fs.truncate(path, raw.length - 1);
        return state;
      });
      return handle;
    });
    await expect(memory.remember(night)).rejects.toThrow(kind === 'growth' ? /changed during read/ : /truncated during read/);
    expect(await fs.readFile(path, 'utf8')).toBe(kind === 'growth' ? `${raw} ` : raw.slice(0, -1));
  });
});

describe('exact top K oracle', () => {
  it('matches full stable sorting across randomized ties, duplicate terms, misses and k boundaries', async () => {
    let state = 0x12345678;
    const random = () => { state = (Math.imul(1664525, state) + 1013904223) >>> 0; return state / 2 ** 32; };
    const words = ['alpha', 'beta', 'gamma', 'delta', 'epsilon', 'zeta'];
    const memory = await openMemory({ backend: 'flat-file' });
    const records = Array.from({ length: 600 }, (_, i) => ({ ...night, date: String(i), finding: words.filter(() => random() > 0.45).join(' ') }));
    for (const record of records) await memory.remember(record);
    for (const query of ['alpha beta', 'gamma gamma delta', 'missing', '', 'GAMMA ZETA', 'a alpha', ...Array.from({ length: 12 }, () => words.filter(() => random() > 0.5).join(' '))]) {
      const terms = query.toLowerCase().split(/\s+/).filter((term) => term.length > 1);
      const expected = records.map((record, index) => {
        const text = `${record.deep} ${record.finding} ${record.verdict} ${record.detail ?? ''}`.toLowerCase();
        return { night: record, score: terms.length ? terms.filter((term) => text.includes(term)).length / terms.length : 0, index };
      }).filter((hit) => hit.score > 0).sort((a, b) => b.score - a.score || a.index - b.index)
        .map(({ night: record, score }) => ({ night: record, score }));
      for (const k of [0, 1, 2, 5, 20, 599, 600, MEMORY_LIMITS.results]) {
        expect(await memory.recall(query, k)).toEqual(expected.slice(0, k));
      }
    }
  });
});
