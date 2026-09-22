/**
 * @file demoEngine.ts
 * @summary Demo controller simulation engine, scenarios, and pre-computed optimization.
 * @description Provides calculation functions for time advancement, diurnal cycle updates,
 * extreme weather and flow scenario generation ("Live Weather", "Severe Drought", "Heavy Storm",
 * "High Salinity"), unoptimized baseline parameters, and pre-computed optimal parameters (ADR 0002).
 */

import { FarmProfile, TankCapacities } from '../types/farm';
import {
  TankVolumeMetrics,
  WaterFlowMetrics,
  TelemetrySnapshot,
  getFarmBaseline,
} from '../types/telemetry';
import { calculateIrrigationDemand } from './supervisoryEngine';
import { WeatherData } from '../types/weather';
import { roundTo2Decimals } from './telemetryEngine';
import { generateSyntheticWeather } from './syntheticWeatherEngine';
import { calculateESAWaterProduction } from './esaPhysicsEngine';

/**
 * Supported simulation scenario identifiers for live demonstrations.
 * - 'live': Live ambient weather (Open-Meteo or synthetic Mediterranean seasonal).
 * - 'drought': Severe heatwave with high temperatures, low humidity, zero rainfall, and elevated crop demand.
 * - 'storm': Heavy precipitation event with saturated humidity, high catchment inflow, and lowered irrigation demand.
 * - 'salinity': High salinity / external supply dominance provoking FAO crop compliance warnings in the Blend tank.
 */
export type DemoScenarioId = 'live' | 'drought' | 'storm' | 'salinity';

export type { TelemetrySnapshot };

/**
 * Optimization progress phase definition for the 2-second animated modal.
 */
export interface OptimizationPhaseInfo {
  /** Minimum elapsed time in milliseconds for this phase */
  startMs: number;
  /** Percentage progress value (0 - 100) */
  progress: number;
  /** Human-readable status label explaining the algorithmic operation */
  label: string;
}

/**
 * Sequence of optimization phases executed during the 2-second progress animation.
 */
export const OPTIMIZATION_PHASES: OptimizationPhaseInfo[] = [
  {
    startMs: 0,
    progress: 15,
    label: 'Analyzing local weather & solar irradiance...',
  },
  {
    startMs: 500,
    progress: 50,
    label: 'Calibrating crop ET₀ & soil moisture deficit...',
  },
  {
    startMs: 1100,
    progress: 80,
    label: 'Tuning Blend tank target volumes & mass balance...',
  },
  {
    startMs: 1600,
    progress: 100,
    label: 'Optimal Design Applied (ADR 0002)',
  },
];

/**
 * Calibrated crop irrigation schedules per farm profile, in m³/day.
 *
 * @remarks These match the profile baselines in BASELINE_TELEMETRY: an optimized farm irrigates
 * exactly what its calibration calls for, and saves water through the irrigation mode instead.
 */
const SMALL_FARM_CALIBRATED_SCHEDULE = 2.1;
const MEDIUM_FARM_CALIBRATED_SCHEDULE = 5.8;

/**
 * Unoptimized crop irrigation schedules per farm profile, in m³/day.
 *
 * @remarks Deliberately above the calibrated schedules: over-irrigation on a naive fixed
 * schedule is the defining trait of the unoptimized baseline, and it is what the optimization
 * demo removes. Expressed as a schedule rather than an effective demand so it survives a reload:
 * TelemetryProvider re-derives the effective demand from schedule and mode on every load.
 */
const SMALL_FARM_UNOPTIMIZED_SCHEDULE = 2.8;
const MEDIUM_FARM_UNOPTIMIZED_SCHEDULE = 7.2;

/**
 * Pre-computed optimal parameters adhering to ADR 0002 for Mediterranean farm profiles.
 */
