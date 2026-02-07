import { QueryDefinition } from "../types.js";
import { buildCurrencyRateCase } from "../../../core/currency.js";

/**
 * Companies View KPIs - Queries for the dashboard companies view
 *
 * Aggregates data by company_id:
 * - Avocode (company_id = 1): Revenue from invoices, NO ad spend
 * - KiwiKode (company_id = 2): Revenue from invoices, ad spend from website_id=3
 * - Jackcode (company_id = 3): Revenue from invoices, ad spend from website_id=1,4
 */

const RATE_CASE_INV = buildCurrencyRateCase('i.currency_code');
const RON_RATE = 4.97;

export interface DateRangeConfig {
  days: number;
  type: 'period' | 'cohort';
  startDate?: string;
  endDate?: string;
}

// Company to website mapping for ad spend attribution
const COMPANY_AD_SPEND_WEBSITES: Record<number, number[]> = {
  1: [],        // Avocode - no ad spend
  2: [3],       // KiwiKode - ConviertePDF
  3: [1, 4],    // Jackcode - ConversiePDF + DeviceFinder
};

/**
 * Revenue by company_id
 */
export function revenueByCompanyQuery(dateRange: DateRangeConfig): QueryDefinition {
  const dateFilter = dateRange.type === 'period'
    ? `i.transacted_at >= DATE_SUB(CURDATE(), INTERVAL ${dateRange.days} DAY)`
    : `i.transacted_at >= '${dateRange.startDate}' AND i.transacted_at < '${dateRange.endDate}'`;

  return {
    id: "companies-revenue" as any,
    name: `Revenue by Company (${dateRange.type === 'period' ? dateRange.days + 'd' : 'cohort'})`,
    description: "Gross revenue aggregated by company_id",
    sql: `
      SELECT
        i.company_id,
        SUM(i.amount / ${RATE_CASE_INV}) as gross_revenue_eur,
        SUM(CASE WHEN i.invoice_type_id = 1 THEN i.amount / ${RATE_CASE_INV} ELSE 0 END) as trial_revenue_eur,
        SUM(CASE WHEN i.invoice_type_id = 2 THEN i.amount / ${RATE_CASE_INV} ELSE 0 END) as rebill_revenue_eur,
        COUNT(CASE WHEN i.invoice_type_id = 1 THEN 1 END) as trial_count,
        COUNT(CASE WHEN i.invoice_type_id = 2 THEN 1 END) as rebill_count
      FROM avocode.invoices i
      WHERE ${dateFilter}
        AND i.invoice_status_id = 1
        AND i.invoice_type_id IN (1, 2)
      GROUP BY i.company_id
    `,
    params: [],
    permissions: ["SELECT"],
  };
}

/**
 * Refunds by company_id
 * - Avocode/KiwiKode: invoice_type_id = 3
 * - Jackcode: via zoho_refunds
 */
export function refundsByCompanyQuery(dateRange: DateRangeConfig): QueryDefinition {
  const dateFilterInv = dateRange.type === 'period'
    ? `i.transacted_at >= DATE_SUB(CURDATE(), INTERVAL ${dateRange.days} DAY)`
    : `i.transacted_at >= '${dateRange.startDate}' AND i.transacted_at < '${dateRange.endDate}'`;

  const dateFilterZoho = dateRange.type === 'period'
    ? `zr.created_at >= DATE_SUB(CURDATE(), INTERVAL ${dateRange.days} DAY)`
    : `zr.created_at >= '${dateRange.startDate}' AND zr.created_at < '${dateRange.endDate}'`;

  return {
    id: "companies-refunds" as any,
    name: `Refunds by Company (${dateRange.type === 'period' ? dateRange.days + 'd' : 'cohort'})`,
    description: "Refunds aggregated by company_id",
    sql: `
      SELECT
        company_id,
        SUM(refund_eur) as total_refunds_eur,
        SUM(refund_count) as refund_count
      FROM (
        -- Invoice refunds (Avocode/KiwiKode)
        SELECT
          i.company_id,
          SUM(i.amount / ${RATE_CASE_INV}) as refund_eur,
          COUNT(*) as refund_count
        FROM avocode.invoices i
        WHERE ${dateFilterInv}
          AND i.invoice_status_id = 1
          AND i.invoice_type_id = 3
          AND i.company_id != 3
        GROUP BY i.company_id

        UNION ALL

        -- Zoho refunds (Jackcode)
        SELECT
          3 as company_id,
          SUM(zr.amount / CASE
            WHEN COALESCE(zc.currency_code, zosc.currency_code) = 'EUR' THEN 1
            WHEN COALESCE(zc.currency_code, zosc.currency_code) = 'RON' THEN ${RON_RATE}
            ELSE 1
          END) as refund_eur,
          COUNT(*) as refund_count
        FROM avocodebo.zoho_refunds zr
        LEFT JOIN avocodebo.zoho_credit_notes zcn ON zr.zoho_credit_note_id = zcn.id
        LEFT JOIN avocodebo.zoho_customers zc ON zcn.zoho_customer_id = zc.id
        LEFT JOIN avocodebo.zoho_one_shot_customers zosc ON zcn.zoho_one_shot_customer_id = zosc.id
        WHERE ${dateFilterZoho}
      ) combined
      GROUP BY company_id
    `,
    params: [],
    permissions: ["SELECT"],
  };
}

/**
 * Ad Spend by company (attributed by website ownership)
 * - Avocode: €0
 * - KiwiKode: website_id = 3
 * - Jackcode: website_id IN (1, 4)
 */
