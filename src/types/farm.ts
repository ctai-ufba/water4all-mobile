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
  /** Latitude in decimal degrees (e.g., 37.0194 for Antequera) */
  latitude: number;
  /** Longitude in decimal degrees (e.g., -4.5612 for Antequera) */
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
 * Pre-calibrated Mediterranean farm profiles.
 * Small Farm: Finca El Olivar in Antequera, Andalusia, Spain (~1.84 ha, olive groves, vineyards).
 * Medium Farm: Ktima Helios in Heraklion, Crete, Greece (~4.6 ha, mixed farming, livestock, vegetables).
 */
export const FARM_PROFILES: Record<FarmId, FarmProfile> = {
  'small-farm': {
    id: 'small-farm',
    name: 'Small Farm',
    estateName: 'Finca El Olivar',
    location: 'Antequera, Andalusia, Spain',
    coordinates: {
      latitude: 37.0194,
      longitude: -4.5612,
    },
    areaHa: 1.84,
    catchmentAreaM2: 380.0,
    esaNominalCapacityM3PerDay: 1.2,
    crops: ['Olive trees', 'Vineyards'],
    tankCapacities: {
      rainwater: 45.0,
      esa: 12.0,
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
    coordinates: {
      latitude: 35.3387,
      longitude: 25.1442,
    },
    areaHa: 4.6,
    catchmentAreaM2: 950.0,
    esaNominalCapacityM3PerDay: 2.8,
    crops: ['Olive trees', 'Vineyards', 'Greenhouse vegetables', 'Livestock'],
    tankCapacities: {
      rainwater: 120.0,
      esa: 30.0,
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

