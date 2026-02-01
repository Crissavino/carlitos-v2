/**
 * Weekly Decision Report
 *
 * Genera el reporte semanal de decisiones basado en KPIs.
 */

import { fetchRawMetrics, calculateCoreKpis, determineBusinessStatus } from "../../business-expert/analyzers/cross-analyzer.js";
import { CoreKpis, BusinessStatus } from "../../business-expert/types.js";
import { WeeklyDecisionReport, TriggeredDecision, DECISION_ICONS, PRIORITY_ICONS } from "../types.js";
import { evaluateRules, getTopActions } from "../rules/evaluator.js";
import { audit } from "../../../core/audit.js";

/**
 * Genera el reporte semanal de decisiones
 */
export async function generateWeeklyReport(): Promise<WeeklyDecisionReport | null> {
  const startTime = Date.now();

  await audit.log({
    skill: "decision-engine",
    action: "report_start",
    input: { type: "weekly-report" },
    output: null,
    queries: [],
  });

  try {
    // Obtener métricas de BusinessExpert
    const raw = await fetchRawMetrics();
    if (!raw) {
      await audit.log({
        skill: "decision-engine",
        action: "report_error",
        input: { type: "weekly-report" },
        output: { error: "Failed to fetch metrics" },
        queries: [],
      });
      return null;
    }

    const kpis = calculateCoreKpis(raw);
    const businessStatus = determineBusinessStatus(kpis);

    // Evaluar reglas de decisión
    const allDecisions = evaluateRules(kpis);
    const topDecisions = getTopActions(allDecisions, 5);

    // Calcular semana del año
    const now = new Date();
    const weekNumber = getWeekNumber(now);
    const year = now.getFullYear();

    // Calcular próxima revisión (7 días)
    const nextReview = new Date(now);
    nextReview.setDate(nextReview.getDate() + 7);

    const report: WeeklyDecisionReport = {
      weekNumber,
      year,
      generatedAt: now.toISOString(),
      businessStatus,
      kpiSummary: {
        frr: { value: kpis.frr.value, status: kpis.frr.status },
        cpfr: { value: kpis.cpfr.value, status: kpis.cpfr.status },
        srr: { value: kpis.srr.value, status: kpis.srr.status },
        ur2: { value: kpis.ur2.value, status: kpis.ur2.status },
        netRoas: { value: kpis.netRoas.value, status: kpis.netRoas.status },
        ltv30d: { value: kpis.ltv30d.value, status: kpis.ltv30d.status },
        paybackRatio: { value: kpis.paybackRatio.value, status: kpis.paybackRatio.status },
      },
      decisions: topDecisions,
      actions: topDecisions.map((d) => d.action),
      nextReviewDate: nextReview.toISOString().split("T")[0],
    };

    const executionTimeMs = Date.now() - startTime;

    await audit.log({
      skill: "decision-engine",
      action: "report_success",
      input: { type: "weekly-report" },
      output: {
        executionTimeMs,
        businessStatus,
        decisionsCount: topDecisions.length,
        decisions: topDecisions.map((d) => ({
          ruleId: d.ruleId,
          type: d.type,
          priority: d.priority,
        })),
      },
      queries: [],
    });

    return report;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error";

    await audit.log({
      skill: "decision-engine",
      action: "report_error",
      input: { type: "weekly-report" },
      output: { error: errorMsg },
      queries: [],
    });

    return null;
  }
}

/**
 * Formatea el reporte como texto
 */
export function formatReportAsText(report: WeeklyDecisionReport): string {
  const lines: string[] = [];

  // Header
  lines.push("═══════════════════════════════════════════════════");
  lines.push(`   DECISIONES RECOMENDADAS – SEMANA ${report.weekNumber}/${report.year}`);
  lines.push("═══════════════════════════════════════════════════");
  lines.push("");

  // Estado general
  const statusIcon = getStatusIcon(report.businessStatus);
  lines.push(`Estado del negocio: ${statusIcon} ${report.businessStatus}`);
  lines.push("");

  // KPIs resumen
  lines.push("KPIs:");
  lines.push(formatKpiLine("FRR", report.kpiSummary.frr, (v) => `${(v * 100).toFixed(1)}%`));
  lines.push(formatKpiLine("CPFR", report.kpiSummary.cpfr, (v) => `€${v.toFixed(0)}`));
  lines.push(formatKpiLine("SRR", report.kpiSummary.srr, (v) => `${(v * 100).toFixed(1)}%`));
  lines.push(formatKpiLine("Net ROAS", report.kpiSummary.netRoas, (v) => `${v.toFixed(2)}x`));
  lines.push(formatKpiLine("LTV 30d", report.kpiSummary.ltv30d, (v) => `€${v.toFixed(0)}`));
  lines.push(formatKpiLine("Payback", report.kpiSummary.paybackRatio, (v) => `${v.toFixed(2)}x`));
  lines.push("");

  // Decisiones
  lines.push("───────────────────────────────────────────────────");
  lines.push("ACCIONES RECOMENDADAS:");
  lines.push("");

  if (report.decisions.length === 0) {
    lines.push("  ✅ Sin acciones pendientes. Operación normal.");
  } else {
    for (let i = 0; i < report.decisions.length; i++) {
      const d = report.decisions[i];
      const icon = DECISION_ICONS[d.type];
      const priorityIcon = PRIORITY_ICONS[d.priority];

      lines.push(`${i + 1}. ${icon} ${d.action}`);
      lines.push(`   ${priorityIcon} Prioridad: ${d.priority.toUpperCase()}`);
      lines.push(`   📊 KPIs: ${formatTriggerKpis(d)}`);
      lines.push(`   💡 ${d.rationale}`);
      lines.push("");
    }
  }

  // Footer
  lines.push("───────────────────────────────────────────────────");
  lines.push(`Próxima revisión: ${report.nextReviewDate}`);
  lines.push(`Generado: ${report.generatedAt}`);

  return lines.join("\n");
}

// ============================================================================
// HELPERS
// ============================================================================

function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

function getStatusIcon(status: BusinessStatus): string {
  switch (status) {
    case "ESTABLE":
      return "🟢";
    case "EN RIESGO":
      return "🟡";
    case "CRÍTICO":
      return "🔴";
  }
}

function getStatusColor(status: string): string {
  switch (status) {
    case "green":
      return "🟢";
    case "yellow":
      return "🟡";
    case "red":
      return "🔴";
    default:
      return "⚪";
  }
}

function formatKpiLine(
  name: string,
  kpi: { value: number; status: string },
  formatter: (v: number) => string
): string {
  const icon = getStatusColor(kpi.status);
  return `  ${icon} ${name}: ${formatter(kpi.value)}`;
}

function formatTriggerKpis(decision: TriggeredDecision): string {
  return decision.triggerKpis
    .map((kpiName) => {
      const kpi = decision.kpiValues[kpiName];
      if (!kpi) return kpiName.toUpperCase();

      let formatted: string;
      if (kpiName === "frr" || kpiName === "srr" || kpiName === "ur2") {
        formatted = `${(kpi.value * 100).toFixed(1)}%`;
      } else if (kpiName === "cpfr" || kpiName === "ltv30d") {
        formatted = `€${kpi.value.toFixed(0)}`;
      } else {
        formatted = `${kpi.value.toFixed(2)}x`;
      }

      return `${kpiName.toUpperCase()}=${formatted} (${kpi.status})`;
    })
    .join(", ");
}
