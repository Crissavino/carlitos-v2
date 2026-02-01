/**
 * Macro DecisionEngine - Phase 7.5
 *
 * Genera recomendaciones estratégicas a nivel negocio.
 *
 * IMPORTANTE:
 * - Solo RECOMENDACIONES, NO acciones automáticas
 * - NO puede pausar campañas
 * - NO puede modificar budgets
 *
 * Tipos de recomendación:
 * - SCALE_FOCUS: Payback > 1.5x, incrementar inversión
 * - MAINTAIN: Payback 1.0-1.5x, mantener nivel
 * - REDUCE_EXPOSURE: Payback < 0.7x, reducir riesgo
 * - REBALANCE: Empresa rentable con spend desbalanceado
 */

import {
  getWebsiteView,
  getCompanyView,
  getCountryView,
  getServiceView,
} from "../../business-expert/analyzers/business-aggregator.js";
import type {
  MacroRecommendation,
  MacroRecommendationsResult,
  BusinessRecommendation,
  WebsiteMetrics,
  CompanyMetrics,
  CountryMetrics,
  ServiceMetrics,
} from "../../business-expert/types/business-views.js";

// ============================================================================
// CACHE
// ============================================================================

interface CacheEntry {
  data: MacroRecommendationsResult;
  cachedAt: number;
}

const CACHE_TTL_MS = 5 * 60 * 1000;
let recommendationsCache: CacheEntry | null = null;

export function clearMacroRecommendationsCache(): void {
  recommendationsCache = null;
  console.log("[MacroEngine] Cache cleared");
}

// ============================================================================
// RECOMMENDATION BUILDER
// ============================================================================

function buildRecommendation(
  entityType: 'website' | 'company' | 'country' | 'service',
  entityId: number | string,
  entityName: string,
  recommendation: BusinessRecommendation,
  metrics: {
    spend7d: number;
    payback51dAgg: number;
    attributionCoverage: number;
    minCampaignAgeDays: number;
    totalAcquisitions: number;
  },
  rationale: string
): MacroRecommendation {
  // Determine priority
  let priority: 'high' | 'medium' | 'low' = 'low';
  if (recommendation === 'SCALE_FOCUS' || recommendation === 'REDUCE_EXPOSURE') {
    priority = metrics.spend7d > 500 ? 'high' : 'medium';
  } else if (recommendation === 'REBALANCE') {
    priority = 'medium';
  }

  // Determine if actionable
  const isActionable =
    metrics.minCampaignAgeDays >= 51 &&
    metrics.attributionCoverage >= 50 &&
    metrics.totalAcquisitions >= 30 &&
    recommendation !== 'MONITOR' &&
    recommendation !== 'INSUFFICIENT_DATA';

  const blockers: string[] = [];
  if (metrics.minCampaignAgeDays < 51) {
    blockers.push(`Cohorte inmadura (${metrics.minCampaignAgeDays}d < 51d requeridos)`);
  }
  if (metrics.attributionCoverage < 50) {
    blockers.push(`Baja cobertura de attribution (${metrics.attributionCoverage.toFixed(0)}% < 50%)`);
  }
  if (metrics.totalAcquisitions < 30) {
    blockers.push(`Muestra pequeña (${metrics.totalAcquisitions} < 30 acquisitions)`);
  }

  // Generate suggested action
  let suggestedAction = '';
  switch (recommendation) {
    case 'SCALE_FOCUS':
      suggestedAction = `Considerar incrementar budget en ${entityName}. Payback ${metrics.payback51dAgg.toFixed(2)}x indica rentabilidad sólida.`;
      break;
    case 'MAINTAIN':
      suggestedAction = `Mantener inversión actual en ${entityName}. Break-even alcanzado.`;
      break;
    case 'REDUCE_EXPOSURE':
      suggestedAction = `Revisar ${entityName}. Payback ${metrics.payback51dAgg.toFixed(2)}x indica pérdida. Considerar reducir o pausar campañas menos rentables.`;
      break;
    case 'REBALANCE':
      suggestedAction = `Rebalancear inversión en ${entityName}. Spend concentrado en pocas campañas/websites.`;
      break;
    case 'MONITOR':
      suggestedAction = `Monitorear ${entityName}. Datos insuficientes para decisión.`;
      break;
    case 'INSUFFICIENT_DATA':
      suggestedAction = `Sin datos suficientes para ${entityName}. Verificar tracking y attribution.`;
      break;
  }

  return {
    id: `${entityType}-${entityId}`,
    entityType,
    entityId,
    entityName,
    recommendation,
    priority,
    metrics: {
      spend7d: metrics.spend7d,
      payback51dAgg: metrics.payback51dAgg,
      attributionCoverage: metrics.attributionCoverage,
    },
    rationale,
    suggestedAction,
    isActionable,
    blockers: blockers.length > 0 ? blockers : undefined,
  };
}

// ============================================================================
// MAIN FUNCTION
// ============================================================================

