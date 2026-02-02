/**
 * PR Proposal Generator (T10.3 v1)
 *
 * Generates structured PR proposals from TaskCodeMappings.
 * NO commits, NO diffs, NO GitHub API.
 * Output: Text ready for manual GitHub PR creation.
 */

import type { TaskCodeMapping } from "../task-mapper/types.js";
import type {
  PrProposal,
  PrProposalBatch,
  ProblemContext,
  EconomicImpactSection,
  ChangeScope,
  RiskSection,
  ValidationChecklist,
  ChangeType,
  ModuleChange,
  FileChange,
  ValidationItem,
} from "./types.js";
import {
  CHANGE_TYPE_LABELS,
  RISK_LABELS,
  IMPACT_TYPE_LABELS,
} from "./types.js";

// ============================================================================
// MAIN GENERATOR
// ============================================================================

export function generatePrProposal(mapping: TaskCodeMapping): PrProposal {
  const id = `PR-${mapping.taskId}-${Date.now().toString(36)}`;

  const context = buildProblemContext(mapping);
  const impact = buildEconomicImpact(mapping);
  const scope = buildChangeScope(mapping);
  const risks = buildRiskSection(mapping);
  const validation = buildValidationChecklist(mapping, scope);

  const proposal: PrProposal = {
    id,
    taskId: mapping.taskId,
    generatedAt: new Date().toISOString(),
    title: generatePrTitle(mapping),
    branchName: generateBranchName(mapping),
    labels: generateLabels(mapping),
    context,
    impact,
    scope,
    risks,
    validation,
    formattedProposal: "", // Set below
  };

  proposal.formattedProposal = formatPrProposal(proposal);
  return proposal;
}

export function generatePrProposals(mappings: TaskCodeMapping[]): PrProposalBatch {
  // Filter to DO items only
  const doMappings = mappings.filter((m) => m.recommendation === "DO");

  const proposals = doMappings.map(generatePrProposal);
  const totalImpact = proposals.reduce((sum, p) => sum + p.impact.monthlyEur, 0);

  return {
    generatedAt: new Date().toISOString(),
    totalProposals: proposals.length,
    totalEstimatedImpact: totalImpact,
    proposals,
    summary: formatBatchSummary(proposals, totalImpact),
  };
}

// ============================================================================
// TITLE & BRANCH NAME
// ============================================================================

function generatePrTitle(mapping: TaskCodeMapping): string {
  const changeType = mapToChangeType(mapping.changeType);
  const prefix = getChangeTypePrefix(changeType);
  const area = mapping.businessContext.area;

  // Clean and truncate title
  let title = mapping.taskTitle
    .replace(/^(FREEZE|BLOCK|DIAGNOSE|OPTIMIZE|MONITOR|SCALE|FIX|ADD|UPDATE)[\s:]+/i, "")
    .replace(/[:\-–—]+\s*/g, " - ")
    .trim();

  // Truncate if too long
  if (title.length > 50) {
    title = title.substring(0, 47) + "...";
  }

  return `${prefix}(${area}): ${title}`;
}

function getChangeTypePrefix(changeType: ChangeType): string {
  switch (changeType) {
    case "bugfix": return "fix";
    case "optimization": return "perf";
    case "logic_change": return "feat";
    case "configuration": return "config";
    case "feature": return "feat";
    case "refactor": return "refactor";
    default: return "chore";
  }
}

function generateBranchName(mapping: TaskCodeMapping): string {
  const changeType = mapToChangeType(mapping.changeType);
  const prefix = getChangeTypePrefix(changeType);
  const taskId = mapping.taskId;

  // Create slug from title
  const slug = mapping.taskTitle
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, "-")
    .substring(0, 30)
    .replace(/-+$/, "");

  return `${prefix}/task-${taskId}-${slug}`;
}

