import { useEffect, useState } from 'react';
import { RefreshCw, Clock, TrendingUp, Pause, AlertCircle } from 'lucide-react';
import { api, type CampaignPerformanceResult, type CampaignActions } from '../api/client';
import { CampaignsTable } from '../components/CampaignsTable';

export function Campaigns() {
  const [data, setData] = useState<CampaignPerformanceResult | null>(null);
  const [actions, setActions] = useState<CampaignActions | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [campaignsData, actionsData] = await Promise.all([
        api.getCampaigns(),
        api.getCampaignActions(),
      ]);
      setData(campaignsData);
      setActions(actionsData);
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
