/**
 * @file App.tsx
 * @summary Root application component orchestrating authentication and app shell.
 * @description Renders the top-level AuthProvider and dynamically toggles between
 * the DemoLoginScreen and the mobile AppShell based on active session state.
 */

import React from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { TelemetryProvider } from './context/TelemetryContext';
import { DemoLoginScreen } from './components/auth/DemoLoginScreen';
import { AppShell } from './components/layout/AppShell';
import { DashboardView } from './components/dashboard/DashboardView';

/**
 * Inner application controller that accesses authentication context.
 *
 * @summary Main content router.
 * @description Selects either DemoLoginScreen (if unauthenticated) or AppShell
 * with DashboardView (if authenticated with an active Mediterranean farm profile).
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
      <DashboardView />
    </AppShell>
  );
}

/**
 * Root Application entry component.
 *
 * @summary Root component.
 * @description Wraps the application with AuthProvider and TelemetryProvider to provide farm session context.
 *
 * @returns React.JSX.Element representing the root application.
 * @throws Never throws.
 */
export default function App(): React.JSX.Element {
  return (
    <AuthProvider>
      <TelemetryProvider>
        <AppContent />
      </TelemetryProvider>
    </AuthProvider>
  );
}

