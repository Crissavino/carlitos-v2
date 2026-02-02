interface FunnelData {
  adSpend: number;
  trials: number;
  firstRebills: number;
  revenueM1: number;
  refunds: number;
}

interface Props {
  data: FunnelData;
}

export function ConversionFunnel({ data }: Props) {
  const cpt = data.trials > 0 ? data.adSpend / data.trials : 0;
  const frr = data.trials > 0 ? (data.firstRebills / data.trials) * 100 : 0;
  const refundRate = data.revenueM1 > 0 ? (data.refunds / data.revenueM1) * 100 : 0;
  const netM1 = data.revenueM1 - data.refunds;
  const payback = data.adSpend > 0 ? netM1 / data.adSpend : 0;

  const funnelData = [
    {
      name: 'Ad Spend',
      value: data.adSpend,
      label: `€${data.adSpend.toLocaleString()}`,
      color: '#ef4444',
      sublabel: ''
    },
    {
      name: 'Trials',
      value: data.trials * (data.adSpend / Math.max(data.trials, 1)), // Scale for visual
      label: data.trials.toString(),
      color: '#f59e0b',
      sublabel: `CPT €${cpt.toFixed(0)}`
    },
    {
      name: 'First Rebills',
      value: data.firstRebills * (data.adSpend / Math.max(data.trials, 1)),
      label: data.firstRebills.toString(),
      color: '#3b82f6',
      sublabel: `FRR ${frr.toFixed(0)}%`
    },
    {
      name: 'Revenue M1',
      value: data.revenueM1,
      label: `€${data.revenueM1.toLocaleString()}`,
      color: '#22c55e',
      sublabel: ''
    },
    {
      name: 'Refunds',
      value: data.refunds,
      label: `-€${data.refunds.toLocaleString()}`,
      color: '#dc2626',
      sublabel: `${refundRate.toFixed(1)}%`
    },
    {
      name: 'Net M1',
      value: netM1,
      label: `€${netM1.toLocaleString()}`,
      color: payback >= 1 ? '#22c55e' : payback >= 0.9 ? '#f59e0b' : '#ef4444',
      sublabel: `${payback.toFixed(2)}x Payback`
    },
  ];

  return (
    <div className="bg-gray-900 rounded-xl p-4">
      <div className="text-sm text-gray-400 uppercase tracking-wide mb-4">
        Funnel de Conversión (7 días)
      </div>

      {/* Visual Funnel */}
      <div className="space-y-2">
        {funnelData.map((item, idx) => (
          <div key={item.name} className="flex items-center gap-3">
            <div className="w-24 text-xs text-gray-400 text-right">{item.name}</div>
            <div className="flex-1 relative">
              <div
                className="h-8 rounded flex items-center justify-between px-3"
                style={{
                  backgroundColor: item.color + '30',
                  borderLeft: `4px solid ${item.color}`,
                  width: idx === 4 ? '30%' : idx === 5 ? `${Math.min(100, payback * 70)}%` : `${100 - idx * 12}%`
                }}
              >
                <span className="text-sm font-bold text-white">{item.label}</span>
                {item.sublabel && (
                  <span className="text-xs text-gray-400">{item.sublabel}</span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Summary */}
      <div className="mt-4 pt-4 border-t border-gray-800 flex justify-between items-center">
        <span className="text-sm text-gray-400">
          €{data.adSpend.toLocaleString()} invertidos → €{netM1.toLocaleString()} neto
        </span>
        <span className={`text-lg font-bold ${
          payback >= 1.2 ? 'text-green-400' :
          payback >= 0.9 ? 'text-yellow-400' : 'text-red-400'
        }`}>
          {payback.toFixed(2)}x
        </span>
      </div>
    </div>
  );
}
