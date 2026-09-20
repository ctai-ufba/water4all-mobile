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
} from '../types/telemetry';
import { computeTelemetryState } from '../domain/telemetryEngine';

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
 * flow rates, and derived telemetry metrics, with localStorage persistence.
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
      return loadPersisted(`${STORAGE_KEY_PREFIX}${activeFarm.id}_flows`, { ...baseline.flows });
    }
    return null;
  });

  // Reinitialize volumes and flows whenever the active farm profile changes
  useEffect(() => {
    if (activeFarm) {
      const baseline = getFarmBaseline(activeFarm.id);
      setVolumes(loadPersisted(`${STORAGE_KEY_PREFIX}${activeFarm.id}_volumes`, { ...baseline.volumes }));
      setFlowsState(loadPersisted(`${STORAGE_KEY_PREFIX}${activeFarm.id}_flows`, { ...baseline.flows }));
    } else {
      setVolumes(null);
      setFlowsState(null);
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
   * Resets active farm telemetry back to pre-calibrated baseline and clears custom persistence.
   *
   * @summary Reset telemetry to baseline.
   * @description Reverts reservoir volumes and flow rates to profile defaults,
   * removing persisted custom values from browser localStorage.
   *
   * @returns void
   * @throws Never throws.
   */
  const resetToBaseline = (): void => {
    if (activeFarm) {
      const baseline = getFarmBaseline(activeFarm.id);
      setVolumes({ ...baseline.volumes });
      setFlowsState({ ...baseline.flows });
      try {
        localStorage.removeItem(`${STORAGE_KEY_PREFIX}${activeFarm.id}_volumes`);
        localStorage.removeItem(`${STORAGE_KEY_PREFIX}${activeFarm.id}_flows`);
      } catch (e) {
        console.warn('Failed to remove telemetry from localStorage:', e);
      }
    }
  };

  // Recompute consolidated telemetry whenever activeFarm, volumes, or flows change
  const telemetry = useMemo<TelemetryState | null>(() => {
    if (!activeFarm || !volumes || !flows) {
      return null;
    }
    return computeTelemetryState(activeFarm, volumes, flows);
  }, [activeFarm, volumes, flows]);

  const contextValue = useMemo<TelemetryContextType>(
    () => ({
      telemetry,
      setTankVolumes,
      setFlows,
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
