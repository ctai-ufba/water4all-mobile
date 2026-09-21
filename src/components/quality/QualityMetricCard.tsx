/**
 * @file QualityMetricCard.tsx
 * @summary Card component rendering a single physical or chemical water quality parameter.
 * @description Displays live reading, measurement unit in plain text, nominal reference range,
 * visual status bar, and traffic-light status badge for TDS, pH, Nitrates, or EC.
 */

import React from 'react';
import { CheckCircle2, AlertTriangle, AlertOctagon } from 'lucide-react';
import { ComplianceStatus } from '../../types/quality';

/**
 * Props for the QualityMetricCard component.
 */
export interface QualityMetricCardProps {
  /** Display title for the metric parameter (e.g., 'Total Dissolved Solids (TDS)') */
  title: string;
  /** Primary numeric value formatted with unit in plain text (e.g., '245 mg/L') */
  formattedValue: string;
  /** Parameter symbol or abbreviation (e.g., 'TDS', 'pH', 'EC', 'NO3-') */
  symbol: string;
  /** Nominal agricultural reference standard description (e.g., 'Nominal: < 500 mg/L') */
  nominalRange: string;
  /** Traffic-light compliance status ('safe' | 'caution' | 'unsafe') */
  status: ComplianceStatus;
  /** Descriptive explanation of what this parameter measures and its impact */
  description: string;
  /** Optional icon component rendered in header */
  icon?: React.ComponentType<{ className?: string }>;
}

/**
 * Renders a high-contrast card for a single water quality parameter.
 *
 * @summary Single water quality metric display card.
 * @description Displays real-time measurement value, traffic light status badge,
 * nominal reference bounds, and accessible plain-text units.
 *
 * @param props - Component props containing formatted reading, status, and metadata.
 * @returns React.JSX.Element representing the parameter card.
 * @throws Never throws.
 */
export function QualityMetricCard({
  title,
  formattedValue,
  symbol,
  nominalRange,
  status,
  description,
  icon: Icon,
}: QualityMetricCardProps): React.JSX.Element {
  /**
   * Resolves visual styling classes, badge text, and status icon for the metric card.
   *
   * @summary Resolve status styling configuration.
   * @description Returns corresponding Tailwind CSS classes and Lucide icon based on ComplianceStatus.
   *
   * @returns Object containing badgeBg, barColor, borderAccent, statusText, and StatusIcon.
   * @throws Never throws.
   */
  const getStatusConfig = () => {
    switch (status) {
      case 'safe':
        return {
          badgeBg: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
          barColor: 'bg-emerald-500',
          borderAccent: 'border-slate-800 hover:border-emerald-500/40',
          statusText: 'Optimal',
          StatusIcon: CheckCircle2,
        };
      case 'caution':
        return {
          badgeBg: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
          barColor: 'bg-amber-500',
          borderAccent: 'border-amber-500/40',
          statusText: 'Caution',
          StatusIcon: AlertTriangle,
        };
      case 'unsafe':
        return {
          badgeBg: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
          barColor: 'bg-rose-500',
          borderAccent: 'border-rose-500/50',
          statusText: 'High Risk',
          StatusIcon: AlertOctagon,
        };
    }
  };

  const { badgeBg, barColor, borderAccent, statusText, StatusIcon } = getStatusConfig();

  return (
    <div
      className={`relative flex flex-col justify-between overflow-hidden rounded-2xl bg-slate-900/90 p-4 border transition-all ${borderAccent}`}
      data-testid={`quality-metric-card-${symbol.toLowerCase()}`}
    >
      {/* Card Header: Title, Symbol, and Status Badge */}
      <div>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            {Icon && <Icon className="h-4 w-4 text-cyan-400" />}
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              {symbol}
            </span>
          </div>

          {/* Traffic-light status badge */}
          <div
            className={`flex items-center space-x-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${badgeBg}`}
          >
            <StatusIcon className="h-3 w-3" />
            <span>{statusText}</span>
          </div>
        </div>

        {/* Parameter Title */}
        <h4 className="mt-1 text-sm font-medium text-slate-200">{title}</h4>

        {/* Live Measurement Value */}
        <div className="mt-2 flex items-baseline">
          <span className="text-2xl font-bold tracking-tight text-slate-100">
            {formattedValue}
          </span>
        </div>
      </div>

      {/* Visual Status Band & Nominal Range Footer */}
      <div className="mt-3 pt-2 border-t border-slate-800/80">
        {/* Horizontal indicator bar */}
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
          <div className={`h-full w-full rounded-full ${barColor}`} />
        </div>

        <div className="mt-2 flex items-center justify-between text-[11px]">
          <span className="text-slate-400 font-mono">{nominalRange}</span>
        </div>
        <p className="mt-1 text-[11px] text-slate-400 leading-tight">{description}</p>
      </div>
    </div>
  );
}

