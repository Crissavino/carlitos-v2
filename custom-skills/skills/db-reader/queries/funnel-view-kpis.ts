import { QueryDefinition } from "../types.js";
import { buildCurrencyRateCase } from "../../../core/currency.js";

/**
 * Funnel View KPIs - Comprehensive funnel and cohort analysis
 */

const RATE_CASE = buildCurrencyRateCase('inv.currency_code');
const RON_RATE = 4.97;

export interface DateRangeConfig {
  days: number;
  type: 'period' | 'cohort';
  startDate?: string;
  endDate?: string;
}

/**
 * Marketing Funnel: Impressions → Clicks → Trials → First Rebills
 */
export function marketingFunnelQuery(dateRange: DateRangeConfig, websiteId?: number): QueryDefinition {
  const adDateFilter = dateRange.type === 'period'
    ? `a.date >= DATE_SUB(CURDATE(), INTERVAL ${dateRange.days} DAY)`
    : `a.date >= '${dateRange.startDate}' AND a.date < '${dateRange.endDate}'`;

  const customerDateFilter = dateRange.type === 'period'
    ? `c.create_time >= DATE_SUB(CURDATE(), INTERVAL ${dateRange.days} DAY)`
    : `c.create_time >= '${dateRange.startDate}' AND c.create_time < '${dateRange.endDate}'`;

  const websiteFilter = websiteId ? `AND camp.website_id = ${websiteId}` : '';
  const websiteFilterSub = websiteId ? `AND s.website_id = ${websiteId}` : '';

  return {
    id: "funnel-marketing" as any,
    name: `Marketing Funnel (${dateRange.type === 'period' ? dateRange.days + 'd' : 'cohort'})`,
    description: "Marketing funnel: impressions, clicks, trials, first rebills",
    sql: `
      SELECT
        -- Ads metrics
        COALESCE((
          SELECT SUM(a.impressions)
          FROM avocodebo.ads a
          JOIN avocodebo.campaigns camp ON a.campaign_id = camp.id
          WHERE ${adDateFilter}
            AND camp.website_id IN (1, 3, 4)
            ${websiteFilter}
        ), 0) as impressions,

        COALESCE((
          SELECT SUM(a.clicks)
          FROM avocodebo.ads a
          JOIN avocodebo.campaigns camp ON a.campaign_id = camp.id
          WHERE ${adDateFilter}
            AND camp.website_id IN (1, 3, 4)
            ${websiteFilter}
        ), 0) as clicks,

        -- Trials (customers acquired in period)
        COALESCE((
          SELECT COUNT(DISTINCT c.id)
          FROM avocode.customers c
          JOIN avocode.subscriptions s ON s.customer_id = c.id
          WHERE ${customerDateFilter}
            ${websiteFilterSub}
        ), 0) as trials,

        -- First Rebills (from cohort)
        COALESCE((
          SELECT COUNT(DISTINCT c.id)
          FROM avocode.customers c
          JOIN avocode.subscriptions s ON s.customer_id = c.id
          JOIN avocode.invoices i ON i.customer_id = c.id
            AND i.invoice_type_id = 2 AND i.invoice_status_id = 1
          WHERE ${customerDateFilter}
            ${websiteFilterSub}
        ), 0) as first_rebills,

        -- Ad Spend
        COALESCE((
          SELECT SUM(a.cost / CASE camp.currency_id WHEN 2 THEN 1 WHEN 4 THEN ${RON_RATE} ELSE 1 END)
          FROM avocodebo.ads a
          JOIN avocodebo.campaigns camp ON a.campaign_id = camp.id
          WHERE ${adDateFilter}
            AND camp.website_id IN (1, 3, 4)
            ${websiteFilter}
        ), 0) as ad_spend_eur
    `,
    params: [],
    permissions: ["SELECT"],
  };
}

/**
 * FRR by Weekly Cohort (last 8 weeks)
 */
export function frrByWeeklyCohortQuery(websiteId?: number): QueryDefinition {
  const websiteFilter = websiteId ? `AND s.website_id = ${websiteId}` : '';

  return {
    id: "funnel-frr-weekly" as any,
    name: "FRR by Weekly Cohort",
    description: "First Rebill Rate by week of acquisition",
    sql: `
      SELECT
        YEARWEEK(c.create_time, 1) as cohort_week,
        DATE_FORMAT(MIN(c.create_time), '%d %b') as week_label,
        COUNT(DISTINCT c.id) as trials,
        COUNT(DISTINCT CASE
          WHEN EXISTS (
            SELECT 1 FROM avocode.invoices i
            WHERE i.customer_id = c.id
              AND i.invoice_type_id = 2
              AND i.invoice_status_id = 1
          ) THEN c.id
        END) as first_rebills
      FROM avocode.customers c
      JOIN avocode.subscriptions s ON s.customer_id = c.id
      WHERE c.create_time >= DATE_SUB(CURDATE(), INTERVAL 8 WEEK)
        AND c.create_time < DATE_SUB(CURDATE(), INTERVAL 7 DAY)
        ${websiteFilter}
      GROUP BY YEARWEEK(c.create_time, 1)
      ORDER BY cohort_week ASC
    `,
    params: [],
    permissions: ["SELECT"],
  };
}

