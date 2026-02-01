import { useEffect, useState, useCallback } from 'react';
import { RefreshCw, Clock, AlertTriangle, TrendingUp, Target, Search, Ban, ChevronLeft, ChevronRight, Filter, ArrowUpRight } from 'lucide-react';
import { api, type SearchTermPerformanceResult, type SearchTermsSummary, type SearchTermsWasteResult, type SearchTermWasteAnalysis, type SearchTermPerformance, type SearchTermsQueryParams } from '../api/client';

type ViewTab = 'waste' | 'intent' | 'opportunities' | 'all';

const PAGE_SIZE = 50;

// Intent mismatch patterns (same as backend)
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

// Badge components
function WasteBadge({ flags }: { flags: string[] }) {
  if (flags.length === 0) return null;

  const flagColors: Record<string, string> = {
    HIGH_SPEND_ZERO_CONV: 'bg-red-500/20 text-red-400 border-red-500/30',
    HIGH_SPEND_LOW_CONV: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    SPEND_CONCENTRATION: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
    REPEAT_WASTE: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  };

  const flagLabels: Record<string, string> = {
    HIGH_SPEND_ZERO_CONV: 'No Conv',
    HIGH_SPEND_LOW_CONV: 'Low Conv',
    SPEND_CONCENTRATION: 'Concentrated',
    REPEAT_WASTE: 'Repeat',
  };

  return (
    <div className="flex gap-1 flex-wrap">
      {flags.map(flag => (
        <span
          key={flag}
          className={`px-1.5 py-0.5 text-xs rounded border ${flagColors[flag] || 'bg-gray-700 text-gray-400'}`}
        >
          {flagLabels[flag] || flag}
        </span>
      ))}
    </div>
  );
}

