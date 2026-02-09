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
  clearMetricsCache,
} from "../skills/business-expert/analyzers/cross-analyzer.js";
import {
  generateExecutiveSummary,
} from "../skills/business-expert/reporters/executive-summary.js";
import {
  clearLtvCache,
  getCustomerCohortDistribution,
} from "../skills/business-expert/analyzers/revenue-analyzer.js";
import {
  executeQuery,
} from "../skills/db-reader/executor.js";
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
  createDiscrepancy,
  getDiscrepancies,
  getDiscrepancyById,
  updateDiscrepancy,
  getDiscrepancySummary,
  // Auth
  createUser,
  validateLogin,
  createSession,
  validateSession,
  deleteSession,
  getUsers,
  getUserById,
  hasUsers,
  type KpiSnapshot,
  type Task,
  type TaskStatus,
  type Discrepancy,
  type DiscrepancyType,
  type DiscrepancySeverity,
  type DiscrepancyEntityType,
  type DiscrepancyStatus,
  type User,
  type UserScope,
} from "./db.js";
import { CurrencyConverter } from "../core/currency.js";
import { validateWebsiteId, VALID_WEBSITE_IDS, getWebsiteConfig } from "../core/websites.js";
import {
  grossRevenueQuery,
  refundsQuery,
  adSpendQuery,
  trialsCountQuery,
  firstRebillsQuery,
  disputeRateQuery,
  paybackByWebsiteQuery,
  dailyPulseQuery,
  refundRateM1Query,
  type DateRangeConfig,
} from "../skills/db-reader/queries/global-view-kpis.js";
import {
  revenueByCompanyQuery,
  refundsByCompanyQuery,
  adSpendByCompanyQuery,
  frrByCompanyQuery,
  refundRateM1ByCompanyQuery,
  disputeRateByCompanyQuery,
} from "../skills/db-reader/queries/companies-view-kpis.js";
import {
  revenueByWebsiteQuery,
  refundsByWebsiteQuery,
  adSpendByWebsiteQuery,
  frrByWebsiteQuery,
  refundRateM1ByWebsiteQuery,
  disputeRateByWebsiteQuery,
  totalRevenueByWebsiteQuery,
  totalRefundsByWebsiteQuery,
} from "../skills/db-reader/queries/websites-view-kpis.js";
import {
  revenueByCountryQuery,
  refundsByCountryQuery,
  totalRevenueByCountryQuery,
  totalRefundsByCountryQuery,
  adSpendByCountryQuery,
  frrByCountryQuery,
  refundRateM1ByCountryQuery,
  disputeRateByCountryQuery,
  DateRangeConfig as CountryDateRangeConfig,
} from "../skills/db-reader/queries/countries-view-kpis.js";
import {
  activeAcquisitionsQuery,
  activeSubscribersQuery,
  grossTurnoverPerDayQuery,
  refundsMtdQuery,
  adsExpenseMtdQuery,
  costPerFirstRebillByWebsiteQuery,
} from "../skills/db-reader/queries/legacy-header-cards.js";

const app = express();
const PORT = parseInt(process.env.DASHBOARD_PORT || "3002", 10);
const DASHBOARD_TOKEN = process.env.DASHBOARD_TOKEN || "dev-token-change-in-prod";

// Extend Express Request to include user from session auth
declare global {
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}

// ============================================================================
// MIDDLEWARE
// ============================================================================

app.use(cors({ origin: process.env.CORS_ORIGIN || "*", credentials: true }));
app.use(express.json({ limit: "50mb" }));  // Increased for image uploads

// Request logging
app.use((req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  res.on("finish", () => {
    console.log(`${req.method} ${req.path} ${res.statusCode} ${Date.now() - start}ms`);
  });
  next();
});

// Legacy auth middleware (API token for backwards compatibility / cron jobs)
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

// Session-based auth middleware
async function sessionAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    res.status(401).json({ error: "Missing Authorization header" });
    return;
  }

  const [type, token] = authHeader.split(" ");
  if (type !== "Bearer") {
    res.status(401).json({ error: "Invalid authorization type" });
    return;
  }

  // First try legacy API token (avoids DB dependency for dev/testing)
  if (token === DASHBOARD_TOKEN) {
    // Create a synthetic admin user for API token access
    req.user = { id: 0, email: "api@system", scope: "admin" };
    next();
    return;
  }

  // Then try session token (requires DB_OPENCLAW_* configured)
  try {
    const user = await validateSession(token);
    if (user) {
      req.user = user;
      next();
      return;
    }
  } catch (err) {
    // DB not configured - only legacy token auth available
    console.warn("[sessionAuth] Session validation failed, DB may not be configured");
  }

  res.status(401).json({ error: "Invalid session" });
}

// Admin-only auth middleware
async function adminAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    res.status(401).json({ error: "Missing Authorization header" });
    return;
  }

  const [type, token] = authHeader.split(" ");
  if (type !== "Bearer") {
    res.status(401).json({ error: "Invalid authorization type" });
    return;
  }

  // First try session token
  const user = await validateSession(token);
  if (user) {
    if (user.scope !== "admin") {
      res.status(403).json({ error: "Admin access required" });
      return;
    }
    req.user = user;
    next();
    return;
  }

  // Fallback to legacy API token (admin access)
  if (token === DASHBOARD_TOKEN) {
    req.user = { id: 0, email: "api@system", scope: "admin" };
    next();
    return;
  }

  res.status(401).json({ error: "Invalid session" });
}

// ============================================================================
// PUBLIC ROUTES
// ============================================================================

app.get("/api", (req: Request, res: Response) => {
  res.json({
    name: "OpenClaw Dashboard API",
    version: "2.1.0",
    note: "HARDENING: All KPI endpoints require websiteId parameter. Global KPIs are disabled.",
    validWebsiteIds: VALID_WEBSITE_IDS,
    endpoints: {
      // Business Expert (all require websiteId)
      summary: "GET /api/business/summary?websiteId=1",
      kpis: "GET /api/business/kpis?websiteId=1",
      raw: "GET /api/business/raw?websiteId=1",
      // Decision Engine (all require websiteId)
      weeklyReport: "GET /api/decision/weekly-report?websiteId=1",
      decisions: "GET /api/decision/current?websiteId=1",
      rules: "GET /api/decision/rules",
      // Campaigns (Phase 7)
      campaignsList: "GET /api/campaigns",
      campaignsActions: "GET /api/campaigns/actions",
      // Campaign Decisions (Phase 7.5)
      campaignDecisions: "GET /api/campaigns/decisions",
      campaignDecisionsUrgent: "GET /api/campaigns/decisions/urgent",
      // Keywords (Phase 8A)
      keywordsList: "GET /api/keywords",
      keywordsSummary: "GET /api/keywords/summary",
      keywordsTop: "GET /api/keywords/top?limit=20",
      keywordsUnderperforming: "GET /api/keywords/underperforming",
      keywordsWaste: "GET /api/keywords/waste",
      keywordsByCampaign: "GET /api/keywords/by-campaign/:id",
      // Search Terms (Phase 8B)
      searchTermsList: "GET /api/search-terms",
      searchTermsSummary: "GET /api/search-terms/summary",
      searchTermsTop: "GET /api/search-terms/top?limit=20",
      searchTermsWaste: "GET /api/search-terms/waste",
      searchTermsByCampaign: "GET /api/search-terms/by-campaign/:id",
      searchTermsByKeyword: "GET /api/search-terms/by-keyword?keyword=...",
      // Snapshots (Historical) - require websiteId
      snapshotCreate: "POST /api/snapshots (body: {websiteId: 1})",
      snapshotList: "GET /api/snapshots?websiteId=1&days=30",
      // Tasks (Kanban)
      taskList: "GET /api/tasks?status=todo,in_progress",
      taskGet: "GET /api/tasks/:id",
      taskCreate: "POST /api/tasks",
      taskUpdate: "PATCH /api/tasks/:id",
      taskDelete: "DELETE /api/tasks/:id",
      taskGenerate: "POST /api/tasks/generate (body: {websiteId: 1})",
      // Discrepancy Log (Phase 8C)
      discrepancyList: "GET /api/discrepancies",
      discrepancySummary: "GET /api/discrepancies/summary",
      discrepancyGet: "GET /api/discrepancies/:id",
      discrepancyCreate: "POST /api/discrepancies",
      discrepancyUpdate: "PATCH /api/discrepancies/:id",
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

// ============================================================================
// AUTHENTICATION ROUTES (Public)
// ============================================================================

// POST /api/auth/login - Login with email/password
app.post("/api/auth/login", async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ error: "Email and password are required" });
      return;
    }

    const user = await validateLogin(email, password);
    if (!user) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }

    const token = await createSession(user.id!);

    res.json({
      success: true,
      data: {
        token,
        user: {
          id: user.id,
          email: user.email,
          scope: user.scope,
        },
      },
    });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
  }
});

// POST /api/auth/logout - Logout (invalidate session)
app.post("/api/auth/logout", async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader) {
      const [, token] = authHeader.split(" ");
      if (token) {
        await deleteSession(token);
      }
    }

    res.json({ success: true, data: { message: "Logged out" } });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
  }
});

// GET /api/auth/me - Get current user info (requires session)
app.get("/api/auth/me", sessionAuth, async (req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      id: req.user!.id,
      email: req.user!.email,
      scope: req.user!.scope,
    },
  });
});

// POST /api/auth/setup - One-time initial user setup (only works if no users exist)
app.post("/api/auth/setup", async (req: Request, res: Response) => {
  try {
    const usersExist = await hasUsers();
    if (usersExist) {
      res.status(403).json({ error: "Setup already completed. Users exist." });
      return;
    }

    const { email, password, scope = "admin" } = req.body;

    if (!email || !password) {
      res.status(400).json({ error: "Email and password are required" });
      return;
    }

    const userId = await createUser(email, password, scope as UserScope);
    const user = await getUserById(userId);

    res.status(201).json({
      success: true,
      data: {
        message: "Initial admin user created",
        user: {
          id: user!.id,
          email: user!.email,
          scope: user!.scope,
        },
      },
    });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
  }
});

// ============================================================================
// ADMIN ROUTES (Require admin scope)
// ============================================================================

// POST /api/admin/users - Create a new user (admin only)
app.post("/api/admin/users", adminAuth, async (req: Request, res: Response) => {
  try {
    const { email, password, scope = "viewer" } = req.body;

    if (!email || !password) {
      res.status(400).json({ error: "Email and password are required" });
      return;
    }

    if (scope !== "admin" && scope !== "viewer") {
      res.status(400).json({ error: "Scope must be 'admin' or 'viewer'" });
      return;
    }

    const userId = await createUser(email, password, scope as UserScope);
    const user = await getUserById(userId);

    res.status(201).json({
      success: true,
      data: user,
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes("Duplicate entry")) {
      res.status(409).json({ error: "User with this email already exists" });
      return;
    }
    res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
  }
});

// GET /api/chat/token - Get gateway token (admin only)
app.get("/api/chat/token", adminAuth, (req: Request, res: Response) => {
  const token = process.env.OPENCLAW_GATEWAY_TOKEN;
  if (!token) {
    res.status(500).json({ error: "Gateway token not configured" });
    return;
  }
  res.json({ success: true, data: { token } });
});

// ============================================================================
// CHAT SESSION MANAGEMENT
// ============================================================================

// OpenAI-compatible message content format
interface ChatMessageContent {
  type: "text" | "image_url";
  text?: string;
  image_url?: { url: string };
}

interface ChatMessageHistory {
  role: "user" | "assistant";
  content: string | ChatMessageContent[];
}

interface ChatSession {
  id: string;
  name: string;
  createdAt: Date;
  lastMessageAt: Date;
  messages: ChatMessageHistory[];
}

// In-memory session store (could be moved to DB later)
const chatSessions = new Map<string, ChatSession>();

// GET /api/chat/sessions - List all sessions (admin only)
app.get("/api/chat/sessions", adminAuth, (req: Request, res: Response) => {
  const sessions = Array.from(chatSessions.values())
    .map(s => ({
      id: s.id,
      name: s.name,
      createdAt: s.createdAt.toISOString(),
      lastMessageAt: s.lastMessageAt.toISOString(),
      messageCount: s.messages.length,
    }))
    .sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime());

  res.json({ success: true, data: { sessions } });
});

// POST /api/chat/sessions - Create new session (admin only)
app.post("/api/chat/sessions", adminAuth, (req: Request, res: Response) => {
  const { name } = req.body;
  const id = `session-${Date.now()}`;
  const session: ChatSession = {
    id,
    name: name || `Chat ${new Date().toLocaleDateString()}`,
    createdAt: new Date(),
    lastMessageAt: new Date(),
    messages: [],
  };
  chatSessions.set(id, session);

  res.json({ success: true, data: { id: session.id, name: session.name } });
});

// DELETE /api/chat/sessions/:id - Delete session (admin only)
app.delete("/api/chat/sessions/:id", adminAuth, (req: Request, res: Response) => {
  const { id } = req.params;
  if (chatSessions.has(id)) {
    chatSessions.delete(id);
    res.json({ success: true, data: { deleted: true } });
  } else {
    res.status(404).json({ error: "Session not found" });
  }
});

