/**
 * @file WeatherCard.test.tsx
 * @summary Unit tests for the dashboard weather strip.
 * @description Verifies the three ambient metrics, the live and offline-fallback source badges,
 * navigation into the Weather view, and that the physics detail moved off the dashboard.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { WeatherCard } from '../WeatherCard';
import * as AuthContextModule from '../../../context/AuthContext';
import * as WeatherContextModule from '../../../context/WeatherContext';
import { FARM_PROFILES } from '../../../types/farm';
import {
  WeatherData,
  ESAProductionResult,
  CatchmentEstimateResult,
} from '../../../types/weather';

describe('WeatherCard Component Seam', () => {
  const smallFarm = FARM_PROFILES['small-farm'];

  const mockWeatherLive: WeatherData = {
    temperatureC: 24.5,
    relativeHumidityPct: 62,
    currentPrecipitationMm: 0,
    precipitationForecast24hMm: 8.0,
    isOfflineFallback: false,
    timestamp: '2026-09-20T14:00:00Z',
    hourly: {
      temperatureC: new Array(168).fill(24.5),
      relativeHumidityPct: new Array(168).fill(62),
      startTime: '2026-09-20T14:00:00Z',
    },
  };

  const mockEsaProduction: ESAProductionResult = {
    hourlyRateLiters: 42.5,
    hourlyRateM3: 0.043,
    dailyRateM3: 1.02,
    adsorptionPotentialJPerMol: 1180.5,
    equilibriumLoadingKgPerKg: 0.185,
    ambientYieldRatio: 0.85,
    cyclesPerDay: 2.71,
    energyKwhPerDay: 1474.76,
    integratedDays: 7,
  };

  const mockCatchmentEstimate: CatchmentEstimateResult = {
    catchmentAreaM2: 380,
    precipitationForecastMm: 8.0,
    runoffCoefficient: 0.9,
    firstFlushFactor: 0.95,
    effectiveRunoff: 0.855,
    forecastInflowM3: 2.6,
  };

  /** Installs a weather context returning the given reading. */
  function mockWeatherContext(weather: WeatherData | null): void {
    vi.spyOn(WeatherContextModule, 'useWeather').mockReturnValue({
      weather,
      loading: false,
      esaProduction: mockEsaProduction,
      esaInstantaneous: mockEsaProduction,
      esaForecast24h: { ...mockEsaProduction, dailyRateM3: 0.72, integratedDays: 1 },
      catchmentEstimate: mockCatchmentEstimate,
      refetch: vi.fn(),
      setCustomWeather: vi.fn(),
    });
  }

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      activeFarm: smallFarm,
      isAuthenticated: true,
      login: vi.fn(),
      logout: vi.fn(),
      switchFarm: vi.fn(),
    });
  });

  it('renders the three ambient metrics and the farm location', () => {
    mockWeatherContext(mockWeatherLive);

    render(<WeatherCard />);

    expect(screen.getByTestId('weather-temp-value')).toHaveTextContent('24.5');
    expect(screen.getByTestId('weather-humidity-value')).toHaveTextContent('62');
    expect(screen.getByTestId('weather-rain-value')).toHaveTextContent('8.0');
    expect(screen.getByText(new RegExp(smallFarm.location, 'i'))).toBeInTheDocument();
  });

  it('reports the data source as live when the reading came from Open-Meteo', () => {
    mockWeatherContext(mockWeatherLive);

    render(<WeatherCard />);

    expect(screen.getByTestId('weather-source-badge')).toHaveTextContent('Open-Meteo Live');
  });

  it('reports the data source as fallback when the reading is cached or synthetic', () => {
    mockWeatherContext({ ...mockWeatherLive, isOfflineFallback: true });

    render(<WeatherCard />);

    expect(screen.getByTestId('weather-source-badge')).toHaveTextContent('Offline Fallback');
  });

  it('opens the Weather view when pressed', () => {
    const openMock = vi.fn();
    mockWeatherContext(mockWeatherLive);

    render(<WeatherCard onOpenWeatherView={openMock} />);

    fireEvent.click(screen.getByRole('button', { name: /open weather view/i }));

    expect(openMock).toHaveBeenCalledTimes(1);
  });

  it('renders as static content when no navigation target is supplied', () => {
    mockWeatherContext(mockWeatherLive);

    render(<WeatherCard />);

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.getByTestId('weather-temp-value')).toBeInTheDocument();
  });

  it('carries no ESA or catchment detail; that reasoning belongs on the Weather view', () => {
    // Guards the split the strip exists for: an instantaneous rate and a daily yield shown side by
    // side in a glance card invited reading one as the other, and they are different figures.
    mockWeatherContext(mockWeatherLive);

    render(<WeatherCard />);

    expect(screen.queryByText(/ESA Water Generator/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Rainwater Catchment/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Ambient yield ratio/i)).not.toBeInTheDocument();
  });

  it('renders nothing without an active farm session', () => {
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      activeFarm: null,
      isAuthenticated: false,
      login: vi.fn(),
      logout: vi.fn(),
      switchFarm: vi.fn(),
    });
    mockWeatherContext(mockWeatherLive);

    const { container } = render(<WeatherCard />);

    expect(container).toBeEmptyDOMElement();
  });
});
