/**
 * Keywords Analyzer - Phase 8A
 *
 * Analyzes keyword performance data from Google Ads Scripts.
 * Focuses on WASTE detection: keywords spending money without returns.
 *
 * IMPORTANT: This is Phase 8A - Keywords (what we bid on).
 * Phase 8B will cover Search Terms (what people actually search).
 *
 * NO automatic actions - only recommendations.
 */

import { getKeywordSpend, hasKeywordData, type KeywordSpendData } from "./ingest.js";
import { CurrencyConverter } from "../../core/currency.js";

// ============================================================================
// TYPES
// ============================================================================

export interface KeywordPerformance {
  // Identifiers
  keywordId: string;
  keywordText: string;
  matchType: string;
  campaignId: string;
  campaignName: string;
  adGroupId: string;
  adGroupName: string;

  // Metrics (from Google Ads Script)
  spend7d: number;          // EUR
  clicks: number;
  impressions: number;
  conversions: number;      // Google-reported
  conversionValue: number;
  ctr: number;
  cpc: number;
  conversionRate: number;

  // Status
  performanceStatus: 'good' | 'warning' | 'poor';
  recommendation: KeywordRecommendation | null;
}

export interface KeywordPerformanceResult {
  fetchedAt: string;
  dateRange: string;
  currency: string;
  totalKeywords: number;
  totalSpend: number;
  keywords: KeywordPerformance[];
}

// Waste Detection
export type WasteFlag =
  | 'HIGH_SPEND_ZERO_CONV'     // Spend > threshold, conversions = 0
  | 'HIGH_SPEND_LOW_CONV'      // High spend, very low conversion rate
  | 'SPEND_CONCENTRATION';     // >50% of ad group spend without return

export type KeywordRecommendation =
  | 'NEGATIVE_SUGGESTION'      // Consider adding as negative
  | 'INTENT_MISMATCH'          // Keyword doesn't match intent
  | 'SCALE_KEYWORD'            // Increase bids (suggested)
  | 'MATCH_TYPE_FIX'           // Change match type
  | 'REVIEW_BID'               // Review and adjust bid
  | 'MONITOR';                 // Keep watching

export interface KeywordWasteAnalysis {
  keyword: KeywordPerformance;
  wasteFlags: WasteFlag[];
  wastedSpend: number;
  recommendation: KeywordRecommendation;
  rationale: string;
}

// ============================================================================
// CACHE
// ============================================================================

interface KeywordCacheEntry {
  data: KeywordPerformanceResult;
  cachedAt: number;
}

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
let keywordCache: KeywordCacheEntry | null = null;

export function clearKeywordCache(): void {
  keywordCache = null;
  console.log("[KeywordsAnalyzer] Cache cleared");
}

// ============================================================================
// THRESHOLDS
// ============================================================================

// Waste detection thresholds (configurable)
const THRESHOLDS = {
  HIGH_SPEND_MIN_EUR: 50,           // Minimum spend to be considered "high"
  LOW_CONV_RATE: 0.01,              // Below 1% conversion rate
  SPEND_CONCENTRATION_PCT: 0.5,     // 50% of ad group spend
  TOP_KEYWORDS_LIMIT: 20,           // Default limit for top keywords
  SCALE_CONV_RATE_MIN: 0.05,        // Min 5% conv rate to suggest scaling
  SCALE_ROAS_MIN: 2.0,              // Min 2x ROAS to suggest scaling
};

// ============================================================================
// MAIN FUNCTIONS
// ============================================================================

/**
 * Get all keywords with performance metrics
 * @param campaignId - Optional campaign ID to filter results at SQL level
 */
