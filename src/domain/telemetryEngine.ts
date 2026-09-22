/**
 * @file telemetryEngine.ts
 * @summary Telemetry calculation and state consolidation engine.
 * @description Provides pure calculation functions for water storage summing,
 * daily water balance, water autonomy, local water efficiency, external truck savings,
 * and Blend tank threshold compliance for Mediterranean farm profiles.
 */

import { FarmProfile } from '../types/farm';
import {
  TankVolumeMetrics,
  WaterFlowMetrics,
  TelemetryState,
  getFarmBaseline,
  EXTERNAL_WATER_TRUCK_COST_EUR_PER_M3,
  ELECTRICITY_PRICE_EUR_PER_KWH,
  ESA_BENCH_SPECIFIC_ENERGY_KWH_PER_M3,
  IrrigationMode,
} from '../types/telemetry';

/**
 * Constant representing indefinite water autonomy in days when consumption is zero.
 */
export const INDEFINITE_AUTONOMY_DAYS = 999;

/**
 * Rounds a numeric value to two decimal places.
 *
 * @summary Round to 2 decimal places.
 * @description Rounds a number to two decimal places to avoid floating-point inaccuracies.
 *
 * @param value - The numeric value to round.
 * @returns The rounded number.
 * @throws Never throws.
 */
