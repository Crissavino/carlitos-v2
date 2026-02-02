import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from 'recharts';

export interface WebsitePayback {
  websiteId: number;
  name: string;
  paybackM1: number;
  status: 'green' | 'yellow' | 'red';
}

interface Props {
  data: WebsitePayback[];
}

const statusColors = {
  green: '#22c55e',
  yellow: '#f59e0b',
  red: '#ef4444',
};

const statusEmoji = {
  green: '✅',
  yellow: '⚠️',
  red: '❌',
};

export function PaybackByWebsiteChart({ data }: Props) {
  // Sort by payback descending
  const sortedData = [...data].sort((a, b) => b.paybackM1 - a.paybackM1);

  return (
    <div className="bg-gray-900 rounded-xl p-4">
      <div className="text-sm text-gray-400 uppercase tracking-wide mb-4">
        Payback M1 por Website
      </div>

      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={sortedData}
            layout="vertical"
            margin={{ top: 5, right: 30, bottom: 5, left: 100 }}
          >
            <XAxis
              type="number"
              stroke="#4b5563"
              fontSize={10}
              tickLine={false}
              domain={[0, 'dataMax']}
              tickFormatter={(v) => `${v.toFixed(1)}x`}
            />
            <YAxis
              type="category"
              dataKey="name"
              stroke="#4b5563"
              fontSize={11}
              tickLine={false}
              width={90}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#1f2937',
                border: '1px solid #374151',
                borderRadius: 8
              }}
              labelStyle={{ color: '#9ca3af' }}
              formatter={(value) => [`${(typeof value === 'number' ? value : 0).toFixed(2)}x`, 'Payback M1']}
            />
            <ReferenceLine
              x={1}
              stroke="#6b7280"
              strokeDasharray="3 3"
              label={{ value: '1x', fill: '#6b7280', fontSize: 10, position: 'top' }}
            />
            <ReferenceLine
              x={1.2}
              stroke="#22c55e"
              strokeDasharray="3 3"
              label={{ value: '1.2x', fill: '#22c55e', fontSize: 10, position: 'top' }}
            />
            <Bar dataKey="paybackM1" radius={[0, 4, 4, 0]}>
              {sortedData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={statusColors[entry.status]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Legend / Quick Actions */}
      <div className="mt-4 pt-3 border-t border-gray-800 space-y-1">
        {sortedData.map((item) => (
          <div key={item.websiteId} className="flex items-center justify-between text-sm">
            <span className="text-gray-400">{item.name}</span>
            <span className={`font-medium ${
              item.status === 'green' ? 'text-green-400' :
              item.status === 'yellow' ? 'text-yellow-400' : 'text-red-400'
            }`}>
              {item.paybackM1.toFixed(2)}x {statusEmoji[item.status]}
              <span className="ml-2 text-xs text-gray-500">
                {item.status === 'green' ? 'Escalar' :
                 item.status === 'yellow' ? 'Monitorear' : 'Revisar'}
              </span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
