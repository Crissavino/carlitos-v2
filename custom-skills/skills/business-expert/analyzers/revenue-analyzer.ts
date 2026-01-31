/**
 * Revenue Analyzer
 *
 * Obtiene datos de revenue, trials, rebills, usage y ad spend desde DBReader.
 */

import { executeQuery } from "../../db-reader/executor.js";

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
