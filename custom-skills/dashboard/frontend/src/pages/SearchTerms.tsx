import { useEffect, useState, useCallback, useMemo } from 'react';
import { RefreshCw, Filter, AlertTriangle, Target, TrendingUp, Search, X, Ban } from 'lucide-react';
import { api, type SearchTermPerformanceResult, type SearchTermsSummary, type SearchTermsWasteResult, type SearchTermsQueryParams, type SearchTermPerformance, type SearchTermWasteAnalysis } from '../api/client';
import { GoogleAdsHeader, type DateRange } from '../components/GoogleAdsHeader';
import { PerformanceCards, type MetricCard } from '../components/PerformanceCards';
import { GoogleAdsTable, type Column, MatchTypeBadge, ConversionCell, ActionBadge, PerformanceIndicator } from '../components/GoogleAdsTable';

const PAGE_SIZE = 50;

type ViewTab = 'all' | 'waste' | 'intent' | 'opportunities';

// Intent mismatch patterns
const INTENT_MISMATCH_PATTERNS = [
  'gratis', 'free', 'gratuito',
  'ejemplo', 'example', 'sample',
  'plantilla', 'template',
  'como', 'how to', 'tutorial',
  'que es', 'what is',
  'descargar', 'download',
];

function hasIntentMismatch(searchTerm: string): boolean {
  const lower = searchTerm.toLowerCase();
  return INTENT_MISMATCH_PATTERNS.some(pattern => lower.includes(pattern));
}

