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
import {
  TankVolumeMetrics,
  WaterFlowMetrics,
  TelemetryState,
  getFarmBaseline,
  IrrigationMode,
  PumpTransferResult,
  WaterTruckDeliveryResult,
  TransferSourceTank,
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
}

const TelemetryContext = createContext<TelemetryContextType | undefined>(undefined);

/** Storage key prefix for persisting farm telemetry state in localStorage */
const STORAGE_KEY_PREFIX = 'water4all_telemetry_';

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
      return loadPersisted(`${STORAGE_KEY_PREFIX}${activeFarm.id}_volumes`, { ...baseline.volumes });
    }
    return null;
  });

  const [flows, setFlowsState] = useState<WaterFlowMetrics | null>(() => {
    if (activeFarm) {
      const baseline = getFarmBaseline(activeFarm.id);
      const initialFlows = loadPersisted(`${STORAGE_KEY_PREFIX}${activeFarm.id}_flows`, { ...baseline.flows });
      // Rehydrate irrigationDemand immediately based on persisted irrigationMode
      const savedMode = loadPersisted<IrrigationMode>(
        `${STORAGE_KEY_PREFIX}${activeFarm.id}_irrigationMode`,
        'auto'
      );
      const adjustedDemand = calculateIrrigationDemand(baseline.flows.irrigationDemand, savedMode);
      return {
        ...initialFlows,
        irrigationDemand: adjustedDemand,
      };
    }
    return null;
  });

  // Supervisory control states: irrigation mode and cumulative delivery costs
  const [irrigationMode, setIrrigationModeState] = useState<IrrigationMode>(() => {
    if (activeFarm) {
      return loadPersisted<IrrigationMode>(
        `${STORAGE_KEY_PREFIX}${activeFarm.id}_irrigationMode`,
        'auto'
      );
    }
    return 'auto';
  });

  const [cumulativeTruckCost, setCumulativeTruckCost] = useState<number>(() => {
    if (activeFarm) {
      return loadPersisted<number>(
        `${STORAGE_KEY_PREFIX}${activeFarm.id}_truckCost`,
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
        `${STORAGE_KEY_PREFIX}${activeFarm.id}_irrigationMode`,
        'auto'
      );
      const savedFlows = loadPersisted(`${STORAGE_KEY_PREFIX}${activeFarm.id}_flows`, { ...baseline.flows });
      const adjustedDemand = calculateIrrigationDemand(baseline.flows.irrigationDemand, savedMode);

      setVolumes(loadPersisted(`${STORAGE_KEY_PREFIX}${activeFarm.id}_volumes`, { ...baseline.volumes }));
      setFlowsState({
        ...savedFlows,
        irrigationDemand: adjustedDemand,
      });
      setIrrigationModeState(savedMode);
      setCumulativeTruckCost(
        loadPersisted<number>(
          `${STORAGE_KEY_PREFIX}${activeFarm.id}_truckCost`,
          0
        )
      );
    } else {
      setVolumes(null);
      setFlowsState(null);
      setIrrigationModeState('auto');
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
        try {
          localStorage.setItem(`${STORAGE_KEY_PREFIX}${activeFarm.id}_volumes`, JSON.stringify(next));
        } catch (e) {
          console.warn('Failed to persist volumes to localStorage:', e);
        }
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
        try {
          localStorage.setItem(`${STORAGE_KEY_PREFIX}${activeFarm.id}_flows`, JSON.stringify(next));
        } catch (e) {
          console.warn('Failed to persist flows to localStorage:', e);
        }
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
      try {
        localStorage.setItem(
          `${STORAGE_KEY_PREFIX}${activeFarm.id}_irrigationMode`,
          JSON.stringify(mode)
        );
      } catch (e) {
        console.warn('Failed to persist irrigationMode to localStorage:', e);
      }

      // Calculate adjusted irrigation demand using the baseline rate
      const baseline = getFarmBaseline(activeFarm.id);
      const adjustedDemand = calculateIrrigationDemand(baseline.flows.irrigationDemand, mode);

      setFlows((prev) => ({
        ...prev,
        irrigationDemand: adjustedDemand,
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
      try {
        localStorage.setItem(
          `${STORAGE_KEY_PREFIX}${activeFarm.id}_truckCost`,
          JSON.stringify(updatedCost)
        );
      } catch (e) {
        console.warn('Failed to persist truckCost to localStorage:', e);
      }
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
      setCumulativeTruckCost(0);
      try {
        localStorage.removeItem(`${STORAGE_KEY_PREFIX}${activeFarm.id}_volumes`);
        localStorage.removeItem(`${STORAGE_KEY_PREFIX}${activeFarm.id}_flows`);
        localStorage.removeItem(`${STORAGE_KEY_PREFIX}${activeFarm.id}_irrigationMode`);
        localStorage.removeItem(`${STORAGE_KEY_PREFIX}${activeFarm.id}_truckCost`);
      } catch (e) {
        console.warn('Failed to remove telemetry from localStorage:', e);
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
