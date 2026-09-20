/**
 * @file AppShell.test.tsx
 * @summary Unit and integration tests for AppShell component.
 * @description Verifies that AppShell wraps the page with a mobile-first frame,
 * contains the header, renders children content, and provides bottom navigation tabs.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AppShell } from '../AppShell';
import * as AuthContextModule from '../../../context/AuthContext';
import { FARM_PROFILES } from '../../../types/farm';

describe('AppShell Seam', () => {
  it('renders header, children content, and bottom navigation structure', () => {
    const activeFarm = FARM_PROFILES['small-farm'];
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      activeFarm,
      isAuthenticated: true,
      login: vi.fn(),
      logout: vi.fn(),
      switchFarm: vi.fn(),
    });

    render(
      <AppShell>
        <div data-testid="dashboard-content">Custom Content View</div>
      </AppShell>
    );

    // Header content present
    expect(screen.getByText(activeFarm.name)).toBeInTheDocument();

    // Children content rendered
    expect(screen.getByTestId('dashboard-content')).toBeInTheDocument();

    // Navigation bar tabs present
    expect(screen.getByRole('navigation')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Dashboard' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Weather' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tanks' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Quality' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Demo' })).toBeInTheDocument();
  });

  it('switches to tab view placeholder when a different navigation tab is selected', () => {
    const activeFarm = FARM_PROFILES['small-farm'];
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      activeFarm,
      isAuthenticated: true,
      login: vi.fn(),
      logout: vi.fn(),
      switchFarm: vi.fn(),
    });

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
});
