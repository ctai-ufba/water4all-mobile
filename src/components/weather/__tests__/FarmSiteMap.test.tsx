/**
 * @file FarmSiteMap.test.tsx
 * @summary Unit tests for the active farm's site map.
 * @description Verifies that only the active farm is pinned, that the operator's zoom and pan are
 * left free within a stated range and recoverable through the recentre control, that the radar
 * overlay stops requesting tiles past its native resolution, and that an unavailable or blank
 * radar is always explained rather than left to be read as "no rain".
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import L from 'leaflet';
import {
  FarmSiteMap,
  MAX_ZOOM,
  MIN_ZOOM,
  OSM_TILE_URL,
  RADAR_MAX_NATIVE_ZOOM,
  SITE_ZOOM,
} from '../FarmSiteMap';
import { FARM_PROFILES } from '../../../types/farm';
import { RadarAvailability } from '../../../types/radar';

describe('FarmSiteMap Seam', () => {
  const smallFarm = FARM_PROFILES['small-farm'];
  const mediumFarm = FARM_PROFILES['medium-farm'];

  const availableRadar: RadarAvailability = {
    available: true,
    host: 'https://tilecache.rainviewer.com',
    frames: [
      { timeEpochSeconds: 1790103000, path: '/v2/radar/older' },
      { timeEpochSeconds: 1790104800, path: '/v2/radar/newest' },
    ],
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('confines Leaflet layering so app chrome is never covered by the map', () => {
    // Leaflet numbers its layers 400 to 1000 and this app's chrome tops out at z-50, so without a
    // stacking context of its own the map paints over the header's farm switcher, the bottom
    // navigation and every modal. jsdom does not compute stacking, so the class is the guard: it
    // carries behaviour here, and removing it silently reintroduces the defect.
    const { container } = render(<FarmSiteMap farm={smallFarm} radar={null} />);

    expect(container.firstElementChild).toHaveClass('isolate');
  });

  it('never opens on a zoom whose radar tiles the host will not serve', () => {
    // Past RADAR_MAX_NATIVE_ZOOM, RainViewer answers every location with one byte-identical
    // placeholder reading "zoom level not supported". Opening deeper than the radar reaches tiles
    // that message across the farm, which is exactly how this was found: by using the app.
    expect(SITE_ZOOM).toBeLessThanOrEqual(RADAR_MAX_NATIVE_ZOOM);
  });

  it('centres on the active farm at the site zoom', () => {
    const mapSpy = vi.spyOn(L, 'map');

    render(<FarmSiteMap farm={smallFarm} radar={null} />);

    const options = mapSpy.mock.calls[0][1];
    expect(options?.center).toEqual([
      smallFarm.coordinates.latitude,
      smallFarm.coordinates.longitude,
    ]);
    expect(options?.zoom).toBe(SITE_ZOOM);
  });

  it('pins the active farm and no other site', () => {
    const markerSpy = vi.spyOn(L, 'marker');

    render(<FarmSiteMap farm={smallFarm} radar={null} />);

    expect(markerSpy).toHaveBeenCalledTimes(1);
    expect(markerSpy.mock.calls[0][0]).toEqual([
      smallFarm.coordinates.latitude,
      smallFarm.coordinates.longitude,
    ]);
    expect(screen.queryByText(mediumFarm.name)).not.toBeInTheDocument();
  });

  it('leaves the pin as a marker rather than a control, since the header switches farm', () => {
    const markerSpy = vi.spyOn(L, 'marker');

    render(<FarmSiteMap farm={smallFarm} radar={null} />);

    expect(markerSpy.mock.calls[0][1]).toMatchObject({ interactive: false, keyboard: false });
    expect(screen.queryByRole('button', { name: new RegExp(smallFarm.name, 'i') })).toBeNull();
  });

  it('leaves zoom and panning to the operator within the stated range', () => {
    const mapSpy = vi.spyOn(L, 'map');

    render(<FarmSiteMap farm={smallFarm} radar={null} />);

    const options = mapSpy.mock.calls[0][1] ?? {};
    expect(options.minZoom).toBe(MIN_ZOOM);
    expect(options.maxZoom).toBe(MAX_ZOOM);
    expect(options.zoomControl).toBe(true);
    // Nothing is disabled: dragging, scroll wheel and touch zoom keep their Leaflet defaults.
    expect(options.dragging).toBeUndefined();
    expect(options.scrollWheelZoom).toBeUndefined();
    expect(options.touchZoom).toBeUndefined();
  });

  it('returns the view to the farm when the operator has moved it', () => {
    const setViewSpy = vi.spyOn(L.Map.prototype, 'setView');

    render(<FarmSiteMap farm={smallFarm} radar={null} />);
    setViewSpy.mockClear();

    fireEvent.click(screen.getByRole('button', { name: /recentre map on/i }));

    expect(setViewSpy).toHaveBeenCalledWith(
      [smallFarm.coordinates.latitude, smallFarm.coordinates.longitude],
      SITE_ZOOM
    );
  });

  it('follows the active farm when the header switches profile', () => {
    const setViewSpy = vi.spyOn(L.Map.prototype, 'setView');

    const { rerender } = render(<FarmSiteMap farm={smallFarm} radar={null} />);
    setViewSpy.mockClear();

    rerender(<FarmSiteMap farm={mediumFarm} radar={null} />);

    expect(setViewSpy).toHaveBeenCalledWith(
      [mediumFarm.coordinates.latitude, mediumFarm.coordinates.longitude],
      SITE_ZOOM
    );
  });

  it('renders OpenStreetMap base tiles across the whole zoom range', () => {
    const tileLayerSpy = vi.spyOn(L, 'tileLayer');

    render(<FarmSiteMap farm={smallFarm} radar={null} />);

    expect(tileLayerSpy).toHaveBeenCalledWith(OSM_TILE_URL, { maxZoom: MAX_ZOOM });
  });

  it('tiles radar from the newest composite and stops requesting past its native resolution', () => {
    const tileLayerSpy = vi.spyOn(L, 'tileLayer');

    render(<FarmSiteMap farm={smallFarm} radar={availableRadar} />);

    const radarCall = tileLayerSpy.mock.calls.find((call) =>
      String(call[0]).includes('tilecache.rainviewer.com')
    );
    expect(radarCall).toBeDefined();
    expect(String(radarCall?.[0])).toContain('/v2/radar/newest/256/{z}/{x}/{y}/2/1_1.png');
    // Past this zoom RainViewer returns the same composite upsampled, so Leaflet upscales locally
    // instead of asking the host for tiles that carry no more information.
    expect(radarCall?.[1]).toMatchObject({ maxNativeZoom: RADAR_MAX_NATIVE_ZOOM });
  });

  it('says that a blank overlay may be absent coverage rather than absent rain', () => {
    render(<FarmSiteMap farm={smallFarm} radar={availableRadar} />);

    const status = screen.getByTestId('radar-status');
    expect(status).toHaveTextContent(/Radar composite observed at/i);
    // Outside coverage RainViewer answers 200 with a transparent tile, exactly as it does where
    // there is no rain, so the overlay itself cannot carry this distinction.
    expect(status).toHaveTextContent(/no rain detected or no radar coverage/i);
  });

  it('states that radar is unavailable while still rendering the base map', () => {
    const tileLayerSpy = vi.spyOn(L, 'tileLayer');

    render(<FarmSiteMap farm={smallFarm} radar={{ available: false, reason: 'no-frames' }} />);

    expect(tileLayerSpy).toHaveBeenCalledWith(OSM_TILE_URL, { maxZoom: MAX_ZOOM });
    expect(tileLayerSpy.mock.calls.some((call) => String(call[0]).includes('rainviewer'))).toBe(
      false
    );
    expect(screen.getByTestId('radar-status')).toHaveTextContent(/no recent composites/i);
    expect(screen.getByTestId('farm-site-map')).toBeInTheDocument();
  });

  it('names the reason when the device is offline', () => {
    render(<FarmSiteMap farm={smallFarm} radar={{ available: false, reason: 'offline' }} />);

    expect(screen.getByTestId('radar-status')).toHaveTextContent(/offline/i);
  });

  it('names the reason when RainViewer could not be reached', () => {
    render(<FarmSiteMap farm={smallFarm} radar={{ available: false, reason: 'request-failed' }} />);

    expect(screen.getByTestId('radar-status')).toHaveTextContent(/could not be reached/i);
  });

  it('explains an availability carrying no usable frame instead of claiming a composite', () => {
    // The service cannot produce this today, but the type admits it, and a status line that would
    // announce a composite it never drew is a lie waiting for the service to change.
    render(
      <FarmSiteMap
        farm={smallFarm}
        radar={{ available: true, host: 'https://tilecache.rainviewer.com', frames: [] }}
      />
    );

    const status = screen.getByTestId('radar-status');
    expect(status).toHaveTextContent(/Radar unavailable/i);
    expect(status).not.toHaveTextContent(/composite observed/i);
  });

  it('distinguishes a pending check from a definite absence of radar', () => {
    render(<FarmSiteMap farm={smallFarm} radar={null} />);

    const status = screen.getByTestId('radar-status');
    expect(status).toHaveTextContent(/Checking radar coverage/i);
    expect(status).not.toHaveTextContent(/unavailable/i);
  });
});
