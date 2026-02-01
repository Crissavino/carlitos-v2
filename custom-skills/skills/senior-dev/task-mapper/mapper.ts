/**
 * Task → Code Mapper (T10.2)
 *
 * Maps kanban tasks to code modules with economic justification.
 * NO code generation, NO PRs - only analysis and recommendations.
 */

import { loadIndex } from "../repo/indexer.js";
import type { CodebaseIndex, Complexity } from "../types.js";
import {
  type KanbanTask,
  type TaskCodeMapping,
  type BusinessContext,
  type AffectedKpi,
  type AffectedModule,
  type AffectedFile,
  type EconomicImpact,
  type Recommendation,
  type RiskLevel,
  type ChangeType,
  type DecisionArea,
  type DecisionType,
  type Urgency,
  type ImpactType,
  AREA_MODULE_MAP,
  RULE_CODE_MAP,
  KPI_MODULE_MAP,
  KPI_FULL_NAMES,
  RISK_WEIGHTS,
  DEFAULT_CRITERIA,
} from "./types.js";

// ============================================================================
// MAIN MAPPER
// ============================================================================

export async function mapTaskToCode(task: KanbanTask): Promise<TaskCodeMapping> {
  const index = await loadIndex();
  if (!index) {
    throw new Error("Codebase index not found. Run 'senior-dev index' first.");
  }

  // 1. Extract business context
  const businessContext = extractBusinessContext(task);

  // 2. Identify affected KPIs
  const affectedKpis = identifyAffectedKpis(task, businessContext);

  // 3. Map to code modules
  const { modules, files } = mapToCode(task, businessContext, affectedKpis, index);

  // 4. Determine change type and complexity
  const changeType = determineChangeType(task, businessContext);
  const complexity = estimateComplexity(files, changeType);

  // 5. Assess risk
  const { riskLevel, riskFactors } = assessRisk(modules, files, changeType, businessContext);

  // 6. Calculate economic impact
  const economicImpact = calculateEconomicImpact(task, businessContext, affectedKpis);

  // 7. Calculate confidence
  const confidence = calculateConfidence(affectedKpis, modules, economicImpact);

  // 8. Generate recommendation
  const { recommendation, reason } = generateRecommendation(
    economicImpact,
    riskLevel,
    confidence,
    businessContext
  );

  return {
    taskId: task.id,
    taskTitle: task.title,
    taskSource: task.source,
    businessContext,
    affectedKpis,
    affectedModules: modules,
    affectedFiles: files,
    changeType,
    estimatedComplexity: complexity,
    riskLevel,
    riskFactors,
    economicImpact,
    recommendation,
    recommendationReason: reason,
    mappedAt: new Date().toISOString(),
    confidence,
  };
}

// ============================================================================
// BUSINESS CONTEXT EXTRACTION
// ============================================================================

function extractBusinessContext(task: KanbanTask): BusinessContext {
  const area = parseArea(task);
  const decisionType = parseDecisionType(task);
  const urgency = parseUrgency(task);

  return {
    area,
    decisionType,
    decisionRuleId: task.decision_rule_id,
    decisionRuleName: task.decision_rule_id ? formatRuleName(task.decision_rule_id) : undefined,
    priority: task.priority,
    urgency,
    description: task.description || task.title,
  };
}

function parseArea(task: KanbanTask): DecisionArea {
  // From task.area field
  if (task.area) {
    const normalized = task.area.toLowerCase();
    if (["ads", "marketing", "google-ads", "campaigns"].some(a => normalized.includes(a))) {
      return "ads";
    }
    if (["onboarding", "trial", "activation"].some(a => normalized.includes(a))) {
      return "onboarding";
    }
    if (["retention", "churn", "rebill"].some(a => normalized.includes(a))) {
      return "retention";
    }
    if (["pricing", "price", "payment"].some(a => normalized.includes(a))) {
      return "pricing";
    }
    if (["product", "feature", "ui", "ux"].some(a => normalized.includes(a))) {
      return "product";
    }
    if (["ops", "operations", "admin"].some(a => normalized.includes(a))) {
      return "ops";
    }
  }

  // From decision_rule_id
  if (task.decision_rule_id) {
    const ruleId = task.decision_rule_id.toLowerCase();
    if (ruleId.includes("ads") || ruleId.includes("cpfr") || ruleId.includes("roas") || ruleId.includes("scale")) {
      return "ads";
    }
    if (ruleId.includes("onboarding")) {
      return "onboarding";
    }
    if (ruleId.includes("srr") || ruleId.includes("retention")) {
      return "retention";
    }
  }

  // From title/description keywords
  const text = `${task.title} ${task.description || ""}`.toLowerCase();
  if (text.includes("campaign") || text.includes("ads") || text.includes("cpa") || text.includes("roas")) {
    return "ads";
  }
  if (text.includes("onboarding") || text.includes("trial") || text.includes("activation")) {
    return "onboarding";
  }
  if (text.includes("retention") || text.includes("churn") || text.includes("rebill")) {
    return "retention";
  }

  return "unknown";
}

