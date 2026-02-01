/**
 * GoogleAdsExpert - Ingest Handler
 *
 * Maneja el webhook HTTP para recibir datos de Google Ads Scripts.
 * Persiste los datos en la tabla google_ads_campaign_metrics.
 *
 * Seguridad:
 * - Requiere Authorization header con Bearer token
 * - Rechaza y loguea requests sin auth o con token inválido
 * - Valida schema estrictamente antes de persistir
 */

import { randomUUID } from "crypto";
import { getDataSource, getKeywordsDataSource } from "./datasources/index.js";
import { AdsDataRecord, AdsIngestPayload, IngestResponse, DataSourceType, CampaignMetrics, DateRangeType, KeywordsIngestPayload, KeywordMetrics } from "./types.js";
import { audit } from "../../core/audit.js";
import { getPool } from "../../dashboard/db.js";

/**
 * Verificar token de autorización
 */
function verifyToken(authHeader: string | undefined): { valid: boolean; error?: string } {
  const expectedToken = process.env.GOOGLE_ADS_WEBHOOK_TOKEN;

  if (!expectedToken) {
    return { valid: false, error: 'Webhook token not configured on server' };
  }

  if (!authHeader) {
    return { valid: false, error: 'Missing Authorization header' };
  }

  if (!authHeader.startsWith('Bearer ')) {
    return { valid: false, error: 'Invalid Authorization format (expected Bearer token)' };
  }

  const token = authHeader.substring(7);
  if (token !== expectedToken) {
    return { valid: false, error: 'Invalid token' };
  }

  return { valid: true };
}

/**
 * Calculate metrics date window from dateRange
 */
function calculateDateWindow(dateRange: DateRangeType): { startDate: string; endDate: string; rangeCode: string } {
  const now = new Date();
  const endDate = new Date(now);
  endDate.setDate(endDate.getDate() - 1); // Yesterday (Google Ads data is delayed)

  let startDate: Date;
  let rangeCode: string;

  switch (dateRange) {
    case 'LAST_7_DAYS':
      startDate = new Date(endDate);
      startDate.setDate(startDate.getDate() - 6); // 7 days total
      rangeCode = '7d';
      break;
    case 'LAST_30_DAYS':
      startDate = new Date(endDate);
      startDate.setDate(startDate.getDate() - 29); // 30 days total
      rangeCode = '30d';
      break;
    case 'TODAY':
      startDate = new Date(now);
      endDate.setDate(now.getDate()); // Today
      rangeCode = '1d';
      break;
    case 'YESTERDAY':
      startDate = new Date(endDate);
      rangeCode = '1d';
      break;
    default:
      startDate = new Date(endDate);
      startDate.setDate(startDate.getDate() - 6);
      rangeCode = '7d';
  }

  return {
    startDate: startDate.toISOString().split('T')[0],
    endDate: endDate.toISOString().split('T')[0],
    rangeCode,
  };
}

/**
 * Persist campaign metrics to database
 */
async function persistToDatabase(
  payload: AdsIngestPayload,
  recordId: string
): Promise<{ inserted: number; updated: number }> {
  const pool = getPool();
  const { startDate, endDate, rangeCode } = calculateDateWindow(payload.dateRange);

  let inserted = 0;
  let updated = 0;

  for (const campaign of payload.campaigns) {
    const sql = `
      INSERT INTO google_ads_campaign_metrics (
        campaign_id, campaign_name, campaign_status,
        date_range, metrics_start_date, metrics_end_date,
        cost, currency, impressions, clicks, conversions, ctr, cpc,
        account_id, account_name,
        record_id, source
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        campaign_name = VALUES(campaign_name),
        campaign_status = VALUES(campaign_status),
        cost = VALUES(cost),
        impressions = VALUES(impressions),
        clicks = VALUES(clicks),
        conversions = VALUES(conversions),
        ctr = VALUES(ctr),
        cpc = VALUES(cpc),
        account_id = VALUES(account_id),
        account_name = VALUES(account_name),
        record_id = VALUES(record_id),
        ingested_at = CURRENT_TIMESTAMP
    `;

    const params = [
      campaign.campaignId,
      campaign.campaignName,
      campaign.status,
      rangeCode,
      startDate,
      endDate,
      campaign.cost,
      payload.currency,
      campaign.impressions,
      campaign.clicks,
      campaign.conversions,
      campaign.ctr,
      campaign.cpc,
      payload.accountId,
      payload.accountName,
      recordId,
      payload.source || 'ads-script',
    ];

    try {
      const [result] = await pool.execute(sql, params) as any;
      if (result.affectedRows === 1) {
        inserted++;
      } else if (result.affectedRows === 2) {
        // ON DUPLICATE KEY UPDATE counts as 2 affected rows
        updated++;
      }
    } catch (err) {
      console.error(`[Ingest] Failed to persist campaign ${campaign.campaignId}:`, err);
      throw err;
    }
  }

  return { inserted, updated };
}

