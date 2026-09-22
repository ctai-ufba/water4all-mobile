/**
 * @file supervisoryEngine.ts
 * @summary Calculation and validation engine for supervisory water control actions.
 * @description Provides business logic for external water truck ordering (with capacity clamping
 * and expense calculation), irrigation mode scaling (Auto, Eco deficit irrigation, Paused),
 * and manual pump transfers enforcing strict mass balance and overflow prevention.
 */

import {
  IrrigationMode,
  PumpTransferParams,
  PumpTransferResult,
  WaterTruckDeliveryResult,
  EXTERNAL_WATER_TRUCK_COST_EUR_PER_M3,
} from '../types/telemetry';
import { roundTo2Decimals } from './telemetryEngine';

/**
 * Deficit irrigation ratio applied during Eco mode (60% of baseline demand, saving 40%).
 */
export const ECO_IRRIGATION_RATIO = 0.6;

/**
 * Smallest volume the operator may move in a single manual pump transfer, in m³.
 *
 * @remarks This band is an operating limit on the supervisory interface, not a physical
 * constraint: validateAndExecutePumpTransfer accepts any positive volume the tanks can
 * sustain, so callers exposing manual transfers enforce the band themselves. Kept here so
 * the interface and its validation read the same numbers.
 */
export const MIN_MANUAL_TRANSFER_VOLUME_M3 = 0.1;

/**
 * Largest volume the operator may move in a single manual pump transfer, in m³.
 *
 * @remarks See {@link MIN_MANUAL_TRANSFER_VOLUME_M3} for why the engine does not enforce this.
 */
export const MAX_MANUAL_TRANSFER_VOLUME_M3 = 5.0;

/**
 * Calculates water added to external supply and incurred financial cost for a truck delivery.
 *
 * @summary Calculate water truck delivery.
 * @description Computes the actual volume added to the external tank, clamped by remaining
 * tank capacity. Calculates the billing cost based on the ordered volume (or delivered volume)
 * using the standard Mediterranean tariff.
 *
 * @param currentVolume - Current volume of water in external supply tank in m³.
 * @param capacity - Maximum physical storage capacity of external tank in m³.
 * @param deliveryVolumeM3 - Ordered delivery volume in m³ (+10 or +25 m³).
 * @param costPerM3 - Unit cost in EUR/m³ (defaults to EXTERNAL_WATER_TRUCK_COST_EUR_PER_M3).
 * @returns WaterTruckDeliveryResult containing delivered volume, new tank volume, cost, and capping flag.
 * @throws Never throws.
 */
export function calculateTruckDelivery(
  currentVolume: number,
  capacity: number,
  deliveryVolumeM3: number,
  costPerM3: number = EXTERNAL_WATER_TRUCK_COST_EUR_PER_M3
): WaterTruckDeliveryResult {
  // Available headroom in the external tank
  const availableHeadroom = Math.max(0, capacity - currentVolume);

  // Delivered volume is clamped by available capacity
  const actualAdded = Math.min(deliveryVolumeM3, availableHeadroom);
  const isCapped = deliveryVolumeM3 > availableHeadroom;

  // New storage volume
  const newVolume = roundTo2Decimals(currentVolume + actualAdded);

  // Financial expense is based on the ordered delivery volume
  const cost = roundTo2Decimals(deliveryVolumeM3 * costPerM3);

  return {
    deliveredM3: roundTo2Decimals(actualAdded),
    newVolumeM3: newVolume,
    addedCostEur: cost,
    isCapped,
  };
}

/**
 * Calculates adjusted crop irrigation demand based on active irrigation operational mode.
 *
 * @summary Calculate irrigation demand for mode.
 * @description Scales baseline crop irrigation demand:
 * - 'auto': Full baseline scheduled irrigation (100%).
 * - 'eco': Water-saving deficit irrigation (60% of baseline).
 * - 'paused': Crop irrigation suspended (0 m³/day).
 *
 * @param baselineIrrigationDemand - Pre-calibrated baseline irrigation demand in m³/day.
 * @param mode - Operational irrigation mode ('auto', 'eco', 'paused').
 * @returns Adjusted irrigation demand in m³/day, rounded to 2 decimal places.
 * @throws Never throws.
 */
export function calculateIrrigationDemand(
  baselineIrrigationDemand: number,
  mode: IrrigationMode
): number {
  switch (mode) {
    case 'auto':
      return roundTo2Decimals(baselineIrrigationDemand);
    case 'eco':
      // Deficit irrigation reduces water usage by 40%
      return roundTo2Decimals(baselineIrrigationDemand * ECO_IRRIGATION_RATIO);
    case 'paused':
      return 0;
    default:
      return roundTo2Decimals(baselineIrrigationDemand);
  }
}

/**
 * Validates and executes a manual pump transfer from Rainwater or ESA tank into the Blend tank.
 *
 * @summary Validate and execute pump transfer.
 * @description Validates transfer parameters:
 * 1. Transfer volume must be strictly greater than 0.
 * 2. Source tank must have sufficient water available to fulfill the transfer.
 * 3. Blend tank must have sufficient headroom capacity so that the transfer does not cause overflow.
 * If valid, updates source and Blend tank volumes ensuring strict mass balance conservation:
 * newSource = oldSource - volume, newBlend = oldBlend + volume.
 *
 * @param params - Transfer parameters including source tank, volume, current volumes, and capacities.
 * @returns PumpTransferResult indicating success, transferred volume, updated volumes, and error message if failed.
 * @throws Never throws.
 */
export function validateAndExecutePumpTransfer(
  params: PumpTransferParams
): PumpTransferResult {
  const { fromTank, volumeM3, currentVolumes, capacities } = params;

  // 1. Validate requested volume is positive
  if (volumeM3 <= 0) {
    return {
      success: false,
      transferredM3: 0,
      updatedVolumes: currentVolumes,
      errorMessage: 'Transfer volume must be greater than 0 m³.',
    };
  }

  // 2. Validate source tank availability
  const sourceAvailable = currentVolumes[fromTank];
  if (sourceAvailable < volumeM3) {
    return {
      success: false,
      transferredM3: 0,
      updatedVolumes: currentVolumes,
      errorMessage: `Insufficient volume in source tank. Available: ${sourceAvailable.toFixed(1)} m³, Requested: ${volumeM3.toFixed(1)} m³.`,
    };
  }

  // 3. Validate Blend tank capacity headroom (overflow prevention)
  const blendAvailableHeadroom = capacities.blend - currentVolumes.blend;
  if (volumeM3 > blendAvailableHeadroom) {
    return {
      success: false,
      transferredM3: 0,
      updatedVolumes: currentVolumes,
      errorMessage: `Transfer would exceed Blend tank capacity. Available headroom: ${blendAvailableHeadroom.toFixed(1)} m³, Requested: ${volumeM3.toFixed(1)} m³.`,
    };
  }

  // 4. Apply mass balance: strictly subtract from source and add to Blend tank
  const updatedVolumes = {
    ...currentVolumes,
    [fromTank]: roundTo2Decimals(currentVolumes[fromTank] - volumeM3),
    blend: roundTo2Decimals(currentVolumes.blend + volumeM3),
  };

  return {
    success: true,
    transferredM3: roundTo2Decimals(volumeM3),
    updatedVolumes,
  };
}

