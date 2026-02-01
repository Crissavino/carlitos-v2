/**
 * Campaign Decision Types - Phase 7.5
 *
 * Tipos para decisiones a nivel campaña individual.
 * Complementa las decisiones de negocio agregadas.
 */

import type { CampaignMetrics } from "../../business-expert/analyzers/campaign-analyzer.js";

// ============================================================================
// CAMPAIGN DECISION TYPES
// ============================================================================

/**
 * Tipo de acción para campaña
 * - pause: Pausar campaña (Payback < 0.7)
 * - scale: Aumentar budget (Payback >= 1.5)
 * - optimize: Ajustar targeting/bids (Payback 0.7-1.0)
 * - monitor: Solo observar (datos insuficientes)
 * - maintain: Mantener actual (break-even)
 */
export type CampaignActionType = "pause" | "scale" | "optimize" | "monitor" | "maintain";

/**
 * Urgencia de la acción
 * - immediate: Actuar hoy
 * - this_week: Actuar esta semana
 * - next_review: En próxima revisión semanal
 */
export type CampaignActionUrgency = "immediate" | "this_week" | "next_review";

/**
 * Confianza en la decisión (basada en tamaño de cohorte y edad)
 */
export type DecisionConfidence = "high" | "medium" | "low";

// ============================================================================
// CAMPAIGN DECISION RULE
// ============================================================================

export interface CampaignDecisionRule {
  id: string;
  name: string;
  description: string;

  /**
   * Condición para activar la regla
   */
  condition: (campaign: CampaignMetrics) => boolean;

  /**
   * Acción a tomar si la condición se cumple
   */
  action: {
    type: CampaignActionType;
    urgency: CampaignActionUrgency;
    template: string; // Template con {campaignName}, {payback51d}, etc.
    rationale: string;
  };

  /**
   * Prioridad (menor = más importante)
   */
  priority: number;
}

// ============================================================================
// TRIGGERED CAMPAIGN DECISION
// ============================================================================

export interface CampaignDecision {
  campaignId: string;
  campaignName: string;
  ruleId: string;
  ruleName: string;

  action: CampaignActionType;
  urgency: CampaignActionUrgency;
  actionText: string;
  rationale: string;

  /**
   * Métricas que dispararon la decisión
   */
  metrics: {
    spend7d: number;
    payback21d: number;
    payback51d: number;
    campaignAgeDays: number;
    cohort51dSize: number;
    cpfr: number;
    ltv51d: number;
  };

  /**
   * Confianza en la decisión
   */
  confidence: DecisionConfidence;
  confidenceReason: string;
}

// ============================================================================
// CAMPAIGN DECISION SUMMARY
// ============================================================================

export interface CampaignDecisionSummary {
  generatedAt: string;
  totalCampaigns: number;
  campaignsAnalyzed: number;

  /**
   * Conteos por tipo de acción
   */
  actionCounts: {
    pause: number;
    scale: number;
    optimize: number;
    monitor: number;
    maintain: number;
  };

  /**
   * Impacto estimado
   */
  impact: {
    spendToPause: number;      // EUR/semana
    spendToScale: number;      // EUR/semana potencial
    campaignsNeedingAction: number;
  };

  /**
   * Todas las decisiones ordenadas por urgencia
   */
  decisions: CampaignDecision[];

  /**
   * Top acciones (máximo 5)
   */
  topActions: CampaignDecision[];
}

// ============================================================================
// URGENCY ORDER
// ============================================================================

export const URGENCY_ORDER: Record<CampaignActionUrgency, number> = {
  immediate: 1,
  this_week: 2,
  next_review: 3,
};

export const ACTION_ICONS: Record<CampaignActionType, string> = {
  pause: "⏸️",
  scale: "📈",
  optimize: "⚡",
  monitor: "👁️",
  maintain: "✅",
};

export const URGENCY_LABELS: Record<CampaignActionUrgency, string> = {
  immediate: "Acción Inmediata",
  this_week: "Esta Semana",
  next_review: "Próxima Revisión",
};
