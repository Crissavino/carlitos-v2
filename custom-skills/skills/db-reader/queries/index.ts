import { QueryDefinition, AllowedQueryId } from "../types.js";
import { activeSubscriptionsQuery } from "./active-subscriptions.js";
import { trialsLast7DaysQuery } from "./trials-last-7-days.js";
import { dailyRevenue7dQuery } from "./daily-revenue.js";

export const ALLOWED_QUERIES: Record<AllowedQueryId, QueryDefinition> = {
  "active-subscriptions": activeSubscriptionsQuery,
  "trials-last-7-days": trialsLast7DaysQuery,
  "daily-revenue-7d": dailyRevenue7dQuery,
};

export function getQuery(queryId: string): QueryDefinition | null {
  return ALLOWED_QUERIES[queryId as AllowedQueryId] ?? null;
}

export function isAllowedQuery(queryId: string): queryId is AllowedQueryId {
  return queryId in ALLOWED_QUERIES;
}

export { activeSubscriptionsQuery, trialsLast7DaysQuery, dailyRevenue7dQuery };