export const OPTIMAL_FARM_PARAMETERS: Record<string, TelemetrySnapshot> = {
  'small-farm': {
    volumes: {
      rainwater: 36.0, // 80% capacity buffer (45 m³)
      esa: 9.6,        // 80% capacity buffer (12 m³)
      external: 5.0,   // Minimal external reliance (20 m³)
      blend: 28.0,     // Exact target volume (35 m³ capacity, min 7 m³, 0 deficit)
    },
    flows: {
      rainwaterInflow: 2.8,
      esaInflow: 1.4,
      externalInflow: 0.0,
      irrigationDemand: calculateIrrigationDemand(SMALL_FARM_CALIBRATED_SCHEDULE, 'eco'),
      humanUtilityDemand: 0.5,
      livestockDemand: 0.0,
    },
    cumulativeTruckCost: 0.0,
    irrigationMode: 'eco',
    scheduledIrrigationDemand: SMALL_FARM_CALIBRATED_SCHEDULE,
  },
  'medium-farm': {
    volumes: {
      rainwater: 96.0, // 80% capacity buffer (120 m³)
      esa: 24.0,       // 80% capacity buffer (30 m³)
      external: 15.0,  // Minimal buffer (60 m³)
      blend: 65.0,     // Exact target volume (80 m³ capacity, min 16 m³, 0 deficit)
    },
    flows: {
      rainwaterInflow: 5.2,
      esaInflow: 3.2,
      externalInflow: 0.5,
      irrigationDemand: calculateIrrigationDemand(MEDIUM_FARM_CALIBRATED_SCHEDULE, 'eco'),
      humanUtilityDemand: 0.8,
      livestockDemand: 1.4,
    },
    cumulativeTruckCost: 0.0,
    irrigationMode: 'eco',
    scheduledIrrigationDemand: MEDIUM_FARM_CALIBRATED_SCHEDULE,
  },
};

/**
 * Pre-calibrated unoptimized baseline parameters for Mediterranean farm profiles.
 * Exhibits depleted tanks below minimum operating volume, high truck costs, and quality violations.
 */
export const UNOPTIMIZED_BASELINES: Record<string, TelemetrySnapshot> = {
  'small-farm': {
    volumes: {
      rainwater: 2.5,
      esa: 0.8,
      external: 18.0, // Heavily reliant on external supply
      blend: 5.5,     // Breaches min operating volume (7.0 m³) -> 1.5 m³ deficit!
    },
    flows: {
      rainwaterInflow: 0.5,
      esaInflow: 0.6,
      externalInflow: 3.0,
      irrigationDemand: calculateIrrigationDemand(SMALL_FARM_UNOPTIMIZED_SCHEDULE, 'auto'),
      humanUtilityDemand: 0.5,
      livestockDemand: 0.0,
    },
    cumulativeTruckCost: 382.50, // Frequent emergency truck orders
    irrigationMode: 'auto',
    scheduledIrrigationDemand: SMALL_FARM_UNOPTIMIZED_SCHEDULE,
  },
  'medium-farm': {
    volumes: {
      rainwater: 8.0,
      esa: 2.5,
      external: 55.0, // Heavily reliant on external supply
      blend: 12.0,    // Breaches min operating volume (16.0 m³) -> 4.0 m³ deficit!
    },
    flows: {
      rainwaterInflow: 1.0,
      esaInflow: 1.2,
      externalInflow: 6.5,
      irrigationDemand: calculateIrrigationDemand(MEDIUM_FARM_UNOPTIMIZED_SCHEDULE, 'auto'),
      humanUtilityDemand: 0.8,
      livestockDemand: 1.4,
    },
    cumulativeTruckCost: 840.00, // High external expenses
    irrigationMode: 'auto',
    scheduledIrrigationDemand: MEDIUM_FARM_UNOPTIMIZED_SCHEDULE,
  },
};

/**
 * Generates synthetic or extreme weather conditions corresponding to a demonstration scenario.
 *
 * @summary Generate scenario weather.
 * @description Returns custom WeatherData for simulated extreme scenarios:
 * - 'live': Returns null, signifying that live Open-Meteo or seasonal weather should be active.
 * - 'drought': 38.5 °C, 18% RH, 0 mm rain.
 * - 'storm': 17.5 °C, 95% RH, 8.5 mm instantaneous, 48 mm 24h forecast.
 * - 'salinity': Standard warm dry weather (24.0 °C, 60% RH, 0 mm rain).
 *
 * @param scenario - Identifier of the demonstration scenario.
 * @param _farm - Active Mediterranean farm profile.
 * @param baseDate - Target date for the weather timestamp (defaults to current time).
 * @returns WeatherData object for extreme scenarios, or null for 'live' mode.
 * @throws Never throws.
 */
