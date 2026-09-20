/**
 * @file DemoLoginScreen.test.tsx
 * @summary Unit and integration tests for DemoLoginScreen component.
 * @description Verifies that the 1-click demo login screen renders the branding,
 * farm cards for Antequera and Heraklion, and dispatches login actions upon selection.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DemoLoginScreen } from '../DemoLoginScreen';
import * as AuthContextModule from '../../../context/AuthContext';
import { FARM_PROFILES } from '../../../types/farm';

describe('DemoLoginScreen Seam', () => {
  it('renders application branding and both demo farm options', () => {
    // Mock useAuth return value
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      activeFarm: null,
      isAuthenticated: false,
      login: vi.fn(),
      logout: vi.fn(),
      switchFarm: vi.fn(),
    });

    render(<DemoLoginScreen />);

    // Branding checks
    expect(screen.getByText('Water4All')).toBeInTheDocument();
    expect(screen.getByText(/Farm Water Monitoring/i)).toBeInTheDocument();

    // Check Small Farm button
    expect(screen.getByText(new RegExp(FARM_PROFILES['small-farm'].name, 'i'))).toBeInTheDocument();
    expect(screen.getByText(/Antequera, Andalusia, Spain/i)).toBeInTheDocument();

    // Check Medium Farm button
    expect(screen.getByText(new RegExp(FARM_PROFILES['medium-farm'].name, 'i'))).toBeInTheDocument();
    expect(screen.getByText(/Heraklion, Crete, Greece/i)).toBeInTheDocument();
  });

  it('triggers login with small-farm identifier when Small Farm card is clicked', () => {
    const mockLogin = vi.fn();
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      activeFarm: null,
      isAuthenticated: false,
      login: mockLogin,
      logout: vi.fn(),
      switchFarm: vi.fn(),
    });

    render(<DemoLoginScreen />);

    const smallFarmButton = screen.getByRole('button', {
      name: new RegExp(FARM_PROFILES['small-farm'].name, 'i'),
    });
    fireEvent.click(smallFarmButton);

    expect(mockLogin).toHaveBeenCalledTimes(1);
    expect(mockLogin).toHaveBeenCalledWith('small-farm');
  });

  it('triggers login with medium-farm identifier when Medium Farm card is clicked', () => {
    const mockLogin = vi.fn();
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      activeFarm: null,
      isAuthenticated: false,
      login: mockLogin,
      logout: vi.fn(),
      switchFarm: vi.fn(),
    });

    render(<DemoLoginScreen />);

    const mediumFarmButton = screen.getByRole('button', {
      name: new RegExp(FARM_PROFILES['medium-farm'].name, 'i'),
    });
    fireEvent.click(mediumFarmButton);

    expect(mockLogin).toHaveBeenCalledTimes(1);
    expect(mockLogin).toHaveBeenCalledWith('medium-farm');
  });
});