function generateLabels(mapping: TaskCodeMapping): string[] {
  const labels: string[] = [];

  // Change type label
  const changeType = mapToChangeType(mapping.changeType);
  labels.push(changeType);

  // Area label
  labels.push(`area:${mapping.businessContext.area}`);

  // Priority label
  labels.push(`priority:${mapping.businessContext.priority}`);

  // Impact label
  if (mapping.economicImpact.hasImpact) {
    if (mapping.economicImpact.estimatedMonthlyEur >= 1000) {
      labels.push("high-impact");
    } else if (mapping.economicImpact.estimatedMonthlyEur >= 500) {
      labels.push("medium-impact");
    }
  }

  // Risk label
  if (mapping.riskLevel === "high" || mapping.riskLevel === "medium") {
    labels.push(`risk:${mapping.riskLevel}`);
  }

  return labels;
}

// ============================================================================
// SECTION BUILDERS
// ============================================================================

function buildProblemContext(mapping: TaskCodeMapping): ProblemContext {
  return {
    taskTitle: mapping.taskTitle,
    taskId: mapping.taskId,
    taskUrl: `[Task #${mapping.taskId}](/tasks/${mapping.taskId})`, // Placeholder URL
    businessArea: mapping.businessContext.area,
    decisionRule: mapping.businessContext.decisionRuleId,
    description: mapping.businessContext.description,
    urgency: formatUrgency(mapping.businessContext.urgency),
  };
}

function formatUrgency(urgency: string): string {
  switch (urgency) {
    case "immediate": return "⚡ Immediate - requires action today";
    case "this_week": return "📅 This week - should be addressed within 7 days";
    case "next_week": return "📆 Next week - can be scheduled for next sprint";
    case "backlog": return "📥 Backlog - no time pressure";
    default: return urgency;
  }
}

function buildEconomicImpact(mapping: TaskCodeMapping): EconomicImpactSection {
  const impact = mapping.economicImpact;
  return {
    hasImpact: impact.hasImpact,
    monthlyEur: impact.estimatedMonthlyEur,
    annualEur: impact.estimatedAnnualEur,
    impactType: impact.impactType,
    calculation: impact.calculation,
    affectedKpis: mapping.affectedKpis.map((k) => k.fullName),
    confidence: formatConfidence(impact.confidence),
  };
}

function formatConfidence(confidence: string): string {
  switch (confidence) {
    case "high": return "High (based on historical data)";
    case "medium": return "Medium (based on rule-type estimates)";
    case "low": return "Low (rough estimate)";
    default: return confidence;
  }
}

function buildChangeScope(mapping: TaskCodeMapping): ChangeScope {
  const modules: ModuleChange[] = mapping.affectedModules.map((m) => ({
    name: m.name,
    path: m.path,
    relevance: m.relevance,
    changeDescription: m.reason,
  }));

  const files: FileChange[] = mapping.affectedFiles.map((f) => ({
    path: f.path,
    action: f.changeType,
    description: f.reason,
    estimatedLines: f.estimatedLines,
  }));

  const estimatedLines = files.reduce((sum, f) => sum + f.estimatedLines, 0);

  return {
    changeType: mapToChangeType(mapping.changeType),
    complexity: mapping.estimatedComplexity,
    modules,
    files,
    estimatedLinesChanged: estimatedLines,
  };
}

function mapToChangeType(type: string): ChangeType {
  switch (type) {
    case "bug_fix": return "bugfix";
    case "optimization": return "optimization";
    case "feature": return "feature";
    case "refactor": return "refactor";
    case "configuration": return "configuration";
    case "investigation":
    case "data_analysis":
      return "logic_change";
    default: return "logic_change";
  }
}

function buildRiskSection(mapping: TaskCodeMapping): RiskSection {
  const rollbackPlan = generateRollbackPlan(mapping);
  const mitigations = generateMitigations(mapping);

  return {
    level: mapping.riskLevel,
    factors: mapping.riskFactors,
    rollbackPlan,
    mitigations,
  };
}

