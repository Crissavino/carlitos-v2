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
