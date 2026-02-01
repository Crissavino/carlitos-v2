/**
 * Dashboard API Server
 *
 * Express server that exposes BusinessExpert and DecisionEngine via HTTP API.
 * Lives inside custom-skills to share types and imports directly.
 */

import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import {
  fetchRawMetrics,
  calculateCoreKpis,
  determineBusinessStatus,
} from "../skills/business-expert/analyzers/cross-analyzer.js";
import {
  generateExecutiveSummary,
} from "../skills/business-expert/reporters/executive-summary.js";
import {
  generateWeeklyReport,
} from "../skills/decision-engine/reporters/weekly-report.js";
import {
  evaluateRules,
  getTopActions,
} from "../skills/decision-engine/rules/evaluator.js";
import {
  getDecisionRules,
} from "../skills/decision-engine/rules/decision-matrix.js";
import {
  saveSnapshot,
  getSnapshots,
  createTask,
  getTasks,
  getTaskById,
  updateTask,
  deleteTask,
  getKanbanSummary,
  type KpiSnapshot,
  type Task,
  type TaskStatus,
} from "./db.js";

const app = express();
const PORT = parseInt(process.env.DASHBOARD_PORT || "3002", 10);
const DASHBOARD_TOKEN = process.env.DASHBOARD_TOKEN || "dev-token-change-in-prod";

// ============================================================================
// MIDDLEWARE
// ============================================================================

app.use(cors({ origin: process.env.CORS_ORIGIN || "*", credentials: true }));
app.use(express.json());

// Request logging
app.use((req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  res.on("finish", () => {
    console.log(`${req.method} ${req.path} ${res.statusCode} ${Date.now() - start}ms`);
  });
  next();
});

// Auth middleware
function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    res.status(401).json({ error: "Missing Authorization header" });
    return;
  }
  const [type, token] = authHeader.split(" ");
  if (type !== "Bearer" || token !== DASHBOARD_TOKEN) {
    res.status(403).json({ error: "Invalid token" });
    return;
  }
  next();
}

// ============================================================================
// PUBLIC ROUTES
// ============================================================================

app.get("/", (req: Request, res: Response) => {
  res.json({
    name: "OpenClaw Dashboard API",
    version: "1.1.0",
    endpoints: {
      // Business Expert
      summary: "GET /api/business/summary",
      kpis: "GET /api/business/kpis",
      raw: "GET /api/business/raw",
      // Decision Engine
      weeklyReport: "GET /api/decision/weekly-report",
      decisions: "GET /api/decision/current",
      rules: "GET /api/decision/rules",
      // Snapshots (Historical)
      snapshotCreate: "POST /api/snapshots",
      snapshotList: "GET /api/snapshots?days=30",
      // Tasks (Kanban)
      taskList: "GET /api/tasks?status=todo,in_progress",
      taskGet: "GET /api/tasks/:id",
      taskCreate: "POST /api/tasks",
      taskUpdate: "PATCH /api/tasks/:id",
      taskDelete: "DELETE /api/tasks/:id",
      taskGenerate: "POST /api/tasks/generate",
      // Health
      health: "GET /health",
    },
  });
});