export async function getKeywordPerformance(campaignId?: string): Promise<KeywordPerformanceResult | null> {
  // Cache key includes campaignId for filtered queries
  const cacheKey = campaignId ? `campaign:${campaignId}` : 'all';

  // Check cache (only use cache for non-filtered queries to avoid stale data)
  if (!campaignId && keywordCache && Date.now() - keywordCache.cachedAt < CACHE_TTL_MS) {
    console.log("[KeywordsAnalyzer] Cache hit");
    return keywordCache.data;
  }

  console.log(`[KeywordsAnalyzer] Cache miss - fetching data...${campaignId ? ` (campaign: ${campaignId})` : ''}`);

  // Get keyword data from database (7d window), optionally filtered by campaign
  const spendData = await getKeywordSpend('7d', campaignId);

  if (spendData.length === 0) {
    const hasData = await hasKeywordData();
    if (!hasData) {
      console.log("[KeywordsAnalyzer] No Google Ads Script keyword data in database");
      return null;
    }
    console.log("[KeywordsAnalyzer] No recent keyword data found");
    return null;
  }

  console.log(`[KeywordsAnalyzer] Found ${spendData.length} keywords from Google Ads Script`);

  // Determine currency from first keyword
  // HARDENING: No silent fallback - fail if currency missing
  const currency = spendData[0]?.currency;
  if (!currency) {
    console.error("[KeywordsAnalyzer] CRITICAL: First keyword has no currency. Data integrity issue.");
    throw new Error("Keyword data missing currency - cannot process without currency information");
  }
  const dateRange = spendData[0]?.dateRange || '7d';

  // Transform to performance data
  const keywords: KeywordPerformance[] = [];
  let totalSpend = 0;

  for (const kw of spendData) {
    // Use keyword's own currency, not global (fixes mixed EUR/RON accounts)
    // HARDENING: No silent fallback - skip keyword if currency missing
    if (!kw.currency) {
      console.error(`[KeywordsAnalyzer] Keyword ${kw.keywordId} missing currency - skipping`);
      continue;
    }
    const kwCurrency = kw.currency;
    const spendEur = CurrencyConverter.toEur(kw.cost, kwCurrency);
    totalSpend += spendEur;

    const { status, recommendation } = getKeywordStatusAndRecommendation(
      spendEur,
      kw.conversions,
      kw.conversionRate,
      kw.conversionValue
    );

    keywords.push({
      keywordId: kw.keywordId,
      keywordText: kw.keywordText,
      matchType: kw.matchType,
      campaignId: kw.campaignId,
      campaignName: kw.campaignName,
      adGroupId: kw.adGroupId,
      adGroupName: kw.adGroupName,
      spend7d: Math.round(spendEur * 100) / 100,
      clicks: kw.clicks,
      impressions: kw.impressions,
      conversions: kw.conversions,
      conversionValue: kw.conversionValue,
      ctr: kw.ctr,
      cpc: kw.cpc ? CurrencyConverter.toEur(kw.cpc, kwCurrency) : 0,
      conversionRate: kw.conversionRate,
      performanceStatus: status,
      recommendation,
    });
  }

  // Sort by spend descending
  keywords.sort((a, b) => b.spend7d - a.spend7d);

  const result: KeywordPerformanceResult = {
    fetchedAt: new Date().toISOString(),
    dateRange: `LAST_${dateRange.toUpperCase()}`,
    currency,
    totalKeywords: keywords.length,
    totalSpend: Math.round(totalSpend * 100) / 100,
    keywords,
  };

  // Cache result (only cache non-filtered queries)
  if (!campaignId) {
    keywordCache = { data: result, cachedAt: Date.now() };
  }

  return result;
}

/**
 * Get top keywords by spend
 */
export async function getTopKeywords(limit: number = THRESHOLDS.TOP_KEYWORDS_LIMIT): Promise<KeywordPerformance[]> {
  const data = await getKeywordPerformance();
  if (!data) return [];

  return data.keywords.slice(0, limit);
}

/**
 * Get keywords for a specific campaign
 */
export async function getKeywordsByCampaign(campaignId: string): Promise<KeywordPerformance[]> {
  const data = await getKeywordPerformance();
  if (!data) return [];

  return data.keywords.filter(k => k.campaignId === campaignId);
}

