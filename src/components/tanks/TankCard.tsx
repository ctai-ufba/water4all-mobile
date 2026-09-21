/**
 * @file TankCard.tsx
 * @summary Visual card component representing an individual farm water reservoir.
 * @description Renders tank capacity, current volume, fill percentage, animated fluid
 * level meter, active source flow indicator, and color-coded threshold alerts.
 */

import React from 'react';
import {
  calculateTankFillPercentage,
  getTankAlertLevel,
  getTankSourceStatus,
  TankType,
  TankAlertLevel,
} from '../../domain/tankStatusEngine';
import { ShieldAlert, Target, ArrowDownRight, ArrowUpRight } from 'lucide-react';

/**
 * Props for the TankCard component.
 */
export interface TankCardProps {
  /** Tank identifier type */
  tankType: TankType;
  /** Display title for the tank (e.g. 'Rainwater Catchment') */
  title: string;
  /** Subtitle or engineering role description */
  subtitle: string;
  /** Lucide icon component representing the tank asset */
  icon: React.ComponentType<{ className?: string }>;
  /** Current volume in cubic meters (m³) */
  currentVolume: number;
  /** Total physical storage capacity in cubic meters (m³) */
  capacity: number;
  /** Active daily flow rate in m³/day (inflow for sources, outflow for blend) */
  flowRate: number;
  /** Whether the flow represents an outflow (true for blend tank distribution) */
  isOutflow?: boolean;
  /** Optional target volume setpoint in m³ (for blend tank) */
  targetVolume?: number;
  /** Optional minimum operating volume threshold in m³ (for blend tank) */
  minOperatingVolume?: number;
  /** Optional precomputed alert level to avoid duplicate evaluation */
  alertLevel?: TankAlertLevel;
}

/**
 * Visual card component for an individual water storage tank.
 *
 * @summary Tank asset card with liquid level gauge.
 * @description Provides a comprehensive operational view for a single reservoir,
 * rendering liquid fill level, capacity metrics, active flow indicators, and alerts.
 *
 * @param props - Component props containing tank metrics and thresholds.
 * @returns React.JSX.Element representing the tank card.
 * @throws Never throws.
 */
