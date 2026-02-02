import { QueryDefinition, QueryBuilder } from "../types.js";
import { buildCurrencyRateCase } from "../../../core/currency.js";

/**
 * Business Aggregation Queries - Phase 7.5
 *
 * HARDENING: All queries support optional websiteId filtering
 */

const JACKCODE_COMPANY_ID = 3;
const RATE_CASE_INV = buildCurrencyRateCase('inv.currency_code');

/**
 * Aggregation by Website
 */
export const websiteAggregationQuery: QueryBuilder = (websiteId?: number): QueryDefinition => {
  const websiteFilter = websiteId ? `AND w.id = ?` : '';
  const params = websiteId ? [websiteId] : [];

  return {
    id: "business-by-website" as any,
    name: "Business Aggregation by Website",
    description: "Métricas agregadas por website",
    sql: `
      SELECT
        w.id as website_id,
        w.name as website_name,
        COUNT(DISTINCT camp.id) as total_campaigns,
        SUM(CASE WHEN camp.active = 1 THEN 1 ELSE 0 END) as active_campaigns,
        MIN(DATEDIFF(CURDATE(), camp.started_at)) as min_campaign_age_days,
        0 as spend_7d_placeholder,
        COALESCE(SUM((
          SELECT COUNT(DISTINCT gad.customer_id)
          FROM avocode.google_ads_details gad
          WHERE gad.utm_campaign = camp.google_campaign_id
        )), 0) as total_acquisitions,
        COALESCE(SUM((
          SELECT COUNT(DISTINCT gad.customer_id)
          FROM avocode.google_ads_details gad
          JOIN avocode.invoices i ON i.customer_id = gad.customer_id
          WHERE gad.utm_campaign = camp.google_campaign_id
            AND i.invoice_status_id = 1 AND i.invoice_type_id = 2
        )), 0) as total_first_rebills,
        COALESCE(SUM((
          SELECT SUM(
            COALESCE((SELECT SUM(inv.amount / ${RATE_CASE_INV}) FROM avocode.invoices inv
              WHERE inv.customer_id = c.id AND inv.invoice_status_id = 1 AND inv.invoice_type_id = 2
              AND inv.transacted_at <= DATE_ADD(c.create_time, INTERVAL 51 DAY)), 0)
            - COALESCE((SELECT SUM(inv.amount / ${RATE_CASE_INV}) FROM avocode.invoices inv
              WHERE inv.customer_id = c.id AND inv.invoice_status_id = 1 AND inv.invoice_type_id = 3
              AND inv.company_id != ${JACKCODE_COMPANY_ID}
              AND inv.transacted_at <= DATE_ADD(c.create_time, INTERVAL 51 DAY)), 0))
          FROM avocode.google_ads_details gad
          JOIN avocode.customers c ON c.id = gad.customer_id
          WHERE gad.utm_campaign = camp.google_campaign_id
            AND c.create_time <= DATE_SUB(CURDATE(), INTERVAL 51 DAY)
            AND c.create_time >= DATE_SUB(CURDATE(), INTERVAL 180 DAY)
        )), 0) as total_revenue_51d,
        COALESCE(SUM((
          SELECT COUNT(DISTINCT gad.customer_id)
          FROM avocode.google_ads_details gad
          JOIN avocode.customers c ON c.id = gad.customer_id
          WHERE gad.utm_campaign = camp.google_campaign_id
            AND c.create_time <= DATE_SUB(CURDATE(), INTERVAL 51 DAY)
        )), 0) as cohort_51d_size
      FROM avocode.websites w
      JOIN avocodebo.campaigns camp ON camp.website_id = w.id
      WHERE camp.google_campaign_id IS NOT NULL AND camp.google_campaign_id != ''
        ${websiteFilter}
      GROUP BY w.id, w.name
      ORDER BY total_acquisitions DESC
    `,
    params,
    permissions: ["SELECT"],
  };
};

/**
 * Aggregation by Company
 */
