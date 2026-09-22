/**
 * @file esaPhysicsEngine.ts
 * @summary Physics calculation engine for ESA (Electric Swing Adsorption) atmospheric water generation.
 * @description Implements Dubinin-Astakhov adsorption isotherms, linear-driving-force sorption
 * kinetics, gated adsorption/desorption cycling, condenser enthalpy limits, and installed capacity
 * scaling, ported from the physical ACFF prototype model in prototipo_water4all
 * (`src/h2o_farm/physics/esa.py`).
 *
 * @remarks Production is integrated across an hourly forecast series rather than extrapolated from
 * a single instantaneous reading. Read at a summer afternoon peak, an instantaneous reading reports
 * zero, correctly for that instant and wrongly for the day, because the daily total is collected in
 * the humid pre-dawn window (ADR 0003).
 */

import {
  AmbientConditions,
  HourlyAmbientSeries,
  ESAPhysicalParameters,
  DEFAULT_ESA_PARAMETERS,
  ESAProductionResult,
  BENCH_WATER_KG_PER_CYCLE,
} from '../types/weather';

/** Universal gas constant in Joules per mole Kelvin (J/(mol*K)) */
export const GAS_CONSTANT_J_PER_MOL_K = 8.314462618;

/**
 * Forecast horizon used when answering what a single steady ambient condition would yield.
 *
 * @remarks A cycle spans 8.5 h, so a 24-hour window fits only two whole cycles and truncates the
 * third, under-reporting the steady-state rate by roughly a quarter. Seven days amortises that
 * edge effect to within a few percent of the asymptote.
 */
export const STEADY_STATE_HORIZON_DAYS = 7;

/**
 * Calculates the Polanyi adsorption potential for water vapor in air.
 *
 * @summary Calculate adsorption potential.
 * @description Computes the thermodynamic adsorption potential A = R * T * ln(1 / (RH / 100)),
 * where R is the universal gas constant, T is the absolute temperature in Kelvin, and RH
 * is the ambient relative humidity.
 *
 * @param conditions - Ambient atmospheric conditions (dry-bulb temperature and relative humidity).
 * @returns Adsorption potential in Joules per mole (J/mol).
 * @throws Error if temperature is at or below absolute zero (-273.15 °C).
 */
