import { useState } from 'react';
import { TrendingUp, TrendingDown, Minus, Info, HelpCircle } from 'lucide-react';

interface Props {
  title: string;
  value: string | number;
  subtitle?: string;
  status?: string;
  trend?: 'up' | 'down' | 'neutral';
  reason?: string;
  badge?: string;  // Optional badge (e.g., "DECISOR", "WARNING", "HEADLINE")
  isInformative?: boolean;  // If true, shows gray style without semaphore
  size?: 'normal' | 'large';  // Size variant for headline KPIs
  tooltip?: string;  // Explanation shown on hover
}

const statusColors: Record<string, string> = {
  // Semáforo directo (from API)
  green: 'border-l-green-500',
  yellow: 'border-l-yellow-500',
  red: 'border-l-red-500',
  // Legacy labels
  excelente: 'border-l-green-500',
  bueno: 'border-l-green-400',
  aceptable: 'border-l-yellow-500',
  bajo: 'border-l-orange-500',
  crítico: 'border-l-red-500',
};

const badgeStyles: Record<string, string> = {
  DECISOR: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  WARNING: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  HEADLINE: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  INFO: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
};

export function KpiCard({ title, value, subtitle, status, trend, reason, badge, isInformative, size = 'normal', tooltip }: Props) {
  const [showTooltip, setShowTooltip] = useState(false);

  // Informative KPIs use gray border, others use semaphore colors
  const borderColor = isInformative
    ? 'border-l-gray-600'
    : (status ? statusColors[status.toLowerCase()] || 'border-l-gray-500' : 'border-l-gray-700');

  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;
  const trendColor = trend === 'up' ? 'text-green-500' : trend === 'down' ? 'text-red-500' : 'text-gray-500';

  // Size variants
  const isLarge = size === 'large';
  const containerClass = isLarge
    ? `bg-gray-900 rounded-xl border-l-4 ${borderColor} p-6 relative`
    : `bg-gray-900 rounded-xl border-l-4 ${borderColor} p-4 relative`;
  const valueClass = isLarge ? 'mt-2 text-5xl font-bold' : 'mt-2 text-3xl font-bold';
  const titleClass = isLarge ? 'text-base text-gray-400 uppercase tracking-wide' : 'text-sm text-gray-400 uppercase tracking-wide';

  return (
    <div className={containerClass}>
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <span className={titleClass}>{title}</span>
          {tooltip && (
            <div className="relative">
              <HelpCircle
                className="w-4 h-4 text-gray-500 cursor-help hover:text-gray-400"
                onMouseEnter={() => setShowTooltip(true)}
                onMouseLeave={() => setShowTooltip(false)}
              />
              {showTooltip && (
                <div className="absolute z-50 left-0 top-6 w-64 p-3 bg-gray-800 border border-gray-700 rounded-lg shadow-xl text-xs text-gray-300 leading-relaxed">
                  {tooltip}
                </div>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          {isInformative && (
            <span title="Informativo - no genera alertas">
              <Info className="w-4 h-4 text-gray-500" />
            </span>
          )}
          {badge && (
            <span className={`text-[10px] px-2 py-0.5 rounded border ${badgeStyles[badge] || 'bg-gray-500/20 text-gray-400 border-gray-500/30'}`}>
              {badge}
            </span>
          )}
          {trend && <TrendIcon className={`w-4 h-4 ${trendColor}`} />}
        </div>
      </div>
      <div className={valueClass}>{value}</div>
      {subtitle && <div className={`text-sm ${isInformative ? 'text-gray-600' : 'text-gray-500'} mt-1`}>{subtitle}</div>}
      {reason && (
        <div className={`mt-2 text-xs ${isInformative ? 'text-gray-600' : 'text-gray-500'}`}>{reason}</div>
      )}
    </div>
  );
}