function RecommendationBadge({ recommendation }: { recommendation: string | null }) {
  if (!recommendation) return null;

  const styles: Record<string, { bg: string; icon: React.ReactNode }> = {
    NEGATIVE_SUGGESTION: { bg: 'bg-red-500/20 text-red-400 border-red-500/30', icon: <Ban className="w-3 h-3" /> },
    INTENT_MISMATCH: { bg: 'bg-purple-500/20 text-purple-400 border-purple-500/30', icon: <Target className="w-3 h-3" /> },
    REVIEW_MATCH_TYPE: { bg: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30', icon: <Search className="w-3 h-3" /> },
    PROMOTE_TO_KEYWORD: { bg: 'bg-green-500/20 text-green-400 border-green-500/30', icon: <ArrowUpRight className="w-3 h-3" /> },
    MONITOR: { bg: 'bg-gray-500/20 text-gray-400 border-gray-500/30', icon: null },
  };

  const labels: Record<string, string> = {
    NEGATIVE_SUGGESTION: 'NEGATIVIZE',
    INTENT_MISMATCH: 'INTENT MISMATCH',
    REVIEW_MATCH_TYPE: 'REVIEW MATCH',
    PROMOTE_TO_KEYWORD: 'PROMOTE',
    MONITOR: 'MONITOR',
  };

  const style = styles[recommendation] || styles.MONITOR;

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded border ${style.bg}`}>
      {style.icon}
      {labels[recommendation] || recommendation}
    </span>
  );
}

function StatusDot({ status }: { status: 'good' | 'warning' | 'poor' }) {
  const colors = {
    good: 'bg-green-500',
    warning: 'bg-yellow-500',
    poor: 'bg-red-500',
  };
  return <div className={`w-2 h-2 rounded-full ${colors[status]}`} />;
}

// Waste View Table
function WasteTable({ data, loading }: { data: SearchTermWasteAnalysis[]; loading: boolean }) {
  if (loading) {
    return <div className="text-center py-8 text-gray-500">Loading...</div>;
  }

  if (data.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        No waste search terms detected. Your budget is being used efficiently.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-gray-400 border-b border-gray-800">
            <th className="pb-3 font-medium">Search Term</th>
            <th className="pb-3 font-medium">Matched Keyword</th>
            <th className="pb-3 font-medium">Campaign</th>
            <th className="pb-3 font-medium text-right">Waste</th>
            <th className="pb-3 font-medium text-right">Clicks</th>
            <th className="pb-3 font-medium text-right">Conv</th>
            <th className="pb-3 font-medium">Flags</th>
            <th className="pb-3 font-medium">Action</th>
          </tr>
        </thead>
        <tbody>
          {data.map((item, i) => (
            <tr key={i} className="border-b border-gray-800/50 hover:bg-gray-800/30">
              <td className="py-3">
                <div className="font-medium text-white max-w-xs truncate" title={item.searchTerm.searchTerm}>
                  {item.searchTerm.searchTerm}
                </div>
              </td>
              <td className="py-3">
                <div className="flex items-center gap-2">
                  <span className="text-gray-400 max-w-[150px] truncate" title={item.searchTerm.keywordText}>
                    {item.searchTerm.keywordText || '-'}
                  </span>
                  <span className={`px-1.5 py-0.5 text-xs rounded ${
                    item.searchTerm.matchType === 'EXACT' ? 'bg-green-500/20 text-green-400' :
                    item.searchTerm.matchType === 'PHRASE' ? 'bg-blue-500/20 text-blue-400' :
                    'bg-yellow-500/20 text-yellow-400'
                  }`}>
                    {item.searchTerm.matchType}
                  </span>
                </div>
              </td>
              <td className="py-3">
                <span className="text-gray-400 max-w-[150px] truncate block" title={item.searchTerm.campaignName}>
                  {item.searchTerm.campaignName}
                </span>
              </td>
              <td className="py-3 text-right">
                <span className="text-red-400 font-medium">{item.wastedSpend.toFixed(2)}</span>
              </td>
              <td className="py-3 text-right text-gray-300">{item.searchTerm.clicks}</td>
              <td className="py-3 text-right">
                <span className={item.searchTerm.conversions > 0 ? 'text-green-400' : 'text-gray-500'}>
                  {item.searchTerm.conversions}
                </span>
              </td>
              <td className="py-3">
                <WasteBadge flags={item.wasteFlags} />
              </td>
              <td className="py-3">
                <RecommendationBadge recommendation={item.recommendation} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Intent Mismatch Table
function IntentMismatchTable({ data, loading }: { data: SearchTermPerformance[]; loading: boolean }) {
  const mismatchTerms = data.filter(st => hasIntentMismatch(st.searchTerm));

  if (loading) {
    return <div className="text-center py-8 text-gray-500">Loading...</div>;
  }

  if (mismatchTerms.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        No intent mismatch detected in current data.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-gray-400 border-b border-gray-800">
            <th className="pb-3 font-medium">Search Term (User Intent)</th>
            <th className="pb-3 font-medium">Matched Keyword (Your Bid)</th>
            <th className="pb-3 font-medium">Match Type</th>
            <th className="pb-3 font-medium">Campaign</th>
            <th className="pb-3 font-medium text-right">Spend</th>
            <th className="pb-3 font-medium text-right">Conv</th>
            <th className="pb-3 font-medium">Pattern Detected</th>
          </tr>
        </thead>
        <tbody>
          {mismatchTerms.slice(0, 50).map((st, i) => {
            const detectedPattern = INTENT_MISMATCH_PATTERNS.find(p => st.searchTerm.toLowerCase().includes(p));
            return (
              <tr key={i} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                <td className="py-3">
                  <div className="font-medium text-white max-w-xs">
                    {st.searchTerm.split(new RegExp(`(${INTENT_MISMATCH_PATTERNS.join('|')})`, 'gi')).map((part, j) =>
                      INTENT_MISMATCH_PATTERNS.some(p => part.toLowerCase() === p) ? (
                        <span key={j} className="bg-purple-500/30 text-purple-300 px-0.5 rounded">{part}</span>
                      ) : (
                        <span key={j}>{part}</span>
                      )
                    )}
                  </div>
                </td>
                <td className="py-3 text-gray-400">{st.keywordText || '-'}</td>
                <td className="py-3">
                  <span className={`px-1.5 py-0.5 text-xs rounded ${
                    st.matchType === 'EXACT' ? 'bg-green-500/20 text-green-400' :
                    st.matchType === 'PHRASE' ? 'bg-blue-500/20 text-blue-400' :
                    'bg-yellow-500/20 text-yellow-400'
                  }`}>
                    {st.matchType}
                  </span>
                </td>
                <td className="py-3 text-gray-400 max-w-[150px] truncate">{st.campaignName}</td>
                <td className="py-3 text-right text-gray-300">{st.spend.toFixed(2)}</td>
                <td className="py-3 text-right">
                  <span className={st.conversions > 0 ? 'text-green-400' : 'text-red-400'}>
                    {st.conversions}
                  </span>
                </td>
                <td className="py-3">
                  <span className="px-2 py-0.5 text-xs bg-purple-500/20 text-purple-400 rounded border border-purple-500/30">
                    {detectedPattern}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {mismatchTerms.length > 50 && (
        <div className="text-center py-4 text-gray-500 text-sm">
          Showing 50 of {mismatchTerms.length} intent mismatches
        </div>
      )}
    </div>
  );
}

// Opportunities Table
function OpportunitiesTable({ data, loading }: { data: SearchTermPerformance[]; loading: boolean }) {
  // Filter for opportunities: has conversions, good CPA potential
  const opportunities = data
    .filter(st => st.conversions > 0)
    .sort((a, b) => {
      // Sort by CPA (spend/conversions) ascending, then by conversions descending
      const cpaA = a.spend / a.conversions;
      const cpaB = b.spend / b.conversions;
      if (Math.abs(cpaA - cpaB) < 5) {
        return b.conversions - a.conversions;
      }
      return cpaA - cpaB;
    })
    .slice(0, 100);

  if (loading) {
    return <div className="text-center py-8 text-gray-500">Loading...</div>;
  }

  if (opportunities.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        No high-potential search terms found with conversions.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-gray-400 border-b border-gray-800">
            <th className="pb-3 font-medium">Search Term</th>
            <th className="pb-3 font-medium">Matched Keyword</th>
            <th className="pb-3 font-medium">Match Type</th>
            <th className="pb-3 font-medium">Campaign</th>
            <th className="pb-3 font-medium text-right">Spend</th>
            <th className="pb-3 font-medium text-right">Conv</th>
            <th className="pb-3 font-medium text-right">CPA</th>
            <th className="pb-3 font-medium">Potential</th>
          </tr>
        </thead>
        <tbody>
          {opportunities.map((st, i) => {
            const cpa = st.spend / st.conversions;
            const isExact = st.matchType === 'EXACT';
            const potential = cpa < 20 ? 'high' : cpa < 40 ? 'medium' : 'low';

            return (
              <tr key={i} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                <td className="py-3">
                  <div className="font-medium text-white max-w-xs truncate" title={st.searchTerm}>
                    {st.searchTerm}
                  </div>
                </td>
                <td className="py-3 text-gray-400 max-w-[150px] truncate">{st.keywordText || '-'}</td>
                <td className="py-3">
                  <span className={`px-1.5 py-0.5 text-xs rounded ${
                    st.matchType === 'EXACT' ? 'bg-green-500/20 text-green-400' :
                    st.matchType === 'PHRASE' ? 'bg-blue-500/20 text-blue-400' :
                    'bg-yellow-500/20 text-yellow-400'
                  }`}>
                    {st.matchType}
                  </span>
                </td>
                <td className="py-3 text-gray-400 max-w-[150px] truncate">{st.campaignName}</td>
                <td className="py-3 text-right text-gray-300">{st.spend.toFixed(2)}</td>
                <td className="py-3 text-right text-green-400 font-medium">{st.conversions}</td>
                <td className="py-3 text-right">
                  <span className={cpa < 20 ? 'text-green-400' : cpa < 40 ? 'text-yellow-400' : 'text-gray-400'}>
                    {cpa.toFixed(2)}
                  </span>
                </td>
                <td className="py-3">
                  {!isExact && (
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded border ${
                      potential === 'high' ? 'bg-green-500/20 text-green-400 border-green-500/30' :
                      potential === 'medium' ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' :
                      'bg-gray-500/20 text-gray-400 border-gray-500/30'
                    }`}>
                      <ArrowUpRight className="w-3 h-3" />
                      {potential === 'high' ? 'PROMOTE' : potential === 'medium' ? 'CONSIDER' : 'MONITOR'}
                    </span>
                  )}
                  {isExact && (
                    <span className="px-2 py-0.5 text-xs text-gray-500">Already EXACT</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// All Search Terms Table
function AllSearchTermsTable({
  data,
  loading,
  page,
  pagination,
  onPageChange
}: {
  data: SearchTermPerformance[];
  loading: boolean;
  page: number;
  pagination?: { totalPages: number; hasNext: boolean; hasPrev: boolean };
  onPageChange: (page: number) => void;
}) {
  if (loading && data.length === 0) {
    return <div className="text-center py-8 text-gray-500">Loading...</div>;
  }

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-400 border-b border-gray-800">
              <th className="pb-3 font-medium w-5"></th>
              <th className="pb-3 font-medium">Search Term</th>
              <th className="pb-3 font-medium">Keyword</th>
              <th className="pb-3 font-medium">Match</th>
              <th className="pb-3 font-medium">Campaign</th>
              <th className="pb-3 font-medium text-right">Spend</th>
              <th className="pb-3 font-medium text-right">Clicks</th>
              <th className="pb-3 font-medium text-right">Conv</th>
              <th className="pb-3 font-medium">Recommendation</th>
            </tr>
          </thead>
          <tbody>
            {data.map((st, i) => (
              <tr key={i} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                <td className="py-3"><StatusDot status={st.performanceStatus} /></td>
                <td className="py-3">
                  <div className="font-medium text-white max-w-[200px] truncate" title={st.searchTerm}>
                    {st.searchTerm}
                  </div>
                </td>
                <td className="py-3 text-gray-400 max-w-[120px] truncate">{st.keywordText || '-'}</td>
                <td className="py-3">
                  <span className={`px-1.5 py-0.5 text-xs rounded ${
                    st.matchType === 'EXACT' ? 'bg-green-500/20 text-green-400' :
                    st.matchType === 'PHRASE' ? 'bg-blue-500/20 text-blue-400' :
                    'bg-yellow-500/20 text-yellow-400'
                  }`}>
                    {st.matchType}
                  </span>
                </td>
                <td className="py-3 text-gray-400 max-w-[120px] truncate">{st.campaignName}</td>
                <td className="py-3 text-right text-gray-300">{st.spend.toFixed(2)}</td>
                <td className="py-3 text-right text-gray-300">{st.clicks}</td>
                <td className="py-3 text-right">
                  <span className={st.conversions > 0 ? 'text-green-400' : 'text-gray-500'}>
                    {st.conversions}
                  </span>
                </td>
                <td className="py-3">
                  <RecommendationBadge recommendation={st.recommendation} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-center gap-4 mt-6">
          <button
            onClick={() => onPageChange(Math.max(1, page - 1))}
            disabled={!pagination.hasPrev || loading}
            className="flex items-center gap-1 px-3 py-2 bg-gray-800 rounded-lg hover:bg-gray-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="w-4 h-4" />
            Prev
          </button>
          <span className="text-sm text-gray-400">
            Page {page} of {pagination.totalPages}
          </span>
          <button
            onClick={() => onPageChange(Math.min(pagination.totalPages, page + 1))}
            disabled={!pagination.hasNext || loading}
            className="flex items-center gap-1 px-3 py-2 bg-gray-800 rounded-lg hover:bg-gray-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}

export function SearchTerms() {
  const [activeTab, setActiveTab] = useState<ViewTab>('waste');
  const [data, setData] = useState<SearchTermPerformanceResult | null>(null);
  const [summary, setSummary] = useState<SearchTermsSummary | null>(null);
  const [waste, setWaste] = useState<SearchTermsWasteResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  // Pagination for All view
  const [page, setPage] = useState(1);
  const [filterCampaign, setFilterCampaign] = useState<string>('');
  const [campaigns, setCampaigns] = useState<string[]>([]);

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
        const uniqueCampaigns = [...new Set(searchTermsData.searchTerms.map(st => st.campaignName))].sort();
        setCampaigns(uniqueCampaigns);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error loading data');
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

  const handleFilterChange = (value: string) => {
    setPage(1);
    setFilterCampaign(value);
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
          <button onClick={handleRefresh} className="px-4 py-2 bg-gray-800 rounded-lg hover:bg-gray-700">
            Retry
          </button>
        </div>
      </div>
    );
  }

  const wasteCount = waste?.count || 0;
  const intentMismatchCount = summary?.intentMismatchCount || 0;
  const opportunitiesCount = data?.searchTerms.filter(st => st.conversions > 0).length || 0;

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <span className="text-4xl">🔍</span>
            <div>
              <h1 className="text-2xl font-bold">Search Terms</h1>
              <div className="text-sm text-gray-500 flex items-center gap-2">
                <Clock className="w-3 h-3" />
                {data?.dateRange || 'LAST_7_DAYS'} | {data?.totalSearchTerms || 0} terms | {data?.totalSpend?.toFixed(0) || 0} total spend
              </div>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {lastUpdate && (
              <span className="text-xs text-gray-500">
                Updated: {lastUpdate.toLocaleTimeString()}
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
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          {/* Waste */}
          <button
            onClick={() => setActiveTab('waste')}
            className={`text-left p-4 rounded-xl border transition ${
              activeTab === 'waste'
                ? 'bg-red-500/20 border-red-500/50'
                : 'bg-red-500/10 border-red-500/30 hover:border-red-500/50'
            }`}
          >
            <div className="flex items-center gap-2 text-sm text-red-400 mb-1">
              <AlertTriangle className="w-4 h-4" />
              Waste Detected
            </div>
            <div className="text-2xl font-bold text-red-400">{wasteCount}</div>
            <div className="text-xs text-gray-500">
              {waste?.totalEstimatedWaste?.toFixed(0) || 0} estimated waste
            </div>
          </button>

          {/* Intent Mismatch */}
          <button
            onClick={() => setActiveTab('intent')}
            className={`text-left p-4 rounded-xl border transition ${
              activeTab === 'intent'
                ? 'bg-purple-500/20 border-purple-500/50'
                : 'bg-purple-500/10 border-purple-500/30 hover:border-purple-500/50'
            }`}
          >
            <div className="flex items-center gap-2 text-sm text-purple-400 mb-1">
              <Target className="w-4 h-4" />
              Intent Mismatch
            </div>
            <div className="text-2xl font-bold text-purple-400">{intentMismatchCount}</div>
            <div className="text-xs text-gray-500">wrong intent queries</div>
          </button>

          {/* Opportunities */}
          <button
            onClick={() => setActiveTab('opportunities')}
            className={`text-left p-4 rounded-xl border transition ${
              activeTab === 'opportunities'
                ? 'bg-green-500/20 border-green-500/50'
                : 'bg-green-500/10 border-green-500/30 hover:border-green-500/50'
            }`}
          >
            <div className="flex items-center gap-2 text-sm text-green-400 mb-1">
              <TrendingUp className="w-4 h-4" />
              Opportunities
            </div>
            <div className="text-2xl font-bold text-green-400">{opportunitiesCount}</div>
            <div className="text-xs text-gray-500">with conversions</div>
          </button>

          {/* All */}
          <button
            onClick={() => setActiveTab('all')}
            className={`text-left p-4 rounded-xl border transition ${
              activeTab === 'all'
                ? 'bg-gray-500/20 border-gray-500/50'
                : 'bg-gray-800/50 border-gray-700 hover:border-gray-600'
            }`}
          >
            <div className="flex items-center gap-2 text-sm text-gray-400 mb-1">
              <Search className="w-4 h-4" />
              All Search Terms
            </div>
            <div className="text-2xl font-bold">{data?.filteredCount || data?.totalSearchTerms || 0}</div>
            <div className="text-xs text-gray-500">with spend</div>
          </button>
        </div>

        {/* Waste Breakdown (when on waste tab) */}
        {activeTab === 'waste' && waste && waste.count > 0 && (
          <div className="mb-6 p-4 bg-gray-800/50 border border-gray-700 rounded-xl">
            <div className="flex gap-6 text-sm">
              <div>
                <span className="text-gray-400">No conversions: </span>
                <span className="text-red-400 font-medium">{waste.byFlag.HIGH_SPEND_ZERO_CONV}</span>
              </div>
              <div>
                <span className="text-gray-400">Low conv rate: </span>
                <span className="text-yellow-400 font-medium">{waste.byFlag.HIGH_SPEND_LOW_CONV}</span>
              </div>
              <div>
                <span className="text-gray-400">Concentrated: </span>
                <span className="text-orange-400 font-medium">{waste.byFlag.SPEND_CONCENTRATION}</span>
              </div>
              <div>
                <span className="text-gray-400">Repeat waste: </span>
                <span className="text-purple-400 font-medium">{waste.byFlag.REPEAT_WASTE}</span>
              </div>
            </div>
          </div>
        )}

        {/* Campaign Filter (for All tab) */}
        {activeTab === 'all' && (
          <div className="mb-4 flex items-center gap-4">
            <Filter className="w-4 h-4 text-gray-500" />
            <select
              value={filterCampaign}
              onChange={(e) => handleFilterChange(e.target.value)}
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-gray-600"
            >
              <option value="">All Campaigns</option>
              {campaigns.map((c) => (
                <option key={c} value={c}>
                  {c.length > 50 ? c.substring(0, 50) + '...' : c}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Content based on active tab */}
        <div className="bg-gray-900/50 rounded-xl p-6 border border-gray-800">
          {activeTab === 'waste' && (
            <>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-medium flex items-center gap-2">
                  <Ban className="w-5 h-5 text-red-400" />
                  Negativization Candidates
                </h2>
                <span className="text-sm text-gray-500">
                  Ordered by wasted spend (highest first)
                </span>
              </div>
              <WasteTable data={waste?.searchTerms || []} loading={loading} />
            </>
          )}

          {activeTab === 'intent' && (
            <>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-medium flex items-center gap-2">
                  <Target className="w-5 h-5 text-purple-400" />
                  Intent Mismatch Analysis
                </h2>
                <span className="text-sm text-gray-500">
                  Queries with patterns: {INTENT_MISMATCH_PATTERNS.slice(0, 5).join(', ')}...
                </span>
              </div>
              <IntentMismatchTable data={data?.searchTerms || []} loading={loading} />
            </>
          )}

          {activeTab === 'opportunities' && (
            <>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-medium flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-green-400" />
                  Keyword Promotion Candidates
                </h2>
                <span className="text-sm text-gray-500">
                  Search terms with conversions, sorted by CPA
                </span>
              </div>
              <OpportunitiesTable data={data?.searchTerms || []} loading={loading} />
            </>
          )}

          {activeTab === 'all' && (
            <>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-medium flex items-center gap-2">
                  <Search className="w-5 h-5 text-gray-400" />
                  All Search Terms
                </h2>
                <span className="text-sm text-gray-500">
                  {data?.filteredCount || 0} terms with spend
                </span>
              </div>
              <AllSearchTermsTable
                data={data?.searchTerms || []}
                loading={loading}
                page={page}
                pagination={data?.pagination}
                onPageChange={setPage}
              />
            </>
          )}
        </div>

        {/* Legend */}
        <div className="mt-6 bg-gray-900/50 rounded-xl p-4 border border-gray-800">
          <div className="text-sm text-gray-400 mb-2">Action Recommendations</div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs text-gray-500">
            <div className="flex items-center gap-2">
              <RecommendationBadge recommendation="NEGATIVE_SUGGESTION" />
              <span>Add as negative keyword</span>
            </div>
            <div className="flex items-center gap-2">
              <RecommendationBadge recommendation="INTENT_MISMATCH" />
              <span>Query doesn't match intent</span>
            </div>
            <div className="flex items-center gap-2">
              <RecommendationBadge recommendation="REVIEW_MATCH_TYPE" />
              <span>Consider changing match type</span>
            </div>
            <div className="flex items-center gap-2">
              <RecommendationBadge recommendation="PROMOTE_TO_KEYWORD" />
              <span>Add as exact match keyword</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
