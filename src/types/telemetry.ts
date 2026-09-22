/**
 * @file telemetry.ts
 * @summary Telemetry metrics and state definitions for farm water monitoring.
 * @description Defines interfaces and baseline constants for tank volumes,
 * water flows, derived autonomy metrics, and daily balance.
 */

import { FarmId } from './farm';

/**
 * Standard unit cost of external water truck deliveries in Mediterranean districts (EUR/m³).
 */
export const EXTERNAL_WATER_TRUCK_COST_EUR_PER_M3 = 4.50;

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
  capacities: {
    rainwater: number;
    esa: number;
    external: number;
    blend: number;
  };
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
  /** Estimated daily financial savings compared to external water truck delivery in EUR */
  dailySavingsEur: number;
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
 * Pre-calibrated baseline telemetry metrics for each Mediterranean farm profile.
 */
export const BASELINE_TELEMETRY: Record<FarmId, FarmBaselineData> = {
  'small-farm': {
    volumes: {
      rainwater: 28.5,
      esa: 8.2,
      external: 14.0,
      blend: 26.5,
    },
    flows: {
      rainwaterInflow: 2.4,
      esaInflow: 1.2,
      externalInflow: 0.0,
      irrigationDemand: 2.1,
      humanUtilityDemand: 0.5,
      livestockDemand: 0.0,
    },
  },
  'medium-farm': {
    volumes: {
      rainwater: 74.0,
      esa: 18.5,
      external: 35.0,
      blend: 62.0,
    },
    flows: {
      rainwaterInflow: 4.5,
      esaInflow: 2.8,
      externalInflow: 1.5,
      irrigationDemand: 5.8,
      humanUtilityDemand: 0.8,
      livestockDemand: 1.4,
    },
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

