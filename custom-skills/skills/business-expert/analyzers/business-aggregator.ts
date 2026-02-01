/**
 * Business Aggregator - Phase 7.5
 *
 * Combina datos de Google Ads Script (spend) con DB attribution (revenue)
 * para generar vistas agregadas por website/company/country/service.
 *
 * REGLAS DE AGREGACIÓN:
 * - LTV_51d_agg = SUM(revenue_51d) / SUM(acquisitions)
 * - Payback_51d_agg = SUM(revenue_51d) / SUM(spend)
 * - ❌ NO usar AVG(ltv) ni AVG(payback)
 *
 * APPROACH SIMPLIFICADO:
 * - Usa campaign-performance query (ya tiene website_id/company_id/country_id)
 * - Mergea spend por campaign_id
 * - Agrega por dimensión
 */

import { getCampaignSpend } from "../../google-ads-expert/ingest.js";
import { executeQuery } from "../../db-reader/executor.js";
import { classifyCampaign, getServiceDisplayName, getAllServiceCategories } from "../utils/service-classifier.js";
import type {
  AggregatedMetrics,
  WebsiteMetrics,
  WebsiteViewResult,
  CompanyMetrics,
  CompanyViewResult,
  CountryMetrics,
  CountryViewResult,
  ServiceMetrics,
  ServiceViewResult,
  ServiceCategory,
  RecommendationDetails,
} from "../types/business-views.js";

// ============================================================================
// CACHE
// ============================================================================

interface CacheEntry<T> {
  data: T;
  cachedAt: number;
}

const CACHE_TTL_MS = 5 * 60 * 1000;

let websiteCache: CacheEntry<WebsiteViewResult> | null = null;
let companyCache: CacheEntry<CompanyViewResult> | null = null;
let countryCache: CacheEntry<CountryViewResult> | null = null;
let serviceCache: CacheEntry<ServiceViewResult> | null = null;

export function clearBusinessCache(): void {
  websiteCache = null;
  companyCache = null;
  countryCache = null;
  serviceCache = null;
  console.log("[BusinessAggregator] All caches cleared");
}

// ============================================================================
// ENRICHED CAMPAIGN DATA
// ============================================================================

interface EnrichedCampaign {
  campaignId: string;
  campaignName: string;
  websiteId: number;
  websiteName: string;
  companyId: number;
  companyName: string;
  countryId: number;
  countryCode: string;
  countryName: string;
  active: boolean;
  campaignAgeDays: number;
  // Spend from Script
  spend7d: number;
  spend30d: number;
  // Attribution from DB
  totalAcquisitions: number;
  totalFirstRebills: number;
  totalRevenue51d: number;
  cohort51dSize: number;
}

