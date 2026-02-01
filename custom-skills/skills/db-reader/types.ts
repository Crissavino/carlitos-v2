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
  | "ltv-81d";  // R3 completo

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
