#!/usr/bin/env node
/**
 * SeniorDev CLI
 *
 * Entry point for OpenClaw's Senior Developer skill.
 * Usage: node cli.js [command] [args]
 *
 * Commands:
 *   T10.1 - Repo Awareness:
 *     index         - Generate/update codebase index
 *     status        - Show index status
 *     find <query>  - Find files/modules matching query
 *     explain <path> - Explain what a file does
 *     modules       - List all modules
 *     skills        - List all detected skills
 *     apis          - List all API endpoints
 *     deps <module> - Show module dependencies
 *
 *   T10.2 - Task → Code Mapping:
 *     map-task <id> - Map a single task to code modules
 *     map-tasks     - Map all pending tasks
 */

import * as path from "path";

import { indexCodebase, saveIndex, loadIndex, indexExists } from "./repo/indexer.js";
import {
  find,
  explain,
  listModules,
  listSkills,
  listApis,
  getModuleDependencies,
} from "./repo/navigator.js";
import { mapTaskToCode, mapAllTasks } from "./task-mapper/mapper.js";
import type { IndexStatus } from "./types.js";
import type { TaskCodeMapping, KanbanTask, Recommendation } from "./task-mapper/types.js";

// Default repo path - the openclaw custom-skills source directory
// When running from dist/, we need to go up to custom-skills/ (source root)
function getRepoPath(): string {
  const dirname = import.meta.dirname;
  // Check if we're running from dist/
  if (dirname.includes("/dist/")) {
    // Go from dist/skills/senior-dev to custom-skills/
    return dirname.replace(/\/dist\/.*$/, "");
  }
  // Running from source
  return path.resolve(dirname, "../..");
}

const DEFAULT_REPO_PATH = getRepoPath();

async function main() {
  const command = process.argv[2] || "help";
  const args = process.argv.slice(3);

  switch (command) {
    case "index": {
      await cmdIndex();
      break;
    }

    case "status": {
      await cmdStatus();
      break;
    }

    case "find": {
      const query = args.join(" ");
      if (!query) {
        console.error("Error: Query required. Usage: find <query>");
        process.exit(1);
      }
      await cmdFind(query);
      break;
    }

    case "explain": {
      const filePath = args[0];
      if (!filePath) {
        console.error("Error: File path required. Usage: explain <path>");
        process.exit(1);
      }
      await cmdExplain(filePath);
      break;
    }

    case "modules": {
      await cmdModules();
      break;
    }

    case "skills": {
      await cmdSkills();
      break;
    }

    case "apis": {
      await cmdApis();
      break;
    }

    case "deps": {
      const moduleName = args[0];
      if (!moduleName) {
        console.error("Error: Module name required. Usage: deps <module>");
        process.exit(1);
      }
      await cmdDeps(moduleName);
      break;
    }

    // ========== T10.2 - Task → Code Mapping ==========

    case "map-task": {
      const taskId = parseInt(args[0], 10);
      if (isNaN(taskId)) {
        console.error("Error: Task ID required. Usage: map-task <id>");
        process.exit(1);
      }
      await cmdMapTask(taskId);
      break;
    }

    case "map-tasks": {
      const statusFilter = args[0];
      await cmdMapTasks(statusFilter);
      break;
    }

    case "help":
    default: {
      printHelp();
      break;
    }
  }
}

// ============================================================================
// COMMANDS
// ============================================================================

async function cmdIndex(): Promise<void> {
  console.log("Indexing codebase...");
  const startTime = Date.now();

  const index = await indexCodebase(DEFAULT_REPO_PATH);
  await saveIndex(index);

  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log("");
  console.log(`Indexed in ${duration}s`);
  console.log(`  Files:    ${index.files.length}`);
  console.log(`  Modules:  ${index.modules.length}`);
  console.log(`  Skills:   ${index.patterns.skills.length}`);
  console.log(`  APIs:     ${index.patterns.apis.length}`);
  console.log(`  Tables:   ${index.patterns.dbTables.length}`);
  console.log("");
  console.log(`Branch: ${index.gitBranch} (${index.gitCommit})`);
}

