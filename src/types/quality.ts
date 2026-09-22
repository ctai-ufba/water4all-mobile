/**
 * @file quality.ts
 * @summary Water quality parameter definitions and FAO crop compliance types.
 * @description Defines TypeScript interfaces, types, and baseline source water
 * quality properties for Total Dissolved Solids (TDS), pH, Nitrates, and
 * Electrical Conductivity (EC), paired with FAO agricultural compliance classifications.
 */

/**
 * Physical and chemical water quality parameters.
 */
export interface WaterQualityMetrics {
  /** Total Dissolved Solids in milligrams per liter (mg/L) */
  tds: number;
  /** pH level (dimensionless scale from 0 to 14) */
  ph: number;
  /** Nitrate concentration in milligrams per liter (mg/L) */
  nitrates: number;
  /** Electrical Conductivity in microsiemens per centimeter (µS/cm) */
  ec: number;
}

/**
 * Standard water quality profiles for individual farm water sources
 * based on canonical Mediterranean simulation benchmarks.
 */
/**
 * Water quality regime the farm's supply is in.
 * - 'balanced': the ordinary supply a calibrated farm draws on.
 * - 'stressed': a saltier external supply and more acidic rainfall.
 */
export type WaterQualityRegime = 'balanced' | 'stressed';

/**
 * Source water quality regimes ported from prototipo_water4all's scenario presets.
 *
 * @remarks The prototype models water stress by changing the supply itself, not only the volumes
 * drawn from it, and ships presets for each regime. 'balanced' is its Balanced preset, the ordinary
 * supply the calibrated farm draws on. 'stressed' is its Stressed preset: a saltier, more polluted
 * external supply with more acidic rainfall, which is the regime a High Salinity scenario or a farm
 * living off emergency deliveries is actually in. Only the volumes were ported originally, so no
 * state the app could reach ever crossed a compliance threshold.
 */
export const SOURCE_WATER_QUALITY_PROFILES: Record<
  WaterQualityRegime,
  Record<'rainwater' | 'esa' | 'external', WaterQualityMetrics>
> = {
  balanced: {
    rainwater: {
      tds: 80.0,
      ph: 5.8,
      nitrates: 4.0,
      ec: 100.0,
    },
    esa: {
      tds: 5.0,
      ph: 7.0,
      nitrates: 0.2,
      ec: 10.0,
    },
    external: {
      tds: 450.0,
      ph: 7.2,
      nitrates: 18.0,
      ec: 720.0,
    },
  },
  stressed: {
    rainwater: {
      tds: 90.0,
      ph: 5.4,
      nitrates: 5.0,
      ec: 130.0,
    },
    esa: {
      tds: 8.0,
      ph: 6.8,
      nitrates: 0.3,
      ec: 50.0,
    },
    external: {
      tds: 500.0,
      ph: 7.4,
      nitrates: 22.0,
      ec: 900.0,
    },
  },
};

/**
 * Source water quality of the ordinary balanced supply.
 *
 * @remarks Kept as the name for the default regime, which is what a farm running normally draws.
 * Anything that varies with the active demo state should read SOURCE_WATER_QUALITY_PROFILES.
 */
export const SOURCE_WATER_QUALITIES = SOURCE_WATER_QUALITY_PROFILES.balanced;

/**
 * Traffic-light compliance status according to FAO agricultural guidelines.
 * - 'safe': Water meets optimal quality standards with no restrictions or salinity risk.
 * - 'caution': Water exhibits slight to moderate salinity or nitrate restrictions; careful management needed.
 * - 'unsafe': Water exceeds tolerance thresholds, posing severe risk of crop yield loss or animal toxicity.
 */
export type ComplianceStatus = 'safe' | 'caution' | 'unsafe';

/**
 * Canonical agricultural uses evaluated against FAO quality standards.
 */
export type AgriculturalUseId = 'olive-trees' | 'vineyards' | 'vegetables' | 'livestock';

/**
 * Detailed parameter compliance evaluation breakdown.
 */
export interface ParameterCompliance {
  /** Evaluated status for this specific parameter */
  status: ComplianceStatus;
  /** Metric parameter name (e.g., 'EC', 'pH', 'TDS', 'Nitrates') */
  label: string;
  /** Observed numeric value */
  value: number;
  /** Measurement unit in plain text (e.g., 'mg/L', 'µS/cm') */
  unit: string;
  /** Human-readable FAO threshold description */
  thresholdText: string;
  /** Specific reason if marked caution or unsafe */
  reason?: string;
}

/**
 * Consolidated compliance evaluation for an individual agricultural crop or livestock use.
 */
export interface CropComplianceEvaluation {
  /** Unique agricultural use identifier */
  useId: AgriculturalUseId;
  /** Canonical display name (e.g., 'Olive trees', 'Vegetables') */
  name: string;
  /** Agricultural category ('crop' or 'livestock') */
  category: 'crop' | 'livestock';
  /** Crop sensitivity classification description */
  sensitivity: string;
  /** Overall compliance status (worst-case among individual parameters) */
  status: ComplianceStatus;
  /** Concise summary of current status */
  summary: string;
  /** Primary parameter causing caution or unsafe rating, or null if fully safe */
  limitingFactor: string | null;
  /** Actionable agronomic or veterinary guidance according to FAO literature */
  guidance: string;
  /** Parameter-by-parameter evaluation breakdown */
  parameters: {
    ec: ParameterCompliance;
    tds: ParameterCompliance;
    ph: ParameterCompliance;
    nitrates: ParameterCompliance;
  };
}

/**
 * Complete FAO compliance report consolidating evaluations across all farm uses.
 */
export interface FaoComplianceReport {
  /** Active water quality metrics evaluated */
  quality: WaterQualityMetrics;
  /** Individual evaluations for all 4 standard agricultural uses */
  evaluations: CropComplianceEvaluation[];
  /** Worst-case overall farm compliance status */
  overallStatus: ComplianceStatus;
  /** True if one or more crop/livestock uses is evaluated as 'unsafe' */
  hasUnsafeCrop: boolean;
  /** List of use names evaluated as unsafe */
  unsafeUses: string[];
  /** List of use names evaluated as caution */
  cautionUses: string[];
  /** Critical warning banner payload if safety thresholds are breached, otherwise null */
  warningBanner: {
    title: string;
    message: string;
    severity: 'danger' | 'warning';
  } | null;
}

