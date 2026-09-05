import { describe, expect, it } from 'vitest';
import { createPrivateKey, createPublicKey, generateKeyPairSync, sign } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { decodeTicket, encodeTicket, encodeTicketPayload, verifyTicket, TicketFormatError, MAX_TICKET_BYTES } from './index.js';
import type { CueTicketV1, UnsignedCueTicketV1 } from './index.js';
import { runTicketParserFuzz } from './fuzz.js';

const fixture = JSON.parse(readFileSync(new URL('../fixtures/public-ticket.json', import.meta.url), 'utf8'));
const unsigned = fixture.unsignedTicket as UnsignedCueTicketV1;
const ticket: CueTicketV1 = { ...unsigned, signature: fixture.signatureBase64url };
// PUBLIC TEST KEY: RFC 8032 section 7.1 TEST 1. Never use outside fixtures.
const privateKey = createPrivateKey({ key: Buffer.from(`302e020100300506032b657004220420${fixture.publicTestSeedHex}`, 'hex'), format: 'der', type: 'pkcs8' });
const publicKey = createPublicKey({ key: Buffer.from(`302a300506032b6570032100${fixture.publicKeyHex}`, 'hex'), format: 'der', type: 'spki' });
const payloadHex = (fixture.payloadHexParts as string[]).join('');
const wireHex = `b818${payloadHex.slice(2)}175840${Buffer.from(ticket.signature, 'base64url').toString('hex')}`;
const wire = Buffer.from(wireHex, 'hex');

function patched(value: Record<string, unknown>): CueTicketV1 { return { ...ticket, ...value } as CueTicketV1; }
function malformedHex(old: string, replacement: string): Buffer {
  const at = wireHex.indexOf(old);
  if (at < 0) throw new Error('Bad test fixture pattern');
  return Buffer.from(wireHex.slice(0, at) + replacement + wireHex.slice(at + old.length), 'hex');
}

