/**
 * @file radar.ts
 * @summary Precipitation radar frame types for the RainViewer overlay.
 * @description Describes the radar frames advertised by RainViewer's public index and the
 * availability result the map renders from. Radar is a best-effort layer: coverage is not
 * guaranteed for Andalusia or Crete, so unavailability is a modelled state rather than an error.
 */

/** A single radar composite published by RainViewer. */
export interface RadarFrame {
  /** Observation time of the composite, in epoch seconds (UTC) */
  timeEpochSeconds: number;
  /** Host-relative tile path, e.g. `/v2/radar/75e3fe152318`; opaque and not derivable from time */
  path: string;
}

/** Why no radar overlay can be drawn. */
export type RadarUnavailableReason =
  /** The browser reports itself offline, so no request was attempted */
  | 'offline'
  /** The request failed, timed out, or returned an unusable payload */
  | 'request-failed'
  /** The index was read successfully but advertised no frames */
  | 'no-frames';

/** Radar frames are available and can be tiled. */
export interface RadarFramesAvailable {
  available: true;
  /** Tile host the frame paths hang off, e.g. `https://tilecache.rainviewer.com` */
  host: string;
  /** Published frames, oldest first, as RainViewer orders them */
  frames: RadarFrame[];
}

/** No radar frames are available, with the reason to state to the operator. */
export interface RadarFramesUnavailable {
  available: false;
  reason: RadarUnavailableReason;
}

/**
 * Outcome of asking RainViewer what it currently has.
 *
 * @remarks A discriminated union rather than a nullable frame list, because the map must say
 * *why* there is no overlay. A silently empty overlay reads as "no rain", which is a different
 * claim from "no radar".
 */
export type RadarAvailability = RadarFramesAvailable | RadarFramesUnavailable;
