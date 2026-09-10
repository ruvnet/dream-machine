import { describe, it, expect } from 'vitest';
import { openMemory, keywordScore, probeRuvector, type DreamNight } from './index.js';

const nights: DreamNight[] = [
  { date: '2026-08-13', deep: 'security-adversarial', finding: 'add indirect prompt injection family', verdict: 'ACCEPT' },
  { date: '2026-08-14', deep: 'flywheel-promotion', finding: 'router calibration loop is noisy', verdict: 'INCONCLUSIVE' },
  { date: '2026-08-15', deep: 'darwin-evolution', finding: 'bounded mutation of routing weights', verdict: 'REJECT' },
];

describe('keywordScore', () => {
  it('is 1 when all terms hit, 0 when none', () => {
    expect(keywordScore('prompt injection', 'add indirect prompt injection family')).toBe(1);
    expect(keywordScore('kubernetes helm', 'add indirect prompt injection family')).toBe(0);
  });
  it('is fractional on partial hits', () => {
    expect(keywordScore('prompt kubernetes', 'add indirect prompt injection')).toBeCloseTo(0.5);
  });
});

describe('flat-file backend (default, always available)', () => {
  it('remembers and recalls by relevance', async () => {
    const mem = await openMemory({ backend: 'flat-file', inMemory: true });
    expect(mem.backend).toBe('flat-file');
    for (const n of nights) await mem.remember(n);
    const hits = await mem.recall('prompt injection', 3);
    expect(hits[0].night.finding).toContain('prompt injection');
    expect(hits[0].score).toBeGreaterThan(0);
  });

  it('all() returns everything remembered', async () => {
    const mem = await openMemory({ inMemory: true });
    for (const n of nights) await mem.remember(n);
    expect(await mem.all()).toHaveLength(3);
  });

  it('recall returns [] when nothing matches', async () => {
    const mem = await openMemory({ inMemory: true });
    await mem.remember(nights[0]);
    expect(await mem.recall('nonexistent xyzzy')).toEqual([]);
  });
});

describe('ruvector probe / optional degradation', () => {
  it('probeRuvector returns null when the module is absent (no throw)', async () => {
    const mod = await probeRuvector(async () => {
      throw new Error('MODULE_NOT_FOUND');
    });
    expect(mod).toBeNull();
  });

  it('auto backend falls back to flat-file when ruvector is absent', async () => {
    const mem = await openMemory({
      inMemory: true,
      loadRuvector: async () => {
        throw new Error('MODULE_NOT_FOUND');
      },
    });
    expect(mem.backend).toBe('flat-file');
    await mem.remember(nights[0]);
    expect(await mem.all()).toHaveLength(1);
  });

  it('notes ruvector availability when the module loads', async () => {
    const mem = await openMemory({
      inMemory: true,
      loadRuvector: async () => ({ fakeRuvector: true }),
    });
    // Still functionally the deterministic backend, but availability is tagged.
    expect(mem.backend).toBe('flat-file');
    expect((mem as unknown as { _ruvectorAvailable?: boolean })._ruvectorAvailable).toBe(true);
    await mem.remember(nights[1]);
    expect((await mem.recall('router calibration'))[0].night.date).toBe('2026-08-14');
  });

  it('rejects an explicit RVF request when the module is absent', async () => {
    await expect(
      openMemory({ backend: 'ruvector-rvf', inMemory: true, loadRuvector: async () => null }),
    ).rejects.toThrow(/not installed/);
  });

  it('never labels keyword memory as RVF when the optional module loads', async () => {
    await expect(openMemory({
      backend: 'ruvector-rvf',
      inMemory: true,
      loadRuvector: async () => ({ fakeRuvector: true }),
    })).rejects.toThrow(/not implemented/);
  });
});
