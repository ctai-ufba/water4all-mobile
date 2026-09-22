/**
 * @file DashboardView.tsx
 * @summary Primary dashboard screen presenting core water telemetry to the farm operator.
 * @description Integrates the Water Autonomy card, Blend tank visual gauge with threshold markers,
 * Blend tank low-volume breach alerts, Daily Water Balance card, and Water Efficiency card.
 */

import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { useTelemetry } from '../../context/TelemetryContext';
import { WaterAutonomyCard } from './WaterAutonomyCard';
import { BlendTankGauge } from './BlendTankGauge';
import { BlendTankAlert } from './BlendTankAlert';
import { DailyWaterBalanceCard } from './DailyWaterBalanceCard';
import { WaterEfficiencyCard } from './WaterEfficiencyCard';
import { WeatherCard } from './WeatherCard';

/**
 * Primary Dashboard screen component.
 *
 * @summary Main dashboard view.
 * @description Provides a comprehensive operational overview for Mediterranean farm water
 * systems, rendering autonomy metrics, tank volume gauges, threshold breach warnings,
 * mass flow balance, and local sustainability savings.
 *
 * @returns React.JSX.Element representing the complete dashboard screen.
 * @throws Never throws.
 */
export function DashboardView(): React.JSX.Element {
  const { activeFarm } = useAuth();
  const { telemetry } = useTelemetry();

  if (!activeFarm || !telemetry) {
    return (
      <div className="flex h-64 items-center justify-center text-center text-slate-400">
        <p className="text-sm">Loading farm telemetry...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Farm Operational Header Banner */}
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

      {/* Critical Alert Banner: Rendered conditionally when Blend tank volume drops below minimum operating volume */}
      {telemetry.isBelowMinOperatingVolume && (
        <BlendTankAlert
          currentVolume={telemetry.tankVolumes.blend}
          minOperatingVolume={activeFarm.tankCapacities.minOperatingVolume}
          deficitM3={telemetry.blendDeficitM3}
        />
      )}

      {/* Live Weather & Physics Generation Card */}
      <WeatherCard />

      {/* Water Autonomy in Days Card */}
      <WaterAutonomyCard
        autonomyDays={telemetry.waterAutonomyDays}
        totalStoredVolume={telemetry.totalStoredVolume}
        totalConsumption={telemetry.totalConsumption}
      />

      {/* Blend Tank Visual Gauge */}
      <BlendTankGauge
        currentVolume={telemetry.tankVolumes.blend}
        tankCapacities={activeFarm.tankCapacities}
      />

      {/* Daily Water Balance Card */}
      <DailyWaterBalanceCard
        totalInflow={telemetry.totalInflow}
        totalConsumption={telemetry.totalConsumption}
        netBalance={telemetry.netBalance}
        isSurplus={telemetry.isSurplus}
        flows={telemetry.flows}
      />

      {/* Water Efficiency & Savings Card */}
      <WaterEfficiencyCard
        localPercentage={telemetry.localWaterPercentage}
        dailySavingsEur={telemetry.dailySavingsEur}
        avoidedTruckCostEur={telemetry.avoidedTruckCostEur}
        esaEnergyCostEur={telemetry.esaEnergyCostEur}
      />
    </div>
  );
}

