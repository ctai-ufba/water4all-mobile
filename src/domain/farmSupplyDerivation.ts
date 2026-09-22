/**
 * @file farmSupplyDerivation.ts
 * @summary Derives each farm's local water supply from the physics and catchment engines.
 * @description Turns a farm profile plus its climate normals into the ESA production, energy draw
 * and rainwater inflow it can actually expect, so no part of the app has to state those figures as
 * literals.
 *
 * @remarks This exists because hardcoded supply figures drift away from the physics that is
 * supposed to produce them. Before this module, the demo shipped ESA inflows of 1.4 and 3.2 m³/day
 * against nominal capacities that could not reach them, and a rainwater inflow implying 7.4 mm of
 * rain every day against a Mediterranean mean nearer 1.3 mm.
 *
 * Deliberately placed below `types/telemetry` in the import graph, and importing only the engines
 * and `types/farm`, so both the telemetry baselines and the demo engine can derive from one source
 * without a cycle.
 *
 * @example
 * ```ts
 * const supply = deriveAnnualMeanSupply('small-farm');
 * supply.esaInflowM3PerDay;       // ~0.27, against a 0.55 m³/day nominal
 * supply.rainwaterInflowM3PerDay; // ~0.44
 * supply.esaEnergyKwhPerDay;      // what those cycles drew
 * ```
 */

import { FarmId, FarmProfile, FARM_PROFILES } from '../types/farm';
import { calculateESAProductionFromSeries } from './esaPhysicsEngine';
import { generateSyntheticWeather } from './syntheticWeatherEngine';
import { calculateCatchmentInflow } from './catchmentEngine';
import { getClimateNormals } from './climatology';

/** Days integrated when deriving a farm's annual mean production. */
export const ANNUAL_DERIVATION_DAYS = 365;

/**
 * Anchors the annual derivation.
 *
 * @remarks A whole year is integrated from here, so the day chosen is immaterial; it is fixed only
 * to keep the derived baselines identical between runs.
 */
const ANNUAL_REFERENCE_DATE = new Date(Date.UTC(2026, 0, 1, 0, 0, 0));

/**
 * The local water supply a farm can expect as an annual mean.
 */
export interface AnnualMeanSupply {
  /** Mean ESA water production in m³/day */
  esaInflowM3PerDay: number;
  /** Electrical energy those ESA cycles drew, in kWh/day */
  esaEnergyKwhPerDay: number;
  /** Mean harvestable rainwater inflow in m³/day */
  rainwaterInflowM3PerDay: number;
  /** Share of ESA nominal capacity the annual mean represents (0 - 1) */
  ambientYieldRatio: number;
}

/**
 * Integrating a synthetic year is not free, and several modules want the same answer at load time,
 * so each farm's result is computed once.
 */
const supplyCache = new Map<FarmId, AnnualMeanSupply>();

/** Rounds to two decimal places, matching the precision flows are carried at. */
function roundTo2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Derives a farm's annual mean local water supply.
 *
 * @summary Derive annual mean ESA and rainwater supply.
 * @description Integrates a synthetic year of the farm's own climate through the ESA physics
 * engine, and runs the location's annual rainfall through the catchment engine.
 *
 * @param farmId - The farm to derive supply for.
 * @returns The farm's expected ESA production, energy draw and rainwater inflow.
 * @throws Never throws for a known farm id.
 *
 * @remarks Mediterranean air is far drier than the 25 °C / 90 % RH bench anchor that sets nominal
 * capacity, so ESA lands near 40 % of nominal. That is the physics, not a fault (ADR 0003).
 */
export function deriveAnnualMeanSupply(farmId: FarmId): AnnualMeanSupply {
  const cached = supplyCache.get(farmId);
  if (cached) {
    return cached;
  }

  const farm: FarmProfile = FARM_PROFILES[farmId];

  const series = generateSyntheticWeather(
    ANNUAL_REFERENCE_DATE,
    farmId,
    ANNUAL_DERIVATION_DAYS
  ).hourly;
  const esa = calculateESAProductionFromSeries(series, farm.esaNominalCapacityM3PerDay);

  const normals = getClimateNormals(farmId);
  const annualRainfallMm = normals.precipitationMm.reduce((sum, mm) => sum + mm, 0);
  const rainwater = calculateCatchmentInflow(
    annualRainfallMm / ANNUAL_DERIVATION_DAYS,
    farm.catchmentAreaM2
  );

  const supply: AnnualMeanSupply = {
    esaInflowM3PerDay: roundTo2(esa.dailyRateM3),
    esaEnergyKwhPerDay: esa.energyKwhPerDay,
    rainwaterInflowM3PerDay: rainwater.forecastInflowM3,
    ambientYieldRatio: esa.ambientYieldRatio,
  };

  supplyCache.set(farmId, supply);
  return supply;
}
