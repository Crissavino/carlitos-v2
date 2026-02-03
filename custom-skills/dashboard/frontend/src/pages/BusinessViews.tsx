import { useState, useEffect } from 'react';
import { RefreshCw, AlertTriangle, Building2, Globe, MapPin, Layers, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { api } from '../api/client';
import type {
  WebsiteViewResult,
  CompanyViewResult,
  CountryViewResult,
  ServiceViewResult,
  MacroRecommendationsResult,
} from '../api/client';
import { BusinessCard } from '../components/BusinessCard';
import { RecommendationBadge } from '../components/RecommendationBadge';

type ViewTab = 'websites' | 'companies' | 'countries' | 'services' | 'recommendations';

export function BusinessViews() {
  const [activeTab, setActiveTab] = useState<ViewTab>('companies');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  // Data states
  const [websites, setWebsites] = useState<WebsiteViewResult | null>(null);
  const [companies, setCompanies] = useState<CompanyViewResult | null>(null);
  const [countries, setCountries] = useState<CountryViewResult | null>(null);
  const [services, setServices] = useState<ServiceViewResult | null>(null);
  const [recommendations, setRecommendations] = useState<MacroRecommendationsResult | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      // Load all views in parallel
      const [websitesData, companiesData, countriesData, servicesData, recsData] = await Promise.all([
        api.getBusinessWebsites(),
        api.getBusinessCompanies(),
        api.getBusinessCountries(),
        api.getBusinessServices(),
        api.getBusinessRecommendations(),
      ]);

      setWebsites(websitesData);
      setCompanies(companiesData);
      setCountries(countriesData);
      setServices(servicesData);
      setRecommendations(recsData);
      setLastUpdate(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error cargando datos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 5 * 60 * 1000); // Refresh every 5 min
    return () => clearInterval(interval);
  }, []);

  const tabs: { id: ViewTab; label: string; icon: typeof Building2; count?: number }[] = [
    { id: 'companies', label: 'Empresas', icon: Building2, count: companies?.companies.length },
    { id: 'websites', label: 'Sitios Web', icon: Globe, count: websites?.totalWebsites },
    { id: 'countries', label: 'Países', icon: MapPin, count: countries?.totalCountries },
    { id: 'services', label: 'Servicios', icon: Layers, count: services?.totalServices },
    { id: 'recommendations', label: 'Recomendaciones', icon: TrendingUp, count: recommendations?.summary.totalRecommendations },
  ];

  if (loading && !companies) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <RefreshCw className="w-8 h-8 text-blue-400 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <p className="text-red-400">{error}</p>
          <button
            onClick={loadData}
            className="mt-4 px-4 py-2 bg-gray-800 text-gray-200 rounded-lg hover:bg-gray-700"
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
          <div>
            <h1 className="text-2xl font-bold text-gray-100 flex items-center gap-2">
              <Building2 className="w-7 h-7 text-blue-400" />
              Vista de Negocio
            </h1>
            <p className="text-sm text-gray-400 mt-1" title="Los países se obtienen de los datos de campañas de Google Ads, no de la base de datos de clientes">
              Métricas agregadas por dimensión - Últimos 7 días de campañas activas
            </p>
          </div>
          <div className="flex items-center gap-4">
            {lastUpdate && (
              <span className="text-xs text-gray-500">
                Actualizado {lastUpdate.toLocaleTimeString()}
              </span>
            )}
            <button
              onClick={loadData}
              disabled={loading}
              className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 text-gray-300 rounded-lg hover:bg-gray-700 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Actualizar
            </button>
          </div>
        </div>

        {/* Summary Cards */}
        {recommendations && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
            <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="w-4 h-4 text-green-400" />
                <span className="text-xs text-green-400 uppercase">Escalar</span>
              </div>
              <div className="text-2xl font-bold text-green-400">
                {recommendations.summary.byType.SCALE_FOCUS}
              </div>
              <div className="text-xs text-gray-400">
                €{recommendations.summary.potentialImpact.spendToScale.toLocaleString()} gasto
              </div>
            </div>
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-1">
                <Minus className="w-4 h-4 text-yellow-400" />
                <span className="text-xs text-yellow-400 uppercase">Mantener</span>
              </div>
              <div className="text-2xl font-bold text-yellow-400">
                {recommendations.summary.byType.MAINTAIN}
              </div>
            </div>
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-1">
                <TrendingDown className="w-4 h-4 text-red-400" />
                <span className="text-xs text-red-400 uppercase">Reducir</span>
              </div>
              <div className="text-2xl font-bold text-red-400">
                {recommendations.summary.byType.REDUCE_EXPOSURE}
              </div>
              <div className="text-xs text-gray-400">
                €{recommendations.summary.potentialImpact.spendToReduce.toLocaleString()} gasto
              </div>
            </div>
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-1">
                <RefreshCw className="w-4 h-4 text-blue-400" />
                <span className="text-xs text-blue-400 uppercase">Rebalancear</span>
              </div>
              <div className="text-2xl font-bold text-blue-400">
                {recommendations.summary.byType.REBALANCE}
              </div>
            </div>
            <div className="bg-gray-500/10 border border-gray-500/30 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-1">
                <AlertTriangle className="w-4 h-4 text-gray-400" />
                <span className="text-xs text-gray-400 uppercase">Monitorear</span>
              </div>
              <div className="text-2xl font-bold text-gray-400">
                {recommendations.summary.byType.MONITOR}
              </div>
            </div>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-2">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                    : 'bg-gray-800/50 text-gray-400 border border-gray-700 hover:bg-gray-800'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
                {tab.count !== undefined && (
                  <span className="ml-1 px-1.5 py-0.5 bg-gray-700 rounded text-xs">
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Tab Content */}
        <div className="mb-8">
          {activeTab === 'companies' && companies && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {companies.companies.map((company) => (
                <BusinessCard
                  key={company.companyId}
                  type="company"
                  name={company.companyName}
                  spend7d={company.spend7d}
                  spend30d={company.spend30d}
                  totalAcquisitions={company.totalAcquisitions}
                  ltv51dAgg={company.ltv51dAgg}
                  payback51dAgg={company.payback51dAgg}
                  activeCampaigns={company.activeCampaigns}
                  totalCampaigns={company.totalCampaigns}
                  minCampaignAgeDays={company.minCampaignAgeDays}
                  attributionCoverage={company.attributionCoverage}
                  recommendation={company.recommendation}
                  extra={
                    company.spendConcentration.isConcentrated && (
                      <div className="mt-2 text-xs text-yellow-400 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" />
                        Gasto concentrado ({company.spendConcentration.topWebsiteSpendPct}% en top website)
                      </div>
                    )
                  }
                />
              ))}
            </div>
          )}

          {activeTab === 'websites' && websites && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {websites.websites.map((website) => (
                <BusinessCard
                  key={website.websiteId}
                  type="website"
                  name={website.websiteName}
                  spend7d={website.spend7d}
                  spend30d={website.spend30d}
                  totalAcquisitions={website.totalAcquisitions}
                  ltv51dAgg={website.ltv51dAgg}
                  payback51dAgg={website.payback51dAgg}
                  activeCampaigns={website.activeCampaigns}
                  totalCampaigns={website.totalCampaigns}
                  minCampaignAgeDays={website.minCampaignAgeDays}
                  attributionCoverage={website.attributionCoverage}
                  recommendation={website.recommendation}
                  topCampaigns={website.topCampaigns}
                />
              ))}
            </div>
          )}

          {activeTab === 'countries' && countries && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {countries.countries.map((country) => (
                <BusinessCard
                  key={country.countryId}
                  type="country"
                  name={country.countryName}
                  subtitle={country.countryCode}
                  spend7d={country.spend7d}
                  spend30d={country.spend30d}
                  totalAcquisitions={country.totalAcquisitions}
                  ltv51dAgg={country.ltv51dAgg}
                  payback51dAgg={country.payback51dAgg}
                  activeCampaigns={country.activeCampaigns}
                  totalCampaigns={country.totalCampaigns}
                  minCampaignAgeDays={country.minCampaignAgeDays}
                  attributionCoverage={country.attributionCoverage}
                  recommendation={country.recommendation}
                  topCampaigns={country.topCampaigns}
                />
              ))}
            </div>
          )}

          {activeTab === 'services' && services && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {services.services.map((service) => (
                  <BusinessCard
                    key={service.serviceCategory}
                    type="service"
                    name={service.serviceName}
                    subtitle={`Confianza: ${service.classification.confidence}`}
                    spend7d={service.spend7d}
                    spend30d={service.spend30d}
                    totalAcquisitions={service.totalAcquisitions}
                    ltv51dAgg={service.ltv51dAgg}
                    payback51dAgg={service.payback51dAgg}
                    activeCampaigns={service.activeCampaigns}
                    totalCampaigns={service.totalCampaigns}
                    minCampaignAgeDays={service.minCampaignAgeDays}
                    attributionCoverage={service.attributionCoverage}
                    recommendation={service.recommendation}
                    topCampaigns={service.campaigns}
                  />
                ))}
              </div>
              <div className="mt-4 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                <p className="text-xs text-yellow-400 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  {services.disclaimer}
                </p>
              </div>
            </>
          )}

          {activeTab === 'recommendations' && recommendations && (
            <div className="space-y-4">
              {recommendations.recommendations.map((rec) => (
                <div
                  key={rec.id}
                  className={`bg-gray-900 rounded-xl border border-gray-800 p-4 ${
                    rec.priority === 'high' ? 'border-l-4 border-l-red-500' :
                    rec.priority === 'medium' ? 'border-l-4 border-l-yellow-500' :
                    'border-l-4 border-l-gray-600'
                  }`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <RecommendationBadge recommendation={rec.recommendation} />
                      <div>
                        <h3 className="font-medium text-gray-100">{rec.entityName}</h3>
                        <span className="text-xs text-gray-500 capitalize">{rec.entityType}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-gray-300">
                        €{rec.metrics.spend7d.toLocaleString()} gasto
                      </div>
                      <div className={`text-xs ${
                        rec.metrics.payback51dAgg >= 1.5 ? 'text-green-400' :
                        rec.metrics.payback51dAgg >= 1 ? 'text-yellow-400' : 'text-red-400'
                      }`}>
                        Payback: {rec.metrics.payback51dAgg.toFixed(2)}x
                      </div>
                    </div>
                  </div>

                  <p className="text-sm text-gray-300 mb-3">{rec.suggestedAction}</p>

                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-500">{rec.rationale}</span>
                    {!rec.isActionable && rec.blockers && (
                      <div className="flex items-center gap-1 text-yellow-400">
                        <AlertTriangle className="w-3 h-3" />
                        <span>Bloqueado: {rec.blockers[0]}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer Disclaimer */}
        <div className="mt-8 p-4 bg-gray-900/50 border border-gray-800 rounded-xl">
          <p className="text-xs text-gray-500 text-center">
            <strong>Disclaimer:</strong> Datos agregados - solo recomendaciones estrategicas, no decisiones automaticas.
            Verificar datos antes de actuar. LTV y Payback calculados con SUM-based aggregation.
          </p>
        </div>
      </div>
    </div>
  );
}
