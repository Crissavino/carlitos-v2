/**
 * Revenue Analyzer
 *
 * Obtiene datos de revenue, trials, rebills, usage y ad spend desde DBReader.
 *
 * LTV queries are cached for 1 hour to improve performance.
 * Cache is invalidated on server restart or when TTL expires.
 */

import { executeQuery } from "../../db-reader/executor.js";

// ============================================================================
// LTV CACHE (1 hour TTL for expensive queries)
// ============================================================================

interface CacheEntry<T> {
  data: T;
  cachedAt: number;
}

const LTV_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
const ltvCache: Map<string, CacheEntry<any>> = new Map();

function getCachedLtv<T>(key: string): T | null {
  const entry = ltvCache.get(key);
  if (!entry) return null;

  if (Date.now() - entry.cachedAt > LTV_CACHE_TTL_MS) {
    ltvCache.delete(key);
    return null;
  }

  return entry.data as T;
}

function setCachedLtv<T>(key: string, data: T): void {
  ltvCache.set(key, { data, cachedAt: Date.now() });
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

export async function getRevenueData(): Promise<RevenueData | null> {
  const result = await executeQuery("daily-revenue-7d");

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

export async function getTrialsData(): Promise<TrialsData | null> {
  const result = await executeQuery("trials-last-7-days");

  if (result.status !== "success" || !result.results) {
    return null;
  }

  const data = result.results as any;

  return {
    total: data.total,
  };
}

export async function getFirstRebillsData(): Promise<number | null> {
  const result = await executeQuery("first-rebills-7d");

  if (result.status !== "success" || !result.results) {
    return null;
  }

  const data = result.results as any;
  return data.total;
}

export async function getFirstRebillsCohorte30dData(): Promise<number | null> {
  const result = await executeQuery("first-rebills-cohorte-30d");

  if (result.status !== "success" || !result.results) {
    return null;
  }

  const data = result.results as any;
  return data.total;
}

export async function getSecondRebillsData(): Promise<number | null> {
  const result = await executeQuery("second-rebills-7d");

  if (result.status !== "success" || !result.results) {
    return null;
  }

  const data = result.results as any;
  return data.total;
}

export async function getUsageBeforeRebill2Data(): Promise<{ firstRebills: number; withUsage: number } | null> {
  const result = await executeQuery("usage-before-rebill2-7d");

  if (result.status !== "success" || !result.results) {
    return null;
  }

  const data = result.results as any;
  return {
    firstRebills: data.totalFirstRebills,
    withUsage: data.totalWithUsage,
  };
}

export async function getSubscriptionsData(): Promise<SubscriptionsData | null> {
  const result = await executeQuery("active-subscriptions");

  if (result.status !== "success" || !result.results) {
    return null;
  }

  const data = result.results as any;

  return {
    total: data.total,
  };
}

export async function getAdSpendData(): Promise<AdSpendData | null> {
  const result = await executeQuery("ad-spend-7d");

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

export async function getLtv30dData(): Promise<Ltv30dData | null> {
  // Check cache first
  const cached = getCachedLtv<Ltv30dData>("ltv-30d");
  if (cached) {
    console.log("[LtvCache] Hit: ltv-30d");
    return cached;
  }

  console.log("[LtvCache] Miss: ltv-30d, executing query...");
  const result = await executeQuery("ltv-30d");

  if (result.status !== "success" || !result.results) {
    return null;
  }

  const data = result.results as any;

  // La query retorna un array con un solo row
  const row = Array.isArray(data) ? data[0] : data;

  const ltvData: Ltv30dData = {
    ltv30d: parseFloat(row.ltv_30d) || 0,
    sampleSize: parseInt(row.sample_size) || 0,
  };

  setCachedLtv("ltv-30d", ltvData);
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

export async function getLtv21dData(): Promise<LtvWindowData | null> {
  // Check cache first
  const cached = getCachedLtv<LtvWindowData>("ltv-21d");
  if (cached) {
    console.log("[LtvCache] Hit: ltv-21d");
    return cached;
  }

  console.log("[LtvCache] Miss: ltv-21d, executing query...");
  const result = await executeQuery("ltv-21d");

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

  setCachedLtv("ltv-21d", ltvData);
  return ltvData;
}

export async function getLtv51dData(): Promise<LtvWindowData | null> {
  // Check cache first
  const cached = getCachedLtv<LtvWindowData>("ltv-51d");
  if (cached) {
    console.log("[LtvCache] Hit: ltv-51d");
    return cached;
  }

  console.log("[LtvCache] Miss: ltv-51d, executing query...");
  const result = await executeQuery("ltv-51d");

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

  setCachedLtv("ltv-51d", ltvData);
  return ltvData;
}

export async function getLtv81dData(): Promise<LtvWindowData | null> {
  // Check cache first
  const cached = getCachedLtv<LtvWindowData>("ltv-81d");
  if (cached) {
    console.log("[LtvCache] Hit: ltv-81d");
    return cached;
  }

  console.log("[LtvCache] Miss: ltv-81d, executing query...");
  const result = await executeQuery("ltv-81d");

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

  setCachedLtv("ltv-81d", ltvData);
  return ltvData;
}
