/**
 * @file syntheticWeatherEngine.test.ts
 * @summary Unit tests for synthetic Mediterranean weather generation engine.
 * @description Verifies seasonal curves, the hourly diurnal series the ESA engine integrates over,
 * dew-point-coupled humidity, and precipitation generated as discrete rainfall events drawn from
 * the two farms' climate normals.
 */

import { describe, it, expect } from 'vitest';
import {
  calculateSaturationVaporPressureKPa,
  calculateDewPointC,
  generateSyntheticWeather,
  SYNTHETIC_FORECAST_DAYS,
} from '../syntheticWeatherEngine';
import { ANTEQUERA_NORMALS, HERAKLION_NORMALS } from '../climatology';

/** Sums the twelve monthly entries of a climate normal. */
function annualTotal(monthly: readonly number[]): number {
  return monthly.reduce((sum, value) => sum + value, 0);
}

/**
 * Walks whole years of generated weather and accumulates rainfall statistics.
 *
 * @remarks Precipitation is drawn per day at the month's climatological frequency, so a single
 * day proves nothing. Ten years is enough for the realised mean to sit within a few percent of the
 * normal it was drawn from.
 */
function accumulateRainfall(farmId: 'small-farm' | 'medium-farm', years: number) {
  let rainyDays = 0;
  let totalMm = 0;
  const byMonth = new Array(12).fill(0);
  for (let year = 0; year < years; year += 1) {
    for (let day = 0; day < 365; day += 1) {
      const date = new Date(Date.UTC(2020 + year, 0, 1 + day, 9, 0, 0));
      const weather = generateSyntheticWeather(date, farmId);
      const mm = weather.precipitationForecast24hMm;
      if (mm > 0) {
        rainyDays += 1;
        byMonth[date.getUTCMonth()] += 1;
      }
      totalMm += mm;
    }
  }
  return {
    rainyDaysPerYear: rainyDays / years,
    mmPerYear: totalMm / years,
    rainyDaysPerYearByMonth: byMonth.map((count) => count / years),
  };
}

