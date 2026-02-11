import React, { useState, useEffect } from 'react';
import { Users, TrendingUp, DollarSign, Loader2, AlertCircle, RefreshCw, ChevronRight, ChevronDown } from 'lucide-react';
import { api, type LegacyHeaderCardsData, type TodayPerformanceData } from '../api/client';

export function LegacyView() {
  const [data, setData] = useState<LegacyHeaderCardsData | null>(null);
  const [todayPerf, setTodayPerf] = useState<TodayPerformanceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Toggle states for cards
  const [showNetTurnover, setShowNetTurnover] = useState(false);
  const [showRebillRate, setShowRebillRate] = useState(false);
  const [showRoas, setShowRoas] = useState(false);

  // Expanded websites in Today Performance
  const [expandedTrials, setExpandedTrials] = useState<Set<string>>(new Set());
  const [expandedRebills, setExpandedRebills] = useState<Set<string>>(new Set());

  async function fetchData() {
    setLoading(true);
    setError(null);
    try {
      const [headerCards, todayPerformance] = await Promise.all([
        api.getLegacyHeaderCards(),
        api.getTodayPerformance(),
      ]);
      setData(headerCards);
      setTodayPerf(todayPerformance);
    } catch (err) {
      console.error('Error fetching legacy data:', err);
      setError(err instanceof Error ? err.message : 'Error fetching data');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
  }, []);

  const toggleTrialExpand = (websiteName: string) => {
    setExpandedTrials((prev) => {
      const next = new Set(prev);
      if (next.has(websiteName)) {
        next.delete(websiteName);
      } else {
        next.add(websiteName);
      }
      return next;
    });
  };

  const toggleRebillExpand = (websiteName: string) => {
    setExpandedRebills((prev) => {
      const next = new Set(prev);
      if (next.has(websiteName)) {
        next.delete(websiteName);
      } else {
        next.add(websiteName);
      }
      return next;
    });
  };

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

          <div className="mt-3 pt-3 border-t border-gray-700/50 flex justify-between items-center">
            <span className="text-xs text-gray-500">
              Total: {(data.activeTrials + data.activeSubscriptions).toLocaleString()}
            </span>
            <span className="text-xs text-green-400 font-medium">
              +{data.conversionsToday} hoy →
            </span>
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

      {/* Today Performance Table */}
      {todayPerf && (
        <div className="bg-gray-800/50 rounded-xl border border-gray-700/50 p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">Today Performance</h2>

          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-400 border-b border-gray-700">
                <th className="text-left py-2 font-medium"></th>
                <th className="text-center py-2 font-medium w-24">{todayPerf.dates.today}</th>
                <th className="text-center py-2 font-medium w-24">{todayPerf.dates.yesterday}</th>
              </tr>
            </thead>
            <tbody>
              {/* Trials by Website */}
              {Object.values(todayPerf.trialsByWebsite).map((website) => {
                const isExpanded = expandedTrials.has(website.websiteName);
                const hasCampaigns = Object.keys(website.campaigns).length > 1 ||
                  (Object.keys(website.campaigns).length === 1 && !website.campaigns['No Campaign']);

                return (
                  <React.Fragment key={`trial-${website.websiteId}`}>
                    <tr
                      className={`border-b border-gray-700/50 ${hasCampaigns ? 'cursor-pointer hover:bg-gray-700/30' : ''}`}
                      onClick={() => hasCampaigns && toggleTrialExpand(website.websiteName)}
                    >
                      <td className="py-3 flex items-center gap-2">
                        {hasCampaigns && (
                          isExpanded
                            ? <ChevronDown className="w-4 h-4 text-gray-400" />
                            : <ChevronRight className="w-4 h-4 text-gray-400" />
                        )}
                        <span className="font-medium">{website.websiteName}</span>
                      </td>
                      <td className="text-center py-3 font-medium">{website.today}</td>
                      <td className="text-center py-3 font-medium">{website.yesterday}</td>
                    </tr>
                    {isExpanded && Object.entries(website.campaigns).map(([campaignName, campaignData]) => (
                      <tr key={`trial-camp-${website.websiteId}-${campaignName}`} className="border-b border-gray-700/30 bg-gray-800/30">
                        <td className="py-2 pl-8 text-gray-400 text-xs">{campaignName}</td>
                        <td className="text-center py-2 text-gray-400 text-xs">{campaignData.today}</td>
                        <td className="text-center py-2 text-gray-400 text-xs">{campaignData.yesterday}</td>
                      </tr>
                    ))}
                  </React.Fragment>
                );
              })}

              {/* Premium Acquisitions Total */}
              <tr className="bg-indigo-900/30 border-b border-gray-700">
                <td className="py-3 font-semibold text-indigo-300">Premium Acquisitions</td>
                <td className="text-center py-3 font-semibold text-indigo-300">{todayPerf.totals.premiumAcquisitions.today}</td>
                <td className="text-center py-3 font-semibold text-indigo-300">{todayPerf.totals.premiumAcquisitions.yesterday}</td>
              </tr>

              {/* Rebills by Website */}
              {Object.values(todayPerf.rebillsByWebsite).map((website) => {
                const isExpanded = expandedRebills.has(website.websiteName);
                const hasCampaigns = Object.keys(website.campaigns).length > 1 ||
                  (Object.keys(website.campaigns).length === 1 && !website.campaigns['No Campaign']);

                return (
                  <React.Fragment key={`rebill-${website.websiteId}`}>
                    <tr
                      className={`border-b border-gray-700/50 ${hasCampaigns ? 'cursor-pointer hover:bg-gray-700/30' : ''}`}
                      onClick={() => hasCampaigns && toggleRebillExpand(website.websiteName)}
                    >
                      <td className="py-3 flex items-center gap-2">
                        {hasCampaigns && (
                          isExpanded
                            ? <ChevronDown className="w-4 h-4 text-gray-400" />
                            : <ChevronRight className="w-4 h-4 text-gray-400" />
                        )}
                        <span className="font-medium">{website.websiteName} (Rebills)</span>
                      </td>
                      <td className="text-center py-3 font-medium">{website.today}</td>
                      <td className="text-center py-3 font-medium">{website.yesterday}</td>
                    </tr>
                    {isExpanded && Object.entries(website.campaigns).map(([campaignName, campaignData]) => (
                      <tr key={`rebill-camp-${website.websiteId}-${campaignName}`} className="border-b border-gray-700/30 bg-gray-800/30">
                        <td className="py-2 pl-8 text-gray-400 text-xs">{campaignName}</td>
                        <td className="text-center py-2 text-gray-400 text-xs">{campaignData.today}</td>
                        <td className="text-center py-2 text-gray-400 text-xs">{campaignData.yesterday}</td>
                      </tr>
                    ))}
                  </React.Fragment>
                );
              })}

              {/* Total Rebills Refunded */}
              <tr className="bg-gray-700/30 border-b border-gray-700">
                <td className="py-3 font-medium text-gray-300">Total Rebills Refunded</td>
                <td className="text-center py-3 font-medium text-red-400">{todayPerf.totals.refundedRebills.today}</td>
                <td className="text-center py-3 font-medium text-red-400">{todayPerf.totals.refundedRebills.yesterday}</td>
              </tr>

              {/* Total Rebills */}
              <tr className="bg-gray-700/30 border-b border-gray-700">
                <td className="py-3 font-medium text-gray-300">Total Rebills</td>
                <td className="text-center py-3 font-medium">{todayPerf.totals.totalRebills.today}</td>
                <td className="text-center py-3 font-medium">{todayPerf.totals.totalRebills.yesterday}</td>
              </tr>

              {/* Total */}
              <tr className="bg-indigo-900/30">
                <td className="py-3 font-semibold text-indigo-300">Total</td>
                <td className="text-center py-3 font-semibold text-indigo-300">
                  {todayPerf.totals.total.today.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                </td>
                <td className="text-center py-3 font-semibold text-indigo-300">
                  {todayPerf.totals.total.yesterday.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

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

      {/* Total Rebills by Website MTD / ROAS */}
      <div className="bg-gray-800/50 rounded-xl border border-gray-700/50 p-6 mt-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold">
            {showRoas ? 'ROAS MTD por Website' : 'Total Rebills MTD por Website'}
          </h2>
          <button
            onClick={() => setShowRoas(!showRoas)}
            className="text-xs px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded transition-colors"
          >
            {showRoas ? 'Ver Rebills' : 'Ver ROAS'}
          </button>
        </div>

        <div className="grid md:grid-cols-3 gap-4">
          {Object.values(data.totalRebillsByWebsite).map((website) => {
            const cpfrData = data.costPerRebillByWebsite[website.websiteName];
            const adSpend = cpfrData?.adsExpenseEur || 0;
            const roas = adSpend > 0 ? website.revenueEur / adSpend : 0;

            return (
              <div
                key={website.websiteId}
                className="bg-gray-700/30 rounded-lg p-4 border border-gray-600/30 cursor-pointer hover:border-gray-500/50 transition-colors"
                onClick={() => setShowRoas(!showRoas)}
              >
                <div className="text-sm text-gray-400 mb-2">{website.websiteName}</div>

                {showRoas ? (
                  <>
                    <div className={`text-2xl font-bold ${
                      roas >= 2 ? 'text-green-400' :
                      roas >= 1 ? 'text-yellow-400' : 'text-red-400'
                    }`}>
                      {roas.toFixed(2)}x
                    </div>
                    <div className="text-xs text-gray-500 mt-2 space-y-1">
                      <div>€{website.revenueEur.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} revenue</div>
                      <div>€{adSpend.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ads</div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="text-2xl font-bold text-green-400">
                      €{website.revenueEur.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </div>
                    <div className="text-xs text-gray-500 mt-2">
                      {website.totalRebills.toLocaleString()} rebills
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>

        {Object.keys(data.totalRebillsByWebsite).length === 0 && (
          <div className="text-center text-gray-500 py-8">
            No hay datos de rebills
          </div>
        )}
      </div>
    </div>
  );
}
