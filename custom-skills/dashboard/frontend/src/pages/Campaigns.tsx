import { useEffect, useState, useMemo } from 'react';
import { RefreshCw, TrendingUp, Pause, AlertCircle, ChevronDown, Calendar, Zap, Shield } from 'lucide-react';
import { api, type CampaignPerformanceResult, type CampaignActions, type CampaignDecisionSummary, type CampaignDecision, type CampaignMetrics } from '../api/client';
import { PerformanceCards, type MetricCard } from '../components/PerformanceCards';
import { GoogleAdsTable, type Column, StatusDot } from '../components/GoogleAdsTable';

type DateRange = '7d' | '14d' | '30d';

const DATE_RANGE_LABELS: Record<DateRange, string> = {
  '7d': 'Últimos 7 días',
  '14d': 'Últimos 14 días',
  '30d': 'Últimos 30 días',
};

const ACTION_ICONS: Record<string, string> = {
  pause: '⏸️',
  scale: '📈',
  optimize: '⚡',
  monitor: '👁️',
  maintain: '✅',
};

const CONFIDENCE_COLORS: Record<string, string> = {
  high: 'text-green-500',
  medium: 'text-yellow-500',
  low: 'text-gray-500',
};

export function Campaigns() {
  const [data, setData] = useState<CampaignPerformanceResult | null>(null);
  const [actions, setActions] = useState<CampaignActions | null>(null);
  const [decisions, setDecisions] = useState<CampaignDecisionSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [dateRange, setDateRange] = useState<DateRange>('7d');

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [campaignsData, actionsData, decisionsData] = await Promise.all([
        api.getCampaigns(),
        api.getCampaignActions(),
        api.getCampaignDecisions().catch(() => null),
      ]);
      setData(campaignsData);
      setActions(actionsData);
      setDecisions(decisionsData);
      setLastUpdate(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error cargando campañas');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 60000);
    return () => clearInterval(interval);
  }, []);

  // Build performance cards
  const performanceCards: MetricCard[] = useMemo(() => {
    const campaigns = data?.campaigns || [];
    const clicks = campaigns.reduce((sum, c) => sum + c.clicks, 0);
    const impressions = campaigns.reduce((sum, c) => sum + c.impressions, 0);
    const spend = campaigns.reduce((sum, c) => sum + c.spend7d, 0);
    const acquisitions = campaigns.reduce((sum, c) => sum + c.acquisitions, 0);
    const firstRebills = campaigns.reduce((sum, c) => sum + c.firstRebills, 0);
    const cpfr = firstRebills > 0 ? spend / firstRebills : 0;

    return [
      { id: 'clicks', label: 'Clicks', value: clicks, color: 'blue' as const },
      { id: 'impressions', label: 'Impr.', value: impressions, color: 'red' as const },
      { id: 'cost', label: 'Costo', value: `€${spend.toFixed(0)}`, color: 'gray' as const },
      { id: 'conversions', label: 'Acq/R1', value: `${acquisitions}/${firstRebills}`, color: 'green' as const, tooltip: 'Adquisiciones / Primer Rebill' },
      { id: 'cpfr', label: 'CPFR', value: cpfr > 0 ? `€${cpfr.toFixed(0)}` : '-', color: 'purple' as const },
      { id: 'campaigns', label: 'Campañas', value: campaigns.length, color: 'gray' as const },
    ];
  }, [data]);

  // Table columns
  const columns: Column<CampaignMetrics>[] = useMemo(() => [
    {
      id: 'status',
      header: '',
      accessor: (row) => <StatusDot active={row.status === 'ENABLED'} />,
      width: 'w-8',
    },
    {
      id: 'campaign',
      header: 'Campaña',
      accessor: (row) => (
        <div className="font-medium max-w-[250px] truncate" title={row.campaignName}>
          {row.campaignName}
        </div>
      ),
      sortAccessor: (row) => row.campaignName,
    },
    {
      id: 'age',
      header: 'Edad',
      accessor: (row) => (
        <span className={row.campaignAgeDays < 51 ? 'text-yellow-500' : ''}>
          {row.campaignAgeDays}d
        </span>
      ),
      sortAccessor: (row) => row.campaignAgeDays,
      align: 'right',
      tooltip: 'Días desde primera adquisición',
    },
    {
      id: 'conversions',
      header: 'Acq/R1',
      accessor: (row) => (
        <div className="flex items-center gap-1">
          <span className="text-blue-600 dark:text-blue-400">{row.acquisitions}</span>
          <span className="text-gray-400">/</span>
          <span className="text-green-600 dark:text-green-400">{row.firstRebills}</span>
        </div>
      ),
      sortAccessor: (row) => row.firstRebills,
      align: 'right',
    },
    {
      id: 'cpfr',
      header: 'CPFR',
      accessor: (row) => row.cpfr > 0 ? `€${row.cpfr.toFixed(0)}` : '-',
      sortAccessor: (row) => row.cpfr,
      align: 'right',
    },
    {
      id: 'spend7d',
      header: 'Gasto 7d',
      accessor: (row) => `€${row.spend7d.toFixed(0)}`,
      sortAccessor: (row) => row.spend7d,
      align: 'right',
    },
    {
      id: 'clicks',
      header: 'Clicks',
      accessor: (row) => row.clicks.toLocaleString(),
      sortAccessor: (row) => row.clicks,
      align: 'right',
    },
    {
      id: 'ctr',
      header: 'CTR',
      accessor: (row) => `${row.ctr.toFixed(2)}%`,
      sortAccessor: (row) => row.ctr,
      align: 'right',
    },
    {
      id: 'cpc',
      header: 'CPC',
      accessor: (row) => `€${row.cpc.toFixed(2)}`,
      sortAccessor: (row) => row.cpc,
      align: 'right',
    },
    {
      id: 'payback51d',
      header: 'PB 51d',
      accessor: (row) => {
        const pb = row.payback51d;
        const color = row.payback51dStatus === 'green' ? 'text-green-500' :
                     row.payback51dStatus === 'yellow' ? 'text-yellow-500' : 'text-red-500';
        return <span className={`font-medium ${color}`}>{pb.toFixed(2)}x</span>;
      },
      sortAccessor: (row) => row.payback51d,
      align: 'right',
      tooltip: 'Payback a 51 días (LTV 51d / CPFR)',
    },
    {
      id: 'cohort',
      header: 'n',
      accessor: (row) => (
        <span className={row.cohort51dSize < 10 ? 'text-gray-400' : ''}>
          {row.cohort51dSize}
        </span>
      ),
      sortAccessor: (row) => row.cohort51dSize,
      align: 'right',
      tooltip: 'Tamaño del cohorte 51d',
    },
    {
      id: 'recommendation',
      header: 'Acción',
      accessor: (row) => {
        const rec = row.recommendation.toLowerCase();
        const colors: Record<string, string> = {
          scale: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
          monitor: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
          pause: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
          maintain: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
        };
        const labels: Record<string, string> = {
          scale: 'Escalar',
          monitor: 'Monitorear',
          pause: 'Pausar',
          maintain: 'Mantener',
        };
        return (
          <span className={`px-2 py-0.5 text-xs font-medium rounded ${colors[rec] || colors.maintain}`}>
            {labels[rec] || row.recommendation}
          </span>
        );
      },
    },
  ], []);

  if (loading && !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
        <RefreshCw className="w-8 h-8 animate-spin text-gray-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
        <div className="text-center">
          <div className="text-red-500 text-xl mb-4">Error</div>
          <div className="text-gray-400 mb-4">{error}</div>
          <button onClick={loadData} className="px-4 py-2 bg-gray-800 rounded-lg hover:bg-gray-700 transition">
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 p-6">
      <div className="max-w-[1600px] mx-auto">
        {/* Header - Google Ads style */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-4 flex-wrap">
            {/* Date range selector */}
            <div className="relative flex items-center gap-2">
              <Calendar className="w-4 h-4 text-gray-500" />
              <select
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value as DateRange)}
                className="appearance-none bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md pl-3 pr-8 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
              >
                {Object.entries(DATE_RANGE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
            </div>

            <div className="flex-1" />

            {lastUpdate && (
              <span className="text-sm text-gray-500">
                Actualizado: {lastUpdate.toLocaleTimeString()}
              </span>
            )}

            <button
              onClick={loadData}
              disabled={loading}
              className="p-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 transition disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 text-gray-600 dark:text-gray-400 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          <h1 className="text-2xl font-normal text-gray-900 dark:text-white">Campañas</h1>
          <p className="text-sm text-gray-500 mt-1">{data?.totalCampaigns || 0} campañas activas</p>
        </div>

        {/* Performance Cards */}
        <PerformanceCards cards={performanceCards} />

        {/* Action Summary Cards */}
        {actions && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            {/* To Scale */}
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 dark:bg-green-900/40 rounded-lg">
                  <TrendingUp className="w-5 h-5 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-green-700 dark:text-green-400">{actions.toScale.count}</div>
                  <div className="text-sm text-green-600 dark:text-green-500">Listas para Escalar</div>
                </div>
              </div>
              {actions.toScale.count > 0 && (
                <div className="mt-3 text-xs text-gray-600 dark:text-gray-400">
                  {actions.toScale.campaigns.slice(0, 2).map(c => c.campaignName.substring(0, 25)).join(', ')}
                  {actions.toScale.count > 2 && ` +${actions.toScale.count - 2} más`}
                </div>
              )}
            </div>

            {/* To Monitor */}
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-yellow-100 dark:bg-yellow-900/40 rounded-lg">
                  <AlertCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-yellow-700 dark:text-yellow-400">{actions.toMonitor.count}</div>
                  <div className="text-sm text-yellow-600 dark:text-yellow-500">Necesitan Monitoreo</div>
                </div>
              </div>
              {actions.toMonitor.count > 0 && (
                <div className="mt-3 text-xs text-gray-600 dark:text-gray-400">
                  Campañas &lt;51d o datos insuficientes
                </div>
              )}
            </div>

            {/* To Pause */}
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-100 dark:bg-red-900/40 rounded-lg">
                  <Pause className="w-5 h-5 text-red-600 dark:text-red-400" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-red-700 dark:text-red-400">{actions.toPause.count}</div>
                  <div className="text-sm text-red-600 dark:text-red-500">Considerar Pausar</div>
                </div>
              </div>
              {actions.toPause.count > 0 && (
                <div className="mt-3 text-xs text-gray-600 dark:text-gray-400">
                  Payback 51d &lt;0.7x, edad &gt;51d
                </div>
              )}
            </div>
          </div>
        )}

        {/* Decision Engine Actions */}
        {decisions && decisions.topActions.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <Zap className="w-4 h-4 text-purple-500" />
              <span className="text-sm text-gray-600 dark:text-gray-400 font-medium">
                Acciones Recomendadas
              </span>
              <span className="text-xs text-gray-500 ml-2">
                ({decisions.impact.campaignsNeedingAction} campañas requieren acción)
              </span>
            </div>
            <div className="space-y-2">
              {decisions.topActions.slice(0, 5).map((decision) => (
                <DecisionCard key={decision.campaignId} decision={decision} />
              ))}
            </div>
            {decisions.impact.spendToPause > 0 && (
              <div className="mt-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                <div className="flex items-center gap-2 text-sm">
                  <Shield className="w-4 h-4 text-red-500" />
                  <span className="text-red-700 dark:text-red-400 font-medium">
                    Impacto potencial: €{decisions.impact.spendToPause.toFixed(0)}/sem en campañas a pausar
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Campaigns Table */}
        <GoogleAdsTable
          columns={columns}
          data={data?.campaigns || []}
          keyAccessor={(row) => row.campaignId}
          loading={loading}
          defaultSortColumn="spend7d"
          defaultSortDirection="desc"
          emptyMessage="No hay campañas con datos"
        />

        {/* Legend */}
        <div className="mt-6 p-4 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="text-sm text-gray-500 dark:text-gray-400 mb-2">Lógica de Decisión</div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-gray-600 dark:text-gray-400">
            <div>
              <span className="text-green-600 font-medium">ESCALAR</span>: Payback 51d ≥ 1.5x, edad ≥ 51d, n ≥ 10
            </div>
            <div>
              <span className="text-yellow-600 font-medium">MONITOREAR</span>: Edad &lt; 51d, cohorte pequeño, o break-even
            </div>
            <div>
              <span className="text-red-600 font-medium">PAUSAR</span>: Payback 51d &lt; 0.7x, edad ≥ 51d, n ≥ 10
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Decision Card component
function DecisionCard({ decision }: { decision: CampaignDecision }) {
  const actionColor = decision.action === 'pause' ? 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20' :
                      decision.action === 'scale' ? 'border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20' :
                      decision.action === 'optimize' ? 'border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-900/20' :
                      'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50';

  const urgencyBadge = decision.urgency === 'immediate' ? 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400' :
                       decision.urgency === 'this_week' ? 'bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-400' :
                       'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400';

  return (
    <div className={`rounded-lg border p-3 ${actionColor}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="text-lg">{ACTION_ICONS[decision.action]}</span>
            <span className="font-medium text-gray-900 dark:text-white truncate">{decision.campaignName}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full ${urgencyBadge}`}>
              {decision.urgency === 'immediate' ? 'Inmediato' :
               decision.urgency === 'this_week' ? 'Esta semana' : 'Próxima revisión'}
            </span>
          </div>
          <div className="text-sm text-gray-700 dark:text-gray-300 mb-2">{decision.actionText}</div>
          <div className="flex items-center gap-4 text-xs text-gray-500">
            <span>Gasto: €{decision.metrics.spend7d.toFixed(0)}/sem</span>
            <span>PB 51d: {decision.metrics.payback51d.toFixed(2)}x</span>
            <span>Edad: {decision.metrics.campaignAgeDays}d</span>
            <span>n={decision.metrics.cohort51dSize}</span>
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          <div className={`text-xs ${CONFIDENCE_COLORS[decision.confidence]}`}>
            Confianza: {decision.confidence === 'high' ? 'Alta' :
                       decision.confidence === 'medium' ? 'Media' : 'Baja'}
          </div>
          <div className="text-xs text-gray-500 mt-1 max-w-[150px]">
            {decision.confidenceReason}
          </div>
        </div>
      </div>
    </div>
  );
}
