import { QueryDefinition, QueryBuilder } from "../types.js";
import { buildCurrencyRateCase } from "../../../core/currency.js";

/**
 * Campaign Metrics - Phase 7
 *
 * HARDENING: Filter by website_id when provided
 */

// Jackcode company_id for Zoho refunds
const JACKCODE_COMPANY_ID = 3;

// Currency conversion for invoice amounts
const RATE_CASE = buildCurrencyRateCase('i.currency_code');

/**
 * Campaign Performance Summary
 */
export const campaignPerformanceQuery: QueryBuilder = (websiteId?: number): QueryDefinition => {
  const websiteFilter = websiteId ? `AND camp.website_id = ?` : '';
  const params = websiteId ? [websiteId] : [];

  return {
    id: "campaign-performance" as any,
    name: "Campaign Performance",
    description: "Attribution data por campaña (acquisitions, LTV, rebills)",
    sql: `
      SELECT
        camp.id as campaign_id,
        camp.google_campaign_id,
        camp.name as campaign_name,
        camp.website_id,
        camp.country_id,
        camp.company_id,
        camp.currency_id,
        CASE camp.currency_id
          WHEN 2 THEN 'EUR'
          WHEN 4 THEN 'RON'
          ELSE 'UNKNOWN'
        END as expected_currency,
        camp.active,
        camp.started_at,
        DATEDIFF(CURDATE(), camp.started_at) as campaign_age_days,

        -- Acquisitions (customers atribuidos a esta campaña)
        (
          SELECT COUNT(DISTINCT gad.customer_id)
          FROM avocode.google_ads_details gad
          WHERE gad.utm_campaign = camp.google_campaign_id
        ) as total_acquisitions,

        -- Acquisitions últimos 30 días
        (
          SELECT COUNT(DISTINCT gad.customer_id)
          FROM avocode.google_ads_details gad
          WHERE gad.utm_campaign = camp.google_campaign_id
            AND gad.created_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
        ) as acquisitions_30d,

        -- First Rebills
        (
          SELECT COUNT(DISTINCT gad.customer_id)
          FROM avocode.google_ads_details gad
          JOIN avocode.invoices i ON i.customer_id = gad.customer_id
          WHERE gad.utm_campaign = camp.google_campaign_id
            AND i.invoice_status_id = 1
            AND i.invoice_type_id = 2
        ) as total_first_rebills,

        -- Cohort 21d
        (
          SELECT COUNT(DISTINCT gad.customer_id)
          FROM avocode.google_ads_details gad
          JOIN avocode.customers c ON c.id = gad.customer_id
          WHERE gad.utm_campaign = camp.google_campaign_id
            AND c.create_time <= DATE_SUB(CURDATE(), INTERVAL 21 DAY)
        ) as cohort_21d_size,

        -- LTV 21d
        COALESCE((
          SELECT ROUND(
            SUM(
              COALESCE((
                SELECT SUM(i.amount / ${RATE_CASE})
                FROM avocode.invoices i
                WHERE i.customer_id = c.id
                  AND i.invoice_status_id = 1
                  AND i.invoice_type_id = 2
                  AND i.transacted_at <= DATE_ADD(c.create_time, INTERVAL 21 DAY)
              ), 0)
              -
              COALESCE((
                SELECT SUM(i.amount / ${RATE_CASE})
                FROM avocode.invoices i
                WHERE i.customer_id = c.id
                  AND i.invoice_status_id = 1
                  AND i.invoice_type_id = 3
                  AND i.company_id != ${JACKCODE_COMPANY_ID}
                  AND i.transacted_at <= DATE_ADD(c.create_time, INTERVAL 21 DAY)
              ), 0)
            ) / NULLIF(COUNT(*), 0),
            2
          )
          FROM avocode.google_ads_details gad
          JOIN avocode.customers c ON c.id = gad.customer_id
          WHERE gad.utm_campaign = camp.google_campaign_id
            AND c.create_time <= DATE_SUB(CURDATE(), INTERVAL 21 DAY)
            AND c.create_time >= DATE_SUB(CURDATE(), INTERVAL 120 DAY)
        ), 0) as ltv_21d,

        -- Cohort 51d
        (
          SELECT COUNT(DISTINCT gad.customer_id)
          FROM avocode.google_ads_details gad
          JOIN avocode.customers c ON c.id = gad.customer_id
          WHERE gad.utm_campaign = camp.google_campaign_id
            AND c.create_time <= DATE_SUB(CURDATE(), INTERVAL 51 DAY)
        ) as cohort_51d_size,

        -- LTV 51d
        COALESCE((
          SELECT ROUND(
            SUM(
              COALESCE((
                SELECT SUM(i.amount / ${RATE_CASE})
                FROM avocode.invoices i
                WHERE i.customer_id = c.id
                  AND i.invoice_status_id = 1
                  AND i.invoice_type_id = 2
                  AND i.transacted_at <= DATE_ADD(c.create_time, INTERVAL 51 DAY)
              ), 0)
              -
              COALESCE((
                SELECT SUM(i.amount / ${RATE_CASE})
                FROM avocode.invoices i
                WHERE i.customer_id = c.id
                  AND i.invoice_status_id = 1
                  AND i.invoice_type_id = 3
                  AND i.company_id != ${JACKCODE_COMPANY_ID}
                  AND i.transacted_at <= DATE_ADD(c.create_time, INTERVAL 51 DAY)
              ), 0)
            ) / NULLIF(COUNT(*), 0),
            2
          )
          FROM avocode.google_ads_details gad
          JOIN avocode.customers c ON c.id = gad.customer_id
          WHERE gad.utm_campaign = camp.google_campaign_id
            AND c.create_time <= DATE_SUB(CURDATE(), INTERVAL 51 DAY)
            AND c.create_time >= DATE_SUB(CURDATE(), INTERVAL 180 DAY)
        ), 0) as ltv_51d

      FROM avocodebo.campaigns camp
      WHERE camp.google_campaign_id IS NOT NULL
        AND camp.google_campaign_id != ''
        ${websiteFilter}
      ORDER BY total_acquisitions DESC
    `,
    params,
    permissions: ["SELECT"],
  };
};

