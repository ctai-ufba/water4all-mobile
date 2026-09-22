/**
 * @file TelemetryContext.tsx
 * @summary Telemetry state management context for farm water monitoring.
 * @description Provides the React context and provider for managing active tank volumes,
 * water flow rates, derived water autonomy metrics, daily balance, and threshold alarms.
 * Synchronizes automatically with the active farm profile from AuthContext.
 */

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useMemo,
  ReactNode,
} from 'react';
import { useAuth } from './AuthContext';
import { FarmId } from '../types/farm';
import {
  TankVolumeMetrics,
  WaterFlowMetrics,
  TelemetryState,
  getFarmBaseline,
  IrrigationMode,
  PumpTransferResult,
  WaterTruckDeliveryResult,
  TransferSourceTank,
  TelemetrySnapshot,
} from '../types/telemetry';
import { computeTelemetryState } from '../domain/telemetryEngine';
import {
  calculateTruckDelivery,
  calculateIrrigationDemand,
  validateAndExecutePumpTransfer,
} from '../domain/supervisoryEngine';

/**
 * Interface defining the TelemetryContext shape and dispatch methods.
 */
export interface TelemetryContextType {
  /** Consolidated active telemetry state, or null if no farm is authenticated */
  telemetry: TelemetryState | null;
  /**
   * Updates one or more reservoir volumes and recomputes consolidated telemetry.
   *
   * @summary Update tank volumes.
   * @description Modifies physical tank storage volumes and re-evaluates autonomy,
   * balance, and threshold breach states.
   *
   * @param updater - New volume metrics or functional updater based on previous volumes.
   * @returns void
   * @throws Never throws.
   */
  setTankVolumes: (
    updater: TankVolumeMetrics | ((prev: TankVolumeMetrics) => TankVolumeMetrics)
  ) => void;
  /**
   * Updates one or more water flow rates and recomputes consolidated telemetry.
   *
   * @summary Update water flows.
   * @description Modifies inflow or consumption flow rates and re-evaluates balance,
   * autonomy, and local efficiency.
   *
   * @param updater - New flow metrics or functional updater based on previous flows.
   * @returns void
   * @throws Never throws.
   */
  setFlows: (
    updater: WaterFlowMetrics | ((prev: WaterFlowMetrics) => WaterFlowMetrics)
  ) => void;
  /**
   * Switches the active farm irrigation operational mode.
   *
   * @summary Set irrigation mode.
   * @description Updates irrigationMode ('auto', 'eco', 'paused'), recalculates
   * daily irrigation demand according to mode ratio, and re-evaluates telemetry.
   *
   * @param mode - Target irrigation mode.
   * @returns void
   * @throws Never throws.
   */
  setIrrigationMode: (mode: IrrigationMode) => void;
  /**
   * Dispatches an external water truck delivery request for emergency replenishment.
   *
   * @summary Request water truck delivery.
   * @description Adds +10 m³ or +25 m³ to the External supply tank, capped at physical
   * capacity, and records the simulated financial expense.
   *
   * @param volumeM3 - Delivery volume to order (+10 or +25 m³).
   * @returns WaterTruckDeliveryResult with delivered volume and cost details.
   * @throws Never throws.
   */
  requestWaterTruck: (volumeM3: 10 | 25) => WaterTruckDeliveryResult;
  /**
   * Executes a manual pump transfer from Rainwater or ESA tank into the Blend tank.
   *
   * @summary Execute manual pump transfer.
   * @description Validates source availability and Blend tank headroom, then updates
   * storage volumes ensuring strict mass balance conservation.
   *
   * @param fromTank - Source tank ('rainwater' or 'esa').
   * @param volumeM3 - Volume to transfer in m³.
   * @returns PumpTransferResult indicating success, transferred volume, or error message.
   * @throws Never throws.
   */
  executePumpTransfer: (
    fromTank: TransferSourceTank,
    volumeM3: number
  ) => PumpTransferResult;
  /**
   * Resets active telemetry to the pre-calibrated baseline of the active farm profile.
   *
   * @summary Reset telemetry to baseline.
   * @description Restores default reservoir volumes and flow rates for the current profile.
   *
   * @returns void
   * @throws Never throws.
   */
  resetToBaseline: () => void;
  /**
   * Atomically applies a telemetry snapshot (volumes, flows, truck costs, and irrigation mode).
   *
   * @summary Apply telemetry snapshot.
   * @description Sets reservoir volumes, water flows, cumulative truck costs, and irrigation
   * mode in a single coordinated transition, persisting values to localStorage.
   *
   * @param snapshot - Complete or partial telemetry snapshot to apply.
   * @returns void
   * @throws Never throws.
   */
  applySnapshot: (snapshot: TelemetrySnapshot) => void;
}

