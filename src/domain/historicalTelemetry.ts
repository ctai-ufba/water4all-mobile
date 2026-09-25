/**
 * Daily history for the demo farm. Seed values use the same climate, catchment and ESA
 * engines as live fallback weather; advancing time replaces the current day or appends a day.
 */
import { FarmProfile } from '../types/farm';
import { HistoricalTelemetryDay, TankVolumeMetrics, WaterFlowMetrics } from '../types/telemetry';
import { calculateCatchmentInflow } from './catchmentEngine';
import { calculateESAProductionFromSeries } from './esaPhysicsEngine';
import { generateSyntheticWeather } from './syntheticWeatherEngine';
import { calculateTotalConsumption, calculateTotalInflow } from './telemetryEngine';

const HISTORY_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;
const TANK_KEYS = ['rainwater', 'esa', 'external', 'blend'] as const;

/** Chart-ready daily value with a stable date key and compact English label. */
export interface HistoryTrendPoint {
  date: string;
  label: string;
  value: number;
}

function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function totalStored(volumes: TankVolumeMetrics): number {
  return TANK_KEYS.reduce((total, tank) => total + volumes[tank], 0);
}

/**
 * Sets the earlier day's total to the later day's storage minus its net balance. Differences
 * between tanks represent internal transfers; the final adjustment reconciles the overall mass.
 */
function previousVolumes(
  farm: FarmProfile,
  anchor: TankVolumeMetrics,
  date: Date,
  targetTotal: number
): TankVolumeMetrics {
  const dayNumber = Math.floor(date.getTime() / DAY_MS);
  const volumes = { ...anchor };
  TANK_KEYS.forEach((tank, index) => {
    const swing = 0.035 * Math.sin(dayNumber * 0.9 + index);
    volumes[tank] = round2(Math.min(
      farm.tankCapacities[tank],
      Math.max(0, anchor[tank] + farm.tankCapacities[tank] * swing)
    ));
  });

  let remainder = round2(targetTotal - totalStored(volumes));
  for (const tank of ['rainwater', 'blend', 'external', 'esa'] as const) {
    const adjustment = Math.max(-volumes[tank], Math.min(remainder, farm.tankCapacities[tank] - volumes[tank]));
    volumes[tank] = round2(volumes[tank] + adjustment);
    remainder = round2(remainder - adjustment);
  }
  return volumes;
}

/**
 * Seeds the seven completed UTC days before the supplied date. Yesterday's storage is anchored
 * to the farm's actual current state so the first simulated interval continues from it.
 * Prior storage is reconstructed backwards from current volumes so consecutive daily totals
 * reconcile with inflow minus consumption. Within that total, storage moves between tanks to
 * suggest ordinary pump transfers. Weather supplies daily rain and hourly ESA production.
 */
export function seedHistoricalTelemetry(
  farm: FarmProfile,
  asOf: Date,
  currentVolumes: TankVolumeMetrics,
  currentFlows: WaterFlowMetrics
): HistoricalTelemetryDay[] {
  const currentDay = new Date(`${dayKey(asOf)}T12:00:00Z`);
  const dates = Array.from({ length: HISTORY_DAYS }, (_, index) =>
    new Date(currentDay.getTime() - (HISTORY_DAYS - index) * DAY_MS)
  );
  const history: HistoricalTelemetryDay[] = new Array(HISTORY_DAYS);
  history[HISTORY_DAYS - 1] = makeObservation(dates[HISTORY_DAYS - 1], currentVolumes, currentFlows);

  for (let index = HISTORY_DAYS - 2; index >= 0; index -= 1) {
    const date = dates[index];

    const weather = generateSyntheticWeather(date, farm.id, 1);
    const rain = calculateCatchmentInflow(
      weather.precipitationForecast24hMm,
      farm.catchmentAreaM2
    ).forecastInflowM3;
    const esa = calculateESAProductionFromSeries(
      weather.hourly,
      farm.esaNominalCapacityM3PerDay
    ).dailyRateM3;
    const dayNumber = Math.floor(date.getTime() / DAY_MS);
    const demandFactor = 1 + 0.08 * Math.sin(dayNumber * 1.7 + (farm.id === 'small-farm' ? 0 : 2));
    const flows: WaterFlowMetrics = {
      ...currentFlows,
      rainwaterInflow: rain,
      esaInflow: esa,
      irrigationDemand: round2(currentFlows.irrigationDemand * demandFactor),
    };
    const next = history[index + 1];
    const tankVolumes = previousVolumes(
      farm, currentVolumes, date, round2(totalStored(next.tankVolumes) - next.netBalance)
    );
    history[index] = makeObservation(date, tankVolumes, flows);
  }

  return history;
}