function parseDecisionType(task: KanbanTask): DecisionType | undefined {
  if (!task.decision_rule_id) return undefined;

  const ruleId = task.decision_rule_id.toLowerCase();
  if (ruleId.includes("freeze") || ruleId.includes("pause")) return "freeze";
  if (ruleId.includes("block")) return "block";
  if (ruleId.includes("ready") || ruleId.includes("scale")) return "ready";
  if (ruleId.includes("diagnose") || ruleId.includes("audit")) return "diagnose";
  if (ruleId.includes("optimize") || ruleId.includes("reduce")) return "optimize";
  if (ruleId.includes("monitor") || ruleId.includes("warning") || ruleId.includes("alert")) return "monitor";

  return undefined;
}

function parseUrgency(task: KanbanTask): Urgency {
  if (task.priority === "critical") return "immediate";
  if (task.priority === "high") return "this_week";
  if (task.priority === "medium") return "next_week";
  return "backlog";
}

function formatRuleName(ruleId: string): string {
  return ruleId
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

// ============================================================================
// KPI IDENTIFICATION
// ============================================================================

function identifyAffectedKpis(task: KanbanTask, context: BusinessContext): AffectedKpi[] {
  const kpis: AffectedKpi[] = [];

  // From decision_rule_id (known rules have known KPIs)
  if (task.decision_rule_id) {
    const ruleKpis = getKpisFromRule(task.decision_rule_id);
    for (const kpiName of ruleKpis) {
      kpis.push({
        name: kpiName,
        fullName: KPI_FULL_NAMES[kpiName] || kpiName,
        currentStatus: "unknown",
        expectedImpact: getExpectedImpact(task.decision_rule_id, kpiName),
        impactMagnitude: getImpactMagnitude(task.priority),
      });
    }
  }

  // From text analysis
  const text = `${task.title} ${task.description || ""}`.toLowerCase();
  const kpiPatterns: Array<{ pattern: RegExp; kpi: string }> = [
    { pattern: /\bfrr\b|first\s*rebill/i, kpi: "frr" },
    { pattern: /\bcpfr\b|cost\s*per\s*first/i, kpi: "cpfr" },
    { pattern: /\bsrr\b|second\s*rebill/i, kpi: "srr" },
    { pattern: /\bu-?r2\b|usage.*rebill/i, kpi: "ur2" },
    { pattern: /\broas\b|return.*ad.*spend/i, kpi: "netRoas" },
    { pattern: /\bltv\b|lifetime\s*value/i, kpi: "ltv51d" },
    { pattern: /\bpayback\b/i, kpi: "payback51d" },
  ];

  for (const { pattern, kpi } of kpiPatterns) {
    if (pattern.test(text) && !kpis.some((k) => k.name === kpi)) {
      kpis.push({
        name: kpi,
        fullName: KPI_FULL_NAMES[kpi] || kpi,
        currentStatus: "unknown",
        expectedImpact: "improve",
        impactMagnitude: getImpactMagnitude(task.priority),
      });
    }
  }

  // Default KPIs by area if none found
  if (kpis.length === 0) {
    const areaKpis = getKpisByArea(context.area);
    for (const kpiName of areaKpis) {
      kpis.push({
        name: kpiName,
        fullName: KPI_FULL_NAMES[kpiName] || kpiName,
        currentStatus: "unknown",
        expectedImpact: "unknown",
        impactMagnitude: "low",
      });
    }
  }

  return kpis;
}

function getKpisFromRule(ruleId: string): string[] {
  const ruleKpis: Record<string, string[]> = {
    "frr-red-freeze": ["frr"],
    "frr-red-onboarding": ["frr"],
    "frr-yellow-alert": ["frr"],
    "cpfr-red-block": ["cpfr"],
    "cpfr-yellow-alert": ["cpfr"],
    "payback-21d-warning": ["payback21d", "ltv21d"],
    "payback-51d-pause": ["payback51d", "ltv51d", "cpfr"],
    "payback-51d-scale": ["payback51d", "frr", "cpfr"],
    "scale-ready": ["frr", "cpfr", "payback51d", "netRoas"],
    "srr-red-diagnose": ["srr"],
    "srr-yellow-monitor": ["srr"],
    "roas-yellow-optimize": ["netRoas"],
    "roas-red-reduce": ["netRoas"],
    "all-green": ["frr", "cpfr", "payback51d", "netRoas"],
  };
  return ruleKpis[ruleId] || [];
}

function getExpectedImpact(ruleId: string, _kpi: string): "improve" | "worsen" | "neutral" | "unknown" {
  // Freeze/block rules indicate worsening KPIs that need fixing
  if (ruleId.includes("freeze") || ruleId.includes("block") || ruleId.includes("pause")) {
    return "improve"; // Fixing should improve
  }
  if (ruleId.includes("ready") || ruleId.includes("scale")) {
    return "neutral"; // Already good
  }
  if (ruleId.includes("diagnose") || ruleId.includes("optimize")) {
    return "improve";
  }
  return "unknown";
}

function getImpactMagnitude(priority: string): "high" | "medium" | "low" {
  if (priority === "critical") return "high";
  if (priority === "high") return "high";
  if (priority === "medium") return "medium";
  return "low";
}

function getKpisByArea(area: DecisionArea): string[] {
  const areaKpis: Record<DecisionArea, string[]> = {
    ads: ["cpfr", "netRoas", "frr"],
    onboarding: ["frr", "ur2"],
    retention: ["srr", "ltv51d"],
    pricing: ["ltv51d", "payback51d"],
    product: ["srr", "ur2"],
    ops: [],
    unknown: [],
  };
  return areaKpis[area] || [];
}

// ============================================================================
// CODE MAPPING
// ============================================================================

function mapToCode(
  task: KanbanTask,
  context: BusinessContext,
  kpis: AffectedKpi[],
  index: CodebaseIndex
): { modules: AffectedModule[]; files: AffectedFile[] } {
  const modules: AffectedModule[] = [];
  const files: AffectedFile[] = [];
  const seenModules = new Set<string>();
  const seenFiles = new Set<string>();

  // 1. From decision_rule_id (most specific)
  if (task.decision_rule_id && RULE_CODE_MAP[task.decision_rule_id]) {
    for (const filePath of RULE_CODE_MAP[task.decision_rule_id]) {
      if (!seenFiles.has(filePath)) {
        seenFiles.add(filePath);
        const fileInfo = index.files.find((f) => f.relativePath === filePath);
        files.push({
          path: filePath,
          module: fileInfo?.module || "unknown",
          changeType: context.decisionType === "diagnose" ? "review" : "modify",
          reason: `Implements rule ${task.decision_rule_id}`,
          estimatedLines: 10,
        });

        // Add module
        const moduleName = fileInfo?.module || filePath.split("/").slice(0, 2).join("/");
        if (!seenModules.has(moduleName)) {
          seenModules.add(moduleName);
          const moduleInfo = index.modules.find((m) => m.name === moduleName);
          modules.push({
            name: moduleName,
            path: moduleInfo?.path || moduleName,
            type: moduleInfo?.type || "unknown",
            relevance: "primary",
            reason: `Contains rule ${task.decision_rule_id}`,
          });
        }
      }
    }
  }

  // 2. From affected KPIs
  for (const kpi of kpis) {
    const kpiFiles = KPI_MODULE_MAP[kpi.name] || [];
    for (const filePath of kpiFiles) {
      if (!seenFiles.has(filePath)) {
        seenFiles.add(filePath);
        const fileInfo = index.files.find((f) => f.relativePath === filePath);
        files.push({
          path: filePath,
          module: fileInfo?.module || "unknown",
          changeType: "review",
          reason: `Calculates ${kpi.fullName}`,
          estimatedLines: 5,
        });

        const moduleName = fileInfo?.module || filePath.split("/").slice(0, 2).join("/");
        if (!seenModules.has(moduleName)) {
          seenModules.add(moduleName);
          const moduleInfo = index.modules.find((m) => m.name === moduleName);
          modules.push({
            name: moduleName,
            path: moduleInfo?.path || moduleName,
            type: moduleInfo?.type || "unknown",
            relevance: "secondary",
            reason: `Handles ${kpi.fullName} calculation`,
          });
        }
      }
    }
  }

  // 3. From area mapping
  const areaModules = AREA_MODULE_MAP[context.area] || [];
  for (const moduleName of areaModules) {
    if (!seenModules.has(moduleName)) {
      seenModules.add(moduleName);
      const moduleInfo = index.modules.find((m) => m.name === moduleName);
      if (moduleInfo) {
        modules.push({
          name: moduleName,
          path: moduleInfo.path,
          type: moduleInfo.type,
          relevance: "related",
          reason: `Related to ${context.area} area`,
        });
      }
    }
  }

  // 4. Text-based matching (search in codebase index)
  const searchTerms = extractSearchTerms(task);
  for (const term of searchTerms) {
    const termLower = term.toLowerCase();
    for (const file of index.files) {
      if (seenFiles.has(file.relativePath)) continue;

      const filename = file.relativePath.toLowerCase();
      const purpose = file.purpose.toLowerCase();
      if (filename.includes(termLower) || purpose.includes(termLower)) {
        seenFiles.add(file.relativePath);
        files.push({
          path: file.relativePath,
          module: file.module,
          changeType: "review",
          reason: `Matches search term "${term}"`,
          estimatedLines: 5,
        });

        if (!seenModules.has(file.module)) {
          seenModules.add(file.module);
          const moduleInfo = index.modules.find((m) => m.name === file.module);
          modules.push({
            name: file.module,
            path: moduleInfo?.path || file.module,
            type: moduleInfo?.type || "unknown",
            relevance: "related",
            reason: `Contains file matching "${term}"`,
          });
        }

        // Limit text-based matches
        if (files.length > 15) break;
      }
    }
  }

  return { modules, files };
}

function extractSearchTerms(task: KanbanTask): string[] {
  const text = `${task.title} ${task.description || ""}`;
  const terms: string[] = [];

  // Extract technical terms (camelCase, snake_case, kebab-case)
  const technicalPattern = /[a-z]+(?:[A-Z][a-z]+)+|[a-z]+(?:_[a-z]+)+|[a-z]+(?:-[a-z]+)+/g;
  const matches = text.match(technicalPattern) || [];
  terms.push(...matches);

  // Extract quoted strings
  const quotedPattern = /"([^"]+)"|'([^']+)'/g;
  let match;
  while ((match = quotedPattern.exec(text)) !== null) {
    terms.push(match[1] || match[2]);
  }

  // Extract key business terms
  const businessTerms = [
    "campaign", "keyword", "search-term", "analyzer", "decision",
    "revenue", "cost", "rebill", "trial", "conversion",
  ];
  for (const term of businessTerms) {
    if (text.toLowerCase().includes(term) && !terms.includes(term)) {
      terms.push(term);
    }
  }

  return terms.slice(0, 5); // Limit to 5 terms
}