async function getEnrichedCampaigns(): Promise<EnrichedCampaign[]> {
  // 1. Get spend data from Script
  const [spend7d, spend30d] = await Promise.all([
    getCampaignSpend('7d'),
    getCampaignSpend('30d'),
  ]);

  const spendMap = new Map<string, { spend7d: number; spend30d: number }>();
  for (const s of spend7d) {
    spendMap.set(s.campaignId, { spend7d: s.cost, spend30d: 0 });
  }
  for (const s of spend30d) {
    const current = spendMap.get(s.campaignId);
    if (current) {
      current.spend30d = s.cost;
    } else {
      spendMap.set(s.campaignId, { spend7d: 0, spend30d: s.cost });
    }
  }

  console.log(`[BusinessAggregator] Got spend for ${spendMap.size} campaigns from Script`);

  // Debug: log first few campaign IDs from spendMap
  const spendCampaignIds = Array.from(spendMap.keys()).slice(0, 3);
  console.log(`[BusinessAggregator] Sample spend campaign IDs: ${spendCampaignIds.join(', ')}`);

  // 2. Get attribution + metadata from campaign-performance query
  const result = await executeQuery("campaign-performance");
  if (result.status !== "success" || !result.results) {
    console.log("[BusinessAggregator] Failed to get campaign-performance:", result.error);
    return [];
  }

  const rows = result.results as any[];
  console.log(`[BusinessAggregator] Got ${rows.length} campaigns from DB`);

  // Debug: log first few campaign IDs from DB
  const dbCampaignIds = rows.slice(0, 3).map((r: any) => String(r.google_campaign_id || ''));
  console.log(`[BusinessAggregator] Sample DB campaign IDs: ${dbCampaignIds.join(', ')}`);

  // 3. Get reference data for names
  const websiteNames = new Map<number, string>();
  const companyNames = new Map<number, string>();
  const countryData = new Map<number, { name: string; code: string }>();

  // Fetch reference data
  try {
    const [websitesResult, companiesResult, countriesResult] = await Promise.all([
      executeQuery("business-by-website"),
      executeQuery("business-by-company"),
      executeQuery("business-by-country"),
    ]);

    if (websitesResult.status === "success" && websitesResult.results) {
      for (const row of websitesResult.results as any[]) {
        websiteNames.set(row.website_id, row.website_name);
      }
    }
    if (companiesResult.status === "success" && companiesResult.results) {
      for (const row of companiesResult.results as any[]) {
        const name = row.company_name.includes('AVOCODE') ? 'Avocode' :
                     row.company_name.includes('KIWIKODE') ? 'KiwiKode' :
                     row.company_name.includes('JACKCODE') ? 'Jackcode' : row.company_name;
        companyNames.set(row.company_id, name);
      }
    }
    if (countriesResult.status === "success" && countriesResult.results) {
      for (const row of countriesResult.results as any[]) {
        countryData.set(row.country_id, { name: row.country_name, code: row.country_code });
      }
    }
  } catch (e) {
    console.log("[BusinessAggregator] Failed to get reference data:", e);
  }

  // 4. Merge data
  const enriched: EnrichedCampaign[] = [];

  for (const row of rows) {
    const campaignId = String(row.google_campaign_id || '');
    if (!campaignId) continue;

    const spend = spendMap.get(campaignId) || { spend7d: 0, spend30d: 0 };
    const country = countryData.get(row.country_id) || { name: 'Unknown', code: 'XX' };

    // Parse numeric values safely (avoid NaN)
    const ltv51d = parseFloat(row.ltv_51d) || 0;
    const cohort51dSize = parseInt(row.cohort_51d_size) || 0;
    const totalRevenue51d = ltv51d * cohort51dSize;

    enriched.push({
      campaignId,
      campaignName: row.campaign_name || 'Unknown',
      websiteId: row.website_id,
      websiteName: websiteNames.get(row.website_id) || `Website ${row.website_id}`,
      companyId: row.company_id,
      companyName: companyNames.get(row.company_id) || `Company ${row.company_id}`,
      countryId: row.country_id,
      countryCode: country.code,
      countryName: country.name,
      active: row.active === 1,
      campaignAgeDays: parseInt(row.campaign_age_days) || 0,
      spend7d: Number(spend.spend7d) || 0,
      spend30d: Number(spend.spend30d) || 0,
      totalAcquisitions: parseInt(row.total_acquisitions) || 0,
      totalFirstRebills: parseInt(row.total_first_rebills) || 0,
      totalRevenue51d,
      cohort51dSize,
    });
  }

  // Debug: count campaigns with spend > 0
  const withSpend = enriched.filter(c => c.spend7d > 0);
  const totalSpend = enriched.reduce((sum, c) => sum + c.spend7d, 0);
  console.log(`[BusinessAggregator] Enriched ${enriched.length} campaigns, ${withSpend.length} with spend, total spend7d: ${totalSpend}`);

  return enriched;
}

// ============================================================================
// RECOMMENDATION LOGIC
// ============================================================================

