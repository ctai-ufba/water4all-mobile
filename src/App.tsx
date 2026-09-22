/**
 * @file App.tsx
 * @summary Root application component orchestrating authentication and app shell.
 * @description Renders the top-level AuthProvider and dynamically toggles between
 * the DemoLoginScreen and the mobile AppShell based on active session state.
 */

import React from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { TelemetryProvider } from './context/TelemetryContext';
import { WeatherProvider } from './context/WeatherContext';
import { DemoProvider } from './context/DemoContext';
import { DemoLoginScreen } from './components/auth/DemoLoginScreen';
import { AppShell, NavTab, NavigateToTab } from './components/layout/AppShell';
import { DashboardView } from './components/dashboard/DashboardView';
import { TanksView } from './components/tanks/TanksView';
import { QualityView } from './components/quality/QualityView';
import { WeatherView } from './components/weather/WeatherView';

/**
 * Resolves the view component corresponding to the active navigation tab.
 *
 * @summary Tab view router.
 * @description Maps the selected navigation tab to its corresponding top-level screen:
 * - 'quality': Renders the dedicated Water Quality & FAO Crop Compliance screen.
 * - 'tanks': Renders the dedicated TanksView monitoring screen.
 * - 'weather': Renders the dedicated Weather, ESA physics and radar screen.
 * - 'dashboard': Renders the primary DashboardView overview, which can navigate to other tabs.
 * - other tabs: Returns undefined to allow AppShell to render the module placeholder.
 *
 * @param activeTab - Identifier of the currently selected navigation tab.
 * @param navigate - Shell callback a view uses to move to another tab.
 * @returns React.ReactNode representing the view component, or undefined for unhandled tabs.
 * @throws Never throws.
 */
function renderAppTab(activeTab: NavTab, navigate: NavigateToTab): React.ReactNode {
  switch (activeTab) {
    case 'quality':
      return <QualityView />;
    case 'tanks':
      return <TanksView />;
    case 'weather':
      return <WeatherView />;
    case 'dashboard':
      return <DashboardView onNavigate={navigate} />;
    default:
      return undefined;
  }
}

/**
 * Inner application controller that accesses authentication context.
 *
 * @summary Main content router.
 * @description Selects either DemoLoginScreen (if unauthenticated) or AppShell
 * with active tab routing (DashboardView, TanksView, etc.) when authenticated.
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

  // When authenticated, display the mobile app shell with active tab rendering
  return (
    <AppShell>
      {renderAppTab}
    </AppShell>
  );
}

/**
 * Root Application entry component.
 *
 * @summary Root component.
 * @description Wraps the application with AuthProvider, TelemetryProvider, and WeatherProvider.
 *
 * @returns React.JSX.Element representing the root application.
 * @throws Never throws.
 */
export default function App(): React.JSX.Element {
  return (
    <AuthProvider>
      <TelemetryProvider>
        <WeatherProvider>
          <DemoProvider>
            <AppContent />
          </DemoProvider>
        </WeatherProvider>
      </TelemetryProvider>
    </AuthProvider>
  );
}

