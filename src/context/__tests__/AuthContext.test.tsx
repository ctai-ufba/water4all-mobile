/**
 * @file AuthContext.test.tsx
 * @summary Unit tests for AuthContext and session persistence seam.
 * @description Verifies the authentication state lifecycle, including initial state,
 * 1-click demo login, local storage session persistence, session rehydration on mount,
 * farm profile switching, and logout functionality.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import React from 'react';
import { AuthProvider, useAuth } from '../AuthContext';
import { FARM_PROFILES } from '../../types/farm';

/**
 * Test harness component exposing AuthContext values and actions to the DOM.
 */
function TestAuthConsumer(): React.JSX.Element {
  const { activeFarm, isAuthenticated, login, logout, switchFarm } = useAuth();

  return (
    <div>
      <div data-testid="auth-status">{isAuthenticated ? 'authenticated' : 'unauthenticated'}</div>
      <div data-testid="farm-name">{activeFarm ? activeFarm.name : 'none'}</div>
      <div data-testid="farm-id">{activeFarm ? activeFarm.id : 'none'}</div>
      <button onClick={() => login('small-farm')}>Login Small</button>
      <button onClick={() => login('medium-farm')}>Login Medium</button>
      <button onClick={() => switchFarm('medium-farm')}>Switch to Medium</button>
      <button onClick={() => logout()}>Logout</button>
    </div>
  );
}

describe('AuthContext and Session Persistence Seam', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('starts unauthenticated when no session exists in localStorage', () => {
    render(
      <AuthProvider>
        <TestAuthConsumer />
      </AuthProvider>
    );

    expect(screen.getByTestId('auth-status')).toHaveTextContent('unauthenticated');
    expect(screen.getByTestId('farm-name')).toHaveTextContent('none');
  });

  it('authenticates and persists session to localStorage on 1-click login', () => {
    render(
      <AuthProvider>
        <TestAuthConsumer />
      </AuthProvider>
    );

    act(() => {
      screen.getByText('Login Small').click();
    });

    expect(screen.getByTestId('auth-status')).toHaveTextContent('authenticated');
    expect(screen.getByTestId('farm-name')).toHaveTextContent(FARM_PROFILES['small-farm'].name);
    expect(localStorage.setItem).toHaveBeenCalledWith('water4all_active_farm_id', 'small-farm');
  });

  it('rehydrates authenticated session from localStorage on initial load', () => {
    localStorage.getItem = vi.fn().mockReturnValue('medium-farm');

    render(
      <AuthProvider>
        <TestAuthConsumer />
      </AuthProvider>
    );

    expect(screen.getByTestId('auth-status')).toHaveTextContent('authenticated');
    expect(screen.getByTestId('farm-name')).toHaveTextContent(FARM_PROFILES['medium-farm'].name);
  });

  it('switches farm profile and updates localStorage accordingly', () => {
    render(
      <AuthProvider>
        <TestAuthConsumer />
      </AuthProvider>
    );

    act(() => {
      screen.getByText('Login Small').click();
    });
    expect(screen.getByTestId('farm-id')).toHaveTextContent('small-farm');

    act(() => {
      screen.getByText('Switch to Medium').click();
    });

    expect(screen.getByTestId('farm-id')).toHaveTextContent('medium-farm');
    expect(localStorage.setItem).toHaveBeenCalledWith('water4all_active_farm_id', 'medium-farm');
  });

  it('clears active farm and removes session from localStorage on logout', () => {
    render(
      <AuthProvider>
        <TestAuthConsumer />
      </AuthProvider>
    );

    act(() => {
      screen.getByText('Login Small').click();
    });
    expect(screen.getByTestId('auth-status')).toHaveTextContent('authenticated');

    act(() => {
      screen.getByText('Logout').click();
    });

    expect(screen.getByTestId('auth-status')).toHaveTextContent('unauthenticated');
    expect(screen.getByTestId('farm-name')).toHaveTextContent('none');
    expect(localStorage.removeItem).toHaveBeenCalledWith('water4all_active_farm_id');
  });
});

