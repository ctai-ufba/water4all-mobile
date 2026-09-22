/**
 * @file faoComplianceEngine.ts
 * @summary FAO Agricultural Water Quality Compliance Engine.
 * @description Evaluates physical and chemical water properties (TDS, pH, Nitrates, and EC)
 * against international FAO-29 guidelines ("Water quality for agriculture") and agronomic
 * benchmarks for Olive trees, Vineyards, Vegetables, and Livestock. Generates traffic-light
 * compliance status, limiting factors, guidance text, and safety warning banners.
 */

import {
  WaterQualityMetrics,
  ComplianceStatus,
  AgriculturalUseId,
  CropComplianceEvaluation,
  ParameterCompliance,
  FaoComplianceReport,
} from '../types/quality';

/**
 * Thresholds definition for a specific parameter across safe, caution, and unsafe bands.
 */
interface ParameterThresholdConfig {
  /** Label for display */
  label: string;
  /** Unit of measurement */
  unit: string;
  /** Evaluates status and reason given a numeric value */
  evaluate: (value: number) => { status: ComplianceStatus; reason?: string; thresholdText: string };
}

/**
 * Configuration specification for evaluating an agricultural use against FAO standards.
 */
interface UseEvaluationConfig {
  name: string;
  category: 'crop' | 'livestock';
  sensitivity: string;
  guidanceMap: {
    safe: string;
    caution: string;
    unsafe: string;
  };
  parameters: {
    ec: ParameterThresholdConfig;
    tds: ParameterThresholdConfig;
    ph: ParameterThresholdConfig;
    nitrates: ParameterThresholdConfig;
  };
}

/**
 * Standard FAO and agronomic tolerance matrices for Mediterranean agricultural uses.
 */
