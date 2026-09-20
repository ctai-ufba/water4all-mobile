/**
 * @file AppShell.tsx
 * @summary Responsive mobile application shell with top header and bottom navigation.
 * @description Provides the mobile-first viewport wrapper for Water4All, housing the
 * persistent Header, scrollable content view, and touch-friendly bottom navigation bar.
 */

import React, { ReactNode, useState } from 'react';
import { LayoutDashboard, CloudSun, Cylinder, ShieldCheck, Sliders } from 'lucide-react';
import { Header } from './Header';

/**
 * Available primary navigation tab identifiers.
 */
export type NavTab = 'dashboard' | 'weather' | 'tanks' | 'quality' | 'demo';

/**
 * Props for the AppShell component.
 */
export interface AppShellProps {
  /** Page or view contents rendered within the application frame, or a render function receiving activeTab */
  children?: ReactNode | ((tab: NavTab) => ReactNode);
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
  { id: 'demo', label: 'Demo', icon: Sliders },
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

  // Render view content based on activeTab
  const renderContent = (): ReactNode => {
    if (typeof children === 'function') {
      return children(activeTab);
    }

    // When static children are provided, render them on dashboard tab
    if (activeTab === 'dashboard' && children) {
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

        {/* Scrollable Main Content Area */}
        <main className="flex-1 overflow-y-auto px-4 py-4 pb-20">
          {renderContent()}
        </main>

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

