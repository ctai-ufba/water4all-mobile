/**
 * @file climatology.ts
 * @summary Monthly climate normals for the two Mediterranean farm locations.
 * @description Supplies the seasonal temperature, humidity, diurnal range and precipitation
 * statistics that drive the synthetic offline weather fallback.
 *
 * @remarks These are approximate monthly normals for the nearest long-record station to each farm
 * (AEMET Málaga for Antequera, HNMS Heraklion for Crete), rounded to the precision an offline
 * fallback needs. They are not station-exact observations and are never presented as live data: the
 * generator marks everything it produces with `isOfflineFallback: true`.
 *
 * Rainy-days counts are what make precipitation fall as discrete events rather than as a flat
 * monthly average smeared across every day. A Mediterranean July is not 0.02 mm every day; it is
 * dry almost throughout with a rare shower, and the catchment estimator should see that shape.
 */

import { FarmId } from '../types/farm';

/**
 * Monthly climate normals for one location, indexed 0 (January) through 11 (December).
 */
export interface MonthlyClimateNormals {
  /** Mean dry-bulb temperature per month in degrees Celsius (°C) */
  meanTemperatureC: readonly number[];
  /** Mean relative humidity per month (0 - 100%) */
  meanRelativeHumidityPct: readonly number[];
  /** Mean daily temperature swing per month in degrees Celsius (°C) */
  diurnalRangeC: readonly number[];
  /** Mean cumulative precipitation per month in millimeters (mm) */
  precipitationMm: readonly number[];
  /** Mean count of days recording measurable rainfall per month */
  rainyDays: readonly number[];
  /** Standard-time UTC offset in hours, used to align the diurnal solar curve */
  utcOffsetHours: number;
}

/**
 * Antequera, Andalusia, Spain (37.02° N, 4.56° W).
 *
 * @remarks Inland Andalusia, so winters are cooler and summers hotter than the Málaga coast, and
 * the diurnal swing is wide. Roughly 490 mm of rain across about 50 rainy days, almost none of it
 * between June and August.
 */
export const ANTEQUERA_NORMALS: MonthlyClimateNormals = {
  meanTemperatureC: [9.0, 10.2, 12.7, 14.9, 18.8, 23.5, 26.9, 26.7, 22.8, 17.8, 12.9, 9.8],
  meanRelativeHumidityPct: [76, 72, 66, 62, 58, 53, 49, 52, 61, 69, 75, 78],
  diurnalRangeC: [9.0, 10.0, 11.5, 12.5, 14.0, 15.5, 16.0, 15.5, 13.5, 11.5, 9.5, 8.5],
  precipitationMm: [69.0, 54.0, 44.0, 42.0, 23.0, 8.0, 1.0, 4.0, 20.0, 60.0, 85.0, 79.0],
  rainyDays: [6.6, 5.6, 5.0, 5.6, 3.4, 1.1, 0.2, 0.6, 2.8, 5.6, 6.7, 7.0],
  utcOffsetHours: 1,
};

/**
 * Heraklion, Crete, Greece (35.34° N, 25.14° E).
 *
 * @remarks Maritime, so the diurnal swing is narrow and humidity stays high year round. Rainfall
 * totals resemble Antequera's but arrive over more days, concentrated in a wetter winter, and the
 * summer is drier still.
 */
export const HERAKLION_NORMALS: MonthlyClimateNormals = {
  meanTemperatureC: [12.1, 12.2, 13.7, 16.6, 20.4, 24.4, 26.3, 26.2, 23.6, 20.2, 16.7, 13.6],
  meanRelativeHumidityPct: [70, 69, 68, 66, 64, 58, 55, 57, 62, 68, 70, 71],
  diurnalRangeC: [6.5, 6.5, 7.0, 7.5, 8.0, 8.5, 8.5, 8.5, 8.0, 7.5, 7.0, 6.5],
  precipitationMm: [91.6, 76.5, 51.0, 24.4, 16.1, 3.1, 0.6, 1.0, 15.6, 55.5, 65.1, 85.0],
  rainyDays: [12.5, 10.5, 8.4, 4.9, 3.0, 0.9, 0.2, 0.2, 1.9, 6.0, 7.3, 11.4],
  utcOffsetHours: 2,
};

/**
 * Generic Mediterranean normals used when no farm is known.
 *
 * @remarks Carries the seasonal temperature, humidity and diurnal curves of
 * `prototipo_water4all`'s synthetic generator (`src/h2o_farm/physics/weather.py`), so weather
 * produced without a farm context stays comparable with the prototype's own scenarios.
 */
export const DEFAULT_MEDITERRANEAN_NORMALS: MonthlyClimateNormals = {
  meanTemperatureC: [10.5, 11.5, 13.5, 16.0, 20.0, 24.0, 27.0, 27.0, 24.0, 19.5, 14.5, 11.0],
  meanRelativeHumidityPct: [79.0, 76.0, 72.0, 67.0, 61.0, 55.0, 51.0, 53.0, 61.0, 70.0, 77.0, 80.0],
  diurnalRangeC: [7.0, 8.0, 9.0, 10.0, 12.0, 14.0, 15.0, 14.0, 12.0, 10.0, 8.0, 7.0],
  precipitationMm: [60.0, 48.0, 38.0, 25.0, 14.0, 4.0, 1.0, 2.5, 18.0, 52.0, 68.0, 72.0],
  rainyDays: [8.0, 7.0, 6.0, 5.0, 3.0, 1.0, 0.3, 0.6, 2.5, 6.0, 8.0, 9.0],
  utcOffsetHours: 1,
};

/** Monthly climate normals keyed by farm profile. */
export const FARM_CLIMATE_NORMALS: Record<FarmId, MonthlyClimateNormals> = {
  'small-farm': ANTEQUERA_NORMALS,
  'medium-farm': HERAKLION_NORMALS,
};

/**
 * Resolves the climate normals for a farm.
 *
 * @summary Get climate normals for a farm.
 * @description Returns the farm's monthly normals, falling back to the generic Mediterranean
 * curves when no farm is supplied or the identifier is unrecognised.
 *
 * @param farmId - Farm identifier, or undefined when no farm is active.
 * @returns The matching MonthlyClimateNormals, never null.
 * @throws Never throws.
 */
export function getClimateNormals(farmId?: FarmId | null): MonthlyClimateNormals {
  if (farmId && farmId in FARM_CLIMATE_NORMALS) {
    return FARM_CLIMATE_NORMALS[farmId];
  }
  return DEFAULT_MEDITERRANEAN_NORMALS;
}