export function SearchTerms() {
  const [data, setData] = useState<SearchTermPerformanceResult | null>(null);
  const [summary, setSummary] = useState<SearchTermsSummary | null>(null);
  const [waste, setWaste] = useState<SearchTermsWasteResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  // View & Filters
  const [activeTab, setActiveTab] = useState<ViewTab>('all');
  const [page, setPage] = useState(1);
  const [filterCampaign, setFilterCampaign] = useState<string>('');
  const [dateRange, setDateRange] = useState<DateRange>('7d');

  // Derived campaigns list
  const [campaigns, setCampaigns] = useState<{ id: string; name: string }[]>([]);

  const loadData = useCallback(async (params?: SearchTermsQueryParams) => {
    setLoading(true);
    setError(null);
    try {
      const [searchTermsData, summaryData, wasteData] = await Promise.all([
        api.getSearchTerms({
          page: params?.page || 1,
          limit: PAGE_SIZE,
          hasSpend: true,
          campaign: params?.campaign || undefined,
        }),
        api.getSearchTermsSummary().catch(() => null),
        api.getSearchTermsWaste().catch(() => null),
      ]);

      setData(searchTermsData);
      setSummary(summaryData);
      setWaste(wasteData);
      setLastUpdate(new Date());

      // Extract unique campaigns
      if (!params?.campaign && params?.page === 1) {
        const uniqueCampaigns = [...new Map(searchTermsData.searchTerms.map(st => [st.campaignId, { id: st.campaignId, name: st.campaignName }])).values()];
        setCampaigns(uniqueCampaigns.sort((a, b) => a.name.localeCompare(b.name)));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error cargando datos');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData({ page, campaign: filterCampaign });
  }, [page, filterCampaign, loadData]);

  const handleRefresh = () => {
    loadData({ page, campaign: filterCampaign });
  };

  const handleCampaignChange = (campaignId: string) => {
    setPage(1);
    setFilterCampaign(campaignId);
  };

  // Filter data based on active tab
  const displayData = useMemo(() => {
    const searchTerms = data?.searchTerms || [];

    switch (activeTab) {
      case 'waste':
        if (!waste) return [];
        const wasteTerms = new Set(waste.searchTerms.map(w => w.searchTerm.searchTerm));
        return searchTerms.filter(st => wasteTerms.has(st.searchTerm));
      case 'intent':
        return searchTerms.filter(st => hasIntentMismatch(st.searchTerm));
      case 'opportunities':
        return searchTerms.filter(st => (st.firstRebills || 0) > 0).sort((a, b) => (b.firstRebills || 0) - (a.firstRebills || 0));
      default:
        return searchTerms;
    }
  }, [data, waste, activeTab]);

  // Build performance cards
  const performanceCards: MetricCard[] = useMemo(() => {
    const searchTerms = data?.searchTerms || [];
    const clicks = searchTerms.reduce((sum, st) => sum + st.clicks, 0);
    const impressions = searchTerms.reduce((sum, st) => sum + st.impressions, 0);
    const spend = searchTerms.reduce((sum, st) => sum + st.spend, 0);
    const acquisitions = searchTerms.reduce((sum, st) => sum + (st.acquisitions || 0), 0);
    const firstRebills = searchTerms.reduce((sum, st) => sum + (st.firstRebills || 0), 0);
    const cpfr = firstRebills > 0 ? spend / firstRebills : 0;

    return [
      { id: 'clicks', label: 'Clicks', value: clicks, color: 'blue' as const },
      { id: 'impressions', label: 'Impr.', value: impressions, color: 'red' as const },
      { id: 'cost', label: 'Costo', value: `€${spend.toFixed(0)}`, color: 'gray' as const },
      { id: 'ctr', label: 'CTR', value: impressions > 0 ? `${((clicks / impressions) * 100).toFixed(2)}%` : '-', color: 'gray' as const },
      { id: 'conversions', label: 'Acq/R1', value: `${acquisitions}/${firstRebills}`, color: 'green' as const, tooltip: 'Adquisiciones / Primer Rebill (de nuestra DB)' },
      { id: 'cpfr', label: 'CPFR', value: cpfr > 0 ? `€${cpfr.toFixed(0)}` : '-', color: 'purple' as const, tooltip: 'Cost Per First Rebill' },
    ];
  }, [data]);

  // Table columns
  const columns: Column<SearchTermPerformance>[] = useMemo(() => [
    {
      id: 'performance',
      header: '',
      accessor: (row) => <PerformanceIndicator status={row.performanceStatus} />,
      width: 'w-8',
    },
    {
      id: 'searchTerm',
      header: 'Search term',
      accessor: (row) => {
        // Highlight intent mismatch patterns
        const hasIntent = hasIntentMismatch(row.searchTerm);
        if (hasIntent) {
          return (
            <div className="font-medium max-w-[250px]" title={row.searchTerm}>
              {row.searchTerm.split(new RegExp(`(${INTENT_MISMATCH_PATTERNS.join('|')})`, 'gi')).map((part, j) =>
                INTENT_MISMATCH_PATTERNS.some(p => part.toLowerCase() === p) ? (
                  <span key={j} className="bg-purple-200 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 px-0.5 rounded">{part}</span>
                ) : (
                  <span key={j}>{part}</span>
                )
              )}
            </div>
          );
        }
        return (
          <div className="font-medium max-w-[250px] truncate" title={row.searchTerm}>
            {row.searchTerm}
          </div>
        );
      },
      sortAccessor: (row) => row.searchTerm,
    },
    {
      id: 'keyword',
      header: 'Keyword',
      accessor: (row) => (
        <span className="text-gray-500 dark:text-gray-400 max-w-[150px] truncate block" title={row.keywordText}>
          {row.keywordText || '-'}
        </span>
      ),
    },
    {
      id: 'matchType',
      header: 'Match',
      accessor: (row) => <MatchTypeBadge matchType={row.matchType} />,
      sortAccessor: (row) => row.matchType,
    },
    {
      id: 'campaign',
      header: 'Campaña',
      accessor: (row) => (
        <span className="text-gray-500 dark:text-gray-400 max-w-[120px] truncate block" title={row.campaignName}>
          {row.campaignName}
        </span>
      ),
    },
    {
      id: 'conversions',
      header: 'Acq/R1',
      accessor: (row) => (
        <ConversionCell
          acquisitions={row.acquisitions || 0}
          firstRebills={row.firstRebills || 0}
          attributionLevel={row.attributionLevel}
        />
      ),
      sortAccessor: (row) => row.firstRebills || 0,
      align: 'right',
      tooltip: 'Adquisiciones / Primer Rebill (de nuestra DB)',
    },
    {
      id: 'clicks',
      header: 'Clicks',
      accessor: (row) => row.clicks.toLocaleString(),
      sortAccessor: (row) => row.clicks,
      align: 'right',
    },
    {
      id: 'impressions',
      header: 'Impr.',
      accessor: (row) => row.impressions.toLocaleString(),
      sortAccessor: (row) => row.impressions,
      align: 'right',
    },
    {
      id: 'ctr',
      header: 'CTR',
      accessor: (row) => `${row.ctr.toFixed(2)}%`,
      sortAccessor: (row) => row.ctr,
      align: 'right',
    },
    {
      id: 'cost',
      header: 'Costo',
      accessor: (row) => `€${row.spend.toFixed(2)}`,
      sortAccessor: (row) => row.spend,
      align: 'right',
    },
    {
      id: 'cpfr',
      header: 'CPFR',
      accessor: (row) => {
        const cpfr = row.firstRebills && row.firstRebills > 0 ? row.spend / row.firstRebills : null;
        return cpfr ? `€${cpfr.toFixed(0)}` : '-';
      },
      sortAccessor: (row) => row.firstRebills && row.firstRebills > 0 ? row.spend / row.firstRebills : 99999,
      align: 'right',
      tooltip: 'Cost Per First Rebill',
    },
    {
      id: 'action',
      header: 'Acción',
      accessor: (row) => <ActionBadge action={row.recommendation} />,
    },
  ], []);

  // Waste table columns (different view)
  const wasteColumns: Column<SearchTermWasteAnalysis>[] = useMemo(() => [
    {
      id: 'searchTerm',
      header: 'Search term',
      accessor: (row) => (
        <div className="font-medium max-w-[250px] truncate" title={row.searchTerm.searchTerm}>
          {row.searchTerm.searchTerm}
        </div>
      ),
      sortAccessor: (row) => row.searchTerm.searchTerm,
    },
    {
      id: 'keyword',
      header: 'Keyword',
      accessor: (row) => (
        <div className="flex items-center gap-2">
          <span className="text-gray-500 dark:text-gray-400 max-w-[120px] truncate" title={row.searchTerm.keywordText}>
            {row.searchTerm.keywordText || '-'}
          </span>
          <MatchTypeBadge matchType={row.searchTerm.matchType} />
        </div>
      ),
    },
    {
      id: 'campaign',
      header: 'Campaña',
      accessor: (row) => (
        <span className="text-gray-500 dark:text-gray-400 max-w-[120px] truncate block" title={row.searchTerm.campaignName}>
          {row.searchTerm.campaignName}
        </span>
      ),
    },
    {
      id: 'wastedSpend',
      header: 'Desperdicio',
      accessor: (row) => <span className="text-red-500 font-medium">€{row.wastedSpend.toFixed(2)}</span>,
      sortAccessor: (row) => row.wastedSpend,
      align: 'right',
    },
    {
      id: 'clicks',
      header: 'Clicks',
      accessor: (row) => row.searchTerm.clicks.toLocaleString(),
      sortAccessor: (row) => row.searchTerm.clicks,
      align: 'right',
    },
    {
      id: 'conversions',
      header: 'Acq/R1',
      accessor: (row) => (
        <ConversionCell
          acquisitions={row.searchTerm.acquisitions || 0}
          firstRebills={row.searchTerm.firstRebills || 0}
          attributionLevel={row.searchTerm.attributionLevel}
        />
      ),
      align: 'right',
    },
    {
      id: 'flags',
      header: 'Alertas',
      accessor: (row) => (
        <div className="flex gap-1 flex-wrap">
          {row.wasteFlags.map(flag => {
            const labels: Record<string, string> = {
              HIGH_SPEND_ZERO_CONV: 'Sin Conv',
              HIGH_SPEND_LOW_CONV: 'Baja Conv',
              SPEND_CONCENTRATION: 'Concentrado',
              REPEAT_WASTE: 'Repetido',
            };
            const colors: Record<string, string> = {
              HIGH_SPEND_ZERO_CONV: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
              HIGH_SPEND_LOW_CONV: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
              SPEND_CONCENTRATION: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
              REPEAT_WASTE: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
            };
            return (
              <span key={flag} className={`px-1.5 py-0.5 text-xs rounded ${colors[flag] || ''}`}>
                {labels[flag] || flag}
              </span>
            );
          })}
        </div>
      ),
    },
    {
      id: 'action',
      header: 'Acción',
      accessor: (row) => <ActionBadge action={row.recommendation} />,
    },
  ], []);

  if (loading && !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
        <RefreshCw className="w-8 h-8 animate-spin text-gray-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
        <div className="text-center">
          <div className="text-red-500 text-xl mb-4">Error</div>
          <div className="text-gray-400 mb-4">{error}</div>
          <button onClick={handleRefresh} className="px-4 py-2 bg-gray-800 rounded-lg hover:bg-gray-700 transition">
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  const wasteCount = waste?.count || 0;
  const intentMismatchCount = summary?.intentMismatchCount || 0;
  const opportunitiesCount = (data?.searchTerms || []).filter(st => (st.firstRebills || 0) > 0).length;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 p-6">
      <div className="max-w-[1600px] mx-auto">
        {/* Google Ads Header */}
        <GoogleAdsHeader
          title="Search terms"
          subtitle={filterCampaign ? campaigns.find(c => c.id === filterCampaign)?.name : undefined}
          campaigns={campaigns}
          selectedCampaign={filterCampaign}
          onCampaignChange={handleCampaignChange}
          dateRange={dateRange}
          onDateRangeChange={setDateRange}
          onRefresh={handleRefresh}
          loading={loading}
          lastUpdate={lastUpdate || undefined}
          totalSpend={data?.totalSpend}
          totalItems={data?.filteredCount || data?.totalSearchTerms}
          currency="€"
        />

        {/* Performance Cards */}
        <PerformanceCards cards={performanceCards} />

        {/* Tab Navigation - Google Ads style */}
        <div className="mb-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex gap-1">
            <TabButton
              active={activeTab === 'all'}
              onClick={() => setActiveTab('all')}
              icon={<Search className="w-4 h-4" />}
              label="Todos"
              count={data?.filteredCount || data?.totalSearchTerms || 0}
            />
            <TabButton
              active={activeTab === 'waste'}
              onClick={() => setActiveTab('waste')}
              icon={<Ban className="w-4 h-4" />}
              label="Desperdicio"
              count={wasteCount}
              color="red"
            />
            <TabButton
              active={activeTab === 'intent'}
              onClick={() => setActiveTab('intent')}
              icon={<Target className="w-4 h-4" />}
              label="Intent. Incorrecta"
              count={intentMismatchCount}
              color="purple"
            />
            <TabButton
              active={activeTab === 'opportunities'}
              onClick={() => setActiveTab('opportunities')}
              icon={<TrendingUp className="w-4 h-4" />}
              label="Oportunidades"
              count={opportunitiesCount}
              color="green"
            />
          </div>
        </div>

        {/* Active Filters */}
        {filterCampaign && (
          <div className="mb-4 flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-500" />
            <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded text-xs">
              Campaña: {campaigns.find(c => c.id === filterCampaign)?.name.substring(0, 30)}...
              <button onClick={() => handleCampaignChange('')}><X className="w-3 h-3" /></button>
            </span>
          </div>
        )}

        {/* Waste Summary (when on waste tab) */}
        {activeTab === 'waste' && waste && wasteCount > 0 && (
          <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <div className="flex items-center gap-3 mb-2">
              <AlertTriangle className="w-5 h-5 text-red-500" />
              <span className="font-medium text-red-800 dark:text-red-300">
                €{waste.totalEstimatedWaste.toFixed(0)} desperdiciado estimado
              </span>
            </div>
            <div className="flex gap-6 text-sm text-red-600 dark:text-red-400">
              <span>Sin conv: {waste.byFlag.HIGH_SPEND_ZERO_CONV}</span>
              <span>Baja conv: {waste.byFlag.HIGH_SPEND_LOW_CONV}</span>
              <span>Concentrado: {waste.byFlag.SPEND_CONCENTRATION}</span>
              <span>Repetido: {waste.byFlag.REPEAT_WASTE}</span>
            </div>
          </div>
        )}

        {/* Intent Mismatch Info (when on intent tab) */}
        {activeTab === 'intent' && (
          <div className="mb-4 p-4 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg">
            <div className="flex items-center gap-3 mb-2">
              <Target className="w-5 h-5 text-purple-500" />
              <span className="font-medium text-purple-800 dark:text-purple-300">
                Patrones de intención incorrecta detectados
              </span>
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              {INTENT_MISMATCH_PATTERNS.slice(0, 10).map(pattern => (
                <span key={pattern} className="px-2 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded">
                  {pattern}
                </span>
              ))}
              <span className="text-purple-500">+{INTENT_MISMATCH_PATTERNS.length - 10} más</span>
            </div>
          </div>
        )}

        {/* Opportunities Info (when on opportunities tab) */}
        {activeTab === 'opportunities' && (
          <div className="mb-4 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
            <div className="flex items-center gap-3">
              <TrendingUp className="w-5 h-5 text-green-500" />
              <span className="font-medium text-green-800 dark:text-green-300">
                Términos con conversiones reales (R1) - candidatos para promover a keyword
              </span>
            </div>
          </div>
        )}

        {/* Results count */}
        <div className="mb-4 text-sm text-gray-500 text-right">
          {displayData.length} términos
          {activeTab === 'all' && data?.pagination && ` (pág ${data.pagination.page}/${data.pagination.totalPages})`}
        </div>

        {/* Data Table */}
        {activeTab === 'waste' && waste ? (
          <GoogleAdsTable
            columns={wasteColumns}
            data={waste.searchTerms}
            keyAccessor={(row) => row.searchTerm.searchTerm + row.searchTerm.campaignId}
            loading={loading}
            defaultSortColumn="wastedSpend"
            defaultSortDirection="desc"
            emptyMessage="No hay términos de búsqueda desperdiciados"
          />
        ) : (
          <GoogleAdsTable
            columns={columns}
            data={displayData}
            keyAccessor={(row) => row.searchTerm + row.campaignId}
            loading={loading}
            pagination={activeTab === 'all' ? data?.pagination : undefined}
            onPageChange={activeTab === 'all' ? setPage : undefined}
            defaultSortColumn="cost"
            defaultSortDirection="desc"
            emptyMessage={
              activeTab === 'intent' ? 'No hay términos con intención incorrecta' :
              activeTab === 'opportunities' ? 'No hay términos con conversiones' :
              'No hay términos de búsqueda con gasto'
            }
          />
        )}

        {/* Legend */}
        <div className="mt-6 p-4 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="text-sm text-gray-500 dark:text-gray-400 mb-2">Leyenda</div>
          <div className="flex flex-wrap gap-6 text-xs">
            <div className="flex items-center gap-2">
              <span className="text-blue-600">Acq</span>
              <span className="text-gray-400">=</span>
              <span className="text-gray-500">Trials (adquisiciones)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-green-600">R1</span>
              <span className="text-gray-400">=</span>
              <span className="text-gray-500">Primer Rebill (de nuestra DB vía utm_term)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-purple-600">CPFR</span>
              <span className="text-gray-400">=</span>
              <span className="text-gray-500">Costo / R1</span>
            </div>
            <div className="flex items-center gap-2 border-l pl-6 border-gray-200 dark:border-gray-700">
              <span className="text-gray-500">* = atribución por campaña (sin utm_term)</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Tab Button component
function TabButton({
  active,
  onClick,
  icon,
  label,
  count,
  color = 'blue'
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  count: number;
  color?: 'blue' | 'red' | 'purple' | 'green';
}) {
  const colorStyles = {
    blue: active ? 'border-blue-500 text-blue-600' : '',
    red: active ? 'border-red-500 text-red-600' : '',
    purple: active ? 'border-purple-500 text-purple-600' : '',
    green: active ? 'border-green-500 text-green-600' : '',
  };

  const countColors = {
    blue: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    red: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    purple: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
    green: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  };

  return (
    <button
      onClick={onClick}
      className={`
        flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors
        ${active
          ? `${colorStyles[color]} border-current`
          : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300'
        }
      `}
    >
      {icon}
      <span>{label}</span>
      <span className={`px-1.5 py-0.5 text-xs rounded ${active ? countColors[color] : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'}`}>
        {count}
      </span>
    </button>
  );
}
