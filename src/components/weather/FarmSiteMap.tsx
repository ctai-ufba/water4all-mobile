/**
 * @file FarmSiteMap.tsx
 * @summary Leaflet map of the active farm's site, with the precipitation radar overlay.
 * @description Centres on the farm whose physics the Weather view is reporting, pins that site
 * alone, and lays the latest RainViewer radar composite over it. Zoom and panning belong to the
 * operator; a control returns the view to the farm once they have moved it.
 *
 * @remarks An earlier design held both farm sites in one locked frame and used the pins as the
 * farm selector. Both were dropped (ADR 0005, correction of 2026-09-22): the header already
 * carries a farm switcher reachable from every tab, and at the zoom that fitted Andalusia and
 * Crete together, both pins fell outside the frame on a narrow phone.
 */

import React, { useCallback, useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { AlertTriangle, Crosshair, Radar } from 'lucide-react';
import { FarmProfile } from '../../types/farm';
import { RadarAvailability, RadarFrame, RadarUnavailableReason } from '../../types/radar';
import { buildRadarTileUrlTemplate, selectLatestFrame } from '../../services/radarService';

/** OpenStreetMap Foundation raster tile endpoint. */
export const OSM_TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

/**
 * Zoom the site opens at, and returns to when recentred.
 *
 * @remarks Pinned to `RADAR_MAX_NATIVE_ZOOM`: the most detailed view whose radar tiles are real
 * data, so the screen opens showing the best composite that exists rather than an upscaled one.
 * A regional frame also suits what radar is for, since rain arrives from outside the farm.
 */
export const SITE_ZOOM = 7;

/** Widest view the operator can zoom out to: the farm's region within the Mediterranean. */
export const MIN_ZOOM = 4;

/** Closest view the operator can zoom in to, where base tiles still carry street detail. */
export const MAX_ZOOM = 15;

/**
 * Deepest zoom RainViewer serves radar for.
 *
 * @remarks Measured against the live host, not assumed. At z7 Antequera and Heraklion return
 * different payloads (4713 and 2526 bytes), which is real data. At z8 and z9 both locations return
 * the *byte-identical* 1370-byte image (md5 `2cc6649e...`): a fixed placeholder reading "zoom level
 * not supported", which the map would otherwise tile across the farm.
 *
 * Leaflet is told to stop requesting past this level and upscale the z7 composite locally. That is
 * what keeps the placeholder off the map at any zoom the operator chooses, so the cap belongs here
 * rather than on `MAX_ZOOM`: the base map is free to keep sharpening.
 */
export const RADAR_MAX_NATIVE_ZOOM = 7;

/** Opacity of the radar overlay, low enough to keep coastlines legible underneath. */
export const RADAR_LAYER_OPACITY = 0.65;

/** Props for the FarmSiteMap component. */
export interface FarmSiteMapProps {
  /** The farm whose site is mapped; changing it recentres the map */
  farm: FarmProfile;
  /** Radar availability, or null while the first check is still in flight */
  radar: RadarAvailability | null;
}

/** What to tell the operator for each way radar can be unavailable. */
const RADAR_UNAVAILABLE_TEXT: Record<RadarUnavailableReason, string> = {
  offline: 'Radar unavailable: this device is offline. The base map is shown without an overlay.',
  'request-failed':
    'Radar unavailable: RainViewer could not be reached. The base map is shown without an overlay.',
  'no-frames':
    'Radar unavailable: RainViewer has published no recent composites. The base map is shown without an overlay.',
};

/** What the map can currently say about radar. */
type RadarStatus =
  /** The first availability check has not settled yet */
  | { kind: 'checking' }
  /** A composite is available and is the one drawn */
  | { kind: 'showing'; frame: RadarFrame }
  /** Nothing can be drawn, for a reason the operator is told */
  | { kind: 'unavailable'; reason: RadarUnavailableReason };

/**
 * Reduces radar availability to the one thing the map should say and draw.
 *
 * @summary Resolve radar status.
 * @description Collapses "not checked yet", "available with a frame" and every flavour of
 * unavailable into a single value the overlay effect and the status line both read.
 *
 * @param radar - Availability as reported by the service, or null before the first check settles.
 * @returns The status to render and to tile from.
 * @throws Never throws.
 *
 * @remarks An availability that reports `available` but carries no usable frame resolves to
 * `no-frames`, rather than to a branch that draws nothing and says a composite is showing. The
 * service never produces that combination today; the type permits it, and a UI that would lie if
 * it ever occurred is a UI that has to be re-checked every time the service changes.
 */
function resolveRadarStatus(radar: RadarAvailability | null): RadarStatus {
  if (radar === null) {
    return { kind: 'checking' };
  }
  if (!radar.available) {
    return { kind: 'unavailable', reason: radar.reason };
  }
  const frame = selectLatestFrame(radar.frames);
  return frame ? { kind: 'showing', frame } : { kind: 'unavailable', reason: 'no-frames' };
}

/**
 * Builds the marker glyph for the site.
 *
 * @summary Build the site marker icon.
 * @description Produces a dot and a name chip for the farm's coordinates.
 *
 * @param label - Farm name rendered beside the pin.
 * @returns A Leaflet DivIcon for the marker.
 * @throws Never throws.
 *
 * @remarks A `divIcon` rather than Leaflet's default marker, whose bundled PNG URL breaks under a
 * bundler. The marker is non-interactive: it marks a place, and selecting a farm is the header's
 * job, so it must not present itself as a control.
 */
function buildSiteIcon(label: string): L.DivIcon {
  return L.divIcon({
    className: 'w4a-site-marker',
    html:
      '<span class="flex flex-col items-center leading-none">' +
      '<span class="h-3.5 w-3.5 rounded-full bg-cyan-400 ring-4 ring-cyan-400/30"></span>' +
      `<span class="mt-1 rounded-md bg-cyan-500/90 px-1.5 py-0.5 text-[10px] font-semibold text-slate-950 shadow">${label}</span>` +
      '</span>',
    iconSize: [88, 34],
    iconAnchor: [44, 8],
  });
}

/**
 * Map of the active farm's site.
 *
 * @summary Farm site map.
 * @description Creates the Leaflet map once, recentres and re-pins it when the active farm
 * changes, and attaches or removes the radar tile layer as availability changes. When radar is
 * unavailable the base map still renders and the reason is stated beneath it.
 *
 * @param props - The farm to map and the current radar availability.
 * @returns React.JSX.Element containing the map, its recentre control and its radar status line.
 * @throws Never throws.
 */
export function FarmSiteMap({ farm, radar }: FarmSiteMapProps): React.JSX.Element {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const radarLayerRef = useRef<L.TileLayer | null>(null);

  const siteCentre: L.LatLngTuple = [farm.coordinates.latitude, farm.coordinates.longitude];
  const [latitude, longitude] = siteCentre;

  /** Returns the view to the farm after the operator has panned or zoomed away from it. */
  const recentreOnFarm = useCallback(() => {
    mapRef.current?.setView([latitude, longitude], SITE_ZOOM);
  }, [latitude, longitude]);

  // Create the map once. Zoom and panning are left on: the operator asked for the freedom, and the
  // recentre control below is what makes it safe to wander.
  useEffect(() => {
    if (!containerRef.current || mapRef.current) {
      return;
    }

    const map = L.map(containerRef.current, {
      center: [latitude, longitude],
      zoom: SITE_ZOOM,
      minZoom: MIN_ZOOM,
      maxZoom: MAX_ZOOM,
      zoomControl: true,
      // Credit for tiles, radar and weather data sits in the application shell footer, where it is
      // visible on every tab; Leaflet's own control would repeat it over a small map.
      attributionControl: false,
    });

    L.tileLayer(OSM_TILE_URL, { maxZoom: MAX_ZOOM }).addTo(map);
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      radarLayerRef.current = null;
      markerRef.current = null;
    };
    // Coordinates are read once to place the initial view; the effect below follows farm changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Follow the active farm: re-pin the site and bring the view back to it.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) {
      return;
    }

    markerRef.current?.remove();
    markerRef.current = L.marker([latitude, longitude], {
      icon: buildSiteIcon(farm.name),
      title: `${farm.estateName} - ${farm.location}`,
      alt: farm.name,
      interactive: false,
      keyboard: false,
    }).addTo(map);

    map.setView([latitude, longitude], SITE_ZOOM);
  }, [farm.name, farm.estateName, farm.location, latitude, longitude]);

  // Attach, replace or drop the radar overlay as availability changes.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) {
      return;
    }

    if (radarLayerRef.current) {
      radarLayerRef.current.remove();
      radarLayerRef.current = null;
    }

    const status = resolveRadarStatus(radar);
    if (status.kind !== 'showing' || !radar?.available) {
      return;
    }

    radarLayerRef.current = L.tileLayer(buildRadarTileUrlTemplate(radar.host, status.frame), {
      opacity: RADAR_LAYER_OPACITY,
      maxZoom: MAX_ZOOM,
      maxNativeZoom: RADAR_MAX_NATIVE_ZOOM,
    }).addTo(map);
  }, [radar]);

  const status = resolveRadarStatus(radar);

  return (
    /*
      `isolate` is load-bearing, not cosmetic. Leaflet numbers its own layers from 400 (panes) to
      1000 (controls), while this application's chrome tops out at z-50: the header and its farm
      switcher, the bottom navigation, the demo drawer and the modals would all render *underneath*
      the map, which is how this was found. Isolating the wrapper confines Leaflet's scale to a
      stacking context of its own, so the whole map participates in the page as a single layer and
      anything with a positive z-index sits above it. Raising every overlay in the app past 1000
      would have been the same fix applied in eight places, and would break again on the next one.
    */
    <div className="isolate overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 shadow-xl">
      <div className="relative">
        <div
          ref={containerRef}
          data-testid="farm-site-map"
          role="application"
          aria-label={`Map of ${farm.estateName} with precipitation radar`}
          className="h-60 w-full bg-slate-800"
        />

        <button
          type="button"
          onClick={recentreOnFarm}
          aria-label={`Recentre map on ${farm.estateName}`}
          // Above Leaflet's own controls (1000) inside the isolated context; the wrapper keeps
          // that number from competing with anything outside the map.
          className="absolute right-2 top-2 z-[1001] flex items-center gap-1 rounded-lg bg-slate-900/90 px-2 py-1.5 text-[10px] font-semibold text-slate-200 shadow ring-1 ring-slate-700 transition hover:bg-slate-800 hover:text-white"
        >
          <Crosshair className="h-3.5 w-3.5 text-cyan-400" aria-hidden="true" />
          <span>Recentre</span>
        </button>
      </div>

      <div className="border-t border-slate-800/80 px-3 py-2">
        {status.kind === 'checking' ? (
          <p data-testid="radar-status" className="text-[11px] text-slate-400">
            Checking radar coverage...
          </p>
        ) : status.kind === 'showing' ? (
          <p
            data-testid="radar-status"
            className="flex items-start gap-1.5 text-[11px] text-slate-300"
          >
            <Radar className="mt-px h-3.5 w-3.5 shrink-0 text-sky-400" aria-hidden="true" />
            <span>
              Radar composite observed at{' '}
              <span className="font-semibold text-white">
                {new Date(status.frame.timeEpochSeconds * 1000).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
              .{' '}
              {/*
                The overlay's own blankness cannot carry this. Outside its coverage RainViewer
                answers 200 with a transparent tile, exactly as it does where there is no rain, so
                no error path and no pixel distinguishes the two. Centred on one site, a blank
                overlay is the ordinary view, which makes saying so out loud the only honest option.
              */}
              <span className="text-slate-400">
                An area with no echoes means no rain detected or no radar coverage there; the two
                look identical.
              </span>
            </span>
          </p>
        ) : (
          <p
            data-testid="radar-status"
            role="status"
            className="flex items-start gap-1.5 text-[11px] text-amber-400"
          >
            <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>{RADAR_UNAVAILABLE_TEXT[status.reason]}</span>
          </p>
        )}

        <p className="mt-1 text-[10px] text-slate-500">
          Zoom and pan freely; radar detail stops improving beyond the opening view. Change farm
          from the profile switcher in the header.
        </p>
      </div>
    </div>
  );
}
