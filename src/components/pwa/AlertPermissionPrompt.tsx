/**
 * @file AlertPermissionPrompt.tsx
 * @summary Opt-in card for operating system alert notifications.
 * @description Asks for notification permission from a button rather than on mount, because
 * browsers ignore a permission request that no gesture triggered and, worse, count it against
 * the origin. Disappears once the operator answers either way, or dismisses it for the session.
 */

import React, { useState } from 'react';
import { BellRing, X } from 'lucide-react';
import { usePwa } from '../../context/PwaContext';

/**
 * Notification opt-in component.
 *
 * @summary Critical alert permission prompt.
 * @description Renders a slim card while notifications are supported but undecided, explaining
 * what the app would send. Says nothing where the browser exposes no Notification API, since the
 * operator has nothing to decide there and in-app toasts carry the alerts regardless.
 *
 * @returns React.JSX.Element with the opt-in card, or null when there is nothing to ask.
 * @throws Never throws.
 */
export function AlertPermissionPrompt(): React.JSX.Element | null {
  const { notificationPermission, enableNotifications } = usePwa();
  const [isDismissed, setIsDismissed] = useState(false);

  if (notificationPermission !== 'default' || isDismissed) {
    return null;
  }

  return (
    <div className="flex items-center gap-2 border-b border-slate-800/80 bg-slate-900/80 px-4 py-2 text-[11px] text-slate-300">
      <BellRing className="h-3.5 w-3.5 shrink-0 text-cyan-400" aria-hidden="true" />

      <span className="min-w-0 flex-1">
        Get alerted when the Blend tank drops below its minimum operating volume or rain is on the
        way.
      </span>

      <button
        onClick={() => void enableNotifications()}
        className="shrink-0 rounded-lg bg-cyan-500/10 px-2.5 py-1 text-[11px] font-semibold text-cyan-300 ring-1 ring-cyan-500/20 transition-colors hover:bg-cyan-500/20 focus:outline-none focus:ring-2 focus:ring-cyan-500/40"
      >
        Enable alerts
      </button>

      <button
        onClick={() => setIsDismissed(true)}
        className="shrink-0 rounded-lg p-1 text-slate-400 transition-colors hover:bg-slate-800 hover:text-white focus:outline-none focus:ring-2 focus:ring-slate-500/40"
        aria-label="Dismiss alert permission prompt"
      >
        <X className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
    </div>
  );
}