export function TankCard({
  tankType,
  title,
  subtitle,
  icon: Icon,
  currentVolume,
  capacity,
  flowRate,
  isOutflow = false,
  targetVolume,
  minOperatingVolume,
  alertLevel,
}: TankCardProps): React.JSX.Element {
  // Calculate fill percentage clamped between 0% and 100%
  const fillPercentage = calculateTankFillPercentage(currentVolume, capacity);

  // Evaluate alert level based on current volume and specific thresholds (or reuse precomputed prop)
  const effectiveAlertLevel =
    alertLevel ?? getTankAlertLevel(tankType, currentVolume, capacity, minOperatingVolume);

  // Retrieve active source status and badge formatting
  const sourceStatus = getTankSourceStatus(tankType, flowRate, currentVolume);

  // Determine fluid bar gradient based on alert severity
  let barGradient = 'from-cyan-500 to-emerald-400';
  let badgeClasses = 'bg-cyan-500/10 text-cyan-400 ring-cyan-500/20';

  if (effectiveAlertLevel === 'critical') {
    barGradient = 'from-rose-600 to-rose-400';
    badgeClasses = 'bg-rose-500/10 text-rose-400 ring-rose-500/20';
  } else if (effectiveAlertLevel === 'warning') {
    barGradient = 'from-amber-500 to-yellow-400';
    badgeClasses = 'bg-amber-500/10 text-amber-400 ring-amber-500/20';
  } else if (sourceStatus.badgeVariant === 'emerald') {
    badgeClasses = 'bg-emerald-500/10 text-emerald-400 ring-emerald-500/20';
  } else if (sourceStatus.badgeVariant === 'slate') {
    badgeClasses = 'bg-slate-800 text-slate-400 ring-slate-700';
  }

  // Calculate percentage positions for target and min operating threshold markers (for Blend tank)
  const targetPercentage =
    targetVolume !== undefined ? calculateTankFillPercentage(targetVolume, capacity) : null;
  const minOperatingPercentage =
    minOperatingVolume !== undefined
      ? calculateTankFillPercentage(minOperatingVolume, capacity)
      : null;

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 shadow-xl transition-all hover:border-slate-700/80">
      {/* Tank Header: Icon, Names, and Source Status Badge */}
      <div className="flex items-start justify-between">
        <div className="flex items-center space-x-3">
          <div className="rounded-xl bg-slate-800/80 p-2.5 text-cyan-400 ring-1 ring-slate-700/50">
            <Icon className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              {subtitle}
            </span>
            <h3 className="text-sm font-bold text-white leading-tight">{title}</h3>
          </div>
        </div>

        {/* Source Activity Badge */}
        <span
          className={`flex items-center space-x-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium ring-1 ${badgeClasses}`}
        >
          {sourceStatus.isActive && (
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-current opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-current" />
            </span>
          )}
          <span>{sourceStatus.statusText}</span>
        </span>
      </div>

      {/* Volume Summary Display */}
      <div className="mt-4 flex items-baseline justify-between">
        <div>
          <span className="text-2xl font-extrabold text-white">
            {currentVolume.toFixed(1)} m³
          </span>
          <span className="ml-1.5 text-xs text-slate-400">
            / {capacity.toFixed(1)} m³
          </span>
        </div>
        <span className="text-sm font-bold text-slate-300">
          {fillPercentage.toFixed(1)}%
        </span>
      </div>

      {/* Visual Liquid Level Indicator Bar */}
      <div className="relative mt-2.5 h-5 w-full overflow-hidden rounded-lg bg-slate-950 ring-1 ring-slate-800">
        {/* Animated fluid fill bar */}
        <div
          className={`h-full bg-gradient-to-r ${barGradient} transition-all duration-700 ease-out`}
          style={{ width: `${fillPercentage}%` }}
        />

        {/* Optional Target Volume Marker for Blend Tank */}
        {targetPercentage !== null && (
          <div
            className="absolute top-0 bottom-0 z-10 w-0.5 bg-cyan-300 shadow-[0_0_8px_rgba(103,232,249,0.8)]"
            style={{ left: `${targetPercentage}%` }}
            title={`Target Volume: ${targetVolume?.toFixed(1)} m³`}
          />
        )}

        {/* Optional Minimum Operating Volume Marker for Blend Tank */}
        {minOperatingPercentage !== null && (
          <div
            className="absolute top-0 bottom-0 z-10 w-0.5 bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.8)]"
            style={{ left: `${minOperatingPercentage}%` }}
            title={`Min Operating Volume: ${minOperatingVolume?.toFixed(1)} m³`}
          />
        )}
      </div>

      {/* Threshold Markers for Blend Tank */}
      {(targetVolume !== undefined || minOperatingVolume !== undefined) && (
        <div className="mt-2 flex items-center justify-between text-[11px]">
          {minOperatingVolume !== undefined && (
            <div className="flex items-center space-x-1 text-rose-400">
              <ShieldAlert className="h-3 w-3 flex-shrink-0" aria-hidden="true" />
              <span>Min Operating: {minOperatingVolume.toFixed(1)} m³</span>
            </div>
          )}
          {targetVolume !== undefined && (
            <div className="flex items-center space-x-1 text-cyan-300">
              <Target className="h-3 w-3 flex-shrink-0" aria-hidden="true" />
              <span>Target: {targetVolume.toFixed(1)} m³</span>
            </div>
          )}
        </div>
      )}

      {/* Operational Flow & Status Description Footer */}
      <div className="mt-3 flex items-center justify-between border-t border-slate-800/80 pt-2.5 text-xs">
        <p className="text-slate-400 text-[11px] leading-tight">
          {sourceStatus.description}
        </p>

        <div className="flex items-center space-x-1 font-semibold text-slate-300 flex-shrink-0 ml-2">
          {isOutflow ? (
            <>
              <ArrowDownRight className="h-3.5 w-3.5 text-amber-400" />
              <span className="text-amber-300">-{flowRate.toFixed(1)} m³/d</span>
            </>
          ) : (
            <>
              <ArrowUpRight className={`h-3.5 w-3.5 ${flowRate > 0 ? 'text-emerald-400' : 'text-slate-500'}`} />
              <span className={flowRate > 0 ? 'text-emerald-400' : 'text-slate-400'}>
                +{flowRate.toFixed(1)} m³/d
              </span>
            </>
          )}
        </div>
      </div>

      {/* Critical Alert Warning Box (Rendered when tank is depleted or critically low) */}
      {effectiveAlertLevel === 'critical' && (
        <div className="mt-3 rounded-xl border border-rose-500/30 bg-rose-500/10 p-2.5 text-xs text-rose-300">
          <div className="flex items-center space-x-2">
            <ShieldAlert className="h-4 w-4 text-rose-400 flex-shrink-0" />
            <span className="font-semibold">
              {currentVolume <= 0
                ? 'Storage Depleted: Tank is empty.'
                : 'Critically Low: Volume below safety threshold.'}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