export function calculateAdsorptionPotential(conditions: AmbientConditions): number {
  const { temperatureC, relativeHumidityPct } = conditions;
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
 * @param conditions - Ambient atmospheric conditions (dry-bulb temperature and relative humidity).
 * @param params - Physical ESA parameters (defaults to calibrated ACFF prototype parameters).
 * @param precomputedPotential - Optional precomputed adsorption potential in J/mol to avoid redundant evaluation.
 * @returns Equilibrium loading in kilograms of water per kilogram of sorbent (kg/kg).
 * @throws Error if temperature is below absolute zero.
 */
export function calculateEquilibriumLoading(
  conditions: AmbientConditions,
  params: ESAPhysicalParameters = DEFAULT_ESA_PARAMETERS,
  precomputedPotential?: number
): number {
  // Use precomputed potential if provided to avoid duplicate logarithmic evaluation
  const potential = precomputedPotential ?? calculateAdsorptionPotential(conditions);

  // Dubinin-Astakhov isotherm calculation
  const safeEnergy = Math.max(params.characteristicEnergyJPerMol, 1e-12);
  const exponent = Math.pow(potential / safeEnergy, params.dubininExponent);

  return params.qMaxKgPerKg * Math.exp(-exponent);
}

/**
 * Builds an hourly series holding one ambient condition constant.
 *
 * @summary Build a constant ambient series.
 * @description Repeats a single temperature and relative humidity across whole days, for answering
 * what a steady regime would yield. Used by demo scenario overrides, which supply one condition
 * rather than a forecast.
 *
 * @param conditions - The ambient condition to hold constant.
 * @param days - Whole days to span (defaults to STEADY_STATE_HORIZON_DAYS).
 * @param startTime - ISO 8601 timestamp of the first sample (defaults to now).
 * @returns An HourlyAmbientSeries of `days * 24` identical samples.
 * @throws Never throws; a non-positive day count yields an empty series.
 */
export function buildConstantAmbientSeries(
  conditions: AmbientConditions,
  days: number = STEADY_STATE_HORIZON_DAYS,
  startTime: string = new Date().toISOString()
): HourlyAmbientSeries {
  const hours = Math.max(0, Math.floor(days)) * 24;
  return {
    temperatureC: new Array(hours).fill(conditions.temperatureC),
    relativeHumidityPct: new Array(hours).fill(conditions.relativeHumidityPct),
    startTime,
  };
}

/**
 * Takes the leading hours of an ambient forecast series.
 *
 * @summary Slice an ambient series to a window.
 * @description Keeps the first `hours` samples of temperature and humidity, preserving the
 * series start time. Used to integrate production over a stated window, such as the next day,
 * rather than over whatever horizon the forecast happens to carry.
 *
 * @param series - The hourly ambient series to narrow.
 * @param hours - Number of leading hours to keep; clamped to the series length.
 * @returns A series of at most `hours` samples, starting where the input did.
 * @throws Never throws; a non-positive count yields an empty series.
 *
 * @remarks A window shorter than a few days truncates the cycle that straddles its end, because a
 * cycle spans `adsorptionHours + desorptionHours` and only cycles that finish inside the window
 * deliver water. A 24-hour window therefore reports a day's *yield*, which sits below the
 * sustained daily rate; see STEADY_STATE_HORIZON_DAYS.
 */
export function sliceAmbientSeries(series: HourlyAmbientSeries, hours: number): HourlyAmbientSeries {
  const kept = Math.max(0, Math.floor(hours));
  return {
    temperatureC: series.temperatureC.slice(0, kept),
    relativeHumidityPct: series.relativeHumidityPct.slice(0, kept),
    startTime: series.startTime,
  };
}

/** One completed adsorption/desorption cycle of a single ACFF module. */
interface ESACycleResult {
  /** Water condensed and collected over the cycle, in kg */
  collectedWaterKg: number;
  /** Electrical energy drawn by the cycle, in kWh */
  energyKwh: number;
}

/**
 * Simulates one sequential ACFF sorbent bed against an hourly climate series.
 *
 * @summary Simulate a single ACFF module.
 * @description Advances sorbent loading toward the Dubinin-Astakhov equilibrium using
 * linear-driving-force kinetics on a sub-hourly step, then desorbs once the adsorption stage has
 * run its course *and* the bed holds enough water to be worth regenerating.
 *
 * @param series - Hourly ambient temperature and relative humidity.
 * @param params - Calibrated physical ESA parameters.
 * @returns The cycles completed within the series window.
 * @throws Error if stage durations or the integration step are not positive.
 */
function simulateAcffModule(
  series: HourlyAmbientSeries,
  params: ESAPhysicalParameters
): ESACycleResult[] {
  const dt = params.integrationStepHours;
  if (dt <= 0 || params.adsorptionHours <= 0 || params.desorptionHours <= 0) {
    throw new Error('ESA stage durations and integration step must be positive.');
  }

  const hours = Math.min(series.temperatureC.length, series.relativeHumidityPct.length);
  const cycles: ESACycleResult[] = [];

  // Condenser thermal ceiling is fixed by the desorption stage, so it is hoisted out of the loop.
  const condenserLimitKg =
    (params.condenserCop * params.condenserPowerKw * params.desorptionHours) /
    params.waterLatentHeatKwhPerKg;

  let elapsed = 0.0;
  let loading = params.residualLoadingKgPerKg;
  let adsorptionElapsed = 0.0;

  while (elapsed + dt <= hours + 1e-9) {
    // The climate series is hourly while the physics steps at a finer interval, so each sub-hourly
    // step reads the hour it falls within.
    const index = Math.min(Math.floor(elapsed), hours - 1);
    const equilibrium = calculateEquilibriumLoading(
      {
        temperatureC: series.temperatureC[index],
        relativeHumidityPct: series.relativeHumidityPct[index],
      },
      params
    );

    // Linear driving force: loading relaxes toward equilibrium at a finite rate rather than
    // snapping to it, so a brief humid window does not fill the bed instantly.
    loading = equilibrium - (equilibrium - loading) * Math.exp(-params.ldfRatePerHour * dt);
    loading = Math.min(params.qMaxKgPerKg, Math.max(params.residualLoadingKgPerKg, loading));

    elapsed += dt;
    adsorptionElapsed += dt;

    const potentialCollectionKg =
      params.sorbentMassKg *
      Math.max(0.0, loading - params.residualLoadingKgPerKg) *
      params.desorptionEfficiency *
      params.collectionEfficiency;

    const stageComplete = adsorptionElapsed + 1e-9 >= params.adsorptionHours;

    // The cycle gate. Desorption draws a fixed regeneration charge whatever it recovers, so in dry
    // air the bed keeps adsorbing instead of spending a full cycle on a nearly empty bed.
    if (!stageComplete || potentialCollectionKg < params.minimumCollectionKg) {
      continue;
    }

    // Only cycles that can finish desorbing inside the forecast window are counted.
    if (elapsed + params.desorptionHours > hours + 1e-9) {
      break;
    }

    const releasableKg =
      params.sorbentMassKg * Math.max(0.0, loading - params.residualLoadingKgPerKg);
    const desorbedKg = releasableKg * params.desorptionEfficiency;
    const collectedKg = Math.min(desorbedKg * params.collectionEfficiency, condenserLimitKg);

    // Energy splits into a charge drawn regardless of yield and a charge scaling with water
    // recovered, both referenced to the bench cycle.
    const energyScale =
      params.energyFixedFraction +
      (params.energyWaterFraction * collectedKg) / BENCH_WATER_KG_PER_CYCLE;
    const energyKwh = params.referenceCycleEnergyKwh * Math.max(0.0, energyScale);

    cycles.push({ collectedWaterKg: collectedKg, energyKwh });

    elapsed += params.desorptionHours;
    loading = (params.sorbentMassKg * loading - desorbedKg) / params.sorbentMassKg;
    adsorptionElapsed = 0.0;
  }

  return cycles;
}

/** Rounds to a fixed number of decimal places. */
function roundTo(value: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

/** The result returned when there is nothing to integrate. */
function emptyProductionResult(
  conditions: AmbientConditions | null,
  params: ESAPhysicalParameters
): ESAProductionResult {
  const potential = conditions ? calculateAdsorptionPotential(conditions) : 0;
  const loading = conditions ? calculateEquilibriumLoading(conditions, params, potential) : 0;
  return {
    hourlyRateLiters: 0,
    hourlyRateM3: 0,
    dailyRateM3: 0,
    adsorptionPotentialJPerMol: roundTo(potential, 1),
    equilibriumLoadingKgPerKg: roundTo(loading, 4),
    ambientYieldRatio: 0,
    cyclesPerDay: 0,
    energyKwhPerDay: 0,
    integratedDays: 0,
  };
}

/**
 * Integrates ESA water production across an hourly ambient forecast.
 *
 * @summary Calculate ESA production over a forecast series.
 * @description Simulates one ACFF module against the series, scales it by the module count the
 * farm's nominal capacity implies, and normalises water, energy and cycle counts to a daily rate.
 *
 * @param series - Hourly ambient temperature and relative humidity forecast.
 * @param nominalCapacityM3PerDay - Nominal rated capacity of the installed farm system in m³/day.
 * @param params - Calibrated physical ESA parameters (defaults to DEFAULT_ESA_PARAMETERS).
 * @returns ESAProductionResult with daily water, energy, cycle count and ambient yield ratio.
 * @throws Error if a sampled temperature is at or below absolute zero.
 *
 * @remarks Diagnostic fields (`adsorptionPotentialJPerMol`, `equilibriumLoadingKgPerKg`) report the
 * first sample of the series, so they line up with the instantaneous reading the weather card
 * displays; the production figures come from the whole series.
 */
export function calculateESAProductionFromSeries(
  series: HourlyAmbientSeries,
  nominalCapacityM3PerDay: number,
  params: ESAPhysicalParameters = DEFAULT_ESA_PARAMETERS
): ESAProductionResult {
  const hours = Math.min(series.temperatureC.length, series.relativeHumidityPct.length);
  const safeNominal = Math.max(0, nominalCapacityM3PerDay);

  const firstSample: AmbientConditions | null =
    hours > 0
      ? {
          temperatureC: series.temperatureC[0],
          relativeHumidityPct: series.relativeHumidityPct[0],
        }
      : null;

  if (hours === 0 || safeNominal === 0) {
    return emptyProductionResult(firstSample, params);
  }

  // Installed module count follows from the bench-anchored reference output (ADR 0003).
  const moduleCount = (safeNominal * 1000.0) / Math.max(params.referenceOutputKgPerDay, 1e-12);
  const cycles = simulateAcffModule(series, params);

  const dayEquivalents = hours / 24.0;
  const totalWaterKg =
    cycles.reduce((sum, cycle) => sum + cycle.collectedWaterKg, 0) * moduleCount;
  const totalEnergyKwh = cycles.reduce((sum, cycle) => sum + cycle.energyKwh, 0) * moduleCount;

  const dailyRateM3 = totalWaterKg / 1000.0 / dayEquivalents;
  const hourlyRateKg = totalWaterKg / hours;

  const potential = calculateAdsorptionPotential(firstSample as AmbientConditions);
  const loading = calculateEquilibriumLoading(
    firstSample as AmbientConditions,
    params,
    potential
  );

  return {
    hourlyRateLiters: roundTo(hourlyRateKg, 1),
    hourlyRateM3: roundTo(hourlyRateKg / 1000.0, 4),
    dailyRateM3: roundTo(dailyRateM3, 4),
    adsorptionPotentialJPerMol: roundTo(potential, 1),
    equilibriumLoadingKgPerKg: roundTo(loading, 4),
    ambientYieldRatio: roundTo(dailyRateM3 / safeNominal, 4),
    cyclesPerDay: roundTo(cycles.length / dayEquivalents, 4),
    energyKwhPerDay: roundTo(totalEnergyKwh / dayEquivalents, 2),
    integratedDays: Math.floor(dayEquivalents),
  };
}

/**
 * Calculates what a single steady ambient condition would yield.
 *
 * @summary Calculate ESA production for a held condition.
 * @description Holds one temperature and relative humidity across a multi-day horizon and
 * integrates, answering "what if it stayed like this". Demo scenario overrides supply a single
 * condition rather than a forecast, and this is their entry point.
 *
 * @param conditions - Ambient atmospheric conditions to hold constant.
 * @param nominalCapacityM3PerDay - Nominal rated capacity of the installed farm system in m³/day.
 * @param params - Calibrated physical ESA parameters (defaults to DEFAULT_ESA_PARAMETERS).
 * @returns ESAProductionResult for the steady regime.
 * @throws Error if temperature is at or below absolute zero.
 *
 * @remarks This is not the right entry point for a real forecast. A held afternoon reading reports
 * zero for a day that does produce, which is the defect ADR 0003 records; pass the hourly series to
 * `calculateESAProductionFromSeries` instead.
 */
export function calculateESAWaterProduction(
  conditions: AmbientConditions,
  nominalCapacityM3PerDay: number,
  params: ESAPhysicalParameters = DEFAULT_ESA_PARAMETERS
): ESAProductionResult {
  return calculateESAProductionFromSeries(
    buildConstantAmbientSeries(conditions, STEADY_STATE_HORIZON_DAYS),
    nominalCapacityM3PerDay,
    params
  );
}
