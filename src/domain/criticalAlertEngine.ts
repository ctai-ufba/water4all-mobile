/**
 * @file criticalAlertEngine.ts
 * @summary Derivation of the farm conditions worth interrupting the operator for.
 * @description Turns the current telemetry and weather reading into the set of critical alerts
 * that should be showing, and decides which of them are new enough to announce. Pure and
 * synchronous: it touches neither the Notification API nor React, so the policy of "what is worth
 * an alert" can be tested on its own and the delivery mechanism can change without it.
 *
 * ## Why announcement is separate from derivation
 *
 * Telemetry recomputes on every volume change, so the same breach is derived hundreds of times
 * while it lasts. Announcing on derivation would notify the operator on each pass. Instead, each
 * alert carries a coarse {@link CriticalAlert.escalationStep}, and {@link selectAlertsToAnnounce}
 * announces a condition only when it is newly held or has deteriorated past the deepest step the
 * operator has already been told about.
 *
 * The comparison is deliberately one-directional. A tank refilling from a 6 m³ deficit crosses
 * the same steps on the way up as it did on the way down, and announcing those would notify the
 * operator that the farm is in a critical state repeatedly while it recovers, which is both
 * wrong and the surest way to teach them to ignore the alert. Only deterioration speaks; a
 * condition that clears is forgotten, so a breach that returns is announced afresh.
 *
 * @example
 * ```ts
 * const alerts = deriveCriticalAlerts({
 *   blendVolumeM3: 3.2,
 *   minOperatingVolumeM3: 6.0,
 *   precipitationForecast24hMm: 8.4,
 *   catchmentInflowM3: 2.1,
 * });
 * const { announce, nextAnnounced } = selectAlertsToAnnounce(alerts, announced);
 * announce.forEach(showNotification); // only what the operator has not been told, or worse news
 * announced = nextAnnounced;          // cleared conditions drop out and may fire again later
 * ```
 */

import { AnnouncedAlert, CriticalAlert } from '../types/pwa';

/**
 * Deficit growth, in m³, that re-arms the minimum operating volume alert.
 *
 * @remarks Without a step the alert would re-announce on every recomputation; with too coarse a
 * step a tank draining steadily would announce once and stay silent while it emptied. One cubic
 * metre is the smallest deficit change an operator would act on differently.
 */
export const BLEND_DEFICIT_REANNOUNCE_STEP_M3 = 1;

/**
 * Forecast depth, in mm, below which rain is not announced.
 *
 * @remarks Under a millimetre over 24 hours is a trace that wets the ground and collects nothing
 * worth planning around; announcing it would train the operator to ignore the rain alert.
 */
export const RAINFALL_ALERT_THRESHOLD_MM = 1;

/**
 * Current farm conditions the alert policy is evaluated against.
 */
export interface CriticalAlertConditions {
  /** Current Blend tank volume in m³ */
  blendVolumeM3: number;
  /** Minimum operating volume of the active farm profile in m³ */
  minOperatingVolumeM3: number;
  /** Cumulative precipitation forecast over the next 24 hours in mm */
  precipitationForecast24hMm: number;
  /** Collectible rainwater catchment inflow implied by that forecast in m³, when estimated */
  catchmentInflowM3?: number;
}

/**
 * Outcome of comparing the alerts that should be showing against those already announced.
 */
export interface AlertAnnouncementPlan {
  /**
   * Alerts to announce now.
   *
   * @remarks Every other current alert describes a situation the operator has already been told
   * about, or one that is recovering.
   */
  announce: CriticalAlert[];
  /**
   * Announcement records to carry into the next evaluation.
   *
   * @remarks One per currently held condition, each carrying the deepest step announced so far,
   * so deterioration is measured against the worst news already delivered rather than against
   * the previous reading. A condition that clears has no record and will announce again if it
   * returns. Callers replace their stored set with this rather than merging into it.
   */
  nextAnnounced: AnnouncedAlert[];
}

/**
 * Builds the Blend tank minimum operating volume alert.
 *
 * @summary Minimum operating volume breach alert.
 * @description Reports the current volume, the threshold it fell under and the deficit, which are
 * the three figures the in-app BlendTankAlert banner carries, so the notification and the screen
 * state the same situation.
 *
 * @param blendVolumeM3 - Current Blend tank volume in m³.
 * @param minOperatingVolumeM3 - Minimum operating volume of the active profile in m³.
 * @returns The critical alert describing the breach.
 * @throws Never throws.
 */
