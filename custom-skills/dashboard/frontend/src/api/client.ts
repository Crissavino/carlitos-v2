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
    frr: KpiValue;
    cpfr: KpiValue;
    srr: KpiValue;
    ur2: KpiValue & { isDiagnostic: boolean };
    netRoas: KpiValue;
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
};