// ============================================================================
// CHANGE TYPE & COMPLEXITY
// ============================================================================

function determineChangeType(task: KanbanTask, context: BusinessContext): ChangeType {
  const text = `${task.title} ${task.description || ""}`.toLowerCase();

  // From decision type
  if (context.decisionType) {
    switch (context.decisionType) {
      case "freeze":
      case "block":
        return "configuration"; // Usually threshold/flag changes
      case "diagnose":
        return "investigation";
      case "optimize":
        return "optimization";
      case "ready":
        return "data_analysis";
      case "monitor":
        return "data_analysis";
    }
  }

  // From text analysis
  if (text.includes("fix") || text.includes("bug") || text.includes("error")) {
    return "bug_fix";
  }
  if (text.includes("add") || text.includes("new") || text.includes("implement")) {
    return "feature";
  }
  if (text.includes("refactor") || text.includes("restructure") || text.includes("cleanup")) {
    return "refactor";
  }
  if (text.includes("optimize") || text.includes("improve") || text.includes("enhance")) {
    return "optimization";
  }
  if (text.includes("investigate") || text.includes("analyze") || text.includes("review")) {
    return "investigation";
  }
  if (text.includes("config") || text.includes("threshold") || text.includes("setting")) {
    return "configuration";
  }

  return "unknown";
}

