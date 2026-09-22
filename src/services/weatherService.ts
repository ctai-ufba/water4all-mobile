/**
 * @file weatherService.ts
 * @summary Weather fetching service with Open-Meteo integration and synthetic fallback.
 * @description Retrieves dry-bulb temperature, relative humidity and precipitation from the free
 * Open-Meteo REST API, both as a current reading and as the hourly series the ESA engine
 * integrates over. When the network, the API or the payload fails, falls back to recent cached
 * weather and then to deterministic synthetic Mediterranean weather.
 *
 * ## Fallback path
 *
 * Every failure mode takes the same route: **cache, then synthetic**. That includes a 200 OK
 * carrying a malformed body, which is a failure like a timeout and must not skip the cache. The
 * parser therefore reports failure by returning `null` rather than substituting synthetic data,
 * because a parser that silently invents data denies the caller the choice.
 *
 * Cached weather expires after `WEATHER_CACHE_TTL_MS`. Past that it is discarded in favour of the
 * synthetic model: a reading hours old is no longer a description of the current sky, and the
 * synthetic curve at least matches the season and hour.
 *
 * @example
 * ```ts
 * // Always resolves; never throws.
 * const weather = await fetchFarmWeather(farm.coordinates, 8000, farm.id);
 * weather.isOfflineFallback;          // false for live data, true for cache or synthetic
 * weather.hourly.temperatureC.length; // hours available to integrate
 * ```
 */

import { Coordinates, FarmId } from '../types/farm';
import { HourlyAmbientSeries, WeatherData } from '../types/weather';
import { generateSyntheticWeather } from '../domain/syntheticWeatherEngine';
import { createTimeoutSignal } from './requestTimeout';

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
    temperature_2m?: number[];
    relative_humidity_2m?: number[];
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
 * How long a cached reading may still stand in for live weather.
 *
 * @remarks Three hours is about how long a Mediterranean forecast stays a fair description of the
 * sky. Past it the synthetic seasonal model is the more honest answer, because it is at least
 * anchored to the current hour and season.
 */
export const WEATHER_CACHE_TTL_MS = 3 * 60 * 60 * 1000;

/** Storage key prefix for caching farm weather in localStorage */
export const WEATHER_STORAGE_KEY_PREFIX = 'water4all_weather_';

/** Hours of hourly forecast retained from a response, capped to bound cache size. */
export const MAX_FORECAST_HOURS = 168;

/** Envelope stored in localStorage, pairing a reading with when it was taken. */
interface CachedWeatherRecord {
  /** The live reading as parsed */
  weather: WeatherData;
  /** Epoch milliseconds at which the reading was cached */
  cachedAt: number;
}

/** Narrows an unknown value to a finite number. */
function asFiniteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/**
 * Locates the index in the hourly series matching the current reading's timestamp.
 *
 * @summary Align the hourly block to the current hour.
 * @description Open-Meteo returns the hourly block from the start of the local day, so the forecast
 * ahead of the farm begins partway through it. Matching on the `YYYY-MM-DDTHH` prefix finds where.
 *
 * @param times - The hourly block's timestamps, if it has any.
 * @param currentTime - Timestamp of the current reading.
 * @returns The index the forecast starts at, or `null` when the block cannot be aligned.
 * @throws Never throws.
 *
 * @remarks Returns `null` rather than defaulting to 0. Index 0 is the start of the local day, which
 * at 18:00 is eighteen hours in the past: reading it as "the next 24 hours" reports yesterday
 * morning's rain as a forecast, and starts the ESA integration at the wrong point in the diurnal
 * cycle. An unalignable block is unusable, and callers degrade instead.
 */
function findCurrentHourIndex(
  times: string[] | undefined,
  currentTime: string | undefined
): number | null {
  if (!Array.isArray(times) || times.length === 0 || !currentTime) {
    return null;
  }
  const currentHourPrefix = currentTime.slice(0, 13);
  const index = times.findIndex((t) => typeof t === 'string' && t.startsWith(currentHourPrefix));
  return index === -1 ? null : index;
}

/**
 * Extracts the forward-looking hourly temperature and humidity series.
 *
 * @remarks Samples are kept only while both temperature and humidity are finite, so a ragged tail
 * in one array cannot desynchronise the pair. When the payload carries no usable hourly block, the
 * current reading is held across a day: the ESA engine needs something to integrate, and a flat
 * day is a poorer but valid forecast.
 */
