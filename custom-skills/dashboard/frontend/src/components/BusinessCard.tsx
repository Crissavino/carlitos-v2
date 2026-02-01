import { Building2, Globe, MapPin, Layers, ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';
import { RecommendationBadge } from './RecommendationBadge';
import type { RecommendationDetails, TopCampaign, AttributionCoverage } from '../api/client';

interface BusinessCardProps {
  type: 'website' | 'company' | 'country' | 'service';
  name: string;
  subtitle?: string;
  spend7d: number;
  spend30d?: number;
  totalAcquisitions: number;
  ltv51dAgg: number;
  payback51dAgg: number;
  activeCampaigns: number;
  totalCampaigns: number;
  minCampaignAgeDays: number;
  attributionCoverage: AttributionCoverage;
  recommendation: RecommendationDetails;
  topCampaigns?: TopCampaign[];
  extra?: React.ReactNode;
}

const typeIcons = {
  website: Globe,
  company: Building2,
  country: MapPin,
  service: Layers,
};

function formatCurrency(value: number): string {
  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}k`;
  }
  return value.toFixed(0);
}

function formatPayback(value: number): string {
  if (value === 0) return '-';
  if (value >= 100) return `${value.toFixed(0)}x`;
  return `${value.toFixed(2)}x`;
}

export function BusinessCard({
  type,
  name,
  subtitle,
  spend7d,
  spend30d: _spend30d, // Reserved for future use
  totalAcquisitions,
  ltv51dAgg,
  payback51dAgg,
  activeCampaigns,
  totalCampaigns,
  minCampaignAgeDays,
  attributionCoverage,
  recommendation,
  topCampaigns,
  extra,
}: BusinessCardProps) {
  const [expanded, setExpanded] = useState(false);
  const Icon = typeIcons[type];

  // Determine border color based on recommendation
  const borderColors: Record<string, string> = {
    SCALE_FOCUS: 'border-l-green-500',
    MAINTAIN: 'border-l-yellow-500',
    REDUCE_EXPOSURE: 'border-l-red-500',
    REBALANCE: 'border-l-blue-500',
    MONITOR: 'border-l-gray-500',
    INSUFFICIENT_DATA: 'border-l-gray-600',
  };
  const borderColor = borderColors[recommendation.recommendation] || 'border-l-gray-600';

  return (
    <div
      className={`bg-gray-900 rounded-xl border border-gray-800 border-l-4 ${borderColor} overflow-hidden`}
    >
      {/* Header */}
      <div className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <Icon className="w-5 h-5 text-gray-400" />
            <div>
              <h3 className="font-medium text-gray-100 truncate max-w-[200px]" title={name}>
                {name}
              </h3>
              {subtitle && (
                <span className="text-xs text-gray-500">{subtitle}</span>
              )}
            </div>
          </div>
          <RecommendationBadge
            recommendation={recommendation.recommendation}
            confidence={recommendation.confidence}
            size="sm"
          />
        </div>

        {/* Main Metrics Grid */}
        <div className="grid grid-cols-3 gap-3 mb-3">
          <div>
            <div className="text-xs text-gray-500 uppercase">Spend 7d</div>
            <div className="text-lg font-semibold text-gray-100">
              {spend7d > 0 ? `€${formatCurrency(spend7d)}` : '-'}
            </div>
          </div>
          <div>
            <div className="text-xs text-gray-500 uppercase">Acquisitions</div>
            <div className="text-lg font-semibold text-gray-100">
              {totalAcquisitions.toLocaleString()}
            </div>
          </div>
          <div>
            <div className="text-xs text-gray-500 uppercase">Payback 51d</div>
            <div className={`text-lg font-semibold ${
              payback51dAgg >= 1.5 ? 'text-green-400' :
              payback51dAgg >= 1 ? 'text-yellow-400' :
              payback51dAgg > 0 ? 'text-red-400' : 'text-gray-500'
            }`}>
              {formatPayback(payback51dAgg)}
            </div>
          </div>
        </div>

        {/* Secondary Metrics */}
        <div className="flex items-center gap-4 text-xs text-gray-400">
          <span>LTV: €{ltv51dAgg.toFixed(0)}</span>
          <span className="text-gray-600">|</span>
          <span>{activeCampaigns}/{totalCampaigns} camps</span>
          <span className="text-gray-600">|</span>
          <span>Age: {minCampaignAgeDays}d</span>
        </div>

        {/* Attribution Coverage Bar */}
        <div className="mt-3">
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-gray-500">Attribution Coverage</span>
            <span className={attributionCoverage.percentage >= 70 ? 'text-green-400' :
              attributionCoverage.percentage >= 50 ? 'text-yellow-400' : 'text-red-400'}>
              {attributionCoverage.percentage}%
            </span>
          </div>
          <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                attributionCoverage.percentage >= 70 ? 'bg-green-500' :
                attributionCoverage.percentage >= 50 ? 'bg-yellow-500' : 'bg-red-500'
              }`}
              style={{ width: `${Math.min(attributionCoverage.percentage, 100)}%` }}
            />
          </div>
        </div>

        {/* Extra content slot */}
        {extra}
      </div>

      {/* Expandable Section */}
      {(topCampaigns && topCampaigns.length > 0) && (
        <>
          <button
            onClick={() => setExpanded(!expanded)}
            className="w-full px-4 py-2 flex items-center justify-between text-xs text-gray-400 hover:bg-gray-800/50 border-t border-gray-800"
          >
            <span>Top Campaigns ({topCampaigns.length})</span>
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          {expanded && (
            <div className="px-4 pb-4 space-y-2">
              {topCampaigns.map((camp) => (
                <div
                  key={camp.campaignId}
                  className="flex items-center justify-between text-xs bg-gray-800/50 rounded px-2 py-1.5"
                >
                  <span className="text-gray-300 truncate max-w-[180px]" title={camp.campaignName}>
                    {camp.campaignName}
                  </span>
                  <div className="flex items-center gap-3 text-gray-400">
                    <span>€{formatCurrency(camp.spend7d)}</span>
                    <span className={
                      camp.payback51d >= 1.5 ? 'text-green-400' :
                      camp.payback51d >= 1 ? 'text-yellow-400' :
                      camp.payback51d > 0 ? 'text-red-400' : ''
                    }>
                      {formatPayback(camp.payback51d)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Rationale Footer */}
      <div className="px-4 py-2 bg-gray-800/30 border-t border-gray-800">
        <p className="text-xs text-gray-400 italic">{recommendation.rationale}</p>
      </div>
    </div>
  );
}