const EVALUATION_CONFIGS: Record<AgriculturalUseId, UseEvaluationConfig> = {
  vegetables: {
    name: 'Vegetables',
    category: 'crop',
    sensitivity: 'Sensitive crop (High salinity vulnerability)',
    guidanceMap: {
      safe: 'Optimal water quality. Safe for all greenhouse and field vegetable varieties without restriction.',
      caution:
        'Slight to moderate salinity restriction. Monitor soil leaching and consider blending additional ESA or rainwater.',
      unsafe:
        'Severe salinity hazard. High risk of osmotic root stress, leaf necrosis, and severe yield reduction. Do not irrigate sensitive crops without dilution.',
    },
    parameters: {
      ec: {
        label: 'Electrical Conductivity',
        unit: 'µS/cm',
        evaluate: (val) => {
          if (val <= 700) {
            return { status: 'safe', thresholdText: 'FAO limit: <= 700 µS/cm' };
          }
          if (val <= 1500) {
            return {
              status: 'caution',
              reason: 'EC exceeds sensitive vegetable baseline (700 µS/cm)',
              thresholdText: 'FAO limit: <= 700 µS/cm',
            };
          }
          return {
            status: 'unsafe',
            reason: 'EC exceeds maximum vegetable tolerance (1500 µS/cm)',
            thresholdText: 'FAO limit: <= 700 µS/cm',
          };
        },
      },
      tds: {
        label: 'Total Dissolved Solids',
        unit: 'mg/L',
        evaluate: (val) => {
          if (val <= 450) {
            return { status: 'safe', thresholdText: 'FAO limit: <= 450 mg/L' };
          }
          if (val <= 1000) {
            return {
              status: 'caution',
              reason: 'TDS exceeds recommended freshwater threshold (450 mg/L)',
              thresholdText: 'FAO limit: <= 450 mg/L',
            };
          }
          return {
            status: 'unsafe',
            reason: 'TDS exceeds vegetable survival limit (1000 mg/L)',
            thresholdText: 'FAO limit: <= 450 mg/L',
          };
        },
      },
      ph: {
        label: 'pH Level',
        unit: '',
        evaluate: (val) => {
          if (val >= 5.5 && val <= 8.4) {
            return { status: 'safe', thresholdText: 'FAO range: 5.5 - 8.4' };
          }
          if ((val >= 5.0 && val < 5.5) || (val > 8.4 && val <= 8.8)) {
            return {
              status: 'caution',
              reason: 'pH slightly outside optimal agronomic range (5.5 - 8.4)',
              thresholdText: 'FAO range: 5.5 - 8.4',
            };
          }
          return {
            status: 'unsafe',
            reason: 'Extreme pH causes nutrient lockup or root toxicity',
            thresholdText: 'FAO range: 5.5 - 8.4',
          };
        },
      },
      nitrates: {
        label: 'Nitrates',
        unit: 'mg/L',
        evaluate: (val) => {
          if (val <= 30) {
            return { status: 'safe', thresholdText: 'FAO limit: <= 30 mg/L' };
          }
          if (val <= 50) {
            return {
              status: 'caution',
              reason: 'Nitrates elevated; risk of excessive vegetative foliar growth',
              thresholdText: 'FAO limit: <= 30 mg/L',
            };
          }
          return {
            status: 'unsafe',
            reason: 'Excessive nitrates cause delayed fruiting and tissue damage',
            thresholdText: 'FAO limit: <= 30 mg/L',
          };
        },
      },
    },
  },

  vineyards: {
    name: 'Vineyards',
    category: 'crop',
    sensitivity: 'Moderately sensitive crop (Grapes & vines)',
    guidanceMap: {
      safe: 'Excellent water quality. Safe for wine and table grape irrigation with optimal sugar balance.',
      caution:
        'Moderate salinity level. Monitor grapevine canopy and berry development; maintain regular drainage.',
      unsafe:
        'High salinity risk. Exceeds grapevine osmotic tolerance, risking canopy scorch and compromised grape quality.',
    },
    parameters: {
      ec: {
        label: 'Electrical Conductivity',
        unit: 'µS/cm',
        evaluate: (val) => {
          if (val <= 1000) {
            return { status: 'safe', thresholdText: 'FAO limit: <= 1000 µS/cm' };
          }
          if (val <= 1800) {
            return {
              status: 'caution',
              reason: 'EC exceeds optimal vineyard threshold (1000 µS/cm)',
              thresholdText: 'FAO limit: <= 1000 µS/cm',
            };
          }
          return {
            status: 'unsafe',
            reason: 'EC exceeds grapevine salinity tolerance (1800 µS/cm)',
            thresholdText: 'FAO limit: <= 1000 µS/cm',
          };
        },
      },
      tds: {
        label: 'Total Dissolved Solids',
        unit: 'mg/L',
        evaluate: (val) => {
          if (val <= 640) {
            return { status: 'safe', thresholdText: 'FAO limit: <= 640 mg/L' };
          }
          if (val <= 1150) {
            return {
              status: 'caution',
              reason: 'TDS exceeds vineyard baseline (640 mg/L)',
              thresholdText: 'FAO limit: <= 640 mg/L',
            };
          }
          return {
            status: 'unsafe',
            reason: 'TDS exceeds vine tolerance limit (1150 mg/L)',
            thresholdText: 'FAO limit: <= 640 mg/L',
          };
        },
      },
      ph: {
        label: 'pH Level',
        unit: '',
        evaluate: (val) => {
          if (val >= 5.5 && val <= 8.4) {
            return { status: 'safe', thresholdText: 'FAO range: 5.5 - 8.4' };
          }
          if ((val >= 5.0 && val < 5.5) || (val > 8.4 && val <= 8.8)) {
            return {
              status: 'caution',
              reason: 'pH outside ideal vineyard nutrient absorption range (5.5 - 8.4)',
              thresholdText: 'FAO range: 5.5 - 8.4',
            };
          }
          return {
            status: 'unsafe',
            reason: 'Severe pH imbalance prevents micronutrient uptake in vines',
            thresholdText: 'FAO range: 5.5 - 8.4',
          };
        },
      },
      nitrates: {
        label: 'Nitrates',
        unit: 'mg/L',
        evaluate: (val) => {
          if (val <= 30) {
            return { status: 'safe', thresholdText: 'FAO limit: <= 30 mg/L' };
          }
          if (val <= 50) {
            return {
              status: 'caution',
              reason: 'Nitrates elevated; risk of uncontrolled canopy vigor',
              thresholdText: 'FAO limit: <= 30 mg/L',
            };
          }
          return {
            status: 'unsafe',
            reason: 'Excess nitrates induce poor berry set and bunch rot risk',
            thresholdText: 'FAO limit: <= 30 mg/L',
          };
        },
      },
    },
  },

  'olive-trees': {
    name: 'Olive trees',
    category: 'crop',
    sensitivity: 'Moderately tolerant Mediterranean crop',
    guidanceMap: {
      safe: 'Ideal water conditions for olive groves and oil yield maximization.',
      caution:
        'Slight salinity stress tolerated by mature olive trees. Young saplings may experience minor growth slowing.',
      unsafe:
        'Extreme salinity level exceeding olive tolerance threshold (> 3200 µS/cm). Root filtration impaired.',
    },
    parameters: {
      ec: {
        label: 'Electrical Conductivity',
        unit: 'µS/cm',
        evaluate: (val) => {
          if (val <= 2000) {
            return { status: 'safe', thresholdText: 'FAO limit: <= 2000 µS/cm' };
          }
          if (val <= 3200) {
            return {
              status: 'caution',
              reason: 'EC exceeds optimal olive threshold (2000 µS/cm)',
              thresholdText: 'FAO limit: <= 2000 µS/cm',
            };
          }
          return {
            status: 'unsafe',
            reason: 'EC exceeds maximum olive salinity threshold (3200 µS/cm)',
            thresholdText: 'FAO limit: <= 2000 µS/cm',
          };
        },
      },
      tds: {
        label: 'Total Dissolved Solids',
        unit: 'mg/L',
        evaluate: (val) => {
          if (val <= 1280) {
            return { status: 'safe', thresholdText: 'FAO limit: <= 1280 mg/L' };
          }
          if (val <= 2000) {
            return {
              status: 'caution',
              reason: 'TDS exceeds optimal olive baseline (1280 mg/L)',
              thresholdText: 'FAO limit: <= 1280 mg/L',
            };
          }
          return {
            status: 'unsafe',
            reason: 'TDS exceeds olive tree stress limit (2000 mg/L)',
            thresholdText: 'FAO limit: <= 1280 mg/L',
          };
        },
      },
      ph: {
        label: 'pH Level',
        unit: '',
        evaluate: (val) => {
          if (val >= 5.5 && val <= 8.5) {
            return { status: 'safe', thresholdText: 'FAO range: 5.5 - 8.5' };
          }
          if ((val >= 5.0 && val < 5.5) || (val > 8.5 && val <= 8.9)) {
            return {
              status: 'caution',
              reason: 'pH outside preferred olive soil interaction range (5.5 - 8.5)',
              thresholdText: 'FAO range: 5.5 - 8.5',
            };
          }
          return {
            status: 'unsafe',
            reason: 'Severe pH imbalance damages olive root zone',
            thresholdText: 'FAO range: 5.5 - 8.5',
          };
        },
      },
      nitrates: {
        label: 'Nitrates',
        unit: 'mg/L',
        evaluate: (val) => {
          if (val <= 45) {
            return { status: 'safe', thresholdText: 'FAO limit: <= 45 mg/L' };
          }
          if (val <= 60) {
            return {
              status: 'caution',
              reason: 'Nitrates slightly elevated for olive flowering',
              thresholdText: 'FAO limit: <= 45 mg/L',
            };
          }
          return {
            status: 'unsafe',
            reason: 'Excessive nitrates impair olive oil phenolic development',
            thresholdText: 'FAO limit: <= 45 mg/L',
          };
        },
      },
    },
  },

  livestock: {
    name: 'Livestock',
    category: 'livestock',
    sensitivity: 'Farm animals & drinking water safety',
    guidanceMap: {
      safe: 'Wholesome drinking water fully compliant with veterinary and animal health standards.',
      caution:
        'Salinity or nitrates moderately elevated. Safe for mature sheep and goats; monitor calves and poultry.',
      unsafe:
        'Toxicity hazard! Nitrate (> 100 mg/L) or salinity levels pose severe risk of methemoglobinemia in ruminants.',
    },
    parameters: {
      ec: {
        label: 'Electrical Conductivity',
        unit: 'µS/cm',
        evaluate: (val) => {
          if (val <= 1500) {
            return { status: 'safe', thresholdText: 'FAO limit: <= 1500 µS/cm' };
          }
          if (val <= 3000) {
            return {
              status: 'caution',
              reason: 'EC elevated for animal hydration (1500 µS/cm)',
              thresholdText: 'FAO limit: <= 1500 µS/cm',
            };
          }
          return {
            status: 'unsafe',
            reason: 'EC exceeds livestock drinking safety threshold (3000 µS/cm)',
            thresholdText: 'FAO limit: <= 1500 µS/cm',
          };
        },
      },
      tds: {
        label: 'Total Dissolved Solids',
        unit: 'mg/L',
        evaluate: (val) => {
          if (val <= 1000) {
            return { status: 'safe', thresholdText: 'FAO limit: <= 1000 mg/L' };
          }
          if (val <= 2000) {
            return {
              status: 'caution',
              reason: 'TDS moderately high for animal drinking (1000 mg/L)',
              thresholdText: 'FAO limit: <= 1000 mg/L',
            };
          }
          return {
            status: 'unsafe',
            reason: 'TDS exceeds safe animal hydration limit (2000 mg/L)',
            thresholdText: 'FAO limit: <= 1000 mg/L',
          };
        },
      },
      ph: {
        label: 'pH Level',
        unit: '',
        evaluate: (val) => {
          if (val >= 5.5 && val <= 8.5) {
            return { status: 'safe', thresholdText: 'FAO range: 5.5 - 8.5' };
          }
          if ((val >= 5.0 && val < 5.5) || (val > 8.5 && val <= 9.0)) {
            return {
              status: 'caution',
              reason: 'pH outside normal livestock drinking preference (5.5 - 8.5)',
              thresholdText: 'FAO range: 5.5 - 8.5',
            };
          }
          return {
            status: 'unsafe',
            reason: 'Severe pH abnormality causes digestive disturbances in animals',
            thresholdText: 'FAO range: 5.5 - 8.5',
          };
        },
      },
      nitrates: {
        label: 'Nitrates',
        unit: 'mg/L',
        evaluate: (val) => {
          if (val <= 50) {
            return { status: 'safe', thresholdText: 'FAO limit: <= 50 mg/L' };
          }
          if (val <= 100) {
            return {
              status: 'caution',
              reason: 'Nitrates elevated; risk for young or pregnant livestock (50 mg/L)',
              thresholdText: 'FAO limit: <= 50 mg/L',
            };
          }
          return {
            status: 'unsafe',
            reason: 'Nitrates exceed toxic threshold (> 100 mg/L); risk of methemoglobinemia',
            thresholdText: 'FAO limit: <= 50 mg/L',
          };
        },
      },
    },
  },
};

