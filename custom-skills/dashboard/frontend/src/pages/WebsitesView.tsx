import { useState } from 'react';
import { Activity, ChevronDown, ChevronUp } from 'lucide-react';
import { useCohort } from '../contexts/CohortContext';

// Base mock data for websites
const BASE_WEBSITES = [
  {
    name: 'conversie-pdf.com',
    currency: 'EUR',
    baseKpis: { frr: 42.5, cpfr: 78, refundRate: 3.8, paybackM1: 1.35, trials: 156 },
    baseFunnel: { adSpend: 6991.56, trials: 128, firstRebills: 77, revenueM1: 8354.42, refunds: 158.34 },
    baseCustomers: { total: 1130, m1: 207, m2: 129, m3: 109, m4: 98, m5: 76, m6: 69, m7plus: 442 },
  },
  {
    name: 'convierte-pdf.com',
    currency: 'EUR',
    baseKpis: { frr: 35.2, cpfr: 95, refundRate: 5.2, paybackM1: 1.12, trials: 89 },
    baseFunnel: { adSpend: 4250.00, trials: 85, firstRebills: 30, revenueM1: 4820.00, refunds: 245.00 },
    baseCustomers: { total: 620, m1: 89, m2: 72, m3: 65, m4: 58, m5: 52, m6: 48, m7plus: 236 },
  },
  {
    name: 'device-finder.com',
    currency: 'USD',
    baseKpis: { frr: 28.1, cpfr: 125, refundRate: 8.5, paybackM1: 0.85, trials: 45 },
    baseFunnel: { adSpend: 3200.00, trials: 45, firstRebills: 13, revenueM1: 2720.00, refunds: 312.00 },
    baseCustomers: { total: 280, m1: 45, m2: 32, m3: 28, m4: 25, m5: 22, m6: 20, m7plus: 108 },
  },
];

type Status = 'green' | 'yellow' | 'red';

function getStatus(value: number, thresholds: { green: number; yellow: number }, inverse = false): Status {
  if (inverse) {
    if (value <= thresholds.green) return 'green';
    if (value <= thresholds.yellow) return 'yellow';
    return 'red';
  }
  if (value >= thresholds.green) return 'green';
  if (value >= thresholds.yellow) return 'yellow';
  return 'red';
}

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

interface FunnelData {
  adSpend: number;
  trials: number;
  cpt: number;
  firstRebills: number;
  frr: number;
  revenueM1: number;
  refunds: number;
  refundRate: number;
  netM1: number;
  payback: number;
}

