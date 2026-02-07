import { GitBranch, TrendingDown } from 'lucide-react';
import { useCohort } from '../contexts/CohortContext';

// Mock data - in real implementation this would come from API
const MOCK_MARKETING_FUNNEL = [
  { stage: 'Impresiones', value: 850000, cr: null },
  { stage: 'Clicks', value: 28500, cr: 3.35 },
  { stage: 'Paywall Views', value: 12400, cr: 43.51 },
  { stage: 'Trials', value: 520, cr: 4.19 },
];

const MOCK_COHORT_FRR = [
  { cohort: 'Sem -8', frr: 38.2 },
  { cohort: 'Sem -7', frr: 41.5 },
  { cohort: 'Sem -6', frr: 39.8 },
  { cohort: 'Sem -5', frr: 42.1 },
  { cohort: 'Sem -4', frr: 40.3 },
  { cohort: 'Sem -3', frr: 43.2 },
  { cohort: 'Sem -2', frr: 41.8 },
  { cohort: 'Sem -1', frr: 39.5 },
];

// Full retention data (for mature cohorts)
const FULL_RETENTION_DATA = [
  { month: 'M1', customers: 520, rate: 100 },
  { month: 'M2', customers: 312, rate: 60 },
  { month: 'M3', customers: 218, rate: 42 },
  { month: 'M4', customers: 176, rate: 34 },
  { month: 'M5', customers: 151, rate: 29 },
  { month: 'M6', customers: 135, rate: 26 },
];

// LTV values by month
const LTV_BY_MONTH: Record<number, number> = {
  1: 48,
  2: 85,
  3: 112,
};

const MOCK_RISK_TRENDS = [
  { month: 'Sep', refundRate: 4.2, disputeRate: 0.3 },
  { month: 'Oct', refundRate: 4.5, disputeRate: 0.4 },
  { month: 'Nov', refundRate: 4.8, disputeRate: 0.3 },
  { month: 'Dic', refundRate: 5.2, disputeRate: 0.5 },
  { month: 'Ene', refundRate: 4.9, disputeRate: 0.4 },
  { month: 'Feb', refundRate: 4.6, disputeRate: 0.3 },
];

