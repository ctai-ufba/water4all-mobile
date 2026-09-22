/**
 * @file useRadarFrames.ts
 * @summary React hook supplying the current RainViewer radar availability.
 * @description Asks RainViewer what composites it has published, refreshes on an interval, and
 * reports the answer as a `RadarAvailability`. The hook never throws and never leaves the caller
 * guessing: before the first answer arrives it returns `null`, which the map renders as "checking",
 * distinct from a definite "unavailable".
 *
 * @example
 * ```tsx
 * const radar = useRadarFrames();
 * if (radar === null) return <p>Checking radar coverage...</p>;
 * if (!radar.available) return <p>Radar unavailable ({radar.reason}).</p>;
 * ```
 */

import { useEffect, useState } from 'react';
import { RadarAvailability } from '../../types/radar';
import { fetchRadarFrames } from '../../services/radarService';

/**
 * How often radar availability is re-checked while the Weather view stays open.
 *
 * @remarks RainViewer publishes a new composite roughly every ten minutes, so polling faster
 * re-fetches the same index. Without any poll, a session left open would keep tiling a frame that
 * ages out of the host's cache and starts returning blanks.
 */
export const RADAR_REFRESH_INTERVAL_MS = 10 * 60 * 1000;

/**
 * Tracks published radar frames for as long as the component is mounted.
 *
 * @summary Radar availability hook.
 * @description Fetches once on mount, then on `RADAR_REFRESH_INTERVAL_MS`, discarding results that
 * arrive after unmount.
 *
 * @param refreshIntervalMs - Poll interval in milliseconds (defaults to RADAR_REFRESH_INTERVAL_MS).
 * @returns The latest RadarAvailability, or null until the first request settles.
 * @throws Never throws; failures surface as an unavailable result.
 */
export function useRadarFrames(
  refreshIntervalMs: number = RADAR_REFRESH_INTERVAL_MS
): RadarAvailability | null {
  const [radar, setRadar] = useState<RadarAvailability | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async (): Promise<void> => {
      const result = await fetchRadarFrames();
      if (!cancelled) {
        setRadar(result);
      }
    };

    load();
    const intervalId = setInterval(load, refreshIntervalMs);

    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, [refreshIntervalMs]);

  return radar;
}
