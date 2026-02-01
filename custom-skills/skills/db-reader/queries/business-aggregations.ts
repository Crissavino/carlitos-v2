import { QueryDefinition } from "../types.js";
import { buildCurrencyRateCase } from "../../../core/currency.js";

/**
 * Business Aggregation Queries - Phase 7.5
 *
 * REGLAS DE AGREGACIÓN:
 * - LTV_51d_agg = SUM(revenue_51d) / SUM(acquisitions)
 * - Payback_51d_agg = SUM(revenue_51d) / SUM(spend)
 * - ❌ NO usar AVG(ltv) ni AVG(payback)
 *
 * REFERENCE TABLES:
 * - avocode.websites (id, name)
 * - avocode.companies (id, name)
 * - avocode.countries (id, name, code)
 * - avocodebo.campaigns (website_id, company_id, country_id, google_campaign_id)
 */

const JACKCODE_COMPANY_ID = 3;
// For nested subqueries using 'inv' alias
const RATE_CASE_INV = buildCurrencyRateCase('inv.currency_code');

/**
 * Aggregation by Website
 * Groups all campaigns by website_id
 */
export const websiteAggregationQuery: QueryDefinition = {
  id: "business-by-website" as any,
  name: "Business Aggregation by Website",
  description: "Métricas agregadas por website con LTV y Payback SUM-based",
  sql: `
    SELECT
      w.id as website_id,
      w.name as website_name,

      -- Campaign counts
      COUNT(DISTINCT camp.id) as total_campaigns,
      SUM(CASE WHEN camp.active = 1 THEN 1 ELSE 0 END) as active_campaigns,
      MIN(DATEDIFF(CURDATE(), camp.started_at)) as min_campaign_age_days,

      -- Spend from google_ads_campaign_metrics (Script source of truth)
      -- Note: This is a placeholder - actual spend comes from separate join
      0 as spend_7d_placeholder,

      -- Acquisitions
      COALESCE(SUM((
        SELECT COUNT(DISTINCT gad.customer_id)
        FROM avocode.google_ads_details gad
        WHERE gad.utm_campaign = camp.google_campaign_id
      )), 0) as total_acquisitions,

      -- First Rebills
      COALESCE(SUM((
        SELECT COUNT(DISTINCT gad.customer_id)
        FROM avocode.google_ads_details gad
        JOIN avocode.invoices i ON i.customer_id = gad.customer_id
        WHERE gad.utm_campaign = camp.google_campaign_id
          AND i.invoice_status_id = 1
          AND i.invoice_type_id = 2
      )), 0) as total_first_rebills,

      -- Revenue 51d (for SUM-based LTV calculation)
      COALESCE(SUM((
        SELECT SUM(
          COALESCE((
            SELECT SUM(inv.amount / ${RATE_CASE_INV})
            FROM avocode.invoices inv
            WHERE inv.customer_id = c.id
              AND inv.invoice_status_id = 1
              AND inv.invoice_type_id = 2
              AND inv.transacted_at <= DATE_ADD(c.create_time, INTERVAL 51 DAY)
          ), 0)
          -
          COALESCE((
            SELECT SUM(inv.amount / ${RATE_CASE_INV})
            FROM avocode.invoices inv
            WHERE inv.customer_id = c.id
              AND inv.invoice_status_id = 1
              AND inv.invoice_type_id = 3
              AND inv.company_id != ${JACKCODE_COMPANY_ID}
              AND inv.transacted_at <= DATE_ADD(c.create_time, INTERVAL 51 DAY)
          ), 0)
        )
        FROM avocode.google_ads_details gad
        JOIN avocode.customers c ON c.id = gad.customer_id
        WHERE gad.utm_campaign = camp.google_campaign_id
          AND c.create_time <= DATE_SUB(CURDATE(), INTERVAL 51 DAY)
          AND c.create_time >= DATE_SUB(CURDATE(), INTERVAL 180 DAY)
      )), 0) as total_revenue_51d,

      -- Cohort size 51d (for context)
      COALESCE(SUM((
        SELECT COUNT(DISTINCT gad.customer_id)
        FROM avocode.google_ads_details gad
        JOIN avocode.customers c ON c.id = gad.customer_id
        WHERE gad.utm_campaign = camp.google_campaign_id
          AND c.create_time <= DATE_SUB(CURDATE(), INTERVAL 51 DAY)
      )), 0) as cohort_51d_size

    FROM avocode.websites w
    JOIN avocodebo.campaigns camp ON camp.website_id = w.id
    WHERE camp.google_campaign_id IS NOT NULL
      AND camp.google_campaign_id != ''
    GROUP BY w.id, w.name
    ORDER BY total_acquisitions DESC
  `,
  params: [],
  permissions: ["SELECT"],
};

/**
 * Aggregation by Company
 * Groups all campaigns by company_id
 */
