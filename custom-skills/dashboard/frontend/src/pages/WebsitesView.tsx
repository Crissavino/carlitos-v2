import { useState } from 'react';
import { Activity, ChevronDown, ChevronUp } from 'lucide-react';
import { useCohort } from '../contexts/CohortContext';

// Mock data for websites
const MOCK_WEBSITES = [
  {
    name: 'conversie-pdf.com',
    currency: 'EUR',
    kpis: {
      frr: { value: 42.5, status: 'green' as const },
      cpfr: { value: 78, status: 'green' as const },
      refundRate: { value: 3.8, status: 'green' as const },
      paybackM1: { value: 1.35, status: 'green' as const },
      trials: { value: 156, change: 12 },
    },
    funnel: {
      adSpend: 6991.56,
      trials: 128,
      cpt: 55,
      firstRebills: 77,
      frr: 60,
      revenueM1: 8354.42,
      refunds: 158.34,
      refundRate: 1.9,
      netM1: 8196.08,
      payback: 1.17,
    },
    customers: {
      total: 1130,
      byMonth: [
        { month: 'M1', count: 207, percent: 18.3, color: 'bg-blue-500' },
        { month: 'M2', count: 129, percent: 11.4, color: 'bg-purple-500' },
        { month: 'M3', count: 109, percent: 9.6, color: 'bg-blue-400' },
        { month: 'M4', count: 98, percent: 8.7, color: 'bg-yellow-500' },
        { month: 'M5', count: 76, percent: 6.7, color: 'bg-yellow-400' },
        { month: 'M6', count: 69, percent: 6.1, color: 'bg-red-500' },
        { month: 'M7+', count: 442, percent: 39.1, color: 'bg-green-500' },
      ],
    },
  },
  {
    name: 'convierte-pdf.com',
    currency: 'EUR',
    kpis: {
      frr: { value: 35.2, status: 'green' as const },
      cpfr: { value: 95, status: 'yellow' as const },
      refundRate: { value: 5.2, status: 'yellow' as const },
      paybackM1: { value: 1.12, status: 'yellow' as const },
      trials: { value: 89, change: -5 },
    },
    funnel: {
      adSpend: 4250.00,
      trials: 85,
      cpt: 50,
      firstRebills: 30,
      frr: 35,
      revenueM1: 4820.00,
      refunds: 245.00,
      refundRate: 5.1,
      netM1: 4575.00,
      payback: 1.08,
    },
    customers: {
      total: 620,
      byMonth: [
        { month: 'M1', count: 89, percent: 14.4, color: 'bg-blue-500' },
        { month: 'M2', count: 72, percent: 11.6, color: 'bg-purple-500' },
        { month: 'M3', count: 65, percent: 10.5, color: 'bg-blue-400' },
        { month: 'M4', count: 58, percent: 9.4, color: 'bg-yellow-500' },
        { month: 'M5', count: 52, percent: 8.4, color: 'bg-yellow-400' },
        { month: 'M6', count: 48, percent: 7.7, color: 'bg-red-500' },
        { month: 'M7+', count: 236, percent: 38.1, color: 'bg-green-500' },
      ],
    },
  },
  {
    name: 'device-finder.com',
    currency: 'USD',
    kpis: {
      frr: { value: 28.1, status: 'yellow' as const },
      cpfr: { value: 125, status: 'red' as const },
      refundRate: { value: 8.5, status: 'red' as const },
      paybackM1: { value: 0.85, status: 'red' as const },
      trials: { value: 45, change: -18 },
    },
    funnel: {
      adSpend: 3200.00,
      trials: 45,
      cpt: 71,
      firstRebills: 13,
      frr: 29,
      revenueM1: 2720.00,
      refunds: 312.00,
      refundRate: 11.5,
      netM1: 2408.00,
      payback: 0.75,
    },
    customers: {
      total: 280,
      byMonth: [
        { month: 'M1', count: 45, percent: 16.1, color: 'bg-blue-500' },
        { month: 'M2', count: 32, percent: 11.4, color: 'bg-purple-500' },
        { month: 'M3', count: 28, percent: 10.0, color: 'bg-blue-400' },
        { month: 'M4', count: 25, percent: 8.9, color: 'bg-yellow-500' },
        { month: 'M5', count: 22, percent: 7.9, color: 'bg-yellow-400' },
        { month: 'M6', count: 20, percent: 7.1, color: 'bg-red-500' },
        { month: 'M7+', count: 108, percent: 38.6, color: 'bg-green-500' },
      ],
    },
  },
];

