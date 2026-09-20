/**
 * @file WaterAutonomyCard.tsx
 * @summary Primary dashboard card displaying farm water autonomy in days.
 * @description Renders the calculated water autonomy metric indicating how long
 * current reserves will last under current consumption rates, alongside total stored
 * water volume and daily consumption rate.
 */

import React from 'react';
import { Clock, Droplets, ArrowDownRight } from 'lucide-react';
import { INDEFINITE_AUTONOMY_DAYS } from '../../domain/telemetryEngine';

/**
 * Props for the WaterAutonomyCard component.
 */
export interface WaterAutonomyCardProps {
  /** Calculated water autonomy in days */
  autonomyDays: number;
  /** Total water volume currently stored across all reservoirs in m³ */
  totalStoredVolume: number;
  /** Total daily water consumption across all farm uses in m³/day */
  totalConsumption: number;
}

/**
 * Water autonomy card component.
 *
 * @summary Primary water autonomy card.
 * @description Presents the farm operator with immediate clarity on how many days
 * of water remain, categorized by status (Optimal, Adequate, Critical).
 *
 * @param props - Component props containing autonomyDays, totalStoredVolume, and totalConsumption.
 * @returns React.JSX.Element representing the water autonomy metric card.
 * @throws Never throws.
 */
export function WaterAutonomyCard({
  autonomyDays,
  totalStoredVolume,
  totalConsumption,
}: WaterAutonomyCardProps): React.JSX.Element {
  // Determine status color and text based on autonomy thresholds
  let statusBadgeColor = 'bg-emerald-500/10 text-emerald-400 ring-emerald-500/30';
  let statusText = 'Optimal Autonomy';

  if (autonomyDays < 7) {
    statusBadgeColor = 'bg-rose-500/10 text-rose-400 ring-rose-500/30';
    statusText = 'Critical (< 7 Days)';
  } else if (autonomyDays < 15) {
    statusBadgeColor = 'bg-amber-500/10 text-amber-400 ring-amber-500/30';
    statusText = 'Caution (7-14 Days)';
  }

  return (
    <div className="rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800/90 p-5 shadow-xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <div className="rounded-lg bg-cyan-500/10 p-2 text-cyan-400 ring-1 ring-cyan-500/20">
            <Clock className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-cyan-400">
              Reserve Telemetry
            </span>
            <h3 className="text-sm font-bold text-white">Water Autonomy in Days</h3>
          </div>
        </div>

        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${statusBadgeColor}`}
        >
          {statusText}
        </span>
      </div>

      {/* Primary Autonomy Metric */}
      <div className="mt-4 flex items-baseline space-x-2">
        <span className="text-4xl font-extrabold tracking-tight text-white">
          {autonomyDays >= INDEFINITE_AUTONOMY_DAYS ? '> 999' : autonomyDays.toFixed(1)}
        </span>
        <span className="text-lg font-medium text-slate-400">Days</span>
      </div>
      <p className="mt-1 text-xs text-slate-400">
        Estimated operational duration without external replenishment under current demand.
      </p>

      {/* Auxiliary Metrics Grid */}
      <div className="mt-4 grid grid-cols-2 gap-3 border-t border-slate-800/80 pt-3 text-xs">
        <div className="flex items-center space-x-2 rounded-xl bg-slate-950/40 p-2.5">
          <Droplets className="h-4 w-4 text-cyan-400 flex-shrink-0" aria-hidden="true" />
          <div className="truncate">
            <span className="text-slate-400">Total Stored:</span>
            <p className="font-bold text-white">{totalStoredVolume.toFixed(1)} m³ stored</p>
          </div>
        </div>

        <div className="flex items-center space-x-2 rounded-xl bg-slate-950/40 p-2.5">
          <ArrowDownRight className="h-4 w-4 text-rose-400 flex-shrink-0" aria-hidden="true" />
          <div className="truncate">
            <span className="text-slate-400">Daily Demand:</span>
            <p className="font-bold text-white">{totalConsumption.toFixed(1)} m³/day</p>
          </div>
        </div>
      </div>
    </div>
  );
}