const TelemetryContext = createContext<TelemetryContextType | undefined>(undefined);

/** Storage key prefix for persisting farm telemetry state in localStorage */
const STORAGE_KEY_PREFIX = 'water4all_telemetry_';

/**
 * Reads one telemetry slot from localStorage.
 *
 * @summary Read a telemetry slot.
 * @description Returns the stored value, or the fallback when nothing is stored or the stored
 * value cannot be parsed.
 *
 * @param farmId - Farm profile the slot belongs to.
 * @param slot - Telemetry slot being read.
 * @param fallback - Value to use when nothing usable is stored.
 * @returns Parsed stored value, or the fallback.
 * @throws Never throws.
 */
function readSlot<T>(farmId: FarmId, slot: TelemetrySlot, fallback: T): T {
  return loadPersisted(storageKey(farmId, slot), fallback);
}

/**
 * Independently persisted slots of a farm's telemetry state.
 *
 * @remarks Declared as a list rather than a union so that operations covering the whole of a
 * farm's persisted state, such as resetToBaseline, iterate it instead of enumerating slots by
 * hand and drifting the day a slot is added.
 */
const TELEMETRY_SLOTS = [
  'volumes',
  'flows',
  'irrigationMode',
  'scheduledIrrigation',
  'truckCost',
] as const;

type TelemetrySlot = (typeof TELEMETRY_SLOTS)[number];

/**
 * Builds the localStorage key holding one slot of one farm's telemetry.
 *
 * @summary Telemetry storage key.
 * @description Composes the shared prefix, the farm identifier, and the slot name.
 *
 * @remarks Every read, write and removal goes through this, so the key scheme lives in one
 * place and renaming a slot cannot leave a stale key behind at some other call site.
 *
 * @param farmId - Farm profile the slot belongs to.
 * @param slot - Telemetry slot being addressed.
 * @returns Fully qualified localStorage key.
 * @throws Never throws.
 */
function storageKey(farmId: FarmId, slot: TelemetrySlot): string {
  return `${STORAGE_KEY_PREFIX}${farmId}_${slot}`;
}

/**
 * Writes one telemetry slot to localStorage.
 *
 * @summary Persist a telemetry slot.
 * @description Serializes the value and stores it under the slot's key.
 *
 * @remarks Storage is unavailable in private browsing and can throw when the quota is
 * exhausted. Persistence is a convenience here, never a correctness requirement, so a failure
 * is warned about and swallowed rather than propagated into the render path.
 *
 * @param farmId - Farm profile the slot belongs to.
 * @param slot - Telemetry slot being written.
 * @param value - Value to serialize.
 * @returns void
 * @throws Never throws.
 */
function persistSlot(farmId: FarmId, slot: TelemetrySlot, value: unknown): void {
  try {
    localStorage.setItem(storageKey(farmId, slot), JSON.stringify(value));
  } catch (error) {
    console.warn(`Failed to persist ${slot} to localStorage:`, error);
  }
}

/**
 * Removes one telemetry slot from localStorage.
 *
 * @summary Clear a telemetry slot.
 * @description Deletes the stored value, leaving the next read to fall back to the baseline.
 *
 * @param farmId - Farm profile the slot belongs to.
 * @param slot - Telemetry slot being cleared.
 * @returns void
 * @throws Never throws.
 */
