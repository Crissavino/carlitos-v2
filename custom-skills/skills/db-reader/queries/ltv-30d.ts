import { QueryDefinition, QueryBuilder } from "../types.js";
import { buildCurrencyRateCase } from "../../../core/currency.js";

/**
 * LTV Queries - Lifetime Value real basado en diferentes ventanas de tiempo
 *
 * HARDENING: Filter by website_id through customers/subscriptions tables
 */

// SQL CASE for currency conversion (from centralized CurrencyConverter)
const RATE_CASE = buildCurrencyRateCase('i.currency_code');

const buildLtvQuery = (days: number, lookbackMonths: number = 3, websiteId?: number): string => {
  // Filter customers by website_id through subscriptions
  const websiteJoin = websiteId ? `
    INNER JOIN avocode.subscriptions sub ON sub.customer_id = c.customer_id AND sub.website_id = ${websiteId}
  ` : '';

  return `
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
      ${websiteJoin}
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
};

/**
 * LTV 30 días - Para decisiones operativas de ads
 */
export const ltv30dQuery: QueryBuilder = (websiteId?: number): QueryDefinition => ({
  id: "ltv-30d",
  name: "LTV 30 días",
  description: "Lifetime Value promedio (primeros 30 días) - Para decisiones de ads",
  sql: buildLtvQuery(30, 3, websiteId),
  params: [],
  permissions: ["SELECT"],
});

/**
 * LTV 45 días - Balance entre velocidad y completitud
 */
export const ltv45dQuery: QueryBuilder = (websiteId?: number): QueryDefinition => ({
  id: "ltv-45d",
  name: "LTV 45 días",
  description: "Lifetime Value promedio (primeros 45 días) - Balance velocidad/completitud",
  sql: buildLtvQuery(45, 4, websiteId),
  params: [],
  permissions: ["SELECT"],
});

/**
 * LTV 90 días - Análisis estratégico
 */
export const ltv90dQuery: QueryBuilder = (websiteId?: number): QueryDefinition => ({
  id: "ltv-90d",
  name: "LTV 90 días",
  description: "Lifetime Value promedio (primeros 90 días) - Análisis estratégico",
  sql: buildLtvQuery(90, 6, websiteId),
  params: [],
  permissions: ["SELECT"],
});
