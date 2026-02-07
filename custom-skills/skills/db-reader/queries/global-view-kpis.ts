import { QueryDefinition } from "../types.js";
import { buildCurrencyRateCase } from "../../../core/currency.js";

/**
 * Global View KPIs - Queries for the dashboard global view
 *
 * Supports dynamic date ranges: 7d, 14d, 30d, 60d
 * All amounts are converted to EUR using buildCurrencyRateCase
 */

const RATE_CASE_INV = buildCurrencyRateCase('i.currency_code');
const RATE_CASE_ADS_EUR = 1; // ads table uses currency_id (2=EUR, 4=RON)
const RON_RATE = 4.97;

export interface DateRangeConfig {
  days: number;
  type: 'period' | 'cohort';
  // For cohort: startDate and endDate
  startDate?: string; // YYYY-MM-DD
  endDate?: string;
}

/**
 * Gross Revenue - Sum of paid invoices (type 1=trial, type 2=rebill)
 * Converted to EUR
 */
export function grossRevenueQuery(dateRange: DateRangeConfig): QueryDefinition {
  const dateFilter = dateRange.type === 'period'
    ? `i.transacted_at >= DATE_SUB(CURDATE(), INTERVAL ${dateRange.days} DAY)`
    : `i.transacted_at >= '${dateRange.startDate}' AND i.transacted_at < '${dateRange.endDate}'`;

  return {
    id: "global-gross-revenue" as any,
    name: `Gross Revenue (${dateRange.type === 'period' ? dateRange.days + 'd' : 'cohort'})`,
    description: "Sum of paid invoices (trials + rebills) converted to EUR",
    sql: `
      SELECT
        SUM(i.amount / ${RATE_CASE_INV}) as gross_revenue_eur,
        SUM(CASE WHEN i.invoice_type_id = 1 THEN i.amount / ${RATE_CASE_INV} ELSE 0 END) as trial_revenue_eur,
        SUM(CASE WHEN i.invoice_type_id = 2 THEN i.amount / ${RATE_CASE_INV} ELSE 0 END) as rebill_revenue_eur,
        COUNT(CASE WHEN i.invoice_type_id = 1 THEN 1 END) as trial_count,
        COUNT(CASE WHEN i.invoice_type_id = 2 THEN 1 END) as rebill_count
      FROM avocode.invoices i
      WHERE ${dateFilter}
        AND i.invoice_status_id = 1
        AND i.invoice_type_id IN (1, 2)
    `,
    params: [],
    permissions: ["SELECT"],
  };
}

/**
 * Refunds - Sum of refund invoices (type 3) for Avocode/KiwiKode
 * + Zoho refunds for Jackcode
 * Converted to EUR
 */
export function refundsQuery(dateRange: DateRangeConfig): QueryDefinition {
  const dateFilterInv = dateRange.type === 'period'
    ? `i.transacted_at >= DATE_SUB(CURDATE(), INTERVAL ${dateRange.days} DAY)`
    : `i.transacted_at >= '${dateRange.startDate}' AND i.transacted_at < '${dateRange.endDate}'`;

  const dateFilterZoho = dateRange.type === 'period'
    ? `zr.created_at >= DATE_SUB(CURDATE(), INTERVAL ${dateRange.days} DAY)`
    : `zr.created_at >= '${dateRange.startDate}' AND zr.created_at < '${dateRange.endDate}'`;

  return {
    id: "global-refunds" as any,
    name: `Refunds (${dateRange.type === 'period' ? dateRange.days + 'd' : 'cohort'})`,
    description: "Sum of refunds from invoices (Avocode/KiwiKode) + Zoho (Jackcode)",
    sql: `
      SELECT
        COALESCE(inv_refunds.total_eur, 0) + COALESCE(zoho_refunds.total_eur, 0) as total_refunds_eur,
        COALESCE(inv_refunds.total_eur, 0) as invoice_refunds_eur,
        COALESCE(zoho_refunds.total_eur, 0) as zoho_refunds_eur,
        COALESCE(inv_refunds.refund_count, 0) + COALESCE(zoho_refunds.refund_count, 0) as refund_count
      FROM (
        -- Refunds from invoices (Avocode/KiwiKode - company_id != 3)
        SELECT
          SUM(i.amount / ${RATE_CASE_INV}) as total_eur,
          COUNT(*) as refund_count
        FROM avocode.invoices i
        WHERE ${dateFilterInv}
          AND i.invoice_status_id = 1
          AND i.invoice_type_id = 3
          AND i.company_id != 3
      ) inv_refunds,
      (
        -- Zoho refunds (Jackcode - company_id = 3)
        SELECT
          SUM(zr.amount / CASE
            WHEN COALESCE(zc.currency_code, zosc.currency_code) = 'EUR' THEN 1
            WHEN COALESCE(zc.currency_code, zosc.currency_code) = 'RON' THEN ${RON_RATE}
            ELSE 1
          END) as total_eur,
          COUNT(*) as refund_count
        FROM avocodebo.zoho_refunds zr
        LEFT JOIN avocodebo.zoho_credit_notes zcn ON zr.zoho_credit_note_id = zcn.id
        LEFT JOIN avocodebo.zoho_customers zc ON zcn.zoho_customer_id = zc.id
        LEFT JOIN avocodebo.zoho_one_shot_customers zosc ON zcn.zoho_one_shot_customer_id = zosc.id
        WHERE ${dateFilterZoho}
      ) zoho_refunds
    `,
    params: [],
    permissions: ["SELECT"],
  };
}