/**
 * Procesar ingest de datos de Google Ads
 * Responde inmediatamente después de validar, persiste en background
 */
export async function handleIngest(
  authHeader: string | undefined,
  rawPayload: unknown,
  sourceType: DataSourceType = 'ads-script'
): Promise<IngestResponse> {
  const recordId = randomUUID();

  // 1. Verificar autenticación
  const authResult = verifyToken(authHeader);
  if (!authResult.valid) {
    audit.log({
      skill: 'google-ads-expert',
      action: 'ingest_blocked',
      input: {
        reason: authResult.error,
        sourceType
      },
      output: { blocked: true },
      queries: []
    }).catch(() => {}); // Fire and forget

    return {
      success: false,
      error: authResult.error
    };
  }

  // 2. Obtener datasource
  const dataSource = getDataSource(sourceType);

  // 3. Validar payload
  const validation = dataSource.validate(rawPayload);

  if (!validation.valid) {
    audit.log({
      skill: 'google-ads-expert',
      action: 'ingest_validation_failed',
      input: {
        sourceType,
        errors: validation.errors
      },
      output: { valid: false },
      queries: []
    }).catch(() => {}); // Fire and forget

    return {
      success: false,
      error: 'Validation failed',
      validation
    };
  }

  // 4. Transformar a schema unificado
  const payload = dataSource.transform(rawPayload);

  // 5. Persistir a base de datos EN BACKGROUND (no await)
  // Respondemos inmediatamente para evitar timeout de Google Ads Scripts
  const campaignCount = payload.campaigns.length;
  console.log(`[Ingest] Accepted ${campaignCount} campaigns, persisting in background...`);

  persistToDatabase(payload, recordId)
    .then(({ inserted, updated }) => {
      console.log(`[Ingest] Persisted ${inserted} new, ${updated} updated campaigns to database`);
      return audit.log({
        skill: 'google-ads-expert',
        action: 'ingest_success',
        input: {
          recordId,
          sourceType,
          accountId: payload.accountId,
          accountName: payload.accountName,
          dateRange: payload.dateRange,
          campaignCount
        },
        output: {
          persisted: true,
          inserted,
          updated,
          warnings: validation.warnings
        },
        queries: []
      });
    })
    .catch((err) => {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      console.error(`[Ingest] Background persist failed:`, errorMsg);
      audit.log({
        skill: 'google-ads-expert',
        action: 'ingest_persist_error',
        input: { recordId },
        output: { error: errorMsg },
        queries: []
      }).catch(() => {});
    });

  // Responder inmediatamente
  return {
    success: true,
    recordId,
    validation
  };
}

// ============================================================================
// READ FUNCTIONS (for campaign-analyzer)
// ============================================================================

export interface CampaignSpendData {
  campaignId: string;
  campaignName: string;
  campaignStatus: string;
  dateRange: string;
  metricsStartDate: string;
  metricsEndDate: string;
  cost: number;
  currency: string;
  impressions: number;
  clicks: number;
  conversions: number;
  ctr: number;
  cpc: number;
  ingestedAt: string;
}

