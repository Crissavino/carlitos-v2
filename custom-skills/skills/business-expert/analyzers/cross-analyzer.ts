/**
 * Cross Analyzer
 *
 * Cruza datos de DBReader para calcular los 5 KPIs CORE.
 *
 * JERARQUÍA DE PRIORIDAD:
 * P1 - FRR (First Rebill Rate)
 * P2 - CPFR (Cost per First Rebill)
 * P3 - SRR (Second Rebill Rate) - usa cohorte 30-37d
 * P4 - U-R2 (Usage before Rebill 2) - diagnóstica, no alerta
 * P5 - Net ROAS Real
 *
 * Reglas de conflicto:
 * - Si FRR está en rojo, el negocio está mal aunque ROAS esté verde.
 * - Si CPFR está en rojo, NO se escala aunque FRR sea bueno.
 * - ROAS nunca sobreescribe FRR o CPFR.
 */

import {
  getRevenueData,
  getTrialsData,
  getFirstRebillsData,
  getFirstRebillsCohorte30dData,
  getSecondRebillsData,
  getUsageBeforeRebill2Data,
  getSubscriptionsData,
  getAdSpendData,
  getLtv30dData,
  getLtv21dData,
  getLtv51dData,
  getLtv81dData,
  // Utility Model (Phase 9) - DEPRECATED: Used for cashflow coverage only
  getTrialRevenueData,
  getFirstRebillRevenueData,
  getRefundsM1Data,
  // Phase 11: Payback M1 Cohort (FIX)
  getPaybackM1CohortData,
} from "./revenue-analyzer.js";
import {
  RawMetrics,
  CoreKpis,
  KpiResult,
  KpiStatus,
  BusinessStatus,
  Alert,
  AlertType,
  THRESHOLDS,
  CPFR_GREEN,
  CPFR_YELLOW,
  getWebsiteThresholds,
} from "../types.js";

// Minimum sample size for LTV to be considered reliable
const LTV_MIN_SAMPLE_SIZE = 30;

// ============================================================================
// METRICS CACHE (5 min TTL for fast dashboard loads)
// ============================================================================

interface MetricsCacheEntry {
  data: RawMetrics;
  cachedAt: number;
}

const METRICS_CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours (data updates daily from Google Ads)
// HARDENING: Cache per website_id, not global
const metricsCache: Map<number, MetricsCacheEntry> = new Map();

export function clearMetricsCache(websiteId?: number): void {
  if (websiteId) {
    metricsCache.delete(websiteId);
    console.log(`[MetricsCache] Cache cleared for website_id=${websiteId}`);
  } else {
    metricsCache.clear();
    console.log("[MetricsCache] All caches cleared");
  }
}

// ============================================================================
// DATA FETCHING
// ============================================================================

/**
 * Fetch raw metrics for a specific website
 * HARDENING: websiteId is REQUIRED - no global metrics allowed
 */
