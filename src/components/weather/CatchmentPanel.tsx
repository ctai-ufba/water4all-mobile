/**
 * @file CatchmentPanel.tsx
 * @summary Rainwater catchment detail panel for the Weather view.
 * @description Shows the forecast inflow together with the factors behind it - runoff coefficient,
 * first-flush diversion and their product - and spells out the millimetre-to-cubic-metre
 * conversion, so the volume can be checked rather than taken on trust.
 */

import React from 'react';
import { CloudRain, Calculator } from 'lucide-react';
import { CatchmentEstimateResult } from '../../types/weather';

/** Props for the CatchmentPanel component. */
export interface CatchmentPanelProps {
  /** Catchment estimate for the active farm, or null when no weather is available */
  estimate: CatchmentEstimateResult | null;
}

/**
 * Rainwater catchment detail panel.
 *
 * @summary Catchment physics panel.
 * @description Renders the forecast harvest volume, the runoff and first-flush factors it applies,
 * and the arithmetic that turns forecast rainfall depth over the collection area into cubic metres.
 *
 * @param props - The catchment estimate to present.
 * @returns React.JSX.Element representing the catchment detail panel.
 * @throws Never throws; a missing estimate renders as em dashes.
 */
export function CatchmentPanel({ estimate }: CatchmentPanelProps): React.JSX.Element {
  return (
    <section
      data-testid="catchment-panel"
      className="rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800/90 p-4 shadow-xl"
    >
      <div className="flex items-center gap-2">
        <div className="rounded-lg bg-sky-500/10 p-2 text-sky-400 ring-1 ring-sky-500/20">
          <CloudRain className="h-4 w-4" aria-hidden="true" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-white">Rainwater Catchment</h3>
          <span className="text-[10px] text-slate-400">
            {estimate ? `${estimate.catchmentAreaM2} m² collection area` : 'Collection area pending'}
          </span>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className="rounded-xl bg-slate-950/50 p-3 ring-1 ring-slate-800/60">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
            24 h rainfall forecast
          </span>
          <p data-testid="catchment-precipitation" className="mt-1 text-xl font-bold text-white">
            {estimate ? estimate.precipitationForecastMm.toFixed(1) : '--'}
            <span className="ml-1 text-xs font-medium text-slate-400">mm</span>
          </p>
        </div>

        <div className="rounded-xl bg-slate-950/50 p-3 ring-1 ring-slate-800/60">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
            Collectible inflow
          </span>
          <p data-testid="catchment-inflow" className="mt-1 text-xl font-bold text-sky-400">
            {estimate ? estimate.forecastInflowM3.toFixed(2) : '--'}
            <span className="ml-1 text-xs font-medium text-slate-400">m³</span>
          </p>
        </div>
      </div>

      <dl className="mt-3 border-t border-slate-800/80 pt-2 text-[11px]">
        <div className="flex items-baseline justify-between border-b border-slate-800/60 py-1.5">
          <dt className="text-slate-300">Runoff coefficient</dt>
          <dd data-testid="catchment-runoff-coefficient" className="font-semibold text-white">
            {estimate ? estimate.runoffCoefficient.toFixed(2) : '--'}
          </dd>
        </div>
        <div className="flex items-baseline justify-between border-b border-slate-800/60 py-1.5">
          <dt className="text-slate-300">First-flush factor</dt>
          <dd data-testid="catchment-first-flush-factor" className="font-semibold text-white">
            {estimate ? estimate.firstFlushFactor.toFixed(2) : '--'}
          </dd>
        </div>
        <div className="flex items-baseline justify-between py-1.5">
          <dt className="text-slate-300">Effective runoff</dt>
          <dd data-testid="catchment-effective-runoff" className="font-semibold text-white">
            {estimate ? estimate.effectiveRunoff.toFixed(3) : '--'}
          </dd>
        </div>
      </dl>

      {/* The conversion written out: a volume an operator can re-derive is a volume they can trust. */}
      <div className="mt-2 flex items-start gap-1.5 rounded-lg bg-slate-950/40 px-2.5 py-1.5">
        <Calculator className="mt-0.5 h-3 w-3 shrink-0 text-slate-500" aria-hidden="true" />
        <p
          data-testid="catchment-breakdown"
          className="text-[10px] leading-relaxed text-slate-400"
        >
          {estimate
            ? `${estimate.precipitationForecastMm.toFixed(1)} mm × ${estimate.catchmentAreaM2} m² × ${estimate.effectiveRunoff.toFixed(3)} ÷ 1000 = ${estimate.forecastInflowM3.toFixed(2)} m³ — millimetres over an area are litres, and 1000 litres are one cubic metre.`
            : 'Awaiting a rainfall forecast for the active farm.'}
        </p>
      </div>
    </section>
  );
}
