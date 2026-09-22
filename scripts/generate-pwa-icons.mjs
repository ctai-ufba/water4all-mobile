/**
 * @file generate-pwa-icons.mjs
 * @summary Regenerates the PWA home screen icons in `public/icons/`.
 * @description Rasterises the Water4All droplet mark to the PNG sizes the Web App Manifest
 * declares. The icons are committed, so this script only runs when the mark or the palette
 * changes; it exists so that change is a one-line edit and a rerun rather than a manual export.
 *
 * Written against Node's built-in `zlib` with no image dependency: three flat-coloured icons do
 * not justify adding a native toolchain to a project whose build is otherwise pure JavaScript.
 *
 * ## Usage
 *
 * ```sh
 * npm run icons
 * ```
 *
 * Writes `icon-192.png`, `icon-512.png` and `icon-maskable-512.png` into `public/icons/`,
 * overwriting what is there, and prints one line per file.
 */

import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUTPUT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons');

/** Deep slate plate the mark sits on, matching the app's `bg-slate-950` shell. */
const PLATE_COLOR = [15, 23, 42];

/** Cyan at the top of the droplet, matching the app's primary accent. */
const DROPLET_TOP_COLOR = [34, 211, 238];

/** Emerald at the base of the droplet, matching the app's positive-state accent. */
const DROPLET_BOTTOM_COLOR = [16, 185, 129];

/**
 * Geometry of the droplet in the 24-unit viewBox of the favicon, so the installed icon and the
 * browser tab show the same mark: a circle capped by a rotated square that forms the point.
 */
const DROPLET = {
  viewBox: 24,
  circle: { cx: 12, cy: 14.007, r: 8 },
  diamond: { cx: 12, cy: 8.35, halfDiagonal: 5.657 },
};

/** Samples per axis used to antialias edges; 4x4 is indistinguishable from more at these sizes. */
const SUPERSAMPLE = 4;

/**
 * Reports whether a point in viewBox units falls inside the droplet mark.
 *
 * @param {number} x - Horizontal position in viewBox units.
 * @param {number} y - Vertical position in viewBox units.
 * @returns {boolean} True when the point is inside the circle or the rotated square.
 */
function isInsideDroplet(x, y) {
  const { circle, diamond } = DROPLET;
  const inCircle = (x - circle.cx) ** 2 + (y - circle.cy) ** 2 <= circle.r ** 2;
  // A square rotated 45 degrees is the set of points within an L1 distance of its centre.
  const inDiamond = Math.abs(x - diamond.cx) + Math.abs(y - diamond.cy) <= diamond.halfDiagonal;
  return inCircle || inDiamond;
}

/**
 * Reports whether a point falls inside the rounded plate.
 *
 * @param {number} x - Horizontal position in pixels.
 * @param {number} y - Vertical position in pixels.
 * @param {number} size - Plate edge length in pixels.
 * @param {number} radius - Corner radius in pixels.
 * @returns {boolean} True when the point is inside the plate.
 */
function isInsidePlate(x, y, size, radius) {
  if (radius <= 0) {
    return true;
  }
  const dx = Math.max(radius - x, x - (size - radius), 0);
  const dy = Math.max(radius - y, y - (size - radius), 0);
  return dx * dx + dy * dy <= radius * radius;
}

/**
 * Blends two colours.
 *
 * @param {number[]} from - Start colour as [r, g, b].
 * @param {number[]} to - End colour as [r, g, b].
 * @param {number} t - Position between them, 0 to 1.
 * @returns {number[]} The blended colour.
 */
function mix(from, to, t) {
  return from.map((channel, index) => Math.round(channel + (to[index] - channel) * t));
}

/**
 * Measures how much of one pixel a shape covers, by supersampling it.
 *
 * @param {number} x - Pixel column.
 * @param {number} y - Pixel row.
 * @param {(px: number, py: number) => boolean} contains - Membership test in pixel coordinates.
 * @returns {number} Covered fraction of the pixel, 0 to 1.
 */
function pixelCoverage(x, y, contains) {
  let hits = 0;

  for (let sy = 0; sy < SUPERSAMPLE; sy += 1) {
    for (let sx = 0; sx < SUPERSAMPLE; sx += 1) {
      if (contains(x + (sx + 0.5) / SUPERSAMPLE, y + (sy + 0.5) / SUPERSAMPLE)) {
        hits += 1;
      }
    }
  }

  return hits / (SUPERSAMPLE * SUPERSAMPLE);
}

