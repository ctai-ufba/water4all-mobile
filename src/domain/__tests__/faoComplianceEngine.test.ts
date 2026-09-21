/**
 * @file faoComplianceEngine.test.ts
 * @summary Unit tests for the FAO Crop Compliance Evaluation Engine.
 * @description Verifies compliance evaluation thresholds, traffic light status,
 * limiting factors, agronomic guidance, and warning banner generation across
 * Olive trees, Vineyards, Vegetables, and Livestock under various water qualities.
 */

import { describe, it, expect } from 'vitest';
import {
  evaluateCropCompliance,
  generateFaoComplianceReport,
} from '../faoComplianceEngine';
import { WaterQualityMetrics } from '../../types/quality';

describe('FAO Compliance Engine Seam', () => {
  const cleanFreshwater: WaterQualityMetrics = {
    tds: 180.0,
    ph: 6.8,
    nitrates: 6.0,
    ec: 280.0,
  };

  const moderateSalinityWater: WaterQualityMetrics = {
    tds: 750.0,
    ph: 7.4,
    nitrates: 25.0,
    ec: 1150.0,
  };

  const highSalinityWater: WaterQualityMetrics = {
    tds: 1600.0,
    ph: 7.9,
    nitrates: 40.0,
    ec: 2500.0,
  };

  const severeToxicityWater: WaterQualityMetrics = {
    tds: 2800.0,
    ph: 9.2,
    nitrates: 120.0,
    ec: 4200.0,
  };

  describe('evaluateCropCompliance - Individual Uses', () => {
    describe('Vegetables (Sensitive Crop)', () => {
      it('evaluates as safe under fresh low-salinity water', () => {
        const evaluation = evaluateCropCompliance('vegetables', cleanFreshwater);

        expect(evaluation.status).toBe('safe');
        expect(evaluation.limitingFactor).toBeNull();
        expect(evaluation.parameters.ec.status).toBe('safe');
        expect(evaluation.parameters.nitrates.status).toBe('safe');
      });

      it('evaluates as caution when EC is between 700 and 1500 µS/cm', () => {
        const evaluation = evaluateCropCompliance('vegetables', moderateSalinityWater);

        expect(evaluation.status).toBe('caution');
        expect(evaluation.limitingFactor).toContain('EC');
        expect(evaluation.parameters.ec.status).toBe('caution');
      });

      it('evaluates as unsafe when EC exceeds 1500 µS/cm', () => {
        const evaluation = evaluateCropCompliance('vegetables', highSalinityWater);

        expect(evaluation.status).toBe('unsafe');
        expect(evaluation.limitingFactor).toContain('EC');
        expect(evaluation.guidance).toContain('risk');
      });
    });

    describe('Vineyards (Moderately Sensitive Crop)', () => {
      it('evaluates as safe under fresh water with EC <= 1000 µS/cm', () => {
        const evaluation = evaluateCropCompliance('vineyards', cleanFreshwater);

        expect(evaluation.status).toBe('safe');
        expect(evaluation.limitingFactor).toBeNull();
      });

      it('evaluates as caution when EC is between 1000 and 1800 µS/cm', () => {
        const evaluation = evaluateCropCompliance('vineyards', moderateSalinityWater);

        expect(evaluation.status).toBe('caution');
        expect(evaluation.limitingFactor).toContain('EC');
      });

      it('evaluates as unsafe when EC exceeds 1800 µS/cm', () => {
        const evaluation = evaluateCropCompliance('vineyards', highSalinityWater);

        expect(evaluation.status).toBe('unsafe');
        expect(evaluation.limitingFactor).toContain('EC');
      });
    });

    describe('Olive trees (Moderately Tolerant Crop)', () => {
      it('evaluates as safe under moderate salinity (EC <= 2000 µS/cm)', () => {
        const evaluation = evaluateCropCompliance('olive-trees', moderateSalinityWater);

        expect(evaluation.status).toBe('safe');
        expect(evaluation.limitingFactor).toBeNull();
      });

      it('evaluates as caution when EC is between 2000 and 3200 µS/cm', () => {
        const evaluation = evaluateCropCompliance('olive-trees', highSalinityWater);

        expect(evaluation.status).toBe('caution');
        expect(evaluation.limitingFactor).toContain('EC');
      });

      it('evaluates as unsafe when EC exceeds 3200 µS/cm', () => {
        const evaluation = evaluateCropCompliance('olive-trees', severeToxicityWater);

        expect(evaluation.status).toBe('unsafe');
        expect(evaluation.limitingFactor).toBeDefined();
      });
    });

    describe('Livestock (Animal Drinking)', () => {
      it('evaluates as safe when nitrates <= 50 mg/L and TDS <= 1000 mg/L', () => {
        const evaluation = evaluateCropCompliance('livestock', cleanFreshwater);

        expect(evaluation.status).toBe('safe');
        expect(evaluation.parameters.nitrates.status).toBe('safe');
      });

      it('evaluates as caution when nitrates are between 50 and 100 mg/L', () => {
        const cautionLivestockQuality: WaterQualityMetrics = {
          tds: 500.0,
          ph: 7.2,
          nitrates: 75.0,
          ec: 800.0,
        };
        const evaluation = evaluateCropCompliance('livestock', cautionLivestockQuality);

        expect(evaluation.status).toBe('caution');
        expect(evaluation.limitingFactor).toContain('Nitrates');
      });

      it('evaluates as unsafe when nitrates exceed 100 mg/L (toxicity threshold)', () => {
        const evaluation = evaluateCropCompliance('livestock', severeToxicityWater);

        expect(evaluation.status).toBe('unsafe');
        expect(evaluation.parameters.nitrates.status).toBe('unsafe');
        expect(evaluation.guidance.toLowerCase()).toContain('toxicity');
      });
    });

    describe('pH Extremes', () => {
      it('marks status as unsafe if pH is severely acidic (< 5.5)', () => {
        const acidicQuality: WaterQualityMetrics = {
          tds: 150.0,
          ph: 4.8,
          nitrates: 5.0,
          ec: 200.0,
        };
        const evaluation = evaluateCropCompliance('vegetables', acidicQuality);

        expect(evaluation.status).toBe('unsafe');
        expect(evaluation.limitingFactor).toContain('pH');
      });

      it('marks status as unsafe if pH is severely alkaline (> 8.8)', () => {
        const alkalineQuality: WaterQualityMetrics = {
          tds: 150.0,
          ph: 9.1,
          nitrates: 5.0,
          ec: 200.0,
        };
        const evaluation = evaluateCropCompliance('vegetables', alkalineQuality);

        expect(evaluation.status).toBe('unsafe');
        expect(evaluation.limitingFactor).toContain('pH');
      });
    });
  });

  describe('generateFaoComplianceReport', () => {
    it('generates an overall safe report when all uses comply', () => {
      const report = generateFaoComplianceReport(cleanFreshwater);

      expect(report.overallStatus).toBe('safe');
      expect(report.hasUnsafeCrop).toBe(false);
      expect(report.unsafeUses).toHaveLength(0);
      expect(report.warningBanner).toBeNull();
      expect(report.evaluations).toHaveLength(4);
    });

    it('generates a danger warning banner when high salinity threatens vegetables and vineyards', () => {
      const report = generateFaoComplianceReport(highSalinityWater);

      expect(report.overallStatus).toBe('unsafe');
      expect(report.hasUnsafeCrop).toBe(true);
      expect(report.unsafeUses).toContain('Vegetables');
      expect(report.unsafeUses).toContain('Vineyards');
      expect(report.warningBanner).not.toBeNull();
      expect(report.warningBanner?.severity).toBe('danger');
      expect(report.warningBanner?.title).toContain('Water Quality Alert');
      expect(report.warningBanner?.message).toContain('Vegetables');
    });

    it('generates a warning banner when only caution conditions exist', () => {
      const report = generateFaoComplianceReport(moderateSalinityWater);

      expect(report.overallStatus).toBe('caution');
      expect(report.hasUnsafeCrop).toBe(false);
      expect(report.cautionUses).toContain('Vegetables');
      expect(report.warningBanner).not.toBeNull();
      expect(report.warningBanner?.severity).toBe('warning');
    });
  });
});
