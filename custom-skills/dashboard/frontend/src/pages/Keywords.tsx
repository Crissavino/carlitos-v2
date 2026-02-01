import { useEffect, useState, useCallback } from 'react';
import { RefreshCw, Clock, AlertTriangle, TrendingUp, Filter, ChevronLeft, ChevronRight } from 'lucide-react';
import { api, type KeywordPerformanceResult, type KeywordsSummary, type KeywordsWasteResult, type KeywordsQueryParams } from '../api/client';
import { KeywordsTable } from '../components/KeywordsTable';

const MATCH_TYPE_COLORS: Record<string, string> = {
  EXACT: 'bg-green-500/20 text-green-400 border-green-500/30',
  PHRASE: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  BROAD: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
};

const PAGE_SIZE = 50;

export function Keywords() {
  const [data, setData] = useState<KeywordPerformanceResult | null>(null);
  const [summary, setSummary] = useState<KeywordsSummary | null>(null);
  const [waste, setWaste] = useState<KeywordsWasteResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  // Filters & Pagination (server-side)
  const [page, setPage] = useState(1);
  const [filterCampaign, setFilterCampaign] = useState<string>('');
  const [filterMatchType, setFilterMatchType] = useState<string>('');
  const [showWasteOnly, setShowWasteOnly] = useState(false);
  const [campaigns, setCampaigns] = useState<string[]>([]);

  const loadKeywords = useCallback(async (params: KeywordsQueryParams) => {
    setLoading(true);
    setError(null);
    try {
      const keywordsData = await api.getKeywords({
        page: params.page || 1,
        limit: PAGE_SIZE,
        hasSpend: true, // Only show keywords with spend
        campaign: params.campaign || undefined,
        matchType: params.matchType || undefined,
      });
      setData(keywordsData);
      setLastUpdate(new Date());

      // Extract unique campaigns from first load for filter dropdown
      if (!params.campaign && !params.matchType && params.page === 1) {
        const uniqueCampaigns = [...new Set(keywordsData.keywords.map(k => k.campaignName))].sort();
        setCampaigns(uniqueCampaigns);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error loading keywords');
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
      // Silently fail for summary/waste
    }
  }, []);

  // Load keywords when page or filters change
  useEffect(() => {
    loadKeywords({ page, campaign: filterCampaign, matchType: filterMatchType });
  }, [page, filterCampaign, filterMatchType, loadKeywords]);

  // Load summary and waste once on mount
  useEffect(() => {
    loadSummaryAndWaste();
  }, [loadSummaryAndWaste]);

  // Reset page when filters change
  const handleFilterChange = (type: 'campaign' | 'matchType', value: string) => {
    setPage(1);
    if (type === 'campaign') setFilterCampaign(value);
    if (type === 'matchType') setFilterMatchType(value);
  };

  const handleRefresh = () => {
    loadKeywords({ page, campaign: filterCampaign, matchType: filterMatchType });
    loadSummaryAndWaste();
  };

  if (loading && !data) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <RefreshCw className="w-8 h-8 animate-spin text-gray-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-500 text-xl mb-4">Error</div>
          <div className="text-gray-400 mb-4">{error}</div>
          <button
            onClick={handleRefresh}
            className="px-4 py-2 bg-gray-800 rounded-lg hover:bg-gray-700 transition"
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  // Filter by waste if checkbox is checked (client-side since waste comes from separate endpoint)
  let displayKeywords = data?.keywords || [];
  if (showWasteOnly && waste) {
    const wasteKeywordIds = new Set(waste.keywords.map(w => w.keyword.keywordId));
    displayKeywords = displayKeywords.filter(k => wasteKeywordIds.has(k.keywordId));
  }

  const pagination = data?.pagination;
  const filteredCount = data?.filteredCount || 0;

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <span className="text-4xl">🔑</span>
            <div>
              <h1 className="text-2xl font-bold">Keywords</h1>
              <div className="text-sm text-gray-500 flex items-center gap-2">
                <Clock className="w-3 h-3" />
                {data?.dateRange || 'LAST_7_DAYS'} | {filteredCount} con gasto / {data?.totalKeywords || 0} total
              </div>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {lastUpdate && (
              <span className="text-xs text-gray-500">
                Actualizado: {lastUpdate.toLocaleTimeString()}
              </span>
            )}
            <button
              onClick={handleRefresh}
              disabled={loading}
              className="p-2 bg-gray-800 rounded-lg hover:bg-gray-700 transition disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Summary Cards */}
        {summary && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            {/* Total Spend */}
            <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-4">
              <div className="text-sm text-gray-400 mb-1">Total Spend (7d)</div>
              <div className="text-2xl font-bold">{summary.totalSpend.toFixed(0)}</div>
              <div className="text-xs text-gray-500">{summary.totalKeywords} keywords</div>
            </div>

            {/* Conversions */}
            <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4">
              <div className="flex items-center gap-2 text-sm text-green-400 mb-1">
                <TrendingUp className="w-4 h-4" />
                With Conversions
              </div>
              <div className="text-2xl font-bold text-green-400">{summary.keywordsWithConversions}</div>
              <div className="text-xs text-gray-500">
                {((summary.keywordsWithConversions / summary.totalKeywords) * 100).toFixed(1)}% of keywords
              </div>
            </div>

            {/* Zero Conversions */}
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4">
              <div className="flex items-center gap-2 text-sm text-yellow-400 mb-1">
                <AlertTriangle className="w-4 h-4" />
                Zero Conversions
              </div>
              <div className="text-2xl font-bold text-yellow-400">{summary.keywordsWithZeroConversions}</div>
              <div className="text-xs text-gray-500">
                {((summary.keywordsWithZeroConversions / summary.totalKeywords) * 100).toFixed(1)}% of keywords
              </div>
            </div>

            {/* Waste */}
            {waste && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
                <div className="text-sm text-red-400 mb-1">Estimated Waste</div>
                <div className="text-2xl font-bold text-red-400">{waste.totalEstimatedWaste.toFixed(0)}</div>
                <div className="text-xs text-gray-500">{waste.count} keywords flagged</div>
              </div>
            )}
          </div>
        )}

        {/* Match Type Breakdown */}
        {summary && summary.byMatchType && (
          <div className="mb-6">
            <div className="text-sm text-gray-400 uppercase tracking-wide mb-3">By Match Type</div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {Object.entries(summary.byMatchType).map(([matchType, stats]) => (
                <div
                  key={matchType}
                  className={`rounded-xl p-4 border ${MATCH_TYPE_COLORS[matchType] || 'bg-gray-800/50 border-gray-700'}`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium">{matchType}</span>
                    <span className="text-sm">{stats.count} keywords</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-gray-400">Spend:</span>{' '}
                      <span className="font-medium">{stats.spend.toFixed(0)}</span>
                    </div>
                    <div>
                      <span className="text-gray-400">Conv:</span>{' '}
                      <span className="font-medium">{stats.conversions.toFixed(0)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Waste Alert */}
        {waste && waste.count > 0 && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-red-400 mt-0.5" />
              <div>
                <div className="font-medium text-red-400 mb-1">
                  {waste.count} keywords flagged for waste
                </div>
                <div className="text-sm text-gray-400 mb-2">
                  Estimated {waste.totalEstimatedWaste.toFixed(2)} wasted in the last 7 days
                </div>
                <div className="flex gap-4 text-xs">
                  <span>High spend, zero conv: {waste.byFlag.HIGH_SPEND_ZERO_CONV}</span>
                  <span>High spend, low conv: {waste.byFlag.HIGH_SPEND_LOW_CONV}</span>
                  <span>Spend concentration: {waste.byFlag.SPEND_CONCENTRATION}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="mb-4 flex flex-wrap gap-4 items-center">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-500" />
            <span className="text-sm text-gray-500">Filters:</span>
          </div>

          {/* Campaign Filter */}
          <select
            value={filterCampaign}
            onChange={(e) => handleFilterChange('campaign', e.target.value)}
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-gray-600"
          >
            <option value="">All Campaigns</option>
            {campaigns.map((c) => (
              <option key={c} value={c}>
                {c.length > 40 ? c.substring(0, 40) + '...' : c}
              </option>
            ))}
          </select>

          {/* Match Type Filter */}
          <select
            value={filterMatchType}
            onChange={(e) => handleFilterChange('matchType', e.target.value)}
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-gray-600"
          >
            <option value="">All Match Types</option>
            <option value="EXACT">EXACT</option>
            <option value="PHRASE">PHRASE</option>
            <option value="BROAD">BROAD</option>
          </select>

          {/* Waste Filter */}
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={showWasteOnly}
              onChange={(e) => setShowWasteOnly(e.target.checked)}
              className="rounded border-gray-600 bg-gray-800 text-red-500 focus:ring-red-500"
            />
            <span className="text-gray-400">Show waste only</span>
          </label>

          {/* Result count */}
          <span className="text-sm text-gray-500 ml-auto">
            Showing {displayKeywords.length} keywords (page {page} of {pagination?.totalPages || 1})
          </span>
        </div>

        {/* Keywords Table */}
        <div className="mb-6">
          <KeywordsTable
            keywords={displayKeywords}
            wasteData={waste?.keywords}
            loading={loading}
          />
        </div>

        {/* Pagination */}
        {pagination && pagination.totalPages > 1 && (
          <div className="flex items-center justify-center gap-4 mb-6">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={!pagination.hasPrev || loading}
              className="flex items-center gap-1 px-3 py-2 bg-gray-800 rounded-lg hover:bg-gray-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-4 h-4" />
              Anterior
            </button>

            <div className="flex items-center gap-2">
              {/* Page numbers */}
              {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                let pageNum: number;
                if (pagination.totalPages <= 5) {
                  pageNum = i + 1;
                } else if (page <= 3) {
                  pageNum = i + 1;
                } else if (page >= pagination.totalPages - 2) {
                  pageNum = pagination.totalPages - 4 + i;
                } else {
                  pageNum = page - 2 + i;
                }
                return (
                  <button
                    key={pageNum}
                    onClick={() => setPage(pageNum)}
                    disabled={loading}
                    className={`w-10 h-10 rounded-lg transition ${
                      page === pageNum
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-800 hover:bg-gray-700'
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
            </div>

            <button
              onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))}
              disabled={!pagination.hasNext || loading}
              className="flex items-center gap-1 px-3 py-2 bg-gray-800 rounded-lg hover:bg-gray-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Siguiente
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Legend */}
        <div className="bg-gray-900/50 rounded-xl p-4 border border-gray-800">
          <div className="text-sm text-gray-400 mb-2">Waste Detection Flags</div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-gray-500">
            <div>
              <span className="text-red-400 font-medium">HIGH_SPEND_ZERO_CONV</span>: Spend &gt; 50, zero conversions
            </div>
            <div>
              <span className="text-yellow-400 font-medium">HIGH_SPEND_LOW_CONV</span>: Spend high, conv rate &lt; 1%
            </div>
            <div>
              <span className="text-orange-400 font-medium">SPEND_CONCENTRATION</span>: &gt;50% of ad group spend without return
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
