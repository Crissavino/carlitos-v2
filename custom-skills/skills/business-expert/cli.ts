/**
 * BusinessExpert CLI
 *
 * Entry point for OpenClaw skill invocation.
 * Usage: node cli.js [command]
 *
 * Commands:
 *   summary   - Generate executive summary (default)
 *   kpis      - Get 5 CORE KPIs
 *   alerts    - Get current alerts only
 */

import { generateExecutiveSummary, formatSummaryAsText } from "./reporters/executive-summary.js";
import { fetchRawMetrics, calculateCoreKpis, generateAlerts } from "./analyzers/cross-analyzer.js";

async function main() {
  const command = process.argv[2] || "summary";

  switch (command) {
    case "summary": {
      const summary = await generateExecutiveSummary();
      if (!summary) {
        console.error("Error: No se pudo generar el resumen ejecutivo");
        process.exit(1);
      }
      console.log(formatSummaryAsText(summary));
      break;
    }

    case "kpis": {
      const raw = await fetchRawMetrics();
      if (!raw) {
        console.error("Error: No se pudieron obtener las métricas");
        process.exit(1);
      }
      const kpis = calculateCoreKpis(raw);
      console.log("5 KPIs CORE:");
      console.log("");
      console.log(`P1 - FRR:      ${(kpis.frr.value * 100).toFixed(1)}% [${kpis.frr.status}]`);
      console.log(`              ${kpis.frr.shortReason}`);
      console.log(`P2 - CPFR:     €${kpis.cpfr.value.toFixed(2)} [${kpis.cpfr.status}]`);
      console.log(`              ${kpis.cpfr.shortReason}`);
      console.log(`P3 - SRR:      ${(kpis.srr.value * 100).toFixed(1)}% [${kpis.srr.status}]`);
      console.log(`              ${kpis.srr.shortReason}`);
      console.log(`P4 - U-R2:     ${(kpis.ur2.value * 100).toFixed(1)}% [${kpis.ur2.status}]`);
      console.log(`              ${kpis.ur2.shortReason}`);
      console.log(`P5 - Net ROAS: ${kpis.netRoas.value.toFixed(2)}x [${kpis.netRoas.status}]`);
      console.log(`              ${kpis.netRoas.shortReason}`);
      break;
    }

    case "alerts": {
      const raw = await fetchRawMetrics();
      if (!raw) {
        console.error("Error: No se pudieron obtener las métricas");
        process.exit(1);
      }
      const kpis = calculateCoreKpis(raw);
      const alerts = generateAlerts(kpis);
      if (alerts.length === 0) {
        console.log("✅ No hay alertas activas");
      } else {
        console.log(`🚨 ${alerts.length} alerta(s) activa(s):\n`);
        for (const alert of alerts) {
          console.log(`🔴 ${alert.message}`);
        }
      }
      break;
    }

    case "help":
    default:
      console.log(`
BusinessExpert - KPI Governance Tool

Comandos:
  summary   Resumen ejecutivo tipo CFO (default)
  kpis      Ver 5 KPIs CORE con semáforos
  alerts    Ver alertas activas

5 KPIs CORE (por prioridad):
  P1 - FRR      First Rebill Rate
  P2 - CPFR     Cost per First Rebill
  P3 - SRR      Second Rebill Rate
  P4 - U-R2     Usage before Rebill 2
  P5 - Net ROAS Revenue / Ad Spend

Ejemplo:
  node cli.js summary
`);
      break;
  }
}

main().catch((error) => {
  console.error("Error:", error.message);
  process.exit(1);
});