app.get("/health", (req: Request, res: Response) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// ============================================================================
// PROTECTED ROUTES
// ============================================================================

app.use("/api", authMiddleware);

// GET /api/business/summary
app.get("/api/business/summary", async (req: Request, res: Response) => {
  try {
    const summary = await generateExecutiveSummary();
    if (!summary) {
      res.status(500).json({ error: "Failed to generate summary" });
      return;
    }
    res.json({
      success: true,
      data: {
        businessStatus: summary.businessStatus,
        generatedAt: summary.generatedAt,
        period: summary.period,
        financials: {
          netRevenueEur: summary.netRevenueEur,
          adSpendEur: summary.adSpendEur,
        },
        kpis: {
          frr: { value: summary.kpis.frr.value, percentage: Math.round(summary.kpis.frr.value * 1000) / 10, status: summary.kpis.frr.status },
          cpfr: { value: summary.kpis.cpfr.value, status: summary.kpis.cpfr.status },
          srr: { value: summary.kpis.srr.value, percentage: Math.round(summary.kpis.srr.value * 1000) / 10, status: summary.kpis.srr.status },
          ur2: { value: summary.kpis.ur2.value, percentage: Math.round(summary.kpis.ur2.value * 1000) / 10, status: summary.kpis.ur2.status, isDiagnostic: true },
          netRoas: { value: summary.kpis.netRoas.value, status: summary.kpis.netRoas.status },
        },
        alerts: summary.alerts,
        summaryText: summary.summaryText,
      },
    });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
  }
});

// GET /api/business/kpis
app.get("/api/business/kpis", async (req: Request, res: Response) => {
  try {
    const raw = await fetchRawMetrics();
    if (!raw) {
      res.status(500).json({ error: "Failed to fetch metrics" });
      return;
    }
    const kpis = calculateCoreKpis(raw);
    const businessStatus = determineBusinessStatus(kpis);

    res.json({
      success: true,
      data: {
        businessStatus,
        generatedAt: raw.generatedAt,
        period: raw.period,
        kpis: {
          frr: {
            value: kpis.frr.value,
            percentage: Math.round(kpis.frr.value * 1000) / 10,
            status: kpis.frr.status,
            reason: kpis.frr.shortReason,
            numerator: raw.firstRebills,
            denominator: raw.trials,
          },
          cpfr: {
            value: kpis.cpfr.value,
            status: kpis.cpfr.status,
            reason: kpis.cpfr.shortReason,
            numerator: raw.totalAdSpendEur,
            denominator: raw.firstRebills,
          },
          srr: {
            value: kpis.srr.value,
            percentage: Math.round(kpis.srr.value * 1000) / 10,
            status: kpis.srr.status,
            reason: kpis.srr.shortReason,
            numerator: raw.secondRebills,
            denominator: raw.firstRebillsCohorte30d,
          },
          ur2: {
            value: kpis.ur2.value,
            percentage: Math.round(kpis.ur2.value * 1000) / 10,
            status: kpis.ur2.status,
            reason: kpis.ur2.shortReason,
            isDiagnostic: true,
          },
          netRoas: {
            value: kpis.netRoas.value,
            status: kpis.netRoas.status,
            reason: kpis.netRoas.shortReason,
            numerator: raw.netRevenueEur,
            denominator: raw.totalAdSpendEur,
          },
        },
        totals: {
          trials: raw.trials,
          firstRebills: raw.firstRebills,
          firstRebillsCohorte30d: raw.firstRebillsCohorte30d,
          secondRebills: raw.secondRebills,
          netRevenueEur: raw.netRevenueEur,
          adSpendEur: raw.totalAdSpendEur,
          activeSubscriptions: raw.activeSubscriptions,
        },
      },
    });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
  }
});

// GET /api/business/raw
app.get("/api/business/raw", async (req: Request, res: Response) => {
  try {
    const raw = await fetchRawMetrics();
    if (!raw) {
      res.status(500).json({ error: "Failed to fetch raw metrics" });
      return;
    }
    res.json({ success: true, data: raw });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
  }
});

// GET /api/decision/weekly-report
app.get("/api/decision/weekly-report", async (req: Request, res: Response) => {
  try {
    const report = await generateWeeklyReport();
    if (!report) {
      res.status(500).json({ error: "Failed to generate weekly report" });
      return;
    }
    res.json({
      success: true,
      data: {
        weekNumber: report.weekNumber,
        year: report.year,
        generatedAt: report.generatedAt,
        businessStatus: report.businessStatus,
        kpiSummary: report.kpiSummary,
        decisions: report.decisions,
        actions: report.actions,
        nextReviewDate: report.nextReviewDate,
      },
    });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
  }
});

// GET /api/decision/current
app.get("/api/decision/current", async (req: Request, res: Response) => {
  try {
    const raw = await fetchRawMetrics();
    if (!raw) {
      res.status(500).json({ error: "Failed to fetch metrics" });
      return;
    }
    const kpis = calculateCoreKpis(raw);
    const decisions = evaluateRules(kpis);
    const topActions = getTopActions(decisions, 5);

    res.json({
      success: true,
      data: {
        allDecisions: decisions.length,
        topActions,
      },
    });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
  }
});

// GET /api/decision/rules
app.get("/api/decision/rules", (req: Request, res: Response) => {
  try {
    const rules = getDecisionRules();
    res.json({
      success: true,
      data: {
        totalRules: rules.length,
        rules: rules.map((r) => ({
          id: r.id,
          name: r.name,
          description: r.description,
          decision: {
            type: r.decision.type,
            priority: r.decision.priority,
            area: r.decision.area,
            action: r.decision.action,
            reversible: r.decision.reversible,
          },
          triggerKpis: r.triggerKpis,
        })),
      },
    });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
  }
});

// ============================================================================
// SNAPSHOTS (Historical KPIs)
// ============================================================================

// POST /api/snapshots - Save daily snapshot (called by cron)
app.post("/api/snapshots", async (req: Request, res: Response) => {
  try {
    // Fetch current metrics and calculate KPIs
    const raw = await fetchRawMetrics();
    if (!raw) {
      res.status(500).json({ error: "Failed to fetch metrics for snapshot" });
      return;
    }

    const kpis = calculateCoreKpis(raw);
    const businessStatus = determineBusinessStatus(kpis);

    const snapshot: Omit<KpiSnapshot, "id" | "created_at"> = {
      snapshot_date: new Date().toISOString().split("T")[0],
      business_status: businessStatus,
      frr: kpis.frr.value,
      cpfr: kpis.cpfr.value,
      srr: kpis.srr.value,
      ur2: kpis.ur2.value,
      net_roas: kpis.netRoas.value,
      trials: raw.trials,
      first_rebills: raw.firstRebills,
      first_rebills_cohorte_30d: raw.firstRebillsCohorte30d,
      second_rebills: raw.secondRebills,
      active_subscriptions: raw.activeSubscriptions,
      ad_spend_eur: raw.totalAdSpendEur,
      net_revenue_eur: raw.netRevenueEur,
    };

    const result = await saveSnapshot(snapshot);

    res.json({
      success: true,
      data: {
        message: "Snapshot saved",
        date: snapshot.snapshot_date,
        businessStatus: snapshot.business_status,
        affected: result,
      },
    });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
  }
});

// GET /api/snapshots - Get historical snapshots
app.get("/api/snapshots", async (req: Request, res: Response) => {
  try {
    const days = parseInt(req.query.days as string) || 30;
    const maxDays = 365; // Limit to 1 year
    const snapshots = await getSnapshots(Math.min(days, maxDays));

    res.json({
      success: true,
      data: {
        count: snapshots.length,
        days: Math.min(days, maxDays),
        snapshots,
      },
    });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
  }
});

// ============================================================================
// TASKS (Kanban)
// ============================================================================

// GET /api/tasks - List tasks with filters
app.get("/api/tasks", async (req: Request, res: Response) => {
  try {
    const { status, priority, source } = req.query;

    const filters: {
      status?: TaskStatus | TaskStatus[];
      priority?: string;
      source?: string;
    } = {};

    if (status) {
      // Support comma-separated statuses: ?status=todo,in_progress
      const statuses = (status as string).split(",") as TaskStatus[];
      filters.status = statuses.length === 1 ? statuses[0] : statuses;
    }
    if (priority) filters.priority = priority as string;
    if (source) filters.source = source as string;

    const tasks = await getTasks(filters as any);
    const summary = await getKanbanSummary();

    res.json({
      success: true,
      data: {
        count: tasks.length,
        summary,
        tasks,
      },
    });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
  }
});

// GET /api/tasks/:id - Get single task
app.get("/api/tasks/:id", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      res.status(400).json({ error: "Invalid task ID" });
      return;
    }

    const task = await getTaskById(id);
    if (!task) {
      res.status(404).json({ error: "Task not found" });
      return;
    }

    res.json({ success: true, data: task });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
  }
});

