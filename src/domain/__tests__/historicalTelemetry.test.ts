import { describe, expect, it } from 'vitest';
import { FARM_PROFILES } from '../../types/farm';
import { getFarmBaseline } from '../../types/telemetry';
import {
  formatHistorySeries,
  recordHistoricalTelemetry,
  seedHistoricalTelemetry,
} from '../historicalTelemetry';

describe('historical telemetry', () => {
  const farm = FARM_PROFILES['small-farm'];
  const baseline = getFarmBaseline(farm.id);

  it('seeds seven completed chronological days ending at the current state', () => {
    const history = seedHistoricalTelemetry(farm, new Date('2026-03-08T12:00:00Z'), baseline.volumes, baseline.flows);

    expect(history.map((day) => day.date)).toEqual([
      '2026-03-01', '2026-03-02', '2026-03-03', '2026-03-04',
      '2026-03-05', '2026-03-06', '2026-03-07',
    ]);
    expect(history[6].tankVolumes).toEqual(baseline.volumes);
    expect(history[6].netBalance).toBeCloseTo(history[6].inflow - history[6].consumption, 2);
    expect(new Set(history.map((day) => day.esaYield)).size).toBeGreaterThan(1);
    for (const day of history) {
      expect(day.inflow).toBeGreaterThanOrEqual(0);
      expect(day.consumption).toBeGreaterThan(0);
      expect(day.esaYield).toBeGreaterThanOrEqual(0);
      for (const tank of ['rainwater', 'esa', 'external', 'blend'] as const) {
        expect(day.tankVolumes[tank]).toBeGreaterThanOrEqual(0);
        expect(day.tankVolumes[tank]).toBeLessThanOrEqual(farm.tankCapacities[tank]);
      }
    }
    for (let index = 1; index < history.length; index += 1) {
      const stored = (day: typeof history[number]) => Object.values(day.tankVolumes)
        .reduce((total, volume) => total + volume, 0);
      expect(stored(history[index]) - stored(history[index - 1])).toBeCloseTo(history[index].netBalance, 1);
    }
  });

  it('keeps the medium farm within its own storage capacities and seasonal ESA limits', () => {
    const medium = FARM_PROFILES['medium-farm'];
    const mediumBaseline = getFarmBaseline(medium.id);
    const history = seedHistoricalTelemetry(
      medium, new Date('2026-09-25T12:00:00Z'), mediumBaseline.volumes, mediumBaseline.flows
    );

    expect(history).toHaveLength(7);
    expect(history[6].tankVolumes).toEqual(mediumBaseline.volumes);
    for (const day of history) {
      expect(day.esaYield).toBeLessThanOrEqual(medium.esaNominalCapacityM3PerDay);
      expect(day.tankVolumes.esa).toBeLessThanOrEqual(medium.tankCapacities.esa);
    }
  });

  it('formats chart points in chronological order with readable day labels', () => {
    const history = seedHistoricalTelemetry(farm, new Date('2026-03-08T12:00:00Z'), baseline.volumes, baseline.flows);
    expect(formatHistorySeries(history, (day) => day.netBalance)[0]).toEqual({
      date: '2026-03-01', label: 'Mar 1', value: history[0].netBalance,
    });
    expect(formatHistorySeries(history, (day) => day.esaYield)[6]).toEqual({
      date: '2026-03-07', label: 'Mar 7', value: history[6].esaYield,
    });
  });

  it('accumulates six-hour amounts and splits a step at midnight', () => {
    const history = seedHistoricalTelemetry(farm, new Date('2026-03-08T12:00:00Z'), baseline.volumes, baseline.flows);
    const advancedVolumes = { ...baseline.volumes, blend: 24 };
    const advancedFlows = { ...baseline.flows, esaInflow: 0.12 };
    const sameDay = recordHistoricalTelemetry(history, {
      startDate: new Date('2026-03-08T12:00:00Z'),
      endDate: new Date('2026-03-08T18:00:00Z'),
      startVolumes: baseline.volumes,
      endVolumes: advancedVolumes,
      flows: advancedFlows,
    });
    expect(sameDay).toHaveLength(7);
    expect(sameDay[6].tankVolumes.blend).toBe(24);
    expect(sameDay[6].source).toBe('simulated');
    expect(sameDay[6].esaYield).toBe(0.03);

    const nextDay = recordHistoricalTelemetry(sameDay, {
      startDate: new Date('2026-03-08T18:00:00Z'),
      endDate: new Date('2026-03-09T00:00:00Z'),
      startVolumes: advancedVolumes,
      endVolumes: advancedVolumes,
      flows: advancedFlows,
    });
    expect(nextDay).toHaveLength(7);
    expect(nextDay[6].date).toBe('2026-03-08');
    expect(nextDay[6].esaYield).toBe(0.06);

    const crossing = recordHistoricalTelemetry(nextDay, {
      startDate: new Date('2026-03-09T00:00:00Z'),
      endDate: new Date('2026-03-09T06:00:00Z'),
      startVolumes: advancedVolumes,
      endVolumes: advancedVolumes,
      flows: advancedFlows,
    });
    expect(crossing[0].date).toBe('2026-03-03');
    expect(crossing[6].date).toBe('2026-03-09');
    expect(crossing[6].esaYield).toBe(0.03);
  });

  it('assigns one six-hour interval to both calendar days when it crosses midnight', () => {
    const history = seedHistoricalTelemetry(farm, new Date('2026-03-08T18:00:00Z'), baseline.volumes, baseline.flows);
    const flows = { ...baseline.flows, esaInflow: 0.24 };
    const result = recordHistoricalTelemetry(history, {
      startDate: new Date('2026-03-08T21:00:00Z'),
      endDate: new Date('2026-03-09T03:00:00Z'),
      startVolumes: baseline.volumes,
      endVolumes: { ...baseline.volumes, blend: baseline.volumes.blend - 1 },
      flows,
    });

    expect(result.at(-2)?.date).toBe('2026-03-08');
    expect(result.at(-1)?.date).toBe('2026-03-09');
    expect(result.at(-2)?.esaYield).toBe(0.03);
    expect(result.at(-1)?.esaYield).toBe(0.03);
    expect(result.at(-2)?.tankVolumes.blend).toBe(26);
    expect(result.at(-1)?.tankVolumes.blend).toBe(25.5);
  });
});
