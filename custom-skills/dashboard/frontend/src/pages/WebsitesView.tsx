import { useState, useEffect } from 'react';
import { Activity, ChevronDown, ChevronUp, RefreshCw } from 'lucide-react';
import { useCohort } from '../contexts/CohortContext';
import { api, type WebsitesViewData } from '../api/client';

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

interface FunnelProps {
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

function ConversionFunnel({ data }: { data: FunnelProps }) {
  const steps = [
    { label: 'Ad Spend', value: data.adSpend, display: `€${Math.round(data.adSpend).toLocaleString()}`, color: 'bg-red-900/60', badge: null },
    { label: 'Trials', value: data.trials, display: data.trials.toString(), color: 'bg-yellow-900/60', badge: `CPT €${Math.round(data.cpt)}` },
    { label: 'First Rebills', value: data.firstRebills, display: data.firstRebills.toString(), color: 'bg-amber-800/60', badge: `FRR ${data.frr.toFixed(1)}%` },
    { label: 'Revenue M1', value: data.revenueM1, display: `€${Math.round(data.revenueM1).toLocaleString()}`, color: 'bg-green-800/60', badge: null },
    { label: 'Refunds', value: data.refunds, display: `-€${Math.round(data.refunds).toLocaleString()}`, color: 'bg-red-800/60', badge: `${data.refundRate.toFixed(1)}%` },
    { label: 'Net M1', value: data.netM1, display: `€${Math.round(data.netM1).toLocaleString()}`, color: 'bg-green-700/60', badge: `${data.payback.toFixed(2)}x Payback` },
  ];

  // Calculate widths based on relative values
  const maxValue = Math.max(data.adSpend, data.revenueM1, data.netM1);

  return (
    <div className="bg-gray-800/50 rounded-xl border border-gray-700/50 p-4">
      <h4 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-4">
        Funnel de Conversión
      </h4>
      <div className="space-y-2">
        {steps.map((step, index) => {
          let widthPercent: number;
          if (index === 0) widthPercent = maxValue > 0 ? (data.adSpend / maxValue) * 100 : 100;
          else if (index === 1) widthPercent = 70;
          else if (index === 2) widthPercent = 50;
          else if (index === 3) widthPercent = maxValue > 0 ? (data.revenueM1 / maxValue) * 100 : 90;
          else if (index === 4) widthPercent = maxValue > 0 ? Math.max((data.refunds / maxValue) * 100, 15) : 20;
          else widthPercent = maxValue > 0 ? (data.netM1 / maxValue) * 100 : 85;

          return (
            <div key={step.label} className="flex items-center gap-3">
              <div className="w-24 text-sm text-gray-500 text-right">{step.label}</div>
              <div className="flex-1 flex items-center gap-2">
                <div
                  className={`h-8 ${step.color} rounded flex items-center px-3 shrink-0`}
                  style={{ width: `${Math.max(widthPercent, 15)}%` }}
                >
                  <span className="text-sm font-medium text-white whitespace-nowrap">{step.display}</span>
                </div>
                {step.badge && (
                  <span className="text-xs bg-gray-700/50 px-2 py-0.5 rounded text-gray-300 whitespace-nowrap">
                    {step.badge}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-4 pt-3 border-t border-gray-700/50 flex items-center justify-between text-sm">
        <span className="text-gray-500">
          €{Math.round(data.adSpend).toLocaleString()} invertidos → €{Math.round(data.netM1).toLocaleString()} neto
        </span>
        <span className={`text-lg font-bold ${data.payback >= 1.2 ? 'text-green-400' : data.payback >= 1.0 ? 'text-yellow-400' : 'text-red-400'}`}>
          {data.payback.toFixed(2)}x
        </span>
      </div>
    </div>
  );
}

export function WebsitesView() {
  const { selectedRange, isPeriod, days } = useCohort();
  const [expandedWebsite, setExpandedWebsite] = useState<number | null>(1);
  const [data, setData] = useState<WebsitesViewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
        const result = await api.getWebsitesView(range);
        setData(result);
      } catch (err) {
        console.error('Error fetching websites data:', err);
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
            <Activity className="w-7 h-7 text-purple-400" />
            Vista Websites
          </h1>
        </div>
        <div className="bg-gray-800/50 rounded-xl border border-gray-700/50 p-8 text-center">
          <p className="text-gray-400">Selecciona un rango de tiempo (7d, 14d, 30d, 60d) para ver los datos.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold mb-2 flex items-center gap-3">
            <Activity className="w-7 h-7 text-purple-400" />
            Vista Websites
          </h1>
        </div>
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="w-8 h-8 animate-spin text-purple-400" />
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
            <Activity className="w-7 h-7 text-purple-400" />
            Vista Websites
          </h1>
        </div>
        <div className="bg-red-500/20 border border-red-500/50 rounded-xl p-6 text-center">
          <p className="text-red-400">Error: {error}</p>
        </div>
      </div>
    );
  }

  const websites = data?.websites || [];

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-2 flex items-center gap-3">
          <Activity className="w-7 h-7 text-purple-400" />
          Vista Websites
        </h1>
        <p className="text-gray-400">
          Performance por Website - {selectedRange.label}
        </p>
      </div>

      {/* Websites List */}
      <div className="space-y-4">
        {websites.map((website) => {
          const isExpanded = expandedWebsite === website.websiteId;
          const paybackStatus = getStatus(website.kpis.paybackM1, { green: 1.2, yellow: 1.0 });
          const frrStatus = getStatus(website.kpis.frr, { green: 35, yellow: 25 });
          const refundStatus = getStatus(website.kpis.refundRateM1, { green: 5, yellow: 10 }, true);

          // Build funnel data (M1 cohort-based)
          const funnelData: FunnelProps = {
            adSpend: website.kpis.adSpendEur,
            trials: website.kpis.trialCount,
            cpt: website.kpis.cpt,
            firstRebills: website.kpis.firstRebillCount,
            frr: website.kpis.frr,
            revenueM1: website.kpis.revenueM1Eur,
            refunds: website.kpis.refundsM1Eur,
            refundRate: website.kpis.refundRateM1,
            netM1: website.kpis.netM1,
            payback: website.kpis.paybackM1,
          };

          return (
            <div key={website.websiteId} className="bg-gray-800/50 rounded-xl border border-gray-700/50 overflow-hidden">
              <button
                onClick={() => setExpandedWebsite(isExpanded ? null : website.websiteId)}
                className="w-full p-4 flex items-center justify-between hover:bg-gray-800/30 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div>
                    <div className="font-medium text-left">{website.name}</div>
                    <div className="text-xs text-gray-500">
                      Profit: <span className={website.kpis.profit >= 0 ? 'text-green-400' : 'text-red-400'}>
                        {website.kpis.profit >= 0 ? '+' : ''}€{Math.round(website.kpis.profit).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-6">
                  <div className={`text-center px-3 py-1 rounded border ${statusBg[paybackStatus]}`}>
                    <span className={`font-bold ${statusColors[paybackStatus]}`}>
                      {website.kpis.paybackM1.toFixed(2)}x
                    </span>
                    <div className="text-xs text-gray-500">Payback M1</div>
                  </div>
                  <div className={`text-center px-3 py-1 rounded border ${statusBg[frrStatus]}`}>
                    <span className={`font-bold ${statusColors[frrStatus]}`}>
                      {website.kpis.frr.toFixed(1)}%
                    </span>
                    <div className="text-xs text-gray-500">FRR</div>
                  </div>
                  <div className={`text-center px-3 py-1 rounded border ${statusBg[refundStatus]}`}>
                    <span className={`font-bold ${statusColors[refundStatus]}`}>
                      {website.kpis.refundRateM1.toFixed(1)}%
                    </span>
                    <div className="text-xs text-gray-500">Refund M1</div>
                  </div>
                  <div className="text-center px-3 py-1">
                    <span className="font-bold">{website.kpis.trialCount}</span>
                    <div className="text-xs text-gray-500">Trials</div>
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
                    <ConversionFunnel data={funnelData} />

                    {/* M1 Stats (Cohort-based) */}
                    <div className="bg-gray-800/50 rounded-xl border border-gray-700/50 p-4">
                      <h4 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-4">
                        M1 - Cohorte del Período
                      </h4>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-gray-900/50 rounded-lg p-3">
                          <div className="text-xs text-gray-500">Trial Revenue</div>
                          <div className="text-lg font-bold">€{Math.round(website.kpis.trialRevenueEur).toLocaleString()}</div>
                        </div>
                        <div className="bg-gray-900/50 rounded-lg p-3">
                          <div className="text-xs text-gray-500">First Rebill Revenue</div>
                          <div className="text-lg font-bold">€{Math.round(website.kpis.firstRebillRevenueEur).toLocaleString()}</div>
                        </div>
                        <div className="bg-gray-900/50 rounded-lg p-3">
                          <div className="text-xs text-gray-500">Revenue M1</div>
                          <div className="text-lg font-bold text-blue-400">€{Math.round(website.kpis.revenueM1Eur).toLocaleString()}</div>
                        </div>
                        <div className="bg-gray-900/50 rounded-lg p-3">
                          <div className="text-xs text-gray-500">Refunds M1</div>
                          <div className="text-lg font-bold text-red-400">-€{Math.round(website.kpis.refundsM1Eur).toLocaleString()}</div>
                        </div>
                        <div className="bg-gray-900/50 rounded-lg p-3">
                          <div className="text-xs text-gray-500">Net M1</div>
                          <div className={`text-lg font-bold ${website.kpis.netM1 >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            €{Math.round(website.kpis.netM1).toLocaleString()}
                          </div>
                        </div>
                        <div className="bg-gray-900/50 rounded-lg p-3">
                          <div className="text-xs text-gray-500">Payback M1</div>
                          <div className={`text-lg font-bold ${website.kpis.paybackM1 >= 1.2 ? 'text-green-400' : website.kpis.paybackM1 >= 1.0 ? 'text-yellow-400' : 'text-red-400'}`}>
                            {website.kpis.paybackM1.toFixed(2)}x
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Total Stats (Period-based) */}
                  <div className="mt-4">
                    <div className="bg-gray-800/50 rounded-xl border border-gray-700/50 p-4">
                      <h4 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-4">
                        Total - Actividad del Período
                      </h4>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div className="bg-gray-900/50 rounded-lg p-3">
                          <div className="text-xs text-gray-500">Total Revenue</div>
                          <div className="text-lg font-bold">€{Math.round(website.kpis.totalRevenueEur).toLocaleString()}</div>
                        </div>
                        <div className="bg-gray-900/50 rounded-lg p-3">
                          <div className="text-xs text-gray-500">Total Rebills</div>
                          <div className="text-lg font-bold">€{Math.round(website.kpis.totalRebillRevenueEur).toLocaleString()}</div>
                        </div>
                        <div className="bg-gray-900/50 rounded-lg p-3">
                          <div className="text-xs text-gray-500">Total Refunds</div>
                          <div className="text-lg font-bold text-red-400">-€{Math.round(website.kpis.totalRefundsEur).toLocaleString()}</div>
                        </div>
                        <div className="bg-gray-900/50 rounded-lg p-3">
                          <div className="text-xs text-gray-500">Net Total</div>
                          <div className={`text-lg font-bold ${website.kpis.netTotal >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            €{Math.round(website.kpis.netTotal).toLocaleString()}
                          </div>
                        </div>
                      </div>
                      <div className="mt-3 grid grid-cols-3 gap-3">
                        <div className="bg-gray-900/50 rounded-lg p-3">
                          <div className="text-xs text-gray-500">Ad Spend</div>
                          <div className="text-lg font-bold text-orange-400">€{Math.round(website.kpis.adSpendEur).toLocaleString()}</div>
                        </div>
                        <div className="bg-gray-900/50 rounded-lg p-3">
                          <div className="text-xs text-gray-500">Profit</div>
                          <div className={`text-lg font-bold ${website.kpis.profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {website.kpis.profit >= 0 ? '+' : ''}€{Math.round(website.kpis.profit).toLocaleString()}
                          </div>
                        </div>
                        <div className="bg-gray-900/50 rounded-lg p-3">
                          <div className="text-xs text-gray-500">CPT</div>
                          <div className="text-lg font-bold">€{Math.round(website.kpis.cpt)}</div>
                        </div>
                      </div>
                    </div>
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
