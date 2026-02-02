/**
 * Executive Summary Reporter
 *
 * Genera un resumen ejecutivo tipo CFO: corto, directo, accionable.
 * Máximo 6-8 líneas.
 */

import { fetchRawMetrics, calculateCoreKpis, determineBusinessStatus, generateAlerts } from "../analyzers/cross-analyzer.js";
import { ExecutiveSummary, CoreKpis, BusinessStatus, KpiStatus } from "../types.js";
import { audit } from "../../../core/audit.js";

/**
 * Generate executive summary for a specific website
 * HARDENING: websiteId is REQUIRED - no global summaries allowed
 */
export async function generateExecutiveSummary(websiteId: number): Promise<ExecutiveSummary | null> {
  if (!websiteId) {
    throw new Error('WEBSITE_ID_REQUIRED: generateExecutiveSummary requires websiteId. Global summaries are disabled.');
  }

  const startTime = Date.now();

  await audit.log({
    skill: "business-expert",
    action: "summary_start",
    input: { type: "executive-summary", websiteId },
    output: null,
    queries: [],
  });

  try {
    const raw = await fetchRawMetrics(websiteId);

    if (!raw) {
      await audit.log({
        skill: "business-expert",
        action: "summary_error",
        input: { type: "executive-summary" },
        output: { error: "Failed to fetch metrics" },
        queries: [],
      });
      return null;
    }

    const kpis = calculateCoreKpis(raw);
    const businessStatus = determineBusinessStatus(kpis);
    const alerts = generateAlerts(kpis);

    const summary: ExecutiveSummary = {
      period: raw.period,
      generatedAt: raw.generatedAt,
      businessStatus,
      grossRevenueEur: raw.subscriptionEur,
      netRevenueEur: raw.netRevenueEur,
      adSpendEur: raw.totalAdSpendEur,
      acquisitionData: {
        trials: raw.trials,
        firstRebills: raw.firstRebills,
      },
      refundsM1Total: raw.refundsEur,
      kpis,
      alerts,
      summaryText: buildSummaryText(raw, kpis, businessStatus),
    };

    const executionTimeMs = Date.now() - startTime;

    await audit.log({
      skill: "business-expert",
      action: "summary_success",
      input: { type: "executive-summary" },
      output: {
        executionTimeMs,
        businessStatus,
        alertsCount: alerts.length,
        kpiStatuses: {
          frr: kpis.frr.status,
          cpfr: kpis.cpfr.status,
          srr: kpis.srr.status,
          ur2: kpis.ur2.status,
          netRoas: kpis.netRoas.status,
        },
      },
      queries: [],
    });

    return summary;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error";

    await audit.log({
      skill: "business-expert",
      action: "summary_error",
      input: { type: "executive-summary" },
      output: { error: errorMsg },
      queries: [],
    });

    return null;
  }
}

// ============================================================================
// SUMMARY TEXT BUILDER
// ============================================================================

interface RawMetricsForText {
  period: string;
  netRevenueEur: number;
  totalAdSpendEur: number;
  trials: number;
  firstRebills: number;
  firstRebillsCohorte30d: number;
  secondRebills: number;
}

function buildSummaryText(
  raw: RawMetricsForText,
  kpis: CoreKpis,
  status: BusinessStatus
): string {
  const lines: string[] = [];

  // Línea 1: Estado general
  const periodText = raw.period === "LAST_7_DAYS" ? "los últimos 7 días" : "los últimos 30 días";
  lines.push(`En ${periodText}, el negocio está ${status}.`);

  // Línea 2: Revenue y Ads
  lines.push(
    `Revenue neto: €${raw.netRevenueEur.toLocaleString()} | Ad Spend: €${raw.totalAdSpendEur.toLocaleString()}`
  );

  // Línea 3: Net ROAS con color
  const roasColor = statusToText(kpis.netRoas.status);
  lines.push(`Net ROAS: ${kpis.netRoas.value.toFixed(2)}x (${roasColor})`);

  // Línea 4: FRR y CPFR
  lines.push(
    `FRR: ${(kpis.frr.value * 100).toFixed(1)}% (${statusToText(kpis.frr.status)}) | CPFR: €${kpis.cpfr.value.toFixed(0)} (${statusToText(kpis.cpfr.status)})`
  );

  // Línea 5: SRR (con nota de cohorte)
  lines.push(
    `SRR: ${(kpis.srr.value * 100).toFixed(1)}% (${statusToText(kpis.srr.status)}) [${raw.secondRebills}/${raw.firstRebillsCohorte30d} cohorte 30d]`
  );

  // Línea 6: Insight principal
  const insight = generateMainInsight(kpis, raw);
  if (insight) {
    lines.push(insight);
  }

  // Línea 7: Recomendación
  const recommendation = generateRecommendation(kpis, status);
  lines.push(`Recomendación: ${recommendation}`);

  return lines.join("\n");
}

