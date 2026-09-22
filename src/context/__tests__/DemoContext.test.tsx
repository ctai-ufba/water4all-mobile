/**
 * @file DemoContext.test.tsx
 * @summary Unit and integration tests for DemoContext.
 * @description Verifies scenario selection, unoptimized baseline toggling, time advancement,
 * optimization animation execution, and drawer visibility controls.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { DemoProvider, useDemo } from '../DemoContext';
import * as AuthContextModule from '../AuthContext';
import * as TelemetryContextModule from '../TelemetryContext';
import * as WeatherContextModule from '../WeatherContext';
import { FARM_PROFILES } from '../../types/farm';
import { BASELINE_TELEMETRY, TelemetryState } from '../../types/telemetry';

describe('DemoContext', () => {
  const mockFarm = FARM_PROFILES['small-farm'];
  const mockBaseline = BASELINE_TELEMETRY['small-farm'];

  const mockTelemetry: TelemetryState = {
    tankVolumes: { ...mockBaseline.volumes },
    flows: { ...mockBaseline.flows },
    totalStoredVolume: 77.2,
    totalInflow: 3.6,
    totalConsumption: 2.6,
    waterAutonomyDays: 29.7,
    netBalance: 1.0,
    isSurplus: true,
    localWaterPercentage: 100,
    dailySavingsEur: 11.7,
    avoidedTruckCostEur: 11.70,
    esaEnergyCostEur: 0,
    isBelowMinOperatingVolume: false,
    blendDeficitM3: 0,
    irrigationMode: 'auto',
    cumulativeTruckDeliveryCostEur: 0,
  };

  const setTankVolumesMock = vi.fn();
  const setFlowsMock = vi.fn();
  const resetToBaselineMock = vi.fn();
  const applySnapshotMock = vi.fn();
  const setCustomWeatherMock = vi.fn();

  beforeEach(() => {
    vi.useFakeTimers();
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
      setTankVolumes: setTankVolumesMock,
      setFlows: setFlowsMock,
      setIrrigationMode: vi.fn(),
      requestWaterTruck: vi.fn(),
      executePumpTransfer: vi.fn(),
      resetToBaseline: resetToBaselineMock,
      applySnapshot: applySnapshotMock,
      scheduledIrrigationDemand: mockBaseline.flows.irrigationDemand,
    });

    vi.spyOn(WeatherContextModule, 'useWeather').mockReturnValue({
      weather: null,
      loading: false,
      esaProduction: null,
      catchmentEstimate: null,
      refetch: vi.fn(),
      setCustomWeather: setCustomWeatherMock,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  /**
   * Helper test consumer component.
   */
  function TestConsumer(): React.JSX.Element {
    const {
      scenario,
      isUnoptimizedBaseline,
      qualityRegime,
      isDrawerOpen,
      isOptimizing,
      optimizationProgress,
      elapsedSimulatedHours,
      openDrawer,
      closeDrawer,
      selectScenario,
      toggleUnoptimizedBaseline,
      advanceTime,
      resetTime,
      runOptimization,
      resetDemo,
    } = useDemo();

    return (
      <div>
        <div data-testid="scenario">{scenario}</div>
        <div data-testid="isUnoptimized">{String(isUnoptimizedBaseline)}</div>
        <div data-testid="qualityRegime">{qualityRegime}</div>
        <div data-testid="isDrawerOpen">{String(isDrawerOpen)}</div>
        <div data-testid="isOptimizing">{String(isOptimizing)}</div>
        <div data-testid="progress">{optimizationProgress}</div>
        <div data-testid="elapsedHours">{elapsedSimulatedHours}</div>

        <button onClick={openDrawer}>Open Drawer</button>
        <button onClick={closeDrawer}>Close Drawer</button>
        <button onClick={() => selectScenario('drought')}>Select Drought</button>
        <button onClick={() => selectScenario('storm')}>Select Storm</button>
        <button onClick={() => selectScenario('salinity')}>Select Salinity</button>
        <button onClick={() => selectScenario('live')}>Select Live</button>
        <button onClick={toggleUnoptimizedBaseline}>Toggle Baseline</button>
        <button onClick={() => advanceTime(6)}>Advance 6h</button>
        <button onClick={() => advanceTime(24)}>Advance 24h</button>
        <button onClick={resetTime}>Reset Time</button>
        <button onClick={() => runOptimization()}>Run Optimization</button>
        <button onClick={resetDemo}>Reset Demo</button>
      </div>
    );
  }

  it('initializes with default live scenario and closed drawer', () => {
    render(
      <DemoProvider>
        <TestConsumer />
      </DemoProvider>
    );

    expect(screen.getByTestId('scenario').textContent).toBe('live');
    expect(screen.getByTestId('isUnoptimized').textContent).toBe('false');
    expect(screen.getByTestId('isDrawerOpen').textContent).toBe('false');
    expect(screen.getByTestId('isOptimizing').textContent).toBe('false');
    expect(screen.getByTestId('elapsedHours').textContent).toBe('0');
  });

  it('controls drawer visibility via openDrawer and closeDrawer', () => {
    render(
      <DemoProvider>
        <TestConsumer />
      </DemoProvider>
    );

    act(() => {
      screen.getByText('Open Drawer').click();
    });
    expect(screen.getByTestId('isDrawerOpen').textContent).toBe('true');

    act(() => {
      screen.getByText('Close Drawer').click();
    });
    expect(screen.getByTestId('isDrawerOpen').textContent).toBe('false');
  });

  it('switches to drought scenario, applying custom weather and adjusted flows', () => {
    render(
      <DemoProvider>
        <TestConsumer />
      </DemoProvider>
    );

    act(() => {
      screen.getByText('Select Drought').click();
    });

    expect(screen.getByTestId('scenario').textContent).toBe('drought');
    expect(setCustomWeatherMock).toHaveBeenCalledWith(
      expect.objectContaining({
        temperatureC: 38.5,
        relativeHumidityPct: 18,
      })
    );
    expect(setFlowsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        rainwaterInflow: 0.0,
      })
    );
  });

  it('switches to salinity scenario, applying external dominance to volumes', () => {
    render(
      <DemoProvider>
        <TestConsumer />
      </DemoProvider>
    );

    act(() => {
      screen.getByText('Select Salinity').click();
    });

    expect(screen.getByTestId('scenario').textContent).toBe('salinity');
    expect(setTankVolumesMock).toHaveBeenCalledWith(
      expect.objectContaining({
        rainwater: 1.0,
        esa: 0.5,
      })
    );
  });

  it('restores clean baseline tank volumes when switching away from salinity scenario', () => {
    render(
      <DemoProvider>
        <TestConsumer />
      </DemoProvider>
    );

    // Switch to salinity
    act(() => {
      screen.getByText('Select Salinity').click();
    });
    expect(screen.getByTestId('scenario').textContent).toBe('salinity');

    // Switch back to drought
    act(() => {
      screen.getByText('Select Drought').click();
    });
    expect(screen.getByTestId('scenario').textContent).toBe('drought');
    expect(setTankVolumesMock).toHaveBeenCalledWith(mockBaseline.volumes);
  });

  it('toggles Unoptimized Baseline on and off', () => {
    render(
      <DemoProvider>
        <TestConsumer />
      </DemoProvider>
    );

    // Toggle ON
    act(() => {
      screen.getByText('Toggle Baseline').click();
    });
    expect(screen.getByTestId('isUnoptimized').textContent).toBe('true');
    expect(applySnapshotMock).toHaveBeenCalledWith(
      expect.objectContaining({
        volumes: expect.objectContaining({ blend: 5.5 }),
        cumulativeTruckCost: 382.50,
      })
    );

    // Toggle OFF
    act(() => {
      screen.getByText('Toggle Baseline').click();
    });
    expect(screen.getByTestId('isUnoptimized').textContent).toBe('false');
    expect(resetToBaselineMock).toHaveBeenCalled();
  });

  it('clears unoptimized baseline and restores telemetry when selecting a new scenario', () => {
    render(
      <DemoProvider>
        <TestConsumer />
      </DemoProvider>
    );

    // Turn ON unoptimized baseline
    act(() => {
      screen.getByText('Toggle Baseline').click();
    });
    expect(screen.getByTestId('isUnoptimized').textContent).toBe('true');

    // Switch scenario to drought
    act(() => {
      screen.getByText('Select Drought').click();
    });

    // Unoptimized baseline should be deactivated and baseline restored
    expect(screen.getByTestId('isUnoptimized').textContent).toBe('false');
    expect(screen.getByTestId('scenario').textContent).toBe('drought');
    expect(resetToBaselineMock).toHaveBeenCalled();
  });

  it('advances virtual time and updates tank volumes with simulation step', () => {
    render(
      <DemoProvider>
        <TestConsumer />
      </DemoProvider>
    );

    act(() => {
      screen.getByText('Advance 6h').click();
    });

    expect(screen.getByTestId('elapsedHours').textContent).toBe('6');
    expect(setTankVolumesMock).toHaveBeenCalled();
    expect(setFlowsMock).toHaveBeenCalled();
  });

  it('executes 2-second animated optimization and applies optimal parameters (ADR 0002)', async () => {
    render(
      <DemoProvider>
        <TestConsumer />
      </DemoProvider>
    );

    // Trigger optimization
    act(() => {
      screen.getByText('Run Optimization').click();
    });

    expect(screen.getByTestId('isOptimizing').textContent).toBe('true');

    // Fast-forward to 550 ms (Phase 2: 50%)
    act(() => {
      vi.advanceTimersByTime(550);
    });
    expect(Number(screen.getByTestId('progress').textContent)).toBeGreaterThanOrEqual(50);

    // Fast-forward to 1150 ms (Phase 3: 80%)
    act(() => {
      vi.advanceTimersByTime(600);
    });
    expect(Number(screen.getByTestId('progress').textContent)).toBeGreaterThanOrEqual(80);

    // Fast-forward to 1650 ms (Completion: 100% & applySnapshot)
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(applySnapshotMock).toHaveBeenCalledWith(
      expect.objectContaining({
        volumes: expect.objectContaining({ blend: 28.0 }),
        cumulativeTruckCost: 0,
        irrigationMode: 'eco',
      })
    );

    // Fast-forward to 2000 ms (Dismiss modal exactly at 2.0 seconds)
    act(() => {
      vi.advanceTimersByTime(400);
    });
    expect(screen.getByTestId('isOptimizing').textContent).toBe('false');
  });

  it('resets all demo state via resetDemo', () => {
    render(
      <DemoProvider>
        <TestConsumer />
      </DemoProvider>
    );

    act(() => {
      screen.getByText('Select Drought').click();
      screen.getByText('Advance 6h').click();
      screen.getByText('Reset Demo').click();
    });

    expect(screen.getByTestId('scenario').textContent).toBe('live');
    expect(screen.getByTestId('elapsedHours').textContent).toBe('0');
    expect(resetToBaselineMock).toHaveBeenCalled();
  });
  describe("Operator irrigation state survives demo controls", () => {
    /**
     * Re-mocks the telemetry context with a paused irrigation network.
     *
     * @returns void
     */
    function mockPausedIrrigation(): void {
      vi.spyOn(TelemetryContextModule, 'useTelemetry').mockReturnValue({
        telemetry: {
          ...mockTelemetry,
          irrigationMode: 'paused',
          flows: { ...mockBaseline.flows, irrigationDemand: 0 },
        },
        setTankVolumes: setTankVolumesMock,
        setFlows: setFlowsMock,
        setIrrigationMode: vi.fn(),
        requestWaterTruck: vi.fn(),
        executePumpTransfer: vi.fn(),
        resetToBaseline: resetToBaselineMock,
        applySnapshot: applySnapshotMock,
        scheduledIrrigationDemand: mockBaseline.flows.irrigationDemand,
      });
    }

    it('keeps irrigation demand at zero when advancing time with irrigation paused', () => {
      mockPausedIrrigation();
      render(
        <DemoProvider>
          <TestConsumer />
        </DemoProvider>
      );

      act(() => {
        screen.getByText('Advance 6h').click();
      });

      expect(setFlowsMock).toHaveBeenCalledWith(
        expect.objectContaining({ irrigationDemand: 0 })
      );
    });

    it('keeps irrigation demand at zero when switching scenario with irrigation paused', () => {
      mockPausedIrrigation();
      render(
        <DemoProvider>
          <TestConsumer />
        </DemoProvider>
      );

      act(() => {
        screen.getByText('Select Drought').click();
      });

      expect(setFlowsMock).toHaveBeenCalledWith(
        expect.objectContaining({ irrigationDemand: 0 })
      );
    });
  });
  describe('Leaving the salinity scenario', () => {
    const workedVolumes = { rainwater: 31.0, esa: 9.4, external: 19.0, blend: 30.2 };

    /**
     * Mocks telemetry for a farm whose volumes reflect operator work, not the profile baseline.
     *
     * @returns void
     */
    function mockWorkedFarm(): void {
      vi.spyOn(TelemetryContextModule, 'useTelemetry').mockReturnValue({
        telemetry: {
          ...mockTelemetry,
          tankVolumes: { ...workedVolumes },
          cumulativeTruckDeliveryCostEur: 112.5,
        },
        setTankVolumes: setTankVolumesMock,
        setFlows: setFlowsMock,
        setIrrigationMode: vi.fn(),
        requestWaterTruck: vi.fn(),
        executePumpTransfer: vi.fn(),
        resetToBaseline: resetToBaselineMock,
        applySnapshot: applySnapshotMock,
        scheduledIrrigationDemand: mockBaseline.flows.irrigationDemand,
      });
    }

    it('restores the volumes the farm had before salinity, not the profile calibration', () => {
      mockWorkedFarm();
      render(
        <DemoProvider>
          <TestConsumer />
        </DemoProvider>
      );

      act(() => {
        screen.getByText('Select Salinity').click();
      });
      setTankVolumesMock.mockClear();

      act(() => {
        screen.getByText('Select Live').click();
      });

      // The truck delivery and pump transfer that produced these volumes were paid for; resetting
      // to the profile baseline would bill the presenter for water it then took away.
      expect(setTankVolumesMock).toHaveBeenCalledWith(workedVolumes);
      expect(setTankVolumesMock).not.toHaveBeenCalledWith(mockBaseline.volumes);
    });

    it('does not reset volumes when switching between two salinity selections', () => {
      mockWorkedFarm();
      render(
        <DemoProvider>
          <TestConsumer />
        </DemoProvider>
      );

      act(() => {
        screen.getByText('Select Salinity').click();
      });
      setTankVolumesMock.mockClear();

      act(() => {
        screen.getByText('Select Salinity').click();
      });

      expect(setTankVolumesMock).not.toHaveBeenCalledWith(workedVolumes);
    });
  });
  describe('Water quality regime', () => {
    it('draws the balanced supply in live weather', () => {
      render(
        <DemoProvider>
          <TestConsumer />
        </DemoProvider>
      );

      expect(screen.getByTestId('qualityRegime').textContent).toBe('balanced');
    });

    it('switches to the stressed supply in the High Salinity scenario', () => {
      render(
        <DemoProvider>
          <TestConsumer />
        </DemoProvider>
      );

      act(() => {
        screen.getByText('Select Salinity').click();
      });

      expect(screen.getByTestId('qualityRegime').textContent).toBe('stressed');
    });

    it('keeps the balanced supply in scenarios that are not about water quality', () => {
      render(
        <DemoProvider>
          <TestConsumer />
        </DemoProvider>
      );

      act(() => {
        screen.getByText('Select Drought').click();
      });

      expect(screen.getByTestId('qualityRegime').textContent).toBe('balanced');
    });

    it('switches to the stressed supply for the unoptimized baseline', () => {
      render(
        <DemoProvider>
          <TestConsumer />
        </DemoProvider>
      );

      act(() => {
        screen.getByText('Toggle Baseline').click();
      });

      expect(screen.getByTestId('qualityRegime').textContent).toBe('stressed');
    });
  });
});