export async function fetchRawMetrics(websiteId: number): Promise<RawMetrics | null> {
  // HARDENING: Reject requests without websiteId
  if (!websiteId) {
    console.error("[MetricsCache] REJECTED: fetchRawMetrics called without websiteId");
    throw new Error('WEBSITE_ID_REQUIRED: fetchRawMetrics requires websiteId. Global KPIs are disabled.');
  }

  // Check cache for this specific website
  const cached = metricsCache.get(websiteId);
  if (cached && Date.now() - cached.cachedAt < METRICS_CACHE_TTL_MS) {
    console.log(`[MetricsCache] Hit for website_id=${websiteId} - returning cached metrics`);
    return cached.data;
  }

  console.log(`[MetricsCache] Miss for website_id=${websiteId} - fetching fresh metrics...`);
  const fetchStart = Date.now();

  // Helper to time individual queries
  const timed = async <T>(name: string, fn: () => Promise<T>): Promise<T> => {
    const start = Date.now();
    const result = await fn();
    console.log(`[QueryTime] ${name}: ${Date.now() - start}ms`);
    return result;
  };

  // HARDENING: All queries now filter by websiteId
  const [
    revenueData,
    trialsData,
    firstRebills,
    firstRebillsCohorte30d,
    secondRebills,
    usageData,
    subscriptionsData,
    adSpendData,
    ltv30dData,
    ltv21dData,
    ltv51dData,
    ltv81dData,
    // Utility Model (Phase 9) - DEPRECATED for Payback M1, kept for Cashflow Coverage
    trialRevenueData,
    firstRebillRevenueData,
    refundsM1Data,
    // Phase 11: Payback M1 Cohort (FIX - real cohort-based calculation)
    paybackM1CohortData,
  ] = await Promise.all([
    timed('revenue', () => getRevenueData(websiteId)),
    timed('trials', () => getTrialsData(websiteId)),
    timed('firstRebills', () => getFirstRebillsData(websiteId)),
    timed('firstRebillsCohorte30d', () => getFirstRebillsCohorte30dData(websiteId)),
    timed('secondRebills', () => getSecondRebillsData(websiteId)),
    timed('usage', () => getUsageBeforeRebill2Data(websiteId)),
    timed('subscriptions', () => getSubscriptionsData(websiteId)),
    timed('adSpend', () => getAdSpendData(websiteId)),
    timed('ltv30d', () => getLtv30dData(websiteId)),
    timed('ltv21d', () => getLtv21dData(websiteId)),
    timed('ltv51d', () => getLtv51dData(websiteId)),
    timed('ltv81d', () => getLtv81dData(websiteId)),
    // Utility Model (Phase 9) - DEPRECATED for Payback M1
    timed('trialRevenue', () => getTrialRevenueData(websiteId)),
    timed('firstRebillRevenue', () => getFirstRebillRevenueData(websiteId)),
    timed('refundsM1', () => getRefundsM1Data(websiteId)),
    // Phase 11: Payback M1 Cohort (FIX)
    timed('paybackM1Cohort', () => getPaybackM1CohortData(websiteId)),
  ]);

  console.log(`[MetricsCache] Total fetch time for website_id=${websiteId}: ${Date.now() - fetchStart}ms`);

  if (!revenueData || !trialsData) {
    return null;
  }

  const metrics: RawMetrics = {
    period: "LAST_7_DAYS",
    generatedAt: new Date().toISOString(),
    websiteId, // HARDENING: Include websiteId in metrics

    trials: trialsData.total,
    firstRebills: firstRebills ?? 0,
    firstRebillsCohorte30d: firstRebillsCohorte30d ?? 0,
    secondRebills: secondRebills ?? 0,
    usersWithUsageBeforeRebill2: usageData?.withUsage ?? 0,
    netRevenueEur: revenueData.netRevenueEur,
    subscriptionEur: revenueData.subscriptionEur,
    refundsEur: revenueData.refundsEur,
    activeSubscriptions: subscriptionsData?.total ?? 0,

    totalAdSpendEur: adSpendData?.totalEur ?? 0,

    // LTV 30 días (proxy intermedio)
    ltv30d: ltv30dData?.ltv30d ?? 0,
    ltv30dSampleSize: ltv30dData?.sampleSize ?? 0,

    // LTV ventanas correctas (Phase 6.1)
    ltv21d: ltv21dData?.ltv ?? 0,
    ltv21dCohortSize: ltv21dData?.cohortSize ?? 0,
    ltv51d: ltv51dData?.ltv ?? 0,
    ltv51dCohortSize: ltv51dData?.cohortSize ?? 0,
    ltv81d: ltv81dData?.ltv ?? 0,
    ltv81dCohortSize: ltv81dData?.cohortSize ?? 0,

    // Utility Model (Phase 9) - DEPRECATED for Payback M1, used for Cashflow Coverage
    trialRevenueEur: trialRevenueData?.totalEur ?? 0,
    firstRebillRevenueEur: firstRebillRevenueData?.totalEur ?? 0,
    refundsM1Eur: refundsM1Data?.totalEur ?? 0,

    // Phase 11: Payback M1 Cohort (FIX - real cohort-based calculation)
    paybackM1Cohort: paybackM1CohortData ? {
      cohortSize: paybackM1CohortData.cohortSize,
      firstRebills: paybackM1CohortData.firstRebills,
      trialRevenueEur: paybackM1CohortData.trialRevenueEur,
      firstRebillRevenueEur: paybackM1CohortData.firstRebillRevenueEur,
      refundsM1Eur: paybackM1CohortData.refundsM1Eur,
      m1NetRevenueEur: paybackM1CohortData.m1NetRevenueEur,
      adSpendEur: paybackM1CohortData.adSpendEur,
      paybackM1: paybackM1CohortData.paybackM1,
      cpfrCohort: paybackM1CohortData.cpfrCohort,
    } : undefined,
  };

  // Cache the result for this website
  metricsCache.set(websiteId, { data: metrics, cachedAt: Date.now() });
  console.log(`[MetricsCache] Cached fresh metrics for website_id=${websiteId}`);

  return metrics;
}

// ============================================================================
// KPI CALCULATIONS
// ============================================================================