function clearSlot(farmId: FarmId, slot: TelemetrySlot): void {
  try {
    localStorage.removeItem(storageKey(farmId, slot));
  } catch (error) {
    console.warn(`Failed to remove ${slot} from localStorage:`, error);
  }
}

/**
 * Safely loads and parses persisted JSON data from localStorage.
 *
 * @summary Load persisted state.
 * @description Attempts to retrieve and parse a JSON string from localStorage,
 * returning the fallback value if the key does not exist or parsing fails.
 *
 * @param key - Storage key to read.
 * @param fallback - Default fallback value.
 * @returns Parsed value or fallback.
 * @throws Never throws.
 */
function loadPersisted<T>(key: string, fallback: T): T {
  try {
    const stored = localStorage.getItem(key);
    if (stored) {
      return JSON.parse(stored) as T;
    }
  } catch (error) {
    console.warn(`Failed to read ${key} from localStorage:`, error);
  }
  return fallback;
}

/**
 * Loads persisted flow rates for a farm with irrigation demand re-derived from its active mode.
 *
 * @summary Rehydrate persisted flows.
 * @description Reads the persisted flow rates and replaces irrigationDemand with the value the
 * active irrigation mode implies.
 *
 * @remarks Irrigation demand is derived state, not stored state: the interface shows a mode and
 * a rate side by side, so a persisted rate that disagrees with the persisted mode would render a
 * contradiction. Re-deriving on load is what keeps the two honest. What varies independently is
 * the scheduled demand, which an unoptimized farm sets above its profile baseline; scaling that
 * by the mode is the whole rule, and this is the only place it runs on load.
 *
 * @param farmId - Active farm profile identifier.
 * @param mode - Persisted irrigation mode for that farm.
 * @param scheduledDemand - Persisted scheduled irrigation demand in m³/day.
 * @returns Persisted flow rates with irrigationDemand consistent with schedule and mode.
 * @throws Never throws.
 */
function rehydrateFlows(
  farmId: FarmId,
  mode: IrrigationMode,
  scheduledDemand: number
): WaterFlowMetrics {
  const baseline = getFarmBaseline(farmId);
  const savedFlows = readSlot(farmId, 'flows', { ...baseline.flows });

  return {
    ...savedFlows,
    irrigationDemand: calculateIrrigationDemand(scheduledDemand, mode),
  };
}

/**
 * Reads the persisted scheduled irrigation demand for a farm.
 *
 * @summary Load scheduled irrigation demand.
 * @description Falls back to the farm profile's calibrated baseline demand when nothing has
 * been persisted, which is the case for any farm that has not run an unoptimized demo state.
 *
 * @param farmId - Active farm profile identifier.
 * @returns Scheduled crop irrigation demand in m³/day.
 * @throws Never throws.
 */
function loadScheduledDemand(farmId: FarmId): number {
  return loadPersisted<number>(
    storageKey(farmId, 'scheduledIrrigation'),
    getFarmBaseline(farmId).flows.irrigationDemand
  );
}

/**
 * Props for the TelemetryProvider component.
 */
export interface TelemetryProviderProps {
  /** Child React elements wrapped by the provider */
  children: ReactNode;
}

/**
 * Telemetry Provider component supplying real-time water state and calculations.
 *
 * @summary Telemetry state provider.
 * @description Listens to the active farm profile and maintains live reservoir volumes,
 * flow rates, supervisory actions, and derived telemetry metrics, with localStorage persistence.
 *
 * @param props - Component props containing children nodes.
 * @returns React.JSX.Element wrapping child components with TelemetryContext.
 * @throws Never throws.
 */