function statusToText(status: KpiStatus): string {
  switch (status) {
    case "green":
      return "verde";
    case "yellow":
      return "amarillo";
    case "red":
      return "rojo";
  }
}

function generateMainInsight(kpis: CoreKpis, raw: RawMetricsForText): string | null {
  // Prioridad: FRR > CPFR > SRR > ROAS
  if (kpis.frr.status === "red") {
    return `Riesgo: solo ${(kpis.frr.value * 100).toFixed(1)}% de trials convierten a pago.`;
  }
  if (kpis.cpfr.status === "red") {
    return `Riesgo: costo de adquisición (€${kpis.cpfr.value.toFixed(0)}) supera límite sostenible.`;
  }
  if (kpis.srr.status === "red") {
    return `Riesgo: retención al segundo mes (${(kpis.srr.value * 100).toFixed(1)}%) por debajo del objetivo.`;
  }
  if (kpis.frr.status === "yellow") {
    return `Atención: FRR en ${(kpis.frr.value * 100).toFixed(1)}% indica deterioro de calidad.`;
  }
  if (kpis.netRoas.status === "green" && kpis.frr.status === "green") {
    return `Métricas saludables. ${raw.firstRebills} first rebills de ${raw.trials} trials.`;
  }
  return null;
}

function generateRecommendation(kpis: CoreKpis, status: BusinessStatus): string {
  if (status === "CRÍTICO") {
    if (kpis.frr.status === "red") {
      return "Revisar fuentes de adquisición y pausar campañas de baja calidad.";
    }
    if (kpis.cpfr.status === "red") {
      return "Reducir presupuesto de ads hasta mejorar eficiencia de conversión.";
    }
    return "Auditar funnel completo antes de incrementar inversión.";
  }

  if (status === "EN RIESGO") {
    if (kpis.srr.status === "red") {
      return "Investigar causas de baja retención al segundo mes.";
    }
    if (kpis.frr.status === "yellow") {
      return "Monitorear calidad de adquisición antes de escalar.";
    }
    if (kpis.netRoas.status === "red") {
      return "Optimizar campañas o reducir spend hasta mejorar ROAS.";
    }
    return "Mantener presupuesto actual y optimizar antes de escalar.";
  }

  return "Métricas permiten considerar incremento controlado de inversión.";
}

// ============================================================================
// TEXT FORMATTER
// ============================================================================

export function formatSummaryAsText(summary: ExecutiveSummary): string {
  const lines: string[] = [];

  lines.push("═══════════════════════════════════════════════════");
  lines.push("     ESTADO DEL NEGOCIO – ÚLTIMOS 7 DÍAS");
  lines.push("═══════════════════════════════════════════════════");
  lines.push("");
  lines.push(summary.summaryText);
  lines.push("");

  if (summary.alerts.length > 0) {
    lines.push("───────────────────────────────────────────────────");
    lines.push("ALERTAS CRÍTICAS:");
    for (const alert of summary.alerts) {
      lines.push(`  🔴 ${alert.message}`);
    }
    lines.push("");
  }

  lines.push("───────────────────────────────────────────────────");
  lines.push(`Generado: ${summary.generatedAt}`);

  return lines.join("\n");
}
