/**
 * @file demoEngine.test.ts
 * @summary Unit tests for the Demo Controller simulation and optimization domain engine.
 * @description Verifies scenario weather and flow adjustments, unoptimized baseline configurations,
 * pre-computed optimal parameters (ADR 0002), temporal simulation steps, and date advancement.
 */

import { describe, it, expect } from 'vitest';
import {
  getScenarioWeather,
  getScenarioFlows,
  getScenarioVolumes,
  getUnoptimizedBaselineTelemetry,
  getOptimizedTelemetry,
  simulateTimeStep,
  advanceSimulatedDate,
  calculateDiurnalDemand,
  advanceSimulation,
  OPTIMIZATION_PHASES,
} from '../demoEngine';
import { FARM_PROFILES } from '../../types/farm';
import { BASELINE_TELEMETRY } from '../../types/telemetry';

describe('Demo Engine Domain Logic', () => {
  const smallFarm = FARM_PROFILES['small-farm'];
  const mediumFarm = FARM_PROFILES['medium-farm'];
  const smallBaseline = BASELINE_TELEMETRY['small-farm'];

  describe('Scenario Weather Generation', () => {
    it('returns null for "live" scenario to preserve real/synthetic weather', () => {
      const weather = getScenarioWeather('live', smallFarm);
      expect(weather).toBeNull();
    });

    it('generates extreme heat and dry air for "drought" scenario', () => {
      const weather = getScenarioWeather('drought', smallFarm);
      expect(weather).not.toBeNull();
      expect(weather?.temperatureC).toBe(38.5);
      expect(weather?.relativeHumidityPct).toBe(18);
      expect(weather?.currentPrecipitationMm).toBe(0);
      expect(weather?.precipitationForecast24hMm).toBe(0);
      expect(weather?.isOfflineFallback).toBe(true);
    });

    it('generates heavy rain and saturated humidity for "storm" scenario', () => {
      const weather = getScenarioWeather('storm', smallFarm);
      expect(weather).not.toBeNull();
      expect(weather?.temperatureC).toBe(17.5);
      expect(weather?.relativeHumidityPct).toBe(95);
      expect(weather?.currentPrecipitationMm).toBe(8.5);
      expect(weather?.precipitationForecast24hMm).toBe(48.0);
    });

    it('generates warm dry conditions for "salinity" scenario', () => {
      const weather = getScenarioWeather('salinity', smallFarm);
      expect(weather).not.toBeNull();
      expect(weather?.temperatureC).toBe(24.0);
      expect(weather?.relativeHumidityPct).toBe(60);
    });
  });

  describe('Scenario Flow Adjustments', () => {
    it('increases irrigation demand and zeroes rainwater in drought', () => {
      const flows = getScenarioFlows('drought', smallFarm, smallBaseline.flows);
      expect(flows.rainwaterInflow).toBe(0.0);
      expect(flows.irrigationDemand).toBeGreaterThan(smallBaseline.flows.irrigationDemand);
      expect(flows.esaInflow).toBeLessThan(smallBaseline.flows.esaInflow);
    });

    it('surges rainwater catchment and decreases irrigation demand in storm', () => {
      const flows = getScenarioFlows('storm', smallFarm, smallBaseline.flows);
      expect(flows.rainwaterInflow).toBeGreaterThan(smallBaseline.flows.rainwaterInflow * 3);
      expect(flows.irrigationDemand).toBeLessThan(smallBaseline.flows.irrigationDemand);
      expect(flows.esaInflow).toBeGreaterThan(smallBaseline.flows.esaInflow);
    });

    it('elevates external supply inflow in salinity scenario', () => {
      const flows = getScenarioFlows('salinity', smallFarm, smallBaseline.flows);
      expect(flows.externalInflow).toBeGreaterThanOrEqual(2.5);
      expect(flows.rainwaterInflow).toBe(0.2);
      expect(flows.esaInflow).toBe(0.2);
    });

    it('returns untouched baseline flows in live mode', () => {
      const flows = getScenarioFlows('live', smallFarm, smallBaseline.flows);
      expect(flows).toEqual(smallBaseline.flows);
    });
  });

  describe('Scenario Volume Adjustments', () => {
    it('skews storage to external supply and depletes rainwater/ESA in salinity scenario', () => {
      const volumes = getScenarioVolumes('salinity', smallFarm, smallBaseline.volumes);
      expect(volumes.rainwater).toBe(1.0);
      expect(volumes.esa).toBe(0.5);
      expect(volumes.external).toBe(18.0); // 90% of 20 m³
    });

    it('preserves existing volumes for non-salinity scenarios', () => {
      const volumes = getScenarioVolumes('drought', smallFarm, smallBaseline.volumes);
      expect(volumes).toEqual(smallBaseline.volumes);
    });
  });

  describe('Unoptimized Baseline State (ADR 0002 & CONTEXT.md)', () => {
    it('provides depleted Blend tank below minimum operating volume for Small Farm', () => {
      const unopt = getUnoptimizedBaselineTelemetry(smallFarm);
      expect(unopt.volumes.blend).toBe(5.5);
      expect(unopt.volumes.blend).toBeLessThan(smallFarm.tankCapacities.minOperatingVolume); // 7.0 m³
      expect(unopt.cumulativeTruckCost).toBe(382.50);
      expect(unopt.irrigationMode).toBe('auto');
    });

    it('provides depleted Blend tank below minimum operating volume for Medium Farm', () => {
      const unopt = getUnoptimizedBaselineTelemetry(mediumFarm);
      expect(unopt.volumes.blend).toBe(12.0);
      expect(unopt.volumes.blend).toBeLessThan(mediumFarm.tankCapacities.minOperatingVolume); // 16.0 m³
      expect(unopt.cumulativeTruckCost).toBe(840.00);
      expect(unopt.irrigationMode).toBe('auto');
    });
  });

  describe('Pre-computed Optimal Parameters (ADR 0002)', () => {
    it('provides balanced volumes at target volume with zero deficit for Small Farm', () => {
      const opt = getOptimizedTelemetry(smallFarm);
      expect(opt.volumes.blend).toBe(smallFarm.tankCapacities.targetVolume); // 28.0 m³
      expect(opt.volumes.rainwater).toBe(36.0); // 80% capacity
      expect(opt.volumes.esa).toBe(9.6);       // 80% capacity
      expect(opt.volumes.external).toBe(5.0);
      expect(opt.cumulativeTruckCost).toBe(0);
      expect(opt.irrigationMode).toBe('eco');
    });

    it('provides balanced volumes at target volume with zero deficit for Medium Farm', () => {
      const opt = getOptimizedTelemetry(mediumFarm);
      expect(opt.volumes.blend).toBe(mediumFarm.tankCapacities.targetVolume); // 65.0 m³
      expect(opt.volumes.rainwater).toBe(96.0); // 80% capacity
      expect(opt.volumes.esa).toBe(24.0);       // 80% capacity
      expect(opt.cumulativeTruckCost).toBe(0);
      expect(opt.irrigationMode).toBe('eco');
    });
  });

  describe('Temporal Simulation Step', () => {
    it('advances 6 hours integrating inflows into sources and draining Blend tank', () => {
      const initialVolumes = {
        rainwater: 20.0,
        esa: 6.0,
        external: 10.0,
        blend: 25.0,
      };

      const updated = simulateTimeStep(
        6,
        initialVolumes,
        smallBaseline.flows,
        smallFarm.tankCapacities
      );

      // Rainwater inflow = 2.4 * (6/24) = 0.6 m³ -> rainwater becomes 20.6 m³
      // ESA inflow = 1.2 * (6/24) = 0.3 m³ -> esa becomes 6.3 m³
      // External inflow = 0 -> external remains 10.0 m³
      // Consumption = (2.1 + 0.5) * (6/24) = 2.6 * 0.25 = 0.65 m³
      // Blend volume = 25.0 - 0.65 = 24.35 m³
      expect(updated.rainwater).toBe(20.6);
      expect(updated.esa).toBe(6.3);
      expect(updated.external).toBe(10.0);
      expect(updated.blend).toBe(24.35);
    });

    it('drains Blend tank down to 0 without going negative under extreme demand', () => {
      const initialVolumes = {
        rainwater: 5.0,
        esa: 2.0,
        external: 5.0,
        blend: 1.0,
      };

      const flows = {
        rainwaterInflow: 0.0,
        esaInflow: 0.0,
        externalInflow: 0.0,
        irrigationDemand: 10.0,
        humanUtilityDemand: 2.0,
        livestockDemand: 0.0,
      };

      // 6 hours: consumption = 12 * 0.25 = 3.0 m³. Blend was 1.0 m³, so it caps at 0 m³
      const updated = simulateTimeStep(
        6,
        initialVolumes,
        flows,
        smallFarm.tankCapacities
      );

      expect(updated.blend).toBe(0);
    });

    it('respects maximum physical tank capacities during heavy inflow', () => {
      const highVolumes = {
        rainwater: 44.5,
        esa: 11.8,
        external: 19.5,
        blend: 34.5,
      };

      const highFlows = {
        rainwaterInflow: 50.0,
        esaInflow: 20.0,
        externalInflow: 20.0,
        irrigationDemand: 0.1,
        humanUtilityDemand: 0.1,
        livestockDemand: 0.0,
      };

      const updated = simulateTimeStep(
        24,
        highVolumes,
        highFlows,
        smallFarm.tankCapacities
      );

      expect(updated.rainwater).toBeLessThanOrEqual(smallFarm.tankCapacities.rainwater);
      expect(updated.esa).toBeLessThanOrEqual(smallFarm.tankCapacities.esa);
      expect(updated.external).toBeLessThanOrEqual(smallFarm.tankCapacities.external);
      expect(updated.blend).toBeLessThanOrEqual(smallFarm.tankCapacities.blend);
    });
  });

  describe('Date Advancement & Optimization Phases', () => {
    it('advances simulated date by exact hours', () => {
      const base = new Date('2026-09-21T12:00:00.000Z');
      const advanced6h = advanceSimulatedDate(base, 6);
      expect(advanced6h.toISOString()).toBe('2026-09-21T18:00:00.000Z');

      const advanced24h = advanceSimulatedDate(base, 24);
      expect(advanced24h.toISOString()).toBe('2026-09-22T12:00:00.000Z');
    });

    it('defines 4 phased steps spanning 2000 ms for optimization modal', () => {
      expect(OPTIMIZATION_PHASES.length).toBe(4);
      expect(OPTIMIZATION_PHASES[0].progress).toBeLessThan(OPTIMIZATION_PHASES[1].progress);
      expect(OPTIMIZATION_PHASES[OPTIMIZATION_PHASES.length - 1].progress).toBe(100);
    });
  });

  describe('Diurnal Demand & Full Simulation Progression', () => {
    it('modulates irrigation demand between daylight peak and nocturnal rest', () => {
      const noonFlows = calculateDiurnalDemand(14, smallBaseline.flows);
      const nightFlows = calculateDiurnalDemand(2, smallBaseline.flows);

      // Daytime 14:00 has peak solar irrigation demand (1.4x baseline)
      expect(noonFlows.irrigationDemand).toBeGreaterThan(smallBaseline.flows.irrigationDemand);
      // Nighttime 02:00 has resting irrigation demand (0.1x baseline)
      expect(nightFlows.irrigationDemand).toBeLessThan(smallBaseline.flows.irrigationDemand);
      expect(nightFlows.irrigationDemand).toBeCloseTo(smallBaseline.flows.irrigationDemand * 0.1, 1);
    });

    it('advances simulation coordinating date, diurnal flows, and tank levels', () => {
      const baseDate = new Date('2026-09-21T06:00:00.000Z');
      const initialVolumes = {
        rainwater: 25.0,
        esa: 8.0,
        external: 10.0,
        blend: 26.0,
      };

      const result = advanceSimulation(
        baseDate,
        6,
        initialVolumes,
        smallBaseline.flows,
        smallFarm,
        'live'
      );

      expect(result.date.toISOString()).toBe('2026-09-21T12:00:00.000Z');
      expect(result.weather).not.toBeNull();
      expect(result.flows.irrigationDemand).toBeGreaterThan(0);
      expect(result.volumes.blend).toBeLessThan(initialVolumes.blend);
    });
  });
});

