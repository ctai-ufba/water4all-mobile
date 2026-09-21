/**
 * @file App.test.tsx
 * @summary Integration tests for root App component and end-to-end user flows.
 * @description Verifies full authentication lifecycle: starting at Demo Login,
 * logging in with 1 click, seeing AppShell with active farm profile, and logging out.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import App from '../App';
import { FARM_PROFILES } from '../types/farm';

describe('App Root Flow Seam', () => {
  beforeEach(() => {
    localStorage.clear();
  });

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

    // Click 'Demo' tab (not yet implemented) and verify fallback to AppShell placeholder
    const demoNavButton = screen.getByRole('button', { name: /^demo$/i });
    fireEvent.click(demoNavButton);

    await waitFor(() => {
      expect(screen.getByText(/Demo View/i)).toBeInTheDocument();
      expect(screen.getByText(/Module scheduled for upcoming implementation phase/i)).toBeInTheDocument();
    });
  });
});
