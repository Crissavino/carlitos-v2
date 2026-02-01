import { useEffect, useState } from 'react';
import { RefreshCw, Clock, TrendingUp, Pause, AlertCircle, Zap, Shield } from 'lucide-react';
import { api, type CampaignPerformanceResult, type CampaignActions, type CampaignDecisionSummary, type CampaignDecision } from '../api/client';
import { CampaignsTable } from '../components/CampaignsTable';

const ACTION_ICONS: Record<string, string> = {
  pause: '⏸️',
  scale: '📈',
  optimize: '⚡',
  monitor: '👁️',
  maintain: '✅',
};

const CONFIDENCE_COLORS: Record<string, string> = {
  high: 'text-green-400',
  medium: 'text-yellow-400',
  low: 'text-gray-400',
};

export function Campaigns() {
  const [data, setData] = useState<CampaignPerformanceResult | null>(null);
  const [actions, setActions] = useState<CampaignActions | null>(null);
  const [decisions, setDecisions] = useState<CampaignDecisionSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [campaignsData, actionsData, decisionsData] = await Promise.all([
        api.getCampaigns(),
        api.getCampaignActions(),
        api.getCampaignDecisions().catch(() => null), // Graceful fail
      ]);
      setData(campaignsData);
      setActions(actionsData);
      setDecisions(decisionsData);
      setLastUpdate(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error loading campaigns');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 60000);
    return () => clearInterval(interval);
  }, []);

  if (loading && !data) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <RefreshCw className="w-8 h-8 animate-spin text-gray-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-500 text-xl mb-4">Error</div>
          <div className="text-gray-400 mb-4">{error}</div>
          <button
            onClick={loadData}
            className="px-4 py-2 bg-gray-800 rounded-lg hover:bg-gray-700 transition"
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <span className="text-4xl">📊</span>
            <div>
              <h1 className="text-2xl font-bold">Campaign Control</h1>
              <div className="text-sm text-gray-500 flex items-center gap-2">
                <Clock className="w-3 h-3" />
                {data?.dateRange || 'LAST_7_DAYS'} | {data?.totalCampaigns || 0} campaigns
              </div>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {lastUpdate && (
              <span className="text-xs text-gray-500">
                Actualizado: {lastUpdate.toLocaleTimeString()}
              </span>
            )}
            <button
              onClick={loadData}
              disabled={loading}
              className="p-2 bg-gray-800 rounded-lg hover:bg-gray-700 transition disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Action Summary Cards */}
        {actions && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            {/* To Scale */}
            <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-500/20 rounded-lg">
                  <TrendingUp className="w-5 h-5 text-green-400" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-green-400">{actions.toScale.count}</div>
                  <div className="text-sm text-green-400/70">Ready to Scale</div>
                </div>
              </div>
              {actions.toScale.count > 0 && (
                <div className="mt-3 text-xs text-gray-400">
                  {actions.toScale.campaigns.slice(0, 2).map(c => c.campaignName).join(', ')}
                  {actions.toScale.count > 2 && ` +${actions.toScale.count - 2} more`}
                </div>
              )}
            </div>

            {/* To Monitor */}
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-yellow-500/20 rounded-lg">
                  <AlertCircle className="w-5 h-5 text-yellow-400" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-yellow-400">{actions.toMonitor.count}</div>
                  <div className="text-sm text-yellow-400/70">Need Monitoring</div>
                </div>
              </div>
              {actions.toMonitor.count > 0 && (
                <div className="mt-3 text-xs text-gray-400">
                  Campaigns &lt;51d old, waiting for data
                </div>
              )}
            </div>

            {/* To Pause */}
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-500/20 rounded-lg">
                  <Pause className="w-5 h-5 text-red-400" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-red-400">{actions.toPause.count}</div>
                  <div className="text-sm text-red-400/70">Consider Pausing</div>
                </div>
              </div>
              {actions.toPause.count > 0 && (
                <div className="mt-3 text-xs text-gray-400">
                  Payback 51d &lt;0.7x, age &gt;51d
                </div>
              )}
            </div>
          </div>
        )}

        {/* DecisionEngine Actions (Phase 7.5) */}
        {decisions && decisions.topActions.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <Zap className="w-4 h-4 text-purple-400" />
              <span className="text-sm text-gray-400 uppercase tracking-wide">
                DecisionEngine Actions
              </span>
              <span className="text-xs text-gray-500 ml-2">
                ({decisions.impact.campaignsNeedingAction} campaigns need action)
              </span>
            </div>
            <div className="space-y-2">
              {decisions.topActions.map((decision) => (
                <DecisionCard key={decision.campaignId} decision={decision} />
              ))}
            </div>
            {decisions.impact.spendToPause > 0 && (
              <div className="mt-3 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                <div className="flex items-center gap-2 text-sm">
                  <Shield className="w-4 h-4 text-red-400" />
                  <span className="text-red-400 font-medium">
                    Impacto potencial: €{decisions.impact.spendToPause.toFixed(0)}/sem en campañas a pausar
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Campaigns Table */}
        <div className="mb-6">
          <div className="text-sm text-gray-400 uppercase tracking-wide mb-3">
            All Campaigns
          </div>
          <CampaignsTable
            campaigns={data?.campaigns || []}
            loading={loading && !data}
          />
        </div>

        {/* Legend / Help */}
        <div className="bg-gray-900/50 rounded-xl p-4 border border-gray-800">
          <div className="text-sm text-gray-400 mb-2">Decision Logic</div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-gray-500">
            <div>
              <span className="text-green-400 font-medium">SCALE</span>: Payback 51d &ge; 1.5x, age &ge; 51d, n &ge; 10
            </div>
            <div>
              <span className="text-yellow-400 font-medium">MONITOR</span>: Age &lt; 51d OR small cohort OR break-even
            </div>
            <div>
              <span className="text-red-400 font-medium">PAUSE</span>: Payback 51d &lt; 0.7x, age &ge; 51d, n &ge; 10
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// DecisionCard component for showing individual decisions
function DecisionCard({ decision }: { decision: CampaignDecision }) {
  const actionColor = decision.action === 'pause' ? 'border-red-500/30 bg-red-500/5' :
                      decision.action === 'scale' ? 'border-green-500/30 bg-green-500/5' :
                      decision.action === 'optimize' ? 'border-yellow-500/30 bg-yellow-500/5' :
                      'border-gray-700 bg-gray-800/50';

  const urgencyBadge = decision.urgency === 'immediate' ? 'bg-red-500/20 text-red-400' :
                       decision.urgency === 'this_week' ? 'bg-yellow-500/20 text-yellow-400' :
                       'bg-gray-700 text-gray-400';

  return (
    <div className={`rounded-lg border p-3 ${actionColor}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg">{ACTION_ICONS[decision.action]}</span>
            <span className="font-medium truncate">{decision.campaignName}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full ${urgencyBadge}`}>
              {decision.urgency === 'immediate' ? 'Inmediato' :
               decision.urgency === 'this_week' ? 'Esta semana' : 'Próxima revisión'}
            </span>
          </div>
          <div className="text-sm text-gray-300 mb-2">{decision.actionText}</div>
          <div className="flex items-center gap-4 text-xs text-gray-500">
            <span>Spend: €{decision.metrics.spend7d}/sem</span>
            <span>PB 51d: {decision.metrics.payback51d.toFixed(2)}x</span>
            <span>Age: {decision.metrics.campaignAgeDays}d</span>
            <span>n={decision.metrics.cohort51dSize}</span>
          </div>
        </div>
        <div className="text-right">
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
