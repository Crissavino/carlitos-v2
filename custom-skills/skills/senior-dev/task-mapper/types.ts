/**
 * Task → Code Mapping Types (T10.2)
 *
 * Tipos para mapear tareas del kanban a código,
 * con justificación de impacto económico.
 */

import type { ModuleInfo, FileInfo, Complexity } from "../types.js";

// ============================================================================
// TASK INPUT (from dashboard-tasks)
// ============================================================================

export interface KanbanTask {
  id: number;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  source: TaskSource;
  decision_rule_id?: string;
  area?: string;
  due_date?: string;
  created_at?: string;
  updated_at?: string;
}

export type TaskStatus = "backlog" | "todo" | "in_progress" | "review" | "done" | "archived";
export type TaskPriority = "critical" | "high" | "medium" | "low";
export type TaskSource = "decision_engine" | "manual" | "alert" | "learning";

// ============================================================================
// TASK CODE MAPPING
// ============================================================================

export interface TaskCodeMapping {
  taskId: number;
  taskTitle: string;
  taskSource: TaskSource;

  // Business Context
  businessContext: BusinessContext;

  // Affected Metrics
  affectedKpis: AffectedKpi[];

  // Code Mapping
  affectedModules: AffectedModule[];
  affectedFiles: AffectedFile[];

  // Change Analysis
  changeType: ChangeType;
  estimatedComplexity: Complexity;

  // Risk Assessment
  riskLevel: RiskLevel;
  riskFactors: string[];

  // Economic Justification
  economicImpact: EconomicImpact;

  // Final Recommendation
  recommendation: Recommendation;
  recommendationReason: string;

  // Metadata
  mappedAt: string;
  confidence: number; // 0-1
}

// ============================================================================
// BUSINESS CONTEXT
// ============================================================================

export interface BusinessContext {
  area: DecisionArea;
  decisionType?: DecisionType;
  decisionRuleId?: string;
  decisionRuleName?: string;
  priority: TaskPriority;
  urgency: Urgency;
  description: string;
}

export type DecisionArea = "ads" | "onboarding" | "retention" | "pricing" | "product" | "ops" | "unknown";
export type DecisionType = "freeze" | "block" | "ready" | "diagnose" | "optimize" | "monitor";
export type Urgency = "immediate" | "this_week" | "next_week" | "backlog";

// ============================================================================
// AFFECTED METRICS
// ============================================================================

export interface AffectedKpi {
  name: string;
  fullName: string;
  currentStatus: "green" | "yellow" | "red" | "unknown";
  expectedImpact: "improve" | "worsen" | "neutral" | "unknown";
  impactMagnitude: "high" | "medium" | "low";
}

export const KPI_FULL_NAMES: Record<string, string> = {
  frr: "First Rebill Rate",
  cpfr: "Cost per First Rebill",
  srr: "Second Rebill Rate",
  ur2: "Usage before Rebill 2",
  netRoas: "Net ROAS",
  ltv30d: "LTV 30 días",
  paybackRatio: "Payback Ratio 30d",
  ltv21d: "LTV 21 días",
  payback21d: "Payback 21d",
  ltv51d: "LTV 51 días",
  payback51d: "Payback 51d",
  ltv81d: "LTV 81 días",
  payback81d: "Payback 81d",
};

// ============================================================================
// CODE MAPPING
// ============================================================================

export interface AffectedModule {
  name: string;
  path: string;
  type: string;
  relevance: "primary" | "secondary" | "related";
  reason: string;
}

export interface AffectedFile {
  path: string;
  module: string;
  changeType: FileChangeType;
  reason: string;
  estimatedLines: number;
}

export type FileChangeType = "modify" | "create" | "delete" | "review";

export type ChangeType =
  | "bug_fix"           // Fix existing functionality
  | "feature"           // Add new functionality
  | "optimization"      // Improve existing code
  | "refactor"          // Restructure without behavior change
  | "configuration"     // Config/threshold change
  | "data_analysis"     // Analyze data, no code change
  | "investigation"     // Investigate issue, may or may not need code
  | "documentation"     // Docs only
  | "unknown";

// ============================================================================
// RISK ASSESSMENT
// ============================================================================

export type RiskLevel = "critical" | "high" | "medium" | "low" | "minimal";

export interface RiskFactor {
  factor: string;
  severity: "high" | "medium" | "low";
  mitigation?: string;
}

export const RISK_WEIGHTS: Record<string, number> = {
  // High risk factors
  "affects_revenue_calculation": 3,
  "affects_decision_logic": 3,
  "multiple_modules": 2,
  "core_module": 2,
  "production_data": 2,

  // Medium risk factors
  "affects_kpi_display": 1,
  "configuration_change": 1,
  "new_feature": 1,

  // Low risk factors
  "isolated_change": -1,
  "well_tested_area": -1,
  "read_only": -2,
};

// ============================================================================
// ECONOMIC IMPACT
// ============================================================================