function calculateFRR(firstRebills: number, trials: number, websiteId: number): KpiResult {
  if (trials === 0) {
    return { value: 0, status: "red", shortReason: "Sin trials" };
  }

  const frr = firstRebills / trials;
  const thresholds = getWebsiteThresholds(websiteId);
  let status: KpiStatus;
  let shortReason: string;

  if (frr >= thresholds.frr.green) {
    status = "green";
    shortReason = `${(frr * 100).toFixed(1)}% - Adquisición de calidad`;
  } else if (frr >= thresholds.frr.yellow) {
    status = "yellow";
    shortReason = `${(frr * 100).toFixed(1)}% - Calidad en riesgo`;
  } else {
    status = "red";
    shortReason = `${(frr * 100).toFixed(1)}% - Adquisición de baja calidad`;
  }

  return { value: Math.round(frr * 1000) / 1000, status, shortReason };
}

function calculateCPFR(totalAdSpend: number, firstRebills: number, websiteId: number): KpiResult {
  if (firstRebills === 0) {
    if (totalAdSpend === 0) {
      return { value: 0, status: "green", shortReason: "Sin gasto en ads" };
    }
    return { value: Infinity, status: "red", shortReason: "Gasto sin rebills" };
  }

  const cpfr = totalAdSpend / firstRebills;
  const thresholds = getWebsiteThresholds(websiteId);
  let status: KpiStatus;
  let shortReason: string;

  if (cpfr <= thresholds.cpfr.green) {
    status = "green";
    shortReason = `€${cpfr.toFixed(0)} - CAC eficiente`;
  } else if (cpfr <= thresholds.cpfr.yellow) {
    status = "yellow";
    shortReason = `€${cpfr.toFixed(0)} - CAC en zona límite`;
  } else {
    status = "red";
    shortReason = `€${cpfr.toFixed(0)} - CAC demasiado alto`;
  }

  return { value: Math.round(cpfr * 100) / 100, status, shortReason };
}

function calculateSRR(secondRebills: number, firstRebillsCohorte30d: number): KpiResult {
  if (firstRebillsCohorte30d === 0) {
    return { value: 0, status: "yellow", shortReason: "Sin datos de cohorte", isInformative: true };
  }

  const srr = secondRebills / firstRebillsCohorte30d;
  // En modelo UTILITY, SRR siempre es informativo (no genera alertas)
  // SRR ~45-50% es ESTRUCTURAL, no un problema

  let shortReason: string;
  if (srr >= THRESHOLDS.SRR_GREEN) {
    shortReason = `${(srr * 100).toFixed(1)}% - Excepcional para utility`;
  } else if (srr >= THRESHOLDS.SRR_YELLOW) {
    shortReason = `${(srr * 100).toFixed(1)}% - Normal alto`;
  } else {
    shortReason = `${(srr * 100).toFixed(1)}% - Normal en utility (M2 estructuralmente bajo)`;
  }

  // Status es solo visual, no genera alertas
  const status: KpiStatus = srr >= THRESHOLDS.SRR_GREEN ? "green" :
                            srr >= THRESHOLDS.SRR_YELLOW ? "yellow" : "yellow"; // Nunca rojo en utility

  return { value: Math.round(srr * 1000) / 1000, status, shortReason, isInformative: true };
}

/**
 * Weekly Profit - P0 HEADLINE (modelo utility)
 * WeeklyProfit = Net Revenue (7d) - Ad Spend (7d) - €250 (fixed costs)
 *
 * Este es EL indicador más importante del negocio.
 */
function calculateWeeklyProfit(netRevenueEur: number, adSpendEur: number): KpiResult {
  const weeklyProfit = netRevenueEur - adSpendEur - THRESHOLDS.WEEKLY_FIXED_COSTS;

  let status: KpiStatus;
  let shortReason: string;

  if (weeklyProfit >= THRESHOLDS.WEEKLY_PROFIT_GREEN) {
    status = "green";
    shortReason = `€${weeklyProfit.toFixed(0)} - Negocio rentable`;
  } else if (weeklyProfit >= THRESHOLDS.WEEKLY_PROFIT_YELLOW) {
    status = "yellow";
    shortReason = `€${weeklyProfit.toFixed(0)} - Rentabilidad ajustada`;
  } else {
    status = "red";
    shortReason = `€${weeklyProfit.toFixed(0)} - Negocio en pérdida`;
  }

  return { value: Math.round(weeklyProfit * 100) / 100, status, shortReason };
}

function calculateUR2(usersWithUsage: number, firstRebillsCohorte30d: number): KpiResult {
  if (firstRebillsCohorte30d === 0) {
    return { value: 0, status: "yellow", shortReason: "Sin datos de cohorte" };
  }

  const ur2 = usersWithUsage / firstRebillsCohorte30d;
  let status: KpiStatus;
  let shortReason: string;

  if (ur2 >= THRESHOLDS.UR2_GREEN) {
    status = "green";
    shortReason = `${(ur2 * 100).toFixed(1)}% - Activación saludable`;
  } else if (ur2 >= THRESHOLDS.UR2_YELLOW) {
    status = "yellow";
    shortReason = `${(ur2 * 100).toFixed(1)}% - Activación débil`;
  } else {
    status = "red";
    shortReason = `${(ur2 * 100).toFixed(1)}% - Uso bajo (modelo puntual)`;
  }

  return { value: Math.round(ur2 * 1000) / 1000, status, shortReason };
}

