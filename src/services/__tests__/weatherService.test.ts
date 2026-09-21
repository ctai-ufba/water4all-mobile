/**
 * @file weatherService.test.ts
 * @summary Unit tests for Open-Meteo weather service and fallback logic.
 * @description Verifies API payload parsing, error handling, offline detection,
 * and seamless fallback to synthetic seasonal weather.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  parseOpenMeteoResponse,
  fetchFarmWeather,
  OpenMeteoApiResponse,
} from '../weatherService';

describe('Weather Service Seam', () => {
  const antequeraCoords = { latitude: 37.0194, longitude: -4.5612 };

  describe('parseOpenMeteoResponse', () => {
    it('parses valid Open-Meteo response into WeatherData', () => {
      const mockPayload: OpenMeteoApiResponse = {
        current: {
          temperature_2m: 23.4,
          relative_humidity_2m: 58,
          precipitation: 0.2,
          time: '2026-09-20T12:00:00Z',
        },
        daily: {
          precipitation_sum: [5.6, 0.0, 1.2],
          time: ['2026-09-20', '2026-09-21', '2026-09-22'],
        },
      };

      const result = parseOpenMeteoResponse(mockPayload);
      expect(result.isOfflineFallback).toBe(false);
      expect(result.temperatureC).toBe(23.4);
      expect(result.relativeHumidityPct).toBe(58);
      expect(result.currentPrecipitationMm).toBe(0.2);
      expect(result.precipitationForecast24hMm).toBe(5.6);
      expect(result.timestamp).toBe('2026-09-20T12:00:00Z');
    });

    it('calculates rolling 24-hour precipitation from hourly series when present', () => {
      const hourlyTimes: string[] = [];
      const hourlyPrecip: number[] = [];
      for (let i = 0; i < 48; i++) {
        const hourStr = i < 10 ? `0${i}` : `${i}`;
        hourlyTimes.push(`2026-09-20T${hourStr}:00`);
        hourlyPrecip.push(0.5);
      }

      const mockPayload: OpenMeteoApiResponse = {
        current: {
          temperature_2m: 22.0,
          relative_humidity_2m: 60,
          precipitation: 0.0,
          time: '2026-09-20T10:00',
        },
        hourly: {
          time: hourlyTimes,
          precipitation: hourlyPrecip,
        },
        daily: {
          precipitation_sum: [8.0],
          time: ['2026-09-20'],
        },
      };

      const result = parseOpenMeteoResponse(mockPayload);
      // 24 hours * 0.5 mm = 12.0 mm rolling
      expect(result.precipitationForecast24hMm).toBe(12.0);
    });

    it('falls back to synthetic weather when payload is null or missing current', () => {
      const resultNull = parseOpenMeteoResponse(null);
      expect(resultNull.isOfflineFallback).toBe(true);

      const resultMissing = parseOpenMeteoResponse({});
      expect(resultMissing.isOfflineFallback).toBe(true);
    });

    it('falls back to synthetic weather when temperature or humidity is not a finite number', () => {
      const badPayload = {
        current: {
          temperature_2m: NaN,
          relative_humidity_2m: 50,
        },
      };
      const result = parseOpenMeteoResponse(badPayload);
      expect(result.isOfflineFallback).toBe(true);
    });
  });

  describe('fetchFarmWeather', () => {
    beforeEach(() => {
      vi.restoreAllMocks();
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('successfully fetches and returns parsed live weather data', async () => {
      const mockResponse = {
        current: {
          temperature_2m: 21.0,
          relative_humidity_2m: 65,
          precipitation: 0.0,
          time: '2026-09-20T15:00:00Z',
        },
        daily: {
          precipitation_sum: [2.5],
          time: ['2026-09-20'],
        },
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      const weather = await fetchFarmWeather(antequeraCoords);

      expect(weather.isOfflineFallback).toBe(false);
      expect(weather.temperatureC).toBe(21.0);
      expect(weather.relativeHumidityPct).toBe(65);
      expect(weather.precipitationForecast24hMm).toBe(2.5);
    });

    it('falls back to synthetic weather when fetch rejects with network error', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Failed to fetch (network error)'));

      const weather = await fetchFarmWeather(antequeraCoords);

      expect(weather.isOfflineFallback).toBe(true);
      expect(weather.temperatureC).toBeDefined();
      expect(weather.relativeHumidityPct).toBeDefined();
    });

    it('falls back to synthetic weather when HTTP response is not ok (e.g. 503)', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
        statusText: 'Service Unavailable',
      });

      const weather = await fetchFarmWeather(antequeraCoords);

      expect(weather.isOfflineFallback).toBe(true);
    });

    it('falls back immediately to synthetic weather when navigator.onLine is false', async () => {
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
      const mockResponse = {
        current: {
          temperature_2m: 27.5,
          relative_humidity_2m: 45,
          precipitation: 0.0,
          time: '2026-09-20T16:00:00Z',
        },
        daily: {
          precipitation_sum: [0.0],
          time: ['2026-09-20'],
        },
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      // 1. Fetch live weather with farmId, should cache to localStorage
      const live = await fetchFarmWeather(antequeraCoords, 8000, 'small-farm');
      expect(live.isOfflineFallback).toBe(false);
      expect(live.temperatureC).toBe(27.5);

      // 2. Simulate offline
      const originalOnLine = navigator.onLine;
      Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });

      const offline = await fetchFarmWeather(antequeraCoords, 8000, 'small-farm');
      // Should return the cached live data with isOfflineFallback = true
      expect(offline.isOfflineFallback).toBe(true);
      expect(offline.temperatureC).toBe(27.5);
      expect(offline.relativeHumidityPct).toBe(45);

      Object.defineProperty(navigator, 'onLine', { value: originalOnLine, configurable: true });
    });
  });
});

