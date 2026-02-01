/**
 * Business Views - Phase 7.5
 *
 * Types para vistas agregadas a nivel negocio.
 *
 * REGLAS DE AGREGACIÓN (críticas):
 * - LTV_51d_agg = SUM(revenue_51d) / SUM(customers_acquired)
 * - Payback_51d_agg = SUM(revenue_51d) / SUM(spend)
 * - ❌ NO usar AVG(ltv_campaign) ni AVG(payback_campaign)
 *
 * Esto evita que campañas chicas distorsionen la visión macro.
 */

// ============================================================================
// BASE AGGREGATED METRICS
// ============================================================================

/**
 * Métricas agregadas base - compartidas por todas las vistas
 */
export interface AggregatedMetrics {
  // Spend (from Google Ads Script - source of truth)
  spend7d: number;           // EUR
  spend30d: number;          // EUR

  // Volume metrics (from DB attribution)
  totalAcquisitions: number;       // SUM of customers acquired
  totalFirstRebills: number;       // SUM of first rebills
  totalRevenue51d: number;         // SUM of revenue within 51d window (EUR)

  // Aggregated LTV & Payback (SUM-based, NOT averages)
  ltv51dAgg: number;         // SUM(revenue_51d) / SUM(acquisitions)
  payback51dAgg: number;     // SUM(revenue_51d) / SUM(spend_7d)

  // Context (for display only, NOT for decisions)
  minCampaignAgeDays: number;      // MIN(campaignAgeDays) in group
  activeCampaigns: number;         // Count of active campaigns
  totalCampaigns: number;          // Count of all campaigns

  // Attribution coverage
  attributionCoverage: {
    spendWithAttribution: number;  // EUR spend with attribution data
    spendTotal: number;            // EUR total spend
    percentage: number;            // % of spend covered by attribution
  };
}

/**
 * Recommendation types for macro decisions
 * Phase 7.5: Solo recomendaciones, NO acciones automáticas
 */
export type BusinessRecommendation =
  | 'SCALE_FOCUS'      // Payback > 1.5x, should increase investment
  | 'MAINTAIN'         // Payback 1.0-1.5x, keep current level
  | 'REDUCE_EXPOSURE'  // Payback < 0.7x in mature cohort, reduce risk
  | 'REBALANCE'        // Profitable but spend is unbalanced
  | 'MONITOR'          // Not enough data yet
  | 'INSUFFICIENT_DATA'; // No attribution data available

export interface RecommendationDetails {
  recommendation: BusinessRecommendation;
  confidence: 'high' | 'medium' | 'low';
  rationale: string;
  dataQuality: {
    hasMatureCohort: boolean;      // minCampaignAgeDays >= 51
    attributionCoverage: number;   // % of spend with attribution
    sampleSize: number;            // totalAcquisitions
  };
}

// ============================================================================
// WEBSITE VIEW
// ============================================================================

export interface WebsiteMetrics extends AggregatedMetrics {
  websiteId: number;
  websiteName: string;
  websiteUrl?: string;

  // Top performing campaigns in this website
  topCampaigns: {
    campaignId: string;
    campaignName: string;
    spend7d: number;
    payback51d: number;
  }[];

  recommendation: RecommendationDetails;
}

export interface WebsiteViewResult {
  generatedAt: string;
  totalWebsites: number;
  websites: WebsiteMetrics[];
  aggregatedTotal: AggregatedMetrics;
}

// ============================================================================
// COMPANY VIEW
// ============================================================================

export type CompanyName = 'Avocode' | 'KiwiKode' | 'Jackcode';

export interface CompanyMetrics extends AggregatedMetrics {
  companyId: number;
  companyName: CompanyName;

  // Websites in this company
  websites: {
    websiteId: number;
    websiteName: string;
    spend7d: number;
    payback51dAgg: number;
  }[];

  // Spend concentration analysis
  spendConcentration: {
    topWebsiteSpendPct: number;    // % of spend in top website
    isConcentrated: boolean;       // >70% in single website
  };

  recommendation: RecommendationDetails;
}

export interface CompanyViewResult {
  generatedAt: string;
  companies: CompanyMetrics[];
  aggregatedTotal: AggregatedMetrics;
}

// ============================================================================
// COUNTRY VIEW
// ============================================================================

export interface CountryMetrics extends AggregatedMetrics {
  countryId: number;
  countryCode: string;        // ISO 3166-1 alpha-2 (RO, ES, PL, etc.)
  countryName: string;

  // Top campaigns in this country
  topCampaigns: {
    campaignId: string;
    campaignName: string;
    spend7d: number;
    payback51d: number;
  }[];

  recommendation: RecommendationDetails;
}

export interface CountryViewResult {
  generatedAt: string;
  totalCountries: number;
  countries: CountryMetrics[];
  aggregatedTotal: AggregatedMetrics;
}

// ============================================================================
// SERVICE VIEW
// ============================================================================

/**
 * Service classification is HEURISTIC based on campaign name patterns.
 * NOT a source of truth - used for directional insights only.
 */
export type ServiceCategory =
  | 'PDF_TOOLS'        // PDF to Word, PDF to Excel, Merge PDF, etc.
  | 'CONTRACTS'        // Contratos, Contrato Commodat, etc.
  | 'DEVICE_FINDER'    // Device Finder
  | 'IMAGE_TOOLS'      // Image to PDF, etc.
  | 'FORMS'            // Formularios ANAF, etc.
  | 'OTHER';           // Unclassified

export interface ServiceMetrics extends AggregatedMetrics {
  serviceCategory: ServiceCategory;
  serviceName: string;           // Human-readable name

  // Campaigns in this service
  campaigns: {
    campaignId: string;
    campaignName: string;
    spend7d: number;
    payback51d: number;
  }[];

  // Classification metadata
  classification: {
    method: 'pattern_matching';  // Always pattern matching for now
    confidence: 'high' | 'medium' | 'low';
    matchedPatterns: string[];   // Patterns that matched
  };

  recommendation: RecommendationDetails;
}

export interface ServiceViewResult {
  generatedAt: string;
  totalServices: number;
  services: ServiceMetrics[];
  aggregatedTotal: AggregatedMetrics;
  disclaimer: string;  // "Service classification is heuristic"
}

// ============================================================================
// MACRO RECOMMENDATIONS
// ============================================================================

export interface MacroRecommendation {
  id: string;
  entityType: 'website' | 'company' | 'country' | 'service';
  entityId: number | string;
  entityName: string;

  recommendation: BusinessRecommendation;
  priority: 'high' | 'medium' | 'low';

  metrics: {
    spend7d: number;
    payback51dAgg: number;
    attributionCoverage: number;
  };

  rationale: string;
  suggestedAction: string;  // Human-readable action

  // Metadata
  isActionable: boolean;    // Has enough data for confident recommendation
  blockers?: string[];      // Why not actionable (e.g., "Cohort too young")
}

export interface MacroRecommendationsResult {
  generatedAt: string;

  summary: {
    totalRecommendations: number;
    byType: {
      SCALE_FOCUS: number;
      MAINTAIN: number;
      REDUCE_EXPOSURE: number;
      REBALANCE: number;
      MONITOR: number;
    };
    potentialImpact: {
      spendToScale: number;       // EUR that could be scaled
      spendToReduce: number;      // EUR with risk exposure
      spendToRebalance: number;   // EUR that could be reallocated
    };
  };

  recommendations: MacroRecommendation[];

  disclaimer: string;  // "Recommendations only - no automatic actions"
}