function calculateNetRoas(netRevenue: number, totalAdSpend: number): KpiResult {
  if (totalAdSpend === 0) {
    if (netRevenue > 0) {
      return { value: Infinity, status: "green", shortReason: "Revenue sin gasto en ads" };
    }
    return { value: 0, status: "green", shortReason: "Sin datos de ads" };
  }

  const roas = netRevenue / totalAdSpend;
  let status: KpiStatus;
  let shortReason: string;

  if (roas >= THRESHOLDS.ROAS_GREEN) {
    status = "green";
    shortReason = `${roas.toFixed(2)}x - ROAS excelente`;
  } else if (roas >= THRESHOLDS.ROAS_YELLOW) {
    status = "yellow";
    shortReason = `${roas.toFixed(2)}x - ROAS ajustado`;
  } else {
    status = "red";
    shortReason = `${roas.toFixed(2)}x - ROAS crítico`;
  }

  return { value: Math.round(roas * 100) / 100, status, shortReason };
}

function calculateLtv30d(ltv30d: number, sampleSize: number): KpiResult {
  if (sampleSize < LTV_MIN_SAMPLE_SIZE) {
    return {
      value: ltv30d,
      status: "yellow",
      shortReason: `€${ltv30d.toFixed(0)} (n=${sampleSize}, muestra pequeña)`,
    };
  }

  // LTV no tiene semáforos per se, pero indicamos si es bajo vs esperado
  const status: KpiStatus = ltv30d >= THRESHOLDS.TARGET_LTV ? "green" :
                            ltv30d >= THRESHOLDS.TARGET_LTV * 0.7 ? "yellow" : "red";
  const shortReason = `€${ltv30d.toFixed(0)} (n=${sampleSize})`;

  return { value: Math.round(ltv30d * 100) / 100, status, shortReason };
}

function calculatePaybackRatio(ltv30d: number, cpfr: number): KpiResult {
  if (cpfr === 0 || cpfr === Infinity) {
    return { value: 0, status: "yellow", shortReason: "Sin datos de CPFR" };
  }

  if (ltv30d === 0) {
    return { value: 0, status: "yellow", shortReason: "Sin datos de LTV" };
  }

  const payback = ltv30d / cpfr;
  let status: KpiStatus;
  let shortReason: string;

  if (payback >= THRESHOLDS.PAYBACK_GREEN) {
    status = "green";
    shortReason = `${payback.toFixed(2)}x - Adquisición rentable`;
  } else if (payback >= THRESHOLDS.PAYBACK_YELLOW) {
    status = "yellow";
    shortReason = `${payback.toFixed(2)}x - Break-even`;
  } else {
    status = "red";
    shortReason = `${payback.toFixed(2)}x - Pérdida en adquisición`;
  }

  return { value: Math.round(payback * 100) / 100, status, shortReason };
}

// ============================================================================
// LTV/PAYBACK VENTANAS CORRECTAS (Phase 6.1)
// ============================================================================

// Minimum cohort size for LTV windows to be considered reliable
const LTV_WINDOW_MIN_COHORT = 50;

function calculateLtv21d(ltv21d: number, cohortSize: number): KpiResult {
  if (cohortSize < LTV_WINDOW_MIN_COHORT) {
    return {
      value: ltv21d,
      status: "yellow",
      shortReason: `€${ltv21d.toFixed(0)} (n=${cohortSize}, muestra pequeña)`,
    };
  }

  // LTV 21d no tiene semáforos fuertes, es solo informativo
  const status: KpiStatus = "yellow"; // Siempre amarillo porque es solo para warning
  const shortReason = `€${ltv21d.toFixed(0)} (n=${cohortSize})`;

  return { value: Math.round(ltv21d * 100) / 100, status, shortReason };
}

function calculatePayback21d(ltv21d: number, cpfr: number): KpiResult {
  if (cpfr === 0 || cpfr === Infinity) {
    return { value: 0, status: "yellow", shortReason: "Sin datos de CPFR" };
  }

  if (ltv21d === 0) {
    return { value: 0, status: "yellow", shortReason: "Sin datos de LTV 21d" };
  }

  const payback = ltv21d / cpfr;
  let status: KpiStatus;
  let shortReason: string;

  // Payback 21d: solo warning, nunca decisiones fuertes
  if (payback >= THRESHOLDS.PAYBACK_21D_WARNING) {
    status = "yellow"; // Amarillo = OK para 21d (es solo warning)
    shortReason = `${payback.toFixed(2)}x (21d) - Monitorear`;
  } else {
    status = "yellow"; // Nunca rojo para 21d
    shortReason = `${payback.toFixed(2)}x (21d) - Warning temprano`;
  }

  return { value: Math.round(payback * 100) / 100, status, shortReason };
}