function generateRollbackPlan(mapping: TaskCodeMapping): string {
  const changeType = mapToChangeType(mapping.changeType);

  switch (changeType) {
    case "configuration":
      return "Revert configuration change to previous values. No code deployment required.";
    case "bugfix":
      return "Revert the commit and redeploy previous version. Monitor affected KPIs.";
    case "optimization":
      return "Revert optimization changes. Performance may degrade to previous levels.";
    case "logic_change":
      return "Revert logic changes and verify decision outputs match previous behavior.";
    case "feature":
      return "Disable feature flag or revert commit. Communicate to affected users if needed.";
    case "refactor":
      return "Revert refactor changes. Functionality should remain identical.";
    default:
      return "Revert to previous commit and redeploy.";
  }
}

function generateMitigations(mapping: TaskCodeMapping): string[] {
  const mitigations: string[] = [];

  // Based on risk factors
  for (const factor of mapping.riskFactors) {
    if (factor.includes("revenue") || factor.includes("cost")) {
      mitigations.push("Add logging to track financial calculations before/after change");
      mitigations.push("Deploy during low-traffic period");
    }
    if (factor.includes("decision")) {
      mitigations.push("Run decision engine in shadow mode first to compare outputs");
    }
    if (factor.includes("multiple modules")) {
      mitigations.push("Deploy changes incrementally, one module at a time");
    }
    if (factor.includes("core module")) {
      mitigations.push("Extensive code review required before merge");
      mitigations.push("Add integration tests for affected flows");
    }
  }

  // Default mitigations
  if (mitigations.length === 0) {
    mitigations.push("Standard code review process");
    mitigations.push("Run existing test suite");
  }

  return [...new Set(mitigations)]; // Remove duplicates
}

function buildValidationChecklist(mapping: TaskCodeMapping, scope: ChangeScope): ValidationChecklist {
  const items: ValidationItem[] = [];
  const testCommands: string[] = [];
  const manualChecks: string[] = [];

  // Standard items
  items.push({
    description: "Code compiles without errors",
    type: "automated",
    priority: "required",
  });

  items.push({
    description: "All existing tests pass",
    type: "automated",
    priority: "required",
  });

  testCommands.push("npm run build");
  testCommands.push("npm run test");

  // Based on change type
  switch (scope.changeType) {
    case "bugfix":
      items.push({
        description: "Bug is reproducible before fix",
        type: "manual",
        priority: "required",
      });
      items.push({
        description: "Bug is fixed after change",
        type: "manual",
        priority: "required",
      });
      manualChecks.push("Verify the original bug no longer occurs");
      break;

    case "configuration":
      items.push({
        description: "Configuration change applied correctly",
        type: "manual",
        priority: "required",
      });
      items.push({
        description: "System behavior matches expected with new config",
        type: "manual",
        priority: "required",
      });
      manualChecks.push("Verify new threshold/config values are active");
      break;

    case "logic_change":
      items.push({
        description: "Decision outputs are correct with new logic",
        type: "manual",
        priority: "required",
      });
      items.push({
        description: "Edge cases handled correctly",
        type: "manual",
        priority: "recommended",
      });
      manualChecks.push("Run decision engine and verify outputs match expectations");
      break;

    case "optimization":
      items.push({
        description: "Performance improvement measured",
        type: "manual",
        priority: "recommended",
      });
      items.push({
        description: "No regression in functionality",
        type: "automated",
        priority: "required",
      });
      manualChecks.push("Compare execution time before/after");
      break;
  }

  // Based on affected KPIs
  if (mapping.affectedKpis.length > 0) {
    items.push({
      description: `Verify affected KPIs (${mapping.affectedKpis.map(k => k.name).join(", ")}) calculate correctly`,
      type: "manual",
      priority: "required",
    });
    manualChecks.push("Run business-expert summary and verify KPI values");
    testCommands.push("node dist/skills/business-expert/cli.js kpis");
  }

  // Based on affected modules
  for (const mod of scope.modules.filter((m) => m.relevance === "primary")) {
    if (mod.name.includes("decision-engine")) {
      testCommands.push("node dist/skills/decision-engine/cli.js evaluate");
      manualChecks.push("Verify decision rules evaluate correctly");
    }
    if (mod.name.includes("google-ads-expert")) {
      manualChecks.push("Verify ads data is processed correctly");
    }
  }

  // Visual check for dashboard changes
  if (scope.modules.some((m) => m.name.includes("dashboard") || m.name.includes("frontend"))) {
    items.push({
      description: "UI displays correctly",
      type: "visual",
      priority: "required",
    });
    manualChecks.push("Open dashboard and verify affected views render correctly");
  }

  return {
    items,
    testCommands: [...new Set(testCommands)],
    manualChecks: [...new Set(manualChecks)],
  };
}

