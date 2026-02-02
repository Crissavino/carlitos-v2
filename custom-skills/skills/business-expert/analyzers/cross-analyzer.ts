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
  // Utility Model (Phase 9)
  getTrialRevenueData,
  getFirstRebillRevenueData,
  getRefundsM1Data,
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

const METRICS_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour (data updates daily from Google Ads)
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
    // Utility Model (Phase 9)
    trialRevenueData,
    firstRebillRevenueData,
    refundsM1Data,
  ] = await Promise.all([
    getRevenueData(websiteId),
    getTrialsData(websiteId),
    getFirstRebillsData(websiteId),
    getFirstRebillsCohorte30dData(websiteId),
    getSecondRebillsData(websiteId),
    getUsageBeforeRebill2Data(websiteId),
    getSubscriptionsData(websiteId),
    getAdSpendData(websiteId),
    getLtv30dData(websiteId),
    getLtv21dData(websiteId),
    getLtv51dData(websiteId),
    getLtv81dData(websiteId),
    // Utility Model (Phase 9)
    getTrialRevenueData(websiteId),
    getFirstRebillRevenueData(websiteId),
    getRefundsM1Data(websiteId),
  ]);

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

    // Utility Model (Phase 9)
    trialRevenueEur: trialRevenueData?.totalEur ?? 0,
    firstRebillRevenueEur: firstRebillRevenueData?.totalEur ?? 0,
    refundsM1Eur: refundsM1Data?.totalEur ?? 0,
  };

  // Cache the result for this website
  metricsCache.set(websiteId, { data: metrics, cachedAt: Date.now() });
  console.log(`[MetricsCache] Cached fresh metrics for website_id=${websiteId}`);

  return metrics;
}

// ============================================================================
// KPI CALCULATIONS
// ============================================================================

function calculateFRR(firstRebills: number, trials: number): KpiResult {
  if (trials === 0) {
    return { value: 0, status: "red", shortReason: "Sin trials" };
  }

  const frr = firstRebills / trials;
  let status: KpiStatus;
  let shortReason: string;

  if (frr >= THRESHOLDS.FRR_GREEN) {
    status = "green";
    shortReason = `${(frr * 100).toFixed(1)}% - Adquisición de calidad`;
  } else if (frr >= THRESHOLDS.FRR_YELLOW) {
    status = "yellow";
    shortReason = `${(frr * 100).toFixed(1)}% - Calidad en riesgo`;
  } else {
    status = "red";
    shortReason = `${(frr * 100).toFixed(1)}% - Adquisición de baja calidad`;
  }

  return { value: Math.round(frr * 1000) / 1000, status, shortReason };
}