function calculateLtv51d(ltv51d: number, cohortSize: number): KpiResult {
  if (cohortSize < LTV_WINDOW_MIN_COHORT) {
    return {
      value: ltv51d,
      status: "yellow",
      shortReason: `€${ltv51d.toFixed(0)} (n=${cohortSize}, muestra pequeña)`,
    };
  }

  // LTV 51d tiene semáforos basados en CPFR esperado
  const expectedCpfr = 90; // EUR aproximado
  const impliedPayback = ltv51d / expectedCpfr;

  const status: KpiStatus = impliedPayback >= THRESHOLDS.PAYBACK_51D_SCALE ? "green" :
                            impliedPayback >= THRESHOLDS.PAYBACK_51D_PAUSE ? "yellow" : "red";
  const shortReason = `€${ltv51d.toFixed(0)} (n=${cohortSize})`;

  return { value: Math.round(ltv51d * 100) / 100, status, shortReason };
}

function calculatePayback51d(ltv51d: number, cpfr: number): KpiResult {
  if (cpfr === 0 || cpfr === Infinity) {
    return { value: 0, status: "yellow", shortReason: "Sin datos de CPFR" };
  }

  if (ltv51d === 0) {
    return { value: 0, status: "yellow", shortReason: "Sin datos de LTV 51d" };
  }

  const payback = ltv51d / cpfr;
  let status: KpiStatus;
  let shortReason: string;

  // Payback 51d: decisiones fuertes
  if (payback >= THRESHOLDS.PAYBACK_51D_SCALE) {
    status = "green";
    shortReason = `${payback.toFixed(2)}x (51d) - Scale ready`;
  } else if (payback >= THRESHOLDS.PAYBACK_51D_PAUSE) {
    status = "yellow";
    shortReason = `${payback.toFixed(2)}x (51d) - Break-even`;
  } else {
    status = "red";
    shortReason = `${payback.toFixed(2)}x (51d) - Pause ads`;
  }

  return { value: Math.round(payback * 100) / 100, status, shortReason };
}

function calculateLtv81d(ltv81d: number, cohortSize: number): KpiResult {
  if (cohortSize < LTV_WINDOW_MIN_COHORT) {
    return {
      value: ltv81d,
      status: "yellow",
      shortReason: `€${ltv81d.toFixed(0)} (n=${cohortSize}, muestra pequeña)`,
    };
  }

  const shortReason = `€${ltv81d.toFixed(0)} (n=${cohortSize})`;
  return { value: Math.round(ltv81d * 100) / 100, status: "yellow", shortReason };
}

function calculatePayback81d(ltv81d: number, cpfr: number): KpiResult {
  if (cpfr === 0 || cpfr === Infinity || ltv81d === 0) {
    return { value: 0, status: "yellow", shortReason: "Sin datos" };
  }

  const payback = ltv81d / cpfr;
  return {
    value: Math.round(payback * 100) / 100,
    status: "yellow",
    shortReason: `${payback.toFixed(2)}x (81d) - Análisis`,
  };
}

// ============================================================================
// UTILITY MODEL KPIs (Phase 9 + Phase 11 FIX)
// El negocio se gana o pierde en M1
// ============================================================================

/**
 * Payback M1 - P1 HEADLINE (COHORT-BASED)
 *
 * Phase 11 FIX: Usa datos de COHORTE (30-60 días atrás), no cashflow.
 * Fórmula: M1_Net_Revenue_Cohort / Ad_Spend_Cohort
 *
 * TODOS los componentes de la MISMA cohorte de adquisición.
 * Thresholds: ≥1.20 green, 0.90-1.19 yellow, <0.90 red
 */
function calculatePaybackM1Cohort(
  cohortData?: {
    paybackM1: number;
    cohortSize: number;
    m1NetRevenueEur: number;
    adSpendEur: number;
  }
): KpiResult {
  if (!cohortData || cohortData.cohortSize === 0) {
    return { value: 0, status: "yellow", shortReason: "Sin datos de cohorte" };
  }

  if (cohortData.adSpendEur === 0) {
    return { value: 0, status: "yellow", shortReason: "Sin ad spend en cohorte" };
  }

  const paybackM1 = cohortData.paybackM1;

  let status: KpiStatus;
  let shortReason: string;

  if (paybackM1 >= THRESHOLDS.PAYBACK_M1_GREEN) {
    status = "green";
    shortReason = `${paybackM1.toFixed(2)}x (cohorte) - Rentable en M1`;
  } else if (paybackM1 >= THRESHOLDS.PAYBACK_M1_YELLOW) {
    status = "yellow";
    shortReason = `${paybackM1.toFixed(2)}x (cohorte) - Break-even M1`;
  } else {
    status = "red";
    shortReason = `${paybackM1.toFixed(2)}x (cohorte) - Pérdida en M1`;
  }

  return { value: Math.round(paybackM1 * 100) / 100, status, shortReason };
}

