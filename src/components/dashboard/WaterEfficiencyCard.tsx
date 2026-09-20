/**
 * @file WaterEfficiencyCard.tsx
 * @summary Dashboard card displaying local water efficiency and daily euro savings.
 * @description Renders the percentage of farm demand met by sustainable local sources
 * (Rainwater catchment + ESA atmospheric water generator) and the estimated daily financial
 * savings achieved compared to purchasing water from external truck deliveries.
 */

import React from 'react';
import { Leaf, Euro, Sparkles } from 'lucide-react';
import { EXTERNAL_WATER_TRUCK_COST_EUR_PER_M3 } from '../../types/telemetry';

/**
 * Props for the WaterEfficiencyCard component.
 */
export interface WaterEfficiencyCardProps {
  /** Percentage of demand met by local sources (0 to 100%) */
  localPercentage: number;
  /** Estimated daily savings in EUR compared to external deliveries */
  dailySavingsEur: number;
}

/**
 * Water efficiency and financial savings card component.
 *
 * @summary Water efficiency and savings card.
 * @description Quantifies the environmental and economic value of on-site water harvesting,
 * presenting local water share and euros saved per day.
 *
 * @param props - Component props containing localPercentage and dailySavingsEur.
 * @returns React.JSX.Element representing the water efficiency card.
 * @throws Never throws.
 */
export function WaterEfficiencyCard({
  localPercentage,
  dailySavingsEur,
}: WaterEfficiencyCardProps): React.JSX.Element {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 shadow-xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <div className="rounded-lg bg-emerald-500/10 p-2 text-emerald-400 ring-1 ring-emerald-500/20">
            <Leaf className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-emerald-400">
              Sustainability &amp; Value
            </span>
            <h3 className="text-sm font-bold text-white">Water Efficiency &amp; Savings</h3>
          </div>
        </div>

        <span className="flex items-center space-x-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-400 ring-1 ring-emerald-500/30">
          <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
          <span>{localPercentage}% Local</span>
        </span>
      </div>

      {/* Primary Savings Display */}
      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-slate-950/60 p-3 ring-1 ring-slate-800/80">
          <div className="flex items-center space-x-1 text-slate-400 text-xs">
            <Leaf className="h-3.5 w-3.5 text-emerald-400" aria-hidden="true" />
            <span>Local Supply Share</span>
          </div>
          <p className="mt-1 text-2xl font-extrabold text-white">
            {localPercentage}%
          </p>
          <p className="mt-1 text-[11px] text-slate-400">
            Rainwater + ESA water
          </p>
        </div>

        <div className="rounded-xl bg-slate-950/60 p-3 ring-1 ring-slate-800/80">
          <div className="flex items-center space-x-1 text-slate-400 text-xs">
            <Euro className="h-3.5 w-3.5 text-cyan-400" aria-hidden="true" />
            <span>Daily Avoided Cost</span>
          </div>
          <p className="mt-1 text-2xl font-extrabold text-cyan-400">
            €{dailySavingsEur.toFixed(2)}
          </p>
          <p className="mt-1 text-[11px] text-slate-400">
            vs. truck deliveries
          </p>
        </div>
      </div>

      {/* Visual Progress Bar for Local Water */}
      <div className="mt-4">
        <div className="flex justify-between text-[11px] text-slate-400 mb-1">
          <span>Local Sources (Rainwater + ESA)</span>
          <span className="font-semibold text-slate-300">{localPercentage}%</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-950 ring-1 ring-slate-800">
          <div
            className="h-full bg-gradient-to-r from-cyan-500 to-emerald-400 transition-all duration-500"
            style={{ width: `${localPercentage}%` }}
          />
        </div>
      </div>

      <p className="mt-3 text-[11px] text-slate-500 text-center">
        Estimated savings based on standard {EXTERNAL_WATER_TRUCK_COST_EUR_PER_M3.toFixed(2)} €/m³ truck delivery rate.
      </p>
    </div>
  );
}