export function roundTo2Decimals(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Calculates the total stored water across all four farm reservoirs.
 *
 * @summary Sum total stored water.
 * @description Adds together the volumes of the Rainwater tank, ESA tank, External
 * supply tank, and Blend tank.
 *
 * @param volumes - Object containing individual reservoir volumes in m³.
 * @returns Total stored water in cubic meters (m³), rounded to 2 decimal places.
 * @throws Never throws.
 */
export function calculateTotalStored(volumes: TankVolumeMetrics): number {
  const sum = volumes.rainwater + volumes.esa + volumes.external + volumes.blend;
  return roundTo2Decimals(sum);
}

/**
 * Calculates the total daily water inflow entering the farm system.
 *
 * @summary Sum total daily inflow.
 * @description Adds together rainwater catchment, ESA atmospheric production,
 * and external deliveries.
 *
 * @param flows - Water flow rates in m³/day.
 * @returns Total daily inflow in m³/day, rounded to 2 decimal places.
 * @throws Never throws.
 */
export function calculateTotalInflow(flows: WaterFlowMetrics): number {
  const sum = flows.rainwaterInflow + flows.esaInflow + flows.externalInflow;
  return roundTo2Decimals(sum);
}

/**
 * Calculates the total daily water consumption across all farm demands.
 *
 * @summary Sum total daily consumption.
 * @description Adds together crop irrigation demand, human/utility demand,
 * and livestock drinking demand.
 *
 * @param flows - Water flow rates in m³/day.
 * @returns Total daily consumption in m³/day, rounded to 2 decimal places.
 * @throws Never throws.
 */
export function calculateTotalConsumption(flows: WaterFlowMetrics): number {
  const sum = flows.irrigationDemand + flows.humanUtilityDemand + flows.livestockDemand;
  return roundTo2Decimals(sum);
}

/**
 * Calculates estimated water autonomy in days under current consumption.
 *
 * @summary Calculate water autonomy in days.
 * @description Divides total stored water reserves by average daily consumption.
 * If consumption is zero or negative, returns INDEFINITE_AUTONOMY_DAYS (999) to indicate indefinite supply.
 * If stored volume is zero or negative, returns 0 days.
 *
 * @param totalStored - Total water volume currently stored in m³.
 * @param dailyConsumption - Total daily water consumption in m³/day.
 * @returns Autonomy in days rounded to 1 decimal place.
 * @throws Never throws.
 */
export function calculateWaterAutonomy(totalStored: number, dailyConsumption: number): number {
  if (totalStored <= 0) {
    return 0;
  }
  if (dailyConsumption <= 0) {
    // Indefinite autonomy when no consumption is occurring
    return INDEFINITE_AUTONOMY_DAYS;
  }
  const days = totalStored / dailyConsumption;
  return Math.round(days * 10) / 10;
}

/**
 * Calculates the net daily water balance and determines surplus or deficit.
 *
 * @summary Calculate daily water balance.
 * @description Computes net balance as (totalInflow - totalConsumption).
 * If net balance is greater than or equal to zero, marks the state as a surplus.
 *
 * @param totalInflow - Total water entering the system in m³/day.
 * @param totalConsumption - Total water leaving the system in m³/day.
 * @returns Object with netBalance in m³/day (rounded to 2 decimals) and isSurplus boolean flag.
 * @throws Never throws.
 */
export function calculateDailyBalance(
  totalInflow: number,
  totalConsumption: number
): { netBalance: number; isSurplus: boolean } {
  const net = roundTo2Decimals(totalInflow - totalConsumption);
  return {
    netBalance: net,
    isSurplus: net >= 0,
  };
}

/**
 * Inputs to the water efficiency and savings calculation.
 */
export interface WaterEfficiencyInputs {
  /** Inflow from sustainable local sources (Rainwater + ESA) in m³/day */
  localInflow: number;
  /** Total daily consumption across all farm uses in m³/day */
  totalDemand: number;
  /** ESA share of the local inflow in m³/day; drives the energy charge (defaults to 0) */
  esaInflow?: number;
  /**
   * Electrical energy the ESA unit actually drew in kWh/day.
   *
   * @remarks Supply this whenever the physics engine has computed it. Left out, the cost falls
   * back to `esaInflow` at the bench specific energy, which understates a real Mediterranean draw.
   */
  esaEnergyKwhPerDay?: number;
  /** Unit cost of external water truck delivery in EUR/m³ */
  costPerM3?: number;
  /** Unit cost of electricity in EUR/kWh */
  electricityPriceEurPerKwh?: number;
}

/**
 * Water efficiency and the two cost lines that make up net savings.
 */
export interface WaterEfficiencyResult {
  /** Percentage of demand satisfied by local sources (0 - 100%) */
  localPercentage: number;
  /** External truck purchases avoided by local water, in EUR/day (never negative) */
  avoidedTruckCostEur: number;
  /** Electricity drawn producing ESA water, in EUR/day (never negative) */
  esaEnergyCostEur: number;
  /** Net daily saving: avoided purchases less the energy drawn. Negative when ESA costs more
   * than the water it displaces, which in a Mediterranean climate it does. */
  dailySavingsEur: number;
}

/**
 * Calculates local self-sufficiency and the net daily financial effect of producing water on site.
 *
 * @summary Calculate water efficiency and net savings.
 * @description Compares local inflow (Rainwater + ESA) against total demand, credits the avoided
 * truck purchases that local water actually displaced, then deducts the electricity ESA drew to
 * produce its share.
 *
 * @param inputs - Inflows, demand, and the cost assumptions to apply.
 * @returns Local share plus the avoided-cost, energy-cost and net savings lines.
 * @throws Never throws.
 *
 * @remarks Crediting all local water at the truck price with no production cost presented the
 * farm's most expensive water as a pure saving. ESA water costs roughly 790 EUR/m³ in electricity
 * against 4.50 EUR/m³ for delivered water, so the honest net is normally negative; ESA earns its
 * place through autonomy where no truck reaches, not through price.
 */
export function calculateWaterEfficiency(inputs: WaterEfficiencyInputs): WaterEfficiencyResult {
  const {
    localInflow,
    totalDemand,
    esaInflow = 0,
    esaEnergyKwhPerDay,
    costPerM3 = EXTERNAL_WATER_TRUCK_COST_EUR_PER_M3,
    electricityPriceEurPerKwh = ELECTRICITY_PRICE_EUR_PER_KWH,
  } = inputs;

  let percentage: number;
  if (totalDemand <= 0) {
    percentage = localInflow > 0 ? 100 : 0;
  } else {
    // Cap percentage at 100% when local supply exceeds demand
    percentage = Math.min(100, Math.round((localInflow / totalDemand) * 100));
  }

  // Only water that actually replaced demand avoids a purchase.
  const replacedWater = Math.min(Math.max(0, localInflow), Math.max(0, totalDemand));
  const avoidedTruckCostEur = roundTo2Decimals(replacedWater * costPerM3);

  const safeEsaInflow = Math.max(0, esaInflow);
  const energyKwh =
    esaEnergyKwhPerDay !== undefined && Number.isFinite(esaEnergyKwhPerDay)
      ? Math.max(0, esaEnergyKwhPerDay)
      : safeEsaInflow * ESA_BENCH_SPECIFIC_ENERGY_KWH_PER_M3;
  const esaEnergyCostEur = roundTo2Decimals(energyKwh * electricityPriceEurPerKwh);

  return {
    localPercentage: percentage,
    avoidedTruckCostEur,
    esaEnergyCostEur,
    dailySavingsEur: roundTo2Decimals(avoidedTruckCostEur - esaEnergyCostEur),
  };
}

/**
 * Checks whether the Blend tank volume has dropped below the minimum operating volume.
 *
 * @summary Check Blend tank minimum operating volume.
 * @description Compares active Blend tank volume against the profile's minimum operating
 * volume. When breached, calculates the missing deficit volume in m³.
 *
 * @param blendVolume - Current water volume stored in Blend tank in m³.
 * @param minOperatingVolume - Minimum operating volume in m³.
 * @returns Object indicating whether the minimum volume is breached and the deficit in m³.
 * @throws Never throws.
 */
export function checkBlendOperatingVolume(
  blendVolume: number,
  minOperatingVolume: number
): { isBreached: boolean; deficitM3: number } {
  if (blendVolume < minOperatingVolume) {
    const deficit = roundTo2Decimals(minOperatingVolume - blendVolume);
    return {
      isBreached: true,
      deficitM3: deficit,
    };
  }
  return {
    isBreached: false,
    deficitM3: 0,
  };
}

/**
 * Consolidates volume metrics and flow rates into a complete TelemetryState object.
 *
 * @summary Consolidate farm telemetry state.
 * @description Aggregates raw tank volumes and flow rates with computed water autonomy,
 * daily water balance, local water efficiency, financial savings, Blend tank alarms,
 * active irrigation mode, and cumulative water truck delivery expenses.
 *
 * @param farm - Mediterranean farm profile providing capacity constraints and thresholds.
 * @param volumes - Active reservoir volumes in m³.
 * @param flows - Active flow rates in m³/day.
 * @param irrigationMode - Operational mode of the farm irrigation network (defaults to 'auto').
 * @param cumulativeTruckDeliveryCostEur - Cumulative external truck costs in EUR (defaults to 0).
 * @returns Consolidated TelemetryState object.
 * @throws Never throws.
 */
export function computeTelemetryState(
  farm: FarmProfile,
  volumes: TankVolumeMetrics,
  flows: WaterFlowMetrics,
  irrigationMode: IrrigationMode = 'auto',
  cumulativeTruckDeliveryCostEur: number = 0
): TelemetryState {
  const totalStoredVolume = calculateTotalStored(volumes);
  const totalInflow = calculateTotalInflow(flows);
  const totalConsumption = calculateTotalConsumption(flows);
  const waterAutonomyDays = calculateWaterAutonomy(totalStoredVolume, totalConsumption);
  const { netBalance, isSurplus } = calculateDailyBalance(totalInflow, totalConsumption);

  // Local inflow consists of sustainable Rainwater and ESA production
  const localInflow = flows.rainwaterInflow + flows.esaInflow;
  const { localPercentage, dailySavingsEur, avoidedTruckCostEur, esaEnergyCostEur } =
    calculateWaterEfficiency({
      localInflow,
      totalDemand: totalConsumption,
      esaInflow: flows.esaInflow,
      esaEnergyKwhPerDay: flows.esaEnergyKwhPerDay,
    });

  const { isBreached, deficitM3 } = checkBlendOperatingVolume(
    volumes.blend,
    farm.tankCapacities.minOperatingVolume
  );

  return {
    tankVolumes: volumes,
    flows,
    totalStoredVolume,
    totalInflow,
    totalConsumption,
    waterAutonomyDays,
    netBalance,
    isSurplus,
    localWaterPercentage: localPercentage,
    dailySavingsEur,
    avoidedTruckCostEur,
    esaEnergyCostEur,
    isBelowMinOperatingVolume: isBreached,
    blendDeficitM3: deficitM3,
    irrigationMode,
    cumulativeTruckDeliveryCostEur,
  };
}

/**
 * Generates the pre-calibrated baseline telemetry state for a given Mediterranean farm profile.
 *
 * @summary Get baseline telemetry for farm.
 * @description Retrieves baseline volumes and flow rates defined for the profile ID
 * and computes the initial consolidated TelemetryState.
 *
 * @param farm - Active Mediterranean farm profile.
 * @returns Consolidated baseline TelemetryState.
 * @throws Never throws.
 */
export function getBaselineTelemetry(farm: FarmProfile): TelemetryState {
  const baseline = getFarmBaseline(farm.id);
  return computeTelemetryState(farm, baseline.volumes, baseline.flows);
}
