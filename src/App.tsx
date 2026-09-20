/**
 * @file App.tsx
 * @summary Root application component orchestrating authentication and app shell.
 * @description Renders the top-level AuthProvider and dynamically toggles between
 * the DemoLoginScreen and the mobile AppShell based on active session state.
 */

import React from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { DemoLoginScreen } from './components/auth/DemoLoginScreen';
import { AppShell } from './components/layout/AppShell';

/**
 * Inner application controller that accesses authentication context.
 *
 * @summary Main content router.
 * @description Selects either DemoLoginScreen (if unauthenticated) or AppShell
 * (if authenticated with an active Mediterranean farm profile).
 *
 * @returns React.JSX.Element representing the current application view.
 * @throws Never throws.
 */
function AppContent(): React.JSX.Element {
  const { isAuthenticated, activeFarm } = useAuth();

  // If no farm session is active, present the 1-click demo login screen
  if (!isAuthenticated || !activeFarm) {
    return <DemoLoginScreen />;
  }

  // When authenticated, display the mobile app shell with dashboard overview
  return (
    <AppShell>
      <div className="space-y-4">
        {/* Farm Welcome Banner */}
        <div className="rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800/80 p-4 shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-cyan-400">
                Active Farm Operations
              </span>
              <h2 className="text-lg font-bold text-white">
                {activeFarm.estateName}
              </h2>
            </div>
            <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-400 ring-1 ring-emerald-500/20">
              Live Monitoring
            </span>
          </div>

          <p className="mt-2 text-xs leading-relaxed text-slate-300">
            {activeFarm.description}
          </p>

          <div className="mt-4 grid grid-cols-2 gap-2 border-t border-slate-800/80 pt-3 text-xs">
            <div>
              <span className="text-slate-400">Cultivated Area:</span>
              <p className="font-semibold text-white">{activeFarm.areaHa} ha</p>
            </div>
            <div>
              <span className="text-slate-400">Main Crops:</span>
              <p className="truncate font-semibold text-white">
                {activeFarm.crops.join(', ')}
              </p>
            </div>
          </div>
        </div>

        {/* Getting Started Guide */}
        <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
            System Initialization
          </h3>
          <p className="mt-1 text-xs text-slate-400">
            App Shell initialized. Next: Water Autonomy Gauge &amp; Dashboard (Issue 02).
          </p>
        </div>
      </div>
    </AppShell>
  );
}

/**
 * Root Application entry component.
 *
 * @summary Root component.
 * @description Wraps the application with AuthProvider to provide farm session context.
 *
 * @returns React.JSX.Element representing the root application.
 * @throws Never throws.
 */
export default function App(): React.JSX.Element {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

