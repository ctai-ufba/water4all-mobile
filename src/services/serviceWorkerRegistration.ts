/**
 * @file serviceWorkerRegistration.ts
 * @summary Registration flow for the offline app shell service worker.
 * @description Registers `sw.js` (served from `public/`) and reports, rather than throws, every
 * reason it may not have registered. Offline capability is an enhancement: a browser without
 * service worker support, a page served over plain HTTP, or a failed registration must all leave
 * the app fully usable, so no path here rejects.
 *
 * ## Usage
 *
 * Call once during bootstrap, after the app has mounted, and ignore or log the result:
 *
 * ```ts
 * import { registerServiceWorker } from './services/serviceWorkerRegistration';
 *
 * void registerServiceWorker(); // 'registered' | 'unsupported' | 'disabled' | 'failed'
 * ```
 *
 * The worker script is resolved against Vite's `BASE_URL`, so the same build works at the site
 * root during `vite preview` and under `/water4all-mobile/` on GitHub Pages (ADR 0001).
 */

import { ServiceWorkerRegistrationResult } from '../types/pwa';

/**
 * Filename of the service worker script, served verbatim from `public/`.
 */
export const SERVICE_WORKER_FILENAME = 'sw.js';

/**
 * Resolves the URL the service worker is registered from.
 *
 * @summary Service worker script URL.
 * @description Joins Vite's configured base path with the worker filename. The worker must be
 * served from the base path and not from a nested directory, because a worker's default scope is
 * its own directory and a nested worker could not control the app shell.
 *
 * @returns Base-relative URL of the worker script, e.g. `/water4all-mobile/sw.js`.
 * @throws Never throws.
 */
export function getServiceWorkerUrl(): string {
  const base = import.meta.env.BASE_URL ?? '/';
  return `${base.endsWith('/') ? base : `${base}/`}${SERVICE_WORKER_FILENAME}`;
}

/**
 * Registers the offline app shell service worker.
 *
 * @summary Register the service worker.
 * @description Skips registration in the dev server, where a caching worker would serve stale
 * modules past a hot reload, and in any browser that exposes no service worker API. Otherwise
 * registers the worker at the app's base scope and resolves with the outcome.
 *
 * @param scope - Container exposing `serviceWorker`, defaulting to the live `navigator`. Injected
 *   so tests can drive the unsupported and failing paths without touching the global.
 * @returns Result carrying the status and, on failure, the message for diagnostics.
 * @throws Never throws; a rejected registration resolves with status `'failed'`.
 */
export async function registerServiceWorker(
  scope: Pick<Navigator, 'serviceWorker'> | undefined = typeof navigator === 'undefined'
    ? undefined
    : navigator
): Promise<ServiceWorkerRegistrationResult> {
  // Caching in the dev server would shadow Vite's module graph and break hot reloading.
  if (import.meta.env.DEV) {
    return { status: 'disabled' };
  }

  if (!scope?.serviceWorker) {
    return { status: 'unsupported' };
  }

  const scriptUrl = getServiceWorkerUrl();

  try {
    await scope.serviceWorker.register(scriptUrl, { type: 'classic' });
    return { status: 'registered', scriptUrl };
  } catch (error) {
    return {
      status: 'failed',
      scriptUrl,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
