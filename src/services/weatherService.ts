/**
 * @file weatherService.ts
 * @summary Weather fetching service with Open-Meteo integration and synthetic fallback.
 * @description Retrieves real-time dry-bulb temperature, relative humidity, and precipitation
 * forecasts from the free Open-Meteo REST API. In offline mode or during network/API failures,
 * gracefully falls back to deterministic synthetic Mediterranean seasonal weather.
 */

import { Coordinates, FarmId } from '../types/farm';
import { WeatherData } from '../types/weather';
import { generateSyntheticWeather } from '../domain/syntheticWeatherEngine';

/**
 * Raw Open-Meteo REST API response schema.
 */
export interface OpenMeteoApiResponse {
  current?: {
    temperature_2m?: number;
    relative_humidity_2m?: number;
    precipitation?: number;
    time?: string;
  };
  hourly?: {
    precipitation?: number[];
    time?: string[];
  };
  daily?: {
    precipitation_sum?: number[];
    time?: string[];
  };
}

/** Open-Meteo API base forecast URL */
export const OPEN_METEO_BASE_URL = 'https://api.open-meteo.com/v1/forecast';

/** Default network request timeout in milliseconds */
export const DEFAULT_WEATHER_TIMEOUT_MS = 8000;

/**
 * Parses and validates an Open-Meteo API response into canonical WeatherData.
 *
 * @summary Parse Open-Meteo response.
 * @description Extracts temperature_2m, relative_humidity_2m, precipitation, and forward-looking
 * 24h rolling precipitation forecast from hourly series (falling back to daily summary if absent).
 *
 * @param json - Raw JSON payload received from Open-Meteo.
 * @param fallbackDate - Optional date to anchor synthetic fallback if needed.
 * @returns Validated WeatherData object.
 * @throws Never throws; returns synthetic fallback on malformed input.
 */
export function parseOpenMeteoResponse(
  json: unknown,
  fallbackDate: Date = new Date()
): WeatherData {
  if (!json || typeof json !== 'object') {
    return generateSyntheticWeather(fallbackDate);
  }

  const payload = json as OpenMeteoApiResponse;
  const current = payload.current;

  // Validate that essential current weather fields exist and are finite numbers
  if (
    !current ||
    typeof current.temperature_2m !== 'number' ||
    !Number.isFinite(current.temperature_2m) ||
    typeof current.relative_humidity_2m !== 'number' ||
    !Number.isFinite(current.relative_humidity_2m)
  ) {
    return generateSyntheticWeather(fallbackDate);
  }

  const currentPrecip =
    typeof current.precipitation === 'number' && Number.isFinite(current.precipitation)
      ? Math.max(0, current.precipitation)
      : 0;

  // Calculate forward-looking rolling 24-hour precipitation forecast
  let forecastRain24h = 0;
  if (
    payload.hourly?.precipitation &&
    Array.isArray(payload.hourly.precipitation) &&
    payload.hourly.time &&
    Array.isArray(payload.hourly.time)
  ) {
    // Locate the starting hour matching the current reading timestamp (YYYY-MM-DDTHH)
    const currentTimeHour = current.time ? current.time.slice(0, 13) : '';
    let startIndex = payload.hourly.time.findIndex(
      (t) => currentTimeHour && t.startsWith(currentTimeHour)
    );
    if (startIndex === -1) {
      startIndex = 0;
    }

    // Sum precipitation for the next 24 rolling hours
    const next24Values = payload.hourly.precipitation.slice(startIndex, startIndex + 24);
    const sum = next24Values.reduce(
      (acc, val) => (typeof val === 'number' && Number.isFinite(val) ? acc + val : acc),
      0
    );
    forecastRain24h = Math.round(sum * 10) / 10;
  } else {
    // Fallback to daily precipitation summary if hourly series is unavailable
    const dailyForecast = payload.daily?.precipitation_sum?.[0];
    forecastRain24h =
      typeof dailyForecast === 'number' && Number.isFinite(dailyForecast)
        ? Math.max(0, Math.round(dailyForecast * 10) / 10)
        : 0;
  }

  return {
    temperatureC: Math.round(current.temperature_2m * 10) / 10,
    relativeHumidityPct: Math.round(Math.min(100, Math.max(0, current.relative_humidity_2m))),
    currentPrecipitationMm: currentPrecip,
    precipitationForecast24hMm: forecastRain24h,
    isOfflineFallback: false,
    timestamp: current.time || fallbackDate.toISOString(),
  };
}

/** Storage key prefix for caching farm weather in localStorage */
export const WEATHER_STORAGE_KEY_PREFIX = 'water4all_weather_';