function estimateComplexity(files: AffectedFile[], changeType: ChangeType): Complexity {
  const fileCount = files.filter((f) => f.changeType !== "review").length;
  const totalLines = files.reduce((sum, f) => sum + f.estimatedLines, 0);

  // Investigation and data_analysis are typically trivial (no code changes)
  if (changeType === "investigation" || changeType === "data_analysis") {
    return "trivial";
  }

  // Configuration changes are usually simple
  if (changeType === "configuration") {
    return "simple";
  }

  // Based on file count and lines
  if (fileCount === 0) return "trivial";
  if (fileCount === 1 && totalLines < 20) return "simple";
  if (fileCount <= 3 && totalLines < 50) return "medium";
  return "complex";
}

// ============================================================================
// RISK ASSESSMENT
// ============================================================================

function assessRisk(
  modules: AffectedModule[],
  files: AffectedFile[],
  changeType: ChangeType,
  context: BusinessContext
): { riskLevel: RiskLevel; riskFactors: string[] } {
  const factors: string[] = [];
  let score = 0;

  // Check core module involvement
  const hasCoreModule = modules.some((m) => m.type === "core" || m.name === "core");
  if (hasCoreModule) {
    factors.push("Affects core module");
    score += RISK_WEIGHTS["core_module"];
  }

  // Check multiple modules
  const primaryModules = modules.filter((m) => m.relevance === "primary").length;
  if (primaryModules > 1) {
    factors.push(`Multiple modules affected (${primaryModules})`);
    score += RISK_WEIGHTS["multiple_modules"];
  }

  // Check if affects revenue calculation
  const revenueFiles = files.filter((f) =>
    f.path.includes("revenue") ||
    f.path.includes("cross-analyzer") ||
    f.reason.toLowerCase().includes("ltv") ||
    f.reason.toLowerCase().includes("cpfr")
  );
  if (revenueFiles.length > 0) {
    factors.push("Affects revenue/cost calculations");
    score += RISK_WEIGHTS["affects_revenue_calculation"];
  }

  // Check if affects decision logic
  const decisionFiles = files.filter((f) =>
    f.path.includes("decision") || f.path.includes("rules")
  );
  if (decisionFiles.length > 0) {
    factors.push("Affects decision logic");
    score += RISK_WEIGHTS["affects_decision_logic"];
  }

  // Read-only / investigation reduces risk
  if (changeType === "investigation" || changeType === "data_analysis") {
    factors.push("Read-only analysis");
    score += RISK_WEIGHTS["read_only"];
  }

  // Isolated change reduces risk
  if (modules.length === 1 && files.length <= 2) {
    factors.push("Isolated change");
    score += RISK_WEIGHTS["isolated_change"];
  }

  // Priority affects risk perception
  if (context.priority === "critical") {
    factors.push("Critical priority (time pressure)");
    score += 1;
  }

  // Calculate risk level
  let riskLevel: RiskLevel;
  if (score >= 6) riskLevel = "critical";
  else if (score >= 4) riskLevel = "high";
  else if (score >= 2) riskLevel = "medium";
  else if (score >= 0) riskLevel = "low";
  else riskLevel = "minimal";

  return { riskLevel, riskFactors: factors };
}