export function FunnelView() {
  const { selectedRange, isPeriod, monthsAvailable } = useCohort();
  const maxFunnelValue = MOCK_MARKETING_FUNNEL[0].value;
  const maxFrr = Math.max(...MOCK_COHORT_FRR.map(c => c.frr));

  // For periods, show all data; for cohorts, only show available months
  const effectiveMonths = isPeriod ? 6 : monthsAvailable;

  // Generate retention data based on available months
  const retentionData = FULL_RETENTION_DATA.map((data, index) => {
    const monthNumber = index + 1;
    const hasData = monthNumber <= effectiveMonths;
    return {
      ...data,
      customers: hasData ? data.customers : null,
      rate: hasData ? data.rate : null,
    };
  });

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-2 flex items-center gap-3">
          <GitBranch className="w-7 h-7 text-cyan-400" />
          Funnel & Cohortes
        </h1>
        <p className="text-gray-400">Diagnóstico Avanzado - Funnels, Retención y Tendencias de Riesgo</p>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Marketing Funnel */}
        <div className="bg-gray-800/50 rounded-xl border border-gray-700/50 p-6">
          <h3 className="text-lg font-semibold mb-4">Funnel Marketing / Activación</h3>
          <div className="space-y-3">
            {MOCK_MARKETING_FUNNEL.map((step) => (
              <div key={step.stage}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-400">{step.stage}</span>
                  <div className="flex items-center gap-3">
                    <span className="font-medium">{step.value.toLocaleString()}</span>
                    {step.cr && (
                      <span className="text-xs text-gray-500">CR: {step.cr}%</span>
                    )}
                  </div>
                </div>
                <div className="h-8 bg-gray-700/50 rounded overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-cyan-500/50 to-cyan-400/30 rounded transition-all"
                    style={{ width: `${(step.value / maxFunnelValue) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Cohort FRR */}
        <div className="bg-gray-800/50 rounded-xl border border-gray-700/50 p-6">
          <h3 className="text-lg font-semibold mb-4">FRR por Cohorte de Adquisición</h3>
          <div className="flex items-end gap-2 h-40">
            {MOCK_COHORT_FRR.map((cohort) => (
              <div key={cohort.cohort} className="flex-1 flex flex-col items-center gap-1">
                <div
                  className="w-full bg-green-500/30 rounded-t hover:bg-green-500/50 transition-colors"
                  style={{ height: `${(cohort.frr / maxFrr) * 100}%` }}
                />
                <span className="text-xs text-gray-500">{cohort.cohort}</span>
                <span className="text-xs font-medium text-green-400">{cohort.frr}%</span>
              </div>
            ))}
          </div>
        </div>

        {/* Retention Table */}
        <div className="bg-gray-800/50 rounded-xl border border-gray-700/50 p-6">
          <h3 className="text-lg font-semibold mb-4">
            Retención por Mes ({selectedRange.label})
          </h3>
          <div className="grid grid-cols-6 gap-2">
            {retentionData.map((month) => {
              const hasData = month.customers !== null;
              return (
                <div
                  key={month.month}
                  className={`text-center p-2 rounded ${!hasData ? 'border border-dashed border-gray-600' : ''}`}
                  style={{
                    backgroundColor: hasData
                      ? `rgba(34, 197, 94, ${(month.rate ?? 0) / 100 * 0.4})`
                      : 'rgba(55, 65, 81, 0.3)',
                  }}
                >
                  <div className="text-xs text-gray-400 mb-1">{month.month}</div>
                  <div className={`text-lg font-bold ${!hasData ? 'text-gray-600' : ''}`}>
                    {hasData ? month.customers : '—'}
                  </div>
                  <div className={`text-xs ${!hasData ? 'text-gray-600' : 'text-gray-400'}`}>
                    {hasData ? `${month.rate}%` : 'pendiente'}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-4 pt-4 border-t border-gray-700/50 grid grid-cols-3 gap-4 text-center">
            {[1, 2, 3].map((monthNum) => {
              const hasData = monthNum <= effectiveMonths;
              const ltv = LTV_BY_MONTH[monthNum];
              return (
                <div key={monthNum}>
                  <div className="text-sm text-gray-400">LTV {monthNum * 30}d</div>
                  {hasData ? (
                    <div className="text-xl font-bold text-green-400">€{ltv}</div>
                  ) : (
                    <>
                      <div className="text-xl font-bold text-gray-600">—</div>
                      <div className="text-xs text-gray-600">pendiente</div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Risk Trends */}
        <div className="bg-gray-800/50 rounded-xl border border-gray-700/50 p-6">
          <h3 className="text-lg font-semibold mb-4">Tendencias de Riesgo</h3>
          <div className="space-y-4">
            {/* Refund Rate */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-gray-400">Refund Rate</span>
                <div className="flex items-center gap-2">
                  <span className="text-yellow-400 font-medium">4.6%</span>
                  <TrendingDown className="w-4 h-4 text-green-400" />
                  <span className="text-xs text-green-400">-0.3%</span>
                </div>
              </div>
              <div className="flex items-end gap-1 h-16">
                {MOCK_RISK_TRENDS.map((month) => (
                  <div key={month.month} className="flex-1 flex flex-col items-center">
                    <div
                      className="w-full bg-yellow-500/30 rounded-t"
                      style={{ height: `${month.refundRate * 10}%` }}
                    />
                    <span className="text-xs text-gray-500 mt-1">{month.month}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Dispute Rate */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-gray-400">Dispute Rate</span>
                <div className="flex items-center gap-2">
                  <span className="text-green-400 font-medium">0.3%</span>
                  <TrendingDown className="w-4 h-4 text-green-400" />
                  <span className="text-xs text-green-400">-0.1%</span>
                </div>
              </div>
              <div className="flex items-end gap-1 h-16">
                {MOCK_RISK_TRENDS.map((month) => (
                  <div key={month.month} className="flex-1 flex flex-col items-center">
                    <div
                      className="w-full bg-green-500/30 rounded-t"
                      style={{ height: `${month.disputeRate * 100}%` }}
                    />
                    <span className="text-xs text-gray-500 mt-1">{month.month}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
