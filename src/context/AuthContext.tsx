/**
 * @file AuthContext.tsx
 * @summary Authentication and active farm profile state management.
 * @description Provides the React context and provider for managing the user's
 * active Mediterranean farm profile, demo authentication session, and persistence
 * to the browser's localStorage.
 */

import React, { createContext, useContext, useState, useMemo, ReactNode } from 'react';
import { FarmId, FarmProfile, FARM_PROFILES, getFarmProfile } from '../types/farm';

/** Key used to persist the active farm identifier in browser localStorage */
export const STORAGE_KEY_ACTIVE_FARM = 'water4all_active_farm_id';

/**
 * Interface representing the authentication context state and dispatch actions.
 */
export interface AuthContextType {
  /** The currently selected Mediterranean farm profile, or null if unauthenticated */
  activeFarm: FarmProfile | null;
  /** Boolean flag indicating whether a farm profile is actively loaded */
  isAuthenticated: boolean;
  /**
   * Authenticates the user with a pre-configured farm profile without typing credentials.
   *
   * @summary Demo login action.
   * @description Sets the active farm profile and persists the selection in localStorage.
   *
   * @param farmId - Identifier of the farm profile to activate ('small-farm' | 'medium-farm').
   * @returns void
   * @throws Never throws; logs warning if farm profile does not exist.
   */
  login: (farmId: FarmId) => void;
  /**
   * Logs out the user, clearing the active session from state and localStorage.
   *
   * @summary Logout action.
   * @description Clears active farm state and removes stored session from localStorage.
   *
   * @returns void
   * @throws Never throws.
   */
  logout: () => void;
  /**
   * Switches the active farm profile without leaving the application.
   *
   * @summary Profile switching action.
   * @description Updates active farm state and updates stored session in localStorage.
   *
   * @param farmId - Identifier of the new farm profile to activate.
   * @returns void
   * @throws Never throws; logs warning if farm profile does not exist.
   */
  switchFarm: (farmId: FarmId) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * Props for the AuthProvider component.
 */
export interface AuthProviderProps {
  /** Child components wrapped by the provider */
  children: ReactNode;
}

/**
 * Authentication Provider component that supplies farm session state.
 *
 * @summary Farm session provider.
 * @description Manages active Mediterranean farm state and synchronizes with localStorage.
 *
 * @param props - Component props containing children nodes.
 * @returns React.JSX.Element wrapping child components with AuthContext.
 * @throws Never throws.
 */
export function AuthProvider({ children }: AuthProviderProps): React.JSX.Element {
  // Initialize activeFarm state from localStorage on first render
  const [activeFarm, setActiveFarm] = useState<FarmProfile | null>(() => {
    try {
      const storedFarmId = localStorage.getItem(STORAGE_KEY_ACTIVE_FARM);
      if (storedFarmId) {
        // Attempt to resolve profile from pre-calibrated definitions
        const profile = getFarmProfile(storedFarmId);
        if (profile) {
          return profile;
        }
      }
    } catch (error) {
      // Inline comment: Handle environments where localStorage might be restricted
      console.warn('Unable to access localStorage for farm session:', error);
    }
    return null;
  });

  /**
   * Authenticates user with selected farm profile.
   *
   * @summary Authenticate with farm profile.
   * @description Resolves the farm profile and updates localStorage and state.
   *
   * @param farmId - The farm profile ID to activate.
   * @returns void
   * @throws Never throws; warns if profile not found.
   */
  const login = (farmId: FarmId): void => {
    const profile = FARM_PROFILES[farmId];
    if (profile) {
      setActiveFarm(profile);
      try {
        localStorage.setItem(STORAGE_KEY_ACTIVE_FARM, farmId);
      } catch (error) {
        console.warn('Failed to persist farm session to localStorage:', error);
      }
    } else {
      console.warn(`Unrecognized farm profile identifier: ${farmId}`);
    }
  };

  /**
   * Terminates active farm session.
   *
   * @summary Clear farm session.
   * @description Resets activeFarm state to null and clears localStorage.
   *
   * @returns void
   * @throws Never throws.
   */
  const logout = (): void => {
    setActiveFarm(null);
    try {
      localStorage.removeItem(STORAGE_KEY_ACTIVE_FARM);
    } catch (error) {
      console.warn('Failed to remove farm session from localStorage:', error);
    }
  };

  /**
   * Switches active profile to another farm.
   *
   * @summary Switch active farm.
   * @description Delegates to login to update state and persistence.
   *
   * @param farmId - The target farm profile ID.
   * @returns void
   * @throws Never throws.
   */
  const switchFarm = (farmId: FarmId): void => {
    login(farmId);
  };

  const contextValue = useMemo<AuthContextType>(
    () => ({
      activeFarm,
      isAuthenticated: activeFarm !== null,
      login,
      logout,
      switchFarm,
    }),
    [activeFarm]
  );

  return <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>;
}

/**
 * Custom hook to consume the AuthContext.
 *
 * @summary Hook for authentication state.
 * @description Provides access to the current farm profile and session actions.
 *
 * @returns AuthContextType containing active farm profile and methods.
 * @throws Error if called outside of an AuthProvider tree.
 */
export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

