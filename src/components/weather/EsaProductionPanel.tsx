/**
 * @file EsaProductionPanel.tsx
 * @summary ESA atmospheric water generation detail panel for the Weather view.
 * @description Presents the three ESA figures that answer three different questions - what the air
 * sustains right now, what the next day is forecast to yield, and what the whole forecast horizon
 * averages - alongside the physics intermediates the engine computes on the way there.
 *
 * @remarks Keeping the three apart is the point of the panel. An instantaneous rate read at a
 * summer afternoon peak is legitimately zero for a day that does produce, because the daily total
 * is collected in the humid pre-dawn window (ADR 0003), so presenting either figure as the other
 * misstates the plant.
 */

import React from 'react';
import { Wind, Gauge, Zap, RotateCw } from 'lucide-react';
import { AmbientConditions, ESAProductionResult } from '../../types/weather';

/** Props for the EsaProductionPanel component. */
export interface EsaProductionPanelProps {
  /** Production implied by holding the current reading steady, or null when unavailable */
  instantaneous: ESAProductionResult | null;
  /** Production integrated across the next 24 hours of forecast, or null when unavailable */
  forecast24h: ESAProductionResult | null;
  /** Production integrated across the whole forecast horizon carried, or null when unavailable */
  horizonMean: ESAProductionResult | null;
  /** The current reading the instantaneous figure is taken at, or null when unavailable */
  ambient: AmbientConditions | null;
  /** Nominal daily capacity of the installed ESA system in m³/day */
  nominalCapacityM3PerDay: number;
}

/** Renders one labelled intermediate with its unit. */
function IntermediateRow({
  label,
  value,
  unit,
  note,
  testId,
}: {
  label: string;
  value: string;
  unit: string;
  note: string;
  testId: string;
}): React.JSX.Element {
  return (
    <div className="flex items-baseline justify-between gap-2 border-b border-slate-800/60 py-1.5 last:border-b-0">
      <div className="min-w-0">
        <span className="text-[11px] text-slate-300">{label}</span>
        <p className="text-[10px] leading-tight text-slate-500">{note}</p>
      </div>
      <span className="shrink-0 text-right text-xs font-semibold text-white">
        <span data-testid={testId}>{value}</span>
        <span className="ml-1 font-normal text-slate-400">{unit}</span>
      </span>
    </div>
  );
}

/**
 * ESA production detail panel.
 *
 * @summary ESA physics panel.
 * @description Renders the instantaneous rate, the day-ahead yield and the horizon mean as three
 * separately labelled figures, then the adsorption potential, equilibrium loading, ambient yield
 * ratio, cycle count and energy draw behind them.
 *
 * @param props - The three production results, the ambient reading and the nominal capacity.
 * @returns React.JSX.Element representing the ESA detail panel.
 * @throws Never throws; missing results render as em dashes.
 */
