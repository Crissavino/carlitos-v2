import { type CohortDistributionItem } from '../api/client';

interface Props {
  data: CohortDistributionItem[];
  totalActiveCustomers: number;
}

export function CohortDistributionChart({ data, totalActiveCustomers }: Props) {
  if (!data || data.length === 0) {
    return (
      <div className="bg-gray-900 rounded-xl p-6 text-center text-gray-500">
        Sin datos de distribución
      </div>
    );
  }

  // Find the maximum for scaling
  const maxCustomers = Math.max(...data.map(d => d.activeCustomers));

  // Color mapping for each cohort
  const getColor = (month: string) => {
    const colors: Record<string, string> = {
      'M1': 'bg-green-500',
      'M2': 'bg-blue-500',
      'M3': 'bg-purple-500',
      'M4': 'bg-yellow-500',
      'M5': 'bg-orange-500',
      'M6': 'bg-red-500',
      'M7+': 'bg-gray-500',
    };
    return colors[month] || 'bg-gray-500';
  };

  return (
    <div className="bg-gray-900 rounded-xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">Distribución de Clientes por Mes</h3>
        <span className="text-sm text-gray-400">
          Total Activos: {totalActiveCustomers.toLocaleString()}
        </span>
      </div>

      <div className="space-y-3">
        {data.map((item) => {
          const percentage = totalActiveCustomers > 0
            ? ((item.activeCustomers / totalActiveCustomers) * 100).toFixed(1)
            : '0';
          const barWidth = maxCustomers > 0
            ? (item.activeCustomers / maxCustomers) * 100
            : 0;

          return (
            <div key={item.cohortMonth} className="flex items-center gap-3">
              {/* Month Label */}
              <div className="w-12 text-sm font-medium text-gray-400">
                {item.cohortMonth}
              </div>

              {/* Bar */}
              <div className="flex-1 h-8 bg-gray-800 rounded-lg overflow-hidden">
                <div
                  className={`h-full ${getColor(item.cohortMonth)} transition-all duration-500 flex items-center px-2`}
                  style={{ width: `${barWidth}%` }}
                >
                  {barWidth > 20 && (
                    <span className="text-xs text-white font-medium">
                      {item.activeCustomers.toLocaleString()}
                    </span>
                  )}
                </div>
              </div>

              {/* Stats */}
              <div className="w-24 text-right">
                <div className="text-sm font-medium">{item.activeCustomers.toLocaleString()}</div>
                <div className="text-xs text-gray-500">{percentage}%</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Insight */}
      {data.length > 0 && (
        <div className="mt-4 pt-4 border-t border-gray-800">
          <div className="text-sm text-gray-400">
            {(() => {
              const m1 = data.find(d => d.cohortMonth === 'M1');
              const m1Pct = m1 && totalActiveCustomers > 0
                ? ((m1.activeCustomers / totalActiveCustomers) * 100)
                : 0;

              if (m1Pct > 50) {
                return (
                  <span className="text-green-400">
                    Modelo Utility: {m1Pct.toFixed(0)}% en M1 - La mayoría del revenue viene de clientes nuevos.
                  </span>
                );
              } else if (m1Pct > 30) {
                return (
                  <span className="text-yellow-400">
                    Mix: {m1Pct.toFixed(0)}% en M1 - Revenue balanceado entre nuevos y legacy.
                  </span>
                );
              } else {
                return (
                  <span className="text-blue-400">
                    Revenue Legacy: Solo {m1Pct.toFixed(0)}% en M1 - Depende de retención M2+.
                  </span>
                );
              }
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
