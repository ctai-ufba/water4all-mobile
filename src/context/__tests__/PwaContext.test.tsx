/**
 * @file PwaContext.test.tsx
 * @summary Integration tests for PwaContext and PwaProvider.
 * @description Verifies offline state handling, capture and use of the deferred install prompt,
 * the notification permission flow, and that a persisting farm condition is announced to the
 * operating system once rather than on every telemetry recomputation.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { PwaProvider, usePwa, INSTALL_DISMISSED_STORAGE_KEY } from '../PwaContext';
import * as AuthContextModule from '../AuthContext';
import * as TelemetryContextModule from '../TelemetryContext';
import * as WeatherContextModule from '../WeatherContext';
import * as NotificationServiceModule from '../../services/notificationService';
import { FARM_PROFILES } from '../../types/farm';
import { BASELINE_TELEMETRY, TelemetryState } from '../../types/telemetry';
import { WeatherData } from '../../types/weather';
import { BeforeInstallPromptEvent } from '../../types/pwa';

const ACTIVE_FARM = FARM_PROFILES['small-farm'];

/** Weather with a dry sky, so only the tests that want a rain alert raise one. */
const DRY_WEATHER: WeatherData = {
  temperatureC: 22,
  relativeHumidityPct: 60,
  currentPrecipitationMm: 0,
  precipitationForecast24hMm: 0,
  isOfflineFallback: false,
  timestamp: '2026-09-22T12:00:00Z',
  hourly: {
    temperatureC: [22],
    relativeHumidityPct: [60],
    startTime: '2026-09-22T12:00:00Z',
  },
};

function TestPwaConsumer(): React.JSX.Element {
  const {
    isOnline,
    canInstall,
    promptInstall,
    dismissInstallBanner,
    notificationPermission,
    enableNotifications,
    activeAlerts,
    dismissAlert,
  } = usePwa();

  return (
    <div>
      <div data-testid="connectivity">{isOnline ? 'online' : 'offline'}</div>
      <div data-testid="can-install">{canInstall ? 'yes' : 'no'}</div>
      <div data-testid="permission">{notificationPermission}</div>
      <div data-testid="alert-ids">{activeAlerts.map((alert) => alert.id).join(',')}</div>

      <button onClick={() => void promptInstall()}>Install</button>
      <button onClick={dismissInstallBanner}>Dismiss Install</button>
      <button onClick={() => void enableNotifications()}>Enable Alerts</button>
      <button onClick={() => activeAlerts.forEach((alert) => dismissAlert(alert.id))}>
        Dismiss Alerts
      </button>
    </div>
  );
}

/**
 * Mounts the provider with the surrounding contexts stubbed.
 *
 * @param telemetry - Telemetry state the alert derivation reads, or null when unauthenticated.
 * @param weather - Weather reading the alert derivation reads.
 * @returns void
 */
function renderProvider(
  telemetry: TelemetryState | null,
  weather: WeatherData | null = DRY_WEATHER
): { setTelemetry: (next: TelemetryState) => void } {
  vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
    activeFarm: ACTIVE_FARM,
    isAuthenticated: true,
    login: vi.fn(),
    logout: vi.fn(),
    switchFarm: vi.fn(),
  });
  mockTelemetry(telemetry);
  vi.spyOn(WeatherContextModule, 'useWeather').mockReturnValue({
    weather,
    loading: false,
    esaProduction: null,
    esaInstantaneous: null,
    esaForecast24h: null,
    catchmentEstimate: null,
    refetch: vi.fn(),
    setCustomWeather: vi.fn(),
  });

  // A fresh element every time: React bails out of a re-render handed the identical element.
  const tree = (): React.JSX.Element => (
    <PwaProvider>
      <TestPwaConsumer />
    </PwaProvider>
  );
  const { rerender } = render(tree());

  return {
    setTelemetry: (next: TelemetryState): void => {
      mockTelemetry(next);
      rerender(tree());
    },
  };
}

/**
 * Points the telemetry hook at one state.
 *
 * @param telemetry - Telemetry state to report, or null when unauthenticated.
 * @returns void
 */
