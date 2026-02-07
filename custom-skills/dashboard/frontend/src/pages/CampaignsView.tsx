import { useState } from 'react';
import { Megaphone, Filter, ChevronDown } from 'lucide-react';

// Mock data for campaigns
const MOCK_CAMPAIGNS = [
  {
    id: 1,
    name: 'NL - PDF Converter - Search',
    type: 'ACQ',
    status: 'active',
    spend: 2450,
    impressions: 45000,
    clicks: 1250,
    ctr: 2.78,
    trials: 42,
    cpt: 58.33,
    firstRebills: 18,
    frr: 42.9,
    cpfr: 136.11,
    roiReal: 1.45,
    action: '',
  },
  {
    id: 2,
    name: 'BE - Device Finder - Display',
    type: 'ACQ',
    status: 'active',
    spend: 1850,
    impressions: 120000,
    clicks: 980,
    ctr: 0.82,
    trials: 28,
    cpt: 66.07,
    firstRebills: 9,
    frr: 32.1,
    cpfr: 205.56,
    roiReal: 0.72,
    action: '',
  },
  {
    id: 3,
    name: 'DE - PDF Tools - Search Brand',
    type: 'ACQ',
    status: 'active',
    spend: 890,
    impressions: 12000,
    clicks: 850,
    ctr: 7.08,
    trials: 35,
    cpt: 25.43,
    firstRebills: 16,
    frr: 45.7,
    cpfr: 55.63,
    roiReal: 2.85,
    action: '',
  },
  {
    id: 4,
    name: 'ES - Convierte PDF - Search',
    type: 'ACQ',
    status: 'paused',
    spend: 520,
    impressions: 8500,
    clicks: 320,
    ctr: 3.76,
    trials: 12,
    cpt: 43.33,
    firstRebills: 3,
    frr: 25.0,
    cpfr: 173.33,
    roiReal: 0.65,
    action: 'PAUSAR',
  },
  {
    id: 5,
    name: 'NL - PDF Converter - Rebill',
    type: 'REBILL',
    status: 'active',
    spend: 450,
    impressions: 5000,
    clicks: 180,
    ctr: 3.60,
    trials: 0,
    cpt: 0,
    firstRebills: 0,
    frr: 0,
    cpfr: 0,
    roiReal: 3.20,
    action: '',
  },
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
  green: 'text-green-400',
  yellow: 'text-yellow-400',
  red: 'text-red-400',
};

