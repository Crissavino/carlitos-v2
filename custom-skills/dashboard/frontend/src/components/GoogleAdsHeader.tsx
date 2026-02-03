import { RefreshCw, ChevronDown, Calendar } from 'lucide-react';

export type DateRange = '7d' | '14d' | '30d' | 'today';

interface GoogleAdsHeaderProps {
  title: string;
  subtitle?: string;
  campaigns: { id: string; name: string }[];
  selectedCampaign: string;
  onCampaignChange: (campaignId: string) => void;
  dateRange: DateRange;
  onDateRangeChange: (range: DateRange) => void;
  onRefresh: () => void;
  loading?: boolean;
  lastUpdate?: Date;
  // Optional summary metrics for header bar
  totalSpend?: number;
  totalItems?: number;
  currency?: string;
}

const DATE_RANGE_LABELS: Record<DateRange, string> = {
  'today': 'Hoy',
  '7d': 'Últimos 7 días',
  '14d': 'Últimos 14 días',
  '30d': 'Últimos 30 días',
};

export function GoogleAdsHeader({
  title,
  subtitle,
  campaigns,
  selectedCampaign,
  onCampaignChange,
  dateRange,
  onDateRangeChange,
  onRefresh,
  loading,
  lastUpdate,
  totalSpend,
  totalItems,
  currency = '€',
}: GoogleAdsHeaderProps) {
  const selectedCampaignData = campaigns.find(c => c.id === selectedCampaign);

  return (
    <div className="mb-6">
      {/* Top filter bar - Google Ads style */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        {/* Campaign selector */}
        <div className="relative">
          <select
            value={selectedCampaign}
            onChange={(e) => onCampaignChange(e.target.value)}
            className="appearance-none bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md pl-3 pr-8 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 cursor-pointer min-w-[200px]"
          >
            <option value="">Todas las campañas</option>
            {campaigns.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name.length > 35 ? c.name.substring(0, 35) + '...' : c.name}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
        </div>

        {/* Campaign status badge */}
        {selectedCampaignData && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md">
            <div className="w-2 h-2 rounded-full bg-green-500" />
            <span className="text-sm text-green-700 dark:text-green-400">Enabled</span>
          </div>
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Date range selector */}
        <div className="relative flex items-center gap-2">
          <Calendar className="w-4 h-4 text-gray-500" />
          <select
            value={dateRange}
            onChange={(e) => onDateRangeChange(e.target.value as DateRange)}
            className="appearance-none bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md pl-3 pr-8 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
          >
            {Object.entries(DATE_RANGE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
        </div>

        {/* Refresh button */}
        <button
          onClick={onRefresh}
          disabled={loading}
          className="p-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 transition disabled:opacity-50"
          title="Actualizar"
        >
          <RefreshCw className={`w-4 h-4 text-gray-600 dark:text-gray-400 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Title and summary */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-normal text-gray-900 dark:text-white">{title}</h1>
          {subtitle && (
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{subtitle}</p>
          )}
        </div>

        <div className="flex items-center gap-6 text-sm text-gray-500 dark:text-gray-400">
          {totalItems !== undefined && (
            <span>{totalItems.toLocaleString()} elementos</span>
          )}
          {totalSpend !== undefined && (
            <span>Gasto: {currency}{totalSpend.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          )}
          {lastUpdate && (
            <span>Actualizado: {lastUpdate.toLocaleTimeString()}</span>
          )}
        </div>
      </div>
    </div>
  );
}
