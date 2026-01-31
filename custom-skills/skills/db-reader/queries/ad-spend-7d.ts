import { QueryDefinition } from "../types.js";

/**
 * Ad Spend - Gasto en ads de los últimos 7 días desde avocodebo.ads
 *
 * Convierte a EUR usando rates hardcoded.
 * currency_id 2 = EUR, currency_id 4 = RON
 */
export const adSpend7dQuery: QueryDefinition = {
  id: "ad-spend-7d" as any,
  name: "Ad Spend (7 days)",
  description: "Gasto total en ads de los últimos 7 días, convertido a EUR",
  sql: `
    SELECT
      c.currency_id,
      SUM(a.cost) as total_cost
    FROM avocodebo.ads a
    INNER JOIN avocodebo.campaigns c ON a.campaign_id = c.id
    WHERE a.date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
    GROUP BY c.currency_id
  `,
  params: [],
  permissions: ["SELECT"],
};