function extractHourlySeries(
  payload: OpenMeteoApiResponse,
  startIndex: number | null,
  current: { temperatureC: number; relativeHumidityPct: number },
  startTime: string
): HourlyAmbientSeries {
  const hourlyTemps = payload.hourly?.temperature_2m;
  const hourlyRh = payload.hourly?.relative_humidity_2m;

  if (startIndex !== null && Array.isArray(hourlyTemps) && Array.isArray(hourlyRh)) {
    const temperatureC: number[] = [];
    const relativeHumidityPct: number[] = [];
    const end = Math.min(hourlyTemps.length, hourlyRh.length, startIndex + MAX_FORECAST_HOURS);

    for (let i = startIndex; i < end; i += 1) {
      const temperature = asFiniteNumber(hourlyTemps[i]);
      const humidity = asFiniteNumber(hourlyRh[i]);
      if (temperature === null || humidity === null) {
        break;
      }
      temperatureC.push(temperature);
      relativeHumidityPct.push(Math.min(100, Math.max(0, humidity)));
    }

    if (temperatureC.length > 0) {
      return { temperatureC, relativeHumidityPct, startTime };
    }
  }

  return {
    temperatureC: new Array(24).fill(current.temperatureC),
    relativeHumidityPct: new Array(24).fill(current.relativeHumidityPct),
    startTime,
  };
}

/**
 * Sums the next 24 hours of precipitation, preferring the hourly series over the daily summary.
 *
 * @remarks Only uses the hourly block when it could be aligned to the current hour; otherwise the
 * daily summary is the honest answer, since an unaligned window would sum the wrong 24 hours.
 */
function extractPrecipitationForecast24hMm(
  payload: OpenMeteoApiResponse,
  startIndex: number | null
): number {
  const hourlyPrecip = payload.hourly?.precipitation;
  if (startIndex !== null && Array.isArray(hourlyPrecip)) {
    const window = hourlyPrecip.slice(startIndex, startIndex + 24);
    const sum = window.reduce<number>((acc, value) => acc + (asFiniteNumber(value) ?? 0), 0);
    return Math.round(sum * 10) / 10;
  }

  const dailyForecast = asFiniteNumber(payload.daily?.precipitation_sum?.[0]);
  return dailyForecast === null ? 0 : Math.max(0, Math.round(dailyForecast * 10) / 10);
}

/**
 * Parses an Open-Meteo API response into canonical WeatherData.
 *
 * @summary Parse an Open-Meteo response.
 * @description Extracts the current temperature, humidity and precipitation, the forward-looking
 * hourly temperature and humidity series, and the rolling 24-hour rainfall total.
 *
 * @param json - Raw JSON payload received from Open-Meteo.
 * @param fallbackDate - Date used for the timestamp when the payload carries none.
 * @returns Parsed WeatherData, or `null` when the payload is unusable.
 * @throws Never throws.
 *
 * @remarks Returns `null` rather than synthetic data so the caller can try its cache first. A
 * parser that substitutes invented data on failure makes the failure invisible.
 */
export function parseOpenMeteoResponse(
  json: unknown,
  fallbackDate: Date = new Date()
): WeatherData | null {
  if (!json || typeof json !== 'object') {
    return null;
  }

  const payload = json as OpenMeteoApiResponse;
  const current = payload.current;
  const temperature = asFiniteNumber(current?.temperature_2m);
  const humidity = asFiniteNumber(current?.relative_humidity_2m);

  if (temperature === null || humidity === null) {
    return null;
  }

  const temperatureC = Math.round(temperature * 10) / 10;
  const relativeHumidityPct = Math.round(Math.min(100, Math.max(0, humidity)));
  const timestamp = current?.time ?? fallbackDate.toISOString();
  const startIndex = findCurrentHourIndex(payload.hourly?.time, current?.time);

  return {
    temperatureC,
    relativeHumidityPct,
    currentPrecipitationMm: Math.max(0, asFiniteNumber(current?.precipitation) ?? 0),
    precipitationForecast24hMm: extractPrecipitationForecast24hMm(payload, startIndex),
    isOfflineFallback: false,
    timestamp,
    hourly: extractHourlySeries(
      payload,
      startIndex,
      { temperatureC, relativeHumidityPct },
      timestamp
    ),
  };
}

/**
 * Retrieves cached weather from localStorage if it is still fresh.
 *
 * @summary Get cached weather.
 * @description Reads a previously stored live reading, discarding it once older than
 * `WEATHER_CACHE_TTL_MS`. What it returns is marked `isOfflineFallback: true`, so a cached reading
 * is never presented as current.
 *
 * @param farmId - Farm identifier; omit and nothing is read.
 * @returns Cached WeatherData, or null when absent, corrupted or stale.
 * @throws Never throws.
 */