describe('Synthetic Weather Engine Seam', () => {
  describe('calculateSaturationVaporPressureKPa', () => {
    it('calculates saturation vapor pressure accurately at 20C', () => {
      // Magnus formula at 20C: ~2.34 kPa
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

  describe('generateSyntheticWeather ambient conditions', () => {
    it('generates plausible summer weather for July (hot and dry)', () => {
      const summerDate = new Date('2026-07-15T14:00:00Z');
      const weather = generateSyntheticWeather(summerDate, 'small-farm');

      expect(weather.isOfflineFallback).toBe(true);
      expect(weather.temperatureC).toBeGreaterThan(22);
      expect(weather.relativeHumidityPct).toBeLessThan(70);
    });

    it('generates plausible winter weather for January (cool and humid)', () => {
      const winterDate = new Date('2026-01-15T10:00:00Z');
      const weather = generateSyntheticWeather(winterDate, 'small-farm');

      expect(weather.isOfflineFallback).toBe(true);
      expect(weather.temperatureC).toBeLessThan(18);
      expect(weather.relativeHumidityPct).toBeGreaterThan(60);
    });

    it('produces realistic diurnal variation between night and afternoon', () => {
      const nightWeather = generateSyntheticWeather(new Date('2026-05-15T04:00:00Z'), 'small-farm');
      const dayWeather = generateSyntheticWeather(new Date('2026-05-15T15:00:00Z'), 'small-farm');

      // Afternoon should be significantly warmer than early morning
      expect(dayWeather.temperatureC).toBeGreaterThan(nightWeather.temperatureC);
      // Relative humidity should be lower in the warmer afternoon
      expect(dayWeather.relativeHumidityPct).toBeLessThan(nightWeather.relativeHumidityPct);
    });

    it('aligns the diurnal solar curve with each farm UTC offset', () => {
      // Antequera keeps CET (UTC+1), so 14:00 UTC is 15:00 solar time, near the diurnal peak,
      // and 02:00 UTC is 03:00 solar time, near the trough.
      const peak = generateSyntheticWeather(new Date('2026-06-15T14:00:00Z'), 'small-farm');
      const trough = generateSyntheticWeather(new Date('2026-06-15T02:00:00Z'), 'small-farm');

      expect(peak.temperatureC).toBeGreaterThan(trough.temperatureC + 8);
      expect(peak.relativeHumidityPct).toBeLessThan(trough.relativeHumidityPct);
    });

    it('reflects each location climate rather than one generic Mediterranean curve', () => {
      const date = new Date('2026-01-15T09:00:00Z');
      const antequera = generateSyntheticWeather(date, 'small-farm');
      const heraklion = generateSyntheticWeather(date, 'medium-farm');

      // Maritime Crete runs milder in January than inland Andalusia.
      expect(heraklion.temperatureC).toBeGreaterThan(antequera.temperatureC);
    });

    it('is deterministic for the same date and farm', () => {
      const date = new Date('2026-03-08T11:00:00Z');
      expect(generateSyntheticWeather(date, 'small-farm')).toEqual(
        generateSyntheticWeather(date, 'small-farm')
      );
    });
  });

  describe('generateSyntheticWeather hourly series', () => {
    it('produces a whole-day hourly series for the ESA engine to integrate', () => {
      const weather = generateSyntheticWeather(new Date('2026-07-15T14:00:00Z'), 'small-farm');

      expect(weather.hourly.temperatureC).toHaveLength(SYNTHETIC_FORECAST_DAYS * 24);
      expect(weather.hourly.relativeHumidityPct).toHaveLength(SYNTHETIC_FORECAST_DAYS * 24);
      expect(weather.hourly.temperatureC.every(Number.isFinite)).toBe(true);
    });

    it('keeps every hourly humidity sample inside physical bounds', () => {
      const weather = generateSyntheticWeather(new Date('2026-07-15T14:00:00Z'), 'small-farm');

      for (const rh of weather.hourly.relativeHumidityPct) {
        expect(rh).toBeGreaterThan(0);
        expect(rh).toBeLessThanOrEqual(100);
      }
    });

    it('reconstructs humidity from a daily dew point, peaking before dawn', () => {
      // The series starts at the current hour (00:00 UTC is 01:00 solar time in Antequera), so
      // index 3 falls in the pre-dawn temperature trough and index 15 near the afternoon peak.
      const weather = generateSyntheticWeather(new Date('2026-07-15T00:00:00Z'), 'small-farm');
      const { temperatureC, relativeHumidityPct } = weather.hourly;

      expect(temperatureC[3]).toBeLessThan(temperatureC[15]);
      // Humidity is the inverse of the temperature cycle because vapour content is held constant
      // across the day; it is not varied independently.
      expect(relativeHumidityPct[3]).toBeGreaterThan(relativeHumidityPct[15]);
    });
  });

  describe('generateSyntheticWeather precipitation events', () => {
    it('delivers rain as discrete events rather than a flat daily average', () => {
      // A flat monthly average would put a small non-zero depth on every single day.
      let dryDays = 0;
      let wettestDayMm = 0;
      for (let day = 0; day < 60; day += 1) {
        const weather = generateSyntheticWeather(
          new Date(Date.UTC(2026, 0, 1 + day, 9, 0, 0)),
          'small-farm'
        );
        if (weather.precipitationForecast24hMm === 0) {
          dryDays += 1;
        }
        wettestDayMm = Math.max(wettestDayMm, weather.precipitationForecast24hMm);
      }

      // Antequera records rain on roughly 6 of 30 winter days, so most days must be bone dry.
      expect(dryDays).toBeGreaterThan(30);
      // And a day that does rain delivers a real shower, not a rounding artefact.
      expect(wettestDayMm).toBeGreaterThan(5);
    });

    it('reproduces the Antequera annual rainfall normals over many years', () => {
      const observed = accumulateRainfall('small-farm', 10);

      expect(observed.rainyDaysPerYear).toBeGreaterThan(annualTotal(ANTEQUERA_NORMALS.rainyDays) * 0.85);
      expect(observed.rainyDaysPerYear).toBeLessThan(annualTotal(ANTEQUERA_NORMALS.rainyDays) * 1.15);
      expect(observed.mmPerYear).toBeGreaterThan(annualTotal(ANTEQUERA_NORMALS.precipitationMm) * 0.85);
      expect(observed.mmPerYear).toBeLessThan(annualTotal(ANTEQUERA_NORMALS.precipitationMm) * 1.15);
    });

    it('reproduces the Heraklion annual rainfall normals over many years', () => {
      const observed = accumulateRainfall('medium-farm', 10);

      expect(observed.rainyDaysPerYear).toBeGreaterThan(annualTotal(HERAKLION_NORMALS.rainyDays) * 0.85);
      expect(observed.rainyDaysPerYear).toBeLessThan(annualTotal(HERAKLION_NORMALS.rainyDays) * 1.15);
      expect(observed.mmPerYear).toBeGreaterThan(annualTotal(HERAKLION_NORMALS.precipitationMm) * 0.85);
      expect(observed.mmPerYear).toBeLessThan(annualTotal(HERAKLION_NORMALS.precipitationMm) * 1.15);
    });

    it('keeps the Mediterranean summer drought: July is far drier than January', () => {
      const observed = accumulateRainfall('small-farm', 10);

      expect(observed.rainyDaysPerYearByMonth[6]).toBeLessThan(1);
      expect(observed.rainyDaysPerYearByMonth[0]).toBeGreaterThan(4);
    });

    it('rains on more days in Heraklion than Antequera, despite similar annual totals', () => {
      const antequera = accumulateRainfall('small-farm', 10);
      const heraklion = accumulateRainfall('medium-farm', 10);

      expect(heraklion.rainyDaysPerYear).toBeGreaterThan(antequera.rainyDaysPerYear);
    });
  });
});
