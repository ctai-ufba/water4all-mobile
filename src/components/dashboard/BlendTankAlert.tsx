/**
 * @file BlendTankAlert.tsx
 * @summary Warning alert banner for Blend tank minimum volume breaches.
 * @description Displays a prominent, high-contrast alert when the central Blend tank
 * volume drops below the profile's minimum operating volume threshold.
 */

import React from 'react';
import { AlertTriangle } from 'lucide-react';

/**
 * Props for the BlendTankAlert component.
 */
export interface BlendTankAlertProps {
  /** Current volume in the Blend tank in m³ */
  currentVolume: number;
  /** Minimum operating volume threshold in m³ */
  minOperatingVolume: number;
  /** Deficit volume below threshold in m³ */
  deficitM3: number;
}

/**
 * Visual warning banner component for low Blend tank reserves.
 *
 * @summary Blend tank breach alert banner.
 * @description Renders a high-visibility warning notification indicating that water
 * reserves have dropped below the minimum operating volume, specifying the current
 * volume and the deficit required to restore safe operations.
 *
 * @param props - Component props containing currentVolume, minOperatingVolume, and deficitM3.
 * @returns React.JSX.Element representing the warning banner.
 * @throws Never throws.
 */
export function BlendTankAlert({
  currentVolume,
  minOperatingVolume,
  deficitM3,
}: BlendTankAlertProps): React.JSX.Element {
  return (
    <div
      role="alert"
      className="flex items-start space-x-3 rounded-2xl border border-rose-500/40 bg-rose-950/40 p-4 text-rose-200 shadow-lg backdrop-blur-sm"
    >
      <div className="flex-shrink-0 pt-0.5">
        <AlertTriangle className="h-5 w-5 text-rose-400 animate-pulse" aria-hidden="true" />
      </div>
      <div className="flex-1 text-xs">
        <h4 className="font-bold uppercase tracking-wider text-rose-300">
          Critical Water Alert
        </h4>
        <p className="mt-1 leading-relaxed text-rose-100">
          Blend tank volume ({currentVolume.toFixed(1)} m³) is below minimum operating volume ({minOperatingVolume.toFixed(1)} m³).
          Depleted by {deficitM3.toFixed(1)} m³. Immediate replenishment required to avoid irrigation interruption!
        </p>
      </div>
    </div>
  );
}

