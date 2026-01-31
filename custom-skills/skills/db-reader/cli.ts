#!/usr/bin/env node
/**
 * DB Reader CLI
 * Usage: node cli.js <query-id>
 */

import { executeQuery } from "./executor.js";
import { isAllowedQuery } from "./queries/index.js";

const queryId = process.argv[2];

if (!queryId) {
  console.error("Usage: node cli.js <query-id>");
  console.error("Available queries: active-subscriptions, trials-last-7-days, daily-revenue-7d");
  process.exit(1);
}

if (!isAllowedQuery(queryId)) {
  console.error("Error: Unknown query '" + queryId + "'");
  console.error("Available queries: active-subscriptions, trials-last-7-days, daily-revenue-7d");
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
