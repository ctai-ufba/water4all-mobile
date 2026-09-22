/**
 * @file CriticalAlertToasts.tsx
 * @summary In-app toast stack for critical farm alerts.
 * @description Surfaces minimum operating volume breaches and rain forecasts from whichever tab
 * the operator is on. This is the channel that always works: OS notifications need a permission
 * the operator may never grant and an API iOS only exposes to installed apps, whereas a toast
 * reaches a farmer looking at the Quality screen while the Blend tank empties.
 */

import React, { useEffect, useRef } from 'react';
import { AlertTriangle, CloudRain, X } from 'lucide-react';
import { CriticalAlert, CriticalAlertSeverity } from '../../types/pwa';
import { usePwa } from '../../context/PwaContext';

/**
 * How long a toast stays on screen before dismissing itself, per severity.
 *
 * @remarks A toast is an interruption, not a status display: the Dashboard's BlendTankAlert
 * banner is the standing view of a breach, and a toast that never left would cover the figures
 * the operator opened the app to read. A breach dwells longer than a forecast because acting on
 * it is urgent.
 */
export const TOAST_DURATION_MS: Record<CriticalAlertSeverity, number> = {
  critical: 20000,
  info: 10000,
};

/** Per-severity presentation: the icon and the colour ramp the toast is drawn in. */
const SEVERITY_STYLES = {
  critical: {
    icon: AlertTriangle,
    container: 'border-rose-500/40 bg-rose-950/90 text-rose-100',
    accent: 'text-rose-400',
    heading: 'text-rose-300',
  },
  info: {
    icon: CloudRain,
    container: 'border-cyan-500/40 bg-slate-900/95 text-slate-200',
    accent: 'text-cyan-400',
    heading: 'text-cyan-300',
  },
} as const;

/**
 * Props for the CriticalAlertToast component.
 */
export interface CriticalAlertToastProps {
  /** Alert to present */
  alert: CriticalAlert;
  /**
   * Hides this alert.
   *
   * @returns void
   */
  onDismiss: () => void;
}

/**
 * Single alert toast.
 *
 * @summary Critical alert toast.
 * @description Renders one alert in its severity's colours with a dismiss control, and dismisses
 * itself once its severity's dwell time elapses.
 *
 * @param props - Component props containing the alert and its dismiss handler.
 * @returns React.JSX.Element representing the toast.
 * @throws Never throws.
 */
export function CriticalAlertToast({
  alert,
  onDismiss,
}: CriticalAlertToastProps): React.JSX.Element {
  const style = SEVERITY_STYLES[alert.severity];
  const Icon = style.icon;

  // Held in a ref so the dwell timer is set once per alert. The handler is rebuilt on every
  // parent render, and depending on it directly would restart the timer each time telemetry moved.
  const dismiss = useRef(onDismiss);
  dismiss.current = onDismiss;

  useEffect(() => {
    const timer = setTimeout(() => dismiss.current(), TOAST_DURATION_MS[alert.severity]);
    return () => clearTimeout(timer);
  }, [alert.severity]);

  return (
    <div
      role={alert.severity === 'critical' ? 'alert' : 'status'}
      className={`flex items-start gap-2.5 rounded-2xl border p-3 shadow-2xl backdrop-blur-md ${style.container}`}
    >
      <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${style.accent}`} aria-hidden="true" />

      <div className="min-w-0 flex-1 text-[11px]">
        <p className={`font-bold uppercase tracking-wider ${style.heading}`}>{alert.title}</p>
        <p className="mt-0.5 leading-relaxed">{alert.body}</p>
      </div>

      <button
        onClick={onDismiss}
        className="shrink-0 rounded-lg p-1 opacity-70 transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-slate-500/40"
        aria-label={`Dismiss alert: ${alert.title}`}
      >
        <X className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
    </div>
  );
}

/**
 * Critical alert toast stack.
 *
 * @summary In-app critical alert stack.
 * @description Renders every currently active alert, critical first, as the alert engine orders
 * them. Renders nothing when no condition holds. Placement is the dock's concern, not this
 * component's, so the stack flows wherever PwaAlertDock puts it.
 *
 * @returns React.JSX.Element with the stack, or null when there is nothing to report.
 * @throws Never throws.
 */
export function CriticalAlertToasts(): React.JSX.Element | null {
  const { activeAlerts, dismissAlert } = usePwa();

  if (activeAlerts.length === 0) {
    return null;
  }

  return (
    <div aria-live="polite" className="pointer-events-auto flex flex-col gap-2">
      {activeAlerts.map((alert) => (
        <CriticalAlertToast
          key={alert.id}
          alert={alert}
          onDismiss={() => dismissAlert(alert.id)}
        />
      ))}
    </div>
  );
}
