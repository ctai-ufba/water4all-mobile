/**
 * @file PumpTransferModal.tsx
 * @summary Modal dialog for manual water pump transfers into the Blend tank.
 * @description Allows the farm operator to select Rainwater tank or ESA tank as the source and
 * specify a transfer volume within the manual operating band (quick presets, or any value between
 * MIN_MANUAL_TRANSFER_VOLUME_M3 and MAX_MANUAL_TRANSFER_VOLUME_M3). Source availability and Blend
 * tank headroom are validated by the mass-balance engine before the transfer can be executed.
 */

import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useTelemetry } from '../../context/TelemetryContext';
import { ArrowRightLeft, CloudRain, Wind, Cylinder, AlertCircle, CheckCircle2, X } from 'lucide-react';
import { TransferSourceTank } from '../../types/telemetry';
import {
  validateAndExecutePumpTransfer,
  MIN_MANUAL_TRANSFER_VOLUME_M3,
  MAX_MANUAL_TRANSFER_VOLUME_M3,
} from '../../domain/supervisoryEngine';

/**
 * Props for the PumpTransferModal component.
 */
export interface PumpTransferModalProps {
  /** Whether the modal dialog is open */
  isOpen: boolean;
  /** Initial source tank to preselect */
  initialSource?: TransferSourceTank;
  /** Callback to close the modal */
  onClose: () => void;
}

const PRESET_VOLUMES = [1.0, 2.0, 3.0, 5.0];

/**
 * Manual pump transfer modal component.
 *
 * @summary Manual pump transfer dialog.
 * @description Provides a supervisory interface to transfer water from source reservoirs
 * to the central Blend tank, with live validation of source availability and target capacity.
 *
 * @param props - Component props containing isOpen, initialSource, and onClose.
 * @returns React.JSX.Element or null if not open.
 * @throws Never throws.
 */
