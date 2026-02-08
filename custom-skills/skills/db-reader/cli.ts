#!/usr/bin/env node
/**
 * DB Reader CLI
 * Usage:
 *   node cli.js <query-id>              - Run a pre-defined query
 *   node cli.js sql "SELECT ..."        - Run an arbitrary SELECT query
 *   node cli.js schema [database]       - Show available tables and columns
 */

import { executeQuery, executeArbitrarySql } from "./executor.js";
import { isAllowedQuery, QUERY_BUILDERS } from "./queries/index.js";

const command = process.argv[2];

if (!command) {
  const queryIds = Object.keys(QUERY_BUILDERS);
  console.error("Usage:");
  console.error("  node cli.js <query-id>          - Run a pre-defined query");
  console.error('  node cli.js sql "SELECT ..."     - Run an arbitrary SELECT query');
  console.error("  node cli.js schema [database]    - Show available tables");
  console.error("");
  console.error("Available pre-defined queries: " + queryIds.join(", "));
  process.exit(1);
}

// Handle "sql" subcommand for arbitrary queries
if (command === "sql") {
  const rawSql = process.argv.slice(3).join(" ");
  if (!rawSql.trim()) {
    console.error('Usage: node cli.js sql "SELECT column FROM table WHERE ..."');
    process.exit(1);
  }

  try {
    const result = await executeArbitrarySql(rawSql);
    console.log(JSON.stringify(result, null, 2));
    process.exit(result.status === "success" ? 0 : 1);
  } catch (error) {
    console.error("Error:", error instanceof Error ? error.message : "Unknown error");
    process.exit(1);
  }
}
// Handle "schema" subcommand
else if (command === "schema") {
  const database = process.argv[3];
  const schema: Record<string, string[]> = {
    avocode: [
      "subscriptions", "invoices", "customers", "payments", "payment_status",
      "products", "currencies", "companies", "websites",
      "bo_periodicals", "bo_periodical_transactions", "bo_periodical_statuses",
      "bo_stripe_customers", "bo_payu_customers", "bo_revolut_customers", "bo_tap_customers",
    ],
    avocodebo: [
      "campaigns", "ads", "fixed_expenses",
      "zoho_customers", "zoho_invoices", "zoho_payments", "zoho_organizations",
    ],
  };

  if (database && schema[database]) {
    console.log(JSON.stringify({ database, tables: schema[database] }, null, 2));
  } else if (database) {
    console.error("Unknown database: " + database + ". Available: " + Object.keys(schema).join(", "));
    process.exit(1);
  } else {
    console.log(JSON.stringify(schema, null, 2));
  }
  process.exit(0);
}
// Handle pre-defined query IDs
else if (isAllowedQuery(command)) {
  try {
    const result = await executeQuery(command as any);
    console.log(JSON.stringify(result, null, 2));
    process.exit(result.status === "success" ? 0 : 1);
  } catch (error) {
    console.error("Error:", error instanceof Error ? error.message : "Unknown error");
    process.exit(1);
  }
} else {
  const queryIds = Object.keys(QUERY_BUILDERS);
  console.error("Error: Unknown command or query '" + command + "'");
  console.error("");
  console.error("Usage:");
  console.error("  node cli.js <query-id>          - Run a pre-defined query");
  console.error('  node cli.js sql "SELECT ..."     - Run an arbitrary SELECT query');
  console.error("");
  console.error("Available pre-defined queries: " + queryIds.join(", "));
  process.exit(1);
}
