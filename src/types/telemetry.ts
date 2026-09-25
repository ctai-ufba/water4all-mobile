/**
 * @file telemetry.ts
 * @summary Telemetry metrics and state definitions for farm water monitoring.
 * @description Defines interfaces and baseline constants for tank volumes,
 * water flows, derived autonomy metrics, and daily balance.
 */

import { FarmId, TankCapacities } from './farm';
import { ESA_SPECIFIC_ENERGY_KWH_PER_M3 } from './weather';
import { deriveAnnualMeanSupply } from '../domain/farmSupplyDerivation';

/**
 * Standard unit cost of external water truck deliveries in Mediterranean districts (EUR/m³).
 */
export const EXTERNAL_WATER_TRUCK_COST_EUR_PER_M3 = 4.50;

/**
 * Electricity price used to cost ESA production (EUR/kWh).
 *
 * @remarks Adopted verbatim from the calibration authority's `electricity_price_usd_per_kwh`
 * (`prototipo_water4all/src/h2o_farm/economics.py:40`). That figure is denominated in USD and is
 * carried here as EUR one-for-one, a stated simplification that keeps the number traceable to the
 * prototype rather than pinned to a floating exchange rate.
 */
export const ELECTRICITY_PRICE_EUR_PER_KWH = 0.17;

/**
 * Specific energy of ESA water production at the bench measurement (kWh/m³).
 *
 * @remarks Re-exported from `ESA_SPECIFIC_ENERGY_KWH_PER_M3`, which is where the figure is defined;
 * this alias exists only so cost code reads in the units it works in.
 *
 * This is a floor, not the typical figure. Each cycle draws a fixed regeneration charge whatever it
 * recovers, so in Mediterranean air, where a cycle collects well under the bench yield, realised
 * specific energy runs closer to 7300 kWh/m³. Callers holding a simulated `energyKwhPerDay` should
 * pass it rather than relying on this constant.
 */
export const ESA_BENCH_SPECIFIC_ENERGY_KWH_PER_M3 = ESA_SPECIFIC_ENERGY_KWH_PER_M3;

/**
 * Physical water volumes stored across individual reservoirs in cubic meters (m³).
 */
export interface TankVolumeMetrics {
  /** Water stored in Rainwater catchment reservoir in m³ */
  rainwater: number;
  /** Water stored in ESA (atmospheric water generator) reservoir in m³ */
  esa: number;
  /** Water stored in External supply holding reservoir in m³ */
  external: number;
  /** Water stored in Blend tank in m³ */
  blend: number;
}

/** One daily observation used by the seven-day telemetry trends. */
export interface HistoricalTelemetryDay {
  /** Calendar day in UTC, YYYY-MM-DD. */
  date: string;
  /** Water entering the farm during this day or simulated part-day, in m³. */
  inflow: number;
  /** Water used during this day or simulated part-day, in m³. */
  consumption: number;
  /** Inflow minus consumption, in m³. */
  netBalance: number;
  /** Physical storage at the observation time, in m³. */
  tankVolumes: TankVolumeMetrics;
  /** ESA water produced during this day or simulated part-day, in m³. */
  esaYield: number;
  /** Seeded complete-day value or accumulated simulated interval. */
  source: 'seed' | 'simulated';
}

/**
 * Water flow rates and agricultural demands in cubic meters per day (m³/day).
 */
export interface WaterFlowMetrics {
  /** Daily inflow captured from rainfall in m³/day */
  rainwaterInflow: number;
  /** Daily inflow produced by ESA atmospheric generator in m³/day */
  esaInflow: number;
  /** Daily inflow delivered by external connection or water truck in m³/day */
  externalInflow: number;
  /** Daily water demand consumed by crop irrigation in m³/day */
  irrigationDemand: number;
  /** Daily water demand consumed by farmhouse and utility services in m³/day */
  humanUtilityDemand: number;
  /** Daily water demand consumed by farm animals and livestock in m³/day */
  livestockDemand: number;
  /**
   * Electrical energy the ESA unit drew over the day, in kWh/day.
   *
   * @remarks Optional because the demo's static baselines predate the physics engine. When the
   * ESA engine has integrated a forecast, pass its figure: the bench-derived fallback understates
   * a real Mediterranean draw, where each cycle collects far less than the bench yield while still
   * paying the fixed regeneration charge.
   */
  esaEnergyKwhPerDay?: number;
}

