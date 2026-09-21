/**
 * @file syntheticWeatherEngine.ts
 * @summary Synthetic Mediterranean weather generation engine for offline fallback.
 * @description Provides a deterministic, physically coupled weather generator producing
 * ambient temperature, relative humidity, and precipitation forecasts based on seasonal
 * Mediterranean climate curves from prototipo_water4all.
 */

import { AmbientConditions, WeatherData } from '../types/weather';

/** Monthly baseline mean dry-bulb temperatures for Mediterranean regions (°C) */
export const MONTHLY_MEAN_TEMPERATURE_C = [
  10.5, 11.5, 13.5, 16.0, 20.0, 24.0, 27.0, 27.0, 24.0, 19.5, 14.5, 11.0,
] as const;

/** Monthly baseline mean relative humidity percentages for Mediterranean regions (%) */
export const MONTHLY_MEAN_RH_PCT = [
  79.0, 76.0, 72.0, 67.0, 61.0, 55.0, 51.0, 53.0, 61.0, 70.0, 77.0, 80.0,
] as const;

/** Monthly diurnal temperature cycle ranges (°C) */
export const MONTHLY_DIURNAL_RANGE_C = [
  7.0, 8.0, 9.0, 10.0, 12.0, 14.0, 15.0, 14.0, 12.0, 10.0, 8.0, 7.0,
] as const;

/** Typical monthly cumulative rainfall depths for Mediterranean regions (mm/month) */
export const MONTHLY_PRECIPITATION_MM = [
  60.0, 48.0, 38.0, 25.0, 14.0, 4.0, 1.0, 2.5, 18.0, 52.0, 68.0, 72.0,
] as const;

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
 * @description Provides continuous transitions between monthly climate averages.
 *
 * @param monthlyValues - 12 monthly values.
 * @param dayOfYear - Day of year (0 to 365).
 * @returns Smoothly interpolated value.
 * @throws Never throws.
 */
function smoothMonthly(monthlyValues: readonly number[], dayOfYear: number): number {
  const monthCount = monthlyValues.length;
  const daysPerMonth = 30.5;
  const month = Math.floor(dayOfYear / daysPerMonth) % monthCount;
  const fraction = (dayOfYear % daysPerMonth) / daysPerMonth;
  // Cosine easing for smooth curve
  const weight = 0.5 - 0.5 * Math.cos(Math.PI * fraction);
  const nextMonth = (month + 1) % monthCount;
  return monthlyValues[month] + weight * (monthlyValues[nextMonth] - monthlyValues[month]);
}

/** Standard Mediterranean UTC offset in hours (UTC+1 for Central European Time) */
export const DEFAULT_MEDITERRANEAN_UTC_OFFSET_HOURS = 1;

/**
 * Generates synthetic Mediterranean weather for a given date or current time.
 *
 * @summary Generate synthetic seasonal Mediterranean weather.
 * @description Computes coupled ambient temperature, relative humidity, and 24h precipitation
 * forecast from Mediterranean climate records. Incorporates Mediterranean UTC offset to align
 * diurnal solar curves regardless of the user client's local timezone.
 *
 * @param date - Optional target Date object (defaults to new Date()).
 * @param timezoneOffsetHours - UTC offset in hours for solar cycle alignment (defaults to 1 for CET).
 * @returns WeatherData object marked with isOfflineFallback: true.
 * @throws Never throws.
 */
export function generateSyntheticWeather(
  date: Date = new Date(),
  timezoneOffsetHours: number = DEFAULT_MEDITERRANEAN_UTC_OFFSET_HOURS
): WeatherData {
  // Day of year calculation (0 to 365)
  const startOfYear = new Date(date.getFullYear(), 0, 0);
  const diff = date.getTime() - startOfYear.getTime();
  const dayOfYear = Math.floor(diff / (1000 * 60 * 60 * 24));

  // Compute solar hour aligned with Mediterranean timezone (UTC + offset)
  const solarHour = (date.getUTCHours() + timezoneOffsetHours + 24) % 24;

  // 1. Interpolate monthly means for day of year
  const meanTemp = smoothMonthly(MONTHLY_MEAN_TEMPERATURE_C, dayOfYear);
  const meanRh = smoothMonthly(MONTHLY_MEAN_RH_PCT, dayOfYear);
  const diurnalRange = smoothMonthly(MONTHLY_DIURNAL_RANGE_C, dayOfYear);
  const monthlyRain = smoothMonthly(MONTHLY_PRECIPITATION_MM, dayOfYear);

  // 2. Compute dew point from daily means
  const dewPoint = calculateDewPointC({ temperatureC: meanTemp, relativeHumidityPct: meanRh });
  const vaporPressure = calculateSaturationVaporPressureKPa(dewPoint);

  // 3. Hourly temperature variation (troughs at 03:00, peaks around 15:00 solar time)
  const hourlyTemp =
    meanTemp + 0.5 * diurnalRange * Math.sin((2.0 * Math.PI * (solarHour - 9.0)) / 24.0);

  // 4. Physically coupled relative humidity
  const satVaporPressure = calculateSaturationVaporPressureKPa(hourlyTemp);
  const hourlyRh = Math.min(100.0, Math.max(5.0, (100.0 * vaporPressure) / satVaporPressure));

  // 5. Estimated 24h precipitation forecast (daily average scaled for the season)
  const forecastRain24h = Math.round((monthlyRain / 30.0) * 10) / 10;

  return {
    temperatureC: Math.round(hourlyTemp * 10) / 10,
    relativeHumidityPct: Math.round(hourlyRh),
    currentPrecipitationMm: 0,
    precipitationForecast24hMm: forecastRain24h,
    isOfflineFallback: true,
    timestamp: date.toISOString(),
  };
}

