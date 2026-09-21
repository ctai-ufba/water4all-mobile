/**
 * @file catchmentEngine.ts
 * @summary Rainwater catchment inflow estimation engine.
 * @description Computes expected harvestable rainwater volume from forecasted precipitation (mm),
 * farm catchment area (m²), impermeable runoff coefficients, and first-flush diversion factors.
 * Aligned with the catchment literature model in prototipo_water4all.
 */

import { CatchmentEstimateResult } from '../types/weather';

/** Standard runoff coefficient for impermeable greenhouse and agricultural catchment surfaces (0.0 to 1.0) */
export const DEFAULT_RUNOFF_COEFFICIENT = 0.90;

/** First-flush diversion factor accounting for initial roof wash and dust clearance (0.0 to 1.0) */
export const DEFAULT_FIRST_FLUSH_FACTOR = 0.95;

/**
 * Calculates estimated harvestable rainwater inflow from forecasted precipitation.
 *
 * @summary Calculate rainwater catchment inflow.
 * @description Applies the standard hydrological catchment formula:
 * V (m³) = (Rainfall (mm) * CatchmentArea (m²) * RunoffCoefficient * FirstFlushFactor) / 1000,
 * where 1000 converts liters (mm * m²) into cubic meters (m³).
 *
 * @param precipitationMm - Forecasted cumulative rainfall depth in millimeters (mm).
 * @param catchmentAreaM2 - Surface area available for rain harvesting in square meters (m²).
 * @param runoffCoefficient - Impermeable surface runoff coefficient (defaults to 0.90).
 * @param firstFlushFactor - Initial wash diversion factor (defaults to 0.95).
 * @returns CatchmentEstimateResult containing inputs, effective runoff, and forecasted inflow in m³.
 * @throws Never throws; bounds negative inputs to zero.
 */
export function calculateCatchmentInflow(
  precipitationMm: number,
  catchmentAreaM2: number,
  runoffCoefficient: number = DEFAULT_RUNOFF_COEFFICIENT,
  firstFlushFactor: number = DEFAULT_FIRST_FLUSH_FACTOR
): CatchmentEstimateResult {
  const safePrecipitation = Math.max(0, precipitationMm);
  const safeArea = Math.max(0, catchmentAreaM2);
  const safeRunoff = Math.min(1.0, Math.max(0, runoffCoefficient));
  const safeFirstFlush = Math.min(1.0, Math.max(0, firstFlushFactor));

  // Combined effective runoff factor (typically 0.90 * 0.95 = 0.855)
  const effectiveRunoff = Math.round(safeRunoff * safeFirstFlush * 1000) / 1000;

  // Volume in m³: (mm * m² * effectiveRunoff) / 1000
  const rawVolumeM3 = (safePrecipitation * safeArea * effectiveRunoff) / 1000.0;
  const forecastInflowM3 = Math.round(rawVolumeM3 * 100) / 100;

  return {
    catchmentAreaM2: safeArea,
    precipitationForecastMm: safePrecipitation,
    runoffCoefficient: safeRunoff,
    firstFlushFactor: safeFirstFlush,
    effectiveRunoff,
    forecastInflowM3,
  };
}

