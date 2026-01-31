/**
 * Decision Engine - Types
 *
 * Sistema de decisiones basado en KPIs.
 * Traduce estado del negocio en acciones concretas.
 */

import { KpiStatus, BusinessStatus, CoreKpis } from "../business-expert/types.js";

// ============================================================================
// DECISION TYPES
// ============================================================================

/**
 * Tipo de decisión
 * - freeze: Pausar/detener algo (acción fuerte)
 * - block: No permitir algo (bloqueo)
 * - ready: Listo para acción positiva
 * - diagnose: Requiere investigación
 * - optimize: Ajustar/mejorar algo existente
 * - monitor: Solo observar, sin acción
 */
export type DecisionType = "freeze" | "block" | "ready" | "diagnose" | "optimize" | "monitor";

/**
 * Prioridad de la decisión
 * - critical: Acción inmediata requerida
 * - high: Acción esta semana
 * - medium: Considerar próxima semana
 * - low: Informativo
 */
export type DecisionPriority = "critical" | "high" | "medium" | "low";

/**
 * Área afectada por la decisión
 */
export type DecisionArea = "ads" | "onboarding" | "retention" | "pricing" | "product";

// ============================================================================
// DECISION RULE
// ============================================================================

export interface DecisionRule {
  id: string;
  name: string;
  description: string;

  /**
   * Condición para activar la regla
   * Función que recibe los KPIs y retorna true si la regla aplica
   */
  condition: (kpis: CoreKpis) => boolean;

  /**
   * Decisión a tomar si la condición se cumple
   */
  decision: {
    type: DecisionType;
    priority: DecisionPriority;
    area: DecisionArea;
    action: string;
    rationale: string;
    reversible: boolean;
  };

  /**
   * KPIs que disparan esta regla (para explicabilidad)
   */
  triggerKpis: Array<"frr" | "cpfr" | "srr" | "ur2" | "netRoas">;
}

// ============================================================================
// TRIGGERED DECISION
// ============================================================================

export interface TriggeredDecision {
  ruleId: string;
  ruleName: string;
  type: DecisionType;
  priority: DecisionPriority;
  area: DecisionArea;
  action: string;
  rationale: string;
  reversible: boolean;
  triggerKpis: string[];

  /**
   * Valores de KPIs que dispararon la decisión
   */
  kpiValues: Record<string, { value: number; status: KpiStatus }>;
}

// ============================================================================
// WEEKLY REPORT
// ============================================================================

export interface WeeklyDecisionReport {
  weekNumber: number;
  year: number;
  generatedAt: string;

  /**
   * Estado general del negocio
   */
  businessStatus: BusinessStatus;

  /**
   * Resumen de KPIs
   */
  kpiSummary: {
    frr: { value: number; status: KpiStatus };
    cpfr: { value: number; status: KpiStatus };
    srr: { value: number; status: KpiStatus };
    ur2: { value: number; status: KpiStatus };
    netRoas: { value: number; status: KpiStatus };
  };

  /**
   * Decisiones activadas, ordenadas por prioridad
   */
  decisions: TriggeredDecision[];

  /**
   * Acciones recomendadas (texto formateado)
   */
  actions: string[];

  /**
   * Próxima revisión
   */
  nextReviewDate: string;
}

// ============================================================================
// PRIORITY ORDER
// ============================================================================

export const PRIORITY_ORDER: Record<DecisionPriority, number> = {
  critical: 1,
  high: 2,
  medium: 3,
  low: 4,
};

export const DECISION_ICONS: Record<DecisionType, string> = {
  freeze: "🛑",
  block: "⛔",
  ready: "✅",
  diagnose: "🔍",
  optimize: "⚡",
  monitor: "👁️",
};

export const PRIORITY_ICONS: Record<DecisionPriority, string> = {
  critical: "🔴",
  high: "🟠",
  medium: "🟡",
  low: "🟢",
};
