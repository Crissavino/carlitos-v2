import { QueryDefinition } from "../types.js";

/**
 * First Rebills - Customers que completaron su primer pago de suscripción
 * en los últimos 7 días.
 *
 * Un "first rebill" es la primera factura tipo 2 (subscription) pagada de un customer.
 */
export const firstRebills7dQuery: QueryDefinition = {
  id: "first-rebills-7d",
  name: "First Rebills (7 days)",
  description: "Customers que completaron su primer pago de suscripción en los últimos 7 días",
  sql: `
    SELECT
      DATE(i.transacted_at) as date,
      COUNT(DISTINCT i.customer_id) as count
    FROM avocode.invoices i
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
  params: [],
  permissions: ["SELECT"],
};
