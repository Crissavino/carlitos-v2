import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import type { Snapshot } from '../api/client';

interface Props {
  snapshots: Snapshot[];
  metric: 'frr' | 'srr' | 'net_roas' | 'cpfr' | 'ltv_30d';
  title: string;
  threshold?: number;
  format?: (v: number) => string;
}

const metricConfig = {
  frr: { color: '#3b82f6', threshold: 0.10, format: (v: number) => `${(v * 100).toFixed(1)}%` },
  srr: { color: '#8b5cf6', threshold: 0.70, format: (v: number) => `${(v * 100).toFixed(1)}%` },
  net_roas: { color: '#22c55e', threshold: 1.0, format: (v: number) => `${v.toFixed(2)}x` },
  cpfr: { color: '#f59e0b', threshold: 50, format: (v: number) => `€${v.toFixed(0)}` },
  ltv_30d: { color: '#10b981', threshold: 100, format: (v: number) => `€${v?.toFixed(0) || '0'}` },
};

export function TrendChart({ snapshots, metric, title, threshold, format }: Props) {
  const config = metricConfig[metric];
  const formatter = format || config.format;
  const thresholdValue = threshold ?? config.threshold;

  const data = snapshots.map(s => ({
    date: s.snapshot_date.slice(5), // MM-DD
    value: s[metric],
  }));

  return (
    <div className="bg-gray-900 rounded-lg p-4">
      <div className="text-sm text-gray-400 uppercase tracking-wide mb-4">{title}</div>
      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
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
              tickFormatter={formatter}
              width={45}
            />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
              labelStyle={{ color: '#9ca3af' }}
              formatter={(value) => [formatter(value as number), title]}
            />
            {thresholdValue && (
              <ReferenceLine
                y={thresholdValue}
                stroke="#ef4444"
                strokeDasharray="3 3"
                label={{ value: 'Min', fill: '#ef4444', fontSize: 10 }}
              />
            )}
            <Line
              type="monotone"
              dataKey="value"
              stroke={config.color}
              strokeWidth={2}
              dot={{ fill: config.color, strokeWidth: 0, r: 3 }}
              activeDot={{ r: 5, fill: config.color }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
