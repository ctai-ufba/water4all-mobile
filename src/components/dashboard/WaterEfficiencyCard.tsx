/**
 * @file WaterEfficiencyCard.tsx
 * @summary Dashboard card displaying local water efficiency and the daily euro balance.
 * @description Renders the percentage of farm demand met by sustainable local sources
 * (Rainwater catchment + ESA atmospheric water generator), then the daily financial result as
 * three lines: truck purchases avoided, electricity drawn producing ESA water, and the net.
 */

import React from 'react';
import { Leaf, Euro, Sparkles, Zap } from 'lucide-react';
import {
  EXTERNAL_WATER_TRUCK_COST_EUR_PER_M3,
  ELECTRICITY_PRICE_EUR_PER_KWH,
} from '../../types/telemetry';

/**
 * Props for the WaterEfficiencyCard component.
 */
export interface WaterEfficiencyCardProps {
  /** Percentage of demand met by local sources (0 to 100%) */
  localPercentage: number;
  /** Net daily financial effect in EUR: avoided purchases less ESA electricity */
  dailySavingsEur: number;
  /** External truck purchases avoided by local water, in EUR/day */
  avoidedTruckCostEur: number;
  /** Electricity drawn producing ESA water, in EUR/day */
  esaEnergyCostEur: number;
}

/**
 * Water efficiency and financial savings card component.
 *
 * @summary Water efficiency and savings card.
 * @description Quantifies the environmental and economic value of on-site water harvesting,
 * presenting the local water share and the day's financial balance broken into its two causes.
 *
 * @param props - Local share plus the avoided-cost, energy-cost and net savings figures.
 * @returns React.JSX.Element representing the water efficiency card.
 * @throws Never throws.
 */
export function WaterEfficiencyCard({
  localPercentage,
  dailySavingsEur,
  avoidedTruckCostEur,
  esaEnergyCostEur,
}: WaterEfficiencyCardProps): React.JSX.Element {
  const isNetLoss = dailySavingsEur < 0;
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
            <span>Net Daily Result</span>
          </div>
          <p
            data-testid="water-efficiency-net"
            className={`mt-1 text-2xl font-extrabold ${isNetLoss ? 'text-amber-400' : 'text-cyan-400'}`}
          >
            €{dailySavingsEur.toFixed(2)}
          </p>
          <p className="mt-1 text-[11px] text-slate-400">
            water saved less energy
          </p>
        </div>
      </div>

      {/*
        Shown as three lines rather than one net figure. ESA water costs on the order of 790 EUR/m³
        in electricity against 4.50 EUR/m³ delivered, so the net is normally negative; a lone red
        number would say nothing about why. Split, the card attributes it.
      */}
      <div className="mt-3 space-y-1.5 rounded-xl bg-slate-950/40 p-3 text-xs ring-1 ring-slate-800/60">
        <div className="flex items-center justify-between">
          <span className="flex items-center space-x-1.5 text-slate-400">
            <Leaf className="h-3.5 w-3.5 text-emerald-400" aria-hidden="true" />
            <span>Truck water avoided</span>
          </span>
          <span data-testid="water-efficiency-avoided" className="font-semibold text-emerald-400">
            +€{avoidedTruckCostEur.toFixed(2)}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <span className="flex items-center space-x-1.5 text-slate-400">
            <Zap className="h-3.5 w-3.5 text-amber-400" aria-hidden="true" />
            <span>ESA energy cost</span>
          </span>
          <span data-testid="water-efficiency-energy" className="font-semibold text-amber-400">
            −€{esaEnergyCostEur.toFixed(2)}
          </span>
        </div>

        <div className="flex items-center justify-between border-t border-slate-800/80 pt-1.5">
          <span className="font-semibold text-slate-300">Net per day</span>
          <span className={`font-bold ${isNetLoss ? 'text-amber-400' : 'text-emerald-400'}`}>
            €{dailySavingsEur.toFixed(2)}
          </span>
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
        Truck delivery {EXTERNAL_WATER_TRUCK_COST_EUR_PER_M3.toFixed(2)} €/m³, electricity{' '}
        {ELECTRICITY_PRICE_EUR_PER_KWH.toFixed(2)} €/kWh. ESA earns its place through autonomy where
        no truck reaches, not through price.
      </p>
    </div>
  );
}

