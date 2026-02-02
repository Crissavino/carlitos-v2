import { useState, useMemo } from 'react';
import { ChevronUp, ChevronDown, ArrowUpDown, HelpCircle } from 'lucide-react';
import type { CampaignMetrics } from '../api/client';

interface Props {
  campaigns: CampaignMetrics[];
  loading?: boolean;
}

type SortField = 'campaignName' | 'spend7d' | 'acquisitions' | 'firstRebills' | 'cpfr' | 'payback21d' | 'payback51d' | 'campaignAgeDays';
type SortDir = 'asc' | 'desc';

// Tooltips for column headers
const COLUMN_TOOLTIPS: Record<string, string> = {
  spend7d: 'Gasto en ads de los últimos 7 días (en EUR)',
  acquisitions: 'Trials/Adquisiciones - clientes que iniciaron trial',
  firstRebills: 'First Rebills - clientes que pagaron la primera subscripción',
  cpfr: 'Cost Per First Rebill = Gasto Ads / First Rebills. Es el costo real de adquirir un cliente de pago.',
  payback21d: 'Payback a 21 días = LTV_21d / CPFR. Indica recuperación temprana (solo R1). No usar para decisiones fuertes.',
  payback51d: 'Payback a 51 días = LTV_51d / CPFR. Incluye R1+R2. ESTE es el KPI para decisiones de escalar/pausar.',
  campaignAgeDays: 'Días desde que la campaña empezó a generar datos. Mínimo 51d para decisiones confiables.',
};

const statusColors: Record<string, string> = {
  green: 'bg-green-500',
  yellow: 'bg-yellow-500',
  red: 'bg-red-500',
};

const statusBg: Record<string, string> = {
  green: 'bg-green-500/10',
  yellow: 'bg-yellow-500/10',
  red: 'bg-red-500/10',
};

