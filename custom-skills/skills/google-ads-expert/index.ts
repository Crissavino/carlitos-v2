/**
 * GoogleAdsExpert - Main Entry Point
 * 
 * Observer Mode skill para ingerir métricas de Google Ads.
 * 
 * Fase 2: Solo ingest + sanity checks
 * - NO análisis avanzado
 * - NO cambios en campañas
 * - Todo read-only
 */

export * from "./types.js";
export * from "./ingest.js";
export { getDataSource, getConfiguredDataSource } from "./datasources/index.js";
export type { AdsDataSource, ValidationResult } from "./datasources/interface.js";
