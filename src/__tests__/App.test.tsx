/**
 * @file App.test.tsx
 * @summary Integration tests for root App component and end-to-end user flows.
 * @description Verifies full authentication lifecycle: starting at Demo Login,
 * logging in with 1 click, seeing AppShell with active farm profile, and logging out.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
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

  it('completes 1-click login and transitions to AppShell', () => {
    render(<App />);

    const smallFarmButton = screen.getByRole('button', {
      name: new RegExp(FARM_PROFILES['small-farm'].name, 'i'),
    });
    fireEvent.click(smallFarmButton);

    // Farm name is displayed in the active view
    expect(screen.getByText(FARM_PROFILES['small-farm'].name)).toBeInTheDocument();
    expect(screen.getAllByText(FARM_PROFILES['small-farm'].estateName).length).toBeGreaterThanOrEqual(1);

    // App navigation is present
    expect(screen.getByRole('navigation')).toBeInTheDocument();
  });

  it('logs out and returns to DemoLoginScreen', () => {
    render(<App />);

    // Login
    const smallFarmButton = screen.getByRole('button', {
      name: new RegExp(FARM_PROFILES['small-farm'].name, 'i'),
    });
    fireEvent.click(smallFarmButton);

    // Logout
    const logoutButton = screen.getByRole('button', { name: /logout|sign out/i });
    fireEvent.click(logoutButton);

    // Assert returned to DemoLoginScreen
    expect(screen.getByText('Water4All')).toBeInTheDocument();
    expect(screen.getByText(/Select Demo Farm Profile/i)).toBeInTheDocument();
  });
});
