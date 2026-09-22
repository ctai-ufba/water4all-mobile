/**
 * @file PwaSurfaces.test.tsx
 * @summary Unit tests for the PWA shell surfaces.
 * @description Verifies the offline indicator, the install promotion banner, the notification
 * opt-in card and the critical alert toast stack: what each shows, what each stays silent about,
 * and which context action each triggers.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { NetworkStatusBanner } from '../NetworkStatusBanner';
import { InstallPromptBanner } from '../InstallPromptBanner';
import { AlertPermissionPrompt } from '../AlertPermissionPrompt';
import { CriticalAlertToasts, TOAST_DURATION_MS } from '../CriticalAlertToasts';
import * as PwaContextModule from '../../../context/PwaContext';
import { PwaContextType } from '../../../context/PwaContext';
import { CriticalAlert } from '../../../types/pwa';

const BREACH_ALERT: CriticalAlert = {
  id: 'blend-minimum-operating-volume',
  severity: 'critical',
  title: 'Critical water alert',
  body: 'Blend tank at 2.0 m³, below the 6.0 m³ minimum operating volume.',
  escalationStep: 4,
};

const RAIN_ALERT: CriticalAlert = {
  id: 'rainfall-forecast',
  severity: 'info',
  title: 'Rain forecast',
  body: '11.0 mm of rain forecast in the next 24 hours, about 3.1 m³ collectible.',
  escalationStep: 11,
};

const promptInstall = vi.fn().mockResolvedValue('accepted');
const dismissInstallBanner = vi.fn();
const enableNotifications = vi.fn().mockResolvedValue('granted');
const dismissAlert = vi.fn();

/**
 * Stubs the PWA context with a device that is online, installed and quiet.
 *
 * @param overrides - Fields the test needs to differ.
 * @returns void
 */
function stubPwaContext(overrides: Partial<PwaContextType> = {}): void {
  vi.spyOn(PwaContextModule, 'usePwa').mockReturnValue({
    isOnline: true,
    canInstall: false,
    promptInstall,
    dismissInstallBanner,
    notificationPermission: 'granted',
    enableNotifications,
    activeAlerts: [],
    dismissAlert,
    ...overrides,
  });
}

describe('PWA shell surfaces', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  describe('NetworkStatusBanner', () => {
    it('says nothing while the device is online', () => {
      stubPwaContext();

      const { container } = render(<NetworkStatusBanner />);

      expect(container).toBeEmptyDOMElement();
    });

    it('explains offline mode, naming what stays live and what falls back', () => {
      stubPwaContext({ isOnline: false });

      render(<NetworkStatusBanner />);

      const banner = screen.getByRole('status');
      expect(banner).toHaveTextContent(/offline mode/i);
      expect(banner).toHaveTextContent(/telemetry and controls stay\s+live/i);
      expect(banner).toHaveTextContent(/climate normals/i);
    });
  });

  describe('InstallPromptBanner', () => {
    it('stays hidden when the browser has offered no install prompt', () => {
      stubPwaContext({ canInstall: false });

      const { container } = render(<InstallPromptBanner />);

      expect(container).toBeEmptyDOMElement();
    });

    it('offers installation and hands off to the browser dialog', async () => {
      stubPwaContext({ canInstall: true });

      render(<InstallPromptBanner />);
      expect(screen.getByText(/add to your home screen/i)).toBeInTheDocument();

      // Awaited inside act: the button settles only once the browser dialog resolves.
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Install' }));
      });

      expect(promptInstall).toHaveBeenCalledTimes(1);
    });

    it('records a dismissal so the offer is not repeated', () => {
      stubPwaContext({ canInstall: true });

      render(<InstallPromptBanner />);
      fireEvent.click(screen.getByRole('button', { name: /dismiss install banner/i }));

      expect(dismissInstallBanner).toHaveBeenCalledTimes(1);
    });
  });

  describe('AlertPermissionPrompt', () => {
    it.each(['granted', 'denied', 'unsupported'] as const)(
      'asks nothing once notifications are %s',
      (permission) => {
        stubPwaContext({ notificationPermission: permission });

        const { container } = render(<AlertPermissionPrompt />);

        expect(container).toBeEmptyDOMElement();
      }
    );

    it('requests permission from the operator gesture', () => {
      stubPwaContext({ notificationPermission: 'default' });

      render(<AlertPermissionPrompt />);
      fireEvent.click(screen.getByRole('button', { name: 'Enable alerts' }));

      expect(enableNotifications).toHaveBeenCalledTimes(1);
    });

    it('can be dismissed without answering the permission question', () => {
      stubPwaContext({ notificationPermission: 'default' });

      render(<AlertPermissionPrompt />);
      fireEvent.click(screen.getByRole('button', { name: /dismiss alert permission prompt/i }));

      expect(screen.queryByRole('button', { name: 'Enable alerts' })).not.toBeInTheDocument();
      expect(enableNotifications).not.toHaveBeenCalled();
    });
  });

  describe('CriticalAlertToasts', () => {
    it('renders nothing while no condition holds', () => {
      stubPwaContext({ activeAlerts: [] });

      const { container } = render(<CriticalAlertToasts />);

      expect(container).toBeEmptyDOMElement();
    });

    it('announces a breach assertively and a forecast politely', () => {
      stubPwaContext({ activeAlerts: [BREACH_ALERT, RAIN_ALERT] });

      render(<CriticalAlertToasts />);

      expect(screen.getByRole('alert')).toHaveTextContent(BREACH_ALERT.body);
      expect(screen.getByRole('status')).toHaveTextContent(RAIN_ALERT.body);
    });

    it('dismisses the condition the toast reports', () => {
      stubPwaContext({ activeAlerts: [BREACH_ALERT] });

      render(<CriticalAlertToasts />);
      fireEvent.click(screen.getByRole('button', { name: /dismiss alert/i }));

      expect(dismissAlert).toHaveBeenCalledWith(BREACH_ALERT.id);
    });

    it('stands down on its own so it stops covering the figures underneath', () => {
      vi.useFakeTimers();
      stubPwaContext({ activeAlerts: [BREACH_ALERT] });

      try {
        render(<CriticalAlertToasts />);

        act(() => {
          vi.advanceTimersByTime(TOAST_DURATION_MS.critical - 1);
        });
        expect(dismissAlert).not.toHaveBeenCalled();

        act(() => {
          vi.advanceTimersByTime(1);
        });
        expect(dismissAlert).toHaveBeenCalledWith(BREACH_ALERT.id);
      } finally {
        vi.useRealTimers();
      }
    });

    it('lets a forecast stand down sooner than a breach', () => {
      expect(TOAST_DURATION_MS.info).toBeLessThan(TOAST_DURATION_MS.critical);
    });
  });
});
