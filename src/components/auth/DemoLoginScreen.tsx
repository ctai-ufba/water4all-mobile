/**
 * @file DemoLoginScreen.tsx
 * @summary 1-click demo authentication screen for Mediterranean farm selection.
 * @description Provides a touch-friendly, mobile-first login interface allowing farm
 * evaluators, presenters, and operators to enter the Water4All application with a single
 * tap by selecting either Small Farm (Antequera, Spain) or Medium Farm (Heraklion, Greece).
 */

import React from 'react';
import { Droplet, MapPin, Sprout, ArrowRight } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { ALL_FARM_PROFILES } from '../../types/farm';

/**
 * 1-Click Demo Login Screen component.
 *
 * @summary Demo login screen.
 * @description Renders application branding and interactive farm cards that trigger
 * immediate authentication upon selection without requiring typed credentials.
 *
 * @returns React.JSX.Element representing the demo login screen.
 * @throws Never throws.
 */
export function DemoLoginScreen(): React.JSX.Element {
  const { login } = useAuth();

  return (
    <div className="flex min-h-screen flex-col justify-between bg-slate-950 px-4 py-8 text-slate-100 sm:px-6 lg:px-8">
      {/* Top Branding Section */}
      <div className="mx-auto flex w-full max-w-md flex-col items-center text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-cyan-500/10 text-cyan-400 ring-1 ring-cyan-500/30">
          <Droplet className="h-8 w-8 fill-cyan-400" />
        </div>

        <h1 className="mt-4 text-3xl font-bold tracking-tight text-white sm:text-4xl">
          Water4All
        </h1>
        <p className="mt-1 text-sm font-medium text-cyan-400">
          Farm Water Monitoring PWA
        </p>
        <p className="mt-3 text-xs leading-relaxed text-slate-400">
          Real-time water autonomy, tank dynamics, and crop quality compliance for Mediterranean farms.
          Select a profile below to enter the live demo.
        </p>
      </div>

      {/* Farm Profile Selection Cards */}
      <div className="mx-auto mt-6 flex w-full max-w-md flex-col space-y-4">
        <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          Select Demo Farm Profile
        </div>

        {ALL_FARM_PROFILES.map((profile) => {
          // Inline comment: Distinguish farm scale visually (greenish for small family farm, cyan/blue for commercial)
          const isSmall = profile.id === 'small-farm';
          const compositeTitle = `${profile.name} (${profile.location.split(',')[0]}, ${profile.location.split(',').slice(-1)[0].trim()})`;

          return (
            <button
              key={profile.id}
              onClick={() => login(profile.id)}
              className="group relative flex flex-col rounded-2xl border border-slate-800 bg-slate-900/90 p-5 text-left transition-all duration-200 hover:border-cyan-500/50 hover:bg-slate-800/80 active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-cyan-500/40"
              aria-label={compositeTitle}
              title={compositeTitle}
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center space-x-2">
                    <span
                      className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold ${
                        isSmall
                          ? 'bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20'
                          : 'bg-cyan-500/10 text-cyan-400 ring-1 ring-cyan-500/20'
                      }`}
                    >
                      {compositeTitle}
                    </span>
                    <span className="text-xs text-slate-400">
                      {profile.areaHa} ha
                    </span>
                  </div>
                  <h2 className="mt-1 text-base font-semibold text-white">
                    {profile.estateName}
                  </h2>
                </div>

                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-800 text-slate-300 transition-colors group-hover:bg-cyan-500 group-hover:text-white">
                  <ArrowRight className="h-5 w-5" />
                </div>
              </div>

              {/* Location with coordinates */}
              <div className="mt-3 flex items-center text-xs text-slate-400">
                <MapPin className="mr-1.5 h-3.5 w-3.5 shrink-0 text-slate-500" />
                <span>{profile.location}</span>
              </div>

              {/* Crops and Activities */}
              <div className="mt-2.5 flex items-start text-xs text-slate-300">
                <Sprout className="mr-1.5 mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" />
                <span className="line-clamp-1">{profile.crops.join(', ')}</span>
              </div>

              {/* Summary description */}
              <p className="mt-3 text-xs leading-relaxed text-slate-400 line-clamp-2">
                {profile.description}
              </p>
            </button>
          );
        })}
      </div>

      {/* Footer Info */}
      <div className="mx-auto mt-6 w-full max-w-md text-center">
        <p className="text-[11px] text-slate-400">
          Demo mode: No credentials or backend required. Session automatically persists in browser storage.
        </p>
      </div>
    </div>
  );
}

