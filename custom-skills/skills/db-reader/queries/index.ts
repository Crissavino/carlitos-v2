import { QueryDefinition, AllowedQueryId } from "../types.js";
import { activeSubscriptionsQuery } from "./active-subscriptions.js";
import { trialsLast7DaysQuery } from "./trials-last-7-days.js";
import { dailyRevenue7dQuery } from "./daily-revenue.js";
import { firstRebills7dQuery } from "./first-rebills-7d.js";
import { secondRebills7dQuery, firstRebillsCohorte30dQuery } from "./second-rebills-7d.js";
import { usageBeforeRebill27dQuery } from "./usage-before-rebill2-7d.js";
import { adSpend7dQuery } from "./ad-spend-7d.js";

export const ALLOWED_QUERIES: Record<AllowedQueryId, QueryDefinition> = {
  "active-subscriptions": activeSubscriptionsQuery,
  "trials-last-7-days": trialsLast7DaysQuery,
  "daily-revenue-7d": dailyRevenue7dQuery,
  "first-rebills-7d": firstRebills7dQuery,
  "second-rebills-7d": secondRebills7dQuery,
  "first-rebills-cohorte-30d": firstRebillsCohorte30dQuery,
  "usage-before-rebill2-7d": usageBeforeRebill27dQuery,
  "ad-spend-7d": adSpend7dQuery,
};

export function getQuery(queryId: string): QueryDefinition | null {
  return ALLOWED_QUERIES[queryId as AllowedQueryId] ?? null;
}

export function isAllowedQuery(queryId: string): queryId is AllowedQueryId {
  return queryId in ALLOWED_QUERIES;
}

export {
  activeSubscriptionsQuery,
  trialsLast7DaysQuery,
  dailyRevenue7dQuery,
  firstRebills7dQuery,
  secondRebills7dQuery,
  firstRebillsCohorte30dQuery,
  usageBeforeRebill27dQuery,
  adSpend7dQuery,
};
