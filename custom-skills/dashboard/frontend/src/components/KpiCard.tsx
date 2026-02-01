import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface Props {
  title: string;
  value: string | number;
  subtitle?: string;
  status?: string;
  trend?: 'up' | 'down' | 'neutral';
  reason?: string;
  badge?: string;  // Optional badge (e.g., "DECISOR", "WARNING")
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
};

export function KpiCard({ title, value, subtitle, status, trend, reason, badge }: Props) {
  const borderColor = status ? statusColors[status.toLowerCase()] || 'border-l-gray-500' : 'border-l-gray-700';

  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;
  const trendColor = trend === 'up' ? 'text-green-500' : trend === 'down' ? 'text-red-500' : 'text-gray-500';

  return (
    <div className={`bg-gray-900 rounded-xl border-l-4 ${borderColor} p-4`}>
      <div className="flex items-start justify-between">
        <div className="text-sm text-gray-400 uppercase tracking-wide">{title}</div>
        <div className="flex items-center gap-2">
          {badge && (
            <span className={`text-[10px] px-2 py-0.5 rounded border ${badgeStyles[badge] || 'bg-gray-500/20 text-gray-400 border-gray-500/30'}`}>
              {badge}
            </span>
          )}
          {trend && <TrendIcon className={`w-4 h-4 ${trendColor}`} />}
        </div>
      </div>
      <div className="mt-2 text-3xl font-bold">{value}</div>
      {subtitle && <div className="text-sm text-gray-500 mt-1">{subtitle}</div>}
      {reason && (
        <div className="mt-2 text-xs text-gray-500">{reason}</div>
      )}
    </div>
  );
}
