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
 * An hourly-resolution ambient forecast series.
 *
 * @remarks The ESA engine integrates production across this series rather than extrapolating a
 * single instantaneous reading over 24 hours. A reading taken at a summer afternoon peak returns
 * zero production, correctly for that instant and wrongly for the day, because the daily total is
 * collected during the humid pre-dawn window (ADR 0003).
 */
export interface HourlyAmbientSeries {
  /** Hourly dry-bulb temperature samples in degrees Celsius (°C); index 0 is the series start */
  temperatureC: number[];
  /** Hourly relative humidity samples (0 - 100%); must be the same length as temperatureC */
  relativeHumidityPct: number[];
  /** ISO 8601 timestamp of the first sample */
  startTime: string;
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
  /**
   * Hourly temperature and relative humidity forecast driving the ESA integration.
   *
   * @remarks Always populated by both the Open-Meteo parser and the synthetic generator. Consumers
   * that only need an instantaneous reading can ignore it; the ESA engine requires it.
   */
  hourly: HourlyAmbientSeries;
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
  /**
   * Linear-driving-force mass transfer rate toward equilibrium loading, per hour (default: 1.2 /h).
   *
   * @remarks From `prototipo_water4all/src/h2o_farm/physics/esa.py:21`. Sets how fast loading
   * relaxes toward equilibrium, so it decides whether a brief humid window fills the bed or passes
   * unused. At 1.2 /h a 6 h adsorption stage reaches equilibrium to within 0.1 %.
   */
  ldfRatePerHour: number;
  /** Loading retained by the sorbent after desorption in kg/kg (default: 0.0 kg/kg) */
  residualLoadingKgPerKg: number;
  /**
   * Water per module below which a ready cycle keeps adsorbing instead of desorbing (default: 0.005 kg).
   *
   * @remarks This is the cycle gate, from `prototipo_water4all/src/h2o_farm/physics/esa.py:34`.
   * Desorption costs a fixed energy charge whatever it recovers, so in dry air the unit waits
   * rather than spending a full regeneration on a nearly empty bed.
   */
  minimumCollectionKg: number;
  /**
   * Physics integration step in hours; finer than the hourly climate series (default: 0.5 h).
   *
   * @remarks From `prototipo_water4all/src/h2o_farm/physics/esa.py:35`. Kept at the prototype's
   * value because changing it changes where cycles land against the 6 h / 2.5 h stage boundaries,
   * and so changes the output.
   */
  integrationStepHours: number;
  /** Reference electrical energy consumed by one full cycle in kWh (default: 4.64 * 0.3645 kWh) */
  referenceCycleEnergyKwh: number;
  /** Share of cycle energy drawn regardless of water recovered (dimensionless, 0 - 1) */
  energyFixedFraction: number;
  /** Share of cycle energy scaling with water recovered (dimensionless, 0 - 1) */
  energyWaterFraction: number;
}

/** Water collected by one ACFF module per cycle at the 25 °C / 90 % RH bench measurement, in kg */
export const BENCH_WATER_KG_PER_CYCLE = 0.3645;

/**
 * Specific energy of the complete Li et al. ACFF prototype, in kWh per kg of water collected.
 *
 * @remarks The canonical declaration of this figure. Includes electric-swing regeneration and
 * semiconductor condensation (`prototipo_water4all/src/h2o_farm/economics.py:69`). Anything needing
 * it per cubic metre derives from here rather than restating it.
 */
export const ESA_SPECIFIC_ENERGY_KWH_PER_KG = 4.64;

/** Specific energy of the bench ACFF prototype expressed per cubic metre of water (kWh/m³). */
export const ESA_SPECIFIC_ENERGY_KWH_PER_M3 = ESA_SPECIFIC_ENERGY_KWH_PER_KG * 1000.0;

/** Electrical energy of one reference cycle in kWh (specific energy at the bench water yield) */
export const REFERENCE_CYCLE_ENERGY_KWH =
  ESA_SPECIFIC_ENERGY_KWH_PER_KG * BENCH_WATER_KG_PER_CYCLE;

/**
 * Energy drawn by a cycle regardless of water recovered, in kWh (electric swing regeneration).
 *
 * @remarks Carried from the calibration authority's `energy_fixed_fraction`, declared there as
 * `0.600 / (4.64 * 0.3645)` (`prototipo_water4all/src/h2o_farm/physics/esa.py:31`). The 0.600 kWh
 * numerator is the part of a cycle's draw that does not scale with water recovered, which is what
 * makes a cycle in dry air so expensive per litre and why the cycle gate exists at all.
 */
export const ESA_FIXED_CYCLE_ENERGY_KWH = 0.600;

/** Share of reference cycle energy that is independent of the water actually collected */
export const ESA_ENERGY_FIXED_FRACTION =
  ESA_FIXED_CYCLE_ENERGY_KWH / REFERENCE_CYCLE_ENERGY_KWH;

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
  ldfRatePerHour: 1.2,
  residualLoadingKgPerKg: 0.0,
  minimumCollectionKg: 0.005,
  integrationStepHours: 0.5,
  referenceCycleEnergyKwh: REFERENCE_CYCLE_ENERGY_KWH,
  energyFixedFraction: ESA_ENERGY_FIXED_FRACTION,
  energyWaterFraction: 1.0 - ESA_ENERGY_FIXED_FRACTION,
};

/**
 * Calculated outputs of the ESA atmospheric water generation physics engine.
 */
export interface ESAProductionResult {
  /** Mean water production rate across the integrated forecast in liters per hour (L/h) */
  hourlyRateLiters: number;
  /** Mean water production rate across the integrated forecast in cubic meters per hour (m³/h) */
  hourlyRateM3: number;
  /** Mean daily water production across the integrated forecast in cubic meters per day (m³/day) */
  dailyRateM3: number;
  /** Chemical adsorption potential at the first sample of the series, in Joules per mole (J/mol) */
  adsorptionPotentialJPerMol: number;
  /** Sorbent equilibrium water loading at the first sample of the series, in kg water / kg sorbent */
  equilibriumLoadingKgPerKg: number;
  /**
   * Share of ESA nominal capacity the current air can actually deliver (0.0 to 1.0+).
   *
   * @remarks Named a yield ratio, not an efficiency, because nominal capacity is anchored to a
   * 25 °C / 90 % RH bench measurement that Mediterranean air never approaches. A healthy plant
   * reads around 0.41 as an annual mean and under 0.10 in July: that is the physics of dry air,
   * not a malfunctioning unit (ADR 0003).
   */
  ambientYieldRatio: number;
  /** Completed adsorption/desorption cycles per day across the integrated forecast */
  cyclesPerDay: number;
  /** Electrical energy drawn per day across the integrated forecast, in kWh/day */
  energyKwhPerDay: number;
  /** Whole days of forecast the integration covered */
  integratedDays: number;
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

