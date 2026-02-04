import { QueryDefinition, QueryBuilder } from "../types.js";

/**
 * Risk Metrics Queries
 *
 * CHARGEBACK RATE - Riesgo de cierre de cuenta por procesador
 * Fuente: avocode.customers.dispute
 *
 * Si supera 0.5%, el procesador puede cerrar la cuenta.
 * Ya cerraron Revolut por esto.
 *
 * BASE INSTALADA - Clientes con >1 rebill (revenue "asegurado")
 * Fuente: avocode.invoices (type_id = 2)
 *
 * En modelo utility debería ser bajo (mayoría M1)
 */

/**
 * Chargeback Rate Query
 *
 * Calcula: disputes / total_transactions (últimos 30 días)
 *
 * Thresholds:
 * - Verde: <= 0.3%
 * - Amarillo: 0.3% - 0.5%
 * - Rojo: > 0.5% (CRÍTICO)
 */
export const chargebackRateQuery: QueryBuilder = (websiteId?: number): QueryDefinition => {
  const websiteFilter = websiteId ? `AND c.website_id = ${websiteId}` : '';

  return {
    id: "chargeback-rate",
    name: "Chargeback Rate (30d)",
    description: "Tasa de chargebacks/disputes en últimos 30 días. >0.5% = riesgo procesador.",
    sql: `
      SELECT
        COALESCE(disputes.total_disputes, 0) as total_disputes,
        COALESCE(transactions.total_transactions, 0) as total_transactions,
        CASE
          WHEN COALESCE(transactions.total_transactions, 0) = 0 THEN 0
          ELSE ROUND(COALESCE(disputes.total_disputes, 0) / transactions.total_transactions, 6)
        END as chargeback_rate
      FROM
        (
          SELECT COUNT(*) as total_disputes
          FROM avocode.customers c
          WHERE c.dispute IS NOT NULL
            AND c.dispute > 0
            ${websiteFilter}
        ) disputes,
        (
          SELECT COUNT(*) as total_transactions
          FROM avocode.invoices i
          INNER JOIN avocode.customers c ON i.customer_id = c.id
          WHERE i.invoice_status_id = 1
            AND i.transacted_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
            ${websiteFilter}
        ) transactions
    `,
    params: [],
    permissions: ["SELECT"],
  };
};

/**
 * Base Instalada Query
 *
 * Cuenta clientes activos con más de 1 rebill (invoice_type_id = 2)
 * Estos son clientes "asegurados" que generan revenue recurrente.
 *
 * En modelo utility esto debería ser bajo porque la mayoría
 * de usuarios resuelve su problema en M1 y se va.
 */
export const baseInstaladaQuery: QueryBuilder = (websiteId?: number): QueryDefinition => {
  const websiteFilter = websiteId ? `AND c.website_id = ${websiteId}` : '';

  return {
    id: "base-instalada",
    name: "Base Instalada (>1 rebill)",
    description: "Clientes activos con más de 1 rebill. Revenue 'asegurado'.",
    sql: `
      SELECT
        multiple_rebills.customers_with_multiple_rebills,
        active.total_active_customers,
        CASE
          WHEN active.total_active_customers = 0 THEN 0
          ELSE ROUND(multiple_rebills.customers_with_multiple_rebills / active.total_active_customers, 4)
        END as percentage
      FROM
        (
          -- Clientes con más de 1 invoice type_id = 2 (rebills)
          SELECT COUNT(DISTINCT customer_id) as customers_with_multiple_rebills
          FROM (
            SELECT i.customer_id, COUNT(*) as rebill_count
            FROM avocode.invoices i
            INNER JOIN avocode.customers c ON i.customer_id = c.id
            INNER JOIN avocode.subscriptions s ON i.customer_id = s.customer_id
            WHERE i.invoice_type_id = 2
              AND i.invoice_status_id = 1
              AND s.is_subscription_active = 1
              ${websiteFilter}
            GROUP BY i.customer_id
            HAVING rebill_count > 1
          ) multi
        ) multiple_rebills,
        (
          -- Total clientes activos
          SELECT COUNT(DISTINCT s.customer_id) as total_active_customers
          FROM avocode.subscriptions s
          INNER JOIN avocode.customers c ON s.customer_id = c.id
          WHERE s.is_subscription_active = 1
            ${websiteFilter}
        ) active
    `,
    params: [],
    permissions: ["SELECT"],
  };
};