export function getScenarioWeather(
  scenario: DemoScenarioId,
  _farm: FarmProfile,
  baseDate: Date = new Date()
): WeatherData | null {
  const timestamp = baseDate.toISOString();

  switch (scenario) {
    case 'drought':
      return {
        temperatureC: 38.5,
        relativeHumidityPct: 18,
        currentPrecipitationMm: 0,
        precipitationForecast24hMm: 0,
        isOfflineFallback: true,
        timestamp,
      };

    case 'storm':
      return {
        temperatureC: 17.5,
        relativeHumidityPct: 95,
        currentPrecipitationMm: 8.5,
        precipitationForecast24hMm: 48.0,
        isOfflineFallback: true,
        timestamp,
      };

    case 'salinity':
      return {
        temperatureC: 24.0,
        relativeHumidityPct: 60,
        currentPrecipitationMm: 0,
        precipitationForecast24hMm: 0,
        isOfflineFallback: true,
        timestamp,
      };

    case 'live':
    default:
      return null;
  }
}

/**
 * Computes water flow rates adjusted according to the active demonstration scenario.
 *
 * @summary Calculate scenario water flows.
 * @description Adjusts inflow rates and crop demands to reflect environmental stress or abundance:
 * - 'drought': Inflows drop, irrigation demand increases by 50% due to high evapotranspiration.
 * - 'storm': Rainwater catchment surges by 250%, irrigation demand decreases by 60% due to rain.
 * - 'salinity': External inflow dominates, sustainable inflows decrease.
 * - 'live': Reverts to baseline flows.
 *
 * @param scenario - Active demonstration scenario.
 * @param _farm - Mediterranean farm profile.
 * @param baseFlows - Baseline flow rates for the profile.
 * @returns Adjusted WaterFlowMetrics reflecting scenario conditions.
 * @throws Never throws.
 */
export function getScenarioFlows(
  scenario: DemoScenarioId,
  _farm: FarmProfile,
  baseFlows: WaterFlowMetrics
): WaterFlowMetrics {
  switch (scenario) {
    case 'drought':
      return {
        ...baseFlows,
        rainwaterInflow: 0.0,
        esaInflow: roundTo2Decimals(baseFlows.esaInflow * 0.35),
        irrigationDemand: roundTo2Decimals(baseFlows.irrigationDemand * 1.5),
      };

    case 'storm':
      return {
        ...baseFlows,
        rainwaterInflow: roundTo2Decimals(baseFlows.rainwaterInflow * 3.5),
        esaInflow: roundTo2Decimals(baseFlows.esaInflow * 1.25),
        irrigationDemand: roundTo2Decimals(baseFlows.irrigationDemand * 0.4),
      };

    case 'salinity':
      return {
        ...baseFlows,
        rainwaterInflow: 0.2,
        esaInflow: 0.2,
        externalInflow: roundTo2Decimals(Math.max(2.5, baseFlows.externalInflow * 2.0)),
      };

    case 'live':
    default:
      return { ...baseFlows };
  }
}

/**
 * Computes tank volume adjustments required by extreme demonstration scenarios.
 *
 * @summary Calculate scenario tank volumes.
 * @description For 'salinity', skews stored water heavily toward external supply (high EC and TDS)
 * so that the Blend tank triggers FAO crop compliance warnings. For other scenarios, preserves
 * current volumes.
 *
 * @param scenario - Active demonstration scenario.
 * @param farm - Mediterranean farm profile.
 * @param currentVolumes - Existing reservoir storage volumes in m³.
 * @returns Updated TankVolumeMetrics for the scenario.
 * @throws Never throws.
 */
export function getScenarioVolumes(
  scenario: DemoScenarioId,
  farm: FarmProfile,
  currentVolumes: TankVolumeMetrics
): TankVolumeMetrics {
  if (scenario === 'salinity') {
    // Fill external supply near capacity and deplete rainwater/ESA to provoke salinity
    return {
      rainwater: 1.0,
      esa: 0.5,
      external: roundTo2Decimals(farm.tankCapacities.external * 0.9),
      blend: roundTo2Decimals(farm.tankCapacities.blend * 0.7),
    };
  }

  return { ...currentVolumes };
}

/**
 * Retrieves the pre-calibrated unoptimized baseline telemetry snapshot for a farm profile.
 *
 * @summary Get unoptimized baseline telemetry.
 * @description Returns depleted volumes (Blend tank below minimum operating volume),
 * high external delivery expenses, and unoptimized demands.
 *
 * @param farm - Active Mediterranean farm profile.
 * @returns TelemetrySnapshot representing the unoptimized baseline state.
 * @throws Never throws.
 */