/**
 * Get latest campaign metrics for a specific date range (7d or 30d)
 */
export async function getCampaignSpend(dateRange: '7d' | '30d' = '7d'): Promise<CampaignSpendData[]> {
  const pool = getPool();

  // Get the most recent metrics for each campaign for the specified date_range
  const sql = `
    SELECT
      campaign_id as campaignId,
      campaign_name as campaignName,
      campaign_status as campaignStatus,
      date_range as dateRange,
      metrics_start_date as metricsStartDate,
      metrics_end_date as metricsEndDate,
      cost,
      currency,
      impressions,
      clicks,
      conversions,
      ctr,
      cpc,
      ingested_at as ingestedAt
    FROM google_ads_campaign_metrics m1
    WHERE date_range = ?
      AND ingested_at = (
        SELECT MAX(ingested_at)
        FROM google_ads_campaign_metrics m2
        WHERE m2.campaign_id = m1.campaign_id
          AND m2.date_range = m1.date_range
      )
    ORDER BY cost DESC
  `;

  try {
    const [rows] = await pool.execute(sql, [dateRange]) as any;
    return rows.map((row: any) => ({
      ...row,
      // Ensure cost is a number (MySQL returns decimals as strings)
      cost: parseFloat(row.cost) || 0,
      impressions: parseInt(row.impressions) || 0,
      clicks: parseInt(row.clicks) || 0,
      conversions: parseFloat(row.conversions) || 0,
      ctr: parseFloat(row.ctr) || 0,
      cpc: parseFloat(row.cpc) || 0,
      metricsStartDate: row.metricsStartDate instanceof Date
        ? row.metricsStartDate.toISOString().split('T')[0]
        : row.metricsStartDate,
      metricsEndDate: row.metricsEndDate instanceof Date
        ? row.metricsEndDate.toISOString().split('T')[0]
        : row.metricsEndDate,
      ingestedAt: row.ingestedAt instanceof Date
        ? row.ingestedAt.toISOString()
        : row.ingestedAt,
    }));
  } catch (err) {
    console.error('[Ingest] Failed to get campaign spend:', err);
    return [];
  }
}

/**
 * Get latest record info (for backward compatibility)
 */
export function getLatestRecord(): AdsDataRecord | null {
  // This function is now deprecated in favor of getCampaignSpend()
  // Kept for backward compatibility but returns null
  console.warn('[Ingest] getLatestRecord() is deprecated. Use getCampaignSpend() instead.');
  return null;
}

/**
 * Check if there's any campaign data in the database
 */
export async function hasCampaignData(): Promise<boolean> {
  const pool = getPool();

  try {
    const [rows] = await pool.execute(
      'SELECT COUNT(*) as count FROM google_ads_campaign_metrics WHERE date_range = ?',
      ['7d']
    ) as any;
    return rows[0]?.count > 0;
  } catch (err) {
    console.error('[Ingest] Failed to check campaign data:', err);
    return false;
  }
}

// ============================================================================
// KEYWORDS INGEST (Phase 8A)
// ============================================================================

/**
 * Persist keyword metrics to database
 */
