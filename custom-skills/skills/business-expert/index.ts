/**
 * BusinessExpert - Main Entry Point
 *
 * 5 KPIs CORE de gobierno:
 * P1 - FRR (First Rebill Rate)
 * P2 - CPFR (Cost per First Rebill)
 * P3 - SRR (Second Rebill Rate) - usa cohorte 30-37d
 * P4 - U-R2 (Usage before Rebill 2) - diagnóstica
 * P5 - Net ROAS Real
 */

export { generateExecutiveSummary, formatSummaryAsText } from "./reporters/executive-summary.js";
export { fetchRawMetrics, calculateCoreKpis, determineBusinessStatus, generateAlerts } from "./analyzers/cross-analyzer.js";
export { getTopCampaigns } from "./analyzers/ads-analyzer.js";
export * from "./types.js";
