/**
 * @file supervisoryEngine.test.ts
 * @summary Unit tests for supervisory control actions engine.
 * @description Verifies calculations and validations for external water truck deliveries,
 * irrigation mode demand scaling, and manual pump transfers with strict mass balance.
 */

import { describe, it, expect } from 'vitest';
import {
  calculateTruckDelivery,
  calculateIrrigationDemand,
  validateAndExecutePumpTransfer,
} from '../supervisoryEngine';
import { TankVolumeMetrics } from '../../types/telemetry';

describe('supervisoryEngine', () => {
  describe('calculateTruckDelivery', () => {
    it('calculates standard +10 m³ delivery within capacity', () => {
      // Current: 5.0 m³, Capacity: 20.0 m³
      const result = calculateTruckDelivery(5.0, 20.0, 10);
      expect(result.deliveredM3).toBe(10);
      expect(result.newVolumeM3).toBe(15.0);
      expect(result.addedCostEur).toBe(45.0); // 10 * 4.50
      expect(result.isCapped).toBe(false);
    });

    it('calculates standard +25 m³ delivery within capacity', () => {
      // Current: 20.0 m³, Capacity: 60.0 m³
      const result = calculateTruckDelivery(20.0, 60.0, 25);
      expect(result.deliveredM3).toBe(25);
      expect(result.newVolumeM3).toBe(45.0);
      expect(result.addedCostEur).toBe(112.5); // 25 * 4.50
      expect(result.isCapped).toBe(false);
    });

    it('caps delivered volume when tank capacity would be exceeded', () => {
      // Current: 15.0 m³, Capacity: 20.0 m³, Request: +10 m³
      // Available space: 5.0 m³
      const result = calculateTruckDelivery(15.0, 20.0, 10);
      expect(result.deliveredM3).toBe(5.0);
      expect(result.newVolumeM3).toBe(20.0);
      expect(result.addedCostEur).toBe(45.0); // Billed for the 10 m³ order
      expect(result.isCapped).toBe(true);
    });

    it('handles already full tank safely', () => {
      const result = calculateTruckDelivery(20.0, 20.0, 10);
      expect(result.deliveredM3).toBe(0);
      expect(result.newVolumeM3).toBe(20.0);
      expect(result.isCapped).toBe(true);
    });
  });

  describe('calculateIrrigationDemand', () => {
    const baselineDemand = 2.5;

    it('returns full baseline demand in Auto mode', () => {
      const demand = calculateIrrigationDemand(baselineDemand, 'auto');
      expect(demand).toBe(2.5);
    });

    it('scales demand to 60% in Eco mode (deficit irrigation)', () => {
      // 2.5 * 0.6 = 1.5
      const demand = calculateIrrigationDemand(baselineDemand, 'eco');
      expect(demand).toBe(1.5);
    });

    it('returns 0 in Paused mode', () => {
      const demand = calculateIrrigationDemand(baselineDemand, 'paused');
      expect(demand).toBe(0);
    });
  });

  describe('validateAndExecutePumpTransfer', () => {
    const initialVolumes: TankVolumeMetrics = {
      rainwater: 20.0,
      esa: 8.0,
      external: 10.0,
      blend: 25.0,
    };

    const capacities = {
      rainwater: 45.0,
      esa: 12.0,
      external: 20.0,
      blend: 35.0,
    };

    it('successfully transfers water from Rainwater to Blend tank with mass balance', () => {
      const result = validateAndExecutePumpTransfer({
        fromTank: 'rainwater',
        volumeM3: 3.0,
        currentVolumes: initialVolumes,
        capacities,
      });

      expect(result.success).toBe(true);
      expect(result.transferredM3).toBe(3.0);
      expect(result.updatedVolumes.rainwater).toBe(17.0); // 20.0 - 3.0
      expect(result.updatedVolumes.blend).toBe(28.0); // 25.0 + 3.0
      expect(result.updatedVolumes.esa).toBe(8.0); // Unchanged
      expect(result.updatedVolumes.external).toBe(10.0); // Unchanged

      // Strict volume conservation: total stored water remains identical
      const initialTotal = initialVolumes.rainwater + initialVolumes.blend;
      const updatedTotal = result.updatedVolumes.rainwater + result.updatedVolumes.blend;
      expect(updatedTotal).toBe(initialTotal);
    });

    it('successfully transfers water from ESA to Blend tank', () => {
      const result = validateAndExecutePumpTransfer({
        fromTank: 'esa',
        volumeM3: 2.5,
        currentVolumes: initialVolumes,
        capacities,
      });

      expect(result.success).toBe(true);
      expect(result.transferredM3).toBe(2.5);
      expect(result.updatedVolumes.esa).toBe(5.5); // 8.0 - 2.5
      expect(result.updatedVolumes.blend).toBe(27.5); // 25.0 + 2.5
      expect(result.updatedVolumes.rainwater).toBe(20.0); // Unchanged
    });

    it('rejects transfer when volume is zero or negative', () => {
      const zeroResult = validateAndExecutePumpTransfer({
        fromTank: 'rainwater',
        volumeM3: 0,
        currentVolumes: initialVolumes,
        capacities,
      });
      expect(zeroResult.success).toBe(false);
      expect(zeroResult.errorMessage).toContain('greater than 0');

      const negativeResult = validateAndExecutePumpTransfer({
        fromTank: 'rainwater',
        volumeM3: -2,
        currentVolumes: initialVolumes,
        capacities,
      });
      expect(negativeResult.success).toBe(false);
    });

    it('rejects transfer when source tank has insufficient volume', () => {
      const result = validateAndExecutePumpTransfer({
        fromTank: 'esa',
        volumeM3: 10.0, // ESA only has 8.0 m³
        currentVolumes: initialVolumes,
        capacities,
      });

      expect(result.success).toBe(false);
      expect(result.transferredM3).toBe(0);
      expect(result.errorMessage).toContain('Insufficient volume in source tank');
      expect(result.updatedVolumes).toEqual(initialVolumes);
    });

    it('rejects transfer when Blend tank would overflow', () => {
      // Blend current is 25.0 m³, capacity is 35.0 m³ (headroom is 10.0 m³)
      const lowHeadroomVolumes: TankVolumeMetrics = {
        ...initialVolumes,
        blend: 33.0, // only 2.0 m³ headroom
      };

      const result = validateAndExecutePumpTransfer({
        fromTank: 'rainwater',
        volumeM3: 5.0, // 5.0 > 2.0 headroom
        currentVolumes: lowHeadroomVolumes,
        capacities,
      });

      expect(result.success).toBe(false);
      expect(result.transferredM3).toBe(0);
      expect(result.errorMessage).toContain('exceed Blend tank capacity');
      expect(result.updatedVolumes).toEqual(lowHeadroomVolumes);
    });
  });
});

