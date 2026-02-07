import { QueryDefinition } from "../types.js";
import { buildCurrencyRateCase } from "../../../core/currency.js";

/**
 * Countries View KPIs - Queries for the dashboard countries view
 *
 * Country is determined by CAMPAIGN targeting (campaigns.country_id), not customer billing address.
 * This allows proper ad spend attribution and payback calculation.
 *
 * All amounts converted to EUR using buildCurrencyRateCase()
 */

const RATE_CASE_INV = buildCurrencyRateCase('i.currency_code');
const RATE_CASE_TRIAL = buildCurrencyRateCase('trial_inv.currency_code');
const RATE_CASE_FR = buildCurrencyRateCase('fr_inv.currency_code');
const RATE_CASE_REF = buildCurrencyRateCase('ref_inv.currency_code');
const RON_RATE = 4.97;

export interface DateRangeConfig {
  days: number;
  type: 'period' | 'cohort';
  startDate?: string;
  endDate?: string;
}

/**
 * Revenue M1 by Country (COHORT-BASED)
 * Only includes trial revenue + first rebill revenue from customers ACQUIRED in the period
 * Country determined by campaign targeting
 */
export function revenueByCountryQuery(dateRange: DateRangeConfig, websiteId?: number): QueryDefinition {
  const dateFilter = dateRange.type === 'period'
    ? `c.create_time >= DATE_SUB(CURDATE(), INTERVAL ${dateRange.days} DAY)`
    : `c.create_time >= '${dateRange.startDate}' AND c.create_time < '${dateRange.endDate}'`;

  const websiteFilter = websiteId ? `AND camp.website_id = ${websiteId}` : '';

  return {
    id: "countries-revenue-m1" as any,
    name: `Revenue M1 by Country (${dateRange.type === 'period' ? dateRange.days + 'd' : 'cohort'})`,
    description: "Revenue M1 from cohort acquired in period by campaign country",
    sql: `
      SELECT
        ctr.id as country_id,
        ctr.code as country_code,
        ctr.name as country_name,
        -- Trial revenue from cohort
        COALESCE(SUM(trial_inv.amount / ${RATE_CASE_TRIAL}), 0) as trial_revenue_eur,
        -- First rebill revenue from cohort
        COALESCE(SUM(fr_inv.amount / ${RATE_CASE_FR}), 0) as first_rebill_revenue_eur,
        -- Total M1 revenue
        COALESCE(SUM(trial_inv.amount / ${RATE_CASE_TRIAL}), 0) + COALESCE(SUM(fr_inv.amount / ${RATE_CASE_FR}), 0) as gross_revenue_eur
      FROM avocode.customers c
      INNER JOIN avocode.google_ads_details gad ON gad.customer_id = c.id
      INNER JOIN avocodebo.campaigns camp ON camp.google_campaign_id = gad.utm_campaign
      INNER JOIN avocode.countries ctr ON ctr.id = camp.country_id
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
        ${websiteFilter}
      GROUP BY ctr.id, ctr.code, ctr.name
    `,
    params: [],
    permissions: ["SELECT"],
  };
}

/**
 * Total Revenue by Country (PERIOD-BASED)
 * All invoices transacted in the period from customers acquired via campaigns
 */
export function totalRevenueByCountryQuery(dateRange: DateRangeConfig, websiteId?: number): QueryDefinition {
  const dateFilter = dateRange.type === 'period'
    ? `i.transacted_at >= DATE_SUB(CURDATE(), INTERVAL ${dateRange.days} DAY)`
    : `i.transacted_at >= '${dateRange.startDate}' AND i.transacted_at < '${dateRange.endDate}'`;

  const websiteFilter = websiteId ? `AND camp.website_id = ${websiteId}` : '';

  return {
    id: "countries-total-revenue" as any,
    name: `Total Revenue by Country (${dateRange.type === 'period' ? dateRange.days + 'd' : 'cohort'})`,
    description: "All revenue transacted in period by campaign country",
    sql: `
      SELECT
        ctr.id as country_id,
        ctr.code as country_code,
        ctr.name as country_name,
        SUM(i.amount / ${RATE_CASE_INV}) as total_revenue_eur,
        SUM(CASE WHEN i.invoice_type_id = 1 THEN i.amount / ${RATE_CASE_INV} ELSE 0 END) as total_trial_revenue_eur,
        SUM(CASE WHEN i.invoice_type_id = 2 THEN i.amount / ${RATE_CASE_INV} ELSE 0 END) as total_rebill_revenue_eur
      FROM avocode.invoices i
      INNER JOIN avocode.google_ads_details gad ON gad.customer_id = i.customer_id
      INNER JOIN avocodebo.campaigns camp ON camp.google_campaign_id = gad.utm_campaign
      INNER JOIN avocode.countries ctr ON ctr.id = camp.country_id
      WHERE ${dateFilter}
        AND i.invoice_status_id = 1
        AND i.invoice_type_id IN (1, 2)
        ${websiteFilter}
      GROUP BY ctr.id, ctr.code, ctr.name
    `,
    params: [],
    permissions: ["SELECT"],
  };
}

