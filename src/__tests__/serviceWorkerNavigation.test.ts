/**
 * @file serviceWorkerNavigation.test.ts
 * @summary Behavioural tests for the service worker's navigation caching rule.
 * @description Loads the real `public/sw.js` into a sandbox standing in for a worker global and
 * drives its `fetch` listener with navigation requests. The rule under test is narrow but load
 * bearing: the cached app shell is the farm's only entry point when there is no signal, so what
 * may overwrite it decides whether an offline start works at all.
 *
 * The worker ships as a plain script served verbatim rather than as a module the suite can import,
 * so it is evaluated here with its globals injected. That is also what keeps this test honest: it
 * runs the file the browser runs, not a copy of its logic.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const WORKER_ORIGIN = 'https://farm.example';

/** A navigation request, as the worker reads one; Node's Request forbids `mode: 'navigate'`. */
const NAVIGATION_REQUEST = {
  method: 'GET',
  url: `${WORKER_ORIGIN}/`,
  mode: 'navigate',
};

/** Listener signature the worker registers for the events this test drives. */
type WorkerListener = (event: {
  request: typeof NAVIGATION_REQUEST;
  respondWith: (response: Promise<Response>) => void;
  waitUntil: (work: Promise<unknown>) => void;
}) => void;

interface WorkerHarness {
  /** Drives the worker's fetch listener and resolves with what it responded */
  navigate: () => Promise<Response>;
  /** Everything written to the shell cache, keyed by request */
  cached: Map<string, Response>;
  /** Writes to the shell cache, so a test can assert one did not happen */
  put: ReturnType<typeof vi.fn>;
}

/**
 * Evaluates the real service worker with stubbed worker globals.
 *
 * @summary Load sw.js into a sandbox.
 * @description Injects `self`, `caches` and `fetch` as parameters, which shadow the ambient
 * globals inside the script, and captures the listeners the worker registers.
 *
 * @param respond - The network stand-in the worker's `fetch` calls resolve or reject with.
 * @param primed - Entries already in the cache when the worker starts.
 * @returns A harness exposing the navigation path and the cache writes it made.
 * @throws Never throws; a worker that fails to parse fails the test that loaded it.
 */
function loadWorker(
  respond: () => Promise<Response>,
  primed: Array<[string, Response]> = []
): WorkerHarness {
  const cached = new Map<string, Response>(primed);
  const put = vi.fn(async (key: string, value: Response): Promise<void> => {
    cached.set(String(key), value);
  });

  const cache = { put, add: vi.fn(), keys: async () => [], delete: vi.fn() };
  const caches = {
    open: async () => cache,
    match: async (key: unknown) => cached.get(String(key)),
    keys: async () => [],
    delete: vi.fn(),
  };

  const listeners: Record<string, WorkerListener> = {};
  const self = {
    addEventListener: (type: string, listener: WorkerListener): void => {
      listeners[type] = listener;
    },
    skipWaiting: vi.fn(),
    clients: { claim: vi.fn() },
    location: { origin: WORKER_ORIGIN },
  };

  const source = readFileSync(resolve(process.cwd(), 'public/sw.js'), 'utf-8');
  // eslint-disable-next-line no-new-func -- the point of this suite is to run the shipped file.
  new Function('self', 'caches', 'fetch', source)(self, caches, respond);

  return {
    cached,
    put,
    navigate: () => {
      let responded: Promise<Response> | undefined;
      listeners.fetch({
        request: NAVIGATION_REQUEST,
        respondWith: (response) => {
          responded = response;
        },
        waitUntil: () => undefined,
      });

      if (!responded) {
        throw new Error('the worker did not handle the navigation');
      }
      return responded;
    },
  };
}

describe('Service worker navigation handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('refreshes the cached shell from a successful navigation', async () => {
    const worker = loadWorker(async () => new Response('<!doctype html>fresh shell'));

    await worker.navigate();

    expect(worker.put).toHaveBeenCalledTimes(1);
    expect(worker.put.mock.calls[0][0]).toBe('./index.html');
    await expect(worker.cached.get('./index.html')?.text()).resolves.toContain('fresh shell');
  });

  it.each([404, 500, 503])(
    'leaves the cached shell intact when the network answers %i',
    async (status) => {
      const shell = new Response('<!doctype html>real shell');
      const worker = loadWorker(async () => new Response('Not the app', { status }), [
        ['./index.html', shell],
      ]);

      const response = await worker.navigate();

      // The error page reaches the browser, but it must never become the offline entry point.
      expect(response.status).toBe(status);
      expect(worker.put).not.toHaveBeenCalled();
      await expect(worker.cached.get('./index.html')?.text()).resolves.toContain('real shell');
    }
  );

  it('does not let a captive portal sign-in page replace the shell', async () => {
    // A hotel or rural hotspot answers every request with its own page, often as a redirect.
    const portal = new Response('Sign in to continue', { status: 302 });
    const worker = loadWorker(async () => portal, [
      ['./index.html', new Response('<!doctype html>real shell')],
    ]);

    await worker.navigate();

    expect(worker.put).not.toHaveBeenCalled();
  });

  it('serves the cached shell when the network is unreachable', async () => {
    const worker = loadWorker(
      async () => {
        throw new TypeError('Failed to fetch');
      },
      [['./index.html', new Response('<!doctype html>real shell')]]
    );

    const response = await worker.navigate();

    await expect(response.text()).resolves.toContain('real shell');
  });

  it('propagates the failure when nothing is cached to fall back to', async () => {
    const worker = loadWorker(async () => {
      throw new TypeError('Failed to fetch');
    });

    await expect(worker.navigate()).rejects.toThrow('Failed to fetch');
  });
});
