import { QueryDefinition, QueryBuilder } from "../types.js";

/**
 * Customer Counts Query
 * Returns total and active customer counts per website
 *
 * - total_customers: Clientes en trial activo O con suscripción activa (is_trial_active = 1 OR is_subscription_active = 1)
 * - active_customers: Solo subs activas (is_subscription_active = 1)
 */
export const customerCountsQuery: QueryBuilder = (websiteId?: number): QueryDefinition => {
  const websiteFilter = websiteId ? `AND website_id = ?` : '';
  const params = websiteId ? [websiteId] : [];

  return {
    id: "customer-counts" as any,
    name: "Customer Counts",
    description: "Total and active customer counts for dashboard",
    sql: `
      SELECT
        SUM(CASE WHEN is_trial_active = 1 OR is_subscription_active = 1 THEN 1 ELSE 0 END) as total_customers,
        SUM(CASE WHEN is_subscription_active = 1 THEN 1 ELSE 0 END) as active_customers,
        SUM(CASE WHEN is_subscription_active = 0 AND cancelled_during_trial = 0 THEN 1 ELSE 0 END) as churned_customers,
        SUM(CASE WHEN cancelled_during_trial = 1 THEN 1 ELSE 0 END) as cancelled_trials
      FROM avocode.subscriptions
      WHERE 1=1
        ${websiteFilter}
    `,
    params,
    permissions: ["SELECT"],
  };
};
