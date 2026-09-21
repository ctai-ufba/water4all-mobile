/**
 * @file waterQualityEngine.ts
 * @summary Water quality calculation and volumetric mixing engine.
 * @description Computes composite physical and chemical water quality parameters
 * (TDS, pH, Nitrates, and EC) for the central Blend tank based on volumetric
 * mass-balance mixing and logarithmic molar hydrogen ion (H+) blending.
 */

import { TankVolumeMetrics } from '../types/telemetry';
import { WaterQualityMetrics, SOURCE_WATER_QUALITIES } from '../types/quality';

/**
 * Converts a pH value to its corresponding hydrogen ion molar concentration [mol/L].
 *
 * @summary pH to H+ concentration.
 * @description Uses the standard chemical relationship [H+] = 10^(-pH) so that
 * fluid mixing can be computed on a conservative linear quantity.
 *
 * @param ph - pH level (dimensionless scale 0-14).
 * @returns Hydrogen ion concentration in mol/L.
 * @throws Never throws.
 */
export function phToHydrogenIonConcentration(ph: number): number {
  return Math.pow(10, -ph);
}

/**
 * Converts a hydrogen ion molar concentration [mol/L] back to pH.
 *
 * @summary H+ concentration to pH.
 * @description Uses the logarithmic formula pH = -log10([H+]), clamped to [0, 14].
 *
 * @param hPlus - Hydrogen ion concentration in mol/L.
 * @returns pH level (0 to 14).
 * @throws Never throws.
 */
export function hydrogenIonConcentrationToPh(hPlus: number): number {
  if (hPlus <= 0) {
    return 7.0;
  }
  const ph = -Math.log10(hPlus);
  return Math.max(0, Math.min(14, Math.round(ph * 100) / 100));
}

/**
 * Calculates the blended water quality within the central Blend tank based on
 * the volume contributions of individual source reservoirs.
 *
 * @summary Compute Blend tank water quality.
 * @description Uses conservation of mass (volumetric weighted average) to compute
 * composite Total Dissolved Solids (TDS), Nitrates, and Electrical Conductivity (EC).
 * For pH, performs molar linear blending of [H+] ions before converting back to pH units.
 * If total stored volume across sources is zero, falls back to a clean neutral standard.
 *
 * @param tankVolumes - Current water storage volumes across all four reservoirs in m³.
 * @returns Composite WaterQualityMetrics representing the Blend tank water state.
 * @throws Never throws.
 */
export function calculateBlendQuality(tankVolumes: TankVolumeMetrics): WaterQualityMetrics {
  const { rainwater, esa, external } = tankVolumes;
  const totalVolume = rainwater + esa + external;

  // Edge case: if no source water is stored, return default neutral baseline quality
  if (totalVolume <= 0) {
    return {
      tds: 120.0,
      ph: 7.0,
      nitrates: 4.5,
      ec: 180.0,
    };
  }

  // Calculate fractional volumetric contribution of each source
  const rainFraction = rainwater / totalVolume;
  const esaFraction = esa / totalVolume;
  const extFraction = external / totalVolume;

  const rainQuality = SOURCE_WATER_QUALITIES.rainwater;
  const esaQuality = SOURCE_WATER_QUALITIES.esa;
  const externalQuality = SOURCE_WATER_QUALITIES.external;

  // Linear volumetric mass-balance mixing for conservative solutes
  const mixedTds =
    rainFraction * rainQuality.tds +
    esaFraction * esaQuality.tds +
    extFraction * externalQuality.tds;
  const mixedNitrates =
    rainFraction * rainQuality.nitrates +
    esaFraction * esaQuality.nitrates +
    extFraction * externalQuality.nitrates;
  const mixedEc =
    rainFraction * rainQuality.ec +
    esaFraction * esaQuality.ec +
    extFraction * externalQuality.ec;

  // Logarithmic molar H+ ion blending for pH calculation
  const rainHPlus = phToHydrogenIonConcentration(rainQuality.ph);
  const esaHPlus = phToHydrogenIonConcentration(esaQuality.ph);
  const extHPlus = phToHydrogenIonConcentration(externalQuality.ph);

  const mixedHPlus = rainFraction * rainHPlus + esaFraction * esaHPlus + extFraction * extHPlus;
  const mixedPh = hydrogenIonConcentrationToPh(mixedHPlus);

  return {
    tds: Math.round(mixedTds * 10) / 10,
    ph: Math.round(mixedPh * 10) / 10,
    nitrates: Math.round(mixedNitrates * 10) / 10,
    ec: Math.round(mixedEc * 10) / 10,
  };
}

