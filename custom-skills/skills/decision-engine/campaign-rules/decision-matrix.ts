/**
 * Campaign Decision Matrix - Phase 7.5
 *
 * Reglas de decisión a nivel campaña individual.
 * Basadas en Payback_51d como métrica decisora.
 *
 * IMPORTANTE:
 * - Payback_21d: Solo warning, NUNCA pause
 * - Payback_51d: Métrica decisora (PAUSE/SCALE/MAINTAIN)
 * - Requiere campaignAgeDays >= 51 y cohort51dSize >= 10 para decisiones fuertes
 */

import type { CampaignDecisionRule } from "./types.js";

// ============================================================================
// THRESHOLDS
// ============================================================================

const THRESHOLDS = {
  // Payback 51d thresholds
  PAYBACK_51D_SCALE: 1.5,      // >= 1.5x → SCALE
  PAYBACK_51D_MAINTAIN: 1.0,   // >= 1.0x → MAINTAIN (break-even)
  PAYBACK_51D_OPTIMIZE: 0.7,   // >= 0.7x → OPTIMIZE
  PAYBACK_51D_PAUSE: 0.7,      // < 0.7x → PAUSE

  // Payback 21d thresholds (solo warning)
  PAYBACK_21D_WARNING: 0.5,    // < 0.5x → WARNING temprano

  // Requisitos para decisiones
  MIN_AGE_FOR_DECISION: 51,    // Días mínimos para decisión
  MIN_COHORT_FOR_DECISION: 10, // Tamaño mínimo de cohorte
  MIN_SPEND_FOR_ATTENTION: 50, // EUR/semana mínimo para prestar atención
};

// ============================================================================
// CAMPAIGN DECISION RULES
// ============================================================================

