import { QueryDefinition } from "../types.js";
import { buildCurrencyRateCase } from "../../../core/currency.js";

/**
 * LTV Queries - Lifetime Value real basado en diferentes ventanas de tiempo
 *
 * - LTV_30d: Para decisiones de ads (ciclo corto ~19 días)
 * - LTV_45d: Balance entre velocidad y completitud
 * - LTV_90d: Análisis estratégico (incluye rebills tardíos)
 *
 * Todas calculan ingreso promedio por customer:
 * - Solo customers con N+ días desde primer pago (datos completos)
 * - Suma trials (type 1) + subscriptions (type 2)
 * - Resta refunds (type 3)
 * - Convierte todo a EUR usando CurrencyConverter centralizado
 */

// SQL CASE for currency conversion (from centralized CurrencyConverter)
const RATE_CASE = buildCurrencyRateCase('i.currency_code');

const buildLtvQuery = (days: number, lookbackMonths: number = 3): string => `
  SELECT
    ROUND(AVG(customer_revenue_eur), 2) as ltv_${days}d,
    COUNT(*) as sample_size,
    ROUND(MIN(customer_revenue_eur), 2) as min_ltv,
    ROUND(MAX(customer_revenue_eur), 2) as max_ltv,
    ROUND(STDDEV(customer_revenue_eur), 2) as stddev_ltv
  FROM (
    SELECT
      c.customer_id,
      c.first_payment,
      SUM(
        CASE
          WHEN i.invoice_type_id IN (1, 2) THEN i.amount / ${RATE_CASE}
          WHEN i.invoice_type_id = 3 THEN -i.amount / ${RATE_CASE}
          ELSE 0
        END
      ) as customer_revenue_eur
    FROM (
      SELECT
        customer_id,
        MIN(transacted_at) as first_payment
      FROM avocode.invoices
      WHERE invoice_status_id = 1
        AND invoice_type_id IN (1, 2)
      GROUP BY customer_id
      HAVING first_payment <= DATE_SUB(CURDATE(), INTERVAL ${days} DAY)
        AND first_payment >= DATE_SUB(CURDATE(), INTERVAL ${lookbackMonths * 30} DAY)
    ) c
    JOIN avocode.invoices i
      ON i.customer_id = c.customer_id
      AND i.transacted_at >= c.first_payment
      AND i.transacted_at <= DATE_ADD(c.first_payment, INTERVAL ${days} DAY)
      AND i.invoice_status_id = 1
      AND i.invoice_type_id IN (1, 2, 3)
    GROUP BY c.customer_id, c.first_payment
    HAVING customer_revenue_eur > 0
  ) per_customer
`;

/**
 * LTV 30 días - Para decisiones operativas de ads
 * Ciclo de monetización ~19 días, 30d captura casi todo
 */
export const ltv30dQuery: QueryDefinition = {
  id: "ltv-30d",
  name: "LTV 30 días",
  description: "Lifetime Value promedio (primeros 30 días) - Para decisiones de ads",
  sql: buildLtvQuery(30, 3),
  params: [],
  permissions: ["SELECT"],
};

/**
 * LTV 45 días - Balance entre velocidad y completitud
 */
export const ltv45dQuery: QueryDefinition = {
  id: "ltv-45d",
  name: "LTV 45 días",
  description: "Lifetime Value promedio (primeros 45 días) - Balance velocidad/completitud",
  sql: buildLtvQuery(45, 4),
  params: [],
  permissions: ["SELECT"],
};

/**
 * LTV 90 días - Análisis estratégico
 * Incluye rebills tardíos y churn recovery
 */
export const ltv90dQuery: QueryDefinition = {
  id: "ltv-90d",
  name: "LTV 90 días",
  description: "Lifetime Value promedio (primeros 90 días) - Análisis estratégico",
  sql: buildLtvQuery(90, 6),
  params: [],
  permissions: ["SELECT"],
};

/**
 * Query combinada que retorna los 3 LTVs de una vez
 * Útil para el dashboard y comparativas
 */
export const ltvAllQuery: QueryDefinition = {
  id: "ltv-all" as any,
  name: "LTV Comparativo",
  description: "LTV 30d, 45d y 90d en una sola query",
  sql: `
    SELECT
      'ltv_30d' as metric,
      (${buildLtvQuery(30, 3).replace(/ltv_\d+d/g, 'ltv')}) as data
    UNION ALL
    SELECT
      'ltv_45d' as metric,
      (${buildLtvQuery(45, 4).replace(/ltv_\d+d/g, 'ltv')}) as data
    UNION ALL
    SELECT
      'ltv_90d' as metric,
      (${buildLtvQuery(90, 6).replace(/ltv_\d+d/g, 'ltv')}) as data
  `,
  params: [],
  permissions: ["SELECT"],
};