async function cmdStatus(): Promise<void> {
  const exists = await indexExists();

  if (!exists) {
    console.log("Index: NOT FOUND");
    console.log("");
    console.log("Run 'index' command to generate the codebase index.");
    return;
  }

  const index = await loadIndex();
  if (!index) {
    console.log("Index: ERROR (could not load)");
    return;
  }

  const status: IndexStatus = {
    exists: true,
    indexedAt: index.indexedAt,
    gitBranch: index.gitBranch,
    gitCommit: index.gitCommit,
    moduleCount: index.modules.length,
    fileCount: index.files.length,
    skillCount: index.patterns.skills.length,
    apiCount: index.patterns.apis.length,
  };

  console.log(`Index from: ${status.indexedAt}`);
  console.log(`Branch:     ${status.gitBranch} (${status.gitCommit})`);
  console.log(`Modules:    ${status.moduleCount}`);
  console.log(`Files:      ${status.fileCount}`);
  console.log(`Skills:     ${status.skillCount}`);
  console.log(`APIs:       ${status.apiCount}`);
}

async function cmdFind(query: string): Promise<void> {
  try {
    const results = await find(query);

    if (results.length === 0) {
      console.log(`No results found for: "${query}"`);
      return;
    }

    console.log(`Found ${results.length} result(s) for "${query}":\n`);

    for (const result of results) {
      const lineInfo = result.line ? `:${result.line}` : "";
      console.log(`[${result.type.toUpperCase()}] ${result.name}`);
      console.log(`  Path: ${result.path}${lineInfo}`);
      console.log(`  ${result.matchReason}`);
      console.log(`  Relevance: ${result.relevanceScore}`);
      console.log("");
    }
  } catch (error) {
    console.error("Error:", (error as Error).message);
    process.exit(1);
  }
}

async function cmdExplain(filePath: string): Promise<void> {
  try {
    const explanation = await explain(filePath);

    console.log(`File: ${explanation.path}`);
    console.log(`Module: ${explanation.module}`);
    console.log(`Purpose: ${explanation.purpose}`);
    console.log("");

    if (explanation.exports.length > 0) {
      console.log("Exports:");
      for (const exp of explanation.exports) {
        console.log(`  - ${exp.name} (${exp.type}, line ${exp.line})`);
      }
      console.log("");
    }

    if (explanation.imports.length > 0) {
      console.log("Imports:");
      for (const imp of explanation.imports) {
        const type = imp.isRelative ? "local" : "external";
        console.log(`  - ${imp.source} [${type}]`);
        if (imp.names.length > 0 && imp.names.length <= 5) {
          console.log(`    {${imp.names.join(", ")}}`);
        }
      }
      console.log("");
    }

    if (explanation.keyFunctions.length > 0) {
      console.log("Key Functions:");
      for (const func of explanation.keyFunctions) {
        const asyncTag = func.isAsync ? "async " : "";
        console.log(`  - ${asyncTag}${func.name}() [line ${func.line}]`);
        if (func.description) {
          console.log(`    ${func.description}`);
        }
      }
      console.log("");
    }

    if (explanation.relatedFiles.length > 0) {
      console.log("Related Files:");
      for (const file of explanation.relatedFiles.slice(0, 5)) {
        console.log(`  - ${file}`);
      }
    }
  } catch (error) {
    console.error("Error:", (error as Error).message);
    process.exit(1);
  }
}

async function cmdModules(): Promise<void> {
  try {
    const modules = await listModules();

    console.log(`Modules (${modules.length}):\n`);

    for (const mod of modules) {
      console.log(`[${mod.type.toUpperCase()}] ${mod.name}`);
      console.log(`  ${mod.description}`);
      console.log(`  Files: ${mod.linesOfCode} LOC`);
      if (mod.dependencies.length > 0) {
        console.log(`  Deps: ${mod.dependencies.join(", ")}`);
      }
      console.log("");
    }
  } catch (error) {
    console.error("Error:", (error as Error).message);
    process.exit(1);
  }
}

