#!/usr/bin/env node
/**
 * Task Mapper Test Script
 *
 * Tests the task mapping logic with mock tasks.
 * Run: npx ts-node skills/senior-dev/task-mapper/test-mapper.ts
 * Or after build: node dist/skills/senior-dev/task-mapper/test-mapper.js
 */

import { mapTaskToCode, mapAllTasks } from "./mapper.js";
import { generateWeeklyReview } from "../reporters/weekly-review.js";
import { generatePrProposals } from "../pr-engine/generator.js";
import type { KanbanTask } from "./types.js";

// Mock tasks for testing
const MOCK_TASKS: KanbanTask[] = [
  // Critical/high risk tasks - should be SKIP or REVIEW
  {
    id: 1,
    title: "FREEZE ADS: Pausar incrementos de presupuesto",
    description: "FRR por debajo del 25% indica que el tráfico no convierte. Escalar ahora quemaría presupuesto.",
    status: "todo",
    priority: "critical",
    source: "decision_engine",
    decision_rule_id: "frr-red-freeze",
    area: "marketing",
    created_at: "2026-02-01T10:00:00Z",
  },
  {
    id: 2,
    title: "DIAGNÓSTICO RETENCIÓN: Investigar causas de baja renovación",
    description: "SRR bajo puede indicar: (1) Producto no cumple expectativa, (2) Pricing no coincide con valor.",
    status: "backlog",
    priority: "high",
    source: "decision_engine",
    decision_rule_id: "srr-red-diagnose",
    area: "retention",
    created_at: "2026-02-01T10:00:00Z",
  },

  // Medium risk, clear impact - may get DO
  {
    id: 3,
    title: "Ajustar umbral ROAS amarillo",
    description: "Cambiar threshold de ROAS_YELLOW de 1.3 a 1.5 para ser más conservadores.",
    status: "todo",
    priority: "medium",
    source: "alert",
    area: "ads",
    created_at: "2026-02-01T10:00:00Z",
  },

  // No economic impact - should SKIP
  {
    id: 4,
    title: "Refactorizar código del router",
    description: "Mejorar la estructura del router para mayor mantenibilidad",
    status: "backlog",
    priority: "low",
    source: "manual",
    created_at: "2026-02-01T10:00:00Z",
  },

  // Scale ready - REVIEW (investigative)
  {
    id: 5,
    title: "SCALE READY: Payback 51d >= 1.5",
    description: "Rentabilidad confirmada con datos maduros. OK para incrementar spend en campañas rentables.",
    status: "todo",
    priority: "medium",
    source: "decision_engine",
    decision_rule_id: "payback-51d-scale",
    area: "ads",
    created_at: "2026-02-01T10:00:00Z",
  },

  // Simple fix with clear impact - good candidate for DO
  {
    id: 6,
    title: "Fix: CPFR calculation with correct currency",
    description: "El CPFR no está convirtiendo USD a EUR correctamente. Esto causa errores en el dashboard.",
    status: "todo",
    priority: "high",
    source: "alert",
    area: "ads",
    created_at: "2026-02-01T10:00:00Z",
  },

  // Simple monitoring task - REVIEW (no code change needed)
  {
    id: 7,
    title: "Monitorear SRR esta semana",
    description: "SRR en zona amarilla, solo observar tendencia sin acción.",
    status: "todo",
    priority: "low",
    source: "decision_engine",
    decision_rule_id: "srr-yellow-monitor",
    area: "retention",
    created_at: "2026-02-01T10:00:00Z",
  },
];