export function getUnoptimizedBaselineTelemetry(farm: FarmProfile): TelemetrySnapshot {
  return UNOPTIMIZED_BASELINES[farm.id] ?? UNOPTIMIZED_BASELINES['small-farm'];
}

/**
 * Retrieves pre-computed optimal system parameters adhering to ADR 0002.
 *
 * @summary Get pre-computed optimal parameters.
 * @description Returns calibrated storage buffers (80% in Rainwater and ESA tanks),
 * Blend tank maintained at target volume (zero deficit), eco-mode irrigation, and zero waste.
 *
 * @param farm - Active Mediterranean farm profile.
 * @returns TelemetrySnapshot representing the optimal design state.
 * @throws Never throws.
 */
export function getOptimizedTelemetry(farm: FarmProfile): TelemetrySnapshot {
  return OPTIMAL_FARM_PARAMETERS[farm.id] ?? OPTIMAL_FARM_PARAMETERS['small-farm'];
}

/**
 * Fraction of a source tank's capacity withheld from supervisory replenishment.
 *
 * @remarks Without a floor, replenishment empties the Rainwater and ESA tanks to hold the Blend
 * tank at its target volume, so a severe drought would show the Blend tank *rising* while the
 * sources it drains run dry. Holding back a slice of each source keeps depleted sources from
 * propping up the Blend tank, which is what makes the drought scenario read as a drought.
 */
export const SOURCE_TANK_PUMP_RESERVE_RATIO = 0.1;

/**
 * Volume a source tank can give up to replenishment without breaching its reserve floor.
 *
 * @summary Pumpable volume of a source tank.
 * @description Returns the stored volume above the tank's reserve floor, or 0 when the tank is
 * at or below it.
 *
 * @param volume - Current stored volume in m³.
 * @param capacity - Physical tank capacity in m³.
 * @returns Volume available for transfer in m³, never negative.
 * @throws Never throws.
 */
function pumpableVolume(volume: number, capacity: number): number {
  return Math.max(0, volume - capacity * SOURCE_TANK_PUMP_RESERVE_RATIO);
}

/**
 * Simulates temporal progression over an elapsed number of hours (6h or 24h).
 *
 * @summary Simulate time progression step.
 * @description Advances physical water volumes by integrating inflows and consumption over
 * elapsed hours (elapsedDayFraction = hours / 24). Inflows accumulate in source tanks
 * (Rainwater, ESA, External) up to physical capacities, while farm consumption drains the
 * Blend tank. Dynamically replenishes the Blend tank from sustainable sources proportional to
 * the elapsed time step (up to 50% of needed replenishment for 6h, 80% for 24h, and 100% in
 * a heavy catchment event), allowing presenters to demonstrate dynamic level fluctuations
 * without premature locking or unrealistic drainage to zero. Replenishment draws only on source
 * water above SOURCE_TANK_PUMP_RESERVE_RATIO of each source tank's capacity, so depleted sources
 * cannot hold the Blend tank up during a drought.
 *
 * @param hours - Elapsed virtual time in hours (typically 6 or 24).
 * @param currentVolumes - Current storage volumes in m³.
 * @param flows - Active flow rates in m³/day.
 * @param capacities - Reservoir physical capacities and target volume in m³.
 * @param isHeavyCatchmentEvent - Whether catchment inflow is heavy enough for the pumps to cover
 * the full replenishment need in one step. Callers that know the active scenario pass it
 * explicitly; the default suits ordinary operation.
 * @returns Updated TankVolumeMetrics after elapsed time progression.
 * @throws Never throws.
 */