async function cmdSkills(): Promise<void> {
  try {
    const skills = await listSkills();

    console.log(`Skills (${skills.length}):\n`);

    for (const skill of skills) {
      const features = [];
      if (skill.hasIndex) features.push("index");
      if (skill.hasCli) features.push("cli");
      if (skill.hasTypes) features.push("types");

      console.log(`${skill.name}/`);
      console.log(`  Path: ${skill.path}`);
      console.log(`  Structure: [${features.join(", ")}]`);
      if (skill.commands.length > 0) {
        console.log(`  Commands: ${skill.commands.join(", ")}`);
      }
      if (skill.exports.length > 0) {
        console.log(`  Exports: ${skill.exports.slice(0, 5).join(", ")}${skill.exports.length > 5 ? "..." : ""}`);
      }
      console.log("");
    }
  } catch (error) {
    console.error("Error:", (error as Error).message);
    process.exit(1);
  }
}

async function cmdApis(): Promise<void> {
  try {
    const apis = await listApis();

    if (apis.length === 0) {
      console.log("No API endpoints detected.");
      return;
    }

    console.log(`API Endpoints (${apis.length}):\n`);

    for (const api of apis) {
      console.log(`${api.method.padEnd(6)} ${api.path}`);
      console.log(`  File: ${api.file}:${api.line}`);
      if (api.description) {
        console.log(`  ${api.description}`);
      }
      console.log("");
    }
  } catch (error) {
    console.error("Error:", (error as Error).message);
    process.exit(1);
  }
}

async function cmdDeps(moduleName: string): Promise<void> {
  try {
    const deps = await getModuleDependencies(moduleName);

    console.log(`Dependencies for: ${moduleName}\n`);

    if (deps.dependencies.length > 0) {
      console.log("Depends on:");
      for (const dep of deps.dependencies) {
        console.log(`  -> ${dep}`);
      }
    } else {
      console.log("Depends on: (none)");
    }

    console.log("");

    if (deps.dependents.length > 0) {
      console.log("Depended on by:");
      for (const dep of deps.dependents) {
        console.log(`  <- ${dep}`);
      }
    } else {
      console.log("Depended on by: (none)");
    }
  } catch (error) {
    console.error("Error:", (error as Error).message);
    process.exit(1);
  }
}

// ============================================================================
// T10.2 - TASK → CODE MAPPING COMMANDS
// ============================================================================

async function cmdMapTask(taskId: number): Promise<void> {
  try {
    // Fetch task from database
    const task = await fetchTaskById(taskId);
    if (!task) {
      console.error(`Error: Task #${taskId} not found`);
      process.exit(1);
    }

    console.log("Mapping task to code...\n");

    const mapping = await mapTaskToCode(task);
    printTaskMapping(mapping);

  } catch (error) {
    console.error("Error:", (error as Error).message);
    process.exit(1);
  }
}