function ConversionFunnel({ data, currency }: { data: FunnelData; currency: string }) {
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

interface CustomerMonth {
  month: string;
  count: number | null;
  percent: number | null;
  color: string;
}

interface CustomerData {
  total: number;
  byMonth: CustomerMonth[];
}

function CustomerDistribution({ data, monthsAvailable }: { data: CustomerData; monthsAvailable: number }) {
  const maxCount = Math.max(...data.byMonth.filter(m => m.count !== null).map(m => m.count as number));

  return (
    <div className="bg-gray-800/50 rounded-xl border border-gray-700/50 p-4">
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-sm font-medium text-gray-400 uppercase tracking-wider">
          Distribución de Clientes por Mes
        </h4>
        <span className="text-sm text-gray-500">Total Activos: {data.total.toLocaleString()}</span>
      </div>
      <div className="space-y-2">
        {data.byMonth.map((month) => {
          const hasData = month.count !== null;
          return (
            <div key={month.month} className="flex items-center gap-3">
              <div className="w-10 text-sm text-gray-500">{month.month}</div>
              <div className="flex-1 relative h-7">
                {hasData ? (
                  <div
                    className={`h-full ${month.color} rounded flex items-center px-3`}
                    style={{ width: `${((month.count as number) / maxCount) * 100}%` }}
                  >
                    <span className="text-sm font-medium text-white">{month.count}</span>
                  </div>
                ) : (
                  <div className="h-full bg-gray-700/30 rounded border border-dashed border-gray-600 flex items-center px-3">
                    <span className="text-sm text-gray-600">—</span>
                  </div>
                )}
              </div>
              <div className="w-16 text-right">
                {hasData ? (
                  <>
                    <span className="font-medium">{month.count}</span>
                    <span className="text-xs text-gray-500 ml-1">{month.percent}%</span>
                  </>
                ) : (
                  <span className="text-xs text-gray-600">pendiente</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-3 pt-3 border-t border-gray-700/50">
        <p className="text-xs text-cyan-400">
          {monthsAvailable >= 3
            ? 'Revenue Legacy: Solo 18% en M1 - Depende de retención M2+.'
            : `Cohorte inmadura (${monthsAvailable}m) - datos parciales.`}
        </p>
      </div>
    </div>
  );
}

export function WebsitesView() {
  const { selectedRange, isPeriod, days, monthsAvailable } = useCohort();
  const [expandedWebsite, setExpandedWebsite] = useState<string | null>(BASE_WEBSITES[0].name);

  // Generate data factor based on selection
  const dataFactor = isPeriod
    ? Math.min(days / 60, 1)
    : monthsAvailable / 6;

  // Generate cohort-adjusted website data
  const websites = BASE_WEBSITES.map((site) => {
    // KPIs improve with maturity
    const frrValue = +(site.baseKpis.frr + dataFactor * 5).toFixed(1);
    const cpfrValue = Math.round(site.baseKpis.cpfr * (1.1 - dataFactor * 0.15));
    const refundValue = +(site.baseKpis.refundRate * (1.1 - dataFactor * 0.15)).toFixed(1);
    const paybackValue = +(site.baseKpis.paybackM1 + dataFactor * 0.25).toFixed(2);
    const trialsValue = Math.round(site.baseKpis.trials * (0.6 + dataFactor * 0.5));
    const trialsChange = Math.round((dataFactor - 0.5) * 30);

    // Funnel data
    const trials = Math.round(site.baseFunnel.trials * (0.6 + dataFactor * 0.5));
    const firstRebills = Math.round(site.baseFunnel.firstRebills * (0.5 + dataFactor * 0.6));
    const cpt = trials > 0 ? Math.round(site.baseFunnel.adSpend / trials) : 0;
    const frr = trials > 0 ? Math.round((firstRebills / trials) * 100) : 0;
    const revenueM1 = +(site.baseFunnel.revenueM1 * (0.6 + dataFactor * 0.5)).toFixed(2);
    const refunds = +(site.baseFunnel.refunds * (1.1 - dataFactor * 0.2)).toFixed(2);
    const refundRate = revenueM1 > 0 ? +((refunds / revenueM1) * 100).toFixed(1) : 0;
    const netM1 = +(revenueM1 - refunds).toFixed(2);
    const payback = site.baseFunnel.adSpend > 0 ? +(netM1 / site.baseFunnel.adSpend).toFixed(2) : 0;

    // Customer distribution - only show months with data based on cohort
    const monthColors = ['bg-blue-500', 'bg-purple-500', 'bg-blue-400', 'bg-yellow-500', 'bg-yellow-400', 'bg-red-500', 'bg-green-500'];
    const monthNames = ['M1', 'M2', 'M3', 'M4', 'M5', 'M6', 'M7+'];
    const baseCounts = [site.baseCustomers.m1, site.baseCustomers.m2, site.baseCustomers.m3, site.baseCustomers.m4, site.baseCustomers.m5, site.baseCustomers.m6, site.baseCustomers.m7plus];

    const customerTotal = Math.round(site.baseCustomers.total * (0.5 + dataFactor * 0.6));
    const byMonth: CustomerMonth[] = monthNames.map((name, i) => {
      const monthNum = i + 1;
      const hasData = monthNum <= monthsAvailable || (i === 6 && monthsAvailable >= 7);

      if (!hasData) {
        return { month: name, count: null, percent: null, color: monthColors[i] };
      }

      const count = Math.round(baseCounts[i] * (0.5 + dataFactor * 0.6));
      const percent = customerTotal > 0 ? +((count / customerTotal) * 100).toFixed(1) : 0;
      return { month: name, count, percent, color: monthColors[i] };
    });

    return {
      name: site.name,
      currency: site.currency,
      kpis: {
        frr: { value: frrValue, status: getStatus(frrValue, { green: 35, yellow: 25 }) },
        cpfr: { value: cpfrValue, status: getStatus(cpfrValue, { green: 90, yellow: 120 }, true) },
        refundRate: { value: refundValue, status: getStatus(refundValue, { green: 5, yellow: 8 }, true) },
        paybackM1: { value: paybackValue, status: getStatus(paybackValue, { green: 1.2, yellow: 1.0 }) },
        trials: { value: trialsValue, change: trialsChange },
      },
      funnel: {
        adSpend: site.baseFunnel.adSpend,
        trials,
        cpt,
        firstRebills,
        frr,
        revenueM1,
        refunds,
        refundRate,
        netM1,
        payback,
      },
      customers: {
        total: customerTotal,
        byMonth,
      },
    };
  });

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-2 flex items-center gap-3">
          <Activity className="w-7 h-7 text-purple-400" />
          Vista Websites
        </h1>
        <p className="text-gray-400">
          Performance de Producto/Oferta por Website - {selectedRange.label}
        </p>
      </div>

      {/* Websites List */}
      <div className="space-y-4">
        {websites.map((website) => {
          const isExpanded = expandedWebsite === website.name;

          return (
            <div key={website.name} className="bg-gray-800/50 rounded-xl border border-gray-700/50 overflow-hidden">
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

              {isExpanded && (
                <div className="p-4 pt-0 border-t border-gray-700/50">
                  <div className="grid lg:grid-cols-2 gap-4 mt-4">
                    <ConversionFunnel data={website.funnel} currency={website.currency} />
                    <CustomerDistribution data={website.customers} monthsAvailable={monthsAvailable} />
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
