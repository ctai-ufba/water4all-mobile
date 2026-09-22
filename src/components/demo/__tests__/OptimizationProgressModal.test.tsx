/**
 * @file OptimizationProgressModal.test.tsx
 * @summary Component tests for OptimizationProgressModal.
 * @description Verifies rendering of the 2-second animated optimization modal,
 * progress bar percentage updates, and phase checklist indicators.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { OptimizationProgressModal } from '../OptimizationProgressModal';
import * as DemoContextModule from '../../../context/DemoContext';

describe('OptimizationProgressModal', () => {
  const defaultDemoContext = {
    scenario: 'live' as const,
    isUnoptimizedBaseline: false,
    qualityRegime: 'balanced' as const,
    simulatedDate: new Date(),
    elapsedSimulatedHours: 0,
    isDrawerOpen: false,
    isOptimizing: false,
    optimizationProgress: 0,
    optimizationPhase: '',
    openDrawer: vi.fn(),
    closeDrawer: vi.fn(),
    selectScenario: vi.fn(),
    toggleUnoptimizedBaseline: vi.fn(),
    advanceTime: vi.fn(),
    resetTime: vi.fn(),
    runOptimization: vi.fn(),
    resetDemo: vi.fn(),
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders nothing when isOptimizing is false', () => {
    vi.spyOn(DemoContextModule, 'useDemo').mockReturnValue(defaultDemoContext);

    render(<OptimizationProgressModal />);
    expect(screen.queryByTestId('optimization-progress-modal')).not.toBeInTheDocument();
  });

  it('renders progress modal, progress bar, and phases when isOptimizing is true', () => {
    vi.spyOn(DemoContextModule, 'useDemo').mockReturnValue({
      ...defaultDemoContext,
      isOptimizing: true,
      optimizationProgress: 55,
      optimizationPhase: 'Calibrating crop ET₀ & soil moisture deficit...',
    });

    render(<OptimizationProgressModal />);

    expect(screen.getByTestId('optimization-progress-modal')).toBeInTheDocument();
    expect(screen.getByText('System Optimization')).toBeInTheDocument();
    expect(screen.getByText(/Calibrating crop ET₀ & soil moisture deficit.../i)).toBeInTheDocument();
    expect(screen.getByText('55%')).toBeInTheDocument();

    const progressBar = screen.getByRole('progressbar');
    expect(progressBar).toHaveAttribute('aria-valuenow', '55');
  });
});
