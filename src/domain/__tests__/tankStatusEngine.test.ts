/**
 * @file tankStatusEngine.test.ts
 * @summary Unit tests for tank status, capacity summation, and fill calculation engine.
 * @description Verifies storage capacity sums, fill level percentages, threshold alert
 * levels (normal, warning, critical/empty), and active source status indicators.
 */

import { describe, it, expect } from 'vitest';
import {
  calculateTotalStorageCapacity,
  calculateTankFillPercentage,
  getTankAlertLevel,
  getTankSourceStatus,
} from '../tankStatusEngine';
import { TankCapacities } from '../../types/farm';

describe('tankStatusEngine', () => {
  const mockCapacities: TankCapacities = {
    rainwater: 45.0,
    esa: 12.0,
    external: 20.0,
    blend: 35.0,
    targetVolume: 28.0,
    minOperatingVolume: 7.0,
  };

  describe('calculateTotalStorageCapacity', () => {
    it('sums capacities of all four tanks correctly', () => {
      // 45 + 12 + 20 + 35 = 112.0 m³
      const total = calculateTotalStorageCapacity(mockCapacities);
      expect(total).toBe(112.0);
    });

    it('handles zero capacities safely', () => {
      const emptyCapacities: TankCapacities = {
        rainwater: 0,
        esa: 0,
        external: 0,
        blend: 0,
        targetVolume: 0,
        minOperatingVolume: 0,
      };
      expect(calculateTotalStorageCapacity(emptyCapacities)).toBe(0);
    });
  });

  describe('calculateTankFillPercentage', () => {
    it('calculates standard fill percentage rounded to 1 decimal', () => {
      // 28.5 / 45.0 = 63.333... -> 63.3%
      expect(calculateTankFillPercentage(28.5, 45.0)).toBe(63.3);
    });

    it('clamps fill percentage to 0 when volume is negative or 0', () => {
      expect(calculateTankFillPercentage(0, 45.0)).toBe(0);
      expect(calculateTankFillPercentage(-5, 45.0)).toBe(0);
    });

    it('clamps fill percentage to 100 when volume exceeds capacity', () => {
      expect(calculateTankFillPercentage(50, 45.0)).toBe(100);
    });

    it('returns 0 if capacity is 0 to prevent division by zero', () => {
      expect(calculateTankFillPercentage(10, 0)).toBe(0);
    });
  });

  describe('getTankAlertLevel', () => {
    it('identifies critical status when volume is zero or depleted', () => {
      expect(getTankAlertLevel('rainwater', 0, 45.0)).toBe('critical');
      expect(getTankAlertLevel('esa', 0, 12.0)).toBe('critical');
      expect(getTankAlertLevel('external', -1, 20.0)).toBe('critical');
    });

    it('identifies critical status when volume is below 15% of capacity for source tanks', () => {
      // 15% of 45 is 6.75
      expect(getTankAlertLevel('rainwater', 6.0, 45.0)).toBe('critical');
      expect(getTankAlertLevel('esa', 1.5, 12.0)).toBe('critical');
    });

    it('identifies critical status for blend tank when below minOperatingVolume', () => {
      // Blend capacity 35, minOperatingVolume 7.0
      expect(getTankAlertLevel('blend', 6.5, 35.0, 7.0)).toBe('critical');
      expect(getTankAlertLevel('blend', 7.0, 35.0, 7.0)).not.toBe('critical');
    });

    it('identifies warning status when volume is between 15% and 30% of capacity', () => {
      // 20% of 45 is 9.0
      expect(getTankAlertLevel('rainwater', 9.0, 45.0)).toBe('warning');
    });

    it('identifies normal status when volume is at or above 30% of capacity', () => {
      // 50% of 45 is 22.5
      expect(getTankAlertLevel('rainwater', 22.5, 45.0)).toBe('normal');
      expect(getTankAlertLevel('blend', 25.0, 35.0, 7.0)).toBe('normal');
    });
  });

  describe('getTankSourceStatus', () => {
    it('formats Rainwater tank status when capturing rain vs standby', () => {
      const active = getTankSourceStatus('rainwater', 2.4, 28.5);
      expect(active.statusText).toBe('Capturing Rain');
      expect(active.isActive).toBe(true);
      expect(active.description).toContain('+2.4 m³/day');

      const idle = getTankSourceStatus('rainwater', 0, 28.5);
      expect(idle.statusText).toBe('Standby (No Rain)');
      expect(idle.isActive).toBe(false);

      const empty = getTankSourceStatus('rainwater', 0, 0);
      expect(empty.statusText).toBe('Depleted (Empty)');
      expect(empty.badgeVariant).toBe('rose');

      // Empty tank actively capturing rain should show active status
      const emptyCapturing = getTankSourceStatus('rainwater', 3.0, 0);
      expect(emptyCapturing.statusText).toBe('Capturing Rain');
      expect(emptyCapturing.isActive).toBe(true);
      expect(emptyCapturing.description).toContain('filling depleted tank');
    });

    it('formats ESA tank status when generating water vs idle', () => {
      const active = getTankSourceStatus('esa', 1.2, 8.2);
      expect(active.statusText).toBe('Generating Water');
      expect(active.isActive).toBe(true);
      expect(active.description).toContain('+1.2 m³/day');

      const idle = getTankSourceStatus('esa', 0, 8.2);
      expect(idle.statusText).toBe('Standby (Generator Idle)');
      expect(idle.isActive).toBe(false);
    });

    it('formats External supply tank status when receiving delivery vs holding', () => {
      const active = getTankSourceStatus('external', 5.0, 14.0);
      expect(active.statusText).toBe('Receiving Delivery');
      expect(active.isActive).toBe(true);
      expect(active.description).toContain('+5.0 m³/day');

      const idle = getTankSourceStatus('external', 0, 14.0);
      expect(idle.statusText).toBe('Holding Reserve');
      expect(idle.isActive).toBe(false);
    });

    it('formats Blend tank status when distributing water vs idle', () => {
      const active = getTankSourceStatus('blend', 2.6, 26.5);
      expect(active.statusText).toBe('Distributing Water');
      expect(active.isActive).toBe(true);
      expect(active.description).toContain('-2.6 m³/day');

      const idle = getTankSourceStatus('blend', 0, 26.5);
      expect(idle.statusText).toBe('Holding Blend');
      expect(idle.isActive).toBe(false);
    });
  });
});

