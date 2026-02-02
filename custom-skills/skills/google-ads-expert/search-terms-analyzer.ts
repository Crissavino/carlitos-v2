/**
 * Search Terms Analyzer - Phase 8B
 *
 * Analyzes search term data from Google Ads Scripts.
 * Focuses on:
 * - WASTE detection: queries spending without returns
 * - INTENT MISMATCH: queries that don't match service intent
 * - NEGATIVE CANDIDATES: queries to add as negatives
 *
 * IMPORTANT: This is Phase 8B - Search Terms (what people actually search).
 * Phase 8A covers Keywords (what we bid on).
 *
 * NO automatic actions - only recommendations.
 */

import { getSearchTermSpend, hasSearchTermData, type SearchTermSpendData } from "./ingest.js";
import { CurrencyConverter } from "../../core/currency.js";

// ============================================================================
// TYPES
// ============================================================================

export interface SearchTermPerformance {
  // Search term (actual user query)
  searchTerm: string;

  // Matched keyword
  keywordText: string;
  matchType: string;

  // Hierarchy
  campaignId: string;
  campaignName: string;
  adGroupId: string;
  adGroupName: string;

  // Metrics (from Google Ads Script)
  spend: number;          // EUR
  clicks: number;
  impressions: number;
  conversions: number;
  conversionValue: number;
  ctr: number;
  conversionRate: number;

  // Status
  performanceStatus: 'good' | 'warning' | 'poor';
  recommendation: SearchTermRecommendation | null;
}

export interface SearchTermPerformanceResult {
  fetchedAt: string;
  dateRange: string;
  currency: string;
  totalSearchTerms: number;
  totalSpend: number;
  searchTerms: SearchTermPerformance[];
}

// Waste Detection
export type SearchTermWasteFlag =
  | 'HIGH_SPEND_ZERO_CONV'     // Spend > threshold, conversions = 0
  | 'HIGH_SPEND_LOW_CONV'      // High spend, very low conversion rate
  | 'SPEND_CONCENTRATION'      // >50% of ad group spend without return
  | 'REPEAT_WASTE';            // Same query wasting across multiple campaigns

export type SearchTermRecommendation =
  | 'NEGATIVE_SUGGESTION'      // Add as negative keyword
  | 'INTENT_MISMATCH'          // Query doesn't match service intent
  | 'REVIEW_MATCH_TYPE'        // Consider changing keyword match type
  | 'MONITOR';                 // Keep watching

export interface SearchTermWasteAnalysis {
  searchTerm: SearchTermPerformance;
  wasteFlags: SearchTermWasteFlag[];
  wastedSpend: number;
  recommendation: SearchTermRecommendation;
  rationale: string;
}

// ============================================================================
// CACHE
// ============================================================================

interface SearchTermCacheEntry {
  data: SearchTermPerformanceResult;
  cachedAt: number;
}

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
let searchTermCache: SearchTermCacheEntry | null = null;

export function clearSearchTermCache(): void {
  searchTermCache = null;
  console.log("[SearchTermsAnalyzer] Cache cleared");
}

// ============================================================================
// THRESHOLDS
// ============================================================================

const THRESHOLDS = {
  HIGH_SPEND_MIN_EUR: 30,           // Lower threshold for search terms
  LOW_CONV_RATE: 0.01,              // Below 1% conversion rate
  SPEND_CONCENTRATION_PCT: 0.5,     // 50% of ad group spend
  TOP_SEARCH_TERMS_LIMIT: 50,       // Default limit for top search terms
};

// Intent mismatch keywords (queries containing these are likely not our target)
const INTENT_MISMATCH_PATTERNS = [
  'gratis', 'free', 'gratuito',
  'ejemplo', 'example', 'sample',
  'plantilla', 'template',
  'como', 'how to', 'tutorial',
  'que es', 'what is',
  'descargar', 'download',
];

// ============================================================================
// MAIN FUNCTIONS
// ============================================================================

/**
 * Get all search terms with performance metrics
 * @param campaignId - Optional campaign ID to filter results at SQL level
 */
