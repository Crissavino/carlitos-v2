import { AllowedQueryId, DBReaderResponse } from "./types.js";
import { getQuery } from "./queries/index.js";
import { convertToEur } from "./queries/daily-revenue.js";
import { CurrencyConverter, EUR_RATES } from "../../core/currency.js";
import { audit } from "../../core/audit.js";

// Re-export for backwards compatibility
const HARDCODED_RATES = EUR_RATES;
import mysql from "mysql2/promise";

let pool: mysql.Pool | null = null;

function getPool(): mysql.Pool {
  if (!pool) {
    // Core DB (Avocode) - read-only access to business data
    // Supports both new DB_CORE_* and legacy DB_* variables
    const host = process.env.DB_CORE_HOST || process.env.DB_HOST;
    const port = parseInt(process.env.DB_CORE_PORT || process.env.DB_PORT || "3306", 10);
    const user = process.env.DB_CORE_USER || process.env.DB_READONLY_USER;
    const password = process.env.DB_CORE_PASSWORD || process.env.DB_READONLY_PASSWORD;
    const database = process.env.DB_CORE_DATABASE;

    if (!host || !user || !password) {
      throw new Error("Core database credentials not configured (DB_CORE_*)");
    }

    pool = mysql.createPool({
      host,
      port,
      user,
      password,
      database,
      waitForConnections: true,
      connectionLimit: 5,
      queueLimit: 0,
      connectTimeout: 10000,
    });
  }
  return pool;
}

/**
 * Execute a query with optional website_id filtering
 * HARDENING: Pass websiteId to filter data by website
 */
export async function executeQuery(queryId: AllowedQueryId, websiteId?: number): Promise<DBReaderResponse> {
  const startTime = Date.now();
  const query = getQuery(queryId, websiteId);

  if (!query) {
    return {
      queryId,
      executedAt: new Date().toISOString(),
      status: "error",
      results: null,
      error: "Query not found",
      meta: { rowCount: 0, executionTimeMs: Date.now() - startTime },
    };
  }

  await audit.log({
    skill: "db-reader",
    action: "execute_start",
    input: { queryId, websiteId, sql: query.sql },
    output: null,
    queries: [query.sql],
  });

  try {
    const rows = await executeRealQuery(query.sql, query.params);
    const executionTimeMs = Date.now() - startTime;

    await audit.log({
      skill: "db-reader",
      action: "execute_success",
      input: { queryId },
      output: { rowCount: rows.length, executionTimeMs },
      queries: [query.sql],
    });

    const formattedResults = formatResults(queryId, rows);

    return {
      queryId,
      executedAt: new Date().toISOString(),
      status: "success",
      results: formattedResults,
      meta: { rowCount: rows.length, executionTimeMs },
    };
  } catch (error) {
    const executionTimeMs = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    await audit.log({
      skill: "db-reader",
      action: "execute_error",
      input: { queryId },
      output: { error: errorMessage },
      queries: [query.sql],
    });

    return {
      queryId,
      executedAt: new Date().toISOString(),
      status: "error",
      results: null,
      error: `Database query failed: ${errorMessage}`,
      meta: { rowCount: 0, executionTimeMs },
    };
  }
}

async function executeRealQuery(sql: string, params: unknown[]): Promise<unknown[]> {
  const dbPool = getPool();
  const [rows] = await dbPool.execute(sql, params);
  return rows as unknown[];
}

/**
 * Execute a raw SQL query (for dynamic queries not in the registry)
 * Use with caution - only for internal dashboard use
 */
export async function executeRawQuery(sql: string, params: unknown[] = []): Promise<unknown[]> {
  return executeRealQuery(sql, params);
}

/**
 * Execute an arbitrary SQL query from the CLI.
 * Safety: Only SELECT statements are allowed (validated before execution).
 */
