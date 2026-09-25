/**
 * @file TanksView.tsx
 * @summary Dedicated screen providing monitoring into all farm water storage assets.
 * @description Renders a comprehensive overview of the four core farm tanks: Rainwater
 * catchment, ESA atmospheric generator, External supply, and Central blend tank.
 * Displays individual fluid level gauges, active source statuses, capacities, and alerts.
 */

import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useTelemetry } from '../../context/TelemetryContext';
import {
  calculateTotalStorageCapacity,
  calculateTankFillPercentage,
  getTankAlertLevel,
} from '../../domain/tankStatusEngine';
import { TankCard } from './TankCard';
import { IrrigationModeSelector } from '../supervisory/IrrigationModeSelector';
import { WaterTruckModal } from '../supervisory/WaterTruckModal';
import { PumpTransferModal } from '../supervisory/PumpTransferModal';
import { CloudRain, Wind, Truck, Cylinder, Layers, AlertTriangle, ArrowRightLeft } from 'lucide-react';
import { TransferSourceTank } from '../../types/telemetry';
import { TrendChart } from '../charts/TrendChart';
import { formatHistorySeries } from '../../domain/historicalTelemetry';

/**
 * Dedicated Tanks & Sources screen component.
 *
 * @summary Tanks and sources monitoring view.
 * @description Provides the farm operator with detailed visibility into all four
 * physical water storage assets, overall farm storage totals, critical low-volume alerts,
 * and interactive supervisory controls (Water Truck Request, Irrigation Mode, Pump Transfer).
 *
 * @returns React.JSX.Element representing the Tanks & Sources monitoring view.
 * @throws Never throws.
 */