export async function getSearchTermPerformance(campaignId?: string): Promise<SearchTermPerformanceResult | null> {
  // Check cache (only use cache for non-filtered queries to avoid stale data)
  if (!campaignId && searchTermCache && Date.now() - searchTermCache.cachedAt < CACHE_TTL_MS) {
    console.log("[SearchTermsAnalyzer] Cache hit");
    return searchTermCache.data;
  }

  console.log(`[SearchTermsAnalyzer] Cache miss - fetching data...${campaignId ? ` (campaign: ${campaignId})` : ''}`);

  // Get search term data from database (7d window), optionally filtered by campaign
  const spendData = await getSearchTermSpend('7d', campaignId);

  if (spendData.length === 0) {
    const hasData = await hasSearchTermData();
    if (!hasData) {
      console.log("[SearchTermsAnalyzer] No Google Ads Script search term data in database");
      return null;
    }
    console.log("[SearchTermsAnalyzer] No recent search term data found");
    return null;
  }

  console.log(`[SearchTermsAnalyzer] Found ${spendData.length} search terms from Google Ads Script`);

  // Determine currency from first search term
  // HARDENING: No silent fallback - fail if currency missing
  const currency = spendData[0]?.currency;
  if (!currency) {
    console.error("[SearchTermsAnalyzer] CRITICAL: First search term has no currency. Data integrity issue.");
    throw new Error("Search term data missing currency - cannot process without currency information");
  }
  const dateRange = spendData[0]?.dateRange || '7d';

  // Transform to performance data
  const searchTerms: SearchTermPerformance[] = [];
  let totalSpend = 0;

  for (const st of spendData) {
    // Use search term's own currency, not global (fixes mixed EUR/RON accounts)
    // HARDENING: No silent fallback - skip search term if currency missing
    if (!st.currency) {
      console.error(`[SearchTermsAnalyzer] Search term "${st.searchTerm}" missing currency - skipping`);
      continue;
    }
    const stCurrency = st.currency;
    const spendEur = CurrencyConverter.toEur(st.cost, stCurrency);
    totalSpend += spendEur;

    const { status, recommendation } = getSearchTermStatusAndRecommendation(
      st.searchTerm,
      spendEur,
      st.conversions,
      st.conversionRate
    );

    searchTerms.push({
      searchTerm: st.searchTerm,
      keywordText: st.keywordText,
      matchType: st.matchType,
      campaignId: st.campaignId,
      campaignName: st.campaignName,
      adGroupId: st.adGroupId,
      adGroupName: st.adGroupName,
      spend: Math.round(spendEur * 100) / 100,
      clicks: st.clicks,
      impressions: st.impressions,
      conversions: st.conversions,
      conversionValue: st.conversionValue,
      ctr: st.ctr,
      conversionRate: st.conversionRate,
      performanceStatus: status,
      recommendation,
    });
  }

  // Sort by spend descending
  searchTerms.sort((a, b) => b.spend - a.spend);

  const result: SearchTermPerformanceResult = {
    fetchedAt: new Date().toISOString(),
    dateRange: `LAST_${dateRange.toUpperCase()}`,
    currency,
    totalSearchTerms: searchTerms.length,
    totalSpend: Math.round(totalSpend * 100) / 100,
    searchTerms,
  };

  // Cache result (only cache non-filtered queries)
  if (!campaignId) {
    searchTermCache = { data: result, cachedAt: Date.now() };
  }

  return result;
}

/**
 * Get top search terms by spend
 */
export async function getTopSearchTerms(limit: number = THRESHOLDS.TOP_SEARCH_TERMS_LIMIT): Promise<SearchTermPerformance[]> {
  const data = await getSearchTermPerformance();
  if (!data) return [];

  return data.searchTerms.slice(0, limit);
}

/**
 * Get search terms for a specific campaign
 */
export async function getSearchTermsByCampaign(campaignId: string): Promise<SearchTermPerformance[]> {
  const data = await getSearchTermPerformance();
  if (!data) return [];

  return data.searchTerms.filter(st => st.campaignId === campaignId);
}

/**
 * Get search terms for a specific keyword
 */
