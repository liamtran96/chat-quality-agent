export interface AgentInfo {
  name: string;
  description: string;
  version: string;
  capabilities: string[];
}

export interface AgentRunRequest {
  tenant_id: string;
  action: string;
  params?: Record<string, unknown>;
}

export interface AgentRunResponse {
  status: string;
  summary?: Record<string, unknown>;
  errors?: string[];
}
