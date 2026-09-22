/**
 * @file DemoControllerDrawer.test.tsx
 * @summary Component tests for the DemoControllerDrawer and DemoFloatingTrigger.
 * @description Verifies drawer rendering, time advancement triggers, scenario switches,
 * baseline toggling, and optimization action dispatching.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DemoControllerDrawer } from '../DemoControllerDrawer';
import { DemoFloatingTrigger } from '../DemoFloatingTrigger';
import * as DemoContextModule from '../../../context/DemoContext';
import * as AuthContextModule from '../../../context/AuthContext';
import { FARM_PROFILES } from '../../../types/farm';

describe('Demo Controller UI Components', () => {
  const mockFarm = FARM_PROFILES['small-farm'];

  const openDrawerMock = vi.fn();
  const closeDrawerMock = vi.fn();
  const selectScenarioMock = vi.fn();
  const toggleUnoptimizedBaselineMock = vi.fn();
  const advanceTimeMock = vi.fn();
  const resetTimeMock = vi.fn();
  const runOptimizationMock = vi.fn();
  const resetDemoMock = vi.fn();

  beforeEach(() => {
    vi.restoreAllMocks();

    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      activeFarm: mockFarm,
      isAuthenticated: true,
      login: vi.fn(),
      logout: vi.fn(),
      switchFarm: vi.fn(),
    });

    vi.spyOn(DemoContextModule, 'useDemo').mockReturnValue({
      scenario: 'live',
      isUnoptimizedBaseline: false,
      simulatedDate: new Date('2026-09-21T12:00:00Z'),
      elapsedSimulatedHours: 0,
      isDrawerOpen: true,
      isOptimizing: false,
      optimizationProgress: 0,
      optimizationPhase: '',
      openDrawer: openDrawerMock,
      closeDrawer: closeDrawerMock,
      selectScenario: selectScenarioMock,
      toggleUnoptimizedBaseline: toggleUnoptimizedBaselineMock,
      advanceTime: advanceTimeMock,
      resetTime: resetTimeMock,
      runOptimization: runOptimizationMock,
      resetDemo: resetDemoMock,
    });
  });

  describe('Unoptimized baseline summary', () => {
    /**
     * Mounts the drawer with the unoptimized baseline active for a given farm profile.
     */
    function renderWithUnoptimizedBaseline(farmId: 'small-farm' | 'medium-farm'): void {
      vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
        activeFarm: FARM_PROFILES[farmId],
        isAuthenticated: true,
        login: vi.fn(),
        logout: vi.fn(),
        switchFarm: vi.fn(),
      });

      vi.spyOn(DemoContextModule, 'useDemo').mockReturnValue({
        scenario: 'live',
        isUnoptimizedBaseline: true,
        simulatedDate: new Date('2026-09-21T12:00:00Z'),
        elapsedSimulatedHours: 0,
        isDrawerOpen: true,
        isOptimizing: false,
        optimizationProgress: 0,
        optimizationPhase: '',
        openDrawer: openDrawerMock,
        closeDrawer: closeDrawerMock,
        selectScenario: selectScenarioMock,
        toggleUnoptimizedBaseline: toggleUnoptimizedBaselineMock,
        advanceTime: advanceTimeMock,
        resetTime: resetTimeMock,
        runOptimization: runOptimizationMock,
        resetDemo: resetDemoMock,
      });

      render(<DemoControllerDrawer />);
    }

    it('reports the truck expense of the active farm, not a fixed figure', () => {
      renderWithUnoptimizedBaseline('small-farm');
      expect(screen.getByText(/expenses accrued \(382.50 €\)/i)).toBeInTheDocument();
    });

    it('reports the higher Medium Farm truck expense', () => {
      renderWithUnoptimizedBaseline('medium-farm');
      expect(screen.getByText(/expenses accrued \(840.00 €\)/i)).toBeInTheDocument();
    });
  });

  describe('DemoFloatingTrigger', () => {
    it('renders floating trigger and calls openDrawer when clicked', () => {
      render(<DemoFloatingTrigger />);

      const triggerBtn = screen.getByTestId('demo-floating-trigger');
      expect(triggerBtn).toBeInTheDocument();
      expect(screen.getByText('Demo')).toBeInTheDocument();

      fireEvent.click(triggerBtn);
      expect(openDrawerMock).toHaveBeenCalledTimes(1);
    });

    it('displays active styling when an override scenario is active', () => {
      vi.spyOn(DemoContextModule, 'useDemo').mockReturnValue({
        scenario: 'drought',
        isUnoptimizedBaseline: false,
        simulatedDate: new Date(),
        elapsedSimulatedHours: 0,
        isDrawerOpen: false,
        isOptimizing: false,
        optimizationProgress: 0,
        optimizationPhase: '',
        openDrawer: openDrawerMock,
        closeDrawer: closeDrawerMock,
        selectScenario: selectScenarioMock,
        toggleUnoptimizedBaseline: toggleUnoptimizedBaselineMock,
        advanceTime: advanceTimeMock,
        resetTime: resetTimeMock,
        runOptimization: runOptimizationMock,
        resetDemo: resetDemoMock,
      });

      render(<DemoFloatingTrigger />);
      const triggerBtn = screen.getByTestId('demo-floating-trigger');
      expect(triggerBtn.className).toContain('bg-amber-600/90');
    });
  });

  describe('DemoControllerDrawer', () => {
    it('does not render when isDrawerOpen is false', () => {
      vi.spyOn(DemoContextModule, 'useDemo').mockReturnValue({
        scenario: 'live',
        isUnoptimizedBaseline: false,
        simulatedDate: new Date(),
        elapsedSimulatedHours: 0,
        isDrawerOpen: false,
        isOptimizing: false,
        optimizationProgress: 0,
        optimizationPhase: '',
        openDrawer: openDrawerMock,
        closeDrawer: closeDrawerMock,
        selectScenario: selectScenarioMock,
        toggleUnoptimizedBaseline: toggleUnoptimizedBaselineMock,
        advanceTime: advanceTimeMock,
        resetTime: resetTimeMock,
        runOptimization: runOptimizationMock,
        resetDemo: resetDemoMock,
      });

      render(<DemoControllerDrawer />);
      expect(screen.queryByTestId('demo-controller-drawer')).not.toBeInTheDocument();
    });

    it('renders all sections when isDrawerOpen is true', () => {
      render(<DemoControllerDrawer />);

      expect(screen.getByTestId('demo-controller-drawer')).toBeInTheDocument();
      expect(screen.getByText('Demo Controller')).toBeInTheDocument();
      expect(screen.getByText(/Virtual Time Acceleration/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Advance 6 Hours/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Next Day/i })).toBeInTheDocument();
      expect(screen.getByText(/Simulated Scenarios/i)).toBeInTheDocument();
      expect(screen.getByText('Live Weather')).toBeInTheDocument();
      expect(screen.getByText('Severe Drought')).toBeInTheDocument();
      expect(screen.getByText('Heavy Storm')).toBeInTheDocument();
      expect(screen.getByText('High Salinity')).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: /Unoptimized Baseline/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Run System Optimization/i })).toBeInTheDocument();
    });

    it('dispatches advanceTime on time button clicks', () => {
      render(<DemoControllerDrawer />);

      const advance6hBtn = screen.getByRole('button', { name: /Advance 6 Hours/i });
      fireEvent.click(advance6hBtn);
      expect(advanceTimeMock).toHaveBeenCalledWith(6);

      const nextDayBtn = screen.getByRole('button', { name: /Next Day/i });
      fireEvent.click(nextDayBtn);
      expect(advanceTimeMock).toHaveBeenCalledWith(24);
    });

    it('dispatches selectScenario when scenario option is clicked', () => {
      render(<DemoControllerDrawer />);

      const droughtBtn = screen.getByRole('button', { name: /Severe Drought/i });
      fireEvent.click(droughtBtn);
      expect(selectScenarioMock).toHaveBeenCalledWith('drought');

      const stormBtn = screen.getByRole('button', { name: /Heavy Storm/i });
      fireEvent.click(stormBtn);
      expect(selectScenarioMock).toHaveBeenCalledWith('storm');
    });

    it('dispatches toggleUnoptimizedBaseline when switch is toggled', () => {
      render(<DemoControllerDrawer />);

      const toggleSwitch = screen.getByRole('switch', { name: /Toggle Unoptimized Baseline/i });
      fireEvent.click(toggleSwitch);
      expect(toggleUnoptimizedBaselineMock).toHaveBeenCalledTimes(1);
    });

    it('dispatches runOptimization and closes drawer when optimization button is clicked', () => {
      render(<DemoControllerDrawer />);

      const optBtn = screen.getByRole('button', { name: /Run System Optimization/i });
      fireEvent.click(optBtn);

      expect(closeDrawerMock).toHaveBeenCalledTimes(1);
      expect(runOptimizationMock).toHaveBeenCalledTimes(1);
    });

    it('dispatches resetDemo when reset button is clicked', () => {
      render(<DemoControllerDrawer />);

      const resetBtn = screen.getByRole('button', { name: /Reset All to Initial Baseline/i });
      fireEvent.click(resetBtn);
      expect(resetDemoMock).toHaveBeenCalledTimes(1);
    });

    it('closes drawer when header close button is clicked', () => {
      render(<DemoControllerDrawer />);

      const closeBtn = screen.getByRole('button', { name: /Close Demo Controller/i });
      fireEvent.click(closeBtn);
      expect(closeDrawerMock).toHaveBeenCalledTimes(1);
    });
  });
});
