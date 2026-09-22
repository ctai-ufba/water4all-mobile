/**
 * @file WaterTruckModal.tsx
 * @summary Modal dialog for requesting external water truck deliveries.
 * @description Allows the farm operator to order emergency water replenishment
 * (+10 m³ or +25 m³), immediately increasing the External supply tank volume
 * (clamped at capacity) and recording the simulated financial expense.
 */

import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useTelemetry } from '../../context/TelemetryContext';
import { Truck, AlertCircle, CheckCircle2, X } from 'lucide-react';
import { calculateTruckDelivery } from '../../domain/supervisoryEngine';
import { EXTERNAL_WATER_TRUCK_COST_EUR_PER_M3 } from '../../types/telemetry';

/**
 * Props for the WaterTruckModal component.
 */
export interface WaterTruckModalProps {
  /** Whether the modal dialog is open */
  isOpen: boolean;
  /** Callback to close the modal */
  onClose: () => void;
}

/**
 * Water truck emergency delivery modal.
 *
 * @summary Request external water truck modal.
 * @description Provides a supervisory dialog with +10 m³ and +25 m³ delivery options,
 * capacity headroom validation, and cost calculation.
 *
 * @param props - Component props containing isOpen and onClose.
 * @returns React.JSX.Element or null if not open.
 * @throws Never throws.
 */
