import { Zap, AlertCircle, ArrowRight } from 'lucide-react';
import type { TopAction } from '../api/client';

interface Props {
  action: TopAction;
}

const priorityConfig: Record<string, { bg: string; text: string; icon: string }> = {
  critical: { bg: 'bg-red-500/20', text: 'text-red-400', icon: 'border-red-500' },
  high: { bg: 'bg-orange-500/20', text: 'text-orange-400', icon: 'border-orange-500' },
  medium: { bg: 'bg-yellow-500/20', text: 'text-yellow-400', icon: 'border-yellow-500' },
  low: { bg: 'bg-blue-500/20', text: 'text-blue-400', icon: 'border-blue-500' },
};

const areaLabels: Record<string, string> = {
  marketing: 'Marketing',
  product: 'Producto',
  operations: 'Operaciones',
  finance: 'Finanzas',
};

export function ActionCard({ action }: Props) {
  const config = priorityConfig[action.priority] || priorityConfig.medium;

  return (
    <div className={`bg-gray-900 rounded-lg p-4 border-l-4 ${config.icon}`}>
      <div className="flex items-start gap-3">
        <div className={`flex-shrink-0 w-8 h-8 rounded-full ${config.bg} flex items-center justify-center`}>
          {action.priority === 'critical' ? (
            <AlertCircle className={`w-4 h-4 ${config.text}`} />
          ) : (
            <Zap className={`w-4 h-4 ${config.text}`} />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-xs px-2 py-0.5 rounded ${config.bg} ${config.text} uppercase`}>
              {action.priority}
            </span>
            <span className="text-xs text-gray-500">
              {areaLabels[action.area] || action.area}
            </span>
          </div>
          <div className="text-white font-medium">{action.action}</div>
          <div className="text-sm text-gray-400 mt-1">{action.rationale}</div>
        </div>
        <ArrowRight className="w-5 h-5 text-gray-600 flex-shrink-0" />
      </div>
    </div>
  );
}