async function cmdMapTasks(statusFilter?: string): Promise<void> {
  try {
    // Default to actionable statuses
    const statuses = statusFilter
      ? statusFilter.split(",")
      : ["backlog", "todo"];

    // Fetch tasks from database
    const tasks = await fetchTasks(statuses);

    if (tasks.length === 0) {
      console.log(`No tasks found with status: ${statuses.join(", ")}`);
      return;
    }

    console.log(`Mapping ${tasks.length} task(s) to code...\n`);

    const mappings = await mapAllTasks(tasks);

    // Summary by recommendation
    const doTasks = mappings.filter((m) => m.recommendation === "DO");
    const reviewTasks = mappings.filter((m) => m.recommendation === "REVIEW");
    const skipTasks = mappings.filter((m) => m.recommendation === "SKIP");

    console.log("═══════════════════════════════════════════════════════════════════");
    console.log("TASK → CODE MAPPING SUMMARY");
    console.log("═══════════════════════════════════════════════════════════════════");
    console.log("");
    console.log(`Total tasks:  ${mappings.length}`);
    console.log(`✅ DO:        ${doTasks.length}`);
    console.log(`👁️ REVIEW:    ${reviewTasks.length}`);
    console.log(`⏭️ SKIP:      ${skipTasks.length}`);
    console.log("");

    // Show DO tasks first
    if (doTasks.length > 0) {
      console.log("───────────────────────────────────────────────────────────────────");
      console.log("✅ TASKS READY TO PROCEED (DO)");
      console.log("───────────────────────────────────────────────────────────────────");
      for (const mapping of doTasks) {
        printMappingSummary(mapping);
      }
    }

    // Show REVIEW tasks
    if (reviewTasks.length > 0) {
      console.log("───────────────────────────────────────────────────────────────────");
      console.log("👁️ TASKS REQUIRING REVIEW");
      console.log("───────────────────────────────────────────────────────────────────");
      for (const mapping of reviewTasks) {
        printMappingSummary(mapping);
      }
    }

    // Show SKIP tasks (brief)
    if (skipTasks.length > 0) {
      console.log("───────────────────────────────────────────────────────────────────");
      console.log("⏭️ TASKS SKIPPED (no economic justification)");
      console.log("───────────────────────────────────────────────────────────────────");
      for (const mapping of skipTasks) {
        console.log(`  #${mapping.taskId} ${mapping.taskTitle}`);
        console.log(`     └─ ${mapping.recommendationReason}`);
        console.log("");
      }
    }

    // Total economic impact
    const totalImpact = mappings
      .filter((m) => m.recommendation !== "SKIP")
      .reduce((sum, m) => sum + m.economicImpact.estimatedMonthlyEur, 0);

    console.log("═══════════════════════════════════════════════════════════════════");
    console.log(`POTENTIAL MONTHLY IMPACT: €${totalImpact.toLocaleString()}/month`);
    console.log("═══════════════════════════════════════════════════════════════════");

  } catch (error) {
    console.error("Error:", (error as Error).message);
    process.exit(1);
  }
}