/**
 * Cashflow Coverage 7d - INFORMATIVO (ex-Payback M1 cashflow)
 *
 * DEPRECATED para decisiones. Solo informativo.
 * Mezcla ventanas incompatibles (revenue de cualquier cohorte / CPFR 7d)
 *
 * NO afecta business status ni genera alertas.
 */
function calculateCashflowCoverage7d(
  trialRevenueEur: number,
  firstRebillRevenueEur: number,
  refundsM1Eur: number,
  cpfr: number
): KpiResult {
  if (cpfr === 0 || cpfr === Infinity) {
    return { value: 0, status: "yellow", shortReason: "Sin datos", isInformative: true };
  }

  const m1Revenue = trialRevenueEur + firstRebillRevenueEur - refundsM1Eur;
  const coverage = m1Revenue / cpfr;

  // Siempre informativo, no afecta semáforos del negocio
  return {
    value: Math.round(coverage * 100) / 100,
    status: "yellow", // Siempre amarillo - es solo informativo
    shortReason: `${coverage.toFixed(2)}x cashflow (no cohorte)`,
    isInformative: true,
  };
}

/**
 * Refund Rate M1 - P2 (COHORT-BASED)
 * RefundRateM1 = Refunds_M1 / First_Rebill_Revenue (de la cohorte)
 * Thresholds: ≤5% green, 5-10% yellow, >10% red
 */
function calculateRefundRateM1Cohort(
  cohortData?: {
    refundsM1Eur: number;
    firstRebillRevenueEur: number;
    cohortSize: number;
  }
): KpiResult {
  if (!cohortData || cohortData.cohortSize === 0) {
    return { value: 0, status: "yellow", shortReason: "Sin datos de cohorte" };
  }

  if (cohortData.firstRebillRevenueEur === 0) {
    return { value: 0, status: "yellow", shortReason: "Sin first rebills en cohorte" };
  }

  // Calculate as % of first rebill revenue
  const refundRate = cohortData.refundsM1Eur / cohortData.firstRebillRevenueEur;

  let status: KpiStatus;
  let shortReason: string;

  if (refundRate <= THRESHOLDS.REFUND_RATE_M1_GREEN) {
    status = "green";
    shortReason = `${(refundRate * 100).toFixed(1)}% (cohorte) - Controlados`;
  } else if (refundRate <= THRESHOLDS.REFUND_RATE_M1_YELLOW) {
    status = "yellow";
    shortReason = `${(refundRate * 100).toFixed(1)}% (cohorte) - Elevados`;
  } else {
    status = "red";
    shortReason = `${(refundRate * 100).toFixed(1)}% (cohorte) - Críticos`;
  }

  return { value: Math.round(refundRate * 1000) / 1000, status, shortReason };
}

/**
 * CPT - Cost Per Trial - P3 (contexto, alertas suaves)
 * CPT = Ad_Spend / Trials
 * Thresholds: ≤€30 green, €30-€50 yellow, >€50 red
 */
function calculateCPT(totalAdSpend: number, trials: number): KpiResult {
  if (trials === 0) {
    if (totalAdSpend === 0) {
      return { value: 0, status: "green", shortReason: "Sin gasto en ads" };
    }
    return { value: Infinity, status: "red", shortReason: "Gasto sin trials" };
  }

  const cpt = totalAdSpend / trials;
  let status: KpiStatus;
  let shortReason: string;

  if (cpt <= THRESHOLDS.CPT_GREEN) {
    status = "green";
    shortReason = `€${cpt.toFixed(0)} - CPT eficiente`;
  } else if (cpt <= THRESHOLDS.CPT_YELLOW) {
    status = "yellow";
    shortReason = `€${cpt.toFixed(0)} - CPT en zona límite`;
  } else {
    status = "red";
    shortReason = `€${cpt.toFixed(0)} - CPT muy alto`;
  }

  return { value: Math.round(cpt * 100) / 100, status, shortReason };
}

