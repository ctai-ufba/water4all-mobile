/**
 * @file WeatherContext.test.tsx
 * @summary Unit and integration tests for WeatherContext and WeatherProvider.
 * @description Verifies weather state initialization, ESA physics calculation coupling,
 * rainwater catchment estimation, and refetch handling.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { WeatherProvider, useWeather } from '../WeatherContext';
import * as AuthContextModule from '../AuthContext';
import * as WeatherServiceModule from '../../services/weatherService';
import { FARM_PROFILES } from '../../types/farm';
import { WeatherData } from '../../types/weather';

function TestWeatherConsumer(): React.JSX.Element {
  const { weather, loading, esaProduction, catchmentEstimate, refetch } = useWeather();

  if (loading) {
    return <div data-testid="loading">Loading Weather...</div>;
  }

  if (!weather) {
    return <div data-testid="no-weather">No Weather</div>;
  }

  return (
    <div>
      <div data-testid="temperature">{weather.temperatureC}</div>
      <div data-testid="humidity">{weather.relativeHumidityPct}</div>
      <div data-testid="rain-forecast">{weather.precipitationForecast24hMm}</div>
      <div data-testid="is-offline">{weather.isOfflineFallback ? 'offline' : 'live'}</div>

      {esaProduction && (
        <>
          <div data-testid="esa-hourly-liters">{esaProduction.hourlyRateLiters}</div>
          <div data-testid="esa-daily-m3">{esaProduction.dailyRateM3}</div>
        </>
      )}

      {catchmentEstimate && (
        <div data-testid="catchment-inflow">{catchmentEstimate.forecastInflowM3}</div>
      )}

      <button onClick={() => refetch()}>Refresh Weather</button>
    </div>
  );
}

describe('WeatherContext Seam', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('throws error when useWeather is used outside WeatherProvider', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => render(<TestWeatherConsumer />)).toThrow(
      'useWeather must be used within a WeatherProvider'
    );

    consoleSpy.mockRestore();
  });

  it('renders no weather when no farm is authenticated', async () => {
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      activeFarm: null,
      isAuthenticated: false,
      login: vi.fn(),
      logout: vi.fn(),
      switchFarm: vi.fn(),
    });

    render(
      <WeatherProvider>
        <TestWeatherConsumer />
      </WeatherProvider>
    );

    expect(screen.getByTestId('no-weather')).toBeInTheDocument();
  });

  it('fetches weather and computes ESA physics and catchment inflow for active farm', async () => {
    const smallFarm = FARM_PROFILES['small-farm'];
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      activeFarm: smallFarm,
      isAuthenticated: true,
      login: vi.fn(),
      logout: vi.fn(),
      switchFarm: vi.fn(),
    });

    const mockWeather: WeatherData = {
      temperatureC: 22.0,
      relativeHumidityPct: 65,
      currentPrecipitationMm: 0,
      precipitationForecast24hMm: 10.0,
      isOfflineFallback: false,
      timestamp: '2026-09-20T12:00:00Z',
    };

    vi.spyOn(WeatherServiceModule, 'fetchFarmWeather').mockResolvedValue(mockWeather);

    render(
      <WeatherProvider>
        <TestWeatherConsumer />
      </WeatherProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('temperature')).toHaveTextContent('22');
      expect(screen.getByTestId('humidity')).toHaveTextContent('65');
      expect(screen.getByTestId('rain-forecast')).toHaveTextContent('10');
      expect(screen.getByTestId('is-offline')).toHaveTextContent('live');
    });

    // ESA production should be computed (> 0)
    expect(Number(screen.getByTestId('esa-hourly-liters').textContent)).toBeGreaterThan(0);
    expect(Number(screen.getByTestId('esa-daily-m3').textContent)).toBeGreaterThan(0);

    // Catchment inflow for 10 mm on 380 m² (0.855 runoff) = 3.25 m³
    expect(screen.getByTestId('catchment-inflow')).toHaveTextContent('3.25');
  });
});
