import { QueryDefinition } from "../types.js";
import { buildCurrencyRateCase } from "../../../core/currency.js";

/**
 * LTV Queries - Ventanas correctas basadas en modelo de cobro real
 *
 * MODELO DE COBRO (desde acquisition D0):
 * - Trial: 2 días
 * - R1 ventana completa: D21 (D2 + 19 días de reintentos)
 * - R2 ventana completa: D51 (D32 + 19 días de reintentos)
 * - R3 ventana completa: D81 (D62 + 19 días de reintentos)
 *
 * DEFINICIÓN LTV CORRECTA:
 * LTV_Nd = (SUM(revenue_subscriptions) - SUM(refunds)) / COUNT(customers_en_cohorte)
 *
 * FUENTES DE DATOS:
 * - Cohorte: avocode.customers (create_time = acquisition date)
 * - Revenue: avocode.invoices (invoice_type_id = 2)
 * - Refunds:
 *   - Avocode/Kiwikode (company_id 1,2): avocode.invoices (invoice_type_id = 3)
 *   - Jackcode (company_id 3): zoho_refunds via chain
 *
 * ESQUEMA REAL:
 * - customers: id, create_time, website_id
 * - invoices: customer_id, company_id, invoice_type_id, transacted_at, amount, currency_code
 * - zoho_refunds → zoho_credit_notes → zoho_invoices → invoices
 */

// Jackcode company_id
const JACKCODE_COMPANY_ID = 3;

// SQL CASE for currency conversion (from centralized CurrencyConverter)
const RATE_CASE = buildCurrencyRateCase('i.currency_code');
const RATE_CASE_INV = buildCurrencyRateCase('inv.currency_code');

/**
 * Construye query LTV para una ventana específica
 * Usa esquema real verificado en producción
 */
const buildLtvWindowQuery = (days: number, lookbackDays: number = 120): string => `
  SELECT
    -- LTV = SUM(net_revenue) / COUNT(customers_en_cohorte)
    ROUND(
      COALESCE(SUM(net_revenue_eur), 0) / NULLIF(COUNT(*), 0),
      2
    ) as ltv_${days}d,

    -- Métricas de cohorte
    COUNT(*) as cohort_size,
    SUM(CASE WHEN gross_revenue_eur > 0 THEN 1 ELSE 0 END) as customers_with_revenue,
    ROUND(
      SUM(CASE WHEN gross_revenue_eur > 0 THEN 1 ELSE 0 END) * 100.0 / NULLIF(COUNT(*), 0),
      1
    ) as conversion_rate_pct,

    -- Revenue breakdown
    ROUND(COALESCE(SUM(gross_revenue_eur), 0), 2) as total_gross_revenue_eur,
    ROUND(COALESCE(SUM(total_refunds_eur), 0), 2) as total_refunds_eur,
    ROUND(COALESCE(SUM(net_revenue_eur), 0), 2) as total_net_revenue_eur

  FROM (
    SELECT
      c.id as customer_id,
      c.create_time as acquisition_date,

      -- Gross revenue: invoices type 2 (subscriptions) within window
      COALESCE((
        SELECT SUM(i.amount / ${RATE_CASE})
        FROM avocode.invoices i
        WHERE i.customer_id = c.id
          AND i.invoice_status_id = 1
          AND i.invoice_type_id = 2
          AND i.transacted_at <= DATE_ADD(c.create_time, INTERVAL ${days} DAY)
      ), 0) as gross_revenue_eur,

      -- Refunds from invoices type 3 (Avocode/Kiwikode: company_id 1,2)
      COALESCE((
        SELECT SUM(i.amount / ${RATE_CASE})
        FROM avocode.invoices i
        WHERE i.customer_id = c.id
          AND i.invoice_status_id = 1
          AND i.invoice_type_id = 3
          AND i.company_id != ${JACKCODE_COMPANY_ID}
          AND i.transacted_at <= DATE_ADD(c.create_time, INTERVAL ${days} DAY)
      ), 0) as invoice_refunds_eur,

      -- Refunds from Zoho (Jackcode: company_id 3)
      -- Chain: zoho_refunds → zoho_credit_notes → zoho_invoices → invoices
      COALESCE((
        SELECT SUM(zr.amount / ${RATE_CASE_INV})
        FROM avocodebo.zoho_refunds zr
        JOIN avocodebo.zoho_credit_notes zcn ON zcn.id = zr.zoho_credit_note_id
        JOIN avocodebo.zoho_invoices zi ON zi.id = zcn.zoho_invoice_id
        JOIN avocode.invoices inv ON inv.id = zi.invoice_id
        WHERE inv.customer_id = c.id
          AND inv.company_id = ${JACKCODE_COMPANY_ID}
          AND zr.created_at <= DATE_ADD(c.create_time, INTERVAL ${days} DAY)
      ), 0) as zoho_refunds_eur

    FROM avocode.customers c
    WHERE
      -- Cohorte: customers con ventana completa (acquisition hace más de N días)
      c.create_time <= DATE_SUB(CURDATE(), INTERVAL ${days} DAY)
      -- Lookback para evitar datos muy antiguos
      AND c.create_time >= DATE_SUB(CURDATE(), INTERVAL ${lookbackDays} DAY)

  ) cohort_data,

  -- Calculate net revenue inline
  LATERAL (
    SELECT
      gross_revenue_eur - invoice_refunds_eur - zoho_refunds_eur as net_revenue_eur,
      invoice_refunds_eur + zoho_refunds_eur as total_refunds_eur
  ) calc
`;