/**
 * Ad Spend - Sum of ad costs converted to EUR
 * currency_id 2 = EUR, currency_id 4 = RON
 */
export function adSpendQuery(dateRange: DateRangeConfig): QueryDefinition {
  const dateFilter = dateRange.type === 'period'
    ? `a.date >= DATE_SUB(CURDATE(), INTERVAL ${dateRange.days} DAY)`
    : `a.date >= '${dateRange.startDate}' AND a.date < '${dateRange.endDate}'`;

  return {
    id: "global-ad-spend" as any,
    name: `Ad Spend (${dateRange.type === 'period' ? dateRange.days + 'd' : 'cohort'})`,
    description: "Sum of ad spend converted to EUR",
    sql: `
      SELECT
        SUM(a.cost / CASE c.currency_id
          WHEN 2 THEN 1
          WHEN 4 THEN ${RON_RATE}
          ELSE 1
        END) as total_spend_eur
      FROM avocodebo.ads a
      INNER JOIN avocodebo.campaigns c ON a.campaign_id = c.id
      WHERE ${dateFilter}
    `,
    params: [],
    permissions: ["SELECT"],
  };
}

/**
 * Trials count for CPT calculation
 */
export function trialsCountQuery(dateRange: DateRangeConfig): QueryDefinition {
  const dateFilter = dateRange.type === 'period'
    ? `c.create_time >= DATE_SUB(CURDATE(), INTERVAL ${dateRange.days} DAY)`
    : `c.create_time >= '${dateRange.startDate}' AND c.create_time < '${dateRange.endDate}'`;

  return {
    id: "global-trials-count" as any,
    name: `Trials Count (${dateRange.type === 'period' ? dateRange.days + 'd' : 'cohort'})`,
    description: "Count of new customers (trials)",
    sql: `
      SELECT COUNT(DISTINCT c.id) as trial_count
      FROM avocode.customers c
      WHERE ${dateFilter}
    `,
    params: [],
    permissions: ["SELECT"],
  };
}

/**
 * First Rebills count and FRR calculation
 * Uses cohort-based logic: customers acquired in period who converted
 */
export function firstRebillsQuery(dateRange: DateRangeConfig): QueryDefinition {
  const dateFilter = dateRange.type === 'period'
    ? `c.create_time >= DATE_SUB(CURDATE(), INTERVAL ${dateRange.days} DAY)`
    : `c.create_time >= '${dateRange.startDate}' AND c.create_time < '${dateRange.endDate}'`;

  return {
    id: "global-first-rebills" as any,
    name: `First Rebills (${dateRange.type === 'period' ? dateRange.days + 'd' : 'cohort'})`,
    description: "First rebill count for customers acquired in the period",
    sql: `
      SELECT
        COUNT(DISTINCT c.id) as trial_count,
        COUNT(DISTINCT CASE WHEN fr.customer_id IS NOT NULL THEN c.id END) as first_rebill_count
      FROM avocode.customers c
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
    `,
    params: [],
    permissions: ["SELECT"],
  };
}

/**
 * Refund Rate M1 - Transaction-based (First Rebills Refunded / Total First Rebills)
 * For Avocode/KiwiKode: first rebill that has a matching refund (invoice_type_id=3)
 * For Jackcode (company_id=3): first rebill that has a matching zoho_refund
 */