async function persistKeywordsToDatabase(
  payload: KeywordsIngestPayload,
  recordId: string
): Promise<{ inserted: number; updated: number }> {
  const pool = getPool();
  const { startDate, endDate, rangeCode } = calculateDateWindow(payload.dateRange);

  let inserted = 0;
  let updated = 0;

  for (const keyword of payload.keywords) {
    const sql = `
      INSERT INTO google_ads_keyword_metrics (
        keyword_id, keyword_text, match_type,
        campaign_id, campaign_name, ad_group_id, ad_group_name,
        date_range, metrics_start_date, metrics_end_date,
        cost, currency, impressions, clicks, conversions, conversion_value, ctr, cpc, conversion_rate,
        account_id, account_name,
        record_id, source
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        keyword_id = VALUES(keyword_id),
        campaign_name = VALUES(campaign_name),
        ad_group_name = VALUES(ad_group_name),
        cost = VALUES(cost),
        impressions = VALUES(impressions),
        clicks = VALUES(clicks),
        conversions = VALUES(conversions),
        conversion_value = VALUES(conversion_value),
        ctr = VALUES(ctr),
        cpc = VALUES(cpc),
        conversion_rate = VALUES(conversion_rate),
        account_id = VALUES(account_id),
        account_name = VALUES(account_name),
        record_id = VALUES(record_id),
        ingested_at = CURRENT_TIMESTAMP
    `;

    const params = [
      keyword.keywordId,
      keyword.keywordText,
      keyword.matchType,
      keyword.campaignId,
      keyword.campaignName,
      keyword.adGroupId,
      keyword.adGroupName,
      rangeCode,
      startDate,
      endDate,
      keyword.cost,
      payload.currency,
      keyword.impressions,
      keyword.clicks,
      keyword.conversions,
      keyword.conversionValue,
      keyword.ctr,
      keyword.cpc,
      keyword.conversionRate,
      payload.accountId,
      payload.accountName,
      recordId,
      'ads-script',
    ];

    try {
      const [result] = await pool.execute(sql, params) as any;
      if (result.affectedRows === 1) {
        inserted++;
      } else if (result.affectedRows === 2) {
        // ON DUPLICATE KEY UPDATE counts as 2 affected rows
        updated++;
      }
    } catch (err) {
      console.error(`[Ingest] Failed to persist keyword ${keyword.keywordId}:`, err);
      throw err;
    }
  }

  return { inserted, updated };
}

/**
 * Process keywords ingest from Google Ads Scripts
 * Responde inmediatamente después de validar, persiste en background
 */
export async function handleKeywordsIngest(
  authHeader: string | undefined,
  rawPayload: unknown
): Promise<IngestResponse> {
  const recordId = randomUUID();

  // 1. Verify authentication
  const authResult = verifyToken(authHeader);
  if (!authResult.valid) {
    audit.log({
      skill: 'google-ads-expert',
      action: 'keywords_ingest_blocked',
      input: {
        reason: authResult.error,
      },
      output: { blocked: true },
      queries: [],
    }).catch(() => {}); // Fire and forget

    return {
      success: false,
      error: authResult.error,
    };
  }

  // 2. Get keywords datasource
  const dataSource = getKeywordsDataSource();

  // 3. Validate payload
  const validation = dataSource.validate(rawPayload);

  if (!validation.valid) {
    audit.log({
      skill: 'google-ads-expert',
      action: 'keywords_ingest_validation_failed',
      input: {
        errors: validation.errors,
      },
      output: { valid: false },
      queries: [],
    }).catch(() => {}); // Fire and forget

    return {
      success: false,
      error: 'Validation failed',
      validation,
    };
  }

  // 4. Transform to unified schema
  const payload = dataSource.transform(rawPayload);

  // 5. Persist to database EN BACKGROUND (no await)
  // Respondemos inmediatamente para evitar timeout de Google Ads Scripts
  const keywordCount = payload.keywords.length;
  console.log(`[Ingest] Accepted ${keywordCount} keywords, persisting in background...`);

  persistKeywordsToDatabase(payload, recordId)
    .then(({ inserted, updated }) => {
      console.log(`[Ingest] Persisted ${inserted} new, ${updated} updated keywords to database`);
      return audit.log({
        skill: 'google-ads-expert',
        action: 'keywords_ingest_success',
        input: {
          recordId,
          accountId: payload.accountId,
          accountName: payload.accountName,
          dateRange: payload.dateRange,
          keywordCount,
        },
        output: {
          persisted: true,
          inserted,
          updated,
          warnings: validation.warnings,
        },
        queries: [],
      });
    })
    .catch((err) => {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      console.error(`[Ingest] Background persist failed:`, errorMsg);
      audit.log({
        skill: 'google-ads-expert',
        action: 'keywords_ingest_persist_error',
        input: { recordId },
        output: { error: errorMsg },
        queries: [],
      }).catch(() => {});
    });

  // Responder inmediatamente
  return {
    success: true,
    recordId,
    validation,
  };
}