export function simulateTimeStep(
  hours: number,
  currentVolumes: TankVolumeMetrics,
  flows: WaterFlowMetrics,
  capacities: TankCapacities,
  isHeavyCatchmentEvent: boolean = false
): TankVolumeMetrics {
  const elapsedDayFraction = Math.max(0, hours) / 24.0;

  // 1. Inflows accumulated over the elapsed duration in m³
  const rainInflow = flows.rainwaterInflow * elapsedDayFraction;
  const esaInflow = flows.esaInflow * elapsedDayFraction;
  const externalInflow = flows.externalInflow * elapsedDayFraction;

  // 2. Consumption drawn over the elapsed duration in m³
  const totalConsumption =
    (flows.irrigationDemand + flows.humanUtilityDemand + flows.livestockDemand) * elapsedDayFraction;

  // 3. New source tank volumes capped at physical capacities
  let newRain = Math.min(capacities.rainwater, currentVolumes.rainwater + rainInflow);
  let newEsa = Math.min(capacities.esa, currentVolumes.esa + esaInflow);
  const newExternal = Math.min(capacities.external, currentVolumes.external + externalInflow);

  // 4. Blend tank: subtract consumption drawn by farm operations (minimum 0 m³)
  const remainingBlend = Math.max(0, currentVolumes.blend - totalConsumption);

  // 5. Dynamic supervisory replenishment towards target volume
  // Inflow headroom needed in Blend tank up to target volume
  const targetCapped = Math.min(capacities.targetVolume, capacities.blend);
  const replenishmentNeeded = Math.max(0, targetCapped - remainingBlend);

  // In heavy storms, rapid catchment transfer covers up to 100% of replenishment needed;
  // in normal/drought operations, steady pump transfer covers a realistic fraction (50% per 6h,
  // 80% per 24h). The caller states whether the event is heavy rather than this function
  // inferring it from an inflow threshold, which only ever held for the larger farm profile.
  const transferFactor = isHeavyCatchmentEvent ? 1.0 : (hours >= 24 ? 0.8 : 0.5);
  const transferRequested = replenishmentNeeded * transferFactor;

  // Prioritize sustainable Rainwater first, down to its reserve floor
  const rainTransfer = Math.min(transferRequested, pumpableVolume(newRain, capacities.rainwater));
  newRain -= rainTransfer;

  // Supply remainder from ESA atmospheric water generator, down to its reserve floor
  const remainingNeeded = transferRequested - rainTransfer;
  const esaTransfer = Math.min(remainingNeeded, pumpableVolume(newEsa, capacities.esa));
  newEsa -= esaTransfer;

  const newBlend = Math.min(capacities.blend, remainingBlend + rainTransfer + esaTransfer);

  return {
    rainwater: roundTo2Decimals(newRain),
    esa: roundTo2Decimals(newEsa),
    external: roundTo2Decimals(newExternal),
    blend: roundTo2Decimals(newBlend),
  };
}

/**
 * Advances a virtual Date object by a given number of hours.
 *
 * @summary Advance virtual date.
 * @description Adds elapsed hours to the provided Date, returning a new Date instance.
 *
 * @param currentDate - Starting Date object.
 * @param hours - Number of hours to advance (e.g. 6 or 24).
 * @returns New Date advanced by the specified hours.
 * @throws Never throws.
 */
export function advanceSimulatedDate(currentDate: Date, hours: number): Date {
  return new Date(currentDate.getTime() + hours * 3600 * 1000);
}

/**
 * Modulates farm water flows based on the solar hour to reflect day/night cycles.
 *
 * @summary Calculate diurnal demand modulation.
 * @description Modulates irrigation demand according to solar irradiance and evapotranspiration:
 * - Daytime (08:00 - 19:00): active irrigation demand, peaking around 14:00 (up to 1.4x baseline).
 * - Nocturnal hours (20:00 - 07:00): nocturnal rest, irrigation demand drops to 0.1x baseline.
 * - Human utility and livestock demands maintain steady consumption with a slight daytime weighting.
 *
 * @param hour - Hour of the day in 24-hour format (0 - 23).
 * @param baseFlows - Baseline flow rates for the farm.
 * @returns WaterFlowMetrics with diurnally modulated demand rates.
 * @throws Never throws.
 */
export function calculateDiurnalDemand(
  hour: number,
  baseFlows: WaterFlowMetrics
): WaterFlowMetrics {
  // Normalize hour to 0-23 range
  const normalizedHour = ((hour % 24) + 24) % 24;

  let irrigationMultiplier: number;
  if (normalizedHour >= 8 && normalizedHour <= 19) {
    // Daytime: solar curve centered at 14:00
    const solarDistance = Math.abs(normalizedHour - 14);
    irrigationMultiplier = roundTo2Decimals(1.4 - solarDistance * 0.07);
  } else {
    // Nighttime: nocturnal rest
    irrigationMultiplier = 0.1;
  }

  // Domestic and livestock slight reduction at night (0.6x at night vs 1.1x day)
  const utilityMultiplier = normalizedHour >= 7 && normalizedHour <= 22 ? 1.1 : 0.6;
  const livestockMultiplier = normalizedHour >= 6 && normalizedHour <= 21 ? 1.1 : 0.7;

  return {
    ...baseFlows,
    irrigationDemand: roundTo2Decimals(baseFlows.irrigationDemand * irrigationMultiplier),
    humanUtilityDemand: roundTo2Decimals(baseFlows.humanUtilityDemand * utilityMultiplier),
    livestockDemand: roundTo2Decimals(baseFlows.livestockDemand * livestockMultiplier),
  };
}

