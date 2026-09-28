// Today's forecast from Open-Meteo (free, no API key), using the phone's location.
// The last forecast is cached in IndexedDB so the Today tab works offline.

import { db } from '../db/db';
import { summarizeDay, type DayWeather, type HourlyForecast } from '../engine/weather';

interface WeatherCache {
  fetchedAt: number;
  lat: number;
  lon: number;
  hourly: HourlyForecast;
}

export interface TodayWeather {
  weather: DayWeather | null;
  source: 'live' | 'cached' | 'none';
  fetchedAt?: number;
  error?: string;
}

const CACHE_KEY = 'weatherCache';
const FRESH_MS = 60 * 60 * 1000;

export const localDate = (d = new Date()) => d.toLocaleDateString('en-CA'); // YYYY-MM-DD

function position(): Promise<{ lat: number; lon: number }> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('Location is not available on this device.'));
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lon: p.coords.longitude }),
      (err) =>
        reject(
          new Error(
            err.code === err.PERMISSION_DENIED
              ? 'Location permission is off. Allow it for this app to get your forecast.'
              : "Couldn't get your location.",
          ),
        ),
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 30 * 60 * 1000 },
    );
  });
}

async function fetchHourly(lat: number, lon: number): Promise<HourlyForecast> {
  const url = new URL('https://api.open-meteo.com/v1/forecast');
  url.search = new URLSearchParams({
    // ~1 km precision is plenty for weather and keeps the request less identifying.
    latitude: lat.toFixed(2),
    longitude: lon.toFixed(2),
    hourly: 'temperature_2m,apparent_temperature,precipitation_probability',
    timezone: 'auto',
    forecast_days: '2',
  }).toString();
  let res: Response;
  try {
    res = await fetch(url);
  } catch {
    throw new Error("Couldn't reach the weather service.");
  }
  if (!res.ok) throw new Error(`Forecast request failed (${res.status}).`);
  const json = await res.json();
  return {
    time: json.hourly.time,
    temperature: json.hourly.temperature_2m,
    apparent: json.hourly.apparent_temperature,
    precipProbability: json.hourly.precipitation_probability,
  };
}

async function readCache(): Promise<WeatherCache | undefined> {
  return (await db.settings.get(CACHE_KEY))?.value as WeatherCache | undefined;
}

export async function loadTodayWeather(force = false): Promise<TodayWeather> {
  const today = localDate();
  const cache = await readCache();
  const fromCache = (error?: string): TodayWeather => {
    const weather = cache ? summarizeDay(cache.hourly, today) : null;
    return weather
      ? { weather, source: 'cached', fetchedAt: cache!.fetchedAt, error }
      : { weather: null, source: 'none', error };
  };

  if (!force && cache && Date.now() - cache.fetchedAt < FRESH_MS) {
    const weather = summarizeDay(cache.hourly, today);
    if (weather) return { weather, source: 'live', fetchedAt: cache.fetchedAt };
  }

  try {
    const { lat, lon } = await position();
    const hourly = await fetchHourly(lat, lon);
    const fetchedAt = Date.now();
    await db.settings.put({ key: CACHE_KEY, value: { fetchedAt, lat, lon, hourly } satisfies WeatherCache });
    return { weather: summarizeDay(hourly, today), source: 'live', fetchedAt };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Weather unavailable.';
    return fromCache(navigator.onLine ? msg : "You're offline.");
  }
}
