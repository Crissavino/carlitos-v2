import { QueryDefinition } from "../types.js";
import { buildCurrencyRateCase } from "../../../core/currency.js";

/**
 * Campaign Metrics - Phase 7
 *
 * Métricas a nivel campaña para decisiones de ads.
 *
 * JOIN CHAIN:
 * - avocodebo.campaigns (google_campaign_id, website_id, country_id, company_id)
 *     ↓ JOIN on google_campaign_id = utm_campaign
 * - avocode.google_ads_details (utm_campaign, customer_id)
 *     ↓ JOIN on customer_id
 * - avocode.customers (id, create_time)
 *     ↓ JOIN on customer_id
 * - avocode.invoices (customer_id, invoice_type_id, amount)
 *
 * SPEND:
 * - avocodebo.ads (campaign_id, cost, date)
 *     ↓ JOIN on campaigns.id
 *
 * MÉTRICAS:
 * - Spend (7d, 30d)
 * - Acquisitions (customers atribuidos)
 * - First Rebills (invoice_type_id = 2)
 * - LTV_21d, LTV_51d
 * - CPFR = Spend / First Rebills
 * - Payback_21d, Payback_51d
 * - campaignAgeDays = DATEDIFF(NOW(), started_at)
 */

// Jackcode company_id for Zoho refunds
const JACKCODE_COMPANY_ID = 3;

// Currency conversion
const RATE_CASE = buildCurrencyRateCase('i.currency_code');
const RATE_CASE_INV = buildCurrencyRateCase('inv.currency_code');
const RATE_CASE_ADS = buildCurrencyRateCase('cur.normalized');

/**
 * Campaign Performance Summary
 * Returns all campaigns with key metrics for the dashboard
 */
export const campaignPerformanceQuery: QueryDefinition = {
  id: "campaign-performance" as any,
  name: "Campaign Performance",
  description: "Métricas de rendimiento por campaña con LTV y Payback",
  sql: `
    SELECT
      camp.id as campaign_id,
      camp.google_campaign_id,
      camp.name as campaign_name,
      camp.website_id,
      camp.country_id,
      camp.company_id,
      camp.active,
      camp.started_at,
      DATEDIFF(CURDATE(), camp.started_at) as campaign_age_days,

      -- Spend (últimos 7 días)
      COALESCE((
        SELECT ROUND(SUM(a.cost / ${RATE_CASE_ADS}), 2)
        FROM avocodebo.ads a
        JOIN avocodebo.currencies cur ON cur.id = camp.currency_id
        WHERE a.campaign_id = camp.id
          AND a.date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
      ), 0) as spend_7d_eur,

      -- Spend (últimos 30 días)
      COALESCE((
        SELECT ROUND(SUM(a.cost / ${RATE_CASE_ADS}), 2)
        FROM avocodebo.ads a
        JOIN avocodebo.currencies cur ON cur.id = camp.currency_id
        WHERE a.campaign_id = camp.id
          AND a.date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
      ), 0) as spend_30d_eur,

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

      -- First Rebills (customers con invoice tipo 2)
      (
        SELECT COUNT(DISTINCT gad.customer_id)
        FROM avocode.google_ads_details gad
        JOIN avocode.invoices i ON i.customer_id = gad.customer_id
        WHERE gad.utm_campaign = camp.google_campaign_id
          AND i.invoice_status_id = 1
          AND i.invoice_type_id = 2
      ) as total_first_rebills,

      -- Cohort con 21+ días (para LTV_21d)
      (
        SELECT COUNT(DISTINCT gad.customer_id)
        FROM avocode.google_ads_details gad
        JOIN avocode.customers c ON c.id = gad.customer_id
        WHERE gad.utm_campaign = camp.google_campaign_id
          AND c.create_time <= DATE_SUB(CURDATE(), INTERVAL 21 DAY)
      ) as cohort_21d_size,

      -- LTV 21d (por campaña)
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

      -- Cohort con 51+ días (para LTV_51d)
      (
        SELECT COUNT(DISTINCT gad.customer_id)
        FROM avocode.google_ads_details gad
        JOIN avocode.customers c ON c.id = gad.customer_id
        WHERE gad.utm_campaign = camp.google_campaign_id
          AND c.create_time <= DATE_SUB(CURDATE(), INTERVAL 51 DAY)
      ) as cohort_51d_size,

      -- LTV 51d (por campaña)
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
    ORDER BY spend_7d_eur DESC
  `,
  params: [],
  permissions: ["SELECT"],
};

/**
 * Campaign Summary (lightweight version for dashboard)
 * Solo campañas activas con métricas calculadas
 */
export const campaignSummaryQuery: QueryDefinition = {
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
    ORDER BY spend_7d DESC
    LIMIT 50
  `,
  params: [],
  permissions: ["SELECT"],
};
