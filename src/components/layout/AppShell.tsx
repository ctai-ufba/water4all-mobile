/**
 * @file AppShell.tsx
 * @summary Responsive mobile application shell with top header and bottom navigation.
 * @description Provides the mobile-first viewport wrapper for Water4All, housing the
 * persistent Header, scrollable content view, and touch-friendly bottom navigation bar.
 */

import React, { ReactNode, useState } from 'react';
import { LayoutDashboard, CloudSun, Cylinder, ShieldCheck } from 'lucide-react';
import { Header } from './Header';
import { DemoControllerDrawer } from '../demo/DemoControllerDrawer';
import { OptimizationProgressModal } from '../demo/OptimizationProgressModal';
import { DemoFloatingTrigger } from '../demo/DemoFloatingTrigger';
import { NetworkStatusBanner } from '../pwa/NetworkStatusBanner';
import { AlertPermissionPrompt } from '../pwa/AlertPermissionPrompt';
import { PwaAlertDock } from '../pwa/PwaAlertDock';

/**
 * Available primary navigation tab identifiers.
 */
export type NavTab = 'dashboard' | 'weather' | 'tanks' | 'quality';

/**
 * Moves the shell to another primary tab.
 *
 * @param tab - Tab to activate.
 * @returns void
 */
export type NavigateToTab = (tab: NavTab) => void;

/**
 * Props for the AppShell component.
 */
export interface AppShellProps {
  /**
   * Page or view contents, or a render function receiving the active tab and a navigate callback.
   *
   * @remarks The navigate callback is how a view reaches another tab: the dashboard's weather strip
   * opens the Weather view with it. Navigation state stays owned by the shell, which is the only
   * component that knows the tab set, so views never hold a copy of it.
   */
  children?: ReactNode | ((tab: NavTab, navigate: NavigateToTab) => ReactNode);
  /** Optional active tab override for testing or external routing */
  initialTab?: NavTab;
}

/**
 * Navigation item specification.
 */
interface NavItem {
  id: NavTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'weather', label: 'Weather', icon: CloudSun },
  { id: 'tanks', label: 'Tanks', icon: Cylinder },
  { id: 'quality', label: 'Quality', icon: ShieldCheck },
];

/**
 * Main application shell container.
 *
 * @summary Application shell component.
 * @description Houses the mobile viewport frame, top header, main content slot,
 * and bottom navigation bar with active tab awareness.
 *
 * @param props - Component props containing children and optional initial tab.
 * @returns React.JSX.Element representing the mobile application layout.
 * @throws Never throws.
 */
export function AppShell({ children, initialTab = 'dashboard' }: AppShellProps): React.JSX.Element {
  const [activeTab, setActiveTab] = useState<NavTab>(initialTab);

  /**
   * Resolves and renders the view content corresponding to the active navigation tab.
   *
   * @summary Render active tab view.
   * @description Evaluates children (whether passed as a functional render prop or static ReactNode)
   * against the currently selected tab, handing the render prop a callback that switches tabs.
   * Falls back to a standard module placeholder for tabs not yet implemented or returning
   * null/undefined.
   *
   * @returns ReactNode representing the view component to display in the main content slot.
   * @throws Never throws.
   */
  const renderContent = (): ReactNode => {
    if (typeof children === 'function') {
      const rendered = children(activeTab, setActiveTab);
      if (rendered !== undefined && rendered !== null) {
        return rendered;
      }
    }

    // When static children are provided, render them on dashboard tab
    if (activeTab === 'dashboard' && typeof children !== 'function' && children) {
      return children;
    }

    // Default tab view placeholder for other modules
    const activeItem = NAV_ITEMS.find((item) => item.id === activeTab);
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center text-slate-400">
        <p className="text-sm font-medium text-slate-300">
          {activeItem?.label} View
        </p>
        <p className="mt-1 text-xs text-slate-400">
          Module scheduled for upcoming implementation phase.
        </p>
      </div>
    );
  };

  return (
    <div className="flex min-h-screen justify-center bg-slate-950 text-slate-100">
      {/* Mobile-first viewport container (centered and framed on desktop viewports) */}
      <div className="relative flex w-full max-w-md flex-col bg-slate-950 shadow-2xl ring-1 ring-slate-800/60 min-h-screen">
        {/* Top Header */}
        <Header />

        {/* Device status strips: offline mode, then the one-time notification opt-in */}
        <NetworkStatusBanner />
        <AlertPermissionPrompt />

        {/* Scrollable Main Content Area */}
        <main className="flex-1 overflow-y-auto px-4 py-4 pb-20">
          {renderContent()}

          {/*
            Every third party the app draws on is credited here rather than on the view that uses
            it: map tiles and radar appear only on the Weather view, but ODbL and the RainViewer
            terms are conditions on the app, not on one screen. It is unconditional for the same
            reason the Open-Meteo credit always was - the licences cover the data the app is built
            on whether or not this particular session reached any of the three APIs.
          */}
          <footer className="mt-6 px-1 pb-2 text-center text-[10px] leading-relaxed text-slate-500">
            &copy;{' '}
            <a
              href="https://www.openstreetmap.org/copyright"
              target="_blank"
              rel="noreferrer noopener"
              className="underline decoration-slate-700 underline-offset-2 hover:text-slate-400"
            >
              OpenStreetMap
            </a>{' '}
            contributors &middot; Radar &copy;{' '}
            <a
              href="https://www.rainviewer.com/"
              target="_blank"
              rel="noreferrer noopener"
              className="underline decoration-slate-700 underline-offset-2 hover:text-slate-400"
            >
              RainViewer
            </a>{' '}
            &middot; Weather data by{' '}
            <a
              href="https://open-meteo.com/"
              target="_blank"
              rel="noreferrer noopener"
              className="underline decoration-slate-700 underline-offset-2 hover:text-slate-400"
            >
              Open-Meteo.com
            </a>{' '}
            (
            <a
              href="https://creativecommons.org/licenses/by/4.0/"
              target="_blank"
              rel="noreferrer noopener"
              className="underline decoration-slate-700 underline-offset-2 hover:text-slate-400"
            >
              CC BY 4.0
            </a>
            )
          </footer>
        </main>

        {/* Critical alert toasts and the Add to Home Screen offer, docked above the demo trigger */}
        <PwaAlertDock />

        {/* Persistent Floating Demo Presentation Trigger */}
        <DemoFloatingTrigger />

        {/* Slide-over Demo Controller Drawer */}
        <DemoControllerDrawer />

        {/* 2-Second Animated Optimization Progress Modal */}
        <OptimizationProgressModal />

        {/* Bottom Navigation Bar */}
        <nav
          className="fixed bottom-0 z-30 flex w-full max-w-md items-center justify-around border-t border-slate-800/80 bg-slate-900/95 py-2 px-1 backdrop-blur-md"
          role="navigation"
          aria-label="Main Navigation"
        >
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;

            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex flex-col items-center justify-center px-2 py-1 transition-colors rounded-xl ${
                  isActive
                    ? 'text-cyan-400 font-semibold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                aria-label={item.label}
                aria-current={isActive ? 'page' : undefined}
              >
                <Icon className={`h-5 w-5 ${isActive ? 'stroke-[2.5px]' : 'stroke-2'}`} />
                <span className="mt-1 text-[10px] tracking-tight">{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>
    </div>
  );
}

