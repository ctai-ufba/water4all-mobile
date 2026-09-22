/**
 * @file DemoControllerDrawer.tsx
 * @summary Interactive slide-over Demo Controller Drawer tailored for live presentations.
 * @description Provides presentation controls: virtual time acceleration ("Advance 6 Hours", "Next Day"),
 * scenario switching ("Live Weather", "Severe Drought", "Heavy Storm", "High Salinity"),
 * the "Unoptimized Baseline" comparison toggle, and the "Run System Optimization" action (ADR 0002).
 */

import React from 'react';
import {
  X,
  FastForward,
  Calendar,
  CloudSun,
  Flame,
  CloudLightning,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  ToggleLeft,
  ToggleRight,
  Check,
  Zap,
} from 'lucide-react';
import { useDemo } from '../../context/DemoContext';
import { useAuth } from '../../context/AuthContext';
import { DemoScenarioId, getUnoptimizedBaselineTelemetry } from '../../domain/demoEngine';

/**
 * Scenario option configuration for presentation cards.
 */
interface ScenarioOption {
  id: DemoScenarioId;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  accentColor: string;
}

const SCENARIO_OPTIONS: ScenarioOption[] = [
  {
    id: 'live',
    label: 'Live Weather',
    description: 'Real-time Open-Meteo or synthetic seasonal baseline.',
    icon: CloudSun,
    accentColor: 'text-cyan-400 border-cyan-500/50 bg-cyan-950/20',
  },
  {
    id: 'drought',
    label: 'Severe Drought',
    description: '38.5 °C, 18% RH, zero rain, elevated crop ET₀ demand.',
    icon: Flame,
    accentColor: 'text-rose-400 border-rose-500/50 bg-rose-950/20',
  },
  {
    id: 'storm',
    label: 'Heavy Storm',
    description: '17.5 °C, 95% RH, 48 mm 24h rain, surge in catchment.',
    icon: CloudLightning,
    accentColor: 'text-blue-400 border-blue-500/50 bg-blue-950/20',
  },
  {
    id: 'salinity',
    label: 'High Salinity',
    description: 'External supply dominant, elevated EC & TDS, FAO crop warnings.',
    icon: AlertTriangle,
    accentColor: 'text-amber-400 border-amber-500/50 bg-amber-950/20',
  },
];

const TIME_ADVANCE_OPTIONS = [
  { hours: 6 as const, label: 'Advance 6 Hours', icon: FastForward },
  { hours: 24 as const, label: 'Next Day (+24h)', icon: Calendar },
];

/**
 * Formats a virtual Date object into a readable presentation string.
 *
 * @summary Format simulated date.
 * @description Produces human-friendly day of week and time representation.
 *
 * @param date - Virtual simulation Date.
 * @param elapsedHours - Cumulative simulated hours.
 * @returns Formatted time string.
 * @throws Never throws.
 */
function formatSimulatedTime(date: Date, elapsedHours: number): string {
  const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const dateStr = date.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
  return `${dateStr}, ${timeStr} (+${elapsedHours}h)`;
}

/**
 * Slide-over Demo Controller Drawer component.
 *
 * @summary Demo controller slide-over drawer.
 * @description Renders the slide-over presentation drawer housing time controls,
 * scenario switches, baseline comparison, and system optimization.
 *
 * @returns React.JSX.Element | null representing the slide-over drawer, or null if closed.
 * @throws Never throws.
 */
