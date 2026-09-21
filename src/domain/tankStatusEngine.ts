/**
 * @file tankStatusEngine.ts
 * @summary Calculation and status determination engine for farm water storage tanks.
 * @description Provides pure calculation functions for total farm storage capacity,
 * tank fill percentages, threshold-based alert levels (normal, warning, critical/depleted),
 * and dynamic human-readable source activity indicators for Rainwater, ESA, External, and Blend tanks.
 */

import { TankCapacities } from '../types/farm';

/**
 * Enumeration of the four core water storage tank types on the farm.
 */
export type TankType = 'rainwater' | 'esa' | 'external' | 'blend';

/**
 * Alert severity levels for water storage tanks.
 */
export type TankAlertLevel = 'critical' | 'warning' | 'normal';

/**
 * Result object describing the operational status and visual badges for a tank.
 */
export interface TankSourceStatusResult {
  /** Human-readable status title (e.g., 'Capturing Rain', 'Standby') */
  statusText: string;
  /** Detailed operational description with flow metrics */
  description: string;
  /** Whether the source is actively flowing (inflow or outflow > 0) */
  isActive: boolean;
  /** Color theme variant for status badges and indicators */
  badgeVariant: 'emerald' | 'cyan' | 'amber' | 'rose' | 'slate';
}

/**
 * Calculates the total water storage capacity across all four farm reservoirs.
 *
 * @summary Calculate total farm storage capacity.
 * @description Sums the individual volume capacities of the Rainwater tank,
 * ESA tank, External supply tank, and Blend tank in cubic meters (m³).
 *
 * @param capacities - Object containing individual reservoir capacities.
 * @returns Total storage capacity in m³, rounded to 1 decimal place.
 * @throws Never throws; bounds negative capacities to zero.
 */
export function calculateTotalStorageCapacity(capacities: TankCapacities): number {
  // Sum individual tank capacities, ensuring non-negative values
  const total =
    Math.max(0, capacities.rainwater) +
    Math.max(0, capacities.esa) +
    Math.max(0, capacities.external) +
    Math.max(0, capacities.blend);

  // Round to 1 decimal place to avoid floating point representation issues
  return Math.round(total * 10) / 10;
}

/**
 * Calculates the fill percentage of a water tank.
 *
 * @summary Calculate tank fill percentage.
 * @description Divides current volume by total capacity, scales to a percentage (0 - 100%),
 * clamps to [0, 100], and rounds to 1 decimal place. Returns 0 if capacity is 0.
 *
 * @param volume - Current water volume stored in the tank in m³.
 * @param capacity - Total storage capacity of the tank in m³.
 * @returns Fill percentage between 0.0% and 100.0%.
 * @throws Never throws.
 */
export function calculateTankFillPercentage(volume: number, capacity: number): number {
  // Prevent division by zero if capacity is non-positive
  if (capacity <= 0) {
    return 0;
  }

  // Clamp raw percentage between 0% and 100%
  const clampedVolume = Math.min(capacity, Math.max(0, volume));
  const percentage = (clampedVolume / capacity) * 100;

  // Round to 1 decimal place
  return Math.round(percentage * 10) / 10;
}

/**
 * Evaluates the alert severity level of a water tank based on its current volume and thresholds.
 *
 * @summary Determine tank alert level.
 * @description Evaluates whether a tank is in 'critical', 'warning', or 'normal' condition:
 * - Critical: Tank is empty (volume <= 0), or volume is below 15% of capacity (or below minOperatingVolume for Blend tank).
 * - Warning: Volume is below 30% of capacity (or below 75% of target volume for Blend tank).
 * - Normal: Volume is comfortably above warning thresholds.
 *
 * @param tankType - Identifier of the tank being evaluated.
 * @param volume - Current water volume stored in m³.
 * @param capacity - Total capacity of the tank in m³.
 * @param minOperatingVolume - Optional minimum operating volume threshold (specifically for Blend tank).
 * @returns Alert severity level: 'critical', 'warning', or 'normal'.
 * @throws Never throws.
 */
export function getTankAlertLevel(
  tankType: TankType,
  volume: number,
  capacity: number,
  minOperatingVolume?: number
): TankAlertLevel {
  // Check for complete depletion or non-positive volume
  if (volume <= 0) {
    return 'critical';
  }

  // Special threshold evaluation for central Blend tank
  if (tankType === 'blend' && minOperatingVolume !== undefined) {
    // If blend tank drops below minimum operating volume, it triggers a critical alert
    if (volume < minOperatingVolume) {
      return 'critical';
    }
    // If below 30% capacity, flag as warning
    if (capacity > 0 && volume < capacity * 0.3) {
      return 'warning';
    }
    return 'normal';
  }

  // Standard threshold evaluation for source tanks (Rainwater, ESA, External)
  if (capacity > 0) {
    // Volume below 15% of capacity is critically low
    if (volume < capacity * 0.15) {
      return 'critical';
    }
    // Volume below 30% of capacity is a low-level warning
    if (volume < capacity * 0.3) {
      return 'warning';
    }
  }

  return 'normal';
}

