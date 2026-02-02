/**
 * PR Proposal Engine Types (T10.3 v1)
 *
 * Types for generating PR proposals from TaskCodeMappings.
 * NO commits, NO diffs, NO GitHub API - just structured text.
 */

import type { TaskCodeMapping, RiskLevel, ImpactType } from "../task-mapper/types.js";
import type { Complexity } from "../types.js";

// ============================================================================
// PR PROPOSAL
// ============================================================================

export interface PrProposal {
  // Identification
  id: string;
  taskId: number;
  generatedAt: string;

  // PR Metadata
  title: string;
  branchName: string;
  labels: string[];

  // Sections
  context: ProblemContext;
  impact: EconomicImpactSection;
  scope: ChangeScope;
  risks: RiskSection;
  validation: ValidationChecklist;

  // Formatted output
  formattedProposal: string;
}

// ============================================================================
// SECTIONS
// ============================================================================

export interface ProblemContext {
  taskTitle: string;
  taskId: number;
  taskUrl?: string;
  businessArea: string;
  decisionRule?: string;
  description: string;
  urgency: string;
}

export interface EconomicImpactSection {
  hasImpact: boolean;
  monthlyEur: number;
  annualEur: number;
  impactType: ImpactType;
  calculation: string;
  affectedKpis: string[];
  confidence: string;
}

export interface ChangeScope {
  changeType: ChangeType;
  complexity: Complexity;
  modules: ModuleChange[];
  files: FileChange[];
  estimatedLinesChanged: number;
}

export type ChangeType =
  | "bugfix"
  | "optimization"
  | "logic_change"
  | "configuration"
  | "feature"
  | "refactor";

export interface ModuleChange {
  name: string;
  path: string;
  relevance: "primary" | "secondary" | "related";
  changeDescription: string;
}

export interface FileChange {
  path: string;
  action: "modify" | "create" | "delete" | "review";
  description: string;
  estimatedLines: number;
}

export interface RiskSection {
  level: RiskLevel;
  factors: string[];
  rollbackPlan: string;
  mitigations: string[];
}

export interface ValidationChecklist {
  items: ValidationItem[];
  testCommands: string[];
  manualChecks: string[];
}

export interface ValidationItem {
  description: string;
  type: "automated" | "manual" | "visual";
  priority: "required" | "recommended" | "optional";
}

// ============================================================================
// BATCH OUTPUT
// ============================================================================

export interface PrProposalBatch {
  generatedAt: string;
  totalProposals: number;
  totalEstimatedImpact: number;
  proposals: PrProposal[];
  summary: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

export const CHANGE_TYPE_LABELS: Record<ChangeType, string> = {
  bugfix: "🐛 Bug Fix",
  optimization: "⚡ Optimization",
  logic_change: "🔄 Logic Change",
  configuration: "⚙️ Configuration",
  feature: "✨ Feature",
  refactor: "♻️ Refactor",
};

export const RISK_LABELS: Record<RiskLevel, string> = {
  critical: "🔴 Critical",
  high: "🟠 High",
  medium: "🟡 Medium",
  low: "🟢 Low",
  minimal: "⚪ Minimal",
};

export const IMPACT_TYPE_LABELS: Record<ImpactType, string> = {
  revenue_increase: "📈 Revenue Increase",
  cost_reduction: "📉 Cost Reduction",
  waste_prevention: "🛡️ Waste Prevention",
  efficiency_gain: "⚡ Efficiency Gain",
  risk_mitigation: "🔒 Risk Mitigation",
  none: "—",
};
