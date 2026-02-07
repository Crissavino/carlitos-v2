import { QueryDefinition } from "../types.js";
import { buildCurrencyRateCase } from "../../../core/currency.js";

/**
 * Countries View KPIs - Queries for the dashboard countries view
 *
 * Country is determined by CAMPAIGN targeting (campaigns.country_id).
 * Uses subqueries approach like business-aggregations.ts for better data coverage.
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
 * All Country Metrics in one query (simplified approach)
 * Groups campaigns by country and calculates metrics via subqueries
 */
export function countryMetricsQuery(dateRange: DateRangeConfig, websiteId?: number): QueryDefinition {
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

  return {
    id: "countries-all-metrics" as any,
    name: `All Country Metrics (${dateRange.type === 'period' ? dateRange.days + 'd' : 'cohort'})`,
    description: "Complete country metrics using subqueries",
    sql: `
      SELECT
        ctr.id as country_id,
        ctr.code as country_code,
        ctr.name as country_name,

        -- Trial count (cohort)
        COALESCE((
          SELECT COUNT(DISTINCT gad.customer_id)
          FROM avocode.google_ads_details gad
          JOIN avocode.customers c ON c.id = gad.customer_id
          JOIN avocodebo.campaigns cp ON cp.google_campaign_id = gad.utm_campaign
          WHERE cp.country_id = ctr.id
            AND ${customerDateFilter}
            ${websiteFilter ? 'AND cp.website_id = ' + websiteId : ''}
        ), 0) as trial_count,

        -- First rebill count (cohort)
        COALESCE((
          SELECT COUNT(DISTINCT gad.customer_id)
          FROM avocode.google_ads_details gad
          JOIN avocode.customers c ON c.id = gad.customer_id
          JOIN avocodebo.campaigns cp ON cp.google_campaign_id = gad.utm_campaign
          JOIN avocode.invoices i ON i.customer_id = gad.customer_id
            AND i.invoice_type_id = 2 AND i.invoice_status_id = 1
          WHERE cp.country_id = ctr.id
            AND ${customerDateFilter}
            ${websiteFilter ? 'AND cp.website_id = ' + websiteId : ''}
        ), 0) as first_rebill_count,

        -- Trial Revenue M1 (cohort)
        COALESCE((
          SELECT SUM(inv.amount / ${RATE_CASE})
          FROM avocode.google_ads_details gad
          JOIN avocode.customers c ON c.id = gad.customer_id
          JOIN avocodebo.campaigns cp ON cp.google_campaign_id = gad.utm_campaign
          JOIN avocode.invoices inv ON inv.customer_id = gad.customer_id
            AND inv.invoice_type_id = 1 AND inv.invoice_status_id = 1
          WHERE cp.country_id = ctr.id
            AND ${customerDateFilter}
            ${websiteFilter ? 'AND cp.website_id = ' + websiteId : ''}
        ), 0) as trial_revenue_eur,

        -- First Rebill Revenue M1 (cohort)
        COALESCE((
          SELECT SUM(inv.amount / ${RATE_CASE})
          FROM avocode.google_ads_details gad
          JOIN avocode.customers c ON c.id = gad.customer_id
          JOIN avocodebo.campaigns cp ON cp.google_campaign_id = gad.utm_campaign
          JOIN avocode.invoices inv ON inv.customer_id = gad.customer_id
            AND inv.invoice_type_id = 2 AND inv.invoice_status_id = 1
            AND inv.id = (SELECT MIN(i2.id) FROM avocode.invoices i2
                          WHERE i2.customer_id = inv.customer_id
                            AND i2.invoice_type_id = 2 AND i2.invoice_status_id = 1)
          WHERE cp.country_id = ctr.id
            AND ${customerDateFilter}
            ${websiteFilter ? 'AND cp.website_id = ' + websiteId : ''}
        ), 0) as first_rebill_revenue_eur,

        -- Refunds M1 (cohort - only from cohort customers)
        COALESCE((
          SELECT SUM(inv.amount / ${RATE_CASE})
          FROM avocode.google_ads_details gad
          JOIN avocode.customers c ON c.id = gad.customer_id
          JOIN avocodebo.campaigns cp ON cp.google_campaign_id = gad.utm_campaign
          JOIN avocode.invoices inv ON inv.customer_id = gad.customer_id
            AND inv.invoice_type_id = 3 AND inv.invoice_status_id = 1 AND inv.company_id != 3
          WHERE cp.country_id = ctr.id
            AND ${customerDateFilter}
            ${websiteFilter ? 'AND cp.website_id = ' + websiteId : ''}
        ), 0) as refunds_m1_eur,

        -- Total Revenue (period-based)
        COALESCE((
          SELECT SUM(inv.amount / ${RATE_CASE})
          FROM avocode.google_ads_details gad
          JOIN avocodebo.campaigns cp ON cp.google_campaign_id = gad.utm_campaign
          JOIN avocode.invoices inv ON inv.customer_id = gad.customer_id
            AND inv.invoice_type_id IN (1, 2) AND inv.invoice_status_id = 1
          WHERE cp.country_id = ctr.id
            AND ${invoiceDateFilter}
            ${websiteFilter ? 'AND cp.website_id = ' + websiteId : ''}
        ), 0) as total_revenue_eur,

        -- Total Rebill Revenue (period-based, all rebills)
        COALESCE((
          SELECT SUM(inv.amount / ${RATE_CASE})
          FROM avocode.google_ads_details gad
          JOIN avocodebo.campaigns cp ON cp.google_campaign_id = gad.utm_campaign
          JOIN avocode.invoices inv ON inv.customer_id = gad.customer_id
            AND inv.invoice_type_id = 2 AND inv.invoice_status_id = 1
          WHERE cp.country_id = ctr.id
            AND ${invoiceDateFilter}
            ${websiteFilter ? 'AND cp.website_id = ' + websiteId : ''}
        ), 0) as total_rebill_revenue_eur,

        -- Total Refunds (period-based)
        COALESCE((
          SELECT SUM(inv.amount / ${RATE_CASE})
          FROM avocode.google_ads_details gad
          JOIN avocodebo.campaigns cp ON cp.google_campaign_id = gad.utm_campaign
          JOIN avocode.invoices inv ON inv.customer_id = gad.customer_id
            AND inv.invoice_type_id = 3 AND inv.invoice_status_id = 1 AND inv.company_id != 3
          WHERE cp.country_id = ctr.id
            AND ${invoiceDateFilter}
            ${websiteFilter ? 'AND cp.website_id = ' + websiteId : ''}
        ), 0) as total_refunds_eur,

        -- Ad Spend
        COALESCE((
          SELECT SUM(a.cost / CASE cp.currency_id WHEN 2 THEN 1 WHEN 4 THEN ${RON_RATE} ELSE 1 END)
          FROM avocodebo.ads a
          JOIN avocodebo.campaigns cp ON a.campaign_id = cp.id
          WHERE cp.country_id = ctr.id
            AND ${adDateFilter}
            AND cp.website_id IN (1, 3, 4)
            ${websiteFilter ? 'AND cp.website_id = ' + websiteId : ''}
        ), 0) as ad_spend_eur

      FROM avocode.countries ctr
      WHERE EXISTS (
        SELECT 1 FROM avocodebo.campaigns camp
        WHERE camp.country_id = ctr.id
          AND camp.website_id IN (1, 3, 4)
          ${websiteFilter}
      )
      ORDER BY ctr.name
    `,
    params: [],
    permissions: ["SELECT"],
  };
}

