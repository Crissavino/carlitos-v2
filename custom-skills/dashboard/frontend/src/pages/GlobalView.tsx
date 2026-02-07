import { useState } from 'react';
import { TrendingUp, TrendingDown, Minus, RefreshCw, Users, AlertTriangle, Percent, PiggyBank, Target, DollarSign, X } from 'lucide-react';
import { useCohort } from '../contexts/CohortContext';

// Placeholder data - will be replaced with real API calls
const MOCK_KPIS = {
  weeklyProfit: { value: 4250, status: 'green' as const, target: '>€0' },
  paybackM1: { value: 1.17, status: 'yellow' as const, target: '≥1.20' },
  cpt: { value: 55, status: 'yellow' as const, target: '≤€50' },
  frr: { value: 38.2, status: 'green' as const, target: '≥35%' },
  refundRateM1: { value: 4.8, status: 'green' as const, target: '≤5%' },
  disputeRate: { value: 0.42, status: 'green' as const, target: '≤1%' },
};

const MOCK_DAILY_PULSE = {
  acquisitions: { today: 45, lastWeek: 38, change: 18.4 },
  firstRebills: { today: 22, lastWeek: 25, change: -12.0 },
  refunds: { today: 3, lastWeek: 5, change: -40.0 },
  grossRevenue: { today: 2850, lastWeek: 2620, change: 8.8 },
};

// Payback M1 by Website for comparison chart
const MOCK_PAYBACK_BY_WEBSITE = [
  { website: 'ConversiePDF', payback: 0.52, status: 'red' as const },
  { website: 'DeviceFinder', payback: 0.47, status: 'red' as const },
  { website: 'ConviertePDF', payback: 0.21, status: 'red' as const },
];

type KpiStatus = 'green' | 'yellow' | 'red';

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

  // For refunds, negative change is good
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

function PaybackByWebsiteChart({ data }: { data: typeof MOCK_PAYBACK_BY_WEBSITE }) {
  const maxPayback = 0.6; // For scale reference

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
              {/* Scale markers */}
              <div className="absolute inset-0 flex justify-between pointer-events-none">
                {[0, 0.1, 0.2, 0.3, 0.4, 0.5].map((mark) => (
                  <div key={mark} className="border-l border-gray-700/50 h-full" />
                ))}
              </div>
              {/* Bar */}
              <div className="h-8 relative">
                <div
                  className={`h-full ${barColors[item.status]} rounded-r`}
                  style={{ width: `${(item.payback / maxPayback) * 100}%` }}
                />
              </div>
            </div>
          </div>
        ))}
        {/* Scale labels */}
        <div className="flex justify-between text-xs text-gray-500 ml-32">
          <span>0.0x</span>
          <span>0.1x</span>
          <span>0.2x</span>
          <span>0.3x</span>
          <span>0.4x</span>
          <span>0.5x</span>
        </div>
      </div>

      {/* Summary */}
      <div className="mt-6 pt-4 border-t border-gray-700/50 space-y-2">
        {data.map((item) => (
          <div key={item.website} className="flex items-center justify-between text-sm">
            <span className="text-gray-400">{item.website}</span>
            <div className="flex items-center gap-2">
              <span className={`font-medium ${item.status === 'red' ? 'text-red-400' : item.status === 'yellow' ? 'text-yellow-400' : 'text-green-400'}`}>
                {item.payback.toFixed(2)}x
              </span>
              <X className="w-4 h-4 text-red-400" />
              <span className="text-gray-500">Revisar</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function GlobalView() {
  const [loading] = useState(false);
  const { selectedCohort } = useCohort();

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
          Resumen agregado - Cohorte: {selectedCohort.label} ({selectedCohort.monthsAvailable}m data)
        </p>
      </div>

      {/* KPIs Section - Reorganized */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-blue-500" />
          Semáforo Principal
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <KpiCardNew
            title="Weekly Profit"
            value={`€${MOCK_KPIS.weeklyProfit.value.toLocaleString()}`}
            status={MOCK_KPIS.weeklyProfit.status}
            target={MOCK_KPIS.weeklyProfit.target}
            icon={PiggyBank}
          />
          <KpiCardNew
            title="Payback M1"
            value={`${MOCK_KPIS.paybackM1.value}x`}
            status={MOCK_KPIS.paybackM1.status}
            target={MOCK_KPIS.paybackM1.target}
            icon={Target}
          />
          <KpiCardNew
            title="Cost Per Trial"
            value={`€${MOCK_KPIS.cpt.value}`}
            status={MOCK_KPIS.cpt.status}
            target={MOCK_KPIS.cpt.target}
            icon={DollarSign}
          />
          <KpiCardNew
            title="FRR (2do Pago)"
            value={`${MOCK_KPIS.frr.value}%`}
            status={MOCK_KPIS.frr.status}
            target={MOCK_KPIS.frr.target}
            icon={Users}
          />
          <KpiCardNew
            title="Refund Rate M1"
            value={`${MOCK_KPIS.refundRateM1.value}%`}
            status={MOCK_KPIS.refundRateM1.status}
            target={MOCK_KPIS.refundRateM1.target}
            icon={Percent}
          />
          <KpiCardNew
            title="Dispute Rate"
            value={`${MOCK_KPIS.disputeRate.value}%`}
            status={MOCK_KPIS.disputeRate.status}
            target={MOCK_KPIS.disputeRate.target}
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
            today={MOCK_DAILY_PULSE.acquisitions.today}
            lastWeek={MOCK_DAILY_PULSE.acquisitions.lastWeek}
            change={MOCK_DAILY_PULSE.acquisitions.change}
          />
          <PulseCard
            title="First Rebills Hoy"
            today={MOCK_DAILY_PULSE.firstRebills.today}
            lastWeek={MOCK_DAILY_PULSE.firstRebills.lastWeek}
            change={MOCK_DAILY_PULSE.firstRebills.change}
          />
          <PulseCard
            title="Refunds Hoy"
            today={MOCK_DAILY_PULSE.refunds.today}
            lastWeek={MOCK_DAILY_PULSE.refunds.lastWeek}
            change={MOCK_DAILY_PULSE.refunds.change}
          />
          <PulseCard
            title="Gross Revenue Hoy"
            today={MOCK_DAILY_PULSE.grossRevenue.today}
            lastWeek={MOCK_DAILY_PULSE.grossRevenue.lastWeek}
            change={MOCK_DAILY_PULSE.grossRevenue.change}
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
          <PaybackByWebsiteChart data={MOCK_PAYBACK_BY_WEBSITE} />
        </div>
      </section>
    </div>
  );
}
