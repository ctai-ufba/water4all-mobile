/**
 * @file WeatherCard.tsx
 * @summary Weather monitoring, ESA atmospheric physics, and rainwater catchment card.
 * @description Displays ambient temperature, relative humidity, and 24h precipitation forecast
 * from Open-Meteo (or synthetic fallback), live ESA atmospheric water generation rates,
 * and expected rainwater catchment volume for the active Mediterranean farm profile.
 */

import React from 'react';
import {
  Thermometer,
  Droplets,
  CloudRain,
  Wind,
  RefreshCw,
  SunMedium,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import { useWeather } from '../../context/WeatherContext';
import { useAuth } from '../../context/AuthContext';

/**
 * Live Weather and Physics Card component.
 *
 * @summary Live weather and ESA physics dashboard card.
 * @description Integrates real-time ambient observations with physics-based ESA water
 * production rates and rainwater catchment potential.
 *
 * @returns React.JSX.Element representing the weather and atmospheric physics card.
 * @throws Never throws.
 */
export function WeatherCard(): React.JSX.Element {
  const { activeFarm } = useAuth();
  const { weather, loading, esaProduction, catchmentEstimate, refetch } = useWeather();

  if (!activeFarm) {
    return <></>;
  }

  return (
    <div className="rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800/90 p-5 shadow-xl">
      {/* Header: Title, Coordinates, Source Indicator, and Refresh Button */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2.5">
          <div className="rounded-lg bg-sky-500/10 p-2 text-sky-400 ring-1 ring-sky-500/20">
            <SunMedium className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-sky-400">
              Live Weather &bull; {activeFarm.location}
            </span>
            <h3 className="text-sm font-bold text-white">Ambient Conditions & Generation</h3>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {/* Live vs. Offline Fallback Status Badge */}
          {weather?.isOfflineFallback ? (
            <span
              data-testid="weather-source-badge"
              className="inline-flex items-center space-x-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-semibold text-amber-400 ring-1 ring-amber-500/30"
              title="Using synthetic seasonal Mediterranean weather model"
            >
              <AlertTriangle className="h-3 w-3" />
              <span>Offline Fallback</span>
            </span>
          ) : (
            <span
              data-testid="weather-source-badge"
              className="inline-flex items-center space-x-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-semibold text-emerald-400 ring-1 ring-emerald-500/30"
              title="Live data from Open-Meteo API"
            >
              <CheckCircle2 className="h-3 w-3" />
              <span>Open-Meteo Live</span>
            </span>
          )}

          {/* Manual Refresh Button */}
          <button
            type="button"
            onClick={() => refetch()}
            disabled={loading}
            aria-label="Refresh weather data"
            className="rounded-lg bg-slate-800 p-1.5 text-slate-400 transition hover:bg-slate-700 hover:text-white disabled:opacity-50"
          >
            <RefreshCw
              className={`h-4 w-4 ${loading ? 'animate-spin text-cyan-400' : ''}`}
              aria-hidden="true"
            />
          </button>
        </div>
      </div>

      {/* Primary Weather Metrics Grid: Temperature, Relative Humidity, 24h Rain Forecast */}
      <div className="mt-4 grid grid-cols-3 gap-2 text-center">
        {/* Ambient Temperature */}
        <div className="rounded-xl bg-slate-950/40 p-3 ring-1 ring-slate-800/60">
          <div className="flex items-center justify-center space-x-1 text-slate-400 mb-1">
            <Thermometer className="h-3.5 w-3.5 text-amber-400" aria-hidden="true" />
            <span className="text-[11px] font-medium uppercase">Temp</span>
          </div>
          <span
            data-testid="weather-temp-value"
            className="text-xl font-bold tracking-tight text-white"
          >
            {weather ? `${weather.temperatureC.toFixed(1)}` : '--'}
          </span>
          <span className="ml-0.5 text-xs text-slate-400">°C</span>
        </div>

        {/* Relative Humidity */}
        <div className="rounded-xl bg-slate-950/40 p-3 ring-1 ring-slate-800/60">
          <div className="flex items-center justify-center space-x-1 text-slate-400 mb-1">
            <Droplets className="h-3.5 w-3.5 text-cyan-400" aria-hidden="true" />
            <span className="text-[11px] font-medium uppercase">Humidity</span>
          </div>
          <span
            data-testid="weather-humidity-value"
            className="text-xl font-bold tracking-tight text-white"
          >
            {weather ? `${weather.relativeHumidityPct}` : '--'}
          </span>
          <span className="ml-0.5 text-xs text-slate-400">%</span>
        </div>

        {/* 24-Hour Rain Forecast */}
        <div className="rounded-xl bg-slate-950/40 p-3 ring-1 ring-slate-800/60">
          <div className="flex items-center justify-center space-x-1 text-slate-400 mb-1">
            <CloudRain className="h-3.5 w-3.5 text-sky-400" aria-hidden="true" />
            <span className="text-[11px] font-medium uppercase">24h Rain</span>
          </div>
          <span
            data-testid="weather-rain-value"
            className="text-xl font-bold tracking-tight text-white"
          >
            {weather ? `${weather.precipitationForecast24hMm.toFixed(1)}` : '--'}
          </span>
          <span className="ml-0.5 text-xs text-slate-400">mm</span>
        </div>
      </div>

      {/* Physics Generation Sections: ESA Water Generator & Rainwater Catchment */}
      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 border-t border-slate-800/80 pt-3 text-xs">
        {/* ESA Atmospheric Water Generation Sub-card */}
        <div className="rounded-xl bg-slate-950/40 p-3 ring-1 ring-slate-800/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-1.5">
              <Wind className="h-4 w-4 text-cyan-400" aria-hidden="true" />
              <span className="font-semibold text-white">ESA Water Generator</span>
            </div>
            <span className="text-[10px] text-slate-400">
              {activeFarm.esaNominalCapacityM3PerDay.toFixed(1)} m³/d nominal
            </span>
          </div>

          <div className="mt-2.5 flex items-baseline justify-between">
            <div>
              <span className="text-slate-400">Live Rate:</span>
              <p
                data-testid="esa-live-rate"
                className="text-base font-bold text-cyan-400"
              >
                {esaProduction ? `${esaProduction.hourlyRateLiters.toFixed(1)} L/h` : '--'}
              </p>
            </div>
            <div className="text-right">
              <span className="text-slate-400">Est. 24h Yield:</span>
              <p
                data-testid="esa-daily-yield"
                className="text-sm font-semibold text-white"
              >
                {esaProduction ? `${esaProduction.dailyRateM3.toFixed(2)} m³/day` : '--'}
              </p>
            </div>
          </div>

          <p className="mt-1.5 text-[10px] text-slate-400">
            Operating at {esaProduction ? `${(esaProduction.efficiencyFactor * 100).toFixed(0)}%` : '--'} of nominal capacity under current conditions.
          </p>
        </div>

        {/* Rainwater Catchment Inflow Sub-card */}
        <div className="rounded-xl bg-slate-950/40 p-3 ring-1 ring-slate-800/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-1.5">
              <CloudRain className="h-4 w-4 text-sky-400" aria-hidden="true" />
              <span className="font-semibold text-white">Rainwater Catchment</span>
            </div>
            <span className="text-[10px] text-slate-400">
              {activeFarm.catchmentAreaM2} m² area
            </span>
          </div>

          <div className="mt-2.5 flex items-baseline justify-between">
            <div>
              <span className="text-slate-400">Forecast Inflow:</span>
              <p
                data-testid="catchment-inflow-value"
                className="text-base font-bold text-sky-400"
              >
                {catchmentEstimate ? `${catchmentEstimate.forecastInflowM3.toFixed(2)} m³` : '--'}
              </p>
            </div>
            <div className="text-right">
              <span className="text-slate-400">Collection Area:</span>
              <p className="text-sm font-semibold text-white">
                {activeFarm.catchmentAreaM2} m²
              </p>
            </div>
          </div>

          <p className="mt-1.5 text-[10px] text-slate-400">
            {catchmentEstimate && catchmentEstimate.precipitationForecastMm > 0
              ? `Expected harvest from ${catchmentEstimate.precipitationForecastMm} mm forecasted rainfall.`
              : 'No significant rainfall forecasted for the next 24 hours.'}
          </p>
        </div>
      </div>
    </div>
  );
}

