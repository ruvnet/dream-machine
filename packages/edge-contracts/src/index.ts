import { KeyObject, verify } from 'node:crypto';
export { parseDreamResourceUri, ResourceUriError } from './uri.js';
export type { DreamResourceName, ParsedDreamResourceUri } from './uri.js';

/** Research prototype, not hardware or Edge Contract v1 conformance evidence. */
export const CONTRACT_STATUS = 'edge-v1-prototype' as const;
export const MAX_TICKET_BYTES = 768;
const MAX_UINT64 = (1n << 64n) - 1n;
const TYPED_ARRAY_PROTO: object = Object.getPrototypeOf(Uint8Array.prototype);
const BYTE_LENGTH = Object.getOwnPropertyDescriptor(TYPED_ARRAY_PROTO, 'byteLength')!.get!;
const BYTE_OFFSET = Object.getOwnPropertyDescriptor(TYPED_ARRAY_PROTO, 'byteOffset')!.get!;
const ARRAY_BUFFER = Object.getOwnPropertyDescriptor(TYPED_ARRAY_PROTO, 'buffer')!.get!;

/** Exact JSON projection of safety-decision.schema.json/$defs/ticket. */
export interface CueTicketV1 {
  version: 1;
  ticketId: string;
  proposalSha256: string;
  deviceId: string;
  bootId: string;
  challengeId: string;
  policySha256: string;
  firmwareSha256: string;
  experimentId: string;
  consentEpoch: number;
  sequence: string;
  issuedMonotonicUs: string;
  notBeforeMonotonicUs: string;
  expiresMonotonicUs: string;
  stateDigest: string;
  confidenceQ15: number;
  modality: 'audio' | 'light' | 'haptic';
  assetSha256: string;
  intensityQ15: number;
  durationMs: number;
  rampMs: number;
  reasonCode: number;
  consentSha256: string;
  signature: string;
}

export type UnsignedCueTicketV1 = Omit<CueTicketV1, 'signature'>;
type Field = keyof CueTicketV1;
type Descriptor = readonly [Field, 'id' | 'digest' | 'u64' | 'uint' | 'modality' | 'signature', number?, number?];

// The position IS the frozen numeric CBOR key. Do not alphabetically reorder.
const FIELDS: readonly Descriptor[] = [
  ['version', 'uint', 1, 1], ['ticketId', 'id'], ['proposalSha256', 'digest'],
  ['deviceId', 'id'], ['bootId', 'id'], ['challengeId', 'id'],
  ['policySha256', 'digest'], ['firmwareSha256', 'digest'], ['experimentId', 'id'],
  ['consentEpoch', 'uint', 1, 4294967295], ['sequence', 'u64'],
  ['issuedMonotonicUs', 'u64'], ['notBeforeMonotonicUs', 'u64'], ['expiresMonotonicUs', 'u64'],
  ['stateDigest', 'digest'], ['confidenceQ15', 'uint', 0, 32767], ['modality', 'modality'],
  ['assetSha256', 'digest'], ['intensityQ15', 'uint', 0, 32767],
  ['durationMs', 'uint', 1, 60000], ['rampMs', 'uint', 0, 10000],
  ['reasonCode', 'uint', 0, 65535], ['consentSha256', 'digest'], ['signature', 'signature'],
];
const MODALITIES = ['audio', 'light', 'haptic'] as const;

/** Error messages identify structure only, never sensitive ticket values. */
export class TicketFormatError extends Error {
  constructor(message: string) { super(message); this.name = 'TicketFormatError'; }
}

function fail(message: string): never { throw new TicketFormatError(message); }

/** Snapshot plain data once so accessor tricks cannot change signed fields. */
function snapshot(input: unknown, signed: boolean): Record<Field, unknown> {
  if (input === null || typeof input !== 'object') fail('Ticket must be a plain object');
  const proto: unknown = Object.getPrototypeOf(input);
  if (proto !== Object.prototype && proto !== null) fail('Ticket must be a plain object');
  const count = signed ? 24 : 23;
  const own = Reflect.ownKeys(input);
  if (own.length !== count) fail('Ticket has an incorrect field set');
  const result = Object.create(null) as Record<Field, unknown>;
  for (let key = 0; key < count; key++) {
    const [field] = FIELDS[key];
    const d = Object.getOwnPropertyDescriptor(input, field);
    if (!d || !('value' in d) || !d.enumerable) fail(`Invalid data property: ${field}`);
    result[field] = d.value;
  }
  return result;
}

