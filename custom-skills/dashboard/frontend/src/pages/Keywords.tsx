import { useEffect, useState, useCallback, useMemo } from 'react';
import { RefreshCw, AlertTriangle, X, BarChart3 } from 'lucide-react';
import { api, type KeywordPerformanceResult, type KeywordsWasteResult, type KeywordsQueryParams, type KeywordPerformance } from '../api/client';
import { GoogleAdsHeader, type DateRange } from '../components/GoogleAdsHeader';
import { PerformanceCards, type MetricCard } from '../components/PerformanceCards';
import { GoogleAdsTable, type Column, MatchTypeBadge, ConversionCell, ActionBadge } from '../components/GoogleAdsTable';
import { SpendChart, buildChartDataFromItems } from '../components/SpendChart';

const PAGE_SIZE = 50;

export function Keywords() {
  const [data, setData] = useState<KeywordPerformanceResult | null>(null);
  const [waste, setWaste] = useState<KeywordsWasteResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  // Filters
  const [page, setPage] = useState(1);
  const [filterCampaign, setFilterCampaign] = useState<string>('');
  const [filterMatchType, setFilterMatchType] = useState<string>('');
  const [showWasteOnly, setShowWasteOnly] = useState(false);
  const [dateRange, setDateRange] = useState<DateRange>('7d');
  const [showChart, setShowChart] = useState(false);

  // Campaigns list
  const [campaigns, setCampaigns] = useState<{ id: string; name: string }[]>([]);

  const loadKeywords = useCallback(async (params: KeywordsQueryParams) => {
    setLoading(true);
    setError(null);
    try {
      const keywordsData = await api.getKeywords({
        page: params.page || 1,
        limit: PAGE_SIZE,
        hasSpend: true,
        campaign: params.campaign || undefined,
        matchType: params.matchType || undefined,
      });
      setData(keywordsData);
      setLastUpdate(new Date());

      // Extract unique campaigns on first load
      if (!params.campaign && !params.matchType && params.page === 1) {
        const uniqueCampaigns = [...new Map(keywordsData.keywords.map(k => [k.campaignId, { id: k.campaignId, name: k.campaignName }])).values()];
        setCampaigns(uniqueCampaigns.sort((a, b) => a.name.localeCompare(b.name)));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error cargando keywords');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadWaste = useCallback(async () => {
    try {
      const wasteData = await api.getKeywordsWaste().catch(() => null);
      setWaste(wasteData);
    } catch {
      // Silently fail
    }
  }, []);

  useEffect(() => {
    loadKeywords({ page, campaign: filterCampaign, matchType: filterMatchType });
  }, [page, filterCampaign, filterMatchType, loadKeywords]);

  useEffect(() => {
    loadWaste();
  }, [loadWaste]);

  const handleRefresh = () => {
    loadKeywords({ page, campaign: filterCampaign, matchType: filterMatchType });
    loadWaste();
  };

  const handleCampaignChange = (campaignId: string) => {
    setPage(1);
    setFilterCampaign(campaignId);
  };

  // Filter waste if toggle is on
  const displayKeywords = useMemo(() => {
    let keywords = data?.keywords || [];
    if (showWasteOnly && waste) {
      const wasteKeywordIds = new Set(waste.keywords.map(w => w.keyword.keywordId));
      keywords = keywords.filter(k => wasteKeywordIds.has(k.keywordId));
    }
    return keywords;
  }, [data, waste, showWasteOnly]);

  // Chart data
  const chartData = useMemo(() => {
    return buildChartDataFromItems(displayKeywords, 'keyword', 8);
  }, [displayKeywords]);

  // Performance cards
  const performanceCards: MetricCard[] = useMemo(() => {
    const keywords = data?.keywords || [];
    const clicks = keywords.reduce((sum, k) => sum + k.clicks, 0);
    const impressions = keywords.reduce((sum, k) => sum + k.impressions, 0);
    const spend = keywords.reduce((sum, k) => sum + k.spend7d, 0);
    const acquisitions = keywords.reduce((sum, k) => sum + (k.acquisitions || 0), 0);
    const firstRebills = keywords.reduce((sum, k) => sum + (k.firstRebills || 0), 0);
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
  const columns: Column<KeywordPerformance>[] = useMemo(() => [
    {
      id: 'keyword',
      header: 'Keyword',
      accessor: (row) => (
        <div className="font-medium text-sm max-w-[200px] truncate" title={row.keywordText}>
          {row.keywordText}
        </div>
      ),
      sortAccessor: (row) => row.keywordText,
      isPrimary: true,
    },
    {
      id: 'matchType',
      header: 'Match',
      accessor: (row) => <MatchTypeBadge matchType={row.matchType} />,
      sortAccessor: (row) => row.matchType,
      mobileLabel: 'Match',
    },
    {
      id: 'campaign',
      header: 'Campaña',
      accessor: (row) => (
        <span className="text-gray-500 text-xs max-w-[120px] truncate block" title={row.campaignName}>
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
      id: 'cpc',
      header: 'CPC',
      accessor: (row) => <span className="text-xs">€{row.cpc.toFixed(2)}</span>,
      sortAccessor: (row) => row.cpc,
      align: 'right',
      hideOnMobile: true,
    },
    {
      id: 'cost',
      header: 'Costo',
      accessor: (row) => <span className="text-xs font-medium">€{row.spend7d.toFixed(0)}</span>,
      sortAccessor: (row) => row.spend7d,
      align: 'right',
      mobileLabel: 'Costo',
    },
    {
      id: 'cpfr',
      header: 'CPFR',
      accessor: (row) => {
        const cpfr = row.firstRebills && row.firstRebills > 0 ? row.spend7d / row.firstRebills : null;
        return <span className="text-xs">{cpfr ? `€${cpfr.toFixed(0)}` : '-'}</span>;
      },
      sortAccessor: (row) => row.firstRebills && row.firstRebills > 0 ? row.spend7d / row.firstRebills : 99999,
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

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 p-3 md:p-6">
      <div className="max-w-[1600px] mx-auto">
        {/* Header */}
        <GoogleAdsHeader
          title="Keywords"
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
          totalItems={data?.filteredCount || data?.totalKeywords}
        />

        {/* Performance Cards */}
        <PerformanceCards cards={performanceCards} />

        {/* Chart toggle + Chart */}
        <div className="mb-4">
          <button
            onClick={() => setShowChart(!showChart)}
            className={`flex items-center gap-2 px-3 py-1.5 text-xs rounded-lg border transition ${
              showChart
                ? 'bg-blue-500 text-white border-blue-600'
                : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            {showChart ? 'Ocultar gráfico' : 'Ver gráfico'}
          </button>

          {showChart && (
            <div className="mt-3 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-3 md:p-4">
              <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Top Keywords por Gasto
              </div>
              <SpendChart
                data={chartData}
                type="bar"
                height={180}
                metrics={['spend', 'clicks']}
                showLegend={true}
              />
            </div>
          )}
        </div>

        {/* Waste Alert */}
        {waste && waste.count > 0 && !filterCampaign && (
          <div className="mb-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="font-medium text-red-800 dark:text-red-300 text-sm">
                  {waste.count} keywords desperdicio • €{waste.totalEstimatedWaste.toFixed(0)}
                </div>
                <button
                  onClick={() => setShowWasteOnly(!showWasteOnly)}
                  className={`mt-1 px-2 py-1 text-xs rounded ${
                    showWasteOnly
                      ? 'bg-red-500 text-white'
                      : 'bg-red-100 dark:bg-red-800 text-red-700 dark:text-red-300'
                  }`}
                >
                  {showWasteOnly ? 'Ver todas' : 'Solo desperdicio'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Filters - scrollable on mobile */}
        <div className="mb-3 flex items-center gap-2 overflow-x-auto pb-2 -mx-3 px-3 md:mx-0 md:px-0 md:flex-wrap">
          {/* Match Type */}
          <select
            value={filterMatchType}
            onChange={(e) => { setPage(1); setFilterMatchType(e.target.value); }}
            className="flex-shrink-0 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg px-2 py-1.5 text-xs md:text-sm"
          >
            <option value="">Todos</option>
            <option value="EXACT">EXACT</option>
            <option value="PHRASE">PHRASE</option>
            <option value="BROAD">BROAD</option>
          </select>

          {/* Active filter badges */}
          {filterCampaign && (
            <span className="flex-shrink-0 inline-flex items-center gap-1 px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded text-xs">
              {campaigns.find(c => c.id === filterCampaign)?.name.substring(0, 15)}...
              <button onClick={() => handleCampaignChange('')}><X className="w-3 h-3" /></button>
            </span>
          )}
          {filterMatchType && (
            <span className="flex-shrink-0 inline-flex items-center gap-1 px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded text-xs">
              {filterMatchType}
              <button onClick={() => { setPage(1); setFilterMatchType(''); }}><X className="w-3 h-3" /></button>
            </span>
          )}
          {showWasteOnly && (
            <span className="flex-shrink-0 inline-flex items-center gap-1 px-2 py-1 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded text-xs">
              Desperdicio
              <button onClick={() => setShowWasteOnly(false)}><X className="w-3 h-3" /></button>
            </span>
          )}

          {/* Results count */}
          <span className="ml-auto flex-shrink-0 text-xs text-gray-500">
            {displayKeywords.length}
            {data?.pagination && ` • ${data.pagination.page}/${data.pagination.totalPages}`}
          </span>
        </div>

        {/* Data Table */}
        <GoogleAdsTable
          columns={columns}
          data={displayKeywords}
          keyAccessor={(row) => row.keywordId}
          loading={loading}
          pagination={data?.pagination}
          onPageChange={setPage}
          defaultSortColumn="cost"
          defaultSortDirection="desc"
          emptyMessage="No hay keywords con gasto"
          mobileColumns={['keyword', 'matchType', 'conversions', 'clicks', 'cost', 'cpfr']}
        />
      </div>
    </div>
  );
}
