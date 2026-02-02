import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import type { Snapshot } from '../api/client';

interface Props {
  snapshots: Snapshot[];
}

export function DailyMarginChart({ snapshots }: Props) {
  // Transform snapshots into chart data
  // Note: We need net_revenue_eur and ad_spend_eur from snapshots
  const data = snapshots
    .slice()
    .reverse() // Oldest first
    .map(s => ({
      date: s.snapshot_date.slice(5), // MM-DD
      revenueM1: s.net_revenue_eur || 0,
      adSpend: s.ad_spend_eur || 0,
      margin: (s.net_revenue_eur || 0) - (s.ad_spend_eur || 0),
    }));

  // Calculate current trend
  const latestMargin = data.length > 0 ? data[data.length - 1].margin : 0;
  const previousMargin = data.length > 1 ? data[data.length - 2].margin : 0;
  const marginTrend = latestMargin - previousMargin;

  return (
    <div className="bg-gray-900 rounded-xl p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="text-sm text-gray-400 uppercase tracking-wide">
          Margen Diario: Revenue vs Ad Spend
        </div>
        <div className={`text-sm font-medium ${marginTrend >= 0 ? 'text-green-400' : 'text-red-400'}`}>
          Gap: €{latestMargin.toLocaleString()} {marginTrend >= 0 ? '↑' : '↓'}
        </div>
      </div>

      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#22c55e" stopOpacity={0}/>
              </linearGradient>
              <linearGradient id="colorAdSpend" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <XAxis
              dataKey="date"
              stroke="#4b5563"
              fontSize={10}
              tickLine={false}
            />
            <YAxis
              stroke="#4b5563"
              fontSize={10}
              tickLine={false}
              tickFormatter={(v) => `€${(v/1000).toFixed(0)}k`}
              width={50}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#1f2937',
                border: '1px solid #374151',
                borderRadius: 8
              }}
              labelStyle={{ color: '#9ca3af' }}
              formatter={(value, name) => [
                `€${(typeof value === 'number' ? value : 0).toLocaleString()}`,
                name === 'revenueM1' ? 'Revenue M1' : name === 'adSpend' ? 'Ad Spend' : 'Margin'
              ]}
            />
            <Legend
              verticalAlign="top"
              height={36}
              formatter={(value) => (
                <span className="text-xs text-gray-400">
                  {value === 'revenueM1' ? 'Revenue M1' : value === 'adSpend' ? 'Ad Spend' : 'Margin'}
                </span>
              )}
            />
            <Area
              type="monotone"
              dataKey="revenueM1"
              stroke="#22c55e"
              strokeWidth={2}
              fill="url(#colorRevenue)"
            />
            <Area
              type="monotone"
              dataKey="adSpend"
              stroke="#ef4444"
              strokeWidth={2}
              fill="url(#colorAdSpend)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Quick insight */}
      <div className="mt-2 text-xs text-gray-500 text-center">
        El gap entre las líneas = tu margen. Si se achica → alarma.
      </div>
    </div>
  );
}
