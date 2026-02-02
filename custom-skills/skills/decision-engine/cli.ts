/**
 * Decision Engine CLI
 *
 * Entry point for OpenClaw skill invocation.
 * Usage: node cli.js <websiteId> [command]
 *
 * HARDENING: websiteId is REQUIRED - no global decisions allowed
 *
 * Commands:
 *   report   - Generate weekly decision report (default)
 *   rules    - List all decision rules
 *   evaluate - Evaluate rules against current KPIs
 */

import { generateWeeklyReport, formatReportAsText } from "./reporters/weekly-report.js";
import { evaluateRules, getTopActions } from "./rules/evaluator.js";
import { getDecisionRules } from "./rules/decision-matrix.js";
import { fetchRawMetrics, calculateCoreKpis } from "../business-expert/analyzers/cross-analyzer.js";
import { DECISION_ICONS, PRIORITY_ICONS } from "./types.js";
import { validateWebsiteId, getWebsiteConfig, VALID_WEBSITE_IDS } from "../../core/websites.js";

async function main() {
  const websiteIdArg = process.argv[2];
  const command = process.argv[3] || "report";

  // Rules command doesn't need websiteId
  if (websiteIdArg === "rules" || command === "rules") {
    showRules();
    return;
  }

  // Show help if no websiteId provided
  if (!websiteIdArg || websiteIdArg === "help") {
    showHelp();
    return;
  }

  // Validate websiteId
  let websiteId: number;
  try {
    websiteId = validateWebsiteId(parseInt(websiteIdArg, 10));
  } catch (error) {
    console.error(`Error: ${(error as Error).message}`);
    console.error(`Valid website IDs: ${VALID_WEBSITE_IDS.join(", ")}`);
    process.exit(1);
  }

  const websiteConfig = getWebsiteConfig(websiteId);
  console.log(`Website: ${websiteConfig.name} (ID: ${websiteId})\n`);

  switch (command) {
    case "report": {
      const report = await generateWeeklyReport(websiteId);
      if (!report) {
        console.error("Error: No se pudo generar el reporte de decisiones");
        process.exit(1);
      }
      console.log(formatReportAsText(report));
      break;
    }

    case "evaluate": {
      const raw = await fetchRawMetrics(websiteId);
      if (!raw) {
        console.error("Error: No se pudieron obtener las métricas");
        process.exit(1);
      }
      const kpis = calculateCoreKpis(raw);
      const decisions = evaluateRules(kpis);
      const top = getTopActions(decisions, 10);

      console.log("EVALUACIÓN DE REGLAS");
      console.log("═══════════════════════════════════════════════════");
      console.log("");
      console.log(`Reglas activadas: ${decisions.length}`);
      console.log(`Top acciones: ${top.length}`);
      console.log("");

      if (top.length === 0) {
        console.log("✅ Sin reglas activadas. Todo en orden.");
      } else {
        for (const d of top) {
          const icon = DECISION_ICONS[d.type];
          const priorityIcon = PRIORITY_ICONS[d.priority];
          console.log(`${icon} ${d.ruleName}`);
          console.log(`   ${priorityIcon} ${d.priority.toUpperCase()}`);
          console.log(`   → ${d.action}`);
          console.log("");
        }
      }
      break;
    }

    case "help":
    default:
      showHelp();
      break;
  }
}

function showRules() {
  const rules = getDecisionRules();
  console.log("MATRIZ DE DECISIONES");
  console.log("═══════════════════════════════════════════════════");
  console.log("");
  for (const rule of rules) {
    const icon = DECISION_ICONS[rule.decision.type];
    const priorityIcon = PRIORITY_ICONS[rule.decision.priority];
    console.log(`${icon} ${rule.name}`);
    console.log(`   ID: ${rule.id}`);
    console.log(`   Prioridad: ${priorityIcon} ${rule.decision.priority}`);
    console.log(`   Área: ${rule.decision.area}`);
    console.log(`   KPIs: ${rule.triggerKpis.join(", ")}`);
    console.log(`   Acción: ${rule.decision.action}`);
    console.log("");
  }
  console.log(`Total: ${rules.length} reglas`);
}

function showHelp() {
  console.log(`
Decision Engine - KPI to Actions

HARDENING: websiteId is REQUIRED for report/evaluate commands

Uso:
  node cli.js <websiteId> [command]
  node cli.js rules              # No requiere websiteId

websiteId:
  ${VALID_WEBSITE_IDS.join(", ")} (required for report/evaluate)

Comandos:
  report    Reporte semanal de decisiones (default)
  rules     Listar todas las reglas de decisión
  evaluate  Evaluar reglas contra KPIs actuales

Ejemplo:
  node cli.js 1 report    # Jackcode
  node cli.js 3 evaluate  # KiwiKode
  node cli.js rules       # Ver reglas (no necesita websiteId)
`);
}

main().catch((error) => {
  console.error("Error:", error.message);
  process.exit(1);
});
