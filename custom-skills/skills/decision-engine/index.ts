/**
 * Decision Engine - Main Entry Point
 *
 * Traduce KPIs en acciones concretas.
 * Read-only, explicable, reversible.
 */

export { generateWeeklyReport, formatReportAsText } from "./reporters/weekly-report.js";
export { evaluateRules, getTopActions, deduplicateDecisions } from "./rules/evaluator.js";
export { getDecisionRules, DECISION_RULES } from "./rules/decision-matrix.js";
export * from "./types.js";
