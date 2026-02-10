import { useState, useEffect } from 'react';
import { Users, TrendingUp, DollarSign, Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import { api, type LegacyHeaderCardsData } from '../api/client';

export function LegacyView() {
  const [data, setData] = useState<LegacyHeaderCardsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Toggle states for cards
  const [showNetTurnover, setShowNetTurnover] = useState(false);
  const [showRebillRate, setShowRebillRate] = useState(false);

  async function fetchData() {
    setLoading(true);
    setError(null);
    try {
      const result = await api.getLegacyHeaderCards();
      setData(result);
    } catch (err) {
      console.error('Error fetching legacy header cards:', err);
      setError(err instanceof Error ? err.message : 'Error fetching data');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
  }, []);

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

  const websites = Object.values(data.costPerRebillByWebsite);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold mb-2">Legacy Dashboard</h1>
          <p className="text-gray-400">Replica del dashboard antiguo - Header Cards MTD</p>
        </div>
        <button
          onClick={fetchData}
          className="flex items-center gap-2 px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Actualizar
        </button>
      </div>

      {/* Header Cards Grid */}
      <div className="grid md:grid-cols-3 gap-6 mb-8">
        {/* Card 1: Trials & Active Subscriptions */}
        <div className="bg-gray-800/50 rounded-xl border border-gray-700/50 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 rounded-lg bg-blue-500/20">
              <Users className="w-6 h-6 text-blue-400" />
            </div>
          </div>
          <div className="text-sm text-gray-400 mb-3">Suscripciones Activas</div>

          {/* Two columns for Trials and Subscriptions */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-2xl font-bold text-yellow-400">
                {data.activeTrials.toLocaleString()}
              </div>
              <div className="text-xs text-gray-500 mt-1">Trials</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-green-400">
                {data.activeSubscriptions.toLocaleString()}
              </div>
              <div className="text-xs text-gray-500 mt-1">Pagando</div>
            </div>
          </div>

          <div className="mt-3 pt-3 border-t border-gray-700/50 text-xs text-gray-500">
            Total: {(data.activeTrials + data.activeSubscriptions).toLocaleString()} no canceladas
          </div>
        </div>

        {/* Card 2: Gross / Net Turnover Per Day */}
        <div
          className="bg-gray-800/50 rounded-xl border border-gray-700/50 p-6 cursor-pointer hover:border-gray-600/50 transition-colors"
          onClick={() => setShowNetTurnover(!showNetTurnover)}
        >
          <div className="flex items-center justify-between mb-4">
            <div className={`p-3 rounded-lg ${showNetTurnover ? 'bg-blue-500/20' : 'bg-green-500/20'}`}>
              <DollarSign className={`w-6 h-6 ${showNetTurnover ? 'text-blue-400' : 'text-green-400'}`} />
            </div>
            <span className="text-xs text-gray-500">Click para alternar</span>
          </div>
          <div className="text-sm text-gray-400 mb-1">
            {showNetTurnover ? 'Net Turnover Per Day' : 'Gross Turnover Per Day'}
          </div>
          <div className="text-3xl font-bold">
            {showNetTurnover
              ? `€${data.netTurnoverPerDay.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
              : `€${data.grossTurnoverPerDay.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          </div>
          <div className="text-xs text-gray-500 mt-2">
            MTD: €{showNetTurnover
              ? data.netTurnoverMtd.toLocaleString(undefined, { maximumFractionDigits: 0 })
              : data.grossTurnoverMtd.toLocaleString(undefined, { maximumFractionDigits: 0 })} / {data.daysInMonth} días
          </div>
        </div>

        {/* Card 3: Summary Card */}
        <div className="bg-gray-800/50 rounded-xl border border-gray-700/50 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 rounded-lg bg-purple-500/20">
              <TrendingUp className="w-6 h-6 text-purple-400" />
            </div>
          </div>
          <div className="text-sm text-gray-400 mb-3">Resumen MTD</div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Gross</span>
              <span className="text-green-400">€{data.grossTurnoverMtd.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Refunds</span>
              <span className="text-red-400">-€{data.totalRefundsEur.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Ads</span>
              <span className="text-yellow-400">-€{data.adsExpenseEur.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
            </div>
            <div className="border-t border-gray-700 pt-2 flex justify-between font-medium">
              <span className="text-gray-400">Net</span>
              <span className={data.netTurnoverMtd >= 0 ? 'text-green-400' : 'text-red-400'}>
                €{data.netTurnoverMtd.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Cost Per First Rebill by Website */}
      <div className="bg-gray-800/50 rounded-xl border border-gray-700/50 p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold">
            {showRebillRate ? 'Rebill Rate por Website' : 'Cost Per First Rebill por Website'}
          </h2>
          <button
            onClick={() => setShowRebillRate(!showRebillRate)}
            className="text-xs px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded transition-colors"
          >
            {showRebillRate ? 'Ver CPFR' : 'Ver Rebill Rate'}
          </button>
        </div>

        <div className="grid md:grid-cols-3 gap-4">
          {websites.map((website) => (
            <div
              key={website.websiteId}
              className="bg-gray-700/30 rounded-lg p-4 border border-gray-600/30"
            >
              <div className="text-sm text-gray-400 mb-2">{website.websiteName}</div>

              {showRebillRate ? (
                <>
                  <div className={`text-2xl font-bold ${
                    Number(website.rebillRate) >= 35 ? 'text-green-400' :
                    Number(website.rebillRate) >= 25 ? 'text-yellow-400' : 'text-red-400'
                  }`}>
                    {Number(website.rebillRate).toFixed(1)}%
                  </div>
                  <div className="text-xs text-gray-500 mt-2">
                    {website.firstRebills} rebills / {website.trials} trials
                  </div>
                </>
              ) : (
                <>
                  <div className={`text-2xl font-bold ${
                    Number(website.costPerFirstRebill) <= 80 ? 'text-green-400' :
                    Number(website.costPerFirstRebill) <= 120 ? 'text-yellow-400' : 'text-red-400'
                  }`}>
                    €{Number(website.costPerFirstRebill).toFixed(0)}
                  </div>
                  <div className="text-xs text-gray-500 mt-2">
                    €{Number(website.adsExpenseEur).toFixed(0)} ads / {website.firstRebills} rebills
                  </div>
                </>
              )}

              {/* Mini bar showing rebill rate */}
              <div className="mt-3 h-2 bg-gray-600/50 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${
                    Number(website.rebillRate) >= 35 ? 'bg-green-500' :
                    Number(website.rebillRate) >= 25 ? 'bg-yellow-500' : 'bg-red-500'
                  }`}
                  style={{ width: `${Math.min(Number(website.rebillRate), 100)}%` }}
                />
              </div>
            </div>
          ))}
        </div>

        {websites.length === 0 && (
          <div className="text-center text-gray-500 py-8">
            No hay datos de websites
          </div>
        )}
      </div>
    </div>
  );
}
