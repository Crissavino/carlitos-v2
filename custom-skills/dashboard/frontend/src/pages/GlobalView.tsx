import { useState } from 'react';
import { TrendingUp, TrendingDown, Minus, RefreshCw, Users, CreditCard, AlertTriangle, Percent, PiggyBank } from 'lucide-react';

// Placeholder data - will be replaced with real API calls
const MOCK_KPIS = {
  netRoas: { value: 1.54, status: 'yellow' as const, target: '≥2.0' },
  frrGlobal: { value: 38.2, status: 'green' as const, target: '≥35%' },
  cpfrGlobal: { value: 82, status: 'green' as const, target: '≤€90' },
  refundRateM1: { value: 4.8, status: 'green' as const, target: '≤5%' },
  disputeRate: { value: 0.42, status: 'green' as const, target: '≤1%' },
  profitLoss: { value: 12450, status: 'green' as const, target: '>€0' },
};

const MOCK_DAILY_PULSE = {
  acquisitions: { today: 45, lastWeek: 38, change: 18.4 },
  firstRebills: { today: 22, lastWeek: 25, change: -12.0 },
  refunds: { today: 3, lastWeek: 5, change: -40.0 },
  grossRevenue: { today: 2850, lastWeek: 2620, change: 8.8 },
};

const MOCK_REVENUE_HISTORY = [
  { month: 'Mar', value: 42000 },
  { month: 'Abr', value: 45000 },
  { month: 'May', value: 48000 },
  { month: 'Jun', value: 52000 },
  { month: 'Jul', value: 49000 },
  { month: 'Ago', value: 55000 },
  { month: 'Sep', value: 58000 },
  { month: 'Oct', value: 62000 },
  { month: 'Nov', value: 59000 },
  { month: 'Dic', value: 68000 },
  { month: 'Ene', value: 71000 },
  { month: 'Feb', value: 65000 },
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

function RevenueChart({ data }: { data: typeof MOCK_REVENUE_HISTORY }) {
  const maxValue = Math.max(...data.map(d => d.value));

  return (
    <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700/50">
      <h3 className="text-lg font-semibold mb-4">Evolución Gross Revenue (12 Meses)</h3>
      <div className="flex items-end gap-2 h-48">
        {data.map((item) => (
          <div key={item.month} className="flex-1 flex flex-col items-center gap-2">
            <div
              className="w-full bg-blue-500/30 rounded-t hover:bg-blue-500/50 transition-colors relative group"
              style={{ height: `${(item.value / maxValue) * 100}%` }}
            >
              <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-gray-900 px-2 py-1 rounded text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">
                €{item.value.toLocaleString()}
              </div>
            </div>
            <span className="text-xs text-gray-500">{item.month}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function GlobalView() {
  const [loading] = useState(false);

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
        <p className="text-gray-400">Resumen agregado de todas las empresas, websites y países</p>
      </div>

      {/* KPIs Section */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-blue-500" />
          Semáforo Principal
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <KpiCardNew
            title="Net ROAS"
            value={`${MOCK_KPIS.netRoas.value}x`}
            status={MOCK_KPIS.netRoas.status}
            target={MOCK_KPIS.netRoas.target}
            icon={TrendingUp}
          />
          <KpiCardNew
            title="FRR Global"
            value={`${MOCK_KPIS.frrGlobal.value}%`}
            status={MOCK_KPIS.frrGlobal.status}
            target={MOCK_KPIS.frrGlobal.target}
            icon={Users}
          />
          <KpiCardNew
            title="CPFR Global"
            value={`€${MOCK_KPIS.cpfrGlobal.value}`}
            status={MOCK_KPIS.cpfrGlobal.status}
            target={MOCK_KPIS.cpfrGlobal.target}
            icon={CreditCard}
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
          <KpiCardNew
            title="Profit/Loss"
            value={`€${MOCK_KPIS.profitLoss.value.toLocaleString()}`}
            status={MOCK_KPIS.profitLoss.status}
            target={MOCK_KPIS.profitLoss.target}
            icon={PiggyBank}
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

      {/* Revenue Chart Section */}
      <section>
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-green-500" />
          Tendencia de Revenue
        </h2>
        <RevenueChart data={MOCK_REVENUE_HISTORY} />
      </section>
    </div>
  );
}
