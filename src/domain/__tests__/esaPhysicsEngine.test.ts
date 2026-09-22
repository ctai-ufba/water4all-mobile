/**
 * @file esaPhysicsEngine.test.ts
 * @summary Unit tests for ESA atmospheric water generation physics engine.
 * @description Verifies adsorption potential, Dubinin-Astakhov equilibrium loading, cycle gating,
 * and production integrated across an hourly forecast series across Mediterranean regimes.
 *
 * @remarks Expected production values are reference outputs captured from the
 * `prototipo_water4all` engine (`src/h2o_farm/physics/esa.py`, `build_acff_production_profile`)
 * run over these same forecasts. They are an independent oracle: they come from the calibration
 * authority rather than from recomputing this module's own formula.
 */

import { describe, it, expect } from 'vitest';
import {
  calculateAdsorptionPotential,
  calculateEquilibriumLoading,
  calculateESAWaterProduction,
  calculateESAProductionFromSeries,
  buildConstantAmbientSeries,
} from '../esaPhysicsEngine';
import { HourlyAmbientSeries } from '../../types/weather';

/** Small Farm nominal ESA capacity after the kappa = 1/10 rescale (ADR 0004), in m3/day */
const SMALL_FARM_NOMINAL_M3_PER_DAY = 0.55;

/** Medium Farm nominal ESA capacity after the kappa = 1/10 rescale (ADR 0004), in m3/day */
const MEDIUM_FARM_NOMINAL_M3_PER_DAY = 1.58;

/** Magnus-Tetens saturation vapor pressure in kPa, mirrored from the prototype weather module. */
function saturationVaporPressureKPa(temperatureC: number): number {
  return 0.61094 * Math.exp((17.625 * temperatureC) / (temperatureC + 243.04));
}

/**
 * Builds a diurnal series the way the prototype synthetic generator does: relative humidity is
 * reconstructed from a fixed daily dew point and the temperature cycle, so humidity peaks before
 * dawn and collapses in the afternoon.
 */
function buildDiurnalSeries(
  meanTemperatureC: number,
  diurnalRangeC: number,
  dewPointC: number,
  days: number
): HourlyAmbientSeries {
  const vaporPressure = saturationVaporPressureKPa(dewPointC);
  const temperatureC: number[] = [];
  const relativeHumidityPct: number[] = [];
  for (let day = 0; day < days; day += 1) {
    for (let hour = 0; hour < 24; hour += 1) {
      const t =
        meanTemperatureC +
        0.5 * diurnalRangeC * Math.sin((2.0 * Math.PI * (hour - 9.0)) / 24.0);
      temperatureC.push(t);
      relativeHumidityPct.push(
        Math.min(100.0, Math.max(5.0, (100.0 * vaporPressure) / saturationVaporPressureKPa(t)))
      );
    }
  }
  return { temperatureC, relativeHumidityPct, startTime: '2026-07-01T00:00:00.000Z' };
}

