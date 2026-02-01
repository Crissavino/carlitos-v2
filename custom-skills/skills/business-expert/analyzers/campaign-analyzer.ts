/**
 * Campaign Analyzer - Phase 7
 *
 * Combina datos de Google Ads Script (DB) con datos de atribución (DB).
 *
 * FUENTES DE DATOS (arquitectura definitiva):
 * - google_ads_campaign_metrics: spend, clicks, impressions, conversions
 *   → FUENTE DE VERDAD para COSTO (viene de Google Ads Scripts)
 * - google_ads_details → invoices: acquisitions, revenue, LTV
 *   → FUENTE DE VERDAD para ATRIBUCIÓN y REVENUE
 *
 * JOIN KEY: campaignId (script) = utm_campaign (google_ads_details)
 */

import { getCampaignSpend, hasCampaignData, type CampaignSpendData } from "../../google-ads-expert/ingest.js";
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

  // From Google Ads Script (SOURCE OF TRUTH for cost)
  spend7d: number;          // EUR
  clicks: number;
  impressions: number;
  conversionsGoogle: number; // Conversions reportadas por Google
  ctr: number;
  cpc: number;
  googleCpa: number;         // CPA de Google (spend / conversions)

  // From DB Attribution (SOURCE OF TRUTH for revenue)
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
  dataSource: {
    spend: 'google-ads-script';
    attribution: 'database';
  };
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
 * Get enriched campaign metrics combining Google Ads Script data with DB attribution
 */
export async function getCampaignPerformance(): Promise<CampaignPerformanceResult | null> {
  // Check cache
  if (campaignCache && Date.now() - campaignCache.cachedAt < CACHE_TTL_MS) {
    console.log("[CampaignAnalyzer] Cache hit");
    return campaignCache.data;
  }

  console.log("[CampaignAnalyzer] Cache miss - fetching data...");

  // 1. Get campaign COST data from google_ads_campaign_metrics (7d window)
  const spendData = await getCampaignSpend('7d');

  if (spendData.length === 0) {
    // Check if we have any data at all
    const hasData = await hasCampaignData();
    if (!hasData) {
      console.log("[CampaignAnalyzer] No Google Ads Script data in database");
      console.log("[CampaignAnalyzer] Ensure the script is sending data to /ingest/google-ads");
      return null;
    }
    console.log("[CampaignAnalyzer] No recent campaign data found");
    return null;
  }

  console.log(`[CampaignAnalyzer] Found ${spendData.length} campaigns from Google Ads Script`);

  // 2. Get ATTRIBUTION data from DB for all campaigns
  const attributionData = await getAttributionData();

  // 3. Determine currency from first campaign (should all be same)
  const currency = spendData[0]?.currency || 'EUR';
  const dateRange = spendData[0]?.dateRange || '7d';

  // 4. Combine both sources
  const campaigns: CampaignMetrics[] = [];

  for (const sc of spendData) {
    const campaignId = String(sc.campaignId || '');
    if (!campaignId) continue;

    // Look up attribution by campaignId
    const attr = attributionData[campaignId] || {
      acquisitions: 0,
      firstRebills: 0,
      cohort21dSize: 0,
      cohort51dSize: 0,
      ltv21d: 0,
      ltv51d: 0,
      campaignAgeDays: 0,
    };

    // Convert spend to EUR if needed
    const spendEur = CurrencyConverter.toEur(sc.cost, currency);

    // Calculate CPFR (spend / first rebills)
    const cpfr = attr.firstRebills > 0 ? spendEur / attr.firstRebills : 0;

    // Calculate Payback ratios
    const payback21d = cpfr > 0 ? attr.ltv21d / cpfr : 0;
    const payback51d = cpfr > 0 ? attr.ltv51d / cpfr : 0;

    // Determine status and recommendation
    const { status, recommendation } = getPaybackStatusAndRecommendation(
      payback51d,
      attr.campaignAgeDays,
      attr.cohort51dSize
    );

    campaigns.push({
      campaignId,
      campaignName: sc.campaignName || 'Unknown',
      status: sc.campaignStatus || 'UNKNOWN',

      // From Google Ads Script (cost metrics)
      spend7d: Math.round(spendEur * 100) / 100,
      clicks: sc.clicks || 0,
      impressions: sc.impressions || 0,
      conversionsGoogle: sc.conversions || 0,
      ctr: sc.ctr || 0,
      cpc: sc.cpc ? CurrencyConverter.toEur(sc.cpc, currency) : 0,
      googleCpa: sc.conversions > 0 ? Math.round((spendEur / sc.conversions) * 100) / 100 : 0,

      // From DB Attribution (revenue metrics)
      acquisitions: attr.acquisitions,
      firstRebills: attr.firstRebills,
      cohort21dSize: attr.cohort21dSize,
      cohort51dSize: attr.cohort51dSize,
      ltv21d: attr.ltv21d,
      ltv51d: attr.ltv51d,

      // Calculated (crossing both worlds)
      cpfr: Math.round(cpfr * 100) / 100,
      payback21d: Math.round(payback21d * 100) / 100,
      payback51d: Math.round(payback51d * 100) / 100,
      campaignAgeDays: attr.campaignAgeDays,

      // Status
      payback51dStatus: status,
      recommendation,
    });
  }

  // Sort by spend descending
  campaigns.sort((a, b) => b.spend7d - a.spend7d);

  const result: CampaignPerformanceResult = {
    fetchedAt: new Date().toISOString(),
    dateRange: `LAST_${dateRange.toUpperCase()}`,
    currency,
    totalCampaigns: campaigns.length,
    campaigns,
    dataSource: {
      spend: 'google-ads-script',
      attribution: 'database',
    },
  };

  // Cache result
  campaignCache = { data: result, cachedAt: Date.now() };

  return result;
}