/** Converts an active daily flow rate and storage snapshot into a trend observation. */
function makeObservation(
  date: Date,
  tankVolumes: TankVolumeMetrics,
  flows: WaterFlowMetrics
): HistoricalTelemetryDay {
  const inflow = round2(calculateTotalInflow(flows));
  const consumption = round2(calculateTotalConsumption(flows));
  return {
    date: dayKey(date),
    inflow,
    consumption,
    netBalance: round2(inflow - consumption),
    tankVolumes: { ...tankVolumes },
    esaYield: round2(flows.esaInflow),
    source: 'seed',
  };
}

/**
 * One simulated interval and the storage on either side of it. The interval's flow rates are
 * integrated by elapsed hours rather than copied as complete daily totals.
 */
export interface HistoricalTelemetryStep {
  startDate: Date;
  endDate: Date;
  startVolumes: TankVolumeMetrics;
  endVolumes: TankVolumeMetrics;
  flows: WaterFlowMetrics;
}

/** Adds a simulated interval to its UTC daily logs and keeps the latest seven days. */
export function recordHistoricalTelemetry(
  history: HistoricalTelemetryDay[],
  step: HistoricalTelemetryStep
): HistoricalTelemetryDay[] {
  const startMs = step.startDate.getTime();
  const endMs = step.endDate.getTime();
  if (endMs <= startMs) return history;

  let result = [...history];
  let cursor = startMs;
  while (cursor < endMs) {
    const nextMidnight = new Date(cursor);
    nextMidnight.setUTCHours(24, 0, 0, 0);
    const segmentEnd = Math.min(endMs, nextMidnight.getTime());
    const fractionOfDay = (segmentEnd - cursor) / DAY_MS;
    const date = dayKey(new Date(cursor));
    const saved = result.find((day) => day.date === date);
    const previous = saved?.source === 'simulated' ? saved : null;
    const progress = (segmentEnd - startMs) / (endMs - startMs);
    const tankVolumes = { ...step.endVolumes };
    TANK_KEYS.forEach((tank) => {
      tankVolumes[tank] = round2(
        step.startVolumes[tank] + (step.endVolumes[tank] - step.startVolumes[tank]) * progress
      );
    });
    const inflow = round2((previous?.inflow ?? 0) + calculateTotalInflow(step.flows) * fractionOfDay);
    const consumption = round2((previous?.consumption ?? 0) + calculateTotalConsumption(step.flows) * fractionOfDay);
    const observation: HistoricalTelemetryDay = {
      date,
      inflow,
      consumption,
      netBalance: round2(inflow - consumption),
      tankVolumes,
      esaYield: round2((previous?.esaYield ?? 0) + step.flows.esaInflow * fractionOfDay),
      source: 'simulated',
    };
    result = [...result.filter((day) => day.date !== date), observation]
      .sort((left, right) => left.date.localeCompare(right.date)).slice(-HISTORY_DAYS);
    cursor = segmentEnd;
  }
  return result;
}

/** Formats a selected metric as chart values without changing the recorded daily values. */
export function formatHistorySeries(
  history: HistoricalTelemetryDay[],
  selectValue: (day: HistoricalTelemetryDay) => number
): HistoryTrendPoint[] {
  return history.map((day) => ({
    date: day.date,
    label: new Date(`${day.date}T12:00:00Z`).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', timeZone: 'UTC',
    }),
    value: selectValue(day),
  }));
}
