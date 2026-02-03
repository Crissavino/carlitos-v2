import { AlertTriangle, CheckCircle, XCircle, HelpCircle, Info } from 'lucide-react';

interface Props {
  status: string;
  size?: 'sm' | 'lg';
  paybackM1?: number; // Para determinar el subtítulo
}

const statusConfig: Record<string, { icon: typeof CheckCircle; label: string; class: string }> = {
  // Estados principales del modelo utility
  'ESTABLE': { icon: CheckCircle, label: 'Estable', class: 'border-green-500/50 bg-green-500/10 text-green-400' },
  'EN RIESGO': { icon: AlertTriangle, label: 'En Riesgo', class: 'border-yellow-500/50 bg-yellow-500/10 text-yellow-400' },
  'CRÍTICO': { icon: XCircle, label: 'Crítico', class: 'border-red-500/50 bg-red-500/10 text-red-400' },
  // Legacy mappings
  'SALUDABLE': { icon: CheckCircle, label: 'Saludable', class: 'border-green-500/50 bg-green-500/10 text-green-400' },
  'healthy': { icon: CheckCircle, label: 'Saludable', class: 'border-green-500/50 bg-green-500/10 text-green-400' },
  'ADVERTENCIA': { icon: AlertTriangle, label: 'Advertencia', class: 'border-yellow-500/50 bg-yellow-500/10 text-yellow-400' },
  'warning': { icon: AlertTriangle, label: 'Advertencia', class: 'border-yellow-500/50 bg-yellow-500/10 text-yellow-400' },
  'critical': { icon: XCircle, label: 'Crítico', class: 'border-red-500/50 bg-red-500/10 text-red-400' },
};

function getSubtitle(paybackM1?: number): string | null {
  if (paybackM1 === undefined) return null;

  if (paybackM1 < 0.90) {
    return 'Pérdida confirmada en M1';
  }
  if (paybackM1 >= 1.20) {
    return 'Modelo rentable en M1 (utility)';
  }
  if (paybackM1 >= 0.90 && paybackM1 < 1.20) {
    return 'Break-even en M1';
  }
  return null;
}

export function StatusBadge({ status, size = 'sm', paybackM1 }: Props) {
  const config = statusConfig[status] || { icon: HelpCircle, label: status, class: 'border-gray-500/50 bg-gray-500/10 text-gray-400' };
  const Icon = config.icon;
  const subtitle = getSubtitle(paybackM1);

  if (size === 'lg') {
    return (
      <div
        className={`flex items-center gap-4 px-6 py-4 rounded-xl border ${config.class} h-full`}
        title="El estado se basa en Payback M1 + Refund Rate M1. En modelo utility, Payback M1 ≥ 1.20 = ESTABLE sin importar otros KPIs."
      >
        <Icon className="w-12 h-12 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="text-sm text-gray-400 uppercase tracking-wide flex items-center gap-1">
            Estado del Negocio
            <Info className="w-3 h-3 opacity-50" />
          </div>
          <div className="text-2xl font-bold">{config.label.toUpperCase()}</div>
          {subtitle && (
            <div className="text-xs text-gray-500 mt-1">{subtitle}</div>
          )}
        </div>
      </div>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-sm border ${config.class}`}
      title="Estado basado en Payback M1 + Refund Rate M1"
    >
      <Icon className="w-4 h-4" />
      {config.label}
    </span>
  );
}
