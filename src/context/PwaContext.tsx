/**
 * @file PwaContext.tsx
 * @summary Installability, connectivity and critical alert state for the app shell.
 * @description Owns the three pieces of state that make the app behave like an installed field
 * tool rather than a web page: whether the device is reachable, whether the browser is offering
 * installation, and which farm conditions are currently worth interrupting the operator for.
 *
 * Alert delivery is coupled here rather than in a view because an alert must reach the operator
 * from whichever tab is open. The provider derives alerts from telemetry and weather, announces
 * the new ones through the Notification API when permitted, and exposes the full set for the
 * in-app toast stack, which is the channel that always works.
 *
 * ## Usage
 *
 * Mount inside the telemetry and weather providers, which supply the conditions alerts derive
 * from, and read it from any component under the shell:
 *
 * ```tsx
 * const { isOnline, canInstall, promptInstall, activeAlerts } = usePwa();
 * ```
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  ReactNode,
} from 'react';
import { useAuth } from './AuthContext';
import { useTelemetry } from './TelemetryContext';
import { useWeather } from './WeatherContext';
import { deriveCriticalAlerts, selectAlertsToAnnounce } from '../domain/criticalAlertEngine';
import {
  announceAlert,
  getNotificationPermission,
  requestNotificationPermission,
} from '../services/notificationService';
import {
  AnnouncedAlert,
  BeforeInstallPromptEvent,
  CriticalAlert,
  CriticalAlertId,
  InstallOutcome,
  NotificationPermissionState,
} from '../types/pwa';

/** localStorage key recording that the operator dismissed the install banner. */
export const INSTALL_DISMISSED_STORAGE_KEY = 'water4all_pwa_install_dismissed';

/**
 * Interface defining the PwaContext shape and control methods.
 */
export interface PwaContextType {
  /** Whether the device currently reports a network connection */
  isOnline: boolean;
  /**
   * Whether the browser has offered an install prompt that has not been used or dismissed.
   *
   * @remarks False is the normal state on iOS and Firefox, which never offer one, and in an
   * already installed app. It means "no prompt to show", not "not installable".
   */
  canInstall: boolean;
  /**
   * Presents the browser's install dialog.
   *
   * @summary Prompt to install the app.
   * @description Must be called from a user gesture; browsers ignore a prompt raised on mount.
   * The deferred event is single-use, so the prompt is cleared whatever the operator chooses.
   *
   * @returns The operator's choice, or 'unavailable' when no prompt was pending.
   * @throws Never throws.
   */
  promptInstall: () => Promise<InstallOutcome>;
  /**
   * Hides the install banner for good on this device.
   *
   * @summary Dismiss the install banner.
   * @description Records the dismissal in localStorage so a farm operator who declined once is
   * not asked again on every visit.
   *
   * @returns void
   * @throws Never throws.
   */
  dismissInstallBanner: () => void;
  /** Current permission for OS-level notifications */
  notificationPermission: NotificationPermissionState;
  /**
   * Asks the operator to allow OS notifications for critical alerts.
   *
   * @summary Enable critical alert notifications.
   * @description Shows the browser's permission prompt; call from a click handler. Alerts still
   * appear as in-app toasts whatever the answer.
   *
   * @returns The resulting permission state.
   * @throws Never throws.
   */
  enableNotifications: () => Promise<NotificationPermissionState>;
  /** Alerts whose condition currently holds and which the operator has not dismissed */
  activeAlerts: CriticalAlert[];
  /**
   * Hides the toast for one condition.
   *
   * @summary Dismiss an alert toast.
   * @description Suppresses the toast while the condition holds unchanged. A condition that
   * worsens past the deepest step already announced, or that clears and returns, raises a fresh
   * toast: the dismissal covered the situation the operator saw, not the condition forever.
   *
   * @param id - Condition whose toast is being dismissed.
   * @returns void
   * @throws Never throws.
   */
  dismissAlert: (id: CriticalAlertId) => void;
}

const PwaContext = createContext<PwaContextType | undefined>(undefined);

/**
 * Props for the PwaProvider component.
 */
export interface PwaProviderProps {
  /** Child React elements wrapped by the provider */
  children: ReactNode;
}

/**
 * Reads the persisted install banner dismissal.
 *
 * @summary Read install dismissal.
 * @description Treats an unreadable store as "not dismissed", because a private-mode browser
 * that refuses storage should still be offered the install banner.
 *
 * @returns True when the operator previously dismissed the banner.
 * @throws Never throws.
 */