export const companyAggregationQuery: QueryBuilder = (websiteId?: number): QueryDefinition => {
  const websiteFilter = websiteId ? `AND camp.website_id = ?` : '';
  const params = websiteId ? [websiteId] : [];

  return {
    id: "business-by-company" as any,
    name: "Business Aggregation by Company",
    description: "Métricas agregadas por empresa",
    sql: `
      SELECT
        co.id as company_id,
        co.name as company_name,
        COUNT(DISTINCT camp.id) as total_campaigns,
        SUM(CASE WHEN camp.active = 1 THEN 1 ELSE 0 END) as active_campaigns,
        COUNT(DISTINCT camp.website_id) as total_websites,
        MIN(DATEDIFF(CURDATE(), camp.started_at)) as min_campaign_age_days,
        COALESCE(SUM((
          SELECT COUNT(DISTINCT gad.customer_id)
          FROM avocode.google_ads_details gad
          WHERE gad.utm_campaign = camp.google_campaign_id
        )), 0) as total_acquisitions,
        COALESCE(SUM((
          SELECT COUNT(DISTINCT gad.customer_id)
          FROM avocode.google_ads_details gad
          JOIN avocode.invoices i ON i.customer_id = gad.customer_id
          WHERE gad.utm_campaign = camp.google_campaign_id
            AND i.invoice_status_id = 1 AND i.invoice_type_id = 2
        )), 0) as total_first_rebills,
        COALESCE(SUM((
          SELECT SUM(
            COALESCE((SELECT SUM(inv.amount / ${RATE_CASE_INV}) FROM avocode.invoices inv
              WHERE inv.customer_id = c.id AND inv.invoice_status_id = 1 AND inv.invoice_type_id = 2
              AND inv.transacted_at <= DATE_ADD(c.create_time, INTERVAL 51 DAY)), 0)
            - COALESCE((SELECT SUM(inv.amount / ${RATE_CASE_INV}) FROM avocode.invoices inv
              WHERE inv.customer_id = c.id AND inv.invoice_status_id = 1 AND inv.invoice_type_id = 3
              AND inv.company_id != ${JACKCODE_COMPANY_ID}
              AND inv.transacted_at <= DATE_ADD(c.create_time, INTERVAL 51 DAY)), 0))
          FROM avocode.google_ads_details gad
          JOIN avocode.customers c ON c.id = gad.customer_id
          WHERE gad.utm_campaign = camp.google_campaign_id
            AND c.create_time <= DATE_SUB(CURDATE(), INTERVAL 51 DAY)
            AND c.create_time >= DATE_SUB(CURDATE(), INTERVAL 180 DAY)
        )), 0) as total_revenue_51d,
        COALESCE(SUM((
          SELECT COUNT(DISTINCT gad.customer_id)
          FROM avocode.google_ads_details gad
          JOIN avocode.customers c ON c.id = gad.customer_id
          WHERE gad.utm_campaign = camp.google_campaign_id
            AND c.create_time <= DATE_SUB(CURDATE(), INTERVAL 51 DAY)
        )), 0) as cohort_51d_size
      FROM avocode.companies co
      JOIN avocodebo.campaigns camp ON camp.company_id = co.id
      WHERE camp.google_campaign_id IS NOT NULL AND camp.google_campaign_id != ''
        ${websiteFilter}
      GROUP BY co.id, co.name
      ORDER BY total_acquisitions DESC
    `,
    params,
    permissions: ["SELECT"],
  };
};

/**
 * Aggregation by Country
 */
export const countryAggregationQuery: QueryBuilder = (websiteId?: number): QueryDefinition => {
  const websiteFilter = websiteId ? `AND camp.website_id = ?` : '';
  const params = websiteId ? [websiteId] : [];

  return {
    id: "business-by-country" as any,
    name: "Business Aggregation by Country",
    description: "Métricas agregadas por país",
    sql: `
      SELECT
        ctr.id as country_id,
        ctr.name as country_name,
        ctr.code as country_code,
        COUNT(DISTINCT camp.id) as total_campaigns,
        SUM(CASE WHEN camp.active = 1 THEN 1 ELSE 0 END) as active_campaigns,
        MIN(DATEDIFF(CURDATE(), camp.started_at)) as min_campaign_age_days,
        COALESCE(SUM((
          SELECT COUNT(DISTINCT gad.customer_id)
          FROM avocode.google_ads_details gad
          WHERE gad.utm_campaign = camp.google_campaign_id
        )), 0) as total_acquisitions,
        COALESCE(SUM((
          SELECT COUNT(DISTINCT gad.customer_id)
          FROM avocode.google_ads_details gad
          JOIN avocode.invoices i ON i.customer_id = gad.customer_id
          WHERE gad.utm_campaign = camp.google_campaign_id
            AND i.invoice_status_id = 1 AND i.invoice_type_id = 2
        )), 0) as total_first_rebills,
        COALESCE(SUM((
          SELECT SUM(
            COALESCE((SELECT SUM(inv.amount / ${RATE_CASE_INV}) FROM avocode.invoices inv
              WHERE inv.customer_id = c.id AND inv.invoice_status_id = 1 AND inv.invoice_type_id = 2
              AND inv.transacted_at <= DATE_ADD(c.create_time, INTERVAL 51 DAY)), 0)
            - COALESCE((SELECT SUM(inv.amount / ${RATE_CASE_INV}) FROM avocode.invoices inv
              WHERE inv.customer_id = c.id AND inv.invoice_status_id = 1 AND inv.invoice_type_id = 3
              AND inv.company_id != ${JACKCODE_COMPANY_ID}
              AND inv.transacted_at <= DATE_ADD(c.create_time, INTERVAL 51 DAY)), 0))
          FROM avocode.google_ads_details gad
          JOIN avocode.customers c ON c.id = gad.customer_id
          WHERE gad.utm_campaign = camp.google_campaign_id
            AND c.create_time <= DATE_SUB(CURDATE(), INTERVAL 51 DAY)
            AND c.create_time >= DATE_SUB(CURDATE(), INTERVAL 180 DAY)
        )), 0) as total_revenue_51d,
        COALESCE(SUM((
          SELECT COUNT(DISTINCT gad.customer_id)
          FROM avocode.google_ads_details gad
          JOIN avocode.customers c ON c.id = gad.customer_id
          WHERE gad.utm_campaign = camp.google_campaign_id
            AND c.create_time <= DATE_SUB(CURDATE(), INTERVAL 51 DAY)
        )), 0) as cohort_51d_size
      FROM avocode.countries ctr
      JOIN avocodebo.campaigns camp ON camp.country_id = ctr.id
      WHERE camp.google_campaign_id IS NOT NULL AND camp.google_campaign_id != ''
        ${websiteFilter}
      GROUP BY ctr.id, ctr.name, ctr.code
      HAVING total_acquisitions > 0
      ORDER BY total_acquisitions DESC
    `,
    params,
    permissions: ["SELECT"],
  };
};

