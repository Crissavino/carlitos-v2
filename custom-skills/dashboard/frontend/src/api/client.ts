const API_TOKEN = import.meta.env.VITE_API_TOKEN || 'openclaw-dashboard-2024';

async function fetchAPI<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`/api${endpoint}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${API_TOKEN}`,
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!res.ok) {
    throw new Error(`API Error: ${res.status}`);
  }

  const data = await res.json();
  if (!data.success) {
    throw new Error(data.error || 'Unknown error');
  }

  return data.data;
}

// ============================================================================
// Business & KPIs
// ============================================================================

export interface KpiValue {
  value: number;
  percentage?: number;
  status: string;
  reason?: string;
}

export interface BusinessSummary {
  businessStatus: string;
  generatedAt: string;
  period: { start: string; end: string };
  financials: { netRevenueEur: number; adSpendEur: number };
  kpis: {
    // Core KPIs (decisores)
    frr: KpiValue;
    cpfr: KpiValue;
    srr: KpiValue;
    netRoas: KpiValue;
    // Payback Windows (Phase 6.1)
    payback21d: KpiValue;  // Warning temprano (R1)
    payback51d: KpiValue;  // Decisor (R2 completo)
    // LTV Windows
    ltv21d: KpiValue;
    ltv51d: KpiValue;
    // Diagnóstico (no decisor)
    ur2: KpiValue & { isDiagnostic: boolean };
    // Legacy (referencia histórica)
    ltv30d: KpiValue;
    paybackRatio: KpiValue;
  };
  alerts: Array<{ type: string; message: string }>;
  summaryText: string;
}

export interface Snapshot {
  id: number;
  snapshot_date: string;
  business_status: string;
  frr: number;
  cpfr: number;
  srr: number;
  ur2: number;
  net_roas: number;
  ltv_30d: number | null;
  trials: number;
  first_rebills: number;
  ad_spend_eur: number;
  net_revenue_eur: number;
}

export interface TopAction {
  ruleId: string;
  ruleName: string;
  area: string;
  priority: string;
  action: string;
  rationale: string;
}

export interface DecisionCurrent {
  allDecisions: number;
  topActions: TopAction[];
}

// ============================================================================
// Tasks & Kanban
// ============================================================================

export type TaskStatus = 'backlog' | 'todo' | 'in_progress' | 'review' | 'done' | 'archived';
export type TaskPriority = 'critical' | 'high' | 'medium' | 'low';
export type TaskSource = 'decision_engine' | 'manual' | 'alert' | 'learning';

export interface Task {
  id: number;
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
  created_at: string;
  updated_at: string;
  completed_at?: string;
}

export interface TaskComment {
  id: number;
  task_id: number;
  comment: string;
  author: string;
  created_at: string;
}

export interface TaskRun {
  id: number;
  task_id: number;
  started_at: string;
  completed_at?: string;
  status: 'running' | 'success' | 'failed' | 'cancelled';
  output?: string;
  error_message?: string;
  duration_ms?: number;
  tokens_used?: number;
}

export interface TaskArtifact {
  id: number;
  task_id: number;
  run_id?: number;
  artifact_type: 'analysis' | 'insight' | 'data' | 'chart' | 'recommendation' | 'error';
  name: string;
  content?: string;
  metadata?: Record<string, unknown>;
  created_at: string;
}

export interface TaskDetails extends Task {
  comments: TaskComment[];
  runs: TaskRun[];
  artifacts: TaskArtifact[];
}

export interface KanbanSummary {
  backlog: number;
  todo: number;
  in_progress: number;
  review: number;
  done: number;
  archived: number;
}

export interface TasksResponse {
  count: number;
  summary: KanbanSummary;
  tasks: Task[];
}

// ============================================================================
// Campaigns (Phase 7)
// ============================================================================

export interface CampaignMetrics {
  campaignId: string;
  campaignName: string;
  status: string;

  // From avocodebo.ads (spend)
  spend7d: number;
  spend30d: number;
  clicks: number;
  impressions: number;
  conversionsGoogle: number;
  ctr: number;
  cpc: number;
  googleCpa: number;

  // From DB Attribution (google_ads_details → invoices)
  acquisitions: number;
  acquisitions30d: number;
  firstRebills: number;
  cohort21dSize: number;
  cohort51dSize: number;
  ltv21d: number;
  ltv51d: number;

