// Pairwise color harmony between two garments.
// Works in OKLCH (see color.ts). Each result carries a short human reason so
// suggestions are explainable and easy to tune.

import { deltaE, hexToOklch, hueDistance, isNeutral } from './color';
import type { ColorFamily, ColorTag } from './types';

export type Relation =
  | 'tonal' // essentially the same color
  | 'near-miss' // close but not matching: the clash we most want to avoid
  | 'neutral' // at least one neutral
  | 'monochrome' // same hue, clearly different lightness
  | 'analogous' // neighbouring hues
  | 'complementary' // opposite hues
  | 'contrast'; // unrelated hues

export interface PairHarmony {
  relation: Relation;
  /** 0 (clash) … 1 (great) */
  score: number;
  reason: string;
}

/** Below this ΔE two colors read as the same color. */
export const MATCH_DE = 0.04;
/**
 * Same-hue chromatic colors read as a near miss when they're this close overall,
 * or when their lightness is too similar to look like deliberate tonal contrast
 * (a light blue shirt with navy trousers works; forest with hunter green doesn't).
 */
export const NEAR_MISS_DE = 0.15;
const NEAR_MISS_MAX_DE = 0.25;
const TONAL_CONTRAST_DL = 0.2;
/** Low-chroma neutrals in the same family (two khakis, two denims) under this ΔE read as a near miss. */
const NEUTRAL_NEAR_MISS_DE = 0.12;
const CHROMATIC_C = 0.035;
const PURE_NEUTRALS: ReadonlySet<ColorFamily> = new Set(['black', 'white', 'gray']);

const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

export function pairHarmony(a: ColorTag, b: ColorTag): PairHarmony {
  const names = a.family === b.family ? cap(a.family) : `${cap(a.family)} + ${b.family}`;
  const d = deltaE(a.hex, b.hex);
  const ca = hexToOklch(a.hex);
  const cb = hexToOklch(b.hex);
  const hd = hueDistance(ca.h, cb.h);
  const bothChromatic = ca.C > CHROMATIC_C && cb.C > CHROMATIC_C;
  const aNeutral = isNeutral(a.family);
  const bNeutral = isNeutral(b.family);

  if (d < MATCH_DE) {
    return {
      relation: 'tonal',
      score: aNeutral ? 0.9 : 0.75,
      reason: `${names}: matching`,
    };
  }

  // Two slightly different greens, olive against forest, two denim washes…
  const dL = Math.abs(ca.L - cb.L);
  if (bothChromatic && hd < 30 && (d < NEAR_MISS_DE || (dL < TONAL_CONTRAST_DL && d < NEAR_MISS_MAX_DE))) {
    return { relation: 'near-miss', score: 0.15, reason: `${names}: close but not matching` };
  }
  if (a.family === b.family && !PURE_NEUTRALS.has(a.family) && d < NEUTRAL_NEAR_MISS_DE) {
    return { relation: 'near-miss', score: 0.35, reason: `${names}: close shades that don't quite match` };
  }

  if (aNeutral || bNeutral) {
    const fams = new Set([a.family, b.family]);
    if (fams.has('navy') && fams.has('black')) {
      return { relation: 'neutral', score: 0.55, reason: 'Navy + black: can read as a mismatch' };
    }
    return { relation: 'neutral', score: aNeutral && bNeutral ? 0.9 : 0.85, reason: `${names}: neutral pairing` };
  }

  // Both chromatic from here on.
  if (hd < 30) return { relation: 'monochrome', score: 0.75, reason: `${names}: tonal contrast` };
  // OKLCH hue angles aren't the painter's color wheel: red↔green is ~113°,
  // blue↔orange ~166°. So "complementary" starts at 110° here.
  if (hd < 80) return { relation: 'analogous', score: 0.75, reason: `${names}: analogous` };
  if (hd >= 110) {
    const loud = ca.C > 0.15 && cb.C > 0.15;
    return {
      relation: 'complementary',
      score: loud ? 0.5 : 0.7,
      reason: loud ? `${names}: complementary but loud` : `${names}: complementary`,
    };
  }
  return { relation: 'contrast', score: 0.4, reason: `${names}: unrelated hues` };
}
