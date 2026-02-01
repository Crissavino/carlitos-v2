const API_TOKEN = import.meta.env.VITE_API_TOKEN || 'openclaw-dashboard-2024';

async function fetchAPI<T>(endpoint: string): Promise<T> {
  const res = await fetch(`/api${endpoint}`, {
    headers: {
      'Authorization': `Bearer ${API_TOKEN}`,
      'Content-Type': 'application/json',
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

export const api = {
  getSummary: () => fetchAPI<BusinessSummary>('/business/summary'),
  getSnapshots: (days = 30) => fetchAPI<{ count: number; snapshots: Snapshot[] }>(`/snapshots?days=${days}`),
  getDecisions: () => fetchAPI<DecisionCurrent>('/decision/current'),
};
