/**
 * @file DemoFloatingTrigger.tsx
 * @summary Persistent floating presentation action button for opening the Demo Controller Drawer.
 * @description Provides a persistent, accessible FAB trigger for presenters and stakeholders to
 * quickly access time controls, extreme scenarios, baseline toggles, and system optimization.
 */

import React from 'react';
import { Sliders, Sparkles } from 'lucide-react';
import { useDemo } from '../../context/DemoContext';

/**
 * Persistent floating action button triggering the Demo Controller Drawer.
 *
 * @summary Floating demo trigger button.
 * @description Floats in the lower-right area of the mobile frame above the bottom navigation bar.
 * Displays active indicators when scenarios or unoptimized baselines are active.
 *
 * @returns React.JSX.Element representing the floating trigger button.
 * @throws Never throws.
 */
export function DemoFloatingTrigger(): React.JSX.Element {
  const { openDrawer, scenario, isUnoptimizedBaseline } = useDemo();

  const hasActiveOverrides = scenario !== 'live' || isUnoptimizedBaseline;

  return (
    <button
      onClick={openDrawer}
      className={`fixed bottom-16 right-4 z-20 flex items-center space-x-2 rounded-full px-3.5 py-2.5 shadow-xl backdrop-blur-md transition-all duration-200 active:scale-95 focus:outline-none focus:ring-2 focus:ring-cyan-400 ${
        hasActiveOverrides
          ? 'bg-amber-600/90 text-white ring-2 ring-amber-400/60 shadow-amber-900/30'
          : 'bg-gradient-to-r from-cyan-600 to-teal-600 text-white ring-1 ring-cyan-400/40 shadow-cyan-950/50 hover:brightness-110'
      }`}
      aria-label="Open Demo Presentation Controller"
      title="Open Demo Presentation Controller"
      data-testid="demo-floating-trigger"
    >
      {hasActiveOverrides ? (
        <Sparkles className="h-4 w-4 animate-spin text-amber-200" />
      ) : (
        <Sliders className="h-4 w-4 text-cyan-200" />
      )}
      <span className="text-xs font-bold tracking-tight">Demo</span>
      {hasActiveOverrides && (
        <span className="flex h-2 w-2 rounded-full bg-amber-300 animate-ping" />
      )}
    </button>
  );
}

