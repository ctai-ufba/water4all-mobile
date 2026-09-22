# The app shell is cached, the weather reading is not, and "push" is local

ADR 0001 chose a pure client-side PWA partly on the promise that a farmer with no signal still gets a working app. This records how that promise is kept, and the one thing it deliberately does not cover.

## A hand-written worker, because there are exactly three policies

`vite-plugin-pwa` and Workbox were the obvious route. They were not taken. The app's caching rules fit in three cases — the navigation entry point, content-hashed build output, and map imagery — and a generated precache manifest buys nothing here, because Vite already emits hashed filenames: a cached asset under `assets/` is immutable, so cache-first can never serve a stale module. A new build requests new filenames and the old ones are dropped with the cache version.

What the generators would have added is a build-time dependency, a second source of truth about what is cached, and a layer between the reader and the three rules. `public/sw.js` is served verbatim, reads top to bottom, and is checked by a test that reads the file rather than the bundle.

Verified against the production build in headless Chrome: the worker activates at `/sw.js`, takes control on the second load, primes `water4all-v1-shell` and `water4all-v1-assets`, and with the network emulated offline the app reloads, renders and completes a demo login from cache alone.

## The weather reading is never cached

This is the decision the rest follows from. Everything the app serves offline is either code or a figure computed on the device; the Open-Meteo response is neither, and it is the one thing that goes stale.

A cached reading would be handed to the operator as live weather while being hours or days old, and nothing on the screen would distinguish it from a reading taken a minute ago. The app already has an honest answer for a farm with no signal: the synthetic series built from that location's climate normals, which the Weather view labels as a fallback. A stale cache would replace a labelled approximation with an unlabelled wrong number.

So weather requests fall through the worker untouched, and `navigator.onLine` keeps its existing job of skipping the request entirely (`weatherService`, `radarService`). Radar and base map tiles are the exception, served stale while they revalidate: a tile is a picture of a place, it is captioned with the frame it came from, and the alternative on a slow rural connection is a grey map.

## Notifications are local, and the ticket called them simulated

There is no backend and no VAPID key pair, so nothing can wake a closed app. What is built is the delivery surface and the permission flow: alerts derived on the device, raised through the Notification API when permission is granted, and tagged by condition so a renewed warning replaces its predecessor rather than stacking.

The in-app toast is the primary channel, not the fallback. iOS exposes no Notification API outside an installed standalone app, Android Chrome forbids the constructor outside a service worker, and any operator may simply decline the prompt — all three end at the same place, and an alert that only existed as an OS notification would be lost in each. Every one of those paths is a `false` return and a toast that still shows.

## Repeated alerts are suppressed by escalation, not by a timer

Telemetry recomputes on every volume change, so a Blend tank sitting below its minimum operating volume derives the same alert hundreds of times. Announcing on derivation would notify the operator on each pass; announcing once and remembering the condition forever would go silent while a tank drained from a small deficit to an empty one.

Each alert therefore carries a coarse escalation step — the deficit floored to whole cubic metres, the rain forecast rounded to whole millimetres — and a condition speaks only when it is newly held or has risen above the deepest step already announced. A condition that clears drops out of the remembered set, so a breach that returns is announced again. The threshold is not a duration, because the operator cares about the water, not the clock.

The comparison is one-directional, and that direction is the whole point. A tank refilling from a 6 m³ deficit crosses the same steps going up that it crossed coming down; announcing those would tell the operator the farm is critically low, repeatedly, while they watch the truck fill it. The same holds for a forecast oscillating around a whole millimetre, which alternates between two steps indefinitely. Keeping the deepest step announced rather than the last one announced answers both: only worse news speaks.
