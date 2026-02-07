import { useState } from 'react';
import { TrendingUp, TrendingDown, Minus, RefreshCw, Users, AlertTriangle, Percent, PiggyBank, Target, DollarSign, X, Check } from 'lucide-react';
import { useCohort } from '../contexts/CohortContext';

// Base KPI values - will be adjusted based on cohort
const BASE_KPIS = {
  weeklyProfit: 4250,
  paybackM1: 1.17,
  cpt: 55,
  frr: 38.2,
  refundRateM1: 4.8,
  disputeRate: 0.42,
};

const BASE_DAILY_PULSE = {
  acquisitions: { today: 45, lastWeek: 38 },
  firstRebills: { today: 22, lastWeek: 25 },
  refunds: { today: 3, lastWeek: 5 },
  grossRevenue: { today: 2850, lastWeek: 2620 },
};

const BASE_PAYBACK_BY_WEBSITE = [
  { website: 'ConversiePDF', basePayback: 0.52 },
  { website: 'DeviceFinder', basePayback: 0.47 },
  { website: 'ConviertePDF', basePayback: 0.21 },
];

type KpiStatus = 'green' | 'yellow' | 'red';

function getKpiStatus(value: number, thresholds: { green: number; yellow: number }, inverse = false): KpiStatus {
  if (inverse) {
    if (value <= thresholds.green) return 'green';
    if (value <= thresholds.yellow) return 'yellow';
    return 'red';
  }
  if (value >= thresholds.green) return 'green';
  if (value >= thresholds.yellow) return 'yellow';
  return 'red';
}

const statusColors: Record<KpiStatus, string> = {
  green: 'bg-green-500/20 border-green-500/50 text-green-400',
  yellow: 'bg-yellow-500/20 border-yellow-500/50 text-yellow-400',
  red: 'bg-red-500/20 border-red-500/50 text-red-400',
};

const statusDots: Record<KpiStatus, string> = {
  green: 'bg-green-500',
  yellow: 'bg-yellow-500',
  red: 'bg-red-500',
};

const barColors: Record<KpiStatus, string> = {
  green: 'bg-green-500',
  yellow: 'bg-yellow-500',
  red: 'bg-red-500',
};

interface KpiCardProps {
  title: string;
  value: string;
  status: KpiStatus;
  target: string;
  icon: React.ElementType;
}

function KpiCardNew({ title, value, status, target, icon: Icon }: KpiCardProps) {
  return (
    <div className={`rounded-xl border p-4 ${statusColors[status]}`}>
      <div className="flex items-center justify-between mb-2">
        <Icon className="w-5 h-5 opacity-70" />
        <div className={`w-3 h-3 rounded-full ${statusDots[status]}`} />
      </div>
      <div className="text-2xl font-bold mb-1">{value}</div>
      <div className="text-sm opacity-70">{title}</div>
      <div className="text-xs opacity-50 mt-1">Meta: {target}</div>
    </div>
  );
}

interface PulseCardProps {
  title: string;
  today: number;
  lastWeek: number;
  change: number;
  format?: 'number' | 'currency';
}

function PulseCard({ title, today, lastWeek, change, format = 'number' }: PulseCardProps) {
  const isPositive = change > 0;
  const isNeutral = change === 0;
  const TrendIcon = isNeutral ? Minus : isPositive ? TrendingUp : TrendingDown;

  const isRefunds = title.toLowerCase().includes('refund');
  const colorClass = isNeutral
    ? 'text-gray-400'
    : (isRefunds ? !isPositive : isPositive)
      ? 'text-green-400'
      : 'text-red-400';

  const formatValue = (val: number) => {
    if (format === 'currency') return `€${val.toLocaleString()}`;
    return val.toLocaleString();
  };

  return (
    <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700/50">
      <div className="text-sm text-gray-400 mb-2">{title}</div>
      <div className="flex items-end justify-between">
        <div>
          <div className="text-2xl font-bold">{formatValue(today)}</div>
          <div className="text-xs text-gray-500">vs {formatValue(lastWeek)} sem. pasada</div>
        </div>
        <div className={`flex items-center gap-1 ${colorClass}`}>
          <TrendIcon className="w-4 h-4" />
          <span className="font-medium">{Math.abs(change).toFixed(1)}%</span>
        </div>
      </div>
    </div>
  );
}

interface PaybackWebsite {
  website: string;
  payback: number;
  status: KpiStatus;
}