// ============================================================================
// ECONOMIC IMPACT
// ============================================================================

function calculateEconomicImpact(
  task: KanbanTask,
  context: BusinessContext,
  kpis: AffectedKpi[]
): EconomicImpact {
  const assumptions: string[] = [];
  let estimatedMonthly = 0;
  let impactType: ImpactType = "none";
  let calculation = "No quantifiable impact identified";
  let confidence: "high" | "medium" | "low" = "low";

  // Rule-based impact estimation
  if (task.decision_rule_id) {
    const ruleImpact = estimateRuleImpact(task.decision_rule_id, context.priority);
    if (ruleImpact.monthly > 0) {
      estimatedMonthly = ruleImpact.monthly;
      impactType = ruleImpact.type;
      calculation = ruleImpact.calculation;
      assumptions.push(...ruleImpact.assumptions);
      confidence = ruleImpact.confidence;
    }
  }

  // KPI-based impact estimation
  if (estimatedMonthly === 0 && kpis.length > 0) {
    const kpiImpact = estimateKpiImpact(kpis, context.area);
    if (kpiImpact.monthly > 0) {
      estimatedMonthly = kpiImpact.monthly;
      impactType = kpiImpact.type;
      calculation = kpiImpact.calculation;
      assumptions.push(...kpiImpact.assumptions);
      confidence = kpiImpact.confidence;
    }
  }

  // Priority-based multiplier
  if (context.priority === "critical" && estimatedMonthly > 0) {
    estimatedMonthly *= 1.5;
    assumptions.push("Critical priority suggests higher urgency/impact");
  }

  return {
    hasImpact: estimatedMonthly > 0,
    impactType,
    estimatedMonthlyEur: Math.round(estimatedMonthly),
    estimatedAnnualEur: Math.round(estimatedMonthly * 12),
    confidence,
    calculation,
    assumptions,
  };
}