function calculateRecommendation(
  metrics: AggregatedMetrics
): RecommendationDetails {
  const { payback51dAgg, attributionCoverage, minCampaignAgeDays, totalAcquisitions } = metrics;

  const hasMatureCohort = minCampaignAgeDays >= 51;
  const hasGoodCoverage = attributionCoverage.percentage >= 70;
  const hasSampleSize = totalAcquisitions >= 50;

  if (attributionCoverage.percentage < 30 || totalAcquisitions < 10) {
    return {
      recommendation: 'INSUFFICIENT_DATA',
      confidence: 'low',
      rationale: `Solo ${totalAcquisitions} acquisitions y ${attributionCoverage.percentage.toFixed(0)}% coverage`,
      dataQuality: { hasMatureCohort, attributionCoverage: attributionCoverage.percentage, sampleSize: totalAcquisitions },
    };
  }

  if (!hasMatureCohort) {
    return {
      recommendation: 'MONITOR',
      confidence: 'medium',
      rationale: `Cohorte más joven: ${minCampaignAgeDays}d. Esperar 51d.`,
      dataQuality: { hasMatureCohort, attributionCoverage: attributionCoverage.percentage, sampleSize: totalAcquisitions },
    };
  }

  const confidence: 'high' | 'medium' | 'low' =
    hasGoodCoverage && hasSampleSize ? 'high' :
    hasGoodCoverage || hasSampleSize ? 'medium' : 'low';

  if (payback51dAgg >= 1.5) {
    return {
      recommendation: 'SCALE_FOCUS',
      confidence,
      rationale: `Payback ${payback51dAgg.toFixed(2)}x > 1.5x. Incrementar inversión.`,
      dataQuality: { hasMatureCohort, attributionCoverage: attributionCoverage.percentage, sampleSize: totalAcquisitions },
    };
  }

  if (payback51dAgg >= 1.0) {
    return {
      recommendation: 'MAINTAIN',
      confidence,
      rationale: `Payback ${payback51dAgg.toFixed(2)}x en break-even.`,
      dataQuality: { hasMatureCohort, attributionCoverage: attributionCoverage.percentage, sampleSize: totalAcquisitions },
    };
  }

  if (payback51dAgg >= 0.7) {
    return {
      recommendation: 'MAINTAIN',
      confidence: 'medium',
      rationale: `Payback ${payback51dAgg.toFixed(2)}x - optimizar antes de escalar.`,
      dataQuality: { hasMatureCohort, attributionCoverage: attributionCoverage.percentage, sampleSize: totalAcquisitions },
    };
  }

  return {
    recommendation: 'REDUCE_EXPOSURE',
    confidence,
    rationale: `Payback ${payback51dAgg.toFixed(2)}x < 0.7x. Reducir exposición.`,
    dataQuality: { hasMatureCohort, attributionCoverage: attributionCoverage.percentage, sampleSize: totalAcquisitions },
  };
}

// ============================================================================
// AGGREGATION HELPER
// ============================================================================

function buildAggregatedMetrics(
  campaigns: EnrichedCampaign[],
  totalSpend7d?: number
): AggregatedMetrics {
  const spend7d = campaigns.reduce((sum, c) => sum + c.spend7d, 0);
  const spend30d = campaigns.reduce((sum, c) => sum + c.spend30d, 0);
  const totalAcquisitions = campaigns.reduce((sum, c) => sum + c.totalAcquisitions, 0);
  const totalFirstRebills = campaigns.reduce((sum, c) => sum + c.totalFirstRebills, 0);
  const totalRevenue51d = campaigns.reduce((sum, c) => sum + c.totalRevenue51d, 0);
  const minCampaignAgeDays = campaigns.length > 0
    ? Math.min(...campaigns.map(c => c.campaignAgeDays))
    : 0;
  const activeCampaigns = campaigns.filter(c => c.active).length;
  const totalCampaigns = campaigns.length;

  // SUM-based calculations
  const ltv51dAgg = totalAcquisitions > 0 ? totalRevenue51d / totalAcquisitions : 0;
  const payback51dAgg = spend7d > 0 ? totalRevenue51d / spend7d : 0;

  // Attribution coverage
  const spendWithAttribution = campaigns.filter(c => c.totalAcquisitions > 0).reduce((sum, c) => sum + c.spend7d, 0);
  const refTotalSpend = totalSpend7d !== undefined ? totalSpend7d : spend7d;

  return {
    spend7d: Math.round(spend7d * 100) / 100,
    spend30d: Math.round(spend30d * 100) / 100,
    totalAcquisitions,
    totalFirstRebills,
    totalRevenue51d: Math.round(totalRevenue51d * 100) / 100,
    ltv51dAgg: Math.round(ltv51dAgg * 100) / 100,
    payback51dAgg: Math.round(payback51dAgg * 100) / 100,
    minCampaignAgeDays,
    activeCampaigns,
    totalCampaigns,
    attributionCoverage: {
      spendWithAttribution: Math.round(spendWithAttribution * 100) / 100,
      spendTotal: Math.round(refTotalSpend * 100) / 100,
      percentage: refTotalSpend > 0 ? Math.round((spendWithAttribution / refTotalSpend) * 100) : 0,
    },
  };
}

// ============================================================================
// WEBSITE VIEW
// ============================================================================

