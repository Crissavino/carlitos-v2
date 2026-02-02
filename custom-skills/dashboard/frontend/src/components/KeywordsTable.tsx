import React, { useState } from 'react';
import { ChevronUp, ChevronDown, AlertTriangle, TrendingUp, Search, MinusCircle } from 'lucide-react';
import type { KeywordPerformance, KeywordWasteAnalysis, WasteFlag } from '../api/client';

interface KeywordsTableProps {
  keywords: KeywordPerformance[];
  wasteData?: KeywordWasteAnalysis[];
  loading?: boolean;
}

type SortKey = 'spend7d' | 'clicks' | 'impressions' | 'conversions' | 'ctr' | 'cpc' | 'conversionRate' | 'keywordText';
type SortDirection = 'asc' | 'desc';

const MATCH_TYPE_BADGE: Record<string, string> = {
  EXACT: 'bg-green-500/20 text-green-400',
  PHRASE: 'bg-blue-500/20 text-blue-400',
  BROAD: 'bg-yellow-500/20 text-yellow-400',
};

const STATUS_COLORS: Record<string, string> = {
  good: 'text-green-400',
  warning: 'text-yellow-400',
  poor: 'text-red-400',
};

const RECOMMENDATION_ICONS: Record<string, React.ReactNode> = {
  NEGATIVE_SUGGESTION: <MinusCircle className="w-4 h-4 text-red-400" />,
  INTENT_MISMATCH: <AlertTriangle className="w-4 h-4 text-orange-400" />,
  SCALE_KEYWORD: <TrendingUp className="w-4 h-4 text-green-400" />,
  MATCH_TYPE_FIX: <Search className="w-4 h-4 text-blue-400" />,
  REVIEW_BID: <AlertTriangle className="w-4 h-4 text-yellow-400" />,
  MONITOR: <Search className="w-4 h-4 text-gray-400" />,
};

const WASTE_FLAG_COLORS: Record<WasteFlag, string> = {
  HIGH_SPEND_ZERO_CONV: 'bg-red-500/20 text-red-400',
  HIGH_SPEND_LOW_CONV: 'bg-yellow-500/20 text-yellow-400',
  SPEND_CONCENTRATION: 'bg-orange-500/20 text-orange-400',
};

