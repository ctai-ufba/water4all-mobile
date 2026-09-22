/**
 * @file main.tsx
 * @summary Application bootstrap entry point.
 * @description Mounts the React application root into the DOM container and registers the
 * offline app shell service worker.
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { registerServiceWorker } from './services/serviceWorkerRegistration';
import './index.css';

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Root element #root not found in document. Unable to mount application.');
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Registered after mounting so the first paint never waits on it, and deliberately unawaited:
// offline caching is an enhancement, and every failure path resolves to a reported status.
void registerServiceWorker();

