/**
 * Campaign Analyzer - Phase 7
 *
 * Combina datos de Google Ads Script (JSONL) con datos de atribución (DB).
 *
 * FUENTES DE DATOS:
 * - Google Ads Script (JSONL): spend, clicks, impressions, conversions, CPA
 *   → Fuente de verdad para métricas de ads
 * - DB (google_ads_details → invoices): acquisitions, revenue, LTV
 *   → Fuente de verdad para revenue real
 *
 * JOIN KEY: campaignId (script) = utm_campaign (google_ads_details)
 */

import { getLatestRecord, readRecords } from "../../google-ads-expert/ingest.js";
import { executeQuery } from "../../db-reader/executor.js";
import { CurrencyConverter } from "../../../core/currency.js";

// ============================================================================
// TYPES
// ============================================================================

export interface CampaignMetrics {
  // Identifiers
  campaignId: string;
  campaignName: string;
  status: string;

  // From Google Ads Script (source of truth for ads metrics)
  spend7d: number;          // EUR
  clicks: number;
  impressions: number;
  conversionsGoogle: number; // Conversions reportadas por Google
  ctr: number;
  cpc: number;
  googleCpa: number;         // CPA de Google (spend / conversions)

  // From DB Attribution (source of truth for revenue)
  acquisitions: number;      // Customers atribuidos vía utm_campaign
  firstRebills: number;      // Customers con invoice tipo 2
  cohort21dSize: number;
  cohort51dSize: number;
  ltv21d: number;
  ltv51d: number;

  // Calculated (combining both sources)
  cpfr: number;              // spend / firstRebills (real CPFR)
  payback21d: number;        // ltv21d / cpfr
  payback51d: number;        // ltv51d / cpfr
  campaignAgeDays: number;   // Days since first acquisition

  // Semáforos
  payback51dStatus: 'green' | 'yellow' | 'red';
  recommendation: string;
}

export interface CampaignPerformanceResult {
  fetchedAt: string;
  dateRange: string;
  currency: string;
  totalCampaigns: number;
  campaigns: CampaignMetrics[];
}

// ============================================================================
// CACHE
// ============================================================================

interface CampaignCacheEntry {
  data: CampaignPerformanceResult;
  cachedAt: number;
}

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
let campaignCache: CampaignCacheEntry | null = null;

export function clearCampaignCache(): void {
  campaignCache = null;
  console.log("[CampaignAnalyzer] Cache cleared");
}

// ============================================================================
// MAIN FUNCTION
// ============================================================================

/**
 * Get enriched campaign metrics combining Google Ads data with DB attribution
 */
export async function getCampaignPerformance(): Promise<CampaignPerformanceResult | null> {
  // Check cache
  if (campaignCache && Date.now() - campaignCache.cachedAt < CACHE_TTL_MS) {
    console.log("[CampaignAnalyzer] Cache hit");
    return campaignCache.data;
  }

  console.log("[CampaignAnalyzer] Cache miss - fetching data...");

  // 1. Get campaign data from Google Ads Script (JSONL)
  const adsRecord = getLatestRecord();
  if (!adsRecord || !adsRecord.payload || !adsRecord.payload.campaigns) {
    console.log("[CampaignAnalyzer] No Google Ads data available");
    return null;
  }

  const scriptCampaigns = adsRecord.payload.campaigns;
  const currency = adsRecord.payload.currency || 'EUR';
  const dateRange = adsRecord.payload.dateRange || 'LAST_7_DAYS';

  // 2. Get attribution data from DB for all campaigns
  const campaignIds = scriptCampaigns.map((c: any) => c.campaignId).filter(Boolean);
  const attributionData = await getAttributionData(campaignIds);

  // 3. Combine both sources
  const campaigns: CampaignMetrics[] = [];

  for (const sc of scriptCampaigns) {
    const campaignId = sc.campaignId;
    if (!campaignId) continue;

    const attr = attributionData[campaignId] || {
      acquisitions: 0,
      firstRebills: 0,
      cohort21dSize: 0,
      cohort51dSize: 0,
      ltv21d: 0,
      ltv51d: 0,
      firstAcquisitionDate: null,
    };

    // Convert spend to EUR if needed
    const spendEur = CurrencyConverter.toEur(sc.cost || 0, currency);

    // Calculate CPFR (spend / first rebills)
    const cpfr = attr.firstRebills > 0 ? spendEur / attr.firstRebills : 0;

    // Calculate Payback ratios
    const payback21d = cpfr > 0 ? attr.ltv21d / cpfr : 0;
    const payback51d = cpfr > 0 ? attr.ltv51d / cpfr : 0;

    // Calculate campaign age
    const campaignAgeDays = attr.firstAcquisitionDate
      ? Math.floor((Date.now() - new Date(attr.firstAcquisitionDate).getTime()) / (1000 * 60 * 60 * 24))
      : 0;

    // Determine status and recommendation
    const { status, recommendation } = getPaybackStatusAndRecommendation(
      payback51d,
      campaignAgeDays,
      attr.cohort51dSize
    );

    campaigns.push({
      campaignId,
      campaignName: sc.campaignName || 'Unknown',
      status: sc.status || 'UNKNOWN',

      // From Google Ads Script
      spend7d: Math.round(spendEur * 100) / 100,
      clicks: sc.clicks || 0,
      impressions: sc.impressions || 0,
      conversionsGoogle: sc.conversions || 0,
      ctr: sc.ctr || 0,
      cpc: sc.cpc || 0,
      googleCpa: sc.conversions > 0 ? Math.round((spendEur / sc.conversions) * 100) / 100 : 0,

      // From DB Attribution
      acquisitions: attr.acquisitions,
      firstRebills: attr.firstRebills,
      cohort21dSize: attr.cohort21dSize,
      cohort51dSize: attr.cohort51dSize,
      ltv21d: attr.ltv21d,
      ltv51d: attr.ltv51d,

      // Calculated
      cpfr: Math.round(cpfr * 100) / 100,
      payback21d: Math.round(payback21d * 100) / 100,
      payback51d: Math.round(payback51d * 100) / 100,
      campaignAgeDays,

      // Status
      payback51dStatus: status,
      recommendation,
    });
  }

  // Sort by spend descending
  campaigns.sort((a, b) => b.spend7d - a.spend7d);

  const result: CampaignPerformanceResult = {
    fetchedAt: new Date().toISOString(),
    dateRange,
    currency,
    totalCampaigns: campaigns.length,
    campaigns,
  };

  // Cache result
  campaignCache = { data: result, cachedAt: Date.now() };

  return result;
}

