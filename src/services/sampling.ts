// Pixel sampling for the eyedropper and "suggested swatches".
// Works on raw RGBA arrays (ImageData.data) so it is testable without a DOM.

import { averageHex, deltaE, rgbToHex } from '../engine/color';

export interface Pixels {
  data: Uint8ClampedArray; // RGBA
  width: number;
  height: number;
}

/**
 * Average color of a square patch centred on (x, y).
 * Averaging smooths out fabric texture, stitching and sensor noise that a
 * single-pixel pick would catch.
 */
export function samplePatch(px: Pixels, x: number, y: number, radius = 4): string {
  const cx = Math.round(x), cy = Math.round(y);
  let r = 0, g = 0, b = 0, n = 0;
  for (let j = Math.max(0, cy - radius); j <= Math.min(px.height - 1, cy + radius); j++) {
    for (let i = Math.max(0, cx - radius); i <= Math.min(px.width - 1, cx + radius); i++) {
      const o = (j * px.width + i) * 4;
      if (px.data[o + 3] < 128) continue; // skip transparent
      r += px.data[o]; g += px.data[o + 1]; b += px.data[o + 2]; n++;
    }
  }
  if (!n) return '#000000';
  return rgbToHex({ r: r / n, g: g / n, b: b / n });
}

/**
 * Suggests up to `count` dominant colors, looking only at the centre of the
 * frame (where the garment usually is) to reduce background noise.
 * Coarse RGB bucketing, then merges buckets that look alike.
 */
export function dominantColors(px: Pixels, count = 3, centreFraction = 0.6): string[] {
  const x0 = Math.floor((px.width * (1 - centreFraction)) / 2);
  const y0 = Math.floor((px.height * (1 - centreFraction)) / 2);
  const x1 = px.width - x0, y1 = px.height - y0;
  const step = Math.max(1, Math.floor(Math.sqrt(((x1 - x0) * (y1 - y0)) / 4000))); // ~4k samples

  const buckets = new Map<number, { r: number; g: number; b: number; n: number }>();
  for (let y = y0; y < y1; y += step) {
    for (let x = x0; x < x1; x += step) {
      const o = (y * px.width + x) * 4;
      if (px.data[o + 3] < 128) continue;
      const r = px.data[o], g = px.data[o + 1], b = px.data[o + 2];
      const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
      const bucket = buckets.get(key) ?? { r: 0, g: 0, b: 0, n: 0 };
      bucket.r += r; bucket.g += g; bucket.b += b; bucket.n++;
      buckets.set(key, bucket);
    }
  }

  const ranked = [...buckets.values()]
    .sort((a, b) => b.n - a.n)
    .map((c) => ({ hex: rgbToHex({ r: c.r / c.n, g: c.g / c.n, b: c.b / c.n }), n: c.n }));

  // Merge similar buckets into clusters, weighting by pixel count.
  const clusters: { hexes: string[]; n: number; hex: string }[] = [];
  for (const c of ranked.slice(0, 40)) {
    const near = clusters.find((k) => deltaE(k.hex, c.hex) < 0.08);
    if (near) {
      near.hexes.push(c.hex);
      near.n += c.n;
    } else {
      clusters.push({ hexes: [c.hex], n: c.n, hex: c.hex });
    }
  }

  return clusters
    .sort((a, b) => b.n - a.n)
    .slice(0, count)
    .map((k) => averageHex(k.hexes));
}