export async function executeArbitrarySql(rawSql: string): Promise<DBReaderResponse> {
  const startTime = Date.now();
  const trimmed = rawSql.trim();

  // Validate: must start with SELECT (case-insensitive)
  if (!/^\s*SELECT\b/i.test(trimmed)) {
    return {
      queryId: "sql" as any,
      executedAt: new Date().toISOString(),
      status: "blocked",
      results: null,
      error: "Only SELECT queries are allowed. Your query must start with SELECT.",
      meta: { rowCount: 0, executionTimeMs: Date.now() - startTime },
    };
  }

  // Validate: reject dangerous keywords that could modify data
  const dangerousPatterns = [
    /\bINSERT\b/i, /\bUPDATE\b/i, /\bDELETE\b/i,
    /\bDROP\b/i, /\bALTER\b/i, /\bTRUNCATE\b/i,
    /\bCREATE\b/i, /\bGRANT\b/i, /\bREVOKE\b/i,
    /\bINTO\s+OUTFILE\b/i, /\bINTO\s+DUMPFILE\b/i,
    /\bLOAD_FILE\b/i,
  ];

  for (const pattern of dangerousPatterns) {
    if (pattern.test(trimmed)) {
      return {
        queryId: "sql" as any,
        executedAt: new Date().toISOString(),
        status: "blocked",
        results: null,
        error: `Prohibited SQL pattern detected: ${pattern.source}. Only read-only SELECT queries are allowed.`,
        meta: { rowCount: 0, executionTimeMs: Date.now() - startTime },
      };
    }
  }

  await audit.log({
    skill: "db-reader",
    action: "execute_arbitrary_sql",
    input: { sql: trimmed },
    output: null,
    queries: [trimmed],
  });

  try {
    const rows = await executeRealQuery(trimmed, []);
    const executionTimeMs = Date.now() - startTime;

    await audit.log({
      skill: "db-reader",
      action: "arbitrary_sql_success",
      input: { sql: trimmed },
      output: { rowCount: (rows as any[]).length, executionTimeMs },
      queries: [trimmed],
    });

    return {
      queryId: "sql" as any,
      executedAt: new Date().toISOString(),
      status: "success",
      results: rows,
      meta: { rowCount: (rows as any[]).length, executionTimeMs },
    };
  } catch (error) {
    const executionTimeMs = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    await audit.log({
      skill: "db-reader",
      action: "arbitrary_sql_error",
      input: { sql: trimmed },
      output: { error: errorMessage },
      queries: [trimmed],
    });

    return {
      queryId: "sql" as any,
      executedAt: new Date().toISOString(),
      status: "error",
      results: null,
      error: `SQL query failed: ${errorMessage}`,
      meta: { rowCount: 0, executionTimeMs },
    };
  }
}

