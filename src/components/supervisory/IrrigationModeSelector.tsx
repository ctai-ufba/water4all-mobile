/**
 * @file IrrigationModeSelector.tsx
 * @summary Interactive supervisory selector for farm irrigation operational mode.
 * @description Provides a touch-friendly 3-way toggle between 'Auto (Scheduled)',
 * 'Eco (Water-saving)' deficit irrigation, and 'Paused', immediately updating farm consumption rates.
 */

import React from 'react';
import { useTelemetry } from '../../context/TelemetryContext';
import { IrrigationMode } from '../../types/telemetry';
import { CalendarClock, Leaf, PauseCircle, Check } from 'lucide-react';

/**
 * Configuration schema for irrigation operational mode options.
 */
interface IrrigationOptionConfig {
  mode: IrrigationMode;
  label: string;
  shortLabel: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  badge: string;
  activeBorder: string;
  activeBg: string;
  activeText: string;
}

const IRRIGATION_OPTIONS: IrrigationOptionConfig[] = [
  {
    mode: 'auto',
    label: 'Auto (Scheduled)',
    shortLabel: 'Auto',
    icon: CalendarClock,
    description: 'Scheduled baseline irrigation matching standard crop demand.',
    badge: '100% Demand',
    activeBorder: 'border-cyan-500',
    activeBg: 'bg-cyan-500/15',
    activeText: 'text-cyan-400',
  },
  {
    mode: 'eco',
    label: 'Eco (Water-saving)',
    shortLabel: 'Eco',
    icon: Leaf,
    description: 'Deficit irrigation reducing crop demand by 40% to extend autonomy.',
    badge: '-40% Water',
    activeBorder: 'border-emerald-500',
    activeBg: 'bg-emerald-500/15',
    activeText: 'text-emerald-400',
  },
  {
    mode: 'paused',
    label: 'Paused',
    shortLabel: 'Paused',
    icon: PauseCircle,
    description: 'Crop irrigation suspended. Farmhouse and livestock water preserved.',
    badge: '0 m³/d Irrigation',
    activeBorder: 'border-amber-500',
    activeBg: 'bg-amber-500/15',
    activeText: 'text-amber-400',
  },
];

/**
 * Supervisory control component for toggling irrigation modes.
 *
 * @summary Irrigation mode selector.
 * @description Allows the farm operator to switch between Auto, Eco, and Paused modes,
 * dynamically updating daily consumption rates and derived water autonomy.
 *
 * @returns React.JSX.Element representing the irrigation mode selector.
 * @throws Never throws.
 */
export function IrrigationModeSelector(): React.JSX.Element {
  const { telemetry, setIrrigationMode } = useTelemetry();

  const currentMode = telemetry?.irrigationMode ?? 'auto';
  const currentDemand = telemetry?.flows.irrigationDemand ?? 0;

  const activeConfig =
    IRRIGATION_OPTIONS.find((opt) => opt.mode === currentMode) ?? IRRIGATION_OPTIONS[0];

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 shadow-xl">
      <div className="flex items-center justify-between">
        <div>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-cyan-400">
            Supervisory Control
          </span>
          <h3 className="text-sm font-bold text-white leading-tight">Irrigation Mode</h3>
        </div>

        {/* Current Flow Badge */}
        <span
          className={`flex items-center space-x-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${activeConfig.activeBg} ${activeConfig.activeText} border ${activeConfig.activeBorder}`}
        >
          <span>{currentDemand.toFixed(1)} m³/day</span>
        </span>
      </div>

      {/* Mode Toggle Button Group */}
      <div
        className="mt-3.5 grid grid-cols-3 gap-2"
        role="radiogroup"
        aria-label="Irrigation Operational Mode"
      >
        {IRRIGATION_OPTIONS.map((option) => {
          const Icon = option.icon;
          const isSelected = currentMode === option.mode;

          return (
            <button
              key={option.mode}
              type="button"
              role="radio"
              aria-checked={isSelected}
              onClick={() => setIrrigationMode(option.mode)}
              className={`flex flex-col items-center justify-center rounded-xl p-2.5 transition-all duration-200 border text-center ${
                isSelected
                  ? `${option.activeBg} ${option.activeBorder} ${option.activeText} shadow-md ring-1 ring-white/10`
                  : 'border-slate-800 bg-slate-950/60 text-slate-400 hover:border-slate-700 hover:text-slate-200'
              }`}
            >
              <div className="flex items-center space-x-1">
                <Icon className="h-4 w-4 flex-shrink-0" />
                {isSelected && <Check className="h-3 w-3" />}
              </div>
              <span className="mt-1 text-xs font-bold leading-tight">
                {option.shortLabel}
              </span>
              <span className="mt-0.5 text-[9px] font-medium opacity-80">
                {option.badge}
              </span>
            </button>
          );
        })}
      </div>

      {/* Mode Operational Description */}
      <div className="mt-3 rounded-xl bg-slate-950/60 p-2.5 text-xs text-slate-300 ring-1 ring-slate-800/80">
        <p className="leading-relaxed">
          <strong className="text-white">{activeConfig.label}:</strong>{' '}
          {activeConfig.description}
        </p>
      </div>
    </div>
  );
}

