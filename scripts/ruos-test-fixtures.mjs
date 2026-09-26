import { deflateSync } from 'node:zlib';

let crcTable;
function crc32(bytes) {
  if (!crcTable) {
    crcTable = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      crcTable[n] = c >>> 0;
    }
  }
  let c = 0xffffffff;
  for (const byte of bytes) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data, corruptCrc = false) {
  const typeBytes = Buffer.from(type, 'ascii');
  const out = Buffer.alloc(data.length + 12);
  out.writeUInt32BE(data.length, 0);
  typeBytes.copy(out, 4);
  data.copy(out, 8);
  out.writeUInt32BE((crc32(Buffer.concat([typeBytes, data])) ^ (corruptCrc ? 1 : 0)) >>> 0,
    out.length - 4);
  return out;
}

export function pngFixture({ width = 1, height = 1, raw, idat, corruptIdatCrc = false } = {}) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 4; // grayscale plus alpha
  const pixels = raw ?? Buffer.alloc((width * 2 + 1) * height);
  return Buffer.concat([
    Buffer.from('89504e470d0a1a0a', 'hex'),
    chunk('IHDR', ihdr),
    chunk('IDAT', idat ?? deflateSync(pixels), corruptIdatCrc),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}