export function PumpTransferModal({
  isOpen,
  initialSource = 'rainwater',
  onClose,
}: PumpTransferModalProps): React.JSX.Element | null {
  const { activeFarm } = useAuth();
  const { telemetry, executePumpTransfer } = useTelemetry();

  const [fromTank, setFromTank] = useState<TransferSourceTank>(initialSource);
  const [volumeM3, setVolumeM3] = useState<number>(2.0);
  const [transferSuccess, setTransferSuccess] = useState<{
    transferredM3: number;
    fromTank: TransferSourceTank;
  } | null>(null);

  if (!isOpen || !activeFarm || !telemetry) {
    return null;
  }

  const sourceVolume = telemetry.tankVolumes[fromTank];
  const blendVolume = telemetry.tankVolumes.blend;
  const blendCapacity = activeFarm.tankCapacities.blend;
  const blendHeadroom = Math.max(0, blendCapacity - blendVolume);

  // Dry-run the transfer through the engine so the button can never enable a transfer the
  // engine would reject. validateAndExecutePumpTransfer is pure, so previewing costs nothing.
  const transferPreview = validateAndExecutePumpTransfer({
    fromTank,
    volumeM3,
    currentVolumes: telemetry.tankVolumes,
    capacities: activeFarm.tankCapacities,
  });

  // The engine does not police the operating band, so the interface does.
  const isOutOfBand =
    volumeM3 < MIN_MANUAL_TRANSFER_VOLUME_M3 || volumeM3 > MAX_MANUAL_TRANSFER_VOLUME_M3;

  // Retained only to phrase the operator-facing messages, which name the tank the engine
  // error does not. The engine remains the sole authority on whether a transfer may run.
  const isSourceInsufficient = volumeM3 > sourceVolume;
  const isBlendOverflow = volumeM3 > blendHeadroom;
  const isValid = transferPreview.success && !isOutOfBand;

  /**
   * Dispatches the manual pump transfer to the telemetry context and records result.
   *
   * @summary Execute transfer.
   * @description Validates transfer parameters and dispatches executePumpTransfer.
   *
   * @returns void
   * @throws Never throws.
   */
  const handleExecuteTransfer = (): void => {
    if (!isValid) return;

    const result = executePumpTransfer(fromTank, volumeM3);
    if (result.success) {
      setTransferSuccess({
        transferredM3: result.transferredM3,
        fromTank,
      });
    }
  };

  /**
   * Resets local modal feedback state and triggers the parent onClose callback.
   *
   * @summary Close modal.
   * @description Clears transfer feedback and invokes parent dismissal handler.
   *
   * @returns void
   * @throws Never throws.
   */
  const handleClose = (): void => {
    setTransferSuccess(null);
    onClose();
  };

  const sourceName = fromTank === 'rainwater' ? 'Rainwater tank' : 'ESA tank';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pump-transfer-modal-title"
    >
      <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-5 shadow-2xl">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center space-x-2.5">
            <div className="rounded-xl bg-cyan-500/10 p-2 text-cyan-400 ring-1 ring-cyan-500/20">
              <ArrowRightLeft className="h-5 w-5" />
            </div>
            <div>
              <h2 id="pump-transfer-modal-title" className="text-base font-bold text-white">
                Manual Pump Transfer
              </h2>
              <span className="text-xs text-slate-400">Supervisory Reservoir Mixing</span>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
            aria-label="Close dialog"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Success Feedback View */}
        {transferSuccess ? (
          <div className="mt-4 space-y-4 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20">
              <CheckCircle2 className="h-7 w-7" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Transfer Completed!</h3>
              <p className="mt-1 text-xs text-slate-300">
                Successfully transferred <strong>{transferSuccess.transferredM3.toFixed(1)} m³</strong> from{' '}
                {transferSuccess.fromTank === 'rainwater' ? 'Rainwater tank' : 'ESA tank'} into Blend tank.
              </p>
              <p className="mt-1 text-xs font-semibold text-emerald-400">
                Mass balance conserved (Total farm stored water unchanged).
              </p>
            </div>

            <button
              onClick={handleClose}
              className="w-full rounded-xl bg-cyan-500 py-2.5 text-xs font-bold text-slate-950 shadow-md hover:bg-cyan-400 transition-colors"
            >
              Done
            </button>
          </div>
        ) : (
          /* Transfer Configuration View */
          <div className="mt-4 space-y-4">
            {/* Source Reservoir Selector */}
            <div>
              <label className="text-xs font-semibold text-slate-300">
                Select Source Reservoir:
              </label>
              <div className="mt-2 grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setFromTank('rainwater')}
                  className={`flex items-center space-x-2.5 rounded-xl p-3 border transition-all ${
                    fromTank === 'rainwater'
                      ? 'border-cyan-500 bg-cyan-500/15 text-cyan-300 ring-1 ring-cyan-500/30'
                      : 'border-slate-800 bg-slate-950/60 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <CloudRain className="h-5 w-5 flex-shrink-0" />
                  <div className="text-left">
                    <div className="text-xs font-bold">Rainwater tank</div>
                    <div className="text-[11px] text-slate-300">
                      {telemetry.tankVolumes.rainwater.toFixed(1)} m³ avail
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setFromTank('esa')}
                  className={`flex items-center space-x-2.5 rounded-xl p-3 border transition-all ${
                    fromTank === 'esa'
                      ? 'border-cyan-500 bg-cyan-500/15 text-cyan-300 ring-1 ring-cyan-500/30'
                      : 'border-slate-800 bg-slate-950/60 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <Wind className="h-5 w-5 flex-shrink-0" />
                  <div className="text-left">
                    <div className="text-xs font-bold">ESA tank</div>
                    <div className="text-[11px] text-slate-300">
                      {telemetry.tankVolumes.esa.toFixed(1)} m³ avail
                    </div>
                  </div>
                </button>
              </div>
            </div>

            {/* Target Blend Tank Indicator */}
            <div className="rounded-xl bg-slate-950/70 p-3 ring-1 ring-slate-800">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center space-x-2 text-slate-300">
                  <Cylinder className="h-4 w-4 text-cyan-400" />
                  <span className="font-semibold">Target: Blend tank</span>
                </div>
                <span className="font-bold text-white">
                  {blendVolume.toFixed(1)} / {blendCapacity.toFixed(1)} m³
                </span>
              </div>
              <div className="mt-1 flex justify-between text-[11px] text-slate-400">
                <span>Available Headroom:</span>
                <span className="font-bold text-cyan-400">{blendHeadroom.toFixed(1)} m³</span>
              </div>
            </div>

            {/* Transfer Volume Selector */}
            <div>
              <div className="flex items-center justify-between">
                <label htmlFor="pump-volume-input" className="text-xs font-semibold text-slate-300">
                  Transfer Volume:
                </label>
                <div className="flex items-center space-x-1.5">
                  <input
                    id="pump-volume-input"
                    type="number"
                    min={MIN_MANUAL_TRANSFER_VOLUME_M3}
                    max={MAX_MANUAL_TRANSFER_VOLUME_M3}
                    step="0.1"
                    value={volumeM3}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      setVolumeM3(isNaN(val) ? 0 : Math.round(val * 10) / 10);
                    }}
                    className="w-20 rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-right text-sm font-extrabold text-white focus:border-cyan-500 focus:outline-none ring-1 ring-slate-800"
                  />
                  <span className="text-xs text-slate-400">m³</span>
                </div>
              </div>

              {/* Volume Presets */}
              <div className="mt-2 grid grid-cols-4 gap-2">
                {PRESET_VOLUMES.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setVolumeM3(preset)}
                    className={`rounded-xl py-2 text-xs font-bold transition-all border ${
                      volumeM3 === preset
                        ? 'border-cyan-500 bg-cyan-500/20 text-cyan-300 ring-1 ring-cyan-500/30'
                        : 'border-slate-800 bg-slate-950/60 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    {preset} m³
                  </button>
                ))}
              </div>
            </div>

            {/* Validation & Error Display */}
            {isSourceInsufficient && !isOutOfBand && (
              <div className="flex items-start space-x-2 rounded-xl border border-rose-500/30 bg-rose-500/10 p-2.5 text-xs text-rose-300">
                <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                <p className="leading-tight">
                  Insufficient water in {sourceName}. Available: {sourceVolume.toFixed(1)} m³.
                </p>
              </div>
            )}

            {isOutOfBand && volumeM3 > 0 && (
              <div className="flex items-start space-x-2 rounded-xl border border-rose-500/30 bg-rose-500/10 p-2.5 text-xs text-rose-300">
                <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                <p className="leading-tight">
                  A single manual transfer must be between {MIN_MANUAL_TRANSFER_VOLUME_M3.toFixed(1)} and{' '}
                  {MAX_MANUAL_TRANSFER_VOLUME_M3.toFixed(1)} m³.
                </p>
              </div>
            )}

            {isBlendOverflow && !isOutOfBand && (
              <div className="flex items-start space-x-2 rounded-xl border border-rose-500/30 bg-rose-500/10 p-2.5 text-xs text-rose-300">
                <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                <p className="leading-tight">
                  Transfer would exceed Blend tank capacity. Headroom: {blendHeadroom.toFixed(1)} m³.
                </p>
              </div>
            )}

            {isValid && (
              <div className="flex items-start space-x-2 rounded-xl border border-cyan-500/30 bg-cyan-500/10 p-2.5 text-xs text-cyan-300">
                <CheckCircle2 className="h-4 w-4 flex-shrink-0 mt-0.5" />
                <p className="leading-tight">
                  Ready: -{volumeM3.toFixed(1)} m³ from {sourceName} {'->'} +{volumeM3.toFixed(1)} m³ into Blend tank.
                </p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex space-x-3 pt-2">
              <button
                type="button"
                onClick={handleClose}
                className="flex-1 rounded-xl border border-slate-700 bg-slate-800 py-2.5 text-xs font-semibold text-slate-300 hover:bg-slate-700 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteTransfer}
                disabled={!isValid}
                className={`flex-1 rounded-xl py-2.5 text-xs font-bold shadow-md transition-colors ${
                  isValid
                    ? 'bg-cyan-500 text-slate-950 hover:bg-cyan-400'
                    : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                }`}
              >
                Execute Transfer
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
