import { QueryDefinition, QueryBuilder } from "../types.js";

export const activeSubscriptionsQuery: QueryBuilder = (websiteId?: number): QueryDefinition => {
  const websiteFilter = websiteId ? `AND website_id = ?` : '';
  const params = websiteId ? [websiteId] : [];

  return {
    id: "active-subscriptions",
    name: "Suscripciones activas",
    description: "Cuenta suscripciones activas agrupadas por plan (monthly/annual)",
    sql: `
      SELECT
        COUNT(*) as total,
        plan_type,
        COUNT(*) as count
      FROM avocode.subscriptions
      WHERE is_subscription_active = 1
        ${websiteFilter}
      GROUP BY plan_type
    `,
    params,
    permissions: ["SELECT"],
  };
};