export const companyAggregationQuery: QueryDefinition = {
  id: "business-by-company" as any,
  name: "Business Aggregation by Company",
  description: "Métricas agregadas por empresa (Avocode/KiwiKode/Jackcode)",
  sql: `
    SELECT
      co.id as company_id,
      co.name as company_name,

      -- Campaign counts
      COUNT(DISTINCT camp.id) as total_campaigns,
      SUM(CASE WHEN camp.active = 1 THEN 1 ELSE 0 END) as active_campaigns,
      COUNT(DISTINCT camp.website_id) as total_websites,
      MIN(DATEDIFF(CURDATE(), camp.started_at)) as min_campaign_age_days,

      -- Acquisitions
      COALESCE(SUM((
        SELECT COUNT(DISTINCT gad.customer_id)
        FROM avocode.google_ads_details gad
        WHERE gad.utm_campaign = camp.google_campaign_id
      )), 0) as total_acquisitions,

      -- First Rebills
      COALESCE(SUM((
        SELECT COUNT(DISTINCT gad.customer_id)
        FROM avocode.google_ads_details gad
        JOIN avocode.invoices i ON i.customer_id = gad.customer_id
        WHERE gad.utm_campaign = camp.google_campaign_id
          AND i.invoice_status_id = 1
          AND i.invoice_type_id = 2
      )), 0) as total_first_rebills,

      -- Revenue 51d
      COALESCE(SUM((
        SELECT SUM(
          COALESCE((
            SELECT SUM(inv.amount / ${RATE_CASE_INV})
            FROM avocode.invoices inv
            WHERE inv.customer_id = c.id
              AND inv.invoice_status_id = 1
              AND inv.invoice_type_id = 2
              AND inv.transacted_at <= DATE_ADD(c.create_time, INTERVAL 51 DAY)
          ), 0)
          -
          COALESCE((
            SELECT SUM(inv.amount / ${RATE_CASE_INV})
            FROM avocode.invoices inv
            WHERE inv.customer_id = c.id
              AND inv.invoice_status_id = 1
              AND inv.invoice_type_id = 3
              AND inv.company_id != ${JACKCODE_COMPANY_ID}
              AND inv.transacted_at <= DATE_ADD(c.create_time, INTERVAL 51 DAY)
          ), 0)
        )
        FROM avocode.google_ads_details gad
        JOIN avocode.customers c ON c.id = gad.customer_id
        WHERE gad.utm_campaign = camp.google_campaign_id
          AND c.create_time <= DATE_SUB(CURDATE(), INTERVAL 51 DAY)
          AND c.create_time >= DATE_SUB(CURDATE(), INTERVAL 180 DAY)
      )), 0) as total_revenue_51d,

      -- Cohort size 51d
      COALESCE(SUM((
        SELECT COUNT(DISTINCT gad.customer_id)
        FROM avocode.google_ads_details gad
        JOIN avocode.customers c ON c.id = gad.customer_id
        WHERE gad.utm_campaign = camp.google_campaign_id
          AND c.create_time <= DATE_SUB(CURDATE(), INTERVAL 51 DAY)
      )), 0) as cohort_51d_size

    FROM avocode.companies co
    JOIN avocodebo.campaigns camp ON camp.company_id = co.id
    WHERE camp.google_campaign_id IS NOT NULL
      AND camp.google_campaign_id != ''
    GROUP BY co.id, co.name
    ORDER BY total_acquisitions DESC
  `,
  params: [],
  permissions: ["SELECT"],
};

/**
 * Aggregation by Country
 * Groups all campaigns by country_id
 */
