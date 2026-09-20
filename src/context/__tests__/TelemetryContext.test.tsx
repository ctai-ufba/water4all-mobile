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
      <div data-testid="is-breached">{telemetry.isBelowMinOperatingVolume ? 'true' : 'false'}</div>
      <div data-testid="net-balance">{telemetry.netBalance}</div>
      <div data-testid="is-surplus">{telemetry.isSurplus ? 'surplus' : 'deficit'}</div>
      <div data-testid="savings-eur">{telemetry.dailySavingsEur}</div>

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
});