export function calculateCoreKpis(raw: RawMetrics): CoreKpis {
  // Usar thresholds por website para FRR y CPFR
  const websiteId = raw.websiteId;
  const cpfr = calculateCPFR(raw.totalAdSpendEur, raw.firstRebills, websiteId);
  const ltv30d = calculateLtv30d(raw.ltv30d, raw.ltv30dSampleSize);

  // LTV ventanas correctas (Phase 6.1)
  const ltv21d = calculateLtv21d(raw.ltv21d, raw.ltv21dCohortSize);
  const ltv51d = calculateLtv51d(raw.ltv51d, raw.ltv51dCohortSize);
  const ltv81d = raw.ltv81d !== undefined
    ? calculateLtv81d(raw.ltv81d, raw.ltv81dCohortSize ?? 0)
    : undefined;

  // SRR y U-R2 son informativos (no generan alertas en modelo utility)
  const srr = calculateSRR(raw.secondRebills, raw.firstRebillsCohorte30d);
  // srr ya tiene isInformative = true en calculateSRR

  const ur2 = calculateUR2(raw.usersWithUsageBeforeRebill2, raw.firstRebillsCohorte30d);
  ur2.isInformative = true; // Diagnóstica, no alerta

  // Payback legacy también es informativo
  const paybackRatio = calculatePaybackRatio(raw.ltv30d, cpfr.value);
  paybackRatio.isInformative = true; // Reemplazado por Payback M1

  // Payback windows son informativos
  const payback21d = calculatePayback21d(raw.ltv21d, cpfr.value);
  payback21d.isInformative = true;
  const payback51d = calculatePayback51d(raw.ltv51d, cpfr.value);
  payback51d.isInformative = true;
  const payback81d = raw.ltv81d !== undefined
    ? calculatePayback81d(raw.ltv81d, cpfr.value)
    : undefined;
  if (payback81d) payback81d.isInformative = true;

  return {
    // P0 - Weekly Profit (HEADLINE - modelo utility)
    weeklyProfit: calculateWeeklyProfit(raw.netRevenueEur, raw.totalAdSpendEur),

    // P1 - FRR con thresholds por website
    frr: calculateFRR(raw.firstRebills, raw.trials, websiteId),
    cpfr,
    srr,
    ur2,
    netRoas: calculateNetRoas(raw.netRevenueEur, raw.totalAdSpendEur),

    // LTV 30d (proxy intermedio, informativo)
    ltv30d: { ...ltv30d, isInformative: true },
    paybackRatio,

    // LTV/Payback ventanas correctas (Phase 6.1) - informativos
    ltv21d: { ...ltv21d, isInformative: true },
    payback21d,
    ltv51d: { ...ltv51d, isInformative: true },
    payback51d,
    ltv81d: ltv81d ? { ...ltv81d, isInformative: true } : undefined,
    payback81d,

    // Utility Model KPIs (Phase 9 + Phase 11 FIX)
    // Payback M1 ahora usa datos de COHORTE, no cashflow
    paybackM1: calculatePaybackM1Cohort(raw.paybackM1Cohort),
    refundRateM1: calculateRefundRateM1Cohort(raw.paybackM1Cohort),
    cpt: calculateCPT(raw.totalAdSpendEur, raw.trials),

    // Cashflow Coverage 7d - INFORMATIVO (ex-Payback M1 cashflow)
    // Mantenido solo para referencia histórica, NO afecta decisiones
    cashflowCoverage7d: calculateCashflowCoverage7d(
      raw.trialRevenueEur,
      raw.firstRebillRevenueEur,
      raw.refundsM1Eur,
      cpfr.value
    ),
  };
}

// ============================================================================
// BUSINESS STATUS (based on KPI hierarchy)
// ============================================================================

