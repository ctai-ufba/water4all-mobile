/**
 * @file AppShell.test.tsx
 * @summary Unit and integration tests for AppShell component.
 * @description Verifies that AppShell wraps the page with a mobile-first frame,
 * contains the header, renders children content, provides bottom navigation tabs,
 * and opens the Demo Controller Drawer via the persistent floating action trigger.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AppShell } from '../AppShell';
import * as AuthContextModule from '../../../context/AuthContext';
import * as DemoContextModule from '../../../context/DemoContext';
import { FARM_PROFILES } from '../../../types/farm';

describe('AppShell Seam', () => {
  const activeFarm = FARM_PROFILES['small-farm'];
  const openDrawerMock = vi.fn();

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      activeFarm,
      isAuthenticated: true,
      login: vi.fn(),
      logout: vi.fn(),
      switchFarm: vi.fn(),
    });
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
      closeDrawer: vi.fn(),
      selectScenario: vi.fn(),
      toggleUnoptimizedBaseline: vi.fn(),
      advanceTime: vi.fn(),
      resetTime: vi.fn(),
      runOptimization: vi.fn(),
      resetDemo: vi.fn(),
    });
  });

  it('renders header, children content, and bottom navigation structure', () => {
    render(
      <AppShell>
        <div data-testid="dashboard-content">Custom Content View</div>
      </AppShell>
    );

    // Header content present
    expect(screen.getByText(activeFarm.name)).toBeInTheDocument();

    // Children content rendered
    expect(screen.getByTestId('dashboard-content')).toBeInTheDocument();

    // Navigation bar tabs present (4 primary views)
    expect(screen.getByRole('navigation')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Dashboard' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Weather' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tanks' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Quality' })).toBeInTheDocument();

    // Floating Demo Presentation Trigger present
    expect(screen.getByTestId('demo-floating-trigger')).toBeInTheDocument();
  });

  it('switches to tab view placeholder when a different navigation tab is selected', () => {
    render(
      <AppShell>
        <div data-testid="dashboard-content">Dashboard Content</div>
      </AppShell>
    );

    // Click Weather tab
    const weatherButton = screen.getByRole('button', { name: 'Weather' });
    fireEvent.click(weatherButton);

    // Verify Weather view placeholder is displayed
    expect(screen.getByText('Weather View')).toBeInTheDocument();
    expect(screen.queryByTestId('dashboard-content')).not.toBeInTheDocument();
  });

  it('triggers openDrawer when the Demo floating trigger is clicked', () => {
    render(
      <AppShell>
        <div data-testid="dashboard-content">Dashboard Content</div>
      </AppShell>
    );

    const demoTrigger = screen.getByTestId('demo-floating-trigger');
    fireEvent.click(demoTrigger);

    expect(openDrawerMock).toHaveBeenCalledTimes(1);
  });
});
