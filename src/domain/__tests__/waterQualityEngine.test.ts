/**
 * @file waterQualityEngine.test.ts
 * @summary Unit tests for the Water Quality mixing and formatting engine.
 * @description Verifies linear volumetric mixing of TDS, Nitrates, and EC,
 * logarithmic molar H+ ion blending for pH, and edge-case behaviors.
 */

import { describe, it, expect } from 'vitest';
import {
  calculateBlendQuality,
  formatQualityMetric,
  getNominalRangeDescription,
  evaluateFreshwaterMetricStatus,
} from '../waterQualityEngine';
import { TankVolumeMetrics } from '../../types/telemetry';
import { SOURCE_WATER_QUALITIES } from '../../types/quality';
import { evaluateCropCompliance } from '../faoComplianceEngine';

describe('Water Quality Engine Seam', () => {
  describe('calculateBlendQuality', () => {
    it('returns default clean baseline quality when all source volumes are zero', () => {
      const emptyVolumes: TankVolumeMetrics = {
        rainwater: 0,
        esa: 0,
        external: 0,
        blend: 0,
      };

      const result = calculateBlendQuality(emptyVolumes);

      expect(result.tds).toBeGreaterThan(0);
      expect(result.ph).toBeCloseTo(7.0, 1);
      expect(result.nitrates).toBeGreaterThanOrEqual(0);
      expect(result.ec).toBeGreaterThan(0);
    });

    it('matches 100% rainwater quality when only rainwater is present', () => {
      const rainwaterOnly: TankVolumeMetrics = {
        rainwater: 40,
        esa: 0,
        external: 0,
        blend: 20,
      };

      const result = calculateBlendQuality(rainwaterOnly);

      expect(result.tds).toBeCloseTo(SOURCE_WATER_QUALITIES.rainwater.tds, 1);
      expect(result.ph).toBeCloseTo(SOURCE_WATER_QUALITIES.rainwater.ph, 1);
      expect(result.nitrates).toBeCloseTo(SOURCE_WATER_QUALITIES.rainwater.nitrates, 1);
      expect(result.ec).toBeCloseTo(SOURCE_WATER_QUALITIES.rainwater.ec, 1);
    });

    it('matches 100% ESA quality when only ESA water is present', () => {
      const esaOnly: TankVolumeMetrics = {
        rainwater: 0,
        esa: 25,
        external: 0,
        blend: 15,
      };

      const result = calculateBlendQuality(esaOnly);

      expect(result.tds).toBeCloseTo(SOURCE_WATER_QUALITIES.esa.tds, 1);
      expect(result.ph).toBeCloseTo(SOURCE_WATER_QUALITIES.esa.ph, 1);
      expect(result.nitrates).toBeCloseTo(SOURCE_WATER_QUALITIES.esa.nitrates, 1);
      expect(result.ec).toBeCloseTo(SOURCE_WATER_QUALITIES.esa.ec, 1);
    });

    it('matches 100% external supply quality when only external water is present', () => {
      const externalOnly: TankVolumeMetrics = {
        rainwater: 0,
        esa: 0,
        external: 50,
        blend: 30,
      };

      const result = calculateBlendQuality(externalOnly);

      expect(result.tds).toBeCloseTo(SOURCE_WATER_QUALITIES.external.tds, 1);
      expect(result.ph).toBeCloseTo(SOURCE_WATER_QUALITIES.external.ph, 1);
      expect(result.nitrates).toBeCloseTo(SOURCE_WATER_QUALITIES.external.nitrates, 1);
      expect(result.ec).toBeCloseTo(SOURCE_WATER_QUALITIES.external.ec, 1);
    });

    it('computes proportional linear mixing for TDS, Nitrates, and EC in mixed volumes', () => {
      // 50% Rainwater (tds=80, ec=100, nitrates=4.0) + 50% External (tds=450, ec=720, nitrates=18.0)
      const mixedVolumes: TankVolumeMetrics = {
        rainwater: 20,
        esa: 0,
        external: 20,
        blend: 30,
      };

      const result = calculateBlendQuality(mixedVolumes);

      // Expected TDS = (80 * 20 + 450 * 20) / 40 = 265 mg/L
      expect(result.tds).toBeCloseTo(265.0, 1);
      // Expected Nitrates = (4.0 * 20 + 18.0 * 20) / 40 = 11.0 mg/L
      expect(result.nitrates).toBeCloseTo(11.0, 1);
      // Expected EC = (100 * 20 + 720 * 20) / 40 = 410 µS/cm
      expect(result.ec).toBeCloseTo(410.0, 1);
    });

    it('computes correct logarithmic molar H+ ion pH blending', () => {
      // 50% Rainwater (pH 5.8 => [H+] = 10^-5.8 = 1.5849e-6)
      // 50% ESA (pH 7.0 => [H+] = 10^-7.0 = 1.0e-7)
      // Mixed [H+] = 0.5 * 1.5849e-6 + 0.5 * 1.0e-7 = 7.924e-7 + 0.5e-7 = 8.424e-7
      // Expected pH = -log10(8.424e-7) = 6.074
      const mixedVolumes: TankVolumeMetrics = {
        rainwater: 10,
        esa: 10,
        external: 0,
        blend: 15,
      };

      const result = calculateBlendQuality(mixedVolumes);

      expect(result.ph).toBeCloseTo(6.07, 1);
    });
  });

  describe('formatQualityMetric', () => {
    it('formats TDS as integer with mg/L unit', () => {
      expect(formatQualityMetric('tds', 245.7)).toBe('246 mg/L');
    });

    it('formats pH with one decimal place', () => {
      expect(formatQualityMetric('ph', 6.84)).toBe('6.8');
    });

    it('formats Nitrates with one decimal place and mg/L unit', () => {
      expect(formatQualityMetric('nitrates', 12.38)).toBe('12.4 mg/L');
    });

    it('formats EC as integer with µS/cm unit', () => {
      expect(formatQualityMetric('ec', 420.2)).toBe('420 µS/cm');
    });
  });

  describe('getNominalRangeDescription', () => {
    it('provides standard nominal range strings for all four parameters', () => {
      expect(getNominalRangeDescription('tds')).toContain('mg/L');
      expect(getNominalRangeDescription('ph')).toContain('5.5');
      expect(getNominalRangeDescription('nitrates')).toContain('mg/L');
      expect(getNominalRangeDescription('ec')).toContain('µS/cm');
    });
  });

  describe('evaluateFreshwaterMetricStatus', () => {
    it('evaluates safe, caution, and unsafe levels for EC', () => {
      expect(evaluateFreshwaterMetricStatus('ec', 450)).toBe('safe');
      expect(evaluateFreshwaterMetricStatus('ec', 1200)).toBe('caution');
      expect(evaluateFreshwaterMetricStatus('ec', 2200)).toBe('unsafe');
    });

    it('evaluates safe, caution, and unsafe levels for TDS', () => {
      expect(evaluateFreshwaterMetricStatus('tds', 300)).toBe('safe');
      expect(evaluateFreshwaterMetricStatus('tds', 750)).toBe('caution');
      expect(evaluateFreshwaterMetricStatus('tds', 1400)).toBe('unsafe');
    });

    it('evaluates safe, caution, and unsafe levels for pH', () => {
      expect(evaluateFreshwaterMetricStatus('ph', 7.2)).toBe('safe');
      // 5.8 is ordinary rainwater, and sits inside the prototype's 5.5 irrigation floor.
      expect(evaluateFreshwaterMetricStatus('ph', 5.8)).toBe('safe');
      expect(evaluateFreshwaterMetricStatus('ph', 5.2)).toBe('caution');
      expect(evaluateFreshwaterMetricStatus('ph', 9.2)).toBe('unsafe');
    });

    it('evaluates safe, caution, and unsafe levels for Nitrates', () => {
      expect(evaluateFreshwaterMetricStatus('nitrates', 15)).toBe('safe');
      expect(evaluateFreshwaterMetricStatus('nitrates', 45)).toBe('caution');
      expect(evaluateFreshwaterMetricStatus('nitrates', 80)).toBe('unsafe');
    });
  });
});