export function determineBusinessStatus(kpis: CoreKpis): BusinessStatus {
  // ============================================================================
  // MODELO UTILITY: JERARQUÍA DE DECISIÓN
  // ============================================================================
  //
  // P0. Weekly Profit: Si es verde (>€5k), el negocio está bien
  // P1. Payback M1: Si es verde (>=1.20), el negocio está bien
  // P2. Weekly Profit rojo (<€2.5k) → CRÍTICO (perdiendo plata)
  // P3. Payback M1 < 0.90 → CRÍTICO
  // P4. Refund Rate M1 > 15% → CRÍTICO
  //
  // KPIs que NO afectan el estado (solo contexto):
  // - SRR, U-R2, Payback 30d/51d/90d, CPT
  // - FRR, CPFR (alertas pero no cambian estado si profit es bueno)
  //
  // ============================================================================

  const weeklyProfitValue = kpis.weeklyProfit.value;
  const paybackM1Value = kpis.paybackM1.value;
  const refundRateM1Value = kpis.refundRateM1.value;

  // ─────────────────────────────────────────────────────────────────────────────
  // ESTABLE: Weekly Profit verde O Payback M1 verde
  // ─────────────────────────────────────────────────────────────────────────────
  // Si el negocio genera >€5k/semana de profit, está bien aunque otros KPIs
  // estén en amarillo. El profit real es lo que importa.
  if (weeklyProfitValue >= THRESHOLDS.WEEKLY_PROFIT_GREEN) {
    return "ESTABLE";
  }

  // Payback M1 verde también indica negocio estable
  if (paybackM1Value >= 1.20) {
    return "ESTABLE";
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // CRÍTICO: Condiciones de pérdida confirmada
  // ─────────────────────────────────────────────────────────────────────────────
  // 1. Weekly Profit < €2,500 (el negocio pierde plata)
  // 2. Payback M1 < 0.90 (pérdida en M1)
  // 3. Refund Rate M1 > 15% (refunds descontrolados)
  // ─────────────────────────────────────────────────────────────────────────────
  if (weeklyProfitValue < THRESHOLDS.WEEKLY_PROFIT_YELLOW) {
    return "CRÍTICO";
  }
  if (paybackM1Value < 0.90) {
    return "CRÍTICO";
  }
  if (refundRateM1Value > 0.15) {
    return "CRÍTICO";
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // EN RIESGO: Métricas en zona amarilla
  // ─────────────────────────────────────────────────────────────────────────────
  // - Weekly Profit €2.5k-5k
  // - Payback M1 0.90-1.19
  // - Refund Rate M1 8-15%
  // ─────────────────────────────────────────────────────────────────────────────
  if (weeklyProfitValue >= THRESHOLDS.WEEKLY_PROFIT_YELLOW && weeklyProfitValue < THRESHOLDS.WEEKLY_PROFIT_GREEN) {
    return "EN RIESGO";
  }
  if (paybackM1Value >= 0.90 && paybackM1Value < 1.20) {
    return "EN RIESGO";
  }
  if (refundRateM1Value > 0.08 && refundRateM1Value <= 0.15) {
    return "EN RIESGO";
  }

  // Net ROAS < 1.2 es warning pero no crítico
  if (kpis.netRoas.value < 1.2) {
    return "EN RIESGO";
  }

  return "ESTABLE";
}

// ============================================================================
// ALERTS (SOLO 2 - U-R2 es diagnóstica)
// ============================================================================

export function generateAlerts(kpis: CoreKpis): Alert[] {
  const alerts: Alert[] = [];

  // ============================================================================
  // JERARQUÍA DE ALERTAS - MODELO UTILITY
  // ============================================================================
  // 1. Weekly Profit rojo → CRÍTICO (el negocio pierde plata)
  // 2. FRR rojo → CRÍTICO (adquisición de baja calidad)
  // 3. CPFR rojo → NO ESCALAR (warning)
  // 4. ROAS rojo → OPTIMIZAR
  // 5. SRR → NUNCA alerta (M2+ bajo es estructural)
  // ============================================================================

  // P0: Weekly Profit en rojo - MÁXIMA PRIORIDAD
  if (kpis.weeklyProfit.status === "red") {
    alerts.push({
      type: "weekly_profit_red",
      severity: "critical",
      message: `Weekly Profit €${kpis.weeklyProfit.value.toFixed(0)}: Negocio en pérdida. Acción urgente.`,
    });
  }

  // P1: FRR en rojo
  if (kpis.frr.status === "red") {
    alerts.push({
      type: "frr_red",
      severity: "critical",
      message: `FRR ${(kpis.frr.value * 100).toFixed(1)}%: Adquisición de baja calidad. Revisar tráfico.`,
    });
  }

  // P2: CPFR en rojo - NO ESCALAR (pero no es crítico si hay profit)
  if (kpis.cpfr.status === "red") {
    alerts.push({
      type: "cpfr_red",
      severity: "critical",
      message: `CPFR €${kpis.cpfr.value.toFixed(0)}: CAC alto. No escalar hasta optimizar.`,
    });
  }

  // P3: ROAS en rojo - OPTIMIZAR
  if (kpis.netRoas.status === "red") {
    alerts.push({
      type: "roas_red",
      severity: "critical",
      message: `ROAS ${kpis.netRoas.value.toFixed(2)}x: Eficiencia baja. Optimizar campañas.`,
    });
  }

  // P4: Payback M1 en rojo (pérdida en M1)
  if (kpis.paybackM1.status === "red") {
    alerts.push({
      type: "payback_red",
      severity: "critical",
      message: `Payback M1 ${kpis.paybackM1.value.toFixed(2)}x: Pérdida en primer mes.`,
    });
  }

  // P5: Refund Rate M1 alto
  if (kpis.refundRateM1.status === "red") {
    alerts.push({
      type: "refund_m1_red",
      severity: "critical",
      message: `Refund Rate M1 ${(kpis.refundRateM1.value * 100).toFixed(1)}%: Refunds descontrolados.`,
    });
  }

  // NOTA: SRR y U-R2 NUNCA generan alertas en modelo utility
  // M2+ bajo es estructural, no un problema

  return alerts;
}