/**
 * Operational mode of the farm irrigation network.
 * - 'auto': Scheduled automated irrigation at baseline demand.
 * - 'eco': Water-saving deficit irrigation (reduced demand).
 * - 'paused': Irrigation completely suspended (0 m³/day).
 */
export type IrrigationMode = 'auto' | 'eco' | 'paused';

/**
 * Result payload returned from an external water truck delivery request.
 */
export interface WaterTruckDeliveryResult {
  /** Delivered volume in m³ added to external supply tank */
  deliveredM3: number;
  /** Financial expense logged for the delivery in EUR */
  addedCostEur: number;
  /** Whether the delivery had to be capped at the tank's maximum capacity */
  isCapped: boolean;
  /** Updated external tank volume in m³ */
  newVolumeM3: number;
}

/**
 * Eligible source storage tanks for manual pump transfers into the Blend tank.
 */
export type TransferSourceTank = 'rainwater' | 'esa';

/**
 * Parameters required to execute a manual pump transfer.
 */
export interface PumpTransferParams {
  /** Source tank to pump water from */
  fromTank: TransferSourceTank;
  /** Target volume to transfer into the Blend tank in m³ */
  volumeM3: number;
  /** Current volumes across all tanks in m³ */
  currentVolumes: TankVolumeMetrics;
  /** Physical capacities across all tanks in m³ */
  capacities: TankCapacities;
}

/**
 * Result payload returned from a manual pump transfer execution.
 */
export interface PumpTransferResult {
  /** Whether the transfer passed validation and was executed successfully */
  success: boolean;
  /** Volume in m³ successfully transferred into the Blend tank */
  transferredM3: number;
  /** Updated tank volumes after applying mass balance */
  updatedVolumes: TankVolumeMetrics;
  /** Error message describing validation failure, if any */
  errorMessage?: string;
}

/**
 * Complete consolidated telemetry state for an active farm.
 */
export interface TelemetryState {
  /** Active physical storage volumes in m³ */
  tankVolumes: TankVolumeMetrics;
  /** Active daily inflow and consumption flow rates in m³/day */
  flows: WaterFlowMetrics;
  /** Total water physically stored across all reservoirs in m³ */
  totalStoredVolume: number;
  /** Total daily inflow into the farm water system in m³/day */
  totalInflow: number;
  /** Total daily consumption across all agricultural and human uses in m³/day */
  totalConsumption: number;
  /** Estimated water autonomy in days under current consumption */
  waterAutonomyDays: number;
  /** Net daily water balance (totalInflow - totalConsumption) in m³/day */
  netBalance: number;
  /** Flag indicating whether the farm is in a daily water surplus (true) or deficit (false) */
  isSurplus: boolean;
  /** Percentage of farm demand satisfied by local sources (Rainwater + ESA) (0 - 100%) */
  localWaterPercentage: number;
  /** Net daily financial effect: avoided truck purchases less ESA electricity, in EUR/day */
  dailySavingsEur: number;
  /** External truck purchases avoided by local water, in EUR/day */
  avoidedTruckCostEur: number;
  /** Electricity drawn producing ESA water, in EUR/day */
  esaEnergyCostEur: number;
  /** Flag indicating whether the Blend tank has dropped below minimum operating volume */
  isBelowMinOperatingVolume: boolean;
  /** Deficit volume below minimum operating volume if breached, otherwise 0 m³ */
  blendDeficitM3: number;
  /** Active operational mode of the irrigation network */
  irrigationMode: IrrigationMode;
  /** Cumulative financial expense incurred from external water truck deliveries in EUR */
  cumulativeTruckDeliveryCostEur: number;
}