function mockTelemetry(telemetry: TelemetryState | null): void {
  vi.spyOn(TelemetryContextModule, 'useTelemetry').mockReturnValue({
    telemetry,
    setTankVolumes: vi.fn(),
    setFlows: vi.fn(),
    setIrrigationMode: vi.fn(),
    requestWaterTruck: vi.fn(),
    executePumpTransfer: vi.fn(),
    resetToBaseline: vi.fn(),
    applySnapshot: vi.fn(),
    scheduledIrrigationDemand: BASELINE_TELEMETRY['small-farm'].flows.irrigationDemand,
    history: [],
    recordTimeAdvance: vi.fn(),
  });
}

/**
 * Builds telemetry whose Blend tank sits at the requested volume.
 *
 * @param blendVolumeM3 - Volume to report for the Blend tank.
 * @returns A telemetry state carrying that volume; other figures are irrelevant to alerts.
 */
function telemetryWithBlendVolume(blendVolumeM3: number): TelemetryState {
  const baseline = BASELINE_TELEMETRY['small-farm'];

  return {
    tankVolumes: { ...baseline.volumes, blend: blendVolumeM3 },
    flows: baseline.flows,
    totalStoredVolume: blendVolumeM3,
    totalInflow: 0,
    totalConsumption: 0,
    waterAutonomyDays: 0,
    netBalance: 0,
    isSurplus: false,
    localWaterPercentage: 0,
    dailySavingsEur: 0,
    avoidedTruckCostEur: 0,
    esaEnergyCostEur: 0,
    isBelowMinOperatingVolume: blendVolumeM3 < ACTIVE_FARM.tankCapacities.minOperatingVolume,
    blendDeficitM3: Math.max(0, ACTIVE_FARM.tankCapacities.minOperatingVolume - blendVolumeM3),
    irrigationMode: 'auto',
    cumulativeTruckDeliveryCostEur: 0,
  };
}

/**
 * Dispatches a `beforeinstallprompt` event carrying a controllable user choice.
 *
 * @param outcome - Choice the fake dialog resolves with.
 * @returns The dispatched event, so tests can assert it was intercepted.
 */
function dispatchInstallPrompt(outcome: 'accepted' | 'dismissed'): BeforeInstallPromptEvent {
  const event = new Event('beforeinstallprompt', { cancelable: true });
  Object.assign(event, {
    prompt: vi.fn().mockResolvedValue(undefined),
    userChoice: Promise.resolve({ outcome }),
  });

  act(() => {
    window.dispatchEvent(event);
  });

  return event as BeforeInstallPromptEvent;
}