/**
 * Evaluates water quality against FAO guidelines for a single agricultural use.
 *
 * @summary Evaluate single crop/livestock compliance.
 * @description Assesses EC, TDS, pH, and Nitrates against defined agronomic thresholds.
 * Assigns an overall status based on the worst parameter, determines limiting factor,
 * and attaches actionable guidance text.
 *
 * @param useId - Target agricultural use ('vegetables' | 'vineyards' | 'olive-trees' | 'livestock').
 * @param quality - Active physical and chemical water quality readings.
 * @returns Complete CropComplianceEvaluation object.
 * @throws Never throws.
 */
export function evaluateCropCompliance(
  useId: AgriculturalUseId,
  quality: WaterQualityMetrics
): CropComplianceEvaluation {
  const config = EVALUATION_CONFIGS[useId];

  // Evaluate individual parameters
  const ecEval = config.parameters.ec.evaluate(quality.ec);
  const tdsEval = config.parameters.tds.evaluate(quality.tds);
  const phEval = config.parameters.ph.evaluate(quality.ph);
  const nitratesEval = config.parameters.nitrates.evaluate(quality.nitrates);

  const parameterResults: {
    ec: ParameterCompliance;
    tds: ParameterCompliance;
    ph: ParameterCompliance;
    nitrates: ParameterCompliance;
  } = {
    ec: {
      status: ecEval.status,
      label: config.parameters.ec.label,
      value: quality.ec,
      unit: config.parameters.ec.unit,
      thresholdText: ecEval.thresholdText,
      reason: ecEval.reason,
    },
    tds: {
      status: tdsEval.status,
      label: config.parameters.tds.label,
      value: quality.tds,
      unit: config.parameters.tds.unit,
      thresholdText: tdsEval.thresholdText,
      reason: tdsEval.reason,
    },
    ph: {
      status: phEval.status,
      label: config.parameters.ph.label,
      value: quality.ph,
      unit: config.parameters.ph.unit,
      thresholdText: phEval.thresholdText,
      reason: phEval.reason,
    },
    nitrates: {
      status: nitratesEval.status,
      label: config.parameters.nitrates.label,
      value: quality.nitrates,
      unit: config.parameters.nitrates.unit,
      thresholdText: nitratesEval.thresholdText,
      reason: nitratesEval.reason,
    },
  };

  // Determine overall status by taking the worst case among parameters
  const allStatuses: ComplianceStatus[] = [
    ecEval.status,
    tdsEval.status,
    phEval.status,
    nitratesEval.status,
  ];

  let overallStatus: ComplianceStatus = 'safe';
  if (allStatuses.includes('unsafe')) {
    overallStatus = 'unsafe';
  } else if (allStatuses.includes('caution')) {
    overallStatus = 'caution';
  }

  // Find the primary limiting factor if not completely safe
  let limitingFactor: string | null = null;
  if (overallStatus !== 'safe') {
    const limitingParam = Object.values(parameterResults).find((p) => p.status === overallStatus);
    if (limitingParam) {
      limitingFactor = `${limitingParam.label} (${limitingParam.reason ?? 'threshold exceeded'})`;
    }
  }

  let summary = 'Safe to irrigate';
  if (overallStatus === 'caution') {
    summary = 'Caution: Slight to moderate restriction';
  } else if (overallStatus === 'unsafe') {
    summary = 'Unsafe: Risk of crop/livestock damage';
  }

  return {
    useId,
    name: config.name,
    category: config.category,
    sensitivity: config.sensitivity,
    status: overallStatus,
    summary,
    limitingFactor,
    guidance: config.guidanceMap[overallStatus],
    parameters: parameterResults,
  };
}

