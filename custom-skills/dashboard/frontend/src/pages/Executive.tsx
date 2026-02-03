import { useEffect, useState } from 'react';
import { RefreshCw, Clock } from 'lucide-react';
import { api, type BusinessSummary, type Snapshot, type DecisionCurrent, type DailyComparison, type WebsiteId, type AllWebsitesPayback } from '../api/client';
import { StatusBadge } from '../components/StatusBadge';
import { KpiCard } from '../components/KpiCard';
import { TrendChart } from '../components/TrendChart';
import { ActionCard } from '../components/ActionCard';
import { PaybackByWebsiteChart } from '../components/PaybackByWebsiteChart';
import { DailyMarginChart } from '../components/DailyMarginChart';
import { ConversionFunnel } from '../components/ConversionFunnel';

interface ExecutiveProps {
  websiteId: WebsiteId;
}

export function Executive({ websiteId }: ExecutiveProps) {
  const [summary, setSummary] = useState<BusinessSummary | null>(null);
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [decisions, setDecisions] = useState<DecisionCurrent | null>(null);
  const [daily, setDaily] = useState<DailyComparison | null>(null);
  const [allWebsitesPayback, setAllWebsitesPayback] = useState<AllWebsitesPayback | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [summaryData, snapshotsData, decisionsData, dailyData, paybackData] = await Promise.all([
        api.getSummary(websiteId),
        api.getSnapshots(websiteId, 14),
        api.getDecisions(websiteId),
        api.getDailyComparison(websiteId),
        api.getAllWebsitesPayback(),
      ]);
      setSummary(summaryData);
      setSnapshots(snapshotsData.snapshots);
      setDecisions(decisionsData);
      setDaily(dailyData);
      setAllWebsitesPayback(paybackData);
      setLastUpdate(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error cargando datos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Clear old data when website changes to show loading state
    setSummary(null);
    setSnapshots([]);
    setDecisions(null);
    setDaily(null);
    setAllWebsitesPayback(null);
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

        {/* Resumen Financiero */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-gray-900 rounded-xl p-4">
            <div className="text-sm text-gray-400">Ingresos Brutos</div>
            <div className="text-2xl font-bold text-green-400">€{summary.financials.grossRevenueEur.toLocaleString()}</div>
          </div>
          <div className="bg-gray-900 rounded-xl p-4">
            <div className="text-sm text-gray-400">Ingresos Netos</div>
            <div className="text-2xl font-bold">€{summary.financials.netRevenueEur.toLocaleString()}</div>
          </div>
          <div className="bg-gray-900 rounded-xl p-4">
            <div className="text-sm text-gray-400">Gasto en Ads</div>
            <div className="text-2xl font-bold text-gray-400">€{summary.financials.adSpendEur.toLocaleString()}</div>
          </div>
          <div className="lg:row-span-1">
            <StatusBadge status={summary.businessStatus} size="lg" />
          </div>
        </div>

        {/* Daily Comparison - Today vs Same Day Last Week */}
        {daily && (
          <div className="mb-6">
            <div className="text-sm text-gray-400 uppercase tracking-wide mb-3">
              Hoy vs {new Date(daily.comparedTo).toLocaleDateString('es', { weekday: 'long' })} pasado
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-gray-900 rounded-xl p-4 border-l-4 border-l-blue-500">
                <div className="text-sm text-gray-400">Trials (Adquisiciones)</div>
                <div className="text-2xl font-bold">{daily.acquisitions.today}</div>
                <div className={`text-sm ${daily.acquisitions.change >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {daily.acquisitions.change >= 0 ? '↑' : '↓'} {Math.abs(daily.acquisitions.change)}% vs {daily.acquisitions.weekAgo}
                </div>
              </div>
              <div className="bg-gray-900 rounded-xl p-4 border-l-4 border-l-purple-500" title="Costo por Trial = Gasto Ads / Trials">
                <div className="text-sm text-gray-400">CPA (Costo por Trial)</div>
                <div className="text-2xl font-bold">€{daily.cpa.today.toFixed(0)}</div>
                <div className={`text-sm ${daily.cpa.change <= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {daily.cpa.change <= 0 ? '↓' : '↑'} {Math.abs(daily.cpa.change)}% vs €{daily.cpa.weekAgo.toFixed(0)}
                </div>
              </div>
              <div className="bg-gray-900 rounded-xl p-4 border-l-4 border-l-orange-500" title="Costo por First Rebill = Gasto Ads / First Rebills. Es el costo real de conseguir un cliente que paga.">
                <div className="text-sm text-gray-400">CPFR (Costo por Pago)</div>
                <div className="text-2xl font-bold">€{daily.cpfr.today.toFixed(0)}</div>
                <div className={`text-sm ${daily.cpfr.change <= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {daily.cpfr.change <= 0 ? '↓' : '↑'} {Math.abs(daily.cpfr.change)}% vs €{daily.cpfr.weekAgo.toFixed(0)}
                </div>
              </div>
              <div className="bg-gray-900 rounded-xl p-4 border-l-4 border-l-gray-500">
                <div className="text-sm text-gray-400">First Rebills (Pagos)</div>
                <div className="text-2xl font-bold">{daily.firstRebills.today}</div>
                <div className="text-sm text-gray-500">
                  vs {daily.firstRebills.weekAgo} semana pasada
                </div>
              </div>
            </div>
          </div>
        )}

        {/* P1 HEADLINE - Payback M1 (Cohorte 30-60d) */}
        <div className="mb-6">
          <KpiCard
            title="Payback M1 (Cohorte)"
            value={`${summary.kpis.paybackM1?.value?.toFixed(2) || '0.00'}x`}
            subtitle="Cohorte 30-60d atrás - M1 completado"
            status={summary.kpis.paybackM1?.status || 'yellow'}
            reason={summary.kpis.paybackM1?.reason || 'Payback cohorte M1'}
            badge="HEADLINE"
            size="large"
            tooltip="Cuánto recuperas por cada €1 invertido en el primer mes. Fórmula: (Trial + Subscripciones M1 - Refunds M1) / Gasto Ads. Si es < 1.0, pierdes dinero en M1 (normal en modelo utility)."
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
              subtitle="Tasa de Primer Pago"
              status={summary.kpis.frr.status}
              reason={summary.kpis.frr.reason}
              tooltip="First Rebill Rate = First Rebills / Trials. Mide qué % de trials se convierten en clientes de pago. Verde: ≥35%, Amarillo: 25-34%, Rojo: <25%."
            />
            <KpiCard
              title="CPFR"
              value={`€${summary.kpis.cpfr.value.toFixed(0)}`}
              subtitle="Costo por Primer Pago"
              status={summary.kpis.cpfr.status}
              reason={summary.kpis.cpfr.reason}
              tooltip="Cost Per First Rebill = Gasto Ads / First Rebills. Es el costo REAL de adquirir un cliente que paga (no un trial). Si FRR=35%, CPFR = CPA / 0.35."
            />
            <KpiCard
              title="Refund M1"
              value={`${((summary.kpis.refundRateM1?.value || 0) * 100).toFixed(1)}%`}
              subtitle="Tasa de Refunds en M1"
              status={summary.kpis.refundRateM1?.status || 'yellow'}
              reason={summary.kpis.refundRateM1?.reason}
              tooltip="% de clientes que piden reembolso antes del segundo mes. Verde: ≤5%, Amarillo: 5-10%, Rojo: >10%."
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
              subtitle="Retorno sobre Gasto Ads"
              status={summary.kpis.netRoas.status}
              reason={summary.kpis.netRoas.reason}
              tooltip="Return on Ad Spend = Ingresos Netos / Gasto Ads. Mide rentabilidad general (no por cohorte). Verde: ≥2.0x, Amarillo: 1.3-2.0x, Rojo: <1.3x."
            />
            <KpiCard
              title="CPT"
              value={`€${summary.kpis.cpt?.value?.toFixed(0) || '0'}`}
              subtitle="Costo por Trial"
              status={summary.kpis.cpt?.status || 'yellow'}
              reason={summary.kpis.cpt?.reason}
              tooltip="Cost Per Trial = Gasto Ads / Trials. Lo que pagas por conseguir un trial (no un cliente de pago). Verde: ≤€30, Amarillo: €30-50, Rojo: >€50."
            />
          </div>
        </div>

        {/* Informativos (sin alertas) */}
        <div className="mb-6">
          <div className="text-sm text-gray-400 uppercase tracking-wide mb-3 flex items-center gap-2">
            Informativos
            <span className="text-xs text-gray-600 normal-case">(Modelo utility: retención M2+ baja es normal)</span>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard
              title="SRR"
              value={`${summary.kpis.srr.percentage}%`}
              subtitle="Tasa de Segundo Pago"
              status={summary.kpis.srr.status}
              reason={summary.kpis.srr.reason}
              isInformative
              tooltip="Second Rebill Rate = Second Rebills / First Rebills (de cohorte 30d). En modelo utility es normal que sea bajo porque el cliente resuelve su problema en M1."
            />
            <KpiCard
              title="U-R2"
              value={`${((summary.kpis.ur2?.value || 0) * 100).toFixed(1)}%`}
              subtitle="Uso antes de R2"
              status={summary.kpis.ur2?.status || 'yellow'}
              reason={summary.kpis.ur2?.reason}
              isInformative
              tooltip="Usage antes de Rebill 2 = % de clientes que usaron el producto antes de su segundo pago. Indica engagement real con el producto."
            />
            <KpiCard
              title="Payback 30d"
              value={`${summary.kpis.paybackRatio?.value?.toFixed(2) || '0.00'}x`}
              subtitle="LTV 30d / CPFR"
              status={summary.kpis.paybackRatio?.status || 'yellow'}
              reason="Proxy histórico"
              isInformative
              tooltip="Proxy de Payback usando LTV histórico de 30 días dividido por CPFR actual. No es tan preciso como Payback M1 Cohorte."
            />
            <KpiCard
              title="Payback 51d"
              value={`${summary.kpis.payback51d?.value?.toFixed(2) || '0.00'}x`}
              subtitle="Incluye R2 completo"
              status={summary.kpis.payback51d?.status || 'yellow'}
              reason={summary.kpis.payback51d?.reason}
              isInformative
              tooltip="Payback incluyendo hasta el segundo rebill (día 51). Si es mayor que Payback M1, indica retención saludable."
            />
          </div>
        </div>

        {/* Executive Charts */}
        <div className="mb-6">
          <div className="text-sm text-gray-400 uppercase tracking-wide mb-3">
            Gráficos Ejecutivos
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Payback by Website Chart */}
            {allWebsitesPayback && allWebsitesPayback.websites.length > 0 && (
              <PaybackByWebsiteChart data={allWebsitesPayback.websites} />
            )}

            {/* Daily Margin Chart */}
            {snapshots.length > 1 && (
              <DailyMarginChart snapshots={snapshots} />
            )}

            {/* Conversion Funnel */}
            {summary && (
              <div className="lg:col-span-2">
                <ConversionFunnel
                  data={{
                    adSpend: summary.financials.adSpendEur,
                    trials: summary.acquisitionData?.trials || 0,
                    firstRebills: summary.acquisitionData?.firstRebills || 0,
                    revenueM1: summary.financials.netRevenueEur,
                    refunds: summary.refundsM1?.total || 0,
                  }}
                />
              </div>
            )}
          </div>
        </div>

        {/* Charts + Actions */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Charts */}
          <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
            {snapshots.length > 1 ? (
              <>
                <TrendChart snapshots={snapshots} metric="frr" title="Tendencia FRR" />
                <TrendChart snapshots={snapshots} metric="srr" title="Tendencia SRR" />
                <TrendChart snapshots={snapshots} metric="net_roas" title="Tendencia Net ROAS" />
                <TrendChart snapshots={snapshots} metric="cpfr" title="Tendencia CPFR" />
                <TrendChart snapshots={snapshots} metric="ltv_30d" title="Tendencia LTV 30d" />
              </>
            ) : (
              <div className="md:col-span-2 bg-gray-900 rounded-lg p-8 text-center text-gray-500">
                <div className="text-lg mb-2">Sin datos históricos</div>
                <div className="text-sm">Las tendencias aparecerán cuando haya más de un snapshot</div>
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
                  Sin acciones pendientes
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
