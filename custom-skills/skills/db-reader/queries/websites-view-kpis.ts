import { QueryDefinition } from "../types.js";
import { buildCurrencyRateCase } from "../../../core/currency.js";

/**
 * Websites View KPIs - Queries for the dashboard websites view
 *
 * All amounts converted to EUR using buildCurrencyRateCase()
 * Supports: EUR, USD, RON, HUF, CLP, BRL, GBP, etc.
 */

const RATE_CASE_INV = buildCurrencyRateCase('i.currency_code');
const RON_RATE = 4.97;

export interface DateRangeConfig {
  days: number;
  type: 'period' | 'cohort';
  startDate?: string;
  endDate?: string;
}

/**
 * Revenue M1 by website_id (COHORT-BASED)
 * Only includes trial revenue + first rebill revenue from customers ACQUIRED in the period
 */
export function revenueByWebsiteQuery(dateRange: DateRangeConfig): QueryDefinition {
  const dateFilter = dateRange.type === 'period'
    ? `c.create_time >= DATE_SUB(CURDATE(), INTERVAL ${dateRange.days} DAY)`
    : `c.create_time >= '${dateRange.startDate}' AND c.create_time < '${dateRange.endDate}'`;

  return {
    id: "websites-revenue-m1" as any,
    name: `Revenue M1 by Website (${dateRange.type === 'period' ? dateRange.days + 'd' : 'cohort'})`,
    description: "Revenue M1 from cohort acquired in period (trials + first rebills only)",
    sql: `
      SELECT
        s.website_id,
        -- Trial revenue from cohort
        COALESCE(SUM(trial_inv.amount / ${RATE_CASE_INV}), 0) as trial_revenue_eur,
        -- First rebill revenue from cohort
        COALESCE(SUM(fr_inv.amount / ${RATE_CASE_INV}), 0) as first_rebill_revenue_eur,
        -- Total M1 revenue
        COALESCE(SUM(trial_inv.amount / ${RATE_CASE_INV}), 0) + COALESCE(SUM(fr_inv.amount / ${RATE_CASE_INV}), 0) as gross_revenue_eur
      FROM avocode.customers c
      INNER JOIN avocode.subscriptions s ON s.customer_id = c.id
      -- Trial invoice
      LEFT JOIN avocode.invoices trial_inv ON trial_inv.customer_id = c.id
        AND trial_inv.invoice_type_id = 1
        AND trial_inv.invoice_status_id = 1
      -- First rebill invoice (only the first one)
      LEFT JOIN (
        SELECT i.customer_id, i.amount, i.currency_code
        FROM avocode.invoices i
        WHERE i.invoice_type_id = 2
          AND i.invoice_status_id = 1
          AND i.id = (
            SELECT MIN(i2.id)
            FROM avocode.invoices i2
            WHERE i2.customer_id = i.customer_id
              AND i2.invoice_type_id = 2
              AND i2.invoice_status_id = 1
          )
      ) fr_inv ON fr_inv.customer_id = c.id
      WHERE ${dateFilter}
      GROUP BY s.website_id
    `,
    params: [],
    permissions: ["SELECT"],
  };
}

/**
 * Refunds M1 by website_id (COHORT-BASED)
 * Only includes refunds from customers ACQUIRED in the period
 */