/**
 * Retention by Month (cohort tracking)
 * Shows how many customers from a reference cohort are still paying at M1, M2, M3...
 */
export function retentionByMonthQuery(websiteId?: number): QueryDefinition {
  const websiteFilter = websiteId ? `AND s.website_id = ${websiteId}` : '';

  return {
    id: "funnel-retention" as any,
    name: "Retention by Month",
    description: "Customer retention tracking by month since acquisition",
    sql: `
      SELECT
        month_number,
        COUNT(DISTINCT customer_id) as customers,
        ROUND(COUNT(DISTINCT customer_id) * 100.0 / NULLIF(first_value, 0), 1) as retention_rate
      FROM (
        SELECT
          c.id as customer_id,
          1 as month_number,
          (SELECT COUNT(DISTINCT c2.id)
           FROM avocode.customers c2
           JOIN avocode.subscriptions s2 ON s2.customer_id = c2.id
           WHERE c2.create_time >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
             AND c2.create_time < DATE_SUB(CURDATE(), INTERVAL 5 MONTH)
             ${websiteFilter ? 'AND s2.website_id = ' + websiteId : ''}
          ) as first_value
        FROM avocode.customers c
        JOIN avocode.subscriptions s ON s.customer_id = c.id
        WHERE c.create_time >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
          AND c.create_time < DATE_SUB(CURDATE(), INTERVAL 5 MONTH)
          ${websiteFilter}

        UNION ALL

        SELECT
          c.id as customer_id,
          2 as month_number,
          (SELECT COUNT(DISTINCT c2.id)
           FROM avocode.customers c2
           JOIN avocode.subscriptions s2 ON s2.customer_id = c2.id
           WHERE c2.create_time >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
             AND c2.create_time < DATE_SUB(CURDATE(), INTERVAL 5 MONTH)
             ${websiteFilter ? 'AND s2.website_id = ' + websiteId : ''}
          ) as first_value
        FROM avocode.customers c
        JOIN avocode.subscriptions s ON s.customer_id = c.id
        JOIN avocode.invoices i ON i.customer_id = c.id
          AND i.invoice_type_id = 2 AND i.invoice_status_id = 1
          AND i.transacted_at >= DATE_ADD(c.create_time, INTERVAL 1 MONTH)
          AND i.transacted_at < DATE_ADD(c.create_time, INTERVAL 2 MONTH)
        WHERE c.create_time >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
          AND c.create_time < DATE_SUB(CURDATE(), INTERVAL 5 MONTH)
          ${websiteFilter}

        UNION ALL

        SELECT
          c.id as customer_id,
          3 as month_number,
          (SELECT COUNT(DISTINCT c2.id)
           FROM avocode.customers c2
           JOIN avocode.subscriptions s2 ON s2.customer_id = c2.id
           WHERE c2.create_time >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
             AND c2.create_time < DATE_SUB(CURDATE(), INTERVAL 5 MONTH)
             ${websiteFilter ? 'AND s2.website_id = ' + websiteId : ''}
          ) as first_value
        FROM avocode.customers c
        JOIN avocode.subscriptions s ON s.customer_id = c.id
        JOIN avocode.invoices i ON i.customer_id = c.id
          AND i.invoice_type_id = 2 AND i.invoice_status_id = 1
          AND i.transacted_at >= DATE_ADD(c.create_time, INTERVAL 2 MONTH)
          AND i.transacted_at < DATE_ADD(c.create_time, INTERVAL 3 MONTH)
        WHERE c.create_time >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
          AND c.create_time < DATE_SUB(CURDATE(), INTERVAL 5 MONTH)
          ${websiteFilter}

        UNION ALL

        SELECT
          c.id as customer_id,
          4 as month_number,
          (SELECT COUNT(DISTINCT c2.id)
           FROM avocode.customers c2
           JOIN avocode.subscriptions s2 ON s2.customer_id = c2.id
           WHERE c2.create_time >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
             AND c2.create_time < DATE_SUB(CURDATE(), INTERVAL 5 MONTH)
             ${websiteFilter ? 'AND s2.website_id = ' + websiteId : ''}
          ) as first_value
        FROM avocode.customers c
        JOIN avocode.subscriptions s ON s.customer_id = c.id
        JOIN avocode.invoices i ON i.customer_id = c.id
          AND i.invoice_type_id = 2 AND i.invoice_status_id = 1
          AND i.transacted_at >= DATE_ADD(c.create_time, INTERVAL 3 MONTH)
          AND i.transacted_at < DATE_ADD(c.create_time, INTERVAL 4 MONTH)
        WHERE c.create_time >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
          AND c.create_time < DATE_SUB(CURDATE(), INTERVAL 5 MONTH)
          ${websiteFilter}

        UNION ALL

        SELECT
          c.id as customer_id,
          5 as month_number,
          (SELECT COUNT(DISTINCT c2.id)
           FROM avocode.customers c2
           JOIN avocode.subscriptions s2 ON s2.customer_id = c2.id
           WHERE c2.create_time >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
             AND c2.create_time < DATE_SUB(CURDATE(), INTERVAL 5 MONTH)
             ${websiteFilter ? 'AND s2.website_id = ' + websiteId : ''}
          ) as first_value
        FROM avocode.customers c
        JOIN avocode.subscriptions s ON s.customer_id = c.id
        JOIN avocode.invoices i ON i.customer_id = c.id
          AND i.invoice_type_id = 2 AND i.invoice_status_id = 1
          AND i.transacted_at >= DATE_ADD(c.create_time, INTERVAL 4 MONTH)
          AND i.transacted_at < DATE_ADD(c.create_time, INTERVAL 5 MONTH)
        WHERE c.create_time >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
          AND c.create_time < DATE_SUB(CURDATE(), INTERVAL 5 MONTH)
          ${websiteFilter}
      ) retention_data
      GROUP BY month_number, first_value
      ORDER BY month_number
    `,
    params: [],
    permissions: ["SELECT"],
  };
}

