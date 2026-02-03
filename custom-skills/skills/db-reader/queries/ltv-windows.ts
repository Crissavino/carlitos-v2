import { QueryDefinition, QueryBuilder } from "../types.js";
import { buildCurrencyRateCase } from "../../../core/currency.js";

/**
 * LTV Queries - Ventanas correctas basadas en modelo de cobro real
 *
 * HARDENING: Filter by website_id through customers table
 *
 * MODELO DE COBRO (desde acquisition D0):
 * - Trial: 2 días
 * - R1 ventana completa: D21 (D2 + 19 días de reintentos)
 * - R2 ventana completa: D51 (D32 + 19 días de reintentos)
 * - R3 ventana completa: D81 (D62 + 19 días de reintentos)
 */

// Jackcode company_id
const JACKCODE_COMPANY_ID = 3;

// SQL CASE for currency conversion (from centralized CurrencyConverter)
const RATE_CASE = buildCurrencyRateCase('i.currency_code');
const RATE_CASE_INV = buildCurrencyRateCase('inv.currency_code');

/**
 * MySQL 5.7 compatible query with website_id filtering
 * OPTIMIZED: Uses JOINs instead of correlated subqueries for O(n) instead of O(n²)
 */
const buildLtvWindowQueryCompat = (days: number, lookbackDays: number = 120, websiteId?: number): string => {
  const websiteFilter = websiteId ? `AND c.website_id = ${websiteId}` : '';

  // Use pre-aggregated subqueries with JOINs instead of correlated subqueries
  return `
    SELECT
      ROUND(
        SUM(COALESCE(rev.amount_eur, 0) - COALESCE(ref.amount_eur, 0) - COALESCE(zref.amount_eur, 0)) / NULLIF(COUNT(DISTINCT c.id), 0),
        2
      ) as ltv_${days}d,

      COUNT(DISTINCT c.id) as cohort_size,
      SUM(CASE WHEN rev.amount_eur > 0 THEN 1 ELSE 0 END) as customers_with_revenue,
      ROUND(
        SUM(CASE WHEN rev.amount_eur > 0 THEN 1 ELSE 0 END) * 100.0 / NULLIF(COUNT(DISTINCT c.id), 0),
        1
      ) as conversion_rate_pct,

      ROUND(SUM(COALESCE(rev.amount_eur, 0)), 2) as total_gross_revenue_eur,
      ROUND(SUM(COALESCE(ref.amount_eur, 0) + COALESCE(zref.amount_eur, 0)), 2) as total_refunds_eur,
      ROUND(SUM(COALESCE(rev.amount_eur, 0) - COALESCE(ref.amount_eur, 0) - COALESCE(zref.amount_eur, 0)), 2) as total_net_revenue_eur

    FROM avocode.customers c

    -- Pre-aggregated revenue per customer (subscription invoices within window)
    LEFT JOIN (
      SELECT
        i.customer_id,
        SUM(i.amount / ${RATE_CASE}) as amount_eur
      FROM avocode.invoices i
      JOIN avocode.customers c2 ON i.customer_id = c2.id
      WHERE i.invoice_status_id = 1
        AND i.invoice_type_id = 2
        AND i.transacted_at <= DATE_ADD(c2.create_time, INTERVAL ${days} DAY)
        AND c2.create_time <= DATE_SUB(CURDATE(), INTERVAL ${days} DAY)
        AND c2.create_time >= DATE_SUB(CURDATE(), INTERVAL ${lookbackDays} DAY)
        ${websiteFilter.replace('c.website_id', 'c2.website_id')}
      GROUP BY i.customer_id
    ) rev ON rev.customer_id = c.id

    -- Pre-aggregated refunds per customer (type 3 invoices, non-Jackcode)
    LEFT JOIN (
      SELECT
        i.customer_id,
        SUM(i.amount / ${RATE_CASE}) as amount_eur
      FROM avocode.invoices i
      JOIN avocode.customers c2 ON i.customer_id = c2.id
      WHERE i.invoice_status_id = 1
        AND i.invoice_type_id = 3
        AND i.company_id != ${JACKCODE_COMPANY_ID}
        AND i.transacted_at <= DATE_ADD(c2.create_time, INTERVAL ${days} DAY)
        AND c2.create_time <= DATE_SUB(CURDATE(), INTERVAL ${days} DAY)
        AND c2.create_time >= DATE_SUB(CURDATE(), INTERVAL ${lookbackDays} DAY)
        ${websiteFilter.replace('c.website_id', 'c2.website_id')}
      GROUP BY i.customer_id
    ) ref ON ref.customer_id = c.id

    -- Pre-aggregated Zoho refunds per customer (Jackcode only)
    LEFT JOIN (
      SELECT
        inv.customer_id,
        SUM(zr.amount / ${RATE_CASE_INV}) as amount_eur
      FROM avocodebo.zoho_refunds zr
      JOIN avocodebo.zoho_credit_notes zcn ON zcn.id = zr.zoho_credit_note_id
      JOIN avocodebo.zoho_invoices zi ON zi.id = zcn.zoho_invoice_id
      JOIN avocode.invoices inv ON inv.id = zi.invoice_id
      JOIN avocode.customers c2 ON inv.customer_id = c2.id
      WHERE inv.company_id = ${JACKCODE_COMPANY_ID}
        AND zr.created_at <= DATE_ADD(c2.create_time, INTERVAL ${days} DAY)
        AND c2.create_time <= DATE_SUB(CURDATE(), INTERVAL ${days} DAY)
        AND c2.create_time >= DATE_SUB(CURDATE(), INTERVAL ${lookbackDays} DAY)
        ${websiteFilter.replace('c.website_id', 'c2.website_id')}
      GROUP BY inv.customer_id
    ) zref ON zref.customer_id = c.id

    WHERE c.create_time <= DATE_SUB(CURDATE(), INTERVAL ${days} DAY)
      AND c.create_time >= DATE_SUB(CURDATE(), INTERVAL ${lookbackDays} DAY)
      ${websiteFilter}
  `;
};

// ============================================================================
// QUERY DEFINITIONS
// ============================================================================

/**
 * LTV 21 días - Ventana R1 completa
 * Para warning temprano (nunca decisiones fuertes)
 */
export const ltv21dQuery: QueryBuilder = (websiteId?: number): QueryDefinition => ({
  id: "ltv-21d",
  name: "LTV 21 días (R1 completo)",
  description: "LTV ventana R1 completa. Cohorte desde acquisition, incluye todos los customers.",
  sql: buildLtvWindowQueryCompat(21, 90, websiteId),
  params: [],
  permissions: ["SELECT"],
});

/**
 * LTV 51 días - Ventana R2 completa
 * Para decisiones fuertes (pause/scale)
 */
export const ltv51dQuery: QueryBuilder = (websiteId?: number): QueryDefinition => ({
  id: "ltv-51d",
  name: "LTV 51 días (R2 completo)",
  description: "LTV ventana R2 completa. Base para decisiones de ads (pause/scale).",
  sql: buildLtvWindowQueryCompat(51, 120, websiteId),
  params: [],
  permissions: ["SELECT"],
});

/**
 * LTV 81 días - Ventana R3 completa
 * Para análisis estratégico
 */
export const ltv81dQuery: QueryBuilder = (websiteId?: number): QueryDefinition => ({
  id: "ltv-81d",
  name: "LTV 81 días (R3 completo)",
  description: "LTV ventana R3 completa. Análisis estratégico de retención largo plazo.",
  sql: buildLtvWindowQueryCompat(81, 180, websiteId),
  params: [],
  permissions: ["SELECT"],
});