export function refundRateM1Query(dateRange: DateRangeConfig): QueryDefinition {
  const dateFilter = dateRange.type === 'period'
    ? `c.create_time >= DATE_SUB(CURDATE(), INTERVAL ${dateRange.days} DAY)`
    : `c.create_time >= '${dateRange.startDate}' AND c.create_time < '${dateRange.endDate}'`;

  return {
    id: "global-refund-rate-m1" as any,
    name: `Refund Rate M1 (${dateRange.type === 'period' ? dateRange.days + 'd' : 'cohort'})`,
    description: "Refund rate based on first rebill transactions refunded",
    sql: `
      SELECT
        COUNT(DISTINCT fr.customer_id) as total_first_rebills,
        COUNT(DISTINCT CASE
          WHEN fr.company_id != 3 AND ref_inv.id IS NOT NULL THEN fr.customer_id
          WHEN fr.company_id = 3 AND zoho_ref.customer_id IS NOT NULL THEN fr.customer_id
          ELSE NULL
        END) as refunded_first_rebills
      FROM avocode.customers c
      INNER JOIN (
        -- First rebill per customer with company info
        SELECT
          i.customer_id,
          i.id as first_rebill_id,
          i.amount,
          i.currency_code,
          i.transacted_at,
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
      -- Check for refund invoice (Avocode/KiwiKode)
      LEFT JOIN avocode.invoices ref_inv ON ref_inv.customer_id = c.id
        AND ref_inv.invoice_type_id = 3
        AND ref_inv.invoice_status_id = 1
        AND ref_inv.company_id != 3
      -- Check for Zoho refund (Jackcode) via zoho_credit_notes -> zoho_invoices -> invoices
      LEFT JOIN (
        SELECT DISTINCT inv.customer_id
        FROM avocodebo.zoho_refunds zr
        JOIN avocodebo.zoho_credit_notes zcn ON zcn.id = zr.zoho_credit_note_id
        JOIN avocodebo.zoho_invoices zi ON zi.id = zcn.zoho_invoice_id
        JOIN avocode.invoices inv ON inv.id = zi.invoice_id
        WHERE inv.company_id = 3
      ) zoho_ref ON zoho_ref.customer_id = c.id AND fr.company_id = 3
      WHERE ${dateFilter}
    `,
    params: [],
    permissions: ["SELECT"],
  };
}

/**
 * Dispute Rate - Chargebacks / Total Transactions
 */
export function disputeRateQuery(dateRange: DateRangeConfig): QueryDefinition {
  const dateFilter = dateRange.type === 'period'
    ? `i.transacted_at >= DATE_SUB(CURDATE(), INTERVAL ${dateRange.days} DAY)`
    : `i.transacted_at >= '${dateRange.startDate}' AND i.transacted_at < '${dateRange.endDate}'`;

  return {
    id: "global-dispute-rate" as any,
    name: `Dispute Rate (${dateRange.type === 'period' ? dateRange.days + 'd' : 'cohort'})`,
    description: "Chargeback count and rate",
    sql: `
      SELECT
        COUNT(*) as total_transactions,
        SUM(CASE WHEN i.invoice_type_id = 4 THEN 1 ELSE 0 END) as chargeback_count
      FROM avocode.invoices i
      WHERE ${dateFilter}
        AND i.invoice_status_id = 1
        AND i.invoice_type_id IN (1, 2, 4)
    `,
    params: [],
    permissions: ["SELECT"],
  };
}

/**
 * Payback by Website - For comparison chart
 * Calculates Payback M1 per website using cohort-based logic
 */
