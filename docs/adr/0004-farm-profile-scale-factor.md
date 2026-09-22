# Farm profiles are the prototype's presets scaled by 1/10

The two farm profiles were assembled from `prototipo_water4all`'s Small and Medium cases, but the water system was scaled down without recording a factor. Land area was copied verbatim — 1.84 ha and 4.6 ha, identical to `app.py:184-188,204-208` — while tanks, demand and ESA capacity were reduced by differing amounts (ESA 0.22x, rain tank 0.13x, blend tank 0.105x, demand 0.099x). The result was farms with prototype-scale land and a water system ten times too small for it, and an ESA capacity roughly twice as large as the rest of the system implied.

We declare a single scale factor **κ = 1/10** against the prototype's presets, applied to every quantity with prototype lineage: cultivated area, ESA nominal capacity, tank capacities and daily demand. κ = 1/10 is what the app's tanks and demand already implied, so adopting it preserves the demo calibration recorded in issue 07 and corrects only the two quantities that were out of line. The alternatives were adopting the prototype's presets wholesale (full fidelity, but every demo figure grows tenfold and stops fitting a phone screen) or shrinking only the land area (which would have contradicted the one value that already matched the calibration authority).

## Correction, 2026-09-22: the ratio audit missed the ESA tank

The paragraph above claims κ "is what the app's tanks and demand already implied". That is true of the rain tank (0.128×), the blend tank (0.105×), the target volume (0.108×) and demand (0.099×). It is **not** true of the ESA tank, which sat at 0.75× for the Small Farm (12 m³ against the prototype's 16 m³) and 0.64× for the Medium (30 m³ against 47 m³). The original ratio list — "ESA 0.22x, rain tank 0.13x, blend tank 0.105x, demand 0.099x" — read `esa_output`, the production capacity, and never audited `esa_storage_capacity_m3`, the tank. So the one tank tied to a quantity that *was* out of line was itself the furthest out, and the omission hid it.

The ESA tank is therefore rescaled to κ: **1.6 m³** and **4.7 m³**. This is also the only value that makes physical sense. At a derived production of 0.27 m³/day, the old 12 m³ tank held six weeks of output; the corrected 1.6 m³ holds about six days, which is what a buffer on a continuous source should be. A test now pins the ratio between tank capacity and derived production, so the two cannot drift apart again.

The remaining tanks stay as calibrated. They sit between 0.09× and 0.25× of the prototype, close enough to κ that moving them would disturb the issue 07 demo calibration for no gain in fidelity; the Medium rain tank at 0.247× is the loosest and is the obvious candidate if that calibration is ever revisited.

## Catchment area

`catchmentAreaM2` has no counterpart in the prototype and is therefore **not** governed by κ. It is retained at 380 m² and 950 m² as roof and greenhouse collection area, which is about a fifth of the scaled plot. Because it is ungoverned, rainwater inflow must be derived from the catchment engine rather than hardcoded; the previous fixed 2.8 m³/day over 380 m² implied 7.4 mm of rain per day against a Mediterranean mean nearer 1.4 mm.
