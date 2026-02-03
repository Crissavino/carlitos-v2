import { ChevronDown } from 'lucide-react';

export interface MetricCard {
  id: string;
  label: string;
  value: string | number;
  subValue?: string;
  color?: 'blue' | 'red' | 'green' | 'yellow' | 'gray' | 'purple';
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  tooltip?: string;
}

interface PerformanceCardsProps {
  cards: MetricCard[];
  onCardClick?: (cardId: string) => void;
}

const COLOR_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  blue: {
    bg: 'bg-blue-500',
    text: 'text-white',
    border: 'border-blue-600',
  },
  red: {
    bg: 'bg-red-500',
    text: 'text-white',
    border: 'border-red-600',
  },
  green: {
    bg: 'bg-green-500',
    text: 'text-white',
    border: 'border-green-600',
  },
  yellow: {
    bg: 'bg-yellow-500',
    text: 'text-white',
    border: 'border-yellow-600',
  },
  purple: {
    bg: 'bg-purple-500',
    text: 'text-white',
    border: 'border-purple-600',
  },
  gray: {
    bg: 'bg-gray-100 dark:bg-gray-800',
    text: 'text-gray-900 dark:text-white',
    border: 'border-gray-200 dark:border-gray-700',
  },
};

function formatValue(value: string | number): string {
  if (typeof value === 'number') {
    if (value >= 1000000) {
      return (value / 1000000).toFixed(2) + 'M';
    }
    if (value >= 1000) {
      return (value / 1000).toFixed(1) + 'k';
    }
    return value.toLocaleString();
  }
  return value;
}

export function PerformanceCards({ cards, onCardClick }: PerformanceCardsProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 mb-6">
      {cards.map((card) => {
        const colorStyle = COLOR_STYLES[card.color || 'gray'];
        const isColored = card.color && card.color !== 'gray';

        return (
          <div
            key={card.id}
            onClick={() => onCardClick?.(card.id)}
            className={`
              rounded-lg border p-4 transition-all
              ${colorStyle.bg} ${colorStyle.border}
              ${onCardClick ? 'cursor-pointer hover:shadow-md hover:scale-[1.02]' : ''}
            `}
            title={card.tooltip}
          >
            {/* Label with dropdown indicator (like Google Ads) */}
            <div className={`flex items-center gap-1 text-sm mb-2 ${isColored ? 'text-white/80' : 'text-gray-500 dark:text-gray-400'}`}>
              <span>{card.label}</span>
              {onCardClick && <ChevronDown className="w-3 h-3" />}
            </div>

            {/* Value */}
            <div className={`text-2xl font-medium ${colorStyle.text}`}>
              {formatValue(card.value)}
            </div>

            {/* Sub value or trend */}
            {(card.subValue || card.trendValue) && (
              <div className={`text-xs mt-1 ${isColored ? 'text-white/70' : 'text-gray-500 dark:text-gray-400'}`}>
                {card.subValue}
                {card.trendValue && (
                  <span className={card.trend === 'up' ? 'text-green-400' : card.trend === 'down' ? 'text-red-400' : ''}>
                    {card.trend === 'up' ? ' ↑' : card.trend === 'down' ? ' ↓' : ''} {card.trendValue}
                  </span>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// Pre-built card configurations for common metrics
export function buildGoogleAdsCards(data: {
  clicks?: number;
  impressions?: number;
  cost?: number;
  costPerConv?: number;
  ctr?: number;
  cpc?: number;
  // Custom DB metrics
  acquisitions?: number;
  firstRebills?: number;
  cpfr?: number;
  convRate?: number;
  currency?: string;
}): MetricCard[] {
  const currency = data.currency || '€';
  const cards: MetricCard[] = [];

  // Google Ads style: first two cards are colored
  if (data.clicks !== undefined) {
    cards.push({
      id: 'clicks',
      label: 'Clicks',
      value: data.clicks,
      color: 'blue',
    });
  }

  if (data.impressions !== undefined) {
    cards.push({
      id: 'impressions',
      label: 'Impr.',
      value: data.impressions,
      color: 'red',
    });
  }

  // Gray cards for cost metrics
  if (data.costPerConv !== undefined) {
    cards.push({
      id: 'costPerConv',
      label: 'Cost/conv.',
      value: data.costPerConv > 0 ? `${currency}${data.costPerConv.toFixed(2)}` : '-',
      color: 'gray',
    });
  }

  if (data.cost !== undefined) {
    cards.push({
      id: 'cost',
      label: 'Costo',
      value: `${currency}${data.cost.toFixed(2)}`,
      color: 'gray',
    });
  }

  // Our custom metrics - use distinctive colors
  if (data.acquisitions !== undefined && data.firstRebills !== undefined) {
    cards.push({
      id: 'conversions',
      label: 'Acq/R1',
      value: `${data.acquisitions}/${data.firstRebills}`,
      color: 'green',
      tooltip: 'Adquisiciones / Primer Rebill (de DB)',
    });
  }

  if (data.cpfr !== undefined && data.cpfr > 0) {
    cards.push({
      id: 'cpfr',
      label: 'CPFR',
      value: `${currency}${data.cpfr.toFixed(0)}`,
      color: 'purple',
      tooltip: 'Cost Per First Rebill (de DB)',
    });
  }

  return cards;
}