export function paybackByWebsiteQuery(dateRange: DateRangeConfig): QueryDefinition {
  // For payback, we need mature cohorts (at least 51 days old)
  // We use customers acquired 51-180 days ago
  const cohortStart = dateRange.type === 'period' ? 180 : 180;
  const cohortEnd = dateRange.type === 'period' ? 51 : 51;

  const RATE_CASE_INV = buildCurrencyRateCase('inv.currency_code');

  return {
    id: "global-payback-by-website" as any,
    name: "Payback M1 by Website",
    description: "Payback M1 calculation per website for mature cohorts",
    sql: `
      SELECT
        w.id as website_id,
        w.name as website_name,
        COUNT(DISTINCT c.id) as cohort_size,
        COUNT(DISTINCT CASE WHEN fr.first_rebill_id IS NOT NULL THEN c.id END) as first_rebill_count,
        COALESCE(SUM(
          COALESCE((
            SELECT SUM(inv.amount / ${RATE_CASE_INV})
            FROM avocode.invoices inv
            WHERE inv.customer_id = c.id
              AND inv.invoice_status_id = 1
              AND inv.invoice_type_id IN (1, 2)
              AND inv.transacted_at <= DATE_ADD(c.create_time, INTERVAL 51 DAY)
          ), 0)
          - COALESCE((
            SELECT SUM(inv.amount / ${RATE_CASE_INV})
            FROM avocode.invoices inv
            WHERE inv.customer_id = c.id
              AND inv.invoice_status_id = 1
              AND inv.invoice_type_id = 3
              AND inv.company_id != 3
              AND inv.transacted_at <= DATE_ADD(c.create_time, INTERVAL 51 DAY)
          ), 0)
        ), 0) as revenue_m1_eur,
        COALESCE((
          SELECT SUM(a.cost / CASE camp.currency_id WHEN 2 THEN 1 WHEN 4 THEN ${RON_RATE} ELSE 1 END)
          FROM avocodebo.ads a
          INNER JOIN avocodebo.campaigns camp ON a.campaign_id = camp.id
          WHERE camp.website_id = w.id
            AND a.date >= DATE_SUB(CURDATE(), INTERVAL ${cohortStart} DAY)
            AND a.date < DATE_SUB(CURDATE(), INTERVAL ${cohortEnd} DAY)
        ), 0) as ad_spend_eur
      FROM avocode.websites w
      INNER JOIN avocode.subscriptions s ON s.website_id = w.id
      INNER JOIN avocode.customers c ON c.id = s.customer_id
      LEFT JOIN (
        SELECT
          i.customer_id,
          MIN(i.id) as first_rebill_id
        FROM avocode.invoices i
        WHERE i.invoice_type_id = 2
          AND i.invoice_status_id = 1
        GROUP BY i.customer_id
      ) fr ON fr.customer_id = c.id
      WHERE c.create_time >= DATE_SUB(CURDATE(), INTERVAL ${cohortStart} DAY)
        AND c.create_time < DATE_SUB(CURDATE(), INTERVAL ${cohortEnd} DAY)
      GROUP BY w.id, w.name
      HAVING cohort_size > 0
      ORDER BY revenue_m1_eur DESC
    `,
    params: [],
    permissions: ["SELECT"],
  };
}

/**
 * Daily Pulse - Today vs Same Day Last Week
 */
export function dailyPulseQuery(): QueryDefinition {
  const RATE_CASE_INV = buildCurrencyRateCase('i.currency_code');

  return {
    id: "global-daily-pulse" as any,
    name: "Daily Pulse (Today vs 7d ago)",
    description: "Daily comparison of key metrics",
    sql: `
      SELECT
        'today' as period,
        (SELECT COUNT(*) FROM avocode.customers WHERE DATE(create_time) = CURDATE()) as acquisitions,
        (SELECT COUNT(DISTINCT customer_id)
         FROM avocode.invoices
         WHERE DATE(transacted_at) = CURDATE()
           AND invoice_type_id = 2
           AND invoice_status_id = 1
           AND id = (SELECT MIN(i2.id) FROM avocode.invoices i2
                     WHERE i2.customer_id = invoices.customer_id
                       AND i2.invoice_type_id = 2 AND i2.invoice_status_id = 1)
        ) as first_rebills,
        (SELECT COUNT(*)
         FROM avocode.invoices
         WHERE DATE(transacted_at) = CURDATE()
           AND invoice_status_id = 1
           AND invoice_type_id = 3
        ) as refund_count,
        (SELECT COALESCE(SUM(i.amount / ${RATE_CASE_INV}), 0)
         FROM avocode.invoices i
         WHERE DATE(i.transacted_at) = CURDATE()
           AND i.invoice_status_id = 1
           AND i.invoice_type_id IN (1, 2)
        ) as gross_revenue_eur
      UNION ALL
      SELECT
        'last_week' as period,
        (SELECT COUNT(*) FROM avocode.customers WHERE DATE(create_time) = DATE_SUB(CURDATE(), INTERVAL 7 DAY)) as acquisitions,
        (SELECT COUNT(DISTINCT customer_id)
         FROM avocode.invoices
         WHERE DATE(transacted_at) = DATE_SUB(CURDATE(), INTERVAL 7 DAY)
           AND invoice_type_id = 2
           AND invoice_status_id = 1
           AND id = (SELECT MIN(i2.id) FROM avocode.invoices i2
                     WHERE i2.customer_id = invoices.customer_id
                       AND i2.invoice_type_id = 2 AND i2.invoice_status_id = 1)
        ) as first_rebills,
        (SELECT COUNT(*)
         FROM avocode.invoices
         WHERE DATE(transacted_at) = DATE_SUB(CURDATE(), INTERVAL 7 DAY)
           AND invoice_status_id = 1
           AND invoice_type_id = 3
        ) as refund_count,
        (SELECT COALESCE(SUM(i.amount / ${RATE_CASE_INV}), 0)
         FROM avocode.invoices i
         WHERE DATE(i.transacted_at) = DATE_SUB(CURDATE(), INTERVAL 7 DAY)
           AND i.invoice_status_id = 1
           AND i.invoice_type_id IN (1, 2)
        ) as gross_revenue_eur
    `,
    params: [],
    permissions: ["SELECT"],
  };
}
