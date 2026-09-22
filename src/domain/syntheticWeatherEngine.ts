/**
 * @file syntheticWeatherEngine.ts
 * @summary Synthetic Mediterranean weather generation engine for offline fallback.
 * @description Produces a deterministic, physically coupled hourly forecast from each farm's
 * monthly climate normals: a diurnal temperature cycle, relative humidity reconstructed from a
 * daily dew point, and precipitation drawn as discrete rainfall events.
 *
 * @remarks Two properties matter to the consumers downstream. The ESA engine integrates across the
 * hourly series, so the generator must supply the diurnal shape rather than a single reading
 * (ADR 0003). And the catchment estimator sees rain as events, not as a monthly average smeared
 * across every day, because a Mediterranean July is dry throughout with a rare shower rather than
 * a trace of rain daily.
 *
 * Everything this module returns carries `isOfflineFallback: true`; it is never presented as live.
 */

import { AmbientConditions, HourlyAmbientSeries, WeatherData } from '../types/weather';
import { FarmId } from '../types/farm';
import {
  MonthlyClimateNormals,
  DEFAULT_MEDITERRANEAN_NORMALS,
  getClimateNormals,
} from './climatology';

/**
 * Days of hourly forecast the generator produces.
 *
 * @remarks Matches the ESA engine's steady-state horizon, so an offline farm integrates over the
 * same window length as one reading a live Open-Meteo forecast.
 */
export const SYNTHETIC_FORECAST_DAYS = 7;

/** Re-exported for consumers that only need the generic curves (see `climatology.ts`). */
export { DEFAULT_MEDITERRANEAN_NORMALS };

/** Monthly baseline mean dry-bulb temperatures for the generic Mediterranean curve (°C) */
export const MONTHLY_MEAN_TEMPERATURE_C = DEFAULT_MEDITERRANEAN_NORMALS.meanTemperatureC;

/** Monthly baseline mean relative humidity for the generic Mediterranean curve (%) */
export const MONTHLY_MEAN_RH_PCT = DEFAULT_MEDITERRANEAN_NORMALS.meanRelativeHumidityPct;

/** Monthly diurnal temperature cycle ranges for the generic Mediterranean curve (°C) */
export const MONTHLY_DIURNAL_RANGE_C = DEFAULT_MEDITERRANEAN_NORMALS.diurnalRangeC;

/** Typical monthly cumulative rainfall for the generic Mediterranean curve (mm/month) */
export const MONTHLY_PRECIPITATION_MM = DEFAULT_MEDITERRANEAN_NORMALS.precipitationMm;

/** Standard Mediterranean UTC offset in hours (UTC+1 for Central European Time) */
export const DEFAULT_MEDITERRANEAN_UTC_OFFSET_HOURS = 1;

/**
 * Calculates saturation vapor pressure of water using the Magnus-Tetens formula.
 *
 * @summary Calculate saturation vapor pressure.
 * @description Evaluates P_sat (kPa) = 0.61094 * exp(17.625 * T / (T + 243.04)).
 *
 * @param temperatureC - Temperature in degrees Celsius (°C).
 * @returns Saturation vapor pressure in kilopascals (kPa).
 * @throws Never throws.
 */
export function calculateSaturationVaporPressureKPa(temperatureC: number): number {
  return 0.61094 * Math.exp((17.625 * temperatureC) / (temperatureC + 243.04));
}

/**
 * Calculates the atmospheric dew point temperature.
 *
 * @summary Calculate dew point temperature.
 * @description Derives dew point from ambient temperature and relative humidity
 * by inverting the Magnus formula.
 *
 * @param conditions - Ambient atmospheric conditions (dry-bulb temperature and relative humidity).
 * @returns Dew point temperature in degrees Celsius (°C).
 * @throws Never throws.
 */
export function calculateDewPointC(conditions: AmbientConditions): number {
  const { temperatureC, relativeHumidityPct } = conditions;
  const boundedRh = Math.min(100.0, Math.max(0.1, relativeHumidityPct)) / 100.0;
  const gamma = Math.log(boundedRh) + (17.625 * temperatureC) / (243.04 + temperatureC);
  return (243.04 * gamma) / (17.625 - gamma);
}

/**
 * Interpolates monthly values smoothly across days using a cosine weight.
 *
 * @summary Smooth monthly interpolation.
 * @description Provides continuous transitions between monthly climate averages, so a forecast
 * spanning a month boundary does not step.
 *
 * @param monthlyValues - 12 monthly values.
 * @param dayOfYear - Day of year (may exceed 365; it wraps).
 * @returns Smoothly interpolated value.
 * @throws Never throws.
 */