function estimateRuleImpact(ruleId: string, priority: string): {
  monthly: number;
  type: ImpactType;
  calculation: string;
  assumptions: string[];
  confidence: "high" | "medium" | "low";
} {
  // Base impact estimates by rule type
  const ruleImpacts: Record<string, { base: number; type: ImpactType; calc: string }> = {
    "frr-red-freeze": {
      base: 2000,
      type: "waste_prevention",
      calc: "Prevents ~€2000/month wasted ad spend on low-converting traffic",
    },
    "frr-red-onboarding": {
      base: 1500,
      type: "revenue_increase",
      calc: "Improving onboarding can increase FRR by 5-10%, ~€1500/month in recovered revenue",
    },
    "cpfr-red-block": {
      base: 1800,
      type: "waste_prevention",
      calc: "Prevents scaling campaigns with unsustainable CAC, saving ~€1800/month",
    },
    "payback-51d-pause": {
      base: 2500,
      type: "waste_prevention",
      calc: "Pausing unprofitable campaigns prevents ~€2500/month in losses",
    },
    "payback-51d-scale": {
      base: 3000,
      type: "revenue_increase",
      calc: "Scaling profitable campaigns can generate +€3000/month incremental revenue",
    },
    "scale-ready": {
      base: 2000,
      type: "revenue_increase",
      calc: "Healthy metrics allow +10-20% spend increase, ~€2000/month additional revenue",
    },
    "srr-red-diagnose": {
      base: 1200,
      type: "revenue_increase",
      calc: "Improving SRR by 10% increases LTV, ~€1200/month impact",
    },
    "roas-yellow-optimize": {
      base: 800,
      type: "efficiency_gain",
      calc: "Optimizing campaign mix can improve ROAS by 0.2x, ~€800/month",
    },
    "roas-red-reduce": {
      base: 1500,
      type: "waste_prevention",
      calc: "Reducing spend on negative-ROAS campaigns saves ~€1500/month",
    },
  };

  const impact = ruleImpacts[ruleId];
  if (!impact) {
    return { monthly: 0, type: "none", calculation: "Unknown rule", assumptions: [], confidence: "low" };
  }

  // Adjust by priority
  let multiplier = 1.0;
  if (priority === "critical") multiplier = 1.5;
  else if (priority === "high") multiplier = 1.2;
  else if (priority === "low") multiplier = 0.7;

  return {
    monthly: impact.base * multiplier,
    type: impact.type,
    calculation: impact.calc,
    assumptions: [
      "Based on historical rule impact data",
      `Priority ${priority} multiplier: ${multiplier}x`,
    ],
    confidence: "medium",
  };
}

function estimateKpiImpact(
  kpis: AffectedKpi[],
  area: DecisionArea
): {
  monthly: number;
  type: ImpactType;
  calculation: string;
  assumptions: string[];
  confidence: "high" | "medium" | "low";
} {
  // Base KPI impact values
  const kpiValues: Record<string, { base: number; type: ImpactType }> = {
    frr: { base: 1500, type: "revenue_increase" },
    cpfr: { base: 1200, type: "cost_reduction" },
    srr: { base: 1000, type: "revenue_increase" },
    netRoas: { base: 800, type: "efficiency_gain" },
    ltv51d: { base: 1200, type: "revenue_increase" },
    payback51d: { base: 1000, type: "efficiency_gain" },
  };

  // Find highest-impact KPI
  let maxImpact = 0;
  let impactType: ImpactType = "none";

  for (const kpi of kpis) {
    const value = kpiValues[kpi.name];
    if (value && value.base > maxImpact) {
      maxImpact = value.base;
      impactType = value.type;
    }
  }

  if (maxImpact === 0) {
    return { monthly: 0, type: "none", calculation: "No quantifiable KPI impact", assumptions: [], confidence: "low" };
  }

  // Magnitude multiplier
  const magnitudeMultiplier = kpis[0]?.impactMagnitude === "high" ? 1.3 : kpis[0]?.impactMagnitude === "medium" ? 1.0 : 0.7;

  return {
    monthly: maxImpact * magnitudeMultiplier,
    type: impactType,
    calculation: `Improvement in ${kpis.map((k) => k.fullName).join(", ")}`,
    assumptions: [
      "Assumes 5-10% improvement in affected KPI(s)",
      `Impact magnitude: ${kpis[0]?.impactMagnitude || "unknown"}`,
    ],
    confidence: "low",
  };
}