/**
 * Evaluates water quality across all standard agricultural uses and generates
 * an actionable farm-wide FAO compliance report.
 *
 * @summary Generate farm FAO compliance report.
 * @description Evaluates Olive trees, Vineyards, Vegetables, and Livestock against
 * the provided Blend tank quality. Constructs safety warnings, lists affected crops,
 * and determines worst-case farm status.
 *
 * @param quality - Active physical and chemical water quality readings in Blend tank.
 * @returns Consolidated FaoComplianceReport object.
 * @throws Never throws.
 */
export function generateFaoComplianceReport(
  quality: WaterQualityMetrics
): FaoComplianceReport {
  const useIds: AgriculturalUseId[] = ['vegetables', 'vineyards', 'olive-trees', 'livestock'];
  const evaluations = useIds.map((id) => evaluateCropCompliance(id, quality));

  const unsafeEvals = evaluations.filter((e) => e.status === 'unsafe');
  const cautionEvals = evaluations.filter((e) => e.status === 'caution');

  let overallStatus: ComplianceStatus = 'safe';
  if (unsafeEvals.length > 0) {
    overallStatus = 'unsafe';
  } else if (cautionEvals.length > 0) {
    overallStatus = 'caution';
  }

  const hasUnsafeCrop = unsafeEvals.length > 0;
  const unsafeUses = unsafeEvals.map((e) => e.name);
  const cautionUses = cautionEvals.map((e) => e.name);

  // Generate actionable warning banner if safety constraints are breached
  let warningBanner: FaoComplianceReport['warningBanner'] = null;

  if (hasUnsafeCrop) {
    const cropListText = unsafeUses.join(', ');
    warningBanner = {
      severity: 'danger',
      title: 'Water Quality Alert - High Salinity Hazard',
      message: `Blend tank water exceeds safe FAO thresholds for: ${cropListText}. Do not irrigate sensitive crops without diluting with pure ESA or rainwater.`,
    };
  } else if (cautionEvals.length > 0) {
    const cautionListText = cautionUses.join(', ');
    warningBanner = {
      severity: 'warning',
      title: 'Water Quality Advisory - Moderate Salinity',
      message: `Caution advised for: ${cautionListText}. Blend tank salinity exhibits slight to moderate restriction. Monitor soil conductivity.`,
    };
  }

  return {
    quality,
    evaluations,
    overallStatus,
    hasUnsafeCrop,
    unsafeUses,
    cautionUses,
    warningBanner,
  };
}

