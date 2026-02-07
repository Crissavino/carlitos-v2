import { useState, useEffect } from 'react';
import { Megaphone, Filter, ChevronDown, ChevronUp, Loader2, TrendingUp, TrendingDown, AlertCircle, Globe, Map } from 'lucide-react';
import { useCohort } from '../contexts/CohortContext';
import { api, type CampaignData } from '../api/client';

type Status = 'green' | 'yellow' | 'red' | 'neutral';

function getStatus(value: number, thresholds: { green: number; yellow: number }, inverse = false): Status {
  if (value === 0) return 'neutral';
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
  neutral: 'text-gray-400',
};

const statusBg: Record<Status, string> = {
  green: 'bg-green-500/20 border-green-500/30',
  yellow: 'bg-yellow-500/20 border-yellow-500/30',
  red: 'bg-red-500/20 border-red-500/30',
  neutral: 'bg-gray-500/20 border-gray-500/30',
};

// Website options
const WEBSITES = [
  { id: undefined, name: 'Todos los Websites' },
  { id: 1, name: 'conversie-pdf.com' },
  { id: 3, name: 'convierte-pdf.com' },
  { id: 4, name: 'device-finder.com' },
];

export function CampaignsView() {
  const { selectedRange, days, isPeriod } = useCohort();
  const [campaigns, setCampaigns] = useState<CampaignData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedCampaigns, setExpandedCampaigns] = useState<Set<number>>(new Set());
  const [websiteFilter, setWebsiteFilter] = useState<number | undefined>(undefined);
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'paused'>('all');
  const [sortBy, setSortBy] = useState<'spend' | 'payback' | 'frr' | 'profit'>('spend');

  useEffect(() => {
    async function fetchData() {
      if (!isPeriod) {
        setLoading(false);
        setCampaigns([]);
        return;
      }

      setLoading(true);
      setError(null);
      try {
        const range = `${days}d`;
        const result = await api.getCampaignsView(range, websiteFilter);
        if (result.campaigns) {
          setCampaigns(result.campaigns.filter((c: CampaignData) => c && c.kpis));
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error loading campaigns');
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [days, isPeriod, websiteFilter]);

  if (!isPeriod) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold mb-2 flex items-center gap-3">
            <Megaphone className="w-7 h-7 text-orange-400" />
            Vista Campanas
          </h1>
        </div>
        <div className="bg-gray-800/50 rounded-xl border border-gray-700/50 p-8 text-center">
          <p className="text-gray-400">Selecciona un rango de tiempo (7d, 14d, 30d, 60d) para ver los datos.</p>
          <p className="text-gray-500 text-sm mt-2">Las cohortes mensuales no estan soportadas en esta vista.</p>
        </div>
      </div>
    );
  }

  const toggleExpand = (campaignId: number) => {
    setExpandedCampaigns(prev => {
      const next = new Set(prev);
      if (next.has(campaignId)) {
        next.delete(campaignId);
      } else {
        next.add(campaignId);
      }
      return next;
    });
  };

  // Filter and sort campaigns
  const filteredCampaigns = campaigns
    .filter(c => {
      if (statusFilter === 'active' && !c.active) return false;
      if (statusFilter === 'paused' && c.active) return false;
      return true;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'spend': return b.kpis.adSpendEur - a.kpis.adSpendEur;
        case 'payback': return b.kpis.paybackM1 - a.kpis.paybackM1;
        case 'frr': return b.kpis.frr - a.kpis.frr;
        case 'profit': return b.kpis.profit - a.kpis.profit;
        default: return 0;
      }
    });

  // Calculate totals
  const totals = filteredCampaigns.reduce((acc, c) => ({
    adSpend: acc.adSpend + c.kpis.adSpendEur,
    trials: acc.trials + c.kpis.trialCount,
    firstRebills: acc.firstRebills + c.kpis.firstRebillCount,
    netM1: acc.netM1 + c.kpis.netM1,
    netTotal: acc.netTotal + c.kpis.netTotal,
    profit: acc.profit + c.kpis.profit,
  }), { adSpend: 0, trials: 0, firstRebills: 0, netM1: 0, netTotal: 0, profit: 0 });

  const totalFrr = totals.trials > 0 ? (totals.firstRebills / totals.trials) * 100 : 0;
  const totalPaybackM1 = totals.adSpend > 0 ? totals.netM1 / totals.adSpend : 0;

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

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-2 flex items-center gap-3">
          <Megaphone className="w-7 h-7 text-orange-400" />
          Vista Campanas
        </h1>
        <p className="text-gray-400">
          Performance por campana - {selectedRange.label}
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 mb-6">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-400" />
          <span className="text-sm text-gray-400">Filtros:</span>
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

        {/* Status Filter */}
        <div className="relative">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm appearance-none pr-8 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">Todos</option>
            <option value="active">Activas</option>
            <option value="paused">Pausadas</option>
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
        </div>

        {/* Sort */}
        <div className="relative">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm appearance-none pr-8 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="spend">Ordenar: Spend</option>
            <option value="payback">Ordenar: Payback M1</option>
            <option value="frr">Ordenar: FRR</option>
            <option value="profit">Ordenar: Profit</option>
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
        </div>
      </div>

      {/* Summary Totals */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-6">
        <div className="bg-gray-800/50 rounded-lg p-3 border border-gray-700/50">
          <div className="text-xs text-gray-500 mb-1">Campanas</div>
          <div className="text-xl font-bold">{filteredCampaigns.length}</div>
        </div>
        <div className="bg-gray-800/50 rounded-lg p-3 border border-gray-700/50">
          <div className="text-xs text-gray-500 mb-1">Ad Spend</div>
          <div className="text-xl font-bold">€{totals.adSpend.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
        </div>
        <div className="bg-gray-800/50 rounded-lg p-3 border border-gray-700/50">
          <div className="text-xs text-gray-500 mb-1">Trials</div>
          <div className="text-xl font-bold">{totals.trials.toLocaleString()}</div>
        </div>
        <div className="bg-gray-800/50 rounded-lg p-3 border border-gray-700/50">
          <div className="text-xs text-gray-500 mb-1">FRR</div>
          <div className={`text-xl font-bold ${statusColors[getStatus(totalFrr, { green: 35, yellow: 25 })]}`}>
            {totalFrr.toFixed(1)}%
          </div>
        </div>
        <div className="bg-gray-800/50 rounded-lg p-3 border border-gray-700/50">
          <div className="text-xs text-gray-500 mb-1">Payback M1</div>
          <div className={`text-xl font-bold ${statusColors[getStatus(totalPaybackM1, { green: 1.2, yellow: 0.9 })]}`}>
            {totalPaybackM1.toFixed(2)}x
          </div>
        </div>
        <div className="bg-gray-800/50 rounded-lg p-3 border border-gray-700/50">
          <div className="text-xs text-gray-500 mb-1">Profit Total</div>
          <div className={`text-xl font-bold ${totals.profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            €{totals.profit.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </div>
        </div>
      </div>

      {/* Campaigns List */}
      <div className="space-y-3">
        {filteredCampaigns.length === 0 ? (
          <div className="bg-gray-800/50 rounded-xl border border-gray-700/50 p-8 text-center">
            <Megaphone className="w-12 h-12 text-gray-600 mx-auto mb-3" />
            <p className="text-gray-400">No hay campanas con actividad en este periodo</p>
          </div>
        ) : (
          filteredCampaigns.map((campaign) => {
            const { kpis } = campaign;
            const isExpanded = expandedCampaigns.has(campaign.campaignId);
            const paybackStatus = getStatus(kpis.paybackM1, { green: 1.2, yellow: 0.9 });
            const frrStatus = getStatus(kpis.frr, { green: 35, yellow: 25 });

            return (
              <div
                key={campaign.campaignId}
                className={`bg-gray-800/50 rounded-xl border ${statusBg[paybackStatus]} overflow-hidden`}
              >
                {/* Campaign Header - Always Visible */}
                <div
                  className="p-4 cursor-pointer hover:bg-gray-700/30 transition-colors"
                  onClick={() => toggleExpand(campaign.campaignId)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      {/* Status indicator */}
                      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${campaign.active ? 'bg-green-400' : 'bg-gray-500'}`} />

                      {/* Campaign name */}
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{campaign.campaignName}</div>
                        <div className="text-xs text-gray-500 flex items-center gap-2">
                          <span>{campaign.websiteName || `Website ${campaign.websiteId}`}</span>
                          {campaign.countryCode && (
                            <>
                              <span>•</span>
                              <span className="flex items-center gap-1">
                                <Map className="w-3 h-3" />
                                {campaign.countryCode}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Key Metrics */}
                    <div className="flex items-center gap-4 text-sm">
                      <div className="text-right hidden sm:block">
                        <div className="text-xs text-gray-500">Spend</div>
                        <div className="font-medium">€{kpis.adSpendEur.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                      </div>
                      <div className="text-right hidden md:block">
                        <div className="text-xs text-gray-500">Trials</div>
                        <div className="font-medium">{kpis.trialCount}</div>
                      </div>
                      <div className="text-right hidden md:block">
                        <div className="text-xs text-gray-500">FRR</div>
                        <div className={`font-medium ${statusColors[frrStatus]}`}>{kpis.frr.toFixed(1)}%</div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs text-gray-500">Payback M1</div>
                        <div className={`font-medium ${statusColors[paybackStatus]}`}>{kpis.paybackM1.toFixed(2)}x</div>
                      </div>
                      <div className="text-right hidden lg:block">
                        <div className="text-xs text-gray-500">Profit</div>
                        <div className={`font-medium flex items-center gap-1 ${kpis.profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {kpis.profit >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                          €{Math.abs(kpis.profit).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </div>
                      </div>

                      {/* Expand icon */}
                      <div className="ml-2">
                        {isExpanded ? (
                          <ChevronUp className="w-5 h-5 text-gray-400" />
                        ) : (
                          <ChevronDown className="w-5 h-5 text-gray-400" />
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="px-4 pb-4 border-t border-gray-700/50">
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 pt-4">
                      {/* M1 Cohort Metrics */}
                      <div className="col-span-2 md:col-span-4 lg:col-span-6">
                        <div className="text-xs text-gray-500 uppercase tracking-wider mb-2">M1 (Cohorte adquirida en periodo)</div>
                      </div>

                      <div className="bg-gray-900/50 rounded-lg p-3">
                        <div className="text-xs text-gray-500 mb-1">Trial Revenue</div>
                        <div className="font-medium">€{kpis.trialRevenueEur.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                      </div>
                      <div className="bg-gray-900/50 rounded-lg p-3">
                        <div className="text-xs text-gray-500 mb-1">1st Rebill Revenue</div>
                        <div className="font-medium">€{kpis.firstRebillRevenueEur.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                      </div>
                      <div className="bg-gray-900/50 rounded-lg p-3">
                        <div className="text-xs text-gray-500 mb-1">Refunds M1</div>
                        <div className="font-medium text-red-400">-€{kpis.refundsM1Eur.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                      </div>
                      <div className="bg-gray-900/50 rounded-lg p-3">
                        <div className="text-xs text-gray-500 mb-1">Net M1</div>
                        <div className={`font-medium ${kpis.netM1 >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          €{kpis.netM1.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </div>
                      </div>
                      <div className="bg-gray-900/50 rounded-lg p-3">
                        <div className="text-xs text-gray-500 mb-1">Trials</div>
                        <div className="font-medium">{kpis.trialCount}</div>
                      </div>
                      <div className="bg-gray-900/50 rounded-lg p-3">
                        <div className="text-xs text-gray-500 mb-1">1st Rebills</div>
                        <div className="font-medium">{kpis.firstRebillCount}</div>
                      </div>

                      {/* Total Period Metrics */}
                      <div className="col-span-2 md:col-span-4 lg:col-span-6 mt-2">
                        <div className="text-xs text-gray-500 uppercase tracking-wider mb-2">Total (Actividad en periodo)</div>
                      </div>

                      <div className="bg-gray-900/50 rounded-lg p-3">
                        <div className="text-xs text-gray-500 mb-1">Total Revenue</div>
                        <div className="font-medium">€{kpis.totalRevenueEur.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                      </div>
                      <div className="bg-gray-900/50 rounded-lg p-3">
                        <div className="text-xs text-gray-500 mb-1">Rebill Revenue</div>
                        <div className="font-medium">€{kpis.totalRebillRevenueEur.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                      </div>
                      <div className="bg-gray-900/50 rounded-lg p-3">
                        <div className="text-xs text-gray-500 mb-1">Total Refunds</div>
                        <div className="font-medium text-red-400">-€{kpis.totalRefundsEur.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                      </div>
                      <div className="bg-gray-900/50 rounded-lg p-3">
                        <div className="text-xs text-gray-500 mb-1">Net Total</div>
                        <div className={`font-medium ${kpis.netTotal >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          €{kpis.netTotal.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </div>
                      </div>
                      <div className="bg-gray-900/50 rounded-lg p-3">
                        <div className="text-xs text-gray-500 mb-1">Ad Spend</div>
                        <div className="font-medium">€{kpis.adSpendEur.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                      </div>
                      <div className="bg-gray-900/50 rounded-lg p-3">
                        <div className="text-xs text-gray-500 mb-1">Profit</div>
                        <div className={`font-medium ${kpis.profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          €{kpis.profit.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </div>
                      </div>

                      {/* KPIs */}
                      <div className="col-span-2 md:col-span-4 lg:col-span-6 mt-2">
                        <div className="text-xs text-gray-500 uppercase tracking-wider mb-2">KPIs</div>
                      </div>

                      <div className="bg-gray-900/50 rounded-lg p-3">
                        <div className="text-xs text-gray-500 mb-1">FRR</div>
                        <div className={`font-medium ${statusColors[frrStatus]}`}>{kpis.frr.toFixed(1)}%</div>
                      </div>
                      <div className="bg-gray-900/50 rounded-lg p-3">
                        <div className="text-xs text-gray-500 mb-1">CPT</div>
                        <div className={`font-medium ${statusColors[getStatus(kpis.cpt, { green: 30, yellow: 50 }, true)]}`}>
                          €{kpis.cpt.toFixed(0)}
                        </div>
                      </div>
                      <div className="bg-gray-900/50 rounded-lg p-3">
                        <div className="text-xs text-gray-500 mb-1">CPFR</div>
                        <div className={`font-medium ${statusColors[getStatus(kpis.cpfr, { green: 90, yellow: 150 }, true)]}`}>
                          €{kpis.cpfr.toFixed(0)}
                        </div>
                      </div>
                      <div className="bg-gray-900/50 rounded-lg p-3">
                        <div className="text-xs text-gray-500 mb-1">Payback M1</div>
                        <div className={`font-medium ${statusColors[paybackStatus]}`}>{kpis.paybackM1.toFixed(2)}x</div>
                      </div>
                      <div className="bg-gray-900/50 rounded-lg p-3">
                        <div className="text-xs text-gray-500 mb-1">Net ROAS</div>
                        <div className={`font-medium ${statusColors[getStatus(kpis.netRoas, { green: 1.5, yellow: 1.0 })]}`}>
                          {kpis.netRoas.toFixed(2)}x
                        </div>
                      </div>
                      <div className="bg-gray-900/50 rounded-lg p-3">
                        <div className="text-xs text-gray-500 mb-1">CTR</div>
                        <div className="font-medium">{kpis.ctr.toFixed(2)}%</div>
                      </div>

                      {/* Google Ads Metrics */}
                      {(kpis.impressions > 0 || kpis.clicks > 0) && (
                        <>
                          <div className="col-span-2 md:col-span-4 lg:col-span-6 mt-2">
                            <div className="text-xs text-gray-500 uppercase tracking-wider mb-2">Google Ads</div>
                          </div>

                          <div className="bg-gray-900/50 rounded-lg p-3">
                            <div className="text-xs text-gray-500 mb-1">Impressions</div>
                            <div className="font-medium">{kpis.impressions.toLocaleString()}</div>
                          </div>
                          <div className="bg-gray-900/50 rounded-lg p-3">
                            <div className="text-xs text-gray-500 mb-1">Clicks</div>
                            <div className="font-medium">{kpis.clicks.toLocaleString()}</div>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
