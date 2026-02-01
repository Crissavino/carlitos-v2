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
// DATA FETCHING
// ============================================================================

export async function fetchRawMetrics(): Promise<RawMetrics | null> {
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
  ] = await Promise.all([
    getRevenueData(),
    getTrialsData(),
    getFirstRebillsData(),
    getFirstRebillsCohorte30dData(),
    getSecondRebillsData(),
    getUsageBeforeRebill2Data(),
    getSubscriptionsData(),
    getAdSpendData(),
    getLtv30dData(),
  ]);

  if (!revenueData || !trialsData) {
    return null;
  }

  return {
    period: "LAST_7_DAYS",
    generatedAt: new Date().toISOString(),

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

    // LTV 30 días real
    ltv30d: ltv30dData?.ltv30d ?? 0,
    ltv30dSampleSize: ltv30dData?.sampleSize ?? 0,
  };
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

export function calculateCoreKpis(raw: RawMetrics): CoreKpis {
  const cpfr = calculateCPFR(raw.totalAdSpendEur, raw.firstRebills);
  const ltv30d = calculateLtv30d(raw.ltv30d, raw.ltv30dSampleSize);

  return {
    frr: calculateFRR(raw.firstRebills, raw.trials),
    cpfr,
    srr: calculateSRR(raw.secondRebills, raw.firstRebillsCohorte30d),
    ur2: calculateUR2(raw.usersWithUsageBeforeRebill2, raw.firstRebillsCohorte30d),
    netRoas: calculateNetRoas(raw.netRevenueEur, raw.totalAdSpendEur),
    ltv30d,
    paybackRatio: calculatePaybackRatio(raw.ltv30d, cpfr.value),
  };
}

// ============================================================================
// BUSINESS STATUS (based on KPI hierarchy)
// ============================================================================

export function determineBusinessStatus(kpis: CoreKpis): BusinessStatus {
  // P1: FRR drives main status
  if (kpis.frr.status === "red") {
    return "CRÍTICO";
  }

  // P2: CPFR can make it critical
  if (kpis.cpfr.status === "red") {
    return "CRÍTICO";
  }

  // Payback < 1.0 es crítico (perdiendo dinero en adquisición)
  if (kpis.paybackRatio.status === "red") {
    return "CRÍTICO";
  }

  // P3: SRR red puts in risk
  if (kpis.srr.status === "red") {
    return "EN RIESGO";
  }

  // P1-P2 yellow also means risk
  if (kpis.frr.status === "yellow" || kpis.cpfr.status === "yellow") {
    return "EN RIESGO";
  }

  // Payback yellow (break-even) is also risk
  if (kpis.paybackRatio.status === "yellow") {
    return "EN RIESGO";
  }

  // P5: ROAS red is also risk (but lower priority)
  if (kpis.netRoas.status === "red") {
    return "EN RIESGO";
  }

  // P3-P5 yellow but P1-P2 green = still stable
  return "ESTABLE";
}

// ============================================================================
// ALERTS (SOLO 2 - U-R2 es diagnóstica)
// ============================================================================

export function generateAlerts(kpis: CoreKpis): Alert[] {
  const alerts: Alert[] = [];

  // ALERTA 1: FRR en rojo
  if (kpis.frr.status === "red") {
    alerts.push({
      type: "frr_red",
      severity: "critical",
      message: "FRR en rojo: Adquisición de baja calidad. Revisar fuentes de tráfico.",
    });
  }

  // ALERTA 2: CPFR en rojo
  if (kpis.cpfr.status === "red") {
    alerts.push({
      type: "cpfr_red",
      severity: "critical",
      message: "CPFR en rojo: Costo de adquisición insostenible. No escalar.",
    });
  }

  // ALERTA 3: Payback Ratio en rojo (LTV < CPFR)
  if (kpis.paybackRatio.status === "red") {
    alerts.push({
      type: "payback_red",
      severity: "critical",
      message: `Payback ${kpis.paybackRatio.value.toFixed(2)}x: LTV < CPFR. Cada adquisición genera pérdida.`,
    });
  }

  return alerts;
}