/**
 * Query sin LATERAL (MySQL 5.7 compatible)
 */
const buildLtvWindowQueryCompat = (days: number, lookbackDays: number = 120): string => `
  SELECT
    ROUND(
      SUM(gross_revenue_eur - invoice_refunds_eur - zoho_refunds_eur) / NULLIF(COUNT(*), 0),
      2
    ) as ltv_${days}d,

    COUNT(*) as cohort_size,
    SUM(CASE WHEN gross_revenue_eur > 0 THEN 1 ELSE 0 END) as customers_with_revenue,
    ROUND(
      SUM(CASE WHEN gross_revenue_eur > 0 THEN 1 ELSE 0 END) * 100.0 / NULLIF(COUNT(*), 0),
      1
    ) as conversion_rate_pct,

    ROUND(SUM(gross_revenue_eur), 2) as total_gross_revenue_eur,
    ROUND(SUM(invoice_refunds_eur + zoho_refunds_eur), 2) as total_refunds_eur,
    ROUND(SUM(gross_revenue_eur - invoice_refunds_eur - zoho_refunds_eur), 2) as total_net_revenue_eur

  FROM (
    SELECT
      c.id as customer_id,

      -- Gross revenue (subscriptions type 2) within window
      COALESCE((
        SELECT SUM(i.amount / ${RATE_CASE})
        FROM avocode.invoices i
        WHERE i.customer_id = c.id
          AND i.invoice_status_id = 1
          AND i.invoice_type_id = 2
          AND i.transacted_at <= DATE_ADD(c.create_time, INTERVAL ${days} DAY)
      ), 0) as gross_revenue_eur,

      -- Refunds type 3 (Avocode/Kiwikode only, company_id != 3)
      COALESCE((
        SELECT SUM(i.amount / ${RATE_CASE})
        FROM avocode.invoices i
        WHERE i.customer_id = c.id
          AND i.invoice_status_id = 1
          AND i.invoice_type_id = 3
          AND i.company_id != ${JACKCODE_COMPANY_ID}
          AND i.transacted_at <= DATE_ADD(c.create_time, INTERVAL ${days} DAY)
      ), 0) as invoice_refunds_eur,

      -- Zoho refunds (Jackcode only, company_id = 3)
      -- Chain: zoho_refunds → zoho_credit_notes → zoho_invoices → invoices
      COALESCE((
        SELECT SUM(zr.amount / ${RATE_CASE_INV})
        FROM avocodebo.zoho_refunds zr
        JOIN avocodebo.zoho_credit_notes zcn ON zcn.id = zr.zoho_credit_note_id
        JOIN avocodebo.zoho_invoices zi ON zi.id = zcn.zoho_invoice_id
        JOIN avocode.invoices inv ON inv.id = zi.invoice_id
        WHERE inv.customer_id = c.id
          AND inv.company_id = ${JACKCODE_COMPANY_ID}
          AND zr.created_at <= DATE_ADD(c.create_time, INTERVAL ${days} DAY)
      ), 0) as zoho_refunds_eur

    FROM avocode.customers c
    WHERE c.create_time <= DATE_SUB(CURDATE(), INTERVAL ${days} DAY)
      AND c.create_time >= DATE_SUB(CURDATE(), INTERVAL ${lookbackDays} DAY)
  ) cohort
`;

// ============================================================================
// QUERY DEFINITIONS
// ============================================================================

/**
 * LTV 21 días - Ventana R1 completa
 * Para warning temprano (nunca decisiones fuertes)
 */
export const ltv21dQuery: QueryDefinition = {
  id: "ltv-21d",
  name: "LTV 21 días (R1 completo)",
  description: "LTV ventana R1 completa. Cohorte desde acquisition, incluye todos los customers.",
  sql: buildLtvWindowQueryCompat(21, 90),
  params: [],
  permissions: ["SELECT"],
};

/**
 * LTV 51 días - Ventana R2 completa
 * Para decisiones fuertes (pause/scale)
 */
export const ltv51dQuery: QueryDefinition = {
  id: "ltv-51d",
  name: "LTV 51 días (R2 completo)",
  description: "LTV ventana R2 completa. Base para decisiones de ads (pause/scale).",
  sql: buildLtvWindowQueryCompat(51, 120),
  params: [],
  permissions: ["SELECT"],
};

/**
 * LTV 81 días - Ventana R3 completa
 * Para análisis estratégico
 */
export const ltv81dQuery: QueryDefinition = {
  id: "ltv-81d",
  name: "LTV 81 días (R3 completo)",
  description: "LTV ventana R3 completa. Análisis estratégico de retención largo plazo.",
  sql: buildLtvWindowQueryCompat(81, 180),
  params: [],
  permissions: ["SELECT"],
};
