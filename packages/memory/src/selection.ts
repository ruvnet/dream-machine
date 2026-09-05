/** Internal pure selection kernel. Callers validate limits before entering here. */
import type { DreamNight, RecallHit } from './index.js';

export function scoreTerms(terms: readonly string[], text: string): number {
  if (terms.length === 0) return 0;
  let hits = 0;
  for (const term of terms) if (text.includes(term)) hits += 1;
  return hits / terms.length;
}

interface RankedHit extends RecallHit { index: number }

function worse(a: RankedHit, b: RankedHit): boolean {
  return a.score < b.score || (a.score === b.score && a.index > b.index);
}

/** Exact bounded top K. The heap root is the worst selected hit. */
export function selectRecallHits(
  nights: readonly DreamNight[], texts: readonly string[], terms: readonly string[], k: number,
): RecallHit[] {
  if (k === 0 || terms.length === 0) return [];
  const heap: RankedHit[] = [];
  for (let index = 0; index < nights.length; index += 1) {
    const score = scoreTerms(terms, texts[index]);
    if (score === 0) continue;
    const hit = { night: nights[index], score, index };
    if (heap.length < k) {
      heap.push(hit);
      let child = heap.length - 1;
      while (child > 0) {
        const parent = Math.floor((child - 1) / 2);
        if (!worse(heap[child], heap[parent])) break;
        [heap[child], heap[parent]] = [heap[parent], heap[child]];
        child = parent;
      }
    } else if (worse(heap[0], hit)) {
      heap[0] = hit;
      let parent = 0;
      while (parent * 2 + 1 < heap.length) {
        const left = parent * 2 + 1;
        const right = left + 1;
        const child = right < heap.length && worse(heap[right], heap[left]) ? right : left;
        if (!worse(heap[child], heap[parent])) break;
        [heap[child], heap[parent]] = [heap[parent], heap[child]];
        parent = child;
      }
    }
  }
  return heap.sort((a, b) => b.score - a.score || a.index - b.index)
    .map(({ night, score }) => ({ night: { ...night }, score }));
}
