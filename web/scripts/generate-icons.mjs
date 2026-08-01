/**
 * Generates the PWA icons (no image libraries — raw PNG encoding).
 *
 *   node scripts/generate-icons.mjs
 *
 * Draws the PriceScout mark: a rounded brand-blue tile with a white
 * "price drop" arrow, supersampled 4× for smooth edges.
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const OUT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../public');
const BRAND = [0x2a, 0x78, 0xd6];
const INK = [0xff, 0xff, 0xff];
const SS = 4; // supersampling factor

function crc32(buf) {
  let c;
  const table = crc32.table ?? (crc32.table = (() => {
    const t = new Int32Array(256);
    for (let n = 0; n < 256; n += 1) {
      c = n;
      for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c;
    }
    return t;
  })());
  let crc = -1;
  for (let i = 0; i < buf.length; i += 1) crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ -1) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

function encodePng(width, height, rgba) {
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * (stride + 1)] = 0; // filter: none
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/** Signed-distance-ish test for a rounded rectangle covering the whole tile. */
function insideRoundedTile(x, y, size, radius) {
  const dx = Math.max(radius - x, 0, x - (size - radius));
  const dy = Math.max(radius - y, 0, y - (size - radius));
  return dx * dx + dy * dy <= radius * radius;
}

/** Down arrow: rectangular stem plus a triangular head. */
function insideArrow(x, y, size) {
  const stemHalf = size * 0.075;
  const cx = size * 0.5;
  if (y >= size * 0.2 && y <= size * 0.53 && Math.abs(x - cx) <= stemHalf) return true;
  const headTop = size * 0.47;
  const headBottom = size * 0.8;
  if (y >= headTop && y <= headBottom) {
    const t = (y - headTop) / (headBottom - headTop);
    const halfWidth = size * 0.24 * (1 - t);
    return Math.abs(x - cx) <= halfWidth;
  }
  return false;
}

function renderIcon(size) {
  const buf = Buffer.alloc(size * size * 4);
  const radius = size * 0.22;
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      let tile = 0;
      let arrow = 0;
      for (let sy = 0; sy < SS; sy += 1) {
        for (let sx = 0; sx < SS; sx += 1) {
          const px = x + (sx + 0.5) / SS;
          const py = y + (sy + 0.5) / SS;
          if (insideRoundedTile(px, py, size, radius)) tile += 1;
          if (insideArrow(px, py, size)) arrow += 1;
        }
      }
      const samples = SS * SS;
      const tileA = tile / samples;
      const arrowA = (arrow / samples) * tileA;
      const offset = (y * size + x) * 4;
      for (let c = 0; c < 3; c += 1) {
        buf[offset + c] = Math.round(BRAND[c] * (1 - arrowA) + INK[c] * arrowA);
      }
      buf[offset + 3] = Math.round(tileA * 255);
    }
  }
  return encodePng(size, size, buf);
}

const favicon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="14" fill="#2a78d6"/>
  <path d="M32 12.8v21.1M32 51.2 16.6 30.1h30.8z" fill="none" stroke="#fff" stroke-width="9.6" stroke-linecap="round" stroke-linejoin="round"/>
</svg>
`;

fs.mkdirSync(OUT_DIR, { recursive: true });
for (const [name, size] of [['icon-192.png', 192], ['icon-512.png', 512], ['apple-touch-icon.png', 180]]) {
  fs.writeFileSync(path.join(OUT_DIR, name), renderIcon(size));
  console.log(`wrote ${name} (${size}×${size})`);
}
fs.writeFileSync(path.join(OUT_DIR, 'favicon.svg'), favicon);
console.log('wrote favicon.svg');
