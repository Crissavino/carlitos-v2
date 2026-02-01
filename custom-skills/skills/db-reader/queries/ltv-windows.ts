import { QueryDefinition } from "../types.js";

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
 * - Cohorte: avocode.customers (created_at = acquisition date)
 * - Revenue: avocode.invoices (type = 2)
 * - Refunds:
 *   - Avocode/Kiwikode: avocode.invoices (type = 3)
 *   - Jackcode: zoho_refunds + zoho_credit_notes
 *
 * NOTA: No usamos AVG porque infla Payback al excluir churn temprano.
 */

/**
 * Company IDs para determinar fuente de refunds:
 * - Avocode (RO): company_id = 1
 * - Kiwikode (RO): company_id = 2
 * - Jackcode (Dubai): company_id = 3
 */
const JACKCODE_COMPANY_ID = 3;

/**
 * Conversión de monedas a EUR
 */
const CURRENCY_CONVERSION = `
  CASE currency_code
    WHEN 'EUR' THEN 1
    WHEN 'USD' THEN 1.08
    WHEN 'RON' THEN 4.97
    WHEN 'BRL' THEN 6.35
    WHEN 'CLP' THEN 1020
    WHEN 'HUF' THEN 408
    WHEN 'GBP' THEN 0.84
    WHEN 'UAH' THEN 43.5
    WHEN 'AED' THEN 3.97
    ELSE 1
  END
`;

/**
 * Construye query LTV para una ventana específica
 *
 * @param days - Ventana en días (21, 51, 81)
 * @param lookbackDays - Días hacia atrás para la cohorte (ej: 90 para últimos 3 meses)
 */
const buildLtvWindowQuery = (days: number, lookbackDays: number = 120): string => `
  SELECT
    -- LTV = SUM(revenue - refunds) / COUNT(customers)
    ROUND(
      COALESCE(SUM(revenue_eur), 0) / NULLIF(COUNT(*), 0),
      2
    ) as ltv_${days}d,

    -- Métricas de cohorte
    COUNT(*) as cohort_size,
    SUM(CASE WHEN revenue_eur > 0 THEN 1 ELSE 0 END) as customers_with_revenue,
    ROUND(SUM(CASE WHEN revenue_eur > 0 THEN 1 ELSE 0 END) * 100.0 / NULLIF(COUNT(*), 0), 1) as conversion_rate,

    -- Revenue breakdown
    ROUND(COALESCE(SUM(revenue_eur), 0), 2) as total_revenue_eur,
    ROUND(COALESCE(SUM(refunds_eur), 0), 2) as total_refunds_eur,
    ROUND(COALESCE(SUM(revenue_eur), 0) - COALESCE(SUM(refunds_eur), 0), 2) as net_revenue_eur

  FROM (
    SELECT
      c.id as customer_id,
      c.created_at as acquisition_date,
      c.company_id,

      -- Revenue from invoices type 2 (subscriptions) within window
      COALESCE((
        SELECT SUM(i.amount / ${CURRENCY_CONVERSION})
        FROM avocode.invoices i
        WHERE i.customer_id = c.id
          AND i.invoice_status_id = 1
          AND i.invoice_type_id = 2
          AND i.transacted_at <= DATE_ADD(c.created_at, INTERVAL ${days} DAY)
      ), 0) as gross_revenue_eur,

      -- Refunds from invoices type 3 (for Avocode/Kiwikode) within window
      COALESCE((
        SELECT SUM(i.amount / ${CURRENCY_CONVERSION})
        FROM avocode.invoices i
        WHERE i.customer_id = c.id
          AND i.invoice_status_id = 1
          AND i.invoice_type_id = 3
          AND i.transacted_at <= DATE_ADD(c.created_at, INTERVAL ${days} DAY)
          AND c.company_id != ${JACKCODE_COMPANY_ID}
      ), 0) as invoice_refunds_eur,

      -- Refunds from Zoho (for Jackcode) within window
      COALESCE((
        SELECT SUM(zr.amount / ${CURRENCY_CONVERSION.replace(/currency_code/g, 'zr.currency_code')})
        FROM avocodebo.zoho_refunds zr
        WHERE zr.customer_id = c.id
          AND zr.refund_date <= DATE_ADD(c.created_at, INTERVAL ${days} DAY)
          AND c.company_id = ${JACKCODE_COMPANY_ID}
      ), 0) +
      COALESCE((
        SELECT SUM(zcn.amount / ${CURRENCY_CONVERSION.replace(/currency_code/g, 'zcn.currency_code')})
        FROM avocodebo.zoho_credit_notes zcn
        WHERE zcn.customer_id = c.id
          AND zcn.credit_date <= DATE_ADD(c.created_at, INTERVAL ${days} DAY)
          AND c.company_id = ${JACKCODE_COMPANY_ID}
      ), 0) as zoho_refunds_eur

    FROM avocode.customers c
    WHERE
      -- Cohorte: customers adquiridos hace más de N días (ventana completa)
      c.created_at <= DATE_SUB(CURDATE(), INTERVAL ${days} DAY)
      -- Lookback: solo últimos X días para evitar datos muy antiguos
      AND c.created_at >= DATE_SUB(CURDATE(), INTERVAL ${lookbackDays} DAY)

  ) cohort_data

  -- Calcular revenue neto por customer
  CROSS JOIN LATERAL (
    SELECT
      gross_revenue_eur as revenue_eur,
      invoice_refunds_eur + zoho_refunds_eur as refunds_eur
  ) calculated
`;