export function refundsByWebsiteQuery(dateRange: DateRangeConfig): QueryDefinition {
  const dateFilter = dateRange.type === 'period'
    ? `c.create_time >= DATE_SUB(CURDATE(), INTERVAL ${dateRange.days} DAY)`
    : `c.create_time >= '${dateRange.startDate}' AND c.create_time < '${dateRange.endDate}'`;

  return {
    id: "websites-refunds-m1" as any,
    name: `Refunds M1 by Website (${dateRange.type === 'period' ? dateRange.days + 'd' : 'cohort'})`,
    description: "Refunds from cohort acquired in period, converted to EUR",
    sql: `
      SELECT
        website_id,
        SUM(refund_eur) as total_refunds_eur
      FROM (
        -- Invoice refunds (Avocode/KiwiKode) for cohort
        SELECT
          s.website_id,
          SUM(ref_inv.amount / ${RATE_CASE_INV}) as refund_eur
        FROM avocode.customers c
        INNER JOIN avocode.subscriptions s ON s.customer_id = c.id
        INNER JOIN avocode.invoices ref_inv ON ref_inv.customer_id = c.id
          AND ref_inv.invoice_type_id = 3
          AND ref_inv.invoice_status_id = 1
          AND ref_inv.company_id != 3
        WHERE ${dateFilter}
        GROUP BY s.website_id

        UNION ALL

        -- Zoho refunds (Jackcode) for cohort
        SELECT
          s.website_id,
          SUM(zr.amount / CASE
            WHEN COALESCE(zc.currency_code, zosc.currency_code) = 'EUR' THEN 1
            WHEN COALESCE(zc.currency_code, zosc.currency_code) = 'RON' THEN ${RON_RATE}
            ELSE 1
          END) as refund_eur
        FROM avocode.customers c
        INNER JOIN avocode.subscriptions s ON s.customer_id = c.id
        INNER JOIN avocodebo.zoho_refunds zr ON 1=1
        LEFT JOIN avocodebo.zoho_credit_notes zcn ON zr.zoho_credit_note_id = zcn.id
        LEFT JOIN avocodebo.zoho_customers zc ON zcn.zoho_customer_id = zc.id
        LEFT JOIN avocodebo.zoho_one_shot_customers zosc ON zcn.zoho_one_shot_customer_id = zosc.id
        LEFT JOIN avocodebo.zoho_invoices zi ON zi.id = zcn.zoho_invoice_id
        LEFT JOIN avocode.invoices inv ON inv.id = zi.invoice_id
        WHERE ${dateFilter}
          AND inv.customer_id = c.id
        GROUP BY s.website_id
      ) combined
      GROUP BY website_id
    `,
    params: [],
    permissions: ["SELECT"],
  };
}

/**
 * Ad Spend by website_id
 */
export function adSpendByWebsiteQuery(dateRange: DateRangeConfig): QueryDefinition {
  const dateFilter = dateRange.type === 'period'
    ? `a.date >= DATE_SUB(CURDATE(), INTERVAL ${dateRange.days} DAY)`
    : `a.date >= '${dateRange.startDate}' AND a.date < '${dateRange.endDate}'`;

  return {
    id: "websites-ad-spend" as any,
    name: `Ad Spend by Website (${dateRange.type === 'period' ? dateRange.days + 'd' : 'cohort'})`,
    description: "Ad spend by website_id, converted to EUR",
    sql: `
      SELECT
        c.website_id,
        SUM(a.cost / CASE c.currency_id
          WHEN 2 THEN 1
          WHEN 4 THEN ${RON_RATE}
          ELSE 1
        END) as total_spend_eur
      FROM avocodebo.ads a
      INNER JOIN avocodebo.campaigns c ON a.campaign_id = c.id
      WHERE ${dateFilter}
        AND c.website_id IN (1, 3, 4)
      GROUP BY c.website_id
    `,
    params: [],
    permissions: ["SELECT"],
  };
}

/**
 * Trials and First Rebills by website_id (cohort-based FRR)
 */
export function frrByWebsiteQuery(dateRange: DateRangeConfig): QueryDefinition {
  const dateFilter = dateRange.type === 'period'
    ? `c.create_time >= DATE_SUB(CURDATE(), INTERVAL ${dateRange.days} DAY)`
    : `c.create_time >= '${dateRange.startDate}' AND c.create_time < '${dateRange.endDate}'`;

  return {
    id: "websites-frr" as any,
    name: `FRR by Website (${dateRange.type === 'period' ? dateRange.days + 'd' : 'cohort'})`,
    description: "First Rebill Rate by website for customers acquired in period",
    sql: `
      SELECT
        s.website_id,
        COUNT(DISTINCT c.id) as trial_count,
        COUNT(DISTINCT CASE WHEN fr.customer_id IS NOT NULL THEN c.id END) as first_rebill_count
      FROM avocode.customers c
      INNER JOIN avocode.subscriptions s ON s.customer_id = c.id
      LEFT JOIN (
        SELECT
          i.customer_id,
          MIN(i.id) as first_rebill_id
        FROM avocode.invoices i
        WHERE i.invoice_type_id = 2
          AND i.invoice_status_id = 1
        GROUP BY i.customer_id
      ) fr ON fr.customer_id = c.id
      WHERE ${dateFilter}
      GROUP BY s.website_id
    `,
    params: [],
    permissions: ["SELECT"],
  };
}

