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
 * Revenue by website_id
 */
export function revenueByWebsiteQuery(dateRange: DateRangeConfig): QueryDefinition {
  const dateFilter = dateRange.type === 'period'
    ? `i.transacted_at >= DATE_SUB(CURDATE(), INTERVAL ${dateRange.days} DAY)`
    : `i.transacted_at >= '${dateRange.startDate}' AND i.transacted_at < '${dateRange.endDate}'`;

  return {
    id: "websites-revenue" as any,
    name: `Revenue by Website (${dateRange.type === 'period' ? dateRange.days + 'd' : 'cohort'})`,
    description: "Gross revenue aggregated by website_id, converted to EUR",
    sql: `
      SELECT
        s.website_id,
        SUM(i.amount / ${RATE_CASE_INV}) as gross_revenue_eur,
        SUM(CASE WHEN i.invoice_type_id = 1 THEN i.amount / ${RATE_CASE_INV} ELSE 0 END) as trial_revenue_eur,
        SUM(CASE WHEN i.invoice_type_id = 2 THEN i.amount / ${RATE_CASE_INV} ELSE 0 END) as rebill_revenue_eur
      FROM avocode.invoices i
      INNER JOIN avocode.subscriptions s ON s.customer_id = i.customer_id
      WHERE ${dateFilter}
        AND i.invoice_status_id = 1
        AND i.invoice_type_id IN (1, 2)
      GROUP BY s.website_id
    `,
    params: [],
    permissions: ["SELECT"],
  };
}

/**
 * Refunds by website_id (amount-based for display)
 */
export function refundsByWebsiteQuery(dateRange: DateRangeConfig): QueryDefinition {
  const dateFilterInv = dateRange.type === 'period'
    ? `i.transacted_at >= DATE_SUB(CURDATE(), INTERVAL ${dateRange.days} DAY)`
    : `i.transacted_at >= '${dateRange.startDate}' AND i.transacted_at < '${dateRange.endDate}'`;

  const dateFilterZoho = dateRange.type === 'period'
    ? `zr.created_at >= DATE_SUB(CURDATE(), INTERVAL ${dateRange.days} DAY)`
    : `zr.created_at >= '${dateRange.startDate}' AND zr.created_at < '${dateRange.endDate}'`;

  return {
    id: "websites-refunds" as any,
    name: `Refunds by Website (${dateRange.type === 'period' ? dateRange.days + 'd' : 'cohort'})`,
    description: "Refunds aggregated by website_id, converted to EUR",
    sql: `
      SELECT
        website_id,
        SUM(refund_eur) as total_refunds_eur
      FROM (
        -- Invoice refunds (Avocode/KiwiKode) by website
        SELECT
          s.website_id,
          SUM(i.amount / ${RATE_CASE_INV}) as refund_eur
        FROM avocode.invoices i
        INNER JOIN avocode.subscriptions s ON s.customer_id = i.customer_id
        WHERE ${dateFilterInv}
          AND i.invoice_status_id = 1
          AND i.invoice_type_id = 3
          AND i.company_id != 3
        GROUP BY s.website_id

        UNION ALL

        -- Zoho refunds (Jackcode) - attributed to website via invoice
        SELECT
          s.website_id,
          SUM(zr.amount / CASE
            WHEN COALESCE(zc.currency_code, zosc.currency_code) = 'EUR' THEN 1
            WHEN COALESCE(zc.currency_code, zosc.currency_code) = 'RON' THEN ${RON_RATE}
            ELSE 1
          END) as refund_eur
        FROM avocodebo.zoho_refunds zr
        LEFT JOIN avocodebo.zoho_credit_notes zcn ON zr.zoho_credit_note_id = zcn.id
        LEFT JOIN avocodebo.zoho_customers zc ON zcn.zoho_customer_id = zc.id
        LEFT JOIN avocodebo.zoho_one_shot_customers zosc ON zcn.zoho_one_shot_customer_id = zosc.id
        LEFT JOIN avocodebo.zoho_invoices zi ON zi.id = zcn.zoho_invoice_id
        LEFT JOIN avocode.invoices inv ON inv.id = zi.invoice_id
        LEFT JOIN avocode.subscriptions s ON s.customer_id = inv.customer_id
        WHERE ${dateFilterZoho}
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