// ============================================================================
// FORMATTING
// ============================================================================

export function formatPrProposal(proposal: PrProposal): string {
  const lines: string[] = [];

  // Header
  lines.push("═".repeat(78));
  lines.push(`PR PROPOSAL: ${proposal.title}`);
  lines.push("═".repeat(78));
  lines.push("");
  lines.push(`Branch: \`${proposal.branchName}\``);
  lines.push(`Labels: ${proposal.labels.join(", ")}`);
  lines.push(`Generated: ${new Date(proposal.generatedAt).toLocaleString()}`);
  lines.push("");

  // Problem Context
  lines.push("## 📋 Problem Context");
  lines.push("");
  lines.push(`**Task:** ${proposal.context.taskUrl}`);
  lines.push(`**Area:** ${proposal.context.businessArea}`);
  if (proposal.context.decisionRule) {
    lines.push(`**Decision Rule:** \`${proposal.context.decisionRule}\``);
  }
  lines.push(`**Urgency:** ${proposal.context.urgency}`);
  lines.push("");
  lines.push("### Description");
  lines.push("");
  lines.push(proposal.context.description);
  lines.push("");

  // Economic Impact
  lines.push("## 💰 Economic Impact");
  lines.push("");
  if (proposal.impact.hasImpact) {
    lines.push(`| Metric | Value |`);
    lines.push(`|--------|-------|`);
    lines.push(`| Monthly Impact | **€${proposal.impact.monthlyEur.toLocaleString()}** |`);
    lines.push(`| Annual Impact | €${proposal.impact.annualEur.toLocaleString()} |`);
    lines.push(`| Impact Type | ${IMPACT_TYPE_LABELS[proposal.impact.impactType]} |`);
    lines.push(`| Confidence | ${proposal.impact.confidence} |`);
    lines.push("");
    lines.push(`**Calculation:** ${proposal.impact.calculation}`);
    lines.push("");
    if (proposal.impact.affectedKpis.length > 0) {
      lines.push(`**Affected KPIs:** ${proposal.impact.affectedKpis.join(", ")}`);
      lines.push("");
    }
  } else {
    lines.push("No quantifiable economic impact identified.");
    lines.push("");
  }

  // Change Scope
  lines.push("## 📁 Change Scope");
  lines.push("");
  lines.push(`| Property | Value |`);
  lines.push(`|----------|-------|`);
  lines.push(`| Change Type | ${CHANGE_TYPE_LABELS[proposal.scope.changeType]} |`);
  lines.push(`| Complexity | ${proposal.scope.complexity} |`);
  lines.push(`| Estimated Lines | ~${proposal.scope.estimatedLinesChanged} |`);
  lines.push("");

  // Affected Modules
  if (proposal.scope.modules.length > 0) {
    lines.push("### Affected Modules");
    lines.push("");
    for (const mod of proposal.scope.modules) {
      const relevanceIcon = mod.relevance === "primary" ? "🔴" :
                            mod.relevance === "secondary" ? "🟡" : "⚪";
      lines.push(`- ${relevanceIcon} **${mod.name}** (${mod.relevance})`);
      lines.push(`  - ${mod.changeDescription}`);
    }
    lines.push("");
  }

  // Affected Files
  if (proposal.scope.files.length > 0) {
    lines.push("### Affected Files");
    lines.push("");
    lines.push("| File | Action | Est. Lines |");
    lines.push("|------|--------|------------|");
    for (const file of proposal.scope.files) {
      const actionIcon = file.action === "modify" ? "📝" :
                         file.action === "create" ? "➕" :
                         file.action === "delete" ? "➖" : "👁️";
      lines.push(`| \`${file.path}\` | ${actionIcon} ${file.action} | ~${file.estimatedLines} |`);
    }
    lines.push("");
  }

  // Risks & Rollback
  lines.push("## ⚠️ Risks & Rollback");
  lines.push("");
  lines.push(`**Risk Level:** ${RISK_LABELS[proposal.risks.level]}`);
  lines.push("");

  if (proposal.risks.factors.length > 0) {
    lines.push("### Risk Factors");
    lines.push("");
    for (const factor of proposal.risks.factors) {
      lines.push(`- ${factor}`);
    }
    lines.push("");
  }

  lines.push("### Rollback Plan");
  lines.push("");
  lines.push(proposal.risks.rollbackPlan);
  lines.push("");

  if (proposal.risks.mitigations.length > 0) {
    lines.push("### Mitigations");
    lines.push("");
    for (const mitigation of proposal.risks.mitigations) {
      lines.push(`- [ ] ${mitigation}`);
    }
    lines.push("");
  }

  // Validation Checklist
  lines.push("## ✅ Validation Checklist");
  lines.push("");

  lines.push("### Automated Checks");
  lines.push("");
  lines.push("```bash");
  for (const cmd of proposal.validation.testCommands) {
    lines.push(cmd);
  }
  lines.push("```");
  lines.push("");

  lines.push("### Manual Verification");
  lines.push("");
  for (const item of proposal.validation.items) {
    const priorityTag = item.priority === "required" ? "[REQUIRED]" :
                        item.priority === "recommended" ? "[RECOMMENDED]" : "[OPTIONAL]";
    lines.push(`- [ ] ${priorityTag} ${item.description}`);
  }
  lines.push("");

  if (proposal.validation.manualChecks.length > 0) {
    lines.push("### How to Test");
    lines.push("");
    for (let i = 0; i < proposal.validation.manualChecks.length; i++) {
      lines.push(`${i + 1}. ${proposal.validation.manualChecks[i]}`);
    }
    lines.push("");
  }

  // Footer
  lines.push("─".repeat(78));
  lines.push("");
  lines.push("*This PR proposal was generated by OpenClaw SeniorDev skill.*");
  lines.push("*Review carefully before creating the actual PR.*");

  return lines.join("\n");
}

