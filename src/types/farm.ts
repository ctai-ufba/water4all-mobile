/**
 * @file farm.ts
 * @summary Domain types and pre-calibrated profiles for Mediterranean farms.
 * @description Defines the FarmProfile interface, FarmId type, and canonical
 * configurations for Small Farm (Antequera, Spain) and Medium Farm (Heraklion, Greece)
 * as documented in CONTEXT.md and the project specification.
 */

/**
 * Unique identifier for pre-configured Mediterranean farm profiles.
 */
export type FarmId = 'small-farm' | 'medium-farm';

/**
 * Geographic coordinates in decimal degrees.
 */
export interface Coordinates {
  /** Latitude in decimal degrees (e.g., 37.0051 for the Antequera site) */
  latitude: number;
  /** Longitude in decimal degrees (e.g., -4.6425 for the Antequera site) */
  longitude: number;
}

/**
 * Tank capacity configuration for a farm profile in cubic meters (m³).
 */
export interface TankCapacities {
  /** Rainwater catchment storage capacity in m³ */
  rainwater: number;
  /** ESA (Electric Swing Adsorption) atmospheric water storage capacity in m³ */
  esa: number;
  /** External water supply holding tank capacity in m³ */
  external: number;
  /** Central blend tank capacity in m³ where sources are mixed */
  blend: number;
  /** Target volume maintained in the blend tank by automated control in m³ */
  targetVolume: number;
  /** Minimum operating volume threshold triggering critical alarms in m³ */
  minOperatingVolume: number;
}

/**
 * Detailed specification of a Mediterranean farm profile.
 */
export interface FarmProfile {
  /** Unique profile identifier */
  id: FarmId;
  /** Canonical display name */
  name: string;
  /** Agricultural estate name */
  estateName: string;
  /** Human-readable location description */
  location: string;
  /** Geographic coordinates for weather fetching */
  coordinates: Coordinates;
  /** Total cultivated farm area in hectares (ha) */
  areaHa: number;
  /** Rainwater catchment collection surface area in square meters (m²) */
  catchmentAreaM2: number;
  /** Nominal daily water production capacity of installed ESA unit in m³/day */
  esaNominalCapacityM3PerDay: number;
  /** Cultivated crop types and agricultural activities */
  crops: string[];
  /** Baseline storage capacities in cubic meters */
  tankCapacities: TankCapacities;
  /** High-level description of farm operations and water strategy */
  description: string;
}

/**
 * The ratio by which each profile is reduced from its `prototipo_water4all` preset.
 *
 * @remarks Governs every quantity with prototype lineage: cultivated area, ESA nominal capacity,
 * tank capacities and daily demand. It does **not** govern `catchmentAreaM2`, which has no
 * counterpart in the prototype (ADR 0004).
 *
 * The tank capacities and demands below already sat at roughly this ratio, which is why adopting
 * it preserves the demo calibration; area and ESA capacity were the two quantities out of line.
 */
export const PROFILE_SCALE_FACTOR = 1 / 10;

/**
 * Pre-calibrated Mediterranean farm profiles.
 *
 * Small Farm: Finca El Olivar in Antequera, Andalusia, Spain, the prototype's Small case at
 * kappa = 1/10 (0.184 ha, olive groves, vineyards).
 * Medium Farm: Ktima Helios in Heraklion, Crete, Greece, the prototype's Medium case at the same
 * ratio (0.46 ha, mixed farming, livestock, vegetables).
 */
