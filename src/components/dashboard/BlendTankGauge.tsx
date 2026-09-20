/**
 * @file BlendTankGauge.tsx
 * @summary Visual gauge component for the central Blend tank.
 * @description Displays the current Blend tank volume in cubic meters (m³),
 * relative percentage of total tank capacity, target volume indicator,
 * and minimum operating volume threshold.
 */

import React from 'react';
import { Cylinder, Target, ShieldAlert } from 'lucide-react';
import { TankCapacities } from '../../types/farm';

/**
 * Props for the BlendTankGauge component.
 */
export interface BlendTankGaugeProps {
  /** Current water volume in the Blend tank in m³ */
  currentVolume: number;
  /** Tank capacity specifications for the active farm */
  tankCapacities: TankCapacities;
}

/**
 * Visual gauge component representing Blend tank state.
 *
 * @summary Blend tank visual gauge.
 * @description Renders a high-contrast visual meter showing current water level,
 * with visible threshold indicators for target volume and minimum operating volume.
 *
 * @param props - Component props containing currentVolume and tankCapacities.
 * @returns React.JSX.Element representing the Blend tank gauge.
 * @throws Never throws.
 */
export function BlendTankGauge({
  currentVolume,
  tankCapacities,
}: BlendTankGaugeProps): React.JSX.Element {
  const { blend: capacity, targetVolume, minOperatingVolume } = tankCapacities;

  // Calculate percentage fills safely, clamped between 0 and 100
  const fillPercentage = Math.min(100, Math.max(0, (currentVolume / capacity) * 100));
  const targetPercentage = Math.min(100, Math.max(0, (targetVolume / capacity) * 100));
  const minPercentage = Math.min(100, Math.max(0, (minOperatingVolume / capacity) * 100));

  // Determine fill bar color scheme based on volume thresholds
  const isBelowMin = currentVolume < minOperatingVolume;
  const isNearTarget = currentVolume >= targetVolume * 0.9;

  let barGradient = 'from-cyan-500 to-emerald-400';
  let statusTextColor = 'text-emerald-400';
  let statusText = 'Optimal Mixing Level';

  if (isBelowMin) {
    barGradient = 'from-rose-600 to-rose-400';
    statusTextColor = 'text-rose-400';
    statusText = 'Below Minimum Threshold';
  } else if (!isNearTarget) {
    barGradient = 'from-amber-500 to-cyan-400';
    statusTextColor = 'text-amber-400';
    statusText = 'Below Target Volume';
  }

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 shadow-xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <div className="rounded-lg bg-emerald-500/10 p-2 text-emerald-400 ring-1 ring-emerald-500/20">
            <Cylinder className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-emerald-400">
              Blend Tank
            </span>
            <h3 className="text-sm font-bold text-white">Blend Tank Gauge</h3>
          </div>
        </div>

        <span className={`text-xs font-semibold ${statusTextColor}`}>
          {statusText}
        </span>
      </div>

      {/* Volume Summary Display */}
      <div className="mt-4 flex items-baseline justify-between">
        <div>
          <span className="text-3xl font-extrabold text-white">
            {currentVolume.toFixed(1)} m³
          </span>
          <span className="ml-2 text-xs text-slate-400">
            / {capacity.toFixed(1)} m³ capacity
          </span>
        </div>
        <span className="text-sm font-bold text-slate-300">
          {fillPercentage.toFixed(1)}%
        </span>
      </div>

      {/* Visual Level Gauge Bar */}
      <div className="relative mt-3 h-7 w-full overflow-hidden rounded-xl bg-slate-950/80 ring-1 ring-slate-800">
        {/* Animated fluid fill */}
        <div
          className={`h-full bg-gradient-to-r ${barGradient} transition-all duration-700 ease-out`}
          style={{ width: `${fillPercentage}%` }}
        />

        {/* Target Volume Marker */}
        <div
          className="absolute top-0 bottom-0 z-10 w-0.5 bg-cyan-300 shadow-[0_0_8px_rgba(103,232,249,0.8)]"
          style={{ left: `${targetPercentage}%` }}
          title={`Target Volume: ${targetVolume.toFixed(1)} m³`}
        />

        {/* Minimum Operating Volume Marker */}
        <div
          className="absolute top-0 bottom-0 z-10 w-0.5 bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.8)]"
          style={{ left: `${minPercentage}%` }}
          title={`Min Operating Volume: ${minOperatingVolume.toFixed(1)} m³`}
        />
      </div>

      {/* Threshold Indicators & Legend */}
      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <div className="flex items-center space-x-1.5 text-rose-400">
          <ShieldAlert className="h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
          <span>Min Operating: {minOperatingVolume.toFixed(1)} m³</span>
        </div>

        <div className="flex items-center justify-end space-x-1.5 text-cyan-300">
          <Target className="h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
          <span>Target: {targetVolume.toFixed(1)} m³</span>
        </div>
      </div>
    </div>
  );
}