/**
 * Configuration schema for tank status descriptions and badges.
 */
interface TankStatusConfig {
  activeTitle: string;
  activeDescription: (flowRate: number, isDepleted: boolean) => string;
  activeBadge: 'cyan' | 'emerald';
  idleTitle: string;
  idleDescription: string;
  depletedDescription: string;
}

/**
 * Pre-configured status text templates and badge styles for each tank type.
 */
const TANK_STATUS_CONFIGS: Record<TankType, TankStatusConfig> = {
  rainwater: {
    activeTitle: 'Capturing Rain',
    activeDescription: (flow, isDepleted) =>
      `Harvesting precipitation at +${flow.toFixed(1)} m³/day${isDepleted ? ' (filling depleted tank)' : ''}`,
    activeBadge: 'cyan',
    idleTitle: 'Standby (No Rain)',
    idleDescription: 'Dry conditions. Rainwater stored for irrigation.',
    depletedDescription: 'Catchment reservoir depleted. Awaiting rainfall.',
  },
  esa: {
    activeTitle: 'Generating Water',
    activeDescription: (flow, isDepleted) =>
      `Air moisture condensation at +${flow.toFixed(1)} m³/day${isDepleted ? ' (filling depleted tank)' : ''}`,
    activeBadge: 'emerald',
    idleTitle: 'Standby (Generator Idle)',
    idleDescription: 'Atmospheric generator in standby cycle.',
    depletedDescription: 'ESA storage empty. Generator awaiting conditions.',
  },
  external: {
    activeTitle: 'Receiving Delivery',
    activeDescription: (flow, isDepleted) =>
      `Water truck / connection inflow at +${flow.toFixed(1)} m³/day${isDepleted ? ' (filling depleted tank)' : ''}`,
    activeBadge: 'emerald',
    idleTitle: 'Holding Reserve',
    idleDescription: 'External water held as backup for peak irrigation.',
    depletedDescription: 'External reserve depleted. Replenishment recommended.',
  },
  blend: {
    activeTitle: 'Distributing Water',
    activeDescription: (flow) =>
      `Supplying farm irrigation at -${flow.toFixed(1)} m³/day`,
    activeBadge: 'cyan',
    idleTitle: 'Holding Blend',
    idleDescription: 'Irrigation scheduled or paused. Stored water ready.',
    depletedDescription: 'Blend tank completely empty. Irrigation suspended.',
  },
};

/**
 * Determines the active source activity status and badge styling for a given tank.
 *
 * @summary Format tank active source status.
 * @description Generates a human-friendly description of current source behavior:
 * - Rainwater: Capturing rain (+X.X m³/day) when raining, or Standby.
 * - ESA: Generating water (+X.X m³/day) when operating, or Generator Idle.
 * - External: Receiving delivery (+X.X m³/day), or Holding Reserve.
 * - Blend: Distributing water (-X.X m³/day) to crops, or Holding Blend.
 * Active flow takes precedence over empty tank volume, showing active capture while filling.
 *
 * @param tankType - The type of tank.
 * @param flowRate - Active inflow rate for source tanks, or consumption/outflow rate for Blend tank (m³/day).
 * @param volume - Current water volume stored in the tank in m³.
 * @returns TankSourceStatusResult object with status text, description, active flag, and badge color.
 * @throws Never throws.
 */
export function getTankSourceStatus(
  tankType: TankType,
  flowRate: number,
  volume: number
): TankSourceStatusResult {
  const isDepleted = volume <= 0;
  const isFlowing = flowRate > 0;
  const config = TANK_STATUS_CONFIGS[tankType];

  // Active flow takes precedence to indicate dynamic incoming or outgoing water
  if (isFlowing) {
    return {
      statusText: config.activeTitle,
      description: config.activeDescription(flowRate, isDepleted),
      isActive: true,
      badgeVariant: config.activeBadge,
    };
  }

  // When no flow is occurring and the tank has no water, report depleted
  if (isDepleted) {
    return {
      statusText: 'Depleted (Empty)',
      description: config.depletedDescription,
      isActive: false,
      badgeVariant: 'rose',
    };
  }

  // Default idle/standby status when water is stored but no active flow
  return {
    statusText: config.idleTitle,
    description: config.idleDescription,
    isActive: false,
    badgeVariant: 'slate',
  };
}

