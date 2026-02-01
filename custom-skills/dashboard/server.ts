/**
 * Dashboard API Server
 *
 * Express server that exposes BusinessExpert and DecisionEngine via HTTP API.
 * Lives inside custom-skills to share types and imports directly.
 */

import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
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
  createTaskWithDedupe,
  getTasks,
  getTaskById,
  updateTask,
  deleteTask,
  getKanbanSummary,
  addComment,
  getComments,
  startRun,
  completeRun,
  getRuns,
  createArtifact,
  getArtifacts,
  logGeneration,
  getGenerationLogs,
  generateDedupeKey,
  getISOWeek,
  type KpiSnapshot,
  type Task,
  type TaskStatus,
} from "./db.js";
import { CurrencyConverter } from "../core/currency.js";

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

app.get("/api", (req: Request, res: Response) => {
  res.json({
    name: "OpenClaw Dashboard API",
    version: "2.0.0",
    endpoints: {
      // Business Expert
      summary: "GET /api/business/summary",
      kpis: "GET /api/business/kpis",
      raw: "GET /api/business/raw",
      // Decision Engine
      weeklyReport: "GET /api/decision/weekly-report",
      decisions: "GET /api/decision/current",
      rules: "GET /api/decision/rules",
      // Campaigns (Phase 7)
      campaignsList: "GET /api/campaigns",
      campaignsActions: "GET /api/campaigns/actions",
      // Campaign Decisions (Phase 7.5)
      campaignDecisions: "GET /api/campaigns/decisions",
      campaignDecisionsUrgent: "GET /api/campaigns/decisions/urgent",
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
// CURRENCY RATES (for cron updates)
// ============================================================================

// GET /api/currency/rates - Get current exchange rates (public)
app.get("/api/currency/rates", (req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      rates: CurrencyConverter.getAllRates(),
      lastUpdated: CurrencyConverter.getLastUpdated()?.toISOString() || null,
      isStale: CurrencyConverter.isStale(),
    },
  });
});

// POST /api/currency/refresh - Refresh rates from external API (protected)
app.post("/api/currency/refresh", authMiddleware, async (req: Request, res: Response) => {
  try {
    const success = await CurrencyConverter.refreshRates();
    if (success) {
      res.json({
        success: true,
        message: "Currency rates refreshed",
        data: {
          rates: CurrencyConverter.getAllRates(),
          lastUpdated: CurrencyConverter.getLastUpdated()?.toISOString(),
        },
      });
    } else {
      res.status(500).json({ error: "Failed to refresh rates from API" });
    }
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
  }
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
          frr: { value: summary.kpis.frr.value, percentage: Math.round(summary.kpis.frr.value * 1000) / 10, status: summary.kpis.frr.status, reason: summary.kpis.frr.shortReason },
          cpfr: { value: summary.kpis.cpfr.value, status: summary.kpis.cpfr.status, reason: summary.kpis.cpfr.shortReason },
          srr: { value: summary.kpis.srr.value, percentage: Math.round(summary.kpis.srr.value * 1000) / 10, status: summary.kpis.srr.status, reason: summary.kpis.srr.shortReason },
          ur2: { value: summary.kpis.ur2.value, percentage: Math.round(summary.kpis.ur2.value * 1000) / 10, status: summary.kpis.ur2.status, reason: summary.kpis.ur2.shortReason, isDiagnostic: true },
          netRoas: { value: summary.kpis.netRoas.value, status: summary.kpis.netRoas.status, reason: summary.kpis.netRoas.shortReason },
          ltv30d: { value: summary.kpis.ltv30d.value, status: summary.kpis.ltv30d.status, reason: summary.kpis.ltv30d.shortReason },
          paybackRatio: { value: summary.kpis.paybackRatio.value, status: summary.kpis.paybackRatio.status, reason: summary.kpis.paybackRatio.shortReason },
          // Phase 6.1: Ventanas correctas
          ltv21d: { value: summary.kpis.ltv21d.value, status: summary.kpis.ltv21d.status, reason: summary.kpis.ltv21d.shortReason },
          payback21d: { value: summary.kpis.payback21d.value, status: summary.kpis.payback21d.status, reason: summary.kpis.payback21d.shortReason },
          ltv51d: { value: summary.kpis.ltv51d.value, status: summary.kpis.ltv51d.status, reason: summary.kpis.ltv51d.shortReason },
          payback51d: { value: summary.kpis.payback51d.value, status: summary.kpis.payback51d.status, reason: summary.kpis.payback51d.shortReason },
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
          ltv30d: {
            value: kpis.ltv30d.value,
            status: kpis.ltv30d.status,
            reason: kpis.ltv30d.shortReason,
            sampleSize: raw.ltv30dSampleSize,
          },
          paybackRatio: {
            value: kpis.paybackRatio.value,
            status: kpis.paybackRatio.status,
            reason: kpis.paybackRatio.shortReason,
            numerator: raw.ltv30d,
            denominator: kpis.cpfr.value,
          },
          // Phase 6.1: Ventanas correctas
          ltv21d: {
            value: kpis.ltv21d.value,
            status: kpis.ltv21d.status,
            reason: kpis.ltv21d.shortReason,
            cohortSize: raw.ltv21dCohortSize,
          },
          payback21d: {
            value: kpis.payback21d.value,
            status: kpis.payback21d.status,
            reason: kpis.payback21d.shortReason,
          },
          ltv51d: {
            value: kpis.ltv51d.value,
            status: kpis.ltv51d.status,
            reason: kpis.ltv51d.shortReason,
            cohortSize: raw.ltv51dCohortSize,
          },
          payback51d: {
            value: kpis.payback51d.value,
            status: kpis.payback51d.status,
            reason: kpis.payback51d.shortReason,
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
// CAMPAIGNS (Phase 7)
// ============================================================================

import {
  getCampaignPerformance,
  getCampaignsToPause,
  getCampaignsToScale,
  getCampaignsToMonitor,
} from "../skills/business-expert/analyzers/campaign-analyzer.js";
import {
  evaluateCampaignRules,
  getCampaignsNeedingAction,
} from "../skills/decision-engine/campaign-rules/evaluator.js";

// GET /api/campaigns - Get all campaigns with metrics
app.get("/api/campaigns", async (req: Request, res: Response) => {
  try {
    const data = await getCampaignPerformance();
    if (!data) {
      res.status(500).json({ error: "No campaign data available" });
      return;
    }

    res.json({
      success: true,
      data,
    });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
  }
});

// GET /api/campaigns/actions - Get campaigns needing action (pause/scale/monitor)
app.get("/api/campaigns/actions", async (req: Request, res: Response) => {
  try {
    const [toPause, toScale, toMonitor] = await Promise.all([
      getCampaignsToPause(),
      getCampaignsToScale(),
      getCampaignsToMonitor(),
    ]);

    res.json({
      success: true,
      data: {
        toPause: {
          count: toPause.length,
          campaigns: toPause,
        },
        toScale: {
          count: toScale.length,
          campaigns: toScale,
        },
        toMonitor: {
          count: toMonitor.length,
          campaigns: toMonitor,
        },
      },
    });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
  }
});

// GET /api/campaigns/decisions - Get DecisionEngine decisions for campaigns (Phase 7.5)
app.get("/api/campaigns/decisions", async (req: Request, res: Response) => {
  try {
    const summary = await evaluateCampaignRules();
    if (!summary) {
      res.status(500).json({ error: "No campaign data available for decisions" });
      return;
    }

    res.json({
      success: true,
      data: summary,
    });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
  }
});

// GET /api/campaigns/decisions/urgent - Get only campaigns needing immediate action
app.get("/api/campaigns/decisions/urgent", async (req: Request, res: Response) => {
  try {
    const actions = await getCampaignsNeedingAction();

    res.json({
      success: true,
      data: {
        count: actions.length,
        decisions: actions,
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
      ltv_30d: kpis.ltv30d.value,
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

// POST /api/tasks/generate - Generate tasks from DecisionEngine (with dedupe)
app.post("/api/tasks/generate", async (req: Request, res: Response) => {
  try {
    const { triggerType = "manual" } = req.body;

    const raw = await fetchRawMetrics();
    if (!raw) {
      res.status(500).json({ error: "Failed to fetch metrics" });
      return;
    }

    const kpis = calculateCoreKpis(raw);
    const businessStatus = determineBusinessStatus(kpis);
    const decisions = evaluateRules(kpis);
    const topActions = getTopActions(decisions, 5);

    const { week, year } = getISOWeek();
    const created: Task[] = [];
    let skipped = 0;

    for (const action of topActions) {
      const dedupeKey = generateDedupeKey(action.ruleId, week, year);

      const newTask: Omit<Task, "id" | "created_at" | "updated_at"> = {
        title: action.action,
        description: `**Auto-generated from DecisionEngine**\n\n**Rule:** ${action.ruleName}\n\n**Rationale:** ${action.rationale}\n\n**Week:** ${year}-W${week.toString().padStart(2, "0")}`,
        status: "backlog",
        priority: action.priority as Task["priority"],
        source: "decision_engine",
        decision_rule_id: action.ruleId,
        dedupe_key: dedupeKey,
        area: action.area,
      };

      const result = await createTaskWithDedupe(newTask);
      if (result.created) {
        const task = await getTaskById(result.id);
        if (task) created.push(task);
      } else {
        skipped++;
      }
    }

    // Log the generation
    await logGeneration({
      source: "decision_engine",
      trigger_type: triggerType,
      rules_evaluated: decisions.length,
      tasks_created: created.length,
      tasks_skipped: skipped,
      business_status: businessStatus,
    });

    res.json({
      success: true,
      data: {
        week: `${year}-W${week.toString().padStart(2, "0")}`,
        businessStatus,
        evaluated: decisions.length,
        topActions: topActions.length,
        created: created.length,
        skipped,
        tasks: created,
      },
    });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
  }
});

// GET /api/tasks/generation-log - Get task generation history
app.get("/api/tasks/generation-log", async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;
    const logs = await getGenerationLogs(limit);
    res.json({ success: true, data: logs });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
  }
});

// ============================================================================
// TASK DETAILS (Comments, Runs, Artifacts)
// ============================================================================

// GET /api/tasks/:id/details - Get full task details
app.get("/api/tasks/:id/details", async (req: Request, res: Response) => {
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

    const [comments, runs, artifacts] = await Promise.all([
      getComments(id),
      getRuns(id),
      getArtifacts(id),
    ]);

    res.json({
      success: true,
      data: {
        ...task,
        comments,
        runs,
        artifacts,
      },
    });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
  }
});

// POST /api/tasks/:id/comments - Add comment to task
app.post("/api/tasks/:id/comments", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      res.status(400).json({ error: "Invalid task ID" });
      return;
    }

    const { comment, author = "user" } = req.body;
    if (!comment || typeof comment !== "string") {
      res.status(400).json({ error: "Comment is required" });
      return;
    }

    const task = await getTaskById(id);
    if (!task) {
      res.status(404).json({ error: "Task not found" });
      return;
    }

    const commentId = await addComment(id, comment, author);
    const comments = await getComments(id);

    res.status(201).json({
      success: true,
      data: { id: commentId, comments },
    });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
  }
});

// GET /api/tasks/:id/runs - Get task execution history
app.get("/api/tasks/:id/runs", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      res.status(400).json({ error: "Invalid task ID" });
      return;
    }

    const runs = await getRuns(id);
    res.json({ success: true, data: runs });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
  }
});

// POST /api/tasks/:id/run - Start a new run (OpenClaw executes task)
app.post("/api/tasks/:id/run", async (req: Request, res: Response) => {
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

    // Update task status to in_progress
    await updateTask(id, { status: "in_progress" });

    // Create run record
    const runId = await startRun(id);

    // Add comment
    await addComment(id, "OpenClaw started working on this task", "openclaw");

    res.status(201).json({
      success: true,
      data: {
        runId,
        taskId: id,
        status: "running",
        message: "Run started. Task is now in progress.",
      },
    });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
  }
});

// PATCH /api/runs/:id - Complete a run
app.patch("/api/runs/:id", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      res.status(400).json({ error: "Invalid run ID" });
      return;
    }

    const { status, output, errorMessage, changesMade, tokensUsed } = req.body;

    if (!status || !["success", "failed", "cancelled"].includes(status)) {
      res.status(400).json({ error: "Valid status required (success, failed, cancelled)" });
      return;
    }

    await completeRun(id, status, output, errorMessage, changesMade, tokensUsed);

    res.json({
      success: true,
      data: { id, status, message: "Run completed" },
    });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
  }
});

