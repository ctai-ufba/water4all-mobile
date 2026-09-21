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
 * Calculates the percentage of demand met by local sources and estimated daily financial savings.
 *
 * @summary Calculate water efficiency and cost savings.
 * @description Evaluates local self-sufficiency by comparing local inflow (Rainwater + ESA)
 * against total agricultural demand. Calculates avoided external delivery costs in EUR,
 * strictly bounded by the actual farm demand replaced.
 *
 * @param localInflow - Inflow from sustainable local sources (Rainwater + ESA) in m³/day.
 * @param totalDemand - Total daily consumption across all farm uses in m³/day.
 * @param costPerM3 - Unit cost of external water truck delivery in EUR/m³ (default: 4.50 €/m³).
 * @returns Object with localPercentage (0 to 100%) and dailySavingsEur (EUR/day).
 * @throws Never throws.
 */
export function calculateWaterEfficiency(
  localInflow: number,
  totalDemand: number,
  costPerM3: number = EXTERNAL_WATER_TRUCK_COST_EUR_PER_M3
): { localPercentage: number; dailySavingsEur: number } {
  let percentage: number;
  if (totalDemand <= 0) {
    percentage = localInflow > 0 ? 100 : 0;
  } else {
    // Cap percentage at 100% when local supply exceeds demand
    percentage = Math.min(100, Math.round((localInflow / totalDemand) * 100));
  }

  // Daily savings = avoided water truck purchases (only water that actually replaced demand generates savings)
  const replacedWater = Math.min(localInflow, Math.max(0, totalDemand));
  const savings = roundTo2Decimals(replacedWater * costPerM3);

  return {
    localPercentage: percentage,
    dailySavingsEur: savings,
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
  const { localPercentage, dailySavingsEur } = calculateWaterEfficiency(
    localInflow,
    totalConsumption
  );

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
