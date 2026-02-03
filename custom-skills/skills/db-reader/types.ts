export type AllowedQueryId =
  | "active-subscriptions"
  | "trials-last-7-days"
  | "daily-revenue-7d"
  | "first-rebills-7d"
  | "second-rebills-7d"
  | "first-rebills-cohorte-30d"
  | "usage-before-rebill2-7d"
  | "ad-spend-7d"
  | "ltv-30d"
  | "ltv-45d"
  | "ltv-90d"
  // LTV ventanas correctas (basadas en modelo de cobro real)
  | "ltv-21d"   // R1 completo
  | "ltv-51d"   // R2 completo
  | "ltv-81d"   // R3 completo
  // Phase 7: Campaign-level metrics
  | "campaign-performance"  // Full metrics per campaign
  | "campaign-summary"      // Lightweight summary
  // Phase 7.5: Business aggregations
  | "business-by-website"   // Aggregation by website
  | "business-by-company"   // Aggregation by company
  | "business-by-country"   // Aggregation by country
  | "campaigns-for-service-classification"  // Campaign list for service pattern matching
  // Phase 9: Utility Model KPIs
  | "trial-revenue-7d"       // Trial revenue for Payback M1
  | "first-rebill-revenue-7d" // First rebill revenue for Payback M1
  | "refunds-m1-7d"          // Refunds before M2 for Payback M1
  // Phase 10: Daily Comparison (Today vs 7 days ago)
  | "trials-today"           // Trials started today
  | "trials-7d-ago"          // Trials started 7 days ago
  | "first-rebills-today"    // First rebills today
  | "first-rebills-7d-ago"   // First rebills 7 days ago
  | "ad-spend-today"         // Ad spend today
  | "ad-spend-7d-ago"        // Ad spend 7 days ago
  // Phase 11: Payback M1 Cohort (FIX - real cohort-based calculation)
  | "payback-m1-cohort"     // Payback M1 real por cohorte 30-60d
  // Phase 12: Keyword-level attribution using utm_term
  | "keyword-attribution"   // Acquisitions/FirstRebills by keyword (utm_term)
  // Phase 13: Customer counts for dashboard
  | "customer-counts"      // Total and active customer counts
  // Phase 14: Customer cohort distribution
  | "customer-cohort-distribution"  // M1, M2, M3, etc. distribution
  // Phase 15: Risk metrics (OpenClaw)
  | "chargeback-rate"              // Chargeback rate (riesgo procesador)
  | "base-instalada";              // Clientes con >1 rebill

export interface DBReaderRequest {
  query: AllowedQueryId;
}

export interface DBReaderResponse {
  queryId: AllowedQueryId;
  executedAt: string;
  status: "success" | "error" | "blocked";
  results: unknown;
  error?: string;
  meta: {
    rowCount: number;
    executionTimeMs: number;
  };
}

export interface QueryDefinition {
  id: AllowedQueryId;
  name: string;
  description: string;
  sql: string;
  params: unknown[];
  permissions: string[];
}

// Query builder function type for dynamic queries with websiteId
export type QueryBuilder = (websiteId?: number) => QueryDefinition;

export interface SchemaConfig {
  subscriptions: {
    table: string;
    columns: Record<string, string>;
    values: Record<string, string>;
  };
  invoices: {
    table: string;
    columns: Record<string, string>;
    status_values: Record<string, number>;
  };
  customers: {
    table: string;
    columns: Record<string, string>;
  };
  currencies: {
    table: string;
    columns: Record<string, string>;
  };
}

export interface DBConfig {
  connection: {
    host: string;
    port: number;
    database: string;
    user: string;
    password: string;
    charset: string;
  };
  schema: SchemaConfig;
}