function printTaskMapping(mapping: TaskCodeMapping): void {
  const recIcon = getRecommendationIcon(mapping.recommendation);

  console.log("═══════════════════════════════════════════════════════════════════");
  console.log(`${recIcon} TASK #${mapping.taskId}: ${mapping.taskTitle}`);
  console.log("═══════════════════════════════════════════════════════════════════");
  console.log("");

  // Business Context
  console.log("BUSINESS CONTEXT");
  console.log("───────────────────────────────────────────────────────────────────");
  console.log(`  Area:        ${mapping.businessContext.area}`);
  console.log(`  Priority:    ${mapping.businessContext.priority}`);
  console.log(`  Urgency:     ${mapping.businessContext.urgency}`);
  if (mapping.businessContext.decisionRuleId) {
    console.log(`  Rule:        ${mapping.businessContext.decisionRuleId}`);
  }
  if (mapping.businessContext.decisionType) {
    console.log(`  Type:        ${mapping.businessContext.decisionType}`);
  }
  console.log("");

  // Affected KPIs
  if (mapping.affectedKpis.length > 0) {
    console.log("AFFECTED METRICS");
    console.log("───────────────────────────────────────────────────────────────────");
    for (const kpi of mapping.affectedKpis) {
      const impactArrow = kpi.expectedImpact === "improve" ? "↑" :
                          kpi.expectedImpact === "worsen" ? "↓" : "→";
      console.log(`  ${impactArrow} ${kpi.fullName} (${kpi.name})`);
      console.log(`     Impact: ${kpi.impactMagnitude} | Status: ${kpi.currentStatus}`);
    }
    console.log("");
  }

  // Affected Modules
  if (mapping.affectedModules.length > 0) {
    console.log("AFFECTED MODULES");
    console.log("───────────────────────────────────────────────────────────────────");
    for (const mod of mapping.affectedModules) {
      const relevance = mod.relevance === "primary" ? "🔴" :
                        mod.relevance === "secondary" ? "🟡" : "⚪";
      console.log(`  ${relevance} ${mod.name} [${mod.type}]`);
      console.log(`     └─ ${mod.reason}`);
    }
    console.log("");
  }

  // Affected Files
  if (mapping.affectedFiles.length > 0) {
    console.log("AFFECTED FILES");
    console.log("───────────────────────────────────────────────────────────────────");
    for (const file of mapping.affectedFiles.slice(0, 10)) {
      const changeIcon = file.changeType === "modify" ? "📝" :
                         file.changeType === "create" ? "➕" :
                         file.changeType === "delete" ? "➖" : "👁️";
      console.log(`  ${changeIcon} ${file.path}`);
      console.log(`     └─ ${file.reason} (~${file.estimatedLines} lines)`);
    }
    if (mapping.affectedFiles.length > 10) {
      console.log(`  ... and ${mapping.affectedFiles.length - 10} more files`);
    }
    console.log("");
  }

  // Change Analysis
  console.log("CHANGE ANALYSIS");
  console.log("───────────────────────────────────────────────────────────────────");
  console.log(`  Type:        ${mapping.changeType}`);
  console.log(`  Complexity:  ${mapping.estimatedComplexity}`);
  console.log("");

  // Risk Assessment
  console.log("RISK ASSESSMENT");
  console.log("───────────────────────────────────────────────────────────────────");
  const riskIcon = mapping.riskLevel === "critical" ? "🔴" :
                   mapping.riskLevel === "high" ? "🟠" :
                   mapping.riskLevel === "medium" ? "🟡" :
                   mapping.riskLevel === "low" ? "🟢" : "⚪";
  console.log(`  Risk Level:  ${riskIcon} ${mapping.riskLevel.toUpperCase()}`);
  if (mapping.riskFactors.length > 0) {
    console.log("  Factors:");
    for (const factor of mapping.riskFactors) {
      console.log(`    - ${factor}`);
    }
  }
  console.log("");

  // Economic Impact
  console.log("ECONOMIC IMPACT");
  console.log("───────────────────────────────────────────────────────────────────");
  if (mapping.economicImpact.hasImpact) {
    console.log(`  Monthly:     €${mapping.economicImpact.estimatedMonthlyEur.toLocaleString()}`);
    console.log(`  Annual:      €${mapping.economicImpact.estimatedAnnualEur.toLocaleString()}`);
    console.log(`  Type:        ${mapping.economicImpact.impactType}`);
    console.log(`  Confidence:  ${mapping.economicImpact.confidence}`);
    console.log(`  Calculation: ${mapping.economicImpact.calculation}`);
    if (mapping.economicImpact.assumptions.length > 0) {
      console.log("  Assumptions:");
      for (const assumption of mapping.economicImpact.assumptions) {
        console.log(`    - ${assumption}`);
      }
    }
  } else {
    console.log("  No quantifiable economic impact identified");
  }
  console.log("");

  // Recommendation
  console.log("═══════════════════════════════════════════════════════════════════");
  console.log(`RECOMMENDATION: ${recIcon} ${mapping.recommendation}`);
  console.log("───────────────────────────────────────────────────────────────────");
  console.log(`  ${mapping.recommendationReason}`);
  console.log(`  Confidence: ${(mapping.confidence * 100).toFixed(0)}%`);
  console.log("═══════════════════════════════════════════════════════════════════");
}