function validate(input: unknown, signed: boolean): Record<Field, unknown> {
  return validateData(snapshot(input, signed), signed);
}

/** Private data only: public callers must first pass through snapshot(). */
function validateData(data: Record<Field, unknown>, signed: boolean): Record<Field, unknown> {
  const count = signed ? 24 : 23;
  for (let key = 0; key < count; key++) {
    const [field, kind, minimum, maximum] = FIELDS[key];
    const value = data[field];
    switch (kind) {
      case 'id':
        if (typeof value !== 'string' || value.length !== 32 || !/^(?!0{32}$)[a-f0-9]{32}$/.test(value)) fail(`Invalid identifier: ${field}`);
        break;
      case 'digest':
        if (typeof value !== 'string' || value.length !== 64 || !/^[a-f0-9]{64}$/.test(value)) fail(`Invalid digest: ${field}`);
        break;
      case 'u64':
        if (typeof value !== 'string' || !/^(0|[1-9][0-9]{0,19})$/.test(value) || BigInt(value) > MAX_UINT64 || BigInt(value).toString() !== value) fail(`Invalid uint64: ${field}`);
        break;
      case 'uint':
        if (typeof value !== 'number' || !Number.isSafeInteger(value) || Object.is(value, -0) || value < minimum! || value > maximum!) fail(`Invalid integer: ${field}`);
        break;
      case 'modality':
        if (!MODALITIES.includes(value as CueTicketV1['modality'])) fail('Invalid modality');
        break;
      case 'signature':
        // Node's base64url decoder tolerates aliases; reject before decoding.
        if (typeof value !== 'string' || value.length !== 86 || !/^[A-Za-z0-9_-]{85}[AQgw]$/.test(value)) fail('Invalid canonical signature');
        break;
    }
  }
  const issued = BigInt(data.issuedMonotonicUs as string);
  const before = BigInt(data.notBeforeMonotonicUs as string);
  const expires = BigInt(data.expiresMonotonicUs as string);
  if (issued > before || before >= expires || expires - issued > 2_000_000n) fail('Invalid ticket time relations');
  if ((data.rampMs as number) > (data.durationMs as number)) fail('Ramp exceeds duration');
  return data;
}

class Writer {
  readonly bytes = Buffer.alloc(MAX_TICKET_BYTES);
  offset = 0;

  head(major: number, value: bigint): void {
    const prefix = major << 5;
    if (value < 24n) this.bytes[this.offset++] = prefix | Number(value);
    else if (value <= 255n) { this.bytes[this.offset++] = prefix | 24; this.bytes[this.offset++] = Number(value); }
    else if (value <= 65535n) { this.bytes[this.offset++] = prefix | 25; this.bytes.writeUInt16BE(Number(value), this.offset); this.offset += 2; }
    else if (value <= 4294967295n) { this.bytes[this.offset++] = prefix | 26; this.bytes.writeUInt32BE(Number(value), this.offset); this.offset += 4; }
    else { this.bytes[this.offset++] = prefix | 27; this.bytes.writeBigUInt64BE(value, this.offset); this.offset += 8; }
  }

  blob(value: Buffer): void {
    this.head(2, BigInt(value.length));
    if (this.offset + value.length > MAX_TICKET_BYTES) fail('Ticket exceeds size bound');
    this.bytes.set(value, this.offset); this.offset += value.length;
  }
}

function encodeValidated(data: Record<Field, unknown>, signed: boolean): Uint8Array {
  const writer = new Writer();
  const count = signed ? 24 : 23;
  writer.head(5, BigInt(count));
  for (let key = 0; key < count; key++) {
    const [field, kind] = FIELDS[key];
    const value = data[field];
    writer.head(0, BigInt(key));
    if (kind === 'id' || kind === 'digest') writer.blob(Buffer.from(value as string, 'hex'));
    else if (kind === 'signature') writer.blob(Buffer.from(value as string, 'base64url'));
    else if (kind === 'modality') writer.head(0, BigInt(MODALITIES.indexOf(value as CueTicketV1['modality']) + 1));
    else writer.head(0, BigInt(value as string | number));
  }
  // Copy the used bytes; never expose the larger scratch allocation.
  return Uint8Array.from(writer.bytes.subarray(0, writer.offset));
}

/** Exact Ed25519 message: canonical CBOR map with keys 0 through 22. */
export function encodeTicketPayload(ticket: UnsignedCueTicketV1): Uint8Array {
  return encodeValidated(validate(ticket, false), false);
}

