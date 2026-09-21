/**
 * @file ComplianceCard.tsx
 * @summary Card component displaying FAO agricultural compliance for a specific crop or livestock use.
 * @description Renders traffic-light status badge, crop sensitivity notes, limiting factor alerts,
 * agronomic guidance on salinity/nitrate risks, and individual parameter breakdown.
 */

import React, { useState } from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  AlertOctagon,
  ChevronDown,
  ChevronUp,
  Leaf,
  Info,
} from 'lucide-react';
import { CropComplianceEvaluation, ComplianceStatus } from '../../types/quality';

/**
 * Props for the ComplianceCard component.
 */
export interface ComplianceCardProps {
  /** Evaluation data for the crop or livestock use */
  evaluation: CropComplianceEvaluation;
}

/**
 * Card rendering FAO compliance evaluation for a specific agricultural use.
 *
 * @summary Agricultural crop compliance card.
 * @description Presents green/yellow/red status indicators with detailed agronomic
 * guidance and individual parameter breakdown for EC, TDS, pH, and Nitrates.
 *
 * @param props - Component props containing crop evaluation data.
 * @returns React.JSX.Element representing the compliance card.
 * @throws Never throws.
 */
export function ComplianceCard({ evaluation }: ComplianceCardProps): React.JSX.Element {
  const [isExpanded, setIsExpanded] = useState<boolean>(false);

  const {
    name,
    sensitivity,
    status,
    summary,
    limitingFactor,
    guidance,
    parameters,
    useId,
  } = evaluation;

  /**
   * Helper resolving visual styling classes, badges, and icons by compliance status.
   *
   * @summary Resolve crop status styles.
   * @description Returns Tailwind CSS style descriptors and icons matching the evaluated status.
   *
   * @param cardStatus - Target compliance status ('safe' | 'caution' | 'unsafe').
   * @returns Object containing badgeBg, borderAccent, bannerBg, dotColor, StatusIcon, and label.
   * @throws Never throws.
   */
  const getStatusStyles = (cardStatus: ComplianceStatus) => {
    switch (cardStatus) {
      case 'safe':
        return {
          badgeBg: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
          borderAccent: 'border-slate-800 hover:border-emerald-500/40',
          bannerBg: 'bg-emerald-950/30 border-emerald-800/40 text-emerald-300',
          dotColor: 'bg-emerald-400',
          StatusIcon: CheckCircle2,
          label: 'Safe',
        };
      case 'caution':
        return {
          badgeBg: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
          borderAccent: 'border-amber-500/40 bg-amber-950/10',
          bannerBg: 'bg-amber-950/40 border-amber-800/50 text-amber-200',
          dotColor: 'bg-amber-400',
          StatusIcon: AlertTriangle,
          label: 'Caution',
        };
      case 'unsafe':
        return {
          badgeBg: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
          borderAccent: 'border-rose-500/50 bg-rose-950/20',
          bannerBg: 'bg-rose-950/50 border-rose-800/60 text-rose-200',
          dotColor: 'bg-rose-400',
          StatusIcon: AlertOctagon,
          label: 'Unsafe',
        };
    }
  };

  const currentStyle = getStatusStyles(status);
  const StatusIcon = currentStyle.StatusIcon;

  return (
    <div
      className={`flex flex-col rounded-2xl bg-slate-900/90 p-4 border transition-all shadow-md ${currentStyle.borderAccent}`}
      data-testid={`compliance-card-${useId}`}
    >
      {/* Header: Name, Sensitivity, Status Badge */}
      <div className="flex items-start justify-between">
        <div className="flex items-center space-x-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-800 text-cyan-400">
            <Leaf className="h-5 w-5" />
          </div>
          <div>
            <h4 className="text-base font-semibold text-slate-100">{name}</h4>
            <p className="text-xs text-slate-400">{sensitivity}</p>
          </div>
        </div>

        {/* Traffic-light status indicator */}
        <div
          className={`flex items-center space-x-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${currentStyle.badgeBg}`}
        >
          <StatusIcon className="h-3.5 w-3.5" />
          <span>{currentStyle.label}</span>
        </div>
      </div>

      {/* Summary Banner */}
      <div className={`mt-3 rounded-xl border p-2.5 text-xs font-medium flex items-center justify-between ${currentStyle.bannerBg}`}>
        <span>{summary}</span>
        {limitingFactor && (
          <span className="text-[11px] font-mono text-amber-300 ml-2">
            Limiting: {limitingFactor.split(' ')[0]}
          </span>
        )}
      </div>

      {/* Agronomic / Veterinary Guidance Box */}
      <div className="mt-3 rounded-xl bg-slate-950/70 p-3 border border-slate-800/80">
        <div className="flex items-start space-x-2">
          <Info className="h-4 w-4 shrink-0 text-cyan-400 mt-0.5" />
          <p className="text-xs text-slate-300 leading-relaxed">{guidance}</p>
        </div>
      </div>

      {/* Expandable Parameter Breakdown Button */}
      <button
        onClick={() => setIsExpanded((prev) => !prev)}
        className="mt-3 flex items-center justify-between py-1 text-xs font-medium text-slate-400 hover:text-slate-200 transition-colors"
        aria-expanded={isExpanded}
        aria-label={`Toggle parameter details for ${name}`}
      >
        <span>FAO Parameter Limits Breakdown</span>
        {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>

      {/* Parameter Breakdown Details */}
      {isExpanded && (
        <div className="mt-2 space-y-2 border-t border-slate-800/80 pt-3 text-xs">
          {Object.entries(parameters).map(([key, param]) => {
            const paramStyle = getStatusStyles(param.status);
            const ParamIcon = paramStyle.StatusIcon;

            return (
              <div
                key={key}
                className="flex items-center justify-between rounded-lg bg-slate-950/40 px-3 py-2 border border-slate-800/60"
              >
                <div className="flex items-center space-x-2">
                  <div className={`h-2 w-2 rounded-full ${paramStyle.dotColor}`} />
                  <div>
                    <span className="font-medium text-slate-200">{param.label}</span>
                    <p className="text-[11px] text-slate-400 font-mono">{param.thresholdText}</p>
                  </div>
                </div>

                <div className="flex items-center space-x-2 text-right">
                  <span className="font-semibold text-slate-100 font-mono">
                    {param.value} {param.unit}
                  </span>
                  <ParamIcon className={`h-4 w-4 ${param.status === 'safe' ? 'text-emerald-400' : param.status === 'caution' ? 'text-amber-400' : 'text-rose-400'}`} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