// ============================================================================
// ATTRIBUTION DATA (from DB)
// ============================================================================

interface AttributionDataMap {
  [campaignId: string]: {
    acquisitions: number;
    firstRebills: number;
    cohort21dSize: number;
    cohort51dSize: number;
    ltv21d: number;
    ltv51d: number;
    campaignAgeDays: number;
  };
}

/**
 * Get attribution data from DB for all campaigns
 * Uses google_ads_details → customers → invoices chain
 */
async function getAttributionData(): Promise<AttributionDataMap> {
  // Execute the campaign-performance query to get attribution data
  const result = await executeQuery("campaign-performance");

  if (result.status !== "success" || !result.results) {
    console.log("[CampaignAnalyzer] Failed to get attribution data from DB:", result.error);
    return {};
  }

  const rows = result.results as any[];
  const dataMap: AttributionDataMap = {};

  for (const row of rows) {
    const campaignId = String(row.google_campaign_id || '');
    if (!campaignId) continue;

    dataMap[campaignId] = {
      acquisitions: parseInt(row.total_acquisitions) || 0,
      firstRebills: parseInt(row.total_first_rebills) || 0,
      cohort21dSize: parseInt(row.cohort_21d_size) || 0,
      cohort51dSize: parseInt(row.cohort_51d_size) || 0,
      ltv21d: parseFloat(row.ltv_21d) || 0,
      ltv51d: parseFloat(row.ltv_51d) || 0,
      campaignAgeDays: parseInt(row.campaign_age_days) || 0,
    };
  }

  console.log(`[CampaignAnalyzer] Loaded attribution data for ${Object.keys(dataMap).length} campaigns from DB`);

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
      recommendation: `Monitorear (${Math.max(0, 51 - campaignAgeDays)}d para datos completos)`,
    };
  }

  // Small cohort - not statistically significant
  if (cohort51dSize < 10) {
    return {
      status: 'yellow',
      recommendation: `Muestra pequeña (n=${cohort51dSize})`,
    };
  }

  // No payback (no CPFR or no LTV)
  if (payback51d === 0) {
    return {
      status: 'yellow',
      recommendation: 'Sin datos de Payback',
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
    c.payback51d > 0 &&
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