export function adSpendByCompanyQuery(dateRange: DateRangeConfig): QueryDefinition {
  const dateFilter = dateRange.type === 'period'
    ? `a.date >= DATE_SUB(CURDATE(), INTERVAL ${dateRange.days} DAY)`
    : `a.date >= '${dateRange.startDate}' AND a.date < '${dateRange.endDate}'`;

  return {
    id: "companies-ad-spend" as any,
    name: `Ad Spend by Company (${dateRange.type === 'period' ? dateRange.days + 'd' : 'cohort'})`,
    description: "Ad spend attributed to companies by website ownership",
    sql: `
      SELECT
        CASE
          WHEN c.website_id = 3 THEN 2
          WHEN c.website_id IN (1, 4) THEN 3
          ELSE 0
        END as company_id,
        SUM(a.cost / CASE c.currency_id
          WHEN 2 THEN 1
          WHEN 4 THEN ${RON_RATE}
          ELSE 1
        END) as total_spend_eur
      FROM avocodebo.ads a
      INNER JOIN avocodebo.campaigns c ON a.campaign_id = c.id
      WHERE ${dateFilter}
        AND c.website_id IN (1, 3, 4)
      GROUP BY CASE
        WHEN c.website_id = 3 THEN 2
        WHEN c.website_id IN (1, 4) THEN 3
        ELSE 0
      END
    `,
    params: [],
    permissions: ["SELECT"],
  };
}

/**
 * First Rebills and FRR by company_id (cohort-based)
 */
export function frrByCompanyQuery(dateRange: DateRangeConfig): QueryDefinition {
  const dateFilter = dateRange.type === 'period'
    ? `c.create_time >= DATE_SUB(CURDATE(), INTERVAL ${dateRange.days} DAY)`
    : `c.create_time >= '${dateRange.startDate}' AND c.create_time < '${dateRange.endDate}'`;

  return {
    id: "companies-frr" as any,
    name: `FRR by Company (${dateRange.type === 'period' ? dateRange.days + 'd' : 'cohort'})`,
    description: "First Rebill Rate by company for customers acquired in period",
    sql: `
      SELECT
        trial_inv.company_id,
        COUNT(DISTINCT c.id) as trial_count,
        COUNT(DISTINCT CASE WHEN fr.customer_id IS NOT NULL THEN c.id END) as first_rebill_count
      FROM avocode.customers c
      INNER JOIN avocode.invoices trial_inv ON trial_inv.customer_id = c.id
        AND trial_inv.invoice_type_id = 1
        AND trial_inv.invoice_status_id = 1
        AND trial_inv.id = (
          SELECT MIN(i2.id)
          FROM avocode.invoices i2
          WHERE i2.customer_id = c.id
            AND i2.invoice_type_id = 1
            AND i2.invoice_status_id = 1
        )
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
      GROUP BY trial_inv.company_id
    `,
    params: [],
    permissions: ["SELECT"],
  };
}

/**
 * Refund Rate M1 by company_id (transaction-based)
 */
export function refundRateM1ByCompanyQuery(dateRange: DateRangeConfig): QueryDefinition {
  const dateFilter = dateRange.type === 'period'
    ? `c.create_time >= DATE_SUB(CURDATE(), INTERVAL ${dateRange.days} DAY)`
    : `c.create_time >= '${dateRange.startDate}' AND c.create_time < '${dateRange.endDate}'`;

  return {
    id: "companies-refund-rate-m1" as any,
    name: `Refund Rate M1 by Company (${dateRange.type === 'period' ? dateRange.days + 'd' : 'cohort'})`,
    description: "Transaction-based refund rate on first rebills by company",
    sql: `
      SELECT
        fr.company_id,
        COUNT(DISTINCT fr.customer_id) as total_first_rebills,
        COUNT(DISTINCT CASE
          WHEN fr.company_id != 3 AND ref_inv.id IS NOT NULL THEN fr.customer_id
          WHEN fr.company_id = 3 AND zoho_ref.customer_id IS NOT NULL THEN fr.customer_id
          ELSE NULL
        END) as refunded_first_rebills
      FROM avocode.customers c
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
      GROUP BY fr.company_id
    `,
    params: [],
    permissions: ["SELECT"],
  };
}

/**
 * Dispute Rate by company_id
 */
export function disputeRateByCompanyQuery(dateRange: DateRangeConfig): QueryDefinition {
  const dateFilter = dateRange.type === 'period'
    ? `i.transacted_at >= DATE_SUB(CURDATE(), INTERVAL ${dateRange.days} DAY)`
    : `i.transacted_at >= '${dateRange.startDate}' AND i.transacted_at < '${dateRange.endDate}'`;

  return {
    id: "companies-dispute-rate" as any,
    name: `Dispute Rate by Company (${dateRange.type === 'period' ? dateRange.days + 'd' : 'cohort'})`,
    description: "Chargeback rate by company_id",
    sql: `
      SELECT
        i.company_id,
        COUNT(*) as total_transactions,
        SUM(CASE WHEN i.invoice_type_id = 4 THEN 1 ELSE 0 END) as chargeback_count
      FROM avocode.invoices i
      WHERE ${dateFilter}
        AND i.invoice_status_id = 1
        AND i.invoice_type_id IN (1, 2, 4)
      GROUP BY i.company_id
    `,
    params: [],
    permissions: ["SELECT"],
  };
}