/**
 * Total Refunds by Country (PERIOD-BASED)
 * All refunds transacted in the period
 */
export function totalRefundsByCountryQuery(dateRange: DateRangeConfig, websiteId?: number): QueryDefinition {
  const dateFilterInv = dateRange.type === 'period'
    ? `i.transacted_at >= DATE_SUB(CURDATE(), INTERVAL ${dateRange.days} DAY)`
    : `i.transacted_at >= '${dateRange.startDate}' AND i.transacted_at < '${dateRange.endDate}'`;

  const dateFilterZoho = dateRange.type === 'period'
    ? `zr.created_at >= DATE_SUB(CURDATE(), INTERVAL ${dateRange.days} DAY)`
    : `zr.created_at >= '${dateRange.startDate}' AND zr.created_at < '${dateRange.endDate}'`;

  const websiteFilter = websiteId ? `AND camp.website_id = ${websiteId}` : '';

  return {
    id: "countries-total-refunds" as any,
    name: `Total Refunds by Country (${dateRange.type === 'period' ? dateRange.days + 'd' : 'cohort'})`,
    description: "All refunds transacted in period by campaign country",
    sql: `
      SELECT
        country_id,
        country_code,
        country_name,
        SUM(refund_eur) as total_refunds_eur
      FROM (
        -- Invoice refunds (Avocode/KiwiKode)
        SELECT
          ctr.id as country_id,
          ctr.code as country_code,
          ctr.name as country_name,
          SUM(i.amount / ${RATE_CASE_INV}) as refund_eur
        FROM avocode.invoices i
        INNER JOIN avocode.google_ads_details gad ON gad.customer_id = i.customer_id
        INNER JOIN avocodebo.campaigns camp ON camp.google_campaign_id = gad.utm_campaign
        INNER JOIN avocode.countries ctr ON ctr.id = camp.country_id
        WHERE ${dateFilterInv}
          AND i.invoice_status_id = 1
          AND i.invoice_type_id = 3
          AND i.company_id != 3
          ${websiteFilter}
        GROUP BY ctr.id, ctr.code, ctr.name

        UNION ALL

        -- Zoho refunds (Jackcode)
        SELECT
          ctr.id as country_id,
          ctr.code as country_code,
          ctr.name as country_name,
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
        LEFT JOIN avocode.google_ads_details gad ON gad.customer_id = inv.customer_id
        LEFT JOIN avocodebo.campaigns camp ON camp.google_campaign_id = gad.utm_campaign
        LEFT JOIN avocode.countries ctr ON ctr.id = camp.country_id
        WHERE ${dateFilterZoho}
          AND ctr.id IS NOT NULL
          ${websiteFilter}
        GROUP BY ctr.id, ctr.code, ctr.name
      ) combined
      GROUP BY country_id, country_code, country_name
    `,
    params: [],
    permissions: ["SELECT"],
  };
}

/**
 * Refunds M1 by Country (COHORT-BASED)
 * Only includes refunds from customers ACQUIRED in the period
 */