export async function getMacroRecommendations(): Promise<MacroRecommendationsResult | null> {
  // Check cache
  if (recommendationsCache && Date.now() - recommendationsCache.cachedAt < CACHE_TTL_MS) {
    console.log("[MacroEngine] Cache hit");
    return recommendationsCache.data;
  }

  console.log("[MacroEngine] Cache miss - generating recommendations...");

  // Fetch all views in parallel
  const [websiteView, companyView, countryView, serviceView] = await Promise.all([
    getWebsiteView(),
    getCompanyView(),
    getCountryView(),
    getServiceView(),
  ]);

  const recommendations: MacroRecommendation[] = [];

  // Process websites
  if (websiteView) {
    for (const website of websiteView.websites) {
      if (website.spend7d > 0) {
        recommendations.push(buildRecommendation(
          'website',
          website.websiteId,
          website.websiteName,
          website.recommendation.recommendation,
          {
            spend7d: website.spend7d,
            payback51dAgg: website.payback51dAgg,
            attributionCoverage: website.attributionCoverage.percentage,
            minCampaignAgeDays: website.minCampaignAgeDays,
            totalAcquisitions: website.totalAcquisitions,
          },
          website.recommendation.rationale
        ));
      }
    }
  }

  // Process companies
  if (companyView) {
    for (const company of companyView.companies) {
      if (company.spend7d > 0) {
        recommendations.push(buildRecommendation(
          'company',
          company.companyId,
          company.companyName,
          company.recommendation.recommendation,
          {
            spend7d: company.spend7d,
            payback51dAgg: company.payback51dAgg,
            attributionCoverage: company.attributionCoverage.percentage,
            minCampaignAgeDays: company.minCampaignAgeDays,
            totalAcquisitions: company.totalAcquisitions,
          },
          company.recommendation.rationale
        ));
      }
    }
  }

  // Process countries
  if (countryView) {
    for (const country of countryView.countries) {
      if (country.spend7d > 0) {
        recommendations.push(buildRecommendation(
          'country',
          country.countryId,
          country.countryName,
          country.recommendation.recommendation,
          {
            spend7d: country.spend7d,
            payback51dAgg: country.payback51dAgg,
            attributionCoverage: country.attributionCoverage.percentage,
            minCampaignAgeDays: country.minCampaignAgeDays,
            totalAcquisitions: country.totalAcquisitions,
          },
          country.recommendation.rationale
        ));
      }
    }
  }

  // Process services
  if (serviceView) {
    for (const service of serviceView.services) {
      if (service.spend7d > 0) {
        recommendations.push(buildRecommendation(
          'service',
          service.serviceCategory,
          service.serviceName,
          service.recommendation.recommendation,
          {
            spend7d: service.spend7d,
            payback51dAgg: service.payback51dAgg,
            attributionCoverage: service.attributionCoverage.percentage,
            minCampaignAgeDays: service.minCampaignAgeDays,
            totalAcquisitions: service.totalAcquisitions,
          },
          service.recommendation.rationale
        ));
      }
    }
  }

  // Sort by priority and spend
  const priorityOrder = { high: 0, medium: 1, low: 2 };
  recommendations.sort((a, b) => {
    const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
    if (priorityDiff !== 0) return priorityDiff;
    return b.metrics.spend7d - a.metrics.spend7d;
  });

  // Calculate summary
  const summary = {
    totalRecommendations: recommendations.length,
    byType: {
      SCALE_FOCUS: 0,
      MAINTAIN: 0,
      REDUCE_EXPOSURE: 0,
      REBALANCE: 0,
      MONITOR: 0,
    },
    potentialImpact: {
      spendToScale: 0,
      spendToReduce: 0,
      spendToRebalance: 0,
    },
  };

  for (const rec of recommendations) {
    switch (rec.recommendation) {
      case 'SCALE_FOCUS':
        summary.byType.SCALE_FOCUS++;
        summary.potentialImpact.spendToScale += rec.metrics.spend7d;
        break;
      case 'MAINTAIN':
        summary.byType.MAINTAIN++;
        break;
      case 'REDUCE_EXPOSURE':
        summary.byType.REDUCE_EXPOSURE++;
        summary.potentialImpact.spendToReduce += rec.metrics.spend7d;
        break;
      case 'REBALANCE':
        summary.byType.REBALANCE++;
        summary.potentialImpact.spendToRebalance += rec.metrics.spend7d;
        break;
      case 'MONITOR':
      case 'INSUFFICIENT_DATA':
        summary.byType.MONITOR++;
        break;
    }
  }

  summary.potentialImpact.spendToScale = Math.round(summary.potentialImpact.spendToScale * 100) / 100;
  summary.potentialImpact.spendToReduce = Math.round(summary.potentialImpact.spendToReduce * 100) / 100;
  summary.potentialImpact.spendToRebalance = Math.round(summary.potentialImpact.spendToRebalance * 100) / 100;

  const result: MacroRecommendationsResult = {
    generatedAt: new Date().toISOString(),
    summary,
    recommendations,
    disclaimer: "Datos agregados — solo recomendaciones estratégicas, no decisiones automáticas. Verificar datos antes de actuar.",
  };

  // Cache result
  recommendationsCache = { data: result, cachedAt: Date.now() };

  return result;
}
