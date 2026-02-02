import { QueryDefinition, QueryBuilder } from "../types.js";

/**
 * Trials Today - Count of trials started today
 * HARDENING: Filter by website_id
 */
export const trialsTodayQuery: QueryBuilder = (websiteId?: number): QueryDefinition => {
  const websiteFilter = websiteId ? `AND website_id = ?` : '';
  const params = websiteId ? [websiteId] : [];

  return {
    id: "trials-today",
    name: "Trials Today",
    description: "Count of trials started today",
    sql: `
      SELECT COUNT(*) as count
      FROM avocode.subscriptions
      WHERE DATE(trial_started_at) = CURDATE()
        AND cancelled_during_trial = 0
        ${websiteFilter}
    `,
    params,
    permissions: ["SELECT"],
  };
};

/**
 * Trials 7 Days Ago - Count of trials started exactly 7 days ago (same weekday)
 * HARDENING: Filter by website_id
 */
export const trials7dAgoQuery: QueryBuilder = (websiteId?: number): QueryDefinition => {
  const websiteFilter = websiteId ? `AND website_id = ?` : '';
  const params = websiteId ? [websiteId] : [];

  return {
    id: "trials-7d-ago",
    name: "Trials 7 Days Ago",
    description: "Count of trials started exactly 7 days ago",
    sql: `
      SELECT COUNT(*) as count
      FROM avocode.subscriptions
      WHERE DATE(trial_started_at) = DATE_SUB(CURDATE(), INTERVAL 7 DAY)
        AND cancelled_during_trial = 0
        ${websiteFilter}
    `,
    params,
    permissions: ["SELECT"],
  };
};

/**
 * First Rebills Today - Count of first rebills today
 * HARDENING: Filter by website_id
 */
export const firstRebillsTodayQuery: QueryBuilder = (websiteId?: number): QueryDefinition => {
  const websiteFilter = websiteId ? `AND website_id = ?` : '';
  const params = websiteId ? [websiteId] : [];

  return {
    id: "first-rebills-today",
    name: "First Rebills Today",
    description: "Count of first rebills today",
    sql: `
      SELECT COUNT(*) as count
      FROM avocode.subscriptions
      WHERE DATE(subscription_started_at) = CURDATE()
        ${websiteFilter}
    `,
    params,
    permissions: ["SELECT"],
  };
};

/**
 * First Rebills 7 Days Ago - Count of first rebills exactly 7 days ago
 * HARDENING: Filter by website_id
 */
export const firstRebills7dAgoQuery: QueryBuilder = (websiteId?: number): QueryDefinition => {
  const websiteFilter = websiteId ? `AND website_id = ?` : '';
  const params = websiteId ? [websiteId] : [];

  return {
    id: "first-rebills-7d-ago",
    name: "First Rebills 7 Days Ago",
    description: "Count of first rebills exactly 7 days ago",
    sql: `
      SELECT COUNT(*) as count
      FROM avocode.subscriptions
      WHERE DATE(subscription_started_at) = DATE_SUB(CURDATE(), INTERVAL 7 DAY)
        ${websiteFilter}
    `,
    params,
    permissions: ["SELECT"],
  };
};

/**
 * Ad Spend Today - Ad spend for today
 * HARDENING: Filter by website_id through campaigns table
 */
export const adSpendTodayQuery: QueryBuilder = (websiteId?: number): QueryDefinition => {
  const websiteFilter = websiteId ? `AND c.website_id = ?` : '';
  const params = websiteId ? [websiteId] : [];

  return {
    id: "ad-spend-today",
    name: "Ad Spend Today",
    description: "Ad spend for today",
    sql: `
      SELECT
        c.currency_id,
        SUM(a.cost) as total_cost
      FROM avocodebo.ads a
      INNER JOIN avocodebo.campaigns c ON a.campaign_id = c.id
      WHERE a.date = CURDATE()
        ${websiteFilter}
      GROUP BY c.currency_id
    `,
    params,
    permissions: ["SELECT"],
  };
};

/**
 * Ad Spend 7 Days Ago - Ad spend for exactly 7 days ago
 * HARDENING: Filter by website_id through campaigns table
 */
export const adSpend7dAgoQuery: QueryBuilder = (websiteId?: number): QueryDefinition => {
  const websiteFilter = websiteId ? `AND c.website_id = ?` : '';
  const params = websiteId ? [websiteId] : [];

  return {
    id: "ad-spend-7d-ago",
    name: "Ad Spend 7 Days Ago",
    description: "Ad spend for exactly 7 days ago",
    sql: `
      SELECT
        c.currency_id,
        SUM(a.cost) as total_cost
      FROM avocodebo.ads a
      INNER JOIN avocodebo.campaigns c ON a.campaign_id = c.id
      WHERE a.date = DATE_SUB(CURDATE(), INTERVAL 7 DAY)
        ${websiteFilter}
      GROUP BY c.currency_id
    `,
    params,
    permissions: ["SELECT"],
  };
};