export async function getWebsiteView(): Promise<WebsiteViewResult | null> {
  if (websiteCache && Date.now() - websiteCache.cachedAt < CACHE_TTL_MS) {
    console.log("[BusinessAggregator] Website cache hit");
    return websiteCache.data;
  }

  console.log("[BusinessAggregator] Website cache miss - fetching data...");

  const campaigns = await getEnrichedCampaigns();
  if (campaigns.length === 0) {
    return null;
  }

  // Group by website
  const byWebsite = new Map<number, EnrichedCampaign[]>();
  for (const c of campaigns) {
    if (!byWebsite.has(c.websiteId)) {
      byWebsite.set(c.websiteId, []);
    }
    byWebsite.get(c.websiteId)!.push(c);
  }

  const totalSpend7d = campaigns.reduce((sum, c) => sum + c.spend7d, 0);

  const websites: WebsiteMetrics[] = [];
  for (const [websiteId, websiteCampaigns] of byWebsite.entries()) {
    const metrics = buildAggregatedMetrics(websiteCampaigns, totalSpend7d);

    websites.push({
      ...metrics,
      websiteId,
      websiteName: websiteCampaigns[0]?.websiteName || `Website ${websiteId}`,
      topCampaigns: websiteCampaigns
        .sort((a, b) => b.spend7d - a.spend7d)
        .slice(0, 5)
        .map(c => ({
          campaignId: c.campaignId,
          campaignName: c.campaignName,
          spend7d: c.spend7d,
          payback51d: c.spend7d > 0 ? c.totalRevenue51d / c.spend7d : 0,
        })),
      recommendation: calculateRecommendation(metrics),
    });
  }

  websites.sort((a, b) => b.spend7d - a.spend7d);

  const result: WebsiteViewResult = {
    generatedAt: new Date().toISOString(),
    totalWebsites: websites.length,
    websites,
    aggregatedTotal: buildAggregatedMetrics(campaigns),
  };

  websiteCache = { data: result, cachedAt: Date.now() };
  return result;
}

// ============================================================================
// COMPANY VIEW
// ============================================================================

export async function getCompanyView(): Promise<CompanyViewResult | null> {
  if (companyCache && Date.now() - companyCache.cachedAt < CACHE_TTL_MS) {
    console.log("[BusinessAggregator] Company cache hit");
    return companyCache.data;
  }

  console.log("[BusinessAggregator] Company cache miss - fetching data...");

  const campaigns = await getEnrichedCampaigns();
  if (campaigns.length === 0) {
    return null;
  }

  // Group by company
  const byCompany = new Map<number, EnrichedCampaign[]>();
  for (const c of campaigns) {
    if (!byCompany.has(c.companyId)) {
      byCompany.set(c.companyId, []);
    }
    byCompany.get(c.companyId)!.push(c);
  }

  const companies: CompanyMetrics[] = [];
  for (const [companyId, companyCampaigns] of byCompany.entries()) {
    const metrics = buildAggregatedMetrics(companyCampaigns);

    // Group websites in this company
    const websiteSpend = new Map<number, { id: number; name: string; spend: number; payback: number }>();
    for (const c of companyCampaigns) {
      if (!websiteSpend.has(c.websiteId)) {
        websiteSpend.set(c.websiteId, { id: c.websiteId, name: c.websiteName, spend: 0, payback: 0 });
      }
      const ws = websiteSpend.get(c.websiteId)!;
      ws.spend += c.spend7d;
    }

    const websites = Array.from(websiteSpend.values())
      .sort((a, b) => b.spend - a.spend)
      .map(ws => ({
        websiteId: ws.id,
        websiteName: ws.name,
        spend7d: Math.round(ws.spend * 100) / 100,
        payback51dAgg: 0, // TODO: calculate per-website
      }));

    const topSpend = websites[0]?.spend7d || 0;
    const totalSpend = metrics.spend7d;

    companies.push({
      ...metrics,
      companyId,
      companyName: companyCampaigns[0]?.companyName as any || `Company ${companyId}`,
      websites,
      spendConcentration: {
        topWebsiteSpendPct: totalSpend > 0 ? Math.round((topSpend / totalSpend) * 100) : 0,
        isConcentrated: totalSpend > 0 && (topSpend / totalSpend) > 0.7,
      },
      recommendation: calculateRecommendation(metrics),
    });
  }

  companies.sort((a, b) => b.spend7d - a.spend7d);

  const result: CompanyViewResult = {
    generatedAt: new Date().toISOString(),
    companies,
    aggregatedTotal: buildAggregatedMetrics(campaigns),
  };

  companyCache = { data: result, cachedAt: Date.now() };
  return result;
}

// ============================================================================
// COUNTRY VIEW
// ============================================================================

