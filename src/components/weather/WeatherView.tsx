/**
 * @file WeatherView.tsx
 * @summary Dedicated Weather screen carrying the atmospheric physics detail and the site map.
 * @description Presents the active farm's ambient conditions, the ESA production figures and
 * physics intermediates that do not fit on the dashboard, the rainwater catchment breakdown, and a
 * map of the farm's own site hosting the precipitation radar overlay.
 *
 * @remarks The dashboard keeps only a slim weather strip - three ambient metrics and where they
 * came from - and opens this screen. Everything an operator has to reason about rather than
 * glance at lives here.
 */

import React from 'react';
import {
  Thermometer,
  Droplets,
  CloudRain,
  RefreshCw,
  SunMedium,
  CheckCircle2,
  AlertTriangle,
  MapPin,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useWeather } from '../../context/WeatherContext';
import { FarmSiteMap } from './FarmSiteMap';
import { EsaProductionPanel } from './EsaProductionPanel';
import { CatchmentPanel } from './CatchmentPanel';
import { useRadarFrames } from './useRadarFrames';

/**
 * Weather and atmospheric physics screen.
 *
 * @summary Weather view.
 * @description Reads the active farm and its weather state, checks radar availability, and renders
 * the ambient reading, the site map, the ESA detail panel and the catchment detail panel.
 *
 * @returns React.JSX.Element representing the Weather screen.
 * @throws Never throws; renders a loading placeholder until a farm session exists.
 */
export function WeatherView(): React.JSX.Element {
  const { activeFarm } = useAuth();
  const {
    weather,
    loading,
    esaProduction,
    esaInstantaneous,
    esaForecast24h,
    catchmentEstimate,
    refetch,
  } = useWeather();
  const radar = useRadarFrames();

  if (!activeFarm) {
    return (
      <div className="flex h-64 items-center justify-center text-center text-slate-400">
        <p className="text-sm">Loading weather telemetry...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Screen header: farm, provenance of the reading, and a manual refresh */}
      <section className="rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800/90 p-4 shadow-xl">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="rounded-lg bg-sky-500/10 p-2 text-sky-400 ring-1 ring-sky-500/20">
              <SunMedium className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-sky-400">
                Weather &amp; Atmospheric Physics
              </span>
              <h2 className="text-sm font-bold text-white">{activeFarm.estateName}</h2>
              <p className="flex items-center gap-1 text-[10px] text-slate-400">
                <MapPin className="h-3 w-3" aria-hidden="true" />
                {activeFarm.location} &bull; {activeFarm.coordinates.latitude.toFixed(4)},{' '}
                {activeFarm.coordinates.longitude.toFixed(4)}
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {weather?.isOfflineFallback ? (
              <span
                data-testid="weather-view-source-badge"
                className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] font-semibold text-amber-400 ring-1 ring-amber-500/30"
                title="Using cached or synthetic seasonal Mediterranean weather"
              >
                <AlertTriangle className="h-3 w-3" aria-hidden="true" />
                <span>Offline Fallback</span>
              </span>
            ) : (
              <span
                data-testid="weather-view-source-badge"
                className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-400 ring-1 ring-emerald-500/30"
                title="Live data from Open-Meteo"
              >
                <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                <span>Open-Meteo Live</span>
              </span>
            )}

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

        {/* Ambient reading the physics below is computed from */}
        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-xl bg-slate-950/40 p-2.5 ring-1 ring-slate-800/60">
            <div className="mb-1 flex items-center justify-center gap-1 text-slate-400">
              <Thermometer className="h-3.5 w-3.5 text-amber-400" aria-hidden="true" />
              <span className="text-[10px] font-medium uppercase">Temp</span>
            </div>
            <span data-testid="weather-view-temp" className="text-lg font-bold text-white">
              {weather ? weather.temperatureC.toFixed(1) : '--'}
            </span>
            <span className="ml-0.5 text-xs text-slate-400">°C</span>
          </div>

          <div className="rounded-xl bg-slate-950/40 p-2.5 ring-1 ring-slate-800/60">
            <div className="mb-1 flex items-center justify-center gap-1 text-slate-400">
              <Droplets className="h-3.5 w-3.5 text-cyan-400" aria-hidden="true" />
              <span className="text-[10px] font-medium uppercase">Humidity</span>
            </div>
            <span data-testid="weather-view-humidity" className="text-lg font-bold text-white">
              {weather ? weather.relativeHumidityPct : '--'}
            </span>
            <span className="ml-0.5 text-xs text-slate-400">%</span>
          </div>

          <div className="rounded-xl bg-slate-950/40 p-2.5 ring-1 ring-slate-800/60">
            <div className="mb-1 flex items-center justify-center gap-1 text-slate-400">
              <CloudRain className="h-3.5 w-3.5 text-sky-400" aria-hidden="true" />
              <span className="text-[10px] font-medium uppercase">24h Rain</span>
            </div>
            <span data-testid="weather-view-rain" className="text-lg font-bold text-white">
              {weather ? weather.precipitationForecast24hMm.toFixed(1) : '--'}
            </span>
            <span className="ml-0.5 text-xs text-slate-400">mm</span>
          </div>
        </div>
      </section>

      {/* The farm's own site, under the radar overlay */}
      <FarmSiteMap farm={activeFarm} radar={radar} />

      <EsaProductionPanel
        instantaneous={esaInstantaneous}
        forecast24h={esaForecast24h}
        horizonMean={esaProduction}
        ambient={
          weather
            ? {
                temperatureC: weather.temperatureC,
                relativeHumidityPct: weather.relativeHumidityPct,
              }
            : null
        }
        nominalCapacityM3PerDay={activeFarm.esaNominalCapacityM3PerDay}
      />

      <CatchmentPanel estimate={catchmentEstimate} />
    </div>
  );
}