function calculateCPFR(totalAdSpend: number, firstRebills: number): KpiResult {
  if (firstRebills === 0) {
    if (totalAdSpend === 0) {
      return { value: 0, status: "green", shortReason: "Sin gasto en ads" };
    }
    return { value: Infinity, status: "red", shortReason: "Gasto sin rebills" };
  }

  const cpfr = totalAdSpend / firstRebills;
  let status: KpiStatus;
  let shortReason: string;

  if (cpfr <= CPFR_GREEN) {
    status = "green";
    shortReason = `€${cpfr.toFixed(0)} - CAC eficiente`;
  } else if (cpfr <= CPFR_YELLOW) {
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
    return { value: 0, status: "yellow", shortReason: "Sin datos de cohorte" };
  }

  const srr = secondRebills / firstRebillsCohorte30d;
  let status: KpiStatus;
  let shortReason: string;

  if (srr >= THRESHOLDS.SRR_GREEN) {
    status = "green";
    shortReason = `${(srr * 100).toFixed(1)}% - Retención sólida`;
  } else if (srr >= THRESHOLDS.SRR_YELLOW) {
    status = "yellow";
    shortReason = `${(srr * 100).toFixed(1)}% - Retención en riesgo`;
  } else {
    status = "red";
    shortReason = `${(srr * 100).toFixed(1)}% - Retención crítica`;
  }

  return { value: Math.round(srr * 1000) / 1000, status, shortReason };
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
// UTILITY MODEL KPIs (Phase 9)
// El negocio se gana o pierde en M1
// ============================================================================

/**
 * Payback M1 - P1 HEADLINE
 * PaybackM1 = (Trial_Revenue + First_Rebill_Revenue - Refunds_M1) / CPFR
 * Thresholds: ≥1.20 green, 0.90-1.19 yellow, <0.90 red
 */
function calculatePaybackM1(
  trialRevenueEur: number,
  firstRebillRevenueEur: number,
  refundsM1Eur: number,
  cpfr: number
): KpiResult {
  if (cpfr === 0 || cpfr === Infinity) {
    return { value: 0, status: "yellow", shortReason: "Sin datos de CPFR" };
  }

  const m1Revenue = trialRevenueEur + firstRebillRevenueEur - refundsM1Eur;
  const paybackM1 = m1Revenue / cpfr;

  let status: KpiStatus;
  let shortReason: string;

  if (paybackM1 >= THRESHOLDS.PAYBACK_M1_GREEN) {
    status = "green";
    shortReason = `${paybackM1.toFixed(2)}x - Rentable en M1`;
  } else if (paybackM1 >= THRESHOLDS.PAYBACK_M1_YELLOW) {
    status = "yellow";
    shortReason = `${paybackM1.toFixed(2)}x - Break-even en M1`;
  } else {
    status = "red";
    shortReason = `${paybackM1.toFixed(2)}x - Pérdida en M1`;
  }

  return { value: Math.round(paybackM1 * 100) / 100, status, shortReason };
}

/**
 * Refund Rate M1 - P2
 * RefundRateM1 = Refunds_before_M2 / First_Rebills
 * Thresholds: ≤5% green, 5-10% yellow, >10% red
 */
function calculateRefundRateM1(refundsM1Eur: number, firstRebillRevenueEur: number): KpiResult {
  if (firstRebillRevenueEur === 0) {
    return { value: 0, status: "yellow", shortReason: "Sin datos de first rebills" };
  }

  // Calculate as % of first rebill revenue (more meaningful than count)
  const refundRate = refundsM1Eur / firstRebillRevenueEur;

  let status: KpiStatus;
  let shortReason: string;

  if (refundRate <= THRESHOLDS.REFUND_RATE_M1_GREEN) {
    status = "green";
    shortReason = `${(refundRate * 100).toFixed(1)}% - Refunds controlados`;
  } else if (refundRate <= THRESHOLDS.REFUND_RATE_M1_YELLOW) {
    status = "yellow";
    shortReason = `${(refundRate * 100).toFixed(1)}% - Refunds elevados`;
  } else {
    status = "red";
    shortReason = `${(refundRate * 100).toFixed(1)}% - Refunds críticos`;
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
  const cpfr = calculateCPFR(raw.totalAdSpendEur, raw.firstRebills);
  const ltv30d = calculateLtv30d(raw.ltv30d, raw.ltv30dSampleSize);

  // LTV ventanas correctas (Phase 6.1)
  const ltv21d = calculateLtv21d(raw.ltv21d, raw.ltv21dCohortSize);
  const ltv51d = calculateLtv51d(raw.ltv51d, raw.ltv51dCohortSize);
  const ltv81d = raw.ltv81d !== undefined
    ? calculateLtv81d(raw.ltv81d, raw.ltv81dCohortSize ?? 0)
    : undefined;

  // SRR y U-R2 son informativos (no generan alertas)
  const srr = calculateSRR(raw.secondRebills, raw.firstRebillsCohorte30d);
  srr.isInformative = true; // Modelo utility: M2+ bajo es normal

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
    frr: calculateFRR(raw.firstRebills, raw.trials),
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

    // Utility Model KPIs (Phase 9)
    paybackM1: calculatePaybackM1(
      raw.trialRevenueEur,
      raw.firstRebillRevenueEur,
      raw.refundsM1Eur,
      cpfr.value
    ),
    refundRateM1: calculateRefundRateM1(raw.refundsM1Eur, raw.firstRebillRevenueEur),
    cpt: calculateCPT(raw.totalAdSpendEur, raw.trials),
  };
}

// ============================================================================
// BUSINESS STATUS (based on KPI hierarchy)
// ============================================================================

export function determineBusinessStatus(kpis: CoreKpis): BusinessStatus {
  // P1 HEADLINE: Payback M1 is the main decision driver for utility model
  if (kpis.paybackM1.status === "red") {
    return "CRÍTICO";
  }

  // P2: FRR en rojo también es crítico
  if (kpis.frr.status === "red") {
    return "CRÍTICO";
  }

  // P2: CPFR en rojo es crítico
  if (kpis.cpfr.status === "red") {
    return "CRÍTICO";
  }

  // P2: Refund Rate M1 alto es crítico
  if (kpis.refundRateM1.status === "red") {
    return "CRÍTICO";
  }

  // Payback M1 amarillo es riesgo
  if (kpis.paybackM1.status === "yellow") {
    return "EN RIESGO";
  }

  // FRR o CPFR amarillo es riesgo
  if (kpis.frr.status === "yellow" || kpis.cpfr.status === "yellow") {
    return "EN RIESGO";
  }

  // Refund Rate M1 amarillo es riesgo
  if (kpis.refundRateM1.status === "yellow") {
    return "EN RIESGO";
  }

  // Net ROAS red is risk (contexto)
  if (kpis.netRoas.status === "red") {
    return "EN RIESGO";
  }

  // SRR y U-R2 son informativos, no afectan el estado
  // (modelo utility: M2+ bajo es normal)

  return "ESTABLE";
}

// ============================================================================
// ALERTS (SOLO 2 - U-R2 es diagnóstica)
// ============================================================================

export function generateAlerts(kpis: CoreKpis): Alert[] {
  const alerts: Alert[] = [];

  // ALERTA 1: Payback M1 en rojo (HEADLINE - modelo utility)
  if (kpis.paybackM1.status === "red") {
    alerts.push({
      type: "payback_red",
      severity: "critical",
      message: `Payback M1 ${kpis.paybackM1.value.toFixed(2)}x: Pérdida en primer mes. Revisar adquisición urgente.`,
    });
  }

  // ALERTA 2: FRR en rojo
  if (kpis.frr.status === "red") {
    alerts.push({
      type: "frr_red",
      severity: "critical",
      message: "FRR en rojo: Adquisición de baja calidad. Revisar fuentes de tráfico.",
    });
  }

  // ALERTA 3: CPFR en rojo
  if (kpis.cpfr.status === "red") {
    alerts.push({
      type: "cpfr_red",
      severity: "critical",
      message: "CPFR en rojo: Costo de adquisición insostenible. No escalar.",
    });
  }

  // ALERTA 4: Refund Rate M1 alto
  if (kpis.refundRateM1.status === "red") {
    alerts.push({
      type: "refund_m1_red",
      severity: "critical",
      message: `Refund Rate M1 ${(kpis.refundRateM1.value * 100).toFixed(1)}%: Refunds críticos. Revisar calidad de producto/tráfico.`,
    });
  }

  // NOTA: SRR, U-R2, y Payback legacy NO generan alertas (isInformative = true)

  return alerts;
}
