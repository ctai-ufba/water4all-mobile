/**
 * @file TanksView.test.tsx
 * @summary Component tests for the Tanks & Sources monitoring view.
 * @description Verifies rendering of all four farm tanks, fill gauges, capacities,
 * source status indicators, and color-coded alert banners for empty or critically low tanks.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TanksView } from '../TanksView';
import * as AuthContextModule from '../../../context/AuthContext';
import * as TelemetryContextModule from '../../../context/TelemetryContext';
import { FARM_PROFILES } from '../../../types/farm';
import { TelemetryState } from '../../../types/telemetry';

describe('TanksView Component', () => {
  const mockFarm = FARM_PROFILES['small-farm'];

  const normalTelemetry: TelemetryState = {
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

  const depletedTelemetry: TelemetryState = {
    ...normalTelemetry,
    tankVolumes: {
      rainwater: 0, // Depleted (0 m³)
      esa: 1.0, // Critically low (< 15% of 12.0 m³)
      external: 14.0,
      blend: 26.5,
    },
    flows: {
      ...normalTelemetry.flows,
      rainwaterInflow: 0.0, // No rainfall
    },
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
  });

  it('renders loading state when farm or telemetry is unavailable', () => {
    vi.spyOn(TelemetryContextModule, 'useTelemetry').mockReturnValue({
      telemetry: null,
      setTankVolumes: vi.fn(),
      setFlows: vi.fn(),
      setIrrigationMode: vi.fn(),
      requestWaterTruck: vi.fn(),
      executePumpTransfer: vi.fn(),
      resetToBaseline: vi.fn(),
      applySnapshot: vi.fn(),
    });

    render(<TanksView />);
    expect(screen.getByText(/Loading storage telemetry/i)).toBeInTheDocument();
  });

  it('renders farm storage overview banner with total capacity and volume', () => {
    vi.spyOn(TelemetryContextModule, 'useTelemetry').mockReturnValue({
      telemetry: normalTelemetry,
      setTankVolumes: vi.fn(),
      setFlows: vi.fn(),
      setIrrigationMode: vi.fn(),
      requestWaterTruck: vi.fn(),
      executePumpTransfer: vi.fn(),
      resetToBaseline: vi.fn(),
      applySnapshot: vi.fn(),
    });

    render(<TanksView />);

    expect(screen.getByText(/Tanks & Sources/i)).toBeInTheDocument();
    expect(screen.getByText(/Total Farm Storage/i)).toBeInTheDocument();

    // Small farm baseline total capacity is 45 + 12 + 20 + 35 = 112.0 m³
    expect(screen.getByText(/77.2 m³/i)).toBeInTheDocument();
    expect(screen.getByText(/\/ 112.0 m³ capacity/i)).toBeInTheDocument();
  });

  it('renders all four core farm tanks with volume, capacity, and fill percentage', () => {
    vi.spyOn(TelemetryContextModule, 'useTelemetry').mockReturnValue({
      telemetry: normalTelemetry,
      setTankVolumes: vi.fn(),
      setFlows: vi.fn(),
      setIrrigationMode: vi.fn(),
      requestWaterTruck: vi.fn(),
      executePumpTransfer: vi.fn(),
      resetToBaseline: vi.fn(),
      applySnapshot: vi.fn(),
    });

    render(<TanksView />);

    // 1. Rainwater tank
    expect(screen.getByText(/Rainwater Catchment/i)).toBeInTheDocument();
    expect(screen.getByText(/28.5 m³/i)).toBeInTheDocument();
    expect(screen.getByText(/\/ 45.0 m³/i)).toBeInTheDocument();

    // 2. ESA tank
    expect(screen.getByText(/ESA Atmospheric Generator/i)).toBeInTheDocument();
    expect(screen.getByText(/8.2 m³/i)).toBeInTheDocument();
    expect(screen.getByText(/\/ 12.0 m³/i)).toBeInTheDocument();

    // 3. External supply tank
    expect(screen.getByText(/External Water Supply/i)).toBeInTheDocument();
    expect(screen.getByText(/14.0 m³/i)).toBeInTheDocument();
    expect(screen.getByText(/\/ 20.0 m³/i)).toBeInTheDocument();

    // 4. Blend tank
    expect(screen.getByText(/Central Blend Tank/i)).toBeInTheDocument();
    expect(screen.getByText(/26.5 m³/i)).toBeInTheDocument();
    expect(screen.getByText(/\/ 35.0 m³/i)).toBeInTheDocument();
  });

  it('displays active source statuses for each tank', () => {
    vi.spyOn(TelemetryContextModule, 'useTelemetry').mockReturnValue({
      telemetry: normalTelemetry,
      setTankVolumes: vi.fn(),
      setFlows: vi.fn(),
      setIrrigationMode: vi.fn(),
      requestWaterTruck: vi.fn(),
      executePumpTransfer: vi.fn(),
      resetToBaseline: vi.fn(),
      applySnapshot: vi.fn(),
    });

    render(<TanksView />);

    // Small farm baseline flows: rainwaterInflow = 2.4, esaInflow = 1.2, externalInflow = 0.0, consumption = 2.6
    expect(screen.getByText(/Capturing Rain/i)).toBeInTheDocument();
    expect(screen.getByText(/Generating Water/i)).toBeInTheDocument();
    expect(screen.getByText(/Holding Reserve/i)).toBeInTheDocument();
    expect(screen.getByText(/Distributing Water/i)).toBeInTheDocument();
  });

  it('displays color-coded alert when a source tank is critically low or empty', () => {
    vi.spyOn(TelemetryContextModule, 'useTelemetry').mockReturnValue({
      telemetry: depletedTelemetry,
      setTankVolumes: vi.fn(),
      setFlows: vi.fn(),
      setIrrigationMode: vi.fn(),
      requestWaterTruck: vi.fn(),
      executePumpTransfer: vi.fn(),
      resetToBaseline: vi.fn(),
      applySnapshot: vi.fn(),
    });

    render(<TanksView />);

    // Should display depleted alert for Rainwater
    expect(screen.getByText(/Depleted \(Empty\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Catchment reservoir depleted/i)).toBeInTheDocument();

    // Critical storage alerts banner should appear
    expect(screen.getByText(/Critical Storage Alerts/i)).toBeInTheDocument();
  });

  it('displays threshold markers for Blend tank', () => {
    vi.spyOn(TelemetryContextModule, 'useTelemetry').mockReturnValue({
      telemetry: normalTelemetry,
      setTankVolumes: vi.fn(),
      setFlows: vi.fn(),
      setIrrigationMode: vi.fn(),
      requestWaterTruck: vi.fn(),
      executePumpTransfer: vi.fn(),
      resetToBaseline: vi.fn(),
      applySnapshot: vi.fn(),
    });

    render(<TanksView />);

    // Min operating volume: 7.0 m³, Target: 28.0 m³
    expect(screen.getByText(/Min Operating: 7.0 m³/i)).toBeInTheDocument();
    expect(screen.getByText(/Target: 28.0 m³/i)).toBeInTheDocument();
  });

  it('renders supervisory controls and opens modals when quick action buttons are clicked', () => {
    vi.spyOn(TelemetryContextModule, 'useTelemetry').mockReturnValue({
      telemetry: normalTelemetry,
      setTankVolumes: vi.fn(),
      setFlows: vi.fn(),
      setIrrigationMode: vi.fn(),
      requestWaterTruck: vi.fn(),
      executePumpTransfer: vi.fn(),
      resetToBaseline: vi.fn(),
      applySnapshot: vi.fn(),
    });

    render(<TanksView />);

    // Supervisory mode selector should be present
    expect(screen.getByText(/Irrigation Mode/i)).toBeInTheDocument();

    // Quick action buttons should be present
    const requestTruckBtn = screen.getByRole('button', { name: /Request Truck/i });
    const pumpTransferBtn = screen.getByRole('button', { name: /Pump Transfer/i });
    expect(requestTruckBtn).toBeInTheDocument();
    expect(pumpTransferBtn).toBeInTheDocument();

    // Open Water Truck Modal
    fireEvent.click(requestTruckBtn);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText(/Request External Water Truck/i)).toBeInTheDocument();

    // Close Water Truck Modal
    fireEvent.click(screen.getByRole('button', { name: /Close dialog/i }));

    // Open Pump Transfer Modal
    fireEvent.click(pumpTransferBtn);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText(/Manual Pump Transfer/i)).toBeInTheDocument();
  });
});