async function main() {
  console.log("═══════════════════════════════════════════════════════════════════");
  console.log("TASK → CODE MAPPER TEST");
  console.log("═══════════════════════════════════════════════════════════════════");
  console.log("");

  // Test individual task mapping
  console.log("Testing individual task mapping...\n");

  for (const task of MOCK_TASKS.slice(0, 2)) {
    try {
      console.log(`\nMapping task #${task.id}: ${task.title}`);
      console.log("─".repeat(70));

      const mapping = await mapTaskToCode(task);

      console.log(`  Recommendation: ${mapping.recommendation}`);
      console.log(`  Reason: ${mapping.recommendationReason}`);
      console.log(`  Risk Level: ${mapping.riskLevel}`);
      console.log(`  Confidence: ${(mapping.confidence * 100).toFixed(0)}%`);
      console.log(`  Economic Impact: €${mapping.economicImpact.estimatedMonthlyEur}/month`);
      console.log(`  Affected Modules: ${mapping.affectedModules.map(m => m.name).join(", ")}`);
      console.log(`  Affected Files: ${mapping.affectedFiles.length}`);
      console.log(`  Change Type: ${mapping.changeType}`);
      console.log(`  Complexity: ${mapping.estimatedComplexity}`);
    } catch (error) {
      console.error(`  Error: ${(error as Error).message}`);
    }
  }

  // Test batch mapping
  console.log("\n\n═══════════════════════════════════════════════════════════════════");
  console.log("BATCH MAPPING TEST");
  console.log("═══════════════════════════════════════════════════════════════════\n");

  try {
    const mappings = await mapAllTasks(MOCK_TASKS);

    const doTasks = mappings.filter(m => m.recommendation === "DO");
    const reviewTasks = mappings.filter(m => m.recommendation === "REVIEW");
    const skipTasks = mappings.filter(m => m.recommendation === "SKIP");

    console.log("SUMMARY:");
    console.log(`  Total tasks: ${mappings.length}`);
    console.log(`  ✅ DO:       ${doTasks.length}`);
    console.log(`  👁️ REVIEW:   ${reviewTasks.length}`);
    console.log(`  ⏭️ SKIP:     ${skipTasks.length}`);
    console.log("");

    // Show each category
    if (doTasks.length > 0) {
      console.log("✅ TASKS TO PROCEED (DO):");
      for (const m of doTasks) {
        console.log(`  #${m.taskId} ${m.taskTitle}`);
        console.log(`     Impact: €${m.economicImpact.estimatedMonthlyEur}/month | Risk: ${m.riskLevel}`);
      }
      console.log("");
    }

    if (reviewTasks.length > 0) {
      console.log("👁️ TASKS REQUIRING REVIEW:");
      for (const m of reviewTasks) {
        console.log(`  #${m.taskId} ${m.taskTitle}`);
        console.log(`     Reason: ${m.recommendationReason}`);
      }
      console.log("");
    }

    if (skipTasks.length > 0) {
      console.log("⏭️ TASKS SKIPPED:");
      for (const m of skipTasks) {
        console.log(`  #${m.taskId} ${m.taskTitle}`);
        console.log(`     Reason: ${m.recommendationReason}`);
      }
      console.log("");
    }

    // Total impact
    const totalImpact = mappings
      .filter(m => m.recommendation !== "SKIP")
      .reduce((sum, m) => sum + m.economicImpact.estimatedMonthlyEur, 0);

    console.log("═══════════════════════════════════════════════════════════════════");
    console.log(`POTENTIAL MONTHLY IMPACT: €${totalImpact.toLocaleString()}/month`);
    console.log("═══════════════════════════════════════════════════════════════════");

    // Test Weekly Review formatting (T10.2.5)
    console.log("\n\n");
    console.log("Testing Weekly Code Impact Review (T10.2.5)...\n");

    const review = generateWeeklyReview(mappings);
    console.log(review.formattedReport);

    // Test PR Proposal generation (T10.3)
    console.log("\n\n");
    console.log("Testing PR Proposal Engine (T10.3)...\n");

    const batch = generatePrProposals(mappings);
    console.log(batch.summary);

    // Show first proposal in detail
    if (batch.proposals.length > 0) {
      console.log("\n");
      console.log("Sample PR Proposal (first DO item):");
      console.log(batch.proposals[0].formattedProposal);
    }

  } catch (error) {
    console.error(`Error: ${(error as Error).message}`);
  }
}

main().catch(console.error);