export function TelemetryProvider({ children }: TelemetryProviderProps): React.JSX.Element {
  const { activeFarm } = useAuth();

  // Internal state for raw volumes and flows, initialized with localStorage or baseline
  const [volumes, setVolumes] = useState<TankVolumeMetrics | null>(() => {
    if (activeFarm) {
      const baseline = getFarmBaseline(activeFarm.id);
      return readSlot(activeFarm.id, 'volumes', { ...baseline.volumes });
    }
    return null;
  });

  const [flows, setFlowsState] = useState<WaterFlowMetrics | null>(() => {
    if (activeFarm) {
      const savedMode = loadPersisted<IrrigationMode>(
        storageKey(activeFarm.id, 'irrigationMode'),
        'auto'
      );
      return rehydrateFlows(activeFarm.id, savedMode, loadScheduledDemand(activeFarm.id));
    }
    return null;
  });

  // Supervisory control states: irrigation mode and cumulative delivery costs
  const [irrigationMode, setIrrigationModeState] = useState<IrrigationMode>(() => {
    if (activeFarm) {
      return loadPersisted<IrrigationMode>(
        storageKey(activeFarm.id, 'irrigationMode'),
        'auto'
      );
    }
    return 'auto';
  });

  // The irrigation schedule the farm is running. Held next to irrigationMode rather than inside
  // flows because it is a setting the operator's demo state can change, not a measured rate.
  const [scheduledIrrigationDemand, setScheduledIrrigationDemand] = useState<number>(() => {
    if (activeFarm) {
      return loadScheduledDemand(activeFarm.id);
    }
    return 0;
  });

  const [cumulativeTruckCost, setCumulativeTruckCost] = useState<number>(() => {
    if (activeFarm) {
      return loadPersisted<number>(
        storageKey(activeFarm.id, 'truckCost'),
        0
      );
    }
    return 0;
  });

  // Reinitialize volumes and flows whenever the active farm profile changes
  useEffect(() => {
    if (activeFarm) {
      const baseline = getFarmBaseline(activeFarm.id);
      const savedMode = loadPersisted<IrrigationMode>(
        storageKey(activeFarm.id, 'irrigationMode'),
        'auto'
      );

      const savedSchedule = loadScheduledDemand(activeFarm.id);

      setVolumes(readSlot(activeFarm.id, 'volumes', { ...baseline.volumes }));
      setFlowsState(rehydrateFlows(activeFarm.id, savedMode, savedSchedule));
      setIrrigationModeState(savedMode);
      setScheduledIrrigationDemand(savedSchedule);
      setCumulativeTruckCost(
        loadPersisted<number>(
          storageKey(activeFarm.id, 'truckCost'),
          0
        )
      );
    } else {
      setVolumes(null);
      setFlowsState(null);
      setIrrigationModeState('auto');
      setScheduledIrrigationDemand(0);
      setCumulativeTruckCost(0);
    }
  }, [activeFarm?.id]);

  /**
   * Updates reservoir storage volumes and synchronizes with localStorage.
   *
   * @summary Update tank volumes.
   * @description Updates state with either direct volume metrics or a functional updater,
   * persisting the updated values to browser localStorage under the active farm key.
   *
   * @param updater - New volume metrics or updater function receiving previous metrics.
   * @returns void
   * @throws Never throws.
   */
  const setTankVolumes = (
    updater: TankVolumeMetrics | ((prev: TankVolumeMetrics) => TankVolumeMetrics)
  ): void => {
    setVolumes((prev) => {
      if (!prev) {
        return prev;
      }
      const next = typeof updater === 'function' ? updater(prev) : updater;
      if (activeFarm) {
        persistSlot(activeFarm.id, 'volumes', next);
      }
      return next;
    });
  };

  /**
   * Updates water flow metrics and synchronizes with localStorage.
   *
   * @summary Update water flows.
   * @description Updates state with either direct flow metrics or a functional updater,
   * persisting the updated values to browser localStorage under the active farm key.
   *
   * @param updater - New flow metrics or updater function receiving previous metrics.
   * @returns void
   * @throws Never throws.
   */
  const setFlows = (
    updater: WaterFlowMetrics | ((prev: WaterFlowMetrics) => WaterFlowMetrics)
  ): void => {
    setFlowsState((prev) => {
      if (!prev) {
        return prev;
      }
      const next = typeof updater === 'function' ? updater(prev) : updater;
      if (activeFarm) {
        persistSlot(activeFarm.id, 'flows', next);
      }
      return next;
    });
  };

  /**
   * Switches the active farm irrigation operational mode.
   *
   * @summary Set irrigation mode.
   * @description Updates state, persists mode to localStorage, and updates the irrigation
   * demand flow based on the pre-calibrated baseline and the selected mode.
   *
   * @param mode - Operational irrigation mode ('auto', 'eco', 'paused').
   * @returns void
   * @throws Never throws.
   */
  const setIrrigationMode = (mode: IrrigationMode): void => {
    setIrrigationModeState(mode);
    if (activeFarm) {
      persistSlot(activeFarm.id, 'irrigationMode', mode);

      setFlows((prev) => ({
        ...prev,
        irrigationDemand: calculateIrrigationDemand(scheduledIrrigationDemand, mode),
      }));
    }
  };

  /**
   * Dispatches an external water truck delivery request for emergency replenishment.
   *
   * @summary Request water truck delivery.
   * @description Adds delivered water to the external tank (capped at capacity), logs the
   * expense, and updates localStorage.
   *
   * @param volumeM3 - Delivery volume to order (+10 or +25 m³).
   * @returns WaterTruckDeliveryResult with delivery volume, cost, and capping status.
   * @throws Never throws.
   */
  const requestWaterTruck = (volumeM3: 10 | 25): WaterTruckDeliveryResult => {
    if (!activeFarm || !volumes) {
      return {
        deliveredM3: 0,
        newVolumeM3: 0,
        addedCostEur: 0,
        isCapped: false,
      };
    }

    const deliveryResult = calculateTruckDelivery(
      volumes.external,
      activeFarm.tankCapacities.external,
      volumeM3
    );

    // Update external reservoir volume
    setTankVolumes((prev) => ({
      ...prev,
      external: deliveryResult.newVolumeM3,
    }));

    // Accumulate delivery expense
    setCumulativeTruckCost((prev) => {
      const updatedCost = prev + deliveryResult.addedCostEur;
      persistSlot(activeFarm.id, 'truckCost', updatedCost);
      return updatedCost;
    });

    return deliveryResult;
  };

  /**
   * Executes a manual pump transfer from Rainwater or ESA tank into the Blend tank.
   *
   * @summary Execute manual pump transfer.
   * @description Validates transfer parameters, updates reservoir volumes respecting mass balance,
   * and persists new volumes to localStorage.
   *
   * @param fromTank - Source tank ('rainwater' or 'esa').
   * @param volumeM3 - Water volume to transfer in m³.
   * @returns PumpTransferResult indicating success, transferred amount, and error message if any.
   * @throws Never throws.
   */
  const executePumpTransfer = (
    fromTank: TransferSourceTank,
    volumeM3: number
  ): PumpTransferResult => {
    if (!activeFarm || !volumes) {
      return {
        success: false,
        transferredM3: 0,
        updatedVolumes: volumes ?? { rainwater: 0, esa: 0, external: 0, blend: 0 },
        errorMessage: 'No active farm profile loaded.',
      };
    }

    const transferResult = validateAndExecutePumpTransfer({
      fromTank,
      volumeM3,
      currentVolumes: volumes,
      capacities: activeFarm.tankCapacities,
    });

    if (transferResult.success) {
      setTankVolumes(transferResult.updatedVolumes);
    }

    return transferResult;
  };

  /**
   * Resets active farm telemetry back to pre-calibrated baseline and clears custom persistence.
   *
   * @summary Reset telemetry to baseline.
   * @description Reverts reservoir volumes and flow rates to profile defaults, resets
   * supervisory controls (irrigation mode to 'auto', cumulative costs to 0), and removes
   * persisted custom values from browser localStorage.
   *
   * @returns void
   * @throws Never throws.
   */
  const resetToBaseline = (): void => {
    if (activeFarm) {
      const baseline = getFarmBaseline(activeFarm.id);
      setVolumes({ ...baseline.volumes });
      setFlowsState({ ...baseline.flows });
      setIrrigationModeState('auto');
      setScheduledIrrigationDemand(baseline.flows.irrigationDemand);
      setCumulativeTruckCost(0);
      TELEMETRY_SLOTS.forEach((slot) => clearSlot(activeFarm.id, slot));
    }
  };

  /**
   * Atomically applies a telemetry snapshot (volumes, flows, truck costs, and irrigation mode).
   *
   * @summary Apply telemetry snapshot.
   * @description Sets reservoir volumes, water flows, the irrigation schedule, cumulative truck
   * costs, and irrigation mode in a single coordinated transition, persisting values to
   * localStorage.
   *
   * @remarks The snapshot's effective irrigationDemand is recomputed from its scheduled demand
   * and irrigation mode rather than taken as given, so a snapshot cannot declare a rate that
   * contradicts the mode the interface will show next to it.
   *
   * @param snapshot - Complete or partial telemetry snapshot to apply.
   * @returns void
   * @throws Never throws.
   */
  const applySnapshot = (snapshot: TelemetrySnapshot): void => {
    const appliedMode = snapshot.irrigationMode ?? irrigationMode;
    const appliedSchedule = snapshot.scheduledIrrigationDemand ?? scheduledIrrigationDemand;
    const appliedFlows = snapshot.flows
      ? {
          ...snapshot.flows,
          irrigationDemand: calculateIrrigationDemand(appliedSchedule, appliedMode),
        }
      : undefined;

    setVolumes(snapshot.volumes);
    if (appliedFlows) {
      setFlowsState(appliedFlows);
    }
    if (snapshot.scheduledIrrigationDemand !== undefined) {
      setScheduledIrrigationDemand(snapshot.scheduledIrrigationDemand);
    }
    if (snapshot.cumulativeTruckCost !== undefined) {
      setCumulativeTruckCost(snapshot.cumulativeTruckCost);
    }
    if (snapshot.irrigationMode) {
      setIrrigationModeState(snapshot.irrigationMode);
    }

    if (activeFarm) {
      persistSlot(activeFarm.id, 'volumes', snapshot.volumes);
      if (appliedFlows) {
        persistSlot(activeFarm.id, 'flows', appliedFlows);
      }
      if (snapshot.scheduledIrrigationDemand !== undefined) {
        persistSlot(activeFarm.id, 'scheduledIrrigation', snapshot.scheduledIrrigationDemand);
      }
      if (snapshot.cumulativeTruckCost !== undefined) {
        persistSlot(activeFarm.id, 'truckCost', snapshot.cumulativeTruckCost);
      }
      if (snapshot.irrigationMode) {
        persistSlot(activeFarm.id, 'irrigationMode', snapshot.irrigationMode);
      }
    }
  };

  // Recompute consolidated telemetry whenever activeFarm, volumes, flows, or supervisory states change
  const telemetry = useMemo<TelemetryState | null>(() => {
    if (!activeFarm || !volumes || !flows) {
      return null;
    }
    return computeTelemetryState(
      activeFarm,
      volumes,
      flows,
      irrigationMode,
      cumulativeTruckCost
    );
  }, [activeFarm, volumes, flows, irrigationMode, cumulativeTruckCost]);

  const contextValue = useMemo<TelemetryContextType>(
    () => ({
      telemetry,
      setTankVolumes,
      setFlows,
      setIrrigationMode,
      requestWaterTruck,
      executePumpTransfer,
      resetToBaseline,
      applySnapshot,
    }),
    [telemetry]
  );

  return (
    <TelemetryContext.Provider value={contextValue}>
      {children}
    </TelemetryContext.Provider>
  );
}

/**
 * Custom hook to consume the TelemetryContext.
 *
 * @summary Hook for telemetry state.
 * @description Provides access to active farm water telemetry, flows, and mutator methods.
 *
 * @returns TelemetryContextType containing live telemetry and dispatch functions.
 * @throws Error if called outside of a TelemetryProvider tree.
 */
export function useTelemetry(): TelemetryContextType {
  const context = useContext(TelemetryContext);
  if (!context) {
    throw new Error('useTelemetry must be used within a TelemetryProvider');
  }
  return context;
}
