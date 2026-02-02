/**
 * Revenue Analyzer
 *
 * Obtiene datos de revenue, trials, rebills, usage y ad spend desde DBReader.
 *
 * HARDENING: All functions require websiteId parameter - no global metrics allowed
 */

import { executeQuery } from "../../db-reader/executor.js";

// ============================================================================
// LTV CACHE (1 hour TTL, keyed by websiteId)
// ============================================================================

interface CacheEntry<T> {
  data: T;
  cachedAt: number;
}

const LTV_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
const ltvCache: Map<string, CacheEntry<any>> = new Map();

function getCachedLtv<T>(key: string, websiteId: number): T | null {
  const cacheKey = `${key}-${websiteId}`;
  const entry = ltvCache.get(cacheKey);
  if (!entry) return null;

  if (Date.now() - entry.cachedAt > LTV_CACHE_TTL_MS) {
    ltvCache.delete(cacheKey);
    return null;
  }

  return entry.data as T;
}

function setCachedLtv<T>(key: string, websiteId: number, data: T): void {
  const cacheKey = `${key}-${websiteId}`;
  ltvCache.set(cacheKey, { data, cachedAt: Date.now() });
}

export function clearLtvCache(): void {
  ltvCache.clear();
  console.log("[LtvCache] Cache cleared");
}

export interface RevenueData {
  netRevenueEur: number;
  subscriptionEur: number;
  refundsEur: number;
}

export interface TrialsData {
  total: number;
}

export interface SubscriptionsData {
  total: number;
}

export interface AdSpendData {
  totalEur: number;
}

export async function getRevenueData(websiteId: number): Promise<RevenueData | null> {
  const result = await executeQuery("daily-revenue-7d", websiteId);

  if (result.status !== "success" || !result.results) {
    return null;
  }

  const data = result.results as any;

  return {
    netRevenueEur: data.summary.netRevenueEur,
    subscriptionEur: data.summary.subscriptionEur,
    refundsEur: data.summary.totalRefundsEur,
  };
}

export async function getTrialsData(websiteId: number): Promise<TrialsData | null> {
  const result = await executeQuery("trials-last-7-days", websiteId);

  if (result.status !== "success" || !result.results) {
    return null;
  }

  const data = result.results as any;

  return {
    total: data.total,
  };
}

export async function getFirstRebillsData(websiteId: number): Promise<number | null> {
  const result = await executeQuery("first-rebills-7d", websiteId);

  if (result.status !== "success" || !result.results) {
    return null;
  }

  const data = result.results as any;
  return data.total;
}

export async function getFirstRebillsCohorte30dData(websiteId: number): Promise<number | null> {
  const result = await executeQuery("first-rebills-cohorte-30d", websiteId);

  if (result.status !== "success" || !result.results) {
    return null;
  }

  const data = result.results as any;
  return data.total;
}

export async function getSecondRebillsData(websiteId: number): Promise<number | null> {
  const result = await executeQuery("second-rebills-7d", websiteId);

  if (result.status !== "success" || !result.results) {
    return null;
  }

  const data = result.results as any;
  return data.total;
}

export async function getUsageBeforeRebill2Data(websiteId: number): Promise<{ firstRebills: number; withUsage: number } | null> {
  const result = await executeQuery("usage-before-rebill2-7d", websiteId);

  if (result.status !== "success" || !result.results) {
    return null;
  }

  const data = result.results as any;
  return {
    firstRebills: data.totalFirstRebills,
    withUsage: data.totalWithUsage,
  };
}

export async function getSubscriptionsData(websiteId: number): Promise<SubscriptionsData | null> {
  const result = await executeQuery("active-subscriptions", websiteId);

  if (result.status !== "success" || !result.results) {
    return null;
  }

  const data = result.results as any;

  return {
    total: data.total,
  };
}

export async function getAdSpendData(websiteId: number): Promise<AdSpendData | null> {
  const result = await executeQuery("ad-spend-7d", websiteId);

  if (result.status !== "success" || !result.results) {
    return null;
  }

  const data = result.results as any;

  return {
    totalEur: data.totalEur,
  };
}

export interface Ltv30dData {
  ltv30d: number;
  sampleSize: number;
}

export async function getLtv30dData(websiteId: number): Promise<Ltv30dData | null> {
  // Check cache first
  const cached = getCachedLtv<Ltv30dData>("ltv-30d", websiteId);
  if (cached) {
    console.log(`[LtvCache] Hit: ltv-30d for website ${websiteId}`);
    return cached;
  }

  console.log(`[LtvCache] Miss: ltv-30d for website ${websiteId}, executing query...`);
  const result = await executeQuery("ltv-30d", websiteId);

  if (result.status !== "success" || !result.results) {
    return null;
  }

  const data = result.results as any;
  const row = Array.isArray(data) ? data[0] : data;

  const ltvData: Ltv30dData = {
    ltv30d: parseFloat(row.ltv_30d) || 0,
    sampleSize: parseInt(row.sample_size) || 0,
  };

  setCachedLtv("ltv-30d", websiteId, ltvData);
  return ltvData;
}

