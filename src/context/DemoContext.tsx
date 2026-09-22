/**
 * @file DemoContext.tsx
 * @summary State management context for the Demo Controller and System Optimization.
 * @description Coordinates demonstration scenarios ("Live Weather", "Severe Drought", "Heavy Storm",
 * "High Salinity"), virtual time progression ("Advance 6 Hours", "Next Day"), the "Unoptimized Baseline"
 * comparison toggle, and the 2-second animated "Run System Optimization" process (ADR 0002).
 */

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  useEffect,
  useRef,
  ReactNode,
} from 'react';
import { useAuth } from './AuthContext';
import { useTelemetry } from './TelemetryContext';
import { useWeather } from './WeatherContext';
import {
  DemoScenarioId,
  getScenarioWeather,
  getScenarioFlows,
  getScenarioVolumes,
  getUnoptimizedBaselineTelemetry,
  getOptimizedTelemetry,
  advanceSimulation,
  OPTIMIZATION_PHASES,
  OPTIMIZATION_APPLY_AT_MS,
  OPTIMIZATION_DURATION_MS,
} from '../domain/demoEngine';
import { getFarmBaseline } from '../types/telemetry';

/**
 * Interface defining the DemoContext shape and control methods.
 */
export interface DemoContextType {
  /** Active demonstration scenario */
  scenario: DemoScenarioId;
  /** Whether the Unoptimized Baseline comparison mode is currently active */
  isUnoptimizedBaseline: boolean;
  /** Current virtual simulation date and time */
  simulatedDate: Date;
  /** Total simulated hours elapsed since last reset */
  elapsedSimulatedHours: number;
  /** Whether the Demo Controller slide-over drawer is visible */
  isDrawerOpen: boolean;
  /** Whether the 2-second system optimization progress animation is currently running */
  isOptimizing: boolean;
  /** Optimization progress percentage (0 - 100) */
  optimizationProgress: number;
  /** Status description of the current optimization phase */
  optimizationPhase: string;
  /** Opens the Demo Controller slide-over drawer */
  openDrawer: () => void;
  /** Closes the Demo Controller slide-over drawer */
  closeDrawer: () => void;
  /** Switches to a demonstration scenario ('live', 'drought', 'storm', 'salinity') */
  selectScenario: (scenario: DemoScenarioId) => void;
  /** Toggles the Unoptimized Baseline comparison state */
  toggleUnoptimizedBaseline: () => void;
  /** Advances virtual simulation time by 6 or 24 hours */
  advanceTime: (hours: 6 | 24) => void;
  /** Resets virtual time back to real current time */
  resetTime: () => void;
  /** Triggers the 2-second animated optimization process and applies optimal parameters (ADR 0002) */
  runOptimization: () => Promise<void>;
  /** Resets all demo state, scenarios, and telemetry to profile initial defaults */
  resetDemo: () => void;
}

const DemoContext = createContext<DemoContextType | undefined>(undefined);

/**
 * Props for the DemoProvider component.
 */
export interface DemoProviderProps {
  /** Child React elements wrapped by the provider */
  children: ReactNode;
}

/**
 * Demo Provider component orchestrating demonstration controls and optimization.
 *
 * @summary Demo state provider.
 * @description Manages presentation scenarios, temporal progression, baseline toggles,
 * and the 2-second animated optimization modal, coordinating with TelemetryContext and WeatherContext.
 *
 * @param props - Component props containing children nodes.
 * @returns React.JSX.Element wrapping child components with DemoContext.
 * @throws Never throws.
 */
