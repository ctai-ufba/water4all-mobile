/**
 * @file PwaAlertDock.tsx
 * @summary Fixed dock holding the critical alert toasts and the install banner.
 * @description Gives the two floating PWA surfaces one owner of their placement, so they stack
 * instead of covering each other. It sits above the bottom navigation and clear of the floating
 * demo trigger, which occupies the strip immediately above the nav bar.
 */

import React from 'react';
import { CriticalAlertToasts } from './CriticalAlertToasts';
import { InstallPromptBanner } from './InstallPromptBanner';

/**
 * Floating PWA surface dock.
 *
 * @summary Alert and install banner dock.
 * @description Anchors both surfaces to the bottom of the mobile viewport frame in one column,
 * alerts above the install offer, since a tank below its minimum operating volume outranks an
 * invitation to install. The container itself ignores pointer events so that the map and content
 * underneath stay usable when neither surface is showing.
 *
 * @returns React.JSX.Element containing the dock.
 * @throws Never throws.
 */
export function PwaAlertDock(): React.JSX.Element {
  return (
    <div className="pointer-events-none fixed bottom-28 z-40 flex w-full max-w-md flex-col gap-2 px-3">
      <CriticalAlertToasts />
      <InstallPromptBanner />
    </div>
  );
}