function formatBatchSummary(proposals: PrProposal[], totalImpact: number): string {
  const lines: string[] = [];

  lines.push("╔══════════════════════════════════════════════════════════════════════════╗");
  lines.push("║                    📝 PR PROPOSALS GENERATED                             ║");
  lines.push("╚══════════════════════════════════════════════════════════════════════════╝");
  lines.push("");
  lines.push(`Total Proposals: ${proposals.length}`);
  lines.push(`Total Estimated Impact: €${totalImpact.toLocaleString()}/month`);
  lines.push("");
  lines.push("┌───────┬─────────────────────────────────────────────┬──────────┬────────┐");
  lines.push("│ Task  │ Title                                       │ Impact   │ Risk   │");
  lines.push("├───────┼─────────────────────────────────────────────┼──────────┼────────┤");

  for (const p of proposals) {
    const taskId = `#${p.taskId}`.padEnd(5);
    const title = p.title.length > 43 ? p.title.substring(0, 40) + "..." : p.title.padEnd(43);
    const impact = `€${p.impact.monthlyEur}`.padStart(8);
    const risk = p.risks.level.padEnd(6);
    lines.push(`│ ${taskId} │ ${title} │ ${impact} │ ${risk} │`);
  }

  lines.push("└───────┴─────────────────────────────────────────────┴──────────┴────────┘");
  lines.push("");
  lines.push("To view a specific proposal:");
  lines.push("  node cli.js pr-proposal <task-id>");
  lines.push("");
  lines.push("To create PRs manually:");
  lines.push("  1. Review each proposal below");
  lines.push("  2. Create branch: git checkout -b <branch-name>");
  lines.push("  3. Make changes as described");
  lines.push("  4. Create PR with the formatted description");

  return lines.join("\n");
}
