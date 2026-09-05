import { createHash } from 'node:crypto';
import { decodeTicket, encodeTicket, MAX_TICKET_BYTES, TicketFormatError } from './index.js';

export interface ParserFuzzResult {
  seed: number;
  iterations: number;
  accepted: number;
  rejected: number;
  corpusSha256: string;
}

/** Deterministic bounded parser smoke fuzzing, NOT coverage-guided fuzz evidence. */
export function runTicketParserFuzz(seed: number, iterations: number, canonicalTicket?: Uint8Array): ParserFuzzResult {
  if (!Number.isInteger(seed) || seed < 1 || seed > 0xffffffff) throw new RangeError('Seed must be a nonzero uint32');
  if (!Number.isInteger(iterations) || iterations < 1 || iterations > 1_000_000) throw new RangeError('Iterations must be 1 through 1000000');
  const canonical = canonicalTicket ? encodeTicket(decodeTicket(canonicalTicket)) : undefined;
  let state = seed;
  const next = (): number => { state ^= state << 13; state ^= state >>> 17; state ^= state << 5; return state >>> 0; };
  const hash = createHash('sha256');
  let accepted = 0;
  let rejected = 0;
  for (let i = 0; i < iterations; i++) {
    let bytes: Uint8Array;
    if (canonical && i % 2 === 0) {
      bytes = Uint8Array.from(canonical);
      const count = next() % 4;
      for (let n = 0; n < count; n++) bytes[next() % bytes.length] ^= 1 << (next() % 8);
    } else {
      bytes = new Uint8Array(next() % (MAX_TICKET_BYTES + 2));
      for (let n = 0; n < bytes.length; n++) bytes[n] = next() & 255;
    }
    const length = Buffer.alloc(2); length.writeUInt16BE(bytes.length);
    hash.update(length); hash.update(bytes);
    let decoded;
    try { decoded = decodeTicket(bytes); }
    catch (error) { if (!(error instanceof TicketFormatError)) throw error; rejected++; continue; }
    if (!Buffer.from(encodeTicket(decoded)).equals(Buffer.from(bytes))) throw new Error('Parser accepted noncanonical input');
    accepted++;
  }
  return { seed, iterations, accepted, rejected, corpusSha256: hash.digest('hex') };
}
