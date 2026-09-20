# Water4All Mobile

Canonical domain vocabulary for the farm water monitoring mobile application.
All terms are in English to match the canonical engineering model and frontend interface.

## 1. Locations and Farm Profiles

**Small Farm**:
A family-scale Mediterranean farm profile located in **Antequera, Andalusia, Spain** (37.0194° N, 4.5612° W).
Focuses on olive groves and vineyards, relying heavily on rainwater catchment and ESA water.

**Medium Farm**:
A commercial-scale Mediterranean farm profile located in **Heraklion, Crete, Greece** (35.3387° N, 25.1442° E).
Features mixed operations including olive trees, vineyards, greenhouse vegetables, and livestock, with higher water throughput and external supply access.

## 2. Water Sources and Storage

**Rainwater**:
Water captured from rainfall over the designated catchment area.
_Avoid_: Rain source, roof water

**ESA water**:
Water produced from atmospheric humidity using Electric Swing Adsorption (ESA).
_Avoid_: Air water, atmospheric moisture

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

## 5. Operations and Telemetry

**Water autonomy**:
Estimated number of days the farm can sustain operations without external refills, based on current stored volumes and average daily consumption.
_Avoid_: Days left, survival time

**Daily water balance**:
Net difference between total daily inflow (Rainwater + ESA + External deliveries) and total daily consumption across all uses.
_Avoid_: Water differential, flow balance

**Irrigation mode**:
Operational state of the irrigation network: Auto (scheduled), Eco (water-saving reduced deficit irrigation), or Paused.
_Avoid_: Watering status