export function TanksView(): React.JSX.Element {
  const { activeFarm } = useAuth();
  const { telemetry, history } = useTelemetry();

  // Supervisory control modal states
  const [isTruckModalOpen, setIsTruckModalOpen] = useState(false);
  const [isPumpModalOpen, setIsPumpModalOpen] = useState(false);
  const [pumpSource, setPumpSource] = useState<TransferSourceTank>('rainwater');

  // If no farm is active or telemetry is loading, display loading placeholder
  if (!activeFarm || !telemetry) {
    return (
      <div className="flex h-64 items-center justify-center text-center text-slate-400">
        <p className="text-sm">Loading storage telemetry...</p>
      </div>
    );
  }

  // Calculate cumulative storage capacity across all 4 tanks
  const totalCapacity = calculateTotalStorageCapacity(activeFarm.tankCapacities);
  const totalPercentage = calculateTankFillPercentage(telemetry.totalStoredVolume, totalCapacity);

  // Configuration list for individual storage asset cards
  const tankItems = [
    {
      tankType: 'rainwater' as const,
      title: 'Rainwater Catchment',
      subtitle: 'Natural Inflow',
      icon: CloudRain,
      currentVolume: telemetry.tankVolumes.rainwater,
      capacity: activeFarm.tankCapacities.rainwater,
      flowRate: telemetry.flows.rainwaterInflow,
      alertLevel: getTankAlertLevel(
        'rainwater',
        telemetry.tankVolumes.rainwater,
        activeFarm.tankCapacities.rainwater
      ),
    },
    {
      tankType: 'esa' as const,
      title: 'ESA Atmospheric Generator',
      subtitle: 'Moisture Harvester',
      icon: Wind,
      currentVolume: telemetry.tankVolumes.esa,
      capacity: activeFarm.tankCapacities.esa,
      flowRate: telemetry.flows.esaInflow,
      alertLevel: getTankAlertLevel(
        'esa',
        telemetry.tankVolumes.esa,
        activeFarm.tankCapacities.esa
      ),
    },
    {
      tankType: 'external' as const,
      title: 'External Water Supply',
      subtitle: 'Water Truck Reserve',
      icon: Truck,
      currentVolume: telemetry.tankVolumes.external,
      capacity: activeFarm.tankCapacities.external,
      flowRate: telemetry.flows.externalInflow,
      alertLevel: getTankAlertLevel(
        'external',
        telemetry.tankVolumes.external,
        activeFarm.tankCapacities.external
      ),
    },
    {
      tankType: 'blend' as const,
      title: 'Central Blend Tank',
      subtitle: 'Distribution Reservoir',
      icon: Cylinder,
      currentVolume: telemetry.tankVolumes.blend,
      capacity: activeFarm.tankCapacities.blend,
      flowRate: telemetry.totalConsumption,
      isOutflow: true,
      targetVolume: activeFarm.tankCapacities.targetVolume,
      minOperatingVolume: activeFarm.tankCapacities.minOperatingVolume,
      alertLevel: getTankAlertLevel(
        'blend',
        telemetry.tankVolumes.blend,
        activeFarm.tankCapacities.blend,
        activeFarm.tankCapacities.minOperatingVolume
      ),
    },
  ];

  // Derive global critical alert status if any asset breaches critical thresholds
  const hasCriticalAlert = tankItems.some((item) => item.alertLevel === 'critical');

  return (
    <div className="space-y-4">
      {/* Overview Storage Banner */}
      <div className="rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800/80 p-4 shadow-lg">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-cyan-400">
              Storage Assets
            </span>
            <h2 className="text-lg font-bold text-white">Tanks & Sources</h2>
          </div>
          <div className="flex items-center space-x-1.5 rounded-full bg-cyan-500/10 px-2.5 py-0.5 text-xs font-medium text-cyan-400 ring-1 ring-cyan-500/20">
            <Layers className="h-3.5 w-3.5" />
            <span>4 Reservoirs</span>
          </div>
        </div>

        <p className="mt-1.5 text-xs leading-relaxed text-slate-300">
          Real-time storage status for {activeFarm.estateName}. All inflow and blending
          assets are monitored continuously.
        </p>

        {/* Consolidated Total Storage Metrics */}
        <div className="mt-4 rounded-xl bg-slate-950/70 p-3 ring-1 ring-slate-800">
          <div className="flex items-baseline justify-between">
            <span className="text-xs font-medium text-slate-400">
              Total Farm Storage
            </span>
            <span className="text-xs font-bold text-cyan-400">
              {totalPercentage.toFixed(1)}% Full
            </span>
          </div>

          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-2xl font-extrabold text-white">
              {telemetry.totalStoredVolume.toFixed(1)} m³
            </span>
            <span className="text-xs text-slate-400">
              / {totalCapacity.toFixed(1)} m³ capacity
            </span>
          </div>

          {/* Consolidated Fluid Progress Bar */}
          <div className="mt-2.5 h-2.5 w-full overflow-hidden rounded-full bg-slate-900 ring-1 ring-slate-800">
            <div
              className="h-full bg-gradient-to-r from-cyan-500 via-emerald-400 to-emerald-300 transition-all duration-700 ease-out"
              style={{ width: `${totalPercentage}%` }}
            />
          </div>
        </div>
      </div>

      <section className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 shadow-xl" aria-label="Seven-day tank dynamics">
        <h3 className="text-sm font-bold text-white">Seven-Day Tank Dynamics</h3>
        <p className="mt-1 text-xs text-slate-400">Daily storage snapshots by reservoir</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {([
            ['rainwater', 'Rainwater storage', '#22d3ee'],
            ['esa', 'ESA storage', '#a78bfa'],
            ['external', 'External supply storage', '#fbbf24'],
            ['blend', 'Blend storage', '#34d399'],
          ] as const).map(([tank, title, color]) => (
            <div key={tank} className="rounded-xl bg-slate-950/60 p-3 ring-1 ring-slate-800/80">
              <p className="mb-2 text-xs font-semibold text-slate-200">{title}</p>
              <TrendChart title={`${title} trend`} unit="m³" series={[
                { name: title, color, points: formatHistorySeries(history, (day) => day.tankVolumes[tank]) },
              ]} />
            </div>
          ))}
        </div>
      </section>

      {/* Critical Storage Alerts Summary Banner */}
      {hasCriticalAlert && (
        <div className="rounded-2xl border border-rose-500/40 bg-rose-500/10 p-3.5 text-rose-300 shadow-lg">
          <div className="flex items-start space-x-2.5">
            <AlertTriangle className="h-5 w-5 text-rose-400 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-rose-300">
                Critical Storage Alerts
              </h4>
              <p className="mt-0.5 text-xs text-rose-200 leading-relaxed">
                One or more water reservoirs have reached empty or critically low reserves.
                Inspect individual tank indicators below.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Supervisory Actions: Irrigation Mode Selector */}
      <IrrigationModeSelector />

      {/* Supervisory Quick Action Buttons: Water Truck & Manual Pump */}
      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => setIsTruckModalOpen(true)}
          className="flex items-center space-x-2.5 rounded-2xl border border-cyan-500/30 bg-gradient-to-r from-cyan-950/50 to-slate-900 p-3.5 shadow-lg hover:border-cyan-500/60 hover:from-cyan-950/70 transition-all text-left group"
        >
          <div className="rounded-xl bg-cyan-500/15 p-2 text-cyan-400 ring-1 ring-cyan-500/30 group-hover:bg-cyan-500/25 transition-colors">
            <Truck className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-xs font-bold text-white group-hover:text-cyan-300 transition-colors">
              Request Truck
            </div>
            <div className="text-[10px] text-slate-400">
              {telemetry.cumulativeTruckDeliveryCostEur > 0
                ? `${telemetry.cumulativeTruckDeliveryCostEur.toFixed(0)} € logged`
                : '+10 / +25 m³'}
            </div>
          </div>
        </button>

        <button
          type="button"
          onClick={() => {
            // Preselect whichever source tank actually holds more water, so the quick action
            // can reach the ESA tank too: a manual transfer may draw on either source.
            setPumpSource(
              telemetry.tankVolumes.esa > telemetry.tankVolumes.rainwater ? 'esa' : 'rainwater'
            );
            setIsPumpModalOpen(true);
          }}
          className="flex items-center space-x-2.5 rounded-2xl border border-emerald-500/30 bg-gradient-to-r from-emerald-950/50 to-slate-900 p-3.5 shadow-lg hover:border-emerald-500/60 hover:from-emerald-950/70 transition-all text-left group"
        >
          <div className="rounded-xl bg-emerald-500/15 p-2 text-emerald-400 ring-1 ring-emerald-500/30 group-hover:bg-emerald-500/25 transition-colors">
            <ArrowRightLeft className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-xs font-bold text-white group-hover:text-emerald-300 transition-colors">
              Pump Transfer
            </div>
            <div className="text-[10px] text-slate-400">
              Rainwater / ESA {'->'} Blend Tank
            </div>
          </div>
        </button>
      </div>

      {/* Individual Tank Cards */}
      <div className="space-y-3.5">
        {tankItems.map((item) => (
          <TankCard
            key={item.tankType}
            tankType={item.tankType}
            title={item.title}
            subtitle={item.subtitle}
            icon={item.icon}
            currentVolume={item.currentVolume}
            capacity={item.capacity}
            flowRate={item.flowRate}
            isOutflow={item.isOutflow}
            targetVolume={item.targetVolume}
            minOperatingVolume={item.minOperatingVolume}
            alertLevel={item.alertLevel}
          />
        ))}
      </div>

      {/* Supervisory Modals */}
      <WaterTruckModal
        isOpen={isTruckModalOpen}
        onClose={() => setIsTruckModalOpen(false)}
      />

      {/* Mounted only while open so initialSource is honoured on every open, not just the first. */}
      {isPumpModalOpen && (
        <PumpTransferModal
          isOpen
          initialSource={pumpSource}
          onClose={() => setIsPumpModalOpen(false)}
        />
      )}
    </div>
  );
}
