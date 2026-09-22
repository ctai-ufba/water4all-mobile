# water4all-mobile

app mobile de demonstracao do water4all

A client-side Progressive Web App for monitoring farm water systems on two Mediterranean profiles
(Antequera, Spain and Heraklion, Crete). Domain vocabulary is in [CONTEXT.md](CONTEXT.md);
architectural decisions are in [docs/adr/](docs/adr/).

## Running it

```sh
npm install
npm run dev        # dev server; the service worker is deliberately not registered here
npm test           # vitest
npm run typecheck  # tsc --noEmit
npm run build      # tsc -b && vite build, output in dist/
npm run preview    # serves dist/ - the only way to exercise the PWA locally
```

## PWA behaviour

The app installs to a phone home screen and keeps working without a connection. None of this is
active under `npm run dev`: a caching worker would shadow Vite's module graph, so registration is
skipped in development and the features below are only observable through `npm run preview` (or a
deployed build) over `http://localhost` or HTTPS, which service workers require.

- **Install**: Chromium browsers defer their install prompt, and the app offers it as an
  "Install Water4All" banner above the bottom navigation. A dismissal is remembered on the device.
  iOS and Firefox never offer a prompt; there the app installs through the browser's own share
  menu, and the banner correctly stays hidden.
- **Offline**: on the second load the worker in [public/sw.js](public/sw.js) serves the app shell
  and its build assets from cache. Tank telemetry, controls and the whole demo keep working,
  because they are computed on the device. An amber strip under the header says so, and weather
  falls back to the synthetic series built from climate normals rather than to a stale reading —
  see [ADR 0006](docs/adr/0006-offline-caching-and-alert-delivery.md).
- **Alerts**: the Blend tank dropping below its minimum operating volume, and rain in the next 24
  hours, raise an in-app toast and, once the operator accepts the permission prompt, an OS
  notification. These are local notifications, not Web Push: with no backend, nothing can wake a
  closed app.

To check the offline path by hand: `npm run build && npm run preview`, open the preview URL, reload
once so the worker takes control, then tick **Offline** in the browser's Network devtools and
reload again. The app should render and log in normally.

### Regenerating the app icons

The manifest icons in `public/icons/` are committed. Rerun the generator after changing the mark or
the palette in [scripts/generate-pwa-icons.mjs](scripts/generate-pwa-icons.mjs):

```sh
npm run icons   # rewrites icon-192.png, icon-512.png and icon-maskable-512.png
```

`src/__tests__/pwaAssets.test.ts` then checks the manifest against the files on disk, so a missing
or mis-sized icon fails the suite rather than silently disabling installation.

## Deploying

Pushing to `main` builds and publishes the app to
<https://ctai-ufba.github.io/water4all-mobile/> through
[.github/workflows/deploy.yml](.github/workflows/deploy.yml), which runs the test suite, builds,
and uploads `dist/` as the Pages artifact. A red test or a type error fails the run and leaves the
live site on the previous version.

The workflow needs one setting made by hand, once: **Settings -> Pages -> Build and deployment ->
Source: GitHub Actions**. Nothing else is configured, because the build emits relative URLs and
works at any path; the workflow header says why.

After the first deployment, check that the manifest is served as JSON rather than as a download:

```sh
curl -sI https://ctai-ufba.github.io/water4all-mobile/manifest.webmanifest | grep -i content-type
```

`application/manifest+json` is what the browser wants. If it comes back as
`application/octet-stream`, rename the file to `manifest.json` and update the `<link>` in
`index.html`, the precache list in `public/sw.js`, and `src/__tests__/pwaAssets.test.ts`.

Deployed updates reach a device that has the app cached on its next online load, because
navigation is network-first and build assets are content-hashed. Bump `CACHE_VERSION` in
`public/sw.js` when changing the caching rules themselves.