export function CampaignsView() {
  const [cohortFilter, setCohortFilter] = useState<'all' | 'mature' | 'immature'>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | 'ACQ' | 'REBILL'>('all');
  const [actions, setActions] = useState<Record<number, string>>({});

  const filteredCampaigns = MOCK_CAMPAIGNS.filter(c => {
    if (typeFilter !== 'all' && c.type !== typeFilter) return false;
    return true;
  });

  const handleActionChange = (id: number, value: string) => {
    setActions(prev => ({ ...prev, [id]: value }));
  };

  return (
    <div className="p-6 max-w-full mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-2 flex items-center gap-3">
          <Megaphone className="w-7 h-7 text-orange-400" />
          Vista Campañas
        </h1>
        <p className="text-gray-400">Decisiones de Ads - Métricas de monetización de cohortes maduras</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 mb-6">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-400" />
          <span className="text-sm text-gray-400">Filtros:</span>
        </div>

        <div className="relative">
          <select
            value={cohortFilter}
            onChange={(e) => setCohortFilter(e.target.value as typeof cohortFilter)}
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm appearance-none pr-8 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">Todos los Cohortes</option>
            <option value="mature">Maduros (30-60d)</option>
            <option value="immature">Inmaduros (&lt;30d)</option>
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
        </div>

        <div className="relative">
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as typeof typeFilter)}
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm appearance-none pr-8 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">Todos los Tipos</option>
            <option value="ACQ">Adquisición</option>
            <option value="REBILL">Rebill</option>
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
        </div>
      </div>

      {/* Table */}
      <div className="bg-gray-800/50 rounded-xl border border-gray-700/50 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-900/50">
              <th className="text-left px-4 py-3 font-medium text-gray-400 whitespace-nowrap">Campaña</th>
              <th className="text-center px-3 py-3 font-medium text-gray-400">Tipo</th>
              <th className="text-right px-3 py-3 font-medium text-gray-400">Spend</th>
              <th className="text-right px-3 py-3 font-medium text-gray-400">Impr.</th>
              <th className="text-right px-3 py-3 font-medium text-gray-400">Clicks</th>
              <th className="text-right px-3 py-3 font-medium text-gray-400">CTR</th>
              <th className="text-right px-3 py-3 font-medium text-gray-400">Trials</th>
              <th className="text-right px-3 py-3 font-medium text-gray-400">CPT</th>
              <th className="text-right px-3 py-3 font-medium text-gray-400">1st Reb.</th>
              <th className="text-center px-3 py-3 font-medium text-gray-400">FRR</th>
              <th className="text-center px-3 py-3 font-medium text-gray-400">CPFR</th>
              <th className="text-center px-3 py-3 font-medium text-gray-400">ROI</th>
              <th className="text-center px-4 py-3 font-medium text-gray-400">Acción</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700/50">
            {filteredCampaigns.map((campaign) => {
              const frrStatus = campaign.type === 'ACQ' ? getStatus(campaign.frr, { green: 35, yellow: 25 }) : 'green';
              const cpfrStatus = campaign.type === 'ACQ' ? getStatus(campaign.cpfr, { green: 90, yellow: 150 }, true) : 'green';
              const roiStatus = getStatus(campaign.roiReal, { green: 1.5, yellow: 1.0 });

              return (
                <tr key={campaign.id} className="hover:bg-gray-800/30 transition-colors">
                  <td className="px-4 py-3">
                    <div className="font-medium whitespace-nowrap">{campaign.name}</div>
                    <div className={`text-xs ${campaign.status === 'active' ? 'text-green-400' : 'text-gray-500'}`}>
                      {campaign.status}
                    </div>
                  </td>
                  <td className="px-3 py-3 text-center">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      campaign.type === 'ACQ' ? 'bg-blue-500/20 text-blue-400' : 'bg-purple-500/20 text-purple-400'
                    }`}>
                      {campaign.type}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-right">€{campaign.spend.toLocaleString()}</td>
                  <td className="px-3 py-3 text-right text-gray-400">{campaign.impressions.toLocaleString()}</td>
                  <td className="px-3 py-3 text-right">{campaign.clicks.toLocaleString()}</td>
                  <td className="px-3 py-3 text-right text-gray-400">{campaign.ctr.toFixed(2)}%</td>
                  <td className="px-3 py-3 text-right">{campaign.trials || '-'}</td>
                  <td className="px-3 py-3 text-right">{campaign.cpt ? `€${campaign.cpt.toFixed(0)}` : '-'}</td>
                  <td className="px-3 py-3 text-right">{campaign.firstRebills || '-'}</td>
                  <td className="px-3 py-3 text-center">
                    {campaign.type === 'ACQ' && campaign.frr > 0 ? (
                      <span className={statusColors[frrStatus]}>{campaign.frr.toFixed(1)}%</span>
                    ) : '-'}
                  </td>
                  <td className="px-3 py-3 text-center">
                    {campaign.type === 'ACQ' && campaign.cpfr > 0 ? (
                      <span className={statusColors[cpfrStatus]}>€{campaign.cpfr.toFixed(0)}</span>
                    ) : '-'}
                  </td>
                  <td className="px-3 py-3 text-center">
                    <span className={statusColors[roiStatus]}>{campaign.roiReal.toFixed(2)}x</span>
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={actions[campaign.id] || campaign.action}
                      onChange={(e) => handleActionChange(campaign.id, e.target.value)}
                      className="bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs w-24 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                      <option value="">-</option>
                      <option value="ESCALAR">ESCALAR</option>
                      <option value="MANTENER">MANTENER</option>
                      <option value="OPTIMIZAR">OPTIMIZAR</option>
                      <option value="PAUSAR">PAUSAR</option>
                    </select>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