export const CAMPAIGN_RULES: CampaignDecisionRule[] = [
  // ============================================================================
  // REGLAS DE PAUSE (Payback 51d < 0.7, datos maduros)
  // ============================================================================

  {
    id: "campaign-pause-critical",
    name: "PAUSE - Pérdida Confirmada",
    description: "Payback 51d < 0.7 con datos maduros. Cada adquisición destruye valor.",
    condition: (c) =>
      c.campaignAgeDays >= THRESHOLDS.MIN_AGE_FOR_DECISION &&
      c.cohort51dSize >= THRESHOLDS.MIN_COHORT_FOR_DECISION &&
      c.payback51d > 0 &&
      c.payback51d < THRESHOLDS.PAYBACK_51D_PAUSE &&
      c.status === "ENABLED",
    action: {
      type: "pause",
      urgency: "immediate",
      template: "PAUSE {campaignName}: Payback 51d = {payback51d}x (< 0.7). Spend €{spend7d}/sem destruye valor.",
      rationale: "Con 51+ días de datos y cohorte >= 10, el LTV real no cubre el CPFR. Continuar quema presupuesto.",
    },
    priority: 1,
  },

  // ============================================================================
  // REGLAS DE SCALE (Payback 51d >= 1.5, datos maduros)
  // ============================================================================

  {
    id: "campaign-scale-ready",
    name: "SCALE - Rentabilidad Confirmada",
    description: "Payback 51d >= 1.5 con datos maduros. Rentabilidad demostrada.",
    condition: (c) =>
      c.campaignAgeDays >= THRESHOLDS.MIN_AGE_FOR_DECISION &&
      c.cohort51dSize >= THRESHOLDS.MIN_COHORT_FOR_DECISION &&
      c.payback51d >= THRESHOLDS.PAYBACK_51D_SCALE &&
      c.status === "ENABLED",
    action: {
      type: "scale",
      urgency: "this_week",
      template: "SCALE {campaignName}: Payback 51d = {payback51d}x (>= 1.5). OK para +20% budget.",
      rationale: "Con rentabilidad 1.5x+ confirmada en cohorte madura, incrementar spend genera valor.",
    },
    priority: 2,
  },

  // ============================================================================
  // REGLAS DE OPTIMIZE (Payback 51d entre 0.7-1.0)
  // ============================================================================

  {
    id: "campaign-optimize-marginal",
    name: "OPTIMIZE - Margen Ajustado",
    description: "Payback 51d entre 0.7-1.0. No pausar, pero optimizar.",
    condition: (c) =>
      c.campaignAgeDays >= THRESHOLDS.MIN_AGE_FOR_DECISION &&
      c.cohort51dSize >= THRESHOLDS.MIN_COHORT_FOR_DECISION &&
      c.payback51d >= THRESHOLDS.PAYBACK_51D_OPTIMIZE &&
      c.payback51d < THRESHOLDS.PAYBACK_51D_MAINTAIN &&
      c.status === "ENABLED",
    action: {
      type: "optimize",
      urgency: "this_week",
      template: "OPTIMIZE {campaignName}: Payback 51d = {payback51d}x. Revisar targeting/bids.",
      rationale: "Margen ajustado pero no negativo. Optimizar keywords, audiences o bids antes de pausar.",
    },
    priority: 3,
  },

  // ============================================================================
  // REGLAS DE MAINTAIN (Payback 51d entre 1.0-1.5)
  // ============================================================================

  {
    id: "campaign-maintain-breakeven",
    name: "MAINTAIN - Break-even",
    description: "Payback 51d entre 1.0-1.5. Mantener sin escalar.",
    condition: (c) =>
      c.campaignAgeDays >= THRESHOLDS.MIN_AGE_FOR_DECISION &&
      c.cohort51dSize >= THRESHOLDS.MIN_COHORT_FOR_DECISION &&
      c.payback51d >= THRESHOLDS.PAYBACK_51D_MAINTAIN &&
      c.payback51d < THRESHOLDS.PAYBACK_51D_SCALE &&
      c.status === "ENABLED",
    action: {
      type: "maintain",
      urgency: "next_review",
      template: "MAINTAIN {campaignName}: Payback 51d = {payback51d}x. Break-even, no escalar aún.",
      rationale: "Campaña rentable pero no excepcional. Mantener budget actual y monitorear.",
    },
    priority: 4,
  },

  // ============================================================================
  // REGLAS DE MONITOR (datos insuficientes)
  // ============================================================================

  {
    id: "campaign-monitor-young",
    name: "MONITOR - Campaña Joven",
    description: "Campaña con menos de 51 días. Esperar datos maduros.",
    condition: (c) =>
      c.campaignAgeDays < THRESHOLDS.MIN_AGE_FOR_DECISION &&
      c.campaignAgeDays > 0 &&
      c.status === "ENABLED",
    action: {
      type: "monitor",
      urgency: "next_review",
      template: "MONITOR {campaignName}: Solo {campaignAgeDays}d de edad. Faltan {daysToMature}d para decisión.",
      rationale: "Sin datos de 51 días, el LTV aún no es confiable. No tomar decisiones fuertes.",
    },
    priority: 5,
  },

  {
    id: "campaign-monitor-small-cohort",
    name: "MONITOR - Cohorte Pequeña",
    description: "Campaña madura pero con pocos customers atribuidos.",
    condition: (c) =>
      c.campaignAgeDays >= THRESHOLDS.MIN_AGE_FOR_DECISION &&
      c.cohort51dSize < THRESHOLDS.MIN_COHORT_FOR_DECISION &&
      c.cohort51dSize > 0 &&
      c.status === "ENABLED",
    action: {
      type: "monitor",
      urgency: "next_review",
      template: "MONITOR {campaignName}: Cohorte 51d = {cohort51dSize} (< 10). Muestra no significativa.",
      rationale: "Con menos de 10 customers maduros, los datos no son estadísticamente significativos.",
    },
    priority: 5,
  },

  // ============================================================================
  // WARNING TEMPRANO (Payback 21d bajo, pero NO pause)
  // ============================================================================

  {
    id: "campaign-warning-21d",
    name: "WARNING - Payback 21d Bajo",
    description: "Payback 21d < 0.5. Warning temprano, NUNCA pause por esto.",
    condition: (c) =>
      c.campaignAgeDays >= 21 &&
      c.campaignAgeDays < THRESHOLDS.MIN_AGE_FOR_DECISION &&
      c.payback21d > 0 &&
      c.payback21d < THRESHOLDS.PAYBACK_21D_WARNING &&
      c.status === "ENABLED",
    action: {
      type: "monitor",
      urgency: "next_review",
      template: "WARNING {campaignName}: Payback 21d = {payback21d}x (< 0.5). Observar, NO pausar.",
      rationale: "Señal temprana de posible problema. Pero Payback 21d NO es métrica decisora. Esperar 51d.",
    },
    priority: 6,
  },
];

export function getCampaignRules(): CampaignDecisionRule[] {
  return CAMPAIGN_RULES;
}

export { THRESHOLDS };
