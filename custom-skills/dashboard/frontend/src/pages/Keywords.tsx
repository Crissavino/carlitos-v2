import { useEffect, useState, useCallback, useMemo } from 'react';
import { RefreshCw, Filter, AlertTriangle, X } from 'lucide-react';
import { api, type KeywordPerformanceResult, type KeywordsSummary, type KeywordsWasteResult, type KeywordsQueryParams, type KeywordPerformance } from '../api/client';
import { GoogleAdsHeader, type DateRange } from '../components/GoogleAdsHeader';
import { PerformanceCards, type MetricCard } from '../components/PerformanceCards';
import { GoogleAdsTable, type Column, MatchTypeBadge, ConversionCell, ActionBadge, PerformanceIndicator, StatusDot } from '../components/GoogleAdsTable';

const PAGE_SIZE = 50;

export function Keywords() {
  const [data, setData] = useState<KeywordPerformanceResult | null>(null);
  const [summary, setSummary] = useState<KeywordsSummary | null>(null);
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

  // Derived campaigns list
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

      // Extract unique campaigns from first load
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

  const loadSummaryAndWaste = useCallback(async () => {
    try {
      const [summaryData, wasteData] = await Promise.all([
        api.getKeywordsSummary().catch(() => null),
        api.getKeywordsWaste().catch(() => null),
      ]);
      setSummary(summaryData);
      setWaste(wasteData);
    } catch {
      // Silently fail
    }
  }, []);

  useEffect(() => {
    loadKeywords({ page, campaign: filterCampaign, matchType: filterMatchType });
  }, [page, filterCampaign, filterMatchType, loadKeywords]);

  useEffect(() => {
    loadSummaryAndWaste();
  }, [loadSummaryAndWaste]);

  const handleRefresh = () => {
    loadKeywords({ page, campaign: filterCampaign, matchType: filterMatchType });
    loadSummaryAndWaste();
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

  // Build performance cards
  const performanceCards: MetricCard[] = useMemo(() => {
    if (!summary) return [];

    // Calculate totals from filtered data if campaign selected
    const keywords = data?.keywords || [];
    const filteredTotals = filterCampaign ? {
      clicks: keywords.reduce((sum, k) => sum + k.clicks, 0),
      impressions: keywords.reduce((sum, k) => sum + k.impressions, 0),
      spend: keywords.reduce((sum, k) => sum + k.spend7d, 0),
      acquisitions: keywords.reduce((sum, k) => sum + (k.acquisitions || 0), 0),
      firstRebills: keywords.reduce((sum, k) => sum + (k.firstRebills || 0), 0),
    } : null;

    const clicks = filteredTotals?.clicks ?? keywords.reduce((sum, k) => sum + k.clicks, 0);
    const impressions = filteredTotals?.impressions ?? keywords.reduce((sum, k) => sum + k.impressions, 0);
    const spend = filteredTotals?.spend ?? summary.totalSpend;
    const acquisitions = filteredTotals?.acquisitions ?? keywords.reduce((sum, k) => sum + (k.acquisitions || 0), 0);
    const firstRebills = filteredTotals?.firstRebills ?? keywords.reduce((sum, k) => sum + (k.firstRebills || 0), 0);
    const cpfr = firstRebills > 0 ? spend / firstRebills : 0;

    return [
      { id: 'clicks', label: 'Clicks', value: clicks, color: 'blue' as const },
      { id: 'impressions', label: 'Impr.', value: impressions, color: 'red' as const },
      { id: 'cost', label: 'Costo', value: `€${spend.toFixed(0)}`, color: 'gray' as const },
      { id: 'ctr', label: 'CTR', value: impressions > 0 ? `${((clicks / impressions) * 100).toFixed(2)}%` : '-', color: 'gray' as const },
      { id: 'conversions', label: 'Acq/R1', value: `${acquisitions}/${firstRebills}`, color: 'green' as const, tooltip: 'Adquisiciones / Primer Rebill (de nuestra DB)' },
      { id: 'cpfr', label: 'CPFR', value: cpfr > 0 ? `€${cpfr.toFixed(0)}` : '-', color: 'purple' as const, tooltip: 'Cost Per First Rebill' },
    ];
  }, [summary, data, filterCampaign]);

  // Table columns - Google Ads style
  const columns: Column<KeywordPerformance>[] = useMemo(() => [
    {
      id: 'status',
      header: '',
      accessor: () => <StatusDot active={true} />,
      width: 'w-8',
    },
    {
      id: 'keyword',
      header: 'Keyword',
      accessor: (row) => (
        <div className="font-medium max-w-[200px] truncate" title={row.keywordText}>
          {row.keywordText}
        </div>
      ),
      sortAccessor: (row) => row.keywordText,
    },
    {
      id: 'matchType',
      header: 'Match type',
      accessor: (row) => <MatchTypeBadge matchType={row.matchType} />,
      sortAccessor: (row) => row.matchType,
    },
    {
      id: 'adGroup',
      header: 'Ad group',
      accessor: (row) => (
        <span className="text-gray-500 dark:text-gray-400 max-w-[120px] truncate block" title={row.adGroupName}>
          {row.adGroupName}
        </span>
      ),
    },
    {
      id: 'campaign',
      header: 'Campaña',
      accessor: (row) => (
        <span className="text-gray-500 dark:text-gray-400 max-w-[150px] truncate block" title={row.campaignName}>
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
      id: 'cpc',
      header: 'Avg. CPC',
      accessor: (row) => `€${row.cpc.toFixed(2)}`,
      sortAccessor: (row) => row.cpc,
      align: 'right',
    },
    {
      id: 'cost',
      header: 'Costo',
      accessor: (row) => `€${row.spend7d.toFixed(2)}`,
      sortAccessor: (row) => row.spend7d,
      align: 'right',
    },
    {
      id: 'cpfr',
      header: 'CPFR',
      accessor: (row) => {
        const cpfr = row.firstRebills && row.firstRebills > 0 ? row.spend7d / row.firstRebills : null;
        return cpfr ? `€${cpfr.toFixed(0)}` : '-';
      },
      sortAccessor: (row) => row.firstRebills && row.firstRebills > 0 ? row.spend7d / row.firstRebills : 99999,
      align: 'right',
      tooltip: 'Cost Per First Rebill',
    },
    {
      id: 'performance',
      header: '',
      accessor: (row) => <PerformanceIndicator status={row.performanceStatus} />,
      width: 'w-8',
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

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 p-6">
      <div className="max-w-[1600px] mx-auto">
        {/* Google Ads Header */}
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
          currency="€"
        />

        {/* Performance Cards */}
        <PerformanceCards cards={performanceCards} />

        {/* Waste Alert */}
        {waste && waste.count > 0 && !filterCampaign && (
          <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <div className="font-medium text-red-800 dark:text-red-300">
                {waste.count} keywords marcadas como desperdicio
              </div>
              <div className="text-sm text-red-600 dark:text-red-400 mt-1">
                €{waste.totalEstimatedWaste.toFixed(0)} desperdiciado en los últimos 7 días
              </div>
              <div className="flex gap-4 mt-2 text-xs text-red-500 dark:text-red-400">
                <span>Sin conv: {waste.byFlag.HIGH_SPEND_ZERO_CONV}</span>
                <span>Baja conv: {waste.byFlag.HIGH_SPEND_LOW_CONV}</span>
                <span>Concentrado: {waste.byFlag.SPEND_CONCENTRATION}</span>
              </div>
            </div>
            <button
              onClick={() => setShowWasteOnly(!showWasteOnly)}
              className={`px-3 py-1.5 text-sm rounded transition ${
                showWasteOnly
                  ? 'bg-red-500 text-white'
                  : 'bg-red-100 dark:bg-red-800 text-red-700 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-700'
              }`}
            >
              {showWasteOnly ? 'Ver todas' : 'Ver solo desperdicio'}
            </button>
          </div>
        )}

        {/* Secondary Filters */}
        <div className="mb-4 flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Filter className="w-4 h-4" />
            <span>Filtros:</span>
          </div>

          {/* Match Type */}
          <select
            value={filterMatchType}
            onChange={(e) => { setPage(1); setFilterMatchType(e.target.value); }}
            className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md px-3 py-1.5 text-sm"
          >
            <option value="">Todos los tipos</option>
            <option value="EXACT">EXACT</option>
            <option value="PHRASE">PHRASE</option>
            <option value="BROAD">BROAD</option>
          </select>

          {/* Active filters badges */}
          {(filterCampaign || filterMatchType || showWasteOnly) && (
            <div className="flex items-center gap-2">
              {filterCampaign && (
                <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded text-xs">
                  Campaña: {campaigns.find(c => c.id === filterCampaign)?.name.substring(0, 20)}...
                  <button onClick={() => handleCampaignChange('')}><X className="w-3 h-3" /></button>
                </span>
              )}
              {filterMatchType && (
                <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded text-xs">
                  {filterMatchType}
                  <button onClick={() => { setPage(1); setFilterMatchType(''); }}><X className="w-3 h-3" /></button>
                </span>
              )}
              {showWasteOnly && (
                <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded text-xs">
                  Solo desperdicio
                  <button onClick={() => setShowWasteOnly(false)}><X className="w-3 h-3" /></button>
                </span>
              )}
            </div>
          )}

          {/* Results count */}
          <div className="ml-auto text-sm text-gray-500">
            {displayKeywords.length} keywords
            {data?.pagination && ` (pág ${data.pagination.page}/${data.pagination.totalPages})`}
          </div>
        </div>

        {/* Match Type Summary */}
        {summary?.byMatchType && !filterCampaign && (
          <div className="mb-4 flex gap-3">
            {Object.entries(summary.byMatchType).map(([matchType, stats]) => (
              <button
                key={matchType}
                onClick={() => { setPage(1); setFilterMatchType(filterMatchType === matchType ? '' : matchType); }}
                className={`px-4 py-2 rounded-lg border text-sm transition ${
                  filterMatchType === matchType
                    ? 'bg-blue-500 text-white border-blue-600'
                    : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-500'
                }`}
              >
                <span className="font-medium">{matchType}</span>
                <span className="text-gray-500 dark:text-gray-400 ml-2">{stats.count}</span>
              </button>
            ))}
          </div>
        )}

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
          emptyMessage="No hay keywords con gasto en este periodo"
        />

        {/* Legend */}
        <div className="mt-6 p-4 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="text-sm text-gray-500 dark:text-gray-400 mb-2">Leyenda</div>
          <div className="flex flex-wrap gap-6 text-xs">
            <div className="flex items-center gap-2">
              <MatchTypeBadge matchType="EXACT" />
              <span className="text-gray-500">Coincidencia exacta</span>
            </div>
            <div className="flex items-center gap-2">
              <MatchTypeBadge matchType="PHRASE" />
              <span className="text-gray-500">Frase</span>
            </div>
            <div className="flex items-center gap-2">
              <MatchTypeBadge matchType="BROAD" />
              <span className="text-gray-500">Amplia</span>
            </div>
            <div className="flex items-center gap-2 border-l pl-6 border-gray-200 dark:border-gray-700">
              <span className="text-blue-600">Acq</span>
              <span className="text-gray-400">=</span>
              <span className="text-gray-500">Trials</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-green-600">R1</span>
              <span className="text-gray-400">=</span>
              <span className="text-gray-500">Primer Rebill (de nuestra DB)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-purple-600">CPFR</span>
              <span className="text-gray-400">=</span>
              <span className="text-gray-500">Cost / R1</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
