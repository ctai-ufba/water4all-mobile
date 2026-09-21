/**
 * @file WeatherCard.test.tsx
 * @summary Unit and integration tests for the WeatherCard component.
 * @description Verifies rendering of ambient weather metrics, live ESA physics output,
 * rainwater catchment estimates, live vs. offline badge indicators, and refresh interactions.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { WeatherCard } from '../WeatherCard';
import * as AuthContextModule from '../../../context/AuthContext';
import * as WeatherContextModule from '../../../context/WeatherContext';
import { FARM_PROFILES } from '../../../types/farm';
import { WeatherData, ESAProductionResult, CatchmentEstimateResult } from '../../../types/weather';

describe('WeatherCard Component Seam', () => {
  const smallFarm = FARM_PROFILES['small-farm'];

  const mockWeatherLive: WeatherData = {
    temperatureC: 24.5,
    relativeHumidityPct: 62,
    currentPrecipitationMm: 0,
    precipitationForecast24hMm: 8.0,
    isOfflineFallback: false,
    timestamp: '2026-09-20T14:00:00Z',
  };

  const mockEsaProduction: ESAProductionResult = {
    hourlyRateLiters: 42.5,
    hourlyRateM3: 0.043,
    dailyRateM3: 1.02,
    adsorptionPotentialJPerMol: 1180.5,
    equilibriumLoadingKgPerKg: 0.185,
    efficiencyFactor: 0.85,
  };

  const mockCatchmentEstimate: CatchmentEstimateResult = {
    catchmentAreaM2: 380,
    precipitationForecastMm: 8.0,
    runoffCoefficient: 0.9,
    firstFlushFactor: 0.95,
    effectiveRunoff: 0.855,
    forecastInflowM3: 2.60,
  };

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

  it('renders ambient weather metrics (temperature, humidity, rain forecast)', () => {
    vi.spyOn(WeatherContextModule, 'useWeather').mockReturnValue({
      weather: mockWeatherLive,
      loading: false,
      esaProduction: mockEsaProduction,
      catchmentEstimate: mockCatchmentEstimate,
      refetch: vi.fn(),
      setCustomWeather: vi.fn(),
    });

    render(<WeatherCard />);

    expect(screen.getByTestId('weather-temp-value')).toHaveTextContent('24.5');
    expect(screen.getByTestId('weather-humidity-value')).toHaveTextContent('62');
    expect(screen.getByTestId('weather-rain-value')).toHaveTextContent('8.0');
    expect(screen.getByTestId('weather-source-badge')).toHaveTextContent('Open-Meteo Live');
    expect(screen.getByText(new RegExp(smallFarm.location, 'i'))).toBeInTheDocument();
  });

  it('renders ESA atmospheric water generator metrics', () => {
    vi.spyOn(WeatherContextModule, 'useWeather').mockReturnValue({
      weather: mockWeatherLive,
      loading: false,
      esaProduction: mockEsaProduction,
      catchmentEstimate: mockCatchmentEstimate,
      refetch: vi.fn(),
      setCustomWeather: vi.fn(),
    });

    render(<WeatherCard />);

    expect(screen.getByTestId('esa-live-rate')).toHaveTextContent('42.5 L/h');
    expect(screen.getByTestId('esa-daily-yield')).toHaveTextContent('1.02 m³/day');
  });

  it('renders rainwater catchment inflow forecast', () => {
    vi.spyOn(WeatherContextModule, 'useWeather').mockReturnValue({
      weather: mockWeatherLive,
      loading: false,
      esaProduction: mockEsaProduction,
      catchmentEstimate: mockCatchmentEstimate,
      refetch: vi.fn(),
      setCustomWeather: vi.fn(),
    });

    render(<WeatherCard />);

    expect(screen.getByText('Rainwater Catchment')).toBeInTheDocument();
    expect(screen.getByTestId('catchment-inflow-value')).toHaveTextContent('2.60 m³');
    expect(screen.getByText('380 m² area')).toBeInTheDocument();
  });

  it('displays offline fallback badge when weather originated from synthetic model', () => {
    const mockWeatherOffline: WeatherData = {
      ...mockWeatherLive,
      isOfflineFallback: true,
    };

    vi.spyOn(WeatherContextModule, 'useWeather').mockReturnValue({
      weather: mockWeatherOffline,
      loading: false,
      esaProduction: mockEsaProduction,
      catchmentEstimate: mockCatchmentEstimate,
      refetch: vi.fn(),
      setCustomWeather: vi.fn(),
    });

    render(<WeatherCard />);

    expect(screen.getByTestId('weather-source-badge')).toHaveTextContent('Offline Fallback');
  });

  it('triggers refetch when clicking the refresh button', () => {
    const refetchMock = vi.fn();
    vi.spyOn(WeatherContextModule, 'useWeather').mockReturnValue({
      weather: mockWeatherLive,
      loading: false,
      esaProduction: mockEsaProduction,
      catchmentEstimate: mockCatchmentEstimate,
      refetch: refetchMock,
      setCustomWeather: vi.fn(),
    });

    render(<WeatherCard />);

    const refreshButton = screen.getByRole('button', { name: /refresh weather data/i });
    fireEvent.click(refreshButton);

    expect(refetchMock).toHaveBeenCalledTimes(1);
  });
});
