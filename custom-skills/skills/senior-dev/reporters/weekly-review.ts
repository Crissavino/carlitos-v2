/**
 * Weekly Code Impact Review (T10.2.5)
 *
 * Transforms TaskCodeMappings into a human-readable weekly review.
 * Grouped by recommendation (DO/REVIEW/SKIP) with economic impact summary.
 *
 * NO code generation, NO diffs, NO GitHub interaction.
 * Ends with explicit human approval question.
 */

import type {
  TaskCodeMapping,
  Recommendation,
  RiskLevel,
  ImpactType,
} from "../task-mapper/types.js";

// ============================================================================
// TYPES
// ============================================================================

export interface WeeklyCodeReview {
  weekNumber: number;
  year: number;
  generatedAt: string;

  // Summary
  totalTasks: number;
  doCount: number;
  reviewCount: number;
  skipCount: number;

  // Grouped mappings
  doItems: ReviewItem[];
  reviewItems: ReviewItem[];
  skipItems: ReviewItem[];

  // Economic summary
  totalPotentialImpact: number;
  doImpact: number;
  reviewImpact: number;

  // Formatted output
  formattedReport: string;
}

export interface ReviewItem {
  taskId: number;
  title: string;
  area: string;
  priority: string;

  // Impact
  monthlyImpactEur: number;
  impactType: ImpactType;

  // Risk & Confidence
  riskLevel: RiskLevel;
  confidence: number;

  // Code scope
  moduleCount: number;
  fileCount: number;
  primaryModules: string[];

  // Recommendation
  recommendation: Recommendation;
  reason: string;
}

// ============================================================================
// ICONS & FORMATTING
// ============================================================================

const RECOMMENDATION_ICONS: Record<Recommendation, string> = {
  DO: "✅",
  REVIEW: "👁️",
  SKIP: "⏭️",
};

const RISK_ICONS: Record<RiskLevel, string> = {
  critical: "🔴",
  high: "🟠",
  medium: "🟡",
  low: "🟢",
  minimal: "⚪",
};

const PRIORITY_ICONS: Record<string, string> = {
  critical: "🔴",
  high: "🟠",
  medium: "🟡",
  low: "🟢",
};

const IMPACT_LABELS: Record<ImpactType, string> = {
  revenue_increase: "↑ Revenue",
  cost_reduction: "↓ Costs",
  waste_prevention: "🛡️ Waste Prevention",
  efficiency_gain: "⚡ Efficiency",
  risk_mitigation: "🔒 Risk Mitigation",
  none: "—",
};

// ============================================================================
// MAIN GENERATOR
// ============================================================================

export function generateWeeklyReview(mappings: TaskCodeMapping[]): WeeklyCodeReview {
  const now = new Date();
  const weekNumber = getISOWeek(now);
  const year = now.getFullYear();

  // Group by recommendation
  const doMappings = mappings.filter((m) => m.recommendation === "DO");
  const reviewMappings = mappings.filter((m) => m.recommendation === "REVIEW");
  const skipMappings = mappings.filter((m) => m.recommendation === "SKIP");

  // Convert to review items
  const doItems = doMappings.map(toReviewItem);
  const reviewItems = reviewMappings.map(toReviewItem);
  const skipItems = skipMappings.map(toReviewItem);

  // Calculate impacts
  const doImpact = doItems.reduce((sum, i) => sum + i.monthlyImpactEur, 0);
  const reviewImpact = reviewItems.reduce((sum, i) => sum + i.monthlyImpactEur, 0);
  const totalPotentialImpact = doImpact + reviewImpact;

  const review: WeeklyCodeReview = {
    weekNumber,
    year,
    generatedAt: now.toISOString(),
    totalTasks: mappings.length,
    doCount: doItems.length,
    reviewCount: reviewItems.length,
    skipCount: skipItems.length,
    doItems,
    reviewItems,
    skipItems,
    totalPotentialImpact,
    doImpact,
    reviewImpact,
    formattedReport: "", // Will be set below
  };

  review.formattedReport = formatWeeklyReview(review);
  return review;
}

