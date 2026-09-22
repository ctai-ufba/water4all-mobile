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
  AdvanceSimulationParams,
  SOURCE_TANK_PUMP_RESERVE_RATIO,
  OPTIMIZATION_PHASES,
  OPTIMAL_FARM_PARAMETERS,
  UNOPTIMIZED_BASELINES,
} from '../demoEngine';
import { calculateCatchmentInflow } from '../catchmentEngine';
import { calculateBlendQuality } from '../waterQualityEngine';
import { evaluateCropCompliance } from '../faoComplianceEngine';
import { FARM_PROFILES, PROFILE_SCALE_FACTOR } from '../../types/farm';
import {
  BASELINE_TELEMETRY,
  TankVolumeMetrics,
  WaterFlowMetrics,
} from '../../types/telemetry';

describe('Demo Engine Domain Logic', () => {
  const smallFarm = FARM_PROFILES['small-farm'];
  const mediumFarm = FARM_PROFILES['medium-farm'];
  const smallBaseline = BASELINE_TELEMETRY['small-farm'];
  const mediumBaseline = BASELINE_TELEMETRY['medium-farm'];

  /**
   * Builds advanceSimulation parameters for the small farm running its calibrated schedule.
   *
   * @param overrides - Fields to replace on the calibrated default.
   * @returns Complete AdvanceSimulationParams for one step.
   */
  function advanceParams(
    overrides: Partial<AdvanceSimulationParams> = {}
  ): AdvanceSimulationParams {
    return {
      currentDate: new Date('2026-09-21T12:00:00.000Z'),
      hours: 6,
      currentVolumes: { ...smallBaseline.volumes },
      currentFlows: { ...smallBaseline.flows },
      farm: smallFarm,
      scenario: 'live',
      irrigationMode: 'auto',
      scheduledIrrigationDemand: smallBaseline.flows.irrigationDemand,
      ...overrides,
    };
  }

  describe('Scenario Weather Generation', () => {
    it('returns null for "live" scenario to preserve real/synthetic weather', () => {
      const weather = getScenarioWeather('live');
      expect(weather).toBeNull();
    });

    it('generates extreme heat and dry air for "drought" scenario', () => {
      const weather = getScenarioWeather('drought');
      expect(weather).not.toBeNull();
      expect(weather?.temperatureC).toBe(38.5);
      expect(weather?.relativeHumidityPct).toBe(18);
      expect(weather?.currentPrecipitationMm).toBe(0);
      expect(weather?.precipitationForecast24hMm).toBe(0);
      expect(weather?.isOfflineFallback).toBe(true);
    });

    it('generates heavy rain and saturated humidity for "storm" scenario', () => {
      const weather = getScenarioWeather('storm');
      expect(weather).not.toBeNull();
      expect(weather?.temperatureC).toBe(17.5);
      expect(weather?.relativeHumidityPct).toBe(95);
      expect(weather?.currentPrecipitationMm).toBe(8.5);
      expect(weather?.precipitationForecast24hMm).toBe(48.0);
    });

    it('generates warm dry conditions for "salinity" scenario', () => {
      const weather = getScenarioWeather('salinity');
      expect(weather).not.toBeNull();
      expect(weather?.temperatureC).toBe(24.0);
      expect(weather?.relativeHumidityPct).toBe(60);
    });
  });

  describe('Scenario Flow Adjustments', () => {
    it('increases irrigation demand and zeroes rainwater in drought', () => {
      const flows = getScenarioFlows('drought', smallBaseline.flows, smallFarm);
      expect(flows.rainwaterInflow).toBe(0.0);
      expect(flows.irrigationDemand).toBeGreaterThan(smallBaseline.flows.irrigationDemand);
      expect(flows.esaInflow).toBeLessThan(smallBaseline.flows.esaInflow);
    });

    it('surges rainwater catchment and decreases irrigation demand in storm', () => {
      const flows = getScenarioFlows('storm', smallBaseline.flows, smallFarm);
      expect(flows.rainwaterInflow).toBeGreaterThan(smallBaseline.flows.rainwaterInflow * 3);
      expect(flows.irrigationDemand).toBeLessThan(smallBaseline.flows.irrigationDemand);
      expect(flows.esaInflow).toBeGreaterThan(smallBaseline.flows.esaInflow);
    });

    it('elevates external supply inflow in salinity scenario', () => {
      const flows = getScenarioFlows('salinity', smallBaseline.flows, smallFarm);
      expect(flows.externalInflow).toBeGreaterThanOrEqual(2.5);
      expect(flows.rainwaterInflow).toBe(0);
      // ESA is derived from the scenario's own 24 °C / 60 % RH air, so it can never exceed what
      // the installed capacity could make under those conditions.
      expect(flows.esaInflow).toBeGreaterThan(0);
      expect(flows.esaInflow).toBeLessThan(smallFarm.esaNominalCapacityM3PerDay);
    });

    it('withholds ESA production entirely in the drought scenario', () => {
      const flows = getScenarioFlows('drought', smallBaseline.flows, smallFarm);
      // At 38.5 °C and 18 % RH the cycle gate holds: the unit collects nothing at all. A
      // multiplier on the baseline would have shown a small positive yield instead.
      expect(flows.esaInflow).toBe(0);
    });

    it('keeps every scenario ESA inflow within installed capacity', () => {
      for (const scenario of ['drought', 'storm', 'salinity'] as const) {
        const flows = getScenarioFlows(scenario, smallBaseline.flows, smallFarm);
        expect(flows.esaInflow).toBeLessThanOrEqual(smallFarm.esaNominalCapacityM3PerDay);
      }
    });

    it('returns untouched baseline flows in live mode', () => {
      const flows = getScenarioFlows('live', smallBaseline.flows, smallFarm);
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

    it('over-irrigates on an unoptimized schedule above the profile baseline', () => {
      const unopt = getUnoptimizedBaselineTelemetry(smallFarm);

      // The naive schedule asks for more than the 2.1 m³/day the farm is calibrated for, and
      // Auto mode runs it in full.
      expect(unopt.scheduledIrrigationDemand).toBe(3.6);
      expect(unopt.flows?.irrigationDemand).toBe(3.6);

      const opt = getOptimizedTelemetry(smallFarm);
      expect(opt.scheduledIrrigationDemand).toBe(2.1);
      expect(opt.flows?.irrigationDemand).toBeLessThan(unopt.flows!.irrigationDemand);
    });

    it('carries the unoptimized schedule for Medium Farm too', () => {
      const unopt = getUnoptimizedBaselineTelemetry(mediumFarm);

      expect(unopt.scheduledIrrigationDemand).toBe(9.5);
      expect(unopt.flows?.irrigationDemand).toBe(9.5);
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
      expect(opt.volumes.esa).toBe(1.28);      // 80% of the 1.6 m³ capacity
      expect(opt.volumes.external).toBe(5.0);
      expect(opt.cumulativeTruckCost).toBe(0);
      expect(opt.irrigationMode).toBe('eco');
    });

    it('provides balanced volumes at target volume with zero deficit for Medium Farm', () => {
      const opt = getOptimizedTelemetry(mediumFarm);
      expect(opt.volumes.blend).toBe(mediumFarm.tankCapacities.targetVolume); // 65.0 m³
      expect(opt.volumes.rainwater).toBe(96.0); // 80% capacity
      expect(opt.volumes.esa).toBe(3.76);       // 80% capacity
      expect(opt.cumulativeTruckCost).toBe(0);
      expect(opt.irrigationMode).toBe('eco');
    });
  });

  describe('Temporal Simulation Step', () => {
    it('advances 6 hours integrating inflows into sources and draining Blend tank', () => {
      // The ESA tank holds 1.6 m³ after the kappa rescale, so the starting volume has to sit
      // inside it or the inflow simply clamps and the arithmetic below proves nothing.
      const initialVolumes = {
        rainwater: 20.0,
        esa: 1.0,
        external: 10.0,
        blend: 25.0,
      };

      // Flows are stated here rather than read from the baseline: this test pins the simulation
      // arithmetic, and reading derived inflows would let a climate or physics change silently
      // invalidate the worked example below.
      const flows = {
        rainwaterInflow: 2.4,
        esaInflow: 1.2,
        externalInflow: 0.0,
        irrigationDemand: 2.1,
        humanUtilityDemand: 0.5,
        livestockDemand: 0.0,
      };

      const updated = simulateTimeStep(
        6,
        initialVolumes,
        flows,
        smallFarm.tankCapacities
      );

      // Rainwater inflow = 2.4 * (6/24) = 0.6 m³ -> rainwater accumulates to 20.6 m³
      // ESA inflow = 1.2 * (6/24) = 0.3 m³ -> esa accumulates to 1.3 m³, inside its 1.6 m³ tank
      // External inflow = 0 -> external remains 10.0 m³
      // Consumption = (2.1 + 0.5) * (6/24) = 2.6 * 0.25 = 0.65 m³ -> blend drains to 24.35 m³
      // Replenishment towards the 28.0 m³ target over 6h = (28.0 - 24.35) * 0.5 = 1.825 m³,
      // drawn from Rainwater, which holds 16.1 m³ above its 4.5 m³ reserve floor.
      expect(updated.rainwater).toBe(18.78); // 20.6 - 1.825
      expect(updated.esa).toBe(1.3); // Untouched: Rainwater covered the whole transfer
      expect(updated.external).toBe(10.0);
      expect(updated.blend).toBe(26.18); // 24.35 + 1.825
    });

    it('drains Blend tank down to 0 without going negative under extreme demand', () => {
      // Every source is empty, external supply included, so replenishment cannot rescue the
      // Blend tank and the floor at 0 m³ is the only thing standing between consumption and a
      // negative volume.
      const initialVolumes = {
        rainwater: 0.0,
        esa: 0.0,
        external: 0.0,
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
      expect(updated.rainwater).toBe(0);
      expect(updated.esa).toBe(0);
    });

    it('will not pump a source tank below its reserve floor to top up the Blend tank', () => {
      // Rainwater sits at 4.0 m³, under its 4.5 m³ floor (10% of 45 m³), ESA at 0.1 m³ under
      // its 0.16 m³ floor (10% of the kappa-scaled 1.6 m³ tank), and external supply at 1.0 m³
      // under its 2.0 m³ floor. None can give anything up, however far the Blend tank is from
      // its target volume.
      const depletedSources = {
        rainwater: 4.0,
        esa: 0.1,
        external: 1.0,
        blend: 10.0,
      };

      const noFlow = {
        rainwaterInflow: 0.0,
        esaInflow: 0.0,
        externalInflow: 0.0,
        irrigationDemand: 0.0,
        humanUtilityDemand: 0.0,
        livestockDemand: 0.0,
      };

      const updated = simulateTimeStep(6, depletedSources, noFlow, smallFarm.tankCapacities);

      expect(updated.rainwater).toBe(4.0);
      expect(updated.esa).toBe(0.1);
      expect(updated.external).toBe(1.0);
      expect(updated.blend).toBe(10.0);
    });

    it('covers the full replenishment need during a heavy catchment event on any farm profile', () => {
      const volumes = {
        rainwater: 40.0,
        esa: 10.0,
        external: 10.0,
        blend: 20.0,
      };

      const noFlow = {
        rainwaterInflow: 0.0,
        esaInflow: 0.0,
        externalInflow: 0.0,
        irrigationDemand: 0.0,
        humanUtilityDemand: 0.0,
        livestockDemand: 0.0,
      };

      // Small Farm storm inflow never reached the old 10.0 m3/day threshold, so the full
      // transfer factor only ever applied to the larger profile. The flag makes it explicit.
      const ordinary = simulateTimeStep(6, volumes, noFlow, smallFarm.tankCapacities, false);
      const heavy = simulateTimeStep(6, volumes, noFlow, smallFarm.tankCapacities, true);

      // Need towards the 28.0 m3 target is 8.0 m3: half of it at 6h, all of it in a storm.
      expect(ordinary.blend).toBe(24.0);
      expect(heavy.blend).toBe(28.0);
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
        advanceParams({ currentDate: baseDate, hours: 6, currentVolumes: initialVolumes })
      );

      expect(result.date.toISOString()).toBe('2026-09-21T12:00:00.000Z');
      expect(result.weather).not.toBeNull();
      expect(result.flows.irrigationDemand).toBeGreaterThan(0);
    });

    it('integrates full 24h diurnal demand when advancing 24 hours even at night', () => {
      const nightDate = new Date('2026-09-21T22:00:00.000Z');
      const initialVolumes = {
        rainwater: 25.0,
        esa: 8.0,
        external: 10.0,
        blend: 26.0,
      };

      const result = advanceSimulation(
        advanceParams({ currentDate: nightDate, hours: 24, currentVolumes: initialVolumes })
      );

      // When advancing 24h, irrigationDemand in modulatedFlows is the full daily baseline flow rate
      expect(result.flows.irrigationDemand).toBe(smallBaseline.flows.irrigationDemand);
      expect(result.date.toISOString()).toBe('2026-09-22T22:00:00.000Z');
    });

    it('increases Blend tank volume during heavy storm replenishment', () => {
      const initialVolumes = {
        rainwater: 10.0,
        esa: 5.0,
        external: 5.0,
        blend: 15.0, // Below target 28.0 m³
      };

      const result = advanceSimulation(
        advanceParams({ currentVolumes: initialVolumes, scenario: 'storm' })
      );

      // In a heavy storm, rainwater catchment surges and transfers to Blend tank
      expect(result.volumes.blend).toBeGreaterThan(initialVolumes.blend);
    });

    it('decreases Blend tank volume during severe drought demand', () => {
      // Every source low, purchased water included: a farm still holding external supply
      // spends it before the Blend tank falls, which is a different scene from this one.
      const initialVolumes = {
        rainwater: 2.0,
        esa: 1.0,
        external: 1.5,
        blend: 20.0,
      };

      const result = advanceSimulation(
        advanceParams({ currentVolumes: initialVolumes, scenario: 'drought' })
      );

      // In drought, high irrigation demand outpaces available replenishment
      expect(result.volumes.blend).toBeLessThan(initialVolumes.blend);
    });
  });
  describe('Scenario Rainwater Catchment', () => {
    it('derives storm rainwater inflow from the scenario rainfall forecast', () => {
      const stormWeather = getScenarioWeather('storm');
      const expected = calculateCatchmentInflow(
        stormWeather!.precipitationForecast24hMm,
        smallFarm.catchmentAreaM2
      ).forecastInflowM3;

      const flows = getScenarioFlows('storm', smallBaseline.flows, smallFarm);
      expect(flows.rainwaterInflow).toBe(expected);
    });

    it('harvests more storm rainfall on the farm with the larger collection area', () => {
      const small = getScenarioFlows('storm', smallBaseline.flows, smallFarm);
      const medium = getScenarioFlows('storm', mediumBaseline.flows, mediumFarm);
      expect(medium.rainwaterInflow).toBeGreaterThan(small.rainwaterInflow);
    });

    it('yields no catchment inflow in the rainless drought scenario', () => {
      const flows = getScenarioFlows('drought', smallBaseline.flows, smallFarm);
      expect(flows.rainwaterInflow).toBe(0);
    });

    it('raises rainwater inflow above baseline when a storm step is advanced', () => {
      const result = advanceSimulation(advanceParams({ scenario: 'storm' }));
      expect(result.flows.rainwaterInflow).toBeGreaterThan(smallBaseline.flows.rainwaterInflow);
    });
  });

  describe('Operator Irrigation State Across a Simulation Step', () => {
    it('holds irrigation demand at zero while the operator has irrigation paused', () => {
      const result = advanceSimulation(advanceParams({ irrigationMode: 'paused' }));
      expect(result.flows.irrigationDemand).toBe(0);
    });

    it('keeps an advanced eco step below the same step in auto mode', () => {
      const auto = advanceSimulation(advanceParams({ irrigationMode: 'auto' }));
      const eco = advanceSimulation(advanceParams({ irrigationMode: 'eco' }));
      expect(eco.flows.irrigationDemand).toBeLessThan(auto.flows.irrigationDemand);
    });

    it('respects a paused operator inside a scenario step as well as a live one', () => {
      const result = advanceSimulation(
        advanceParams({ scenario: 'drought', irrigationMode: 'paused' })
      );
      expect(result.flows.irrigationDemand).toBe(0);
    });

    it('carries an unoptimized over-irrigation schedule through a full day step', () => {
      const unoptimized = getUnoptimizedBaselineTelemetry(smallFarm);
      const result = advanceSimulation(
        advanceParams({
          hours: 24,
          irrigationMode: unoptimized.irrigationMode,
          scheduledIrrigationDemand: unoptimized.scheduledIrrigationDemand,
        })
      );

      expect(result.flows.irrigationDemand).toBe(unoptimized.scheduledIrrigationDemand);
      expect(result.flows.irrigationDemand).toBeGreaterThan(
        smallBaseline.flows.irrigationDemand
      );
    });
  });
  describe('External Supply Replenishment', () => {
    it('draws on external supply once rainwater and ESA are at their reserve floors', () => {
      const capacities = smallFarm.tankCapacities;
      const volumes = {
        rainwater: capacities.rainwater * SOURCE_TANK_PUMP_RESERVE_RATIO,
        esa: capacities.esa * SOURCE_TANK_PUMP_RESERVE_RATIO,
        external: 15.0,
        blend: 12.0,
      };

      const result = simulateTimeStep(6, volumes, smallBaseline.flows, capacities);

      expect(result.external).toBeLessThan(volumes.external);
      expect(result.blend).toBeGreaterThan(
        volumes.blend -
          (smallBaseline.flows.irrigationDemand +
            smallBaseline.flows.humanUtilityDemand +
            smallBaseline.flows.livestockDemand) /
            4
      );
    });

    it('spends local sources before touching purchased external water', () => {
      const capacities = smallFarm.tankCapacities;
      const volumes = { rainwater: 30.0, esa: 8.0, external: 15.0, blend: 12.0 };

      const result = simulateTimeStep(6, volumes, smallBaseline.flows, capacities);

      expect(result.rainwater).toBeLessThan(volumes.rainwater);
      // The optimal configuration buys external water on a plan, so the tank may rise; what must
      // not happen is it being drawn down while local sources still have water to give.
      expect(result.external).toBeGreaterThanOrEqual(volumes.external);
    });

    it('holds external supply at its reserve floor rather than emptying the tank', () => {
      const capacities = smallFarm.tankCapacities;
      const volumes = { rainwater: 0, esa: 0, external: 18.0, blend: 0 };
      const thirstyFlows = {
        ...smallBaseline.flows,
        rainwaterInflow: 0,
        esaInflow: 0,
        externalInflow: 0,
      };

      const result = simulateTimeStep(24, volumes, thirstyFlows, capacities);

      expect(result.external).toBeGreaterThanOrEqual(
        capacities.external * SOURCE_TANK_PUMP_RESERVE_RATIO - 0.01
      );
    });

    /**
     * Runs the salinity scenario forward a whole number of days.
     *
     * @param days - Number of 24h steps to advance.
     * @returns Reservoir volumes after the run.
     */
    function runSalinityDays(days: number): TankVolumeMetrics {
      let volumes = getScenarioVolumes('salinity', smallFarm, smallBaseline.volumes);
      let date = new Date('2026-09-21T06:00:00.000Z');

      for (let day = 0; day < days; day += 1) {
        const step = advanceSimulation(
          advanceParams({
            currentDate: date,
            hours: 24,
            currentVolumes: volumes,
            scenario: 'salinity',
          })
        );
        volumes = step.volumes;
        date = step.date;
      }

      return volumes;
    }

    it('keeps the salinity scenario running on external supply instead of draining dry', () => {
      // Long enough that consumption alone would empty a Blend tank nothing replenishes:
      // 24.5 m³ of stored blend against 2.6 m³/day of demand runs out inside ten days.
      const volumes = runSalinityDays(12);
      expect(volumes.blend).toBeGreaterThan(smallFarm.tankCapacities.minOperatingVolume);
    });

    it('spends the external tank to hold the salinity Blend tank up', () => {
      const initial = getScenarioVolumes('salinity', smallFarm, smallBaseline.volumes);
      const volumes = runSalinityDays(12);

      // The water sustaining the Blend tank came out of external supply, which is what makes
      // the scenario a salinity scenario rather than a second drought.
      expect(volumes.external).toBeLessThan(initial.external);
    });
  });
  describe('Unoptimized Baseline as a Running State', () => {
    /**
     * Total daily inflow and consumption implied by a snapshot's flows.
     *
     * @param flows - Snapshot flow rates.
     * @returns Daily inflow and consumption totals in m³/day.
     */
    function waterBudget(flows: WaterFlowMetrics): { inflow: number; consumption: number } {
      return {
        inflow: flows.rainwaterInflow + flows.esaInflow + flows.externalInflow,
        consumption:
          flows.irrigationDemand + flows.humanUtilityDemand + flows.livestockDemand,
      };
    }

    for (const farm of [FARM_PROFILES['small-farm'], FARM_PROFILES['medium-farm']]) {
      describe(farm.id, () => {
        const unopt = getUnoptimizedBaselineTelemetry(farm);
        const min = farm.tankCapacities.minOperatingVolume;

        it('runs at a net water deficit rather than a hidden surplus', () => {
          // A farm whose inflows outrun its consumption recovers on its own, whatever its
          // starting volumes say. The deficit has to be what the operation produces.
          const { inflow, consumption } = waterBudget(unopt.flows!);
          expect(consumption).toBeGreaterThan(inflow);
        });

        it('cannot rescue its own Blend tank from stored source water', () => {
          // Every source at or below its reserve floor: the farm has already spent what it
          // bought, which is what the truck expense on the bill represents.
          const reserve = SOURCE_TANK_PUMP_RESERVE_RATIO;
          expect(unopt.volumes.rainwater).toBeLessThanOrEqual(
            farm.tankCapacities.rainwater * reserve
          );
          expect(unopt.volumes.esa).toBeLessThanOrEqual(farm.tankCapacities.esa * reserve);
          expect(unopt.volumes.external).toBeLessThanOrEqual(
            farm.tankCapacities.external * reserve
          );
        });

        it('deepens the Blend deficit on a 6 hour advance instead of erasing it', () => {
          const step = advanceSimulation({
            currentDate: new Date('2026-09-21T09:00:00.000Z'),
            hours: 6,
            currentVolumes: { ...unopt.volumes },
            currentFlows: { ...unopt.flows! },
            farm,
            scenario: 'live',
            irrigationMode: unopt.irrigationMode!,
            scheduledIrrigationDemand: unopt.scheduledIrrigationDemand!,
          });

          expect(step.volumes.blend).toBeLessThan(unopt.volumes.blend);
          expect(step.volumes.blend).toBeLessThan(min);
        });

        it('deepens the Blend deficit on a full day advance too', () => {
          const step = advanceSimulation({
            currentDate: new Date('2026-09-21T09:00:00.000Z'),
            hours: 24,
            currentVolumes: { ...unopt.volumes },
            currentFlows: { ...unopt.flows! },
            farm,
            scenario: 'live',
            irrigationMode: unopt.irrigationMode!,
            scheduledIrrigationDemand: unopt.scheduledIrrigationDemand!,
          });

          expect(step.volumes.blend).toBeLessThan(unopt.volumes.blend);
          expect(step.volumes.blend).toBeLessThan(min);
        });

        it('keeps stored water external-dominant, so the Blend runs saline', () => {
          // calculateBlendQuality weights the Blend by stored source volumes, so the salinity
          // trait survives only while external supply dominates that mix.
          const { rainwater, esa, external } = unopt.volumes;
          expect(external / (rainwater + esa + external)).toBeGreaterThan(0.7);

          // An unoptimized farm is living off emergency deliveries, which is the stressed supply.
          const unoptimizedQuality = calculateBlendQuality(unopt.volumes, 'stressed');
          const calibratedQuality = calculateBlendQuality(BASELINE_TELEMETRY[farm.id].volumes);
          expect(unoptimizedQuality.ec).toBeGreaterThan(calibratedQuality.ec * 2);
          expect(evaluateCropCompliance('vegetables', unoptimizedQuality).status).not.toBe('safe');
        });

        it('over-irrigates well beyond the profile calibration', () => {
          expect(unopt.scheduledIrrigationDemand!).toBeGreaterThan(
            BASELINE_TELEMETRY[farm.id].flows.irrigationDemand
          );
        });
      });
    }
  });
});

describe('Profile scale and derived optimal flows', () => {
  describe('kappa = 1/10 profile rescale (ADR 0004)', () => {
    it('holds cultivated area at one tenth of the prototype preset', () => {
      // Prototype Small sums to 1.84 ha and Medium to 4.6 ha (app.py:184-222).
      expect(FARM_PROFILES['small-farm'].areaHa).toBeCloseTo(1.84 * PROFILE_SCALE_FACTOR, 4);
      expect(FARM_PROFILES['medium-farm'].areaHa).toBeCloseTo(4.6 * PROFILE_SCALE_FACTOR, 4);
    });

    it('holds ESA nominal capacity at one tenth of the prototype esa_output', () => {
      // These were the quantities out of line: ESA previously sat at 0.22x, not 0.10x.
      expect(FARM_PROFILES['small-farm'].esaNominalCapacityM3PerDay).toBeCloseTo(
        5.5 * PROFILE_SCALE_FACTOR, 4
      );
      expect(FARM_PROFILES['medium-farm'].esaNominalCapacityM3PerDay).toBeCloseTo(
        15.8 * PROFILE_SCALE_FACTOR, 4
      );
    });

    it('leaves catchment area ungoverned by kappa, at about a fifth of the scaled plot', () => {
      for (const farm of [FARM_PROFILES['small-farm'], FARM_PROFILES['medium-farm']]) {
        const plotM2 = farm.areaHa * 10_000;
        expect(farm.catchmentAreaM2 / plotM2).toBeGreaterThan(0.15);
        expect(farm.catchmentAreaM2 / plotM2).toBeLessThan(0.25);
      }
    });
  });

  describe('optimal flows derived from the engines', () => {
    /** A snapshot may omit flows in general; the optimal parameters never do. */
    function requireOptimalFlows(farmId: 'small-farm' | 'medium-farm'): WaterFlowMetrics {
      const flows = OPTIMAL_FARM_PARAMETERS[farmId].flows;
      if (!flows) {
        throw new Error(`Optimal parameters for ${farmId} must declare flows.`);
      }
      return flows;
    }

    for (const farmId of ['small-farm', 'medium-farm'] as const) {
      const farm = FARM_PROFILES[farmId];
      const flows = requireOptimalFlows(farmId);

      it(`keeps ${farmId} ESA inflow below its nominal capacity`, () => {
        // The old hardcoded 1.4 and 3.2 m³/day exceeded even the pre-rescale nominals.
        expect(flows.esaInflow).toBeGreaterThan(0);
        expect(flows.esaInflow).toBeLessThan(farm.esaNominalCapacityM3PerDay);
      });

      it(`realises roughly 40% of ${farmId} nominal capacity, as dry Mediterranean air allows`, () => {
        const ambientYieldRatio = flows.esaInflow / farm.esaNominalCapacityM3PerDay;
        expect(ambientYieldRatio).toBeGreaterThan(0.3);
        expect(ambientYieldRatio).toBeLessThan(0.6);
      });

      it(`derives ${farmId} rainwater inflow from a plausible Mediterranean daily rainfall`, () => {
        // Inverting the catchment formula must land near the 1.3 mm/day regional mean, not the
        // 7.4 mm/day the previous hardcoded figure implied.
        const impliedDailyRainMm =
          (flows.rainwaterInflow * 1000) / (farm.catchmentAreaM2 * 0.855);
        expect(impliedDailyRainMm).toBeGreaterThan(0.8);
        expect(impliedDailyRainMm).toBeLessThan(2.0);
      });

      it(`reports the energy ${farmId} ESA production drew`, () => {
        expect(flows.esaEnergyKwhPerDay).toBeGreaterThan(0);
      });

      it(`keeps every ${farmId} shipped ESA inflow within installed capacity`, () => {
        // The guard against the defect that reopened this ticket. Written as literals, these
        // figures drifted past what the hardware can make: the baseline the app booted into
        // claimed 1.2 m³/day against a 0.55 m³/day nominal. Nothing may state an ESA inflow it
        // could not produce, in any of the three shipped states.
        const shipped = [
          ['baseline', BASELINE_TELEMETRY[farmId].flows.esaInflow],
          ['optimal', OPTIMAL_FARM_PARAMETERS[farmId].flows?.esaInflow],
          ['unoptimized', UNOPTIMIZED_BASELINES[farmId].flows?.esaInflow],
        ] as const;

        for (const [label, esaInflow] of shipped) {
          expect(esaInflow, `${label} ESA inflow`).toBeDefined();
          expect(esaInflow as number, `${label} ESA inflow`).toBeGreaterThanOrEqual(0);
          expect(esaInflow as number, `${label} ESA inflow`).toBeLessThanOrEqual(
            farm.esaNominalCapacityM3PerDay
          );
        }
      });

      it(`sizes the ${farmId} ESA tank against what the unit can actually make`, () => {
        // A tank holding months of production is a sign the capacity was never reconciled with
        // the physics; this one held six weeks before the kappa correction.
        const daysOfProduction = farm.tankCapacities.esa / flows.esaInflow;
        expect(daysOfProduction).toBeGreaterThan(3);
        expect(daysOfProduction).toBeLessThan(14);
      });

      it(`closes the ${farmId} balance with external supply rather than pretending to autonomy`, () => {
        const demand = flows.irrigationDemand + flows.humanUtilityDemand + flows.livestockDemand;
        const local = flows.rainwaterInflow + flows.esaInflow;

        // Local sources cover only part of demand at this scale, exactly as the prototype's own
        // presets do; the optimal configuration buys the remainder cheaply and plans for it.
        expect(local).toBeLessThan(demand);
        expect(flows.rainwaterInflow + flows.esaInflow + flows.externalInflow).toBeGreaterThan(demand);
      });
    }
  });
});