describe('ESA Physics Engine Seam', () => {
  describe('calculateAdsorptionPotential', () => {
    it('calculates adsorption potential correctly for standard conditions (25C, 60% RH)', () => {
      // T = 25 + 273.15 = 298.15 K
      // rh = 0.60
      // A = 8.314462618 * 298.15 * ln(1 / 0.60) ~ 1266.6 J/mol
      const potential = calculateAdsorptionPotential({ temperatureC: 25, relativeHumidityPct: 60 });
      expect(potential).toBeGreaterThan(1200);
      expect(potential).toBeLessThan(1300);
    });

    it('approaches zero potential as relative humidity approaches 100%', () => {
      const potential = calculateAdsorptionPotential({ temperatureC: 20, relativeHumidityPct: 100 });
      expect(potential).toBeCloseTo(0, 4);
    });

    it('produces higher adsorption potential in arid conditions (35C, 20% RH)', () => {
      const standardPotential = calculateAdsorptionPotential({ temperatureC: 25, relativeHumidityPct: 60 });
      const aridPotential = calculateAdsorptionPotential({ temperatureC: 35, relativeHumidityPct: 20 });
      expect(aridPotential).toBeGreaterThan(standardPotential);
      expect(aridPotential).toBeGreaterThan(4000);
    });

    it('throws error when temperature is at or below absolute zero', () => {
      expect(() =>
        calculateAdsorptionPotential({ temperatureC: -273.15, relativeHumidityPct: 50 })
      ).toThrow();
      expect(() =>
        calculateAdsorptionPotential({ temperatureC: -300, relativeHumidityPct: 50 })
      ).toThrow();
    });
  });

  describe('calculateEquilibriumLoading', () => {
    it('yields high sorbent loading under humid conditions (20C, 80% RH)', () => {
      const loading = calculateEquilibriumLoading({ temperatureC: 20, relativeHumidityPct: 80 });
      // Sorbent loading should be significant (e.g. > 0.35 kg/kg out of 0.60 max)
      expect(loading).toBeGreaterThan(0.35);
      expect(loading).toBeLessThanOrEqual(0.60);
    });

    it('yields moderate sorbent loading under typical Mediterranean conditions (25C, 50% RH)', () => {
      const loading = calculateEquilibriumLoading({ temperatureC: 25, relativeHumidityPct: 50 });
      // At 25C and 50% RH, Dubinin-Astakhov equilibrium loading is ~0.055 kg/kg
      expect(loading).toBeGreaterThan(0.04);
      expect(loading).toBeLessThan(0.10);
    });

    it('yields low sorbent loading during hot arid heatwaves (38C, 20% RH)', () => {
      const loading = calculateEquilibriumLoading({ temperatureC: 38, relativeHumidityPct: 20 });
      expect(loading).toBeLessThan(0.01);
      expect(loading).toBeGreaterThanOrEqual(0);
    });
  });

  describe('calculateESAProductionFromSeries', () => {
    it('reproduces the prototype yield for a humid steady regime (22C, 65% RH)', () => {
      const series = buildConstantAmbientSeries(
        { temperatureC: 22, relativeHumidityPct: 65 },
        7
      );
      const result = calculateESAProductionFromSeries(series, SMALL_FARM_NOMINAL_M3_PER_DAY);

      // Prototype reference: 0.201888 m3/day, 2.7143 cycles/day, ratio 0.3671
      expect(result.dailyRateM3).toBeCloseTo(0.2019, 3);
      expect(result.cyclesPerDay).toBeCloseTo(2.7143, 3);
      expect(result.ambientYieldRatio).toBeCloseTo(0.3671, 3);
      expect(result.integratedDays).toBe(7);
    });

    it('scales linearly with nominal capacity for the Medium Farm', () => {
      const series = buildConstantAmbientSeries(
        { temperatureC: 22, relativeHumidityPct: 65 },
        7
      );
      const result = calculateESAProductionFromSeries(series, MEDIUM_FARM_NOMINAL_M3_PER_DAY);

      // Prototype reference: 0.57997 m3/day at 1.58 m3/day nominal
      expect(result.dailyRateM3).toBeCloseTo(0.58, 3);
      expect(result.ambientYieldRatio).toBeCloseTo(0.3671, 3);
    });

    it('withholds cycles entirely in the arid regime (35C, 25% RH)', () => {
      const series = buildConstantAmbientSeries(
        { temperatureC: 35, relativeHumidityPct: 25 },
        7
      );
      const result = calculateESAProductionFromSeries(series, SMALL_FARM_NOMINAL_M3_PER_DAY);

      // Cycle gating: potential collection stays under minimumCollectionKg, so the unit keeps
      // adsorbing rather than spending a fixed regeneration charge on a nearly empty bed.
      expect(result.dailyRateM3).toBe(0);
      expect(result.cyclesPerDay).toBe(0);
      expect(result.energyKwhPerDay).toBe(0);
      expect(result.ambientYieldRatio).toBe(0);
    });

    it('collects water over a summer diurnal cycle whose afternoon reading alone produces none', () => {
      // Mean 27C, 15C diurnal range, 15C dew point: a hot Mediterranean July week.
      const series = buildDiurnalSeries(27, 15, 15, 7);
      const integrated = calculateESAProductionFromSeries(series, SMALL_FARM_NOMINAL_M3_PER_DAY);

      // The 15:00 sample is the afternoon peak: hottest and driest hour of the day.
      const afternoon = {
        temperatureC: series.temperatureC[15],
        relativeHumidityPct: series.relativeHumidityPct[15],
      };
      const afternoonOnly = calculateESAWaterProduction(
        afternoon,
        SMALL_FARM_NOMINAL_M3_PER_DAY
      );

      // ADR 0003: extrapolating the afternoon instant reports zero for a day that does produce.
      expect(afternoonOnly.dailyRateM3).toBe(0);
      // Prototype reference for the integrated week: 0.121571 m3/day, 2.4286 cycles/day
      expect(integrated.dailyRateM3).toBeCloseTo(0.1216, 3);
      expect(integrated.cyclesPerDay).toBeCloseTo(2.4286, 3);
    });

    it('produces more water in a cold humid winter week than a hot summer week', () => {
      const summer = calculateESAProductionFromSeries(
        buildDiurnalSeries(27, 15, 15, 7),
        SMALL_FARM_NOMINAL_M3_PER_DAY
      );
      const winter = calculateESAProductionFromSeries(
        buildDiurnalSeries(10.5, 7, 7, 7),
        SMALL_FARM_NOMINAL_M3_PER_DAY
      );

      // Prototype reference for the winter week: 0.386374 m3/day
      expect(winter.dailyRateM3).toBeCloseTo(0.3864, 3);
      expect(winter.dailyRateM3).toBeGreaterThan(summer.dailyRateM3);
    });

    it('reports energy drawn per day alongside water collected', () => {
      const series = buildConstantAmbientSeries(
        { temperatureC: 22, relativeHumidityPct: 65 },
        7
      );
      const result = calculateESAProductionFromSeries(series, SMALL_FARM_NOMINAL_M3_PER_DAY);

      // Prototype reference: 1474.7563 kWh/day. The fixed regeneration charge is amortised over
      // less water than the bench case, so specific energy exceeds the 4.64 kWh/kg bench figure.
      expect(result.energyKwhPerDay).toBeCloseTo(1474.76, 1);
      expect(result.energyKwhPerDay / result.dailyRateM3).toBeGreaterThan(4640);
    });

    it('keeps the hourly rate consistent with the daily rate', () => {
      const series = buildConstantAmbientSeries(
        { temperatureC: 22, relativeHumidityPct: 65 },
        7
      );
      const result = calculateESAProductionFromSeries(series, SMALL_FARM_NOMINAL_M3_PER_DAY);

      expect(result.hourlyRateM3).toBeCloseTo(result.dailyRateM3 / 24, 3);
      expect(result.hourlyRateLiters).toBeCloseTo((result.dailyRateM3 * 1000) / 24, 0);
    });

    it('handles zero nominal capacity gracefully', () => {
      const series = buildConstantAmbientSeries(
        { temperatureC: 22, relativeHumidityPct: 65 },
        7
      );
      const result = calculateESAProductionFromSeries(series, 0);

      expect(result.dailyRateM3).toBe(0);
      expect(result.hourlyRateLiters).toBe(0);
      expect(result.ambientYieldRatio).toBe(0);
      expect(result.energyKwhPerDay).toBe(0);
    });

    it('returns a zero result rather than throwing on an empty series', () => {
      const result = calculateESAProductionFromSeries(
        { temperatureC: [], relativeHumidityPct: [], startTime: '2026-07-01T00:00:00.000Z' },
        SMALL_FARM_NOMINAL_M3_PER_DAY
      );

      expect(result.dailyRateM3).toBe(0);
      expect(result.integratedDays).toBe(0);
    });
  });

  describe('calculateESAWaterProduction', () => {
    it('answers what a steady humid regime would yield for the Small Farm', () => {
      const result = calculateESAWaterProduction(
        { temperatureC: 22, relativeHumidityPct: 65 },
        SMALL_FARM_NOMINAL_M3_PER_DAY
      );
      expect(result.dailyRateM3).toBeCloseTo(0.2019, 3);
      expect(result.ambientYieldRatio).toBeCloseTo(0.3671, 3);
      expect(result.hourlyRateM3).toBeCloseTo(result.dailyRateM3 / 24, 3);
    });

    it('drastically reduces water production during extreme arid heat (40C, 15% RH)', () => {
      const normalResult = calculateESAWaterProduction(
        { temperatureC: 20, relativeHumidityPct: 70 },
        SMALL_FARM_NOMINAL_M3_PER_DAY
      );
      const droughtResult = calculateESAWaterProduction(
        { temperatureC: 40, relativeHumidityPct: 15 },
        SMALL_FARM_NOMINAL_M3_PER_DAY
      );

      expect(droughtResult.dailyRateM3).toBeLessThan(normalResult.dailyRateM3 * 0.2);
      expect(droughtResult.ambientYieldRatio).toBeLessThan(0.2);
    });

    it('handles zero nominal capacity gracefully', () => {
      const result = calculateESAWaterProduction(
        { temperatureC: 25, relativeHumidityPct: 60 },
        0
      );
      expect(result.dailyRateM3).toBe(0);
      expect(result.hourlyRateLiters).toBe(0);
      expect(result.ambientYieldRatio).toBe(0);
    });
  });
});
