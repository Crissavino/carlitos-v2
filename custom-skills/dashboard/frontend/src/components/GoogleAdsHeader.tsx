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
  totalSpend?: number;
  totalItems?: number;
  currency?: string;
}

const DATE_RANGE_LABELS: Record<DateRange, string> = {
  'today': 'Hoy',
  '7d': '7 días',
  '14d': '14 días',
  '30d': '30 días',
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
  return (
    <div className="mb-4 md:mb-6">
      {/* Mobile: Title first */}
      <div className="flex items-center justify-between mb-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-xl md:text-2xl font-semibold text-gray-900 dark:text-white truncate">{title}</h1>
          {subtitle && (
            <p className="text-xs md:text-sm text-gray-500 dark:text-gray-400 truncate">{subtitle}</p>
          )}
        </div>

        {/* Refresh button - always visible */}
        <button
          onClick={onRefresh}
          disabled={loading}
          className="p-2 ml-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition disabled:opacity-50 flex-shrink-0"
          title="Actualizar"
        >
          <RefreshCw className={`w-4 h-4 text-gray-600 dark:text-gray-400 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Filters row - scrollable on mobile */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 -mx-4 px-4 md:mx-0 md:px-0 md:overflow-visible md:flex-wrap">
        {/* Campaign selector */}
        <div className="relative flex-shrink-0">
          <select
            value={selectedCampaign}
            onChange={(e) => onCampaignChange(e.target.value)}
            className="appearance-none bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg pl-3 pr-8 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer min-w-[140px] md:min-w-[200px]"
          >
            <option value="">Todas</option>
            {campaigns.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name.length > 25 ? c.name.substring(0, 25) + '...' : c.name}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
        </div>

        {/* Date range selector */}
        <div className="relative flex-shrink-0">
          <select
            value={dateRange}
            onChange={(e) => onDateRangeChange(e.target.value as DateRange)}
            className="appearance-none bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg pl-8 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
          >
            {Object.entries(DATE_RANGE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
          <Calendar className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
        </div>

        {/* Quick stats - hidden on very small screens */}
        <div className="hidden sm:flex items-center gap-3 ml-auto text-xs md:text-sm text-gray-500 dark:text-gray-400 flex-shrink-0">
          {totalItems !== undefined && (
            <span className="bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">
              {totalItems.toLocaleString()}
            </span>
          )}
          {totalSpend !== undefined && (
            <span className="bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">
              {currency}{totalSpend.toFixed(0)}
            </span>
          )}
        </div>
      </div>

      {/* Mobile: Stats row */}
      <div className="flex sm:hidden items-center gap-2 mt-2 text-xs text-gray-500">
        {totalItems !== undefined && <span>{totalItems} items</span>}
        {totalItems !== undefined && totalSpend !== undefined && <span>•</span>}
        {totalSpend !== undefined && <span>{currency}{totalSpend.toFixed(0)}</span>}
        {lastUpdate && (
          <>
            <span>•</span>
            <span>{lastUpdate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          </>
        )}
      </div>
    </div>
  );
}