/**
 * Get underperforming keywords (high spend, low/no conversions)
 */
export async function getUnderperformingKeywords(): Promise<KeywordPerformance[]> {
  const data = await getKeywordPerformance();
  if (!data) return [];

  return data.keywords.filter(k =>
    k.performanceStatus === 'poor' ||
    (k.spend7d > THRESHOLDS.HIGH_SPEND_MIN_EUR && k.conversions === 0)
  );
}

/**
 * WASTE Detection - Keywords wasting budget
 * Analyzes keywords for waste patterns and provides recommendations
 */
export async function getWasteKeywords(): Promise<KeywordWasteAnalysis[]> {
  const data = await getKeywordPerformance();
  if (!data) return [];

  // Calculate ad group spend totals for concentration analysis
  const adGroupSpend: Record<string, number> = {};
  for (const kw of data.keywords) {
    const key = kw.adGroupId;
    adGroupSpend[key] = (adGroupSpend[key] || 0) + kw.spend7d;
  }

  const wasteAnalysis: KeywordWasteAnalysis[] = [];

  for (const kw of data.keywords) {
    const wasteFlags: WasteFlag[] = [];
    let wastedSpend = 0;
    let rationale = '';

    // Check: HIGH_SPEND_ZERO_CONV
    if (kw.spend7d >= THRESHOLDS.HIGH_SPEND_MIN_EUR && kw.conversions === 0) {
      wasteFlags.push('HIGH_SPEND_ZERO_CONV');
      wastedSpend = kw.spend7d;
      rationale = `Spend ${kw.spend7d.toFixed(2)} with zero conversions`;
    }

    // Check: HIGH_SPEND_LOW_CONV
    if (kw.spend7d >= THRESHOLDS.HIGH_SPEND_MIN_EUR &&
        kw.conversions > 0 &&
        kw.conversionRate < THRESHOLDS.LOW_CONV_RATE) {
      wasteFlags.push('HIGH_SPEND_LOW_CONV');
      // Estimate wasted spend based on expected conversion rate
      const expectedConversions = kw.clicks * THRESHOLDS.LOW_CONV_RATE;
      const actualConversions = kw.conversions;
      const wasteRatio = Math.max(0, 1 - (actualConversions / expectedConversions));
      wastedSpend = Math.max(wastedSpend, kw.spend7d * wasteRatio);
      rationale = `Conv rate ${(kw.conversionRate * 100).toFixed(2)}% below ${(THRESHOLDS.LOW_CONV_RATE * 100)}% threshold`;
    }

    // Check: SPEND_CONCENTRATION
    const adGroupTotal = adGroupSpend[kw.adGroupId] || 0;
    const spendPct = adGroupTotal > 0 ? kw.spend7d / adGroupTotal : 0;
    if (spendPct >= THRESHOLDS.SPEND_CONCENTRATION_PCT && kw.conversions === 0) {
      wasteFlags.push('SPEND_CONCENTRATION');
      rationale = `${(spendPct * 100).toFixed(0)}% of ad group spend without conversions`;
    }

    // Only include if there are waste flags
    if (wasteFlags.length > 0) {
      const recommendation = determineRecommendation(kw, wasteFlags);
      wasteAnalysis.push({
        keyword: kw,
        wasteFlags,
        wastedSpend: Math.round(wastedSpend * 100) / 100,
        recommendation,
        rationale,
      });
    }
  }

  // Sort by wasted spend descending
  wasteAnalysis.sort((a, b) => b.wastedSpend - a.wastedSpend);

  return wasteAnalysis;
}

/**
 * Get keywords that are performing well and could be scaled
 */
export async function getKeywordsToScale(): Promise<KeywordPerformance[]> {
  const data = await getKeywordPerformance();
  if (!data) return [];

  return data.keywords.filter(k =>
    k.conversions > 0 &&
    k.conversionRate >= THRESHOLDS.SCALE_CONV_RATE_MIN &&
    (k.conversionValue / k.spend7d) >= THRESHOLDS.SCALE_ROAS_MIN
  );
}