describe('edge-v1-prototype canonical ticket codec', () => {
  it('matches frozen manually assembled CBOR payload and signed ticket vectors', () => {
    expect(Buffer.from(encodeTicketPayload(unsigned)).toString('hex')).toBe(payloadHex);
    expect(Buffer.from(encodeTicket(ticket)).toString('hex')).toBe(wireHex);
    expect(decodeTicket(wire)).toEqual(ticket);
    expect(wire.length).toBe(412);
    expect(wire.length).toBeLessThan(MAX_TICKET_BYTES);
  });

  it('verifies the frozen Ed25519 vector and exact signature message', () => {
    expect(sign(null, Buffer.from(payloadHex, 'hex'), privateKey).toString('base64url')).toBe(ticket.signature);
    expect(verifyTicket(ticket, publicKey)).toBe(true);
    expect(verifyTicket({ ...ticket, signature: sign(null, wire, privateKey).toString('base64url') }, publicKey)).toBe(false);
    expect(verifyTicket({ ...ticket, signature: sign(null, Buffer.from(JSON.stringify(unsigned)), privateKey).toString('base64url') }, publicKey)).toBe(false);
  });

  it('covers every unsigned field against tampering', () => {
    for (const [field, value] of Object.entries(unsigned)) {
      let changed: unknown;
      if (field === 'version') changed = 2;
      else if (field === 'modality') changed = 'haptic';
      else if (typeof value === 'number') changed = value + 1;
      else if (['sequence', 'issuedMonotonicUs', 'notBeforeMonotonicUs', 'expiresMonotonicUs'].includes(field)) changed = (BigInt(value) + 1n).toString();
      else changed = `${value[0] === '0' ? '1' : '0'}${value.slice(1)}`;
      expect(verifyTicket(patched({ [field]: changed }), publicKey), field).toBe(false);
    }
  });

  it('accepts all modalities and losslessly preserves uint64 maximum', () => {
    for (const modality of ['audio', 'light', 'haptic'] as const) {
      const maximum = patched({ modality, sequence: '18446744073709551615', issuedMonotonicUs: '18446744073707551615', notBeforeMonotonicUs: '18446744073707551615', expiresMonotonicUs: '18446744073709551615' });
      expect(decodeTicket(encodeTicket(maximum))).toEqual(maximum);
    }
  });

  it('bounds simultaneous maximum-width fields to 439 bytes', () => {
    const maximum = patched({ consentEpoch: 4294967295, sequence: '18446744073709551615', issuedMonotonicUs: '18446744073707551615', notBeforeMonotonicUs: '18446744073707551615', expiresMonotonicUs: '18446744073709551615', confidenceQ15: 32767, intensityQ15: 32767, durationMs: 60000, rampMs: 10000, reasonCode: 65535 });
    // 2 map + 24 keys + 85 identifiers + 204 digests + 66 signature + 58 integers.
    expect(encodeTicket(maximum).length).toBe(439);
    expect(decodeTicket(encodeTicket(maximum))).toEqual(maximum);
  });

  it.each(['0', '23', '24', '255', '256', '65535', '65536', '4294967295', '4294967296', '9007199254740991', '9007199254740992', '18446744073709551615'])('round trips integer representation boundary %s', sequence => {
    const value = patched({ sequence });
    expect(decodeTicket(encodeTicket(value))).toEqual(value);
  });

  it.each([
    ['17', '23'], ['1818', '24'], ['18ff', '255'],
    ['190100', '256'], ['19ffff', '65535'],
    ['1a00010000', '65536'], ['1a80000000', '2147483648'], ['1affffffff', '4294967295'],
    ['1b0000000100000000', '4294967296'], ['1b8000000000000000', '9223372036854775808'],
    ['1bffffffffffffffff', '18446744073709551615'],
  ])('decodes independently assembled unsigned big endian sequence %s', (argument, sequence) => {
    // These wire arguments are literal vectors, independent of Writer.head.
    const input = malformedHex('0a18180b', `0a${argument}0b`);
    expect(decodeTicket(input)).toEqual(patched({ sequence }));
    expect(encodeTicket(patched({ sequence }))).toEqual(Uint8Array.from(input));
  });

  it.each(['1817', '1900ff', '1a0000ffff', '1b00000000ffffffff'])('preserves nonminimal error for argument %s', argument => {
    expect(() => decodeTicket(malformedHex('0a18180b', `0a${argument}0b`)))
      .toThrow(new TicketFormatError('Nonminimal CBOR argument'));
  });

  it.each(['1818', '190100', '1a00010000', '1b0000000100000000'])('checks complete argument bounds before reading %s', argument => {
    const prefix = Buffer.from(wireHex.slice(0, wireHex.indexOf('0a18180b')) + '0a', 'hex');
    const bytes = Buffer.from(argument, 'hex');
    for (let length = 1; length < bytes.length; length++) {
      expect(() => decodeTicket(Buffer.concat([prefix, bytes.subarray(0, length)])))
        .toThrow(new TicketFormatError('Truncated CBOR argument'));
    }
  });

  it.each([
    ['identifier', `0150${'11'.repeat(16)}`, `0150${'00'.repeat(16)}`, 'Invalid identifier: ticketId'],
    ['issued after start', '0b1a000f4240', '0b1a000f4241', 'Invalid ticket time relations'],
    ['empty time window', '0d1a001e8480', '0d1a000f4240', 'Invalid ticket time relations'],
    ['excessive horizon', '0d1a001e8480', '0d1a002dc6c1', 'Invalid ticket time relations'],
    ['ramp exceeds duration', '131864140a', '131864141865', 'Ramp exceeds duration'],
    ['zero duration', '131864140a', '1300140a', 'Invalid integer: durationMs'],
    ['zero version', 'b8180001', 'b8180000', 'Invalid integer: version'],
  ])('retains semantic validation after direct decoding: %s', (_name, old, replacement, message) => {
    expect(() => decodeTicket(malformedHex(old, replacement))).toThrow(new TicketFormatError(message));
  });

  it.each([
    ['map count', 'b818', 'b817'], ['unknown extra key', 'b818', 'b819'],
    ['nonminimal map length', 'b818', 'b90018'], ['indefinite map', 'b818', 'bf'],
    ['wrong map major', 'b818', '9818'], ['map tag', 'b818', 'c0b818'],
    ['nonminimal key', 'b8180001', 'b818180001'], ['duplicate key', '01501111', '00501111'],
    ['key order', '01501111', '02501111'], ['unknown key', '01501111', '1818501111'],
    ['nonminimal integer 1', 'b8180001', 'b818001801'],
    ['nonminimal integer 24', '0a1818', '0a190018'],
    ['nonminimal integer 32767', '0f197fff', '0f1a00007fff'],
    ['nonminimal integer 1000000', '0b1a000f4240', '0b1b00000000000f4240'],
    ['negative integer', 'b8180001', 'b8180020'], ['half float', 'b8180001', 'b81800f93c00'],
    ['single float', 'b8180001', 'b81800fa3f800000'], ['double float', 'b8180001', 'b81800fb3ff0000000000000'],
    ['boolean', 'b8180001', 'b81800f5'], ['null', 'b8180001', 'b81800f6'],
    ['reserved argument', 'b8180001', 'b818001c'], ['indefinite integer', 'b8180001', 'b818001f'],
    ['text identifier', '01501111', '01701111'], ['oversized byte length', '01501111', '015affffffff1111'],
    ['short byte length', '01501111', '014f1111'], ['nonminimal byte length', '01501111', '0158101111'],
    ['indefinite byte string', '01501111', '015f1111'], ['signature length', '175840', '17583f'],
    ['zero consent epoch', '09010a', '09000a'], ['unknown modality', '10011158', '10041158'],
    ['Q15 overflow', '0f197fff', '0f198000'], ['uint32 overflow', '09010a', '091b00000001000000000a'],
    ['unsafe JSON integer', '09010a', '091bffffffffffffffff0a'],
  ])('rejects malformed wire: %s', (_name, old, replacement) => {
    expect(() => decodeTicket(malformedHex(old, replacement))).toThrow(TicketFormatError);
  });

  it('rejects every truncation, every duplicate trailing byte, and oversize inputs', () => {
    for (let i = 0; i < wire.length; i++) expect(() => decodeTicket(wire.subarray(0, i)), `truncation ${i}`).toThrow(TicketFormatError);
    for (let i = 0; i < 256; i++) expect(() => decodeTicket(Buffer.concat([wire, Buffer.from([i])]))).toThrow(TicketFormatError);
    expect(() => decodeTicket(new Uint8Array(769))).toThrow(TicketFormatError);
    expect(() => decodeTicket(new Uint8Array(new SharedArrayBuffer(wire.length)))).toThrow(TicketFormatError);
    expect(() => decodeTicket(null as unknown as Uint8Array)).toThrow(TicketFormatError);
  });

  it.each([
    { sequence: '18446744073709551616' }, { sequence: '01' }, { sequence: '-1' }, { sequence: '1e3' }, { sequence: 1 },
    { sequence: '1'.repeat(10000) }, { version: 0 }, { version: 2 }, { consentEpoch: 0 }, { consentEpoch: 4294967296 },
    { sequence: '1\n' }, { ticketId: '1'.repeat(32) + '\n' }, { policySha256: 'a'.repeat(64) + '\n' }, { signature: 'A'.repeat(86) + '\n' },
    { confidenceQ15: 32768 }, { intensityQ15: -1 }, { intensityQ15: 0.5 }, { intensityQ15: Number.NaN }, { intensityQ15: Number.POSITIVE_INFINITY },
    { intensityQ15: -0 }, { durationMs: 0 }, { durationMs: 60001 }, { rampMs: 10001 }, { rampMs: 101 }, { reasonCode: 65536 },
    { ticketId: '0'.repeat(32) }, { deviceId: 'A'.repeat(32) }, { policySha256: 'a'.repeat(63) }, { modality: 1 },
    { issuedMonotonicUs: '1000001' }, { notBeforeMonotonicUs: '2000000' }, { expiresMonotonicUs: '3000001' },
    { expiresMonotonicUs: '999999' }, { signature: 'A'.repeat(86) + '=' }, { signature: 'A'.repeat(85) + 'B' }, { signature: '_'.repeat(86) },
  ])('rejects invalid JSON structure or relations %j', values => {
    expect(() => encodeTicket(patched(values))).toThrow(TicketFormatError);
    expect(verifyTicket(patched(values), publicKey)).toBe(false);
  });

  it('rejects signature aliases that decode to identical bytes', () => {
    const alias = `${ticket.signature.slice(0, -1)}B`;
    expect(Buffer.from(alias, 'base64url')).toEqual(Buffer.from(ticket.signature, 'base64url'));
    expect(() => encodeTicket(patched({ signature: alias }))).toThrow(TicketFormatError);
    expect(verifyTicket(patched({ signature: alias }), publicKey)).toBe(false);
  });

  it('rejects additional, missing, symbolic, inherited, or accessor fields', () => {
    expect(() => encodeTicket(patched({ authority: 'actuator' }))).toThrow(TicketFormatError);
    const missing = { ...ticket } as Partial<CueTicketV1>; delete missing.signature;
    expect(() => encodeTicket(missing as CueTicketV1)).toThrow(TicketFormatError);
    expect(() => encodeTicketPayload(ticket)).toThrow(TicketFormatError);
    expect(() => encodeTicket({ ...ticket, [Symbol('hidden')]: 1 })).toThrow(TicketFormatError);
    expect(() => encodeTicket(Object.create(ticket))).toThrow(TicketFormatError);
    let reads = 0;
    const getter = { ...ticket };
    Object.defineProperty(getter, 'deviceId', { enumerable: true, get() { reads++; return ticket.deviceId; } });
    expect(() => encodeTicket(getter)).toThrow(TicketFormatError);
    expect(reads).toBe(0);
    expect(verifyTicket(getter, publicKey)).toBe(false);
  });

  it('accepts own data on null prototypes and rejects nonenumerable fields', () => {
    const nullPrototype = Object.assign(Object.create(null), ticket) as CueTicketV1;
    expect(encodeTicket(nullPrototype)).toEqual(Uint8Array.from(wire));
    expect(verifyTicket(nullPrototype, publicKey)).toBe(true);
    const hidden = { ...ticket };
    Object.defineProperty(hidden, 'deviceId', { value: ticket.deviceId, enumerable: false });
    expect(() => encodeTicket(hidden)).toThrow(TicketFormatError);
  });

  it('verifies only with an Ed25519 public KeyObject', () => {
    const wrong = generateKeyPairSync('ed25519');
    const ec = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
    expect(verifyTicket(ticket, wrong.publicKey)).toBe(false);
    expect(verifyTicket(ticket, ec.publicKey)).toBe(false);
    expect(verifyTicket(ticket, privateKey)).toBe(false);
    expect(verifyTicket(ticket, null as unknown as typeof publicKey)).toBe(false);
  });

  it('does not retain caller bytes or leak a mutable scratch buffer', () => {
    const input = Buffer.from(wire);
    const decoded = decodeTicket(input); input.fill(0);
    expect(decoded).toEqual(ticket);
    const encoded = encodeTicket(ticket); encoded.fill(0);
    expect(encodeTicket(ticket)).toEqual(Uint8Array.from(wire));
  });

  it('uses intrinsic byte bounds without invoking subclass accessors', () => {
    let reads = 0;
    const input = new Uint8Array(wire);
    for (const property of ['length', 'byteLength', 'byteOffset', 'buffer']) {
      Object.defineProperty(input, property, { get() { reads++; throw new Error('Untrusted accessor'); } });
    }
    expect(decodeTicket(input)).toEqual(ticket);
    expect(reads).toBe(0);
    const oversize = new Uint8Array(769);
    Object.defineProperty(oversize, 'byteLength', { value: 1 });
    expect(() => decodeTicket(oversize)).toThrow(TicketFormatError);
  });

  it('runs a reproducible 10000 case mixed malformed parser corpus', () => {
    const a = runTicketParserFuzz(0x5eed1234, 10000, wire);
    const b = runTicketParserFuzz(0x5eed1234, 10000, wire);
    expect(a).toEqual(b);
    expect(a.accepted).toBeGreaterThan(0);
    expect(a.rejected).toBeGreaterThan(0);
    expect(a.accepted + a.rejected).toBe(10000);
    expect(() => runTicketParserFuzz(0, 1)).toThrow(RangeError);
    expect(() => runTicketParserFuzz(1, 1000001)).toThrow(RangeError);
  });
});
