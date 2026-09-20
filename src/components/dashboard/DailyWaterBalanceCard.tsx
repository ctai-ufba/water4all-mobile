/**
 * @file DailyWaterBalanceCard.tsx
 * @summary Dashboard card displaying daily water balance (inflow vs. consumption).
 * @description Compares total water entering the farm system against total agricultural
 * and human consumption, providing an immediate net balance surplus/deficit indicator.
 */

import React from 'react';
import { Scale, ArrowUpRight, ArrowDownRight, CheckCircle2, AlertCircle } from 'lucide-react';
import { WaterFlowMetrics } from '../../types/telemetry';

/**
 * Props for the DailyWaterBalanceCard component.
 */
export interface DailyWaterBalanceCardProps {
  /** Total daily inflow in m³/day */
  totalInflow: number;
  /** Total daily consumption in m³/day */
  totalConsumption: number;
  /** Net daily balance in m³/day (inflow - consumption) */
  netBalance: number;
  /** Boolean flag indicating surplus (true) or deficit (false) */
  isSurplus: boolean;
  /** Detailed breakdown of inflows and consumption */
  flows: WaterFlowMetrics;
}

/**
 * Daily water balance card component.
 *
 * @summary Inflow vs. consumption balance card.
 * @description Displays the farm's mass balance, highlighting whether current operations
 * run on a sustainable water surplus or a depleting deficit.
 *
 * @param props - Component props containing inflow, consumption, netBalance, isSurplus, and flows.
 * @returns React.JSX.Element representing the daily water balance card.
 * @throws Never throws.
 */
export function DailyWaterBalanceCard({
  totalInflow,
  totalConsumption,
  netBalance,
  isSurplus,
  flows,
}: DailyWaterBalanceCardProps): React.JSX.Element {
  const badgeColor = isSurplus
    ? 'bg-emerald-500/10 text-emerald-400 ring-emerald-500/30'
    : 'bg-rose-500/10 text-rose-400 ring-rose-500/30';

  const BadgeIcon = isSurplus ? CheckCircle2 : AlertCircle;

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 shadow-xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <div className="rounded-lg bg-indigo-500/10 p-2 text-indigo-400 ring-1 ring-indigo-500/20">
            <Scale className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-indigo-400">
              Flow Telemetry
            </span>
            <h3 className="text-sm font-bold text-white">Daily Water Balance</h3>
          </div>
        </div>

        <div className={`flex items-center space-x-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${badgeColor}`}>
          <BadgeIcon className="h-3.5 w-3.5" aria-hidden="true" />
          <span>{isSurplus ? 'Surplus' : 'Deficit'}</span>
        </div>
      </div>

      {/* Main Flow Comparison */}
      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-slate-950/60 p-3 ring-1 ring-slate-800/80">
          <div className="flex items-center space-x-1 text-slate-400 text-xs">
            <ArrowUpRight className="h-3.5 w-3.5 text-emerald-400" aria-hidden="true" />
            <span>Total Inflow</span>
          </div>
          <p className="mt-1 text-xl font-bold text-white">
            {totalInflow.toFixed(1)} m³/day
          </p>
          <div className="mt-2 space-y-0.5 text-[11px] text-slate-400">
            <p>Rainwater: {flows.rainwaterInflow.toFixed(1)} m³</p>
            <p>ESA: {flows.esaInflow.toFixed(1)} m³</p>
            {flows.externalInflow > 0 && <p>External: {flows.externalInflow.toFixed(1)} m³</p>}
          </div>
        </div>

        <div className="rounded-xl bg-slate-950/60 p-3 ring-1 ring-slate-800/80">
          <div className="flex items-center space-x-1 text-slate-400 text-xs">
            <ArrowDownRight className="h-3.5 w-3.5 text-rose-400" aria-hidden="true" />
            <span>Total Consumption</span>
          </div>
          <p className="mt-1 text-xl font-bold text-white">
            {totalConsumption.toFixed(1)} m³/day
          </p>
          <div className="mt-2 space-y-0.5 text-[11px] text-slate-400">
            <p>Irrigation: {flows.irrigationDemand.toFixed(1)} m³</p>
            <p>Human: {flows.humanUtilityDemand.toFixed(1)} m³</p>
            {flows.livestockDemand > 0 && <p>Livestock: {flows.livestockDemand.toFixed(1)} m³</p>}
          </div>
        </div>
      </div>

      {/* Net Balance Banner */}
      <div className="mt-3 flex items-center justify-between rounded-xl bg-slate-950/40 px-3 py-2 text-xs">
        <span className="text-slate-400">Net Daily Balance:</span>
        <span
          className={`font-bold text-sm ${
            isSurplus ? 'text-emerald-400' : 'text-rose-400'
          }`}
        >
          {netBalance > 0 ? `+${netBalance.toFixed(1)}` : netBalance.toFixed(1)} m³/day
        </span>
      </div>
    </div>
  );
}

