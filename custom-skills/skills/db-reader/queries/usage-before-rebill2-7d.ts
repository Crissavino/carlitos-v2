import { QueryDefinition } from "../types.js";

/**
 * Usage Before Rebill 2 - Customers con actividad entre first y second rebill.
 *
 * Usa cohorte de first rebills de hace 30-37 días.
 * Mide: customers que crearon al menos 1 documento entre first rebill y second rebill
 * (o hasta hoy si no tienen second rebill).
 *
 * NOTA: Esta métrica es diagnóstica, no alerta crítica.
 * El modelo de negocio es de necesidad puntual, no uso recurrente.
 */
export const usageBeforeRebill27dQuery: QueryDefinition = {
  id: "usage-before-rebill2-7d",
  name: "Usage Before Rebill 2",
  description: "Customers con uso de producto entre first y second rebill (cohorte 30-37d)",
  sql: `
    SELECT
      COUNT(DISTINCT i.customer_id) AS first_rebills,
      COUNT(DISTINCT CASE
        WHEN EXISTS (
          SELECT 1
          FROM avocode.documents d
          WHERE d.customer_id = i.customer_id
            AND d.create_time >= i.transacted_at
            AND d.create_time < COALESCE(
              (SELECT MIN(i3.transacted_at)
               FROM avocode.invoices i3
               WHERE i3.customer_id = i.customer_id
                 AND i3.invoice_type_id = 2
                 AND i3.invoice_status_id = 1
                 AND i3.id > i.id),
              NOW()
            )
        ) THEN i.customer_id
      END) AS with_usage
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
