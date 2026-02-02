/**
 * BusinessExpert CLI
 *
 * Entry point for OpenClaw skill invocation.
 * Usage: node cli.js <websiteId> [command]
 *
 * HARDENING: websiteId is REQUIRED - no global metrics allowed
 *
 * Commands:
 *   summary   - Generate executive summary (default)
 *   kpis      - Get 5 CORE KPIs
 *   alerts    - Get current alerts only
 */

import { generateExecutiveSummary, formatSummaryAsText } from "./reporters/executive-summary.js";
import { fetchRawMetrics, calculateCoreKpis, generateAlerts } from "./analyzers/cross-analyzer.js";
import { validateWebsiteId, getWebsiteConfig, VALID_WEBSITE_IDS } from "../../core/websites.js";

async function main() {
  const websiteIdArg = process.argv[2];
  const command = process.argv[3] || "summary";

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
    case "summary": {
      const summary = await generateExecutiveSummary(websiteId);
      if (!summary) {
        console.error("Error: No se pudo generar el resumen ejecutivo");
        process.exit(1);
      }
      console.log(formatSummaryAsText(summary));
      break;
    }

    case "kpis": {
      const raw = await fetchRawMetrics(websiteId);
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
      const raw = await fetchRawMetrics(websiteId);
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
      showHelp();
      break;
  }
}

function showHelp() {
  console.log(`
BusinessExpert - KPI Governance Tool

HARDENING: websiteId is REQUIRED - no global metrics allowed

Uso:
  node cli.js <websiteId> [command]

websiteId:
  ${VALID_WEBSITE_IDS.join(", ")} (required)

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
  node cli.js 1 summary   # Jackcode
  node cli.js 3 kpis      # KiwiKode
`);
}

main().catch((error) => {
  console.error("Error:", error.message);
  process.exit(1);
});
