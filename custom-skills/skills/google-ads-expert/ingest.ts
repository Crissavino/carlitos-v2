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
import { getDataSource } from "./datasources/index.js";
import { AdsDataRecord, AdsIngestPayload, IngestResponse, DataSourceType, CampaignMetrics, DateRangeType } from "./types.js";
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
 */
export async function handleIngest(
  authHeader: string | undefined,
  rawPayload: unknown,
  sourceType: DataSourceType = 'ads-script'
): Promise<IngestResponse> {
  const recordId = randomUUID();
  const ingestedAt = new Date().toISOString();

  // 1. Verificar autenticación
  const authResult = verifyToken(authHeader);
  if (!authResult.valid) {
    await audit.log({
      skill: 'google-ads-expert',
      action: 'ingest_blocked',
      input: {
        reason: authResult.error,
        sourceType
      },
      output: { blocked: true },
      queries: []
    });

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
    await audit.log({
      skill: 'google-ads-expert',
      action: 'ingest_validation_failed',
      input: {
        sourceType,
        errors: validation.errors
      },
      output: { valid: false },
      queries: []
    });

    return {
      success: false,
      error: 'Validation failed',
      validation
    };
  }

  // 4. Transformar a schema unificado
  const payload = dataSource.transform(rawPayload);

  // 5. Persistir a base de datos
  try {
    const { inserted, updated } = await persistToDatabase(payload, recordId);

    console.log(`[Ingest] Persisted ${inserted} new, ${updated} updated campaigns to database`);

    await audit.log({
      skill: 'google-ads-expert',
      action: 'ingest_success',
      input: {
        recordId,
        sourceType,
        accountId: payload.accountId,
        accountName: payload.accountName,
        dateRange: payload.dateRange,
        campaignCount: payload.campaigns.length
      },
      output: {
        persisted: true,
        inserted,
        updated,
        warnings: validation.warnings
      },
      queries: []
    });

    return {
      success: true,
      recordId,
      validation
    };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown error';

    await audit.log({
      skill: 'google-ads-expert',
      action: 'ingest_persist_error',
      input: { recordId },
      output: { error: errorMsg },
      queries: []
    });

    return {
      success: false,
      error: 'Failed to persist data: ' + errorMsg
    };
  }
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
