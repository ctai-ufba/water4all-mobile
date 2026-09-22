/**
 * @file serviceWorkerRegistration.test.ts
 * @summary Unit tests for the service worker registration flow.
 * @description Verifies the worker URL follows the deployment base path, that registration is
 * skipped in development and where the API is absent, and that every failure is reported rather
 * than thrown, since offline caching must never be able to break the app.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  registerServiceWorker,
  getServiceWorkerUrl,
  SERVICE_WORKER_FILENAME,
} from '../serviceWorkerRegistration';

/**
 * Builds a navigator stand-in exposing a service worker container.
 *
 * @param register - Registration implementation the test wants to observe.
 * @returns A navigator-shaped object accepted by registerServiceWorker.
 */
function fakeNavigator(register: () => Promise<unknown>): Pick<Navigator, 'serviceWorker'> {
  return { serviceWorker: { register } } as unknown as Pick<Navigator, 'serviceWorker'>;
}

describe('serviceWorkerRegistration Seam', () => {
  beforeEach(() => {
    // The module refuses to register under the dev server, which is the mode tests run in.
    vi.stubEnv('DEV', false);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('resolves the worker URL against the deployment base path', () => {
    expect(getServiceWorkerUrl()).toBe(`${import.meta.env.BASE_URL}${SERVICE_WORKER_FILENAME}`);
  });

  it('registers the worker at the base scope', async () => {
    const register = vi.fn().mockResolvedValue({});

    const result = await registerServiceWorker(fakeNavigator(register));

    expect(result.status).toBe('registered');
    expect(result.scriptUrl).toBe(getServiceWorkerUrl());
    expect(register).toHaveBeenCalledWith(getServiceWorkerUrl(), { type: 'classic' });
  });

  it('reports a failed registration instead of rejecting', async () => {
    const result = await registerServiceWorker(
      fakeNavigator(() => Promise.reject(new Error('insecure origin')))
    );

    expect(result.status).toBe('failed');
    expect(result.error).toBe('insecure origin');
  });

  it('reports browsers that expose no service worker API', async () => {
    const result = await registerServiceWorker({} as Pick<Navigator, 'serviceWorker'>);

    expect(result.status).toBe('unsupported');
  });

  it('skips registration in the dev server, where a cache would shadow hot reloads', async () => {
    vi.stubEnv('DEV', true);
    const register = vi.fn().mockResolvedValue({});

    const result = await registerServiceWorker(fakeNavigator(register));

    expect(result.status).toBe('disabled');
    expect(register).not.toHaveBeenCalled();
  });
});
