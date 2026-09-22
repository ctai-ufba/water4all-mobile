/**
 * @file WeatherCard.tsx
 * @summary Slim dashboard weather strip.
 * @description Shows the three ambient metrics an operator glances at - temperature, relative
 * humidity and the 24-hour rainfall forecast - plus where the reading came from, and opens the
 * Weather view for anything that needs reasoning about.
 *
 * @remarks The ESA production figures, the physics intermediates and the catchment breakdown moved
 * to the Weather view. The dashboard's job is the glance; a live rate and a daily yield sitting
 * side by side in a strip invited reading one as the other, which they are not (ADR 0003).
 */

import React from 'react';
import {
  Thermometer,
  Droplets,
  CloudRain,
  SunMedium,
  CheckCircle2,
  AlertTriangle,
  ChevronRight,
} from 'lucide-react';
import { useWeather } from '../../context/WeatherContext';
import { useAuth } from '../../context/AuthContext';

/** Props for the WeatherCard component. */
export interface WeatherCardProps {
  /**
   * Opens the Weather view.
   *
   * @remarks Omit it and the strip renders as static text rather than a control, so the card stays
   * usable in contexts with nowhere to navigate to.
   */
  onOpenWeatherView?: () => void;
}

/**
 * Dashboard weather strip.
 *
 * @summary Ambient conditions strip.
 * @description Renders current temperature, relative humidity and forecast rainfall with a live or
 * offline-fallback badge, as a control that opens the Weather view when one is supplied.
 *
 * @param props - Optional navigation callback to the Weather view.
 * @returns React.JSX.Element representing the weather strip, or an empty fragment without a farm.
 * @throws Never throws.
 */
export function WeatherCard({ onOpenWeatherView }: WeatherCardProps): React.JSX.Element {
  const { activeFarm } = useAuth();
  const { weather } = useWeather();

  if (!activeFarm) {
    return <></>;
  }

  const content = (
    <>
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2.5">
          <div className="rounded-lg bg-sky-500/10 p-2 text-sky-400 ring-1 ring-sky-500/20">
            <SunMedium className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="text-left">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-sky-400">
              Live Weather &bull; {activeFarm.location}
            </span>
            <h3 className="text-sm font-bold text-white">Ambient Conditions</h3>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {weather?.isOfflineFallback ? (
            <span
              data-testid="weather-source-badge"
              className="inline-flex items-center space-x-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-semibold text-amber-400 ring-1 ring-amber-500/30"
              title="Using cached or synthetic seasonal Mediterranean weather"
            >
              <AlertTriangle className="h-3 w-3" aria-hidden="true" />
              <span>Offline Fallback</span>
            </span>
          ) : (
            <span
              data-testid="weather-source-badge"
              className="inline-flex items-center space-x-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-semibold text-emerald-400 ring-1 ring-emerald-500/30"
              title="Live data from Open-Meteo"
            >
              <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
              <span>Open-Meteo Live</span>
            </span>
          )}

          {onOpenWeatherView && (
            <ChevronRight className="h-4 w-4 text-slate-500" aria-hidden="true" />
          )}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-xl bg-slate-950/40 p-3 ring-1 ring-slate-800/60">
          <div className="mb-1 flex items-center justify-center space-x-1 text-slate-400">
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

        <div className="rounded-xl bg-slate-950/40 p-3 ring-1 ring-slate-800/60">
          <div className="mb-1 flex items-center justify-center space-x-1 text-slate-400">
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

        <div className="rounded-xl bg-slate-950/40 p-3 ring-1 ring-slate-800/60">
          <div className="mb-1 flex items-center justify-center space-x-1 text-slate-400">
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
    </>
  );

  const cardClass =
    'w-full rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800/90 p-5 shadow-xl';

  if (!onOpenWeatherView) {
    return <div className={cardClass}>{content}</div>;
  }

  return (
    <button
      type="button"
      onClick={onOpenWeatherView}
      aria-label="Open Weather view for ESA production and radar detail"
      className={`${cardClass} text-left transition hover:border-slate-700 hover:bg-slate-800/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500`}
    >
      {content}
    </button>
  );
}
