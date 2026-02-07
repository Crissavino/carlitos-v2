import { Activity } from 'lucide-react';

// Mock data for websites
const MOCK_WEBSITES = [
  {
    name: 'conversie-pdf.com',
    currency: 'EUR',
    kpis: {
      frr: { value: 42.5, status: 'green' as const },
      cpfr: { value: 78, status: 'green' as const },
      refundRate: { value: 3.8, status: 'green' as const },
      paybackM1: { value: 1.35, status: 'green' as const },
      trials: { value: 156, change: 12 },
    }
  },
  {
    name: 'convierte-pdf.com',
    currency: 'EUR',
    kpis: {
      frr: { value: 35.2, status: 'green' as const },
      cpfr: { value: 95, status: 'yellow' as const },
      refundRate: { value: 5.2, status: 'yellow' as const },
      paybackM1: { value: 1.12, status: 'yellow' as const },
      trials: { value: 89, change: -5 },
    }
  },
  {
    name: 'device-finder.com',
    currency: 'USD',
    kpis: {
      frr: { value: 28.1, status: 'yellow' as const },
      cpfr: { value: 125, status: 'red' as const },
      refundRate: { value: 8.5, status: 'red' as const },
      paybackM1: { value: 0.85, status: 'red' as const },
      trials: { value: 45, change: -18 },
    }
  },
];

type Status = 'green' | 'yellow' | 'red';

const statusColors: Record<Status, string> = {
  green: 'text-green-400',
  yellow: 'text-yellow-400',
  red: 'text-red-400',
};

const statusBg: Record<Status, string> = {
  green: 'bg-green-500/10 border-green-500/30',
  yellow: 'bg-yellow-500/10 border-yellow-500/30',
  red: 'bg-red-500/10 border-red-500/30',
};

export function WebsitesView() {
  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-2 flex items-center gap-3">
          <Activity className="w-7 h-7 text-purple-400" />
          Vista Websites
        </h1>
        <p className="text-gray-400">Performance de Producto/Oferta por Website - Cohortes Maduras (30-60d)</p>
      </div>

      {/* Table */}
      <div className="bg-gray-800/50 rounded-xl border border-gray-700/50 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-900/50">
              <th className="text-left px-6 py-4 text-sm font-medium text-gray-400">Website</th>
              <th className="text-center px-4 py-4 text-sm font-medium text-gray-400">FRR</th>
              <th className="text-center px-4 py-4 text-sm font-medium text-gray-400">CPFR</th>
              <th className="text-center px-4 py-4 text-sm font-medium text-gray-400">Refund Rate</th>
              <th className="text-center px-4 py-4 text-sm font-medium text-gray-400">Payback M1</th>
              <th className="text-center px-4 py-4 text-sm font-medium text-gray-400">Trials (7d)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700/50">
            {MOCK_WEBSITES.map((website) => (
              <tr key={website.name} className="hover:bg-gray-800/30 transition-colors">
                <td className="px-6 py-4">
                  <div className="font-medium">{website.name}</div>
                  <div className="text-xs text-gray-500">{website.currency}</div>
                </td>
                <td className="px-4 py-4">
                  <div className={`text-center rounded-lg py-2 border ${statusBg[website.kpis.frr.status]}`}>
                    <span className={`font-bold ${statusColors[website.kpis.frr.status]}`}>
                      {website.kpis.frr.value}%
                    </span>
                  </div>
                </td>
                <td className="px-4 py-4">
                  <div className={`text-center rounded-lg py-2 border ${statusBg[website.kpis.cpfr.status]}`}>
                    <span className={`font-bold ${statusColors[website.kpis.cpfr.status]}`}>
                      €{website.kpis.cpfr.value}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-4">
                  <div className={`text-center rounded-lg py-2 border ${statusBg[website.kpis.refundRate.status]}`}>
                    <span className={`font-bold ${statusColors[website.kpis.refundRate.status]}`}>
                      {website.kpis.refundRate.value}%
                    </span>
                  </div>
                </td>
                <td className="px-4 py-4">
                  <div className={`text-center rounded-lg py-2 border ${statusBg[website.kpis.paybackM1.status]}`}>
                    <span className={`font-bold ${statusColors[website.kpis.paybackM1.status]}`}>
                      {website.kpis.paybackM1.value}x
                    </span>
                  </div>
                </td>
                <td className="px-4 py-4 text-center">
                  <div className="font-bold">{website.kpis.trials.value}</div>
                  <div className={`text-xs ${website.kpis.trials.change >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {website.kpis.trials.change >= 0 ? '+' : ''}{website.kpis.trials.change}%
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="mt-4 flex items-center gap-6 text-sm text-gray-500">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-green-500/30 border border-green-500/50"></div>
          <span>Meta cumplida</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-yellow-500/30 border border-yellow-500/50"></div>
          <span>Atención</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-red-500/30 border border-red-500/50"></div>
          <span>Crítico</span>
        </div>
      </div>
    </div>
  );
}
