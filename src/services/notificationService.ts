/**
 * @file notificationService.ts
 * @summary Browser notification delivery for critical farm alerts.
 * @description Wraps the Notification API so the rest of the app can offer OS-level alerts
 * without branching on browser support. Every entry point degrades to a reported state instead
 * of throwing, because notifications are an enhancement over the in-app toast stack, never the
 * only channel an alert reaches the operator through.
 *
 * ## Simulated push, not real push
 *
 * These are local notifications raised by the running page, not Web Push: the app has no backend
 * and no VAPID key pair (ADR 0001), so nothing can wake the device while the app is closed. The
 * demonstration value is the delivery surface and the permission flow; the transport is simulated.
 *
 * ## Usage
 *
 * ```ts
 * const permission = await requestNotificationPermission(); // shows the browser's prompt
 * if (permission === 'granted') {
 *   announceAlert(alert); // replaces any earlier notification for the same condition
 * }
 * ```
 */

import { CriticalAlert, NotificationPermissionState } from '../types/pwa';

/**
 * Minimal surface of the global `Notification` constructor this module depends on.
 *
 * @remarks Declared structurally rather than taken from `lib.dom` so tests can substitute a
 * double, and so the module compiles where the API is absent.
 */
export interface NotificationApi {
  new (title: string, options?: NotificationOptions): unknown;
  permission: string;
  requestPermission(): Promise<string>;
}

/**
 * Resolves the live Notification constructor, or undefined where the browser exposes none.
 *
 * @summary Ambient Notification API.
 * @description iOS Safari exposes no Notification API outside an installed standalone app, and
 * neither does jsdom, so absence is an expected state rather than an error.
 *
 * @returns The global Notification constructor, or undefined.
 * @throws Never throws.
 */
function getAmbientNotificationApi(): NotificationApi | undefined {
  return (globalThis as { Notification?: NotificationApi }).Notification;
}

/**
 * Narrows a raw permission string to the states the app handles.
 *
 * @param permission - Raw value read from the Notification API.
 * @returns The corresponding permission state, defaulting to `'default'` for unknown values.
 * @throws Never throws.
 */
function toPermissionState(permission: string): NotificationPermissionState {
  return permission === 'granted' || permission === 'denied' ? permission : 'default';
}

/**
 * Reads the current notification permission without prompting.
 *
 * @summary Current notification permission.
 * @description Reports `'unsupported'` where no Notification API exists, which callers must treat
 * as "in-app alerts only" rather than as a denial the operator could reverse.
 *
 * @param api - Notification constructor to inspect; defaults to the ambient one.
 * @returns The current permission state.
 * @throws Never throws.
 */
export function getNotificationPermission(
  api: NotificationApi | undefined = getAmbientNotificationApi()
): NotificationPermissionState {
  return api ? toPermissionState(api.permission) : 'unsupported';
}

/**
 * Asks the operator for permission to raise OS notifications.
 *
 * @summary Request notification permission.
 * @description Shows the browser's permission prompt, which most browsers only present in
 * response to a user gesture; call it from a click handler, not on mount.
 *
 * @param api - Notification constructor to request through; defaults to the ambient one.
 * @returns The resulting permission state, or `'unsupported'` where no API exists.
 * @throws Never throws; a rejected request resolves to `'denied'`.
 */
export async function requestNotificationPermission(
  api: NotificationApi | undefined = getAmbientNotificationApi()
): Promise<NotificationPermissionState> {
  if (!api) {
    return 'unsupported';
  }

  try {
    return toPermissionState(await api.requestPermission());
  } catch {
    // A browser that refuses the request outright is indistinguishable from a denial to the app.
    return 'denied';
  }
}

/**
 * Raises one critical alert as an OS notification.
 *
 * @summary Announce an alert to the operating system.
 * @description Tags the notification with the alert identifier so a renewed warning about the
 * same condition replaces the previous one instead of stacking.
 *
 * @param alert - Alert to announce.
 * @param api - Notification constructor to raise through; defaults to the ambient one.
 * @returns True when the notification was raised; false when unsupported, not granted, or
 *   rejected by the browser, in which case the in-app toast remains the only channel.
 * @throws Never throws.
 */
export function announceAlert(
  alert: CriticalAlert,
  api: NotificationApi | undefined = getAmbientNotificationApi()
): boolean {
  if (!api || toPermissionState(api.permission) !== 'granted') {
    return false;
  }

  try {
    new api(alert.title, { body: alert.body, tag: alert.id });
    return true;
  } catch {
    // Android Chrome forbids the constructor outside a service worker; the toast still shows.
    return false;
  }
}
