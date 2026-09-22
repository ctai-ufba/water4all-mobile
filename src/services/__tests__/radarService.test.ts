/**
 * @file radarService.test.ts
 * @summary Unit tests for the RainViewer radar index client.
 * @description Verifies index parsing, frame selection, tile URL construction, and that every
 * failure path resolves to a stated unavailable reason rather than throwing or returning an
 * empty-but-available overlay.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  RAINVIEWER_INDEX_URL,
  RADAR_COLOR_SCHEME,
  RADAR_TILE_OPTIONS,
  RADAR_TILE_SIZE_PX,
  buildRadarTileUrlTemplate,
  fetchRadarFrames,
  parseRadarIndex,
  selectLatestFrame,
} from '../radarService';

describe('Radar Service Seam', () => {
  const nowSeconds = 1790104824;

  /** Index payload shaped exactly as the live endpoint returns it. */
  const validIndex = {
    version: '2.0',
    generated: nowSeconds,
    host: 'https://tilecache.rainviewer.com',
    radar: {
      past: [
        { time: nowSeconds - 1200, path: '/v2/radar/2f37cd9ccdff' },
        { time: nowSeconds - 600, path: '/v2/radar/99cd374db51b' },
      ],
      nowcast: [{ time: nowSeconds + 600, path: '/v2/radar/75e3fe152318' }],
    },
    satellite: { infrared: [] },
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('parseRadarIndex', () => {
    it('reads the host and the published past frames', () => {
      const result = parseRadarIndex(validIndex, nowSeconds);

      expect(result.available).toBe(true);
      if (!result.available) return;
      expect(result.host).toBe('https://tilecache.rainviewer.com');
      expect(result.frames).toHaveLength(2);
      expect(result.frames[0]).toEqual({
        timeEpochSeconds: nowSeconds - 1200,
        path: '/v2/radar/2f37cd9ccdff',
      });
    });

    it('drops frames stamped in the future so a nowcast is never shown as an observation', () => {
      const result = parseRadarIndex(validIndex, nowSeconds);

      expect(result.available).toBe(true);
      if (!result.available) return;
      expect(result.frames.every((frame) => frame.timeEpochSeconds <= nowSeconds)).toBe(true);
    });

    it('discards malformed entries without discarding the payload', () => {
      const result = parseRadarIndex(
        {
          host: 'https://tilecache.rainviewer.com',
          radar: {
            past: [
              { time: nowSeconds - 600 },
              { path: '/v2/radar/abc' },
              { time: 'soon', path: '/v2/radar/def' },
              { time: nowSeconds - 300, path: '/v2/radar/ghi' },
            ],
          },
        },
        nowSeconds
      );

      expect(result.available).toBe(true);
      if (!result.available) return;
      expect(result.frames).toEqual([{ timeEpochSeconds: nowSeconds - 300, path: '/v2/radar/ghi' }]);
    });

    it('reports no-frames when the index is readable but empty', () => {
      const result = parseRadarIndex(
        { host: 'https://tilecache.rainviewer.com', radar: { past: [], nowcast: [] } },
        nowSeconds
      );

      expect(result).toEqual({ available: false, reason: 'no-frames' });
    });

    it('reports request-failed for a payload with no host', () => {
      expect(parseRadarIndex({ radar: { past: [] } }, nowSeconds)).toEqual({
        available: false,
        reason: 'request-failed',
      });
      expect(parseRadarIndex('not json at all', nowSeconds)).toEqual({
        available: false,
        reason: 'request-failed',
      });
    });
  });

  describe('selectLatestFrame', () => {
    it('picks the newest composite regardless of list order', () => {
      const latest = selectLatestFrame([
        { timeEpochSeconds: 200, path: '/b' },
        { timeEpochSeconds: 900, path: '/c' },
        { timeEpochSeconds: 100, path: '/a' },
      ]);

      expect(latest).toEqual({ timeEpochSeconds: 900, path: '/c' });
    });

    it('returns null for an empty list', () => {
      expect(selectLatestFrame([])).toBeNull();
    });
  });

  describe('buildRadarTileUrlTemplate', () => {
    it('assembles the documented tile path with Leaflet placeholders intact', () => {
      const url = buildRadarTileUrlTemplate('https://tilecache.rainviewer.com', {
        timeEpochSeconds: nowSeconds,
        path: '/v2/radar/75e3fe152318',
      });

      expect(url).toBe(
        `https://tilecache.rainviewer.com/v2/radar/75e3fe152318/${RADAR_TILE_SIZE_PX}` +
          `/{z}/{x}/{y}/${RADAR_COLOR_SCHEME}/${RADAR_TILE_OPTIONS}.png`
      );
    });
  });

  describe('fetchRadarFrames', () => {
    it('requests the public index without credentials and parses the response', async () => {
      const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => validIndex });
      vi.stubGlobal('fetch', fetchMock);

      const result = await fetchRadarFrames();

      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchMock.mock.calls[0][0]).toBe(RAINVIEWER_INDEX_URL);
      expect(result.available).toBe(true);
    });

    it('reports offline without attempting a request', async () => {
      const fetchMock = vi.fn();
      vi.stubGlobal('fetch', fetchMock);
      const onLineSpy = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);

      const result = await fetchRadarFrames();

      expect(result).toEqual({ available: false, reason: 'offline' });
      expect(fetchMock).not.toHaveBeenCalled();
      onLineSpy.mockRestore();
    });

    it('reports request-failed on a network error rather than rejecting', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));

      await expect(fetchRadarFrames()).resolves.toEqual({
        available: false,
        reason: 'request-failed',
      });
    });

    it('reports request-failed on a non-OK response', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({ ok: false, status: 503, statusText: 'Service Unavailable' })
      );

      await expect(fetchRadarFrames()).resolves.toEqual({
        available: false,
        reason: 'request-failed',
      });
    });

    it('reports request-failed when a 200 carries an unusable body', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({ ok: true, json: async () => ({ unexpected: true }) })
      );

      await expect(fetchRadarFrames()).resolves.toEqual({
        available: false,
        reason: 'request-failed',
      });
    });
  });
});
