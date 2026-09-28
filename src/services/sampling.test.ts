import { describe, expect, it } from 'vitest';
import { deltaE } from '../engine/color';
import { dominantColors, samplePatch, type Pixels } from './sampling';

function solid(width: number, height: number, rgb: [number, number, number]): Pixels {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i++) data.set([...rgb, 255], i * 4);
  return { data, width, height };
}

function paint(px: Pixels, x0: number, y0: number, x1: number, y1: number, rgb: [number, number, number]) {
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) px.data.set([...rgb, 255], (y * px.width + x) * 4);
}

describe('samplePatch', () => {
  it('returns the color of a uniform area', () => {
    expect(samplePatch(solid(20, 20, [31, 42, 68]), 10, 10)).toBe('#1f2a44');
  });

  it('averages a noisy patch', () => {
    const px = solid(10, 10, [100, 100, 100]);
    px.data.set([120, 120, 120, 255], (5 * 10 + 5) * 4);
    expect(samplePatch(px, 5, 5, 1)).toBe('#666666'); // (8*100 + 120) / 9 ≈ 102
  });

  it('clamps at image edges', () => {
    expect(samplePatch(solid(4, 4, [255, 0, 0]), 0, 0, 3)).toBe('#ff0000');
  });
});

describe('dominantColors', () => {
  it('finds the main garment color in the centre, ignoring the background', () => {
    const px = solid(100, 100, [240, 240, 240]); // light backdrop
    paint(px, 25, 25, 75, 75, [85, 107, 47]); // olive garment filling the centre
    const [first] = dominantColors(px, 3);
    expect(deltaE(first, '#556b2f')).toBeLessThan(0.02);
  });

  it('returns distinct colors for a two-tone item', () => {
    const px = solid(100, 100, [31, 42, 68]);
    paint(px, 0, 50, 100, 100, [245, 245, 240]);
    const colors = dominantColors(px, 3);
    expect(colors.length).toBe(2);
    expect(deltaE(colors[0], colors[1])).toBeGreaterThan(0.3);
  });
});