function toReviewItem(mapping: TaskCodeMapping): ReviewItem {
  return {
    taskId: mapping.taskId,
    title: mapping.taskTitle,
    area: mapping.businessContext.area,
    priority: mapping.businessContext.priority,
    monthlyImpactEur: mapping.economicImpact.estimatedMonthlyEur,
    impactType: mapping.economicImpact.impactType,
    riskLevel: mapping.riskLevel,
    confidence: mapping.confidence,
    moduleCount: mapping.affectedModules.length,
    fileCount: mapping.affectedFiles.length,
    primaryModules: mapping.affectedModules
      .filter((m) => m.relevance === "primary")
      .map((m) => m.name),
    recommendation: mapping.recommendation,
    reason: mapping.recommendationReason,
  };
}

// ============================================================================
// REPORT FORMATTING
// ============================================================================

export function formatWeeklyReview(review: WeeklyCodeReview): string {
  const lines: string[] = [];

  // Header
  lines.push("╔══════════════════════════════════════════════════════════════════════╗");
  lines.push("║           📊 WEEKLY CODE IMPACT REVIEW                               ║");
  lines.push(`║           Week ${review.weekNumber} / ${review.year}                                          ║`);
  lines.push("╚══════════════════════════════════════════════════════════════════════╝");
  lines.push("");

  // Summary Box
  lines.push("┌─────────────────────────────────────────────────────────────────────┐");
  lines.push("│ SUMMARY                                                             │");
  lines.push("├─────────────────────────────────────────────────────────────────────┤");
  lines.push(`│  Total Tasks Analyzed:  ${review.totalTasks.toString().padEnd(4)}                                      │`);
  lines.push(`│  ✅ Ready to Proceed:   ${review.doCount.toString().padEnd(4)}  (€${review.doImpact.toLocaleString()}/month)                     │`);
  lines.push(`│  👁️ Needs Human Review: ${review.reviewCount.toString().padEnd(4)}  (€${review.reviewImpact.toLocaleString()}/month potential)           │`);
  lines.push(`│  ⏭️ Skipped:            ${review.skipCount.toString().padEnd(4)}  (no economic justification)            │`);
  lines.push("├─────────────────────────────────────────────────────────────────────┤");
  lines.push(`│  💰 TOTAL POTENTIAL IMPACT: €${review.totalPotentialImpact.toLocaleString()}/month                        │`);
  lines.push("└─────────────────────────────────────────────────────────────────────┘");
  lines.push("");

  // DO Section
  if (review.doItems.length > 0) {
    lines.push("═══════════════════════════════════════════════════════════════════════");
    lines.push("✅ READY TO PROCEED (DO)");
    lines.push("   These tasks have clear economic impact and manageable risk.");
    lines.push("═══════════════════════════════════════════════════════════════════════");
    lines.push("");

    for (const item of review.doItems) {
      lines.push(formatReviewItem(item));
    }
  }

  // REVIEW Section
  if (review.reviewItems.length > 0) {
    lines.push("═══════════════════════════════════════════════════════════════════════");
    lines.push("👁️ NEEDS HUMAN REVIEW");
    lines.push("   These tasks require your decision before proceeding.");
    lines.push("═══════════════════════════════════════════════════════════════════════");
    lines.push("");

    for (const item of review.reviewItems) {
      lines.push(formatReviewItem(item));
    }
  }

  // SKIP Section (condensed)
  if (review.skipItems.length > 0) {
    lines.push("═══════════════════════════════════════════════════════════════════════");
    lines.push("⏭️ SKIPPED (no action recommended)");
    lines.push("═══════════════════════════════════════════════════════════════════════");
    lines.push("");

    for (const item of review.skipItems) {
      lines.push(formatSkippedItem(item));
    }
    lines.push("");
  }

  // Footer with action prompt
  lines.push("═══════════════════════════════════════════════════════════════════════");
  lines.push("");

  if (review.doItems.length > 0) {
    lines.push("┌─────────────────────────────────────────────────────────────────────┐");
    lines.push("│ 🤔 NEXT STEP                                                        │");
    lines.push("├─────────────────────────────────────────────────────────────────────┤");
    lines.push(`│  ${review.doCount} task(s) ready for implementation.                              │`);
    lines.push(`│  Estimated impact: €${review.doImpact.toLocaleString()}/month                                    │`);
    lines.push("│                                                                     │");
    lines.push("│  ❓ ¿Querés que prepare PRs para los items DO?                      │");
    lines.push("│                                                                     │");
    lines.push("│  Options:                                                           │");
    lines.push("│    • 'yes' or 'sí' → Prepare PR proposals for all DO items          │");
    lines.push("│    • 'select X,Y'  → Prepare PRs only for specific task IDs         │");
    lines.push("│    • 'no'          → Skip PR generation for now                     │");
    lines.push("└─────────────────────────────────────────────────────────────────────┘");
  } else if (review.reviewItems.length > 0) {
    lines.push("┌─────────────────────────────────────────────────────────────────────┐");
    lines.push("│ 🤔 NEXT STEP                                                        │");
    lines.push("├─────────────────────────────────────────────────────────────────────┤");
    lines.push("│  No tasks automatically approved for implementation.                │");
    lines.push(`│  ${review.reviewCount} task(s) need your review first.                              │`);
    lines.push("│                                                                     │");
    lines.push("│  ❓ ¿Querés aprobar alguno de los items REVIEW?                     │");
    lines.push("│                                                                     │");
    lines.push("│  Options:                                                           │");
    lines.push("│    • 'approve X,Y' → Approve specific tasks for PR generation       │");
    lines.push("│    • 'details X'   → Get more details on a specific task            │");
    lines.push("│    • 'skip'        → No action this week                            │");
    lines.push("└─────────────────────────────────────────────────────────────────────┘");
  } else {
    lines.push("┌─────────────────────────────────────────────────────────────────────┐");
    lines.push("│ ✨ NO ACTION NEEDED                                                 │");
    lines.push("├─────────────────────────────────────────────────────────────────────┤");
    lines.push("│  All analyzed tasks were skipped due to:                            │");
    lines.push("│    • No quantifiable economic impact, or                            │");
    lines.push("│    • Risk level too high for automated changes                      │");
    lines.push("│                                                                     │");
    lines.push("│  Review skipped tasks above if you want to override.                │");
    lines.push("└─────────────────────────────────────────────────────────────────────┘");
  }

  lines.push("");
  lines.push(`Generated: ${new Date(review.generatedAt).toLocaleString()}`);

  return lines.join("\n");
}