/**
 * Pre-calibrated baseline storage volumes and flow rates for a farm profile.
 */
export interface FarmBaselineData {
  /** Baseline storage volumes across reservoirs in m³ */
  volumes: TankVolumeMetrics;
  /** Baseline inflow and consumption flow rates in m³/day */
  flows: WaterFlowMetrics;
}

/**
 * Snapshot payload representing a farm telemetry state configuration for snapshots and overrides.
 */
export interface TelemetrySnapshot {
  /** Physical storage volumes in m³ across all reservoirs */
  volumes: TankVolumeMetrics;
  /** Inflow and consumption flow rates in m³/day */
  flows?: WaterFlowMetrics;
  /** Cumulative water truck delivery expense in EUR */
  cumulativeTruckCost?: number;
  /** Active operational mode of the irrigation network */
  irrigationMode?: IrrigationMode;
  /**
   * Scheduled crop irrigation demand in m³/day before irrigation-mode scaling.
   *
   * @remarks This is what the irrigation schedule calls for, which an unoptimized farm sets
   * above its profile baseline. Omit it to keep the farm's calibrated baseline. The effective
   * demand in flows.irrigationDemand is always derived from this and irrigationMode, never set
   * independently.
   */
  scheduledIrrigationDemand?: number;
}

/**
 * Builds a farm's baseline inflows from the physics and catchment engines.
 *
 * @remarks Local inflows are derived, never stated. Written as literals they drifted past what the
 * hardware can produce: the previous baseline claimed 1.2 and 2.8 m³/day of ESA water against
 * nominal capacities of 0.55 and 1.58, so the state the app booted into was physically impossible.
 * External supply closes whatever gap remains, which at this scale is most of it.
 */
function buildBaselineFlows(
  farmId: FarmId,
  irrigationDemand: number,
  humanUtilityDemand: number,
  livestockDemand: number
): WaterFlowMetrics {
  const supply = deriveAnnualMeanSupply(farmId);
  const totalDemand = irrigationDemand + humanUtilityDemand + livestockDemand;
  const localInflow = supply.rainwaterInflowM3PerDay + supply.esaInflowM3PerDay;

  return {
    rainwaterInflow: supply.rainwaterInflowM3PerDay,
    esaInflow: supply.esaInflowM3PerDay,
    esaEnergyKwhPerDay: supply.esaEnergyKwhPerDay,
    externalInflow: Math.max(0, Math.round((totalDemand - localInflow) * 100) / 100),
    irrigationDemand,
    humanUtilityDemand,
    livestockDemand,
  };
}

/**
 * Pre-calibrated baseline telemetry metrics for each Mediterranean farm profile.
 */
export const BASELINE_TELEMETRY: Record<FarmId, FarmBaselineData> = {
  'small-farm': {
    volumes: {
      rainwater: 28.5,
      esa: 1.1,
      external: 14.0,
      blend: 26.5,
    },
    flows: buildBaselineFlows('small-farm', 2.1, 0.5, 0.0),
  },
  'medium-farm': {
    volumes: {
      rainwater: 74.0,
      esa: 3.2,
      external: 35.0,
      blend: 62.0,
    },
    flows: buildBaselineFlows('medium-farm', 5.8, 0.8, 1.4),
  },
};

/**
 * Retrieves the pre-calibrated baseline telemetry for a Mediterranean farm profile.
 *
 * @summary Lookup baseline telemetry.
 * @description Returns the baseline tank volumes and flow rates for the given farm ID,
 * falling back to the small-farm profile if not recognized.
 *
 * @param farmId - Unique farm identifier.
 * @returns Object containing baseline reservoir volumes and flow rates.
 * @throws Never throws.
 */
export function getFarmBaseline(farmId: FarmId): FarmBaselineData {
  return BASELINE_TELEMETRY[farmId] ?? BASELINE_TELEMETRY['small-farm'];
}