/**
 * Renders one icon into a raw RGBA buffer.
 *
 * @param {number} size - Edge length in pixels.
 * @param {number} markScale - Fraction of the edge the droplet spans. Maskable icons use a
 *   smaller value so the mark survives the circular crop a launcher may apply.
 * @param {number} cornerRadius - Plate corner radius in pixels; 0 keeps the plate square, which
 *   is what a maskable icon must be so the launcher can crop it itself.
 * @returns {Buffer} RGBA pixels, row-major.
 */
function renderIcon(size, markScale, cornerRadius) {
  const pixels = Buffer.alloc(size * size * 4);
  const markSize = size * markScale;
  const markOrigin = (size - markSize) / 2;
  const unit = markSize / DROPLET.viewBox;

  const inPlate = (px, py) => isInsidePlate(px, py, size, cornerRadius);
  const inDroplet = (px, py) =>
    isInsideDroplet((px - markOrigin) / unit, (py - markOrigin) / unit);

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const dropletAlpha = pixelCoverage(x, y, inDroplet);
      const plateAlpha = pixelCoverage(x, y, inPlate);
      const gradientPosition = Math.min(1, Math.max(0, (y - markOrigin) / markSize));
      const droplet = mix(DROPLET_TOP_COLOR, DROPLET_BOTTOM_COLOR, gradientPosition);

      // The droplet is composited over the plate, and the plate over transparency.
      const color = mix(PLATE_COLOR, droplet, dropletAlpha);
      const alpha = Math.max(plateAlpha, dropletAlpha);
      const offset = (y * size + x) * 4;
      pixels[offset] = color[0];
      pixels[offset + 1] = color[1];
      pixels[offset + 2] = color[2];
      pixels[offset + 3] = Math.round(alpha * 255);
    }
  }

  return pixels;
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k += 1) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  return c >>> 0;
});

/**
 * Computes the CRC-32 the PNG chunk format requires.
 *
 * @param {Buffer} buffer - Bytes to checksum.
 * @returns {number} Unsigned CRC-32.
 */
function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/**
 * Wraps payload bytes in a PNG chunk.
 *
 * @param {string} type - Four-character chunk type, e.g. 'IHDR'.
 * @param {Buffer} data - Chunk payload.
 * @returns {Buffer} The length-prefixed, CRC-suffixed chunk.
 */
function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const typeAndData = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(typeAndData));
  return Buffer.concat([length, typeAndData, checksum]);
}

/**
 * Encodes raw RGBA pixels as an 8-bit truecolour-with-alpha PNG.
 *
 * @param {Buffer} pixels - RGBA pixels, row-major.
 * @param {number} size - Image edge length in pixels.
 * @returns {Buffer} Complete PNG file bytes.
 */
function encodePng(pixels, size) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8; // bit depth
  header[9] = 6; // colour type: truecolour with alpha
  // Bytes 10-12 stay zero: deflate compression, adaptive filtering, no interlace.

  // Every scanline is prefixed with filter type 0; flat artwork gains nothing from prediction.
  const stride = size * 4 + 1;
  const raw = Buffer.alloc(size * stride);
  for (let y = 0; y < size; y += 1) {
    raw[y * stride] = 0;
    pixels.copy(raw, y * stride + 1, y * size * 4, (y + 1) * size * 4);
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const ICONS = [
  // Rounded plate for the any-purpose icons, which launchers display as supplied.
  { file: 'icon-192.png', size: 192, markScale: 0.66, cornerRadius: 42 },
  { file: 'icon-512.png', size: 512, markScale: 0.66, cornerRadius: 112 },
  // Maskable: full-bleed plate, mark inside the 80% safe zone the spec guarantees.
  { file: 'icon-maskable-512.png', size: 512, markScale: 0.52, cornerRadius: 0 },
];

mkdirSync(OUTPUT_DIR, { recursive: true });

for (const icon of ICONS) {
  const png = encodePng(renderIcon(icon.size, icon.markScale, icon.cornerRadius), icon.size);
  writeFileSync(resolve(OUTPUT_DIR, icon.file), png);
  console.log(`wrote ${icon.file} (${icon.size}x${icon.size}, ${png.length} bytes)`);
}
