/**
 * @file radarService.ts
 * @summary RainViewer precipitation radar index client.
 * @description Reads RainViewer's public, key-less index of published radar composites and turns
 * a frame into a Leaflet tile URL template. Used by the Weather view's site map to lay a rainfall
 * radar over the base map.
 *
 * ## Licensing
 *
 * RainViewer's terms read "This API is available for personal and educational use only", which is
 * narrower than Open-Meteo's non-commercial allowance. This project is funded research without
 * commercial purpose; the divergence is deliberate and recorded in ADR 0005.
 *
 * ## Availability
 *
 * Radar is best-effort. Per-country coverage for Spain and Greece is not verifiable from a primary
 * source, the index can advertise no frames at all, and the request can fail like any other. Every
 * one of those paths resolves to an `available: false` result carrying a reason, never a rejected
 * promise and never an empty overlay: an empty overlay reads as "no rain", which is a claim this
 * service cannot make.
 *
 * @example
 * ```ts
 * const radar = await fetchRadarFrames();
 * if (radar.available) {
 *   const frame = selectLatestFrame(radar.frames);          // newest composite
 *   const url = buildRadarTileUrlTemplate(radar.host, frame!); // '.../{z}/{x}/{y}/2/1_1.png'
 *   L.tileLayer(url, { opacity: 0.6 }).addTo(map);
 * } else {
 *   radar.reason; // 'offline' | 'request-failed' | 'no-frames' - state it, do not hide it
 * }
 * ```
 */

import { RadarAvailability, RadarFrame } from '../types/radar';
import { createTimeoutSignal } from './requestTimeout';

/** RainViewer's public index of currently published radar and satellite composites. */
export const RAINVIEWER_INDEX_URL = 'https://api.rainviewer.com/public/weather-maps.json';

/** Default radar index request timeout in milliseconds. */
export const DEFAULT_RADAR_TIMEOUT_MS = 8000;

/** Radar tile edge length in pixels; RainViewer serves 256 or 512. */
export const RADAR_TILE_SIZE_PX = 256;

/** RainViewer colour scheme index; 2 is the universal blue-to-red rainfall ramp. */
export const RADAR_COLOR_SCHEME = 2;

/**
 * RainViewer tile render options, as the `{smooth}_{snow}` pair its tile path expects.
 *
 * @remarks `1_1` smooths the radar composite and shades snow separately from rain. Smoothing
 * matters at the zoom this map is locked to, where a raw composite reads as blocky noise.
 */
export const RADAR_TILE_OPTIONS = '1_1';

/** Raw shape of the RainViewer index response. */
interface RainViewerIndexResponse {
  host?: string;
  radar?: {
    past?: Array<{ time?: number; path?: string }>;
    nowcast?: Array<{ time?: number; path?: string }>;
  };
}

/**
 * Builds the Leaflet tile URL template for one radar frame.
 *
 * @summary Build a radar tile URL template.
 * @description Assembles `{host}{path}/{size}/{z}/{x}/{y}/{color}/{options}.png`, leaving Leaflet's
 * `{z}/{x}/{y}` placeholders in place for the tile layer to substitute.
 *
 * @param host - Tile host from the index, e.g. `https://tilecache.rainviewer.com`.
 * @param frame - The frame to render, whose `path` is opaque and must come from the index.
 * @returns A tile URL template ready to hand to `L.tileLayer`.
 * @throws Never throws.
 */
export function buildRadarTileUrlTemplate(host: string, frame: RadarFrame): string {
  return (
    `${host}${frame.path}/${RADAR_TILE_SIZE_PX}` +
    `/{z}/{x}/{y}/${RADAR_COLOR_SCHEME}/${RADAR_TILE_OPTIONS}.png`
  );
}

/**
 * Picks the most recent composite from a frame list.
 *
 * @summary Select the latest radar frame.
 * @description Returns the frame with the greatest observation time, rather than trusting the
 * index's ordering, and null for an empty list.
 *
 * @param frames - Frames as returned by `fetchRadarFrames`.
 * @returns The newest frame, or null when there are none.
 * @throws Never throws.
 */
export function selectLatestFrame(frames: RadarFrame[]): RadarFrame | null {
  return frames.reduce<RadarFrame | null>(
    (latest, frame) =>
      latest === null || frame.timeEpochSeconds > latest.timeEpochSeconds ? frame : latest,
    null
  );
}

/**
 * Parses a RainViewer index payload into frames.
 *
 * @summary Parse the RainViewer index.
 * @description Keeps past observations and nowcast projections that carry both a finite time and a
 * path, discarding malformed entries rather than the whole payload.
 *
 * @param json - Raw JSON body from the index endpoint.
 * @param nowSeconds - Current time in epoch seconds, used to bound future frames.
 * @returns A RadarAvailability describing what can be drawn.
 * @throws Never throws.
 *
 * @remarks Frames stamped after `nowSeconds` are dropped, which is what keeps a forecast from being
 * presented as an observation: RainViewer's `nowcast` block is projection, and `selectLatestFrame`
 * would otherwise always prefer it over the newest real composite. The block is read at all rather
 * than ignored because its leading entries age into the past between index refreshes, and once a
 * frame's time has passed it describes observed rainfall like any other.
 */
export function parseRadarIndex(json: unknown, nowSeconds: number = Date.now() / 1000): RadarAvailability {
  if (!json || typeof json !== 'object') {
    return { available: false, reason: 'request-failed' };
  }

  const payload = json as RainViewerIndexResponse;
  const host = typeof payload.host === 'string' ? payload.host : null;
  if (!host) {
    return { available: false, reason: 'request-failed' };
  }

  const entries = [...(payload.radar?.past ?? []), ...(payload.radar?.nowcast ?? [])];
  const frames: RadarFrame[] = [];

  for (const entry of entries) {
    const time = entry?.time;
    const path = entry?.path;
    if (typeof time !== 'number' || !Number.isFinite(time) || typeof path !== 'string' || !path) {
      continue;
    }
    if (time > nowSeconds) {
      continue;
    }
    frames.push({ timeEpochSeconds: time, path });
  }

  if (frames.length === 0) {
    return { available: false, reason: 'no-frames' };
  }

  return { available: true, host, frames };
}

/**
 * Fetches the currently published radar frames from RainViewer.
 *
 * @summary Fetch radar frames.
 * @description Skips the request when the browser reports itself offline, applies a timeout, and
 * reports every failure as an unavailable result carrying its reason.
 *
 * @param timeoutMs - Request timeout in milliseconds (defaults to 8000 ms).
 * @returns Promise resolving to a RadarAvailability; never rejects.
 * @throws Never throws; always resolves.
 */
export async function fetchRadarFrames(
  timeoutMs: number = DEFAULT_RADAR_TIMEOUT_MS
): Promise<RadarAvailability> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return { available: false, reason: 'offline' };
  }

  const timeout = createTimeoutSignal(timeoutMs);

  try {
    const response = await fetch(RAINVIEWER_INDEX_URL, {
      ...(timeout.signal ? { signal: timeout.signal } : {}),
      headers: { Accept: 'application/json' },
    });

    if (!response.ok) {
      console.warn(`RainViewer returned status ${response.status}: ${response.statusText}`);
      return { available: false, reason: 'request-failed' };
    }

    return parseRadarIndex(await response.json());
  } catch (error) {
    console.warn('Radar frame fetch failed; the map will render without an overlay:', error);
    return { available: false, reason: 'request-failed' };
  } finally {
    timeout.cancel();
  }
}
