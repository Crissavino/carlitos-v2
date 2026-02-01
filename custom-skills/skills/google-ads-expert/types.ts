/**
 * GoogleAdsExpert - Unified Schema (Stable)
 * 
 * Este schema es independiente del datasource (AdsScript o API).
 * NO MODIFICAR sin considerar backward compatibility.
 */

// ============================================================================
// Campaign Status
// ============================================================================

/**
 * Estado de campaña unificado.
 * 
 * Notas por datasource:
 * - AdsScriptSource: Solo emite 'ENABLED' | 'PAUSED' (limitación de Google Ads Scripts)
 * - GoogleApiSource: Puede emitir 'REMOVED' también (futuro)
 */
export type CampaignStatus = 'ENABLED' | 'PAUSED' | 'REMOVED';

export type DateRangeType = 'LAST_7_DAYS' | 'LAST_30_DAYS' | 'TODAY' | 'YESTERDAY';

export type DataSourceType = 'ads-script' | 'google-api';

// ============================================================================
// Campaign Metrics
// ============================================================================

export interface CampaignMetrics {
  campaignId: string;
  campaignName: string;
  status: CampaignStatus;
  
  // Métricas primarias (fuente de verdad)
  cost: number;              // En currency real (NO micros)
  clicks: number;
  impressions: number;
  conversions: number;
  conversionValue: number;
  
  /**
   * Métricas derivadas (calculadas).
   * 
   * IMPORTANTE: Estas métricas son conveniencia del datasource.
   * El Analyzer NO debe asumirlas como fuente de verdad.
   * Si necesita precisión, debe recalcularlas desde las métricas primarias.
   * 
   * Fórmulas:
   * - ctr = clicks / impressions (0 si impressions = 0)
   * - cpc = cost / clicks (0 si clicks = 0)
   * - conversionRate = conversions / clicks (0 si clicks = 0)
   */
  ctr: number;
  cpc: number;
  conversionRate: number;
}

// ============================================================================
// Ingest Payload
// ============================================================================

export interface AdsIngestPayload {
  source: DataSourceType;
  accountId: string;
  accountName: string;
  currency: string;
  dateRange: DateRangeType;
  fetchedAt: string;         // ISO timestamp desde el origen
  campaigns: CampaignMetrics[];
}

// ============================================================================
// Persisted Record
// ============================================================================

export interface AdsDataRecord {
  id: string;                // UUID generado en ingest
  ingestedAt: string;        // ISO timestamp de cuando se recibió
  source: DataSourceType;
  payload: AdsIngestPayload;
  validation: {
    valid: boolean;
    errors: string[];
    warnings: string[];
  };
}

// ============================================================================
// Ingest Response
// ============================================================================

export interface IngestResponse {
  success: boolean;
  recordId?: string;
  error?: string;
  validation?: {
    valid: boolean;
    errors: string[];
    warnings: string[];
  };
}

// ============================================================================
// Config
// ============================================================================

export interface GoogleAdsExpertConfig {
  enabled: boolean;
  datasource: DataSourceType;
  webhook: {
    enabled: boolean;
    path: string;
    tokenEnv: string;
  };
  persistence: {
    path: string;
    format: 'jsonl';
    retentionDays: number;
  };
}

// ============================================================================
// Keywords (Phase 8A)
// ============================================================================

/**
 * Match type for keywords.
 * Controls how strictly the keyword matches search queries.
 */
export type KeywordMatchType = 'EXACT' | 'PHRASE' | 'BROAD';

/**
 * Keyword metrics from Google Ads.
 * Primary metrics for cost analysis.
 */
export interface KeywordMetrics {
  // Identification
  keywordId: string;
  keywordText: string;
  matchType: KeywordMatchType;

  // Hierarchy
  campaignId: string;
  campaignName: string;
  adGroupId: string;
  adGroupName: string;

  // Primary metrics (source of truth)
  cost: number;              // In currency real (NOT micros)
  clicks: number;
  impressions: number;
  conversions: number;       // Google-reported conversions
  conversionValue: number;   // Google-reported conversion value

  /**
   * Derived metrics (calculated).
   *
   * IMPORTANT: These metrics are convenience from the datasource.
   * The Analyzer should recalculate if precision is needed.
   *
   * Formulas:
   * - ctr = clicks / impressions (0 if impressions = 0)
   * - cpc = cost / clicks (0 if clicks = 0)
   * - conversionRate = conversions / clicks (0 if clicks = 0)
   */
  ctr: number;
  cpc: number;
  conversionRate: number;
}

/**
 * Payload for keywords ingest from Google Ads Scripts.
 */
export interface KeywordsIngestPayload {
  source: 'ads-script-keywords';
  accountId: string;
  accountName: string;
  currency: string;
  dateRange: DateRangeType;
  fetchedAt: string;         // ISO timestamp from origin
  keywords: KeywordMetrics[];
}

// ============================================================================
// Search Terms (Phase 8B)
// ============================================================================

/**
 * Search term metrics from Google Ads.
 * Represents actual user queries that triggered ads.
 */
export interface SearchTermMetrics {
  // Search term (what user actually searched)
  searchTerm: string;

  // Matched keyword
  keywordText: string;
  matchType: KeywordMatchType | 'UNKNOWN';

  // Hierarchy
  campaignId: string;
  campaignName: string;
  adGroupId: string;
  adGroupName: string;

  // Primary metrics (source of truth)
  cost: number;              // In currency real (NOT micros)
  clicks: number;
  impressions: number;
  conversions: number;       // Google-reported conversions
  conversionValue: number;   // Google-reported conversion value

  /**
   * Derived metrics (calculated).
   *
   * Formulas:
   * - ctr = clicks / impressions (0 if impressions = 0)
   * - conversionRate = conversions / clicks (0 if clicks = 0)
   */
  ctr: number;
  conversionRate: number;
}

/**
 * Payload for search terms ingest from Google Ads Scripts.
 */
export interface SearchTermsIngestPayload {
  source: 'ads-script-search-terms';
  accountId: string;
  accountName: string;
  currency: string;
  dateRange: '7d' | '30d';   // Already converted from LAST_X_DAYS
  fetchedAt: string;         // ISO timestamp from origin
  chunk?: number;            // Chunk number (if chunked)
  totalChunks?: number;      // Total chunks (if chunked)
  searchTerms: SearchTermMetrics[];
}