/**
 * Keyword Attribution - Phase 12
 *
 * Uses utm_term from google_ads_details to attribute customers to keywords.
 * Returns acquisitions and first rebills per keyword (utm_term + utm_campaign combo)
 */
export const keywordAttributionQuery: QueryBuilder = (websiteId?: number): QueryDefinition => {
  const websiteFilter = websiteId ? `AND camp.website_id = ?` : '';
  const params = websiteId ? [websiteId] : [];

  return {
    id: "keyword-attribution" as any,
    name: "Keyword Attribution",
    description: "Acquisitions and first rebills by keyword (utm_term)",
    sql: `
      SELECT
        gad.utm_term as keyword_text,
        gad.utm_campaign as campaign_id,
        camp.name as campaign_name,
        camp.website_id,
        COUNT(DISTINCT gad.customer_id) as acquisitions,
        COUNT(DISTINCT CASE
          WHEN EXISTS (
            SELECT 1 FROM avocode.invoices i
            WHERE i.customer_id = gad.customer_id
              AND i.invoice_status_id = 1
              AND i.invoice_type_id = 2
          ) THEN gad.customer_id
          ELSE NULL
        END) as first_rebills
      FROM avocode.google_ads_details gad
      LEFT JOIN avocodebo.campaigns camp
        ON camp.google_campaign_id = gad.utm_campaign
      WHERE gad.utm_term IS NOT NULL
        AND gad.utm_term != ''
        ${websiteFilter}
      GROUP BY gad.utm_term, gad.utm_campaign, camp.name, camp.website_id
      ORDER BY acquisitions DESC
    `,
    params,
    permissions: ["SELECT"],
  };
};

/**
 * Campaign Summary (lightweight)
 */
export const campaignSummaryQuery: QueryBuilder = (websiteId?: number): QueryDefinition => {
  const websiteFilter = websiteId ? `AND camp.website_id = ?` : '';
  const params = websiteId ? [websiteId] : [];

  return {
    id: "campaign-summary" as any,
    name: "Campaign Summary",
    description: "Resumen ligero de campañas activas para dashboard",
    sql: `
      SELECT
        camp.id as campaign_id,
        camp.google_campaign_id,
        camp.name as campaign_name,
        camp.website_id,
        camp.active,
        DATEDIFF(CURDATE(), camp.started_at) as campaign_age_days,

        -- Spend 7d
        COALESCE((
          SELECT ROUND(SUM(a.cost), 2)
          FROM avocodebo.ads a
          WHERE a.campaign_id = camp.id
            AND a.date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
        ), 0) as spend_7d,

        -- Acquisitions atribuidas
        (
          SELECT COUNT(DISTINCT gad.customer_id)
          FROM avocode.google_ads_details gad
          WHERE gad.utm_campaign = camp.google_campaign_id
        ) as acquisitions

      FROM avocodebo.campaigns camp
      WHERE camp.active = 1
        AND camp.google_campaign_id IS NOT NULL
        ${websiteFilter}
      ORDER BY spend_7d DESC
      LIMIT 50
    `,
    params,
    permissions: ["SELECT"],
  };
};