function smoothMonthly(monthlyValues: readonly number[], dayOfYear: number): number {
  const monthCount = monthlyValues.length;
  const daysPerMonth = 30.5;
  const wrapped = ((dayOfYear % 366) + 366) % 366;
  const month = Math.floor(wrapped / daysPerMonth) % monthCount;
  const fraction = (wrapped % daysPerMonth) / daysPerMonth;
  // Cosine easing for smooth curve
  const weight = 0.5 - 0.5 * Math.cos(Math.PI * fraction);
  const nextMonth = (month + 1) % monthCount;
  return monthlyValues[month] + weight * (monthlyValues[nextMonth] - monthlyValues[month]);
}

/** Day of year (0 - 365) in UTC, so output does not drift with the client's timezone. */
function dayOfYearUtc(date: Date): number {
  const startOfYear = Date.UTC(date.getUTCFullYear(), 0, 0);
  return Math.floor((date.getTime() - startOfYear) / 86400000);
}

/**
 * Maps a key to a stable value in [0, 1).
 *
 * @summary Deterministic unit-interval hash.
 * @description FNV-1a over the key followed by an avalanche mix, so neighbouring days land on
 * uncorrelated draws. Determinism is the point: the same farm and date must always produce the
 * same weather, both so the offline fallback is reproducible and so tests can pin it.
 *
 * @param key - Arbitrary seed string.
 * @returns A number in [0, 1).
 * @throws Never throws.
 */
function hashUnitInterval(key: string): number {
  let hash = 2166136261;
  for (let i = 0; i < key.length; i += 1) {
    hash ^= key.codePointAt(i) ?? 0;
    hash = Math.imul(hash, 16777619);
  }
  // Avalanche so that adjacent seeds do not produce adjacent draws.
  hash ^= hash >>> 15;
  hash = Math.imul(hash, 2246822507);
  hash ^= hash >>> 13;
  hash = Math.imul(hash, 3266489909);
  hash ^= hash >>> 16;
  return (hash >>> 0) / 4294967296;
}

/**
 * Draws a day's rainfall as a discrete event.
 *
 * @summary Generate discrete daily rainfall.
 * @description Treats each day as a Bernoulli draw at the month's climatological rain frequency.
 * A day that rains delivers the month's total divided by its mean rainy-day count, so the expected
 * monthly depth equals the normal while individual days are either dry or genuinely wet.
 *
 * @param date - The day to draw for.
 * @param normals - Monthly climate normals for the location.
 * @param seedKey - Stable per-location seed, so two farms do not share a rain calendar.
 * @returns Rainfall depth for the day in millimeters (mm); 0 on a dry day.
 * @throws Never throws.
 */
function generateDailyPrecipitationMm(
  date: Date,
  normals: MonthlyClimateNormals,
  seedKey: string
): number {
  const month = date.getUTCMonth();
  const rainyDays = normals.rainyDays[month];
  if (rainyDays <= 0) {
    return 0;
  }

  const daysInMonth = new Date(Date.UTC(date.getUTCFullYear(), month + 1, 0)).getUTCDate();
  const rainProbability = Math.min(1, rainyDays / daysInMonth);
  const draw = hashUnitInterval(
    `${seedKey}:${date.getUTCFullYear()}-${month}-${date.getUTCDate()}`
  );

  if (draw >= rainProbability) {
    return 0;
  }

  const eventDepthMm = normals.precipitationMm[month] / rainyDays;
  return Math.round(eventDepthMm * 10) / 10;
}

/**
 * Builds the hourly ambient forecast series.
 *
 * @summary Generate a synthetic hourly series.
 * @description Walks forward hour by hour from the supplied instant. Each day takes its mean
 * temperature, mean humidity and diurnal range from the interpolated normals, then hourly
 * temperature follows a sine cycle troughing around 03:00 and peaking around 15:00 solar time.
 * Hourly humidity is reconstructed from that day's dew point, so vapour content is held constant
 * across the day and humidity moves inversely to temperature rather than varying independently.
 *
 * @param date - Instant the series starts at; index 0 is this hour.
 * @param normals - Monthly climate normals for the location.
 * @param horizonDays - Days of forecast to produce.
 * @returns An HourlyAmbientSeries spanning `horizonDays * 24` samples.
 * @throws Never throws.
 */