export function refundsByCountryQuery(dateRange: DateRangeConfig, websiteId?: number): QueryDefinition {
  const dateFilter = dateRange.type === 'period'
    ? `c.create_time >= DATE_SUB(CURDATE(), INTERVAL ${dateRange.days} DAY)`
    : `c.create_time >= '${dateRange.startDate}' AND c.create_time < '${dateRange.endDate}'`;

  const websiteFilter = websiteId ? `AND camp.website_id = ${websiteId}` : '';

  return {
    id: "countries-refunds-m1" as any,
    name: `Refunds M1 by Country (${dateRange.type === 'period' ? dateRange.days + 'd' : 'cohort'})`,
    description: "Refunds from cohort acquired in period by campaign country",
    sql: `
      SELECT
        country_id,
        country_code,
        country_name,
        SUM(refund_eur) as total_refunds_eur
      FROM (
        -- Invoice refunds (Avocode/KiwiKode) for cohort
        SELECT
          ctr.id as country_id,
          ctr.code as country_code,
          ctr.name as country_name,
          SUM(ref_inv.amount / ${RATE_CASE_REF}) as refund_eur
        FROM avocode.customers c
        INNER JOIN avocode.google_ads_details gad ON gad.customer_id = c.id
        INNER JOIN avocodebo.campaigns camp ON camp.google_campaign_id = gad.utm_campaign
        INNER JOIN avocode.countries ctr ON ctr.id = camp.country_id
        INNER JOIN avocode.invoices ref_inv ON ref_inv.customer_id = c.id
          AND ref_inv.invoice_type_id = 3
          AND ref_inv.invoice_status_id = 1
          AND ref_inv.company_id != 3
        WHERE ${dateFilter}
          ${websiteFilter}
        GROUP BY ctr.id, ctr.code, ctr.name

        UNION ALL

        -- Zoho refunds (Jackcode) for cohort
        SELECT
          ctr.id as country_id,
          ctr.code as country_code,
          ctr.name as country_name,
          SUM(zr.amount / CASE
            WHEN COALESCE(zc.currency_code, zosc.currency_code) = 'EUR' THEN 1
            WHEN COALESCE(zc.currency_code, zosc.currency_code) = 'RON' THEN ${RON_RATE}
            ELSE 1
          END) as refund_eur
        FROM avocode.customers c
        INNER JOIN avocode.google_ads_details gad ON gad.customer_id = c.id
        INNER JOIN avocodebo.campaigns camp ON camp.google_campaign_id = gad.utm_campaign
        INNER JOIN avocode.countries ctr ON ctr.id = camp.country_id
        INNER JOIN avocodebo.zoho_refunds zr ON 1=1
        LEFT JOIN avocodebo.zoho_credit_notes zcn ON zr.zoho_credit_note_id = zcn.id
        LEFT JOIN avocodebo.zoho_customers zc ON zcn.zoho_customer_id = zc.id
        LEFT JOIN avocodebo.zoho_one_shot_customers zosc ON zcn.zoho_one_shot_customer_id = zosc.id
        LEFT JOIN avocodebo.zoho_invoices zi ON zi.id = zcn.zoho_invoice_id
        LEFT JOIN avocode.invoices inv ON inv.id = zi.invoice_id
        WHERE ${dateFilter}
          AND inv.customer_id = c.id
          ${websiteFilter}
        GROUP BY ctr.id, ctr.code, ctr.name
      ) combined
      GROUP BY country_id, country_code, country_name
    `,
    params: [],
    permissions: ["SELECT"],
  };
}

/**
 * Ad Spend by Country
 * From campaigns.country_id
 */
export function adSpendByCountryQuery(dateRange: DateRangeConfig, websiteId?: number): QueryDefinition {
  const dateFilter = dateRange.type === 'period'
    ? `a.date >= DATE_SUB(CURDATE(), INTERVAL ${dateRange.days} DAY)`
    : `a.date >= '${dateRange.startDate}' AND a.date < '${dateRange.endDate}'`;

  const websiteFilter = websiteId ? `AND c.website_id = ${websiteId}` : '';

  return {
    id: "countries-ad-spend" as any,
    name: `Ad Spend by Country (${dateRange.type === 'period' ? dateRange.days + 'd' : 'cohort'})`,
    description: "Ad spend by campaign country, converted to EUR",
    sql: `
      SELECT
        ctr.id as country_id,
        ctr.code as country_code,
        ctr.name as country_name,
        SUM(a.cost / CASE c.currency_id
          WHEN 2 THEN 1
          WHEN 4 THEN ${RON_RATE}
          ELSE 1
        END) as total_spend_eur
      FROM avocodebo.ads a
      INNER JOIN avocodebo.campaigns c ON a.campaign_id = c.id
      INNER JOIN avocode.countries ctr ON ctr.id = c.country_id
      WHERE ${dateFilter}
        AND c.website_id IN (1, 3, 4)
        ${websiteFilter}
      GROUP BY ctr.id, ctr.code, ctr.name
    `,
    params: [],
    permissions: ["SELECT"],
  };
}

/**
 * Trials and First Rebills by Country (cohort-based FRR)
 */
