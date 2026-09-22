# Water4All Mobile

Canonical domain vocabulary for the farm water monitoring mobile application.
All terms are in English to match the canonical engineering model and frontend interface.

## 1. Locations and Farm Profiles

**Small Farm**:
A family-scale Mediterranean farm profile located on cultivated land in the **municipality of Antequera, Andalusia, Spain** (37.0051° N, 4.6425° W), about 7 km south-west of the town.
Focuses on olive groves and vineyards, relying heavily on rainwater catchment and ESA water.

**Medium Farm**:
A commercial-scale Mediterranean farm profile located on mixed vine and olive land in the **municipality of Heraklion, Crete, Greece** (35.2373° N, 25.1029° E), about 12 km inland from the city.
Features mixed operations including olive trees, vineyards, greenhouse vegetables, and livestock, with higher water throughput and external supply access.

**Profile scale factor**:
The one-tenth ratio by which each farm profile is reduced from the corresponding `prototipo_water4all` preset. Governs cultivated area, ESA nominal capacity, tank capacities and daily demand; does not govern catchment area, which has no prototype counterpart.
_Avoid_: Scale-down, size ratio

## 2. Water Sources and Storage

**Rainwater**:
Water captured from rainfall over the designated catchment area.
_Avoid_: Rain source, roof water

**ESA water**:
Water produced from atmospheric humidity using Electric Swing Adsorption (ESA).
_Avoid_: Air water, atmospheric moisture

**ESA nominal capacity**:
The reference daily output of an installed ESA unit, anchored to the 25 °C / 90 % RH bench measurement of the physical prototype. It is not the output expected in the field, which in a Mediterranean climate averages around 41 % of it.
_Avoid_: ESA rating, nameplate output, installed capacity

**Ambient yield ratio**:
The share of ESA nominal capacity that the current air can actually deliver. A low value means dry air, not a malfunctioning unit.
_Avoid_: Efficiency factor, ESA efficiency, performance ratio

**External supply**:
Water delivered from an external connection or municipal water truck.
_Avoid_: Tap water, city supply

**Blend tank**:
The central mixing reservoir where water from Rainwater, ESA, and External supply is blended and conditioned to meet target quality before distribution to uses.
_Avoid_: Main tank, central reservoir

**Source tank**:
Individual storage tanks dedicated to a specific source (Rainwater tank, ESA tank, External supply tank) before transfer to the Blend tank.
_Avoid_: Feeder tank, raw tank

**Tank capacity**:
Maximum physical volume a reservoir can store, expressed in cubic meters (m³).
_Avoid_: Tank size, total volume

**Tank volume**:
Current volume of water physically stored in a reservoir at a given moment, expressed in cubic meters (m³).
_Avoid_: Stored capacity, current level

**Target volume**:
Desired water volume maintained in the Blend tank by the automated control policy.
_Avoid_: Setpoint

**Minimum operating volume**:
Emergency reserve threshold below which the Blend tank triggers critical low-level warnings.
_Avoid_: Reserve limit, safety threshold

## 3. Water Quality and Compliance

**TDS (Total Dissolved Solids)**:
Concentration of dissolved mineral salts in water, expressed in milligrams per liter (mg/L).
_Avoid_: Total solids, salinity concentration

**Nitrates**:
Nitrate concentration in water, expressed in milligrams per liter (mg/L).
_Avoid_: Nitrogen level

**pH**:
Measure of water acidity or alkalinity (dimensionless scale 0 to 14).
_Avoid_: Acidity index

**EC (Electrical Conductivity)**:
Capacity of water to conduct electrical current, directly proportional to mineral salinity, expressed in microsiemens per centimeter (µS/cm).
_Avoid_: Conductivity rate

**Quality compliance**:
Assessment of whether current Blend tank water is safe and optimal for a specific farm use according to FAO agricultural guidelines (Green: Safe, Yellow: Caution, Red: Unsafe / Risk of damage).
_Avoid_: Quality rating, water grade

