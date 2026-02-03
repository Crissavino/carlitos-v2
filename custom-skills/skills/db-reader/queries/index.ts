import { QueryDefinition, AllowedQueryId, QueryBuilder } from "../types.js";
import { activeSubscriptionsQuery } from "./active-subscriptions.js";
import { trialsLast7DaysQuery } from "./trials-last-7-days.js";
import { dailyRevenue7dQuery } from "./daily-revenue.js";
import { firstRebills7dQuery } from "./first-rebills-7d.js";
import { secondRebills7dQuery, firstRebillsCohorte30dQuery } from "./second-rebills-7d.js";
import { usageBeforeRebill27dQuery } from "./usage-before-rebill2-7d.js";
import { adSpend7dQuery } from "./ad-spend-7d.js";
import { ltv30dQuery, ltv45dQuery, ltv90dQuery } from "./ltv-30d.js";
import { ltv21dQuery, ltv51dQuery, ltv81dQuery } from "./ltv-windows.js";
import { campaignPerformanceQuery, campaignSummaryQuery, keywordAttributionQuery } from "./campaign-metrics.js";
import {
  websiteAggregationQuery,
  companyAggregationQuery,
  countryAggregationQuery,
  campaignListForServiceQuery,
} from "./business-aggregations.js";
import {
  trialRevenue7dQuery,
  firstRebillRevenue7dQuery,
  refundsM1Query,
} from "./utility-model.js";
import {
  trialsTodayQuery,
  trials7dAgoQuery,
  firstRebillsTodayQuery,
  firstRebills7dAgoQuery,
  adSpendTodayQuery,
  adSpend7dAgoQuery,
} from "./daily-comparison.js";
import { paybackM1CohortQuery } from "./payback-m1-cohort.js";
import { customerCountsQuery } from "./customer-counts.js";
import { customerCohortDistributionQuery } from "./customer-cohort-distribution.js";
import { chargebackRateQuery, baseInstaladaQuery } from "./risk-metrics.js";

// Query builders that support websiteId filtering
export const QUERY_BUILDERS: Record<AllowedQueryId, QueryBuilder> = {
  "active-subscriptions": activeSubscriptionsQuery,
  "trials-last-7-days": trialsLast7DaysQuery,
  "daily-revenue-7d": dailyRevenue7dQuery,
  "first-rebills-7d": firstRebills7dQuery,
  "second-rebills-7d": secondRebills7dQuery,
  "first-rebills-cohorte-30d": firstRebillsCohorte30dQuery,
  "usage-before-rebill2-7d": usageBeforeRebill27dQuery,
  "ad-spend-7d": adSpend7dQuery,
  "ltv-30d": ltv30dQuery,
  "ltv-45d": ltv45dQuery,
  "ltv-90d": ltv90dQuery,
  // LTV con ventanas correctas (basadas en modelo de cobro real)
  "ltv-21d": ltv21dQuery,
  "ltv-51d": ltv51dQuery,
  "ltv-81d": ltv81dQuery,
  // Phase 7: Campaign-level metrics
  "campaign-performance": campaignPerformanceQuery,
  "campaign-summary": campaignSummaryQuery,
  // Phase 7.5: Business aggregations
  "business-by-website": websiteAggregationQuery,
  "business-by-company": companyAggregationQuery,
  "business-by-country": countryAggregationQuery,
  "campaigns-for-service-classification": campaignListForServiceQuery,
  // Phase 9: Utility Model KPIs
  "trial-revenue-7d": trialRevenue7dQuery,
  "first-rebill-revenue-7d": firstRebillRevenue7dQuery,
  "refunds-m1-7d": refundsM1Query,
  // Phase 10: Daily Comparison (Today vs 7 days ago)
  "trials-today": trialsTodayQuery,
  "trials-7d-ago": trials7dAgoQuery,
  "first-rebills-today": firstRebillsTodayQuery,
  "first-rebills-7d-ago": firstRebills7dAgoQuery,
  "ad-spend-today": adSpendTodayQuery,
  "ad-spend-7d-ago": adSpend7dAgoQuery,
  // Phase 11: Payback M1 Cohort (FIX - real cohort-based calculation)
  "payback-m1-cohort": paybackM1CohortQuery,
  // Phase 12: Keyword-level attribution
  "keyword-attribution": keywordAttributionQuery,
  // Phase 13: Customer counts
  "customer-counts": customerCountsQuery,
  // Phase 14: Customer cohort distribution
  "customer-cohort-distribution": customerCohortDistributionQuery,
  // Phase 15: Risk metrics (OpenClaw)
  "chargeback-rate": chargebackRateQuery,
  "base-instalada": baseInstaladaQuery,
};

/**
 * Get query definition with optional websiteId filtering
 * HARDENING: Queries that support website filtering will use the websiteId
 */
export function getQuery(queryId: string, websiteId?: number): QueryDefinition | null {
  const builder = QUERY_BUILDERS[queryId as AllowedQueryId];
  if (!builder) return null;
  return builder(websiteId);
}

export function isAllowedQuery(queryId: string): queryId is AllowedQueryId {
  return queryId in QUERY_BUILDERS;
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
  ltv30dQuery,
  ltv45dQuery,
  ltv90dQuery,
  // LTV ventanas correctas
  ltv21dQuery,
  ltv51dQuery,
  ltv81dQuery,
  // Phase 7: Campaign metrics
  campaignPerformanceQuery,
  campaignSummaryQuery,
  keywordAttributionQuery,
  // Phase 7.5: Business aggregations
  websiteAggregationQuery,
  companyAggregationQuery,
  countryAggregationQuery,
  campaignListForServiceQuery,
  // Phase 9: Utility Model
  trialRevenue7dQuery,
  firstRebillRevenue7dQuery,
  refundsM1Query,
};
