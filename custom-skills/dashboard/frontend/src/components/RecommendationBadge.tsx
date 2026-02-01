import { TrendingUp, Minus, TrendingDown, RefreshCw, Eye, HelpCircle } from 'lucide-react';
import type { BusinessRecommendation } from '../api/client';

interface RecommendationBadgeProps {
  recommendation: BusinessRecommendation;
  confidence?: 'high' | 'medium' | 'low';
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}

const config: Record<BusinessRecommendation, {
  label: string;
  icon: typeof TrendingUp;
  bgClass: string;
  textClass: string;
  borderClass: string;
}> = {
  SCALE_FOCUS: {
    label: 'Scale',
    icon: TrendingUp,
    bgClass: 'bg-green-500/10',
    textClass: 'text-green-400',
    borderClass: 'border-green-500/30',
  },
  MAINTAIN: {
    label: 'Maintain',
    icon: Minus,
    bgClass: 'bg-yellow-500/10',
    textClass: 'text-yellow-400',
    borderClass: 'border-yellow-500/30',
  },
  REDUCE_EXPOSURE: {
    label: 'Reduce',
    icon: TrendingDown,
    bgClass: 'bg-red-500/10',
    textClass: 'text-red-400',
    borderClass: 'border-red-500/30',
  },
  REBALANCE: {
    label: 'Rebalance',
    icon: RefreshCw,
    bgClass: 'bg-blue-500/10',
    textClass: 'text-blue-400',
    borderClass: 'border-blue-500/30',
  },
  MONITOR: {
    label: 'Monitor',
    icon: Eye,
    bgClass: 'bg-gray-500/10',
    textClass: 'text-gray-400',
    borderClass: 'border-gray-500/30',
  },
  INSUFFICIENT_DATA: {
    label: 'No Data',
    icon: HelpCircle,
    bgClass: 'bg-gray-500/10',
    textClass: 'text-gray-500',
    borderClass: 'border-gray-500/30',
  },
};

const sizeClasses = {
  sm: 'text-xs px-2 py-0.5',
  md: 'text-sm px-2.5 py-1',
  lg: 'text-base px-3 py-1.5',
};

const iconSizes = {
  sm: 'w-3 h-3',
  md: 'w-4 h-4',
  lg: 'w-5 h-5',
};

export function RecommendationBadge({
  recommendation,
  confidence,
  size = 'md',
  showLabel = true,
}: RecommendationBadgeProps) {
  const cfg = config[recommendation] || config.MONITOR;
  const Icon = cfg.icon;

  return (
    <div
      className={`inline-flex items-center gap-1.5 rounded-full border font-medium ${cfg.bgClass} ${cfg.textClass} ${cfg.borderClass} ${sizeClasses[size]}`}
      title={confidence ? `Confidence: ${confidence}` : undefined}
    >
      <Icon className={iconSizes[size]} />
      {showLabel && <span>{cfg.label}</span>}
      {confidence && confidence !== 'high' && (
        <span className="opacity-60 text-xs">({confidence})</span>
      )}
    </div>
  );
}