/**
 * Query simplificada sin LATERAL (compatibilidad MySQL 5.7)
 */
const buildLtvWindowQuerySimple = (days: number, lookbackDays: number = 120): string => `
  SELECT
    -- LTV = SUM(net_revenue) / COUNT(customers)
    ROUND(
      COALESCE(SUM(net_revenue_eur), 0) / NULLIF(COUNT(*), 0),
      2
    ) as ltv_${days}d,

    -- Métricas de cohorte
    COUNT(*) as cohort_size,
    SUM(CASE WHEN net_revenue_eur > 0 THEN 1 ELSE 0 END) as customers_with_revenue,
    ROUND(SUM(CASE WHEN net_revenue_eur > 0 THEN 1 ELSE 0 END) * 100.0 / NULLIF(COUNT(*), 0), 1) as conversion_rate,

    -- Revenue breakdown
    ROUND(COALESCE(SUM(gross_revenue_eur), 0), 2) as total_gross_revenue_eur,
    ROUND(COALESCE(SUM(total_refunds_eur), 0), 2) as total_refunds_eur,
    ROUND(COALESCE(SUM(net_revenue_eur), 0), 2) as total_net_revenue_eur

  FROM (
    SELECT
      c.id as customer_id,
      c.created_at as acquisition_date,
      c.company_id,

      -- Gross revenue (subscriptions type 2)
      COALESCE((
        SELECT SUM(i.amount /
          CASE i.currency_code
            WHEN 'EUR' THEN 1
            WHEN 'USD' THEN 1.08
            WHEN 'RON' THEN 4.97
            WHEN 'BRL' THEN 6.35
            WHEN 'CLP' THEN 1020
            WHEN 'HUF' THEN 408
            WHEN 'GBP' THEN 0.84
            WHEN 'UAH' THEN 43.5
            WHEN 'AED' THEN 3.97
            ELSE 1
          END
        )
        FROM avocode.invoices i
        WHERE i.customer_id = c.id
          AND i.invoice_status_id = 1
          AND i.invoice_type_id = 2
          AND i.transacted_at <= DATE_ADD(c.created_at, INTERVAL ${days} DAY)
      ), 0) as gross_revenue_eur,

      -- Refunds from invoices (type 3) for non-Jackcode
      CASE
        WHEN c.company_id != ${JACKCODE_COMPANY_ID} THEN
          COALESCE((
            SELECT SUM(i.amount /
              CASE i.currency_code
                WHEN 'EUR' THEN 1
                WHEN 'USD' THEN 1.08
                WHEN 'RON' THEN 4.97
                WHEN 'BRL' THEN 6.35
                WHEN 'CLP' THEN 1020
                WHEN 'HUF' THEN 408
                WHEN 'GBP' THEN 0.84
                WHEN 'UAH' THEN 43.5
                WHEN 'AED' THEN 3.97
                ELSE 1
              END
            )
            FROM avocode.invoices i
            WHERE i.customer_id = c.id
              AND i.invoice_status_id = 1
              AND i.invoice_type_id = 3
              AND i.transacted_at <= DATE_ADD(c.created_at, INTERVAL ${days} DAY)
          ), 0)
        ELSE 0
      END as invoice_refunds_eur,

      -- Refunds from Zoho for Jackcode only
      CASE
        WHEN c.company_id = ${JACKCODE_COMPANY_ID} THEN
          COALESCE((
            SELECT SUM(zr.amount /
              CASE zr.currency_code
                WHEN 'EUR' THEN 1
                WHEN 'USD' THEN 1.08
                WHEN 'AED' THEN 3.97
                ELSE 1
              END
            )
            FROM avocodebo.zoho_refunds zr
            WHERE zr.customer_id = c.id
              AND zr.refund_date <= DATE_ADD(c.created_at, INTERVAL ${days} DAY)
          ), 0) +
          COALESCE((
            SELECT SUM(zcn.amount /
              CASE zcn.currency_code
                WHEN 'EUR' THEN 1
                WHEN 'USD' THEN 1.08
                WHEN 'AED' THEN 3.97
                ELSE 1
              END
            )
            FROM avocodebo.zoho_credit_notes zcn
            WHERE zcn.customer_id = c.id
              AND zcn.credit_date <= DATE_ADD(c.created_at, INTERVAL ${days} DAY)
          ), 0)
        ELSE 0
      END as zoho_refunds_eur

    FROM avocode.customers c
    WHERE
      -- Cohorte: customers con ventana completa
      c.created_at <= DATE_SUB(CURDATE(), INTERVAL ${days} DAY)
      -- Lookback para evitar datos muy antiguos
      AND c.created_at >= DATE_SUB(CURDATE(), INTERVAL ${lookbackDays} DAY)

  ) cohort_data,

  -- Calculate totals inline
  LATERAL (
    SELECT
      gross_revenue_eur - invoice_refunds_eur - zoho_refunds_eur as net_revenue_eur,
      invoice_refunds_eur + zoho_refunds_eur as total_refunds_eur
  ) calc
`;