// GET /api/chat/sessions/:id/messages - Get session messages (admin only)
app.get("/api/chat/sessions/:id/messages", adminAuth, (req: Request, res: Response) => {
  const { id } = req.params;
  const session = chatSessions.get(id);
  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }

  // Return messages with images stripped (for display purposes)
  const messages = session.messages.map(m => ({
    role: m.role,
    content: typeof m.content === "string" ? m.content :
      m.content.map(c => c.type === "text" ? c.text : "[imagen]").join(" "),
  }));

  res.json({ success: true, data: { messages } });
});

// POST /api/chat/send - Send message to OpenClaw (admin only)
app.post("/api/chat/send", adminAuth, async (req: Request, res: Response) => {
  const token = process.env.OPENCLAW_GATEWAY_TOKEN;
  if (!token) {
    res.status(500).json({ error: "Gateway token not configured" });
    return;
  }

  const { message, images, sessionId } = req.body;
  if (!message && (!images || images.length === 0)) {
    res.status(400).json({ error: "Message or images required" });
    return;
  }

  // Get or create session
  let session = sessionId ? chatSessions.get(sessionId) : null;
  if (!session) {
    const id = sessionId || `session-${Date.now()}`;
    session = {
      id,
      name: `Chat ${new Date().toLocaleDateString()}`,
      createdAt: new Date(),
      lastMessageAt: new Date(),
      messages: [],
    };
    chatSessions.set(id, session);
  }

  try {
    // Build message content (OpenAI-compatible format)
    const content: ChatMessageContent[] = [];

    // Add text first
    if (message) {
      content.push({ type: "text", text: message });
    } else if (images && images.length > 0) {
      // If only images, add a generic prompt
      content.push({ type: "text", text: "¿Qué ves en esta imagen?" });
    }

    // Add images (OpenAI format: image_url with data URL)
    if (images && images.length > 0) {
      for (const img of images) {
        content.push({
          type: "image_url",
          image_url: { url: img },  // img is already a data URL
        });
      }
    }

    // Add user message to session history
    session.messages.push({ role: "user", content });
    session.lastMessageAt = new Date();

    // Build request with full message history
    const requestBody = {
      model: "agent:main",
      messages: session.messages,
      stream: true,
      user: session.id,
    };

    // Proxy to OpenClaw Gateway
    const response = await fetch("http://0.0.0.0:18789/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      // Remove failed message from history
      session.messages.pop();
      res.status(response.status).json({ error: errorText });
      return;
    }

    // Stream the response and collect full response
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Session-Id", session.id);

    const reader = response.body?.getReader();
    if (!reader) {
      session.messages.pop();
      res.status(500).json({ error: "No response body" });
      return;
    }

    const decoder = new TextDecoder();
    let fullResponse = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      res.write(chunk);

      // Parse SSE to collect full response
      const lines = chunk.split("\n");
      for (const line of lines) {
        if (line.startsWith("data: ") && line !== "data: [DONE]") {
          try {
            const data = JSON.parse(line.slice(6));
            const content = data.choices?.[0]?.delta?.content;
            if (content) fullResponse += content;
          } catch {
            // Ignore parse errors
          }
        }
      }
    }

    // Add assistant response to session history
    if (fullResponse) {
      session.messages.push({ role: "assistant", content: fullResponse });
    }

    res.end();
  } catch (error) {
    console.error("[Chat] Error:", error);
    res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
  }
});

// GET /api/admin/users - List all users (admin only)
app.get("/api/admin/users", adminAuth, async (req: Request, res: Response) => {
  try {
    const users = await getUsers();
    res.json({
      success: true,
      data: {
        count: users.length,
        users,
      },
    });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
  }
});