export function KeywordsTable({ keywords, wasteData, loading }: KeywordsTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>('spend7d');
  const [sortDir, setSortDir] = useState<SortDirection>('desc');

  // Create a map of waste data by keyword ID
  const wasteMap = new Map<string, KeywordWasteAnalysis>();
  if (wasteData) {
    for (const w of wasteData) {
      wasteMap.set(w.keyword.keywordId, w);
    }
  }

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  const sortedKeywords = [...keywords].sort((a, b) => {
    let aVal: number | string = a[sortKey];
    let bVal: number | string = b[sortKey];

    if (typeof aVal === 'string') {
      return sortDir === 'asc'
        ? aVal.localeCompare(bVal as string)
        : (bVal as string).localeCompare(aVal);
    }

    return sortDir === 'asc' ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number);
  });

  const SortIcon = ({ column }: { column: SortKey }) => {
    if (sortKey !== column) return null;
    return sortDir === 'asc' ? (
      <ChevronUp className="w-3 h-3 inline ml-1" />
    ) : (
      <ChevronDown className="w-3 h-3 inline ml-1" />
    );
  };

  if (loading) {
    return (
      <div className="bg-gray-800/50 rounded-xl p-8 text-center">
        <div className="animate-pulse text-gray-500">Cargando keywords...</div>
      </div>
    );
  }

  if (keywords.length === 0) {
    return (
      <div className="bg-gray-800/50 rounded-xl p-8 text-center">
        <div className="text-gray-500">No se encontraron keywords</div>
      </div>
    );
  }

  return (
    <div className="bg-gray-800/50 rounded-xl border border-gray-700 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-900/50 border-b border-gray-700">
              <th className="px-4 py-3 text-left text-gray-400 font-medium">
                <button
                  onClick={() => handleSort('keywordText')}
                  className="hover:text-white transition"
                >
                  Keyword
                  <SortIcon column="keywordText" />
                </button>
              </th>
              <th className="px-3 py-3 text-center text-gray-400 font-medium">Match</th>
              <th className="px-3 py-3 text-right text-gray-400 font-medium">
                <button
                  onClick={() => handleSort('spend7d')}
                  className="hover:text-white transition"
                >
                  Gasto
                  <SortIcon column="spend7d" />
                </button>
              </th>
              <th className="px-3 py-3 text-right text-gray-400 font-medium">
                <button
                  onClick={() => handleSort('clicks')}
                  className="hover:text-white transition"
                >
                  Clicks
                  <SortIcon column="clicks" />
                </button>
              </th>
              <th className="px-3 py-3 text-right text-gray-400 font-medium">
                <button
                  onClick={() => handleSort('impressions')}
                  className="hover:text-white transition"
                >
                  Impr
                  <SortIcon column="impressions" />
                </button>
              </th>
              <th className="px-3 py-3 text-right text-gray-400 font-medium">
                <button
                  onClick={() => handleSort('ctr')}
                  className="hover:text-white transition"
                >
                  CTR
                  <SortIcon column="ctr" />
                </button>
              </th>
              <th className="px-3 py-3 text-right text-gray-400 font-medium" title="Conversiones reportadas por Google Ads (generalmente trials)">
                <button
                  onClick={() => handleSort('conversions')}
                  className="hover:text-white transition"
                >
                  Conv
                  <SortIcon column="conversions" />
                </button>
              </th>
              <th className="px-3 py-3 text-right text-gray-400 font-medium" title="Tasa de conversión (Conv / Clicks)">
                <button
                  onClick={() => handleSort('conversionRate')}
                  className="hover:text-white transition"
                >
                  Conv%
                  <SortIcon column="conversionRate" />
                </button>
              </th>
              <th className="px-3 py-3 text-center text-gray-400 font-medium">Estado</th>
              <th className="px-3 py-3 text-left text-gray-400 font-medium">Alertas</th>
            </tr>
          </thead>
          <tbody>
            {sortedKeywords.map((kw) => {
              const wasteInfo = wasteMap.get(kw.keywordId);
              const hasWaste = !!wasteInfo;

              return (
                <tr
                  key={`${kw.keywordId}-${kw.matchType}`}
                  className={`border-b border-gray-800 hover:bg-gray-800/50 transition ${
                    hasWaste ? 'bg-red-500/5' : ''
                  }`}
                >
                  {/* Keyword */}
                  <td className="px-4 py-3">
                    <div className="max-w-xs">
                      <div className="font-medium truncate" title={kw.keywordText}>
                        {kw.keywordText}
                      </div>
                      <div className="text-xs text-gray-500 truncate" title={kw.campaignName}>
                        {kw.campaignName}
                      </div>
                    </div>
                  </td>

                  {/* Match Type */}
                  <td className="px-3 py-3 text-center">
                    <span
                      className={`px-2 py-0.5 rounded text-xs font-medium ${
                        MATCH_TYPE_BADGE[kw.matchType] || 'bg-gray-700'
                      }`}
                    >
                      {kw.matchType}
                    </span>
                  </td>

                  {/* Spend */}
                  <td className="px-3 py-3 text-right font-mono">
                    {kw.spend7d.toFixed(2)}
                  </td>

                  {/* Clicks */}
                  <td className="px-3 py-3 text-right font-mono">{kw.clicks}</td>

                  {/* Impressions */}
                  <td className="px-3 py-3 text-right font-mono">
                    {kw.impressions.toLocaleString()}
                  </td>

                  {/* CTR */}
                  <td className="px-3 py-3 text-right font-mono">
                    {(kw.ctr * 100).toFixed(2)}%
                  </td>

                  {/* Conversions */}
                  <td className="px-3 py-3 text-right font-mono">
                    <span className={kw.conversions === 0 ? 'text-gray-500' : ''}>
                      {kw.conversions.toFixed(1)}
                    </span>
                  </td>

                  {/* Conversion Rate */}
                  <td className="px-3 py-3 text-right font-mono">
                    <span className={kw.conversionRate < 0.01 && kw.clicks > 0 ? 'text-red-400' : ''}>
                      {(kw.conversionRate * 100).toFixed(2)}%
                    </span>
                  </td>

                  {/* Status */}
                  <td className="px-3 py-3 text-center">
                    <div className="flex items-center justify-center gap-1">
                      {kw.recommendation && RECOMMENDATION_ICONS[kw.recommendation]}
                      <span className={`text-xs ${STATUS_COLORS[kw.performanceStatus]}`}>
                        {kw.performanceStatus === 'good' && 'Bien'}
                        {kw.performanceStatus === 'warning' && 'Revisar'}
                        {kw.performanceStatus === 'poor' && 'Mal'}
                      </span>
                    </div>
                  </td>

                  {/* Waste Flags */}
                  <td className="px-3 py-3">
                    {wasteInfo && (
                      <div className="flex flex-wrap gap-1">
                        {wasteInfo.wasteFlags.map((flag) => (
                          <span
                            key={flag}
                            className={`px-1.5 py-0.5 rounded text-xs ${WASTE_FLAG_COLORS[flag]}`}
                            title={wasteInfo.rationale}
                          >
                            {flag === 'HIGH_SPEND_ZERO_CONV' && 'Sin Conv'}
                            {flag === 'HIGH_SPEND_LOW_CONV' && 'Baja Conv'}
                            {flag === 'SPEND_CONCENTRATION' && 'Conc.'}
                          </span>
                        ))}
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className="px-4 py-3 bg-gray-900/30 border-t border-gray-700 text-xs text-gray-500">
        Mostrando {keywords.length} keywords | Ordenado por {sortKey} ({sortDir === 'asc' ? 'asc' : 'desc'})
      </div>
    </div>
  );
}
