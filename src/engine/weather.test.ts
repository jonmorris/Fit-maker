import { describe, expect, it } from 'vitest';
import { DEFAULT_NEEDS, bandFor, cToF, needsFor, summarizeDay, type DayWeather, type HourlyForecast } from './weather';

function forecast(date: string, temps: number[], rain: number[] = temps.map(() => 0)): HourlyForecast {
  return {
    time: temps.map((_, h) => `${date}T${String(h).padStart(2, '0')}:00`),
    temperature: temps,
    apparent: temps.map((t) => t - 1),
    precipProbability: rain,
  };
}

const day = (over: Partial<DayWeather>): DayWeather => ({
  date: '2026-09-28',
  tempMin: 15,
  tempMax: 18,
  feelsMin: 15,
  feelsMax: 18,
  rainChance: 0,
  ...over,
});

describe('summarizeDay', () => {
  it('only considers hours inside the 8am–7pm window', () => {
    const temps = Array.from({ length: 24 }, (_, h) => (h < 8 || h >= 19 ? -10 : 10 + h / 2));
    const rain = Array.from({ length: 24 }, (_, h) => (h === 3 ? 100 : h === 17 ? 55 : 5));
    const w = summarizeDay(forecast('2026-09-28', temps, rain), '2026-09-28')!;
    expect(w.tempMin).toBe(14);
    expect(w.tempMax).toBe(19);
    expect(w.rainChance).toBe(55); // the 3am 100% is ignored
    expect(w.feelsMin).toBe(13);
  });

  it('returns null when the forecast has no hours for that date', () => {
    expect(summarizeDay(forecast('2026-09-27', [10, 11]), '2026-09-28')).toBeNull();
  });
});

describe('needsFor', () => {
  it('maps feels-like temperature to bands', () => {
    expect(bandFor(28)).toBe('hot');
    expect(bandFor(20)).toBe('mild');
    expect(bandFor(14)).toBe('cool');
    expect(bandFor(6)).toBe('cold');
    expect(bandFor(-2)).toBe('freezing');
  });

  it('needs no outerwear on a hot dry day', () => {
    const n = needsFor(day({ feelsMin: 26, feelsMax: 30 }));
    expect(n.outerwear).toBe('none');
    expect(n.warmth).toEqual([1, 2]);
  });

  it('requires a warm coat when cold', () => {
    const n = needsFor(day({ feelsMin: 5, feelsMax: 9 }));
    expect(n.outerwear).toBe('required');
    expect(n.outerwearMinWarmth).toBe(3);
  });

  it('requires rain-ready outerwear at 40%+ rain', () => {
    const n = needsFor(day({ feelsMin: 19, feelsMax: 22, rainChance: 60 }));
    expect(n.rain).toBe(true);
    expect(n.outerwear).toBe('required');
    expect(n.notes.join(' ')).toMatch(/60% rain/);
  });

  it('suggests an umbrella rather than a coat when hot and rainy', () => {
    const n = needsFor(day({ feelsMin: 27, feelsMax: 31, rainChance: 70 }));
    expect(n.outerwear).toBe('none');
    expect(n.rain).toBe(false);
    expect(n.notes.join(' ')).toMatch(/umbrella/);
  });

  it('ignores low rain chances', () => {
    expect(needsFor(day({ rainChance: 30 })).rain).toBe(false);
  });

  it('notes a big temperature swing', () => {
    expect(needsFor(day({ feelsMin: 8, feelsMax: 19 })).notes.join(' ')).toMatch(/layers/);
  });

  it('falls back to mild defaults without a forecast', () => {
    expect(needsFor(null)).toBe(DEFAULT_NEEDS);
  });
});

describe('cToF', () => {
  it('converts', () => {
    expect(cToF(0)).toBe(32);
    expect(cToF(100)).toBe(212);
  });
});