/**
 * Get summary statistics for keywords
 */
export async function getKeywordsSummary(): Promise<{
  totalKeywords: number;
  totalSpend: number;
  keywordsWithConversions: number;
  keywordsWithZeroConversions: number;
  wasteKeywordsCount: number;
  estimatedWaste: number;
  byMatchType: Record<string, { count: number; spend: number; conversions: number }>;
} | null> {
  const data = await getKeywordPerformance();
  if (!data) return null;

  const waste = await getWasteKeywords();

  const byMatchType: Record<string, { count: number; spend: number; conversions: number }> = {};

  let keywordsWithConversions = 0;
  let keywordsWithZeroConversions = 0;

  for (const kw of data.keywords) {
    // Count conversions
    if (kw.conversions > 0) {
      keywordsWithConversions++;
    } else {
      keywordsWithZeroConversions++;
    }

    // Aggregate by match type
    if (!byMatchType[kw.matchType]) {
      byMatchType[kw.matchType] = { count: 0, spend: 0, conversions: 0 };
    }
    byMatchType[kw.matchType].count++;
    byMatchType[kw.matchType].spend += kw.spend7d;
    byMatchType[kw.matchType].conversions += kw.conversions;
  }

  return {
    totalKeywords: data.totalKeywords,
    totalSpend: data.totalSpend,
    keywordsWithConversions,
    keywordsWithZeroConversions,
    wasteKeywordsCount: waste.length,
    estimatedWaste: waste.reduce((sum, w) => sum + w.wastedSpend, 0),
    byMatchType,
  };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function getKeywordStatusAndRecommendation(
  spendEur: number,
  conversions: number,
  conversionRate: number,
  conversionValue: number
): { status: 'good' | 'warning' | 'poor'; recommendation: KeywordRecommendation | null } {
  // No spend = no assessment
  if (spendEur === 0) {
    return { status: 'warning', recommendation: 'MONITOR' };
  }

  // High spend, zero conversions = poor
  if (spendEur >= THRESHOLDS.HIGH_SPEND_MIN_EUR && conversions === 0) {
    return { status: 'poor', recommendation: 'NEGATIVE_SUGGESTION' };
  }

  // Has conversions with good ROAS
  if (conversions > 0 && conversionValue > 0) {
    const roas = conversionValue / spendEur;
    if (roas >= THRESHOLDS.SCALE_ROAS_MIN) {
      return { status: 'good', recommendation: 'SCALE_KEYWORD' };
    }
    if (roas >= 1.0) {
      return { status: 'warning', recommendation: 'REVIEW_BID' };
    }
  }

  // Low conversion rate
  if (conversionRate < THRESHOLDS.LOW_CONV_RATE && spendEur > THRESHOLDS.HIGH_SPEND_MIN_EUR / 2) {
    return { status: 'poor', recommendation: 'REVIEW_BID' };
  }

  // Default: monitor
  return { status: 'warning', recommendation: 'MONITOR' };
}

function determineRecommendation(kw: KeywordPerformance, flags: WasteFlag[]): KeywordRecommendation {
  // Zero conversions with high spend -> suggest negative
  if (flags.includes('HIGH_SPEND_ZERO_CONV')) {
    // BROAD match with zero conversions -> likely intent mismatch
    if (kw.matchType === 'BROAD') {
      return 'INTENT_MISMATCH';
    }
    return 'NEGATIVE_SUGGESTION';
  }

  // Low conversion rate -> review bid or match type
  if (flags.includes('HIGH_SPEND_LOW_CONV')) {
    if (kw.matchType === 'BROAD') {
      return 'MATCH_TYPE_FIX';
    }
    return 'REVIEW_BID';
  }

  // Spend concentration -> review or negative
  if (flags.includes('SPEND_CONCENTRATION')) {
    return 'NEGATIVE_SUGGESTION';
  }

  return 'MONITOR';
}
