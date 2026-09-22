/**
 * @file NetworkStatusBanner.tsx
 * @summary Offline mode indicator strip.
 * @description Tells the operator when the device has lost connectivity and what the app is
 * showing instead, which on a rural farm is the difference between "the readings are stale" and
 * "the farm is fine". Renders nothing while online: a permanent connectivity badge would be
 * noise on a screen whose job is water figures.
 */

import React from 'react';
import { WifiOff } from 'lucide-react';
import { usePwa } from '../../context/PwaContext';

/**
 * Network status indicator component.
 *
 * @summary Offline mode banner.
 * @description Displays an amber strip while the device reports no connection, naming the two
 * consequences the operator needs to know: stored telemetry stays live because it is computed on
 * the device, while weather falls back to the synthetic series built from climate normals.
 *
 * @returns React.JSX.Element with the banner while offline, or null while online.
 * @throws Never throws.
 */
export function NetworkStatusBanner(): React.JSX.Element | null {
  const { isOnline } = usePwa();

  if (isOnline) {
    return null;
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-center gap-2 border-b border-amber-500/30 bg-amber-950/40 px-4 py-2 text-[11px] text-amber-200"
    >
      <WifiOff className="h-3.5 w-3.5 shrink-0 text-amber-400" aria-hidden="true" />
      <span>
        <span className="font-semibold">Offline mode.</span> Tank telemetry and controls stay
        live on this device; weather falls back to seasonal climate normals until the connection
        returns.
      </span>
    </div>
  );
}