function printMappingSummary(mapping: TaskCodeMapping): void {
  const recIcon = getRecommendationIcon(mapping.recommendation);
  const riskIcon = mapping.riskLevel === "critical" ? "🔴" :
                   mapping.riskLevel === "high" ? "🟠" :
                   mapping.riskLevel === "medium" ? "🟡" :
                   mapping.riskLevel === "low" ? "🟢" : "⚪";

  console.log(`${recIcon} #${mapping.taskId} ${mapping.taskTitle}`);
  console.log(`   Area: ${mapping.businessContext.area} | Risk: ${riskIcon} ${mapping.riskLevel}`);
  if (mapping.economicImpact.hasImpact) {
    console.log(`   Impact: €${mapping.economicImpact.estimatedMonthlyEur}/month (${mapping.economicImpact.impactType})`);
  }
  console.log(`   Modules: ${mapping.affectedModules.filter(m => m.relevance === "primary").map(m => m.name).join(", ") || "(none)"}`);
  console.log(`   Files: ${mapping.affectedFiles.length} | Complexity: ${mapping.estimatedComplexity}`);
  console.log(`   └─ ${mapping.recommendationReason}`);
  console.log("");
}

function getRecommendationIcon(rec: Recommendation): string {
  switch (rec) {
    case "DO": return "✅";
    case "REVIEW": return "👁️";
    case "SKIP": return "⏭️";
  }
}

// ============================================================================
// DATABASE ACCESS (for fetching tasks)
// ============================================================================

async function fetchTaskById(taskId: number): Promise<KanbanTask | null> {
  try {
    const { getTaskById, closePool } = await import("../../dashboard/db.js");
    const task = await getTaskById(taskId);
    await closePool();

    if (!task) return null;

    return {
      id: task.id!,
      title: task.title,
      description: task.description,
      status: task.status,
      priority: task.priority,
      source: task.source,
      decision_rule_id: task.decision_rule_id,
      area: task.area,
      due_date: task.due_date,
      created_at: task.created_at,
      updated_at: task.updated_at,
    };
  } catch (error) {
    console.error("Database error:", (error as Error).message);
    console.error("Make sure the database is accessible.");
    throw error;
  }
}

async function fetchTasks(statuses: string[]): Promise<KanbanTask[]> {
  try {
    const { getTasks, closePool } = await import("../../dashboard/db.js");
    const tasks = await getTasks({ status: statuses as any[] });
    await closePool();

    return tasks.map((task) => ({
      id: task.id!,
      title: task.title,
      description: task.description,
      status: task.status,
      priority: task.priority,
      source: task.source,
      decision_rule_id: task.decision_rule_id,
      area: task.area,
      due_date: task.due_date,
      created_at: task.created_at,
      updated_at: task.updated_at,
    }));
  } catch (error) {
    console.error("Database error:", (error as Error).message);
    console.error("Make sure the database is accessible.");
    throw error;
  }
}

// ============================================================================
// HELP
// ============================================================================

function printHelp(): void {
  console.log(`
SeniorDev - Senior Developer / Tech Lead Skill

T10.1 - REPO AWARENESS
───────────────────────────────────────────────────────────────────
  index           Generate/update the codebase index
  status          Show current index status
  find <query>    Search for files, modules, skills, or APIs
  explain <path>  Explain what a file does
  modules         List all detected modules
  skills          List all detected skills
  apis            List all API endpoints
  deps <module>   Show module dependencies

T10.2 - TASK → CODE MAPPING
───────────────────────────────────────────────────────────────────
  map-task <id>   Map a single task to code modules with impact analysis
  map-tasks       Map all pending tasks (default: backlog,todo)
  map-tasks <s>   Map tasks with specific status (comma-separated)

Examples:
  node cli.js index
  node cli.js map-task 42
  node cli.js map-tasks
  node cli.js map-tasks backlog,todo,in_progress

Output Explanation:
  ✅ DO      - Task has economic impact, proceed with implementation
  👁️ REVIEW  - Task needs human review before proceeding
  ⏭️ SKIP    - Task has no economic justification, do not proceed

Notes:
  - Run 'index' first before using mapping commands
  - Mappings are based on task content, decision rules, and KPIs
  - Economic impact is estimated based on rule type and priority
  - Risk assessment considers module criticality and change scope
`);
}

// ============================================================================
// MAIN
// ============================================================================

main().catch((error) => {
  console.error("Error:", error.message);
  process.exit(1);
});