function PaybackByWebsiteChart({ data }: { data: PaybackWebsite[] }) {
  const maxPayback = Math.max(1.5, ...data.map(d => d.payback));
  const scaleMarks = [0, 0.3, 0.6, 0.9, 1.2, maxPayback > 1.5 ? 1.5 : 1.2];

  return (
    <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700/50">
      <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-4">
        Payback M1 por Website
      </h3>
      <div className="space-y-4">
        {data.map((item) => (
          <div key={item.website} className="flex items-center gap-4">
            <div className="w-28 text-sm text-gray-400 truncate">{item.website}</div>
            <div className="flex-1 relative">
              <div className="absolute inset-0 flex justify-between pointer-events-none">
                {scaleMarks.map((mark) => (
                  <div key={mark} className="border-l border-gray-700/50 h-full" />
                ))}
              </div>
              <div className="h-8 relative">
                <div
                  className={`h-full ${barColors[item.status]} rounded-r`}
                  style={{ width: `${Math.min((item.payback / maxPayback) * 100, 100)}%` }}
                />
              </div>
            </div>
          </div>
        ))}
        <div className="flex justify-between text-xs text-gray-500 ml-32">
          {scaleMarks.map((mark) => (
            <span key={mark}>{mark.toFixed(1)}x</span>
          ))}
        </div>
      </div>

      <div className="mt-6 pt-4 border-t border-gray-700/50 space-y-2">
        {data.map((item) => (
          <div key={item.website} className="flex items-center justify-between text-sm">
            <span className="text-gray-400">{item.website}</span>
            <div className="flex items-center gap-2">
              <span className={`font-medium ${item.status === 'red' ? 'text-red-400' : item.status === 'yellow' ? 'text-yellow-400' : 'text-green-400'}`}>
                {item.payback.toFixed(2)}x
              </span>
              {item.status === 'green' ? (
                <>
                  <Check className="w-4 h-4 text-green-400" />
                  <span className="text-gray-500">OK</span>
                </>
              ) : (
                <>
                  <X className="w-4 h-4 text-red-400" />
                  <span className="text-gray-500">Revisar</span>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function GlobalView() {
  const [loading] = useState(false);
  const { selectedRange, isPeriod, isCohort, days, monthsAvailable } = useCohort();

  // Generate data factor based on selection
  // For periods: more days = more data = better metrics
  // For cohorts: more months = more mature = better metrics
  const dataFactor = isPeriod
    ? Math.min(days / 60, 1) // 7d = 0.12, 60d = 1.0
    : monthsAvailable / 6;   // 0m = 0, 6m = 1.0

  // KPIs scale with data factor
  const kpis = {
    weeklyProfit: {
      value: Math.round(BASE_KPIS.weeklyProfit * (0.5 + dataFactor * 0.8)),
      status: getKpiStatus(BASE_KPIS.weeklyProfit * (0.5 + dataFactor * 0.8), { green: 0, yellow: -1000 }),
      target: '>€0',
    },
    paybackM1: {
      value: +(BASE_KPIS.paybackM1 + dataFactor * 0.3).toFixed(2),
      status: getKpiStatus(BASE_KPIS.paybackM1 + dataFactor * 0.3, { green: 1.2, yellow: 1.0 }),
      target: '≥1.20',
    },
    cpt: {
      value: Math.round(BASE_KPIS.cpt * (1.2 - dataFactor * 0.3)),
      status: getKpiStatus(BASE_KPIS.cpt * (1.2 - dataFactor * 0.3), { green: 50, yellow: 70 }, true),
      target: '≤€50',
    },
    frr: {
      value: +(BASE_KPIS.frr + dataFactor * 8).toFixed(1),
      status: getKpiStatus(BASE_KPIS.frr + dataFactor * 8, { green: 35, yellow: 25 }),
      target: '≥35%',
    },
    refundRateM1: {
      value: +(BASE_KPIS.refundRateM1 * (1.1 - dataFactor * 0.2)).toFixed(1),
      status: getKpiStatus(BASE_KPIS.refundRateM1 * (1.1 - dataFactor * 0.2), { green: 5, yellow: 8 }, true),
      target: '≤5%',
    },
    disputeRate: {
      value: +(BASE_KPIS.disputeRate * (1.1 - dataFactor * 0.15)).toFixed(2),
      status: getKpiStatus(BASE_KPIS.disputeRate * (1.1 - dataFactor * 0.15), { green: 0.5, yellow: 1 }, true),
      target: '≤1%',
    },
  };

  // Daily pulse scales with data
  const dailyPulse = {
    acquisitions: {
      today: Math.round(BASE_DAILY_PULSE.acquisitions.today * (0.8 + dataFactor * 0.4)),
      lastWeek: Math.round(BASE_DAILY_PULSE.acquisitions.lastWeek * (0.8 + dataFactor * 0.4)),
      change: +((dataFactor - 0.5) * 30).toFixed(1),
    },
    firstRebills: {
      today: Math.round(BASE_DAILY_PULSE.firstRebills.today * (0.6 + dataFactor * 0.6)),
      lastWeek: Math.round(BASE_DAILY_PULSE.firstRebills.lastWeek * (0.6 + dataFactor * 0.6)),
      change: +((dataFactor - 0.4) * 25).toFixed(1),
    },
    refunds: {
      today: Math.round(BASE_DAILY_PULSE.refunds.today * (1.2 - dataFactor * 0.3)),
      lastWeek: Math.round(BASE_DAILY_PULSE.refunds.lastWeek * (1.2 - dataFactor * 0.3)),
      change: +((0.5 - dataFactor) * 40).toFixed(1),
    },
    grossRevenue: {
      today: Math.round(BASE_DAILY_PULSE.grossRevenue.today * (0.6 + dataFactor * 0.6)),
      lastWeek: Math.round(BASE_DAILY_PULSE.grossRevenue.lastWeek * (0.6 + dataFactor * 0.6)),
      change: +((dataFactor - 0.3) * 20).toFixed(1),
    },
  };

  // Payback by website scales with data factor
  const paybackByWebsite: PaybackWebsite[] = BASE_PAYBACK_BY_WEBSITE.map((site) => {
    const payback = +(site.basePayback + dataFactor * 0.8).toFixed(2);
    return {
      website: site.website,
      payback,
      status: getKpiStatus(payback, { green: 1.2, yellow: 1.0 }),
    };
  });

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <RefreshCw className="w-8 h-8 animate-spin text-gray-500" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-2">Vista Global</h1>
        <p className="text-gray-400">
          Resumen agregado - {selectedRange.label}
        </p>
      </div>

      {/* Current cohort warning */}
      {isCohort && monthsAvailable === 0 && (
        <div className="mb-6 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-xl">
          <p className="text-yellow-400 text-sm">
            <strong>Cohorte actual (en curso):</strong> Los datos de {selectedRange.label} aún no están completos.
            Las métricas mostradas son proyecciones parciales del mes en curso.
          </p>
        </div>
      )}

      {/* KPIs Section */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-blue-500" />
          Semáforo Principal
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <KpiCardNew
            title="Weekly Profit"
            value={`€${kpis.weeklyProfit.value.toLocaleString()}`}
            status={kpis.weeklyProfit.status}
            target={kpis.weeklyProfit.target}
            icon={PiggyBank}
          />
          <KpiCardNew
            title="Payback M1"
            value={`${kpis.paybackM1.value}x`}
            status={kpis.paybackM1.status}
            target={kpis.paybackM1.target}
            icon={Target}
          />
          <KpiCardNew
            title="Cost Per Trial"
            value={`€${kpis.cpt.value}`}
            status={kpis.cpt.status}
            target={kpis.cpt.target}
            icon={DollarSign}
          />
          <KpiCardNew
            title="FRR (2do Pago)"
            value={`${kpis.frr.value}%`}
            status={kpis.frr.status}
            target={kpis.frr.target}
            icon={Users}
          />
          <KpiCardNew
            title="Refund Rate M1"
            value={`${kpis.refundRateM1.value}%`}
            status={kpis.refundRateM1.status}
            target={kpis.refundRateM1.target}
            icon={Percent}
          />
          <KpiCardNew
            title="Dispute Rate"
            value={`${kpis.disputeRate.value}%`}
            status={kpis.disputeRate.status}
            target={kpis.disputeRate.target}
            icon={AlertTriangle}
          />
        </div>
      </section>

      {/* Daily Pulse Section */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-purple-500" />
          Pulso Diario
          <span className="text-sm font-normal text-gray-400 ml-2">vs mismo día semana pasada</span>
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <PulseCard
            title="Adquisiciones Hoy"
            today={dailyPulse.acquisitions.today}
            lastWeek={dailyPulse.acquisitions.lastWeek}
            change={dailyPulse.acquisitions.change}
          />
          <PulseCard
            title="First Rebills Hoy"
            today={dailyPulse.firstRebills.today}
            lastWeek={dailyPulse.firstRebills.lastWeek}
            change={dailyPulse.firstRebills.change}
          />
          <PulseCard
            title="Refunds Hoy"
            today={dailyPulse.refunds.today}
            lastWeek={dailyPulse.refunds.lastWeek}
            change={dailyPulse.refunds.change}
          />
          <PulseCard
            title="Gross Revenue Hoy"
            today={dailyPulse.grossRevenue.today}
            lastWeek={dailyPulse.grossRevenue.lastWeek}
            change={dailyPulse.grossRevenue.change}
            format="currency"
          />
        </div>
      </section>

      {/* Executive Charts Section */}
      <section>
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-green-500" />
          Gráficos Ejecutivos
        </h2>
        <div className="grid lg:grid-cols-1 gap-6">
          <PaybackByWebsiteChart data={paybackByWebsite} />
        </div>
      </section>
    </div>
  );
}
