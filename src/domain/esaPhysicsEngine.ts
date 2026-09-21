/**
 * @file esaPhysicsEngine.ts
 * @summary Physics calculation engine for ESA (Electric Swing Adsorption) atmospheric water generation.
 * @description Implements Dubinin-Astakhov adsorption isotherms, temperature-dependent adsorption
 * potentials, condenser enthalpy limitations, and installed capacity scaling based on the
 * physical ACFF prototype model from prototipo_water4all.
 */

import {
  ESAPhysicalParameters,
  DEFAULT_ESA_PARAMETERS,
  ESAProductionResult,
} from '../types/weather';

/** Universal gas constant in Joules per mole Kelvin (J/(mol*K)) */
export const GAS_CONSTANT_J_PER_MOL_K = 8.314462618;

/**
 * Calculates the Polanyi adsorption potential for water vapor in air.
 *
 * @summary Calculate adsorption potential.
 * @description Computes the thermodynamic adsorption potential A = R * T * ln(1 / (RH / 100)),
 * where R is the universal gas constant, T is the absolute temperature in Kelvin, and RH
 * is the ambient relative humidity.
 *
 * @param temperatureC - Ambient temperature in degrees Celsius (°C).
 * @param relativeHumidityPct - Ambient relative humidity in percent (0 to 100%).
 * @returns Adsorption potential in Joules per mole (J/mol).
 * @throws Error if temperature is at or below absolute zero (-273.15 °C).
 */
export function calculateAdsorptionPotential(
  temperatureC: number,
  relativeHumidityPct: number
): number {
  const temperatureK = temperatureC + 273.15;
  if (temperatureK <= 0) {
    throw new Error('Temperature must be above absolute zero (-273.15 °C).');
  }

  // Bound relative humidity to (0, 1] to avoid mathematical singularities in logarithm
  const boundedRh = Math.min(1.0, Math.max(1e-9, relativeHumidityPct / 100.0));

  // Polanyi adsorption potential equation: A = R * T * ln(1 / RH)
  return GAS_CONSTANT_J_PER_MOL_K * temperatureK * Math.log(1.0 / boundedRh);
}

/**
 * Calculates the equilibrium water vapor loading on the ACFF sorbent bed.
 *
 * @summary Calculate equilibrium water loading.
 * @description Evaluates the Dubinin-Astakhov adsorption isotherm:
 * q = q_max * exp( - (A / E)^n ),
 * where A is adsorption potential, E is characteristic adsorption energy, and n is the Dubinin exponent.
 *
 * @param temperatureC - Ambient temperature in degrees Celsius (°C).
 * @param relativeHumidityPct - Ambient relative humidity in percent (0 to 100%).
 * @param params - Physical ESA parameters (defaults to calibrated ACFF prototype parameters).
 * @param precomputedPotential - Optional precomputed adsorption potential in J/mol to avoid redundant evaluation.
 * @returns Equilibrium loading in kilograms of water per kilogram of sorbent (kg/kg).
 * @throws Error if temperature is below absolute zero.
 */
export function calculateEquilibriumLoading(
  temperatureC: number,
  relativeHumidityPct: number,
  params: ESAPhysicalParameters = DEFAULT_ESA_PARAMETERS,
  precomputedPotential?: number
): number {
  // Use precomputed potential if provided to avoid duplicate logarithmic evaluation
  const potential =
    precomputedPotential !== undefined
      ? precomputedPotential
      : calculateAdsorptionPotential(temperatureC, relativeHumidityPct);

  // Dubinin-Astakhov isotherm calculation
  const safeEnergy = Math.max(params.characteristicEnergyJPerMol, 1e-12);
  const exponent = Math.pow(potential / safeEnergy, params.dubininExponent);

  return params.qMaxKgPerKg * Math.exp(-exponent);
}

/**
 * Calculates live water production rates for an installed ESA atmospheric water generator.
 *
 * @summary Calculate ESA water production rates.
 * @description Determines water collected per cycle accounting for sorbent mass, desorption recovery,
 * condenser thermal capacity limit, and scales by the farm profile's nominal installed capacity.
 *
 * @param temperatureC - Ambient dry-bulb temperature in degrees Celsius (°C).
 * @param relativeHumidityPct - Ambient relative humidity in percent (0 to 100%).
 * @param nominalCapacityM3PerDay - Nominal rated capacity of installed farm system in m³/day.
 * @param params - Calibrated physical ESA parameters (defaults to DEFAULT_ESA_PARAMETERS).
 * @returns ESAProductionResult containing hourly and daily production rates, loading, and efficiency.
 * @throws Error if temperature is below absolute zero.
 */
export function calculateESAWaterProduction(
  temperatureC: number,
  relativeHumidityPct: number,
  nominalCapacityM3PerDay: number,
  params: ESAPhysicalParameters = DEFAULT_ESA_PARAMETERS
): ESAProductionResult {
  // Ensure non-negative capacity
  const safeNominal = Math.max(0, nominalCapacityM3PerDay);

  // 1. Calculate thermodynamics and equilibrium loading (reusing precomputed potential)
  const adsorptionPotential = calculateAdsorptionPotential(temperatureC, relativeHumidityPct);
  const equilibriumLoading = calculateEquilibriumLoading(
    temperatureC,
    relativeHumidityPct,
    params,
    adsorptionPotential
  );

  // 2. Desorption water release per single module
  const releasableWaterKg = params.sorbentMassKg * equilibriumLoading;
  const desorbedWaterKg = releasableWaterKg * params.desorptionEfficiency;

  // 3. Condenser thermal limit (COP * CondenserPower * DesorptionHours / LatentHeat)
  const condenserLimitKg =
    (params.condenserCop * params.condenserPowerKw * params.desorptionHours) /
    params.waterLatentHeatKwhPerKg;

  // 4. Actual water collected per cycle per single module
  const collectedPerCycleKg = Math.min(
    desorbedWaterKg * params.collectionEfficiency,
    condenserLimitKg
  );

  // 5. Daily output per module based on cycle duration (adsorption + desorption hours)
  const cycleHours = params.adsorptionHours + params.desorptionHours;
  const cyclesPerDay = 24.0 / cycleHours;
  const moduleDailyOutputKg = collectedPerCycleKg * cyclesPerDay;

  // 6. Installed module scaling based on nominal rated capacity
  const moduleCount =
    safeNominal > 0 ? (safeNominal * 1000.0) / Math.max(params.referenceOutputKgPerDay, 1e-12) : 0;

  // 7. System totals (compute unrounded hourly rate directly to preserve precision)
  const totalDailyKg = moduleCount * moduleDailyOutputKg;
  const dailyRateM3 = Math.round((totalDailyKg / 1000.0) * 100) / 100;
  const hourlyRateKg = totalDailyKg / 24.0;
  const hourlyRateLiters = Math.round(hourlyRateKg * 10) / 10;
  const hourlyRateM3 = Math.round((hourlyRateKg / 1000.0) * 1000) / 1000;
  const efficiencyFactor =
    safeNominal > 0 ? Math.round((dailyRateM3 / safeNominal) * 100) / 100 : 0;

  return {
    hourlyRateLiters,
    hourlyRateM3,
    dailyRateM3,
    adsorptionPotentialJPerMol: Math.round(adsorptionPotential * 10) / 10,
    equilibriumLoadingKgPerKg: Math.round(equilibriumLoading * 10000) / 10000,
    efficiencyFactor,
  };
}