/**
 * Query final sin LATERAL (MySQL 8.0+ compatible, sin LATERAL para 5.7)
 */
const buildLtvWindowQueryFinal = (days: number, lookbackDays: number = 120): string => `
  SELECT
    ROUND(
      SUM(gross_revenue_eur - invoice_refunds_eur - zoho_refunds_eur) / NULLIF(COUNT(*), 0),
      2
    ) as ltv_${days}d,

    COUNT(*) as cohort_size,
    SUM(CASE WHEN gross_revenue_eur > 0 THEN 1 ELSE 0 END) as customers_with_revenue,
    ROUND(SUM(CASE WHEN gross_revenue_eur > 0 THEN 1 ELSE 0 END) * 100.0 / NULLIF(COUNT(*), 0), 1) as conversion_rate_pct,

    ROUND(SUM(gross_revenue_eur), 2) as total_gross_revenue_eur,
    ROUND(SUM(invoice_refunds_eur + zoho_refunds_eur), 2) as total_refunds_eur,
    ROUND(SUM(gross_revenue_eur - invoice_refunds_eur - zoho_refunds_eur), 2) as total_net_revenue_eur

  FROM (
    SELECT
      c.id as customer_id,

      -- Gross revenue (subscriptions type 2) within window
      COALESCE((
        SELECT SUM(i.amount /
          CASE i.currency_code
            WHEN 'EUR' THEN 1 WHEN 'USD' THEN 1.08 WHEN 'RON' THEN 4.97
            WHEN 'BRL' THEN 6.35 WHEN 'CLP' THEN 1020 WHEN 'HUF' THEN 408
            WHEN 'GBP' THEN 0.84 WHEN 'UAH' THEN 43.5 WHEN 'AED' THEN 3.97
            ELSE 1
          END
        )
        FROM avocode.invoices i
        WHERE i.customer_id = c.id
          AND i.invoice_status_id = 1
          AND i.invoice_type_id = 2
          AND i.transacted_at <= DATE_ADD(c.created_at, INTERVAL ${days} DAY)
      ), 0) as gross_revenue_eur,

      -- Refunds type 3 (Avocode/Kiwikode only)
      CASE WHEN c.company_id != ${JACKCODE_COMPANY_ID} THEN
        COALESCE((
          SELECT SUM(i.amount /
            CASE i.currency_code
              WHEN 'EUR' THEN 1 WHEN 'USD' THEN 1.08 WHEN 'RON' THEN 4.97
              WHEN 'BRL' THEN 6.35 WHEN 'CLP' THEN 1020 WHEN 'HUF' THEN 408
              WHEN 'GBP' THEN 0.84 WHEN 'UAH' THEN 43.5 WHEN 'AED' THEN 3.97
              ELSE 1
            END
          )
          FROM avocode.invoices i
          WHERE i.customer_id = c.id
            AND i.invoice_status_id = 1
            AND i.invoice_type_id = 3
            AND i.transacted_at <= DATE_ADD(c.created_at, INTERVAL ${days} DAY)
        ), 0)
      ELSE 0 END as invoice_refunds_eur,

      -- Zoho refunds (Jackcode only)
      -- NOTA: Solo zoho_refunds, NO zoho_credit_notes (evitar doble conteo)
      -- Relación: zoho_refunds → zoho_credit_notes → zoho_invoices → avocode.invoices
      CASE WHEN c.company_id = ${JACKCODE_COMPANY_ID} THEN
        COALESCE((
          SELECT SUM(zr.amount /
            CASE zr.currency_code
              WHEN 'EUR' THEN 1 WHEN 'USD' THEN 1.08 WHEN 'AED' THEN 3.97
              ELSE 1
            END
          )
          FROM avocodebo.zoho_refunds zr
          WHERE zr.customer_id = c.id
            AND zr.refund_date <= DATE_ADD(c.created_at, INTERVAL ${days} DAY)
        ), 0)
      ELSE 0 END as zoho_refunds_eur

    FROM avocode.customers c
    WHERE c.created_at <= DATE_SUB(CURDATE(), INTERVAL ${days} DAY)
      AND c.created_at >= DATE_SUB(CURDATE(), INTERVAL ${lookbackDays} DAY)
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
  description: "LTV ventana R1 completa. Cohorte desde acquisition, incluye todos los customers (incluso churn).",
  sql: buildLtvWindowQueryFinal(21, 90),
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
  sql: buildLtvWindowQueryFinal(51, 120),
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
  sql: buildLtvWindowQueryFinal(81, 180),
  params: [],
  permissions: ["SELECT"],
};