/**
 * Result payload containing the coordinated outputs of an advanced simulation step.
 */
export interface SimulationStepResult {
  /** Updated virtual simulation Date */
  date: Date;
  /** Updated reservoir storage volumes in m³ */
  volumes: TankVolumeMetrics;
  /** Updated water flows in m³/day */
  flows: WaterFlowMetrics;
  /** Updated scenario or diurnal weather data, or null for live Open-Meteo baseline */
  weather: WeatherData | null;
}

/**
 * Advances the entire farm simulation state over a temporal step (6h or 24h).
 *
 * @summary Advance simulation state.
 * @description Coordinates date progression, diurnal weather calculation, diurnal flow
 * recalculation (including live ESA production and modulated irrigation demand), and reservoir
 * volume integration. Volume integration replenishes the Blend tank from the source tanks
 * towards its target volume, in full during the storm scenario and partially otherwise; see
 * {@link simulateTimeStep} for the reserve floor that bounds it.
 *
 * @param currentDate - Starting simulation Date.
 * @param hours - Elapsed virtual hours (6 or 24).
 * @param currentVolumes - Active reservoir volumes in m³.
 * @param currentFlows - Active flow rates in m³/day.
 * @param farm - Active Mediterranean farm profile.
 * @param scenario - Active demonstration scenario identifier.
 * @returns SimulationStepResult containing updated date, volumes, flows, and weather.
 * @throws Never throws.
 */
export function advanceSimulation(
  currentDate: Date,
  hours: number,
  currentVolumes: TankVolumeMetrics,
  currentFlows: WaterFlowMetrics,
  farm: FarmProfile,
  scenario: DemoScenarioId
): SimulationStepResult {
  const newDate = advanceSimulatedDate(currentDate, hours);
  const baseline = getFarmBaseline(farm.id);

  let effectiveWeather: WeatherData | null = null;
  let modulatedFlows: WaterFlowMetrics;

  if (scenario === 'live') {
    // Generate diurnal synthetic weather matching the new solar hour
    effectiveWeather = generateSyntheticWeather(newDate);
    const diurnalEsa = calculateESAWaterProduction(
      effectiveWeather,
      farm.esaNominalCapacityM3PerDay
    );

    // If advancing a full 24h day, total day demand averages to 1.0x baseline daily flow;
    // if advancing a 6h segment, modulate with the active solar hour's demand factor
    const diurnalDemands = hours >= 24
      ? { ...baseline.flows }
      : calculateDiurnalDemand(newDate.getHours(), baseline.flows);

    modulatedFlows = {
      ...diurnalDemands,
      esaInflow: roundTo2Decimals(diurnalEsa.dailyRateM3),
      rainwaterInflow: currentFlows.rainwaterInflow,
      externalInflow: currentFlows.externalInflow,
    };
  } else {
    // In simulated scenarios, get scenario-specific weather and flows
    effectiveWeather = getScenarioWeather(scenario, farm, newDate);
    const scenarioFlows = getScenarioFlows(scenario, farm, baseline.flows);
    // If advancing a full 24h day, preserve full scenario demand;
    // if advancing 6h, modulate irrigation demand with diurnal factor
    const diurnalDemands = hours >= 24
      ? scenarioFlows
      : calculateDiurnalDemand(newDate.getHours(), scenarioFlows);

    modulatedFlows = {
      ...scenarioFlows,
      irrigationDemand: diurnalDemands.irrigationDemand,
    };
  }

  // Integrate volumes over elapsed hours using active flows. The storm scenario is the heavy
  // catchment event, whatever the farm profile's absolute inflow figures happen to be.
  const newVolumes = simulateTimeStep(
    hours,
    currentVolumes,
    modulatedFlows,
    farm.tankCapacities,
    scenario === 'storm'
  );

  return {
    date: newDate,
    volumes: newVolumes,
    flows: modulatedFlows,
    weather: effectiveWeather,
  };
}

