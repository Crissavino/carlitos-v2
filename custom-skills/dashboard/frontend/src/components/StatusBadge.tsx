import { AlertTriangle, CheckCircle, XCircle, HelpCircle } from 'lucide-react';

interface Props {
  status: string;
  size?: 'sm' | 'lg';
}

const statusConfig: Record<string, { icon: typeof CheckCircle; label: string; class: string }> = {
  'SALUDABLE': { icon: CheckCircle, label: 'Saludable', class: 'status-healthy bg-status-healthy' },
  'healthy': { icon: CheckCircle, label: 'Saludable', class: 'status-healthy bg-status-healthy' },
  'ADVERTENCIA': { icon: AlertTriangle, label: 'Advertencia', class: 'status-warning bg-status-warning' },
  'warning': { icon: AlertTriangle, label: 'Advertencia', class: 'status-warning bg-status-warning' },
  'EN RIESGO': { icon: XCircle, label: 'En Riesgo', class: 'status-critical bg-status-critical' },
  'critical': { icon: XCircle, label: 'Crítico', class: 'status-critical bg-status-critical' },
};

export function StatusBadge({ status, size = 'sm' }: Props) {
  const config = statusConfig[status] || { icon: HelpCircle, label: status, class: 'status-unknown bg-status-unknown' };
  const Icon = config.icon;

  if (size === 'lg') {
    return (
      <div className={`flex items-center gap-4 px-6 py-4 rounded-xl border ${config.class}`}>
        <Icon className="w-12 h-12" />
        <div>
          <div className="text-sm text-gray-400 uppercase tracking-wide">Estado del Negocio</div>
          <div className="text-3xl font-bold">{config.label}</div>
        </div>
      </div>
    );
  }

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-sm border ${config.class}`}>
      <Icon className="w-4 h-4" />
      {config.label}
    </span>
  );
}
