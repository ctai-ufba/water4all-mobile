/**
 * @file QualityView.tsx
 * @summary Water Quality & FAO Crop Compliance Screen.
 * @description Dedicated screen presenting live physical and chemical water properties
 * in the central Blend tank (TDS, pH, Nitrates, EC) paired with an agricultural compliance
 * matrix and traffic-light safety indicators according to FAO guidelines for Olive trees,
 * Vineyards, Vegetables, and Livestock.
 */

import React from 'react';
import {
  ShieldCheck,
  AlertOctagon,
  AlertTriangle,
  Activity,
  Zap,
  FlaskConical,
  Droplets,
  Layers,
} from 'lucide-react';
import { useTelemetry } from '../../context/TelemetryContext';
import { useAuth } from '../../context/AuthContext';
import { useDemo } from '../../context/DemoContext';
import {
  calculateBlendQuality,
  formatQualityMetric,
  getNominalRangeDescription,
  evaluateFreshwaterMetricStatus,
} from '../../domain/waterQualityEngine';
import { generateFaoComplianceReport } from '../../domain/faoComplianceEngine';
import { QualityMetricCard } from './QualityMetricCard';
import { ComplianceCard } from './ComplianceCard';
import { SOURCE_WATER_QUALITY_PROFILES } from '../../types/quality';

/**
 * Water Quality & FAO Crop Compliance Screen component.
 *
 * @summary Water quality monitoring screen.
 * @description Displays live Blend tank readings (TDS, pH, Nitrates, EC),
 * warning banners for sensitive crops when quality thresholds are breached,
 * and the FAO crop compliance matrix.
 *
 * @returns React.JSX.Element representing the water quality view.
 * @throws Never throws.
 */
