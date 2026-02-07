// Available websites (from core/websites.ts)
export const WEBSITES = [
  { id: 1, name: 'ConversiePDF', currency: 'EUR' },
  { id: 3, name: 'ConviertePDF', currency: 'RON' },
  { id: 4, name: 'DeviceFinder', currency: 'EUR' },
] as const;

export type WebsiteId = 1 | 3 | 4;

// Get token from localStorage (set by AuthContext on login)
function getToken(): string {
  return localStorage.getItem('session_token') || '';
}

async function fetchAPI<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const token = getToken();
  const res = await fetch(`/api${endpoint}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${token}`,
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
  isInformative?: boolean;  // If true, KPI does not trigger alerts (context only)
}

export interface BusinessSummary {
  businessStatus: string;
  generatedAt: string;
  period: { start: string; end: string };
  financials: { grossRevenueEur: number; netRevenueEur: number; adSpendEur: number };
  acquisitionData: { trials: number; firstRebills: number };
  refundsM1: { total: number };
  kpis: {
    // P0 HEADLINE - Weekly Profit (el indicador más importante)
    weeklyProfit: KpiValue;
    // P1 - Payback M1
    paybackM1: KpiValue;
    // P2 - Accionables
    frr: KpiValue;
    cpfr: KpiValue;
    refundRateM1: KpiValue;
    // P3 - Contexto
    netRoas: KpiValue;
    cpt: KpiValue;
    // Informativos (no generan alertas)
    srr: KpiValue;
    ur2: KpiValue;
    // Payback Windows (Phase 6.1) - informativos
    payback21d: KpiValue;
    payback51d: KpiValue;
    // LTV Windows - informativos
    ltv21d: KpiValue;
    ltv51d: KpiValue;
    // Legacy (referencia histórica) - informativos
    ltv30d: KpiValue;
    paybackRatio: KpiValue;
    // Phase 15: Risk Metrics (OpenClaw)
    chargebackRate?: KpiValue;  // Riesgo procesador (>0.5% = CRÍTICO)
    baseInstalada?: KpiValue;   // Clientes con >1 rebill (informativo)
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

// Daily Comparison - Today vs 7 days ago
export interface DailyComparison {
  date: string;
  comparedTo: string;
  acquisitions: { today: number; weekAgo: number; change: number };
  cpa: { today: number; weekAgo: number; change: number };
  cpfr: { today: number; weekAgo: number; change: number };
  adSpend: { today: number; weekAgo: number };
  firstRebills: { today: number; weekAgo: number };
}

// All Websites Payback (for comparison chart)
export interface WebsitePaybackData {
  websiteId: number;
  name: string;
  paybackM1: number;
  status: 'green' | 'yellow' | 'red';
}

export interface AllWebsitesPayback {
  websites: WebsitePaybackData[];
}

// Global View KPIs
export interface GlobalViewKpis {
  weeklyProfit: number;
  grossRevenueEur: number;
  refundsEur: number;
  adSpendEur: number;
  trialCount: number;
  firstRebillCount: number;
  cpt: number;
  frr: number;
  refundRate: number;
  disputeRate: number;
}

export interface GlobalPaybackByWebsite {
  websiteId: number;
  websiteName: string;
  cohortSize: number;
  firstRebillCount: number;
  revenueM1Eur: number;
  adSpendEur: number;
  paybackM1: number;
}

export interface GlobalDailyPulse {
  acquisitions: { today: number; lastWeek: number };
  firstRebills: { today: number; lastWeek: number };
  refunds: { today: number; lastWeek: number };
  grossRevenue: { today: number; lastWeek: number };
}

export interface GlobalViewData {
  kpis: GlobalViewKpis;
  paybackByWebsite: GlobalPaybackByWebsite[];
  dailyPulse: GlobalDailyPulse;
}

// Companies View
export interface CompanyKpis {
  profit: number;
  grossRevenueEur: number;
  refundsEur: number;
  adSpendEur: number;
  trialCount: number;
  firstRebillCount: number;
  frr: number;
  refundRateM1: number;
  disputeRate: number;
}

export interface CompanyData {
  companyId: number;
  name: string;
  kpis: CompanyKpis;
}

export interface CompaniesViewData {
  companies: CompanyData[];
}

// Websites View
export interface WebsiteKpis {
  // M1 (cohort-based) - from customers acquired in period
  revenueM1Eur: number;           // Trial + First Rebill from cohort
  trialRevenueEur: number;
  firstRebillRevenueEur: number;
  refundsM1Eur: number;           // Refunds from cohort
  netM1: number;                  // revenueM1 - refundsM1
  paybackM1: number;              // netM1 / adSpend

  // Total (period-based) - all activity in period
  totalRevenueEur: number;        // All revenue transacted
  totalRebillRevenueEur: number;  // All rebills (M1, M2, M3+)
  totalRefundsEur: number;        // All refunds transacted
  netTotal: number;               // totalRevenue - totalRefunds
  profit: number;                 // netTotal - adSpend

  // Common
  adSpendEur: number;
  trialCount: number;
  firstRebillCount: number;
  frr: number;
  refundRateM1: number;
  disputeRate: number;
  cpt: number;
}

export interface WebsiteData {
  websiteId: number;
  name: string;
  kpis: WebsiteKpis;
}

export interface WebsitesViewData {
  websites: WebsiteData[];
}

// Countries View
export interface CountryKpis {
  // M1 (cohort-based) - from customers acquired in period
  revenueM1Eur: number;
  trialRevenueEur: number;
  firstRebillRevenueEur: number;
  refundsM1Eur: number;
  netM1: number;
  paybackM1: number;

  // Total (period-based) - all activity in period
  totalRevenueEur: number;
  totalRebillRevenueEur: number;
  totalRefundsEur: number;
  netTotal: number;
  profit: number;

  // Common
  adSpendEur: number;
  trialCount: number;
  firstRebillCount: number;
  frr: number;
  refundRateM1: number;
  disputeRate: number;
  cpt: number;
}

export interface CountryData {
  countryId: number;
  countryCode: string;
  countryName: string;
  kpis: CountryKpis;
}

export interface CountriesViewData {
  countries: CountryData[];
}

// Campaigns View
export interface CampaignKpis {
  // M1 (cohort-based) - from customers acquired in period
  revenueM1Eur: number;
  trialRevenueEur: number;
  firstRebillRevenueEur: number;
  refundsM1Eur: number;
  netM1: number;
  paybackM1: number;

  // Total (period-based) - all activity in period
  totalRevenueEur: number;
  totalRebillRevenueEur: number;
  totalRefundsEur: number;
  netTotal: number;
  profit: number;

  // Common
  adSpendEur: number;
  trialCount: number;
  firstRebillCount: number;
  frr: number;
  cpt: number;
  cpfr: number;
  netRoas: number;

  // Google Ads metrics
  impressions: number;
  clicks: number;
  ctr: number;
}

export interface CampaignData {
  campaignId: number;
  googleCampaignId: string;
  campaignName: string;
  websiteId: number;
  websiteName: string;
  countryId: number;
  countryCode: string;
  countryName: string;
  active: boolean;
  kpis: CampaignKpis;
}

export interface CampaignsViewData {
  campaigns: CampaignData[];
}

// Funnel View
export interface FunnelStage {
  stage: string;
  value: number;
  cr: number | null;
}

export interface CohortFrr {
  cohortWeek: number;
  weekLabel: string;
  trials: number;
  firstRebills: number;
  frr: number;
}

export interface RetentionMonth {
  month: string;
  customers: number;
  rate: number;
}

export interface RiskTrend {
  month: string;
  monthLabel: string;
  totalTransactions: number;
  refunds: number;
  refundRate: number;
}

export interface LtvData {
  ltv30d: number;
  ltv60d: number;
  ltv90d: number;
}

export interface FunnelViewData {
  marketingFunnel: FunnelStage[];
  cohortFrr: CohortFrr[];
  retention: RetentionMonth[];
  riskTrends: RiskTrend[];
  ltv: LtvData;
  adSpendEur: number;
}

// Customer Counts
export interface CohortDistributionItem {
  cohortMonth: string;
  activeCustomers: number;
}

export interface CohortDistribution {
  distribution: CohortDistributionItem[];
  totalActiveCustomers: number;
}

export interface CustomerCounts {
  totalCustomers: number;
  activeCustomers: number;
  churnedCustomers: number;
  cancelledTrials: number;
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
  // Business (HARDENING: all require websiteId)
  getSummary: (websiteId: number) => fetchAPI<BusinessSummary>(`/business/summary?websiteId=${websiteId}`),
  getSnapshots: (websiteId: number, days = 30) => fetchAPI<{ count: number; snapshots: Snapshot[] }>(`/snapshots?websiteId=${websiteId}&days=${days}`),
  getDecisions: (websiteId: number) => fetchAPI<DecisionCurrent>(`/decision/current?websiteId=${websiteId}`),
  getCustomerCounts: (websiteId: number) => fetchAPI<CustomerCounts>(`/business/customers?websiteId=${websiteId}`),
  getDailyComparison: (websiteId: number) => fetchAPI<DailyComparison>(`/business/daily?websiteId=${websiteId}`),
  getAllWebsitesPayback: () => fetchAPI<AllWebsitesPayback>(`/business/all-websites-payback`),
  getCohortDistribution: (websiteId: number) => fetchAPI<CohortDistribution>(`/business/cohort-distribution?websiteId=${websiteId}`),
  getGlobalView: (range: string = '7d') => fetchAPI<GlobalViewData>(`/business/global?range=${range}`),
  getCompaniesView: (range: string = '7d') => fetchAPI<CompaniesViewData>(`/business/companies?range=${range}`),
  getWebsitesView: (range: string = '7d') => fetchAPI<WebsitesViewData>(`/business/websites?range=${range}`),
  getCountriesView: (range: string = '7d', websiteId?: number) => {
    const params = new URLSearchParams({ range });
    if (websiteId) params.append('websiteId', websiteId.toString());
    return fetchAPI<CountriesViewData>(`/business/countries?${params.toString()}`);
  },
  getCampaignsView: (range: string = '7d', websiteId?: number, countryId?: number) => {
    const params = new URLSearchParams({ range });
    if (websiteId) params.append('websiteId', websiteId.toString());
    if (countryId) params.append('countryId', countryId.toString());
    return fetchAPI<CampaignsViewData>(`/business/campaigns?${params.toString()}`);
  },
  getFunnelView: (range: string = '7d', websiteId?: number) => {
    const params = new URLSearchParams({ range });
    if (websiteId) params.append('websiteId', websiteId.toString());
    return fetchAPI<FunnelViewData>(`/business/funnel?${params.toString()}`);
  },

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

  // Search Terms (Phase 8B)
  getSearchTerms: (params?: SearchTermsQueryParams) => {
    const query = new URLSearchParams();
    if (params?.page) query.set('page', params.page.toString());
    if (params?.limit) query.set('limit', params.limit.toString());
    if (params?.minSpend) query.set('minSpend', params.minSpend.toString());
    if (params?.hasSpend !== undefined) query.set('hasSpend', params.hasSpend.toString());
    if (params?.campaign) query.set('campaign', params.campaign);
    if (params?.status) query.set('status', params.status);
    const queryString = query.toString();
    return fetchAPI<SearchTermPerformanceResult>(`/search-terms${queryString ? '?' + queryString : ''}`);
  },
  getSearchTermsSummary: () => fetchAPI<SearchTermsSummary>('/search-terms/summary'),
  getTopSearchTerms: (limit = 20) => fetchAPI<{ count: number; searchTerms: SearchTermPerformance[] }>(`/search-terms/top?limit=${limit}`),
  getSearchTermsWaste: () => fetchAPI<SearchTermsWasteResult>('/search-terms/waste'),
  getSearchTermsByCampaign: (campaignId: string) => fetchAPI<{ campaignId: string; count: number; searchTerms: SearchTermPerformance[] }>(`/search-terms/by-campaign/${campaignId}`),
  getSearchTermsByKeyword: (keyword: string) => fetchAPI<{ keywordText: string; count: number; searchTerms: SearchTermPerformance[] }>(`/search-terms/by-keyword?keyword=${encodeURIComponent(keyword)}`),
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
  // Attribution from Avocode DB (keyword-level via utm_term, or campaign-level fallback)
  acquisitions?: number;
  firstRebills?: number;
  attributionLevel?: 'keyword' | 'campaign';
  // Legacy: deprecated, use acquisitions/firstRebills
  campaignAcquisitions?: number;
  campaignFirstRebills?: number;
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

// ============================================================================
// Search Terms (Phase 8B)
// ============================================================================

export type SearchTermWasteFlag =
  | 'HIGH_SPEND_ZERO_CONV'
  | 'HIGH_SPEND_LOW_CONV'
  | 'SPEND_CONCENTRATION'
  | 'REPEAT_WASTE';

export type SearchTermRecommendation =
  | 'NEGATIVE_SUGGESTION'
  | 'INTENT_MISMATCH'
  | 'REVIEW_MATCH_TYPE'
  | 'PROMOTE_TO_KEYWORD'
  | 'MONITOR';

export type SearchTermPerformanceStatus = 'good' | 'warning' | 'poor';

export interface SearchTermPerformance {
  searchTerm: string;
  keywordText: string;
  matchType: string;
  campaignId: string;
  campaignName: string;
  adGroupId: string;
  adGroupName: string;
  spend: number;
  clicks: number;
  impressions: number;
  conversions: number;
  conversionValue: number;
  ctr: number;
  conversionRate: number;
  performanceStatus: SearchTermPerformanceStatus;
  recommendation: SearchTermRecommendation | null;
  // Attribution from Avocode DB (keyword-level via utm_term, or campaign-level fallback)
  acquisitions?: number;
  firstRebills?: number;
  attributionLevel?: 'keyword' | 'campaign';
  // Legacy: deprecated, use acquisitions/firstRebills
  campaignAcquisitions?: number;
  campaignFirstRebills?: number;
}

export interface SearchTermWasteAnalysis {
  searchTerm: SearchTermPerformance;
  wasteFlags: SearchTermWasteFlag[];
  wastedSpend: number;
  recommendation: SearchTermRecommendation;
  rationale: string;
}

export interface SearchTermsQueryParams {
  page?: number;
  limit?: number;
  minSpend?: number;
  hasSpend?: boolean;
  campaign?: string;
  status?: string;
}

export interface SearchTermPerformanceResult {
  fetchedAt: string;
  dateRange: string;
  currency: string;
  totalSearchTerms: number;
  totalSpend: number;
  searchTerms: SearchTermPerformance[];
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
    status: string | null;
  };
}

export interface SearchTermsSummary {
  totalSearchTerms: number;
  totalSpend: number;
  searchTermsWithConversions: number;
  searchTermsWithZeroConversions: number;
  wasteSearchTermsCount: number;
  estimatedWaste: number;
  intentMismatchCount: number;
}

export interface SearchTermsWasteResult {
  count: number;
  totalEstimatedWaste: number;
  byFlag: {
    HIGH_SPEND_ZERO_CONV: number;
    HIGH_SPEND_LOW_CONV: number;
    SPEND_CONCENTRATION: number;
    REPEAT_WASTE: number;
  };
  searchTerms: SearchTermWasteAnalysis[];
}

// ============================================================================
// Chat API (OpenClaw Gateway Proxy)
// ============================================================================

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  images?: string[];  // base64 encoded images
  timestamp: Date;
}

export interface ChatSendRequest {
  message?: string;
  images?: string[];  // base64 data URLs
  sessionId?: string;
}

// Send chat message with streaming response
export async function sendChatMessage(
  request: ChatSendRequest,
  onChunk: (text: string) => void,
  onDone: () => void,
  onError: (error: string) => void
): Promise<void> {
  const token = localStorage.getItem('session_token') || '';

  try {
    const response = await fetch('/api/chat/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      onError(errorData.error || `HTTP ${response.status}`);
      return;
    }

    const reader = response.body?.getReader();
    if (!reader) {
      onError('No response body');
      return;
    }

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // Parse SSE events
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') {
            onDone();
            return;
          }
          try {
            const parsed = JSON.parse(data);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              onChunk(content);
            }
          } catch {
            // Ignore parse errors for non-JSON lines
          }
        }
      }
    }

    onDone();
  } catch (error) {
    onError(error instanceof Error ? error.message : 'Unknown error');
  }
}

// Convert File to base64 data URL
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