// ============================================================================
// ATTRIBUTION DATA
// ============================================================================

interface AttributionDataMap {
  [campaignId: string]: {
    acquisitions: number;
    firstRebills: number;
    cohort21dSize: number;
    cohort51dSize: number;
    ltv21d: number;
    ltv51d: number;
    firstAcquisitionDate: string | null;
  };
}

/**
 * Get attribution data from DB for given campaign IDs
 * Uses google_ads_details → customers → invoices chain
 */
async function getAttributionData(campaignIds: string[]): Promise<AttributionDataMap> {
  if (campaignIds.length === 0) return {};

  // Execute single query to get all attribution data
  // Note: This is a custom query, not going through the standard executeQuery
  // because we need to pass dynamic campaign IDs

  const result = await executeQuery("campaign-performance");

  if (result.status !== "success" || !result.results) {
    console.log("[CampaignAnalyzer] Failed to get attribution data:", result.error);
    return {};
  }

  const rows = result.results as any[];
  const dataMap: AttributionDataMap = {};

  for (const row of rows) {
    const campaignId = row.google_campaign_id;
    if (!campaignId) continue;

    dataMap[campaignId] = {
      acquisitions: row.total_acquisitions || 0,
      firstRebills: row.total_first_rebills || 0,
      cohort21dSize: row.cohort_21d_size || 0,
      cohort51dSize: row.cohort_51d_size || 0,
      ltv21d: parseFloat(row.ltv_21d) || 0,
      ltv51d: parseFloat(row.ltv_51d) || 0,
      firstAcquisitionDate: row.started_at || null,
    };
  }

  return dataMap;
}

// ============================================================================
// STATUS & RECOMMENDATIONS
// ============================================================================

function getPaybackStatusAndRecommendation(
  payback51d: number,
  campaignAgeDays: number,
  cohort51dSize: number
): { status: 'green' | 'yellow' | 'red'; recommendation: string } {
  // Not enough data yet
  if (campaignAgeDays < 51) {
    return {
      status: 'yellow',
      recommendation: `Monitorear (${51 - campaignAgeDays}d para datos completos)`,
    };
  }

  // Small cohort - not statistically significant
  if (cohort51dSize < 10) {
    return {
      status: 'yellow',
      recommendation: `Muestra pequeña (n=${cohort51dSize})`,
    };
  }

  // Decision based on Payback 51d
  if (payback51d >= 1.5) {
    return {
      status: 'green',
      recommendation: 'SCALE: Payback > 1.5x',
    };
  }

  if (payback51d >= 1.0) {
    return {
      status: 'yellow',
      recommendation: 'MANTENER: Break-even',
    };
  }

  if (payback51d >= 0.7) {
    return {
      status: 'yellow',
      recommendation: 'OPTIMIZAR: Payback bajo',
    };
  }

  return {
    status: 'red',
    recommendation: 'PAUSE: Payback < 0.7x',
  };
}

// ============================================================================
// SUMMARY FUNCTIONS
// ============================================================================

/**
 * Get campaigns that should be paused (Payback 51d < 0.7, age > 51d)
 */
export async function getCampaignsToPause(): Promise<CampaignMetrics[]> {
  const data = await getCampaignPerformance();
  if (!data) return [];

  return data.campaigns.filter(c =>
    c.campaignAgeDays >= 51 &&
    c.cohort51dSize >= 10 &&
    c.payback51d < 0.7 &&
    c.status === 'ENABLED'
  );
}

/**
 * Get campaigns ready to scale (Payback 51d >= 1.5, age > 51d)
 */
export async function getCampaignsToScale(): Promise<CampaignMetrics[]> {
  const data = await getCampaignPerformance();
  if (!data) return [];

  return data.campaigns.filter(c =>
    c.campaignAgeDays >= 51 &&
    c.cohort51dSize >= 10 &&
    c.payback51d >= 1.5 &&
    c.status === 'ENABLED'
  );
}

/**
 * Get young campaigns that need monitoring (age < 51d)
 */
export async function getCampaignsToMonitor(): Promise<CampaignMetrics[]> {
  const data = await getCampaignPerformance();
  if (!data) return [];

  return data.campaigns.filter(c =>
    c.campaignAgeDays < 51 &&
    c.status === 'ENABLED'
  );
}
