/**
 * Rule Evaluator
 *
 * Evalúa las reglas de decisión contra los KPIs actuales.
 * Retorna decisiones ordenadas por prioridad.
 */

import { CoreKpis } from "../../business-expert/types.js";
import { DecisionRule, TriggeredDecision, PRIORITY_ORDER } from "../types.js";
import { getDecisionRules } from "./decision-matrix.js";

/**
 * Evalúa todas las reglas y retorna las decisiones activadas
 */
export function evaluateRules(kpis: CoreKpis): TriggeredDecision[] {
  const rules = getDecisionRules();
  const triggered: TriggeredDecision[] = [];

  for (const rule of rules) {
    if (rule.condition(kpis)) {
      triggered.push(createTriggeredDecision(rule, kpis));
    }
  }

  // Ordenar por prioridad (critical primero)
  return triggered.sort(
    (a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]
  );
}

/**
 * Crea una decisión activada con los valores de KPIs
 */
function createTriggeredDecision(
  rule: DecisionRule,
  kpis: CoreKpis
): TriggeredDecision {
  const kpiValues: TriggeredDecision["kpiValues"] = {};

  for (const kpiName of rule.triggerKpis) {
    const kpi = kpis[kpiName];
    if (kpi) {
      kpiValues[kpiName] = {
        value: kpi.value,
        status: kpi.status,
      };
    }
  }

  return {
    ruleId: rule.id,
    ruleName: rule.name,
    type: rule.decision.type,
    priority: rule.decision.priority,
    area: rule.decision.area,
    action: rule.decision.action,
    rationale: rule.decision.rationale,
    reversible: rule.decision.reversible,
    triggerKpis: rule.triggerKpis,
    kpiValues,
  };
}

/**
 * Filtra decisiones para evitar redundancias
 * Por ejemplo, si ya hay FREEZE por FRR rojo, no mostrar también ALERTA FRR
 */
export function deduplicateDecisions(
  decisions: TriggeredDecision[]
): TriggeredDecision[] {
  const seen = new Set<string>();
  const result: TriggeredDecision[] = [];

  // Primero, marcar las áreas cubiertas por decisiones de alta prioridad
  const criticalAreas = new Set<string>();
  for (const d of decisions) {
    if (d.priority === "critical" || d.priority === "high") {
      criticalAreas.add(`${d.area}-${d.triggerKpis.sort().join(",")}`);
    }
  }

  for (const d of decisions) {
    const areaKey = `${d.area}-${d.triggerKpis.sort().join(",")}`;

    // Si es una decisión de menor prioridad sobre un área ya cubierta, saltar
    if (
      (d.priority === "medium" || d.priority === "low") &&
      criticalAreas.has(areaKey) &&
      d.type === "monitor"
    ) {
      continue;
    }

    // Evitar duplicados exactos
    if (!seen.has(d.ruleId)) {
      seen.add(d.ruleId);
      result.push(d);
    }
  }

  return result;
}

/**
 * Obtiene las acciones principales (top N por prioridad)
 */
export function getTopActions(
  decisions: TriggeredDecision[],
  maxActions: number = 5
): TriggeredDecision[] {
  const deduplicated = deduplicateDecisions(decisions);
  return deduplicated.slice(0, maxActions);
}