// POST /api/tasks - Create task
app.post("/api/tasks", async (req: Request, res: Response) => {
  try {
    const { title, description, status, priority, source, decision_rule_id, area, due_date } = req.body;

    if (!title || typeof title !== "string" || title.trim().length === 0) {
      res.status(400).json({ error: "Title is required" });
      return;
    }

    const newTask: Omit<Task, "id" | "created_at" | "updated_at"> = {
      title: title.trim(),
      description: description || undefined,
      status: status || "backlog",
      priority: priority || "medium",
      source: source || "manual",
      decision_rule_id: decision_rule_id || undefined,
      area: area || undefined,
      due_date: due_date || undefined,
    };

    const id = await createTask(newTask);
    const created = await getTaskById(id);

    res.status(201).json({
      success: true,
      data: created,
    });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
  }
});

// PATCH /api/tasks/:id - Update task
app.patch("/api/tasks/:id", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      res.status(400).json({ error: "Invalid task ID" });
      return;
    }

    const existing = await getTaskById(id);
    if (!existing) {
      res.status(404).json({ error: "Task not found" });
      return;
    }

    const { title, description, status, priority, area, due_date } = req.body;
    const updates: Partial<Task> = {};

    if (title !== undefined) updates.title = title;
    if (description !== undefined) updates.description = description;
    if (status !== undefined) updates.status = status;
    if (priority !== undefined) updates.priority = priority;
    if (area !== undefined) updates.area = area;
    if (due_date !== undefined) updates.due_date = due_date;

    await updateTask(id, updates);
    const updated = await getTaskById(id);

    res.json({ success: true, data: updated });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
  }
});

