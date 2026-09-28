import { describe, expect, it } from 'vitest';
import { colorFamily } from './color';
import { pairHarmony } from './harmony';
import type { ColorTag } from './types';

const c = (hex: string): ColorTag => ({ hex, family: colorFamily(hex) });

const NAVY = c('#1f2a44');
const WHITE = c('#f5f5f0');
const BLACK = c('#111111');
const OLIVE = c('#556b2f');
const FOREST = c('#228b22');
const HUNTER = c('#355e3b');
const KHAKI = c('#c3b091');
const STONE = c('#d8d0c0');
const DENIM_DARK = c('#3b5373');
const DENIM_MID = c('#4b6584');
const RUST = c('#b7410e');
const TEAL = c('#2a8184');
const RED = c('#ff0000');
const GREEN = c('#00c000');
const BURGUNDY = c('#800020');
const PURPLE = c('#6d4a9c');

describe('pairHarmony', () => {
  it('rates classic neutral pairs highly', () => {
    expect(pairHarmony(NAVY, WHITE)).toMatchObject({ relation: 'neutral' });
    expect(pairHarmony(NAVY, WHITE).score).toBeGreaterThanOrEqual(0.85);
    expect(pairHarmony(KHAKI, NAVY).score).toBeGreaterThanOrEqual(0.85);
  });

  it('pairs a neutral with a color', () => {
    expect(pairHarmony(NAVY, RUST).relation).toBe('neutral');
  });

  it('flags two slightly different greens as a near miss', () => {
    const r = pairHarmony(FOREST, HUNTER);
    expect(r.relation).toBe('near-miss');
    expect(r.score).toBeLessThan(0.3);
  });

  it('flags olive against forest green even though olive is a neutral family', () => {
    expect(pairHarmony(OLIVE, FOREST).relation).toBe('near-miss');
  });

  it('flags greens that differ in brightness but not enough to look deliberate', () => {
    expect(pairHarmony(FOREST, c('#50c878')).relation).toBe('near-miss');
  });

  it('allows deliberate tonal contrast like a light blue shirt with navy', () => {
    const r = pairHarmony(c('#aec6e8'), NAVY);
    expect(r.relation).not.toBe('near-miss');
    expect(r.score).toBeGreaterThanOrEqual(0.75);
  });

  it('flags two different denim washes', () => {
    expect(pairHarmony(DENIM_DARK, DENIM_MID).relation).toBe('near-miss');
  });

  it('flags two close khaki shades', () => {
    expect(pairHarmony(KHAKI, STONE).relation).toBe('near-miss');
  });

  it('treats an exact match as tonal, not a near miss', () => {
    expect(pairHarmony(OLIVE, c('#566c30')).relation).toBe('tonal');
  });

  it('marks navy + black as a weaker neutral pairing', () => {
    const r = pairHarmony(NAVY, BLACK);
    expect(r.relation).toBe('neutral');
    expect(r.score).toBeLessThan(pairHarmony(NAVY, WHITE).score);
  });

  it('recognises complementary pairs and tempers loud ones', () => {
    expect(pairHarmony(RUST, TEAL).relation).toBe('complementary');
    const loud = pairHarmony(RED, GREEN);
    expect(loud.relation).toBe('complementary');
    expect(loud.score).toBeLessThan(pairHarmony(RUST, TEAL).score);
  });

  it('recognises analogous pairs', () => {
    expect(pairHarmony(BURGUNDY, PURPLE).relation).toBe('analogous');
  });

  it('always scores a near miss below a neutral pairing', () => {
    expect(pairHarmony(OLIVE, FOREST).score).toBeLessThan(pairHarmony(OLIVE, NAVY).score);
  });

  it('is symmetric', () => {
    for (const [a, b] of [[NAVY, RUST], [OLIVE, FOREST], [RUST, TEAL], [NAVY, BLACK]] as const) {
      expect(pairHarmony(a, b).score).toBe(pairHarmony(b, a).score);
      expect(pairHarmony(a, b).relation).toBe(pairHarmony(b, a).relation);
    }
  });

  it('explains itself', () => {
    expect(pairHarmony(FOREST, HUNTER).reason).toMatch(/close but not matching/);
  });
});
