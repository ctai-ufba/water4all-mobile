/**
 * @file syntheticWeatherEngine.test.ts
 * @summary Unit tests for synthetic Mediterranean weather generation engine.
 * @description Verifies seasonal temperature curves, diurnal variations, dew point coupling,
 * and realistic outputs for offline fallback.
 */

import { describe, it, expect } from 'vitest';
import {
  calculateSaturationVaporPressureKPa,
  calculateDewPointC,
  generateSyntheticWeather,
} from '../syntheticWeatherEngine';

describe('Synthetic Weather Engine Seam', () => {
  describe('calculateSaturationVaporPressureKPa', () => {
    it('calculates saturation vapor pressure accurately at 20°C', () => {
      // Magnus formula at 20°C: ~2.34 kPa
      const pSat = calculateSaturationVaporPressureKPa(20);
      expect(pSat).toBeGreaterThan(2.3);
      expect(pSat).toBeLessThan(2.4);
    });

    it('calculates higher pressure at elevated temperatures', () => {
      expect(calculateSaturationVaporPressureKPa(35)).toBeGreaterThan(calculateSaturationVaporPressureKPa(20));
    });
  });

  describe('calculateDewPointC', () => {
    it('equals dry-bulb temperature at 100% relative humidity', () => {
      const dewPoint = calculateDewPointC({ temperatureC: 20, relativeHumidityPct: 100 });
      expect(dewPoint).toBeCloseTo(20, 1);
    });

    it('is strictly lower than dry-bulb temperature when relative humidity < 100%', () => {
      const dewPoint = calculateDewPointC({ temperatureC: 25, relativeHumidityPct: 50 });
      expect(dewPoint).toBeLessThan(25);
      expect(dewPoint).toBeGreaterThan(10);
    });
  });

  describe('generateSyntheticWeather', () => {
    it('generates plausible summer weather for July (hot and dry)', () => {
      const summerDate = new Date('2026-07-15T14:00:00Z');
      const weather = generateSyntheticWeather(summerDate);

      expect(weather.isOfflineFallback).toBe(true);
      expect(weather.temperatureC).toBeGreaterThan(22);
      expect(weather.relativeHumidityPct).toBeLessThan(70);
      expect(weather.precipitationForecast24hMm).toBeLessThan(2.0);
    });

    it('generates plausible winter weather for January (cool and humid with higher rain potential)', () => {
      const winterDate = new Date('2026-01-15T10:00:00Z');
      const weather = generateSyntheticWeather(winterDate);

      expect(weather.isOfflineFallback).toBe(true);
      expect(weather.temperatureC).toBeLessThan(18);
      expect(weather.relativeHumidityPct).toBeGreaterThan(60);
      expect(weather.precipitationForecast24hMm).toBeGreaterThan(1.0);
    });

    it('produces realistic diurnal variation between night and afternoon', () => {
      const nightDate = new Date('2026-05-15T04:00:00Z');
      const afternoonDate = new Date('2026-05-15T15:00:00Z');

      const nightWeather = generateSyntheticWeather(nightDate);
      const dayWeather = generateSyntheticWeather(afternoonDate);

      // Afternoon should be significantly warmer than early morning
      expect(dayWeather.temperatureC).toBeGreaterThan(nightWeather.temperatureC);
      // Relative humidity should be lower in the warmer afternoon
      expect(dayWeather.relativeHumidityPct).toBeLessThan(nightWeather.relativeHumidityPct);
    });

    it('aligns diurnal solar curve with Mediterranean UTC offset regardless of client timezone', () => {
      // 14:00 UTC + 1 = 15:00 solar time (near diurnal peak)
      const peakDate = new Date('2026-06-15T14:00:00Z');
      // 02:00 UTC + 1 = 03:00 solar time (near diurnal trough)
      const troughDate = new Date('2026-06-15T02:00:00Z');

      const peakWeather = generateSyntheticWeather(peakDate, 1);
      const troughWeather = generateSyntheticWeather(troughDate, 1);

      expect(peakWeather.temperatureC).toBeGreaterThan(troughWeather.temperatureC + 8);
      expect(peakWeather.relativeHumidityPct).toBeLessThan(troughWeather.relativeHumidityPct);
    });
  });
});

