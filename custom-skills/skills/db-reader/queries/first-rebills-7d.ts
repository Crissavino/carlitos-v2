import { QueryDefinition, QueryBuilder } from "../types.js";

/**
 * First Rebills - Customers que completaron su primer pago de suscripción
 * en los últimos 7 días.
 *
 * Un "first rebill" es la primera factura tipo 2 (subscription) pagada de un customer.
 *
 * HARDENING: Filter by website_id through subscriptions table
 */
export const firstRebills7dQuery: QueryBuilder = (websiteId?: number): QueryDefinition => {
  // Join with subscriptions to filter by website_id
  const websiteJoin = websiteId ? `
    INNER JOIN avocode.subscriptions s ON i.customer_id = s.customer_id AND s.website_id = ?
  ` : '';
  const params = websiteId ? [websiteId] : [];

  return {
    id: "first-rebills-7d",
    name: "First Rebills (7 days)",
    description: "Customers que completaron su primer pago de suscripción en los últimos 7 días",
    sql: `
      SELECT
        DATE(i.transacted_at) as date,
        COUNT(DISTINCT i.customer_id) as count
      FROM avocode.invoices i
      ${websiteJoin}
      WHERE i.transacted_at >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
        AND i.invoice_type_id = 2
        AND i.invoice_status_id = 1
        AND i.id = (
          SELECT MIN(i2.id)
          FROM avocode.invoices i2
          WHERE i2.customer_id = i.customer_id
            AND i2.invoice_type_id = 2
            AND i2.invoice_status_id = 1
        )
      GROUP BY DATE(i.transacted_at)
      ORDER BY date DESC
    `,
    params,
    permissions: ["SELECT"],
  };
};
