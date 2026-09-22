/**
 * @file notificationService.test.ts
 * @summary Unit tests for browser notification delivery.
 * @description Verifies permission reporting across supported and unsupported browsers, and that
 * an alert is only raised when granted, is tagged so it replaces its predecessor, and survives a
 * browser that forbids the constructor outright.
 */

import { describe, it, expect, vi } from 'vitest';
import {
  announceAlert,
  getNotificationPermission,
  requestNotificationPermission,
  NotificationApi,
} from '../notificationService';
import { CriticalAlert } from '../../types/pwa';

const ALERT: CriticalAlert = {
  id: 'blend-minimum-operating-volume',
  severity: 'critical',
  title: 'Critical water alert',
  body: 'Blend tank at 2.0 m³, below the 6.0 m³ minimum operating volume.',
  escalationStep: 4,
};

/**
 * Builds a Notification API stand-in that records what it was constructed with.
 *
 * @param permission - Permission the fake reports.
 * @param requestResult - Permission the fake resolves a request with; defaults to `permission`.
 * @returns The fake constructor together with the constructions it recorded.
 */
function fakeNotificationApi(
  permission: string,
  requestResult: string | Error = permission
): { api: NotificationApi; raised: Array<{ title: string; options?: NotificationOptions }> } {
  const raised: Array<{ title: string; options?: NotificationOptions }> = [];

  class FakeNotification {
    constructor(title: string, options?: NotificationOptions) {
      raised.push({ title, options });
    }

    static permission = permission;

    static requestPermission = (): Promise<string> =>
      requestResult instanceof Error
        ? Promise.reject(requestResult)
        : Promise.resolve(requestResult);
  }

  return { api: FakeNotification as unknown as NotificationApi, raised };
}

describe('notificationService Seam', () => {
  describe('getNotificationPermission', () => {
    it('reports an absent Notification API as unsupported rather than denied', () => {
      expect(getNotificationPermission(undefined)).toBe('unsupported');
    });

    it.each(['granted', 'denied', 'default'])('passes through the %s permission', (permission) => {
      expect(getNotificationPermission(fakeNotificationApi(permission).api)).toBe(permission);
    });

    it('treats an unrecognised permission value as undecided', () => {
      expect(getNotificationPermission(fakeNotificationApi('unknown').api)).toBe('default');
    });
  });

  describe('requestNotificationPermission', () => {
    it('returns the permission the operator chose', async () => {
      const { api } = fakeNotificationApi('default', 'granted');

      await expect(requestNotificationPermission(api)).resolves.toBe('granted');
    });

    it('treats a rejected request as a denial', async () => {
      const { api } = fakeNotificationApi('default', new Error('gesture required'));

      await expect(requestNotificationPermission(api)).resolves.toBe('denied');
    });

    it('reports unsupported without prompting when there is no API', async () => {
      await expect(requestNotificationPermission(undefined)).resolves.toBe('unsupported');
    });
  });

  describe('announceAlert', () => {
    it('raises a notification tagged with the condition, so it replaces its predecessor', () => {
      const { api, raised } = fakeNotificationApi('granted');

      expect(announceAlert(ALERT, api)).toBe(true);
      expect(raised).toEqual([
        { title: ALERT.title, options: { body: ALERT.body, tag: ALERT.id } },
      ]);
    });

    it.each(['denied', 'default'])('raises nothing while permission is %s', (permission) => {
      const { api, raised } = fakeNotificationApi(permission);

      expect(announceAlert(ALERT, api)).toBe(false);
      expect(raised).toEqual([]);
    });

    it('reports failure instead of throwing where the constructor is forbidden', () => {
      const api = {
        permission: 'granted',
        requestPermission: vi.fn(),
      } as unknown as NotificationApi;
      // Android Chrome throws an "Illegal constructor" TypeError outside a service worker.
      const forbidding = new Proxy(api, {
        construct() {
          throw new TypeError('Illegal constructor');
        },
      });

      expect(announceAlert(ALERT, forbidding)).toBe(false);
    });
  });
});
