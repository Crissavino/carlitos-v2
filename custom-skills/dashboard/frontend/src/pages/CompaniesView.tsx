import { Building2, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { useCohort } from '../contexts/CohortContext';

type Status = 'green' | 'yellow' | 'red';

// Base mock data - values will be adjusted based on cohort
const BASE_COMPANIES = [
  {
    name: 'Avocode',
    baseKpis: {
      grossRevenue: 45000,
      refundRate: 4.2,
      disputeRate: 0.3,
      activeCustomers: 1250,
      churnRate: 3.1,
    }
  },
  {
    name: 'KiwiKode',
    baseKpis: {
      grossRevenue: 28000,
      refundRate: 6.8,
      disputeRate: 0.8,
      activeCustomers: 820,
      churnRate: 4.5,
    }
  },
  {
    name: 'Jackcode',
    baseKpis: {
      grossRevenue: 12000,
      refundRate: 3.5,
      disputeRate: 0.2,
      activeCustomers: 450,
      churnRate: 2.8,
    }
  },
];

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
  const { selectedCohort } = useCohort();

  // Generate cohort-adjusted data
  // More mature cohorts have more stable/better metrics
  const maturityFactor = selectedCohort.monthsAvailable / 6; // 0.16 to 1.0

  const companies = BASE_COMPANIES.map((company, index) => {
    // Vary data based on cohort - older cohorts show more accumulated data
    const revenueMultiplier = 0.5 + (maturityFactor * 0.5) + (index * 0.1);
    const customerMultiplier = 0.6 + (maturityFactor * 0.4);

    // Rates improve slightly with maturity (more data = more accurate)
    const rateVariation = (1 - maturityFactor) * 0.3;

    const grossRevenue = Math.round(company.baseKpis.grossRevenue * revenueMultiplier);
    const activeCustomers = Math.round(company.baseKpis.activeCustomers * customerMultiplier);
    const refundRate = +(company.baseKpis.refundRate * (1 + rateVariation)).toFixed(1);
    const disputeRate = +(company.baseKpis.disputeRate * (1 + rateVariation)).toFixed(2);
    const churnRate = +(company.baseKpis.churnRate * (1 + rateVariation * 0.5)).toFixed(1);

    // Change percentages vary by cohort
    const changeBase = (maturityFactor - 0.5) * 20;

    return {
      name: company.name,
      kpis: {
        grossRevenue: {
          value: grossRevenue,
          change: +(changeBase + (index - 1) * 8).toFixed(1)
        },
        refundRate: {
          value: refundRate,
          status: getStatus(refundRate, { green: 5, yellow: 8 }, true)
        },
        disputeRate: {
          value: disputeRate,
          status: getStatus(disputeRate, { green: 0.5, yellow: 1 }, true)
        },
        activeCustomers: {
          value: activeCustomers,
          change: +(changeBase + index * 5).toFixed(1)
        },
        churnRate: {
          value: churnRate,
          status: getStatus(churnRate, { green: 4, yellow: 6 }, true)
        },
      }
    };
  });

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-2 flex items-center gap-3">
          <Building2 className="w-7 h-7 text-blue-400" />
          Vista Empresas
        </h1>
        <p className="text-gray-400">
          Comparativa de KPIs por empresa - Cohorte: {selectedCohort.label} ({selectedCohort.monthsAvailable}m data)
        </p>
      </div>

      {/* Companies Grid */}
      <div className="grid gap-6">
        {companies.map((company) => (
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