export function getCachedFarmWeather(farmId?: FarmId): WeatherData | null {
  if (!farmId || typeof localStorage === 'undefined') {
    return null;
  }

  try {
    const raw = localStorage.getItem(`${WEATHER_STORAGE_KEY_PREFIX}${farmId}`);
    if (!raw) {
      return null;
    }

    const record = JSON.parse(raw) as CachedWeatherRecord;
    if (!record?.weather || typeof record.cachedAt !== 'number') {
      return null;
    }
    if (Date.now() - record.cachedAt > WEATHER_CACHE_TTL_MS) {
      return null;
    }

    return { ...record.weather, isOfflineFallback: true };
  } catch {
    // Corrupted cache, ignore
    return null;
  }
}

/**
 * Saves live weather data to the localStorage cache.
 *
 * @summary Cache live weather.
 * @description Stores a successfully fetched reading under the farm's key, stamped with the time
 * it was taken so freshness can be judged on read.
 *
 * @param farmId - Farm identifier; omit and nothing is written.
 * @param weather - WeatherData to persist. Synthetic readings are refused, so the cache never
 * holds anything but observations.
 * @returns void
 * @throws Never throws.
 */
export function cacheFarmWeather(farmId: FarmId | undefined, weather: WeatherData): void {
  if (!farmId || typeof localStorage === 'undefined' || weather.isOfflineFallback) {
    return;
  }
  try {
    const record: CachedWeatherRecord = { weather, cachedAt: Date.now() };
    localStorage.setItem(`${WEATHER_STORAGE_KEY_PREFIX}${farmId}`, JSON.stringify(record));
  } catch (error) {
    console.warn('Failed to cache weather data to localStorage:', error);
  }
}

/**
 * Fetches real-time ambient weather for a farm's coordinates.
 *
 * @summary Fetch farm weather.
 * @description Queries Open-Meteo for the current reading plus the hourly temperature, humidity
 * and precipitation series, on one free, key-less request. Checks `navigator.onLine`, applies a
 * timeout, and on any failure returns fresh cached weather, or synthetic Mediterranean weather.
 *
 * @param coordinates - Geographic coordinates (latitude, longitude) of the farm.
 * @param timeoutMs - Request timeout in milliseconds (defaults to 8000 ms).
 * @param farmId - Farm identifier, used for caching and to pick the synthetic climate normals.
 * @returns Promise resolving to WeatherData, live or fallback.
 * @throws Never throws; always resolves to valid WeatherData.
 */
export async function fetchFarmWeather(
  coordinates: Coordinates,
  timeoutMs: number = DEFAULT_WEATHER_TIMEOUT_MS,
  farmId?: FarmId
): Promise<WeatherData> {
  // Cached live data first, then the synthetic model for the farm's own climate.
  const getFallback = (): WeatherData =>
    getCachedFarmWeather(farmId) ?? generateSyntheticWeather(new Date(), farmId);

  // 1. Skip the request entirely when the browser reports itself offline
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return getFallback();
  }

  // 2. Construct the Open-Meteo query. The hourly temperature and humidity series rides on the
  //    same request as precipitation, at no extra cost (ADR 0003).
  const queryParams = new URLSearchParams({
    latitude: coordinates.latitude.toString(),
    longitude: coordinates.longitude.toString(),
    current: 'temperature_2m,relative_humidity_2m,precipitation',
    hourly: 'temperature_2m,relative_humidity_2m,precipitation',
    daily: 'precipitation_sum',
    timezone: 'auto',
  });

  const url = `${OPEN_METEO_BASE_URL}?${queryParams.toString()}`;

  // 3. Time the request out, however the running environment allows it to be timed out
  const timeout = createTimeoutSignal(timeoutMs);

  try {
    const response = await fetch(url, {
      ...(timeout.signal ? { signal: timeout.signal } : {}),
      headers: { Accept: 'application/json' },
    });

    if (!response.ok) {
      console.warn(`Open-Meteo returned status ${response.status}: ${response.statusText}`);
      return getFallback();
    }

    const weather = parseOpenMeteoResponse(await response.json());

    // A 200 OK carrying an unusable body is a failure like any other, and takes the same path.
    if (!weather) {
      console.warn('Open-Meteo returned a malformed payload; using cached or synthetic weather.');
      return getFallback();
    }

    cacheFarmWeather(farmId, weather);
    return weather;
  } catch (error) {
    // Network failure, timeout, or abort - gracefully fall back without throwing
    console.warn('Weather fetch failed, utilizing cached/synthetic Mediterranean fallback:', error);
    return getFallback();
  } finally {
    timeout.cancel();
  }
}