function readInstallDismissed(): boolean {
  try {
    return localStorage.getItem(INSTALL_DISMISSED_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

/**
 * Reports whether the app is running from the home screen rather than a browser tab.
 *
 * @summary Detect standalone display mode.
 * @description Checks the manifest's standalone display mode, and the non-standard
 * `navigator.standalone` that iOS Safari sets instead, since iOS implements neither
 * `beforeinstallprompt` nor the display-mode query in older versions.
 *
 * @returns True when the app is already installed and launched standalone.
 * @throws Never throws.
 */
function isRunningStandalone(): boolean {
  const iosStandalone = (navigator as { standalone?: boolean }).standalone === true;
  const displayMode = window.matchMedia?.('(display-mode: standalone)').matches === true;
  return iosStandalone || displayMode;
}

/**
 * PWA capability provider.
 *
 * @summary Installability, connectivity and alert provider.
 * @description Tracks online/offline transitions, captures the deferred install prompt, and
 * derives and announces critical farm alerts from the active telemetry and weather state.
 *
 * @param props - Component props containing the child tree.
 * @returns React.JSX.Element providing PwaContext to its children.
 * @throws Never throws.
 */
export function PwaProvider({ children }: PwaProviderProps): React.JSX.Element {
  const { activeFarm } = useAuth();
  const { telemetry } = useTelemetry();
  const { weather, catchmentEstimate } = useWeather();

  const [isOnline, setIsOnline] = useState<boolean>(() => navigator.onLine !== false);
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstallDismissed, setIsInstallDismissed] = useState<boolean>(readInstallDismissed);
  const [notificationPermission, setNotificationPermission] =
    useState<NotificationPermissionState>(getNotificationPermission);
  const [dismissedAlertIds, setDismissedAlertIds] = useState<CriticalAlertId[]>([]);

  /**
   * The deepest raising of each held condition already announced to the operating system.
   *
   * @remarks Held in a ref, not state: announcing must not itself trigger a render, or the
   * effect that announces would re-run and the alert would be raised twice.
   */
  const announcedAlerts = useRef<AnnouncedAlert[]>([]);

  // Connectivity is reported by events rather than polled; navigator.onLine only says whether an
  // interface exists, which is why the app still falls back to synthetic weather when a request
  // fails on a connected but unreachable network.
  useEffect(() => {
    const handleOnline = (): void => setIsOnline(true);
    const handleOffline = (): void => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    const handleBeforeInstallPrompt = (event: Event): void => {
      // Suppressing the browser's own banner is the price of deferring it; the app must now show
      // its own affordance, which is what InstallPromptBanner does.
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };

    const handleInstalled = (): void => setInstallPrompt(null);

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleInstalled);
    };
  }, []);

  const activeAlerts = useMemo(() => {
    if (!activeFarm || !telemetry || !weather) {
      return [];
    }

    return deriveCriticalAlerts({
      blendVolumeM3: telemetry.tankVolumes.blend,
      minOperatingVolumeM3: activeFarm.tankCapacities.minOperatingVolume,
      precipitationForecast24hMm: weather.precipitationForecast24hMm,
      catchmentInflowM3: catchmentEstimate?.forecastInflowM3,
    });
  }, [activeFarm, telemetry, weather, catchmentEstimate]);

  useEffect(() => {
    const { announce, nextAnnounced } = selectAlertsToAnnounce(
      activeAlerts,
      announcedAlerts.current
    );
    announcedAlerts.current = nextAnnounced;
    announce.forEach((alert) => announceAlert(alert));

    // A dismissal covers the situation the operator saw, so it survives the condition merely
    // persisting but not the condition clearing, nor worse news about it.
    const stillSuppressed = new Set(
      nextAnnounced
        .map((record) => record.id)
        .filter((id) => !announce.some((alert) => alert.id === id))
    );
    setDismissedAlertIds((previous) => {
      const retained = previous.filter((id) => stillSuppressed.has(id));
      return retained.length === previous.length ? previous : retained;
    });
  }, [activeAlerts]);

  const promptInstall = useCallback(async (): Promise<InstallOutcome> => {
    if (!installPrompt) {
      return 'unavailable';
    }

    await installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    // The event cannot be prompted twice, so drop it whichever way the operator answered.
    setInstallPrompt(null);
    return outcome;
  }, [installPrompt]);

  const dismissInstallBanner = useCallback((): void => {
    setIsInstallDismissed(true);
    try {
      localStorage.setItem(INSTALL_DISMISSED_STORAGE_KEY, 'true');
    } catch {
      // A browser refusing storage still gets the banner hidden for this session.
    }
  }, []);

  const enableNotifications = useCallback(async (): Promise<NotificationPermissionState> => {
    const permission = await requestNotificationPermission();
    setNotificationPermission(permission);
    return permission;
  }, []);

  const dismissAlert = useCallback((id: CriticalAlertId): void => {
    setDismissedAlertIds((previous) => (previous.includes(id) ? previous : [...previous, id]));
  }, []);

  const visibleAlerts = useMemo(
    () => activeAlerts.filter((alert) => !dismissedAlertIds.includes(alert.id)),
    [activeAlerts, dismissedAlertIds]
  );

  const value = useMemo<PwaContextType>(
    () => ({
      isOnline,
      canInstall: installPrompt !== null && !isInstallDismissed && !isRunningStandalone(),
      promptInstall,
      dismissInstallBanner,
      notificationPermission,
      enableNotifications,
      activeAlerts: visibleAlerts,
      dismissAlert,
    }),
    [
      isOnline,
      installPrompt,
      isInstallDismissed,
      promptInstall,
      dismissInstallBanner,
      notificationPermission,
      enableNotifications,
      visibleAlerts,
      dismissAlert,
    ]
  );

  return <PwaContext.Provider value={value}>{children}</PwaContext.Provider>;
}

/**
 * Accesses the PWA capability context.
 *
 * @summary PWA context hook.
 * @description Returns connectivity, installability and critical alert state.
 *
 * @returns The active PwaContextType value.
 * @throws Error when called outside a PwaProvider.
 */
export function usePwa(): PwaContextType {
  const context = useContext(PwaContext);

  if (context === undefined) {
    throw new Error('usePwa must be used within a PwaProvider');
  }

  return context;
}
