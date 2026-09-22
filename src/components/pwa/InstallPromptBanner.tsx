/**
 * @file InstallPromptBanner.tsx
 * @summary "Add to Home Screen" install promotion banner.
 * @description Offers the install prompt the provider captured from the browser, so the operator
 * gets a full-screen app on the home screen instead of a tab they have to find again. Shown only
 * where the browser actually offered a prompt, which excludes iOS and an already installed app.
 */

import React, { useState } from 'react';
import { Download, X } from 'lucide-react';
import { usePwa } from '../../context/PwaContext';

/**
 * Install promotion banner component.
 *
 * @summary Add to Home Screen banner.
 * @description Renders a dismissible card above the bottom navigation while a deferred install
 * prompt is pending. Accepting hands off to the browser's own dialog; dismissing is remembered on
 * the device so the offer is not repeated on every visit.
 *
 * @returns React.JSX.Element with the banner, or null when there is no prompt to offer.
 * @throws Never throws.
 */
export function InstallPromptBanner(): React.JSX.Element | null {
  const { canInstall, promptInstall, dismissInstallBanner } = usePwa();
  const [isPrompting, setIsPrompting] = useState(false);

  if (!canInstall) {
    return null;
  }

  /**
   * Presents the browser install dialog, keeping the button inert while it is open.
   *
   * @returns Promise resolving once the operator has answered the dialog.
   */
  const handleInstall = async (): Promise<void> => {
    setIsPrompting(true);
    try {
      await promptInstall();
    } finally {
      // The provider clears the prompt either way; this only re-enables the button if it survives.
      setIsPrompting(false);
    }
  };

  return (
    <section aria-label="Install App" className="pointer-events-auto">
      <div className="flex items-center gap-3 rounded-2xl border border-cyan-500/30 bg-slate-900/95 p-3 shadow-2xl backdrop-blur-md">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-400 ring-1 ring-cyan-500/20">
          <Download className="h-4 w-4" aria-hidden="true" />
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-white">Install Water4All</p>
          <p className="text-[11px] leading-snug text-slate-400">
            Add to your home screen to open full screen and keep monitoring without a connection.
          </p>
        </div>

        <button
          onClick={handleInstall}
          disabled={isPrompting}
          className="shrink-0 rounded-xl bg-cyan-500 px-3 py-1.5 text-xs font-semibold text-slate-950 transition-colors hover:bg-cyan-400 disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-cyan-500/40"
        >
          Install
        </button>

        <button
          onClick={dismissInstallBanner}
          className="shrink-0 rounded-lg p-1 text-slate-400 transition-colors hover:bg-slate-800 hover:text-white focus:outline-none focus:ring-2 focus:ring-slate-500/40"
          aria-label="Dismiss install banner"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </section>
  );
}