function buildBlendVolumeAlert(blendVolumeM3: number, minOperatingVolumeM3: number): CriticalAlert {
  const deficitM3 = minOperatingVolumeM3 - blendVolumeM3;

  return {
    id: 'blend-minimum-operating-volume',
    severity: 'critical',
    title: 'Critical water alert',
    body:
      `Blend tank at ${blendVolumeM3.toFixed(1)} m³, below the ${minOperatingVolumeM3.toFixed(1)} m³ ` +
      `minimum operating volume. Replenish ${deficitM3.toFixed(1)} m³ to restore safe operation.`,
    // A deficit one whole step deeper is worse news and is worth telling the operator again.
    escalationStep: Math.floor(deficitM3 / BLEND_DEFICIT_REANNOUNCE_STEP_M3),
  };
}

/**
 * Builds the rain forecast alert.
 *
 * @summary Rainfall forecast alert.
 * @description Reports the forecast depth and, when the catchment estimate is available, the
 * volume that depth is expected to yield, which is the figure an operator schedules around.
 *
 * @param precipitationForecast24hMm - Cumulative 24-hour precipitation forecast in mm.
 * @param catchmentInflowM3 - Collectible catchment inflow in m³, when estimated.
 * @returns The informational alert describing the forecast.
 * @throws Never throws.
 */
function buildRainfallAlert(
  precipitationForecast24hMm: number,
  catchmentInflowM3?: number
): CriticalAlert {
  const depthText = `${precipitationForecast24hMm.toFixed(1)} mm of rain forecast in the next 24 hours`;
  const yieldText =
    catchmentInflowM3 !== undefined
      ? `, about ${catchmentInflowM3.toFixed(1)} m³ collectible from the catchment area.`
      : '.';

  return {
    id: 'rainfall-forecast',
    severity: 'info',
    title: 'Rain forecast',
    body: `${depthText}${yieldText}`,
    // Whole millimetres: a forecast drifting by tenths is the same weather event, and only a
    // forecast that grows past the last whole millimetre announced is news.
    escalationStep: Math.round(precipitationForecast24hMm),
  };
}

/**
 * Derives the critical alerts that should currently be showing.
 *
 * @summary Derive current critical alerts.
 * @description Evaluates the minimum operating volume breach and the rain forecast against the
 * supplied conditions. Returns alerts ordered by urgency, critical before informational, so a
 * caller rendering a capped toast stack keeps the breach visible.
 *
 * @param conditions - Current telemetry and weather figures.
 * @returns The alerts whose conditions hold, possibly empty.
 * @throws Never throws.
 */
export function deriveCriticalAlerts(conditions: CriticalAlertConditions): CriticalAlert[] {
  const alerts: CriticalAlert[] = [];

  if (conditions.blendVolumeM3 < conditions.minOperatingVolumeM3) {
    alerts.push(buildBlendVolumeAlert(conditions.blendVolumeM3, conditions.minOperatingVolumeM3));
  }

  if (conditions.precipitationForecast24hMm >= RAINFALL_ALERT_THRESHOLD_MM) {
    alerts.push(
      buildRainfallAlert(conditions.precipitationForecast24hMm, conditions.catchmentInflowM3)
    );
  }

  return alerts;
}

/**
 * Decides which currently derived alerts are worth announcing.
 *
 * @summary Plan alert announcements.
 * @description Announces a condition that is newly held, or one whose escalation step has risen
 * above the deepest already announced. A condition that is unchanged, or recovering, stays
 * silent, and the record carried forward keeps the deepest step rather than the current one, so
 * a tank refilling past steps it already crossed on the way down says nothing.
 *
 * @param current - Alerts derived from the present conditions.
 * @param announced - Records carried from the previous evaluation.
 * @returns The announcement plan; `announce` is empty when nothing has worsened.
 * @throws Never throws.
 */
export function selectAlertsToAnnounce(
  current: CriticalAlert[],
  announced: readonly AnnouncedAlert[]
): AlertAnnouncementPlan {
  const deepestAnnounced = new Map(announced.map((record) => [record.id, record.step]));
  const announce: CriticalAlert[] = [];
  const nextAnnounced: AnnouncedAlert[] = [];

  current.forEach((alert) => {
    const previousStep = deepestAnnounced.get(alert.id);

    if (previousStep === undefined || alert.escalationStep > previousStep) {
      announce.push(alert);
      nextAnnounced.push({ id: alert.id, step: alert.escalationStep });
      return;
    }

    nextAnnounced.push({ id: alert.id, step: previousStep });
  });

  return { announce, nextAnnounced };
}