export function generateSyntheticHourlySeries(
  date: Date,
  normals: MonthlyClimateNormals = DEFAULT_MEDITERRANEAN_NORMALS,
  horizonDays: number = SYNTHETIC_FORECAST_DAYS
): HourlyAmbientSeries {
  const startSolarHour = (date.getUTCHours() + normals.utcOffsetHours + 24) % 24;
  const baseDayOfYear = dayOfYearUtc(date);
  const totalHours = Math.max(0, Math.floor(horizonDays)) * 24;

  const temperatureC: number[] = [];
  const relativeHumidityPct: number[] = [];

  // Dew point only changes between days, so it is recomputed when the day rolls over rather than
  // on every hour.
  let cachedDayOffset = -1;
  let meanTemperature = 0;
  let diurnalRange = 0;
  let vaporPressureKPa = 0;

  for (let hour = 0; hour < totalHours; hour += 1) {
    const absoluteSolarHour = startSolarHour + hour;
    const dayOffset = Math.floor(absoluteSolarHour / 24);
    const solarHour = absoluteSolarHour % 24;

    if (dayOffset !== cachedDayOffset) {
      const dayOfYear = baseDayOfYear + dayOffset;
      meanTemperature = smoothMonthly(normals.meanTemperatureC, dayOfYear);
      diurnalRange = smoothMonthly(normals.diurnalRangeC, dayOfYear);
      const meanRh = smoothMonthly(normals.meanRelativeHumidityPct, dayOfYear);
      const dewPoint = calculateDewPointC({
        temperatureC: meanTemperature,
        relativeHumidityPct: meanRh,
      });
      vaporPressureKPa = calculateSaturationVaporPressureKPa(dewPoint);
      cachedDayOffset = dayOffset;
    }

    const hourlyTemperature =
      meanTemperature + 0.5 * diurnalRange * Math.sin((2.0 * Math.PI * (solarHour - 9.0)) / 24.0);
    const hourlyRh = Math.min(
      100.0,
      Math.max(5.0, (100.0 * vaporPressureKPa) / calculateSaturationVaporPressureKPa(hourlyTemperature))
    );

    temperatureC.push(Math.round(hourlyTemperature * 10) / 10);
    relativeHumidityPct.push(Math.round(hourlyRh * 10) / 10);
  }

  return { temperatureC, relativeHumidityPct, startTime: date.toISOString() };
}

/**
 * Generates synthetic Mediterranean weather for a farm and instant.
 *
 * @summary Generate synthetic seasonal Mediterranean weather.
 * @description Produces the instantaneous reading, the hourly forecast series the ESA engine
 * integrates over, and the day's rainfall, all from the farm's monthly climate normals. Falls back
 * to generic Mediterranean curves when no farm is supplied.
 *
 * @param date - Target instant (defaults to now).
 * @param farmId - Farm whose climate normals to use; omit for the generic Mediterranean curve.
 * @param horizonDays - Days of hourly forecast to produce (defaults to SYNTHETIC_FORECAST_DAYS).
 * @returns WeatherData marked with `isOfflineFallback: true`.
 * @throws Never throws.
 *
 * @example
 * ```ts
 * const weather = generateSyntheticWeather(new Date(), 'small-farm');
 * weather.isOfflineFallback;                 // true
 * weather.hourly.temperatureC.length;        // 168
 * weather.precipitationForecast24hMm;        // 0 on a dry day, ~10.5 mm on a January rain day
 * ```
 */
export function generateSyntheticWeather(
  date: Date = new Date(),
  farmId?: FarmId,
  horizonDays: number = SYNTHETIC_FORECAST_DAYS
): WeatherData {
  const normals = getClimateNormals(farmId);
  const hourly = generateSyntheticHourlySeries(date, normals, horizonDays);

  // The instantaneous reading is the first sample of the series, so the card and the ESA
  // integration can never disagree about the current hour.
  const temperatureC = hourly.temperatureC[0] ?? 0;
  const relativeHumidityPct = hourly.relativeHumidityPct[0] ?? 0;

  return {
    temperatureC,
    relativeHumidityPct: Math.round(relativeHumidityPct),
    // Whether rain is falling at this exact instant is not modelled; only the day's total is.
    currentPrecipitationMm: 0,
    precipitationForecast24hMm: generateDailyPrecipitationMm(date, normals, farmId ?? 'default'),
    isOfflineFallback: true,
    timestamp: date.toISOString(),
    hourly,
  };
}
