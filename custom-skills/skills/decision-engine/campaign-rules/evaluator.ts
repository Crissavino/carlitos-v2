/**
 * Campaign Rule Evaluator - Phase 7.5
 *
 * Evalúa reglas de decisión contra cada campaña individual.
 * Genera recomendaciones ordenadas por urgencia e impacto.
 */

import type { CampaignMetrics } from "../../business-expert/analyzers/campaign-analyzer.js";
import type {
  CampaignDecision,
  CampaignDecisionSummary,
  DecisionConfidence,
} from "./types.js";
import { URGENCY_ORDER } from "./types.js";
import { getCampaignRules, THRESHOLDS } from "./decision-matrix.js";
import { getCampaignPerformance } from "../../business-expert/analyzers/campaign-analyzer.js";

// ============================================================================
// MAIN EVALUATOR
// ============================================================================

/**
 * Evalúa todas las campañas y genera decisiones
 */
export async function evaluateCampaignRules(): Promise<CampaignDecisionSummary | null> {
  const performanceData = await getCampaignPerformance();
  if (!performanceData || performanceData.campaigns.length === 0) {
    return null;
  }

  const rules = getCampaignRules();
  const decisions: CampaignDecision[] = [];

  // Evaluar cada campaña
  for (const campaign of performanceData.campaigns) {
    // Encontrar la primera regla que aplica (ordenadas por prioridad)
    const sortedRules = [...rules].sort((a, b) => a.priority - b.priority);

    for (const rule of sortedRules) {
      if (rule.condition(campaign)) {
        decisions.push(createCampaignDecision(campaign, rule));
        break; // Solo una decisión por campaña
      }
    }
  }

  // Ordenar decisiones por urgencia y spend
  decisions.sort((a, b) => {
    const urgencyDiff = URGENCY_ORDER[a.urgency] - URGENCY_ORDER[b.urgency];
    if (urgencyDiff !== 0) return urgencyDiff;
    return b.metrics.spend7d - a.metrics.spend7d; // Mayor spend primero
  });

  // Calcular conteos y métricas de impacto
  const actionCounts = {
    pause: 0,
    scale: 0,
    optimize: 0,
    monitor: 0,
    maintain: 0,
  };

  let spendToPause = 0;
  let spendToScale = 0;
  let campaignsNeedingAction = 0;

  for (const d of decisions) {
    actionCounts[d.action]++;

    if (d.action === "pause") {
      spendToPause += d.metrics.spend7d;
      campaignsNeedingAction++;
    } else if (d.action === "scale") {
      spendToScale += d.metrics.spend7d;
      campaignsNeedingAction++;
    } else if (d.action === "optimize") {
      campaignsNeedingAction++;
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    totalCampaigns: performanceData.totalCampaigns,
    campaignsAnalyzed: decisions.length,
    actionCounts,
    impact: {
      spendToPause: Math.round(spendToPause * 100) / 100,
      spendToScale: Math.round(spendToScale * 100) / 100,
      campaignsNeedingAction,
    },
    decisions,
    topActions: decisions
      .filter(d => d.action !== "maintain" && d.action !== "monitor")
      .slice(0, 5),
  };
}

// ============================================================================
// DECISION CREATION
// ============================================================================

function createCampaignDecision(
  campaign: CampaignMetrics,
  rule: ReturnType<typeof getCampaignRules>[0]
): CampaignDecision {
  // Determinar confianza
  const { confidence, reason } = calculateConfidence(campaign);

  // Aplicar template
  const actionText = applyTemplate(rule.action.template, campaign);

  return {
    campaignId: campaign.campaignId,
    campaignName: campaign.campaignName,
    ruleId: rule.id,
    ruleName: rule.name,
    action: rule.action.type,
    urgency: rule.action.urgency,
    actionText,
    rationale: rule.action.rationale,
    metrics: {
      spend7d: campaign.spend7d,
      payback21d: campaign.payback21d,
      payback51d: campaign.payback51d,
      campaignAgeDays: campaign.campaignAgeDays,
      cohort51dSize: campaign.cohort51dSize,
      cpfr: campaign.cpfr,
      ltv51d: campaign.ltv51d,
    },
    confidence,
    confidenceReason: reason,
  };
}

function calculateConfidence(
  campaign: CampaignMetrics
): { confidence: DecisionConfidence; reason: string } {
  // Alta confianza: edad >= 51d y cohorte >= 30
  if (
    campaign.campaignAgeDays >= THRESHOLDS.MIN_AGE_FOR_DECISION &&
    campaign.cohort51dSize >= 30
  ) {
    return {
      confidence: "high",
      reason: `Datos maduros (${campaign.campaignAgeDays}d) y cohorte grande (n=${campaign.cohort51dSize})`,
    };
  }

  // Media confianza: edad >= 51d y cohorte >= 10
  if (
    campaign.campaignAgeDays >= THRESHOLDS.MIN_AGE_FOR_DECISION &&
    campaign.cohort51dSize >= THRESHOLDS.MIN_COHORT_FOR_DECISION
  ) {
    return {
      confidence: "medium",
      reason: `Datos maduros (${campaign.campaignAgeDays}d), cohorte mínima (n=${campaign.cohort51dSize})`,
    };
  }

  // Baja confianza: datos insuficientes
  return {
    confidence: "low",
    reason: campaign.campaignAgeDays < THRESHOLDS.MIN_AGE_FOR_DECISION
      ? `Campaña joven (${campaign.campaignAgeDays}d < 51d)`
      : `Cohorte pequeña (n=${campaign.cohort51dSize} < 10)`,
  };
}

function applyTemplate(template: string, campaign: CampaignMetrics): string {
  const daysToMature = Math.max(0, THRESHOLDS.MIN_AGE_FOR_DECISION - campaign.campaignAgeDays);

  return template
    .replace("{campaignName}", campaign.campaignName)
    .replace("{campaignId}", campaign.campaignId)
    .replace("{spend7d}", campaign.spend7d.toFixed(0))
    .replace("{payback21d}", campaign.payback21d.toFixed(2))
    .replace("{payback51d}", campaign.payback51d.toFixed(2))
    .replace("{campaignAgeDays}", String(campaign.campaignAgeDays))
    .replace("{cohort51dSize}", String(campaign.cohort51dSize))
    .replace("{cpfr}", campaign.cpfr.toFixed(0))
    .replace("{ltv51d}", campaign.ltv51d.toFixed(0))
    .replace("{daysToMature}", String(daysToMature));
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Obtiene solo las campañas que requieren acción (pause, scale, optimize)
 */
export async function getCampaignsNeedingAction(): Promise<CampaignDecision[]> {
  const summary = await evaluateCampaignRules();
  if (!summary) return [];

  return summary.decisions.filter(
    d => d.action === "pause" || d.action === "scale" || d.action === "optimize"
  );
}

/**
 * Obtiene campañas para pausar ordenadas por spend (mayor impacto primero)
 */
export async function getCampaignsToPauseByImpact(): Promise<CampaignDecision[]> {
  const summary = await evaluateCampaignRules();
  if (!summary) return [];

  return summary.decisions
    .filter(d => d.action === "pause")
    .sort((a, b) => b.metrics.spend7d - a.metrics.spend7d);
}

/**
 * Obtiene campañas para escalar ordenadas por Payback (más rentables primero)
 */
export async function getCampaignsToScaleByPayback(): Promise<CampaignDecision[]> {
  const summary = await evaluateCampaignRules();
  if (!summary) return [];

  return summary.decisions
    .filter(d => d.action === "scale")
    .sort((a, b) => b.metrics.payback51d - a.metrics.payback51d);
}

/**
 * Genera un resumen ejecutivo de decisiones de campaña
 */
export async function getCampaignDecisionsSummaryText(): Promise<string | null> {
  const summary = await evaluateCampaignRules();
  if (!summary) return null;

  const lines: string[] = [
    `## Campaign Decisions (${new Date().toLocaleDateString()})`,
    "",
    `Campañas analizadas: ${summary.campaignsAnalyzed}`,
    "",
    "### Resumen de Acciones",
    `- PAUSE: ${summary.actionCounts.pause} (€${summary.impact.spendToPause}/sem)`,
    `- SCALE: ${summary.actionCounts.scale} (€${summary.impact.spendToScale}/sem potencial)`,
    `- OPTIMIZE: ${summary.actionCounts.optimize}`,
    `- MAINTAIN: ${summary.actionCounts.maintain}`,
    `- MONITOR: ${summary.actionCounts.monitor}`,
  ];

  if (summary.topActions.length > 0) {
    lines.push("", "### Top Acciones");
    for (const action of summary.topActions) {
      const icon = action.action === "pause" ? "⏸️" :
                   action.action === "scale" ? "📈" : "⚡";
      lines.push(`${icon} ${action.actionText}`);
    }
  }

  return lines.join("\n");
}
