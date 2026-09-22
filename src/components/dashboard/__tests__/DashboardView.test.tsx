/**
 * @file DashboardView.test.tsx
 * @summary Unit and integration tests for DashboardView and telemetry cards.
 * @description Verifies rendering of water autonomy in days, Blend tank visual gauge
 * with target and minimum operating volume thresholds, warning alerts when breached,
 * daily water balance card (inflow vs. consumption, surplus/deficit), and water efficiency card.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DashboardView } from '../DashboardView';
import * as AuthContextModule from '../../../context/AuthContext';
import * as TelemetryContextModule from '../../../context/TelemetryContext';
import * as WeatherContextModule from '../../../context/WeatherContext';
import { FARM_PROFILES } from '../../../types/farm';
import { TelemetryState } from '../../../types/telemetry';

describe('DashboardView Seam', () => {
  const mockFarm = FARM_PROFILES['small-farm'];

  const normalTelemetry: TelemetryState = {
    tankVolumes: {
      rainwater: 28.5,
      esa: 8.2,
      external: 14.0,
      blend: 26.5,
    },
    flows: {
      rainwaterInflow: 2.4,
      esaInflow: 1.2,
      externalInflow: 0.0,
      irrigationDemand: 2.1,
      humanUtilityDemand: 0.5,
      livestockDemand: 0.0,
    },
    totalStoredVolume: 77.2,
    totalInflow: 3.6,
    totalConsumption: 2.6,
    waterAutonomyDays: 29.7,
    netBalance: 1.0,
    isSurplus: true,
    localWaterPercentage: 100,
    dailySavingsEur: 11.7,
    isBelowMinOperatingVolume: false,
    blendDeficitM3: 0,
    irrigationMode: 'auto',
    cumulativeTruckDeliveryCostEur: 0,
  };

  const breachedTelemetry: TelemetryState = {
    ...normalTelemetry,
    tankVolumes: {
      ...normalTelemetry.tankVolumes,
      blend: 4.5, // Below min operating volume (7.0 m³)
    },
    isBelowMinOperatingVolume: true,
    blendDeficitM3: 2.5,
  };

  const deficitTelemetry: TelemetryState = {
    ...normalTelemetry,
    flows: {
      ...normalTelemetry.flows,
      irrigationDemand: 6.0,
    },
    totalConsumption: 6.5,
    netBalance: -2.9,
    isSurplus: false,
    localWaterPercentage: 55,
    dailySavingsEur: 16.2,
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(WeatherContextModule, 'useWeather').mockReturnValue({
      weather: {
        temperatureC: 22.0,
        relativeHumidityPct: 60,
        currentPrecipitationMm: 0,
        precipitationForecast24hMm: 2.0,
        isOfflineFallback: false,
        timestamp: '2026-09-20T12:00:00Z',
      },
      loading: false,
      esaProduction: {
        hourlyRateLiters: 40.0,
        hourlyRateM3: 0.04,
        dailyRateM3: 0.96,
        adsorptionPotentialJPerMol: 1200,
        equilibriumLoadingKgPerKg: 0.15,
        efficiencyFactor: 0.8,
      },
      catchmentEstimate: {
        catchmentAreaM2: 380,
        precipitationForecastMm: 2.0,
        runoffCoefficient: 0.9,
        firstFlushFactor: 0.95,
        effectiveRunoff: 0.855,
        forecastInflowM3: 0.65,
      },
      refetch: vi.fn(),
      setCustomWeather: vi.fn(),
    });
  });

  it('renders Live Weather & Physics card with ambient metrics', () => {
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      activeFarm: mockFarm,
      isAuthenticated: true,
      login: vi.fn(),
      logout: vi.fn(),
      switchFarm: vi.fn(),
    });

    vi.spyOn(TelemetryContextModule, 'useTelemetry').mockReturnValue({
      telemetry: normalTelemetry,
      setTankVolumes: vi.fn(),
      setFlows: vi.fn(),
      setIrrigationMode: vi.fn(),
      requestWaterTruck: vi.fn(),
      executePumpTransfer: vi.fn(),
      resetToBaseline: vi.fn(),
      applySnapshot: vi.fn(),
      scheduledIrrigationDemand: 2.1,
    });

    render(<DashboardView />);

    expect(screen.getByText(/Live Weather/i)).toBeInTheDocument();
    expect(screen.getByText('Ambient Conditions & Generation')).toBeInTheDocument();
    expect(screen.getByText('Open-Meteo Live')).toBeInTheDocument();
  });

  it('renders "Water Autonomy in Days" prominently', () => {
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      activeFarm: mockFarm,
      isAuthenticated: true,
      login: vi.fn(),
      logout: vi.fn(),
      switchFarm: vi.fn(),
    });

    vi.spyOn(TelemetryContextModule, 'useTelemetry').mockReturnValue({
      telemetry: normalTelemetry,
      setTankVolumes: vi.fn(),
      setFlows: vi.fn(),
      setIrrigationMode: vi.fn(),
      requestWaterTruck: vi.fn(),
      executePumpTransfer: vi.fn(),
      resetToBaseline: vi.fn(),
      applySnapshot: vi.fn(),
      scheduledIrrigationDemand: 2.1,
    });

    render(<DashboardView />);

    expect(screen.getByText('Water Autonomy in Days')).toBeInTheDocument();
    expect(screen.getByText('29.7')).toBeInTheDocument();
    expect(screen.getAllByText(/Days/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/77.2 m³/i)).toBeInTheDocument();
  });

  it('renders Blend tank visual gauge with current, target, and minimum operating volumes', () => {
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      activeFarm: mockFarm,
      isAuthenticated: true,
      login: vi.fn(),
      logout: vi.fn(),
      switchFarm: vi.fn(),
    });

    vi.spyOn(TelemetryContextModule, 'useTelemetry').mockReturnValue({
      telemetry: normalTelemetry,
      setTankVolumes: vi.fn(),
      setFlows: vi.fn(),
      setIrrigationMode: vi.fn(),
      requestWaterTruck: vi.fn(),
      executePumpTransfer: vi.fn(),
      resetToBaseline: vi.fn(),
      applySnapshot: vi.fn(),
      scheduledIrrigationDemand: 2.1,
    });

    render(<DashboardView />);

    // Blend tank title and badge subtitle
    expect(screen.getByText(/Blend Tank Gauge/i)).toBeInTheDocument();
    expect(screen.getByText('Blend Tank')).toBeInTheDocument();

    // Current volume
    expect(screen.getByText(/26.5 m³/i)).toBeInTheDocument();

    // Target volume indicator (28.0 m³)
    expect(screen.getByText(/Target: 28(\.0)? m³/i)).toBeInTheDocument();

    // Minimum operating volume indicator (7.0 m³)
    expect(screen.getByText(/Min Operating: 7(\.0)? m³/i)).toBeInTheDocument();

    // No warning banner when normal
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('displays warning alert when Blend tank drops below minimum operating volume', () => {
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      activeFarm: mockFarm,
      isAuthenticated: true,
      login: vi.fn(),
      logout: vi.fn(),
      switchFarm: vi.fn(),
    });

    vi.spyOn(TelemetryContextModule, 'useTelemetry').mockReturnValue({
      telemetry: breachedTelemetry,
      setTankVolumes: vi.fn(),
      setFlows: vi.fn(),
      setIrrigationMode: vi.fn(),
      requestWaterTruck: vi.fn(),
      executePumpTransfer: vi.fn(),
      resetToBaseline: vi.fn(),
      applySnapshot: vi.fn(),
      scheduledIrrigationDemand: 2.1,
    });

    render(<DashboardView />);

    // Warning alert must be rendered
    const alert = screen.getByRole('alert');
    expect(alert).toBeInTheDocument();
    expect(alert).toHaveTextContent(/below minimum operating volume/i);
    expect(alert).toHaveTextContent(/4.5 m³/i);
  });

  it('renders Daily Water Balance card with inflow, consumption, and surplus indicator', () => {
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      activeFarm: mockFarm,
      isAuthenticated: true,
      login: vi.fn(),
      logout: vi.fn(),
      switchFarm: vi.fn(),
    });

    vi.spyOn(TelemetryContextModule, 'useTelemetry').mockReturnValue({
      telemetry: normalTelemetry,
      setTankVolumes: vi.fn(),
      setFlows: vi.fn(),
      setIrrigationMode: vi.fn(),
      requestWaterTruck: vi.fn(),
      executePumpTransfer: vi.fn(),
      resetToBaseline: vi.fn(),
      applySnapshot: vi.fn(),
      scheduledIrrigationDemand: 2.1,
    });

    render(<DashboardView />);

    expect(screen.getByText(/Daily Water Balance/i)).toBeInTheDocument();
    expect(screen.getByText(/3.6 m³\/day/i)).toBeInTheDocument();
    expect(screen.getAllByText(/2.6 m³\/day/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/Surplus/i)).toBeInTheDocument();
  });

  it('renders Daily Water Balance card with deficit indicator when consumption exceeds inflow', () => {
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      activeFarm: mockFarm,
      isAuthenticated: true,
      login: vi.fn(),
      logout: vi.fn(),
      switchFarm: vi.fn(),
    });

    vi.spyOn(TelemetryContextModule, 'useTelemetry').mockReturnValue({
      telemetry: deficitTelemetry,
      setTankVolumes: vi.fn(),
      setFlows: vi.fn(),
      setIrrigationMode: vi.fn(),
      requestWaterTruck: vi.fn(),
      executePumpTransfer: vi.fn(),
      resetToBaseline: vi.fn(),
      applySnapshot: vi.fn(),
      scheduledIrrigationDemand: 2.1,
    });

    render(<DashboardView />);

    expect(screen.getByText(/Deficit/i)).toBeInTheDocument();
  });

  it('renders Water Efficiency & Savings card with local percentage and estimated daily euros saved', () => {
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      activeFarm: mockFarm,
      isAuthenticated: true,
      login: vi.fn(),
      logout: vi.fn(),
      switchFarm: vi.fn(),
    });

    vi.spyOn(TelemetryContextModule, 'useTelemetry').mockReturnValue({
      telemetry: normalTelemetry,
      setTankVolumes: vi.fn(),
      setFlows: vi.fn(),
      setIrrigationMode: vi.fn(),
      requestWaterTruck: vi.fn(),
      executePumpTransfer: vi.fn(),
      resetToBaseline: vi.fn(),
      applySnapshot: vi.fn(),
      scheduledIrrigationDemand: 2.1,
    });

    render(<DashboardView />);

    expect(screen.getByText(/Water Efficiency & Savings/i)).toBeInTheDocument();
    expect(screen.getAllByText(/100%/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/€11.70/i)).toBeInTheDocument();
  });
});