/**
 * Retrieves cached weather from localStorage if available.
 *
 * @summary Get cached weather.
 * @description Reads previously stored live weather from localStorage, marking it as offline fallback.
 *
 * @param farmId - Optional farm identifier.
 * @returns Cached WeatherData or null if not found or corrupted.
 * @throws Never throws.
 */
export function getCachedFarmWeather(farmId?: FarmId): WeatherData | null {
  if (!farmId || typeof localStorage === 'undefined') {
    return null;
  }
  try {
    const raw = localStorage.getItem(`${WEATHER_STORAGE_KEY_PREFIX}${farmId}`);
    if (raw) {
      const parsed = JSON.parse(raw) as WeatherData;
      return {
        ...parsed,
        isOfflineFallback: true,
      };
    }
  } catch {
    // Corrupted cache, ignore
  }
  return null;
}

/**
 * Saves live weather data to localStorage cache.
 *
 * @summary Cache live weather.
 * @description Stores successfully fetched weather data in localStorage under the farm's key.
 *
 * @param farmId - Farm identifier.
 * @param weather - WeatherData to persist.
 * @returns void
 * @throws Never throws.
 */
export function cacheFarmWeather(farmId: FarmId | undefined, weather: WeatherData): void {
  if (!farmId || typeof localStorage === 'undefined' || weather.isOfflineFallback) {
    return;
  }
  try {
    localStorage.setItem(`${WEATHER_STORAGE_KEY_PREFIX}${farmId}`, JSON.stringify(weather));
  } catch (error) {
    console.warn('Failed to cache weather data to localStorage:', error);
  }
}

/**
 * Fetches real-time ambient weather for farm geographic coordinates.
 *
 * @summary Fetch farm weather.
 * @description Queries Open-Meteo for temperature_2m, relative_humidity_2m, hourly and 24h precipitation.
 * Checks navigator.onLine and applies timeout handling, seamlessly returning cached live data or
 * synthetic Mediterranean weather if offline or if network errors occur.
 *
 * @param coordinates - Geographic coordinates (latitude, longitude) of the farm.
 * @param timeoutMs - Request timeout in milliseconds (defaults to 8000 ms).
 * @param farmId - Optional farm identifier for localStorage caching.
 * @returns Promise resolving to WeatherData.
 * @throws Never throws; always resolves to valid WeatherData (live or cached/synthetic fallback).
 */
export async function fetchFarmWeather(
  coordinates: Coordinates,
  timeoutMs: number = DEFAULT_WEATHER_TIMEOUT_MS,
  farmId?: FarmId
): Promise<WeatherData> {
  // Helper to get fallback (cached live data first, then synthetic model)
  const getFallback = (): WeatherData => {
    const cached = getCachedFarmWeather(farmId);
    return cached ?? generateSyntheticWeather();
  };

  // 1. Immediately use cached or synthetic fallback if browser is explicitly offline
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return getFallback();
  }

  // 2. Construct Open-Meteo REST query with hourly precipitation for rolling 24h summation
  const queryParams = new URLSearchParams({
    latitude: coordinates.latitude.toString(),
    longitude: coordinates.longitude.toString(),
    current: 'temperature_2m,relative_humidity_2m,precipitation',
    hourly: 'precipitation',
    daily: 'precipitation_sum',
    timezone: 'auto',
  });

  const url = `${OPEN_METEO_BASE_URL}?${queryParams.toString()}`;

  // 3. Setup timeout controller safely across browser and test environments
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  let signal: AbortSignal | undefined;

  try {
    if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') {
      signal = AbortSignal.timeout(timeoutMs);
    } else if (typeof AbortController !== 'undefined') {
      const controller = new AbortController();
      timeoutId = setTimeout(() => controller.abort(), timeoutMs);
      signal = controller.signal;
    }
  } catch {
    // Proceed without signal if environment does not support it
  }

  try {
    const response = await fetch(url, {
      ...(signal ? { signal } : {}),
      headers: {
        Accept: 'application/json',
      },
    });

    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      console.warn(`Open-Meteo returned status ${response.status}: ${response.statusText}`);
      return getFallback();
    }

    const data = await response.json();
    const weather = parseOpenMeteoResponse(data);
    cacheFarmWeather(farmId, weather);
    return weather;
  } catch (error) {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    // Network failure, timeout, or abort - gracefully fall back without throwing
    console.warn('Weather fetch failed, utilizing cached/synthetic Mediterranean fallback:', error);
    return getFallback();
  }
}