// ============================================================================
// KEYWORDS READ FUNCTIONS (for keywords-analyzer)
// ============================================================================

export interface KeywordSpendData {
  keywordId: string;
  keywordText: string;
  matchType: string;
  campaignId: string;
  campaignName: string;
  adGroupId: string;
  adGroupName: string;
  dateRange: string;
  metricsStartDate: string;
  metricsEndDate: string;
  cost: number;
  currency: string;
  impressions: number;
  clicks: number;
  conversions: number;
  conversionValue: number;
  ctr: number;
  cpc: number;
  conversionRate: number;
  ingestedAt: string;
}

/**
 * Get latest keyword metrics for a specific date range (7d or 30d)
 */
export async function getKeywordSpend(dateRange: '7d' | '30d' = '7d'): Promise<KeywordSpendData[]> {
  const pool = getPool();

  // Get the most recent metrics for each keyword for the specified date_range
  // Using the composite key for identity
  const sql = `
    SELECT
      keyword_id as keywordId,
      keyword_text as keywordText,
      match_type as matchType,
      campaign_id as campaignId,
      campaign_name as campaignName,
      ad_group_id as adGroupId,
      ad_group_name as adGroupName,
      date_range as dateRange,
      metrics_start_date as metricsStartDate,
      metrics_end_date as metricsEndDate,
      cost,
      currency,
      impressions,
      clicks,
      conversions,
      conversion_value as conversionValue,
      ctr,
      cpc,
      conversion_rate as conversionRate,
      ingested_at as ingestedAt
    FROM google_ads_keyword_metrics m1
    WHERE date_range = ?
      AND ingested_at = (
        SELECT MAX(ingested_at)
        FROM google_ads_keyword_metrics m2
        WHERE m2.campaign_id = m1.campaign_id
          AND m2.ad_group_id = m1.ad_group_id
          AND m2.keyword_text = m1.keyword_text
          AND m2.match_type = m1.match_type
          AND m2.date_range = m1.date_range
      )
    ORDER BY cost DESC
  `;

  try {
    const [rows] = await pool.execute(sql, [dateRange]) as any;
    return rows.map((row: any) => ({
      ...row,
      cost: parseFloat(row.cost) || 0,
      impressions: parseInt(row.impressions) || 0,
      clicks: parseInt(row.clicks) || 0,
      conversions: parseFloat(row.conversions) || 0,
      conversionValue: parseFloat(row.conversionValue) || 0,
      ctr: parseFloat(row.ctr) || 0,
      cpc: parseFloat(row.cpc) || 0,
      conversionRate: parseFloat(row.conversionRate) || 0,
      metricsStartDate: row.metricsStartDate instanceof Date
        ? row.metricsStartDate.toISOString().split('T')[0]
        : row.metricsStartDate,
      metricsEndDate: row.metricsEndDate instanceof Date
        ? row.metricsEndDate.toISOString().split('T')[0]
        : row.metricsEndDate,
      ingestedAt: row.ingestedAt instanceof Date
        ? row.ingestedAt.toISOString()
        : row.ingestedAt,
    }));
  } catch (err) {
    console.error('[Ingest] Failed to get keyword spend:', err);
    return [];
  }
}

/**
 * Check if there's any keyword data in the database
 */
export async function hasKeywordData(): Promise<boolean> {
  const pool = getPool();

  try {
    const [rows] = await pool.execute(
      'SELECT COUNT(*) as count FROM google_ads_keyword_metrics WHERE date_range = ?',
      ['7d']
    ) as any;
    return rows[0]?.count > 0;
  } catch (err) {
    console.error('[Ingest] Failed to check keyword data:', err);
    return false;
  }
}