export const countryAggregationQuery: QueryDefinition = {
  id: "business-by-country" as any,
  name: "Business Aggregation by Country",
  description: "Métricas agregadas por país",
  sql: `
    SELECT
      ctr.id as country_id,
      ctr.name as country_name,
      ctr.code as country_code,

      -- Campaign counts
      COUNT(DISTINCT camp.id) as total_campaigns,
      SUM(CASE WHEN camp.active = 1 THEN 1 ELSE 0 END) as active_campaigns,
      MIN(DATEDIFF(CURDATE(), camp.started_at)) as min_campaign_age_days,

      -- Acquisitions
      COALESCE(SUM((
        SELECT COUNT(DISTINCT gad.customer_id)
        FROM avocode.google_ads_details gad
        WHERE gad.utm_campaign = camp.google_campaign_id
      )), 0) as total_acquisitions,

      -- First Rebills
      COALESCE(SUM((
        SELECT COUNT(DISTINCT gad.customer_id)
        FROM avocode.google_ads_details gad
        JOIN avocode.invoices i ON i.customer_id = gad.customer_id
        WHERE gad.utm_campaign = camp.google_campaign_id
          AND i.invoice_status_id = 1
          AND i.invoice_type_id = 2
      )), 0) as total_first_rebills,

      -- Revenue 51d
      COALESCE(SUM((
        SELECT SUM(
          COALESCE((
            SELECT SUM(inv.amount / ${RATE_CASE_INV})
            FROM avocode.invoices inv
            WHERE inv.customer_id = c.id
              AND inv.invoice_status_id = 1
              AND inv.invoice_type_id = 2
              AND inv.transacted_at <= DATE_ADD(c.create_time, INTERVAL 51 DAY)
          ), 0)
          -
          COALESCE((
            SELECT SUM(inv.amount / ${RATE_CASE_INV})
            FROM avocode.invoices inv
            WHERE inv.customer_id = c.id
              AND inv.invoice_status_id = 1
              AND inv.invoice_type_id = 3
              AND inv.company_id != ${JACKCODE_COMPANY_ID}
              AND inv.transacted_at <= DATE_ADD(c.create_time, INTERVAL 51 DAY)
          ), 0)
        )
        FROM avocode.google_ads_details gad
        JOIN avocode.customers c ON c.id = gad.customer_id
        WHERE gad.utm_campaign = camp.google_campaign_id
          AND c.create_time <= DATE_SUB(CURDATE(), INTERVAL 51 DAY)
          AND c.create_time >= DATE_SUB(CURDATE(), INTERVAL 180 DAY)
      )), 0) as total_revenue_51d,

      -- Cohort size 51d
      COALESCE(SUM((
        SELECT COUNT(DISTINCT gad.customer_id)
        FROM avocode.google_ads_details gad
        JOIN avocode.customers c ON c.id = gad.customer_id
        WHERE gad.utm_campaign = camp.google_campaign_id
          AND c.create_time <= DATE_SUB(CURDATE(), INTERVAL 51 DAY)
      )), 0) as cohort_51d_size

    FROM avocode.countries ctr
    JOIN avocodebo.campaigns camp ON camp.country_id = ctr.id
    WHERE camp.google_campaign_id IS NOT NULL
      AND camp.google_campaign_id != ''
    GROUP BY ctr.id, ctr.name, ctr.code
    HAVING total_acquisitions > 0
    ORDER BY total_acquisitions DESC
  `,
  params: [],
  permissions: ["SELECT"],
};

/**
 * Campaign list with service classification data
 * Used by BusinessAggregator to group by service (pattern-matched)
 */
export const campaignListForServiceQuery: QueryDefinition = {
  id: "campaigns-for-service-classification" as any,
  name: "Campaign List for Service Classification",
  description: "Lista de campañas con datos para clasificación por servicio (heurístico)",
  sql: `
    SELECT
      camp.id as campaign_id,
      camp.google_campaign_id,
      camp.name as campaign_name,
      camp.active,
      DATEDIFF(CURDATE(), camp.started_at) as campaign_age_days,

      -- Acquisitions
      (
        SELECT COUNT(DISTINCT gad.customer_id)
        FROM avocode.google_ads_details gad
        WHERE gad.utm_campaign = camp.google_campaign_id
      ) as total_acquisitions,

      -- First Rebills
      (
        SELECT COUNT(DISTINCT gad.customer_id)
        FROM avocode.google_ads_details gad
        JOIN avocode.invoices i ON i.customer_id = gad.customer_id
        WHERE gad.utm_campaign = camp.google_campaign_id
          AND i.invoice_status_id = 1
          AND i.invoice_type_id = 2
      ) as total_first_rebills,

      -- Revenue 51d
      COALESCE((
        SELECT SUM(
          COALESCE((
            SELECT SUM(inv.amount / ${RATE_CASE_INV})
            FROM avocode.invoices inv
            WHERE inv.customer_id = c.id
              AND inv.invoice_status_id = 1
              AND inv.invoice_type_id = 2
              AND inv.transacted_at <= DATE_ADD(c.create_time, INTERVAL 51 DAY)
          ), 0)
          -
          COALESCE((
            SELECT SUM(inv.amount / ${RATE_CASE_INV})
            FROM avocode.invoices inv
            WHERE inv.customer_id = c.id
              AND inv.invoice_status_id = 1
              AND inv.invoice_type_id = 3
              AND inv.company_id != ${JACKCODE_COMPANY_ID}
              AND inv.transacted_at <= DATE_ADD(c.create_time, INTERVAL 51 DAY)
          ), 0)
        )
        FROM avocode.google_ads_details gad
        JOIN avocode.customers c ON c.id = gad.customer_id
        WHERE gad.utm_campaign = camp.google_campaign_id
          AND c.create_time <= DATE_SUB(CURDATE(), INTERVAL 51 DAY)
          AND c.create_time >= DATE_SUB(CURDATE(), INTERVAL 180 DAY)
      ), 0) as total_revenue_51d,

      -- Cohort size 51d
      (
        SELECT COUNT(DISTINCT gad.customer_id)
        FROM avocode.google_ads_details gad
        JOIN avocode.customers c ON c.id = gad.customer_id
        WHERE gad.utm_campaign = camp.google_campaign_id
          AND c.create_time <= DATE_SUB(CURDATE(), INTERVAL 51 DAY)
      ) as cohort_51d_size

    FROM avocodebo.campaigns camp
    WHERE camp.google_campaign_id IS NOT NULL
      AND camp.google_campaign_id != ''
    ORDER BY total_acquisitions DESC
  `,
  params: [],
  permissions: ["SELECT"],
};