export function WaterTruckModal({ isOpen, onClose }: WaterTruckModalProps): React.JSX.Element | null {
  const { activeFarm } = useAuth();
  const { telemetry, requestWaterTruck } = useTelemetry();

  const [selectedVolume, setSelectedVolume] = useState<10 | 25>(10);
  const [deliveryResult, setDeliveryResult] = useState<{
    deliveredM3: number;
    costEur: number;
    isCapped: boolean;
  } | null>(null);

  if (!isOpen || !activeFarm || !telemetry) {
    return null;
  }

  const currentVolume = telemetry.tankVolumes.external;
  const capacity = activeFarm.tankCapacities.external;
  const headroom = Math.max(0, capacity - currentVolume);
  const isFull = headroom <= 0;

  // Use domain engine to calculate delivery preview and cost (avoids Feature Envy)
  const deliveryPreview = calculateTruckDelivery(currentVolume, capacity, selectedVolume);

  /**
   * Dispatches the water truck delivery request to the telemetry context and records result.
   *
   * @summary Handle order confirmation.
   * @description Executes the delivery, updating tank volumes and logging expenses.
   *
   * @returns void
   * @throws Never throws.
   */
  const handleConfirmOrder = (): void => {
    if (isFull) return;

    const result = requestWaterTruck(selectedVolume);
    setDeliveryResult({
      deliveredM3: result.deliveredM3,
      costEur: result.addedCostEur,
      isCapped: result.isCapped,
    });
  };

  /**
   * Resets local modal feedback state and triggers the parent onClose callback.
   *
   * @summary Close modal.
   * @description Clears delivery feedback and invokes parent dismissal handler.
   *
   * @returns void
   * @throws Never throws.
   */
  const handleClose = (): void => {
    setDeliveryResult(null);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="water-truck-modal-title"
    >
      <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-5 shadow-2xl">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center space-x-2.5">
            <div className="rounded-xl bg-cyan-500/10 p-2 text-cyan-400 ring-1 ring-cyan-500/20">
              <Truck className="h-5 w-5" />
            </div>
            <div>
              <h2 id="water-truck-modal-title" className="text-base font-bold text-white">
                Request External Water Truck
              </h2>
              <span className="text-xs text-slate-400">Emergency Water Delivery</span>
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
        {deliveryResult ? (
          <div className="mt-4 space-y-4 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20">
              <CheckCircle2 className="h-7 w-7" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Delivery Confirmed!</h3>
              <p className="mt-1 text-xs text-slate-300">
                +{deliveryResult.deliveredM3.toFixed(1)} m³ delivered to External supply tank.
              </p>
              <p className="mt-1 text-xs font-semibold text-emerald-400">
                Expense logged: {deliveryResult.costEur.toFixed(2)} €
              </p>
              {deliveryResult.isCapped && (
                <p className="mt-1 text-[11px] text-amber-300">
                  Note: Delivery was capped at maximum tank capacity ({capacity.toFixed(1)} m³).
                </p>
              )}
            </div>

            <button
              onClick={handleClose}
              className="w-full rounded-xl bg-cyan-500 py-2.5 text-xs font-bold text-slate-950 shadow-md hover:bg-cyan-400 transition-colors"
            >
              Done
            </button>
          </div>
        ) : (
          /* Order Configuration View */
          <div className="mt-4 space-y-4">
            {/* Storage Status */}
            <div className="rounded-xl bg-slate-950/70 p-3 ring-1 ring-slate-800">
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">External Tank Current Volume:</span>
                <span className="font-bold text-white">
                  {currentVolume.toFixed(1)} m³ / {capacity.toFixed(1)} m³
                </span>
              </div>
              <div className="mt-1 flex justify-between text-xs">
                <span className="text-slate-400">Available Headroom:</span>
                <span className="font-bold text-cyan-400">{headroom.toFixed(1)} m³</span>
              </div>
            </div>

            {/* Delivery Volume Selector */}
            <div>
              <label className="text-xs font-semibold text-slate-300">
                Select Delivery Volume:
              </label>
              <div className="mt-2 grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setSelectedVolume(10)}
                  className={`flex flex-col items-center justify-center rounded-xl p-3 border transition-all ${
                    selectedVolume === 10
                      ? 'border-cyan-500 bg-cyan-500/15 text-cyan-300 ring-1 ring-cyan-500/30'
                      : 'border-slate-800 bg-slate-950/60 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <span className="text-lg font-extrabold">+10 m³</span>
                  <span className="text-[11px] font-medium text-slate-300">
                    {`${(10 * EXTERNAL_WATER_TRUCK_COST_EUR_PER_M3).toFixed(2)} € (${EXTERNAL_WATER_TRUCK_COST_EUR_PER_M3.toFixed(2)} €/m³)`}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedVolume(25)}
                  className={`flex flex-col items-center justify-center rounded-xl p-3 border transition-all ${
                    selectedVolume === 25
                      ? 'border-cyan-500 bg-cyan-500/15 text-cyan-300 ring-1 ring-cyan-500/30'
                      : 'border-slate-800 bg-slate-950/60 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <span className="text-lg font-extrabold">+25 m³</span>
                  <span className="text-[11px] font-medium text-slate-300">
                    {`${(25 * EXTERNAL_WATER_TRUCK_COST_EUR_PER_M3).toFixed(2)} € (${EXTERNAL_WATER_TRUCK_COST_EUR_PER_M3.toFixed(2)} €/m³)`}
                  </span>
                </button>
              </div>
            </div>

            {/* Capping Warning or Full Tank Notice */}
            {isFull ? (
              <div className="flex items-start space-x-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-2.5 text-xs text-amber-300">
                <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                <p className="leading-tight">
                  External supply tank is already at maximum capacity ({capacity.toFixed(1)} m³). Emergency delivery not needed.
                </p>
              </div>
            ) : deliveryPreview.isCapped ? (
              <div className="flex items-start space-x-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-2.5 text-xs text-amber-300">
                <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                <p className="leading-tight">
                  Requested +{selectedVolume} m³ exceeds available headroom ({headroom.toFixed(1)} m³).
                  Only {deliveryPreview.deliveredM3.toFixed(1)} m³ will be delivered, filling the tank to
                  maximum capacity ({capacity.toFixed(1)} m³) — the full ordered load is still billed at{' '}
                  {deliveryPreview.addedCostEur.toFixed(2)} €.
                </p>
              </div>
            ) : null}

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
                onClick={handleConfirmOrder}
                disabled={isFull}
                className={`flex-1 rounded-xl py-2.5 text-xs font-bold shadow-md transition-colors ${
                  isFull
                    ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                    : 'bg-cyan-500 text-slate-950 hover:bg-cyan-400'
                }`}
              >
                Confirm (+{selectedVolume} m³ · {deliveryPreview.addedCostEur.toFixed(2)} €)
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

