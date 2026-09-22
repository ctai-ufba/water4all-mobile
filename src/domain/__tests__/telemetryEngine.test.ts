/**
 * @file telemetryEngine.test.ts
 * @summary Unit tests for domain telemetry calculation functions.
 * @description Verifies water autonomy calculations, balance calculations,
 * water efficiency and cost savings formulas, threshold breach warnings,
 * and baseline generation for Mediterranean farm profiles.
 */

import { describe, it, expect } from 'vitest';
import {
  calculateTotalStored,
  calculateTotalInflow,
  calculateTotalConsumption,
  calculateWaterAutonomy,
  calculateDailyBalance,
  calculateWaterEfficiency,
  checkBlendOperatingVolume,
  getBaselineTelemetry,
  INDEFINITE_AUTONOMY_DAYS,
} from '../telemetryEngine';
import { FARM_PROFILES } from '../../types/farm';
import {
  TankVolumeMetrics,
  WaterFlowMetrics,
  EXTERNAL_WATER_TRUCK_COST_EUR_PER_M3,
} from '../../types/telemetry';

describe('Telemetry Domain Engine Seam', () => {
  describe('calculateTotalStored', () => {
    it('sums volumes across all four reservoirs (rainwater, esa, external, blend)', () => {
      const volumes: TankVolumeMetrics = {
        rainwater: 25.5,
        esa: 8.0,
        external: 15.0,
        blend: 22.5,
      };
      // 25.5 + 8.0 + 15.0 + 22.5 = 71.0
      expect(calculateTotalStored(volumes)).toBeCloseTo(71.0, 2);
    });

    it('handles zero stored volumes gracefully', () => {
      const volumes: TankVolumeMetrics = {
        rainwater: 0,
        esa: 0,
        external: 0,
        blend: 0,
      };
      expect(calculateTotalStored(volumes)).toBe(0);
    });
  });

  describe('calculateTotalInflow', () => {
    it('sums rainwater, esa, and external inflows', () => {
      const flows: WaterFlowMetrics = {
        rainwaterInflow: 2.4,
        esaInflow: 1.2,
        externalInflow: 0.5,
        irrigationDemand: 2.0,
        humanUtilityDemand: 0.5,
        livestockDemand: 0.0,
      };
      // 2.4 + 1.2 + 0.5 = 4.1
      expect(calculateTotalInflow(flows)).toBeCloseTo(4.1, 2);
    });
  });

  describe('calculateTotalConsumption', () => {
    it('sums irrigation, human/utility, and livestock demands', () => {
      const flows: WaterFlowMetrics = {
        rainwaterInflow: 0,
        esaInflow: 0,
        externalInflow: 0,
        irrigationDemand: 5.5,
        humanUtilityDemand: 0.8,
        livestockDemand: 1.4,
      };
      // 5.5 + 0.8 + 1.4 = 7.7
      expect(calculateTotalConsumption(flows)).toBeCloseTo(7.7, 2);
    });
  });

  describe('calculateWaterAutonomy', () => {
    it('calculates days remaining as stored volume divided by daily consumption', () => {
      // 60 m³ stored / 3 m³/day = 20 days
      expect(calculateWaterAutonomy(60, 3)).toBe(20.0);
      // 77.2 m³ stored / 2.6 m³/day = 29.69... -> 29.7 days
      expect(calculateWaterAutonomy(77.2, 2.6)).toBe(29.7);
    });

    it('returns INDEFINITE_AUTONOMY_DAYS (999) when daily consumption is zero or negative', () => {
      expect(calculateWaterAutonomy(50, 0)).toBe(INDEFINITE_AUTONOMY_DAYS);
      expect(calculateWaterAutonomy(50, -1)).toBe(INDEFINITE_AUTONOMY_DAYS);
    });

    it('returns 0 days when stored volume is zero', () => {
      expect(calculateWaterAutonomy(0, 5)).toBe(0);
    });
  });

  describe('calculateDailyBalance', () => {
    it('identifies water surplus when inflow exceeds consumption', () => {
      const result = calculateDailyBalance(4.5, 3.0);
      expect(result.netBalance).toBeCloseTo(1.5, 2);
      expect(result.isSurplus).toBe(true);
    });

    it('identifies water deficit when consumption exceeds inflow', () => {
      const result = calculateDailyBalance(2.0, 3.5);
      expect(result.netBalance).toBeCloseTo(-1.5, 2);
      expect(result.isSurplus).toBe(false);
    });

    it('treats zero net balance as surplus / balanced', () => {
      const result = calculateDailyBalance(3.0, 3.0);
      expect(result.netBalance).toBe(0);
      expect(result.isSurplus).toBe(true);
    });
  });

  describe('calculateWaterEfficiency', () => {
    it('computes the share of demand met by local sources', () => {
      const result = calculateWaterEfficiency({ localInflow: 2.0, totalDemand: 4.0 });
      expect(result.localPercentage).toBe(50);
    });

    it('caps local percentage at 100% when local inflow exceeds demand', () => {
      expect(calculateWaterEfficiency({ localInflow: 5.0, totalDemand: 2.5 }).localPercentage).toBe(100);
    });

    it('credits avoided truck purchases only for water that actually replaced demand', () => {
      // Local inflow 5.0 m3/day against 2.5 m3/day of demand: only 2.5 m3 displaces a purchase.
      // 2.5 m3 * 4.50 EUR/m3 = 11.25 EUR
      const result = calculateWaterEfficiency({ localInflow: 5.0, totalDemand: 2.5 });
      expect(result.avoidedTruckCostEur).toBeCloseTo(11.25, 2);
    });

    it('charges ESA production for the electricity it draws', () => {
      // 0.2 m3/day of ESA water at the bench specific energy of 4640 kWh/m3 draws 928 kWh/day,
      // which at 0.17 EUR/kWh costs 157.76 EUR/day.
      const result = calculateWaterEfficiency({
        localInflow: 3.0,
        totalDemand: 3.0,
        esaInflow: 0.2,
      });

      expect(result.avoidedTruckCostEur).toBeCloseTo(13.5, 2);
      expect(result.esaEnergyCostEur).toBeCloseTo(157.76, 2);
    });

    it('reports net savings as avoided purchases less the energy drawn', () => {
      const result = calculateWaterEfficiency({
        localInflow: 3.0,
        totalDemand: 3.0,
        esaInflow: 0.2,
      });

      // ESA water is the most expensive water on the farm, so crediting it at the truck price
      // with no production cost presented a large loss as a saving.
      expect(result.dailySavingsEur).toBeCloseTo(13.5 - 157.76, 2);
      expect(result.dailySavingsEur).toBeLessThan(0);
    });

    it('prefers a simulated energy draw over the bench specific energy when one is supplied', () => {
      // The ESA engine reports the energy its cycles actually drew; 1474.76 kWh/day at
      // 0.17 EUR/kWh is 250.71 EUR/day, well above the bench-derived estimate.
      const result = calculateWaterEfficiency({
        localInflow: 3.0,
        totalDemand: 3.0,
        esaInflow: 0.2,
        esaEnergyKwhPerDay: 1474.76,
      });

      expect(result.esaEnergyCostEur).toBeCloseTo(250.71, 2);
      expect(result.dailySavingsEur).toBeCloseTo(13.5 - 250.71, 2);
    });

    it('charges nothing for energy when the farm runs no ESA production', () => {
      const result = calculateWaterEfficiency({
        localInflow: 3.0,
        totalDemand: 3.0,
        esaInflow: 0,
        costPerM3: EXTERNAL_WATER_TRUCK_COST_EUR_PER_M3,
      });

      expect(result.esaEnergyCostEur).toBe(0);
      expect(result.dailySavingsEur).toBeCloseTo(13.5, 2);
    });

    it('handles zero demand with positive local inflow yielding 100% and no avoided cost', () => {
      const result = calculateWaterEfficiency({ localInflow: 1.0, totalDemand: 0 });
      expect(result.localPercentage).toBe(100);
      expect(result.avoidedTruckCostEur).toBe(0);
    });

    it('handles zero demand with zero local inflow yielding 0% and no avoided cost', () => {
      const result = calculateWaterEfficiency({ localInflow: 0, totalDemand: 0 });
      expect(result.localPercentage).toBe(0);
      expect(result.avoidedTruckCostEur).toBe(0);
      expect(result.dailySavingsEur).toBe(0);
    });
  });

  describe('checkBlendOperatingVolume', () => {
    it('flags breach when volume is strictly below minimum operating volume', () => {
      // Min is 7.0 m³, current is 5.2 m³ -> breached, deficit = 1.8 m³
      const result = checkBlendOperatingVolume(5.2, 7.0);
      expect(result.isBreached).toBe(true);
      expect(result.deficitM3).toBeCloseTo(1.8, 2);
    });

    it('does not flag breach when volume is at or above minimum operating volume', () => {
      const resultAt = checkBlendOperatingVolume(7.0, 7.0);
      expect(resultAt.isBreached).toBe(false);
      expect(resultAt.deficitM3).toBe(0);

      const resultAbove = checkBlendOperatingVolume(15.0, 7.0);
      expect(resultAbove.isBreached).toBe(false);
      expect(resultAbove.deficitM3).toBe(0);
    });
  });

  describe('getBaselineTelemetry', () => {
    it('initializes baseline telemetry for Small Farm (Antequera)', () => {
      const smallFarm = FARM_PROFILES['small-farm'];
      const telemetry = getBaselineTelemetry(smallFarm);

      expect(telemetry.tankVolumes.blend).toBeGreaterThan(smallFarm.tankCapacities.minOperatingVolume);
      expect(telemetry.isBelowMinOperatingVolume).toBe(false);
      expect(telemetry.waterAutonomyDays).toBeGreaterThan(15);
      expect(telemetry.isSurplus).toBe(true);
      expect(telemetry.localWaterPercentage).toBeGreaterThan(0);
      expect(telemetry.avoidedTruckCostEur).toBeGreaterThan(0);
      // Net savings run negative because ESA electricity outweighs the truck water it displaces.
      // The card reports all three lines so the loss is attributable rather than mysterious.
      expect(telemetry.esaEnergyCostEur).toBeGreaterThan(telemetry.avoidedTruckCostEur);
      expect(telemetry.dailySavingsEur).toBeLessThan(0);
    });

    it('initializes baseline telemetry for Medium Farm (Heraklion)', () => {
      const mediumFarm = FARM_PROFILES['medium-farm'];
      const telemetry = getBaselineTelemetry(mediumFarm);

      expect(telemetry.tankVolumes.blend).toBeGreaterThan(mediumFarm.tankCapacities.minOperatingVolume);
      expect(telemetry.isBelowMinOperatingVolume).toBe(false);
      expect(telemetry.waterAutonomyDays).toBeGreaterThan(15);
      expect(telemetry.flows.livestockDemand).toBeGreaterThan(0);
    });
  });
});

