/**
 * Decision Matrix
 *
 * Reglas de decisión basadas en KPIs.
 * Cada regla tiene una condición clara y una acción específica.
 *
 * Orden de evaluación:
 * 1. Reglas de bloqueo (FRR rojo, CPFR rojo)
 * 2. Reglas de habilitación (FRR verde + CPFR verde)
 * 3. Reglas de diagnóstico (SRR rojo)
 * 4. Reglas de optimización (ROAS amarillo)
 */

import { DecisionRule } from "../types.js";
import { THRESHOLDS, CPFR_YELLOW } from "../../business-expert/types.js";

export const DECISION_RULES: DecisionRule[] = [
  // ============================================================================
  // REGLAS DE BLOQUEO (prioridad crítica/alta)
  // ============================================================================

  {
    id: "frr-red-freeze",
    name: "FRR Rojo - Freeze Ads",
    description: "First Rebill Rate crítico indica adquisición de baja calidad",
    condition: (kpis) => kpis.frr.status === "red",
    decision: {
      type: "freeze",
      priority: "critical",
      area: "ads",
      action: "FREEZE ADS: Pausar incrementos de presupuesto en campañas de adquisición",
      rationale: "FRR por debajo del 25% indica que el tráfico no convierte. Escalar ahora quemaría presupuesto.",
      reversible: true,
    },
    triggerKpis: ["frr"],
  },

  {
    id: "frr-red-onboarding",
    name: "FRR Rojo - Revisar Onboarding",
    description: "FRR bajo puede indicar problema en las primeras 48h del trial",
    condition: (kpis) => kpis.frr.status === "red",
    decision: {
      type: "diagnose",
      priority: "high",
      area: "onboarding",
      action: "AUDITAR ONBOARDING: Revisar flujo de las primeras 48h del trial",
      rationale: "Si usuarios no ven valor rápido, no convierten. Revisar: ¿llegan al primer uso? ¿entienden el producto?",
      reversible: true,
    },
    triggerKpis: ["frr"],
  },

  {
    id: "cpfr-red-block",
    name: "CPFR Rojo - No Escalar",
    description: "Costo de adquisición insostenible",
    condition: (kpis) => kpis.cpfr.status === "red",
    decision: {
      type: "block",
      priority: "critical",
      area: "ads",
      action: "NO ESCALAR: Mantener presupuesto actual hasta mejorar eficiencia",
      rationale: `CPFR supera €${CPFR_YELLOW}. Cada nuevo cliente cuesta más de lo que genera en valor.`,
      reversible: true,
    },
    triggerKpis: ["cpfr"],
  },

  // ============================================================================
  // PAYBACK VENTANAS CORRECTAS (Phase 6.1)
  // IMPORTANTE: Payback 21d es SOLO warning. Payback 51d es para decisiones.
  // ============================================================================

  {
    id: "payback-21d-warning",
    name: "Payback 21d - Warning Temprano",
    description: "Payback 21d bajo indica riesgo temprano (solo warning, nunca pause)",
    condition: (kpis) => kpis.payback21d.value < 0.5 && kpis.payback21d.value > 0,
    decision: {
      type: "monitor",
      priority: "medium",
      area: "ads",
      action: "WARNING TEMPRANO: Payback 21d < 0.5. Monitorear, no pausar todavía.",
      rationale: "Payback 21d es métrica temprana (R1 completo). Solo sirve para warning. Esperar a datos de 51d para decisiones.",
      reversible: true,
    },
    triggerKpis: ["payback21d"],
  },

  {
    id: "payback-51d-pause",
    name: "Payback 51d - Pause Ads",
    description: "Payback 51d < 1.0 indica pérdida confirmada en cohorte madura",
    condition: (kpis) => kpis.payback51d.status === "red",
    decision: {
      type: "freeze",
      priority: "critical",
      area: "ads",
      action: "PAUSE ADS: Payback 51d < 1.0. Cohorte madura con pérdida confirmada.",
      rationale: "Con 51 días de datos (R2 completo), el LTV real es menor que CPFR. Cada adquisición destruye valor. Pausar hasta optimizar.",
      reversible: true,
    },
    triggerKpis: ["payback51d"],
  },

  {
    id: "payback-51d-scale",
    name: "Payback 51d - Scale Ready",
    description: "Payback 51d >= 1.5 indica rentabilidad confirmada",
    condition: (kpis) =>
      kpis.payback51d.status === "green" &&
      kpis.frr.status !== "red" &&
      kpis.cpfr.status !== "red",
    decision: {
      type: "ready",
      priority: "medium",
      area: "ads",
      action: "SCALE READY: Payback 51d >= 1.5. Rentabilidad confirmada con datos maduros.",
      rationale: "Con 51 días de datos, el LTV supera significativamente al CPFR. OK para incrementar spend en campañas rentables.",
      reversible: true,
    },
    triggerKpis: ["payback51d", "frr", "cpfr"],
  },

  // Payback 30d (proxy) - solo informativo, prioridad baja
  {
    id: "payback-30d-info",
    name: "Payback 30d - Proxy Intermedio",
    description: "Payback 30d es solo proxy, no usar para decisiones fuertes",
    condition: (kpis) => kpis.paybackRatio.status === "red" && kpis.payback51d.value === 0,
    decision: {
      type: "monitor",
      priority: "low",
      area: "ads",
      action: "INFO: Payback 30d bajo. Esperar datos de 51d para decisión.",
      rationale: "Payback 30d es proxy intermedio. Sin datos de 51d, no tomar decisiones fuertes.",
      reversible: true,
    },
    triggerKpis: ["paybackRatio"],
  },

  // ============================================================================
  // REGLAS DE HABILITACIÓN (luz verde para acciones)
  // ============================================================================

  {
    id: "scale-ready",
    name: "Escalar Ready",
    description: "KPIs de adquisición saludables permiten incrementar inversión",
    condition: (kpis) =>
      kpis.frr.status === "green" &&
      kpis.cpfr.status === "green" &&
      kpis.payback51d.status === "green" &&
      kpis.netRoas.status !== "red",
    decision: {
      type: "ready",
      priority: "medium",
      area: "ads",
      action: "ESCALAR READY: OK para incrementar spend +10-20% en campañas rentables",
      rationale: "FRR, CPFR y Payback 51d verdes indican adquisición rentable. ROAS no crítico permite expansión controlada.",
      reversible: true,
    },
    triggerKpis: ["frr", "cpfr", "payback51d", "netRoas"],
  },

  // ============================================================================
  // REGLAS DE DIAGNÓSTICO (requieren investigación)
  // ============================================================================

  {
    id: "srr-red-diagnose",
    name: "SRR Rojo - Diagnóstico Retención",
    description: "Retención al segundo mes por debajo del objetivo",
    condition: (kpis) => kpis.srr.status === "red",
    decision: {
      type: "diagnose",
      priority: "high",
      area: "retention",
      action: "DIAGNÓSTICO RETENCIÓN: Investigar causas de baja renovación al segundo mes",
      rationale: "SRR bajo puede indicar: (1) Producto no cumple expectativa, (2) Pricing no coincide con valor, (3) Usuarios resuelven necesidad en primer mes y no necesitan renovar.",
      reversible: true,
    },
    triggerKpis: ["srr"],
  },

  {
    id: "srr-yellow-monitor",
    name: "SRR Amarillo - Monitorear",
    description: "Retención en zona de riesgo",
    condition: (kpis) => kpis.srr.status === "yellow",
    decision: {
      type: "monitor",
      priority: "medium",
      area: "retention",
      action: "MONITOREAR SRR: Retención en zona amarilla, observar tendencia",
      rationale: "SRR entre 55-70% requiere atención pero no acción inmediata. Revisar en próximo ciclo.",
      reversible: true,
    },
    triggerKpis: ["srr"],
  },

  // ============================================================================
  // REGLAS DE OPTIMIZACIÓN
  // ============================================================================

  {
    id: "roas-yellow-optimize",
    name: "ROAS Amarillo - Optimizar Mix",
    description: "ROAS en zona ajustada, revisar campañas",
    condition: (kpis) =>
      kpis.netRoas.status === "yellow" &&
      kpis.frr.status !== "red" &&
      kpis.cpfr.status !== "red",
    decision: {
      type: "optimize",
      priority: "medium",
      area: "ads",
      action: "OPTIMIZAR MIX: Revisar campañas con peor CPA y redistribuir presupuesto",
      rationale: "ROAS 1.3-2.0x indica margen ajustado. Sin bloquear ads, pero optimizar distribución hacia campañas más eficientes.",
      reversible: true,
    },
    triggerKpis: ["netRoas"],
  },

  {
    id: "roas-red-reduce",
    name: "ROAS Rojo - Reducir Spend",
    description: "ROAS crítico requiere reducción de gasto",
    condition: (kpis) =>
      kpis.netRoas.status === "red" &&
      kpis.frr.status !== "red", // Si FRR también es rojo, ya hay regla más prioritaria
    decision: {
      type: "optimize",
      priority: "high",
      area: "ads",
      action: "REDUCIR SPEND: ROAS crítico, reducir presupuesto 20-30% hasta mejorar",
      rationale: "ROAS <1.3x significa que por cada €1 invertido se pierde dinero. Reducir exposure hasta optimizar.",
      reversible: true,
    },
    triggerKpis: ["netRoas"],
  },

  // ============================================================================
  // REGLAS DE ALERTA TEMPRANA
  // ============================================================================

  {
    id: "frr-yellow-alert",
    name: "FRR Amarillo - Alerta Temprana",
    description: "FRR en deterioro, preparar contingencia",
    condition: (kpis) => kpis.frr.status === "yellow",
    decision: {
      type: "monitor",
      priority: "high",
      area: "ads",
      action: "ALERTA FRR: First Rebill Rate en zona amarilla, no escalar hasta estabilizar",
      rationale: "FRR entre 25-35% indica riesgo de deterioro. Mantener spend actual y monitorear próxima semana.",
      reversible: true,
    },
    triggerKpis: ["frr"],
  },

  {
    id: "cpfr-yellow-alert",
    name: "CPFR Amarillo - Alerta CAC",
    description: "Costo de adquisición en zona límite",
    condition: (kpis) => kpis.cpfr.status === "yellow",
    decision: {
      type: "monitor",
      priority: "medium",
      area: "ads",
      action: "ALERTA CPFR: Costo de adquisición en zona límite, optimizar antes de escalar",
      rationale: "CPFR en zona amarilla. Escalar ahora podría empujar a rojo. Optimizar campañas primero.",
      reversible: true,
    },
    triggerKpis: ["cpfr"],
  },

  // ============================================================================
  // ESTADO SALUDABLE
  // ============================================================================

  {
    id: "all-green",
    name: "Todo Verde - Operación Normal",
    description: "Todos los KPIs principales en verde",
    condition: (kpis) =>
      kpis.frr.status === "green" &&
      kpis.cpfr.status === "green" &&
      kpis.payback51d.status === "green" &&
      kpis.netRoas.status === "green",
    decision: {
      type: "ready",
      priority: "low",
      area: "ads",
      action: "OPERACIÓN NORMAL: Métricas saludables, continuar estrategia actual",
      rationale: "FRR, CPFR, Payback 51d y ROAS en verde. El negocio está funcionando bien. Mantener y considerar expansión gradual.",
      reversible: true,
    },
    triggerKpis: ["frr", "cpfr", "payback51d", "netRoas"],
  },
];

export function getDecisionRules(): DecisionRule[] {
  return DECISION_RULES;
}
