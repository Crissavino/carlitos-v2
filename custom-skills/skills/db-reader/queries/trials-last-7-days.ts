import { QueryDefinition, QueryBuilder } from "../types.js";

export const trialsLast7DaysQuery: QueryBuilder = (websiteId?: number): QueryDefinition => {
  const websiteFilter = websiteId ? `AND website_id = ?` : '';
  const params = websiteId ? [websiteId] : [];

  return {
    id: "trials-last-7-days",
    name: "Trials últimos 7 días",
    description: "Cuenta trials iniciados en los últimos 7 días (sin cancelados)",
    sql: `
      SELECT
        DATE(trial_started_at) as date,
        COUNT(*) as count
      FROM avocode.subscriptions
      WHERE trial_started_at >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
        AND cancelled_during_trial = 0
        ${websiteFilter}
      GROUP BY DATE(trial_started_at)
      ORDER BY date DESC
    `,
    params,
    permissions: ["SELECT"],
  };
};