function formatReviewItem(item: ReviewItem): string {
  const lines: string[] = [];
  const riskIcon = RISK_ICONS[item.riskLevel];
  const priorityIcon = PRIORITY_ICONS[item.priority] || "⚪";
  const impactLabel = IMPACT_LABELS[item.impactType];

  lines.push(`┌─ #${item.taskId} ─────────────────────────────────────────────────────────`);
  lines.push(`│ ${item.title}`);
  lines.push(`│`);
  lines.push(`│ Area: ${item.area.toUpperCase()}  │  Priority: ${priorityIcon} ${item.priority}  │  Risk: ${riskIcon} ${item.riskLevel}`);
  lines.push(`│`);
  lines.push(`│ 💰 Impact: €${item.monthlyImpactEur.toLocaleString()}/month (${impactLabel})`);
  lines.push(`│ 📊 Confidence: ${(item.confidence * 100).toFixed(0)}%`);
  lines.push(`│`);
  lines.push(`│ 📁 Scope: ${item.fileCount} files in ${item.moduleCount} modules`);
  if (item.primaryModules.length > 0) {
    lines.push(`│    Primary: ${item.primaryModules.join(", ")}`);
  }
  lines.push(`│`);
  lines.push(`│ 📝 ${item.reason}`);
  lines.push(`└──────────────────────────────────────────────────────────────────────`);
  lines.push("");

  return lines.join("\n");
}

function formatSkippedItem(item: ReviewItem): string {
  const riskIcon = RISK_ICONS[item.riskLevel];
  return `  ${riskIcon} #${item.taskId} ${item.title}\n     └─ ${item.reason}\n`;
}

// ============================================================================
// UTILITIES
// ============================================================================

function getISOWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

// ============================================================================
// JSON OUTPUT (for programmatic use)
// ============================================================================

export function toJson(review: WeeklyCodeReview): string {
  // Return without formattedReport to keep JSON clean
  const { formattedReport, ...jsonReview } = review;
  return JSON.stringify(jsonReview, null, 2);
}
