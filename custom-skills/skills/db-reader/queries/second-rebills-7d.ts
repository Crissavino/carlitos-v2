import { QueryDefinition } from "../types.js";

/**
 * Second Rebills - Customers que completaron su segundo pago de suscripción
 * en los últimos 7 días.
 *
 * Para SRR correcto, el denominador debe ser first rebills de hace 30-37 días
 * (cohorte que ya tuvo tiempo de tener second rebill).
 */
export const secondRebills7dQuery: QueryDefinition = {
  id: "second-rebills-7d",
  name: "Second Rebills (7 days)",
  description: "Customers que completaron su segundo pago de suscripción en los últimos 7 días",
  sql: `
    SELECT
      DATE(i.transacted_at) as date,
      COUNT(DISTINCT i.customer_id) as count
    FROM avocode.invoices i
    WHERE i.transacted_at >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
      AND i.invoice_type_id = 2
      AND i.invoice_status_id = 1
      AND i.id = (
        SELECT i2.id
        FROM avocode.invoices i2
        WHERE i2.customer_id = i.customer_id
          AND i2.invoice_type_id = 2
          AND i2.invoice_status_id = 1
        ORDER BY i2.id ASC
        LIMIT 1 OFFSET 1
      )
    GROUP BY DATE(i.transacted_at)
    ORDER BY date DESC
  `,
  params: [],
  permissions: ["SELECT"],
};

/**
 * First Rebills Cohorte 30-37d - Para calcular SRR correctamente.
 * Estos son los first rebills que ya tuvieron tiempo de tener second rebill.
 */
export const firstRebillsCohorte30dQuery: QueryDefinition = {
  id: "first-rebills-cohorte-30d" as any,
  name: "First Rebills Cohorte 30-37 días",
  description: "First rebills de hace 30-37 días (denominador para SRR)",
  sql: `
    SELECT
      COUNT(DISTINCT i.customer_id) as count
    FROM avocode.invoices i
    WHERE i.transacted_at >= DATE_SUB(CURDATE(), INTERVAL 37 DAY)
      AND i.transacted_at < DATE_SUB(CURDATE(), INTERVAL 30 DAY)
      AND i.invoice_type_id = 2
      AND i.invoice_status_id = 1
      AND i.id = (
        SELECT MIN(i2.id)
        FROM avocode.invoices i2
        WHERE i2.customer_id = i.customer_id
          AND i2.invoice_type_id = 2
          AND i2.invoice_status_id = 1
      )
  `,
  params: [],
  permissions: ["SELECT"],
};
