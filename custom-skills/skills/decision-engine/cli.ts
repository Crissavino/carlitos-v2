/**
 * Decision Engine CLI
 *
 * Entry point for OpenClaw skill invocation.
 * Usage: node cli.js [command]
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

async function main() {
  const command = process.argv[2] || "report";

  switch (command) {
    case "report": {
      const report = await generateWeeklyReport();
      if (!report) {
        console.error("Error: No se pudo generar el reporte de decisiones");
        process.exit(1);
      }
      console.log(formatReportAsText(report));
      break;
    }

    case "rules": {
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
      break;
    }

    case "evaluate": {
      const raw = await fetchRawMetrics();
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
      console.log(`
Decision Engine - KPI to Actions

Comandos:
  report    Reporte semanal de decisiones (default)
  rules     Listar todas las reglas de decisión
  evaluate  Evaluar reglas contra KPIs actuales

Ejemplo:
  node cli.js report
`);
      break;
  }
}

main().catch((error) => {
  console.error("Error:", error.message);
  process.exit(1);
});
