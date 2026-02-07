import { QueryDefinition } from "../types.js";
import { buildCurrencyRateCase } from "../../../core/currency.js";

/**
 * Campaigns View KPIs - Queries for the dashboard campaigns view
 *
 * Campaign grouping via campaigns table.
 * Customer-Campaign linking: google_ads_details.utm_campaign → campaigns.google_campaign_id
 * Uses subqueries approach for better data coverage.
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
 * All Campaign Metrics in one query (unified subquery approach)
 * Groups by campaign and calculates M1 cohort + Total period metrics
 */
export function campaignMetricsQuery(
  dateRange: DateRangeConfig,
  websiteId?: number,
  countryId?: number
): QueryDefinition {
  const customerDateFilter = dateRange.type === 'period'
    ? `c.create_time >= DATE_SUB(CURDATE(), INTERVAL ${dateRange.days} DAY)`
    : `c.create_time >= '${dateRange.startDate}' AND c.create_time < '${dateRange.endDate}'`;

  const invoiceDateFilter = dateRange.type === 'period'
    ? `inv.transacted_at >= DATE_SUB(CURDATE(), INTERVAL ${dateRange.days} DAY)`
    : `inv.transacted_at >= '${dateRange.startDate}' AND inv.transacted_at < '${dateRange.endDate}'`;

  const adDateFilter = dateRange.type === 'period'
    ? `a.date >= DATE_SUB(CURDATE(), INTERVAL ${dateRange.days} DAY)`
    : `a.date >= '${dateRange.startDate}' AND a.date < '${dateRange.endDate}'`;

  const websiteFilter = websiteId ? `AND camp.website_id = ${websiteId}` : '';
  const countryFilter = countryId ? `AND camp.country_id = ${countryId}` : '';

  return {
    id: "campaigns-all-metrics" as any,
    name: `All Campaign Metrics (${dateRange.type === 'period' ? dateRange.days + 'd' : 'cohort'})`,
    description: "Complete campaign metrics using subqueries",
    sql: `
      SELECT * FROM (
        SELECT
          camp.id as campaign_id,
          camp.google_campaign_id,
          camp.name as campaign_name,
          camp.website_id,
          camp.country_id,
          camp.active,
          ctr.code as country_code,
          ctr.name as country_name,
          w.name as website_name,

          -- Trial count (cohort)
          COALESCE((
            SELECT COUNT(DISTINCT gad.customer_id)
            FROM avocode.google_ads_details gad
            JOIN avocode.customers c ON c.id = gad.customer_id
            WHERE gad.utm_campaign = camp.google_campaign_id
              AND ${customerDateFilter}
          ), 0) as trial_count,

          -- First rebill count (cohort)
          COALESCE((
            SELECT COUNT(DISTINCT gad.customer_id)
            FROM avocode.google_ads_details gad
            JOIN avocode.customers c ON c.id = gad.customer_id
            JOIN avocode.invoices i ON i.customer_id = gad.customer_id
              AND i.invoice_type_id = 2 AND i.invoice_status_id = 1
            WHERE gad.utm_campaign = camp.google_campaign_id
              AND ${customerDateFilter}
          ), 0) as first_rebill_count,

          -- Trial Revenue M1 (cohort)
          COALESCE((
            SELECT SUM(inv.amount / ${RATE_CASE})
            FROM avocode.google_ads_details gad
            JOIN avocode.customers c ON c.id = gad.customer_id
            JOIN avocode.invoices inv ON inv.customer_id = gad.customer_id
              AND inv.invoice_type_id = 1 AND inv.invoice_status_id = 1
            WHERE gad.utm_campaign = camp.google_campaign_id
              AND ${customerDateFilter}
          ), 0) as trial_revenue_eur,

          -- First Rebill Revenue M1 (cohort)
          COALESCE((
            SELECT SUM(inv.amount / ${RATE_CASE})
            FROM avocode.google_ads_details gad
            JOIN avocode.customers c ON c.id = gad.customer_id
            JOIN avocode.invoices inv ON inv.customer_id = gad.customer_id
              AND inv.invoice_type_id = 2 AND inv.invoice_status_id = 1
              AND inv.id = (SELECT MIN(i2.id) FROM avocode.invoices i2
                            WHERE i2.customer_id = inv.customer_id
                              AND i2.invoice_type_id = 2 AND i2.invoice_status_id = 1)
            WHERE gad.utm_campaign = camp.google_campaign_id
              AND ${customerDateFilter}
          ), 0) as first_rebill_revenue_eur,

          -- Refunds M1 (cohort - only from cohort customers)
          COALESCE((
            SELECT SUM(inv.amount / ${RATE_CASE})
            FROM avocode.google_ads_details gad
            JOIN avocode.customers c ON c.id = gad.customer_id
            JOIN avocode.invoices inv ON inv.customer_id = gad.customer_id
              AND inv.invoice_type_id = 3 AND inv.invoice_status_id = 1 AND inv.company_id != 3
            WHERE gad.utm_campaign = camp.google_campaign_id
              AND ${customerDateFilter}
          ), 0) as refunds_m1_eur,

          -- Total Revenue (period-based)
          COALESCE((
            SELECT SUM(inv.amount / ${RATE_CASE})
            FROM avocode.google_ads_details gad
            JOIN avocode.invoices inv ON inv.customer_id = gad.customer_id
              AND inv.invoice_type_id IN (1, 2) AND inv.invoice_status_id = 1
            WHERE gad.utm_campaign = camp.google_campaign_id
              AND ${invoiceDateFilter}
          ), 0) as total_revenue_eur,

          -- Total Rebill Revenue (period-based, all rebills)
          COALESCE((
            SELECT SUM(inv.amount / ${RATE_CASE})
            FROM avocode.google_ads_details gad
            JOIN avocode.invoices inv ON inv.customer_id = gad.customer_id
              AND inv.invoice_type_id = 2 AND inv.invoice_status_id = 1
            WHERE gad.utm_campaign = camp.google_campaign_id
              AND ${invoiceDateFilter}
          ), 0) as total_rebill_revenue_eur,

          -- Total Refunds (period-based)
          COALESCE((
            SELECT SUM(inv.amount / ${RATE_CASE})
            FROM avocode.google_ads_details gad
            JOIN avocode.invoices inv ON inv.customer_id = gad.customer_id
              AND inv.invoice_type_id = 3 AND inv.invoice_status_id = 1 AND inv.company_id != 3
            WHERE gad.utm_campaign = camp.google_campaign_id
              AND ${invoiceDateFilter}
          ), 0) as total_refunds_eur,

          -- Ad Spend
          COALESCE((
            SELECT SUM(a.cost / CASE camp.currency_id WHEN 2 THEN 1 WHEN 4 THEN ${RON_RATE} ELSE 1 END)
            FROM avocodebo.ads a
            WHERE a.campaign_id = camp.id
              AND ${adDateFilter}
          ), 0) as ad_spend_eur,

          -- Google Ads metrics from ads table
          COALESCE((
            SELECT SUM(a.impressions)
            FROM avocodebo.ads a
            WHERE a.campaign_id = camp.id
              AND ${adDateFilter}
          ), 0) as impressions,

          COALESCE((
            SELECT SUM(a.clicks)
            FROM avocodebo.ads a
            WHERE a.campaign_id = camp.id
              AND ${adDateFilter}
          ), 0) as clicks

        FROM avocodebo.campaigns camp
        LEFT JOIN avocode.countries ctr ON ctr.id = camp.country_id
        LEFT JOIN avocode.websites w ON w.id = camp.website_id
        WHERE camp.google_campaign_id IS NOT NULL
          AND camp.google_campaign_id != ''
          AND camp.website_id IN (1, 3, 4)
          ${websiteFilter}
          ${countryFilter}
      ) AS campaign_metrics
      WHERE total_revenue_eur > 0 OR ad_spend_eur > 0
      ORDER BY ad_spend_eur DESC, total_revenue_eur DESC
    `,
    params: [],
    permissions: ["SELECT"],
  };
}
