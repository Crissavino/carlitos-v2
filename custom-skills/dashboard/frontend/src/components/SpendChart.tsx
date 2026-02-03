import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Legend,
} from 'recharts';

export interface ChartDataPoint {
  name: string;
  spend?: number;
  clicks?: number;
  conversions?: number;
  acquisitions?: number;
  firstRebills?: number;
  [key: string]: string | number | undefined;
}

interface SpendChartProps {
  data: ChartDataPoint[];
  type?: 'area' | 'bar';
  height?: number;
  showLegend?: boolean;
  metrics?: ('spend' | 'clicks' | 'conversions' | 'acquisitions' | 'firstRebills')[];
  currency?: string;
}

const COLORS = {
  spend: '#8b5cf6',      // purple
  clicks: '#3b82f6',     // blue
  conversions: '#22c55e', // green
  acquisitions: '#06b6d4', // cyan
  firstRebills: '#10b981', // emerald
};

const LABELS = {
  spend: 'Gasto',
  clicks: 'Clicks',
  conversions: 'Conv.',
  acquisitions: 'Acq',
  firstRebills: 'R1',
};

export function SpendChart({
  data,
  type = 'area',
  height = 200,
  showLegend = true,
  metrics = ['spend', 'clicks'],
  currency = '€',
}: SpendChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 text-center text-gray-500 text-sm" style={{ height }}>
        Sin datos para mostrar
      </div>
    );
  }

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-2 text-xs">
          <p className="font-medium text-gray-900 dark:text-white mb-1">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} style={{ color: entry.color }}>
              {LABELS[entry.dataKey as keyof typeof LABELS] || entry.dataKey}:{' '}
              {entry.dataKey === 'spend' ? `${currency}${entry.value?.toFixed(0)}` : entry.value}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  if (type === 'bar') {
    return (
      <div style={{ height }} className="w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
            <XAxis
              dataKey="name"
              tick={{ fill: '#9ca3af', fontSize: 10 }}
              tickLine={false}
              axisLine={{ stroke: '#374151' }}
            />
            <YAxis
              tick={{ fill: '#9ca3af', fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              width={40}
            />
            <Tooltip content={<CustomTooltip />} />
            {showLegend && <Legend wrapperStyle={{ fontSize: '10px' }} />}
            {metrics.map((metric) => (
              <Bar
                key={metric}
                dataKey={metric}
                name={LABELS[metric]}
                fill={COLORS[metric]}
                radius={[4, 4, 0, 0]}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    );
  }

  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
          <defs>
            {metrics.map((metric) => (
              <linearGradient key={metric} id={`gradient-${metric}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={COLORS[metric]} stopOpacity={0.3} />
                <stop offset="95%" stopColor={COLORS[metric]} stopOpacity={0} />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
          <XAxis
            dataKey="name"
            tick={{ fill: '#9ca3af', fontSize: 10 }}
            tickLine={false}
            axisLine={{ stroke: '#374151' }}
          />
          <YAxis
            tick={{ fill: '#9ca3af', fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            width={40}
          />
          <Tooltip content={<CustomTooltip />} />
          {showLegend && <Legend wrapperStyle={{ fontSize: '10px' }} />}
          {metrics.map((metric) => (
            <Area
              key={metric}
              type="monotone"
              dataKey={metric}
              name={LABELS[metric]}
              stroke={COLORS[metric]}
              fill={`url(#gradient-${metric})`}
              strokeWidth={2}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

// Helper to build chart data from campaign/keyword data
export function buildChartDataFromItems<T extends { campaignName?: string; keywordText?: string; searchTerm?: string; spend7d?: number; spend?: number; clicks?: number; acquisitions?: number; firstRebills?: number }>(
  items: T[],
  groupBy: 'campaign' | 'keyword' | 'searchTerm' = 'campaign',
  limit: number = 10
): ChartDataPoint[] {
  // Group by and sum
  const grouped = new Map<string, { spend: number; clicks: number; acquisitions: number; firstRebills: number }>();

  items.forEach((item) => {
    const key = groupBy === 'campaign' ? item.campaignName :
                groupBy === 'keyword' ? item.keywordText :
                item.searchTerm;
    if (!key) return;

    const current = grouped.get(key) || { spend: 0, clicks: 0, acquisitions: 0, firstRebills: 0 };
    grouped.set(key, {
      spend: current.spend + (item.spend7d || item.spend || 0),
      clicks: current.clicks + (item.clicks || 0),
      acquisitions: current.acquisitions + (item.acquisitions || 0),
      firstRebills: current.firstRebills + (item.firstRebills || 0),
    });
  });

  // Sort by spend and take top N
  return Array.from(grouped.entries())
    .sort((a, b) => b[1].spend - a[1].spend)
    .slice(0, limit)
    .map(([name, values]) => ({
      name: name.length > 15 ? name.substring(0, 15) + '...' : name,
      ...values,
    }));
}