export async function getCountryView(): Promise<CountryViewResult | null> {
  if (countryCache && Date.now() - countryCache.cachedAt < CACHE_TTL_MS) {
    console.log("[BusinessAggregator] Country cache hit");
    return countryCache.data;
  }

  console.log("[BusinessAggregator] Country cache miss - fetching data...");

  const campaigns = await getEnrichedCampaigns();
  if (campaigns.length === 0) {
    return null;
  }

  // Group by country
  const byCountry = new Map<number, EnrichedCampaign[]>();
  for (const c of campaigns) {
    if (!byCountry.has(c.countryId)) {
      byCountry.set(c.countryId, []);
    }
    byCountry.get(c.countryId)!.push(c);
  }

  const countries: CountryMetrics[] = [];
  for (const [countryId, countryCampaigns] of byCountry.entries()) {
    const metrics = buildAggregatedMetrics(countryCampaigns);

    countries.push({
      ...metrics,
      countryId,
      countryCode: countryCampaigns[0]?.countryCode || 'XX',
      countryName: countryCampaigns[0]?.countryName || `Country ${countryId}`,
      topCampaigns: countryCampaigns
        .sort((a, b) => b.spend7d - a.spend7d)
        .slice(0, 5)
        .map(c => ({
          campaignId: c.campaignId,
          campaignName: c.campaignName,
          spend7d: c.spend7d,
          payback51d: c.spend7d > 0 ? c.totalRevenue51d / c.spend7d : 0,
        })),
      recommendation: calculateRecommendation(metrics),
    });
  }

  countries.sort((a, b) => b.spend7d - a.spend7d);

  const result: CountryViewResult = {
    generatedAt: new Date().toISOString(),
    totalCountries: countries.length,
    countries,
    aggregatedTotal: buildAggregatedMetrics(campaigns),
  };

  countryCache = { data: result, cachedAt: Date.now() };
  return result;
}

// ============================================================================
// SERVICE VIEW (Heuristic)
// ============================================================================

export async function getServiceView(): Promise<ServiceViewResult | null> {
  if (serviceCache && Date.now() - serviceCache.cachedAt < CACHE_TTL_MS) {
    console.log("[BusinessAggregator] Service cache hit");
    return serviceCache.data;
  }

  console.log("[BusinessAggregator] Service cache miss - fetching data...");

  const campaigns = await getEnrichedCampaigns();
  if (campaigns.length === 0) {
    return null;
  }

  // Classify and group by service
  const byService = new Map<ServiceCategory, (EnrichedCampaign & { matchedPatterns: string[] })[]>();

  for (const category of getAllServiceCategories()) {
    byService.set(category, []);
  }

  for (const c of campaigns) {
    const classification = classifyCampaign(c.campaignName);
    byService.get(classification.category)!.push({
      ...c,
      matchedPatterns: classification.matchedPatterns,
    });
  }

  const services: ServiceMetrics[] = [];
  for (const [category, serviceCampaigns] of byService.entries()) {
    if (serviceCampaigns.length === 0) continue;

    const metrics = buildAggregatedMetrics(serviceCampaigns);
    const allPatterns = new Set<string>();
    for (const c of serviceCampaigns) {
      for (const p of c.matchedPatterns) {
        allPatterns.add(p);
      }
    }

    services.push({
      ...metrics,
      serviceCategory: category,
      serviceName: getServiceDisplayName(category),
      campaigns: serviceCampaigns
        .sort((a, b) => b.spend7d - a.spend7d)
        .slice(0, 5)
        .map(c => ({
          campaignId: c.campaignId,
          campaignName: c.campaignName,
          spend7d: c.spend7d,
          payback51d: c.spend7d > 0 ? c.totalRevenue51d / c.spend7d : 0,
        })),
      classification: {
        method: 'pattern_matching',
        confidence: category === 'OTHER' ? 'low' : 'high',
        matchedPatterns: Array.from(allPatterns),
      },
      recommendation: calculateRecommendation(metrics),
    });
  }

  services.sort((a, b) => b.spend7d - a.spend7d);

  const result: ServiceViewResult = {
    generatedAt: new Date().toISOString(),
    totalServices: services.length,
    services,
    aggregatedTotal: buildAggregatedMetrics(campaigns),
    disclaimer: "Service classification is heuristic (pattern matching). Not a source of truth.",
  };

  serviceCache = { data: result, cachedAt: Date.now() };
  return result;
}
