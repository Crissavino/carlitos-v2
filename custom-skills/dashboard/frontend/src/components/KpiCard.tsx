import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface Props {
  title: string;
  value: string | number;
  subtitle?: string;
  status?: string;
  trend?: 'up' | 'down' | 'neutral';
  reason?: string;
}

const statusColors: Record<string, string> = {
  excelente: 'border-l-green-500',
  bueno: 'border-l-green-400',
  aceptable: 'border-l-yellow-500',
  bajo: 'border-l-orange-500',
  crítico: 'border-l-red-500',
};

export function KpiCard({ title, value, subtitle, status, trend, reason }: Props) {
  const borderColor = status ? statusColors[status.toLowerCase()] || 'border-l-gray-500' : 'border-l-gray-700';

  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;
  const trendColor = trend === 'up' ? 'text-green-500' : trend === 'down' ? 'text-red-500' : 'text-gray-500';

  return (
    <div className={`bg-gray-900 rounded-lg border-l-4 ${borderColor} p-4`}>
      <div className="flex items-start justify-between">
        <div className="text-sm text-gray-400 uppercase tracking-wide">{title}</div>
        {trend && <TrendIcon className={`w-4 h-4 ${trendColor}`} />}
      </div>
      <div className="mt-2 text-3xl font-bold">{value}</div>
      {subtitle && <div className="text-sm text-gray-500 mt-1">{subtitle}</div>}
      {status && (
        <div className="mt-2 text-xs text-gray-400">
          Estado: <span className="capitalize">{status}</span>
        </div>
      )}
      {reason && (
        <div className="mt-1 text-xs text-gray-500">{reason}</div>
      )}
    </div>
  );
}
