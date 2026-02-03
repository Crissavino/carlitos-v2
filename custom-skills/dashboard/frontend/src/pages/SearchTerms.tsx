import { useEffect, useState, useCallback, useMemo } from 'react';
import { RefreshCw, AlertTriangle, Target, TrendingUp, Search, X, Ban, BarChart3 } from 'lucide-react';
import { api, type SearchTermPerformanceResult, type SearchTermsSummary, type SearchTermsWasteResult, type SearchTermsQueryParams, type SearchTermPerformance, type SearchTermWasteAnalysis } from '../api/client';
import { GoogleAdsHeader, type DateRange } from '../components/GoogleAdsHeader';
import { PerformanceCards, type MetricCard } from '../components/PerformanceCards';
import { GoogleAdsTable, type Column, MatchTypeBadge, ConversionCell, ActionBadge } from '../components/GoogleAdsTable';
import { SpendChart, buildChartDataFromItems } from '../components/SpendChart';

const PAGE_SIZE = 50;

type ViewTab = 'all' | 'waste' | 'intent' | 'opportunities';

const INTENT_MISMATCH_PATTERNS = [
  'gratis', 'free', 'gratuito', 'ejemplo', 'example', 'sample',
  'plantilla', 'template', 'como', 'how to', 'tutorial',
  'que es', 'what is', 'descargar', 'download',
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
  const [showChart, setShowChart] = useState(false);

  // Campaigns list
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

  const handleRefresh = () => loadData({ page, campaign: filterCampaign });

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

  // Chart data
  const chartData = useMemo(() => {
    return buildChartDataFromItems(displayData, 'searchTerm', 8);
  }, [displayData]);

  // Performance cards
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
      { id: 'conversions', label: 'Acq/R1', value: `${acquisitions}/${firstRebills}`, color: 'green' as const },
      { id: 'cpfr', label: 'CPFR', value: cpfr > 0 ? `€${cpfr.toFixed(0)}` : '-', color: 'purple' as const },
      { id: 'ctr', label: 'CTR', value: impressions > 0 ? `${((clicks / impressions) * 100).toFixed(1)}%` : '-', color: 'gray' as const },
    ];
  }, [data]);

  // Table columns
  const columns: Column<SearchTermPerformance>[] = useMemo(() => [
    {
      id: 'searchTerm',
      header: 'Search term',
      accessor: (row) => {
        const hasIntent = hasIntentMismatch(row.searchTerm);
        if (hasIntent) {
          return (
            <div className="font-medium text-sm max-w-[200px]" title={row.searchTerm}>
              {row.searchTerm.split(new RegExp(`(${INTENT_MISMATCH_PATTERNS.join('|')})`, 'gi')).map((part, j) =>
                INTENT_MISMATCH_PATTERNS.some(p => part.toLowerCase() === p) ? (
                  <span key={j} className="bg-purple-200 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 px-0.5 rounded text-xs">{part}</span>
                ) : <span key={j}>{part}</span>
              )}
            </div>
          );
        }
        return (
          <div className="font-medium text-sm max-w-[200px] truncate" title={row.searchTerm}>
            {row.searchTerm}
          </div>
        );
      },
      sortAccessor: (row) => row.searchTerm,
      isPrimary: true,
    },
    {
      id: 'keyword',
      header: 'Keyword',
      accessor: (row) => (
        <span className="text-gray-500 text-xs max-w-[100px] truncate block" title={row.keywordText}>
          {row.keywordText || '-'}
        </span>
      ),
      hideOnMobile: true,
    },
    {
      id: 'matchType',
      header: 'Match',
      accessor: (row) => <MatchTypeBadge matchType={row.matchType} />,
      mobileLabel: 'Match',
    },
    {
      id: 'campaign',
      header: 'Campaña',
      accessor: (row) => (
        <span className="text-gray-500 text-xs max-w-[100px] truncate block" title={row.campaignName}>
          {row.campaignName}
        </span>
      ),
      hideOnMobile: true,
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
      mobileLabel: 'Conv',
    },
    {
      id: 'clicks',
      header: 'Clicks',
      accessor: (row) => <span className="text-xs">{row.clicks.toLocaleString()}</span>,
      sortAccessor: (row) => row.clicks,
      align: 'right',
      mobileLabel: 'Clicks',
    },
    {
      id: 'ctr',
      header: 'CTR',
      accessor: (row) => <span className="text-xs">{row.ctr.toFixed(1)}%</span>,
      sortAccessor: (row) => row.ctr,
      align: 'right',
      hideOnMobile: true,
    },
    {
      id: 'cost',
      header: 'Costo',
      accessor: (row) => <span className="text-xs font-medium">€{row.spend.toFixed(0)}</span>,
      sortAccessor: (row) => row.spend,
      align: 'right',
      mobileLabel: 'Costo',
    },
    {
      id: 'cpfr',
      header: 'CPFR',
      accessor: (row) => {
        const cpfr = row.firstRebills && row.firstRebills > 0 ? row.spend / row.firstRebills : null;
        return <span className="text-xs">{cpfr ? `€${cpfr.toFixed(0)}` : '-'}</span>;
      },
      sortAccessor: (row) => row.firstRebills && row.firstRebills > 0 ? row.spend / row.firstRebills : 99999,
      align: 'right',
      mobileLabel: 'CPFR',
    },
    {
      id: 'action',
      header: 'Acción',
      accessor: (row) => <ActionBadge action={row.recommendation} />,
      hideOnMobile: true,
    },
  ], []);

  // Waste columns
  const wasteColumns: Column<SearchTermWasteAnalysis>[] = useMemo(() => [
    {
      id: 'searchTerm',
      header: 'Search term',
      accessor: (row) => (
        <div className="font-medium text-sm max-w-[200px] truncate" title={row.searchTerm.searchTerm}>
          {row.searchTerm.searchTerm}
        </div>
      ),
      isPrimary: true,
    },
    {
      id: 'keyword',
      header: 'Keyword',
      accessor: (row) => (
        <div className="flex items-center gap-1">
          <span className="text-gray-500 text-xs truncate max-w-[80px]">{row.searchTerm.keywordText || '-'}</span>
          <MatchTypeBadge matchType={row.searchTerm.matchType} />
        </div>
      ),
      hideOnMobile: true,
    },
    {
      id: 'wastedSpend',
      header: 'Desperdicio',
      accessor: (row) => <span className="text-red-500 font-medium text-xs">€{row.wastedSpend.toFixed(0)}</span>,
      sortAccessor: (row) => row.wastedSpend,
      align: 'right',
      mobileLabel: 'Desp.',
    },
    {
      id: 'clicks',
      header: 'Clicks',
      accessor: (row) => <span className="text-xs">{row.searchTerm.clicks}</span>,
      sortAccessor: (row) => row.searchTerm.clicks,
      align: 'right',
      mobileLabel: 'Clicks',
    },
    {
      id: 'conversions',
      header: 'Acq/R1',
      accessor: (row) => (
        <ConversionCell
          acquisitions={row.searchTerm.acquisitions || 0}
          firstRebills={row.searchTerm.firstRebills || 0}
        />
      ),
      align: 'right',
      mobileLabel: 'Conv',
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
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 p-4">
        <div className="text-center">
          <div className="text-red-500 text-lg mb-2">Error</div>
          <div className="text-gray-400 text-sm mb-4">{error}</div>
          <button onClick={handleRefresh} className="px-4 py-2 bg-gray-800 rounded-lg text-sm">
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
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 p-3 md:p-6">
      <div className="max-w-[1600px] mx-auto">
        {/* Header */}
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
        />

        {/* Performance Cards */}
        <PerformanceCards cards={performanceCards} />

        {/* Tab Navigation - scrollable on mobile */}
        <div className="mb-3 overflow-x-auto -mx-3 px-3 md:mx-0 md:px-0">
          <div className="flex gap-1 min-w-max border-b border-gray-200 dark:border-gray-700 pb-px">
            <TabButton active={activeTab === 'all'} onClick={() => setActiveTab('all')} icon={<Search className="w-3 h-3" />} label="Todos" count={data?.filteredCount || 0} />
            <TabButton active={activeTab === 'waste'} onClick={() => setActiveTab('waste')} icon={<Ban className="w-3 h-3" />} label="Desp." count={wasteCount} color="red" />
            <TabButton active={activeTab === 'intent'} onClick={() => setActiveTab('intent')} icon={<Target className="w-3 h-3" />} label="Intent" count={intentMismatchCount} color="purple" />
            <TabButton active={activeTab === 'opportunities'} onClick={() => setActiveTab('opportunities')} icon={<TrendingUp className="w-3 h-3" />} label="Oport." count={opportunitiesCount} color="green" />
          </div>
        </div>

        {/* Chart toggle + Chart */}
        <div className="mb-3">
          <button
            onClick={() => setShowChart(!showChart)}
            className={`flex items-center gap-2 px-3 py-1.5 text-xs rounded-lg border transition ${
              showChart
                ? 'bg-blue-500 text-white border-blue-600'
                : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            {showChart ? 'Ocultar' : 'Gráfico'}
          </button>

          {showChart && (
            <div className="mt-3 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
              <SpendChart
                data={chartData}
                type="bar"
                height={160}
                metrics={['spend', 'clicks']}
                showLegend={true}
              />
            </div>
          )}
        </div>

        {/* Tab info alerts */}
        {activeTab === 'waste' && waste && wasteCount > 0 && (
          <div className="mb-3 p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <div className="flex items-center gap-2 text-xs">
              <AlertTriangle className="w-3 h-3 text-red-500" />
              <span className="text-red-700 dark:text-red-300">€{waste.totalEstimatedWaste.toFixed(0)} desperdiciado</span>
            </div>
          </div>
        )}

        {activeTab === 'intent' && (
          <div className="mb-3 p-2 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg">
            <div className="text-xs text-purple-700 dark:text-purple-300">
              Patrones: {INTENT_MISMATCH_PATTERNS.slice(0, 5).join(', ')}...
            </div>
          </div>
        )}

        {activeTab === 'opportunities' && (
          <div className="mb-3 p-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
            <div className="text-xs text-green-700 dark:text-green-300">
              Términos con R1 - candidatos a promover
            </div>
          </div>
        )}

        {/* Campaign filter badge */}
        {filterCampaign && (
          <div className="mb-3 flex items-center gap-2">
            <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded text-xs">
              {campaigns.find(c => c.id === filterCampaign)?.name.substring(0, 20)}...
              <button onClick={() => handleCampaignChange('')}><X className="w-3 h-3" /></button>
            </span>
          </div>
        )}

        {/* Results count */}
        <div className="mb-2 text-xs text-gray-500 text-right">
          {displayData.length} términos
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
            emptyMessage="Sin desperdicio"
            mobileColumns={['searchTerm', 'wastedSpend', 'clicks', 'conversions', 'action']}
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
            emptyMessage="Sin datos"
            mobileColumns={['searchTerm', 'matchType', 'conversions', 'clicks', 'cost', 'cpfr']}
          />
        )}
      </div>
    </div>
  );
}

// Tab Button component - mobile optimized
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

  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-colors whitespace-nowrap
        ${active ? colorStyles[color] : 'border-transparent text-gray-500 hover:text-gray-700'}`}
    >
      {icon}
      <span>{label}</span>
      <span className={`px-1 py-0.5 text-[10px] rounded ${active ? 'bg-gray-200 dark:bg-gray-700' : 'bg-gray-100 dark:bg-gray-800'}`}>
        {count}
      </span>
    </button>
  );
}
