import { useState, useEffect } from 'react';
import { Globe, ChevronDown, ChevronUp, RefreshCw } from 'lucide-react';
import { useCohort } from '../contexts/CohortContext';
import { api, type CountriesViewData, WEBSITES } from '../api/client';

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

function getFlagEmoji(countryCode: string): string {
  if (!countryCode || countryCode.length !== 2) return '';
  const codePoints = countryCode
    .toUpperCase()
    .split('')
    .map(char => 127397 + char.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
}

export function CountriesView() {
  const { selectedRange, isPeriod, days } = useCohort();
  const [expandedCountry, setExpandedCountry] = useState<number | null>(null);
  const [data, setData] = useState<CountriesViewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedWebsite, setSelectedWebsite] = useState<number | null>(null);

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
        const result = await api.getCountriesView(range, selectedWebsite || undefined);
        setData(result);
        if (result.countries.length > 0 && expandedCountry === null) {
          setExpandedCountry(result.countries[0].countryId);
        }
      } catch (err) {
        console.error('Error fetching countries data:', err);
        setError(err instanceof Error ? err.message : 'Error fetching data');
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [days, isPeriod, selectedWebsite]);

  if (!isPeriod) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold mb-2 flex items-center gap-3">
            <Globe className="w-7 h-7 text-cyan-400" />
            Vista Countries
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
            <Globe className="w-7 h-7 text-cyan-400" />
            Vista Countries
          </h1>
        </div>
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="w-8 h-8 animate-spin text-cyan-400" />
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
            <Globe className="w-7 h-7 text-cyan-400" />
            Vista Countries
          </h1>
        </div>
        <div className="bg-red-500/20 border border-red-500/50 rounded-xl p-6 text-center">
          <p className="text-red-400">Error: {error}</p>
        </div>
      </div>
    );
  }

  const countries = data?.countries || [];

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold mb-2 flex items-center gap-3">
              <Globe className="w-7 h-7 text-cyan-400" />
              Vista Countries
            </h1>
            <p className="text-gray-400">
              Performance por País (Campaign Targeting) - {selectedRange.label}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">Filtrar por website:</span>
            <select
              value={selectedWebsite || ''}
              onChange={(e) => setSelectedWebsite(e.target.value ? parseInt(e.target.value, 10) : null)}
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-cyan-500"
            >
              <option value="">Todos</option>
              {WEBSITES.map(w => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {countries.length === 0 ? (
          <div className="bg-gray-800/50 rounded-xl border border-gray-700/50 p-8 text-center">
            <p className="text-gray-400">No hay datos de países para este período.</p>
          </div>
        ) : (
          countries.filter(c => c && c.kpis).map((country) => {
            const isExpanded = expandedCountry === country.countryId;
            const kpis = country.kpis;
            const paybackStatus = getStatus(kpis.paybackM1, { green: 1.2, yellow: 1.0 });
            const frrStatus = getStatus(kpis.frr, { green: 35, yellow: 25 });
            const refundStatus = getStatus(kpis.refundRateM1, { green: 5, yellow: 10 }, true);

            return (
              <div key={country.countryId} className="bg-gray-800/50 rounded-xl border border-gray-700/50 overflow-hidden">
                <button
                  onClick={() => setExpandedCountry(isExpanded ? null : country.countryId)}
                  className="w-full p-4 flex items-center justify-between hover:bg-gray-800/30 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <span className="text-2xl">{getFlagEmoji(country.countryCode)}</span>
                    <div>
                      <div className="font-medium text-left">{country.countryName}</div>
                      <div className="text-xs text-gray-500">
                        Ad Spend: <span className="text-orange-400">{'\u20AC'}{Math.round(kpis.adSpendEur).toLocaleString()}</span>
                        {' | '}
                        Profit: <span className={kpis.profit >= 0 ? 'text-green-400' : 'text-red-400'}>
                          {kpis.profit >= 0 ? '+' : ''}{'\u20AC'}{Math.round(kpis.profit).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-6">
                    <div className={`text-center px-3 py-1 rounded border ${statusBg[paybackStatus]}`}>
                      <span className={`font-bold ${statusColors[paybackStatus]}`}>
                        {kpis.paybackM1.toFixed(2)}x
                      </span>
                      <div className="text-xs text-gray-500">Payback M1</div>
                    </div>
                    <div className={`text-center px-3 py-1 rounded border ${statusBg[frrStatus]}`}>
                      <span className={`font-bold ${statusColors[frrStatus]}`}>
                        {kpis.frr.toFixed(1)}%
                      </span>
                      <div className="text-xs text-gray-500">FRR</div>
                    </div>
                    <div className={`text-center px-3 py-1 rounded border ${statusBg[refundStatus]}`}>
                      <span className={`font-bold ${statusColors[refundStatus]}`}>
                        {kpis.refundRateM1.toFixed(1)}%
                      </span>
                      <div className="text-xs text-gray-500">Refund M1</div>
                    </div>
                    <div className="text-center px-3 py-1">
                      <span className="font-bold">{kpis.trialCount}</span>
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
                      <div className="bg-gray-800/50 rounded-xl border border-gray-700/50 p-4">
                        <h4 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-4">
                          M1 - Cohorte del Período
                        </h4>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="bg-gray-900/50 rounded-lg p-3">
                            <div className="text-xs text-gray-500">Trial Revenue</div>
                            <div className="text-lg font-bold">{'\u20AC'}{Math.round(kpis.trialRevenueEur).toLocaleString()}</div>
                          </div>
                          <div className="bg-gray-900/50 rounded-lg p-3">
                            <div className="text-xs text-gray-500">First Rebill Revenue</div>
                            <div className="text-lg font-bold">{'\u20AC'}{Math.round(kpis.firstRebillRevenueEur).toLocaleString()}</div>
                          </div>
                          <div className="bg-gray-900/50 rounded-lg p-3">
                            <div className="text-xs text-gray-500">Revenue M1</div>
                            <div className="text-lg font-bold text-blue-400">{'\u20AC'}{Math.round(kpis.revenueM1Eur).toLocaleString()}</div>
                          </div>
                          <div className="bg-gray-900/50 rounded-lg p-3">
                            <div className="text-xs text-gray-500">Refunds M1</div>
                            <div className="text-lg font-bold text-red-400">-{'\u20AC'}{Math.round(kpis.refundsM1Eur).toLocaleString()}</div>
                          </div>
                          <div className="bg-gray-900/50 rounded-lg p-3">
                            <div className="text-xs text-gray-500">Net M1</div>
                            <div className={`text-lg font-bold ${kpis.netM1 >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                              {'\u20AC'}{Math.round(kpis.netM1).toLocaleString()}
                            </div>
                          </div>
                          <div className="bg-gray-900/50 rounded-lg p-3">
                            <div className="text-xs text-gray-500">Payback M1</div>
                            <div className={`text-lg font-bold ${kpis.paybackM1 >= 1.2 ? 'text-green-400' : kpis.paybackM1 >= 1.0 ? 'text-yellow-400' : 'text-red-400'}`}>
                              {kpis.paybackM1.toFixed(2)}x
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="bg-gray-800/50 rounded-xl border border-gray-700/50 p-4">
                        <h4 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-4">
                          Total - Actividad del Período
                        </h4>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="bg-gray-900/50 rounded-lg p-3">
                            <div className="text-xs text-gray-500">Total Revenue</div>
                            <div className="text-lg font-bold">{'\u20AC'}{Math.round(kpis.totalRevenueEur).toLocaleString()}</div>
                          </div>
                          <div className="bg-gray-900/50 rounded-lg p-3">
                            <div className="text-xs text-gray-500">Total Rebills</div>
                            <div className="text-lg font-bold">{'\u20AC'}{Math.round(kpis.totalRebillRevenueEur).toLocaleString()}</div>
                          </div>
                          <div className="bg-gray-900/50 rounded-lg p-3">
                            <div className="text-xs text-gray-500">Total Refunds</div>
                            <div className="text-lg font-bold text-red-400">-{'\u20AC'}{Math.round(kpis.totalRefundsEur).toLocaleString()}</div>
                          </div>
                          <div className="bg-gray-900/50 rounded-lg p-3">
                            <div className="text-xs text-gray-500">Net Total</div>
                            <div className={`text-lg font-bold ${kpis.netTotal >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                              {'\u20AC'}{Math.round(kpis.netTotal).toLocaleString()}
                            </div>
                          </div>
                          <div className="bg-gray-900/50 rounded-lg p-3">
                            <div className="text-xs text-gray-500">Ad Spend</div>
                            <div className="text-lg font-bold text-orange-400">{'\u20AC'}{Math.round(kpis.adSpendEur).toLocaleString()}</div>
                          </div>
                          <div className="bg-gray-900/50 rounded-lg p-3">
                            <div className="text-xs text-gray-500">Profit</div>
                            <div className={`text-lg font-bold ${kpis.profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                              {kpis.profit >= 0 ? '+' : ''}{'\u20AC'}{Math.round(kpis.profit).toLocaleString()}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-4 gap-3">
                      <div className="bg-gray-900/50 rounded-lg p-3 text-center">
                        <div className="text-xs text-gray-500">Trials</div>
                        <div className="text-lg font-bold">{kpis.trialCount}</div>
                      </div>
                      <div className="bg-gray-900/50 rounded-lg p-3 text-center">
                        <div className="text-xs text-gray-500">First Rebills</div>
                        <div className="text-lg font-bold">{kpis.firstRebillCount}</div>
                      </div>
                      <div className="bg-gray-900/50 rounded-lg p-3 text-center">
                        <div className="text-xs text-gray-500">CPT</div>
                        <div className="text-lg font-bold">{'\u20AC'}{Math.round(kpis.cpt)}</div>
                      </div>
                      <div className="bg-gray-900/50 rounded-lg p-3 text-center">
                        <div className="text-xs text-gray-500">Dispute Rate</div>
                        <div className={`text-lg font-bold ${kpis.disputeRate <= 0.5 ? 'text-green-400' : kpis.disputeRate <= 1 ? 'text-yellow-400' : 'text-red-400'}`}>
                          {kpis.disputeRate.toFixed(2)}%
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

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