/**
 * Refund Rate M1 by website_id (transaction-based)
 */
export function refundRateM1ByWebsiteQuery(dateRange: DateRangeConfig): QueryDefinition {
  const dateFilter = dateRange.type === 'period'
    ? `c.create_time >= DATE_SUB(CURDATE(), INTERVAL ${dateRange.days} DAY)`
    : `c.create_time >= '${dateRange.startDate}' AND c.create_time < '${dateRange.endDate}'`;

  return {
    id: "websites-refund-rate-m1" as any,
    name: `Refund Rate M1 by Website (${dateRange.type === 'period' ? dateRange.days + 'd' : 'cohort'})`,
    description: "Transaction-based refund rate on first rebills by website",
    sql: `
      SELECT
        s.website_id,
        COUNT(DISTINCT fr.customer_id) as total_first_rebills,
        COUNT(DISTINCT CASE
          WHEN fr.company_id != 3 AND ref_inv.id IS NOT NULL THEN fr.customer_id
          WHEN fr.company_id = 3 AND zoho_ref.customer_id IS NOT NULL THEN fr.customer_id
          ELSE NULL
        END) as refunded_first_rebills
      FROM avocode.customers c
      INNER JOIN avocode.subscriptions s ON s.customer_id = c.id
      INNER JOIN (
        SELECT
          i.customer_id,
          i.id as first_rebill_id,
          i.company_id
        FROM avocode.invoices i
        WHERE i.invoice_type_id = 2
          AND i.invoice_status_id = 1
          AND i.id = (
            SELECT MIN(i2.id)
            FROM avocode.invoices i2
            WHERE i2.customer_id = i.customer_id
              AND i2.invoice_type_id = 2
              AND i2.invoice_status_id = 1
          )
      ) fr ON fr.customer_id = c.id
      LEFT JOIN avocode.invoices ref_inv ON ref_inv.customer_id = c.id
        AND ref_inv.invoice_type_id = 3
        AND ref_inv.invoice_status_id = 1
        AND ref_inv.company_id != 3
      LEFT JOIN (
        SELECT DISTINCT inv.customer_id
        FROM avocodebo.zoho_refunds zr
        JOIN avocodebo.zoho_credit_notes zcn ON zcn.id = zr.zoho_credit_note_id
        JOIN avocodebo.zoho_invoices zi ON zi.id = zcn.zoho_invoice_id
        JOIN avocode.invoices inv ON inv.id = zi.invoice_id
        WHERE inv.company_id = 3
      ) zoho_ref ON zoho_ref.customer_id = c.id AND fr.company_id = 3
      WHERE ${dateFilter}
      GROUP BY s.website_id
    `,
    params: [],
    permissions: ["SELECT"],
  };
}

/**
 * Dispute Rate by website_id
 */
export function disputeRateByWebsiteQuery(dateRange: DateRangeConfig): QueryDefinition {
  const dateFilter = dateRange.type === 'period'
    ? `i.transacted_at >= DATE_SUB(CURDATE(), INTERVAL ${dateRange.days} DAY)`
    : `i.transacted_at >= '${dateRange.startDate}' AND i.transacted_at < '${dateRange.endDate}'`;

  return {
    id: "websites-dispute-rate" as any,
    name: `Dispute Rate by Website (${dateRange.type === 'period' ? dateRange.days + 'd' : 'cohort'})`,
    description: "Chargeback rate by website_id",
    sql: `
      SELECT
        s.website_id,
        COUNT(*) as total_transactions,
        SUM(CASE WHEN i.invoice_type_id = 4 THEN 1 ELSE 0 END) as chargeback_count
      FROM avocode.invoices i
      INNER JOIN avocode.subscriptions s ON s.customer_id = i.customer_id
      WHERE ${dateFilter}
        AND i.invoice_status_id = 1
        AND i.invoice_type_id IN (1, 2, 4)
      GROUP BY s.website_id
    `,
    params: [],
    permissions: ["SELECT"],
  };
}
