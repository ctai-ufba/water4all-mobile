/**
 * @file TelemetryContext.test.tsx
 * @summary Unit and integration tests for TelemetryContext and provider.
 * @description Verifies initialization of telemetry state from active farm profile,
 * profile switching synchronization, updating tank volumes and flows, and resetting.
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { TelemetryProvider, useTelemetry } from '../TelemetryContext';
import * as AuthContextModule from '../AuthContext';
import { FARM_PROFILES } from '../../types/farm';

/**
 * Helper testing component that consumes TelemetryContext.
 */
function TestTelemetryConsumer(): React.JSX.Element {
  const {
    telemetry,
    setTankVolumes,
    setFlows,
    setIrrigationMode,
    requestWaterTruck,
    executePumpTransfer,
    resetToBaseline,
  } = useTelemetry();

  if (!telemetry) {
    return <div data-testid="no-telemetry">No Telemetry</div>;
  }

  return (
    <div>
      <div data-testid="stored-volume">{telemetry.totalStoredVolume}</div>
      <div data-testid="autonomy-days">{telemetry.waterAutonomyDays}</div>
      <div data-testid="blend-volume">{telemetry.tankVolumes.blend}</div>
      <div data-testid="external-volume">{telemetry.tankVolumes.external}</div>
      <div data-testid="rainwater-volume">{telemetry.tankVolumes.rainwater}</div>
      <div data-testid="is-breached">{telemetry.isBelowMinOperatingVolume ? 'true' : 'false'}</div>
      <div data-testid="net-balance">{telemetry.netBalance}</div>
      <div data-testid="is-surplus">{telemetry.isSurplus ? 'surplus' : 'deficit'}</div>
      <div data-testid="savings-eur">{telemetry.dailySavingsEur}</div>
      <div data-testid="irrigation-mode">{telemetry.irrigationMode}</div>
      <div data-testid="irrigation-demand">{telemetry.flows.irrigationDemand}</div>
      <div data-testid="truck-cost">{telemetry.cumulativeTruckDeliveryCostEur}</div>

      <button
        onClick={() =>
          setTankVolumes((prev) => ({
            ...prev,
            blend: 4.0, // Below minimum operating volume for small farm (7.0)
          }))
        }
      >
        Deplete Blend Tank
      </button>

      <button
        onClick={() =>
          setFlows((prev) => ({
            ...prev,
            irrigationDemand: 10.0, // Cause deficit
          }))
        }
      >
        Increase Irrigation
      </button>

      <button onClick={() => setIrrigationMode('eco')}>Set Eco Mode</button>
      <button onClick={() => setIrrigationMode('paused')}>Set Paused Mode</button>
      <button onClick={() => setIrrigationMode('auto')}>Set Auto Mode</button>
      <button onClick={() => requestWaterTruck(10)}>Order 10m3 Truck</button>
      <button onClick={() => executePumpTransfer('rainwater', 3.0)}>Pump 3m3 Rainwater</button>
      <button onClick={() => resetToBaseline()}>Reset Baseline</button>
    </div>
  );
}