export const FARM_PROFILES: Record<FarmId, FarmProfile> = {
  'small-farm': {
    id: 'small-farm',
    name: 'Small Farm',
    estateName: 'Finca El Olivar',
    location: 'Antequera, Andalusia, Spain',
    /*
      Cultivated land in the Vega de Antequera, about 7 km south-west of the town and inside its
      municipality, so "Antequera, Andalusia" stays literally true. The town-centre coordinates
      this replaced put an olive-grove estate on the main square, which the site map made obvious.
      The point sits inside an unnamed olive grove (OSM `landuse=orchard`, `crop=olive_trees`)
      rather than on a real named finca: this profile carries invented telemetry, and invented
      telemetry does not belong on an identifiable business's land.
    */
    coordinates: {
      latitude: 37.0051,
      longitude: -4.6425,
    },
    // Prototype Small case: 1.84 ha of olives, vineyards, vegetables, pasture and fruit trees.
    areaHa: 0.184,
    // Ungoverned by kappa: roof collection area, about a fifth of the scaled plot (ADR 0004).
    catchmentAreaM2: 380.0,
    // Prototype Small case: esa_output 5.5 m³/day (app.py:184-203).
    esaNominalCapacityM3PerDay: 0.55,
    crops: ['Olive trees', 'Vineyards'],
    tankCapacities: {
      rainwater: 45.0,
      // Prototype Small case: esa_storage_capacity_m3 16.0 (app.py:194). This was the one tank
      // that sat nowhere near kappa (0.75x), and at 12 m³ held six weeks of what the unit can
      // actually make.
      esa: 1.6,
      external: 20.0,
      blend: 35.0,
      targetVolume: 28.0,
      minOperatingVolume: 7.0,
    },
    description: 'Family-scale Mediterranean farm relying on rainwater catchment and ESA water for olive groves and vineyards.',
  },
  'medium-farm': {
    id: 'medium-farm',
    name: 'Medium Farm',
    estateName: 'Ktima Helios',
    location: 'Heraklion, Crete, Greece',
    /*
      Vineyard bordering olive groves near Agios Syllas, in the Temenos unit of the Municipality of
      Heraklion, about 12 km inland from the city; "Heraklion, Crete" remains true at municipality
      level. The mixed vine-and-olive land matches this profile's crops, which the city-centre
      coordinates could not. Unnamed parcels only, for the reason given on the Small Farm above.
    */
    coordinates: {
      latitude: 35.2373,
      longitude: 25.1029,
    },
    // Prototype Medium case: 4.6 ha across olives, vineyards, vegetables, pasture and fruit.
    areaHa: 0.46,
    // Ungoverned by kappa: greenhouse collection area, about a fifth of the scaled plot (ADR 0004).
    catchmentAreaM2: 950.0,
    // Prototype Medium case: esa_output 15.8 m³/day (app.py:203-222).
    esaNominalCapacityM3PerDay: 1.58,
    crops: ['Olive trees', 'Vineyards', 'Greenhouse vegetables', 'Livestock'],
    tankCapacities: {
      rainwater: 120.0,
      // Prototype Medium case: esa_storage_capacity_m3 47.0 (app.py:214), previously 0.64x.
      esa: 4.7,
      external: 60.0,
      blend: 80.0,
      targetVolume: 65.0,
      minOperatingVolume: 16.0,
    },
    description: 'Commercial-scale Mediterranean farm with mixed agriculture, greenhouse vegetables, and livestock demands.',
  },
};

/**
 * Pre-computed array of all available Mediterranean farm profiles.
 */
export const ALL_FARM_PROFILES: FarmProfile[] = Object.values(FARM_PROFILES);

/**
 * Retrieves a farm profile by its unique identifier.
 *
 * @summary Lookup farm profile by ID.
 * @description Returns the pre-calibrated FarmProfile object matching the provided
 * FarmId, or null if the identifier is unrecognized.
 *
 * @param farmId - The unique identifier of the farm profile to look up.
 * @returns The matching FarmProfile object, or null if not found.
 * @throws Never throws an error; returns null for invalid inputs.
 */
export function getFarmProfile(farmId: string | null | undefined): FarmProfile | null {
  if (!farmId) {
    return null;
  }
  // Safely check if key exists in predefined record
  if (farmId in FARM_PROFILES) {
    return FARM_PROFILES[farmId as FarmId];
  }
  return null;
}