export function EsaProductionPanel({
  instantaneous,
  forecast24h,
  horizonMean,
  ambient,
  nominalCapacityM3PerDay,
}: EsaProductionPanelProps): React.JSX.Element {
  return (
    <section
      data-testid="esa-production-panel"
      className="rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800/90 p-4 shadow-xl"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="rounded-lg bg-cyan-500/10 p-2 text-cyan-400 ring-1 ring-cyan-500/20">
            <Wind className="h-4 w-4" aria-hidden="true" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">ESA Water Generator</h3>
            <span className="text-[10px] text-slate-400">
              {nominalCapacityM3PerDay.toFixed(2)} m³/day nominal at the 25 °C / 90 % RH bench
            </span>
          </div>
        </div>
      </div>

      {/* The two figures the screen exists to keep apart: a rate and a yield, never interchanged. */}
      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className="rounded-xl bg-slate-950/50 p-3 ring-1 ring-slate-800/60">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
            Instantaneous rate
          </span>
          <p data-testid="esa-instantaneous-rate" className="mt-1 text-xl font-bold text-cyan-400">
            {instantaneous ? instantaneous.hourlyRateLiters.toFixed(1) : '--'}
            <span className="ml-1 text-xs font-medium text-slate-400">L/h</span>
          </p>
          <p className="mt-1 text-[10px] leading-tight text-slate-400">
            {ambient
              ? `What ${ambient.temperatureC.toFixed(1)} °C at ${ambient.relativeHumidityPct} % RH sustains if held.`
              : 'Awaiting a current reading.'}
          </p>
        </div>

        <div className="rounded-xl bg-slate-950/50 p-3 ring-1 ring-slate-800/60">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
            Next 24 h yield
          </span>
          <p data-testid="esa-forecast-24h-yield" className="mt-1 text-xl font-bold text-white">
            {forecast24h ? forecast24h.dailyRateM3.toFixed(3) : '--'}
            <span className="ml-1 text-xs font-medium text-slate-400">m³</span>
          </p>
          <p className="mt-1 text-[10px] leading-tight text-slate-400">
            Integrated hour by hour across the forecast, not the rate above extrapolated.
          </p>
        </div>
      </div>

      {/*
        A 24-hour window holds only two whole 8.5 h cycles and truncates the third, so the day's
        yield sits below the sustained mean. Stating the horizon makes the gap attributable rather
        than looking like a discrepancy between two figures that should agree.
      */}
      <p className="mt-2 rounded-lg bg-slate-950/40 px-2.5 py-1.5 text-[10px] leading-relaxed text-slate-400">
        Horizon mean{' '}
        <span data-testid="esa-horizon-mean" className="font-semibold text-slate-200">
          {horizonMean ? `${horizonMean.dailyRateM3.toFixed(3)} m³/day` : '--'}
        </span>{' '}
        over{' '}
        <span data-testid="esa-horizon-days" className="font-semibold text-slate-200">
          {horizonMean ? horizonMean.integratedDays : '--'}
        </span>{' '}
        forecast days. A cycle spans 8.5 h, so a single day truncates the cycle straddling its end
        and yields less than the sustained mean.
      </p>

      <div className="mt-3 border-t border-slate-800/80 pt-2">
        <div className="flex items-center gap-1.5">
          <Gauge className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
          <h4 className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            Physics intermediates
          </h4>
        </div>

        <div className="mt-1">
          <IntermediateRow
            label="Adsorption potential A"
            note="Polanyi potential at the current reading; rises as air dries."
            value={instantaneous ? instantaneous.adsorptionPotentialJPerMol.toFixed(1) : '--'}
            unit="J/mol"
            testId="esa-adsorption-potential"
          />
          <IntermediateRow
            label="Equilibrium loading q"
            note="Dubinin-Astakhov loading the bed would reach at that potential."
            value={instantaneous ? instantaneous.equilibriumLoadingKgPerKg.toFixed(4) : '--'}
            unit="kg/kg"
            testId="esa-equilibrium-loading"
          />
          {/*
            Deliberately not phrased as a percentage "of nominal capacity". Nominal is anchored to a
            bench measurement Mediterranean air never reaches, so a healthy unit reads far below it;
            worded as equipment performance, a correct 30 % looked like a fault.
          */}
          <IntermediateRow
            label="Ambient yield ratio"
            note="Share of nominal the next day's air can deliver - moisture, not unit condition."
            value={forecast24h ? `${(forecast24h.ambientYieldRatio * 100).toFixed(0)}` : '--'}
            unit="%"
            testId="esa-ambient-yield-ratio"
          />
          <IntermediateRow
            label="Cycles completed"
            note="Adsorption-desorption cycles finishing inside the next 24 h."
            value={forecast24h ? forecast24h.cyclesPerDay.toFixed(2) : '--'}
            unit="/day"
            testId="esa-cycles-per-day"
          />
          <IntermediateRow
            label="Electrical draw"
            note="Regeneration and condensation over the same 24 h."
            value={forecast24h ? forecast24h.energyKwhPerDay.toFixed(1) : '--'}
            unit="kWh"
            testId="esa-energy-per-day"
          />
        </div>
      </div>

      <div className="mt-2 flex items-start gap-1.5 text-[10px] leading-relaxed text-slate-500">
        {forecast24h && forecast24h.cyclesPerDay === 0 ? (
          <>
            <RotateCw className="mt-px h-3 w-3 shrink-0 text-amber-400" aria-hidden="true" />
            <span>
              No cycle clears the collection gate in this air: regeneration costs a fixed charge
              whatever it recovers, so the unit waits rather than spending it on a near-empty bed.
            </span>
          </>
        ) : (
          <>
            <Zap className="mt-px h-3 w-3 shrink-0 text-slate-500" aria-hidden="true" />
            <span>
              Energy is dominated by the fixed regeneration charge each cycle draws, which is why
              specific energy worsens as the air dries.
            </span>
          </>
        )}
      </div>
    </section>
  );
}