describe('PwaContext Seam', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('throws when usePwa is used outside a PwaProvider', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => render(<TestPwaConsumer />)).toThrow('usePwa must be used within a PwaProvider');

    consoleSpy.mockRestore();
  });

  describe('connectivity', () => {
    it('reports the device offline when the browser loses its connection', () => {
      renderProvider(null);
      expect(screen.getByTestId('connectivity')).toHaveTextContent('online');

      act(() => {
        window.dispatchEvent(new Event('offline'));
      });
      expect(screen.getByTestId('connectivity')).toHaveTextContent('offline');

      act(() => {
        window.dispatchEvent(new Event('online'));
      });
      expect(screen.getByTestId('connectivity')).toHaveTextContent('online');
    });
  });

  describe('installability', () => {
    it('offers installation once the browser defers its prompt', () => {
      renderProvider(null);
      expect(screen.getByTestId('can-install')).toHaveTextContent('no');

      const event = dispatchInstallPrompt('accepted');

      expect(screen.getByTestId('can-install')).toHaveTextContent('yes');
      // The browser's own banner is suppressed, so the app owes the operator an affordance.
      expect(event.defaultPrevented).toBe(true);
    });

    it('shows the browser dialog once and clears the single-use prompt', async () => {
      renderProvider(null);
      const event = dispatchInstallPrompt('accepted');

      fireEvent.click(screen.getByRole('button', { name: 'Install' }));

      await waitFor(() => expect(screen.getByTestId('can-install')).toHaveTextContent('no'));
      expect(event.prompt).toHaveBeenCalledTimes(1);
    });

    it('remembers a dismissal so the banner is not offered again on this device', () => {
      renderProvider(null);
      dispatchInstallPrompt('dismissed');

      fireEvent.click(screen.getByRole('button', { name: 'Dismiss Install' }));

      expect(screen.getByTestId('can-install')).toHaveTextContent('no');
      expect(localStorage.getItem(INSTALL_DISMISSED_STORAGE_KEY)).toBe('true');
    });
  });

  describe('notifications', () => {
    it('adopts the permission the operator chose', async () => {
      vi.spyOn(NotificationServiceModule, 'requestNotificationPermission').mockResolvedValue(
        'granted'
      );
      renderProvider(null);

      fireEvent.click(screen.getByRole('button', { name: 'Enable Alerts' }));

      await waitFor(() => expect(screen.getByTestId('permission')).toHaveTextContent('granted'));
    });
  });

  describe('critical alerts', () => {
    it('raises no alert while no farm session is active', () => {
      renderProvider(null);

      expect(screen.getByTestId('alert-ids')).toHaveTextContent('');
    });

    it('raises and announces a minimum operating volume breach', async () => {
      const announce = vi.spyOn(NotificationServiceModule, 'announceAlert').mockReturnValue(true);
      renderProvider(telemetryWithBlendVolume(1));

      expect(screen.getByTestId('alert-ids')).toHaveTextContent(
        'blend-minimum-operating-volume'
      );
      await waitFor(() => expect(announce).toHaveBeenCalledTimes(1));
    });

    it('announces a persisting breach once, however often telemetry recomputes', async () => {
      const announce = vi.spyOn(NotificationServiceModule, 'announceAlert').mockReturnValue(true);
      renderProvider(telemetryWithBlendVolume(1));

      await waitFor(() => expect(announce).toHaveBeenCalledTimes(1));

      // A connectivity change re-renders the provider without changing the farm's condition.
      act(() => {
        window.dispatchEvent(new Event('offline'));
      });

      expect(announce).toHaveBeenCalledTimes(1);
    });

    it('says nothing to the operator while the tank refills', async () => {
      const announce = vi.spyOn(NotificationServiceModule, 'announceAlert').mockReturnValue(true);
      const { setTelemetry } = renderProvider(telemetryWithBlendVolume(1));

      await waitFor(() => expect(announce).toHaveBeenCalledTimes(1));

      // A truck arrives and the tank climbs back through the steps it fell past.
      [2, 3, 4, 5].forEach((blendVolumeM3) => {
        act(() => setTelemetry(telemetryWithBlendVolume(blendVolumeM3)));
      });

      expect(announce).toHaveBeenCalledTimes(1);
      // Still breached, so the toast stays up; it just stopped shouting.
      expect(screen.getByTestId('alert-ids')).toHaveTextContent('blend-minimum-operating-volume');
    });

    it('keeps a dismissal while the condition merely persists', () => {
      const { setTelemetry } = renderProvider(telemetryWithBlendVolume(3));

      fireEvent.click(screen.getByRole('button', { name: 'Dismiss Alerts' }));
      expect(screen.getByTestId('alert-ids')).toHaveTextContent('');

      act(() => setTelemetry(telemetryWithBlendVolume(3.4)));

      expect(screen.getByTestId('alert-ids')).toHaveTextContent('');
    });

    it('brings a dismissed alert back when the breach deepens', () => {
      const { setTelemetry } = renderProvider(telemetryWithBlendVolume(3));

      fireEvent.click(screen.getByRole('button', { name: 'Dismiss Alerts' }));
      expect(screen.getByTestId('alert-ids')).toHaveTextContent('');

      // A whole cubic metre further down is worse news than the operator dismissed.
      act(() => setTelemetry(telemetryWithBlendVolume(1.5)));

      expect(screen.getByTestId('alert-ids')).toHaveTextContent(
        'blend-minimum-operating-volume'
      );
    });

    it('raises a rain forecast alert from the weather reading', () => {
      renderProvider(telemetryWithBlendVolume(20), {
        ...DRY_WEATHER,
        precipitationForecast24hMm: 11,
      });

      expect(screen.getByTestId('alert-ids')).toHaveTextContent('rainfall-forecast');
    });

    it('hides a dismissed alert while its condition is unchanged', () => {
      renderProvider(telemetryWithBlendVolume(1));

      fireEvent.click(screen.getByRole('button', { name: 'Dismiss Alerts' }));

      expect(screen.getByTestId('alert-ids')).toHaveTextContent('');
    });
  });
});
