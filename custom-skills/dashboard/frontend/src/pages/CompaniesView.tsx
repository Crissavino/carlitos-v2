import { Building2, TrendingUp, TrendingDown, Minus } from 'lucide-react';

// Mock data for companies
const MOCK_COMPANIES = [
  {
    name: 'Avocode',
    kpis: {
      grossRevenue: { value: 45000, change: 12.5 },
      refundRate: { value: 4.2, status: 'green' as const },
      disputeRate: { value: 0.3, status: 'green' as const },
      activeCustomers: { value: 1250, change: 8.2 },
      churnRate: { value: 3.1, status: 'green' as const },
    }
  },
  {
    name: 'KiwiKode',
    kpis: {
      grossRevenue: { value: 28000, change: -5.3 },
      refundRate: { value: 6.8, status: 'yellow' as const },
      disputeRate: { value: 0.8, status: 'yellow' as const },
      activeCustomers: { value: 820, change: -2.1 },
      churnRate: { value: 4.5, status: 'yellow' as const },
    }
  },
  {
    name: 'Jackcode',
    kpis: {
      grossRevenue: { value: 12000, change: 22.1 },
      refundRate: { value: 3.5, status: 'green' as const },
      disputeRate: { value: 0.2, status: 'green' as const },
      activeCustomers: { value: 450, change: 15.3 },
      churnRate: { value: 2.8, status: 'green' as const },
    }
  },
];

type Status = 'green' | 'yellow' | 'red';

const statusColors: Record<Status, string> = {
  green: 'text-green-400',
  yellow: 'text-yellow-400',
  red: 'text-red-400',
};

const statusBg: Record<Status, string> = {
  green: 'bg-green-500/20',
  yellow: 'bg-yellow-500/20',
  red: 'bg-red-500/20',
};

function ChangeIndicator({ value }: { value: number }) {
  const isPositive = value > 0;
  const isNeutral = value === 0;
  const Icon = isNeutral ? Minus : isPositive ? TrendingUp : TrendingDown;
  const color = isNeutral ? 'text-gray-400' : isPositive ? 'text-green-400' : 'text-red-400';

  return (
    <span className={`flex items-center gap-1 text-xs ${color}`}>
      <Icon className="w-3 h-3" />
      {Math.abs(value).toFixed(1)}%
    </span>
  );
}

export function CompaniesView() {
  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-2 flex items-center gap-3">
          <Building2 className="w-7 h-7 text-blue-400" />
          Vista Empresas
        </h1>
        <p className="text-gray-400">Comparativa de KPIs por empresa - Riesgo Financiero/Operativo</p>
      </div>

      {/* Companies Grid */}
      <div className="grid gap-6">
        {MOCK_COMPANIES.map((company) => (
          <div key={company.name} className="bg-gray-800/50 rounded-xl border border-gray-700/50 p-6">
            <h3 className="text-lg font-semibold mb-4">{company.name}</h3>

            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {/* Gross Revenue */}
              <div className="bg-gray-900/50 rounded-lg p-4">
                <div className="text-xs text-gray-500 mb-1">Gross Revenue</div>
                <div className="text-xl font-bold">€{company.kpis.grossRevenue.value.toLocaleString()}</div>
                <ChangeIndicator value={company.kpis.grossRevenue.change} />
              </div>

              {/* Refund Rate */}
              <div className={`rounded-lg p-4 ${statusBg[company.kpis.refundRate.status]}`}>
                <div className="text-xs text-gray-500 mb-1">Refund Rate</div>
                <div className={`text-xl font-bold ${statusColors[company.kpis.refundRate.status]}`}>
                  {company.kpis.refundRate.value}%
                </div>
                <div className="text-xs text-gray-500">Meta: ≤5%</div>
              </div>

              {/* Dispute Rate */}
              <div className={`rounded-lg p-4 ${statusBg[company.kpis.disputeRate.status]}`}>
                <div className="text-xs text-gray-500 mb-1">Dispute Rate</div>
                <div className={`text-xl font-bold ${statusColors[company.kpis.disputeRate.status]}`}>
                  {company.kpis.disputeRate.value}%
                </div>
                <div className="text-xs text-gray-500">Meta: ≤1%</div>
              </div>

              {/* Active Customers */}
              <div className="bg-gray-900/50 rounded-lg p-4">
                <div className="text-xs text-gray-500 mb-1">Clientes Activos</div>
                <div className="text-xl font-bold">{company.kpis.activeCustomers.value.toLocaleString()}</div>
                <ChangeIndicator value={company.kpis.activeCustomers.change} />
              </div>

              {/* Churn Rate */}
              <div className={`rounded-lg p-4 ${statusBg[company.kpis.churnRate.status]}`}>
                <div className="text-xs text-gray-500 mb-1">Churn Rate</div>
                <div className={`text-xl font-bold ${statusColors[company.kpis.churnRate.status]}`}>
                  {company.kpis.churnRate.value}%
                </div>
                <div className="text-xs text-gray-500">Meta: ≤4%</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