export async function getSearchTermsByKeyword(keywordText: string): Promise<SearchTermPerformance[]> {
  const data = await getSearchTermPerformance();
  if (!data) return [];

  return data.searchTerms.filter(st => st.keywordText === keywordText);
}

/**
 * WASTE Detection - Search terms wasting budget
 */
export async function getWasteSearchTerms(): Promise<SearchTermWasteAnalysis[]> {
  const data = await getSearchTermPerformance();
  if (!data) return [];

  // Calculate ad group spend totals for concentration analysis
  const adGroupSpend: Record<string, number> = {};
  for (const st of data.searchTerms) {
    const key = st.adGroupId;
    adGroupSpend[key] = (adGroupSpend[key] || 0) + st.spend;
  }

  // Track search terms that appear across multiple campaigns (for REPEAT_WASTE)
  const searchTermCampaigns: Record<string, { campaigns: Set<string>; totalSpend: number; conversions: number }> = {};
  for (const st of data.searchTerms) {
    if (!searchTermCampaigns[st.searchTerm]) {
      searchTermCampaigns[st.searchTerm] = { campaigns: new Set(), totalSpend: 0, conversions: 0 };
    }
    searchTermCampaigns[st.searchTerm].campaigns.add(st.campaignId);
    searchTermCampaigns[st.searchTerm].totalSpend += st.spend;
    searchTermCampaigns[st.searchTerm].conversions += st.conversions;
  }

  const wasteAnalysis: SearchTermWasteAnalysis[] = [];

  for (const st of data.searchTerms) {
    const wasteFlags: SearchTermWasteFlag[] = [];
    let wastedSpend = 0;
    let rationale = '';

    // Check: HIGH_SPEND_ZERO_CONV
    if (st.spend >= THRESHOLDS.HIGH_SPEND_MIN_EUR && st.conversions === 0) {
      wasteFlags.push('HIGH_SPEND_ZERO_CONV');
      wastedSpend = st.spend;
      rationale = `Spend ${st.spend.toFixed(2)} with zero conversions`;
    }

    // Check: HIGH_SPEND_LOW_CONV
    if (st.spend >= THRESHOLDS.HIGH_SPEND_MIN_EUR &&
        st.conversions > 0 &&
        st.conversionRate < THRESHOLDS.LOW_CONV_RATE) {
      wasteFlags.push('HIGH_SPEND_LOW_CONV');
      const expectedConversions = st.clicks * THRESHOLDS.LOW_CONV_RATE;
      const wasteRatio = Math.max(0, 1 - (st.conversions / expectedConversions));
      wastedSpend = Math.max(wastedSpend, st.spend * wasteRatio);
      rationale = `Conv rate ${(st.conversionRate * 100).toFixed(2)}% below ${(THRESHOLDS.LOW_CONV_RATE * 100)}% threshold`;
    }

    // Check: SPEND_CONCENTRATION
    const adGroupTotal = adGroupSpend[st.adGroupId] || 0;
    const spendPct = adGroupTotal > 0 ? st.spend / adGroupTotal : 0;
    if (spendPct >= THRESHOLDS.SPEND_CONCENTRATION_PCT && st.conversions === 0) {
      wasteFlags.push('SPEND_CONCENTRATION');
      rationale = `${(spendPct * 100).toFixed(0)}% of ad group spend without conversions`;
    }

    // Check: REPEAT_WASTE (same query wasting across multiple campaigns)
    const termData = searchTermCampaigns[st.searchTerm];
    if (termData.campaigns.size > 1 && termData.conversions === 0 && termData.totalSpend >= THRESHOLDS.HIGH_SPEND_MIN_EUR) {
      wasteFlags.push('REPEAT_WASTE');
      rationale = `Wasting across ${termData.campaigns.size} campaigns with zero total conversions`;
    }

    // Only include if there are waste flags
    if (wasteFlags.length > 0) {
      const recommendation = determineRecommendation(st, wasteFlags);
      wasteAnalysis.push({
        searchTerm: st,
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
 * Get summary statistics for search terms
 */
export async function getSearchTermsSummary(): Promise<{
  totalSearchTerms: number;
  totalSpend: number;
  searchTermsWithConversions: number;
  searchTermsWithZeroConversions: number;
  wasteSearchTermsCount: number;
  estimatedWaste: number;
  intentMismatchCount: number;
} | null> {
  const data = await getSearchTermPerformance();
  if (!data) return null;

  const waste = await getWasteSearchTerms();

  let searchTermsWithConversions = 0;
  let searchTermsWithZeroConversions = 0;
  let intentMismatchCount = 0;

  for (const st of data.searchTerms) {
    if (st.conversions > 0) {
      searchTermsWithConversions++;
    } else {
      searchTermsWithZeroConversions++;
    }

    // Check for intent mismatch
    const lowerTerm = st.searchTerm.toLowerCase();
    if (INTENT_MISMATCH_PATTERNS.some(pattern => lowerTerm.includes(pattern))) {
      intentMismatchCount++;
    }
  }

  return {
    totalSearchTerms: data.totalSearchTerms,
    totalSpend: data.totalSpend,
    searchTermsWithConversions,
    searchTermsWithZeroConversions,
    wasteSearchTermsCount: waste.length,
    estimatedWaste: waste.reduce((sum, w) => sum + w.wastedSpend, 0),
    intentMismatchCount,
  };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function getSearchTermStatusAndRecommendation(
  searchTerm: string,
  spendEur: number,
  conversions: number,
  conversionRate: number
): { status: 'good' | 'warning' | 'poor'; recommendation: SearchTermRecommendation | null } {
  // Check for intent mismatch first
  const lowerTerm = searchTerm.toLowerCase();
  if (INTENT_MISMATCH_PATTERNS.some(pattern => lowerTerm.includes(pattern))) {
    if (spendEur > 0 && conversions === 0) {
      return { status: 'poor', recommendation: 'INTENT_MISMATCH' };
    }
    return { status: 'warning', recommendation: 'INTENT_MISMATCH' };
  }

  // No spend = no assessment
  if (spendEur === 0) {
    return { status: 'warning', recommendation: 'MONITOR' };
  }

  // High spend, zero conversions = poor
  if (spendEur >= THRESHOLDS.HIGH_SPEND_MIN_EUR && conversions === 0) {
    return { status: 'poor', recommendation: 'NEGATIVE_SUGGESTION' };
  }

  // Has conversions
  if (conversions > 0) {
    if (conversionRate >= THRESHOLDS.LOW_CONV_RATE) {
      return { status: 'good', recommendation: null };
    }
    return { status: 'warning', recommendation: 'REVIEW_MATCH_TYPE' };
  }

  // Low conversion rate
  if (conversionRate < THRESHOLDS.LOW_CONV_RATE && spendEur > THRESHOLDS.HIGH_SPEND_MIN_EUR / 2) {
    return { status: 'poor', recommendation: 'NEGATIVE_SUGGESTION' };
  }

  // Default: monitor
  return { status: 'warning', recommendation: 'MONITOR' };
}

function determineRecommendation(st: SearchTermPerformance, flags: SearchTermWasteFlag[]): SearchTermRecommendation {
  // Check for intent mismatch first
  const lowerTerm = st.searchTerm.toLowerCase();
  if (INTENT_MISMATCH_PATTERNS.some(pattern => lowerTerm.includes(pattern))) {
    return 'INTENT_MISMATCH';
  }

  // Repeat waste across campaigns -> definitely a negative candidate
  if (flags.includes('REPEAT_WASTE')) {
    return 'NEGATIVE_SUGGESTION';
  }

  // Zero conversions with high spend -> suggest negative
  if (flags.includes('HIGH_SPEND_ZERO_CONV')) {
    return 'NEGATIVE_SUGGESTION';
  }

  // Low conversion rate with BROAD match -> review match type
  if (flags.includes('HIGH_SPEND_LOW_CONV') && st.matchType === 'BROAD') {
    return 'REVIEW_MATCH_TYPE';
  }

  // Spend concentration -> negative
  if (flags.includes('SPEND_CONCENTRATION')) {
    return 'NEGATIVE_SUGGESTION';
  }

  return 'MONITOR';
}
