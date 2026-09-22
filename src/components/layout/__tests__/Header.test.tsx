/**
 * @file Header.test.tsx
 * @summary Unit and integration tests for Header component.
 * @description Verifies that the header displays the active farm profile name,
 * estate, coordinates, and provides accessible controls for switching profiles and logging out.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Header } from '../Header';
import * as AuthContextModule from '../../../context/AuthContext';
import { FARM_PROFILES } from '../../../types/farm';

describe('Header Seam', () => {
  const mockLogout = vi.fn();
  const mockSwitchFarm = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders active farm name, estate, and location coordinates', () => {
    const activeFarm = FARM_PROFILES['small-farm'];
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      activeFarm,
      isAuthenticated: true,
      login: vi.fn(),
      logout: mockLogout,
      switchFarm: mockSwitchFarm,
    });

    render(<Header />);

    expect(screen.getByText(activeFarm.name)).toBeInTheDocument();
    expect(screen.getByText(activeFarm.estateName)).toBeInTheDocument();
    expect(screen.getByText(activeFarm.location)).toBeInTheDocument();
    expect(screen.getByText(/37.0051° N, 4.6425° W/i)).toBeInTheDocument();
  });

  it('calls logout when the logout button is clicked', () => {
    const activeFarm = FARM_PROFILES['small-farm'];
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      activeFarm,
      isAuthenticated: true,
      login: vi.fn(),
      logout: mockLogout,
      switchFarm: mockSwitchFarm,
    });

    render(<Header />);

    const logoutButton = screen.getByRole('button', { name: /logout|sign out/i });
    fireEvent.click(logoutButton);

    expect(mockLogout).toHaveBeenCalledTimes(1);
  });

  it('allows opening profile switcher and selecting a different farm', () => {
    const activeFarm = FARM_PROFILES['small-farm'];
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      activeFarm,
      isAuthenticated: true,
      login: vi.fn(),
      logout: mockLogout,
      switchFarm: mockSwitchFarm,
    });

    render(<Header />);

    // Open profile switcher
    const switchButton = screen.getByRole('button', { name: /switch farm|change profile/i });
    fireEvent.click(switchButton);

    // Click on Medium Farm option
    const mediumFarmOption = screen.getByRole('button', { name: new RegExp(FARM_PROFILES['medium-farm'].name, 'i') });
    fireEvent.click(mediumFarmOption);

    expect(mockSwitchFarm).toHaveBeenCalledWith('medium-farm');
  });
});
