/**
 * @file catchmentEngine.test.ts
 * @summary Unit tests for rainwater catchment inflow estimation engine.
 * @description Verifies harvest volume calculations across precipitation depths,
 * catchment areas for Small and Medium farm profiles, and boundary conditions.
 */

import { describe, it, expect } from 'vitest';
import { calculateCatchmentInflow } from '../catchmentEngine';

describe('Catchment Domain Engine Seam', () => {
  it('returns 0 m³ inflow when precipitation is zero', () => {
    const result = calculateCatchmentInflow(0, 380);
    expect(result.forecastInflowM3).toBe(0);
    expect(result.precipitationForecastMm).toBe(0);
  });

  it('calculates rainwater harvest for Small Farm (380 m²) with 10 mm rainfall', () => {
    // V = (10 * 380 * 0.855) / 1000 = 3.249 -> 3.25 m³
    const result = calculateCatchmentInflow(10, 380);
    expect(result.effectiveRunoff).toBeCloseTo(0.855, 3);
    expect(result.forecastInflowM3).toBeCloseTo(3.25, 2);
  });

  it('calculates rainwater harvest for Medium Farm (950 m²) with 25 mm storm event', () => {
    // V = (25 * 950 * 0.855) / 1000 = 20.30625 -> 20.31 m³
    const result = calculateCatchmentInflow(25, 950);
    expect(result.forecastInflowM3).toBeCloseTo(20.31, 2);
  });

  it('allows custom runoff and first-flush factors', () => {
    // V = (10 * 500 * 0.80 * 1.0) / 1000 = 4.0 m³
    const result = calculateCatchmentInflow(10, 500, 0.80, 1.0);
    expect(result.effectiveRunoff).toBe(0.8);
    expect(result.forecastInflowM3).toBe(4.0);
  });

  it('bounds negative inputs to zero without throwing', () => {
    const result = calculateCatchmentInflow(-5, -300);
    expect(result.forecastInflowM3).toBe(0);
    expect(result.precipitationForecastMm).toBe(0);
    expect(result.catchmentAreaM2).toBe(0);
  });
});
