import { useState, useEffect } from 'react';
import { Building2, RefreshCw } from 'lucide-react';
import { useCohort } from '../contexts/CohortContext';
import { api, type CompaniesViewData } from '../api/client';

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
  green: 'bg-green-500/20',
  yellow: 'bg-yellow-500/20',
  red: 'bg-red-500/20',
};

export function CompaniesView() {
  const { selectedRange, isPeriod, days } = useCohort();
  const [data, setData] = useState<CompaniesViewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      // Only fetch for period-based ranges
      if (!isPeriod) {
        setLoading(false);
        setData(null);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const range = `${days}d`;
        const result = await api.getCompaniesView(range);
        setData(result);
      } catch (err) {
        console.error('Error fetching companies data:', err);
        setError(err instanceof Error ? err.message : 'Error fetching data');
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [days, isPeriod]);

  if (!isPeriod) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold mb-2 flex items-center gap-3">
            <Building2 className="w-7 h-7 text-blue-400" />
            Vista Empresas
          </h1>
        </div>
        <div className="bg-gray-800/50 rounded-xl border border-gray-700/50 p-8 text-center">
          <p className="text-gray-400">Selecciona un rango de tiempo (7d, 14d, 30d, 60d) para ver los datos.</p>
          <p className="text-gray-500 text-sm mt-2">Los rangos de cohorte no están soportados en esta vista.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold mb-2 flex items-center gap-3">
            <Building2 className="w-7 h-7 text-blue-400" />
            Vista Empresas
          </h1>
        </div>
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="w-8 h-8 animate-spin text-blue-400" />
          <span className="ml-3 text-gray-400">Cargando datos...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold mb-2 flex items-center gap-3">
            <Building2 className="w-7 h-7 text-blue-400" />
            Vista Empresas
          </h1>
        </div>
        <div className="bg-red-500/20 border border-red-500/50 rounded-xl p-6 text-center">
          <p className="text-red-400">Error: {error}</p>
        </div>
      </div>
    );
  }

  const companies = data?.companies || [];

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-2 flex items-center gap-3">
          <Building2 className="w-7 h-7 text-blue-400" />
          Vista Empresas
        </h1>
        <p className="text-gray-400">
          Comparativa de KPIs por empresa - {selectedRange.label}
        </p>
      </div>

      {/* Companies Grid */}
      <div className="grid gap-6">
        {companies.map((company) => {
          const frrStatus = getStatus(company.kpis.frr, { green: 35, yellow: 25 });
          const refundRateStatus = getStatus(company.kpis.refundRateM1, { green: 5, yellow: 10 }, true);
          const disputeStatus = getStatus(company.kpis.disputeRate, { green: 0.5, yellow: 1 }, true);

          return (
            <div key={company.companyId} className="bg-gray-800/50 rounded-xl border border-gray-700/50 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">{company.name}</h3>
                <span className={`text-2xl font-bold ${company.kpis.profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {company.kpis.profit >= 0 ? '+' : ''}€{Math.round(company.kpis.profit).toLocaleString()}
                </span>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
                {/* Gross Revenue */}
                <div className="bg-gray-900/50 rounded-lg p-4">
                  <div className="text-xs text-gray-500 mb-1">Gross Revenue</div>
                  <div className="text-xl font-bold">€{Math.round(company.kpis.grossRevenueEur).toLocaleString()}</div>
                </div>

                {/* Refunds */}
                <div className="bg-gray-900/50 rounded-lg p-4">
                  <div className="text-xs text-gray-500 mb-1">Refunds</div>
                  <div className="text-xl font-bold text-red-400">-€{Math.round(company.kpis.refundsEur).toLocaleString()}</div>
                </div>

                {/* Ad Spend */}
                <div className="bg-gray-900/50 rounded-lg p-4">
                  <div className="text-xs text-gray-500 mb-1">Ad Spend</div>
                  <div className="text-xl font-bold text-orange-400">
                    {company.kpis.adSpendEur > 0 ? `-€${Math.round(company.kpis.adSpendEur).toLocaleString()}` : '€0'}
                  </div>
                </div>

                {/* FRR */}
                <div className={`rounded-lg p-4 ${statusBg[frrStatus]}`}>
                  <div className="text-xs text-gray-500 mb-1">FRR</div>
                  <div className={`text-xl font-bold ${statusColors[frrStatus]}`}>
                    {company.kpis.frr.toFixed(1)}%
                  </div>
                  <div className="text-xs text-gray-500">Meta: ≥35%</div>
                </div>

                {/* Refund Rate M1 */}
                <div className={`rounded-lg p-4 ${statusBg[refundRateStatus]}`}>
                  <div className="text-xs text-gray-500 mb-1">Refund Rate M1</div>
                  <div className={`text-xl font-bold ${statusColors[refundRateStatus]}`}>
                    {company.kpis.refundRateM1.toFixed(1)}%
                  </div>
                  <div className="text-xs text-gray-500">Meta: ≤5%</div>
                </div>

                {/* Dispute Rate */}
                <div className={`rounded-lg p-4 ${statusBg[disputeStatus]}`}>
                  <div className="text-xs text-gray-500 mb-1">Dispute Rate</div>
                  <div className={`text-xl font-bold ${statusColors[disputeStatus]}`}>
                    {company.kpis.disputeRate.toFixed(2)}%
                  </div>
                  <div className="text-xs text-gray-500">Meta: ≤0.5%</div>
                </div>
              </div>

              {/* Bottom row: Trials and First Rebills */}
              <div className="mt-4 pt-4 border-t border-gray-700/50 flex gap-6 text-sm text-gray-400">
                <span>Trials: <strong className="text-white">{company.kpis.trialCount.toLocaleString()}</strong></span>
                <span>First Rebills: <strong className="text-white">{company.kpis.firstRebillCount.toLocaleString()}</strong></span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
