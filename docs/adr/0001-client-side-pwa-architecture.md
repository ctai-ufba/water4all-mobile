# 1. Client-Side PWA Architecture for Farm Water Monitoring

Date: 2026-09-20

## Context and Problem Statement

The Water4All system needs a mobile-first application to demonstrate how a farm operator would monitor water tanks, quality parameters, and irrigation demands in the field. The physical IoT sensors, pumps, and ESA units are not yet deployed on-site.
We need a hosting and runtime architecture that:
1. Incurs zero hosting and maintenance costs.
2. Works offline and behaves identically to a native smartphone app (installable on iOS/Android home screen).
3. Provides realistic, dynamic telemetry coupled with live Mediterranean weather without requiring a complex backend database.

## Decision Drivers

- **Zero Cost**: Hostable entirely on GitHub Pages without paid cloud backends or subscriptions.
- **Field Usability**: Operates under poor or intermittent connectivity on rural farms.
- **Demonstration Flexibility**: Allows instant switching between farm scales (Small in Spain vs. Medium in Greece) and simulated weather scenarios (Drought, Storm, Normal).
- **Domain Fidelity**: Models the exact physics and quality thresholds from `prototipo_water4all`.

## Considered Options

- **Option 1**: Full-stack web app with Python/FastAPI backend and PostgreSQL on a cloud VPS (AWS/Render).
- **Option 2**: Pure Client-Side Progressive Web App (React + TypeScript + Vite) with in-browser telemetry engine, Open-Meteo live weather API, and `localStorage` persistence, hosted on GitHub Pages.

## Decision Outcome

Chosen option: **Option 2 (Pure Client-Side PWA on GitHub Pages)**, because:

- **Cost & Maintenance**: 100% free forever; no server downtime, no database migrations, and automated deployment via GitHub Actions.
- **PWA Experience**: Modern service workers and web app manifests allow the farmer to "Add to Home Screen", run full-screen without browser chrome, and access cached data completely offline.
- **Real-Time Coupling**: Direct browser integration with Open-Meteo provides live weather for Antequera (Spain) and Heraklion (Greece) with zero API keys and zero backend proxying.
- **Instant Demo**: Fast profile switching, time-advancement, and demo credentials run with zero latency in client state.

### Consequences

- **Positive**: Instant deployment, zero cloud bills, offline resilience, native mobile feel.
- **Negative / Trade-off**: No real-time synchronization between multiple devices sharing the same account (data is local to the device/browser). This trade-off is completely acceptable for a prototype demonstration before physical hardware deployment.

