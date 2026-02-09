#!/usr/bin/env node
/**
 * DB Reader CLI
 * Usage:
 *   node cli.js <query-id>                  - Run a pre-approved query
 *   node cli.js sql "SELECT ..."            - Run a free-form read-only SQL query
 *   node cli.js schema                      - List all tables in both databases
 *   node cli.js schema <table>              - Describe columns of a specific table
 */

import { executeQuery, executeRawQuery } from "./executor.js";
import { isAllowedQuery } from "./queries/index.js";
import { validateRawSQL } from "./validator.js";
import { audit } from "../../core/audit.js";

const command = process.argv[2];

if (!command) {
  console.error("Usage:");
  console.error("  node cli.js <query-id>           - Run a pre-approved query");
  console.error('  node cli.js sql "SELECT ..."      - Run a free-form SQL query');
  console.error("  node cli.js schema               - List all tables");
  console.error("  node cli.js schema <table>        - Describe a table");
  process.exit(1);
}

// --- Command: sql ---
if (command === "sql") {
  const sql = process.argv[3];
  if (!sql) {
    console.error('Usage: node cli.js sql "SELECT ..."');
    process.exit(1);
  }

  const validation = await validateRawSQL(sql);
  if (!validation.valid) {
    console.error("Blocked:", validation.reason);
    process.exit(1);
  }

  try {
    await audit.log({
      skill: "db-reader",
      action: "raw_sql_execute",
      input: { sql: sql.substring(0, 500) },
      output: null,
    });

    const startTime = Date.now();
    const rows = await executeRawQuery(sql);
    const executionTimeMs = Date.now() - startTime;

    await audit.log({
      skill: "db-reader",
      action: "raw_sql_success",
      input: { sql: sql.substring(0, 200) },
      output: { rowCount: (rows as unknown[]).length, executionTimeMs },
    });

    console.log(JSON.stringify({
      status: "success",
      sql: sql.substring(0, 200),
      results: rows,
      meta: { rowCount: (rows as unknown[]).length, executionTimeMs },
    }, null, 2));
    process.exit(0);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    await audit.log({
      skill: "db-reader",
      action: "raw_sql_error",
      input: { sql: sql.substring(0, 200) },
      output: { error: errorMessage },
    });
    console.error("Error:", errorMessage);
    process.exit(1);
  }
}

// --- Command: schema ---
if (command === "schema") {
  const tableName = process.argv[3];

  try {
    if (tableName) {
      // Describe a specific table
      // Validate table name to prevent injection
      // Allows: table_name or database.table_name (e.g. avocodebo.zoho_refunds)
      if (!/^[a-zA-Z_][a-zA-Z0-9_]*(\.[a-zA-Z_][a-zA-Z0-9_]*)?$/.test(tableName)) {
        console.error("Error: Invalid table name. Use 'table' or 'database.table' format.");
        process.exit(1);
      }

      const columns = await executeRawQuery(`DESCRIBE ${tableName}`);
      console.log(JSON.stringify({
        status: "success",
        table: tableName,
        columns,
      }, null, 2));
    } else {
      // List all tables from the configured database
      const tables = await executeRawQuery("SHOW TABLES");
      console.log(JSON.stringify({
        status: "success",
        tables,
      }, null, 2));
    }
    process.exit(0);
  } catch (error) {
    console.error("Error:", error instanceof Error ? error.message : "Unknown error");
    process.exit(1);
  }
}

// --- Command: pre-approved query ID ---
const queryId = command;

if (!isAllowedQuery(queryId)) {
  console.error("Error: Unknown command or query '" + queryId + "'");
  console.error("Usage:");
  console.error("  node cli.js <query-id>           - Run a pre-approved query");
  console.error('  node cli.js sql "SELECT ..."      - Run a free-form SQL query');
  console.error("  node cli.js schema               - List all tables");
  console.error("  node cli.js schema <table>        - Describe a table");
  process.exit(1);
}

try {
  const result = await executeQuery(queryId as any);
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.status === "success" ? 0 : 1);
} catch (error) {
  console.error("Error:", error instanceof Error ? error.message : "Unknown error");
  process.exit(1);
}