export function encodeTicket(ticket: CueTicketV1): Uint8Array {
  return encodeValidated(validate(ticket, true), true);
}

class Reader {
  offset = 0;
  constructor(readonly bytes: Buffer) {}

  head(major: number): bigint {
    if (this.offset >= this.bytes.length) fail('Truncated CBOR');
    const initial = this.bytes[this.offset++];
    if (initial >> 5 !== major) fail('Unexpected CBOR major type');
    const extra = initial & 31;
    if (extra < 24) return BigInt(extra);
    if (extra > 27) fail('Indefinite or reserved CBOR length');
    const size = 1 << (extra - 24);
    if (this.offset + size > this.bytes.length) fail('Truncated CBOR argument');
    let value: bigint;
    let minimum: bigint;
    switch (size) {
      case 1: value = BigInt(this.bytes.readUInt8(this.offset)); minimum = 24n; break;
      case 2: value = BigInt(this.bytes.readUInt16BE(this.offset)); minimum = 256n; break;
      case 4: value = BigInt(this.bytes.readUInt32BE(this.offset)); minimum = 65536n; break;
      default: value = this.bytes.readBigUInt64BE(this.offset); minimum = 4294967296n; break;
    }
    this.offset += size;
    if (value < minimum) fail('Nonminimal CBOR argument');
    return value;
  }

  blob(size: number): Buffer {
    if (this.head(2) !== BigInt(size)) fail('Incorrect byte string length');
    if (this.offset + size > this.bytes.length) fail('Truncated byte string');
    const result = this.bytes.subarray(this.offset, this.offset + size);
    this.offset += size;
    return result;
  }
}

/** Bounded, nonrecursive parser. Does not establish authorization or freshness. */
export function decodeTicket(bytes: Uint8Array): CueTicketV1 {
  if (!(bytes instanceof Uint8Array)) fail('Invalid ticket byte type');
  // Invoke intrinsic getters: subclass/own accessors cannot lie about lengths
  // or cause Buffer.from to allocate using a caller-supplied `length` property.
  let length: number;
  let offset: number;
  let buffer: ArrayBufferLike;
  try {
    length = BYTE_LENGTH.call(bytes) as number;
    offset = BYTE_OFFSET.call(bytes) as number;
    buffer = ARRAY_BUFFER.call(bytes) as ArrayBufferLike;
  } catch { fail('Invalid ticket byte storage'); }
  if (length === 0 || length > MAX_TICKET_BYTES) fail('Invalid ticket byte length');
  if (buffer instanceof SharedArrayBuffer) fail('Shared ticket memory is forbidden');
  const reader = new Reader(Buffer.from(new Uint8Array(buffer, offset, length)));
  if (reader.head(5) !== 24n) fail('Ticket requires exactly 24 CBOR keys');
  const data = {} as Record<Field, unknown>;
  for (let key = 0; key < 24; key++) {
    if (reader.head(0) !== BigInt(key)) fail('Unknown, duplicate, missing, or out of order CBOR key');
    const [field, kind] = FIELDS[key];
    if (kind === 'id' || kind === 'digest') data[field] = reader.blob(kind === 'id' ? 16 : 32).toString('hex');
    else if (kind === 'signature') data[field] = reader.blob(64).toString('base64url');
    else {
      const value = reader.head(0);
      if (kind === 'u64') data[field] = value.toString();
      else if (kind === 'modality') {
        if (value < 1n || value > 3n) fail('Invalid wire modality');
        data[field] = MODALITIES[Number(value) - 1];
      } else {
        if (value > BigInt(Number.MAX_SAFE_INTEGER)) fail('Unsafe JSON integer');
        data[field] = Number(value);
      }
    }
  }
  if (reader.offset !== reader.bytes.length) fail('Trailing CBOR data');
  // The parser constructed every own field from its private byte snapshot.
  // Keep semantic validation, but do not snapshot these local data a second time.
  validateData(data, true);
  return data as unknown as CueTicketV1;
}

/** Signature validity only. Never use this result as permission to actuate. */
export function verifyTicket(ticket: CueTicketV1, publicKey: KeyObject): boolean {
  try {
    if (!(publicKey instanceof KeyObject) || publicKey.type !== 'public' || publicKey.asymmetricKeyType !== 'ed25519') return false;
    const data = validate(ticket, true);
    return verify(null, encodeValidated(data, false), publicKey, Buffer.from(data.signature as string, 'base64url'));
  } catch {
    return false;
  }
}
