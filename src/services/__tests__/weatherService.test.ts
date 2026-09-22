/**
 * @file weatherService.test.ts
 * @summary Unit tests for Open-Meteo weather service and fallback logic.
 * @description Verifies API payload parsing including the hourly temperature and humidity series,
 * cache freshness, offline detection, and the documented cache-then-synthetic fallback path.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  parseOpenMeteoResponse,
  fetchFarmWeather,
  getCachedFarmWeather,
  cacheFarmWeather,
  OpenMeteoApiResponse,
  WEATHER_STORAGE_KEY_PREFIX,
  WEATHER_CACHE_TTL_MS,
} from '../weatherService';

/** Builds an Open-Meteo hourly block spanning `hours` samples from midnight. */
function buildHourlyBlock(hours: number, temperature: number, humidity: number, precip: number) {
  const time: string[] = [];
  const temperature_2m: number[] = [];
  const relative_humidity_2m: number[] = [];
  const precipitation: number[] = [];
  for (let i = 0; i < hours; i += 1) {
    const day = 20 + Math.floor(i / 24);
    const hour = i % 24;
    time.push(`2026-09-${day}T${String(hour).padStart(2, '0')}:00`);
    temperature_2m.push(temperature);
    relative_humidity_2m.push(humidity);
    precipitation.push(precip);
  }
  return { time, temperature_2m, relative_humidity_2m, precipitation };
}

/** A well-formed Open-Meteo payload with a 7-day hourly series. */
function buildValidPayload(overrides: Partial<OpenMeteoApiResponse> = {}): OpenMeteoApiResponse {
  return {
    current: {
      temperature_2m: 23.4,
      relative_humidity_2m: 58,
      precipitation: 0.2,
      time: '2026-09-20T00:00',
    },
    hourly: buildHourlyBlock(168, 23.4, 58, 0.25),
    daily: {
      precipitation_sum: [5.6, 0.0, 1.2],
      time: ['2026-09-20', '2026-09-21', '2026-09-22'],
    },
    ...overrides,
  };
}