export function DemoControllerDrawer(): React.JSX.Element | null {
  const {
    isDrawerOpen,
    closeDrawer,
    scenario,
    selectScenario,
    isUnoptimizedBaseline,
    toggleUnoptimizedBaseline,
    simulatedDate,
    elapsedSimulatedHours,
    advanceTime,
    resetTime,
    runOptimization,
    resetDemo,
  } = useDemo();
  const { activeFarm } = useAuth();

  if (!isDrawerOpen) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-40 flex justify-end bg-black/75 backdrop-blur-sm transition-opacity"
      role="dialog"
      aria-label="Demo Controller Drawer"
      data-testid="demo-controller-drawer"
    >
      {/* Click outside to close */}
      <div
        className="flex-1 cursor-pointer"
        onClick={closeDrawer}
        aria-hidden="true"
      />

      {/* Slide-over Drawer Panel */}
      <div className="relative flex h-full w-full max-w-md flex-col bg-slate-900 border-l border-slate-800 shadow-2xl overflow-y-auto">
        {/* Drawer Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-800/80 bg-slate-900/95 px-5 py-4 backdrop-blur-md">
          <div className="flex items-center space-x-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-cyan-500/20 text-cyan-400 ring-1 ring-cyan-500/40">
              <Zap className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white tracking-tight">
                Demo Controller
              </h2>
              <p className="text-[11px] text-slate-400">
                Live Demonstration Controls • {activeFarm?.name ?? 'Farm'}
              </p>
            </div>
          </div>

          <button
            onClick={closeDrawer}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
            aria-label="Close Demo Controller"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Drawer Content */}
        <div className="flex-1 space-y-6 p-5 pb-12">
          {/* Section 1: Virtual Time Acceleration */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <FastForward className="h-4 w-4 text-cyan-400" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                  Virtual Time Acceleration
                </h3>
              </div>
              <button
                onClick={resetTime}
                className="flex items-center space-x-1 text-[11px] text-slate-400 hover:text-cyan-400 transition-colors"
                title="Reset time to now"
              >
                <RotateCcw className="h-3 w-3" />
                <span>Reset</span>
              </button>
            </div>

            {/* Virtual Time Display Card */}
            <div className="flex items-center justify-between rounded-xl bg-slate-950/70 p-3 border border-slate-800 text-xs">
              <div className="flex items-center space-x-2 text-slate-300">
                <Calendar className="h-4 w-4 text-cyan-400" />
                <span className="font-mono font-medium">
                  {formatSimulatedTime(simulatedDate, elapsedSimulatedHours)}
                </span>
              </div>
              <span className="text-[10px] rounded-full bg-cyan-950 px-2 py-0.5 font-semibold text-cyan-400 border border-cyan-800/40">
                Simulated
              </span>
            </div>

            {/* Time Advance Buttons */}
            <div className="grid grid-cols-2 gap-2.5">
              {TIME_ADVANCE_OPTIONS.map((opt) => {
                const Icon = opt.icon;
                return (
                  <button
                    key={opt.hours}
                    onClick={() => advanceTime(opt.hours)}
                    className="flex items-center justify-center space-x-2 rounded-xl border border-slate-800 bg-slate-800/80 p-2.5 text-xs font-semibold text-slate-200 hover:border-cyan-500/60 hover:bg-slate-800 hover:text-white transition-all active:scale-95"
                    aria-label={opt.label}
                  >
                    <Icon className="h-3.5 w-3.5 text-cyan-400" />
                    <span>{opt.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section 2: Simulated Extreme Scenarios */}
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <CloudSun className="h-4 w-4 text-cyan-400" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                Simulated Scenarios
              </h3>
            </div>

            <div className="space-y-2">
              {SCENARIO_OPTIONS.map((opt) => {
                const Icon = opt.icon;
                const isSelected = scenario === opt.id && !isUnoptimizedBaseline;

                return (
                  <button
                    key={opt.id}
                    onClick={() => selectScenario(opt.id)}
                    className={`flex w-full items-start justify-between rounded-xl border p-3 text-left transition-all ${
                      isSelected
                        ? opt.accentColor + ' shadow-md'
                        : 'border-slate-800 bg-slate-950/40 text-slate-300 hover:border-slate-700 hover:bg-slate-800/60'
                    }`}
                    aria-label={opt.label}
                    aria-pressed={isSelected}
                  >
                    <div className="flex items-start space-x-2.5">
                      <Icon className="h-4 w-4 shrink-0 mt-0.5" />
                      <div>
                        <div className="text-xs font-bold text-white">{opt.label}</div>
                        <div className="text-[11px] text-slate-400 mt-0.5 leading-snug">
                          {opt.description}
                        </div>
                      </div>
                    </div>
                    {isSelected && <Check className="h-4 w-4 shrink-0 text-cyan-400 mt-0.5 ml-2" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section 3: Unoptimized Baseline Comparison Toggle */}
          <div className="space-y-3 rounded-2xl bg-slate-950/80 p-4 border border-slate-800">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <AlertTriangle
                  className={`h-4 w-4 ${
                    isUnoptimizedBaseline ? 'text-amber-400' : 'text-slate-400'
                  }`}
                />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                  Unoptimized Baseline
                </h3>
              </div>

              <button
                onClick={toggleUnoptimizedBaseline}
                className="flex items-center space-x-1 text-slate-300 hover:text-white transition-colors focus:outline-none"
                role="switch"
                aria-checked={isUnoptimizedBaseline}
                aria-label="Toggle Unoptimized Baseline"
              >
                {isUnoptimizedBaseline ? (
                  <ToggleRight className="h-7 w-7 text-amber-400" />
                ) : (
                  <ToggleLeft className="h-7 w-7 text-slate-500" />
                )}
              </button>
            </div>

            <p className="text-[11px] text-slate-400 leading-relaxed">
              Contrasts current state with an unoptimized baseline operating state: frequent Blend tank deficits, high external truck expenses, and crop quality violations.
            </p>

            {isUnoptimizedBaseline && (
              <div className="rounded-xl bg-amber-950/40 p-3 border border-amber-600/40 text-[11px] text-amber-200">
                <div className="font-bold text-amber-300">Unoptimized Baseline Active:</div>
                <ul className="mt-1 list-disc list-inside space-y-0.5 text-amber-200/90">
                  <li>Blend tank below minimum operating volume (alarm triggered)</li>
                  <li>
                    Cumulative external truck expenses accrued
                    {activeFarm
                      ? ` (${getUnoptimizedBaselineTelemetry(activeFarm).cumulativeTruckCost?.toFixed(2)} €)`
                      : ''}
                  </li>
                  <li>High mineral salinity risking sensitive crop compliance</li>
                </ul>
              </div>
            )}
          </div>

          {/* Section 4: System Optimization (ADR 0002) */}
          <div className="space-y-3 rounded-2xl bg-gradient-to-b from-cyan-950/30 to-slate-900 p-4 border border-cyan-500/40 shadow-lg">
            <div className="flex items-center space-x-2">
              <Sparkles className="h-4 w-4 text-cyan-400" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-cyan-300">
                System Optimization (ADR 0002)
              </h3>
            </div>

            <p className="text-[11px] text-slate-300 leading-relaxed">
              Applies pre-computed Bayesian optimal parameters: restores storage levels, eliminates deficits, balances salinity, and maximizes financial savings.
            </p>

            <button
              onClick={() => {
                closeDrawer();
                runOptimization();
              }}
              className="flex w-full items-center justify-center space-x-2 rounded-xl bg-gradient-to-r from-cyan-500 to-teal-500 py-3 px-4 text-xs font-bold text-slate-950 shadow-lg shadow-cyan-500/20 hover:brightness-110 active:scale-95 transition-all"
              aria-label="Run System Optimization"
            >
              <Sparkles className="h-4 w-4 fill-slate-950" />
              <span>Run System Optimization</span>
            </button>
          </div>

          {/* Section 5: Reset All Demo State */}
          <div className="pt-2">
            <button
              onClick={resetDemo}
              className="flex w-full items-center justify-center space-x-2 rounded-xl border border-slate-800 bg-slate-950/60 p-2.5 text-xs font-medium text-slate-400 hover:border-slate-700 hover:text-slate-200 transition-colors"
              aria-label="Reset All to Initial Baseline"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Reset All to Initial Baseline</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