// POST /api/currency/refresh - Refresh rates from external API (protected)
app.post("/api/currency/refresh", sessionAuth, async (req: Request, res: Response) => {
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

app.use("/api", sessionAuth);

// GET /api/business/summary?websiteId=1
// HARDENING: websiteId is REQUIRED - no global summaries
app.get("/api/business/summary", async (req: Request, res: Response) => {
  try {
    const websiteIdParam = req.query.websiteId as string;
    if (!websiteIdParam) {
      res.status(400).json({
        error: "WEBSITE_ID_REQUIRED",
        message: "websiteId query parameter is required. Global KPIs are disabled.",
        validWebsiteIds: VALID_WEBSITE_IDS,
      });
      return;
    }

    const websiteId = validateWebsiteId(parseInt(websiteIdParam, 10));
    const websiteConfig = getWebsiteConfig(websiteId);

    const summary = await generateExecutiveSummary(websiteId);
    if (!summary) {
      res.status(500).json({ error: "Failed to generate summary" });
      return;
    }
    res.json({
      success: true,
      data: {
        website: {
          id: websiteId,
          name: websiteConfig.name,
          currency: websiteConfig.currency,
        },
        businessStatus: summary.businessStatus,
        generatedAt: summary.generatedAt,
        period: summary.period,
        financials: {
          grossRevenueEur: summary.grossRevenueEur,
          netRevenueEur: summary.netRevenueEur,
          adSpendEur: summary.adSpendEur,
        },
        acquisitionData: summary.acquisitionData,
        refundsM1: {
          total: summary.refundsM1Total,
        },
        kpis: {
          // P0 HEADLINE - Weekly Profit (modelo utility)
          weeklyProfit: { value: summary.kpis.weeklyProfit.value, status: summary.kpis.weeklyProfit.status, reason: summary.kpis.weeklyProfit.shortReason },
          // P1 - Payback M1 (COHORT-BASED - Phase 11 FIX)
          paybackM1: { value: summary.kpis.paybackM1.value, status: summary.kpis.paybackM1.status, reason: summary.kpis.paybackM1.shortReason },
          // P2 - Accionables
          frr: { value: summary.kpis.frr.value, percentage: Math.round(summary.kpis.frr.value * 1000) / 10, status: summary.kpis.frr.status, reason: summary.kpis.frr.shortReason },
          cpfr: { value: summary.kpis.cpfr.value, status: summary.kpis.cpfr.status, reason: summary.kpis.cpfr.shortReason },
          refundRateM1: { value: summary.kpis.refundRateM1.value, percentage: Math.round(summary.kpis.refundRateM1.value * 1000) / 10, status: summary.kpis.refundRateM1.status, reason: summary.kpis.refundRateM1.shortReason },
          // P3 - Contexto
          netRoas: { value: summary.kpis.netRoas.value, status: summary.kpis.netRoas.status, reason: summary.kpis.netRoas.shortReason },
          cpt: { value: summary.kpis.cpt.value, status: summary.kpis.cpt.status, reason: summary.kpis.cpt.shortReason },
          // Informativos (no alertas)
          srr: { value: summary.kpis.srr.value, percentage: Math.round(summary.kpis.srr.value * 1000) / 10, status: summary.kpis.srr.status, reason: summary.kpis.srr.shortReason, isInformative: true },
          ur2: { value: summary.kpis.ur2.value, percentage: Math.round(summary.kpis.ur2.value * 1000) / 10, status: summary.kpis.ur2.status, reason: summary.kpis.ur2.shortReason, isInformative: true },
          ltv30d: { value: summary.kpis.ltv30d.value, status: summary.kpis.ltv30d.status, reason: summary.kpis.ltv30d.shortReason, isInformative: true },
          paybackRatio: { value: summary.kpis.paybackRatio.value, status: summary.kpis.paybackRatio.status, reason: summary.kpis.paybackRatio.shortReason, isInformative: true },
          // Phase 6.1: Ventanas correctas (informativas)
          ltv21d: { value: summary.kpis.ltv21d.value, status: summary.kpis.ltv21d.status, reason: summary.kpis.ltv21d.shortReason, isInformative: true },
          payback21d: { value: summary.kpis.payback21d.value, status: summary.kpis.payback21d.status, reason: summary.kpis.payback21d.shortReason, isInformative: true },
          ltv51d: { value: summary.kpis.ltv51d.value, status: summary.kpis.ltv51d.status, reason: summary.kpis.ltv51d.shortReason, isInformative: true },
          payback51d: { value: summary.kpis.payback51d.value, status: summary.kpis.payback51d.status, reason: summary.kpis.payback51d.shortReason, isInformative: true },
          // Cashflow Coverage 7d (ex-Payback M1 cashflow - DEPRECATED, solo informativo)
          cashflowCoverage7d: summary.kpis.cashflowCoverage7d ? { value: summary.kpis.cashflowCoverage7d.value, status: 'yellow', reason: summary.kpis.cashflowCoverage7d.shortReason, isInformative: true } : undefined,
          // Phase 15: Risk Metrics (OpenClaw)
          chargebackRate: summary.kpis.chargebackRate ? { value: summary.kpis.chargebackRate.value, percentage: Math.round(summary.kpis.chargebackRate.value * 10000) / 100, status: summary.kpis.chargebackRate.status, reason: summary.kpis.chargebackRate.shortReason } : undefined,
          baseInstalada: summary.kpis.baseInstalada ? { value: summary.kpis.baseInstalada.value, percentage: Math.round(summary.kpis.baseInstalada.value * 1000) / 10, status: summary.kpis.baseInstalada.status, reason: summary.kpis.baseInstalada.shortReason, isInformative: true } : undefined,
        },
        alerts: summary.alerts,
        summaryText: summary.summaryText,
      },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    if (msg.includes('WEBSITE_ID_REQUIRED') || msg.includes('INVALID_WEBSITE_ID')) {
      res.status(400).json({ error: msg, validWebsiteIds: VALID_WEBSITE_IDS });
    } else {
      res.status(500).json({ error: msg });
    }
  }
});

// GET /api/business/daily?websiteId=1
// Daily comparison: Today vs 7 days ago (same weekday)
app.get("/api/business/daily", sessionAuth, async (req: Request, res: Response) => {
  try {
    const websiteIdParam = req.query.websiteId as string;
    if (!websiteIdParam) {
      res.status(400).json({
        error: "WEBSITE_ID_REQUIRED",
        validWebsiteIds: VALID_WEBSITE_IDS,
      });
      return;
    }

    const websiteId = validateWebsiteId(parseInt(websiteIdParam, 10));

    // Fetch all daily comparison data in parallel
    const [
      trialsTodayResult,
      trials7dAgoResult,
      firstRebillsTodayResult,
      firstRebills7dAgoResult,
      adSpendTodayResult,
      adSpend7dAgoResult,
    ] = await Promise.all([
      executeQuery("trials-today", websiteId),
      executeQuery("trials-7d-ago", websiteId),
      executeQuery("first-rebills-today", websiteId),
      executeQuery("first-rebills-7d-ago", websiteId),
      executeQuery("ad-spend-today", websiteId),
      executeQuery("ad-spend-7d-ago", websiteId),
    ]);

    const trialsToday = (trialsTodayResult.results as any)?.count || 0;
    const trials7dAgo = (trials7dAgoResult.results as any)?.count || 0;
    const firstRebillsToday = (firstRebillsTodayResult.results as any)?.count || 0;
    const firstRebills7dAgo = (firstRebills7dAgoResult.results as any)?.count || 0;
    const adSpendTodayEur = (adSpendTodayResult.results as any)?.totalEur || 0;
    const adSpend7dAgoEur = (adSpend7dAgoResult.results as any)?.totalEur || 0;

    // Calculate derived metrics
    const cpaToday = trialsToday > 0 ? adSpendTodayEur / trialsToday : 0;
    const cpa7dAgo = trials7dAgo > 0 ? adSpend7dAgoEur / trials7dAgo : 0;
    const cpfrToday = firstRebillsToday > 0 ? adSpendTodayEur / firstRebillsToday : 0;
    const cpfr7dAgo = firstRebills7dAgo > 0 ? adSpend7dAgoEur / firstRebills7dAgo : 0;

    // Calculate % changes
    const trialsChange = trials7dAgo > 0 ? ((trialsToday - trials7dAgo) / trials7dAgo) * 100 : 0;
    const cpaChange = cpa7dAgo > 0 ? ((cpaToday - cpa7dAgo) / cpa7dAgo) * 100 : 0;
    const cpfrChange = cpfr7dAgo > 0 ? ((cpfrToday - cpfr7dAgo) / cpfr7dAgo) * 100 : 0;

    res.json({
      success: true,
      data: {
        date: new Date().toISOString().split('T')[0],
        comparedTo: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        acquisitions: {
          today: trialsToday,
          weekAgo: trials7dAgo,
          change: Math.round(trialsChange * 10) / 10,
        },
        cpa: {
          today: Math.round(cpaToday * 100) / 100,
          weekAgo: Math.round(cpa7dAgo * 100) / 100,
          change: Math.round(cpaChange * 10) / 10,
        },
        cpfr: {
          today: Math.round(cpfrToday * 100) / 100,
          weekAgo: Math.round(cpfr7dAgo * 100) / 100,
          change: Math.round(cpfrChange * 10) / 10,
        },
        adSpend: {
          today: adSpendTodayEur,
          weekAgo: adSpend7dAgoEur,
        },
        firstRebills: {
          today: firstRebillsToday,
          weekAgo: firstRebills7dAgo,
        },
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ error: msg });
  }
});

// GET /api/business/all-websites-payback
// Returns Payback M1 for all websites (for comparison chart)
// GET /api/business/customers?websiteId=1
// Customer counts: total and active customers
app.get("/api/business/customers", sessionAuth, async (req: Request, res: Response) => {
  try {
    const websiteIdParam = req.query.websiteId as string;
    if (!websiteIdParam) {
      res.status(400).json({
        error: "WEBSITE_ID_REQUIRED",
        validWebsiteIds: VALID_WEBSITE_IDS,
      });
      return;
    }

    const websiteId = validateWebsiteId(parseInt(websiteIdParam, 10));
    const result = await executeQuery("customer-counts", websiteId);

    if (result.status !== "success" || !result.results) {
      res.status(500).json({ error: "Failed to fetch customer counts" });
      return;
    }

    const row = (result.results as any[])[0] || {};

    res.json({
      success: true,
      data: {
        totalCustomers: parseInt(row.total_customers) || 0,
        activeCustomers: parseInt(row.active_customers) || 0,
        churnedCustomers: parseInt(row.churned_customers) || 0,
        cancelledTrials: parseInt(row.cancelled_trials) || 0,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ error: msg });
  }
});

// GET /api/business/cohort-distribution?websiteId=1
// Customer distribution by month: M1, M2, M3, etc.
app.get("/api/business/cohort-distribution", sessionAuth, async (req: Request, res: Response) => {
  try {
    const websiteIdParam = req.query.websiteId as string;
    if (!websiteIdParam) {
      res.status(400).json({
        error: "WEBSITE_ID_REQUIRED",
        validWebsiteIds: VALID_WEBSITE_IDS,
      });
      return;
    }

    const websiteId = validateWebsiteId(parseInt(websiteIdParam, 10));
    const data = await getCustomerCohortDistribution(websiteId);

    if (!data) {
      res.status(500).json({ error: "Failed to fetch cohort distribution" });
      return;
    }

    res.json({
      success: true,
      data,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ error: msg });
  }
});

app.get("/api/business/all-websites-payback", sessionAuth, async (req: Request, res: Response) => {
  try {
    // Fetch metrics for all websites in parallel
    const results = await Promise.all(
      VALID_WEBSITE_IDS.map(async (websiteId) => {
        const websiteConfig = getWebsiteConfig(websiteId);
        const raw = await fetchRawMetrics(websiteId);
        if (!raw) return null;

        const kpis = calculateCoreKpis(raw);
        const paybackM1 = kpis.paybackM1?.value || 0;
        const status = kpis.paybackM1?.status || 'yellow';

        return {
          websiteId,
          name: websiteConfig.name,
          paybackM1,
          status,
        };
      })
    );

    const validResults = results.filter(r => r !== null);

    res.json({
      success: true,
      data: {
        websites: validResults,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ error: msg });
  }
});

// GET /api/business/kpis?websiteId=1
// HARDENING: websiteId is REQUIRED - no global KPIs
app.get("/api/business/kpis", sessionAuth, async (req: Request, res: Response) => {
  try {
    const websiteIdParam = req.query.websiteId as string;
    if (!websiteIdParam) {
      res.status(400).json({
        error: "WEBSITE_ID_REQUIRED",
        message: "websiteId query parameter is required. Global KPIs are disabled.",
        validWebsiteIds: VALID_WEBSITE_IDS,
      });
      return;
    }

    const websiteId = validateWebsiteId(parseInt(websiteIdParam, 10));
    const websiteConfig = getWebsiteConfig(websiteId);

    const raw = await fetchRawMetrics(websiteId);
    if (!raw) {
      res.status(500).json({ error: "Failed to fetch metrics" });
      return;
    }
    const kpis = calculateCoreKpis(raw);
    const businessStatus = determineBusinessStatus(kpis);

    res.json({
      success: true,
      data: {
        website: {
          id: websiteId,
          name: websiteConfig.name,
          currency: websiteConfig.currency,
        },
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
          // Utility Model KPIs
          weeklyProfit: {
            value: kpis.weeklyProfit.value,
            status: kpis.weeklyProfit.status,
            reason: kpis.weeklyProfit.shortReason,
          },
          paybackM1: {
            value: kpis.paybackM1.value,
            status: kpis.paybackM1.status,
            reason: kpis.paybackM1.shortReason,
          },
          refundRateM1: {
            value: kpis.refundRateM1.value,
            percentage: Math.round(kpis.refundRateM1.value * 1000) / 10,
            status: kpis.refundRateM1.status,
            reason: kpis.refundRateM1.shortReason,
          },
          cpt: {
            value: kpis.cpt.value,
            status: kpis.cpt.status,
            reason: kpis.cpt.shortReason,
          },
          // Phase 15: Risk Metrics (OpenClaw)
          chargebackRate: kpis.chargebackRate ? {
            value: kpis.chargebackRate.value,
            percentage: Math.round(kpis.chargebackRate.value * 10000) / 100,
            status: kpis.chargebackRate.status,
            reason: kpis.chargebackRate.shortReason,
          } : undefined,
          baseInstalada: kpis.baseInstalada ? {
            value: kpis.baseInstalada.value,
            percentage: Math.round(kpis.baseInstalada.value * 1000) / 10,
            status: kpis.baseInstalada.status,
            reason: kpis.baseInstalada.shortReason,
            isInformative: true,
          } : undefined,
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
    const msg = error instanceof Error ? error.message : "Unknown error";
    if (msg.includes('WEBSITE_ID_REQUIRED') || msg.includes('INVALID_WEBSITE_ID')) {
      res.status(400).json({ error: msg, validWebsiteIds: VALID_WEBSITE_IDS });
    } else {
      res.status(500).json({ error: msg });
    }
  }
});

// GET /api/business/raw?websiteId=1
// HARDENING: websiteId is REQUIRED - no global raw metrics
app.get("/api/business/raw", async (req: Request, res: Response) => {
  try {
    const websiteIdParam = req.query.websiteId as string;
    if (!websiteIdParam) {
      res.status(400).json({
        error: "WEBSITE_ID_REQUIRED",
        message: "websiteId query parameter is required. Global KPIs are disabled.",
        validWebsiteIds: VALID_WEBSITE_IDS,
      });
      return;
    }

    const websiteId = validateWebsiteId(parseInt(websiteIdParam, 10));
    const websiteConfig = getWebsiteConfig(websiteId);

    const raw = await fetchRawMetrics(websiteId);
    if (!raw) {
      res.status(500).json({ error: "Failed to fetch raw metrics" });
      return;
    }
    res.json({
      success: true,
      data: {
        website: {
          id: websiteId,
          name: websiteConfig.name,
          currency: websiteConfig.currency,
        },
        ...raw,
      },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    if (msg.includes('WEBSITE_ID_REQUIRED') || msg.includes('INVALID_WEBSITE_ID')) {
      res.status(400).json({ error: msg, validWebsiteIds: VALID_WEBSITE_IDS });
    } else {
      res.status(500).json({ error: msg });
    }
  }
});

// GET /api/decision/weekly-report?websiteId=1
// HARDENING: websiteId is REQUIRED
app.get("/api/decision/weekly-report", async (req: Request, res: Response) => {
  try {
    const websiteIdParam = req.query.websiteId as string;
    if (!websiteIdParam) {
      res.status(400).json({
        error: "WEBSITE_ID_REQUIRED",
        message: "websiteId query parameter is required. Global reports are disabled.",
        validWebsiteIds: VALID_WEBSITE_IDS,
      });
      return;
    }

    const websiteId = validateWebsiteId(parseInt(websiteIdParam, 10));
    const websiteConfig = getWebsiteConfig(websiteId);

    const report = await generateWeeklyReport(websiteId);
    if (!report) {
      res.status(500).json({ error: "Failed to generate weekly report" });
      return;
    }
    res.json({
      success: true,
      data: {
        website: {
          id: websiteId,
          name: websiteConfig.name,
          currency: websiteConfig.currency,
        },
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
    const msg = error instanceof Error ? error.message : "Unknown error";
    if (msg.includes('WEBSITE_ID_REQUIRED') || msg.includes('INVALID_WEBSITE_ID')) {
      res.status(400).json({ error: msg, validWebsiteIds: VALID_WEBSITE_IDS });
    } else {
      res.status(500).json({ error: msg });
    }
  }
});

// GET /api/decision/current?websiteId=1
// HARDENING: websiteId is REQUIRED
app.get("/api/decision/current", async (req: Request, res: Response) => {
  try {
    const websiteIdParam = req.query.websiteId as string;
    if (!websiteIdParam) {
      res.status(400).json({
        error: "WEBSITE_ID_REQUIRED",
        message: "websiteId query parameter is required. Global decisions are disabled.",
        validWebsiteIds: VALID_WEBSITE_IDS,
      });
      return;
    }

    const websiteId = validateWebsiteId(parseInt(websiteIdParam, 10));
    const websiteConfig = getWebsiteConfig(websiteId);

    const raw = await fetchRawMetrics(websiteId);
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
        website: {
          id: websiteId,
          name: websiteConfig.name,
          currency: websiteConfig.currency,
        },
        allDecisions: decisions.length,
        topActions,
      },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    if (msg.includes('WEBSITE_ID_REQUIRED') || msg.includes('INVALID_WEBSITE_ID')) {
      res.status(400).json({ error: msg, validWebsiteIds: VALID_WEBSITE_IDS });
    } else {
      res.status(500).json({ error: msg });
    }
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
  getAttributionData,
  getKeywordAttributionData,
} from "../skills/business-expert/analyzers/campaign-analyzer.js";
import {
  evaluateCampaignRules,
  getCampaignsNeedingAction,
} from "../skills/decision-engine/campaign-rules/evaluator.js";
import {
  getKeywordPerformance,
  getTopKeywords,
  getUnderperformingKeywords,
  getKeywordsByCampaign,
  getWasteKeywords,
  getKeywordsSummary,
} from "../skills/google-ads-expert/keywords-analyzer.js";
import {
  getSearchTermPerformance,
  getTopSearchTerms,
  getSearchTermsByCampaign,
  getSearchTermsByKeyword,
  getWasteSearchTerms,
  getSearchTermsSummary,
} from "../skills/google-ads-expert/search-terms-analyzer.js";

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
// KEYWORDS (Phase 8A)
// ============================================================================

// GET /api/keywords - Get keywords with pagination and filtering
// Query params:
//   page: number (default 1)
//   limit: number (default 50, max 200)
//   minSpend: number (default 0) - minimum spend in EUR
//   hasSpend: boolean (default true) - only show keywords with spend > 0
//   campaign: string - filter by campaign ID (filtered at SQL level)
//   matchType: string - filter by match type (EXACT, PHRASE, BROAD)
app.get("/api/keywords", async (req: Request, res: Response) => {
  try {
    // Parse query params
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit as string) || 50));
    const minSpend = parseFloat(req.query.minSpend as string) || 0;
    const hasSpend = req.query.hasSpend !== 'false'; // default true
    const campaignFilter = req.query.campaign as string || '';
    const matchTypeFilter = req.query.matchType as string || '';

    // Get keyword data and both attribution data types in parallel
    const [data, keywordAttrData, campaignAttrData] = await Promise.all([
      getKeywordPerformance(campaignFilter || undefined),
      getKeywordAttributionData(), // Get Acq/R1 by keyword (utm_term) from Avocode DB
      getAttributionData(), // Fallback: Get Acq/R1 by campaign from Avocode DB
    ]);

    if (!data) {
      res.status(500).json({ error: "No keyword data available" });
      return;
    }

    // Filter keywords (only non-campaign filters, campaign is done at SQL level)
    let filtered = data.keywords;

    // Filter by spend
    if (hasSpend) {
      filtered = filtered.filter(k => k.spend7d > 0);
    }
    if (minSpend > 0) {
      filtered = filtered.filter(k => k.spend7d >= minSpend);
    }

    // Filter by match type
    if (matchTypeFilter) {
      filtered = filtered.filter(k => k.matchType === matchTypeFilter.toUpperCase());
    }

    // Enrich keywords with attribution data (prefer keyword-level, fallback to campaign-level)
    const enrichedKeywords = filtered.map(k => {
      const campaignId = String(k.campaignId || '');
      const keywordText = (k.keywordText || '').toLowerCase();
      const keywordKey = `${campaignId}:${keywordText}`;

      // Try keyword-level attribution first (from utm_term)
      const kwAttr = keywordAttrData[keywordKey];
      if (kwAttr) {
        return {
          ...k,
          acquisitions: kwAttr.acquisitions,
          firstRebills: kwAttr.firstRebills,
          attributionLevel: 'keyword' as const,
        };
      }

      // Fallback to campaign-level attribution
      const campAttr = campaignAttrData[campaignId];
      return {
        ...k,
        acquisitions: campAttr?.acquisitions || 0,
        firstRebills: campAttr?.firstRebills || 0,
        attributionLevel: 'campaign' as const,
      };
    });

    // Paginate
    const totalFiltered = enrichedKeywords.length;
    const totalPages = Math.ceil(totalFiltered / limit);
    const offset = (page - 1) * limit;
    const paginatedKeywords = enrichedKeywords.slice(offset, offset + limit);

    // Recalculate totals for filtered dataset
    const filteredTotalSpend = enrichedKeywords.reduce((sum, k) => sum + k.spend7d, 0);

    res.json({
      success: true,
      data: {
        fetchedAt: data.fetchedAt,
        dateRange: data.dateRange,
        currency: data.currency,
        // Use filtered totals when campaign filter is applied
        totalKeywords: campaignFilter ? data.totalKeywords : data.totalKeywords,
        totalSpend: campaignFilter ? Math.round(filteredTotalSpend * 100) / 100 : data.totalSpend,
        keywords: paginatedKeywords,
        filteredCount: totalFiltered,
        pagination: {
          page,
          limit,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1,
        },
        filters: {
          hasSpend,
          minSpend,
          campaign: campaignFilter || null,
          matchType: matchTypeFilter || null,
        },
      },
    });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
  }
});

// GET /api/keywords/summary - Get keyword summary statistics
app.get("/api/keywords/summary", async (req: Request, res: Response) => {
  try {
    const summary = await getKeywordsSummary();
    if (!summary) {
      res.status(500).json({ error: "No keyword data available" });
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

// GET /api/keywords/top - Get top keywords by spend
app.get("/api/keywords/top", async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 20;
    const keywords = await getTopKeywords(Math.min(limit, 100));

    res.json({
      success: true,
      data: {
        count: keywords.length,
        keywords,
      },
    });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
  }
});

// GET /api/keywords/underperforming - Get keywords needing attention
app.get("/api/keywords/underperforming", async (req: Request, res: Response) => {
  try {
    const keywords = await getUnderperformingKeywords();

    res.json({
      success: true,
      data: {
        count: keywords.length,
        keywords,
      },
    });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
  }
});

// GET /api/keywords/waste - Get waste analysis (WASTE detection)
app.get("/api/keywords/waste", async (req: Request, res: Response) => {
  try {
    const wasteAnalysis = await getWasteKeywords();
    const totalWaste = wasteAnalysis.reduce((sum, w) => sum + w.wastedSpend, 0);

    res.json({
      success: true,
      data: {
        count: wasteAnalysis.length,
        totalEstimatedWaste: Math.round(totalWaste * 100) / 100,
        byFlag: {
          HIGH_SPEND_ZERO_CONV: wasteAnalysis.filter(w => w.wasteFlags.includes('HIGH_SPEND_ZERO_CONV')).length,
          HIGH_SPEND_LOW_CONV: wasteAnalysis.filter(w => w.wasteFlags.includes('HIGH_SPEND_LOW_CONV')).length,
          SPEND_CONCENTRATION: wasteAnalysis.filter(w => w.wasteFlags.includes('SPEND_CONCENTRATION')).length,
        },
        keywords: wasteAnalysis,
      },
    });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
  }
});

// GET /api/keywords/by-campaign/:id - Get keywords for a specific campaign
app.get("/api/keywords/by-campaign/:id", async (req: Request, res: Response) => {
  try {
    const campaignId = req.params.id;
    if (!campaignId) {
      res.status(400).json({ error: "Campaign ID required" });
      return;
    }

    const keywords = await getKeywordsByCampaign(campaignId);

    res.json({
      success: true,
      data: {
        campaignId,
        count: keywords.length,
        keywords,
      },
    });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
  }
});

// ============================================================================
// SEARCH TERMS (Phase 8B)
// ============================================================================

// GET /api/search-terms - Get search terms with pagination and filtering
// Query params:
//   page: number (default 1)
//   limit: number (default 50, max 200)
//   minSpend: number (default 0) - minimum spend in EUR
//   hasSpend: boolean (default true) - only show search terms with spend > 0
//   campaign: string - filter by campaign ID (filtered at SQL level)
//   status: string - filter by performance status (good, warning, poor)
app.get("/api/search-terms", async (req: Request, res: Response) => {
  try {
    // Parse query params
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit as string) || 50));
    const minSpend = parseFloat(req.query.minSpend as string) || 0;
    const hasSpend = req.query.hasSpend !== 'false'; // default true
    const campaignFilter = req.query.campaign as string || '';
    const statusFilter = req.query.status as string || '';

    // Get search term data and both attribution data types in parallel
    const [data, keywordAttrData, campaignAttrData] = await Promise.all([
      getSearchTermPerformance(campaignFilter || undefined),
      getKeywordAttributionData(), // Get Acq/R1 by keyword (utm_term) from Avocode DB
      getAttributionData(), // Fallback: Get Acq/R1 by campaign from Avocode DB
    ]);

    if (!data) {
      res.status(500).json({ error: "No search term data available" });
      return;
    }

    // Filter search terms (only non-campaign filters, campaign is done at SQL level)
    let filtered = data.searchTerms;

    // Filter by spend
    if (hasSpend) {
      filtered = filtered.filter(st => st.spend > 0);
    }
    if (minSpend > 0) {
      filtered = filtered.filter(st => st.spend >= minSpend);
    }

    // Filter by status
    if (statusFilter) {
      filtered = filtered.filter(st => st.performanceStatus === statusFilter.toLowerCase());
    }

    // Enrich search terms with attribution data (prefer keyword-level via associated keyword, fallback to campaign)
    const enrichedSearchTerms = filtered.map(st => {
      const campaignId = String(st.campaignId || '');
      // Use the associated keyword (keywordText) to look up attribution
      const keywordText = (st.keywordText || '').toLowerCase();
      const keywordKey = `${campaignId}:${keywordText}`;

      // Try keyword-level attribution first (from utm_term via associated keyword)
      const kwAttr = keywordAttrData[keywordKey];
      if (kwAttr) {
        return {
          ...st,
          acquisitions: kwAttr.acquisitions,
          firstRebills: kwAttr.firstRebills,
          attributionLevel: 'keyword' as const,
        };
      }

      // Fallback to campaign-level attribution
      const campAttr = campaignAttrData[campaignId];
      return {
        ...st,
        acquisitions: campAttr?.acquisitions || 0,
        firstRebills: campAttr?.firstRebills || 0,
        attributionLevel: 'campaign' as const,
      };
    });

    // Paginate
    const totalFiltered = enrichedSearchTerms.length;
    const totalPages = Math.ceil(totalFiltered / limit);
    const offset = (page - 1) * limit;
    const paginatedSearchTerms = enrichedSearchTerms.slice(offset, offset + limit);

    // Recalculate totals for filtered dataset
    const filteredTotalSpend = enrichedSearchTerms.reduce((sum, st) => sum + st.spend, 0);

    res.json({
      success: true,
      data: {
        fetchedAt: data.fetchedAt,
        dateRange: data.dateRange,
        currency: data.currency,
        // Use filtered totals when campaign filter is applied
        totalSearchTerms: campaignFilter ? data.totalSearchTerms : data.totalSearchTerms,
        totalSpend: campaignFilter ? Math.round(filteredTotalSpend * 100) / 100 : data.totalSpend,
        searchTerms: paginatedSearchTerms,
        filteredCount: totalFiltered,
        pagination: {
          page,
          limit,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1,
        },
        filters: {
          hasSpend,
          minSpend,
          campaign: campaignFilter || null,
          status: statusFilter || null,
        },
      },
    });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
  }
});

// GET /api/search-terms/summary - Get search term summary statistics
app.get("/api/search-terms/summary", async (req: Request, res: Response) => {
  try {
    const summary = await getSearchTermsSummary();
    if (!summary) {
      res.status(500).json({ error: "No search term data available" });
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

// GET /api/search-terms/top - Get top search terms by spend
app.get("/api/search-terms/top", async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 20;
    const searchTerms = await getTopSearchTerms(Math.min(limit, 100));

    res.json({
      success: true,
      data: {
        count: searchTerms.length,
        searchTerms,
      },
    });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
  }
});

// GET /api/search-terms/waste - Get waste analysis (WASTE detection)
app.get("/api/search-terms/waste", async (req: Request, res: Response) => {
  try {
    const wasteAnalysis = await getWasteSearchTerms();
    const totalWaste = wasteAnalysis.reduce((sum, w) => sum + w.wastedSpend, 0);

    res.json({
      success: true,
      data: {
        count: wasteAnalysis.length,
        totalEstimatedWaste: Math.round(totalWaste * 100) / 100,
        byFlag: {
          HIGH_SPEND_ZERO_CONV: wasteAnalysis.filter(w => w.wasteFlags.includes('HIGH_SPEND_ZERO_CONV')).length,
          HIGH_SPEND_LOW_CONV: wasteAnalysis.filter(w => w.wasteFlags.includes('HIGH_SPEND_LOW_CONV')).length,
          SPEND_CONCENTRATION: wasteAnalysis.filter(w => w.wasteFlags.includes('SPEND_CONCENTRATION')).length,
          REPEAT_WASTE: wasteAnalysis.filter(w => w.wasteFlags.includes('REPEAT_WASTE')).length,
        },
        searchTerms: wasteAnalysis,
      },
    });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
  }
});

// GET /api/search-terms/by-campaign/:id - Get search terms for a specific campaign
app.get("/api/search-terms/by-campaign/:id", async (req: Request, res: Response) => {
  try {
    const campaignId = req.params.id;
    if (!campaignId) {
      res.status(400).json({ error: "Campaign ID required" });
      return;
    }

    const searchTerms = await getSearchTermsByCampaign(campaignId);

    res.json({
      success: true,
      data: {
        campaignId,
        count: searchTerms.length,
        searchTerms,
      },
    });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
  }
});

// GET /api/search-terms/by-keyword - Get search terms that matched a specific keyword
// Query params: keyword (required)
app.get("/api/search-terms/by-keyword", async (req: Request, res: Response) => {
  try {
    const keywordText = req.query.keyword as string;
    if (!keywordText) {
      res.status(400).json({ error: "keyword query param is required" });
      return;
    }

    const searchTerms = await getSearchTermsByKeyword(keywordText);

    res.json({
      success: true,
      data: {
        keywordText,
        count: searchTerms.length,
        searchTerms,
      },
    });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
  }
});

// ============================================================================
// BUSINESS VIEWS (Phase 7.5)
// ============================================================================

import {
  getWebsiteView,
  getCompanyView,
  getCountryView,
  getServiceView,
} from "../skills/business-expert/analyzers/business-aggregator.js";
import {
  getMacroRecommendations,
} from "../skills/decision-engine/business-rules/macro-engine.js";

// GET /api/business/websites-legacy - Old aggregated metrics by website (ads-focused)
app.get("/api/business/websites-legacy", async (req: Request, res: Response) => {
  try {
    const data = await getWebsiteView();
    if (!data) {
      res.status(500).json({ error: "Failed to get website data" });
      return;
    }
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
  }
});

// GET /api/business/companies-legacy - Old aggregated metrics by company (ads-focused)
app.get("/api/business/companies-legacy", async (req: Request, res: Response) => {
  try {
    const data = await getCompanyView();
    if (!data) {
      res.status(500).json({ error: "Failed to get company data" });
      return;
    }
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
  }
});

// GET /api/business/countries-legacy - Old aggregated metrics by country (ads-focused)
app.get("/api/business/countries-legacy", async (req: Request, res: Response) => {
  try {
    const data = await getCountryView();
    if (!data) {
      res.status(500).json({ error: "Failed to get country data" });
      return;
    }
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
  }
});

// GET /api/business/services - Aggregated metrics by service (heuristic)
app.get("/api/business/services", async (req: Request, res: Response) => {
  try {
    const data = await getServiceView();
    if (!data) {
      res.status(500).json({ error: "Failed to get service data" });
      return;
    }
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
  }
});

// GET /api/business/recommendations - Macro-level strategic recommendations
app.get("/api/business/recommendations", async (req: Request, res: Response) => {
  try {
    const data = await getMacroRecommendations();
    if (!data) {
      res.status(500).json({ error: "Failed to get recommendations" });
      return;
    }
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
  }
});

// GET /api/business/global - Global View KPIs
// Supports date ranges: 7d, 14d, 30d, 60d
app.get("/api/business/global", async (req: Request, res: Response) => {
  console.log("[/api/business/global] Request received, range:", req.query.range);
  try {
    const range = (req.query.range as string) || "7d";
    const daysMatch = range.match(/^(\d+)d$/);

    if (!daysMatch) {
      res.status(400).json({
        error: "INVALID_DATE_RANGE",
        message: "Range must be in format: 7d, 14d, 30d, or 60d",
      });
      return;
    }

    const days = parseInt(daysMatch[1], 10);
    if (![7, 14, 30, 60].includes(days)) {
      res.status(400).json({
        error: "INVALID_DATE_RANGE",
        message: "Supported ranges: 7d, 14d, 30d, 60d",
      });
      return;
    }

    const dateRange: DateRangeConfig = { days, type: "period" };
    console.log("[/api/business/global] Date range parsed:", dateRange);

    // Import executeRawQuery dynamically to avoid circular dependency
    const { executeRawQuery } = await import("../skills/db-reader/executor.js");
    console.log("[/api/business/global] executeRawQuery imported, starting queries...");

    // Execute queries one by one for debugging
    console.log("[/api/business/global] Query 1: grossRevenue...");
    const grossRevenueRows = await executeRawQuery(grossRevenueQuery(dateRange).sql);
    console.log("[/api/business/global] Query 2: refunds...");
    const refundsRows = await executeRawQuery(refundsQuery(dateRange).sql);
    console.log("[/api/business/global] Query 3: adSpend...");
    const adSpendRows = await executeRawQuery(adSpendQuery(dateRange).sql);
    console.log("[/api/business/global] Query 4: trials...");
    const trialsRows = await executeRawQuery(trialsCountQuery(dateRange).sql);
    console.log("[/api/business/global] Query 5: firstRebills...");
    const firstRebillsRows = await executeRawQuery(firstRebillsQuery(dateRange).sql);
    console.log("[/api/business/global] Query 6: dispute...");
    const disputeRows = await executeRawQuery(disputeRateQuery(dateRange).sql);
    console.log("[/api/business/global] Query 7: refundRateM1...");
    const refundRateM1Rows = await executeRawQuery(refundRateM1Query(dateRange).sql);
    console.log("[/api/business/global] Query 8: dailyPulse...");
    const dailyPulseRows = await executeRawQuery(dailyPulseQuery().sql);
    console.log("[/api/business/global] All queries complete!");

    // Use cached payback data instead of slow query
    console.log("[/api/business/global] Getting payback from cache...");
    const paybackResults = await Promise.all(
      VALID_WEBSITE_IDS.map(async (websiteId) => {
        const websiteConfig = getWebsiteConfig(websiteId);
        try {
          const metrics = await fetchRawMetrics(websiteId);
          if (!metrics) throw new Error("No metrics");
          const kpis = calculateCoreKpis(metrics);
          return {
            websiteId,
            websiteName: websiteConfig.name,
            cohortSize: metrics.firstRebillsCohorte30d || 0,
            firstRebillCount: metrics.firstRebills || 0,
            revenueM1Eur: metrics.netRevenueEur || 0,
            adSpendEur: metrics.totalAdSpendEur || 0,
            paybackM1: kpis.paybackM1?.value || 0,
          };
        } catch {
          return {
            websiteId,
            websiteName: websiteConfig.name,
            cohortSize: 0,
            firstRebillCount: 0,
            revenueM1Eur: 0,
            adSpendEur: 0,
            paybackM1: 0,
          };
        }
      })
    );
    const paybackRows = paybackResults;

    // Parse results
    const grossRevenue = (grossRevenueRows[0] as any) || {};
    const refunds = (refundsRows[0] as any) || {};
    const adSpend = (adSpendRows[0] as any) || {};
    const trials = (trialsRows[0] as any) || {};
    const firstRebills = (firstRebillsRows[0] as any) || {};
    const disputes = (disputeRows[0] as any) || {};
    const refundRateM1 = (refundRateM1Rows[0] as any) || {};

    // Calculate KPIs
    const grossRevenueEur = Number(grossRevenue.gross_revenue_eur) || 0;
    const totalRefundsEur = Number(refunds.total_refunds_eur) || 0;
    const totalSpendEur = Number(adSpend.total_spend_eur) || 0;
    const trialCount = Number(trials.trial_count) || 0;
    const firstRebillCount = Number(firstRebills.first_rebill_count) || 0;
    const trialsInCohort = Number(firstRebills.trial_count) || 0;
    const totalTransactions = Number(disputes.total_transactions) || 0;
    const chargebackCount = Number(disputes.chargeback_count) || 0;

    // Weekly Profit = Gross Revenue - Refunds - Ad Spend
    const weeklyProfit = grossRevenueEur - totalRefundsEur - totalSpendEur;

    // CPT = Ad Spend / Trials (avoid division by zero)
    const cpt = trialCount > 0 ? totalSpendEur / trialCount : 0;

    // FRR = First Rebills / Trials * 100 (avoid division by zero)
    const frr = trialsInCohort > 0 ? (firstRebillCount / trialsInCohort) * 100 : 0;

    // Refund Rate M1 = First Rebills Refunded / Total First Rebills * 100 (transaction-based)
    const totalFirstRebillsM1 = Number(refundRateM1.total_first_rebills) || 0;
    const refundedFirstRebillsM1 = Number(refundRateM1.refunded_first_rebills) || 0;
    const refundRate = totalFirstRebillsM1 > 0 ? (refundedFirstRebillsM1 / totalFirstRebillsM1) * 100 : 0;

    // Dispute Rate = Chargebacks / Transactions * 100
    const disputeRate = totalTransactions > 0 ? (chargebackCount / totalTransactions) * 100 : 0;

    // Payback by website (already in correct format from cache)
    const paybackByWebsite = paybackRows;

    // Parse daily pulse
    const todayData = (dailyPulseRows as any[]).find((r) => r.period === "today") || {};
    const lastWeekData = (dailyPulseRows as any[]).find((r) => r.period === "last_week") || {};

    const dailyPulse = {
      acquisitions: {
        today: Number(todayData.acquisitions) || 0,
        lastWeek: Number(lastWeekData.acquisitions) || 0,
      },
      firstRebills: {
        today: Number(todayData.first_rebills) || 0,
        lastWeek: Number(lastWeekData.first_rebills) || 0,
      },
      refunds: {
        today: Number(todayData.refund_count) || 0,
        lastWeek: Number(lastWeekData.refund_count) || 0,
      },
      grossRevenue: {
        today: Number(todayData.gross_revenue_eur) || 0,
        lastWeek: Number(lastWeekData.gross_revenue_eur) || 0,
      },
    };

    res.json({
      success: true,
      range,
      data: {
        kpis: {
          weeklyProfit: Math.round(weeklyProfit * 100) / 100,
          grossRevenueEur: Math.round(grossRevenueEur * 100) / 100,
          refundsEur: Math.round(totalRefundsEur * 100) / 100,
          adSpendEur: Math.round(totalSpendEur * 100) / 100,
          trialCount,
          firstRebillCount,
          cpt: Math.round(cpt * 100) / 100,
          frr: Math.round(frr * 10) / 10,
          refundRate: Math.round(refundRate * 10) / 10,
          disputeRate: Math.round(disputeRate * 100) / 100,
        },
        paybackByWebsite,
        dailyPulse,
      },
    });
  } catch (error) {
    console.error("[/api/business/global] Error:", error);
    res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
  }
});

// Company names mapping
const COMPANY_NAMES: Record<number, string> = {
  1: 'Avocode',
  2: 'KiwiKode',
  3: 'Jackcode',
};

// GET /api/business/companies - Companies View KPIs
app.get("/api/business/companies", async (req: Request, res: Response) => {
  console.log("[/api/business/companies] Request received, range:", req.query.range);

  try {
    const rangeParam = (req.query.range as string) || "7d";
    const validRanges = ["7d", "14d", "30d", "60d"];

    if (!validRanges.includes(rangeParam)) {
      res.status(400).json({ error: `Invalid range. Valid: ${validRanges.join(", ")}` });
      return;
    }

    const days = parseInt(rangeParam.replace("d", ""), 10);
    const dateRange: DateRangeConfig = { days, type: "period" };

    const { executeRawQuery } = await import("../skills/db-reader/executor.js");

    // Execute all queries
    console.log("[/api/business/companies] Executing queries...");
    const [revenueRows, refundsRows, adSpendRows, frrRows, refundRateRows, disputeRows] = await Promise.all([
      executeRawQuery(revenueByCompanyQuery(dateRange).sql),
      executeRawQuery(refundsByCompanyQuery(dateRange).sql),
      executeRawQuery(adSpendByCompanyQuery(dateRange).sql),
      executeRawQuery(frrByCompanyQuery(dateRange).sql),
      executeRawQuery(refundRateM1ByCompanyQuery(dateRange).sql),
      executeRawQuery(disputeRateByCompanyQuery(dateRange).sql),
    ]);
    console.log("[/api/business/companies] All queries complete!");

    // Build company data map
    const companyData: Record<number, any> = {
      1: { companyId: 1, name: 'Avocode', grossRevenueEur: 0, refundsEur: 0, adSpendEur: 0, trialCount: 0, firstRebillCount: 0, totalFirstRebillsM1: 0, refundedFirstRebillsM1: 0, totalTransactions: 0, chargebackCount: 0 },
      2: { companyId: 2, name: 'KiwiKode', grossRevenueEur: 0, refundsEur: 0, adSpendEur: 0, trialCount: 0, firstRebillCount: 0, totalFirstRebillsM1: 0, refundedFirstRebillsM1: 0, totalTransactions: 0, chargebackCount: 0 },
      3: { companyId: 3, name: 'Jackcode', grossRevenueEur: 0, refundsEur: 0, adSpendEur: 0, trialCount: 0, firstRebillCount: 0, totalFirstRebillsM1: 0, refundedFirstRebillsM1: 0, totalTransactions: 0, chargebackCount: 0 },
    };

    // Parse revenue
    for (const row of revenueRows as any[]) {
      const cid = Number(row.company_id);
      if (companyData[cid]) {
        companyData[cid].grossRevenueEur = Number(row.gross_revenue_eur) || 0;
        companyData[cid].trialCount = Number(row.trial_count) || 0;
      }
    }

    // Parse refunds
    for (const row of refundsRows as any[]) {
      const cid = Number(row.company_id);
      if (companyData[cid]) {
        companyData[cid].refundsEur = Number(row.total_refunds_eur) || 0;
      }
    }

    // Parse ad spend
    for (const row of adSpendRows as any[]) {
      const cid = Number(row.company_id);
      if (companyData[cid]) {
        companyData[cid].adSpendEur = Number(row.total_spend_eur) || 0;
      }
    }

    // Parse FRR
    for (const row of frrRows as any[]) {
      const cid = Number(row.company_id);
      if (companyData[cid]) {
        companyData[cid].trialCount = Number(row.trial_count) || 0;
        companyData[cid].firstRebillCount = Number(row.first_rebill_count) || 0;
      }
    }

    // Parse refund rate M1
    for (const row of refundRateRows as any[]) {
      const cid = Number(row.company_id);
      if (companyData[cid]) {
        companyData[cid].totalFirstRebillsM1 = Number(row.total_first_rebills) || 0;
        companyData[cid].refundedFirstRebillsM1 = Number(row.refunded_first_rebills) || 0;
      }
    }

    // Parse dispute rate
    for (const row of disputeRows as any[]) {
      const cid = Number(row.company_id);
      if (companyData[cid]) {
        companyData[cid].totalTransactions = Number(row.total_transactions) || 0;
        companyData[cid].chargebackCount = Number(row.chargeback_count) || 0;
      }
    }

    // Calculate derived KPIs and format response
    const companies = Object.values(companyData).map((c: any) => {
      const profit = c.grossRevenueEur - c.refundsEur - c.adSpendEur;
      const frr = c.trialCount > 0 ? (c.firstRebillCount / c.trialCount) * 100 : 0;
      const refundRateM1 = c.totalFirstRebillsM1 > 0 ? (c.refundedFirstRebillsM1 / c.totalFirstRebillsM1) * 100 : 0;
      const disputeRate = c.totalTransactions > 0 ? (c.chargebackCount / c.totalTransactions) * 100 : 0;

      return {
        companyId: c.companyId,
        name: c.name,
        kpis: {
          profit: Math.round(profit * 100) / 100,
          grossRevenueEur: Math.round(c.grossRevenueEur * 100) / 100,
          refundsEur: Math.round(c.refundsEur * 100) / 100,
          adSpendEur: Math.round(c.adSpendEur * 100) / 100,
          trialCount: c.trialCount,
          firstRebillCount: c.firstRebillCount,
          frr: Math.round(frr * 10) / 10,
          refundRateM1: Math.round(refundRateM1 * 10) / 10,
          disputeRate: Math.round(disputeRate * 100) / 100,
        },
      };
    });

    res.json({
      success: true,
      range: rangeParam,
      data: { companies },
    });
  } catch (error) {
    console.error("[/api/business/companies] Error:", error);
    res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
  }
});

// Website names mapping
const WEBSITE_NAMES: Record<number, string> = {
  1: 'conversie-pdf.com',
  3: 'convierte-pdf.com',
  4: 'device-finder.com',
};

// GET /api/business/websites - Websites View KPIs
app.get("/api/business/websites", async (req: Request, res: Response) => {
  console.log("[/api/business/websites] Request received, range:", req.query.range);

  try {
    const rangeParam = (req.query.range as string) || "7d";
    const validRanges = ["7d", "14d", "30d", "60d"];

    if (!validRanges.includes(rangeParam)) {
      res.status(400).json({ error: `Invalid range. Valid: ${validRanges.join(", ")}` });
      return;
    }

    const days = parseInt(rangeParam.replace("d", ""), 10);
    const dateRange: DateRangeConfig = { days, type: "period" };

    const { executeRawQuery } = await import("../skills/db-reader/executor.js");

    // Execute all queries in parallel (M1 cohort-based + Total period-based)
    console.log("[/api/business/websites] Executing queries...");
    const [revenueM1Rows, refundsM1Rows, totalRevenueRows, totalRefundsRows, adSpendRows, frrRows, refundRateRows, disputeRows] = await Promise.all([
      executeRawQuery(revenueByWebsiteQuery(dateRange).sql),
      executeRawQuery(refundsByWebsiteQuery(dateRange).sql),
      executeRawQuery(totalRevenueByWebsiteQuery(dateRange).sql),
      executeRawQuery(totalRefundsByWebsiteQuery(dateRange).sql),
      executeRawQuery(adSpendByWebsiteQuery(dateRange).sql),
      executeRawQuery(frrByWebsiteQuery(dateRange).sql),
      executeRawQuery(refundRateM1ByWebsiteQuery(dateRange).sql),
      executeRawQuery(disputeRateByWebsiteQuery(dateRange).sql),
    ]);
    console.log("[/api/business/websites] All queries complete!");

    // Build website data map
    const websiteData: Record<number, any> = {
      1: { websiteId: 1, name: 'conversie-pdf.com',
           // M1 (cohort-based)
           revenueM1Eur: 0, trialRevenueEur: 0, firstRebillRevenueEur: 0, refundsM1Eur: 0,
           // Total (period-based)
           totalRevenueEur: 0, totalRebillRevenueEur: 0, totalRefundsEur: 0,
           // Common
           adSpendEur: 0, trialCount: 0, firstRebillCount: 0, totalFirstRebillsM1: 0, refundedFirstRebillsM1: 0, totalTransactions: 0, chargebackCount: 0 },
      3: { websiteId: 3, name: 'convierte-pdf.com',
           revenueM1Eur: 0, trialRevenueEur: 0, firstRebillRevenueEur: 0, refundsM1Eur: 0,
           totalRevenueEur: 0, totalRebillRevenueEur: 0, totalRefundsEur: 0,
           adSpendEur: 0, trialCount: 0, firstRebillCount: 0, totalFirstRebillsM1: 0, refundedFirstRebillsM1: 0, totalTransactions: 0, chargebackCount: 0 },
      4: { websiteId: 4, name: 'device-finder.com',
           revenueM1Eur: 0, trialRevenueEur: 0, firstRebillRevenueEur: 0, refundsM1Eur: 0,
           totalRevenueEur: 0, totalRebillRevenueEur: 0, totalRefundsEur: 0,
           adSpendEur: 0, trialCount: 0, firstRebillCount: 0, totalFirstRebillsM1: 0, refundedFirstRebillsM1: 0, totalTransactions: 0, chargebackCount: 0 },
    };

    // Parse M1 revenue (cohort-based)
    for (const row of revenueM1Rows as any[]) {
      const wid = Number(row.website_id);
      if (websiteData[wid]) {
        websiteData[wid].revenueM1Eur = Number(row.gross_revenue_eur) || 0;
        websiteData[wid].trialRevenueEur = Number(row.trial_revenue_eur) || 0;
        websiteData[wid].firstRebillRevenueEur = Number(row.first_rebill_revenue_eur) || 0;
      }
    }

    // Parse M1 refunds (cohort-based)
    for (const row of refundsM1Rows as any[]) {
      const wid = Number(row.website_id);
      if (websiteData[wid]) {
        websiteData[wid].refundsM1Eur = Number(row.total_refunds_eur) || 0;
      }
    }

    // Parse Total revenue (period-based)
    for (const row of totalRevenueRows as any[]) {
      const wid = Number(row.website_id);
      if (websiteData[wid]) {
        websiteData[wid].totalRevenueEur = Number(row.total_revenue_eur) || 0;
        websiteData[wid].totalRebillRevenueEur = Number(row.total_rebill_revenue_eur) || 0;
      }
    }

    // Parse Total refunds (period-based)
    for (const row of totalRefundsRows as any[]) {
      const wid = Number(row.website_id);
      if (websiteData[wid]) {
        websiteData[wid].totalRefundsEur = Number(row.total_refunds_eur) || 0;
      }
    }

    // Parse ad spend
    for (const row of adSpendRows as any[]) {
      const wid = Number(row.website_id);
      if (websiteData[wid]) {
        websiteData[wid].adSpendEur = Number(row.total_spend_eur) || 0;
      }
    }

    // Parse FRR
    for (const row of frrRows as any[]) {
      const wid = Number(row.website_id);
      if (websiteData[wid]) {
        websiteData[wid].trialCount = Number(row.trial_count) || 0;
        websiteData[wid].firstRebillCount = Number(row.first_rebill_count) || 0;
      }
    }

    // Parse refund rate M1
    for (const row of refundRateRows as any[]) {
      const wid = Number(row.website_id);
      if (websiteData[wid]) {
        websiteData[wid].totalFirstRebillsM1 = Number(row.total_first_rebills) || 0;
        websiteData[wid].refundedFirstRebillsM1 = Number(row.refunded_first_rebills) || 0;
      }
    }

    // Parse dispute rate
    for (const row of disputeRows as any[]) {
      const wid = Number(row.website_id);
      if (websiteData[wid]) {
        websiteData[wid].totalTransactions = Number(row.total_transactions) || 0;
        websiteData[wid].chargebackCount = Number(row.chargeback_count) || 0;
      }
    }

    // Calculate derived KPIs and format response
    const websites = Object.values(websiteData).map((w: any) => {
      // M1 metrics (cohort-based)
      const netM1 = w.revenueM1Eur - w.refundsM1Eur;
      const paybackM1 = w.adSpendEur > 0 ? netM1 / w.adSpendEur : 0;

      // Total metrics (period-based)
      const netTotal = w.totalRevenueEur - w.totalRefundsEur;
      const profit = netTotal - w.adSpendEur;

      // Rates
      const frr = w.trialCount > 0 ? (w.firstRebillCount / w.trialCount) * 100 : 0;
      const refundRateM1 = w.totalFirstRebillsM1 > 0 ? (w.refundedFirstRebillsM1 / w.totalFirstRebillsM1) * 100 : 0;
      const disputeRate = w.totalTransactions > 0 ? (w.chargebackCount / w.totalTransactions) * 100 : 0;
      const cpt = w.trialCount > 0 ? w.adSpendEur / w.trialCount : 0;

      return {
        websiteId: w.websiteId,
        name: w.name,
        kpis: {
          // M1 (cohort-based) - from customers acquired in period
          revenueM1Eur: Math.round(w.revenueM1Eur * 100) / 100,
          trialRevenueEur: Math.round(w.trialRevenueEur * 100) / 100,
          firstRebillRevenueEur: Math.round(w.firstRebillRevenueEur * 100) / 100,
          refundsM1Eur: Math.round(w.refundsM1Eur * 100) / 100,
          netM1: Math.round(netM1 * 100) / 100,
          paybackM1: Math.round(paybackM1 * 100) / 100,

          // Total (period-based) - all activity in period
          totalRevenueEur: Math.round(w.totalRevenueEur * 100) / 100,
          totalRebillRevenueEur: Math.round(w.totalRebillRevenueEur * 100) / 100,
          totalRefundsEur: Math.round(w.totalRefundsEur * 100) / 100,
          netTotal: Math.round(netTotal * 100) / 100,
          profit: Math.round(profit * 100) / 100,

          // Common
          adSpendEur: Math.round(w.adSpendEur * 100) / 100,
          trialCount: w.trialCount,
          firstRebillCount: w.firstRebillCount,
          frr: Math.round(frr * 10) / 10,
          refundRateM1: Math.round(refundRateM1 * 10) / 10,
          disputeRate: Math.round(disputeRate * 100) / 100,
          cpt: Math.round(cpt * 100) / 100,
        },
      };
    });

    res.json({
      success: true,
      range: rangeParam,
      data: { websites },
    });
  } catch (error) {
    console.error("[/api/business/websites] Error:", error);
    res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
  }
});

// GET /api/business/countries - Countries View KPIs (by campaign country)
app.get("/api/business/countries", async (req: Request, res: Response) => {
  console.log("[/api/business/countries] Request received, range:", req.query.range, "websiteId:", req.query.websiteId);

  try {
    const rangeParam = (req.query.range as string) || "7d";
    const websiteIdParam = req.query.websiteId as string | undefined;
    const validRanges = ["7d", "14d", "30d", "60d"];

    if (!validRanges.includes(rangeParam)) {
      res.status(400).json({ error: `Invalid range. Valid: ${validRanges.join(", ")}` });
      return;
    }

    const days = parseInt(rangeParam.replace("d", ""), 10);
    const dateRange: CountryDateRangeConfig = { days, type: "period" };
    const websiteId = websiteIdParam ? parseInt(websiteIdParam, 10) : undefined;

    // Validate websiteId if provided
    if (websiteId && ![1, 3, 4].includes(websiteId)) {
      res.status(400).json({ error: "Invalid websiteId. Valid: 1, 3, 4" });
      return;
    }

    const { executeRawQuery } = await import("../skills/db-reader/executor.js");
    const { countryMetricsQuery } = await import("../skills/db-reader/queries/countries-view-kpis.js");

    // Execute unified query
    console.log("[/api/business/countries] Executing unified query...");
    const rows = await executeRawQuery(countryMetricsQuery(dateRange, websiteId).sql);
    console.log("[/api/business/countries] Query complete, rows:", (rows as any[]).length);

    // Parse unified query results and calculate derived KPIs
    const countries = (rows as any[]).filter(row => row.country_id).map((row: any) => {
      const trialRevenueEur = Number(row.trial_revenue_eur) || 0;
      const firstRebillRevenueEur = Number(row.first_rebill_revenue_eur) || 0;
      const refundsM1Eur = Number(row.refunds_m1_eur) || 0;
      const totalRevenueEur = Number(row.total_revenue_eur) || 0;
      const totalRebillRevenueEur = Number(row.total_rebill_revenue_eur) || 0;
      const totalRefundsEur = Number(row.total_refunds_eur) || 0;
      const adSpendEur = Number(row.ad_spend_eur) || 0;
      const trialCount = Number(row.trial_count) || 0;
      const firstRebillCount = Number(row.first_rebill_count) || 0;

      const revenueM1Eur = trialRevenueEur + firstRebillRevenueEur;
      const netM1 = revenueM1Eur - refundsM1Eur;
      const paybackM1 = adSpendEur > 0 ? netM1 / adSpendEur : 0;
      const netTotal = totalRevenueEur - totalRefundsEur;
      const profit = netTotal - adSpendEur;
      const frr = trialCount > 0 ? (firstRebillCount / trialCount) * 100 : 0;
      const cpt = trialCount > 0 ? adSpendEur / trialCount : 0;

      return {
        countryId: Number(row.country_id),
        countryCode: row.country_code || 'XX',
        countryName: row.country_name || `Country ${row.country_id}`,
        kpis: {
          // M1 (cohort-based)
          revenueM1Eur: Math.round(revenueM1Eur * 100) / 100,
          trialRevenueEur: Math.round(trialRevenueEur * 100) / 100,
          firstRebillRevenueEur: Math.round(firstRebillRevenueEur * 100) / 100,
          refundsM1Eur: Math.round(refundsM1Eur * 100) / 100,
          netM1: Math.round(netM1 * 100) / 100,
          paybackM1: Math.round(paybackM1 * 100) / 100,

          // Total (period-based)
          totalRevenueEur: Math.round(totalRevenueEur * 100) / 100,
          totalRebillRevenueEur: Math.round(totalRebillRevenueEur * 100) / 100,
          totalRefundsEur: Math.round(totalRefundsEur * 100) / 100,
          netTotal: Math.round(netTotal * 100) / 100,
          profit: Math.round(profit * 100) / 100,

          // Common
          adSpendEur: Math.round(adSpendEur * 100) / 100,
          trialCount,
          firstRebillCount,
          frr: Math.round(frr * 10) / 10,
          refundRateM1: 0, // TODO: add to unified query
          disputeRate: 0,  // TODO: add to unified query
          cpt: Math.round(cpt * 100) / 100,
        },
      };
    });

    // Sort by ad spend (highest first)
    countries.sort((a, b) => b.kpis.adSpendEur - a.kpis.adSpendEur);

    res.json({
      success: true,
      range: rangeParam,
      websiteId: websiteId || null,
      data: { countries },
    });
  } catch (error) {
    console.error("[/api/business/countries] Error:", error);
    res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
  }
});

// GET /api/business/campaigns - Campaigns View KPIs
app.get("/api/business/campaigns", async (req: Request, res: Response) => {
  console.log("[/api/business/campaigns] Request received, range:", req.query.range, "websiteId:", req.query.websiteId, "countryId:", req.query.countryId);

  try {
    const rangeParam = (req.query.range as string) || "7d";
    const websiteIdParam = req.query.websiteId as string | undefined;
    const countryIdParam = req.query.countryId as string | undefined;
    const validRanges = ["7d", "14d", "30d", "60d"];

    if (!validRanges.includes(rangeParam)) {
      res.status(400).json({ error: `Invalid range. Valid: ${validRanges.join(", ")}` });
      return;
    }

    const days = parseInt(rangeParam.replace("d", ""), 10);
    const dateRange: CountryDateRangeConfig = { days, type: "period" };
    const websiteId = websiteIdParam ? parseInt(websiteIdParam, 10) : undefined;
    const countryId = countryIdParam ? parseInt(countryIdParam, 10) : undefined;

    // Validate websiteId if provided
    if (websiteId && ![1, 3, 4].includes(websiteId)) {
      res.status(400).json({ error: "Invalid websiteId. Valid: 1, 3, 4" });
      return;
    }

    const { executeRawQuery } = await import("../skills/db-reader/executor.js");
    const { campaignMetricsQuery } = await import("../skills/db-reader/queries/campaigns-view-kpis.js");

    // Execute unified query
    console.log("[/api/business/campaigns] Executing unified query...");
    const rows = await executeRawQuery(campaignMetricsQuery(dateRange, websiteId, countryId).sql);
    console.log("[/api/business/campaigns] Query complete, rows:", (rows as any[]).length);

    // Parse unified query results and calculate derived KPIs
    const campaigns = (rows as any[]).filter(row => row.campaign_id).map((row: any) => {
      const trialRevenueEur = Number(row.trial_revenue_eur) || 0;
      const firstRebillRevenueEur = Number(row.first_rebill_revenue_eur) || 0;
      const refundsM1Eur = Number(row.refunds_m1_eur) || 0;
      const totalRevenueEur = Number(row.total_revenue_eur) || 0;
      const totalRebillRevenueEur = Number(row.total_rebill_revenue_eur) || 0;
      const totalRefundsEur = Number(row.total_refunds_eur) || 0;
      const adSpendEur = Number(row.ad_spend_eur) || 0;
      const trialCount = Number(row.trial_count) || 0;
      const firstRebillCount = Number(row.first_rebill_count) || 0;
      const impressions = Number(row.impressions) || 0;
      const clicks = Number(row.clicks) || 0;

      const revenueM1Eur = trialRevenueEur + firstRebillRevenueEur;
      const netM1 = revenueM1Eur - refundsM1Eur;
      const paybackM1 = adSpendEur > 0 ? netM1 / adSpendEur : 0;
      const netTotal = totalRevenueEur - totalRefundsEur;
      const profit = netTotal - adSpendEur;
      const frr = trialCount > 0 ? (firstRebillCount / trialCount) * 100 : 0;
      const cpt = trialCount > 0 ? adSpendEur / trialCount : 0;
      const cpfr = firstRebillCount > 0 ? adSpendEur / firstRebillCount : 0;
      const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
      const netRoas = adSpendEur > 0 ? netTotal / adSpendEur : 0;

      return {
        campaignId: Number(row.campaign_id),
        googleCampaignId: row.google_campaign_id || '',
        campaignName: row.campaign_name || `Campaign ${row.campaign_id}`,
        websiteId: Number(row.website_id) || 0,
        websiteName: row.website_name || '',
        countryId: Number(row.country_id) || 0,
        countryCode: row.country_code || 'XX',
        countryName: row.country_name || '',
        active: Boolean(row.active),
        kpis: {
          // M1 (cohort-based)
          revenueM1Eur: Math.round(revenueM1Eur * 100) / 100,
          trialRevenueEur: Math.round(trialRevenueEur * 100) / 100,
          firstRebillRevenueEur: Math.round(firstRebillRevenueEur * 100) / 100,
          refundsM1Eur: Math.round(refundsM1Eur * 100) / 100,
          netM1: Math.round(netM1 * 100) / 100,
          paybackM1: Math.round(paybackM1 * 100) / 100,

          // Total (period-based)
          totalRevenueEur: Math.round(totalRevenueEur * 100) / 100,
          totalRebillRevenueEur: Math.round(totalRebillRevenueEur * 100) / 100,
          totalRefundsEur: Math.round(totalRefundsEur * 100) / 100,
          netTotal: Math.round(netTotal * 100) / 100,
          profit: Math.round(profit * 100) / 100,

          // Common
          adSpendEur: Math.round(adSpendEur * 100) / 100,
          trialCount,
          firstRebillCount,
          frr: Math.round(frr * 10) / 10,
          cpt: Math.round(cpt * 100) / 100,
          cpfr: Math.round(cpfr * 100) / 100,
          netRoas: Math.round(netRoas * 100) / 100,

          // Google Ads metrics
          impressions,
          clicks,
          ctr: Math.round(ctr * 100) / 100,
        },
      };
    });

    // Sort by ad spend (highest first)
    campaigns.sort((a, b) => b.kpis.adSpendEur - a.kpis.adSpendEur);

    res.json({
      success: true,
      range: rangeParam,
      websiteId: websiteId || null,
      countryId: countryId || null,
      data: { campaigns },
    });
  } catch (error) {
    console.error("[/api/business/campaigns] Error:", error);
    res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
  }
});

// GET /api/business/funnel - Funnel & Cohorts View KPIs
app.get("/api/business/funnel", async (req: Request, res: Response) => {
  console.log("[/api/business/funnel] Request received, range:", req.query.range, "websiteId:", req.query.websiteId);

  try {
    const rangeParam = (req.query.range as string) || "7d";
    const websiteIdParam = req.query.websiteId as string | undefined;
    const validRanges = ["7d", "14d", "30d", "60d"];

    if (!validRanges.includes(rangeParam)) {
      res.status(400).json({ error: `Invalid range. Valid: ${validRanges.join(", ")}` });
      return;
    }

    const days = parseInt(rangeParam.replace("d", ""), 10);
    const dateRange: CountryDateRangeConfig = { days, type: "period" };
    const websiteId = websiteIdParam ? parseInt(websiteIdParam, 10) : undefined;

    // Validate websiteId if provided
    if (websiteId && ![1, 3, 4].includes(websiteId)) {
      res.status(400).json({ error: "Invalid websiteId. Valid: 1, 3, 4" });
      return;
    }

    const { executeRawQuery } = await import("../skills/db-reader/executor.js");
    const {
      marketingFunnelQuery,
      frrByWeeklyCohortQuery,
      retentionByMonthQuery,
      riskTrendsQuery,
      ltvByDaysQuery,
    } = await import("../skills/db-reader/queries/funnel-view-kpis.js");

    // Execute all queries in parallel
    console.log("[/api/business/funnel] Executing queries...");
    const [funnelRows, frrRows, retentionRows, riskRows, ltvRows] = await Promise.all([
      executeRawQuery(marketingFunnelQuery(dateRange, websiteId).sql),
      executeRawQuery(frrByWeeklyCohortQuery(websiteId).sql),
      executeRawQuery(retentionByMonthQuery(websiteId).sql),
      executeRawQuery(riskTrendsQuery(websiteId).sql),
      executeRawQuery(ltvByDaysQuery(websiteId).sql),
    ]);
    console.log("[/api/business/funnel] Queries complete");

    // Parse marketing funnel
    const funnelData = (funnelRows as any[])[0] || {};
    const impressions = Number(funnelData.impressions) || 0;
    const clicks = Number(funnelData.clicks) || 0;
    const trials = Number(funnelData.trials) || 0;
    const firstRebills = Number(funnelData.first_rebills) || 0;
    const adSpendEur = Number(funnelData.ad_spend_eur) || 0;

    const marketingFunnel = [
      { stage: 'Impresiones', value: impressions, cr: null },
      { stage: 'Clicks', value: clicks, cr: impressions > 0 ? Math.round((clicks / impressions) * 10000) / 100 : 0 },
      { stage: 'Trials', value: trials, cr: clicks > 0 ? Math.round((trials / clicks) * 10000) / 100 : 0 },
      { stage: 'First Rebills', value: firstRebills, cr: trials > 0 ? Math.round((firstRebills / trials) * 10000) / 100 : 0 },
    ];

    // Parse FRR by weekly cohort
    const cohortFrr = (frrRows as any[]).map((row: any) => ({
      cohortWeek: row.cohort_week,
      weekLabel: row.week_label,
      trials: Number(row.trials) || 0,
      firstRebills: Number(row.first_rebills) || 0,
      frr: Number(row.trials) > 0 ? Math.round((Number(row.first_rebills) / Number(row.trials)) * 1000) / 10 : 0,
    }));

    // Parse retention data
    const retention = (retentionRows as any[]).map((row: any) => ({
      month: `M${row.month_number}`,
      customers: Number(row.customers) || 0,
      rate: Number(row.retention_rate) || 0,
    }));

    // Parse risk trends
    const riskTrends = (riskRows as any[]).map((row: any) => ({
      month: row.month,
      monthLabel: row.month_label,
      totalTransactions: Number(row.total_transactions) || 0,
      refunds: Number(row.refunds) || 0,
      refundRate: Number(row.refund_rate) || 0,
    }));

    // Parse LTV
    const ltvMap: Record<string, number> = {};
    (ltvRows as any[]).forEach((row: any) => {
      ltvMap[row.metric] = Number(row.value) || 0;
    });

    const ltv = {
      ltv30d: ltvMap['ltv_30d'] || 0,
      ltv60d: ltvMap['ltv_60d'] || 0,
      ltv90d: ltvMap['ltv_90d'] || 0,
    };

    res.json({
      success: true,
      range: rangeParam,
      websiteId: websiteId || null,
      data: {
        marketingFunnel,
        cohortFrr,
        retention,
        riskTrends,
        ltv,
        adSpendEur: Math.round(adSpendEur * 100) / 100,
      },
    });
  } catch (error) {
    console.error("[/api/business/funnel] Error:", error);
    res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
  }
});

// ============================================================================
// LEGACY VIEW - Header Cards
// ============================================================================

/**
 * GET /api/legacy/header-cards
 *
 * Returns KPIs for Legacy Dashboard Header Cards:
 * - Active Acquisitions / Active Subscribers
 * - Cost Per First Rebill by Website / Rebill Rate
 * - Gross Turnover Per Day / Net Turnover Per Day
 */
app.get("/api/legacy/header-cards", async (req: Request, res: Response) => {
  try {
    const { executeRawQuery } = await import("../skills/db-reader/executor.js");

    // Execute queries one by one with logging to debug errors
    console.log("[legacy-header-cards] Running activeAcquisitions...");
    const acquisitionsRows = await executeRawQuery(activeAcquisitionsQuery().sql);
    console.log("[legacy-header-cards] activeAcquisitions OK");

    console.log("[legacy-header-cards] Running activeSubscribers...");
    const subscribersRows = await executeRawQuery(activeSubscribersQuery().sql);
    console.log("[legacy-header-cards] activeSubscribers OK");

    console.log("[legacy-header-cards] Running grossTurnover...");
    const grossTurnoverRows = await executeRawQuery(grossTurnoverPerDayQuery().sql);
    console.log("[legacy-header-cards] grossTurnover OK");

    console.log("[legacy-header-cards] Running refunds...");
    const refundsRows = await executeRawQuery(refundsMtdQuery().sql);
    console.log("[legacy-header-cards] refunds OK");

    console.log("[legacy-header-cards] Running adsExpense...");
    const adsExpenseRows = await executeRawQuery(adsExpenseMtdQuery().sql);
    console.log("[legacy-header-cards] adsExpense OK");

    console.log("[legacy-header-cards] Running cpfrByWebsite...");
    const cpfrByWebsiteRows = await executeRawQuery(costPerFirstRebillByWebsiteQuery().sql);
    console.log("[legacy-header-cards] cpfrByWebsite OK");

    // Parse results with type casting
    const acqRow = acquisitionsRows[0] as { active_acquisitions?: number } | undefined;
    const subRow = subscribersRows[0] as { active_subscribers?: number } | undefined;
    const grossRow = grossTurnoverRows[0] as { gross_turnover_per_day?: number; gross_turnover_mtd?: number; days_in_month?: number } | undefined;
    const refRow = refundsRows[0] as { total_refunds_eur?: number } | undefined;
    const adsRow = adsExpenseRows[0] as { ads_expense_eur?: number } | undefined;

    const activeAcquisitions = acqRow?.active_acquisitions || 0;
    const activeSubscribers = subRow?.active_subscribers || 0;

    const grossTurnoverPerDay = grossRow?.gross_turnover_per_day || 0;
    const grossTurnoverMtd = grossRow?.gross_turnover_mtd || 0;
    const daysInMonth = grossRow?.days_in_month || 1;

    const totalRefundsEur = refRow?.total_refunds_eur || 0;
    const adsExpenseEur = adsRow?.ads_expense_eur || 0;

    // Calculate Net Turnover
    const netTurnoverMtd = grossTurnoverMtd - totalRefundsEur - adsExpenseEur;
    const netTurnoverPerDay = Math.round((netTurnoverMtd / daysInMonth) * 100) / 100;

    // Parse CPFR by website
    interface CpfrRow {
      website_id: number;
      website_name: string;
      first_rebills: number;
      trials: number;
      ads_expense_eur: number;
      cost_per_first_rebill: number;
      rebill_rate: number;
    }

    const costPerRebillByWebsite: Record<string, {
      websiteId: number;
      websiteName: string;
      firstRebills: number;
      trials: number;
      adsExpenseEur: number;
      costPerFirstRebill: number;
      rebillRate: number;
    }> = {};

    for (const row of cpfrByWebsiteRows as CpfrRow[]) {
      costPerRebillByWebsite[row.website_name] = {
        websiteId: row.website_id,
        websiteName: row.website_name,
        firstRebills: row.first_rebills || 0,
        trials: row.trials || 0,
        adsExpenseEur: row.ads_expense_eur || 0,
        costPerFirstRebill: row.cost_per_first_rebill || 0,
        rebillRate: row.rebill_rate || 0,
      };
    }

    res.json({
      success: true,
      data: {
        // Card 1: Acquisitions / Subscribers
        activeAcquisitions,
        activeSubscribers,

        // Card 2: Turnover Per Day
        grossTurnoverPerDay: Math.round(grossTurnoverPerDay * 100) / 100,
        netTurnoverPerDay,
        grossTurnoverMtd: Math.round(grossTurnoverMtd * 100) / 100,
        netTurnoverMtd: Math.round(netTurnoverMtd * 100) / 100,
        daysInMonth,

        // Card 3: Cost Per First Rebill by Website
        costPerRebillByWebsite,

        // Totals for ads/refunds
        totalRefundsEur: Math.round(totalRefundsEur * 100) / 100,
        adsExpenseEur: Math.round(adsExpenseEur * 100) / 100,
      },
    });
  } catch (error) {
    console.error("[/api/legacy/header-cards] Error:", error);
    res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
  }
});

// ============================================================================
// SNAPSHOTS (Historical KPIs)
// ============================================================================

// POST /api/snapshots - Save daily snapshot (called by cron)
// HARDENING: websiteId is REQUIRED in body
app.post("/api/snapshots", async (req: Request, res: Response) => {
  try {
    const { websiteId: websiteIdBody, baseline_post_reset } = req.body;

    if (!websiteIdBody) {
      res.status(400).json({
        error: "WEBSITE_ID_REQUIRED",
        message: "websiteId is required in request body. Global snapshots are disabled.",
        validWebsiteIds: VALID_WEBSITE_IDS,
      });
      return;
    }

    const websiteId = validateWebsiteId(websiteIdBody);
    const websiteConfig = getWebsiteConfig(websiteId);

    // Fetch current metrics and calculate KPIs
    const raw = await fetchRawMetrics(websiteId);
    if (!raw) {
      res.status(500).json({ error: "Failed to fetch metrics for snapshot" });
      return;
    }

    const kpis = calculateCoreKpis(raw);
    const businessStatus = determineBusinessStatus(kpis);

    const snapshot: Omit<KpiSnapshot, "id" | "created_at"> = {
      snapshot_date: new Date().toISOString().split("T")[0],
      website_id: websiteId,
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
      baseline_post_reset: baseline_post_reset || false,
    };

    const result = await saveSnapshot(snapshot);

    res.json({
      success: true,
      data: {
        message: "Snapshot saved",
        website: {
          id: websiteId,
          name: websiteConfig.name,
        },
        date: snapshot.snapshot_date,
        businessStatus: snapshot.business_status,
        baselinePostReset: snapshot.baseline_post_reset,
        affected: result,
      },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    if (msg.includes('WEBSITE_ID_REQUIRED') || msg.includes('INVALID_WEBSITE_ID')) {
      res.status(400).json({ error: msg, validWebsiteIds: VALID_WEBSITE_IDS });
    } else {
      res.status(500).json({ error: msg });
    }
  }
});

// GET /api/snapshots?websiteId=1&days=30
// HARDENING: websiteId is REQUIRED
app.get("/api/snapshots", async (req: Request, res: Response) => {
  try {
    const websiteIdParam = req.query.websiteId as string;
    if (!websiteIdParam) {
      res.status(400).json({
        error: "WEBSITE_ID_REQUIRED",
        message: "websiteId query parameter is required. Global snapshots are disabled.",
        validWebsiteIds: VALID_WEBSITE_IDS,
      });
      return;
    }

    const websiteId = validateWebsiteId(parseInt(websiteIdParam, 10));
    const websiteConfig = getWebsiteConfig(websiteId);

    const days = parseInt(req.query.days as string) || 30;
    const maxDays = 365; // Limit to 1 year
    const snapshots = await getSnapshots(websiteId, Math.min(days, maxDays));

    res.json({
      success: true,
      data: {
        website: {
          id: websiteId,
          name: websiteConfig.name,
          currency: websiteConfig.currency,
        },
        count: snapshots.length,
        days: Math.min(days, maxDays),
        snapshots,
      },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    if (msg.includes('WEBSITE_ID_REQUIRED') || msg.includes('INVALID_WEBSITE_ID')) {
      res.status(400).json({ error: msg, validWebsiteIds: VALID_WEBSITE_IDS });
    } else {
      res.status(500).json({ error: msg });
    }
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
// HARDENING: websiteId is REQUIRED in body
app.post("/api/tasks/generate", async (req: Request, res: Response) => {
  try {
    const { triggerType = "manual", websiteId: websiteIdBody } = req.body;

    if (!websiteIdBody) {
      res.status(400).json({
        error: "WEBSITE_ID_REQUIRED",
        message: "websiteId is required in request body. Global task generation is disabled.",
        validWebsiteIds: VALID_WEBSITE_IDS,
      });
      return;
    }

    const websiteId = validateWebsiteId(websiteIdBody);
    const websiteConfig = getWebsiteConfig(websiteId);

    const raw = await fetchRawMetrics(websiteId);
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
      // Include websiteId in dedupe key to separate tasks per website
      const dedupeKey = generateDedupeKey(`${websiteId}-${action.ruleId}`, week, year);

      const newTask: Omit<Task, "id" | "created_at" | "updated_at"> = {
        title: `[${websiteConfig.name}] ${action.action}`,
        description: `**Auto-generated from DecisionEngine**\n\n**Website:** ${websiteConfig.name} (ID: ${websiteId})\n\n**Rule:** ${action.ruleName}\n\n**Rationale:** ${action.rationale}\n\n**Week:** ${year}-W${week.toString().padStart(2, "0")}`,
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
        website: {
          id: websiteId,
          name: websiteConfig.name,
        },
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
    const msg = error instanceof Error ? error.message : "Unknown error";
    if (msg.includes('WEBSITE_ID_REQUIRED') || msg.includes('INVALID_WEBSITE_ID')) {
      res.status(400).json({ error: msg, validWebsiteIds: VALID_WEBSITE_IDS });
    } else {
      res.status(500).json({ error: msg });
    }
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
// DISCREPANCY LOG (Phase 8C)
// ============================================================================

// GET /api/discrepancies - List discrepancies with filters
app.get("/api/discrepancies", async (req: Request, res: Response) => {
  try {
    const { status, type, entity_type, limit } = req.query;

    const filters: {
      status?: DiscrepancyStatus | DiscrepancyStatus[];
      type?: DiscrepancyType;
      entity_type?: DiscrepancyEntityType;
      limit?: number;
    } = {};

    if (status) {
      const statuses = (status as string).split(",") as DiscrepancyStatus[];
      filters.status = statuses.length === 1 ? statuses[0] : statuses;
    }
    if (type) filters.type = type as DiscrepancyType;
    if (entity_type) filters.entity_type = entity_type as DiscrepancyEntityType;
    if (limit) filters.limit = parseInt(limit as string, 10);

    const discrepancies = await getDiscrepancies(filters);
    const summary = await getDiscrepancySummary();

    res.json({
      success: true,
      data: {
        count: discrepancies.length,
        summary,
        discrepancies,
      },
    });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
  }
});

// GET /api/discrepancies/summary - Get summary stats
app.get("/api/discrepancies/summary", async (req: Request, res: Response) => {
  try {
    const summary = await getDiscrepancySummary();
    res.json({ success: true, data: summary });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
  }
});

// GET /api/discrepancies/:id - Get single discrepancy
app.get("/api/discrepancies/:id", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      res.status(400).json({ error: "Invalid discrepancy ID" });
      return;
    }

    const discrepancy = await getDiscrepancyById(id);
    if (!discrepancy) {
      res.status(404).json({ error: "Discrepancy not found" });
      return;
    }

    res.json({ success: true, data: discrepancy });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
  }
});

// POST /api/discrepancies - Create discrepancy
app.post("/api/discrepancies", async (req: Request, res: Response) => {
  try {
    const {
      discrepancy_type,
      severity,
      entity_type,
      entity_id,
      entity_name,
      system_recommendation,
      actual_outcome,
      description,
      spend_involved,
      days_delayed,
    } = req.body;

    if (!discrepancy_type || !entity_type || !description) {
      res.status(400).json({ error: "discrepancy_type, entity_type, and description are required" });
      return;
    }

    const newDiscrepancy: Omit<Discrepancy, 'id' | 'created_at' | 'updated_at'> = {
      discrepancy_type,
      severity: severity || 'medium',
      entity_type,
      entity_id,
      entity_name,
      system_recommendation,
      actual_outcome,
      description,
      spend_involved: spend_involved || 0,
      days_delayed: days_delayed || 0,
      status: 'open',
      reported_by: 'user',
    };

    const id = await createDiscrepancy(newDiscrepancy);
    const created = await getDiscrepancyById(id);

    res.status(201).json({
      success: true,
      data: created,
    });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
  }
});

// PATCH /api/discrepancies/:id - Update discrepancy
app.patch("/api/discrepancies/:id", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      res.status(400).json({ error: "Invalid discrepancy ID" });
      return;
    }

    const existing = await getDiscrepancyById(id);
    if (!existing) {
      res.status(404).json({ error: "Discrepancy not found" });
      return;
    }

    const { status, severity, resolution_notes, actual_outcome } = req.body;
    const updates: Partial<Discrepancy> = {};

    if (status !== undefined) updates.status = status;
    if (severity !== undefined) updates.severity = severity;
    if (resolution_notes !== undefined) updates.resolution_notes = resolution_notes;
    if (actual_outcome !== undefined) updates.actual_outcome = actual_outcome;

    await updateDiscrepancy(id, updates);
    const updated = await getDiscrepancyById(id);

    res.json({ success: true, data: updated });
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

  // Pre-warm metrics cache for all websites (runs in background)
  warmAllCaches();

  // Schedule daily cache refresh at 5:30 AM Romania time (after Google Ads data update)
  scheduleDailyCacheRefresh();
});

async function warmAllCaches(): Promise<void> {
  console.log("[CacheWarmup] Starting cache pre-warm for all websites (sequential to avoid DB contention)...");
  const warmupStart = Date.now();

  // Load websites SEQUENTIALLY to avoid DB contention
  // This is slower on startup but doesn't overload the database
  for (const websiteId of VALID_WEBSITE_IDS) {
    try {
      const start = Date.now();
      await fetchRawMetrics(websiteId);
      console.log(`[CacheWarmup] Warmed cache for website_id=${websiteId} in ${Date.now() - start}ms`);
    } catch (err) {
      console.error(`[CacheWarmup] Failed for website_id=${websiteId}:`, err);
    }
  }

  const elapsed = ((Date.now() - warmupStart) / 1000).toFixed(1);
  console.log(`[CacheWarmup] Complete! All caches warm in ${elapsed}s`);
}

function scheduleDailyCacheRefresh(): void {
  // Calculate ms until next 5:30 AM Romania time (Europe/Bucharest)
  const getNextRefreshTime = (): number => {
    const now = new Date();
    // Create date in Romania timezone
    const romaniaTime = new Date(now.toLocaleString("en-US", { timeZone: "Europe/Bucharest" }));
    const target = new Date(romaniaTime);
    target.setHours(5, 30, 0, 0);

    // If 5:30 AM already passed today, schedule for tomorrow
    if (romaniaTime >= target) {
      target.setDate(target.getDate() + 1);
    }

    // Calculate difference in ms (accounting for timezone)
    const nowUTC = now.getTime();
    const targetUTC = target.getTime() - (romaniaTime.getTime() - now.getTime());
    return targetUTC - nowUTC;
  };

  const scheduleNext = () => {
    const msUntilRefresh = getNextRefreshTime();
    const hoursUntil = (msUntilRefresh / (1000 * 60 * 60)).toFixed(1);
    console.log(`[CacheScheduler] Next refresh in ${hoursUntil}h (5:30 AM Romania)`);

    setTimeout(async () => {
      console.log("[CacheScheduler] Daily refresh triggered - clearing and re-warming caches...");
      clearMetricsCache();
      clearLtvCache();
      await warmAllCaches();
      // Schedule next refresh
      scheduleNext();
    }, msUntilRefresh);
  };

  scheduleNext();
}

export default app;