// GET /api/tasks/:id/artifacts - Get task artifacts
app.get("/api/tasks/:id/artifacts", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      res.status(400).json({ error: "Invalid task ID" });
      return;
    }

    const runId = req.query.runId ? parseInt(req.query.runId as string, 10) : undefined;
    const artifacts = await getArtifacts(id, runId);

    res.json({ success: true, data: artifacts });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
  }
});

// POST /api/tasks/:id/artifacts - Create artifact
app.post("/api/tasks/:id/artifacts", async (req: Request, res: Response) => {
  try {
    const taskId = parseInt(req.params.id, 10);
    if (isNaN(taskId)) {
      res.status(400).json({ error: "Invalid task ID" });
      return;
    }

    const { runId, artifactType, name, content, metadata } = req.body;

    if (!artifactType || !name) {
      res.status(400).json({ error: "artifactType and name are required" });
      return;
    }

    const id = await createArtifact({
      task_id: taskId,
      run_id: runId,
      artifact_type: artifactType,
      name,
      content,
      metadata,
    });

    res.status(201).json({
      success: true,
      data: { id, taskId, artifactType, name },
    });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
  }
});

// ============================================================================
// FRONTEND (Static files)
// ============================================================================

// __dirname is dist/dashboard/ after compilation, frontend is at dashboard/frontend/dist
const frontendPath = path.join(__dirname, "..", "..", "dashboard", "frontend", "dist");
app.use(express.static(frontendPath, { index: "index.html" }));

// SPA fallback - serve index.html for non-API routes
app.get("*", (req: Request, res: Response, next: NextFunction) => {
  if (req.path.startsWith("/api")) {
    return next();
  }
  res.sendFile(path.join(frontendPath, "index.html"));
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

app.listen(PORT, "0.0.0.0", async () => {
  console.log(`Dashboard running on http://0.0.0.0:${PORT}`);
  console.log(`API: http://0.0.0.0:${PORT}/api`);
  console.log(`Auth token: ${DASHBOARD_TOKEN ? "configured" : "using default"}`);

  // Refresh currency rates on startup
  console.log("Refreshing currency exchange rates...");
  const success = await CurrencyConverter.refreshRates();
  if (!success) {
    console.log("Using default currency rates (API refresh failed)");
  }
});

export default app;
