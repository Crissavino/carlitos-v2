import { AllowedQueryId } from "./types.js";
import { isAllowedQuery, getQuery } from "./queries/index.js";
import { audit } from "../../core/audit.js";
import { permissions } from "../../core/permissions.js";

export interface ValidationResult {
  valid: boolean;
  reason?: string;
  queryId?: AllowedQueryId;
}

export async function validateQuery(queryId: string): Promise<ValidationResult> {
  // 1. Verificar que el queryId está en la whitelist
  if (!isAllowedQuery(queryId)) {
    await audit.log({
      skill: "db-reader",
      action: "validate",
      input: { queryId },
      output: { valid: false },
      blocked: true,
      blockReason: "query_not_in_whitelist",
    });
    return {
      valid: false,
      reason: `Query "${queryId}" not in allowed list. Allowed: active-subscriptions, trials-last-7-days, daily-revenue-7d`,
    };
  }

  // 2. Verificar permisos del skill
  const permCheck = await permissions.checkPermission("db-reader", "SELECT");
  if (!permCheck.allowed) {
    return {
      valid: false,
      reason: permCheck.reason,
    };
  }

  // 3. Verificar que la query solo usa SELECT
  const query = getQuery(queryId);
  if (!query) {
    return { valid: false, reason: "Query definition not found" };
  }

  const sqlUpper = query.sql.toUpperCase();
  const dangerousKeywords = ["INSERT", "UPDATE", "DELETE", "DROP", "ALTER", "TRUNCATE", "CREATE"];
  
  for (const keyword of dangerousKeywords) {
    if (sqlUpper.includes(keyword)) {
      await audit.log({
        skill: "db-reader",
        action: "validate",
        input: { queryId },
        output: { valid: false },
        blocked: true,
        blockReason: "dangerous_keyword_detected",
      });
      return {
        valid: false,
        reason: `Query contains prohibited keyword: ${keyword}`,
      };
    }
  }

  return { valid: true, queryId: queryId as AllowedQueryId };
}

/**
 * Validate a raw SQL query for safety (read-only enforcement).
 * Allows SELECT and WITH (CTEs). Blocks all write/DDL operations.
 */
export async function validateRawSQL(sql: string): Promise<{ valid: boolean; reason?: string }> {
  const trimmed = sql.trim();
  const upper = trimmed.toUpperCase();

  // Must start with SELECT or WITH (for CTEs)
  if (!upper.startsWith("SELECT") && !upper.startsWith("WITH")) {
    await audit.log({
      skill: "db-reader",
      action: "validate_raw_sql",
      input: { sql: trimmed.substring(0, 200) },
      output: { valid: false },
      blocked: true,
      blockReason: "sql_must_start_with_select_or_with",
    });
    return {
      valid: false,
      reason: "SQL must start with SELECT or WITH. Only read queries are allowed.",
    };
  }

  // Block dangerous keywords
  const dangerousKeywords = ["INSERT", "UPDATE", "DELETE", "DROP", "ALTER", "TRUNCATE", "CREATE"];
  for (const keyword of dangerousKeywords) {
    // Match keyword as a whole word (not inside identifiers)
    const regex = new RegExp(`\\b${keyword}\\b`, "i");
    if (regex.test(trimmed)) {
      await audit.log({
        skill: "db-reader",
        action: "validate_raw_sql",
        input: { sql: trimmed.substring(0, 200) },
        output: { valid: false },
        blocked: true,
        blockReason: `dangerous_keyword_${keyword.toLowerCase()}`,
      });
      return {
        valid: false,
        reason: `SQL contains prohibited keyword: ${keyword}. Only read queries are allowed.`,
      };
    }
  }

  return { valid: true };
}
