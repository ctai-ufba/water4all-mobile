/**
 * @file esaPhysicsEngine.test.ts
 * @summary Unit tests for ESA atmospheric water generation physics engine.
 * @description Verifies adsorption potential calculation, Dubinin-Astakhov equilibrium loading,
 * and scaled water production rates across Mediterranean temperature and humidity regimes.
 */

import { describe, it, expect } from 'vitest';
import {
  calculateAdsorptionPotential,
  calculateEquilibriumLoading,
  calculateESAWaterProduction,
} from '../esaPhysicsEngine';

describe('ESA Physics Engine Seam', () => {
  describe('calculateAdsorptionPotential', () => {
    it('calculates adsorption potential correctly for standard conditions (25°C, 60% RH)', () => {
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

    it('produces higher adsorption potential in arid conditions (35°C, 20% RH)', () => {
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
    it('yields high sorbent loading under humid conditions (20°C, 80% RH)', () => {
      const loading = calculateEquilibriumLoading({ temperatureC: 20, relativeHumidityPct: 80 });
      // Sorbent loading should be significant (e.g. > 0.35 kg/kg out of 0.60 max)
      expect(loading).toBeGreaterThan(0.35);
      expect(loading).toBeLessThanOrEqual(0.60);
    });

    it('yields moderate sorbent loading under typical Mediterranean conditions (25°C, 50% RH)', () => {
      const loading = calculateEquilibriumLoading({ temperatureC: 25, relativeHumidityPct: 50 });
      // At 25°C and 50% RH, Dubinin-Astakhov equilibrium loading is ~0.055 kg/kg
      expect(loading).toBeGreaterThan(0.04);
      expect(loading).toBeLessThan(0.10);
    });

    it('yields low sorbent loading during hot arid heatwaves (38°C, 20% RH)', () => {
      const loading = calculateEquilibriumLoading({ temperatureC: 38, relativeHumidityPct: 20 });
      expect(loading).toBeLessThan(0.01);
      expect(loading).toBeGreaterThanOrEqual(0);
    });
  });

  describe('calculateESAWaterProduction', () => {
    it('calculates realistic production for Small Farm (1.2 m³/day nominal) in Mediterranean climate', () => {
      // 22°C, 65% RH (typical evening/morning in Mediterranean climate)
      const result = calculateESAWaterProduction(
        { temperatureC: 22, relativeHumidityPct: 65 },
        1.2
      );
      expect(result.dailyRateM3).toBeGreaterThan(0.3);
      expect(result.hourlyRateM3).toBeCloseTo(result.dailyRateM3 / 24, 3);
      expect(result.hourlyRateLiters).toBeCloseTo((result.dailyRateM3 * 1000) / 24, 0);
      expect(result.hourlyRateM3).toBeCloseTo(result.hourlyRateLiters / 1000, 3);
      expect(result.efficiencyFactor).toBeGreaterThan(0.25);
    });

    it('calculates realistic production for Medium Farm (2.8 m³/day nominal)', () => {
      // 24°C, 60% RH
      const result = calculateESAWaterProduction(
        { temperatureC: 24, relativeHumidityPct: 60 },
        2.8
      );
      expect(result.dailyRateM3).toBeGreaterThan(0.5);
      expect(result.dailyRateM3).toBeLessThan(1.5);
      expect(result.hourlyRateLiters).toBeGreaterThan(20);
    });

    it('drastically reduces water production during extreme arid heat (40°C, 15% RH)', () => {
      const normalResult = calculateESAWaterProduction(
        { temperatureC: 20, relativeHumidityPct: 70 },
        1.2
      );
      const droughtResult = calculateESAWaterProduction(
        { temperatureC: 40, relativeHumidityPct: 15 },
        1.2
      );

      expect(droughtResult.dailyRateM3).toBeLessThan(normalResult.dailyRateM3 * 0.2);
      expect(droughtResult.efficiencyFactor).toBeLessThan(0.2);
    });

    it('handles zero nominal capacity gracefully', () => {
      const result = calculateESAWaterProduction(
        { temperatureC: 25, relativeHumidityPct: 60 },
        0
      );
      expect(result.dailyRateM3).toBe(0);
      expect(result.hourlyRateLiters).toBe(0);
      expect(result.efficiencyFactor).toBe(0);
    });
  });
});
