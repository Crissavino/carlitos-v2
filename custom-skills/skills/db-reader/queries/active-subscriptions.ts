import { QueryDefinition } from "../types.js";

export const activeSubscriptionsQuery: QueryDefinition = {
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
    GROUP BY plan_type
  `,
  params: [],
  permissions: ["SELECT"],
};
