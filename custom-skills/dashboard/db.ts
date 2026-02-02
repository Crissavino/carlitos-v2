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
import bcrypt from "bcrypt";
import crypto from "crypto";

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
  website_id: number;     // REQUIRED - no global KPIs allowed
  business_status: string;
  frr: number;
  cpfr: number;
  srr: number;
  ur2: number;
  net_roas: number;
  ltv_30d: number;        // LTV 30 días en EUR
  trials: number;
  first_rebills: number;
  first_rebills_cohorte_30d: number;
  second_rebills: number;
  active_subscriptions: number;
  ad_spend_eur: number;
  baseline_post_reset?: boolean;
  net_revenue_eur: number;
  created_at?: string;
}

export async function saveSnapshot(snapshot: Omit<KpiSnapshot, "id" | "created_at">): Promise<number> {
  // HARDENING: Reject snapshots without website_id
  if (!snapshot.website_id) {
    throw new Error('WEBSITE_ID_REQUIRED: Cannot save snapshot without website_id. Global KPIs are disabled.');
  }

  const db = getPool();
  const [result] = await db.execute<ResultSetHeader>(
    `INSERT INTO kpi_snapshots
      (snapshot_date, website_id, business_status, frr, cpfr, srr, ur2, net_roas, ltv_30d,
       trials, first_rebills, first_rebills_cohorte_30d, second_rebills,
       active_subscriptions, ad_spend_eur, net_revenue_eur)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       business_status = VALUES(business_status),
       frr = VALUES(frr),
       cpfr = VALUES(cpfr),
       srr = VALUES(srr),
       ur2 = VALUES(ur2),
       net_roas = VALUES(net_roas),
       ltv_30d = VALUES(ltv_30d),
       trials = VALUES(trials),
       first_rebills = VALUES(first_rebills),
       first_rebills_cohorte_30d = VALUES(first_rebills_cohorte_30d),
       second_rebills = VALUES(second_rebills),
       active_subscriptions = VALUES(active_subscriptions),
       ad_spend_eur = VALUES(ad_spend_eur),
       net_revenue_eur = VALUES(net_revenue_eur)`,
    [
      snapshot.snapshot_date,
      snapshot.website_id,
      snapshot.business_status,
      snapshot.frr,
      snapshot.cpfr,
      snapshot.srr,
      snapshot.ur2,
      snapshot.net_roas,
      snapshot.ltv_30d,
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

export async function getSnapshots(websiteId: number, days: number = 30): Promise<KpiSnapshot[]> {
  // HARDENING: Require website_id
  if (!websiteId) {
    throw new Error('WEBSITE_ID_REQUIRED: Cannot get snapshots without website_id. Global KPIs are disabled.');
  }

  const db = getPool();
  const [rows] = await db.execute<RowDataPacket[]>(
    `SELECT * FROM kpi_snapshots
     WHERE website_id = ?
       AND snapshot_date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
     ORDER BY snapshot_date ASC`,
    [websiteId, days]
  );
  return rows.map(row => ({
    ...row,
    snapshot_date: row.snapshot_date instanceof Date
      ? row.snapshot_date.toISOString().split("T")[0]
      : String(row.snapshot_date),
    website_id: row.website_id,
    frr: parseFloat(row.frr) || 0,
    cpfr: parseFloat(row.cpfr) || 0,
    srr: parseFloat(row.srr) || 0,
    ur2: parseFloat(row.ur2) || 0,
    net_roas: parseFloat(row.net_roas) || 0,
    ltv_30d: parseFloat(row.ltv_30d) || 0,
    ad_spend_eur: parseFloat(row.ad_spend_eur) || 0,
    net_revenue_eur: parseFloat(row.net_revenue_eur) || 0,
    baseline_post_reset: row.baseline_post_reset === 1,
  })) as KpiSnapshot[];
}

// ============================================================================
// TASKS (KANBAN)
// ============================================================================

export type TaskStatus = "backlog" | "todo" | "in_progress" | "review" | "done" | "archived";
export type TaskPriority = "critical" | "high" | "medium" | "low";
export type TaskSource = "decision_engine" | "manual" | "alert" | "learning";

export interface Task {
  id?: number;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  source: TaskSource;
  decision_rule_id?: string;
  dedupe_key?: string;
  assignee?: string;
  area?: string;
  due_date?: string;
  created_at?: string;
  updated_at?: string;
  completed_at?: string;
}

export async function createTask(task: Omit<Task, "id" | "created_at" | "updated_at">): Promise<number> {
  const db = getPool();
  const [result] = await db.execute<ResultSetHeader>(
    `INSERT INTO tasks (title, description, status, priority, source, decision_rule_id, dedupe_key, assignee, area, due_date)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      task.title,
      task.description || null,
      task.status || "backlog",
      task.priority || "medium",
      task.source || "manual",
      task.decision_rule_id || null,
      task.dedupe_key || null,
      task.assignee || null,
      task.area || null,
      task.due_date || null,
    ]
  );
  return result.insertId;
}

// Create task with dedupe - returns existing task id if dedupe_key exists
export async function createTaskWithDedupe(task: Omit<Task, "id" | "created_at" | "updated_at">): Promise<{ id: number; created: boolean }> {
  if (!task.dedupe_key) {
    const id = await createTask(task);
    return { id, created: true };
  }

  const db = getPool();

  // Check if task with this dedupe_key already exists and is not done/archived
  const [existing] = await db.execute<RowDataPacket[]>(
    "SELECT id, status FROM tasks WHERE dedupe_key = ? AND status NOT IN ('done', 'archived')",
    [task.dedupe_key]
  );

  if (existing.length > 0) {
    return { id: existing[0].id, created: false };
  }

  const id = await createTask(task);
  return { id, created: true };
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
    dedupe_key: row.dedupe_key,
    assignee: row.assignee,
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
    review: 0,
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

// ============================================================================
// TASK ARTIFACTS
// ============================================================================

export type ArtifactType = "analysis" | "insight" | "data" | "chart" | "recommendation" | "error";

export interface TaskArtifact {
  id?: number;
  task_id: number;
  run_id?: number;
  artifact_type: ArtifactType;
  name: string;
  content?: string;
  metadata?: Record<string, unknown>;
  created_at?: string;
}

export async function createArtifact(artifact: Omit<TaskArtifact, "id" | "created_at">): Promise<number> {
  const db = getPool();
  const [result] = await db.execute<ResultSetHeader>(
    `INSERT INTO task_artifacts (task_id, run_id, artifact_type, name, content, metadata)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      artifact.task_id,
      artifact.run_id || null,
      artifact.artifact_type,
      artifact.name,
      artifact.content || null,
      artifact.metadata ? JSON.stringify(artifact.metadata) : null,
    ]
  );
  return result.insertId;
}

export async function getArtifacts(taskId: number, runId?: number): Promise<TaskArtifact[]> {
  const db = getPool();
  let sql = "SELECT * FROM task_artifacts WHERE task_id = ?";
  const params: unknown[] = [taskId];

  if (runId) {
    sql += " AND run_id = ?";
    params.push(runId);
  }

  sql += " ORDER BY created_at DESC";

  const [rows] = await db.execute<RowDataPacket[]>(sql, params);
  return rows.map(row => ({
    id: row.id,
    task_id: row.task_id,
    run_id: row.run_id,
    artifact_type: row.artifact_type,
    name: row.name,
    content: row.content,
    metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
    created_at: row.created_at?.toISOString?.() || row.created_at,
  }));
}

// ============================================================================
// TASK GENERATION (DecisionEngine -> Tasks)
// ============================================================================

export interface GenerationLog {
  id?: number;
  generated_at?: string;
  source: string;
  trigger_type: string;
  rules_evaluated: number;
  tasks_created: number;
  tasks_skipped: number;
  business_status?: string;
  snapshot_id?: number;
}

export async function logGeneration(log: Omit<GenerationLog, "id" | "generated_at">): Promise<number> {
  const db = getPool();
  const [result] = await db.execute<ResultSetHeader>(
    `INSERT INTO task_generation_log (source, trigger_type, rules_evaluated, tasks_created, tasks_skipped, business_status, snapshot_id)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      log.source,
      log.trigger_type,
      log.rules_evaluated,
      log.tasks_created,
      log.tasks_skipped,
      log.business_status || null,
      log.snapshot_id || null,
    ]
  );
  return result.insertId;
}

export async function getGenerationLogs(limit: number = 10): Promise<GenerationLog[]> {
  const db = getPool();
  const [rows] = await db.execute<RowDataPacket[]>(
    "SELECT * FROM task_generation_log ORDER BY generated_at DESC LIMIT ?",
    [limit]
  );
  return rows.map(row => ({
    id: row.id,
    generated_at: row.generated_at?.toISOString?.() || row.generated_at,
    source: row.source,
    trigger_type: row.trigger_type,
    rules_evaluated: row.rules_evaluated,
    tasks_created: row.tasks_created,
    tasks_skipped: row.tasks_skipped,
    business_status: row.business_status,
    snapshot_id: row.snapshot_id,
  }));
}

// Generate dedupe key for decision engine tasks
export function generateDedupeKey(ruleId: string, weekNumber: number, year: number): string {
  return `decision:${ruleId}:${year}-W${weekNumber.toString().padStart(2, "0")}`;
}

// Get current ISO week number
export function getISOWeek(date: Date = new Date()): { week: number; year: number } {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return { week, year: d.getUTCFullYear() };
}

// ============================================================================
// DISCREPANCY LOG (Phase 8C)
// ============================================================================

export type DiscrepancyType = 'false_positive' | 'false_negative' | 'late_signal' | 'data_issue' | 'other';
export type DiscrepancySeverity = 'low' | 'medium' | 'high' | 'critical';
export type DiscrepancyEntityType = 'campaign' | 'keyword' | 'search_term' | 'kpi' | 'decision' | 'recommendation';
export type DiscrepancyStatus = 'open' | 'investigating' | 'resolved' | 'wont_fix';

export interface Discrepancy {
  id?: number;
  discrepancy_type: DiscrepancyType;
  severity: DiscrepancySeverity;
  entity_type: DiscrepancyEntityType;
  entity_id?: string;
  entity_name?: string;
  system_recommendation?: string;
  actual_outcome?: string;
  description: string;
  spend_involved?: number;
  days_delayed?: number;
  status: DiscrepancyStatus;
  resolution_notes?: string;
  resolved_at?: string;
  reported_by?: string;
  created_at?: string;
  updated_at?: string;
}

export interface DiscrepancySummary {
  discrepancy_type: DiscrepancyType;
  status: DiscrepancyStatus;
  count: number;
  total_spend_involved: number;
  avg_days_delayed: number;
}

export async function createDiscrepancy(discrepancy: Omit<Discrepancy, 'id' | 'created_at' | 'updated_at'>): Promise<number> {
  const db = getPool();
  const [result] = await db.execute<ResultSetHeader>(
    `INSERT INTO discrepancy_log
     (discrepancy_type, severity, entity_type, entity_id, entity_name,
      system_recommendation, actual_outcome, description,
      spend_involved, days_delayed, status, reported_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      discrepancy.discrepancy_type,
      discrepancy.severity,
      discrepancy.entity_type,
      discrepancy.entity_id || null,
      discrepancy.entity_name || null,
      discrepancy.system_recommendation || null,
      discrepancy.actual_outcome || null,
      discrepancy.description,
      discrepancy.spend_involved || 0,
      discrepancy.days_delayed || 0,
      discrepancy.status || 'open',
      discrepancy.reported_by || 'user',
    ]
  );
  return result.insertId;
}

export async function getDiscrepancies(filters?: {
  status?: DiscrepancyStatus | DiscrepancyStatus[];
  type?: DiscrepancyType;
  entity_type?: DiscrepancyEntityType;
  limit?: number;
}): Promise<Discrepancy[]> {
  const db = getPool();
  let query = "SELECT * FROM discrepancy_log WHERE 1=1";
  const params: unknown[] = [];

  if (filters?.status) {
    if (Array.isArray(filters.status)) {
      query += ` AND status IN (${filters.status.map(() => '?').join(',')})`;
      params.push(...filters.status);
    } else {
      query += " AND status = ?";
      params.push(filters.status);
    }
  }

  if (filters?.type) {
    query += " AND discrepancy_type = ?";
    params.push(filters.type);
  }

  if (filters?.entity_type) {
    query += " AND entity_type = ?";
    params.push(filters.entity_type);
  }

  query += " ORDER BY created_at DESC";

  if (filters?.limit) {
    query += " LIMIT ?";
    params.push(filters.limit);
  }

  const [rows] = await db.execute<RowDataPacket[]>(query, params);
  return rows.map(row => ({
    id: row.id,
    discrepancy_type: row.discrepancy_type,
    severity: row.severity,
    entity_type: row.entity_type,
    entity_id: row.entity_id,
    entity_name: row.entity_name,
    system_recommendation: row.system_recommendation,
    actual_outcome: row.actual_outcome,
    description: row.description,
    spend_involved: parseFloat(row.spend_involved) || 0,
    days_delayed: row.days_delayed,
    status: row.status,
    resolution_notes: row.resolution_notes,
    resolved_at: row.resolved_at?.toISOString?.() || row.resolved_at,
    reported_by: row.reported_by,
    created_at: row.created_at?.toISOString?.() || row.created_at,
    updated_at: row.updated_at?.toISOString?.() || row.updated_at,
  }));
}

export async function getDiscrepancyById(id: number): Promise<Discrepancy | null> {
  const db = getPool();
  const [rows] = await db.execute<RowDataPacket[]>(
    "SELECT * FROM discrepancy_log WHERE id = ?",
    [id]
  );
  if (rows.length === 0) return null;
  const row = rows[0];
  return {
    id: row.id,
    discrepancy_type: row.discrepancy_type,
    severity: row.severity,
    entity_type: row.entity_type,
    entity_id: row.entity_id,
    entity_name: row.entity_name,
    system_recommendation: row.system_recommendation,
    actual_outcome: row.actual_outcome,
    description: row.description,
    spend_involved: parseFloat(row.spend_involved) || 0,
    days_delayed: row.days_delayed,
    status: row.status,
    resolution_notes: row.resolution_notes,
    resolved_at: row.resolved_at?.toISOString?.() || row.resolved_at,
    reported_by: row.reported_by,
    created_at: row.created_at?.toISOString?.() || row.created_at,
    updated_at: row.updated_at?.toISOString?.() || row.updated_at,
  };
}

export async function updateDiscrepancy(id: number, updates: Partial<Discrepancy>): Promise<void> {
  const db = getPool();
  const fields: string[] = [];
  const values: unknown[] = [];

  if (updates.status !== undefined) {
    fields.push("status = ?");
    values.push(updates.status);
    if (updates.status === 'resolved') {
      fields.push("resolved_at = NOW()");
    }
  }
  if (updates.severity !== undefined) {
    fields.push("severity = ?");
    values.push(updates.severity);
  }
  if (updates.resolution_notes !== undefined) {
    fields.push("resolution_notes = ?");
    values.push(updates.resolution_notes);
  }
  if (updates.actual_outcome !== undefined) {
    fields.push("actual_outcome = ?");
    values.push(updates.actual_outcome);
  }

  if (fields.length === 0) return;

  values.push(id);
  await db.execute(
    `UPDATE discrepancy_log SET ${fields.join(", ")} WHERE id = ?`,
    values
  );
}

export async function getDiscrepancySummary(): Promise<{
  total: number;
  open: number;
  by_type: Record<DiscrepancyType, number>;
  by_severity: Record<DiscrepancySeverity, number>;
  total_spend_involved: number;
}> {
  const db = getPool();

  const [countRows] = await db.execute<RowDataPacket[]>(
    "SELECT COUNT(*) as total, SUM(status = 'open') as open_count, SUM(spend_involved) as total_spend FROM discrepancy_log"
  );

  const [typeRows] = await db.execute<RowDataPacket[]>(
    "SELECT discrepancy_type, COUNT(*) as count FROM discrepancy_log GROUP BY discrepancy_type"
  );

  const [sevRows] = await db.execute<RowDataPacket[]>(
    "SELECT severity, COUNT(*) as count FROM discrepancy_log GROUP BY severity"
  );

  const byType: Record<string, number> = {};
  for (const row of typeRows) {
    byType[row.discrepancy_type] = row.count;
  }

  const bySeverity: Record<string, number> = {};
  for (const row of sevRows) {
    bySeverity[row.severity] = row.count;
  }

  return {
    total: countRows[0]?.total || 0,
    open: countRows[0]?.open_count || 0,
    by_type: byType as Record<DiscrepancyType, number>,
    by_severity: bySeverity as Record<DiscrepancySeverity, number>,
    total_spend_involved: parseFloat(countRows[0]?.total_spend) || 0,
  };
}

// ============================================================================
// AUTHENTICATION (Users & Sessions)
// ============================================================================

export type UserScope = 'admin' | 'viewer';

export interface User {
  id?: number;
  email: string;
  password_hash?: string;
  scope: UserScope;
  created_at?: string;
  updated_at?: string;
}

export interface Session {
  id?: number;
  user_id: number;
  token: string;
  expires_at: string;
  created_at?: string;
}

const BCRYPT_ROUNDS = 12;
const SESSION_DURATION_DAYS = 7;

// Create user with hashed password
export async function createUser(
  email: string,
  password: string,
  scope: UserScope = 'viewer'
): Promise<number> {
  const db = getPool();
  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

  const [result] = await db.execute<ResultSetHeader>(
    "INSERT INTO users (email, password_hash, scope) VALUES (?, ?, ?)",
    [email.toLowerCase().trim(), passwordHash, scope]
  );

  return result.insertId;
}

// Validate login credentials
export async function validateLogin(
  email: string,
  password: string
): Promise<User | null> {
  const db = getPool();
  const [rows] = await db.execute<RowDataPacket[]>(
    "SELECT id, email, password_hash, scope, created_at, updated_at FROM users WHERE email = ?",
    [email.toLowerCase().trim()]
  );

  if (rows.length === 0) {
    return null;
  }

  const user = rows[0];
  const isValid = await bcrypt.compare(password, user.password_hash);

  if (!isValid) {
    return null;
  }

  return {
    id: user.id,
    email: user.email,
    scope: user.scope,
    created_at: user.created_at?.toISOString?.() || user.created_at,
    updated_at: user.updated_at?.toISOString?.() || user.updated_at,
  };
}

// Create session for user
export async function createSession(userId: number): Promise<string> {
  const db = getPool();
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + SESSION_DURATION_DAYS);

  await db.execute(
    "INSERT INTO sessions (user_id, token, expires_at) VALUES (?, ?, ?)",
    [userId, token, expiresAt.toISOString().slice(0, 19).replace('T', ' ')]
  );

  return token;
}

// Validate session token and return user if valid
export async function validateSession(token: string): Promise<User | null> {
  if (!token) return null;

  const db = getPool();
  const [rows] = await db.execute<RowDataPacket[]>(
    `SELECT u.id, u.email, u.scope, u.created_at, u.updated_at
     FROM sessions s
     JOIN users u ON s.user_id = u.id
     WHERE s.token = ? AND s.expires_at > NOW()`,
    [token]
  );

  if (rows.length === 0) {
    return null;
  }

  const user = rows[0];
  return {
    id: user.id,
    email: user.email,
    scope: user.scope,
    created_at: user.created_at?.toISOString?.() || user.created_at,
    updated_at: user.updated_at?.toISOString?.() || user.updated_at,
  };
}

// Delete session (logout)
export async function deleteSession(token: string): Promise<void> {
  const db = getPool();
  await db.execute("DELETE FROM sessions WHERE token = ?", [token]);
}

// Get all users (for admin panel)
export async function getUsers(): Promise<User[]> {
  const db = getPool();
  const [rows] = await db.execute<RowDataPacket[]>(
    "SELECT id, email, scope, created_at, updated_at FROM users ORDER BY created_at DESC"
  );

  return rows.map(row => ({
    id: row.id,
    email: row.email,
    scope: row.scope,
    created_at: row.created_at?.toISOString?.() || row.created_at,
    updated_at: row.updated_at?.toISOString?.() || row.updated_at,
  }));
}

// Get user by ID
export async function getUserById(id: number): Promise<User | null> {
  const db = getPool();
  const [rows] = await db.execute<RowDataPacket[]>(
    "SELECT id, email, scope, created_at, updated_at FROM users WHERE id = ?",
    [id]
  );

  if (rows.length === 0) return null;

  const row = rows[0];
  return {
    id: row.id,
    email: row.email,
    scope: row.scope,
    created_at: row.created_at?.toISOString?.() || row.created_at,
    updated_at: row.updated_at?.toISOString?.() || row.updated_at,
  };
}

// Check if any users exist (for initial setup)
export async function hasUsers(): Promise<boolean> {
  const db = getPool();
  const [rows] = await db.execute<RowDataPacket[]>(
    "SELECT COUNT(*) as count FROM users"
  );
  return rows[0].count > 0;
}

// Cleanup expired sessions
export async function cleanupExpiredSessions(): Promise<number> {
  const db = getPool();
  const [result] = await db.execute<ResultSetHeader>(
    "DELETE FROM sessions WHERE expires_at <= NOW()"
  );
  return result.affectedRows;
}
