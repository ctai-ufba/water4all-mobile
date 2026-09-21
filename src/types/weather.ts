/**
 * @file weather.ts
 * @summary Weather telemetry, ESA physics, and rainwater catchment types.
 * @description Defines interfaces and data structures for ambient weather conditions,
 * ESA (Electric Swing Adsorption) atmospheric water production metrics, and
 * rainwater catchment inflow forecasts for Mediterranean farm profiles.
 */

/**
 * Ambient atmospheric conditions pair (dry-bulb temperature and relative humidity).
 */
export interface AmbientConditions {
  /** Current ambient dry-bulb temperature in degrees Celsius (°C) */
  temperatureC: number;
  /** Current ambient relative humidity percentage (0 - 100%) */
  relativeHumidityPct: number;
}

/**
 * Ambient weather observation and forecast data.
 */
export interface WeatherData extends AmbientConditions {
  /** Instantaneous precipitation rate in millimeters (mm) */
  currentPrecipitationMm: number;
  /** Forecasted cumulative precipitation over the next 24 hours in millimeters (mm) */
  precipitationForecast24hMm: number;
  /** Flag indicating whether data originated from synthetic Mediterranean seasonal fallback */
  isOfflineFallback: boolean;
  /** ISO 8601 timestamp of when weather was fetched or generated */
  timestamp: string;
}

/**
 * Calibrated parameters for the ACFF (Activated Carbon Fiber Felt) ESA atmospheric water generator.
 * Aligned with the physical prototype model in prototipo_water4all.
 */
export interface ESAPhysicalParameters {
  /** Sorbent bed mass per module in kilograms (kg) (default: 0.797 kg) */
  sorbentMassKg: number;
  /** Maximum equilibrium adsorption capacity in kg water / kg sorbent (default: 0.60 kg/kg) */
  qMaxKgPerKg: number;
  /** Characteristic adsorption energy parameter in J/mol (default: 1015.960538 J/mol) */
  characteristicEnergyJPerMol: number;
  /** Dubinin-Astakhov structural exponent (dimensionless) (default: 1.656674843) */
  dubininExponent: number;
  /** Adsorption phase duration in hours (default: 6.0 h) */
  adsorptionHours: number;
  /** Desorption phase duration in hours (default: 2.5 h) */
  desorptionHours: number;
  /** Desorption thermal recovery efficiency ratio (0 - 1) (default: 0.88) */
  desorptionEfficiency: number;
  /** Water vapor condensation collection efficiency ratio (0 - 1) (default: 0.963) */
  collectionEfficiency: number;
  /** Condenser electrical power rating in kW (default: 0.240 kW) */
  condenserPowerKw: number;
  /** Condenser coefficient of performance (COP) (default: 0.42) */
  condenserCop: number;
  /** Latent heat of vaporization for water in kWh/kg (default: 0.676 kWh/kg) */
  waterLatentHeatKwhPerKg: number;
  /** Reference single-module daily water output in kg/day (default: 1.029176 kg/day) */
  referenceOutputKgPerDay: number;
}

/**
 * Default ACFF ESA physical parameters calibrated against the prototipo_water4all engineering model.
 */
export const DEFAULT_ESA_PARAMETERS: ESAPhysicalParameters = {
  sorbentMassKg: 0.797,
  qMaxKgPerKg: 0.60,
  characteristicEnergyJPerMol: 1015.960538,
  dubininExponent: 1.656674843,
  adsorptionHours: 6.0,
  desorptionHours: 2.5,
  desorptionEfficiency: 0.88,
  collectionEfficiency: 0.963,
  condenserPowerKw: 0.240,
  condenserCop: 0.42,
  waterLatentHeatKwhPerKg: 0.676,
  referenceOutputKgPerDay: (0.3645 * 24.0) / (6.0 + 2.5), // ~1.029176 kg/day
};

/**
 * Calculated outputs of the ESA atmospheric water generation physics engine.
 */
export interface ESAProductionResult {
  /** Live water production rate in liters per hour (L/h) */
  hourlyRateLiters: number;
  /** Live water production rate in cubic meters per hour (m³/h) */
  hourlyRateM3: number;
  /** Estimated full-day water production rate under current conditions in cubic meters per day (m³/day) */
  dailyRateM3: number;
  /** Chemical adsorption potential in Joules per mole (J/mol) */
  adsorptionPotentialJPerMol: number;
  /** Sorbent equilibrium water loading in kg water / kg sorbent */
  equilibriumLoadingKgPerKg: number;
  /** Operational efficiency ratio relative to nominal rated capacity (0.0 to 1.5+) */
  efficiencyFactor: number;
}

/**
 * Calculated outputs of the rainwater catchment inflow estimation engine.
 */
export interface CatchmentEstimateResult {
  /** Surface collection area in square meters (m²) */
  catchmentAreaM2: number;
  /** Forecasted precipitation depth in millimeters (mm) */
  precipitationForecastMm: number;
  /** Impermeable surface runoff coefficient (dimensionless, 0.0 - 1.0) (default: 0.90) */
  runoffCoefficient: number;
  /** First-flush diversion factor accounting for initial roof wash (dimensionless, 0.0 - 1.0) (default: 0.95) */
  firstFlushFactor: number;
  /** Combined effective runoff ratio (runoffCoefficient * firstFlushFactor) (default: 0.855) */
  effectiveRunoff: number;
  /** Estimated collectible water volume in cubic meters (m³) */
  forecastInflowM3: number;
}