/**
 * Risk Trends: Monthly refund rates
 * Includes both invoice refunds (Avocode/KiwiKode) and Zoho refunds (Jackcode)
 */
export function riskTrendsQuery(websiteId?: number): QueryDefinition {
  const websiteFilter = websiteId ? `AND s.website_id = ${websiteId}` : '';

  return {
    id: "funnel-risk-trends" as any,
    name: "Risk Trends",
    description: "Monthly refund rates (invoice + zoho refunds)",
    sql: `
      SELECT
        month,
        month_label,
        SUM(transactions) as total_transactions,
        SUM(refunds) as refunds,
        ROUND(SUM(refunds) * 100.0 / NULLIF(SUM(transactions), 0), 2) as refund_rate
      FROM (
        -- Invoice transactions and refunds (Avocode/KiwiKode)
        SELECT
          DATE_FORMAT(i.transacted_at, '%Y-%m') as month,
          DATE_FORMAT(i.transacted_at, '%b') as month_label,
          COUNT(DISTINCT CASE WHEN i.invoice_type_id IN (1, 2) THEN i.id END) as transactions,
          COUNT(DISTINCT CASE WHEN i.invoice_type_id = 3 AND i.company_id != 3 THEN i.id END) as refunds
        FROM avocode.invoices i
        JOIN avocode.subscriptions s ON s.customer_id = i.customer_id
        WHERE i.transacted_at >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
          AND i.invoice_status_id = 1
          ${websiteFilter}
        GROUP BY DATE_FORMAT(i.transacted_at, '%Y-%m'), DATE_FORMAT(i.transacted_at, '%b')

        UNION ALL

        -- Zoho refunds (Jackcode)
        SELECT
          DATE_FORMAT(zr.created_at, '%Y-%m') as month,
          DATE_FORMAT(zr.created_at, '%b') as month_label,
          0 as transactions,
          COUNT(DISTINCT zr.id) as refunds
        FROM avocodebo.zoho_refunds zr
        LEFT JOIN avocodebo.zoho_credit_notes zcn ON zr.zoho_credit_note_id = zcn.id
        LEFT JOIN avocodebo.zoho_invoices zi ON zi.id = zcn.zoho_invoice_id
        LEFT JOIN avocode.invoices inv ON inv.id = zi.invoice_id
        LEFT JOIN avocode.subscriptions s ON s.customer_id = inv.customer_id
        WHERE zr.created_at >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
          ${websiteFilter}
        GROUP BY DATE_FORMAT(zr.created_at, '%Y-%m'), DATE_FORMAT(zr.created_at, '%b')
      ) combined
      GROUP BY month, month_label
      ORDER BY month ASC
    `,
    params: [],
    permissions: ["SELECT"],
  };
}