// Legacy exports for backwards compatibility (redirect to unified query)
export function revenueByCountryQuery(dateRange: DateRangeConfig, websiteId?: number): QueryDefinition {
  return countryMetricsQuery(dateRange, websiteId);
}

export function refundsByCountryQuery(dateRange: DateRangeConfig, websiteId?: number): QueryDefinition {
  return countryMetricsQuery(dateRange, websiteId);
}

export function totalRevenueByCountryQuery(dateRange: DateRangeConfig, websiteId?: number): QueryDefinition {
  return countryMetricsQuery(dateRange, websiteId);
}

export function totalRefundsByCountryQuery(dateRange: DateRangeConfig, websiteId?: number): QueryDefinition {
  return countryMetricsQuery(dateRange, websiteId);
}

export function adSpendByCountryQuery(dateRange: DateRangeConfig, websiteId?: number): QueryDefinition {
  return countryMetricsQuery(dateRange, websiteId);
}

export function frrByCountryQuery(dateRange: DateRangeConfig, websiteId?: number): QueryDefinition {
  return countryMetricsQuery(dateRange, websiteId);
}

export function refundRateM1ByCountryQuery(dateRange: DateRangeConfig, websiteId?: number): QueryDefinition {
  return countryMetricsQuery(dateRange, websiteId);
}

export function disputeRateByCountryQuery(dateRange: DateRangeConfig, websiteId?: number): QueryDefinition {
  return countryMetricsQuery(dateRange, websiteId);
}
