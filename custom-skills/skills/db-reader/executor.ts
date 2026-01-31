import { AllowedQueryId, DBReaderResponse } from "./types.js";
import { getQuery } from "./queries/index.js";
import { HARDCODED_RATES, convertToEur } from "./queries/daily-revenue.js";
import { audit } from "../../core/audit.js";
import mysql from "mysql2/promise";

let pool: mysql.Pool | null = null;

function getPool(): mysql.Pool {
  if (!pool) {
    const host = process.env.DB_HOST;
    const port = parseInt(process.env.DB_PORT || "3306", 10);
    const user = process.env.DB_READONLY_USER;
    const password = process.env.DB_READONLY_PASSWORD;

    if (!host || !user || !password) {
      throw new Error("Database credentials not configured");
    }

    pool = mysql.createPool({
      host,
      port,
      user,
      password,
      waitForConnections: true,
      connectionLimit: 5,
      queueLimit: 0,
      connectTimeout: 10000,
    });
  }
  return pool;
}

export async function executeQuery(queryId: AllowedQueryId): Promise<DBReaderResponse> {
  const startTime = Date.now();
  const query = getQuery(queryId);

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
    input: { queryId, sql: query.sql },
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
    case "trials-last-7-days": {
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
