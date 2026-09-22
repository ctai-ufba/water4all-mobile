/**
 * @file WeatherView.test.tsx
 * @summary Integration tests for the Weather screen.
 * @description Verifies that the instantaneous ESA rate and the integrated 24-hour yield are shown
 * as separate figures, that the ESA and catchment intermediates are surfaced, that the map doubles
 * as the farm selector, and that an unavailable radar is stated rather than left blank.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { WeatherView } from '../WeatherView';
import * as AuthContextModule from '../../../context/AuthContext';
import * as WeatherContextModule from '../../../context/WeatherContext';
import * as RadarServiceModule from '../../../services/radarService';
import { FARM_PROFILES } from '../../../types/farm';
import {
  WeatherData,
  ESAProductionResult,
  CatchmentEstimateResult,
} from '../../../types/weather';

describe('WeatherView Seam', () => {
  const smallFarm = FARM_PROFILES['small-farm'];
  const switchFarmMock = vi.fn();
  const refetchMock = vi.fn();

  const weather: WeatherData = {
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

  // Three results with deliberately different magnitudes, so a test cannot pass by showing the
  // same number twice under two labels.
  const instantaneous: ESAProductionResult = {
    hourlyRateLiters: 42.5,
    hourlyRateM3: 0.0425,
    dailyRateM3: 1.02,
    adsorptionPotentialJPerMol: 1180.5,
    equilibriumLoadingKgPerKg: 0.1852,
    ambientYieldRatio: 1.85,
    cyclesPerDay: 2.71,
    energyKwhPerDay: 1474.76,
    integratedDays: 7,
  };

  const forecast24h: ESAProductionResult = {
    hourlyRateLiters: 30.1,
    hourlyRateM3: 0.0301,
    dailyRateM3: 0.723,
    adsorptionPotentialJPerMol: 1180.5,
    equilibriumLoadingKgPerKg: 0.1852,
    ambientYieldRatio: 0.41,
    cyclesPerDay: 2.0,
    energyKwhPerDay: 1180.4,
    integratedDays: 1,
  };

  const horizonMean: ESAProductionResult = {
    ...forecast24h,
    dailyRateM3: 0.854,
    integratedDays: 7,
  };

  const catchmentEstimate: CatchmentEstimateResult = {
    catchmentAreaM2: 380,
    precipitationForecastMm: 8.0,
    runoffCoefficient: 0.9,
    firstFlushFactor: 0.95,
    effectiveRunoff: 0.855,
    forecastInflowM3: 2.6,
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    switchFarmMock.mockReset();
    refetchMock.mockReset();

    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      activeFarm: smallFarm,
      isAuthenticated: true,
      login: vi.fn(),
      logout: vi.fn(),
      switchFarm: switchFarmMock,
    });

    vi.spyOn(WeatherContextModule, 'useWeather').mockReturnValue({
      weather,
      loading: false,
      esaProduction: horizonMean,
      esaInstantaneous: instantaneous,
      esaForecast24h: forecast24h,
      catchmentEstimate,
      refetch: refetchMock,
      setCustomWeather: vi.fn(),
    });

    vi.spyOn(RadarServiceModule, 'fetchRadarFrames').mockResolvedValue({
      available: false,
      reason: 'request-failed',
    });
  });

  it('renders the ambient reading the physics is computed from', async () => {
    render(<WeatherView />);

    expect(screen.getByTestId('weather-view-temp')).toHaveTextContent('24.5');
    expect(screen.getByTestId('weather-view-humidity')).toHaveTextContent('62');
    expect(screen.getByTestId('weather-view-rain')).toHaveTextContent('8.0');
    expect(screen.getByTestId('weather-view-source-badge')).toHaveTextContent('Open-Meteo Live');

    await waitFor(() => expect(RadarServiceModule.fetchRadarFrames).toHaveBeenCalled());
  });

  it('shows the instantaneous rate and the 24-hour yield as two distinct figures', async () => {
    render(<WeatherView />);

    const rate = screen.getByTestId('esa-instantaneous-rate');
    const yield24h = screen.getByTestId('esa-forecast-24h-yield');

    // A rate in L/h and a yield in m³ over a stated window: different units, different questions.
    expect(rate).toHaveTextContent('42.5');
    expect(rate).toHaveTextContent('L/h');
    expect(yield24h).toHaveTextContent('0.723');
    expect(yield24h).toHaveTextContent('m³');
    expect(rate.textContent).not.toEqual(yield24h.textContent);

    expect(screen.getByText(/Instantaneous rate/i)).toBeInTheDocument();
    expect(screen.getByText(/Next 24 h yield/i)).toBeInTheDocument();

    await waitFor(() => expect(RadarServiceModule.fetchRadarFrames).toHaveBeenCalled());
  });

  it('attributes the horizon mean to its own window rather than to the day ahead', async () => {
    render(<WeatherView />);

    expect(screen.getByTestId('esa-horizon-mean')).toHaveTextContent('0.854 m³/day');
    expect(screen.getByTestId('esa-horizon-days')).toHaveTextContent('7');

    await waitFor(() => expect(RadarServiceModule.fetchRadarFrames).toHaveBeenCalled());
  });

  it('surfaces the ESA intermediates the engine already computes', async () => {
    render(<WeatherView />);

    expect(screen.getByTestId('esa-adsorption-potential')).toHaveTextContent('1180.5');
    expect(screen.getByTestId('esa-equilibrium-loading')).toHaveTextContent('0.1852');
    expect(screen.getByTestId('esa-ambient-yield-ratio')).toHaveTextContent('41');
    expect(screen.getByTestId('esa-cycles-per-day')).toHaveTextContent('2.00');
    expect(screen.getByTestId('esa-energy-per-day')).toHaveTextContent('1180.4');

    await waitFor(() => expect(RadarServiceModule.fetchRadarFrames).toHaveBeenCalled());
  });

  it('surfaces the catchment intermediates with the millimetre to cubic metre breakdown', async () => {
    render(<WeatherView />);

    expect(screen.getByTestId('catchment-runoff-coefficient')).toHaveTextContent('0.90');
    expect(screen.getByTestId('catchment-first-flush-factor')).toHaveTextContent('0.95');
    expect(screen.getByTestId('catchment-effective-runoff')).toHaveTextContent('0.855');
    expect(screen.getByTestId('catchment-inflow')).toHaveTextContent('2.60');
    expect(screen.getByTestId('catchment-breakdown')).toHaveTextContent(
      '8.0 mm × 380 m² × 0.855 ÷ 1000 = 2.60 m³'
    );

    await waitFor(() => expect(RadarServiceModule.fetchRadarFrames).toHaveBeenCalled());
  });

  it('maps the active farm alone and does not duplicate the header farm switcher', async () => {
    render(<WeatherView />);

    // The site of the farm whose physics this screen reports, and only that site.
    expect(screen.getByTestId('farm-site-map')).toBeInTheDocument();
    expect(screen.getByText(smallFarm.name)).toBeInTheDocument();
    expect(screen.queryByText(FARM_PROFILES['medium-farm'].name)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Medium Farm/i })).toBeNull();
    expect(switchFarmMock).not.toHaveBeenCalled();

    await waitFor(() => expect(RadarServiceModule.fetchRadarFrames).toHaveBeenCalled());
  });

  it('offers a way back to the farm after the operator has moved the map', async () => {
    render(<WeatherView />);

    expect(
      screen.getByRole('button', { name: new RegExp(`Recentre map on ${smallFarm.estateName}`, 'i') })
    ).toBeInTheDocument();

    await waitFor(() => expect(RadarServiceModule.fetchRadarFrames).toHaveBeenCalled());
  });

  it('states that radar is unavailable once the check comes back empty-handed', async () => {
    render(<WeatherView />);

    await waitFor(() => {
      expect(screen.getByTestId('radar-status')).toHaveTextContent(/Radar unavailable/i);
    });
    expect(screen.getByTestId('farm-site-map')).toBeInTheDocument();
  });

  it('shows the composite time when radar frames are published', async () => {
    vi.spyOn(RadarServiceModule, 'fetchRadarFrames').mockResolvedValue({
      available: true,
      host: 'https://tilecache.rainviewer.com',
      frames: [{ timeEpochSeconds: 1790104800, path: '/v2/radar/newest' }],
    });

    render(<WeatherView />);

    await waitFor(() => {
      expect(screen.getByTestId('radar-status')).toHaveTextContent(/Radar composite observed at/i);
    });
  });

  it('refetches weather on demand', async () => {
    render(<WeatherView />);

    fireEvent.click(screen.getByRole('button', { name: /refresh weather data/i }));

    expect(refetchMock).toHaveBeenCalledTimes(1);

    await waitFor(() => expect(RadarServiceModule.fetchRadarFrames).toHaveBeenCalled());
  });

  it('renders a placeholder until a farm session exists', async () => {
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      activeFarm: null,
      isAuthenticated: false,
      login: vi.fn(),
      logout: vi.fn(),
      switchFarm: switchFarmMock,
    });

    render(<WeatherView />);

    expect(screen.getByText(/Loading weather telemetry/i)).toBeInTheDocument();

    await waitFor(() => expect(RadarServiceModule.fetchRadarFrames).toHaveBeenCalled());
  });
});
