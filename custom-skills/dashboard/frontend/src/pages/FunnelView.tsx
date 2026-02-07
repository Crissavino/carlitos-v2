import { useState, useEffect } from 'react';
import { GitBranch, TrendingDown, TrendingUp, Loader2, AlertCircle, Globe } from 'lucide-react';
import { useCohort } from '../contexts/CohortContext';
import { api, type FunnelViewData } from '../api/client';

// Website options
const WEBSITES = [
  { id: undefined, name: 'Todos los Websites' },
  { id: 1, name: 'conversie-pdf.com' },
  { id: 3, name: 'convierte-pdf.com' },
  { id: 4, name: 'device-finder.com' },
];

export function FunnelView() {
  const { selectedRange, days, isPeriod } = useCohort();
  const [data, setData] = useState<FunnelViewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [websiteFilter, setWebsiteFilter] = useState<number | undefined>(undefined);

  useEffect(() => {
    async function fetchData() {
      if (!isPeriod) {
        setLoading(false);
        setData(null);
        return;
      }

      setLoading(true);
      setError(null);
      try {
        const range = `${days}d`;
        const result = await api.getFunnelView(range, websiteFilter);
        setData(result);
      } catch (err) {
        console.error('Error fetching funnel data:', err);
        setError(err instanceof Error ? err.message : 'Error fetching data');
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [days, isPeriod, websiteFilter]);

  if (!isPeriod) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold mb-2 flex items-center gap-3">
            <GitBranch className="w-7 h-7 text-cyan-400" />
            Funnel & Cohortes
          </h1>
        </div>
        <div className="bg-gray-800/50 rounded-xl border border-gray-700/50 p-8 text-center">
          <p className="text-gray-400">Selecciona un rango de tiempo (7d, 14d, 30d, 60d) para ver los datos.</p>
          <p className="text-gray-500 text-sm mt-2">Las cohortes mensuales no estan soportadas en esta vista.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-400" />
          <span className="text-red-400">{error}</span>
        </div>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  const { marketingFunnel, cohortFrr, retention, riskTrends, ltv, adSpendEur } = data;

  const maxFunnelValue = marketingFunnel.length > 0 ? marketingFunnel[0].value : 1;

  // Get latest risk values for trend indicators
  const latestRisk = riskTrends.length > 0 ? riskTrends[riskTrends.length - 1] : null;
  const prevRisk = riskTrends.length > 1 ? riskTrends[riskTrends.length - 2] : null;
  const refundTrend = latestRisk && prevRisk ? latestRisk.refundRate - prevRisk.refundRate : 0;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold mb-2 flex items-center gap-3">
              <GitBranch className="w-7 h-7 text-cyan-400" />
              Funnel & Cohortes
            </h1>
            <p className="text-gray-400">Diagnostico Avanzado - {selectedRange.label}</p>
          </div>

          {/* Website Filter */}
          <div className="relative">
            <select
              value={websiteFilter || ''}
              onChange={(e) => setWebsiteFilter(e.target.value ? parseInt(e.target.value) : undefined)}
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm appearance-none pr-8 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {WEBSITES.map(w => (
                <option key={w.id || 'all'} value={w.id || ''}>
                  {w.name}
                </option>
              ))}
            </select>
            <Globe className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-gray-800/50 rounded-lg p-3 border border-gray-700/50">
          <div className="text-xs text-gray-500 mb-1">Ad Spend</div>
          <div className="text-xl font-bold">€{adSpendEur.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
        </div>
        <div className="bg-gray-800/50 rounded-lg p-3 border border-gray-700/50">
          <div className="text-xs text-gray-500 mb-1">Trials</div>
          <div className="text-xl font-bold">{marketingFunnel.find(s => s.stage === 'Trials')?.value.toLocaleString() || 0}</div>
        </div>
        <div className="bg-gray-800/50 rounded-lg p-3 border border-gray-700/50">
          <div className="text-xs text-gray-500 mb-1">First Rebills</div>
          <div className="text-xl font-bold">{marketingFunnel.find(s => s.stage === 'First Rebills')?.value.toLocaleString() || 0}</div>
        </div>
        <div className="bg-gray-800/50 rounded-lg p-3 border border-gray-700/50">
          <div className="text-xs text-gray-500 mb-1">FRR</div>
          <div className={`text-xl font-bold ${(marketingFunnel.find(s => s.stage === 'First Rebills')?.cr || 0) >= 35 ? 'text-green-400' : (marketingFunnel.find(s => s.stage === 'First Rebills')?.cr || 0) >= 25 ? 'text-yellow-400' : 'text-red-400'}`}>
            {marketingFunnel.find(s => s.stage === 'First Rebills')?.cr?.toFixed(1) || 0}%
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Marketing Funnel */}
        <div className="bg-gray-800/50 rounded-xl border border-gray-700/50 p-6">
          <h3 className="text-lg font-semibold mb-4">Funnel Marketing / Activacion</h3>
          <div className="space-y-3">
            {marketingFunnel.map((step) => (
              <div key={step.stage}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-400">{step.stage}</span>
                  <div className="flex items-center gap-3">
                    <span className="font-medium">{step.value.toLocaleString()}</span>
                    {step.cr !== null && (
                      <span className="text-xs text-gray-500">CR: {step.cr.toFixed(2)}%</span>
                    )}
                  </div>
                </div>
                <div className="h-8 bg-gray-700/50 rounded overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-cyan-500/50 to-cyan-400/30 rounded transition-all"
                    style={{ width: `${Math.max((step.value / maxFunnelValue) * 100, 1)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Cohort FRR */}
        <div className="bg-gray-800/50 rounded-xl border border-gray-700/50 p-6">
          <h3 className="text-lg font-semibold mb-4">FRR por Cohorte Semanal</h3>
          {cohortFrr.length === 0 ? (
            <div className="flex items-center justify-center h-40 text-gray-500">
              No hay datos de cohortes
            </div>
          ) : (
            <div className="space-y-2">
              {cohortFrr.map((cohort) => {
                const barWidth = Math.max((cohort.frr / 100) * 100, 2);
                const barColor = cohort.frr >= 35 ? 'bg-green-500' : cohort.frr >= 25 ? 'bg-yellow-500' : 'bg-red-500';
                return (
                  <div key={cohort.cohortWeek} className="flex items-center gap-3">
                    <span className="text-xs text-gray-500 w-14 flex-shrink-0">{cohort.weekLabel}</span>
                    <div className="flex-1 h-6 bg-gray-700/50 rounded overflow-hidden relative">
                      <div
                        className={`h-full ${barColor} rounded transition-all`}
                        style={{ width: `${barWidth}%` }}
                      />
                      <div className="absolute inset-0 flex items-center px-2">
                        <span className="text-xs font-semibold text-gray-900 drop-shadow-sm">{cohort.frr.toFixed(1)}%</span>
                      </div>
                    </div>
                    <span className="text-xs text-gray-500 w-16 text-right flex-shrink-0">{cohort.trials} trials</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Retention Table */}
        <div className="bg-gray-800/50 rounded-xl border border-gray-700/50 p-6">
          <h3 className="text-lg font-semibold mb-4">Retencion por Mes (Cohorte 6 meses)</h3>
          {retention.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-gray-500">
              No hay datos de retencion
            </div>
          ) : (
            <>
              <div className="grid grid-cols-5 gap-2">
                {retention.map((month) => (
                  <div
                    key={month.month}
                    className="text-center p-2 rounded"
                    style={{
                      backgroundColor: `rgba(34, 197, 94, ${(month.rate / 100) * 0.4})`,
                    }}
                  >
                    <div className="text-xs text-gray-400 mb-1">{month.month}</div>
                    <div className="text-lg font-bold">{month.customers}</div>
                    <div className="text-xs text-gray-400">{month.rate.toFixed(1)}%</div>
                  </div>
                ))}
              </div>
              <div className="mt-4 pt-4 border-t border-gray-700/50 grid grid-cols-3 gap-4 text-center">
                <div>
                  <div className="text-sm text-gray-400">LTV 30d</div>
                  <div className="text-xl font-bold text-green-400">€{ltv.ltv30d.toFixed(0)}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-400">LTV 60d</div>
                  <div className="text-xl font-bold text-green-400">€{ltv.ltv60d.toFixed(0)}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-400">LTV 90d</div>
                  <div className="text-xl font-bold text-green-400">€{ltv.ltv90d.toFixed(0)}</div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Risk Trends */}
        <div className="bg-gray-800/50 rounded-xl border border-gray-700/50 p-6">
          <h3 className="text-lg font-semibold mb-4">Tendencias de Riesgo</h3>
          {riskTrends.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-gray-500">
              No hay datos de riesgo
            </div>
          ) : (
            <div className="space-y-6">
              {/* Refund Rate */}
              <div>
                <div className="flex justify-between items-center mb-3">
                  <span className="text-sm font-medium text-gray-300">Refund Rate</span>
                  <div className="flex items-center gap-2">
                    <span className={`font-medium ${(latestRisk?.refundRate || 0) <= 5 ? 'text-green-400' : (latestRisk?.refundRate || 0) <= 10 ? 'text-yellow-400' : 'text-red-400'}`}>
                      {latestRisk?.refundRate.toFixed(1) || 0}%
                    </span>
                    {refundTrend !== 0 && (
                      <>
                        {refundTrend < 0 ? (
                          <TrendingDown className="w-4 h-4 text-green-400" />
                        ) : (
                          <TrendingUp className="w-4 h-4 text-red-400" />
                        )}
                        <span className={`text-xs ${refundTrend < 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {refundTrend > 0 ? '+' : ''}{refundTrend.toFixed(1)}%
                        </span>
                      </>
                    )}
                  </div>
                </div>
                <div className="space-y-1">
                  {riskTrends.map((month) => {
                    const maxRefund = Math.max(...riskTrends.map(r => r.refundRate), 1);
                    const barWidth = Math.max((month.refundRate / maxRefund) * 100, 2);
                    const barColor = month.refundRate <= 5 ? 'bg-green-500' : month.refundRate <= 10 ? 'bg-yellow-500' : 'bg-red-500';
                    return (
                      <div key={month.month} className="flex items-center gap-2">
                        <span className="text-xs text-gray-500 w-8 flex-shrink-0">{month.monthLabel}</span>
                        <div className="flex-1 h-5 bg-gray-700/50 rounded overflow-hidden relative">
                          <div className={`h-full ${barColor} rounded`} style={{ width: `${barWidth}%` }} />
                        </div>
                        <span className="text-xs text-gray-400 w-12 text-right flex-shrink-0">{month.refundRate.toFixed(1)}%</span>
                      </div>
                    );
                  })}
                </div>
              </div>

            </div>
          )}
        </div>
      </div>
    </div>
  );
}