  // Calculated
  cpfr: number;
  payback21d: number;
  payback51d: number;
  campaignAgeDays: number;

  // Status
  payback51dStatus: 'green' | 'yellow' | 'red';
  recommendation: string;
}

export interface CampaignPerformanceResult {
  fetchedAt: string;
  dateRange: string;
  currency: string;
  totalCampaigns: number;
  campaigns: CampaignMetrics[];
}

export interface CampaignActionGroup {
  count: number;
  campaigns: CampaignMetrics[];
}

export interface CampaignActions {
  toPause: CampaignActionGroup;
  toScale: CampaignActionGroup;
  toMonitor: CampaignActionGroup;
}

// Campaign Decisions (Phase 7.5 - DecisionEngine)
export type CampaignActionType = 'pause' | 'scale' | 'optimize' | 'monitor' | 'maintain';
export type CampaignActionUrgency = 'immediate' | 'this_week' | 'next_review';
export type DecisionConfidence = 'high' | 'medium' | 'low';

export interface CampaignDecision {
  campaignId: string;
  campaignName: string;
  ruleId: string;
  ruleName: string;
  action: CampaignActionType;
  urgency: CampaignActionUrgency;
  actionText: string;
  rationale: string;
  metrics: {
    spend7d: number;
    payback21d: number;
    payback51d: number;
    campaignAgeDays: number;
    cohort51dSize: number;
    cpfr: number;
    ltv51d: number;
  };
  confidence: DecisionConfidence;
  confidenceReason: string;
}

export interface CampaignDecisionSummary {
  generatedAt: string;
  totalCampaigns: number;
  campaignsAnalyzed: number;
  actionCounts: {
    pause: number;
    scale: number;
    optimize: number;
    monitor: number;
    maintain: number;
  };
  impact: {
    spendToPause: number;
    spendToScale: number;
    campaignsNeedingAction: number;
  };
  decisions: CampaignDecision[];
  topActions: CampaignDecision[];
}

// ============================================================================
// API Methods
// ============================================================================

