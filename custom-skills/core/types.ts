export interface SkillRequest {
  id: string;
  timestamp: string;
  userId: string;
  input: string;
  context?: Record<string, unknown>;
}

export interface SkillResponse {
  skillId: SkillId;
  requestId: string;
  status: "success" | "error" | "blocked";
  output: unknown;
  reasoning?: string;
  suggestedActions?: SuggestedAction[];
}

export interface SuggestedAction {
  id: string;
  description: string;
  impact: "low" | "medium" | "high";
  requiresApproval: boolean;
}

export interface AuditEntry {
  id: string;
  timestamp: string;
  skill: string;
  action: string;
  input: unknown;
  output: unknown;
  queries?: string[];
  filesRead?: string[];
  decision?: string;
  blocked?: boolean;
  blockReason?: string;
}

export type SkillId =
  | "system"
  | "db-reader"
  | "google-ads-expert"
  | "business-expert"
  | "dev-expert"
  | "senior-dev"
  | "admin-ops";

export type SystemComponent = "router" | "audit" | "permissions";