describe('Weather Service Seam', () => {
  const antequeraCoords = { latitude: 37.0051, longitude: -4.6425 };

  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    localStorage.clear();
  });

  describe('parseOpenMeteoResponse', () => {
    it('parses a valid Open-Meteo response into WeatherData', () => {
      const result = parseOpenMeteoResponse(buildValidPayload());

      expect(result).not.toBeNull();
      expect(result?.isOfflineFallback).toBe(false);
      expect(result?.temperatureC).toBe(23.4);
      expect(result?.relativeHumidityPct).toBe(58);
      expect(result?.currentPrecipitationMm).toBe(0.2);
      expect(result?.timestamp).toBe('2026-09-20T00:00');
    });

    it('calculates rolling 24-hour precipitation from the hourly series', () => {
      const payload = buildValidPayload({
        current: {
          temperature_2m: 22.0,
          relative_humidity_2m: 60,
          precipitation: 0.0,
          time: '2026-09-20T00:00',
        },
        hourly: buildHourlyBlock(48, 22.0, 60, 0.5),
      });

      // 24 hours * 0.5 mm = 12.0 mm rolling from the current hour
      expect(parseOpenMeteoResponse(payload)?.precipitationForecast24hMm).toBe(12.0);
    });

    it('extracts the hourly temperature and humidity series the ESA engine integrates over', () => {
      const payload = buildValidPayload({
        current: {
          temperature_2m: 18.0,
          relative_humidity_2m: 72,
          precipitation: 0.0,
          time: '2026-09-20T06:00',
        },
        hourly: buildHourlyBlock(168, 18.0, 72, 0.0),
      });

      const result = parseOpenMeteoResponse(payload);

      // The series runs forward from the current hour, not from the start of the payload.
      expect(result?.hourly.temperatureC.length).toBeGreaterThanOrEqual(24);
      expect(result?.hourly.temperatureC.length).toBe(168 - 6);
      expect(result?.hourly.relativeHumidityPct.length).toBe(result?.hourly.temperatureC.length);
      expect(result?.hourly.temperatureC[0]).toBe(18.0);
      expect(result?.hourly.relativeHumidityPct[0]).toBe(72);
    });

    it('falls back to the current reading when the hourly series is absent', () => {
      const payload = buildValidPayload({ hourly: undefined });
      const result = parseOpenMeteoResponse(payload);

      // A forecast without an hourly block still has to give the ESA engine something to
      // integrate, so the current reading is held across a whole day.
      expect(result?.hourly.temperatureC.length).toBe(24);
      expect(result?.hourly.temperatureC.every((t) => t === 23.4)).toBe(true);
    });

    it('falls back to the daily summary when the hourly block carries no time array', () => {
      // Without timestamps the hourly block cannot be aligned to the current hour, so summing its
      // first 24 entries would report the start of the local day as if it were the next 24 hours.
      const payload = buildValidPayload({
        current: {
          temperature_2m: 20,
          relative_humidity_2m: 50,
          precipitation: 0,
          time: '2026-09-20T18:00',
        },
        hourly: {
          precipitation: new Array(48).fill(0).map((_, i) => (i < 24 ? 5 : 0)),
          temperature_2m: new Array(48).fill(20),
          relative_humidity_2m: new Array(48).fill(50),
        },
        daily: { precipitation_sum: [0.0], time: ['2026-09-20'] },
      });

      const result = parseOpenMeteoResponse(payload);

      expect(result?.precipitationForecast24hMm).toBe(0.0);
    });

    it('holds the current reading across a day when the hourly block cannot be aligned', () => {
      const payload = buildValidPayload({
        current: {
          temperature_2m: 20,
          relative_humidity_2m: 50,
          precipitation: 0,
          time: '2026-09-20T18:00',
        },
        hourly: {
          temperature_2m: new Array(48).fill(31),
          relative_humidity_2m: new Array(48).fill(12),
        },
      });

      const result = parseOpenMeteoResponse(payload);

      // An unalignable series would start the ESA integration at the wrong hour of the day, which
      // for a diurnal cycle is worse than a flat day at the known current reading.
      expect(result?.hourly.temperatureC).toHaveLength(24);
      expect(result?.hourly.temperatureC.every((t) => t === 20)).toBe(true);
    });

    it('reports failure rather than substituting synthetic data on a malformed payload', () => {
      // Returning synthetic data from the parser hides the failure from the caller, which then
      // cannot choose the cache first. The parser reports; the caller decides.
      expect(parseOpenMeteoResponse(null)).toBeNull();
      expect(parseOpenMeteoResponse({})).toBeNull();
      expect(parseOpenMeteoResponse('not json')).toBeNull();
      expect(
        parseOpenMeteoResponse({ current: { temperature_2m: NaN, relative_humidity_2m: 50 } })
      ).toBeNull();
      expect(
        parseOpenMeteoResponse({ current: { temperature_2m: 20, relative_humidity_2m: null } })
      ).toBeNull();
    });
  });

  describe('weather cache freshness', () => {
    it('returns cached weather while it is fresh, marked as a fallback', () => {
      const weather = parseOpenMeteoResponse(buildValidPayload());
      cacheFarmWeather('small-farm', weather!);

      const cached = getCachedFarmWeather('small-farm');
      expect(cached?.temperatureC).toBe(23.4);
      expect(cached?.isOfflineFallback).toBe(true);
    });

    it('discards cached weather once it is older than the TTL', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-09-20T12:00:00Z'));

      const weather = parseOpenMeteoResponse(buildValidPayload());
      cacheFarmWeather('small-farm', weather!);
      expect(getCachedFarmWeather('small-farm')).not.toBeNull();

      // A reading this old is no longer a description of the current sky.
      vi.setSystemTime(new Date(Date.now() + WEATHER_CACHE_TTL_MS + 1000));
      expect(getCachedFarmWeather('small-farm')).toBeNull();
    });

    it('ignores a corrupted cache entry without throwing', () => {
      localStorage.setItem(`${WEATHER_STORAGE_KEY_PREFIX}small-farm`, '{not json');
      expect(getCachedFarmWeather('small-farm')).toBeNull();
    });

    it('never caches synthetic weather as if it were an observation', () => {
      const synthetic = parseOpenMeteoResponse(buildValidPayload());
      cacheFarmWeather('small-farm', { ...synthetic!, isOfflineFallback: true });
      expect(getCachedFarmWeather('small-farm')).toBeNull();
    });
  });

  describe('fetchFarmWeather', () => {
    it('requests hourly temperature and humidity alongside precipitation', async () => {
      const fetchSpy = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => buildValidPayload(),
      });
      global.fetch = fetchSpy;

      await fetchFarmWeather(antequeraCoords);

      const requestedUrl = String(fetchSpy.mock.calls[0][0]);
      const hourlyParam = new URL(requestedUrl).searchParams.get('hourly') ?? '';
      // All three ride on the same free, key-less request (ADR 0003).
      expect(hourlyParam).toContain('temperature_2m');
      expect(hourlyParam).toContain('relative_humidity_2m');
      expect(hourlyParam).toContain('precipitation');
    });

    it('successfully fetches and returns parsed live weather data', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => buildValidPayload(),
      });

      const weather = await fetchFarmWeather(antequeraCoords);

      expect(weather.isOfflineFallback).toBe(false);
      expect(weather.temperatureC).toBe(23.4);
      expect(weather.relativeHumidityPct).toBe(58);
      expect(weather.hourly.temperatureC.length).toBeGreaterThan(24);
    });

    it('falls back to synthetic weather when fetch rejects with a network error', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Failed to fetch (network error)'));

      const weather = await fetchFarmWeather(antequeraCoords);

      expect(weather.isOfflineFallback).toBe(true);
      expect(weather.hourly.temperatureC.length).toBeGreaterThan(0);
    });

    it('falls back to synthetic weather when the HTTP response is not ok', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
        statusText: 'Service Unavailable',
      });

      expect((await fetchFarmWeather(antequeraCoords)).isOfflineFallback).toBe(true);
    });

    it('falls back immediately when navigator.onLine is false', async () => {
      const originalOnLine = navigator.onLine;
      Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });

      const fetchSpy = vi.fn();
      global.fetch = fetchSpy;

      const weather = await fetchFarmWeather(antequeraCoords);

      expect(weather.isOfflineFallback).toBe(true);
      expect(fetchSpy).not.toHaveBeenCalled();

      Object.defineProperty(navigator, 'onLine', { value: originalOnLine, configurable: true });
    });

    it('caches live weather and restores it when offline instead of synthetic data', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () =>
          buildValidPayload({
            current: {
              temperature_2m: 27.5,
              relative_humidity_2m: 45,
              precipitation: 0.0,
              time: '2026-09-20T00:00',
            },
          }),
      });

      const live = await fetchFarmWeather(antequeraCoords, 8000, 'small-farm');
      expect(live.isOfflineFallback).toBe(false);
      expect(live.temperatureC).toBe(27.5);

      const originalOnLine = navigator.onLine;
      Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });

      const offline = await fetchFarmWeather(antequeraCoords, 8000, 'small-farm');
      expect(offline.isOfflineFallback).toBe(true);
      expect(offline.temperatureC).toBe(27.5);
      expect(offline.relativeHumidityPct).toBe(45);

      Object.defineProperty(navigator, 'onLine', { value: originalOnLine, configurable: true });
    });

    it('falls back through the cache when a 200 OK carries a malformed payload', async () => {
      // Seed the cache with a good reading.
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () =>
          buildValidPayload({
            current: {
              temperature_2m: 19.5,
              relative_humidity_2m: 81,
              precipitation: 0.0,
              time: '2026-09-20T00:00',
            },
          }),
      });
      await fetchFarmWeather(antequeraCoords, 8000, 'small-farm');

      // Now the API answers 200 with nonsense. A malformed body is a failure like any other and
      // must take the same cache-then-synthetic path, not skip straight to synthetic.
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ current: { temperature_2m: 'warm' } }),
      });

      const weather = await fetchFarmWeather(antequeraCoords, 8000, 'small-farm');

      expect(weather.isOfflineFallback).toBe(true);
      expect(weather.temperatureC).toBe(19.5);
      expect(weather.relativeHumidityPct).toBe(81);
    });

    it('falls back to synthetic when a malformed payload arrives and no cache exists', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ unexpected: 'shape' }),
      });

      const weather = await fetchFarmWeather(antequeraCoords, 8000, 'small-farm');

      expect(weather.isOfflineFallback).toBe(true);
      expect(weather.hourly.temperatureC.length).toBeGreaterThan(0);
    });

    it('prefers synthetic weather over a cache that has gone stale', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-01-15T12:00:00Z'));

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () =>
          buildValidPayload({
            current: {
              temperature_2m: 30.0,
              relative_humidity_2m: 20,
              precipitation: 0.0,
              time: '2026-01-15T12:00',
            },
          }),
      });
      await fetchFarmWeather(antequeraCoords, 8000, 'small-farm');

      // Come back long after that reading expired, with the network down.
      vi.setSystemTime(new Date(Date.now() + WEATHER_CACHE_TTL_MS + 60_000));
      const originalOnLine = navigator.onLine;
      Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });

      const weather = await fetchFarmWeather(antequeraCoords, 8000, 'small-farm');

      expect(weather.isOfflineFallback).toBe(true);
      // A stale 30 C reading must not be served as the current sky in mid-January.
      expect(weather.temperatureC).not.toBe(30.0);
      expect(weather.temperatureC).toBeLessThan(20);

      Object.defineProperty(navigator, 'onLine', { value: originalOnLine, configurable: true });
    });

    it('uses the farm climate normals for its synthetic fallback', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('offline'));

      const date = new Date('2026-01-15T09:00:00Z');
      vi.useFakeTimers();
      vi.setSystemTime(date);

      const antequera = await fetchFarmWeather(antequeraCoords, 8000, 'small-farm');
      const heraklion = await fetchFarmWeather(
        { latitude: 35.2373, longitude: 25.1029 },
        8000,
        'medium-farm'
      );

      // Maritime Crete runs milder in January than inland Andalusia.
      expect(heraklion.temperatureC).toBeGreaterThan(antequera.temperatureC);
    });
  });
});