type Status = 'green' | 'yellow' | 'red';

const statusColors: Record<Status, string> = {
  green: 'text-green-400',
  yellow: 'text-yellow-400',
  red: 'text-red-400',
};

const statusBg: Record<Status, string> = {
  green: 'bg-green-500/10 border-green-500/30',
  yellow: 'bg-yellow-500/10 border-yellow-500/30',
  red: 'bg-red-500/10 border-red-500/30',
};

function ConversionFunnel({ data, currency }: { data: typeof MOCK_WEBSITES[0]['funnel']; currency: string }) {
  const currencySymbol = currency === 'EUR' ? '€' : '$';

  const steps = [
    { label: 'Ad Spend', value: data.adSpend, display: `${currencySymbol}${data.adSpend.toLocaleString()}`, color: 'bg-red-900/60', badge: null },
    { label: 'Trials', value: data.trials, display: data.trials.toString(), color: 'bg-yellow-900/60', badge: `CPT ${currencySymbol}${data.cpt}` },
    { label: 'First Rebills', value: data.firstRebills, display: data.firstRebills.toString(), color: 'bg-amber-800/60', badge: `FRR ${data.frr}%` },
    { label: 'Revenue M1', value: data.revenueM1, display: `${currencySymbol}${data.revenueM1.toLocaleString()}`, color: 'bg-green-800/60', badge: null },
    { label: 'Refunds', value: data.refunds, display: `-${currencySymbol}${data.refunds.toLocaleString()}`, color: 'bg-red-800/60', badge: `${data.refundRate}%` },
    { label: 'Net M1', value: data.netM1, display: `${currencySymbol}${data.netM1.toLocaleString()}`, color: 'bg-green-700/60', badge: `${data.payback.toFixed(2)}x Payback` },
  ];

  return (
    <div className="bg-gray-800/50 rounded-xl border border-gray-700/50 p-4">
      <h4 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-4">
        Funnel de Conversión (7 días)
      </h4>
      <div className="space-y-2">
        {steps.map((step, index) => {
          // Calculate relative width based on value type
          let widthPercent: number;
          if (index === 0) widthPercent = 100;
          else if (index === 1) widthPercent = 85;
          else if (index === 2) widthPercent = 65;
          else if (index === 3) widthPercent = 90;
          else if (index === 4) widthPercent = 20;
          else widthPercent = 88;

          return (
            <div key={step.label} className="flex items-center gap-3">
              <div className="w-24 text-sm text-gray-500 text-right">{step.label}</div>
              <div className="flex-1 relative">
                <div
                  className={`h-8 ${step.color} rounded flex items-center justify-between px-3`}
                  style={{ width: `${widthPercent}%` }}
                >
                  <span className="text-sm font-medium text-white">{step.display}</span>
                  {step.badge && (
                    <span className="text-xs bg-gray-900/50 px-2 py-0.5 rounded text-gray-300">
                      {step.badge}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-4 pt-3 border-t border-gray-700/50 flex items-center justify-between text-sm">
        <span className="text-gray-500">
          {currencySymbol}{data.adSpend.toLocaleString()} invertidos → {currencySymbol}{data.netM1.toLocaleString()} neto
        </span>
        <span className={`text-lg font-bold ${data.payback >= 1.2 ? 'text-green-400' : data.payback >= 1.0 ? 'text-yellow-400' : 'text-red-400'}`}>
          {data.payback.toFixed(2)}x
        </span>
      </div>
    </div>
  );
}

function CustomerDistribution({ data }: { data: typeof MOCK_WEBSITES[0]['customers'] }) {
  const maxCount = Math.max(...data.byMonth.map(m => m.count));

  return (
    <div className="bg-gray-800/50 rounded-xl border border-gray-700/50 p-4">
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-sm font-medium text-gray-400 uppercase tracking-wider">
          Distribución de Clientes por Mes
        </h4>
        <span className="text-sm text-gray-500">Total Activos: {data.total.toLocaleString()}</span>
      </div>
      <div className="space-y-2">
        {data.byMonth.map((month) => (
          <div key={month.month} className="flex items-center gap-3">
            <div className="w-10 text-sm text-gray-500">{month.month}</div>
            <div className="flex-1 relative h-7">
              <div
                className={`h-full ${month.color} rounded flex items-center px-3`}
                style={{ width: `${(month.count / maxCount) * 100}%` }}
              >
                <span className="text-sm font-medium text-white">{month.count}</span>
              </div>
            </div>
            <div className="w-16 text-right">
              <span className="font-medium">{month.count}</span>
              <span className="text-xs text-gray-500 ml-1">{month.percent}%</span>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-3 pt-3 border-t border-gray-700/50">
        <p className="text-xs text-cyan-400">
          Revenue Legacy: Solo 18% en M1 - Depende de retención M2+.
        </p>
      </div>
    </div>
  );
}

export function WebsitesView() {
  const { selectedCohort } = useCohort();
  const [expandedWebsite, setExpandedWebsite] = useState<string | null>(MOCK_WEBSITES[0].name);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-2 flex items-center gap-3">
          <Activity className="w-7 h-7 text-purple-400" />
          Vista Websites
        </h1>
        <p className="text-gray-400">
          Performance de Producto/Oferta por Website - Cohorte: {selectedCohort.label}
        </p>
      </div>

      {/* Websites List with Expandable Details */}
      <div className="space-y-4">
        {MOCK_WEBSITES.map((website) => {
          const isExpanded = expandedWebsite === website.name;

          return (
            <div key={website.name} className="bg-gray-800/50 rounded-xl border border-gray-700/50 overflow-hidden">
              {/* Header Row - Always visible */}
              <button
                onClick={() => setExpandedWebsite(isExpanded ? null : website.name)}
                className="w-full p-4 flex items-center justify-between hover:bg-gray-800/30 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div>
                    <div className="font-medium text-left">{website.name}</div>
                    <div className="text-xs text-gray-500">{website.currency}</div>
                  </div>
                </div>

                {/* Quick KPIs */}
                <div className="flex items-center gap-6">
                  <div className={`text-center px-3 py-1 rounded border ${statusBg[website.kpis.paybackM1.status]}`}>
                    <span className={`font-bold ${statusColors[website.kpis.paybackM1.status]}`}>
                      {website.kpis.paybackM1.value}x
                    </span>
                    <div className="text-xs text-gray-500">Payback</div>
                  </div>
                  <div className={`text-center px-3 py-1 rounded border ${statusBg[website.kpis.frr.status]}`}>
                    <span className={`font-bold ${statusColors[website.kpis.frr.status]}`}>
                      {website.kpis.frr.value}%
                    </span>
                    <div className="text-xs text-gray-500">FRR</div>
                  </div>
                  <div className={`text-center px-3 py-1 rounded border ${statusBg[website.kpis.refundRate.status]}`}>
                    <span className={`font-bold ${statusColors[website.kpis.refundRate.status]}`}>
                      {website.kpis.refundRate.value}%
                    </span>
                    <div className="text-xs text-gray-500">Refund</div>
                  </div>
                  <div className="text-center px-3 py-1">
                    <span className="font-bold">{website.kpis.trials.value}</span>
                    <span className={`text-xs ml-1 ${website.kpis.trials.change >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {website.kpis.trials.change >= 0 ? '+' : ''}{website.kpis.trials.change}%
                    </span>
                    <div className="text-xs text-gray-500">Trials 7d</div>
                  </div>
                  {isExpanded ? (
                    <ChevronUp className="w-5 h-5 text-gray-400" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-gray-400" />
                  )}
                </div>
              </button>

              {/* Expanded Details */}
              {isExpanded && (
                <div className="p-4 pt-0 border-t border-gray-700/50">
                  <div className="grid lg:grid-cols-2 gap-4 mt-4">
                    <ConversionFunnel data={website.funnel} currency={website.currency} />
                    <CustomerDistribution data={website.customers} />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="mt-4 flex items-center gap-6 text-sm text-gray-500">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-green-500/30 border border-green-500/50"></div>
          <span>Meta cumplida</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-yellow-500/30 border border-yellow-500/50"></div>
          <span>Atención</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-red-500/30 border border-red-500/50"></div>
          <span>Crítico</span>
        </div>
      </div>
    </div>
  );
}