## 4. Demands and Agricultural Uses

**Human and utility demand**:
High-purity water allocated for domestic farmhouse use and utilities.
_Avoid_: Drinking water

**Livestock**:
Water supplied for farm animals and livestock drinking troughs.
_Avoid_: Animal water, cattle demand

**Agricultural demand**:
Irrigation water supplied to crops: Olive trees, Vineyards, Vegetables, Pasture, and Fruit trees.
_Avoid_: Crop watering, field load

## 5. Operations, Efficiency and Optimization

**Water autonomy**:
Estimated number of days the farm can sustain operations without external refills, based on current stored volumes and average daily consumption.
_Avoid_: Days left, survival time

**Daily water balance**:
Net difference between total daily inflow (Rainwater + ESA + External deliveries) and total daily consumption across all uses.
_Avoid_: Water differential, flow balance

**Irrigation mode**:
Operational state of the irrigation network: Auto (scheduled), Eco (water-saving reduced deficit irrigation), or Paused.
_Avoid_: Watering status

**Optimal design**:
The calibrated system configuration that minimizes total annual cost while satisfying all quality and demand constraints without deficit.
_Avoid_: Best configuration, tuned mode

**Unoptimized baseline**:
A naive, non-calibrated operating state used for demonstration comparison, exhibiting lower autonomy, higher external supply expenses, and quality violations.
_Avoid_: Uncalibrated mode, raw state

**Water efficiency**:
The percentage of total farm demand satisfied by local sustainable sources (Rainwater + ESA) versus external water deliveries, alongside the daily financial result. The result is reported as three figures — truck purchases avoided, ESA energy cost, and the net — because local water is not free.
_Avoid_: Eco score, savings index

**ESA energy cost**:
The daily electricity cost of running the ESA unit. At roughly 790 EUR/m³ against 4.50 EUR/m³ for delivered water, it normally exceeds the purchases the ESA water displaces; the unit earns its place through autonomy where no delivery reaches, not through price.
_Avoid_: Running cost, ESA opex

**Hourly forecast series**:
The sequence of hourly temperature and relative humidity readings that the ESA engine integrates production across. An instantaneous reading is not a substitute: taken at a summer afternoon peak it reports zero for a day that does produce, because the daily total is collected in the humid pre-dawn window.
_Avoid_: Weather array, forecast data

**Climate normals**:
The monthly temperature, humidity, diurnal range, rainfall and rainy-day statistics for a farm's location, driving the synthetic offline fallback.
_Avoid_: Climate averages, weather baseline

**Rainfall event**:
A single day on which the synthetic generator delivers rain. Offline precipitation falls as discrete events at the location's climatological frequency rather than as a monthly average spread across every day, because a Mediterranean July is dry throughout with a rare shower.
_Avoid_: Rain day, precipitation sample

**Instantaneous ESA rate**:
The production rate the air outside sustains at this moment, expressed in liters per hour (L/h). It answers "is the unit making water right now" and is legitimately zero on a dry afternoon. It is never a daily figure divided by 24, and never stands in for a forecast yield.
_Avoid_: Live rate, current output

**Forecast yield**:
The water the ESA unit is expected to collect across a stated forecast window, expressed in cubic meters (m³) with the window named. A 24-hour window holds only two whole 8.5-hour cycles and truncates the third, so a day's yield sits below the sustained daily mean over a longer horizon.
_Avoid_: Daily production, projected rate

**Radar overlay**:
The most recent published precipitation radar composite, drawn over the base map of the active farm's site. Coverage is not guaranteed for either location and a region without radar returns the same transparent tile as a region without rain, so the absence of echoes is always stated in words: left unexplained it reads as "no rain", which is a different claim from "no radar". It is served only to zoom 7; past that the host returns a fixed "zoom level not supported" image for every location, so deeper views upscale the last real composite locally.
_Avoid_: Rain layer, weather map
