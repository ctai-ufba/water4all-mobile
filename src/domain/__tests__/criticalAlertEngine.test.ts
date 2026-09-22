/**
 * @file criticalAlertEngine.test.ts
 * @summary Unit tests for the critical alert derivation and announcement policy.
 * @description Verifies which farm conditions raise an alert, the figures the alert carries, and
 * the escalation rule that stops a persisting or recovering condition from notifying the operator
 * repeatedly while still letting a deteriorating one speak again.
 */

import { describe, it, expect } from 'vitest';
import {
  deriveCriticalAlerts,
  selectAlertsToAnnounce,
  RAINFALL_ALERT_THRESHOLD_MM,
  BLEND_DEFICIT_REANNOUNCE_STEP_M3,
  CriticalAlertConditions,
} from '../criticalAlertEngine';

/** Conditions of a healthy farm under a dry sky: no alert of any kind. */
const QUIET_CONDITIONS: CriticalAlertConditions = {
  blendVolumeM3: 12,
  minOperatingVolumeM3: 6,
  precipitationForecast24hMm: 0,
};

describe('criticalAlertEngine Seam', () => {
  describe('deriveCriticalAlerts', () => {
    it('raises nothing while the Blend tank is healthy and the sky is dry', () => {
      expect(deriveCriticalAlerts(QUIET_CONDITIONS)).toEqual([]);
    });

    it('raises a critical alert when the Blend tank falls below minimum operating volume', () => {
      const [alert] = deriveCriticalAlerts({
        ...QUIET_CONDITIONS,
        blendVolumeM3: 3.4,
        minOperatingVolumeM3: 6,
      });

      expect(alert.id).toBe('blend-minimum-operating-volume');
      expect(alert.severity).toBe('critical');
      // The operator is told the level, the threshold and what it takes to clear the breach.
      expect(alert.body).toContain('3.4 m³');
      expect(alert.body).toContain('6.0 m³');
      expect(alert.body).toContain('2.6 m³');
    });

    it('treats a volume exactly at the minimum operating volume as compliant', () => {
      expect(
        deriveCriticalAlerts({ ...QUIET_CONDITIONS, blendVolumeM3: 6, minOperatingVolumeM3: 6 })
      ).toEqual([]);
    });

    it('raises the rain alert at the announcement threshold and carries the collectible volume', () => {
      const [alert] = deriveCriticalAlerts({
        ...QUIET_CONDITIONS,
        precipitationForecast24hMm: RAINFALL_ALERT_THRESHOLD_MM,
        catchmentInflowM3: 1.23,
      });

      expect(alert.id).toBe('rainfall-forecast');
      expect(alert.severity).toBe('info');
      expect(alert.body).toContain('1.0 mm');
      expect(alert.body).toContain('1.2 m³');
    });

    it('stays silent on a trace of rain below the announcement threshold', () => {
      expect(
        deriveCriticalAlerts({
          ...QUIET_CONDITIONS,
          precipitationForecast24hMm: RAINFALL_ALERT_THRESHOLD_MM - 0.1,
        })
      ).toEqual([]);
    });

    it('omits the collectible volume when no catchment estimate is available', () => {
      const [alert] = deriveCriticalAlerts({
        ...QUIET_CONDITIONS,
        precipitationForecast24hMm: 9,
      });

      expect(alert.body).toContain('9.0 mm');
      expect(alert.body).not.toContain('collectible');
    });

    it('orders the volume breach ahead of the rain forecast', () => {
      const alerts = deriveCriticalAlerts({
        blendVolumeM3: 1,
        minOperatingVolumeM3: 6,
        precipitationForecast24hMm: 12,
        catchmentInflowM3: 3,
      });

      expect(alerts.map((alert) => alert.id)).toEqual([
        'blend-minimum-operating-volume',
        'rainfall-forecast',
      ]);
    });
  });

  describe('selectAlertsToAnnounce', () => {
    /**
     * Replays a sequence of Blend tank volumes through the policy.
     *
     * @param volumesM3 - Volumes the tank passes through, in order.
     * @returns One entry per volume: true where the breach was announced.
     */
    function announcementsAcross(volumesM3: number[]): boolean[] {
      let announced = selectAlertsToAnnounce([], []).nextAnnounced;

      return volumesM3.map((blendVolumeM3) => {
        const plan = selectAlertsToAnnounce(
          deriveCriticalAlerts({ ...QUIET_CONDITIONS, blendVolumeM3 }),
          announced
        );
        announced = plan.nextAnnounced;
        return plan.announce.length > 0;
      });
    }

    it('announces a newly raised alert', () => {
      const alerts = deriveCriticalAlerts({ ...QUIET_CONDITIONS, blendVolumeM3: 2 });

      const plan = selectAlertsToAnnounce(alerts, []);

      expect(plan.announce).toEqual(alerts);
      expect(plan.nextAnnounced).toEqual([
        { id: 'blend-minimum-operating-volume', step: alerts[0].escalationStep },
      ]);
    });

    it('stays silent while the same breach persists across recomputations', () => {
      const first = deriveCriticalAlerts({ ...QUIET_CONDITIONS, blendVolumeM3: 2 });
      const announced = selectAlertsToAnnounce(first, []).nextAnnounced;

      // The tank drains slightly, within the escalation step: the same situation.
      const second = deriveCriticalAlerts({ ...QUIET_CONDITIONS, blendVolumeM3: 1.9 });

      expect(selectAlertsToAnnounce(second, announced).announce).toEqual([]);
    });

    it('announces again once the deficit deepens past the escalation step', () => {
      const first = deriveCriticalAlerts({ ...QUIET_CONDITIONS, blendVolumeM3: 4 });
      const announced = selectAlertsToAnnounce(first, []).nextAnnounced;

      const deeper = deriveCriticalAlerts({
        ...QUIET_CONDITIONS,
        blendVolumeM3: 4 - BLEND_DEFICIT_REANNOUNCE_STEP_M3,
      });

      expect(selectAlertsToAnnounce(deeper, announced).announce).toHaveLength(1);
    });

    it('says nothing while a breached tank refills past steps it already crossed', () => {
      // Breached at 4.0 and deepening to 2.0, then a truck refills it: recovery is not news, and
      // announcing it would report the farm as critical repeatedly while it is being fixed.
      expect(announcementsAcross([4, 3, 2, 3, 4, 5])).toEqual([
        true,
        true,
        true,
        false,
        false,
        false,
      ]);
    });

    it('keeps the deepest step, so a relapse speaks only once it is worse than before', () => {
      // Down to a 4.0 m³ deficit, back up to 2.0, then down again to 3.0: still better news.
      expect(announcementsAcross([2, 4, 3])).toEqual([true, false, false]);

      // Past the deepest point reached, it speaks again.
      expect(announcementsAcross([2, 4, 3, 1])).toEqual([true, false, false, true]);
    });

    it('tracks each condition independently', () => {
      const breach = deriveCriticalAlerts({ ...QUIET_CONDITIONS, blendVolumeM3: 2 });
      const announced = selectAlertsToAnnounce(breach, []).nextAnnounced;

      // Rain arrives while the unchanged breach persists: only the rain is news.
      const plan = selectAlertsToAnnounce(
        deriveCriticalAlerts({
          ...QUIET_CONDITIONS,
          blendVolumeM3: 2,
          precipitationForecast24hMm: 12,
        }),
        announced
      );

      expect(plan.announce.map((alert) => alert.id)).toEqual(['rainfall-forecast']);
      expect(plan.nextAnnounced).toHaveLength(2);
    });

    it('re-arms an alert once its condition clears, so a breach that returns is announced', () => {
      const breach = deriveCriticalAlerts({ ...QUIET_CONDITIONS, blendVolumeM3: 2 });
      const announced = selectAlertsToAnnounce(breach, []).nextAnnounced;

      // Refilled: nothing is derived, so nothing is remembered.
      const recovered = selectAlertsToAnnounce(deriveCriticalAlerts(QUIET_CONDITIONS), announced);
      expect(recovered.nextAnnounced).toEqual([]);

      expect(selectAlertsToAnnounce(breach, recovered.nextAnnounced).announce).toEqual(breach);
    });

    it('treats a rain forecast drifting by tenths as the same weather event', () => {
      const forecast = deriveCriticalAlerts({ ...QUIET_CONDITIONS, precipitationForecast24hMm: 8 });
      const announced = selectAlertsToAnnounce(forecast, []).nextAnnounced;

      const refreshed = deriveCriticalAlerts({
        ...QUIET_CONDITIONS,
        precipitationForecast24hMm: 8.3,
      });

      expect(selectAlertsToAnnounce(refreshed, announced).announce).toEqual([]);
    });

    it('announces a forecast oscillating across a whole millimetre only once', () => {
      let announced = selectAlertsToAnnounce([], []).nextAnnounced;

      // 8.4 rounds to 8 and 8.6 to 9, so without a high-water mark this alternation never stops.
      const spoke = [8.4, 8.6, 8.4, 8.6, 8.4].map((precipitationForecast24hMm) => {
        const plan = selectAlertsToAnnounce(
          deriveCriticalAlerts({ ...QUIET_CONDITIONS, precipitationForecast24hMm }),
          announced
        );
        announced = plan.nextAnnounced;
        return plan.announce.length > 0;
      });

      expect(spoke).toEqual([true, true, false, false, false]);
    });
  });
});
