// Color math in OKLab / OKLCH — a perceptual space where equal distances look
// roughly equally different. That is what lets us tell "same green" from
// "two slightly different greens".

import type { ColorFamily } from './types';

export interface Rgb { r: number; g: number; b: number } // 0–255
export interface Oklab { L: number; a: number; b: number }
export interface Oklch { L: number; C: number; h: number } // L 0–1, C ~0–0.37, h degrees 0–360

const HEX_RE = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i;

export function isHex(value: string): boolean {
  return HEX_RE.test(value.trim());
}

/** Normalizes "#ABC", "abc", "#AABBCC" → "#aabbcc". Throws on invalid input. */
export function normalizeHex(value: string): string {
  const m = HEX_RE.exec(value.trim());
  if (!m) throw new Error(`Invalid hex color: ${value}`);
  let h = m[1].toLowerCase();
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  return `#${h}`;
}

export function hexToRgb(hex: string): Rgb {
  const h = normalizeHex(hex);
  return {
    r: parseInt(h.slice(1, 3), 16),
    g: parseInt(h.slice(3, 5), 16),
    b: parseInt(h.slice(5, 7), 16),
  };
}

export function rgbToHex({ r, g, b }: Rgb): string {
  const to = (v: number) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0');
  return `#${to(r)}${to(g)}${to(b)}`;
}

const toLinear = (c: number) => {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
};

export function rgbToOklab({ r, g, b }: Rgb): Oklab {
  const lr = toLinear(r), lg = toLinear(g), lb = toLinear(b);
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
  return {
    L: 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    a: 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    b: 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  };
}

export function oklabToOklch({ L, a, b }: Oklab): Oklch {
  const C = Math.hypot(a, b);
  let h = (Math.atan2(b, a) * 180) / Math.PI;
  if (h < 0) h += 360;
  return { L, C, h };
}

export function hexToOklab(hex: string): Oklab {
  return rgbToOklab(hexToRgb(hex));
}

export function hexToOklch(hex: string): Oklch {
  return oklabToOklch(hexToOklab(hex));
}

/** Perceptual difference (Euclidean distance in OKLab). ~0.02 is barely visible, >0.15 is clearly different. */
export function deltaE(hexA: string, hexB: string): number {
  const a = hexToOklab(hexA), b = hexToOklab(hexB);
  return Math.hypot(a.L - b.L, a.a - b.a, a.b - b.b);
}

/** Smallest angle between two hues, 0–180. */
export function hueDistance(h1: number, h2: number): number {
  const d = Math.abs(h1 - h2) % 360;
  return d > 180 ? 360 - d : d;
}

const inHue = (h: number, from: number, to: number) => (from <= to ? h >= from && h < to : h >= from || h < to);

/**
 * Maps a hex color to a clothing-oriented color family.
 * Order matters: neutrals and "fashion neutrals" (navy, khaki, brown, olive,
 * denim) are carved out before falling back to plain hue buckets, because in
 * outfits they behave like neutrals rather than like blue or green.
 */
export function colorFamily(hex: string): ColorFamily {
  const { L, C, h } = hexToOklch(hex);

  // Achromatic. Warm-tinted pales (cream, ecru, stone) read as beige, not white.
  if (L < 0.27 && C < 0.06) return 'black';
  if (C < 0.035) {
    if (C >= 0.022 && inHue(h, 50, 110) && L > 0.7) return 'beige';
    if (L > 0.9) return 'white';
    if (L < 0.3) return 'black';
    return 'gray';
  }

  // Fashion neutrals
  if (inHue(h, 220, 295) && L < 0.45 && (C < 0.15 || L < 0.35)) return 'navy';
  if (inHue(h, 220, 275) && C < 0.1 && L < 0.8) return 'denim';
  if (inHue(h, 30, 100) && C < 0.11 && L >= 0.6) return 'beige';
  if (inHue(h, 25, 95) && L < 0.6 && (C < 0.12 || (h >= 35 && C < 0.16))) return 'brown';
  if (inHue(h, 95, 135) && L < 0.65 && C < 0.14) return 'olive';

  // Hue buckets
  if (inHue(h, 340, 15)) return L > 0.7 || (C < 0.1 && L > 0.6) ? 'pink' : 'red';
  if (inHue(h, 15, 45)) return L > 0.8 && C < 0.12 ? 'pink' : 'red';
  if (inHue(h, 45, 80)) return 'orange';
  if (inHue(h, 80, 118)) return 'yellow';
  if (inHue(h, 118, 170)) return 'green';
  if (inHue(h, 170, 220)) return 'teal';
  if (inHue(h, 220, 290)) return 'blue';
  return 'purple'; // 290–340
}

export const NEUTRAL_FAMILIES: ReadonlySet<ColorFamily> = new Set([
  'black', 'white', 'gray', 'navy', 'beige', 'brown', 'olive', 'denim',
]);

export function isNeutral(family: ColorFamily): boolean {
  return NEUTRAL_FAMILIES.has(family);
}

/** A representative swatch per family, for filter chips and pickers. */
export const FAMILY_SWATCH: Record<ColorFamily, string> = {
  black: '#1b1b1b',
  white: '#f7f7f4',
  gray: '#8d8d8d',
  navy: '#1f2a44',
  beige: '#d6c3a1',
  brown: '#6b4a2f',
  olive: '#5b5f2c',
  denim: '#4b6584',
  red: '#b3262e',
  orange: '#d9772b',
  yellow: '#e2c044',
  green: '#3b7d4a',
  teal: '#2a8184',
  blue: '#2f5fbf',
  purple: '#6d4a9c',
  pink: '#e39bb3',
};

/** Average of several hex colors, computed in OKLab so the result looks like a true middle. */
export function averageHex(hexes: string[]): string {
  if (!hexes.length) throw new Error('averageHex needs at least one color');
  const labs = hexes.map(hexToOklab);
  const n = labs.length;
  const mean: Oklab = {
    L: labs.reduce((s, c) => s + c.L, 0) / n,
    a: labs.reduce((s, c) => s + c.a, 0) / n,
    b: labs.reduce((s, c) => s + c.b, 0) / n,
  };
  return rgbToHex(oklabToRgb(mean));
}

const fromLinear = (v: number) => 255 * (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055);

export function oklabToRgb({ L, a, b }: Oklab): Rgb {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return {
    r: fromLinear(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    g: fromLinear(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    b: fromLinear(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
  };
}
