// Generates the install icons (040 R-09): a neutral fretboard glyph in ink on the surface colour.
// Dependency-free PNG encoder (node:zlib + CRC32). Uses only ink and surface token values,
// never the reserved root, third or fifth colours (Constitution VII).
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

const INK = [0x1a, 0x1d, 0x21]; // light --color-text
const SURFACE = [0xff, 0xff, 0xff]; // light --color-surface
const outDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'static', 'icons');

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(data.length, 0);
  head.write(type, 4, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), data])), 0);
  return Buffer.concat([head, data, crc]);
}
function encodePng(size, rgb) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // truecolour RGB, no alpha: opaque
  const raw = Buffer.alloc(size * (size * 3 + 1));
  for (let y = 0; y < size; y++) {
    const row = y * (size * 3 + 1);
    raw[row] = 0;
    rgb.copy(raw, row + 1, y * size * 3, (y + 1) * size * 3);
  }
  return Buffer.concat([
    Buffer.from('89504e470d0a1a0a', 'hex'),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

/**
 * Fretboard glyph: 6 strings, 5 frets and a thicker nut, inside a square of half-side `half`
 * (fraction of the icon size) centred on the icon. For the maskable icon the square's corners
 * must stay within the central 80% circle (radius 0.4): half <= 0.4 / sqrt(2) ~= 0.28.
 */
function draw(size, half) {
  const px = Buffer.alloc(size * size * 3);
  for (let i = 0; i < size * size; i++) Buffer.from(SURFACE).copy(px, i * 3);
  const rect = (x0, y0, x1, y1) => {
    for (let y = Math.max(0, Math.round(y0)); y < Math.min(size, Math.round(y1)); y++)
      for (let x = Math.max(0, Math.round(x0)); x < Math.min(size, Math.round(x1)); x++)
        Buffer.from(INK).copy(px, (y * size + x) * 3);
  };
  const c = size / 2;
  const left = c - half * size;
  const right = c + half * size;
  const top = c - half * size;
  const bottom = c + half * size;
  const w = right - left;
  const h = bottom - top;
  const line = Math.max(1, size * 0.012);
  const fret = Math.max(2, size * 0.02);
  for (let s = 0; s < 6; s++) {
    const y = top + (h * s) / 5;
    rect(left, y - line / 2, right, y + line / 2 + 1);
  }
  rect(left, top, left + fret * 2.5, bottom + 1); // nut
  for (let f = 1; f <= 4; f++) {
    const x = left + (w * f) / 4;
    rect(x - fret / 2, top, x + fret / 2, bottom + 1);
  }
  return px;
}

mkdirSync(outDir, { recursive: true });
const icons = [
  ['icon-192.png', 192, 0.36],
  ['icon-512.png', 512, 0.36],
  ['icon-maskable-512.png', 512, 0.27],
  ['apple-touch-icon.png', 180, 0.36]
];
for (const [name, size, half] of icons) {
  writeFileSync(join(outDir, name), encodePng(size, draw(size, half)));
  console.log(`wrote static/icons/${name}`);
}
