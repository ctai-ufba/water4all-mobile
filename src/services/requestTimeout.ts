/**
 * @file requestTimeout.ts
 * @summary Abort signal helper shared by the app's outbound fetch services.
 * @description Produces a timeout `AbortSignal` in whichever way the running environment allows,
 * and a cancel function to release the timer once the request settles.
 *
 * @example
 * ```ts
 * const timeout = createTimeoutSignal(8000);
 * try {
 *   const response = await fetch(url, { ...(timeout.signal ? { signal: timeout.signal } : {}) });
 * } finally {
 *   timeout.cancel();
 * }
 * ```
 */

/** A timeout signal paired with the cleanup that releases its timer. */
export interface TimeoutSignal {
  /** Signal to pass to `fetch`, or `undefined` where the environment supports neither mechanism */
  signal: AbortSignal | undefined;
  /** Releases the pending timer; safe to call more than once and when no timer was set */
  cancel: () => void;
}

/**
 * Builds an abort signal that fires after the given delay.
 *
 * @summary Create a request timeout signal.
 * @description Prefers `AbortSignal.timeout`, falls back to an `AbortController` driven by
 * `setTimeout`, and degrades to no signal at all rather than failing the request.
 *
 * @param timeoutMs - Delay in milliseconds after which the request should abort.
 * @returns A TimeoutSignal whose `signal` may be undefined on environments supporting neither API.
 * @throws Never throws; an environment that rejects both mechanisms yields an un-timed request.
 */
export function createTimeoutSignal(timeoutMs: number): TimeoutSignal {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  try {
    if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') {
      return { signal: AbortSignal.timeout(timeoutMs), cancel: () => {} };
    }
    if (typeof AbortController !== 'undefined') {
      const controller = new AbortController();
      timeoutId = setTimeout(() => controller.abort(), timeoutMs);
      return {
        signal: controller.signal,
        cancel: () => {
          if (timeoutId) {
            clearTimeout(timeoutId);
            timeoutId = undefined;
          }
        },
      };
    }
  } catch {
    // An environment that rejects both mechanisms still gets its request, just without a timeout.
  }

  return { signal: undefined, cancel: () => {} };
}