describe('Water Quality Regimes (prototipo_water4all presets)', () => {
  const salinityVolumes = { rainwater: 1.0, esa: 0.5, external: 18.0, blend: 24.5 };
  const unoptimizedVolumes = { rainwater: 0.3, esa: 0.2, external: 2.0, blend: 5.5 };
  const optimizedVolumes = { rainwater: 36.0, esa: 9.6, external: 5.0, blend: 28.0 };

  it('defaults to the balanced supply the calibrated farm draws on', () => {
    const balanced = calculateBlendQuality(salinityVolumes);
    const explicit = calculateBlendQuality(salinityVolumes, 'balanced');
    expect(balanced).toEqual(explicit);
  });

  it('raises salinity under the stressed supply', () => {
    const balanced = calculateBlendQuality(salinityVolumes, 'balanced');
    const stressed = calculateBlendQuality(salinityVolumes, 'stressed');

    expect(stressed.ec).toBeGreaterThan(balanced.ec);
    expect(stressed.tds).toBeGreaterThan(balanced.tds);
  });

  it('breaches the sensitive-crop thresholds the balanced supply cannot reach', () => {
    const stressed = calculateBlendQuality(salinityVolumes, 'stressed');

    expect(evaluateFreshwaterMetricStatus('ec', stressed.ec)).not.toBe('safe');
    expect(evaluateFreshwaterMetricStatus('tds', stressed.tds)).not.toBe('safe');
    expect(evaluateCropCompliance('vegetables', stressed).status).not.toBe('safe');
  });

  it('fails crop compliance for the unoptimized farm leaning on that supply', () => {
    const stressed = calculateBlendQuality(unoptimizedVolumes, 'stressed');
    expect(evaluateCropCompliance('vegetables', stressed).status).not.toBe('safe');
  });

  it('leaves salt-tolerant olives unaffected, which is what the matrix is for', () => {
    const stressed = calculateBlendQuality(salinityVolumes, 'stressed');
    expect(evaluateCropCompliance('olive-trees', stressed).status).toBe('safe');
  });

  it('keeps the optimized design compliant on every use', () => {
    // Its Blend runs on rainwater, whose pH sits near 5.9. The prototype's irrigation floor is
    // 5.5, so a rainwater-fed farm is compliant; a stricter floor would penalise the design
    // precisely for maximising sustainable local water.
    const quality = calculateBlendQuality(optimizedVolumes);
    expect(quality.ph).toBeGreaterThan(5.5);
    expect(quality.ph).toBeLessThan(6.0);

    for (const use of ['vegetables', 'vineyards', 'olive-trees', 'livestock'] as const) {
      expect(evaluateCropCompliance(use, quality).status).toBe('safe');
    }
  });
});
