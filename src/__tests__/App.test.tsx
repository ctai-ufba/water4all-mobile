/**
 * @file App.test.tsx
 * @summary Integration tests for root App component and end-to-end user flows.
 * @description Verifies full authentication lifecycle: starting at Demo Login,
 * logging in with 1 click, seeing AppShell with active farm profile, and logging out.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import App from '../App';
import { FARM_PROFILES } from '../types/farm';

describe('App Root Flow Seam', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  /** Logs in to the Small Farm profile and waits for the shell to settle. */
  async function loginToSmallFarm(): Promise<void> {
    fireEvent.click(
      screen.getByRole('button', { name: new RegExp(FARM_PROFILES['small-farm'].name, 'i') })
    );
    await waitFor(() => {
      expect(screen.getByText(FARM_PROFILES['small-farm'].name)).toBeInTheDocument();
    });
  }

  it('renders DemoLoginScreen by default when unauthenticated', () => {
    render(<App />);

    expect(screen.getByText('Water4All')).toBeInTheDocument();
    expect(screen.getByText(new RegExp(FARM_PROFILES['small-farm'].name, 'i'))).toBeInTheDocument();
    expect(screen.getByText(new RegExp(FARM_PROFILES['medium-farm'].name, 'i'))).toBeInTheDocument();
  });

  it('completes 1-click login and transitions to AppShell', async () => {
    render(<App />);

    const smallFarmButton = screen.getByRole('button', {
      name: new RegExp(FARM_PROFILES['small-farm'].name, 'i'),
    });
    fireEvent.click(smallFarmButton);

    // Wait for async weather loading and state updates
    await waitFor(() => {
      expect(screen.getByText(FARM_PROFILES['small-farm'].name)).toBeInTheDocument();
    });

    expect(screen.getAllByText(FARM_PROFILES['small-farm'].estateName).length).toBeGreaterThanOrEqual(1);

    // App navigation is present
    expect(screen.getByRole('navigation')).toBeInTheDocument();

    // Dashboard telemetry and weather cards are displayed
    expect(screen.getByText(/Live Weather/i)).toBeInTheDocument();
    expect(screen.getByText(/Water Autonomy/i)).toBeInTheDocument();
    expect(screen.getByText(/Blend Tank Gauge/i)).toBeInTheDocument();
    expect(screen.getByText(/Daily Water Balance/i)).toBeInTheDocument();
    expect(screen.getByText(/Water Efficiency & Savings/i)).toBeInTheDocument();
  });

  it('logs out and returns to DemoLoginScreen', async () => {
    render(<App />);

    // Login
    const smallFarmButton = screen.getByRole('button', {
      name: new RegExp(FARM_PROFILES['small-farm'].name, 'i'),
    });
    fireEvent.click(smallFarmButton);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /logout|sign out/i })).toBeInTheDocument();
    });

    // Logout
    const logoutButton = screen.getByRole('button', { name: /logout|sign out/i });
    fireEvent.click(logoutButton);

    // Assert returned to DemoLoginScreen
    await waitFor(() => {
      expect(screen.getByText('Water4All')).toBeInTheDocument();
      expect(screen.getByText(/Select Demo Farm Profile/i)).toBeInTheDocument();
    });
  });

  it('switches between Dashboard and Tanks & Sources screen via bottom navigation', async () => {
    render(<App />);

    // Login to small farm
    const smallFarmButton = screen.getByRole('button', {
      name: new RegExp(FARM_PROFILES['small-farm'].name, 'i'),
    });
    fireEvent.click(smallFarmButton);

    await waitFor(() => {
      expect(screen.getByText(FARM_PROFILES['small-farm'].name)).toBeInTheDocument();
    });

    // Verify initial dashboard view
    expect(screen.getByText(/Water Autonomy/i)).toBeInTheDocument();

    // Click 'Tanks' tab on bottom navigation
    const tanksNavButton = screen.getByRole('button', { name: /^tanks$/i });
    fireEvent.click(tanksNavButton);

    // Verify Tanks & Sources screen is rendered with all 4 tanks
    await waitFor(() => {
      expect(screen.getByText(/Tanks & Sources/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/Rainwater Catchment/i)).toBeInTheDocument();
    expect(screen.getByText(/ESA Atmospheric Generator/i)).toBeInTheDocument();
    expect(screen.getByText(/External Water Supply/i)).toBeInTheDocument();
    expect(screen.getByText(/Central Blend Tank/i)).toBeInTheDocument();

    // Switch back to Dashboard tab
    const dashboardNavButton = screen.getByRole('button', { name: /^dashboard$/i });
    fireEvent.click(dashboardNavButton);

    // Verify Dashboard view is restored
    await waitFor(() => {
      expect(screen.getByText(/Water Autonomy/i)).toBeInTheDocument();
    });

    // Click 'Quality' tab on bottom navigation
    const qualityNavButton = screen.getByRole('button', { name: /^quality$/i });
    fireEvent.click(qualityNavButton);

    // Verify Water Quality & FAO Compliance screen is rendered
    await waitFor(() => {
      expect(screen.getByText(/Water Quality & FAO Compliance/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/FAO Agricultural Compliance Matrix/i)).toBeInTheDocument();
    expect(screen.getByText(/Blend Tank Live Telemetry/i)).toBeInTheDocument();

    // Click Demo floating presentation trigger and verify Demo Controller Drawer opens
    const demoTrigger = screen.getByTestId('demo-floating-trigger');
    fireEvent.click(demoTrigger);

    await waitFor(() => {
      expect(screen.getByTestId('demo-controller-drawer')).toBeInTheDocument();
      expect(screen.getByText('Demo Controller')).toBeInTheDocument();
      expect(screen.getByText(/Virtual Time Acceleration/i)).toBeInTheDocument();
      expect(screen.getByText(/Simulated Scenarios/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Run System Optimization/i })).toBeInTheDocument();
    });
  });

  it('renders the Weather view from the navigation bar instead of a module placeholder', async () => {
    render(<App />);
    await loginToSmallFarm();

    fireEvent.click(screen.getByRole('button', { name: /^weather$/i }));

    await waitFor(() => {
      expect(screen.getByText(/Weather & Atmospheric Physics/i)).toBeInTheDocument();
    });
    expect(
      screen.queryByText(/Module scheduled for upcoming implementation phase/i)
    ).not.toBeInTheDocument();
    expect(screen.getByTestId('farm-site-map')).toBeInTheDocument();
  });

  it('opens the Weather view from the dashboard weather strip', async () => {
    render(<App />);
    await loginToSmallFarm();

    fireEvent.click(screen.getByRole('button', { name: /open weather view/i }));

    await waitFor(() => {
      expect(screen.getByText(/Weather & Atmospheric Physics/i)).toBeInTheDocument();
    });

    // The physics detail the dashboard strip no longer carries is here, as two distinct figures.
    expect(screen.getByTestId('esa-instantaneous-rate')).toBeInTheDocument();
    expect(screen.getByTestId('esa-forecast-24h-yield')).toBeInTheDocument();
    expect(screen.getByTestId('esa-ambient-yield-ratio')).toBeInTheDocument();
    expect(screen.getByTestId('catchment-breakdown')).toBeInTheDocument();
  });

  it('states that radar is unavailable when no frames can be fetched', async () => {
    // The default test fetch mock answers every request with an Open-Meteo payload, which is not a
    // radar index; that is exactly the unusable-payload path the map has to survive.
    render(<App />);
    await loginToSmallFarm();

    fireEvent.click(screen.getByRole('button', { name: /^weather$/i }));

    await waitFor(() => {
      expect(screen.getByTestId('radar-status')).toHaveTextContent(/Radar unavailable/i);
    });
    expect(screen.getByTestId('farm-site-map')).toBeInTheDocument();
  });

  it('keeps third-party attribution visible when weather falls back to the synthetic model', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network unreachable')));

    render(<App />);
    await loginToSmallFarm();

    await waitFor(() => {
      expect(screen.getByTestId('weather-source-badge')).toHaveTextContent('Offline Fallback');
    });

    expect(screen.getByRole('link', { name: /OpenStreetMap/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /RainViewer/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Open-Meteo\.com/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /CC BY 4\.0/i })).toBeInTheDocument();
  });
});
