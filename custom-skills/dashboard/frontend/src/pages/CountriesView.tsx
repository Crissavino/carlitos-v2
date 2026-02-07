import { Map, Flag } from 'lucide-react';
import { useCohort } from '../contexts/CohortContext';

// Base mock data for countries
const BASE_COUNTRIES = [
  { code: 'NL', name: 'Netherlands', frr: 45.2, cpfr: 72, refundRate: 3.2, disputeRate: 0.2, trials: 89, revenue: 28500 },
  { code: 'BE', name: 'Belgium', frr: 41.8, cpfr: 78, refundRate: 4.1, disputeRate: 0.3, trials: 56, revenue: 18200 },
  { code: 'DE', name: 'Germany', frr: 38.5, cpfr: 85, refundRate: 4.8, disputeRate: 0.4, trials: 124, revenue: 42000 },
  { code: 'ES', name: 'Spain', frr: 32.1, cpfr: 95, refundRate: 6.2, disputeRate: 0.6, trials: 78, revenue: 15800 },
  { code: 'FR', name: 'France', frr: 35.8, cpfr: 88, refundRate: 5.5, disputeRate: 0.5, trials: 92, revenue: 22400 },
  { code: 'US', name: 'United States', frr: 28.4, cpfr: 115, refundRate: 8.2, disputeRate: 1.1, trials: 145, revenue: 38500 },
  { code: 'UK', name: 'United Kingdom', frr: 33.2, cpfr: 92, refundRate: 5.8, disputeRate: 0.7, trials: 67, revenue: 19200 },
];

type Status = 'green' | 'yellow' | 'red';

function getStatus(value: number, thresholds: { green: number; yellow: number }, inverse = false): Status {
  if (inverse) {
    if (value <= thresholds.green) return 'green';
    if (value <= thresholds.yellow) return 'yellow';
    return 'red';
  }
  if (value >= thresholds.green) return 'green';
  if (value >= thresholds.yellow) return 'yellow';
  return 'red';
}

const statusColors: Record<Status, string> = {
  green: 'text-green-400 bg-green-500/10',
  yellow: 'text-yellow-400 bg-yellow-500/10',
  red: 'text-red-400 bg-red-500/10',
};

export function CountriesView() {
  const { selectedRange, isPeriod, days, monthsAvailable } = useCohort();

  // Generate data factor based on selection
  const dataFactor = isPeriod
    ? Math.min(days / 60, 1)
    : monthsAvailable / 6;

  const countries = BASE_COUNTRIES.map((country) => {
    // Older cohorts have more accumulated revenue and trials
    const revenueMultiplier = 0.4 + (dataFactor * 0.6);
    const trialsMultiplier = 0.5 + (dataFactor * 0.5);

    // FRR improves with maturity (more time to convert)
    const frrBoost = dataFactor * 5;

    // Rates stabilize with more data
    const rateVariation = (1 - dataFactor) * 0.2;

    return {
      ...country,
      frr: +(country.frr + frrBoost).toFixed(1),
      cpfr: Math.round(country.cpfr * (1 - dataFactor * 0.1)),
      refundRate: +(country.refundRate * (1 + rateVariation)).toFixed(1),
      disputeRate: +(country.disputeRate * (1 + rateVariation)).toFixed(2),
      trials: Math.round(country.trials * trialsMultiplier),
      revenue: Math.round(country.revenue * revenueMultiplier),
    };
  });

  const sortedCountries = [...countries].sort((a, b) => b.revenue - a.revenue);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-2 flex items-center gap-3">
          <Map className="w-7 h-7 text-green-400" />
          Vista Países
        </h1>
        <p className="text-gray-400">
          Análisis Geográfico y de Riesgo - {selectedRange.label}
        </p>
      </div>

      {/* Table */}
      <div className="bg-gray-800/50 rounded-xl border border-gray-700/50 overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-900/50">
              <th className="text-left px-6 py-4 text-sm font-medium text-gray-400">País</th>
              <th className="text-center px-4 py-4 text-sm font-medium text-gray-400">FRR</th>
              <th className="text-center px-4 py-4 text-sm font-medium text-gray-400">CPFR</th>
              <th className="text-center px-4 py-4 text-sm font-medium text-gray-400">Refund</th>
              <th className="text-center px-4 py-4 text-sm font-medium text-gray-400">Dispute</th>
              <th className="text-center px-4 py-4 text-sm font-medium text-gray-400">Trials</th>
              <th className="text-right px-6 py-4 text-sm font-medium text-gray-400">Revenue</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700/50">
            {sortedCountries.map((country) => {
              const frrStatus = getStatus(country.frr, { green: 35, yellow: 25 });
              const cpfrStatus = getStatus(country.cpfr, { green: 90, yellow: 120 }, true);
              const refundStatus = getStatus(country.refundRate, { green: 5, yellow: 10 }, true);
              const disputeStatus = getStatus(country.disputeRate, { green: 1, yellow: 1.5 }, true);

              return (
                <tr key={country.code} className="hover:bg-gray-800/30 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <Flag className="w-4 h-4 text-gray-500" />
                      <div>
                        <div className="font-medium">{country.name}</div>
                        <div className="text-xs text-gray-500">{country.code}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <div className={`text-center rounded px-2 py-1 ${statusColors[frrStatus]}`}>
                      {country.frr}%
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <div className={`text-center rounded px-2 py-1 ${statusColors[cpfrStatus]}`}>
                      €{country.cpfr}
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <div className={`text-center rounded px-2 py-1 ${statusColors[refundStatus]}`}>
                      {country.refundRate}%
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <div className={`text-center rounded px-2 py-1 ${statusColors[disputeStatus]}`}>
                      {country.disputeRate}%
                    </div>
                  </td>
                  <td className="px-4 py-4 text-center text-gray-300">
                    {country.trials}
                  </td>
                  <td className="px-6 py-4 text-right font-medium">
                    €{country.revenue.toLocaleString()}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Thresholds */}
      <div className="mt-4 p-4 bg-gray-800/30 rounded-lg text-sm text-gray-500">
        <strong className="text-gray-400">Umbrales:</strong>
        <span className="ml-4">FRR: ≥35% verde, ≥25% amarillo</span>
        <span className="ml-4">CPFR: ≤€90 verde, ≤€120 amarillo</span>
        <span className="ml-4">Refund: ≤5% verde, ≤10% amarillo</span>
        <span className="ml-4">Dispute: ≤1% verde, ≤1.5% amarillo</span>
      </div>
    </div>
  );
}