describe('TelemetryContext Seam', () => {
  it('throws error when useTelemetry is used outside TelemetryProvider', () => {
    // Suppress console.error in test output for expected throw
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => render(<TestTelemetryConsumer />)).toThrow(
      'useTelemetry must be used within a TelemetryProvider'
    );

    consoleSpy.mockRestore();
  });

  it('initializes telemetry state from active farm profile', () => {
    const activeFarm = FARM_PROFILES['small-farm'];
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      activeFarm,
      isAuthenticated: true,
      login: vi.fn(),
      logout: vi.fn(),
      switchFarm: vi.fn(),
    });

    render(
      <TelemetryProvider>
        <TestTelemetryConsumer />
      </TelemetryProvider>
    );

    expect(screen.getByTestId('stored-volume')).toHaveTextContent('77.2');
    expect(screen.getByTestId('autonomy-days')).toHaveTextContent('29.7');
    expect(screen.getByTestId('blend-volume')).toHaveTextContent('26.5');
    expect(screen.getByTestId('is-breached')).toHaveTextContent('false');
    expect(screen.getByTestId('is-surplus')).toHaveTextContent('surplus');
  });

  it('updates state dynamically and recalculates breach warning when tank is depleted', () => {
    const activeFarm = FARM_PROFILES['small-farm'];
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      activeFarm,
      isAuthenticated: true,
      login: vi.fn(),
      logout: vi.fn(),
      switchFarm: vi.fn(),
    });

    render(
      <TelemetryProvider>
        <TestTelemetryConsumer />
      </TelemetryProvider>
    );

    const depleteBtn = screen.getByRole('button', { name: 'Deplete Blend Tank' });
    act(() => {
      depleteBtn.click();
    });

    // Blend tank volume is now 4.0 m³, which is below minOperatingVolume (7.0 m³)
    expect(screen.getByTestId('blend-volume')).toHaveTextContent('4');
    expect(screen.getByTestId('is-breached')).toHaveTextContent('true');
  });

  it('recalculates balance when flows are updated', () => {
    const activeFarm = FARM_PROFILES['small-farm'];
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      activeFarm,
      isAuthenticated: true,
      login: vi.fn(),
      logout: vi.fn(),
      switchFarm: vi.fn(),
    });

    render(
      <TelemetryProvider>
        <TestTelemetryConsumer />
      </TelemetryProvider>
    );

    const increaseBtn = screen.getByRole('button', { name: 'Increase Irrigation' });
    act(() => {
      increaseBtn.click();
    });

    // Irrigation increased to 10.0 m³/day, total consumption = 10.5 m³/day vs inflow = 3.6 m³/day -> deficit
    expect(screen.getByTestId('is-surplus')).toHaveTextContent('deficit');
  });

  it('resets telemetry back to farm baseline', () => {
    const activeFarm = FARM_PROFILES['small-farm'];
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      activeFarm,
      isAuthenticated: true,
      login: vi.fn(),
      logout: vi.fn(),
      switchFarm: vi.fn(),
    });

    render(
      <TelemetryProvider>
        <TestTelemetryConsumer />
      </TelemetryProvider>
    );

    // Modify
    act(() => {
      screen.getByRole('button', { name: 'Deplete Blend Tank' }).click();
    });
    expect(screen.getByTestId('is-breached')).toHaveTextContent('true');

    // Reset
    act(() => {
      screen.getByRole('button', { name: 'Reset Baseline' }).click();
    });
    expect(screen.getByTestId('is-breached')).toHaveTextContent('false');
    expect(screen.getByTestId('blend-volume')).toHaveTextContent('26.5');
  });

  it('toggles irrigation mode and updates irrigation demand and water autonomy', () => {
    const activeFarm = FARM_PROFILES['small-farm'];
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      activeFarm,
      isAuthenticated: true,
      login: vi.fn(),
      logout: vi.fn(),
      switchFarm: vi.fn(),
    });

    render(
      <TelemetryProvider>
        <TestTelemetryConsumer />
      </TelemetryProvider>
    );

    // Initial mode is 'auto' with baseline irrigation demand = 2.1 m³/day
    expect(screen.getByTestId('irrigation-mode')).toHaveTextContent('auto');
    expect(screen.getByTestId('irrigation-demand')).toHaveTextContent('2.1');

    // Toggle to Eco (deficit irrigation, 60% of 2.1 = 1.26 m³/day)
    act(() => {
      screen.getByRole('button', { name: 'Set Eco Mode' }).click();
    });
    expect(screen.getByTestId('irrigation-mode')).toHaveTextContent('eco');
    expect(screen.getByTestId('irrigation-demand')).toHaveTextContent('1.26');

    // Toggle to Paused (irrigation demand = 0 m³/day)
    act(() => {
      screen.getByRole('button', { name: 'Set Paused Mode' }).click();
    });
    expect(screen.getByTestId('irrigation-mode')).toHaveTextContent('paused');
    expect(screen.getByTestId('irrigation-demand')).toHaveTextContent('0');

    // Toggle back to Auto
    act(() => {
      screen.getByRole('button', { name: 'Set Auto Mode' }).click();
    });
    expect(screen.getByTestId('irrigation-mode')).toHaveTextContent('auto');
    expect(screen.getByTestId('irrigation-demand')).toHaveTextContent('2.1');
  });

  it('handles external water truck requests, updates volume and tracks costs', () => {
    const activeFarm = FARM_PROFILES['small-farm'];
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      activeFarm,
      isAuthenticated: true,
      login: vi.fn(),
      logout: vi.fn(),
      switchFarm: vi.fn(),
    });

    render(
      <TelemetryProvider>
        <TestTelemetryConsumer />
      </TelemetryProvider>
    );

    // Initial external tank volume: 14.0 m³, capacity: 20.0 m³
    expect(screen.getByTestId('external-volume')).toHaveTextContent('14');
    expect(screen.getByTestId('truck-cost')).toHaveTextContent('0');

    // Order 10 m³ truck (capped at capacity 20.0 m³, cost: 10 * 4.50 = 45 EUR)
    act(() => {
      screen.getByRole('button', { name: 'Order 10m3 Truck' }).click();
    });
    expect(screen.getByTestId('external-volume')).toHaveTextContent('20');
    expect(screen.getByTestId('truck-cost')).toHaveTextContent('45');
  });

  it('executes manual pump transfer from rainwater to blend tank with mass balance', () => {
    const activeFarm = FARM_PROFILES['small-farm'];
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      activeFarm,
      isAuthenticated: true,
      login: vi.fn(),
      logout: vi.fn(),
      switchFarm: vi.fn(),
    });

    render(
      <TelemetryProvider>
        <TestTelemetryConsumer />
      </TelemetryProvider>
    );

    // Initial: Rainwater = 28.5 m³, Blend = 26.5 m³
    expect(screen.getByTestId('rainwater-volume')).toHaveTextContent('28.5');
    expect(screen.getByTestId('blend-volume')).toHaveTextContent('26.5');

    // Transfer 3.0 m³ from Rainwater to Blend
    act(() => {
      screen.getByRole('button', { name: 'Pump 3m3 Rainwater' }).click();
    });

    // Rainwater becomes 25.5 m³, Blend becomes 29.5 m³
    expect(screen.getByTestId('rainwater-volume')).toHaveTextContent('25.5');
    expect(screen.getByTestId('blend-volume')).toHaveTextContent('29.5');
  });

  it('rehydrates persisted irrigation mode and synchronizes initial flows on mount', () => {
    const activeFarm = FARM_PROFILES['small-farm'];
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      activeFarm,
      isAuthenticated: true,
      login: vi.fn(),
      logout: vi.fn(),
      switchFarm: vi.fn(),
    });

    // Simulate pre-existing persisted 'eco' mode in localStorage
    localStorage.setItem('water4all_telemetry_small-farm_irrigationMode', JSON.stringify('eco'));

    render(
      <TelemetryProvider>
        <TestTelemetryConsumer />
      </TelemetryProvider>
    );

    // Initial demand should already be scaled to 60% (1.26 m³/day) without user intervention
    expect(screen.getByTestId('irrigation-mode')).toHaveTextContent('eco');
    expect(screen.getByTestId('irrigation-demand')).toHaveTextContent('1.26');

    // Clean up
    localStorage.removeItem('water4all_telemetry_small-farm_irrigationMode');
  });
});

