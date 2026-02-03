import { QueryDefinition, QueryBuilder } from "../types.js";
import { buildCurrencyRateCase } from "../../../core/currency.js";

/**
 * Payback M1 Cohort Queries
 *
 * MODELO CORRECTO: Payback M1 por COHORTE, no cashflow.
 *
 * Cohorte: Clientes adquiridos 30-60 días atrás (M1 ya completado)
 * Fórmula: (Trial_Revenue + M1_Subscription_Revenue - Refunds_M1) / Ad_Spend_Cohorte
 * M1_Subscription_Revenue = ALL type_id=2 invoices within 30 days of acquisition
 *
 * TODOS los componentes deben pertenecer a la MISMA cohorte de adquisición.
 * PROHIBIDO mezclar revenue histórico con gasto reciente.
 *
 * HARDENING: Filter by website_id
 */

// Jackcode company_id (for Zoho refunds)
const JACKCODE_COMPANY_ID = 3;

// Currency conversion
const RATE_CASE = buildCurrencyRateCase('i.currency_code');
const RATE_CASE_ZI = buildCurrencyRateCase('inv.currency_code');

/**
 * Payback M1 Cohort - Complete calculation in one query
 *
 * Cohort window: Customers acquired 30-60 days ago
 * M1 Revenue: Trial + First Rebill - Refunds (within 30 days of acquisition)
 * Ad Spend: From the same 30-60 day period
 *
 * Returns:
 * - cohort_size: Number of customers in cohort
 * - trial_revenue_eur: Trial invoices for cohort
 * - first_rebill_revenue_eur: ALL subscription revenue in M1 (all type_id=2 invoices within 30d)
 * - refunds_m1_eur: Refunds within 30 days of acquisition
 * - m1_net_revenue_eur: Trial + First Rebill - Refunds
 * - ad_spend_eur: Ad spend for the cohort period
 * - payback_m1: M1 Net Revenue / Ad Spend
 * - first_rebills: Count of first rebills (for CPFR calculation)
 * - cpfr: Ad Spend / First Rebills (cohort-based)
 */
/**
 * OPTIMIZED: Uses JOINs instead of correlated subqueries for O(n) instead of O(n²)
 */