// ============================================================================
// LTV VENTANAS CORRECTAS (Phase 6.1)
// ============================================================================

export interface LtvWindowData {
  ltv: number;
  cohortSize: number;
  customersWithRevenue: number;
  conversionRate: number;
  totalNetRevenueEur: number;
}

export async function getLtv21dData(websiteId: number): Promise<LtvWindowData | null> {
  const cached = getCachedLtv<LtvWindowData>("ltv-21d", websiteId);
  if (cached) {
    console.log(`[LtvCache] Hit: ltv-21d for website ${websiteId}`);
    return cached;
  }

  console.log(`[LtvCache] Miss: ltv-21d for website ${websiteId}, executing query...`);
  const result = await executeQuery("ltv-21d", websiteId);

  if (result.status !== "success" || !result.results) {
    return null;
  }

  const data = result.results as any;
  const row = Array.isArray(data) ? data[0] : data;

  const ltvData: LtvWindowData = {
    ltv: parseFloat(row.ltv_21d) || 0,
    cohortSize: parseInt(row.cohort_size) || 0,
    customersWithRevenue: parseInt(row.customers_with_revenue) || 0,
    conversionRate: parseFloat(row.conversion_rate_pct) || 0,
    totalNetRevenueEur: parseFloat(row.total_net_revenue_eur) || 0,
  };

  setCachedLtv("ltv-21d", websiteId, ltvData);
  return ltvData;
}

export async function getLtv51dData(websiteId: number): Promise<LtvWindowData | null> {
  const cached = getCachedLtv<LtvWindowData>("ltv-51d", websiteId);
  if (cached) {
    console.log(`[LtvCache] Hit: ltv-51d for website ${websiteId}`);
    return cached;
  }

  console.log(`[LtvCache] Miss: ltv-51d for website ${websiteId}, executing query...`);
  const result = await executeQuery("ltv-51d", websiteId);

  if (result.status !== "success" || !result.results) {
    return null;
  }

  const data = result.results as any;
  const row = Array.isArray(data) ? data[0] : data;

  const ltvData: LtvWindowData = {
    ltv: parseFloat(row.ltv_51d) || 0,
    cohortSize: parseInt(row.cohort_size) || 0,
    customersWithRevenue: parseInt(row.customers_with_revenue) || 0,
    conversionRate: parseFloat(row.conversion_rate_pct) || 0,
    totalNetRevenueEur: parseFloat(row.total_net_revenue_eur) || 0,
  };

  setCachedLtv("ltv-51d", websiteId, ltvData);
  return ltvData;
}

export async function getLtv81dData(websiteId: number): Promise<LtvWindowData | null> {
  const cached = getCachedLtv<LtvWindowData>("ltv-81d", websiteId);
  if (cached) {
    console.log(`[LtvCache] Hit: ltv-81d for website ${websiteId}`);
    return cached;
  }

  console.log(`[LtvCache] Miss: ltv-81d for website ${websiteId}, executing query...`);
  const result = await executeQuery("ltv-81d", websiteId);

  if (result.status !== "success" || !result.results) {
    return null;
  }

  const data = result.results as any;
  const row = Array.isArray(data) ? data[0] : data;

  const ltvData: LtvWindowData = {
    ltv: parseFloat(row.ltv_81d) || 0,
    cohortSize: parseInt(row.cohort_size) || 0,
    customersWithRevenue: parseInt(row.customers_with_revenue) || 0,
    conversionRate: parseFloat(row.conversion_rate_pct) || 0,
    totalNetRevenueEur: parseFloat(row.total_net_revenue_eur) || 0,
  };

  setCachedLtv("ltv-81d", websiteId, ltvData);
  return ltvData;
}

// ============================================================================
// UTILITY MODEL KPIs (Phase 9)
// El negocio se gana o pierde en M1
// ============================================================================

export interface TrialRevenueData {
  totalEur: number;
  totalCount: number;
}

export async function getTrialRevenueData(websiteId: number): Promise<TrialRevenueData | null> {
  const result = await executeQuery("trial-revenue-7d", websiteId);

  if (result.status !== "success" || !result.results) {
    return null;
  }

  const data = result.results as any;
  return {
    totalEur: data.totalEur || 0,
    totalCount: data.totalCount || 0,
  };
}

export interface FirstRebillRevenueData {
  totalEur: number;
  totalCount: number;
}

export async function getFirstRebillRevenueData(websiteId: number): Promise<FirstRebillRevenueData | null> {
  const result = await executeQuery("first-rebill-revenue-7d", websiteId);

  if (result.status !== "success" || !result.results) {
    return null;
  }

  const data = result.results as any;
  return {
    totalEur: data.totalEur || 0,
    totalCount: data.totalCount || 0,
  };
}

export interface RefundsM1Data {
  totalEur: number;
  totalCount: number;
}

export async function getRefundsM1Data(websiteId: number): Promise<RefundsM1Data | null> {
  const result = await executeQuery("refunds-m1-7d", websiteId);

  if (result.status !== "success" || !result.results) {
    return null;
  }

  const data = result.results as any;
  return {
    totalEur: data.totalEur || 0,
    totalCount: data.totalCount || 0,
  };
}
