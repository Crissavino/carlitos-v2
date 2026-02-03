import { QueryDefinition, QueryBuilder } from "../types.js";

/**
 * Customer Cohort Distribution Query
 *
 * Muestra cuántos clientes ACTIVOS (con suscripción activa) hay en cada mes:
 * - M1: Clientes que empezaron hace 0-30 días
 * - M2: Clientes que empezaron hace 30-60 días
 * - M3: Clientes que empezaron hace 60-90 días
 * - etc.
 *
 * Esto ayuda a entender de dónde viene el revenue:
 * - Si la mayoría está en M1, el modelo utility funciona
 * - Si hay muchos en M3+, hay revenue legacy que infla el profit
 */

export const customerCohortDistributionQuery: QueryBuilder = (websiteId?: number): QueryDefinition => {
  const websiteFilter = websiteId ? `AND c.website_id = ${websiteId}` : '';

  return {
    id: "customer-cohort-distribution",
    name: "Distribución de Clientes por Mes",
    description: "Cuenta clientes activos por mes desde adquisición (M1, M2, M3, etc.)",
    sql: `
      SELECT
        CASE
          WHEN DATEDIFF(CURDATE(), c.create_time) < 30 THEN 'M1'
          WHEN DATEDIFF(CURDATE(), c.create_time) < 60 THEN 'M2'
          WHEN DATEDIFF(CURDATE(), c.create_time) < 90 THEN 'M3'
          WHEN DATEDIFF(CURDATE(), c.create_time) < 120 THEN 'M4'
          WHEN DATEDIFF(CURDATE(), c.create_time) < 150 THEN 'M5'
          WHEN DATEDIFF(CURDATE(), c.create_time) < 180 THEN 'M6'
          ELSE 'M7+'
        END as cohort_month,
        COUNT(DISTINCT s.customer_id) as active_customers,
        ROUND(SUM(s.price), 2) as monthly_revenue_potential
      FROM avocode.subscriptions s
      INNER JOIN avocode.customers c ON s.customer_id = c.id
      WHERE s.is_subscription_active = 1
        ${websiteFilter}
      GROUP BY cohort_month
      ORDER BY
        CASE cohort_month
          WHEN 'M1' THEN 1
          WHEN 'M2' THEN 2
          WHEN 'M3' THEN 3
          WHEN 'M4' THEN 4
          WHEN 'M5' THEN 5
          WHEN 'M6' THEN 6
          ELSE 7
        END
    `,
    params: [],
    permissions: ["SELECT"],
  };
};