function formatResults(queryId: AllowedQueryId, rows: unknown[]): unknown {
  switch (queryId) {
    case "active-subscriptions": {
      const total = rows.reduce((sum: number, r: any) => sum + (r.count || 0), 0);
      return {
        total,
        byPlan: rows.map((r: any) => ({
          plan: r.plan_type,
          count: r.count,
        })),
      };
    }
    case "trials-last-7-days":
    case "first-rebills-7d":
    case "second-rebills-7d": {
      const total = rows.reduce((sum: number, r: any) => sum + (r.count || 0), 0);
      return {
        total,
        byDay: rows.map((r: any) => {
          const dateStr = r.date instanceof Date
            ? r.date.toISOString().split("T")[0]
            : String(r.date);
          return { date: dateStr, count: r.count };
        }),
      };
    }
    case "usage-before-rebill2-7d": {
      // Single row result with first_rebills and with_usage
      const row = rows[0] as any || { first_rebills: 0, with_usage: 0 };
      return {
        totalFirstRebills: row.first_rebills || 0,
        totalWithUsage: row.with_usage || 0,
      };
    }
    case "first-rebills-cohorte-30d": {
      // Single row result with count
      const row = rows[0] as any || { count: 0 };
      return {
        total: row.count || 0,
      };
    }
    case "ad-spend-7d": {
      // Convert to EUR using CurrencyConverter
      // currency_id 2 = EUR, currency_id 4 = RON
      let totalEur = 0;
      const byCurrency: any[] = [];

      for (const r of rows as any[]) {
        const currencyId = r.currency_id;
        const cost = parseFloat(r.total_cost) || 0;
        // Map currency_id to code: 2=EUR, 4=RON
        const currencyCode = currencyId === 4 ? 'RON' : 'EUR';
        const costEur = CurrencyConverter.toEur(cost, currencyCode);

        totalEur += costEur;
        byCurrency.push({
          currencyId,
          original: Math.round(cost * 100) / 100,
          eur: costEur,
        });
      }

      return {
        totalEur: Math.round(totalEur * 100) / 100,
        byCurrency,
      };
    }
    case "trial-revenue-7d":
    case "first-rebill-revenue-7d":
    case "refunds-m1-7d": {
      // Utility model queries - aggregate by currency and convert to EUR
      let totalEur = 0;
      let totalCount = 0;
      const byCurrency: any[] = [];

      for (const r of rows as any[]) {
        const currencyCode = r.currency_code || 'EUR';
        const amount = parseFloat(r.total_amount || r.total_refunds) || 0;
        const amountEur = CurrencyConverter.toEur(amount, currencyCode);
        const count = parseInt(r.trial_count || r.first_rebill_count || r.refund_count) || 0;

        totalEur += amountEur;
        totalCount += count;
        byCurrency.push({
          currency: currencyCode,
          original: Math.round(amount * 100) / 100,
          eur: amountEur,
          count,
        });
      }

      return {
        totalEur: Math.round(totalEur * 100) / 100,
        totalCount,
        byCurrency,
      };
    }
    case "daily-revenue-7d": {
      const byDay: Record<string, {
        date: string;
        totalEur: number;
        subscriptionEur: number;
        trialsEur: number;
        refundsEur: number;
        refundsZohoEur: number;
        byType: Record<string, { typeName: string; totalEur: number; byCurrency: any[] }>;
      }> = {};
      
      for (const r of rows as any[]) {
        const dateStr = r.date instanceof Date 
          ? r.date.toISOString().split("T")[0] 
          : String(r.date);
        
        if (!byDay[dateStr]) {
          byDay[dateStr] = { 
            date: dateStr, 
            totalEur: 0, 
            subscriptionEur: 0,
            trialsEur: 0,
            refundsEur: 0,
            refundsZohoEur: 0,
            byType: {} 
          };
        }
        
        const typeId = r.invoice_type_id;
        const typeName = r.invoice_type_name || `Type ${typeId}`;
        const typeKey = typeName.includes('Zoho') ? `${typeId}-zoho` : String(typeId);
        
        if (!byDay[dateStr].byType[typeKey]) {
          byDay[dateStr].byType[typeKey] = { 
            typeName, 
            totalEur: 0, 
            byCurrency: [] 
          };
        }
        
        const originalAmount = parseFloat(r.total_original) || 0;
        const eurAmount = convertToEur(originalAmount, r.currency_code);
        const rate = HARDCODED_RATES[r.currency_code] || 1;
        
        byDay[dateStr].byType[typeKey].totalEur += eurAmount;
        byDay[dateStr].byType[typeKey].byCurrency.push({
          currency: r.currency_code,
          original: originalAmount,
          rate: rate,
          eur: eurAmount,
          invoiceCount: parseInt(r.invoice_count) || 0,
        });
        
        byDay[dateStr].totalEur += eurAmount;
        
        // Categorize by type
        if (typeId === 2) {
          byDay[dateStr].subscriptionEur += eurAmount;
        } else if (typeId === 1) {
          byDay[dateStr].trialsEur += eurAmount;
        } else if (typeId === 3 || typeId === 6) {
          if (typeName.includes('Zoho')) {
            byDay[dateStr].refundsZohoEur += eurAmount;
          } else {
            byDay[dateStr].refundsEur += eurAmount;
          }
        }
      }

      // Calculate totals
      let totalEur = 0;
      let totalSubscriptionEur = 0;
      let totalTrialsEur = 0;
      let totalRefundsEur = 0;
      let totalRefundsZohoEur = 0;
      
      for (const day of Object.values(byDay)) {
        totalEur += day.totalEur;
        totalSubscriptionEur += day.subscriptionEur;
        totalTrialsEur += day.trialsEur;
        totalRefundsEur += day.refundsEur;
        totalRefundsZohoEur += day.refundsZohoEur;
        
        // Round day totals
        day.totalEur = Math.round(day.totalEur * 100) / 100;
        day.subscriptionEur = Math.round(day.subscriptionEur * 100) / 100;
        day.trialsEur = Math.round(day.trialsEur * 100) / 100;
        day.refundsEur = Math.round(day.refundsEur * 100) / 100;
        day.refundsZohoEur = Math.round(day.refundsZohoEur * 100) / 100;
      }

      const totalAllRefundsEur = totalRefundsEur + totalRefundsZohoEur;
      const netRevenueEur = totalSubscriptionEur - totalAllRefundsEur;

      return {
        summary: {
          totalEur: Math.round(totalEur * 100) / 100,
          subscriptionEur: Math.round(totalSubscriptionEur * 100) / 100,
          trialsEur: Math.round(totalTrialsEur * 100) / 100,
          refundsInvoiceEur: Math.round(totalRefundsEur * 100) / 100,
          refundsZohoEur: Math.round(totalRefundsZohoEur * 100) / 100,
          totalRefundsEur: Math.round(totalAllRefundsEur * 100) / 100,
          netRevenueEur: Math.round(netRevenueEur * 100) / 100,
        },
        byDay: Object.values(byDay).sort((a, b) => b.date.localeCompare(a.date)),
      };
    }
    // Phase 10: Daily comparison queries
    case "trials-today":
    case "trials-7d-ago":
    case "first-rebills-today":
    case "first-rebills-7d-ago": {
      // Single row with count
      const row = rows[0] as any || { count: 0 };
      return {
        count: parseInt(row.count) || 0,
      };
    }
    case "ad-spend-today":
    case "ad-spend-7d-ago": {
      // Same format as ad-spend-7d
      let totalEur = 0;
      const byCurrency: any[] = [];

      for (const r of rows as any[]) {
        const currencyId = r.currency_id;
        const cost = parseFloat(r.total_cost) || 0;
        const currencyCode = currencyId === 4 ? 'RON' : 'EUR';
        const costEur = CurrencyConverter.toEur(cost, currencyCode);

        totalEur += costEur;
        byCurrency.push({
          currencyId,
          original: Math.round(cost * 100) / 100,
          eur: costEur,
        });
      }

      return {
        totalEur: Math.round(totalEur * 100) / 100,
        byCurrency,
      };
    }
    default:
      return rows;
  }
}

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