export const paybackM1CohortQuery: QueryBuilder = (websiteId?: number): QueryDefinition => {
  const websiteFilter = websiteId ? `AND c.website_id = ${websiteId}` : '';
  const adsWebsiteFilter = websiteId ? `AND camp.website_id = ${websiteId}` : '';

  return {
    id: "payback-m1-cohort",
    name: "Payback M1 (Cohorte 30-60d)",
    description: "Payback M1 real por cohorte. Clientes adquiridos 30-60 días atrás.",
    sql: `
      SELECT
        cohort.cohort_size,
        cohort.first_rebills,
        cohort.trial_revenue_eur,
        cohort.first_rebill_revenue_eur,
        cohort.refunds_m1_eur,
        cohort.m1_net_revenue_eur,
        ads.ad_spend_eur,
        ROUND(
          CASE
            WHEN ads.ad_spend_eur > 0 THEN cohort.m1_net_revenue_eur / ads.ad_spend_eur
            ELSE 0
          END,
          4
        ) as payback_m1,
        ROUND(
          CASE
            WHEN cohort.first_rebills > 0 THEN ads.ad_spend_eur / cohort.first_rebills
            ELSE 0
          END,
          2
        ) as cpfr_cohort

      FROM (
        -- Cohort calculation using pre-aggregated JOINs (OPTIMIZED)
        SELECT
          COUNT(DISTINCT c.id) as cohort_size,
          COUNT(DISTINCT rebills.customer_id) as first_rebills,
          ROUND(COALESCE(SUM(trial_rev.amount_eur), 0), 2) as trial_revenue_eur,
          ROUND(COALESCE(SUM(m1_rev.amount_eur), 0), 2) as first_rebill_revenue_eur,
          ROUND(COALESCE(SUM(COALESCE(ref.amount_eur, 0) + COALESCE(zref.amount_eur, 0)), 0), 2) as refunds_m1_eur,
          ROUND(
            COALESCE(SUM(trial_rev.amount_eur), 0) +
            COALESCE(SUM(m1_rev.amount_eur), 0) -
            COALESCE(SUM(COALESCE(ref.amount_eur, 0) + COALESCE(zref.amount_eur, 0)), 0),
            2
          ) as m1_net_revenue_eur

        FROM avocode.customers c

        -- Customers with at least one rebill in M1
        LEFT JOIN (
          SELECT DISTINCT i.customer_id
          FROM avocode.invoices i
          JOIN avocode.customers c2 ON i.customer_id = c2.id
          WHERE i.invoice_type_id = 2
            AND i.invoice_status_id = 1
            AND i.transacted_at <= DATE_ADD(c2.create_time, INTERVAL 30 DAY)
            AND c2.create_time >= DATE_SUB(CURDATE(), INTERVAL 60 DAY)
            AND c2.create_time < DATE_SUB(CURDATE(), INTERVAL 30 DAY)
            ${websiteFilter.replace('c.website_id', 'c2.website_id')}
        ) rebills ON rebills.customer_id = c.id

        -- Trial revenue (type 1)
        LEFT JOIN (
          SELECT i.customer_id, SUM(i.amount / ${RATE_CASE}) as amount_eur
          FROM avocode.invoices i
          JOIN avocode.customers c2 ON i.customer_id = c2.id
          WHERE i.invoice_type_id = 1
            AND i.invoice_status_id = 1
            AND i.transacted_at <= DATE_ADD(c2.create_time, INTERVAL 30 DAY)
            AND c2.create_time >= DATE_SUB(CURDATE(), INTERVAL 60 DAY)
            AND c2.create_time < DATE_SUB(CURDATE(), INTERVAL 30 DAY)
            ${websiteFilter.replace('c.website_id', 'c2.website_id')}
          GROUP BY i.customer_id
        ) trial_rev ON trial_rev.customer_id = c.id

        -- M1 subscription revenue (type 2 within 30 days)
        LEFT JOIN (
          SELECT i.customer_id, SUM(i.amount / ${RATE_CASE}) as amount_eur
          FROM avocode.invoices i
          JOIN avocode.customers c2 ON i.customer_id = c2.id
          WHERE i.invoice_type_id = 2
            AND i.invoice_status_id = 1
            AND i.transacted_at <= DATE_ADD(c2.create_time, INTERVAL 30 DAY)
            AND c2.create_time >= DATE_SUB(CURDATE(), INTERVAL 60 DAY)
            AND c2.create_time < DATE_SUB(CURDATE(), INTERVAL 30 DAY)
            ${websiteFilter.replace('c.website_id', 'c2.website_id')}
          GROUP BY i.customer_id
        ) m1_rev ON m1_rev.customer_id = c.id

        -- Refunds type 3 (non-Jackcode)
        LEFT JOIN (
          SELECT i.customer_id, SUM(i.amount / ${RATE_CASE}) as amount_eur
          FROM avocode.invoices i
          JOIN avocode.customers c2 ON i.customer_id = c2.id
          WHERE i.invoice_type_id = 3
            AND i.invoice_status_id = 1
            AND i.company_id != ${JACKCODE_COMPANY_ID}
            AND i.transacted_at <= DATE_ADD(c2.create_time, INTERVAL 30 DAY)
            AND c2.create_time >= DATE_SUB(CURDATE(), INTERVAL 60 DAY)
            AND c2.create_time < DATE_SUB(CURDATE(), INTERVAL 30 DAY)
            ${websiteFilter.replace('c.website_id', 'c2.website_id')}
          GROUP BY i.customer_id
        ) ref ON ref.customer_id = c.id

        -- Zoho refunds (Jackcode)
        LEFT JOIN (
          SELECT inv.customer_id, SUM(zr.amount / ${RATE_CASE_ZI}) as amount_eur
          FROM avocodebo.zoho_refunds zr
          JOIN avocodebo.zoho_credit_notes zcn ON zcn.id = zr.zoho_credit_note_id
          JOIN avocodebo.zoho_invoices zi ON zi.id = zcn.zoho_invoice_id
          JOIN avocode.invoices inv ON inv.id = zi.invoice_id
          JOIN avocode.customers c2 ON inv.customer_id = c2.id
          WHERE inv.company_id = ${JACKCODE_COMPANY_ID}
            AND zr.created_at <= DATE_ADD(c2.create_time, INTERVAL 30 DAY)
            AND c2.create_time >= DATE_SUB(CURDATE(), INTERVAL 60 DAY)
            AND c2.create_time < DATE_SUB(CURDATE(), INTERVAL 30 DAY)
            ${websiteFilter.replace('c.website_id', 'c2.website_id')}
          GROUP BY inv.customer_id
        ) zref ON zref.customer_id = c.id

        WHERE c.create_time >= DATE_SUB(CURDATE(), INTERVAL 60 DAY)
          AND c.create_time < DATE_SUB(CURDATE(), INTERVAL 30 DAY)
          ${websiteFilter}
      ) cohort,

      -- Ad spend for the same cohort period (30-60 days ago)
      (
        SELECT
          ROUND(COALESCE(SUM(
            CASE
              WHEN camp.currency_id = 2 THEN a.cost  -- EUR
              WHEN camp.currency_id = 4 THEN a.cost / 5.0  -- RON to EUR
              ELSE a.cost
            END
          ), 0), 2) as ad_spend_eur
        FROM avocodebo.ads a
        INNER JOIN avocodebo.campaigns camp ON a.campaign_id = camp.id
        WHERE a.date >= DATE_SUB(CURDATE(), INTERVAL 60 DAY)
          AND a.date < DATE_SUB(CURDATE(), INTERVAL 30 DAY)
          ${adsWebsiteFilter}
      ) ads
    `,
    params: [],
    permissions: ["SELECT"],
  };
};
