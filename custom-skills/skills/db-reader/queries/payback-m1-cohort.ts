import { QueryDefinition, QueryBuilder } from "../types.js";
import { buildCurrencyRateCase } from "../../../core/currency.js";

/**
 * Payback M1 Cohort Queries
 *
 * MODELO CORRECTO: Payback M1 por COHORTE, no cashflow.
 *
 * Cohorte: Clientes adquiridos 30-60 días atrás (M1 ya completado)
 * Fórmula: (Trial_Revenue + First_Rebill_Revenue - Refunds_M1) / Ad_Spend_Cohorte
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
 * - first_rebill_revenue_eur: First rebill invoices for cohort
 * - refunds_m1_eur: Refunds within 30 days of acquisition
 * - m1_net_revenue_eur: Trial + First Rebill - Refunds
 * - ad_spend_eur: Ad spend for the cohort period
 * - payback_m1: M1 Net Revenue / Ad Spend
 * - first_rebills: Count of first rebills (for CPFR calculation)
 * - cpfr: Ad Spend / First Rebills (cohort-based)
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
        -- Cohort revenue calculation
        SELECT
          COUNT(DISTINCT c.id) as cohort_size,

          -- Count of first rebills (customers who had at least one rebill)
          SUM(
            CASE WHEN EXISTS (
              SELECT 1 FROM avocode.invoices i
              WHERE i.customer_id = c.id
                AND i.invoice_type_id = 2
                AND i.invoice_status_id = 1
                AND i.transacted_at <= DATE_ADD(c.create_time, INTERVAL 30 DAY)
            ) THEN 1 ELSE 0 END
          ) as first_rebills,

          -- Trial revenue (invoice_type_id = 1)
          ROUND(COALESCE(SUM(
            (SELECT SUM(i.amount / ${RATE_CASE})
             FROM avocode.invoices i
             WHERE i.customer_id = c.id
               AND i.invoice_type_id = 1
               AND i.invoice_status_id = 1
               AND i.transacted_at <= DATE_ADD(c.create_time, INTERVAL 30 DAY))
          ), 0), 2) as trial_revenue_eur,

          -- First rebill revenue (first invoice_type_id = 2 per customer)
          ROUND(COALESCE(SUM(
            (SELECT i.amount / ${RATE_CASE}
             FROM avocode.invoices i
             WHERE i.customer_id = c.id
               AND i.invoice_type_id = 2
               AND i.invoice_status_id = 1
               AND i.transacted_at <= DATE_ADD(c.create_time, INTERVAL 30 DAY)
             ORDER BY i.id ASC
             LIMIT 1)
          ), 0), 2) as first_rebill_revenue_eur,

          -- Refunds M1 (within 30 days of acquisition)
          -- Type 3 refunds (non-Jackcode) + Zoho refunds (Jackcode)
          ROUND(COALESCE(SUM(
            -- Invoice type 3 refunds (Avocode/Kiwikode)
            COALESCE((
              SELECT SUM(i.amount / ${RATE_CASE})
              FROM avocode.invoices i
              WHERE i.customer_id = c.id
                AND i.invoice_type_id = 3
                AND i.invoice_status_id = 1
                AND i.company_id != ${JACKCODE_COMPANY_ID}
                AND i.transacted_at <= DATE_ADD(c.create_time, INTERVAL 30 DAY)
            ), 0)
            +
            -- Zoho refunds (Jackcode)
            COALESCE((
              SELECT SUM(zr.amount / ${RATE_CASE_ZI})
              FROM avocodebo.zoho_refunds zr
              JOIN avocodebo.zoho_credit_notes zcn ON zcn.id = zr.zoho_credit_note_id
              JOIN avocodebo.zoho_invoices zi ON zi.id = zcn.zoho_invoice_id
              JOIN avocode.invoices inv ON inv.id = zi.invoice_id
              WHERE inv.customer_id = c.id
                AND inv.company_id = ${JACKCODE_COMPANY_ID}
                AND zr.created_at <= DATE_ADD(c.create_time, INTERVAL 30 DAY)
            ), 0)
          ), 0), 2) as refunds_m1_eur,

          -- M1 Net Revenue = Trial + First Rebill - Refunds
          ROUND(
            COALESCE(SUM(
              -- Trial
              COALESCE((
                SELECT SUM(i.amount / ${RATE_CASE})
                FROM avocode.invoices i
                WHERE i.customer_id = c.id
                  AND i.invoice_type_id = 1
                  AND i.invoice_status_id = 1
                  AND i.transacted_at <= DATE_ADD(c.create_time, INTERVAL 30 DAY)
              ), 0)
              +
              -- First Rebill
              COALESCE((
                SELECT i.amount / ${RATE_CASE}
                FROM avocode.invoices i
                WHERE i.customer_id = c.id
                  AND i.invoice_type_id = 2
                  AND i.invoice_status_id = 1
                  AND i.transacted_at <= DATE_ADD(c.create_time, INTERVAL 30 DAY)
                ORDER BY i.id ASC
                LIMIT 1
              ), 0)
              -
              -- Refunds
              COALESCE((
                SELECT SUM(i.amount / ${RATE_CASE})
                FROM avocode.invoices i
                WHERE i.customer_id = c.id
                  AND i.invoice_type_id = 3
                  AND i.invoice_status_id = 1
                  AND i.company_id != ${JACKCODE_COMPANY_ID}
                  AND i.transacted_at <= DATE_ADD(c.create_time, INTERVAL 30 DAY)
              ), 0)
              -
              COALESCE((
                SELECT SUM(zr.amount / ${RATE_CASE_ZI})
                FROM avocodebo.zoho_refunds zr
                JOIN avocodebo.zoho_credit_notes zcn ON zcn.id = zr.zoho_credit_note_id
                JOIN avocodebo.zoho_invoices zi ON zi.id = zcn.zoho_invoice_id
                JOIN avocode.invoices inv ON inv.id = zi.invoice_id
                WHERE inv.customer_id = c.id
                  AND inv.company_id = ${JACKCODE_COMPANY_ID}
                  AND zr.created_at <= DATE_ADD(c.create_time, INTERVAL 30 DAY)
              ), 0)
            ), 0),
          2) as m1_net_revenue_eur

        FROM avocode.customers c
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
