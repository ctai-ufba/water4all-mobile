/** Small accessible line chart for seven-day water telemetry. */
import React from 'react';
import { HistoryTrendPoint } from '../../domain/historicalTelemetry';

export interface TrendSeries {
  name: string;
  color: string;
  points: HistoryTrendPoint[];
}

export interface TrendChartProps {
  title: string;
  unit: string;
  series: TrendSeries[];
  /** Keep zero visible for a balance chart; storage sparklines use their own local range. */
  zeroBaseline?: boolean;
}

/** Draws comparable daily series on one shared numeric scale. */
export function TrendChart({ title, unit, series, zeroBaseline = false }: TrendChartProps): React.JSX.Element {
  const first = series[0]?.points[0];
  const last = series[0]?.points.at(-1);
  if (!first || !last) {
    return <p className="text-xs text-slate-400">No historical telemetry yet.</p>;
  }

  const values = series.flatMap((item) => item.points.map((point) => point.value));
  const minimum = Math.min(...values);
  const maximum = Math.max(...values);
  const padding = (maximum - minimum || Math.max(0.1, Math.abs(maximum) * 0.05)) * 0.15;
  const low = zeroBaseline ? Math.min(0, minimum) : minimum - padding;
  const high = zeroBaseline ? Math.max(0, maximum) : maximum + padding;
  const span = high - low || 1;
  const y = (value: number): number => 82 - ((value - low) / span) * 74;
  const x = (index: number, count: number): number => 6 + (index / Math.max(1, count - 1)) * 288;

  return (
    <div>
      <svg className="h-24 w-full" viewBox="0 0 300 90" role="img" aria-label={title}>
        <desc>{series.map((item) => `${item.name}: ${item.points.map((point) =>
          `${point.label}: ${point.value.toFixed(2)} ${unit}`
        ).join(', ')}`).join('; ')}</desc>
        {low < 0 && high > 0 && (
          <line x1="6" x2="294" y1={y(0)} y2={y(0)} stroke="#475569" strokeDasharray="3 3" />
        )}
        {series.map((item) => (
          <polyline
            key={item.name}
            fill="none"
            stroke={item.color}
            strokeWidth="2.5"
            strokeLinejoin="round"
            strokeLinecap="round"
            points={item.points.map((point, index) => `${x(index, item.points.length)},${y(point.value)}`).join(' ')}
          />
        ))}
      </svg>
      <div className="flex justify-between text-[10px] text-slate-400">
        <span>{first.label}</span><span>{last.label}</span>
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-300">
        {series.map((item) => (
          <span key={item.name} className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} aria-hidden="true" />
            {item.name}: {item.points.at(-1)?.value.toFixed(2)} {unit}
          </span>
        ))}
      </div>
    </div>
  );
}