// ============================================================================
// CONFIDENCE & RECOMMENDATION
// ============================================================================

function calculateConfidence(
  kpis: AffectedKpi[],
  modules: AffectedModule[],
  impact: EconomicImpact
): number {
  let confidence = 0.5; // Base confidence

  // More KPIs identified = higher confidence
  if (kpis.length > 0) confidence += 0.1;
  if (kpis.length > 2) confidence += 0.1;

  // Primary modules identified = higher confidence
  const primaryModules = modules.filter((m) => m.relevance === "primary").length;
  if (primaryModules > 0) confidence += 0.15;
  if (primaryModules > 1) confidence += 0.05;

  // Has economic impact = higher confidence
  if (impact.hasImpact) confidence += 0.1;
  if (impact.confidence === "high") confidence += 0.1;
  else if (impact.confidence === "medium") confidence += 0.05;

  return Math.min(confidence, 1.0);
}

function generateRecommendation(
  impact: EconomicImpact,
  riskLevel: RiskLevel,
  confidence: number,
  context: BusinessContext
): { recommendation: Recommendation; reason: string } {
  const criteria = DEFAULT_CRITERIA;

  // SKIP: Critical risk
  if (riskLevel === "critical") {
    return {
      recommendation: "SKIP",
      reason: "Critical risk level - requires manual review before any code changes",
    };
  }

  // SKIP: No economic impact (unless it's investigation/monitor type)
  if (!impact.hasImpact && context.decisionType !== "diagnose" && context.decisionType !== "monitor") {
    return {
      recommendation: "SKIP",
      reason: "No quantifiable economic impact identified",
    };
  }

  // SKIP: Below minimum impact threshold
  if (impact.hasImpact && impact.estimatedMonthlyEur < criteria.minMonthlyImpact) {
    return {
      recommendation: "SKIP",
      reason: `Estimated impact €${impact.estimatedMonthlyEur}/month below €${criteria.minMonthlyImpact} threshold`,
    };
  }

  // REVIEW: Low confidence
  if (confidence < criteria.minConfidence) {
    return {
      recommendation: "REVIEW",
      reason: `Low mapping confidence (${(confidence * 100).toFixed(0)}%) - needs human review`,
    };
  }

  // REVIEW: High risk
  if (riskLevel === "high") {
    return {
      recommendation: "REVIEW",
      reason: "High risk level - recommend human review before proceeding",
    };
  }

  // REVIEW: Investigation/diagnose tasks (no code changes, just analysis)
  if (context.decisionType === "diagnose" || context.decisionType === "monitor") {
    return {
      recommendation: "REVIEW",
      reason: `Task type "${context.decisionType}" requires analysis, not code changes`,
    };
  }

  // DO: All criteria met
  return {
    recommendation: "DO",
    reason: `€${impact.estimatedMonthlyEur}/month impact, ${riskLevel} risk, ${(confidence * 100).toFixed(0)}% confidence`,
  };
}

// ============================================================================
// BATCH MAPPING
// ============================================================================

export async function mapAllTasks(tasks: KanbanTask[]): Promise<TaskCodeMapping[]> {
  const mappings: TaskCodeMapping[] = [];

  for (const task of tasks) {
    try {
      const mapping = await mapTaskToCode(task);
      mappings.push(mapping);
    } catch (error) {
      console.error(`Failed to map task ${task.id}: ${(error as Error).message}`);
    }
  }

  // Sort by recommendation priority (DO > REVIEW > SKIP) then by impact
  mappings.sort((a, b) => {
    const recOrder: Record<Recommendation, number> = { DO: 0, REVIEW: 1, SKIP: 2 };
    if (recOrder[a.recommendation] !== recOrder[b.recommendation]) {
      return recOrder[a.recommendation] - recOrder[b.recommendation];
    }
    return b.economicImpact.estimatedMonthlyEur - a.economicImpact.estimatedMonthlyEur;
  });

  return mappings;
}