export interface EconomicImpact {
  hasImpact: boolean;
  impactType: ImpactType;
  estimatedMonthlyEur: number;
  estimatedAnnualEur: number;
  confidence: "high" | "medium" | "low";
  calculation: string;
  assumptions: string[];
}

export type ImpactType =
  | "revenue_increase"
  | "cost_reduction"
  | "waste_prevention"
  | "efficiency_gain"
  | "risk_mitigation"
  | "none";

// ============================================================================
// RECOMMENDATION
// ============================================================================

export type Recommendation = "DO" | "REVIEW" | "SKIP";

export interface RecommendationCriteria {
  /** Must have economic impact */
  requiresImpact: boolean;
  /** Minimum estimated monthly EUR to proceed */
  minMonthlyImpact: number;
  /** Maximum acceptable risk level */
  maxRiskLevel: RiskLevel;
  /** Minimum confidence in mapping */
  minConfidence: number;
}

export const DEFAULT_CRITERIA: RecommendationCriteria = {
  requiresImpact: true,
  minMonthlyImpact: 100, // €100/month minimum
  maxRiskLevel: "high", // Skip critical risk
  minConfidence: 0.5,
};

// ============================================================================
// AREA TO MODULE MAPPING
// ============================================================================

export const AREA_MODULE_MAP: Record<DecisionArea, string[]> = {
  ads: [
    "skills/google-ads-expert",
    "skills/business-expert",
    "skills/decision-engine",
  ],
  onboarding: [
    "dashboard",
    "skills/business-expert",
  ],
  retention: [
    "skills/business-expert",
    "skills/decision-engine",
  ],
  pricing: [
    "skills/business-expert",
    "dashboard",
  ],
  product: [
    "dashboard",
    "dashboard/frontend/src",
  ],
  ops: [
    "skills/dashboard-tasks",
    "skills/admin-ops",
  ],
  unknown: [],
};

// ============================================================================
// DECISION RULE TO CODE MAPPING
// ============================================================================

export const RULE_CODE_MAP: Record<string, string[]> = {
  // FRR rules
  "frr-red-freeze": ["skills/decision-engine/rules/decision-matrix.ts", "skills/business-expert/analyzers/cross-analyzer.ts"],
  "frr-red-onboarding": ["skills/decision-engine/rules/decision-matrix.ts"],
  "frr-yellow-alert": ["skills/decision-engine/rules/decision-matrix.ts"],

  // CPFR rules
  "cpfr-red-block": ["skills/decision-engine/rules/decision-matrix.ts", "skills/business-expert/types.ts"],
  "cpfr-yellow-alert": ["skills/decision-engine/rules/decision-matrix.ts"],

  // Payback rules
  "payback-21d-warning": ["skills/decision-engine/rules/decision-matrix.ts"],
  "payback-51d-pause": ["skills/decision-engine/rules/decision-matrix.ts", "skills/business-expert/analyzers/cross-analyzer.ts"],
  "payback-51d-scale": ["skills/decision-engine/rules/decision-matrix.ts"],
  "payback-30d-info": ["skills/decision-engine/rules/decision-matrix.ts"],

  // Scale rules
  "scale-ready": ["skills/decision-engine/rules/decision-matrix.ts"],

  // SRR rules
  "srr-red-diagnose": ["skills/decision-engine/rules/decision-matrix.ts", "skills/business-expert/analyzers/cross-analyzer.ts"],
  "srr-yellow-monitor": ["skills/decision-engine/rules/decision-matrix.ts"],

  // ROAS rules
  "roas-yellow-optimize": ["skills/decision-engine/rules/decision-matrix.ts", "skills/google-ads-expert/keywords-analyzer.ts"],
  "roas-red-reduce": ["skills/decision-engine/rules/decision-matrix.ts"],

  // General
  "all-green": ["skills/decision-engine/rules/decision-matrix.ts"],
};

// ============================================================================
// KPI TO MODULE MAPPING
// ============================================================================

export const KPI_MODULE_MAP: Record<string, string[]> = {
  frr: ["skills/business-expert/analyzers/cross-analyzer.ts", "skills/db-reader/queries/business-aggregations.ts"],
  cpfr: ["skills/business-expert/analyzers/cross-analyzer.ts", "skills/google-ads-expert/keywords-analyzer.ts"],
  srr: ["skills/business-expert/analyzers/cross-analyzer.ts", "skills/db-reader/queries/business-aggregations.ts"],
  ur2: ["skills/business-expert/analyzers/cross-analyzer.ts"],
  netRoas: ["skills/business-expert/analyzers/cross-analyzer.ts", "skills/google-ads-expert/keywords-analyzer.ts"],
  ltv21d: ["skills/business-expert/analyzers/cross-analyzer.ts"],
  ltv51d: ["skills/business-expert/analyzers/cross-analyzer.ts"],
  payback21d: ["skills/business-expert/analyzers/cross-analyzer.ts"],
  payback51d: ["skills/business-expert/analyzers/cross-analyzer.ts"],
};
