import { useEffect, useState } from 'react';
import { RefreshCw, Clock } from 'lucide-react';
import { api, type BusinessSummary, type Snapshot, type DecisionCurrent, type WebsiteId } from '../api/client';
import { StatusBadge } from '../components/StatusBadge';
import { KpiCard } from '../components/KpiCard';
import { TrendChart } from '../components/TrendChart';
import { ActionCard } from '../components/ActionCard';

interface ExecutiveProps {
  websiteId: WebsiteId;
}

export function Executive({ websiteId }: ExecutiveProps) {
  const [summary, setSummary] = useState<BusinessSummary | null>(null);
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [decisions, setDecisions] = useState<DecisionCurrent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [summaryData, snapshotsData, decisionsData] = await Promise.all([
        api.getSummary(websiteId),
        api.getSnapshots(websiteId, 14),
        api.getDecisions(websiteId),
      ]);
      setSummary(summaryData);
      setSnapshots(snapshotsData.snapshots);
      setDecisions(decisionsData);
      setLastUpdate(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error loading data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Clear old data when website changes to show loading state
    setSummary(null);
    setSnapshots([]);
    setDecisions(null);
    setError(null);

    loadData();
    const interval = setInterval(loadData, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, [websiteId]);

  if (loading && !summary) {
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
          <div className="text-gray-400">{error}</div>
          <button
            onClick={loadData}
            className="mt-4 px-4 py-2 bg-gray-800 rounded-lg hover:bg-gray-700 transition"
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  if (!summary) return null;

  const topActions = decisions?.topActions.slice(0, 3) || [];

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <span className="text-4xl">🦞</span>
            <div>
              <h1 className="text-2xl font-bold">OpenClaw Dashboard</h1>
              <div className="text-sm text-gray-500 flex items-center gap-2">
                <Clock className="w-3 h-3" />
                {summary.period.start} → {summary.period.end}
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

        {/* Main Status */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <div className="lg:col-span-2">
            <StatusBadge status={summary.businessStatus} size="lg" />
          </div>
          <div className="bg-gray-900 rounded-xl p-4 flex items-center justify-between">
            <div>
              <div className="text-sm text-gray-400">Net Revenue</div>
              <div className="text-2xl font-bold">€{summary.financials.netRevenueEur.toLocaleString()}</div>
            </div>
            <div className="text-right">
              <div className="text-sm text-gray-400">Ad Spend</div>
              <div className="text-2xl font-bold text-gray-400">€{summary.financials.adSpendEur.toLocaleString()}</div>
            </div>
          </div>
        </div>

        {/* P1 HEADLINE - Payback M1 (Utility Model) */}
        <div className="mb-6">
          <KpiCard
            title="Payback M1"
            value={`${summary.kpis.paybackM1?.value?.toFixed(2) || '0.00'}x`}
            subtitle="El negocio se gana o pierde en M1"
            status={summary.kpis.paybackM1?.status || 'yellow'}
            reason={summary.kpis.paybackM1?.reason || 'Payback primer mes'}
            badge="HEADLINE"
            size="large"
          />
        </div>

        {/* P2 - KPIs Accionables */}
        <div className="mb-6">
          <div className="text-sm text-gray-400 uppercase tracking-wide mb-3">
            KPIs Accionables
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            <KpiCard
              title="FRR"
              value={`${summary.kpis.frr.percentage}%`}
              subtitle="First Rebill Rate"
              status={summary.kpis.frr.status}
              reason={summary.kpis.frr.reason}
            />
            <KpiCard
              title="CPFR"
              value={`€${summary.kpis.cpfr.value.toFixed(0)}`}
              subtitle="Cost Per First Rebill"
              status={summary.kpis.cpfr.status}
              reason={summary.kpis.cpfr.reason}
            />
            <KpiCard
              title="Refund M1"
              value={`${((summary.kpis.refundRateM1?.value || 0) * 100).toFixed(1)}%`}
              subtitle="Refund Rate antes de M2"
              status={summary.kpis.refundRateM1?.status || 'yellow'}
              reason={summary.kpis.refundRateM1?.reason}
            />
          </div>
        </div>

        {/* P3 - KPIs de Contexto */}
        <div className="mb-6">
          <div className="text-sm text-gray-400 uppercase tracking-wide mb-3">
            Contexto
          </div>
          <div className="grid grid-cols-2 gap-4">
            <KpiCard
              title="Net ROAS"
              value={`${summary.kpis.netRoas.value.toFixed(2)}x`}
              subtitle="Return on Ad Spend"
              status={summary.kpis.netRoas.status}
              reason={summary.kpis.netRoas.reason}
            />
            <KpiCard
              title="CPT"
              value={`€${summary.kpis.cpt?.value?.toFixed(0) || '0'}`}
              subtitle="Cost Per Trial"
              status={summary.kpis.cpt?.status || 'yellow'}
              reason={summary.kpis.cpt?.reason}
            />
          </div>
        </div>

        {/* Informativos (sin alertas) */}
        <div className="mb-6">
          <div className="text-sm text-gray-400 uppercase tracking-wide mb-3 flex items-center gap-2">
            Informativos
            <span className="text-xs text-gray-600 normal-case">(Modelo utility: M2+ bajo es normal)</span>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard
              title="SRR"
              value={`${summary.kpis.srr.percentage}%`}
              subtitle="Second Rebill Rate"
              status={summary.kpis.srr.status}
              reason={summary.kpis.srr.reason}
              isInformative
            />
            <KpiCard
              title="U-R2"
              value={`${((summary.kpis.ur2?.value || 0) * 100).toFixed(1)}%`}
              subtitle="Usage antes de R2"
              status={summary.kpis.ur2?.status || 'yellow'}
              reason={summary.kpis.ur2?.reason}
              isInformative
            />
            <KpiCard
              title="Payback 30d"
              value={`${summary.kpis.paybackRatio?.value?.toFixed(2) || '0.00'}x`}
              subtitle="LTV 30d / CPFR"
              status={summary.kpis.paybackRatio?.status || 'yellow'}
              reason="Proxy histórico"
              isInformative
            />
            <KpiCard
              title="Payback 51d"
              value={`${summary.kpis.payback51d?.value?.toFixed(2) || '0.00'}x`}
              subtitle="R2 completo"
              status={summary.kpis.payback51d?.status || 'yellow'}
              reason={summary.kpis.payback51d?.reason}
              isInformative
            />
          </div>
        </div>

        {/* Charts + Actions */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Charts */}
          <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
            {snapshots.length > 1 ? (
              <>
                <TrendChart snapshots={snapshots} metric="frr" title="FRR Trend" />
                <TrendChart snapshots={snapshots} metric="srr" title="SRR Trend" />
                <TrendChart snapshots={snapshots} metric="net_roas" title="Net ROAS Trend" />
                <TrendChart snapshots={snapshots} metric="cpfr" title="CPFR Trend" />
                <TrendChart snapshots={snapshots} metric="ltv_30d" title="LTV 30d Trend" />
              </>
            ) : (
              <div className="md:col-span-2 bg-gray-900 rounded-lg p-8 text-center text-gray-500">
                <div className="text-lg mb-2">Sin datos históricos</div>
                <div className="text-sm">Los gráficos aparecerán cuando haya más de un snapshot</div>
              </div>
            )}
          </div>

          {/* Actions */}
          <div>
            <div className="text-sm text-gray-400 uppercase tracking-wide mb-4">
              Acciones Recomendadas
            </div>
            <div className="space-y-3">
              {topActions.length > 0 ? (
                topActions.map((action) => (
                  <ActionCard key={action.ruleId} action={action} />
                ))
              ) : (
                <div className="bg-gray-900 rounded-lg p-6 text-center text-gray-500">
                  No hay acciones pendientes
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Alerts */}
        {summary.alerts.length > 0 && (
          <div className="mt-8">
            <div className="text-sm text-gray-400 uppercase tracking-wide mb-4">Alertas</div>
            <div className="space-y-2">
              {summary.alerts.map((alert, i) => (
                <div
                  key={i}
                  className={`px-4 py-3 rounded-lg ${
                    alert.type === 'error' ? 'bg-red-500/10 border border-red-500/30 text-red-400' :
                    alert.type === 'warning' ? 'bg-yellow-500/10 border border-yellow-500/30 text-yellow-400' :
                    'bg-blue-500/10 border border-blue-500/30 text-blue-400'
                  }`}
                >
                  {alert.message}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