export function CampaignsTable({ campaigns, loading }: Props) {
  const [sortField, setSortField] = useState<SortField>('spend7d');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const sortedCampaigns = useMemo(() => {
    return [...campaigns].sort((a, b) => {
      const aVal = a[sortField];
      const bVal = b[sortField];

      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortDir === 'asc'
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      }

      const numA = Number(aVal) || 0;
      const numB = Number(bVal) || 0;
      return sortDir === 'asc' ? numA - numB : numB - numA;
    });
  }, [campaigns, sortField, sortDir]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  };

  const SortHeader = ({ field, children, tooltip }: { field: SortField; children: React.ReactNode; tooltip?: string }) => (
    <th
      onClick={() => handleSort(field)}
      className="px-3 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider cursor-pointer hover:text-white transition group"
    >
      <div className="flex items-center gap-1">
        {children}
        {tooltip && (
          <span title={tooltip} className="cursor-help">
            <HelpCircle className="w-3 h-3 text-gray-600 hover:text-gray-400" />
          </span>
        )}
        {sortField === field ? (
          sortDir === 'asc' ? (
            <ChevronUp className="w-4 h-4" />
          ) : (
            <ChevronDown className="w-4 h-4" />
          )
        ) : (
          <ArrowUpDown className="w-4 h-4 opacity-0 group-hover:opacity-50" />
        )}
      </div>
    </th>
  );

  if (loading) {
    return (
      <div className="bg-gray-900 rounded-xl p-8 text-center">
        <div className="animate-pulse text-gray-500">Cargando campanas...</div>
      </div>
    );
  }

  if (campaigns.length === 0) {
    return (
      <div className="bg-gray-900 rounded-xl p-8 text-center">
        <div className="text-gray-500 text-lg mb-2">Sin datos de campanas</div>
        <div className="text-gray-600 text-sm">
          Verifica que el script de Google Ads este enviando datos al webhook
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-900 rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-800/50">
            <tr>
              <th className="px-3 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider w-8">
                Estado
              </th>
              <SortHeader field="campaignName">Campaña</SortHeader>
              <SortHeader field="spend7d" tooltip={COLUMN_TOOLTIPS.spend7d}>Gasto 7d</SortHeader>
              <SortHeader field="acquisitions" tooltip={COLUMN_TOOLTIPS.acquisitions}>Acq</SortHeader>
              <SortHeader field="firstRebills" tooltip={COLUMN_TOOLTIPS.firstRebills}>R1</SortHeader>
              <SortHeader field="cpfr" tooltip={COLUMN_TOOLTIPS.cpfr}>CPFR</SortHeader>
              <SortHeader field="payback21d" tooltip={COLUMN_TOOLTIPS.payback21d}>PB 21d</SortHeader>
              <SortHeader field="payback51d" tooltip={COLUMN_TOOLTIPS.payback51d}>PB 51d</SortHeader>
              <SortHeader field="campaignAgeDays" tooltip={COLUMN_TOOLTIPS.campaignAgeDays}>Edad</SortHeader>
              <th className="px-3 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                Acción
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {sortedCampaigns.map((campaign) => (
              <tr
                key={campaign.campaignId}
                className={`hover:bg-gray-800/30 transition ${statusBg[campaign.payback51dStatus]}`}
              >
                {/* Status Light */}
                <td className="px-3 py-3">
                  <div
                    className={`w-3 h-3 rounded-full ${statusColors[campaign.payback51dStatus]}`}
                    title={`Payback 51d: ${campaign.payback51d}x`}
                  />
                </td>

                {/* Campaign Name */}
                <td className="px-3 py-3">
                  <div className="max-w-[200px]">
                    <div className="font-medium text-sm truncate" title={campaign.campaignName}>
                      {campaign.campaignName}
                    </div>
                    <div className="text-xs text-gray-500">
                      {campaign.status === 'ENABLED' ? (
                        <span className="text-green-400">Activa</span>
                      ) : (
                        <span className="text-gray-500">{campaign.status}</span>
                      )}
                    </div>
                  </div>
                </td>

                {/* Spend 7d */}
                <td className="px-3 py-3 text-sm">
                  <span className="font-mono">{campaign.spend7d.toFixed(0)}</span>
                </td>

                {/* Acquisitions */}
                <td className="px-3 py-3 text-sm text-gray-400">
                  {campaign.acquisitions}
                </td>

                {/* First Rebills */}
                <td className="px-3 py-3 text-sm">
                  {campaign.firstRebills}
                </td>

                {/* CPFR */}
                <td className="px-3 py-3 text-sm font-mono">
                  {campaign.cpfr > 0 ? `${campaign.cpfr.toFixed(0)}` : '-'}
                </td>

                {/* Payback 21d */}
                <td className="px-3 py-3 text-sm">
                  <span className={
                    campaign.payback21d >= 1.0 ? 'text-green-400' :
                    campaign.payback21d >= 0.7 ? 'text-yellow-400' :
                    campaign.payback21d > 0 ? 'text-red-400' : 'text-gray-500'
                  }>
                    {campaign.payback21d > 0 ? `${campaign.payback21d.toFixed(2)}x` : '-'}
                  </span>
                </td>

                {/* Payback 51d */}
                <td className="px-3 py-3 text-sm font-semibold">
                  <span className={
                    campaign.payback51dStatus === 'green' ? 'text-green-400' :
                    campaign.payback51dStatus === 'yellow' ? 'text-yellow-400' :
                    'text-red-400'
                  }>
                    {campaign.payback51d > 0 ? `${campaign.payback51d.toFixed(2)}x` : '-'}
                  </span>
                </td>

                {/* Campaign Age */}
                <td className="px-3 py-3 text-sm text-gray-400">
                  {campaign.campaignAgeDays}d
                </td>

                {/* Recommendation */}
                <td className="px-3 py-3">
                  <span className={`text-xs px-2 py-1 rounded-full ${
                    campaign.recommendation.startsWith('SCALE') ? 'bg-green-500/20 text-green-400' :
                    campaign.recommendation.startsWith('PAUSE') ? 'bg-red-500/20 text-red-400' :
                    campaign.recommendation.startsWith('OPTIMIZAR') ? 'bg-yellow-500/20 text-yellow-400' :
                    'bg-gray-700 text-gray-400'
                  }`}>
                    {campaign.recommendation.split(':')[0]}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Summary Footer */}
      <div className="px-4 py-3 bg-gray-800/30 border-t border-gray-800 flex gap-6 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-green-500" />
          <span className="text-gray-400">Escalar ({campaigns.filter(c => c.payback51dStatus === 'green').length})</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-yellow-500" />
          <span className="text-gray-400">Monitorear ({campaigns.filter(c => c.payback51dStatus === 'yellow').length})</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-red-500" />
          <span className="text-gray-400">Pausar ({campaigns.filter(c => c.payback51dStatus === 'red').length})</span>
        </div>
      </div>
    </div>
  );
}
