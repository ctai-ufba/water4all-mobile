/**
 * @file AppShell.test.tsx
 * @summary Unit and integration tests for AppShell component.
 * @description Verifies that AppShell wraps the page with a mobile-first frame,
 * contains the header, renders children content, provides bottom navigation tabs,
 * and opens the Demo Controller Drawer via the persistent floating action trigger.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AppShell } from '../AppShell';
import * as AuthContextModule from '../../../context/AuthContext';
import * as DemoContextModule from '../../../context/DemoContext';
import * as TelemetryContextModule from '../../../context/TelemetryContext';
import * as PwaContextModule from '../../../context/PwaContext';
import { FARM_PROFILES } from '../../../types/farm';
import { BASELINE_TELEMETRY } from '../../../types/telemetry';

describe('AppShell Seam', () => {
  const activeFarm = FARM_PROFILES['small-farm'];
  const openDrawerMock = vi.fn();

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      activeFarm,
      isAuthenticated: true,
      login: vi.fn(),
      logout: vi.fn(),
      switchFarm: vi.fn(),
    });
    // The Demo drawer reads telemetry for the baseline summary, so the shell needs it mounted
    // even in the tests that only exercise navigation.
    vi.spyOn(TelemetryContextModule, 'useTelemetry').mockReturnValue({
      telemetry: null,
      setTankVolumes: vi.fn(),
      setFlows: vi.fn(),
      setIrrigationMode: vi.fn(),
      requestWaterTruck: vi.fn(),
      executePumpTransfer: vi.fn(),
      resetToBaseline: vi.fn(),
      applySnapshot: vi.fn(),
      scheduledIrrigationDemand: BASELINE_TELEMETRY['small-farm'].flows.irrigationDemand,
    });
    // The shell mounts the offline indicator, the notification opt-in and the alert dock, all of
    // which read PWA state; an online device with notifications already decided shows none of them.
    vi.spyOn(PwaContextModule, 'usePwa').mockReturnValue({
      isOnline: true,
      canInstall: false,
      promptInstall: vi.fn(),
      dismissInstallBanner: vi.fn(),
      notificationPermission: 'granted',
      enableNotifications: vi.fn(),
      activeAlerts: [],
      dismissAlert: vi.fn(),
    });
    vi.spyOn(DemoContextModule, 'useDemo').mockReturnValue({
      scenario: 'live',
      isUnoptimizedBaseline: false,
      qualityRegime: 'balanced',
      simulatedDate: new Date(),
      elapsedSimulatedHours: 0,
      isDrawerOpen: false,
      isOptimizing: false,
      optimizationProgress: 0,
      optimizationPhase: '',
      openDrawer: openDrawerMock,
      closeDrawer: vi.fn(),
      selectScenario: vi.fn(),
      toggleUnoptimizedBaseline: vi.fn(),
      advanceTime: vi.fn(),
      resetTime: vi.fn(),
      runOptimization: vi.fn(),
      resetDemo: vi.fn(),
    });
  });

  it('renders header, children content, and bottom navigation structure', () => {
    render(
      <AppShell>
        <div data-testid="dashboard-content">Custom Content View</div>
      </AppShell>
    );

    // Header content present
    expect(screen.getByText(activeFarm.name)).toBeInTheDocument();

    // Children content rendered
    expect(screen.getByTestId('dashboard-content')).toBeInTheDocument();

    // Navigation bar tabs present (4 primary views)
    expect(screen.getByRole('navigation')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Dashboard' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Weather' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tanks' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Quality' })).toBeInTheDocument();

    // Floating Demo Presentation Trigger present
    expect(screen.getByTestId('demo-floating-trigger')).toBeInTheDocument();
  });

  it('switches to tab view placeholder when a different navigation tab is selected', () => {
    render(
      <AppShell>
        <div data-testid="dashboard-content">Dashboard Content</div>
      </AppShell>
    );

    // Click Weather tab
    const weatherButton = screen.getByRole('button', { name: 'Weather' });
    fireEvent.click(weatherButton);

    // Verify Weather view placeholder is displayed
    expect(screen.getByText('Weather View')).toBeInTheDocument();
    expect(screen.queryByTestId('dashboard-content')).not.toBeInTheDocument();
  });

  it('triggers openDrawer when the Demo floating trigger is clicked', () => {
    render(
      <AppShell>
        <div data-testid="dashboard-content">Dashboard Content</div>
      </AppShell>
    );

    const demoTrigger = screen.getByTestId('demo-floating-trigger');
    fireEvent.click(demoTrigger);

    expect(openDrawerMock).toHaveBeenCalledTimes(1);
  });

  describe('tab navigation exposed to views', () => {
    it('hands the render prop the active tab and a callback that switches tabs', () => {
      render(
        <AppShell>
          {(tab, navigate) => (
            <div>
              <span data-testid="active-tab">{tab}</span>
              <button type="button" onClick={() => navigate('weather')}>
                Open Weather
              </button>
            </div>
          )}
        </AppShell>
      );

      expect(screen.getByTestId('active-tab')).toHaveTextContent('dashboard');

      fireEvent.click(screen.getByRole('button', { name: 'Open Weather' }));

      expect(screen.getByTestId('active-tab')).toHaveTextContent('weather');
    });
  });

  describe('third-party attribution', () => {
    it('credits map tiles, radar and weather data, each linked to its source', () => {
      render(
        <AppShell>
          <div data-testid="dashboard-content">Dashboard Content</div>
        </AppShell>
      );

      expect(screen.getByRole('link', { name: /OpenStreetMap/i })).toHaveAttribute(
        'href',
        'https://www.openstreetmap.org/copyright'
      );
      expect(screen.getByRole('link', { name: /RainViewer/i })).toHaveAttribute(
        'href',
        'https://www.rainviewer.com/'
      );

      const source = screen.getByRole('link', { name: /Open-Meteo\.com/i });
      expect(source).toHaveAttribute('href', 'https://open-meteo.com/');

      const licence = screen.getByRole('link', { name: /CC BY 4\.0/i });
      expect(licence).toHaveAttribute('href', 'https://creativecommons.org/licenses/by/4.0/');
    });

    it('keeps the attribution visible on every tab', () => {
      render(
        <AppShell>
          <div data-testid="dashboard-content">Dashboard Content</div>
        </AppShell>
      );

      // The licences cover data the app is built on, not one screen that happens to show it, so
      // this can be neither a dashboard-only nor a Weather-tab-only credit.
      for (const tab of ['Weather', 'Tanks', 'Quality', 'Dashboard']) {
        fireEvent.click(screen.getByRole('button', { name: tab }));
        expect(screen.getByRole('link', { name: /OpenStreetMap/i })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: /RainViewer/i })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: /Open-Meteo\.com/i })).toBeInTheDocument();
      }
    });
  });
});
