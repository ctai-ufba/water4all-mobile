/**
 * @file SupervisoryControls.test.tsx
 * @summary Component tests for supervisory controls: IrrigationModeSelector, WaterTruckModal, and PumpTransferModal.
 * @description Verifies user interactions, modal state management, validation feedback, and context dispatches.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { IrrigationModeSelector } from '../IrrigationModeSelector';
import { WaterTruckModal } from '../WaterTruckModal';
import { PumpTransferModal } from '../PumpTransferModal';
import * as AuthContextModule from '../../../context/AuthContext';
import * as TelemetryContextModule from '../../../context/TelemetryContext';
import { FARM_PROFILES } from '../../../types/farm';
import { TelemetryState } from '../../../types/telemetry';

describe('Supervisory Controls Components', () => {
  const mockFarm = FARM_PROFILES['small-farm'];

  const mockTelemetry: TelemetryState = {
    tankVolumes: {
      rainwater: 28.5,
      esa: 8.2,
      external: 14.0,
      blend: 26.5,
    },
    flows: {
      rainwaterInflow: 2.4,
      esaInflow: 1.2,
      externalInflow: 0.0,
      irrigationDemand: 2.1,
      humanUtilityDemand: 0.5,
      livestockDemand: 0.0,
    },
    totalStoredVolume: 77.2,
    totalInflow: 3.6,
    totalConsumption: 2.6,
    waterAutonomyDays: 29.7,
    netBalance: 1.0,
    isSurplus: true,
    localWaterPercentage: 100,
    dailySavingsEur: 11.7,
    isBelowMinOperatingVolume: false,
    blendDeficitM3: 0,
    irrigationMode: 'auto',
    cumulativeTruckDeliveryCostEur: 0,
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      activeFarm: mockFarm,
      isAuthenticated: true,
      login: vi.fn(),
      logout: vi.fn(),
      switchFarm: vi.fn(),
    });
    vi.spyOn(TelemetryContextModule, 'useTelemetry').mockReturnValue({
      telemetry: mockTelemetry,
      setTankVolumes: vi.fn(),
      setFlows: vi.fn(),
      setIrrigationMode: vi.fn(),
      requestWaterTruck: vi.fn(),
      executePumpTransfer: vi.fn(),
      resetToBaseline: vi.fn(),
    });
  });

  describe('IrrigationModeSelector', () => {
    it('renders all three irrigation modes and highlights active mode', () => {
      render(<IrrigationModeSelector />);

      expect(screen.getByText(/Irrigation Mode/i)).toBeInTheDocument();
      expect(screen.getByRole('radio', { name: /Auto/i })).toBeInTheDocument();
      expect(screen.getByRole('radio', { name: /Eco/i })).toBeInTheDocument();
      expect(screen.getByRole('radio', { name: /Paused/i })).toBeInTheDocument();

      // Auto mode is checked
      expect(screen.getByRole('radio', { name: /Auto/i })).toHaveAttribute('aria-checked', 'true');
    });

    it('triggers setIrrigationMode when user selects another mode', () => {
      const setIrrigationModeMock = vi.fn();
      vi.spyOn(TelemetryContextModule, 'useTelemetry').mockReturnValue({
        telemetry: mockTelemetry,
        setTankVolumes: vi.fn(),
        setFlows: vi.fn(),
        setIrrigationMode: setIrrigationModeMock,
        requestWaterTruck: vi.fn(),
        executePumpTransfer: vi.fn(),
        resetToBaseline: vi.fn(),
      });

      render(<IrrigationModeSelector />);

      const ecoBtn = screen.getByRole('radio', { name: /Eco/i });
      fireEvent.click(ecoBtn);
      expect(setIrrigationModeMock).toHaveBeenCalledWith('eco');

      const pausedBtn = screen.getByRole('radio', { name: /Paused/i });
      fireEvent.click(pausedBtn);
      expect(setIrrigationModeMock).toHaveBeenCalledWith('paused');
    });
  });

  describe('WaterTruckModal', () => {
    it('does not render when isOpen is false', () => {
      render(<WaterTruckModal isOpen={false} onClose={vi.fn()} />);
      expect(screen.queryByText(/Request External Water Truck/i)).not.toBeInTheDocument();
    });

    it('renders storage status and delivery volume options when isOpen is true', () => {
      render(<WaterTruckModal isOpen={true} onClose={vi.fn()} />);

      expect(screen.getByText(/Request External Water Truck/i)).toBeInTheDocument();
      // External tank is 14.0 m³ / 20.0 m³, headroom is 6.0 m³
      expect(screen.getByText(/14.0 m³ \/ 20.0 m³/i)).toBeInTheDocument();
      expect(screen.getByText(/Available Headroom:/i)).toBeInTheDocument();
      expect(screen.getAllByText(/6.0 m³/i).length).toBeGreaterThanOrEqual(1);

      // Options +10 m³ and +25 m³
      expect(screen.getByRole('button', { name: /^\+10 m³/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /^\+25 m³/i })).toBeInTheDocument();
    });

    it('dispatches requestWaterTruck upon confirming order and shows success feedback', () => {
      const requestTruckMock = vi.fn().mockReturnValue({
        deliveredM3: 6.0,
        addedCostEur: 45.0,
        isCapped: true,
        newVolumeM3: 20.0,
      });

      vi.spyOn(TelemetryContextModule, 'useTelemetry').mockReturnValue({
        telemetry: mockTelemetry,
        setTankVolumes: vi.fn(),
        setFlows: vi.fn(),
        setIrrigationMode: vi.fn(),
        requestWaterTruck: requestTruckMock,
        executePumpTransfer: vi.fn(),
        resetToBaseline: vi.fn(),
      });

      render(<WaterTruckModal isOpen={true} onClose={vi.fn()} />);

      const confirmBtn = screen.getByRole('button', { name: /Confirm/i });
      fireEvent.click(confirmBtn);

      expect(requestTruckMock).toHaveBeenCalledWith(10);
      expect(screen.getByText(/Delivery Confirmed!/i)).toBeInTheDocument();
      expect(screen.getByText(/Expense logged: 45.00 €/i)).toBeInTheDocument();
    });

    it('disables order confirmation and shows notice when External supply tank is full', () => {
      const fullExternalTelemetry: TelemetryState = {
        ...mockTelemetry,
        tankVolumes: {
          ...mockTelemetry.tankVolumes,
          external: 20.0, // Equals capacity 20.0 m³
        },
      };

      vi.spyOn(TelemetryContextModule, 'useTelemetry').mockReturnValue({
        telemetry: fullExternalTelemetry,
        setTankVolumes: vi.fn(),
        setFlows: vi.fn(),
        setIrrigationMode: vi.fn(),
        requestWaterTruck: vi.fn(),
        executePumpTransfer: vi.fn(),
        resetToBaseline: vi.fn(),
      });

      render(<WaterTruckModal isOpen={true} onClose={vi.fn()} />);

      expect(
        screen.getByText(/External supply tank is already at maximum capacity/i)
      ).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Confirm/i })).toBeDisabled();
    });
  });

  describe('PumpTransferModal', () => {
    it('does not render when isOpen is false', () => {
      render(<PumpTransferModal isOpen={false} onClose={vi.fn()} />);
      expect(screen.queryByText(/Manual Pump Transfer/i)).not.toBeInTheDocument();
    });

    it('renders source options, Blend target, and volume presets', () => {
      vi.spyOn(TelemetryContextModule, 'useTelemetry').mockReturnValue({
        telemetry: mockTelemetry,
        setTankVolumes: vi.fn(),
        setFlows: vi.fn(),
        setIrrigationMode: vi.fn(),
        requestWaterTruck: vi.fn(),
        executePumpTransfer: vi.fn(),
        resetToBaseline: vi.fn(),
      });

      render(<PumpTransferModal isOpen={true} onClose={vi.fn()} />);

      expect(screen.getByText(/Manual Pump Transfer/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Rainwater/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /ESA/i })).toBeInTheDocument();
      expect(screen.getByText(/Target: Blend tank/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Execute Transfer/i })).toBeEnabled();
    });

    it('disables execute button and shows error when source volume is insufficient', () => {
      const lowSourceTelemetry: TelemetryState = {
        ...mockTelemetry,
        tankVolumes: {
          ...mockTelemetry.tankVolumes,
          rainwater: 0.5, // Less than preset 2.0 m³
        },
      };

      vi.spyOn(TelemetryContextModule, 'useTelemetry').mockReturnValue({
        telemetry: lowSourceTelemetry,
        setTankVolumes: vi.fn(),
        setFlows: vi.fn(),
        setIrrigationMode: vi.fn(),
        requestWaterTruck: vi.fn(),
        executePumpTransfer: vi.fn(),
        resetToBaseline: vi.fn(),
      });

      render(<PumpTransferModal isOpen={true} onClose={vi.fn()} />);

      expect(screen.getByText(/Insufficient water in Rainwater tank/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Execute Transfer/i })).toBeDisabled();
    });

    it('allows entering an arbitrary transfer volume via number input', () => {
      const executePumpTransferMock = vi.fn().mockReturnValue({
        success: true,
        transferredM3: 1.5,
        updatedVolumes: {
          ...mockTelemetry.tankVolumes,
          rainwater: 27.0,
          blend: 28.0,
        },
      });

      vi.spyOn(TelemetryContextModule, 'useTelemetry').mockReturnValue({
        telemetry: mockTelemetry,
        setTankVolumes: vi.fn(),
        setFlows: vi.fn(),
        setIrrigationMode: vi.fn(),
        requestWaterTruck: vi.fn(),
        executePumpTransfer: executePumpTransferMock,
        resetToBaseline: vi.fn(),
      });

      render(<PumpTransferModal isOpen={true} onClose={vi.fn()} />);

      const volumeInput = screen.getByLabelText(/Transfer Volume:/i);
      fireEvent.change(volumeInput, { target: { value: '1.5' } });

      const executeBtn = screen.getByRole('button', { name: /Execute Transfer/i });
      fireEvent.click(executeBtn);

      expect(executePumpTransferMock).toHaveBeenCalledWith('rainwater', 1.5);
    });

    it('dispatches executePumpTransfer on valid submission and shows completion feedback', () => {
      const executePumpTransferMock = vi.fn().mockReturnValue({
        success: true,
        transferredM3: 2.0,
        updatedVolumes: {
          ...mockTelemetry.tankVolumes,
          rainwater: 26.5,
          blend: 28.5,
        },
      });

      vi.spyOn(TelemetryContextModule, 'useTelemetry').mockReturnValue({
        telemetry: mockTelemetry,
        setTankVolumes: vi.fn(),
        setFlows: vi.fn(),
        setIrrigationMode: vi.fn(),
        requestWaterTruck: vi.fn(),
        executePumpTransfer: executePumpTransferMock,
        resetToBaseline: vi.fn(),
      });

      render(<PumpTransferModal isOpen={true} onClose={vi.fn()} />);

      const executeBtn = screen.getByRole('button', { name: /Execute Transfer/i });
      fireEvent.click(executeBtn);

      expect(executePumpTransferMock).toHaveBeenCalledWith('rainwater', 2.0);
      expect(screen.getByText(/Transfer Completed!/i)).toBeInTheDocument();
      expect(screen.getByText(/Mass balance conserved/i)).toBeInTheDocument();
    });
  });
});