export function QualityView(): React.JSX.Element {
  const { telemetry } = useTelemetry();
  const { activeFarm } = useAuth();
  const { qualityRegime } = useDemo();

  // Compute live Blend tank quality from current reservoir volumes
  const tankVolumes = telemetry?.tankVolumes ?? {
    rainwater: 0,
    esa: 0,
    external: 0,
    blend: 0,
  };

  // The supply itself changes with the demo state, not only how much of it the farm is drawing,
  // so the regime has to reach the mixing model and the source readings below alike.
  const quality = calculateBlendQuality(tankVolumes, qualityRegime);
  const sourceQualities = SOURCE_WATER_QUALITY_PROFILES[qualityRegime];
  const complianceReport = generateFaoComplianceReport(quality);

  const {
    evaluations,
    overallStatus,
    hasUnsafeCrop,
    warningBanner,
  } = complianceReport;

  // Calculate percentage contribution of each source to current stored volume
  const totalSources = tankVolumes.rainwater + tankVolumes.esa + tankVolumes.external;
  const rainPct = totalSources > 0 ? Math.round((tankVolumes.rainwater / totalSources) * 100) : 0;
  const esaPct = totalSources > 0 ? Math.round((tankVolumes.esa / totalSources) * 100) : 0;
  const extPct = totalSources > 0 ? Math.round((tankVolumes.external / totalSources) * 100) : 0;

  return (
    <div className="space-y-5 pb-6" data-testid="quality-view">
      {/* Screen Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center space-x-2">
            <ShieldCheck className="h-6 w-6 text-cyan-400" />
            <h2 className="text-xl font-bold tracking-tight text-slate-100">
              Water Quality & FAO Compliance
            </h2>
          </div>
          <p className="mt-1 text-xs text-slate-400">
            Real-time physical and chemical analysis of the Blend tank for {activeFarm?.estateName ?? 'Farm'}.
          </p>
        </div>
      </div>

      {/* Prominent Safety Warning Banner (Rendered when quality violates safe thresholds) */}
      {warningBanner && (
        <div
          className={`flex items-start space-x-3 rounded-2xl border p-4 shadow-lg transition-all ${
            warningBanner.severity === 'danger'
              ? 'bg-rose-950/40 border-rose-600/50 text-rose-200'
              : 'bg-amber-950/40 border-amber-600/50 text-amber-200'
          }`}
          role="alert"
          aria-live="assertive"
          data-testid="quality-warning-banner"
        >
          {warningBanner.severity === 'danger' ? (
            <AlertOctagon className="h-6 w-6 shrink-0 text-rose-400 mt-0.5" />
          ) : (
            <AlertTriangle className="h-6 w-6 shrink-0 text-amber-400 mt-0.5" />
          )}
          <div>
            <h3 className="text-sm font-bold text-slate-100">{warningBanner.title}</h3>
            <p className="mt-1 text-xs text-slate-300 leading-relaxed">{warningBanner.message}</p>
          </div>
        </div>
      )}

      {/* Live Blend Tank Parameter Readings Grid */}
      <div>
        <div className="flex items-center justify-between mb-2.5">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Blend Tank Live Telemetry
          </h3>
          <span className="text-[11px] font-mono text-cyan-400">
            Status: {overallStatus.toUpperCase()}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {/* EC Card */}
          <QualityMetricCard
            title="Electrical Conductivity"
            formattedValue={formatQualityMetric('ec', quality.ec)}
            symbol="EC"
            nominalRange={getNominalRangeDescription('ec')}
            status={evaluateFreshwaterMetricStatus('ec', quality.ec)}
            description="Direct indicator of mineral salinity and dissolved ions."
            icon={Zap}
          />

          {/* TDS Card */}
          <QualityMetricCard
            title="Total Dissolved Solids"
            formattedValue={formatQualityMetric('tds', quality.tds)}
            symbol="TDS"
            nominalRange={getNominalRangeDescription('tds')}
            status={evaluateFreshwaterMetricStatus('tds', quality.tds)}
            description="Combined mineral salt concentration in water."
            icon={Activity}
          />

          {/* pH Card */}
          <QualityMetricCard
            title="pH Acidity/Alkalinity"
            formattedValue={formatQualityMetric('ph', quality.ph)}
            symbol="pH"
            nominalRange={getNominalRangeDescription('ph')}
            status={evaluateFreshwaterMetricStatus('ph', quality.ph)}
            description="Nutrient uptake availability index."
            icon={FlaskConical}
          />

          {/* Nitrates Card */}
          <QualityMetricCard
            title="Nitrate Concentration"
            formattedValue={formatQualityMetric('nitrates', quality.nitrates)}
            symbol="NO3-"
            nominalRange={getNominalRangeDescription('nitrates')}
            status={evaluateFreshwaterMetricStatus('nitrates', quality.nitrates)}
            description="Vegetative growth and animal safety marker."
            icon={Droplets}
          />
        </div>
      </div>

      {/* FAO Agricultural Compliance Matrix */}
      <div>
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center space-x-1.5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              FAO Agricultural Compliance Matrix
            </h3>
          </div>
          {hasUnsafeCrop ? (
            <span className="text-[11px] font-semibold text-rose-400">
              Crop Protection Required
            </span>
          ) : (
            <span className="text-[11px] font-semibold text-emerald-400">
              All Crops Compliant
            </span>
          )}
        </div>

        <div className="space-y-3">
          {evaluations.map((evaluation) => (
            <ComplianceCard key={evaluation.useId} evaluation={evaluation} />
          ))}
        </div>
      </div>

      {/* Source Water Quality & Blending Breakdown Card */}
      <div className="rounded-2xl bg-slate-900/90 p-4 border border-slate-800/80 shadow-md">
        <div className="flex items-center space-x-2 mb-2">
          <Layers className="h-5 w-5 text-cyan-400" />
          <h3 className="text-sm font-bold text-slate-100">
            Source Water Conditioning Breakdown
          </h3>
        </div>
        <p className="text-xs text-slate-400 leading-relaxed">
          The Blend tank combines high-purity sustainable sources (Rainwater and ESA water) with external deliveries to buffer mineral salinity.
        </p>

        {/* Source Purity Reference Table */}
        <div className="mt-3 space-y-2 text-xs">
          {/* Rainwater Source */}
          <div className="flex items-center justify-between rounded-xl bg-slate-950/60 p-2.5 border border-slate-800/60">
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-semibold text-cyan-300">Rainwater</span>
                <span className="text-[10px] rounded-full bg-cyan-950 px-2 py-0.5 text-cyan-400 border border-cyan-800/40">
                  {rainPct}% in storage
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                TDS: {sourceQualities.rainwater.tds} mg/L | EC: {sourceQualities.rainwater.ec} µS/cm
              </p>
            </div>
            <span className="text-[11px] text-emerald-400 font-medium">Ultra-low Salinity</span>
          </div>

          {/* ESA Source */}
          <div className="flex items-center justify-between rounded-xl bg-slate-950/60 p-2.5 border border-slate-800/60">
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-semibold text-emerald-300">ESA Water</span>
                <span className="text-[10px] rounded-full bg-emerald-950 px-2 py-0.5 text-emerald-400 border border-emerald-800/40">
                  {esaPct}% in storage
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                TDS: {sourceQualities.esa.tds} mg/L | EC: {sourceQualities.esa.ec} µS/cm
              </p>
            </div>
            <span className="text-[11px] text-emerald-400 font-medium">Pure Distillate</span>
          </div>

          {/* External Supply Source */}
          <div className="flex items-center justify-between rounded-xl bg-slate-950/60 p-2.5 border border-slate-800/60">
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-semibold text-amber-300">External Supply</span>
                <span className="text-[10px] rounded-full bg-amber-950 px-2 py-0.5 text-amber-400 border border-amber-800/40">
                  {extPct}% in storage
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                TDS: {sourceQualities.external.tds} mg/L | EC: {sourceQualities.external.ec} µS/cm
              </p>
            </div>
            <span className="text-[11px] text-amber-400 font-medium">Mineralized Water</span>
          </div>
        </div>
      </div>
    </div>
  );
}

