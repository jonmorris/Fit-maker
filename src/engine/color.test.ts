import { describe, expect, it } from 'vitest';
import {
  averageHex, colorFamily, deltaE, hexToOklch, hexToRgb, hueDistance, isHex, isNeutral, normalizeHex, rgbToHex,
} from './color';
import type { ColorFamily } from './types';

describe('hex parsing', () => {
  it('normalizes short and uppercase hex', () => {
    expect(normalizeHex('#ABC')).toBe('#aabbcc');
    expect(normalizeHex('1F2A44')).toBe('#1f2a44');
  });

  it('rejects invalid input', () => {
    expect(isHex('#12345')).toBe(false);
    expect(isHex('green')).toBe(false);
    expect(() => normalizeHex('nope')).toThrow();
  });

  it('round-trips rgb', () => {
    expect(rgbToHex(hexToRgb('#1f2a44'))).toBe('#1f2a44');
  });
});

describe('OKLCH conversion', () => {
  it('matches reference values for pure colors', () => {
    const white = hexToOklch('#ffffff');
    expect(white.L).toBeCloseTo(1, 3);
    expect(white.C).toBeCloseTo(0, 3);

    const red = hexToOklch('#ff0000');
    expect(red.L).toBeCloseTo(0.628, 2);
    expect(red.C).toBeCloseTo(0.258, 2);
    expect(red.h).toBeCloseTo(29.2, 0);

    const blue = hexToOklch('#0000ff');
    expect(blue.h).toBeCloseTo(264.1, 0);
  });
});

describe('deltaE', () => {
  it('is zero for identical colors', () => {
    expect(deltaE('#556b2f', '#556b2f')).toBe(0);
  });

  it('is small for near-identical colors and large for different ones', () => {
    expect(deltaE('#556b2f', '#586e31')).toBeLessThan(0.02);
    expect(deltaE('#1f2a44', '#f5f5f0')).toBeGreaterThan(0.5);
  });

  it('separates two "slightly different greens" from a match', () => {
    const olive = '#556b2f';
    const forest = '#228b22';
    const d = deltaE(olive, forest);
    expect(d).toBeGreaterThan(0.05);
    expect(d).toBeLessThan(0.2);
  });
});

describe('hueDistance', () => {
  it('wraps around 360', () => {
    expect(hueDistance(350, 10)).toBe(20);
    expect(hueDistance(10, 190)).toBe(180);
  });
});

describe('colorFamily', () => {
  const cases: Array<[string, string, ColorFamily]> = [
    ['black', '#111111', 'black'],
    ['charcoal', '#36454f', 'gray'],
    ['light gray', '#d3d3d3', 'gray'],
    ['white', '#ffffff', 'white'],
    ['off-white', '#f5f5f0', 'white'],
    ['cream', '#f3e9d2', 'beige'],
    ['navy', '#000080', 'navy'],
    ['dark navy', '#1f2a44', 'navy'],
    ['denim', '#5d7a99', 'denim'],
    ['chambray', '#9aabc1', 'denim'],
    ['khaki', '#c3b091', 'beige'],
    ['camel', '#c19a6b', 'beige'],
    ['brown', '#6b4a2f', 'brown'],
    ['chocolate', '#3d2314', 'brown'],
    ['cognac', '#9a463d', 'brown'],
    ['olive', '#556b2f', 'olive'],
    ['army green', '#4b5320', 'olive'],
    ['forest green', '#228b22', 'green'],
    ['hunter green', '#355e3b', 'green'],
    ['red', '#ff0000', 'red'],
    ['burgundy', '#800020', 'red'],
    ['maroon', '#800000', 'red'],
    ['pink', '#ffc0cb', 'pink'],
    ['hot pink', '#ff69b4', 'pink'],
    ['orange', '#ffa500', 'orange'],
    ['mustard', '#e1ad01', 'yellow'],
    ['teal', '#008080', 'teal'],
    ['royal blue', '#4169e1', 'blue'],
    ['cobalt', '#0047ab', 'blue'],
    ['purple', '#800080', 'purple'],
    ['plum', '#8e4585', 'purple'],
  ];

  it.each(cases)('%s (%s) → %s', (_name, hex, family) => {
    expect(colorFamily(hex)).toBe(family);
  });
});

describe('isNeutral', () => {
  it('treats fashion neutrals as neutral', () => {
    expect(isNeutral('navy')).toBe(true);
    expect(isNeutral('olive')).toBe(true);
    expect(isNeutral('green')).toBe(false);
  });
});

describe('averageHex', () => {
  it('returns the input for a single color', () => {
    expect(averageHex(['#1f2a44'])).toBe('#1f2a44');
  });

  it('lands between black and white', () => {
    const mid = hexToOklch(averageHex(['#000000', '#ffffff']));
    expect(mid.L).toBeCloseTo(0.5, 1);
  });
});
