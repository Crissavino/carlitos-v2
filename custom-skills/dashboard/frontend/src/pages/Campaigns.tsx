import { useEffect, useState, useMemo } from 'react';
import { RefreshCw, TrendingUp, Pause, AlertCircle, Calendar, Zap, BarChart3 } from 'lucide-react';
import { api, type CampaignPerformanceResult, type CampaignActions, type CampaignDecisionSummary, type CampaignDecision, type CampaignMetrics } from '../api/client';
import { PerformanceCards, type MetricCard } from '../components/PerformanceCards';
import { GoogleAdsTable, type Column, StatusDot } from '../components/GoogleAdsTable';
import { SpendChart, type ChartDataPoint } from '../components/SpendChart';

type DateRange = '7d' | '14d' | '30d';

const DATE_RANGE_LABELS: Record<DateRange, string> = {
  '7d': '7 días',
  '14d': '14 días',
  '30d': '30 días',
};

const ACTION_ICONS: Record<string, string> = {
  pause: '⏸️',
  scale: '📈',
  optimize: '⚡',
  monitor: '👁️',
  maintain: '✅',
};

export function Campaigns() {
  const [data, setData] = useState<CampaignPerformanceResult | null>(null);
  const [actions, setActions] = useState<CampaignActions | null>(null);
  const [decisions, setDecisions] = useState<CampaignDecisionSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [dateRange, setDateRange] = useState<DateRange>('7d');
  const [showChart, setShowChart] = useState(false);

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

  // Chart data
  const chartData: ChartDataPoint[] = useMemo(() => {
    const campaigns = data?.campaigns || [];
    return campaigns
      .sort((a, b) => b.spend7d - a.spend7d)
      .slice(0, 8)
      .map(c => ({
        name: c.campaignName.length > 12 ? c.campaignName.substring(0, 12) + '...' : c.campaignName,
        spend: c.spend7d,
        clicks: c.clicks,
        firstRebills: c.firstRebills,
      }));
  }, [data]);

  // Performance cards
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
      { id: 'conversions', label: 'Acq/R1', value: `${acquisitions}/${firstRebills}`, color: 'green' as const },
      { id: 'cpfr', label: 'CPFR', value: cpfr > 0 ? `€${cpfr.toFixed(0)}` : '-', color: 'purple' as const },
      { id: 'campaigns', label: 'Campañas', value: campaigns.length, color: 'gray' as const },
    ];
  }, [data]);

  // Table columns
  const columns: Column<CampaignMetrics>[] = useMemo(() => [
    {
      id: 'campaign',
      header: 'Campaña',
      accessor: (row) => (
        <div className="flex items-center gap-2">
          <StatusDot active={row.status === 'ENABLED'} />
          <span className="font-medium text-sm max-w-[180px] truncate" title={row.campaignName}>
            {row.campaignName}
          </span>
        </div>
      ),
      sortAccessor: (row) => row.campaignName,
      isPrimary: true,
    },
    {
      id: 'age',
      header: 'Edad',
      accessor: (row) => (
        <span className={`text-xs ${row.campaignAgeDays < 51 ? 'text-yellow-500' : ''}`}>
          {row.campaignAgeDays}d
        </span>
      ),
      sortAccessor: (row) => row.campaignAgeDays,
      align: 'right',
      mobileLabel: 'Edad',
    },
    {
      id: 'conversions',
      header: 'Acq/R1',
      accessor: (row) => (
        <div className="flex items-center gap-0.5 text-xs">
          <span className="text-blue-600 dark:text-blue-400">{row.acquisitions}</span>
          <span className="text-gray-400">/</span>
          <span className="text-green-600 dark:text-green-400">{row.firstRebills}</span>
        </div>
      ),
      sortAccessor: (row) => row.firstRebills,
      align: 'right',
      mobileLabel: 'Conv',
    },
    {
      id: 'cpfr',
      header: 'CPFR',
      accessor: (row) => <span className="text-xs">{row.cpfr > 0 ? `€${row.cpfr.toFixed(0)}` : '-'}</span>,
      sortAccessor: (row) => row.cpfr,
      align: 'right',
      mobileLabel: 'CPFR',
    },
    {
      id: 'spend7d',
      header: 'Gasto',
      accessor: (row) => <span className="text-xs font-medium">€{row.spend7d.toFixed(0)}</span>,
      sortAccessor: (row) => row.spend7d,
      align: 'right',
      mobileLabel: 'Gasto',
    },
    {
      id: 'clicks',
      header: 'Clicks',
      accessor: (row) => <span className="text-xs">{row.clicks.toLocaleString()}</span>,
      sortAccessor: (row) => row.clicks,
      align: 'right',
      hideOnMobile: true,
    },
    {
      id: 'ctr',
      header: 'CTR',
      accessor: (row) => <span className="text-xs">{row.ctr.toFixed(1)}%</span>,
      sortAccessor: (row) => row.ctr,
      align: 'right',
      hideOnMobile: true,
    },
    {
      id: 'payback51d',
      header: 'PB 51d',
      accessor: (row) => {
        const color = row.payback51dStatus === 'green' ? 'text-green-500' :
                     row.payback51dStatus === 'yellow' ? 'text-yellow-500' : 'text-red-500';
        return <span className={`text-xs font-medium ${color}`}>{row.payback51d.toFixed(2)}x</span>;
      },
      sortAccessor: (row) => row.payback51d,
      align: 'right',
      mobileLabel: 'PB',
    },
    {
      id: 'cohort',
      header: 'n',
      accessor: (row) => (
        <span className={`text-xs ${row.cohort51dSize < 10 ? 'text-gray-400' : ''}`}>
          {row.cohort51dSize}
        </span>
      ),
      sortAccessor: (row) => row.cohort51dSize,
      align: 'right',
      hideOnMobile: true,
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
        const labels: Record<string, string> = { scale: 'Escalar', monitor: 'Monitor', pause: 'Pausar', maintain: 'OK' };
        return (
          <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded ${colors[rec] || colors.maintain}`}>
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
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 p-4">
        <div className="text-center">
          <div className="text-red-500 text-lg mb-2">Error</div>
          <div className="text-gray-400 text-sm mb-4">{error}</div>
          <button onClick={loadData} className="px-4 py-2 bg-gray-800 rounded-lg text-sm">
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 p-3 md:p-6">
      <div className="max-w-[1600px] mx-auto">
        {/* Header */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h1 className="text-xl md:text-2xl font-semibold text-gray-900 dark:text-white">Campañas</h1>
              <p className="text-xs md:text-sm text-gray-500">{data?.totalCampaigns || 0} activas</p>
            </div>

            <div className="flex items-center gap-2">
              {/* Date selector */}
              <div className="relative">
                <select
                  value={dateRange}
                  onChange={(e) => setDateRange(e.target.value as DateRange)}
                  className="appearance-none bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg pl-8 pr-3 py-2 text-xs md:text-sm"
                >
                  {Object.entries(DATE_RANGE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
                <Calendar className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
              </div>

              {/* Refresh */}
              <button
                onClick={loadData}
                disabled={loading}
                className="p-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          {lastUpdate && (
            <div className="text-[10px] text-gray-500">
              Actualizado: {lastUpdate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </div>
          )}
        </div>

        {/* Performance Cards */}
        <PerformanceCards cards={performanceCards} />

        {/* Action Summary - Mobile: horizontal scroll, Desktop: grid */}
        {actions && (
          <div className="flex md:grid md:grid-cols-3 gap-2 md:gap-3 mb-4 overflow-x-auto pb-2 -mx-3 px-3 md:mx-0 md:px-0 md:overflow-visible">
            {/* To Scale */}
            <div className="flex-shrink-0 w-[140px] md:w-auto bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-green-600 dark:text-green-400" />
                <span className="text-xl font-bold text-green-700 dark:text-green-400">{actions.toScale.count}</span>
              </div>
              <div className="text-xs text-green-600 dark:text-green-500 mt-1">Escalar</div>
            </div>

            {/* To Monitor */}
            <div className="flex-shrink-0 w-[140px] md:w-auto bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-yellow-600 dark:text-yellow-400" />
                <span className="text-xl font-bold text-yellow-700 dark:text-yellow-400">{actions.toMonitor.count}</span>
              </div>
              <div className="text-xs text-yellow-600 dark:text-yellow-500 mt-1">Monitorear</div>
            </div>

            {/* To Pause */}
            <div className="flex-shrink-0 w-[140px] md:w-auto bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
              <div className="flex items-center gap-2">
                <Pause className="w-4 h-4 text-red-600 dark:text-red-400" />
                <span className="text-xl font-bold text-red-700 dark:text-red-400">{actions.toPause.count}</span>
              </div>
              <div className="text-xs text-red-600 dark:text-red-500 mt-1">Pausar</div>
            </div>
          </div>
        )}

        {/* Chart toggle + Chart */}
        <div className="mb-4">
          <button
            onClick={() => setShowChart(!showChart)}
            className={`flex items-center gap-2 px-3 py-1.5 text-xs rounded-lg border transition ${
              showChart
                ? 'bg-blue-500 text-white border-blue-600'
                : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            {showChart ? 'Ocultar' : 'Gráfico'}
          </button>

          {showChart && (
            <div className="mt-3 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
              <div className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
                Top Campañas por Gasto
              </div>
              <SpendChart
                data={chartData}
                type="bar"
                height={160}
                metrics={['spend', 'firstRebills']}
                showLegend={true}
              />
            </div>
          )}
        </div>

        {/* Decision Engine Alerts - Mobile collapsed */}
        {decisions && decisions.topActions.length > 0 && (
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-2">
              <Zap className="w-4 h-4 text-purple-500" />
              <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
                Acciones ({decisions.impact.campaignsNeedingAction})
              </span>
            </div>
            <div className="space-y-2">
              {decisions.topActions.slice(0, 3).map((decision) => (
                <DecisionCard key={decision.campaignId} decision={decision} />
              ))}
            </div>
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
          emptyMessage="Sin campañas"
          mobileColumns={['campaign', 'age', 'conversions', 'cpfr', 'spend7d', 'payback51d', 'recommendation']}
        />
      </div>
    </div>
  );
}

// Decision Card - Compact for mobile
function DecisionCard({ decision }: { decision: CampaignDecision }) {
  const actionColor = decision.action === 'pause' ? 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20' :
                      decision.action === 'scale' ? 'border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20' :
                      'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50';

  return (
    <div className={`rounded-lg border p-2 ${actionColor}`}>
      <div className="flex items-center gap-2 mb-1">
        <span className="text-sm">{ACTION_ICONS[decision.action]}</span>
        <span className="font-medium text-xs truncate flex-1">{decision.campaignName}</span>
        <span className={`text-[10px] px-1.5 py-0.5 rounded ${
          decision.urgency === 'immediate' ? 'bg-red-200 text-red-800' :
          decision.urgency === 'this_week' ? 'bg-yellow-200 text-yellow-800' : 'bg-gray-200 text-gray-600'
        }`}>
          {decision.urgency === 'immediate' ? 'Ahora' : decision.urgency === 'this_week' ? 'Semana' : 'Luego'}
        </span>
      </div>
      <div className="text-[10px] text-gray-600 dark:text-gray-400">
        €{decision.metrics.spend7d.toFixed(0)}/sem • PB {decision.metrics.payback51d.toFixed(2)}x • {decision.metrics.campaignAgeDays}d
      </div>
    </div>
  );
}
