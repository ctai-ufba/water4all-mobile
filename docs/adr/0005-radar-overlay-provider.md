# The radar overlay comes from RainViewer, under terms narrower than the rest of the app's data

The Weather view carries a small map of both farm sites. With two fixed locations, no route and no search, a base map does almost no informational work, and it was nearly cut. It earns its place by taking over farm selection and by hosting a precipitation radar overlay, which is the only part of the map that carries signal the app does not already have. That makes the choice of radar provider the decision worth recording, not the map.

Open-Meteo's `weather-map-layer` was the natural candidate, since Open-Meteo already supplies the app's weather data. It was rejected on two grounds. Its LICENSE is plain GPL-2.0 with no linking exception, so bundling it would reach this application's own source. Its official tile host is referrer-locked to `*.open-meteo.com`, leaving only an S3 bucket with no published terms and no stated rate limits — a dependency with no contract.

RainViewer's `weather-maps.json` index was confirmed key-less by live unauthenticated request, and its tile paths are opaque handles the index hands out rather than URLs derivable from a timestamp, so the index request is not optional. Its terms read "This API is available for personal and educational use only", which is narrower than Open-Meteo's non-commercial allowance. **This project is funded research without commercial purpose, so the reading is reasonable but not explicitly granted.** The divergence is deliberate and recorded here rather than left implicit, in the same spirit as the TDS divergence recorded in issue 07. If the project ever acquires a commercial purpose, this dependency is the first thing that has to be revisited.

Base map tiles are the OpenStreetMap Foundation's raster endpoint under ODbL. Credit for tiles, radar and weather data sits in the application shell footer, visible on every tab and independent of whether any of the three APIs was reached in a given session, because the licences are conditions on the application rather than on the one screen that happens to draw a map.

## Radar unavailability is a modelled state, not an error path

Per-country radar coverage for Spain and Greece could not be verified from a primary source. The index can also advertise no frames, and the request can fail like any other. All three resolve to an `available: false` result carrying its reason, and the map states that reason beneath a base map that still renders.

This is a requirement rather than a contingency because the failure is silent by nature: an overlay that does not draw looks exactly like an overlay showing no rain. "No radar" and "no rain over the farm" are different claims, and the app is only entitled to make the first one.

## The map is locked, and that is the point

Zoom is fixed at the level that holds Antequera and Heraklion in one frame, and dragging is off. There is nothing off-frame to find, both pins are always visible, and on a phone a pannable map inside a scrolling column steals the scroll gesture. The pins are Leaflet `divIcon` elements rather than the default marker, both because the default marker is a bundled PNG whose URL breaks under a bundler and because an inline element carries the site's name as its own text, which is what gives each pin an accessible name and a keyboard target.

## Correction (2026-09-22): the map shows one site, and the operator drives the zoom

**The section above is superseded.** The map now centres on the active farm and shows that site alone, with zoom and pan under the operator's control. The `divIcon` reasoning survives; the locked frame and the two-site view do not.

The selector argument was wrong on its own terms. `Header.tsx` already ships a Switch Farm Profile modal reachable from every tab, so the map was never the only way to change farm, and selection was not what earned it its place. What earns it is the radar overlay and the geographic context of the one site whose physics the screen is reporting.

The two-site frame was also unsound. At zoom 4 a pixel is 0.0879 degrees of longitude, so the 328 px of map left inside `max-w-md` on a 360 px phone spans 28.8 degrees against the 29.7 degrees between the two sites: both pins fell outside the frame, with panning disabled to prevent recovering them. Centring on one farm removes that constraint instead of patching it. Panning is enabled alongside zoom, because a map that zooms without panning strands the operator as soon as the site leaves the centre, and a control returns the view to the farm.

Free zoom does not mean the radar improves with it. Probing the live host over Antequera returned 5285 bytes at z4, 5912 at z6, and an identical 1370 bytes at z8, z10 and z12, which was first read as the composite being upsampled past its native resolution. **That reading was wrong and is corrected in the section below.**

## Correction (2026-09-22): radar stops at z7, and past it the host serves a message tile

Found by using the app: above a certain zoom the map tiled the words "zoom level not supported" across the farm.

The earlier probe was right about the bytes and wrong about their meaning. Re-probing two locations rather than one settles it: at z7 Antequera returns 4713 bytes and Heraklion 2526, different payloads and therefore real data; at z8 and z9 **both locations return the byte-identical 1370-byte image** (md5 `2cc6649e...`). An identical payload for two points 2000 km apart is not upsampled data, it is one fixed placeholder. RainViewer's deepest served radar zoom is z7.

Identical sizes at a single location were never evidence of upsampling; two locations were needed and only one was probed. The lesson is in the method, not the number: a measurement that cannot distinguish between the hypotheses is not a measurement.

The cap therefore belongs on the radar layer's `maxNativeZoom`, not on the map's `maxZoom`. Leaflet then upscales the z7 composite locally at deeper zooms, the placeholder can never be requested at any zoom, and the operator keeps the full zoom range with a base map that goes on sharpening. The site opens at z7, the most detailed view whose radar is real.

## Correction (2026-09-22): outside coverage RainViewer answers 200, not 404

The unavailability section above assumed a missing region produces a failed tile. Probing the live host shows it produces a **200 with a transparent tile**: a blank Pacific tile came back at 334 bytes, against 5285 over Antequera and 6416 over Heraklion, both of which do have coverage today.

Two consequences. An `errorTileUrl` is dead code, because no error occurs. And, more importantly, there is no tile-level signal that separates "no rain here" from "no radar here" — both are the same transparent image. The index-level reasons (`offline`, `request-failed`, `no-frames`) remain correct and stated, but they do not cover the coverage case, which is the one this ADR singled out as unverifiable for Spain and Greece. Since the map now zooms in on a single site, where a blank overlay is the ordinary view, the claim has to be carried by stated wording on the screen rather than by error handling.