export function frrByCountryQuery(dateRange: DateRangeConfig, websiteId?: number): QueryDefinition {
  const dateFilter = dateRange.type === 'period'
    ? `c.create_time >= DATE_SUB(CURDATE(), INTERVAL ${dateRange.days} DAY)`
    : `c.create_time >= '${dateRange.startDate}' AND c.create_time < '${dateRange.endDate}'`;

  const websiteFilter = websiteId ? `AND camp.website_id = ${websiteId}` : '';

  return {
    id: "countries-frr" as any,
    name: `FRR by Country (${dateRange.type === 'period' ? dateRange.days + 'd' : 'cohort'})`,
    description: "First Rebill Rate by campaign country for customers acquired in period",
    sql: `
      SELECT
        ctr.id as country_id,
        ctr.code as country_code,
        ctr.name as country_name,
        COUNT(DISTINCT c.id) as trial_count,
        COUNT(DISTINCT CASE WHEN fr.customer_id IS NOT NULL THEN c.id END) as first_rebill_count
      FROM avocode.customers c
      INNER JOIN avocode.google_ads_details gad ON gad.customer_id = c.id
      INNER JOIN avocodebo.campaigns camp ON camp.google_campaign_id = gad.utm_campaign
      INNER JOIN avocode.countries ctr ON ctr.id = camp.country_id
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
        ${websiteFilter}
      GROUP BY ctr.id, ctr.code, ctr.name
    `,
    params: [],
    permissions: ["SELECT"],
  };
}

/**
 * Refund Rate M1 by Country (transaction-based)
 */
export function refundRateM1ByCountryQuery(dateRange: DateRangeConfig, websiteId?: number): QueryDefinition {
  const dateFilter = dateRange.type === 'period'
    ? `c.create_time >= DATE_SUB(CURDATE(), INTERVAL ${dateRange.days} DAY)`
    : `c.create_time >= '${dateRange.startDate}' AND c.create_time < '${dateRange.endDate}'`;

  const websiteFilter = websiteId ? `AND camp.website_id = ${websiteId}` : '';

  return {
    id: "countries-refund-rate-m1" as any,
    name: `Refund Rate M1 by Country (${dateRange.type === 'period' ? dateRange.days + 'd' : 'cohort'})`,
    description: "Transaction-based refund rate on first rebills by campaign country",
    sql: `
      SELECT
        ctr.id as country_id,
        ctr.code as country_code,
        ctr.name as country_name,
        COUNT(DISTINCT fr.customer_id) as total_first_rebills,
        COUNT(DISTINCT CASE
          WHEN fr.company_id != 3 AND ref_inv.id IS NOT NULL THEN fr.customer_id
          WHEN fr.company_id = 3 AND zoho_ref.customer_id IS NOT NULL THEN fr.customer_id
          ELSE NULL
        END) as refunded_first_rebills
      FROM avocode.customers c
      INNER JOIN avocode.google_ads_details gad ON gad.customer_id = c.id
      INNER JOIN avocodebo.campaigns camp ON camp.google_campaign_id = gad.utm_campaign
      INNER JOIN avocode.countries ctr ON ctr.id = camp.country_id
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
        ${websiteFilter}
      GROUP BY ctr.id, ctr.code, ctr.name
    `,
    params: [],
    permissions: ["SELECT"],
  };
}

/**
 * Dispute Rate by Country
 */
export function disputeRateByCountryQuery(dateRange: DateRangeConfig, websiteId?: number): QueryDefinition {
  const dateFilter = dateRange.type === 'period'
    ? `i.transacted_at >= DATE_SUB(CURDATE(), INTERVAL ${dateRange.days} DAY)`
    : `i.transacted_at >= '${dateRange.startDate}' AND i.transacted_at < '${dateRange.endDate}'`;

  const websiteFilter = websiteId ? `AND camp.website_id = ${websiteId}` : '';

  return {
    id: "countries-dispute-rate" as any,
    name: `Dispute Rate by Country (${dateRange.type === 'period' ? dateRange.days + 'd' : 'cohort'})`,
    description: "Chargeback rate by campaign country",
    sql: `
      SELECT
        ctr.id as country_id,
        ctr.code as country_code,
        ctr.name as country_name,
        COUNT(*) as total_transactions,
        SUM(CASE WHEN i.invoice_type_id = 4 THEN 1 ELSE 0 END) as chargeback_count
      FROM avocode.invoices i
      INNER JOIN avocode.google_ads_details gad ON gad.customer_id = i.customer_id
      INNER JOIN avocodebo.campaigns camp ON camp.google_campaign_id = gad.utm_campaign
      INNER JOIN avocode.countries ctr ON ctr.id = camp.country_id
      WHERE ${dateFilter}
        AND i.invoice_status_id = 1
        AND i.invoice_type_id IN (1, 2, 4)
        ${websiteFilter}
      GROUP BY ctr.id, ctr.code, ctr.name
    `,
    params: [],
    permissions: ["SELECT"],
  };
}