/**
 * Campaign list for service classification
 */
export const campaignListForServiceQuery: QueryBuilder = (websiteId?: number): QueryDefinition => {
  const websiteFilter = websiteId ? `AND camp.website_id = ?` : '';
  const params = websiteId ? [websiteId] : [];

  return {
    id: "campaigns-for-service-classification" as any,
    name: "Campaign List for Service Classification",
    description: "Lista de campañas para clasificación por servicio",
    sql: `
      SELECT
        camp.id as campaign_id,
        camp.google_campaign_id,
        camp.name as campaign_name,
        camp.active,
        DATEDIFF(CURDATE(), camp.started_at) as campaign_age_days,
        (SELECT COUNT(DISTINCT gad.customer_id)
         FROM avocode.google_ads_details gad
         WHERE gad.utm_campaign = camp.google_campaign_id) as total_acquisitions,
        (SELECT COUNT(DISTINCT gad.customer_id)
         FROM avocode.google_ads_details gad
         JOIN avocode.invoices i ON i.customer_id = gad.customer_id
         WHERE gad.utm_campaign = camp.google_campaign_id
           AND i.invoice_status_id = 1 AND i.invoice_type_id = 2) as total_first_rebills,
        COALESCE((
          SELECT SUM(
            COALESCE((SELECT SUM(inv.amount / ${RATE_CASE_INV}) FROM avocode.invoices inv
              WHERE inv.customer_id = c.id AND inv.invoice_status_id = 1 AND inv.invoice_type_id = 2
              AND inv.transacted_at <= DATE_ADD(c.create_time, INTERVAL 51 DAY)), 0)
            - COALESCE((SELECT SUM(inv.amount / ${RATE_CASE_INV}) FROM avocode.invoices inv
              WHERE inv.customer_id = c.id AND inv.invoice_status_id = 1 AND inv.invoice_type_id = 3
              AND inv.company_id != ${JACKCODE_COMPANY_ID}
              AND inv.transacted_at <= DATE_ADD(c.create_time, INTERVAL 51 DAY)), 0))
          FROM avocode.google_ads_details gad
          JOIN avocode.customers c ON c.id = gad.customer_id
          WHERE gad.utm_campaign = camp.google_campaign_id
            AND c.create_time <= DATE_SUB(CURDATE(), INTERVAL 51 DAY)
            AND c.create_time >= DATE_SUB(CURDATE(), INTERVAL 180 DAY)
        ), 0) as total_revenue_51d,
        (SELECT COUNT(DISTINCT gad.customer_id)
         FROM avocode.google_ads_details gad
         JOIN avocode.customers c ON c.id = gad.customer_id
         WHERE gad.utm_campaign = camp.google_campaign_id
           AND c.create_time <= DATE_SUB(CURDATE(), INTERVAL 51 DAY)) as cohort_51d_size
      FROM avocodebo.campaigns camp
      WHERE camp.google_campaign_id IS NOT NULL AND camp.google_campaign_id != ''
        ${websiteFilter}
      ORDER BY total_acquisitions DESC
    `,
    params,
    permissions: ["SELECT"],
  };
};
