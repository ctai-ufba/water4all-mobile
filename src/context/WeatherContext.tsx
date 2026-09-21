/**
 * @file WeatherContext.tsx
 * @summary Weather and atmospheric physics state management context.
 * @description Provides real-time weather observations, ESA atmospheric water generation rates,
 * and rainwater catchment volume estimates for the active Mediterranean farm profile.
 */

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  ReactNode,
} from 'react';
import { useAuth } from './AuthContext';
import {
  WeatherData,
  ESAProductionResult,
  CatchmentEstimateResult,
} from '../types/weather';
import { fetchFarmWeather } from '../services/weatherService';
import { calculateESAWaterProduction } from '../domain/esaPhysicsEngine';
import { calculateCatchmentInflow } from '../domain/catchmentEngine';

/**
 * Interface defining the WeatherContext shape and methods.
 */
export interface WeatherContextType {
  /** Live or synthetic weather data, or null if no farm is active */
  weather: WeatherData | null;
  /** Flag indicating whether a weather network request is in progress */
  loading: boolean;
  /** Live calculated ESA water production metrics, or null */
  esaProduction: ESAProductionResult | null;
  /** Estimated rainwater catchment inflow from 24h precipitation forecast, or null */
  catchmentEstimate: CatchmentEstimateResult | null;
  /**
   * Refetches real-time weather from Open-Meteo for the active farm.
   *
   * @summary Refetch weather data.
   * @description Triggers a fresh query to Open-Meteo and re-evaluates ESA and catchment physics.
   *
   * @returns Promise resolving when fetch completes.
   * @throws Never throws.
   */
  refetch: () => Promise<void>;
}

const WeatherContext = createContext<WeatherContextType | undefined>(undefined);

/**
 * Props for the WeatherProvider component.
 */
export interface WeatherProviderProps {
  /** Child React elements wrapped by the provider */
  children: ReactNode;
}

/**
 * Weather Provider component supplying real-time weather and physics calculations.
 *
 * @summary Weather state provider.
 * @description Listens to the active farm profile and retrieves ambient temperature,
 * relative humidity, and precipitation from Open-Meteo (or synthetic seasonal fallback).
 * Computes live ESA atmospheric generation and rainwater catchment inflow.
 *
 * @param props - Component props containing children nodes.
 * @returns React.JSX.Element wrapping child components with WeatherContext.
 * @throws Never throws.
 */
export function WeatherProvider({ children }: WeatherProviderProps): React.JSX.Element {
  const { activeFarm } = useAuth();
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  /**
   * Fetches weather data for the current active farm profile.
   *
   * @summary Load farm weather.
   * @description Dispatches request to Open-Meteo or cached/synthetic fallback
   * for the active farm's coordinates, updating the weather state.
   *
   * @returns Promise resolving to void when fetch completes.
   * @throws Never throws; errors are captured internally.
   */
  const loadWeather = useCallback(async () => {
    if (!activeFarm) {
      setWeather(null);
      return;
    }

    setLoading(true);
    try {
      const data = await fetchFarmWeather(activeFarm.coordinates, undefined, activeFarm.id);
      setWeather(data);
    } catch (err) {
      console.warn('WeatherProvider fetch encountered error:', err);
    } finally {
      setLoading(false);
    }
  }, [activeFarm]);

  // Automatically fetch weather when the active farm profile changes
  useEffect(() => {
    loadWeather();
  }, [loadWeather]);

  // Compute live ESA atmospheric water generation based on ambient temperature and relative humidity
  const esaProduction = useMemo<ESAProductionResult | null>(() => {
    if (!activeFarm || !weather) {
      return null;
    }
    return calculateESAWaterProduction(
      weather,
      activeFarm.esaNominalCapacityM3PerDay
    );
  }, [activeFarm, weather]);

  // Compute estimated rainwater catchment inflow from 24h precipitation forecast
  const catchmentEstimate = useMemo<CatchmentEstimateResult | null>(() => {
    if (!activeFarm || !weather) {
      return null;
    }
    return calculateCatchmentInflow(
      weather.precipitationForecast24hMm,
      activeFarm.catchmentAreaM2
    );
  }, [activeFarm, weather]);

  const contextValue = useMemo<WeatherContextType>(
    () => ({
      weather,
      loading,
      esaProduction,
      catchmentEstimate,
      refetch: loadWeather,
    }),
    [weather, loading, esaProduction, catchmentEstimate, loadWeather]
  );

  return (
    <WeatherContext.Provider value={contextValue}>
      {children}
    </WeatherContext.Provider>
  );
}

/**
 * Custom hook to consume the WeatherContext.
 *
 * @summary Hook for weather and ESA physics state.
 * @description Provides access to ambient weather conditions, ESA production rates,
 * and catchment inflow estimates.
 *
 * @returns WeatherContextType containing live weather and physics states.
 * @throws Error if called outside of a WeatherProvider tree.
 */
export function useWeather(): WeatherContextType {
  const context = useContext(WeatherContext);
  if (!context) {
    throw new Error('useWeather must be used within a WeatherProvider');
  }
  return context;
}