/**
 * LTV by Days (30d, 60d, 90d) for mature cohort
 */
export function ltvByDaysQuery(websiteId?: number): QueryDefinition {
  const websiteFilter = websiteId ? `AND s.website_id = ${websiteId}` : '';

  return {
    id: "funnel-ltv" as any,
    name: "LTV by Days",
    description: "LTV at 30d, 60d, 90d for mature cohort",
    sql: `
      SELECT
        'ltv_30d' as metric,
        ROUND(AVG(ltv_30d), 2) as value
      FROM (
        SELECT
          c.id,
          COALESCE(SUM(
            CASE WHEN inv.transacted_at <= DATE_ADD(c.create_time, INTERVAL 30 DAY)
                 AND inv.invoice_type_id IN (1, 2) AND inv.invoice_status_id = 1
            THEN inv.amount / ${RATE_CASE} ELSE 0 END
          ), 0) -
          COALESCE(SUM(
            CASE WHEN inv.transacted_at <= DATE_ADD(c.create_time, INTERVAL 30 DAY)
                 AND inv.invoice_type_id = 3 AND inv.invoice_status_id = 1 AND inv.company_id != 3
            THEN inv.amount / ${RATE_CASE} ELSE 0 END
          ), 0) as ltv_30d
        FROM avocode.customers c
        JOIN avocode.subscriptions s ON s.customer_id = c.id
        LEFT JOIN avocode.invoices inv ON inv.customer_id = c.id
        WHERE c.create_time >= DATE_SUB(CURDATE(), INTERVAL 120 DAY)
          AND c.create_time < DATE_SUB(CURDATE(), INTERVAL 30 DAY)
          ${websiteFilter}
        GROUP BY c.id
      ) cohort_ltv

      UNION ALL

      SELECT
        'ltv_60d' as metric,
        ROUND(AVG(ltv_60d), 2) as value
      FROM (
        SELECT
          c.id,
          COALESCE(SUM(
            CASE WHEN inv.transacted_at <= DATE_ADD(c.create_time, INTERVAL 60 DAY)
                 AND inv.invoice_type_id IN (1, 2) AND inv.invoice_status_id = 1
            THEN inv.amount / ${RATE_CASE} ELSE 0 END
          ), 0) -
          COALESCE(SUM(
            CASE WHEN inv.transacted_at <= DATE_ADD(c.create_time, INTERVAL 60 DAY)
                 AND inv.invoice_type_id = 3 AND inv.invoice_status_id = 1 AND inv.company_id != 3
            THEN inv.amount / ${RATE_CASE} ELSE 0 END
          ), 0) as ltv_60d
        FROM avocode.customers c
        JOIN avocode.subscriptions s ON s.customer_id = c.id
        LEFT JOIN avocode.invoices inv ON inv.customer_id = c.id
        WHERE c.create_time >= DATE_SUB(CURDATE(), INTERVAL 150 DAY)
          AND c.create_time < DATE_SUB(CURDATE(), INTERVAL 60 DAY)
          ${websiteFilter}
        GROUP BY c.id
      ) cohort_ltv

      UNION ALL

      SELECT
        'ltv_90d' as metric,
        ROUND(AVG(ltv_90d), 2) as value
      FROM (
        SELECT
          c.id,
          COALESCE(SUM(
            CASE WHEN inv.transacted_at <= DATE_ADD(c.create_time, INTERVAL 90 DAY)
                 AND inv.invoice_type_id IN (1, 2) AND inv.invoice_status_id = 1
            THEN inv.amount / ${RATE_CASE} ELSE 0 END
          ), 0) -
          COALESCE(SUM(
            CASE WHEN inv.transacted_at <= DATE_ADD(c.create_time, INTERVAL 90 DAY)
                 AND inv.invoice_type_id = 3 AND inv.invoice_status_id = 1 AND inv.company_id != 3
            THEN inv.amount / ${RATE_CASE} ELSE 0 END
          ), 0) as ltv_90d
        FROM avocode.customers c
        JOIN avocode.subscriptions s ON s.customer_id = c.id
        LEFT JOIN avocode.invoices inv ON inv.customer_id = c.id
        WHERE c.create_time >= DATE_SUB(CURDATE(), INTERVAL 180 DAY)
          AND c.create_time < DATE_SUB(CURDATE(), INTERVAL 90 DAY)
          ${websiteFilter}
        GROUP BY c.id
      ) cohort_ltv
    `,
    params: [],
    permissions: ["SELECT"],
  };
}
