// Turns an hourly forecast into clothing needs. Temperatures are °C internally;
// the UI converts for display.

export interface HourlyForecast {
  time: string[]; // local ISO "2026-09-28T08:00"
  temperature: number[];
  apparent: number[];
  precipProbability: number[]; // %
}

export interface DayWeather {
  date: string; // YYYY-MM-DD
  tempMin: number;
  tempMax: number;
  feelsMin: number;
  feelsMax: number;
  rainChance: number; // max % during the window
}

export type Band = 'hot' | 'mild' | 'cool' | 'cold' | 'freezing';

export interface WeatherNeeds {
  band: Band;
  /** Target range for the summed warmth of top + layer + outerwear (each item is 1–5). */
  warmth: [number, number];
  outerwear: 'none' | 'optional' | 'required';
  outerwearMinWarmth: number;
  rain: boolean;
  notes: string[];
}

/** The hours you're typically out, inclusive start, exclusive end. */
export const DAY_WINDOW = { start: 8, end: 19 } as const;
export const RAIN_THRESHOLD = 40;

export function summarizeDay(f: HourlyForecast, date: string, window = DAY_WINDOW): DayWeather | null {
  const idx: number[] = [];
  f.time.forEach((t, i) => {
    if (!t.startsWith(date)) return;
    const hour = Number(t.slice(11, 13));
    if (hour >= window.start && hour < window.end) idx.push(i);
  });
  if (!idx.length) return null;
  const pick = (arr: number[]) => idx.map((i) => arr[i]).filter((v) => typeof v === 'number');
  const temps = pick(f.temperature);
  const feels = pick(f.apparent);
  const rain = pick(f.precipProbability);
  return {
    date,
    tempMin: Math.min(...temps),
    tempMax: Math.max(...temps),
    feelsMin: Math.min(...feels),
    feelsMax: Math.max(...feels),
    rainChance: rain.length ? Math.max(...rain) : 0,
  };
}

/** Used when there's no forecast (offline, location denied): a mild, dry day. */
export const DEFAULT_NEEDS: WeatherNeeds = {
  band: 'mild',
  warmth: [2, 4],
  outerwear: 'optional',
  outerwearMinWarmth: 1,
  rain: false,
  notes: [],
};

export function bandFor(feelsMin: number): Band {
  if (feelsMin >= 24) return 'hot';
  if (feelsMin >= 17) return 'mild';
  if (feelsMin >= 11) return 'cool';
  if (feelsMin >= 3) return 'cold';
  return 'freezing';
}

const BAND_RULES: Record<Band, Omit<WeatherNeeds, 'band' | 'rain' | 'notes'> & { note: string }> = {
  hot: { warmth: [1, 2], outerwear: 'none', outerwearMinWarmth: 1, note: 'Hot: keep it light' },
  mild: { warmth: [2, 3], outerwear: 'optional', outerwearMinWarmth: 1, note: 'Mild: no coat needed' },
  cool: { warmth: [4, 6], outerwear: 'optional', outerwearMinWarmth: 2, note: 'Cool: add a layer or light jacket' },
  cold: { warmth: [6, 8], outerwear: 'required', outerwearMinWarmth: 3, note: 'Cold: wear a proper coat' },
  freezing: { warmth: [8, 11], outerwear: 'required', outerwearMinWarmth: 4, note: 'Freezing: warmest coat plus a layer' },
};

export function needsFor(w: DayWeather | null): WeatherNeeds {
  if (!w) return DEFAULT_NEEDS;
  const band = bandFor(w.feelsMin);
  const { note, ...rule } = BAND_RULES[band];
  const rain = w.rainChance >= RAIN_THRESHOLD;
  const notes = [note];
  let outerwear = rule.outerwear;

  if (rain) {
    if (band === 'hot') {
      notes.push(`${w.rainChance}% rain: pack an umbrella`);
    } else {
      outerwear = 'required';
      notes.push(`${w.rainChance}% rain: rain-ready outerwear`);
    }
  }
  if (w.feelsMax - w.feelsMin >= 8) notes.push('Big temperature swing: wear layers you can shed');

  return { band, ...rule, warmth: [...rule.warmth], outerwear, rain: rain && band !== 'hot', notes };
}

export const cToF = (c: number) => (c * 9) / 5 + 32;