// DELETE /api/tasks/:id - Delete task
app.delete("/api/tasks/:id", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      res.status(400).json({ error: "Invalid task ID" });
      return;
    }

    const deleted = await deleteTask(id);
    if (!deleted) {
      res.status(404).json({ error: "Task not found" });
      return;
    }

    res.json({ success: true, data: { deleted: true, id } });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
  }
});

// POST /api/tasks/generate - Generate tasks from DecisionEngine
app.post("/api/tasks/generate", async (req: Request, res: Response) => {
  try {
    const raw = await fetchRawMetrics();
    if (!raw) {
      res.status(500).json({ error: "Failed to fetch metrics" });
      return;
    }

    const kpis = calculateCoreKpis(raw);
    const decisions = evaluateRules(kpis);
    const topActions = getTopActions(decisions, 5);

    const created: Task[] = [];

    for (const action of topActions) {
      // Check if task already exists for this rule
      const existing = await getTasks({ source: "decision_engine" });
      const alreadyExists = existing.some(
        (t) => t.decision_rule_id === action.ruleId && t.status !== "done" && t.status !== "archived"
      );

      if (!alreadyExists) {
        const newTask: Omit<Task, "id" | "created_at" | "updated_at"> = {
          title: action.action,
          description: `Auto-generated from DecisionEngine rule: ${action.ruleName}\n\nRationale: ${action.rationale}`,
          status: "backlog",
          priority: action.priority as any,
          source: "decision_engine",
          decision_rule_id: action.ruleId,
          area: action.area,
        };

        const id = await createTask(newTask);
        const task = await getTaskById(id);
        if (task) created.push(task);
      }
    }

    res.json({
      success: true,
      data: {
        evaluated: decisions.length,
        topActions: topActions.length,
        created: created.length,
        tasks: created,
      },
    });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
  }
});

// ============================================================================
// ERROR HANDLING
// ============================================================================

app.use((req: Request, res: Response) => {
  res.status(404).json({ error: "Not found", path: req.path });
});

// ============================================================================
// START
// ============================================================================

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Dashboard API running on http://0.0.0.0:${PORT}`);
  console.log(`Auth token: ${DASHBOARD_TOKEN ? "configured" : "using default"}`);
});

export default app;
