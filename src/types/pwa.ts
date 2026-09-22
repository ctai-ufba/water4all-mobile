/**
 * @file pwa.ts
 * @summary Installability, connectivity and critical-alert types for the PWA layer.
 * @description Declares the shapes shared by the service worker registration flow, the
 * install promotion banner, the network status indicator and the critical alert engine
 * (ADR 0001: the app is a pure client-side PWA that must stay usable on a rural farm with
 * intermittent connectivity).
 */

/**
 * Severity of a critical farm alert, governing how loudly it is presented.
 */
export type CriticalAlertSeverity = 'critical' | 'info';

/**
 * Stable identifier of a farm condition worth interrupting the operator for.
 */
export type CriticalAlertId =
  /** Blend tank has dropped below the profile's minimum operating volume */
  | 'blend-minimum-operating-volume'
  /** Rain is forecast over the next 24 hours, with collectible catchment inflow */
  | 'rainfall-forecast';

/**
 * A farm condition raised to the operator as an in-app toast and, when permitted, an OS notification.
 */
export interface CriticalAlert {
  /** Condition this alert reports */
  id: CriticalAlertId;
  /** How loudly the alert is presented */
  severity: CriticalAlertSeverity;
  /** Short headline, used as the OS notification title */
  title: string;
  /** One-sentence explanation carrying the numbers, used as the OS notification body */
  body: string;
  /**
   * How bad this raising of the condition is, as a coarse integer.
   *
   * @remarks Only its ordering against earlier raisings of the same condition is meaningful: a
   * higher step is a worse situation and is announced again, an equal or lower one is the same
   * situation or a recovering one and stays silent. It quantises the underlying measurement
   * rather than carrying it raw, because telemetry moves continuously and an un-quantised step
   * would re-announce on every recomputation.
   */
  escalationStep: number;
}

/**
 * The deepest raising of one condition that the operator has already been told about.
 *
 * @remarks Carried between evaluations so the alert policy can tell a deteriorating condition
 * from a recovering one. It exists only while the condition holds; see
 * {@link ../domain/criticalAlertEngine!selectAlertsToAnnounce}.
 */
export interface AnnouncedAlert {
  /** Condition this record refers to */
  id: CriticalAlertId;
  /** Deepest escalation step announced while this condition has held */
  step: number;
}

/**
 * The `beforeinstallprompt` event, which no TypeScript DOM library declares.
 *
 * @remarks Chromium fires it instead of showing its own install affordance, expecting the page to
 * offer one and call `prompt()` from a user gesture. Declared structurally here because the event
 * is non-standard: Safari and Firefox never fire it, and the app must install through the
 * browser's own share menu there.
 */
export interface BeforeInstallPromptEvent extends Event {
  /** Shows the browser's install dialog; callable once per event. */
  prompt(): Promise<void>;
  /** Resolves once the operator has accepted or dismissed the dialog. */
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/**
 * Outcome of presenting the browser's install prompt to the operator.
 */
export type InstallOutcome =
  /** The operator accepted and the app was added to the home screen */
  | 'accepted'
  /** The operator declined the prompt */
  | 'dismissed'
  /** No deferred prompt was available; the browser never offered one, or it was already used */
  | 'unavailable';

/**
 * State of the operator's permission for OS-level notifications.
 *
 * @remarks Mirrors the Notification API's `permission` values, plus `unsupported` for the
 * browsers (notably iOS Safari outside standalone mode) that expose no Notification API at all.
 * The app degrades to in-app toasts in that case rather than losing the alert.
 */
export type NotificationPermissionState = 'granted' | 'denied' | 'default' | 'unsupported';

/**
 * Result of attempting to register the service worker.
 */
export type ServiceWorkerStatus =
  /** Registration succeeded; the app shell is being cached for offline use */
  | 'registered'
  /** The browser exposes no service worker API, or the page is not in a secure context */
  | 'unsupported'
  /** Registration was deliberately skipped, currently only in the dev server */
  | 'disabled'
  /** The browser supports service workers but registration failed */
  | 'failed';

/**
 * Outcome of the service worker registration flow, including why it did not register.
 */
export interface ServiceWorkerRegistrationResult {
  /** What happened during registration */
  status: ServiceWorkerStatus;
  /** Absolute or base-relative URL of the registered script, when one was registered */
  scriptUrl?: string;
  /** Failure message when status is 'failed', for diagnostics only; never surfaced as an error state */
  error?: string;
}