export const api = {
  // Business
  getSummary: () => fetchAPI<BusinessSummary>('/business/summary'),
  getSnapshots: (days = 30) => fetchAPI<{ count: number; snapshots: Snapshot[] }>(`/snapshots?days=${days}`),
  getDecisions: () => fetchAPI<DecisionCurrent>('/decision/current'),

  // Tasks
  getTasks: (status?: string) => {
    const query = status ? `?status=${status}` : '';
    return fetchAPI<TasksResponse>(`/tasks${query}`);
  },
  getTaskDetails: (id: number) => fetchAPI<TaskDetails>(`/tasks/${id}/details`),
  createTask: (task: Partial<Task>) =>
    fetchAPI<Task>('/tasks', {
      method: 'POST',
      body: JSON.stringify(task),
    }),
  updateTask: (id: number, updates: Partial<Task>) =>
    fetchAPI<Task>(`/tasks/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    }),
  deleteTask: (id: number) =>
    fetchAPI<{ deleted: boolean }>(`/tasks/${id}`, { method: 'DELETE' }),

  // Task Details
  addComment: (taskId: number, comment: string, author = 'user') =>
    fetchAPI<{ id: number }>(`/tasks/${taskId}/comments`, {
      method: 'POST',
      body: JSON.stringify({ comment, author }),
    }),
  startRun: (taskId: number) =>
    fetchAPI<{ runId: number }>(`/tasks/${taskId}/run`, { method: 'POST' }),

  // Generation
  generateTasks: () =>
    fetchAPI<{ created: number; skipped: number; tasks: Task[] }>('/tasks/generate', {
      method: 'POST',
      body: JSON.stringify({ triggerType: 'manual' }),
    }),

  // Campaigns (Phase 7)
  getCampaigns: () => fetchAPI<CampaignPerformanceResult>('/campaigns'),
  getCampaignActions: () => fetchAPI<CampaignActions>('/campaigns/actions'),
  // Campaign Decisions (Phase 7.5)
  getCampaignDecisions: () => fetchAPI<CampaignDecisionSummary>('/campaigns/decisions'),

  // Business Views (Phase 7.5)
  getBusinessWebsites: () => fetchAPI<WebsiteViewResult>('/business/websites'),
  getBusinessCompanies: () => fetchAPI<CompanyViewResult>('/business/companies'),
  getBusinessCountries: () => fetchAPI<CountryViewResult>('/business/countries'),
  getBusinessServices: () => fetchAPI<ServiceViewResult>('/business/services'),
  getBusinessRecommendations: () => fetchAPI<MacroRecommendationsResult>('/business/recommendations'),

  // Keywords (Phase 8A)
  getKeywords: (params?: KeywordsQueryParams) => {
    const query = new URLSearchParams();
    if (params?.page) query.set('page', params.page.toString());
    if (params?.limit) query.set('limit', params.limit.toString());
    if (params?.minSpend) query.set('minSpend', params.minSpend.toString());
    if (params?.hasSpend !== undefined) query.set('hasSpend', params.hasSpend.toString());
    if (params?.campaign) query.set('campaign', params.campaign);
    if (params?.matchType) query.set('matchType', params.matchType);
    const queryString = query.toString();
    return fetchAPI<KeywordPerformanceResult>(`/keywords${queryString ? '?' + queryString : ''}`);
  },
  getKeywordsSummary: () => fetchAPI<KeywordsSummary>('/keywords/summary'),
  getTopKeywords: (limit = 20) => fetchAPI<{ count: number; keywords: KeywordPerformance[] }>(`/keywords/top?limit=${limit}`),
  getUnderperformingKeywords: () => fetchAPI<{ count: number; keywords: KeywordPerformance[] }>('/keywords/underperforming'),
  getKeywordsWaste: () => fetchAPI<KeywordsWasteResult>('/keywords/waste'),
  getKeywordsByCampaign: (campaignId: string) => fetchAPI<{ campaignId: string; count: number; keywords: KeywordPerformance[] }>(`/keywords/by-campaign/${campaignId}`),
};

// ============================================================================
// Business Views (Phase 7.5)
// ============================================================================

export type BusinessRecommendation = 'SCALE_FOCUS' | 'MAINTAIN' | 'REDUCE_EXPOSURE' | 'REBALANCE' | 'MONITOR' | 'INSUFFICIENT_DATA';

export interface RecommendationDetails {
  recommendation: BusinessRecommendation;
  confidence: 'high' | 'medium' | 'low';
  rationale: string;
  dataQuality: {
    hasMatureCohort: boolean;
    attributionCoverage: number;
    sampleSize: number;
  };
}

export interface AttributionCoverage {
  spendWithAttribution: number;
  spendTotal: number;
  percentage: number;
}

export interface AggregatedMetrics {
  spend7d: number;
  spend30d: number;
  totalAcquisitions: number;
  totalFirstRebills: number;
  totalRevenue51d: number;
  ltv51dAgg: number;
  payback51dAgg: number;
  minCampaignAgeDays: number;
  activeCampaigns: number;
  totalCampaigns: number;
  attributionCoverage: AttributionCoverage;
}

export interface TopCampaign {
  campaignId: string;
  campaignName: string;
  spend7d: number;
  payback51d: number;
}

export interface WebsiteMetrics extends AggregatedMetrics {
  websiteId: number;
  websiteName: string;
  topCampaigns: TopCampaign[];
  recommendation: RecommendationDetails;
}

export interface WebsiteViewResult {
  generatedAt: string;
  totalWebsites: number;
  websites: WebsiteMetrics[];
  aggregatedTotal: AggregatedMetrics;
}

export interface CompanyWebsite {
  websiteId: number;
  websiteName: string;
  spend7d: number;
  payback51dAgg: number;
}

export interface CompanyMetrics extends AggregatedMetrics {
  companyId: number;
  companyName: string;
  websites: CompanyWebsite[];
  spendConcentration: {
    topWebsiteSpendPct: number;
    isConcentrated: boolean;
  };
  recommendation: RecommendationDetails;
}

export interface CompanyViewResult {
  generatedAt: string;
  companies: CompanyMetrics[];
  aggregatedTotal: AggregatedMetrics;
}

export interface CountryMetrics extends AggregatedMetrics {
  countryId: number;
  countryCode: string;
  countryName: string;
  topCampaigns: TopCampaign[];
  recommendation: RecommendationDetails;
}

export interface CountryViewResult {
  generatedAt: string;
  totalCountries: number;
  countries: CountryMetrics[];
  aggregatedTotal: AggregatedMetrics;
}

export interface ServiceMetrics extends AggregatedMetrics {
  serviceCategory: string;
  serviceName: string;
  campaigns: TopCampaign[];
  classification: {
    method: string;
    confidence: string;
    matchedPatterns: string[];
  };
  recommendation: RecommendationDetails;
}

export interface ServiceViewResult {
  generatedAt: string;
  totalServices: number;
  services: ServiceMetrics[];
  aggregatedTotal: AggregatedMetrics;
  disclaimer: string;
}

export interface MacroRecommendation {
  id: string;
  entityType: 'website' | 'company' | 'country' | 'service';
  entityId: number | string;
  entityName: string;
  recommendation: BusinessRecommendation;
  priority: 'high' | 'medium' | 'low';
  metrics: {
    spend7d: number;
    payback51dAgg: number;
    attributionCoverage: number;
  };
  rationale: string;
  suggestedAction: string;
  isActionable: boolean;
  blockers?: string[];
}

export interface MacroRecommendationsResult {
  generatedAt: string;
  summary: {
    totalRecommendations: number;
    byType: {
      SCALE_FOCUS: number;
      MAINTAIN: number;
      REDUCE_EXPOSURE: number;
      REBALANCE: number;
      MONITOR: number;
    };
    potentialImpact: {
      spendToScale: number;
      spendToReduce: number;
      spendToRebalance: number;
    };
  };
  recommendations: MacroRecommendation[];
  disclaimer: string;
}

// ============================================================================
// Keywords (Phase 8A)
// ============================================================================

export type KeywordMatchType = 'EXACT' | 'PHRASE' | 'BROAD';
export type KeywordPerformanceStatus = 'good' | 'warning' | 'poor';
export type KeywordRecommendation =
  | 'NEGATIVE_SUGGESTION'
  | 'INTENT_MISMATCH'
  | 'SCALE_KEYWORD'
  | 'MATCH_TYPE_FIX'
  | 'REVIEW_BID'
  | 'MONITOR';

export type WasteFlag =
  | 'HIGH_SPEND_ZERO_CONV'
  | 'HIGH_SPEND_LOW_CONV'
  | 'SPEND_CONCENTRATION';

export interface KeywordPerformance {
  keywordId: string;
  keywordText: string;
  matchType: KeywordMatchType;
  campaignId: string;
  campaignName: string;
  adGroupId: string;
  adGroupName: string;
  spend7d: number;
  clicks: number;
  impressions: number;
  conversions: number;
  conversionValue: number;
  ctr: number;
  cpc: number;
  conversionRate: number;
  performanceStatus: KeywordPerformanceStatus;
  recommendation: KeywordRecommendation | null;
}

export interface KeywordPerformanceResult {
  fetchedAt: string;
  dateRange: string;
  currency: string;
  totalKeywords: number;
  totalSpend: number;
  keywords: KeywordPerformance[];
  // Pagination (new)
  filteredCount?: number;
  pagination?: {
    page: number;
    limit: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
  filters?: {
    hasSpend: boolean;
    minSpend: number;
    campaign: string | null;
    matchType: string | null;
  };
}

export interface KeywordsQueryParams {
  page?: number;
  limit?: number;
  minSpend?: number;
  hasSpend?: boolean;
  campaign?: string;
  matchType?: string;
}

export interface KeywordWasteAnalysis {
  keyword: KeywordPerformance;
  wasteFlags: WasteFlag[];
  wastedSpend: number;
  recommendation: KeywordRecommendation;
  rationale: string;
}

export interface KeywordsSummary {
  totalKeywords: number;
  totalSpend: number;
  keywordsWithConversions: number;
  keywordsWithZeroConversions: number;
  wasteKeywordsCount: number;
  estimatedWaste: number;
  byMatchType: Record<string, { count: number; spend: number; conversions: number }>;
}

export interface KeywordsWasteResult {
  count: number;
  totalEstimatedWaste: number;
  byFlag: {
    HIGH_SPEND_ZERO_CONV: number;
    HIGH_SPEND_LOW_CONV: number;
    SPEND_CONCENTRATION: number;
  };
  keywords: KeywordWasteAnalysis[];
}
