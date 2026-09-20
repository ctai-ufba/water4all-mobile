/**
 * @file Header.tsx
 * @summary Top application header displaying active farm profile and session controls.
 * @description Renders the farm name, estate, geographic coordinates, profile switching
 * selector modal, and the logout trigger button.
 */

import React, { useState } from 'react';
import { Droplet, MapPin, RefreshCw, LogOut, X, Check } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { ALL_FARM_PROFILES } from '../../types/farm';

/**
 * Formats decimal latitude and longitude into human-readable cardinal coordinate text.
 *
 * @summary Format coordinates helper.
 * @description Formats latitude/longitude numbers into degrees with cardinal directions (N/S, E/W).
 *
 * @param lat - Latitude in decimal degrees.
 * @param lng - Longitude in decimal degrees.
 * @returns Formatted coordinate string, e.g. "37.0194° N, 4.5612° W".
 * @throws Never throws.
 */
export function formatCoordinates(lat: number, lng: number): string {
  const latDir = lat >= 0 ? 'N' : 'S';
  const lngDir = lng >= 0 ? 'E' : 'W';
  return `${Math.abs(lat).toFixed(4)}° ${latDir}, ${Math.abs(lng).toFixed(4)}° ${lngDir}`;
}

/**
 * Top application header component.
 *
 * @summary Mobile application header.
 * @description Displays the currently active Mediterranean farm information and provides
 * actions to switch profiles or log out.
 *
 * @returns React.JSX.Element representing the header and profile switcher modal.
 * @throws Never throws.
 */
export function Header(): React.JSX.Element {
  const { activeFarm, switchFarm, logout } = useAuth();
  const [isSwitchModalOpen, setIsSwitchModalOpen] = useState(false);

  if (!activeFarm) {
    return <header className="bg-slate-900 border-b border-slate-800 p-4 text-center text-xs text-slate-400">No active farm</header>;
  }

  const coordinatesText = formatCoordinates(
    activeFarm.coordinates.latitude,
    activeFarm.coordinates.longitude
  );

  return (
    <>
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-800/80 bg-slate-900/95 px-4 py-3 backdrop-blur-md">
        {/* Left: Branding & Active Farm Info */}
        <div className="flex items-center space-x-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-400 ring-1 ring-cyan-500/20">
            <Droplet className="h-5 w-5 fill-cyan-400" />
          </div>

          <div className="min-w-0">
            <div className="flex items-center space-x-1.5">
              <span className="truncate text-sm font-bold text-white">
                {activeFarm.name}
              </span>
              <span className="text-slate-400">•</span>
              <span className="truncate text-xs font-medium text-slate-300">
                {activeFarm.estateName}
              </span>
            </div>

            {/* Human-readable location and coordinates */}
            <div className="flex items-center text-[11px] text-slate-400">
              <MapPin className="mr-1 h-3 w-3 shrink-0 text-cyan-500" />
              <span className="truncate text-slate-300 font-medium mr-1.5">{activeFarm.location}</span>
              <span className="hidden sm:inline font-mono text-slate-400">({coordinatesText})</span>
            </div>
          </div>
        </div>

        {/* Right: Actions (Switch Profile, Logout) */}
        <div className="flex items-center space-x-1">
          <button
            onClick={() => setIsSwitchModalOpen(true)}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-800 hover:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/40"
            aria-label="Switch Farm Profile"
            title="Switch Farm Profile"
          >
            <RefreshCw className="h-4 w-4" />
          </button>

          <button
            onClick={logout}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-red-500/10 hover:text-red-400 focus:outline-none focus:ring-2 focus:ring-red-500/40"
            aria-label="Logout"
            title="Logout"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </header>

      {/* Farm Profile Switcher Modal */}
      {isSwitchModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-slate-800 bg-slate-900 p-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-semibold text-white">Switch Active Farm Profile</h3>
              <button
                onClick={() => setIsSwitchModalOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 space-y-2.5">
              {ALL_FARM_PROFILES.map((farm) => {
                const isSelected = farm.id === activeFarm.id;

                return (
                  <button
                    key={farm.id}
                    onClick={() => {
                      switchFarm(farm.id);
                      setIsSwitchModalOpen(false);
                    }}
                    className={`flex w-full items-center justify-between rounded-xl border p-3 text-left transition-all ${
                      isSelected
                        ? 'border-cyan-500/60 bg-cyan-500/10 text-white'
                        : 'border-slate-800 bg-slate-800/60 text-slate-300 hover:border-slate-700 hover:bg-slate-800'
                    }`}
                    aria-label={farm.name}
                  >
                    <div>
                      <div className="text-xs font-semibold">{farm.name}</div>
                      <div className="text-xs text-slate-400">{farm.estateName} ({farm.location})</div>
                    </div>
                    {isSelected && <Check className="h-4 w-4 text-cyan-400" />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