export function DemoProvider({ children }: DemoProviderProps): React.JSX.Element {
  const { activeFarm } = useAuth();
  const {
    telemetry,
    setTankVolumes,
    setFlows,
    resetToBaseline,
    applySnapshot,
  } = useTelemetry();
  const { setCustomWeather } = useWeather();

  const [scenario, setScenario] = useState<DemoScenarioId>('live');
  const [isUnoptimizedBaseline, setIsUnoptimizedBaseline] = useState<boolean>(false);
  const [simulatedDate, setSimulatedDate] = useState<Date>(() => new Date());
  const [elapsedSimulatedHours, setElapsedSimulatedHours] = useState<number>(0);
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false);

  // Optimization animation states
  const [isOptimizing, setIsOptimizing] = useState<boolean>(false);
  const [optimizationProgress, setOptimizationProgress] = useState<number>(0);
  const [optimizationPhase, setOptimizationPhase] = useState<string>('');

  // Ref tracking active timer IDs to safely clean up on unmount or cancellation
  const optimizationTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  // Clear all pending optimization timers on unmount
  useEffect(() => {
    return () => {
      optimizationTimersRef.current.forEach(clearTimeout);
      optimizationTimersRef.current = [];
    };
  }, []);

  /**
   * Resets internal demo state variables to clean initial defaults.
   *
   * @summary Reset internal demo state.
   * @description Clears scenario, unoptimized baseline, time progression, optimization flags, and weather.
   *
   * @returns void
   * @throws Never throws.
   */
  const resetInternalDemoState = useCallback((): void => {
    setScenario('live');
    setIsUnoptimizedBaseline(false);
    setSimulatedDate(new Date());
    setElapsedSimulatedHours(0);
    setIsOptimizing(false);
    setOptimizationProgress(0);
    setOptimizationPhase('');
    setCustomWeather(null);
  }, [setCustomWeather]);

  // Reset demo state whenever the active farm profile changes
  useEffect(() => {
    resetInternalDemoState();
  }, [activeFarm?.id, resetInternalDemoState]);

  /**
   * Opens the Demo Controller slide-over drawer.
   *
   * @summary Open demo drawer.
   * @description Sets drawer visibility flag to true, displaying the slide-over presentation controls.
   *
   * @returns void
   * @throws Never throws.
   */
  const openDrawer = useCallback((): void => {
    setIsDrawerOpen(true);
  }, []);

  /**
   * Closes the Demo Controller slide-over drawer.
   *
   * @summary Close demo drawer.
   * @description Sets drawer visibility flag to false, hiding the slide-over presentation controls.
   *
   * @returns void
   * @throws Never throws.
   */
  const closeDrawer = useCallback((): void => {
    setIsDrawerOpen(false);
  }, []);

  /**
   * Switches the active demonstration scenario.
   *
   * @summary Select demo scenario.
   * @description Configures weather, inflows, and demands for 'live', 'drought', 'storm', or 'salinity'.
   * Automatically clears unoptimized baseline comparison to avoid state collisions, and restores
   * baseline reservoir volumes when transitioning away from the salinity scenario.
   *
   * @param targetScenario - Identifier of the scenario to activate.
   * @returns void
   * @throws Never throws.
   */
  const selectScenario = useCallback(
    (targetScenario: DemoScenarioId): void => {
      if (!activeFarm) return;
      const previousScenario = scenario;
      setScenario(targetScenario);

      const baseline = getFarmBaseline(activeFarm.id);

      // If unoptimized baseline was active, clear it and restore baseline telemetry
      if (isUnoptimizedBaseline) {
        setIsUnoptimizedBaseline(false);
        resetToBaseline();
      }

      // If switching away from salinity, restore clean baseline tank volumes
      if (previousScenario === 'salinity' && targetScenario !== 'salinity') {
        setTankVolumes({ ...baseline.volumes });
      }

      if (targetScenario === 'live') {
        // Revert to live Open-Meteo or synthetic seasonal weather
        setCustomWeather(null);
        setFlows({ ...baseline.flows });
        return;
      }

      // Generate scenario-specific weather and flows
      const scenarioWeather = getScenarioWeather(targetScenario, simulatedDate);
      setCustomWeather(scenarioWeather);

      const scenarioFlows = getScenarioFlows(targetScenario, baseline.flows);
      setFlows(scenarioFlows);

      // In salinity scenario, skew tank storage to external supply
      if (targetScenario === 'salinity') {
        const currentVols = isUnoptimizedBaseline ? baseline.volumes : (telemetry?.tankVolumes ?? baseline.volumes);
        const scenarioVolumes = getScenarioVolumes(targetScenario, activeFarm, currentVols);
        setTankVolumes(scenarioVolumes);
      }
    },
    [activeFarm, scenario, isUnoptimizedBaseline, simulatedDate, telemetry, resetToBaseline, setCustomWeather, setFlows, setTankVolumes]
  );

  /**
   * Toggles the Unoptimized Baseline comparison mode.
   *
   * @summary Toggle unoptimized baseline.
   * @description Alternates between calibrated operation and an unoptimized baseline exhibiting
   * depleted reservoirs below minimum operating volume, high costs, and quality violations.
   *
   * @returns void
   * @throws Never throws.
   */
  const toggleUnoptimizedBaseline = useCallback((): void => {
    if (!activeFarm) return;

    if (!isUnoptimizedBaseline) {
      // Switch TO unoptimized baseline
      setIsUnoptimizedBaseline(true);
      setScenario('live');
      const unoptimized = getUnoptimizedBaselineTelemetry(activeFarm);
      applySnapshot(unoptimized);
    } else {
      // Revert FROM unoptimized baseline back to standard baseline
      setIsUnoptimizedBaseline(false);
      resetToBaseline();
      setScenario('live');
      setCustomWeather(null);
    }
  }, [activeFarm, isUnoptimizedBaseline, applySnapshot, resetToBaseline, setCustomWeather]);

  /**
   * Advances virtual simulation time by 6 or 24 hours.
   *
   * @summary Advance virtual time.
   * @description Recalculates inflows, outflows, and tank levels across the elapsed time step
   * via domain simulation. Updates diurnal solar variation, ESA production, and modulates
   * irrigation demand between day and night cycles.
   *
   * @param hours - Elapsed hours (6 or 24).
   * @returns void
   * @throws Never throws.
   */
  const advanceTime = useCallback(
    (hours: 6 | 24): void => {
      if (!activeFarm || !telemetry) return;

      const result = advanceSimulation(
        simulatedDate,
        hours,
        telemetry.tankVolumes,
        telemetry.flows,
        activeFarm,
        scenario
      );

      setSimulatedDate(result.date);
      setElapsedSimulatedHours((prev) => prev + hours);
      setTankVolumes(result.volumes);
      setFlows(result.flows);
      if (result.weather) {
        setCustomWeather(result.weather);
      }
    },
    [activeFarm, telemetry, simulatedDate, scenario, setTankVolumes, setFlows, setCustomWeather]
  );

  /**
   * Resets virtual time back to real current time.
   *
   * @summary Reset virtual time.
   * @description Reverts simulated date to new Date() and clears elapsed simulated hours.
   *
   * @returns void
   * @throws Never throws.
   */
  const resetTime = useCallback((): void => {
    setSimulatedDate(new Date());
    setElapsedSimulatedHours(0);
    if (scenario === 'live') {
      setCustomWeather(null);
    }
  }, [scenario, setCustomWeather]);

  /**
   * Triggers the 2-second animated optimization process and applies pre-computed optimal parameters (ADR 0002).
   *
   * @summary Run system optimization.
   * @description Plays an engaging 2000 ms progress animation across 4 distinct phases,
   * then applies optimal parameters: restoring tank volumes, eliminating deficits, and updating financial metrics.
   *
   * @returns Promise resolving when optimization completes.
   * @throws Never throws.
   */
  const runOptimization = useCallback(async (): Promise<void> => {
    if (!activeFarm) return;

    // Clear any active timers
    optimizationTimersRef.current.forEach(clearTimeout);
    optimizationTimersRef.current = [];

    setIsOptimizing(true);
    setOptimizationProgress(OPTIMIZATION_PHASES[0].progress);
    setOptimizationPhase(OPTIMIZATION_PHASES[0].label);

    // Schedule phase transitions across the animation
    const timers: ReturnType<typeof setTimeout>[] = [];

    OPTIMIZATION_PHASES.forEach((phase) => {
      const timer = setTimeout(() => {
        setOptimizationProgress(phase.progress);
        setOptimizationPhase(phase.label);
      }, phase.startMs);
      timers.push(timer);
    });

    // Apply the pre-computed optimal parameters as the progress bar reaches 100%
    const completionTimer = setTimeout(() => {
      const optimal = getOptimizedTelemetry(activeFarm);
      applySnapshot(optimal);

      // Reset scenario and baseline flags
      setScenario('live');
      setIsUnoptimizedBaseline(false);
      setCustomWeather(null);
    }, OPTIMIZATION_APPLY_AT_MS);
    timers.push(completionTimer);

    // Auto-dismiss the modal when the animation ends
    const dismissTimer = setTimeout(() => {
      setIsOptimizing(false);
    }, OPTIMIZATION_DURATION_MS);
    timers.push(dismissTimer);

    optimizationTimersRef.current = timers;
  }, [activeFarm, applySnapshot, setCustomWeather]);

  /**
   * Resets all demo state, scenarios, and telemetry back to initial profile defaults.
   *
   * @summary Reset all demo state.
   * @description Restores live weather, standard baseline telemetry, clears simulated time,
   * and closes the drawer.
   *
   * @returns void
   * @throws Never throws.
   */
  const resetDemo = useCallback((): void => {
    resetInternalDemoState();
    resetToBaseline();
  }, [resetInternalDemoState, resetToBaseline]);

  const contextValue = useMemo<DemoContextType>(
    () => ({
      scenario,
      isUnoptimizedBaseline,
      simulatedDate,
      elapsedSimulatedHours,
      isDrawerOpen,
      isOptimizing,
      optimizationProgress,
      optimizationPhase,
      openDrawer,
      closeDrawer,
      selectScenario,
      toggleUnoptimizedBaseline,
      advanceTime,
      resetTime,
      runOptimization,
      resetDemo,
    }),
    [
      scenario,
      isUnoptimizedBaseline,
      simulatedDate,
      elapsedSimulatedHours,
      isDrawerOpen,
      isOptimizing,
      optimizationProgress,
      optimizationPhase,
      openDrawer,
      closeDrawer,
      selectScenario,
      toggleUnoptimizedBaseline,
      advanceTime,
      resetTime,
      runOptimization,
      resetDemo,
    ]
  );

  return (
    <DemoContext.Provider value={contextValue}>
      {children}
    </DemoContext.Provider>
  );
}

/**
 * Custom hook to consume the DemoContext.
 *
 * @summary Hook for demo state and presentation controls.
 * @description Provides access to active scenario, time advancement, baseline toggles,
 * and system optimization triggers.
 *
 * @returns DemoContextType containing live demo state and dispatch methods.
 * @throws Error if called outside of a DemoProvider tree.
 */
export function useDemo(): DemoContextType {
  const context = useContext(DemoContext);
  if (!context) {
    throw new Error('useDemo must be used within a DemoProvider');
  }
  return context;
}

