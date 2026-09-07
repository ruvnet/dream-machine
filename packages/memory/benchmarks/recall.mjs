/** Synthetic, non-clinical benchmark of the exact production selection kernel. */
import { deepStrictEqual } from 'node:assert';
import { arch, cpus, platform } from 'node:os';
import { performance } from 'node:perf_hooks';
import process from 'node:process';
import console from 'node:console';
import { pathToFileURL } from 'node:url';
import { MEMORY_LIMITS } from '../dist/index.js';
import { scoreTerms, selectRecallHits } from '../dist/selection.js';

/** Full stable sort with identical cached text, scoring and detached output. */
export function fullSortRecall(nights, texts, terms, k) {
  return nights.map((night, index) => ({ night, index, score: scoreTerms(terms, texts[index]) }))
    .filter((hit) => hit.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, k).map(({ night, score }) => ({ night: { ...night }, score }));
}

export function benchmarkRecall({ recordCount = 10_000, k = 5, rounds = 40, warmup = 8 } = {}) {
  for (const [name, value, maximum, minimum] of [
    ['recordCount', recordCount, MEMORY_LIMITS.records, 1], ['k', k, MEMORY_LIMITS.results, 0],
    ['rounds', rounds, 1000, 10], ['warmup', warmup, 100, 1],
  ]) {
    if (!Number.isSafeInteger(value) || value < minimum || value > maximum) throw new RangeError(`Invalid ${name}`);
  }
  let seed = 0xdecafbad;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 2 ** 32; };
  const words = ['alpha', 'beta', 'gamma', 'delta', 'epsilon', 'zeta', 'memory', 'security'];
  const nights = Array.from({ length: recordCount }, (_, index) => ({
    date: String(index), deep: 'synthetic', verdict: 'INCONCLUSIVE',
    finding: words.filter(() => random() > 0.45).join(' '),
  }));
  const texts = nights.map((night) => `${night.deep} ${night.finding} ${night.verdict} `.toLowerCase());
  const queries = ['alpha beta', 'gamma delta epsilon', 'security memory zeta', 'missing', 'alpha alpha zeta'];
  const termSets = queries.map((query) => query.split(/\s+/));
  for (const terms of termSets) deepStrictEqual(selectRecallHits(nights, texts, terms, k), fullSortRecall(nights, texts, terms, k));
  for (let i = 0; i < warmup; i += 1) {
    for (const terms of termSets) {
      fullSortRecall(nights, texts, terms, k);
      selectRecallHits(nights, texts, terms, k);
    }
  }
  const measurements = { fullSortMs: [], boundedTopKMs: [] };
  let checksum = 0;
  for (let round = 0; round < rounds; round += 1) {
    for (const terms of termSets) {
      const operations = [['fullSortMs', fullSortRecall], ['boundedTopKMs', selectRecallHits]];
      if (round % 2) operations.reverse();
      for (const [key, operation] of operations) {
        const start = performance.now();
        const result = operation(nights, texts, terms, k);
        measurements[key].push(performance.now() - start);
        checksum += result.length + (result[0]?.score ?? 0);
      }
    }
  }
  const stats = (values) => {
    const sorted = [...values].sort((a, b) => a - b);
    return {
      count: sorted.length,
      p50: sorted[Math.ceil(sorted.length * 0.5) - 1],
      p95: sorted[Math.ceil(sorted.length * 0.95) - 1],
      minimum: sorted[0], maximum: sorted.at(-1),
    };
  };
  const fullSortMs = stats(measurements.fullSortMs);
  const boundedTopKMs = stats(measurements.boundedTopKMs);
  return {
    schemaVersion: 1, benchmark: 'exact-recall-selection', createdAt: new Date().toISOString(),
    environment: { node: process.version, platform: platform(), arch: arch(), cpu: cpus()[0]?.model ?? 'unknown' },
    fixture: { seed: '0xdecafbad', recordCount, k, rounds, warmup, queries },
    scope: 'selection only; excludes file IO, validation, and text preprocessing; both paths use identical cached inputs',
    correctness: { exactOracle: true, queriesChecked: termSets.length, checksum },
    fullSortMs, boundedTopKMs,
    p50Speedup: fullSortMs.p50 / boundedTopKMs.p50,
    measurements,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  console.log(JSON.stringify(benchmarkRecall(), null, 2));
}
