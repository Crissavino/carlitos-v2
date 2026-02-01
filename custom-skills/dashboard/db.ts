/**
 * OpenClaw Internal Database Connection
 *
 * Separate database for OpenClaw operations (dashboard, tasks, learning).
 * Completely isolated from core business database (Avocode).
 *
 * Database: openclaw_internal
 * Tables: kpi_snapshots, tasks, task_comments, task_runs, task_artifacts (future)
 */

import mysql, { Pool, RowDataPacket, ResultSetHeader } from "mysql2/promise";

let pool: Pool | null = null;

export function getPool(): Pool {
  if (!pool) {
    // OpenClaw internal DB - full access for dashboard operations
    const host = process.env.DB_OPENCLAW_HOST;
    const port = parseInt(process.env.DB_OPENCLAW_PORT || "3306", 10);
    const user = process.env.DB_OPENCLAW_USER;
    const password = process.env.DB_OPENCLAW_PASSWORD;
    const database = process.env.DB_OPENCLAW_DATABASE || "openclaw_internal";

    if (!host || !user || !password) {
      throw new Error("OpenClaw database credentials not configured (DB_OPENCLAW_*)");
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

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

// ============================================================================
// KPI SNAPSHOTS
// ============================================================================

export interface KpiSnapshot {
  id?: number;
  snapshot_date: string;  // YYYY-MM-DD
  business_status: string;
  frr: number;
  cpfr: number;
  srr: number;
  ur2: number;
  net_roas: number;
  trials: number;
  first_rebills: number;
  first_rebills_cohorte_30d: number;
  second_rebills: number;
  active_subscriptions: number;
  ad_spend_eur: number;
  net_revenue_eur: number;
  created_at?: string;
}

export async function saveSnapshot(snapshot: Omit<KpiSnapshot, "id" | "created_at">): Promise<number> {
  const db = getPool();
  const [result] = await db.execute<ResultSetHeader>(
    `INSERT INTO kpi_snapshots
      (snapshot_date, business_status, frr, cpfr, srr, ur2, net_roas,
       trials, first_rebills, first_rebills_cohorte_30d, second_rebills,
       active_subscriptions, ad_spend_eur, net_revenue_eur)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       business_status = VALUES(business_status),
       frr = VALUES(frr),
       cpfr = VALUES(cpfr),
       srr = VALUES(srr),
       ur2 = VALUES(ur2),
       net_roas = VALUES(net_roas),
       trials = VALUES(trials),
       first_rebills = VALUES(first_rebills),
       first_rebills_cohorte_30d = VALUES(first_rebills_cohorte_30d),
       second_rebills = VALUES(second_rebills),
       active_subscriptions = VALUES(active_subscriptions),
       ad_spend_eur = VALUES(ad_spend_eur),
       net_revenue_eur = VALUES(net_revenue_eur)`,
    [
      snapshot.snapshot_date,
      snapshot.business_status,
      snapshot.frr,
      snapshot.cpfr,
      snapshot.srr,
      snapshot.ur2,
      snapshot.net_roas,
      snapshot.trials,
      snapshot.first_rebills,
      snapshot.first_rebills_cohorte_30d,
      snapshot.second_rebills,
      snapshot.active_subscriptions,
      snapshot.ad_spend_eur,
      snapshot.net_revenue_eur,
    ]
  );
  return result.insertId || result.affectedRows;
}

export async function getSnapshots(days: number = 30): Promise<KpiSnapshot[]> {
  const db = getPool();
  const [rows] = await db.execute<RowDataPacket[]>(
    `SELECT * FROM kpi_snapshots
     WHERE snapshot_date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
     ORDER BY snapshot_date ASC`,
    [days]
  );
  return rows.map(row => ({
    ...row,
    snapshot_date: row.snapshot_date instanceof Date
      ? row.snapshot_date.toISOString().split("T")[0]
      : String(row.snapshot_date),
    frr: parseFloat(row.frr) || 0,
    cpfr: parseFloat(row.cpfr) || 0,
    srr: parseFloat(row.srr) || 0,
    ur2: parseFloat(row.ur2) || 0,
    net_roas: parseFloat(row.net_roas) || 0,
    ad_spend_eur: parseFloat(row.ad_spend_eur) || 0,
    net_revenue_eur: parseFloat(row.net_revenue_eur) || 0,
  })) as KpiSnapshot[];
}

// ============================================================================
// TASKS (KANBAN)
// ============================================================================

export type TaskStatus = "backlog" | "todo" | "in_progress" | "done" | "archived";
export type TaskPriority = "critical" | "high" | "medium" | "low";
export type TaskSource = "decision_engine" | "manual" | "alert";

export interface Task {
  id?: number;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  source: TaskSource;
  decision_rule_id?: string;
  area?: string;
  due_date?: string;
  created_at?: string;
  updated_at?: string;
  completed_at?: string;
}

export async function createTask(task: Omit<Task, "id" | "created_at" | "updated_at">): Promise<number> {
  const db = getPool();
  const [result] = await db.execute<ResultSetHeader>(
    `INSERT INTO tasks (title, description, status, priority, source, decision_rule_id, area, due_date)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      task.title,
      task.description || null,
      task.status || "backlog",
      task.priority || "medium",
      task.source || "manual",
      task.decision_rule_id || null,
      task.area || null,
      task.due_date || null,
    ]
  );
  return result.insertId;
}

export async function getTasks(filters?: {
  status?: TaskStatus | TaskStatus[];
  priority?: TaskPriority;
  source?: TaskSource;
}): Promise<Task[]> {
  const db = getPool();
  let sql = "SELECT * FROM tasks WHERE 1=1";
  const params: unknown[] = [];

  if (filters?.status) {
    if (Array.isArray(filters.status)) {
      sql += ` AND status IN (${filters.status.map(() => "?").join(", ")})`;
      params.push(...filters.status);
    } else {
      sql += " AND status = ?";
      params.push(filters.status);
    }
  }
  if (filters?.priority) {
    sql += " AND priority = ?";
    params.push(filters.priority);
  }
  if (filters?.source) {
    sql += " AND source = ?";
    params.push(filters.source);
  }

  sql += " ORDER BY FIELD(priority, 'critical', 'high', 'medium', 'low'), created_at DESC";

  const [rows] = await db.execute<RowDataPacket[]>(sql, params);
  return rows.map(formatTask);
}

export async function getTaskById(id: number): Promise<Task | null> {
  const db = getPool();
  const [rows] = await db.execute<RowDataPacket[]>(
    "SELECT * FROM tasks WHERE id = ?",
    [id]
  );
  return rows.length > 0 ? formatTask(rows[0]) : null;
}

export async function updateTask(id: number, updates: Partial<Task>): Promise<boolean> {
  const db = getPool();
  const allowedFields = ["title", "description", "status", "priority", "area", "due_date"];
  const sets: string[] = [];
  const params: unknown[] = [];

  for (const [key, value] of Object.entries(updates)) {
    if (allowedFields.includes(key)) {
      sets.push(`${key} = ?`);
      params.push(value);
    }
  }

  // Auto-set completed_at when status changes to done
  if (updates.status === "done") {
    sets.push("completed_at = CURRENT_TIMESTAMP");
  } else if (updates.status) {
    // Status changed to something other than done, clear completed_at
    sets.push("completed_at = NULL");
  }

  if (sets.length === 0) return false;

  params.push(id);
  const [result] = await db.execute<ResultSetHeader>(
    `UPDATE tasks SET ${sets.join(", ")} WHERE id = ?`,
    params
  );
  return result.affectedRows > 0;
}

export async function deleteTask(id: number): Promise<boolean> {
  const db = getPool();
  const [result] = await db.execute<ResultSetHeader>(
    "DELETE FROM tasks WHERE id = ?",
    [id]
  );
  return result.affectedRows > 0;
}

function formatTask(row: RowDataPacket): Task {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    status: row.status,
    priority: row.priority,
    source: row.source,
    decision_rule_id: row.decision_rule_id,
    area: row.area,
    due_date: row.due_date ? (row.due_date instanceof Date
      ? row.due_date.toISOString().split("T")[0]
      : String(row.due_date)) : undefined,
    created_at: row.created_at?.toISOString?.() || row.created_at,
    updated_at: row.updated_at?.toISOString?.() || row.updated_at,
    completed_at: row.completed_at?.toISOString?.() || row.completed_at,
  };
}

// ============================================================================
// KANBAN SUMMARY
// ============================================================================

export async function getKanbanSummary(): Promise<Record<TaskStatus, number>> {
  const db = getPool();
  const [rows] = await db.execute<RowDataPacket[]>(
    `SELECT status, COUNT(*) as count FROM tasks
     WHERE status != 'archived'
     GROUP BY status`
  );

  const summary: Record<TaskStatus, number> = {
    backlog: 0,
    todo: 0,
    in_progress: 0,
    done: 0,
    archived: 0,
  };

  for (const row of rows) {
    summary[row.status as TaskStatus] = row.count;
  }

  return summary;
}

// ============================================================================
// TASK COMMENTS
// ============================================================================

export interface TaskComment {
  id?: number;
  task_id: number;
  comment: string;
  author: string;
  created_at?: string;
}

export async function addComment(taskId: number, comment: string, author: string = "system"): Promise<number> {
  const db = getPool();
  const [result] = await db.execute<ResultSetHeader>(
    "INSERT INTO task_comments (task_id, comment, author) VALUES (?, ?, ?)",
    [taskId, comment, author]
  );
  return result.insertId;
}

export async function getComments(taskId: number): Promise<TaskComment[]> {
  const db = getPool();
  const [rows] = await db.execute<RowDataPacket[]>(
    "SELECT * FROM task_comments WHERE task_id = ? ORDER BY created_at ASC",
    [taskId]
  );
  return rows.map(row => ({
    id: row.id,
    task_id: row.task_id,
    comment: row.comment,
    author: row.author,
    created_at: row.created_at?.toISOString?.() || row.created_at,
  }));
}

// ============================================================================
// TASK RUNS (Execution history)
// ============================================================================

export type RunStatus = "running" | "success" | "failed" | "cancelled";

export interface TaskRun {
  id?: number;
  task_id: number;
  started_at?: string;
  completed_at?: string;
  status: RunStatus;
  output?: string;
  error_message?: string;
  changes_made?: Record<string, unknown>;
  duration_ms?: number;
  tokens_used?: number;
}

export async function startRun(taskId: number): Promise<number> {
  const db = getPool();
  const [result] = await db.execute<ResultSetHeader>(
    "INSERT INTO task_runs (task_id, status) VALUES (?, 'running')",
    [taskId]
  );
  return result.insertId;
}

export async function completeRun(
  runId: number,
  status: "success" | "failed" | "cancelled",
  output?: string,
  errorMessage?: string,
  changesMade?: Record<string, unknown>,
  tokensUsed?: number
): Promise<boolean> {
  const db = getPool();
  const [result] = await db.execute<ResultSetHeader>(
    `UPDATE task_runs SET
       completed_at = CURRENT_TIMESTAMP,
       status = ?,
       output = ?,
       error_message = ?,
       changes_made = ?,
       duration_ms = TIMESTAMPDIFF(MICROSECOND, started_at, CURRENT_TIMESTAMP) / 1000,
       tokens_used = ?
     WHERE id = ?`,
    [status, output || null, errorMessage || null, changesMade ? JSON.stringify(changesMade) : null, tokensUsed || null, runId]
  );
  return result.affectedRows > 0;
}

export async function getRuns(taskId: number): Promise<TaskRun[]> {
  const db = getPool();
  const [rows] = await db.execute<RowDataPacket[]>(
    "SELECT * FROM task_runs WHERE task_id = ? ORDER BY started_at DESC",
    [taskId]
  );
  return rows.map(row => ({
    id: row.id,
    task_id: row.task_id,
    started_at: row.started_at?.toISOString?.() || row.started_at,
    completed_at: row.completed_at?.toISOString?.() || row.completed_at,
    status: row.status,
    output: row.output,
    error_message: row.error_message,
    changes_made: row.changes_made ? JSON.parse(row.changes_made) : undefined,
    duration_ms: row.duration_ms,
    tokens_used: row.tokens_used,
  }));
}

export async function getLatestRun(taskId: number): Promise<TaskRun | null> {
  const runs = await getRuns(taskId);
  return runs.length > 0 ? runs[0] : null;
}
