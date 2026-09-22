/**
 * @file QualityView.test.tsx
 * @summary Integration tests for the Water Quality & FAO Compliance screen.
 * @description Verifies rendering of live Blend tank metrics (EC, TDS, pH, Nitrates),
 * compliance matrix cards for all 4 agricultural uses, expandable parameter breakdown,
 * and appearance of warning banners under varying water quality conditions.
 */

import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import { QualityView } from '../QualityView';
import { AuthProvider } from '../../../context/AuthContext';
import { TelemetryProvider } from '../../../context/TelemetryContext';
import { WeatherProvider } from '../../../context/WeatherContext';
import { DemoProvider, useDemo } from '../../../context/DemoContext';

import { STORAGE_KEY_ACTIVE_FARM } from '../../../context/AuthContext';

/**
 * Helper test utility rendering components within Auth and Telemetry providers.
 *
 * @summary Render with app providers.
 * @description Wraps the target UI component in the provider stack App.tsx mounts, since the screen
 * reads the active water quality regime from the demo state.
 *
 * @param ui - React element to render.
 * @returns RenderResult from testing-library.
 * @throws Never throws.
 */
function renderWithProviders(ui: React.ReactElement) {
  return render(
    <AuthProvider>
      <TelemetryProvider>
        <WeatherProvider>
          <DemoProvider>{ui}</DemoProvider>
        </WeatherProvider>
      </TelemetryProvider>
    </AuthProvider>
  );
}

/**
 * Helper control that switches the demo into the High Salinity scenario.
 *
 * @returns React.JSX.Element with a single scenario button.
 */
function ScenarioSwitch(): React.JSX.Element {
  const { selectScenario } = useDemo();
  return <button onClick={() => selectScenario('salinity')}>Go Salinity</button>;
}

describe('QualityView Component Seam', () => {
  beforeEach(() => {
    localStorage.clear();
    // Default to Small Farm
    localStorage.setItem(STORAGE_KEY_ACTIVE_FARM, 'small-farm');
  });

  it('renders the screen header and Blend tank live telemetry section', () => {
    renderWithProviders(<QualityView />);

    expect(screen.getByText('Water Quality & FAO Compliance')).toBeInTheDocument();
    expect(screen.getByText(/Real-time physical and chemical analysis/i)).toBeInTheDocument();
    expect(screen.getByText('Blend Tank Live Telemetry')).toBeInTheDocument();
  });

  it('renders all 4 primary water quality parameter cards (EC, TDS, pH, Nitrates)', () => {
    renderWithProviders(<QualityView />);

    expect(screen.getByTestId('quality-metric-card-ec')).toBeInTheDocument();
    expect(screen.getByTestId('quality-metric-card-tds')).toBeInTheDocument();
    expect(screen.getByTestId('quality-metric-card-ph')).toBeInTheDocument();
    expect(screen.getByTestId('quality-metric-card-no3-')).toBeInTheDocument();
  });

  it('renders FAO compliance cards for all four agricultural uses', () => {
    renderWithProviders(<QualityView />);

    expect(screen.getByTestId('compliance-card-vegetables')).toBeInTheDocument();
    expect(screen.getByTestId('compliance-card-vineyards')).toBeInTheDocument();
    expect(screen.getByTestId('compliance-card-olive-trees')).toBeInTheDocument();
    expect(screen.getByTestId('compliance-card-livestock')).toBeInTheDocument();

    expect(screen.getByText('Olive trees')).toBeInTheDocument();
    expect(screen.getByText('Vineyards')).toBeInTheDocument();
    expect(screen.getByText('Vegetables')).toBeInTheDocument();
    expect(screen.getByText('Livestock')).toBeInTheDocument();
  });

  it('toggles the detailed parameter breakdown when clicking the accordion trigger', () => {
    renderWithProviders(<QualityView />);

    const toggleButtons = screen.getAllByText('FAO Parameter Limits Breakdown');
    expect(toggleButtons.length).toBeGreaterThanOrEqual(4);

    // Click the first accordion button (Vegetables)
    fireEvent.click(toggleButtons[0]);

    // Should reveal parameter limits
    expect(screen.getAllByText(/FAO limit: <= 700 µS\/cm/i).length).toBeGreaterThan(0);
  });

  it('displays the source water conditioning breakdown card', () => {
    renderWithProviders(<QualityView />);

    expect(screen.getByText('Source Water Conditioning Breakdown')).toBeInTheDocument();
    expect(screen.getByText('Rainwater')).toBeInTheDocument();
    expect(screen.getByText('ESA Water')).toBeInTheDocument();
    expect(screen.getByText('External Supply')).toBeInTheDocument();
  });

  it('renders a danger warning banner when external salinity dominates storage', () => {
    // Set volumes with only highly mineralized external supply
    const highSalinityVolumes = {
      rainwater: 0,
      esa: 0,
      external: 80,
      blend: 40,
    };
    localStorage.setItem('water4all_telemetry_small-farm_volumes', JSON.stringify(highSalinityVolumes));

    renderWithProviders(<QualityView />);

    // In 100% external supply, EC is 720 µS/cm which exceeds sensitive vegetable limit (700 µS/cm)
    const warningBanner = screen.queryByTestId('quality-warning-banner');
    expect(warningBanner).toBeInTheDocument();
  });
  describe('Stressed water supply', () => {
    it('shows no warning banner while the farm draws its ordinary supply', () => {
      renderWithProviders(<QualityView />);
      expect(screen.queryByTestId('quality-warning-banner')).not.toBeInTheDocument();
    });

    it('warns once the High Salinity scenario puts the farm on the stressed supply', () => {
      renderWithProviders(
        <>
          <ScenarioSwitch />
          <QualityView />
        </>
      );

      act(() => {
        screen.getByRole('button', { name: 'Go Salinity' }).click();
      });

      // The scenario card promises FAO crop warnings; this is the screen that has to deliver them.
      expect(screen.getByTestId('quality-warning-banner')).toBeInTheDocument();
    });
  });
});