/**
 * Formats a water quality parameter value with appropriate units and precision in plain text.
 *
 * @summary Format water quality parameter.
 * @description Formats numeric readings into human-readable plain text strings with units:
 * - TDS: integer with 'mg/L'
 * - pH: 1 decimal place (dimensionless)
 * - Nitrates: 1 decimal place with 'mg/L'
 * - EC: integer with 'µS/cm'
 *
 * @param metric - Parameter identifier ('tds' | 'ph' | 'nitrates' | 'ec').
 * @param value - Numeric reading.
 * @returns Formatted plain text string (e.g., "245 mg/L", "6.8", "420 µS/cm").
 * @throws Never throws.
 */
export function formatQualityMetric(metric: keyof WaterQualityMetrics, value: number): string {
  switch (metric) {
    case 'tds':
      return `${Math.round(value)} mg/L`;
    case 'ph':
      return value.toFixed(1);
    case 'nitrates':
      return `${value.toFixed(1)} mg/L`;
    case 'ec':
      return `${Math.round(value)} µS/cm`;
    default:
      return `${value}`;
  }
}

/**
 * Returns a human-readable plain text description of the standard nominal reference range.
 *
 * @summary Get nominal range text.
 * @description Provides standard agricultural reference thresholds for display on UI cards.
 *
 * @param metric - Parameter identifier ('tds' | 'ph' | 'nitrates' | 'ec').
 * @returns Description string of optimal agricultural range.
 * @throws Never throws.
 */
export function getNominalRangeDescription(metric: keyof WaterQualityMetrics): string {
  switch (metric) {
    case 'tds':
      return 'Nominal: < 500 mg/L (Freshwater)';
    case 'ph':
      return 'Nominal: 6.0 - 8.5 (Neutral)';
    case 'nitrates':
      return 'Nominal: < 30 mg/L (Optimal)';
    case 'ec':
      return 'Nominal: < 700 µS/cm (Low Salinity)';
    default:
      return '';
  }
}

/**
 * Evaluates the baseline nominal freshwater status for a global water quality metric.
 *
 * @summary Evaluate general metric status.
 * @description Evaluates whether an individual parameter in the central Blend tank
 * falls within standard freshwater irrigation limits (safe), moderate salinity (caution),
 * or elevated concentration (unsafe).
 *
 * @param metric - Target parameter identifier ('tds' | 'ph' | 'nitrates' | 'ec').
 * @param value - Numeric reading to evaluate.
 * @returns Evaluated compliance status ('safe' | 'caution' | 'unsafe').
 * @throws Never throws.
 */
export function evaluateFreshwaterMetricStatus(
  metric: keyof WaterQualityMetrics,
  value: number
): 'safe' | 'caution' | 'unsafe' {
  switch (metric) {
    case 'ec':
      if (value <= 700) return 'safe';
      if (value <= 1500) return 'caution';
      return 'unsafe';
    case 'tds':
      if (value <= 450) return 'safe';
      if (value <= 1000) return 'caution';
      return 'unsafe';
    case 'ph':
      if (value >= 6.0 && value <= 8.4) return 'safe';
      if ((value >= 5.5 && value < 6.0) || (value > 8.4 && value <= 8.8)) return 'caution';
      return 'unsafe';
    case 'nitrates':
      if (value <= 30) return 'safe';
      if (value <= 50) return 'caution';
      return 'unsafe';
    default:
      return 'safe';
  }
}


