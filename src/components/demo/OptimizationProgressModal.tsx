/**
 * @file OptimizationProgressModal.tsx
 * @summary 2-second animated progress modal for Bayesian system optimization (ADR 0002).
 * @description Renders an engaging full-screen overlay showing real-time algorithmic phases:
 * weather analysis, crop ET₀ calibration, and Blend tank target volume tuning, ending with optimal parameters applied.
 */

import React from 'react';
import { Sparkles, CheckCircle2, Loader2, Check } from 'lucide-react';
import { useDemo } from '../../context/DemoContext';

/**
 * Phased checklist items displayed in the optimization modal.
 */
interface PhaseCheckItem {
  threshold: number;
  label: string;
}

const CHECK_ITEMS: PhaseCheckItem[] = [
  { threshold: 15, label: 'Weather & Solar Irradiance Analysis' },
  { threshold: 50, label: 'Crop ET₀ Demand & Deficit Calibration' },
  { threshold: 80, label: 'Blend Tank Mass Balance Tuning' },
  { threshold: 100, label: 'Optimal Design Applied (ADR 0002)' },
];

/**
 * 2-second animated optimization progress modal component.
 *
 * @summary Optimization progress modal.
 * @description Displays a smooth animated progress bar, real-time phase description,
 * and a checklist of algorithmic steps when "Run System Optimization" is triggered.
 *
 * @returns React.JSX.Element | null representing the optimization modal, or null if inactive.
 * @throws Never throws.
 */
export function OptimizationProgressModal(): React.JSX.Element | null {
  const { isOptimizing, optimizationProgress, optimizationPhase } = useDemo();

  if (!isOptimizing) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm transition-all"
      role="dialog"
      aria-modal="true"
      aria-labelledby="optimization-modal-title"
      data-testid="optimization-progress-modal"
    >
      <div className="w-full max-w-sm rounded-3xl border border-cyan-500/40 bg-slate-900/95 p-6 shadow-2xl ring-1 ring-cyan-500/20 backdrop-blur-md">
        {/* Header */}
        <div className="flex items-center space-x-3 pb-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-cyan-500/20 text-cyan-400 ring-1 ring-cyan-500/40 animate-pulse">
            <Sparkles className="h-6 w-6" />
          </div>
          <div>
            <h3
              id="optimization-modal-title"
              className="text-base font-bold text-white tracking-tight"
            >
              System Optimization
            </h3>
            <p className="text-xs text-slate-400">
              Calibrating Bayesian optimal parameters (ADR 0002)
            </p>
          </div>
        </div>

        {/* Animated Progress Bar */}
        <div className="mt-2 space-y-1.5">
          <div className="flex items-center justify-between text-xs font-semibold">
            <span className="text-cyan-300">Algorithmic Progress</span>
            <span className="font-mono text-cyan-400">{optimizationProgress}%</span>
          </div>

          <div className="h-3 w-full overflow-hidden rounded-full bg-slate-800 p-0.5 ring-1 ring-slate-700/60">
            <div
              className="h-full rounded-full bg-gradient-to-r from-cyan-500 via-teal-400 to-emerald-400 transition-all duration-300 ease-out"
              style={{ width: `${optimizationProgress}%` }}
              role="progressbar"
              aria-valuenow={optimizationProgress}
              aria-valuemin={0}
              aria-valuemax={100}
            />
          </div>
        </div>

        {/* Current Active Phase Description */}
        <div className="mt-4 flex items-center space-x-2 rounded-xl bg-slate-950/70 p-3 border border-slate-800">
          {optimizationProgress < 100 ? (
            <Loader2 className="h-4 w-4 shrink-0 text-cyan-400 animate-spin" />
          ) : (
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
          )}
          <span className="text-xs font-medium text-slate-200 truncate">
            {optimizationPhase}
          </span>
        </div>

        {/* Phased Checklist */}
        <div className="mt-4 space-y-2 border-t border-slate-800/80 pt-3 text-xs">
          {CHECK_ITEMS.map((item, index) => {
            const isCompleted = optimizationProgress >= item.threshold;
            const isCurrent =
              optimizationProgress < item.threshold &&
              (index === 0 || optimizationProgress >= CHECK_ITEMS[index - 1].threshold);

            return (
              <div
                key={item.label}
                className={`flex items-center space-x-2.5 transition-colors ${
                  isCompleted
                    ? 'text-emerald-300'
                    : isCurrent
                    ? 'text-cyan-300 font-semibold'
                    : 'text-slate-500'
                }`}
              >
                <div
                  className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] ${
                    isCompleted
                      ? 'bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/40'
                      : isCurrent
                      ? 'bg-cyan-500/20 text-cyan-400 ring-1 ring-cyan-500/40'
                      : 'bg-slate-800 text-slate-500'
                  }`}
                >
                  {isCompleted ? <Check className="h-3 w-3" /> : index + 1}
                </div>
                <span className="truncate">{item.label}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

