# 2. Pre-computed Optimal Parameters vs. In-Browser Numerical Optimization

Date: 2026-09-20

## Context and Problem Statement

The original desktop prototype (`prototipo_water4all`) performs Bayesian optimization of farm water infrastructure sizing and PID setpoints using Python libraries (`scikit-learn` GaussianProcessRegressor, `scipy`, `numpy`). These optimization runs require 30 to 60 seconds of CPU-intensive computation.
In the mobile PWA (`water4all-mobile`), users and presenters need to observe the benefits of an "Optimized System" and trigger an interactive "Run Optimization" action during live demonstrations on mobile devices.
Running heavy matrix math and Gaussian regression in JavaScript on a smartphone would cause high bundle sizes (>15 MB), sluggish UI frames, and excessive battery drain.

## Decision Drivers

- **Mobile Responsiveness**: UI must remain at 60 FPS without freezing during live demonstrations.
- **Demonstration Impact**: Presenters need to show the value of the optimization algorithm without waiting 60 seconds.
- **Fidelity to Original Physics**: Sizing and setpoints must precisely match the calibrated results from `prototipo_water4all`.

## Considered Options

- **Option 1**: Port the Gaussian Process / Bayesian optimization engine to JavaScript (e.g., using a web worker and linear algebra libraries).
- **Option 2**: Use pre-computed optimal parameters derived from the Python simulations for the Antequera and Heraklion profiles, coupled with a 2-second simulated progress animation when "Run Optimization" is triggered, and a contrasting "Unoptimized Baseline" state.

## Decision Outcome

Chosen option: **Option 2 (Pre-computed Optimal Parameters & Simulated Animation)**, because:

- **Instant Performance**: Zero bundle bloat; executes flawlessly on any mobile browser.
- **Realistic Presentation**: The 2-second progress animation (weather analysis, crop ET₀ calibration, setpoint tuning) gives audiences an engaging visual understanding of the optimization steps without boring delays.
- **Dramatic Contrast**: Allows the presenter to toggle between the "Unoptimized Baseline" (depleted tank, water quality warnings, low autonomy) and the "Optimal Design" (balanced levels, zero deficit, maximum financial savings) in real time.

### Consequences

- **Positive**: Lightweight app, instant response, zero crash risk on low-end mobile devices, high visual appeal.
- **Negative / Trade-off**: The user cannot define arbitrary non-preset farm geometries and run a novel 365-day Bayesian search directly on the phone (which belongs to the desktop engineering tool, not the field monitoring app).

