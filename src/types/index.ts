export type ConnectionStatus = 'ok' | 'error' | 'timeout' | null;

export interface McpConnection {
  id: string;
  name: string;
  server_url: string;
  auth_type: 'bearer' | 'header' | 'none';
  last_checked_at: string | null;
  last_status: ConnectionStatus;
  last_check_detail: string | null;
  created_at: string;
}

export interface BridgeToken {
  id: string;
  name: string;
  created_at: string;
  last_used_at: string | null;
}

export interface AuditEntry {
  id: string;
  tool_name: string;
  success: boolean;
  error_message: string | null;
  bridge_token_id: string | null;
  connection_id: string | null;
  called_at: string;
}

export interface AuditDailyStat {
  date: string; // YYYY-MM-DD, UTC
  ok_count: number;
  error_count: number;
}

export interface HealthCheckResult {
  status: 'ok' | 'error' | 'timeout';
  http_status?: number;
  detail?: string;
}

export interface CreateConnectionResponse {
  connection: McpConnection;
  check: HealthCheckResult;
}

export interface CreateTokenResponse {
  token: string;
  bridge_url: string;
}

export interface ApiErrorBody {
  error: string;
  detail?: unknown;
}

export type AuthType = McpConnection['auth_type'];
export type TokenExpiry = 'never' | '30d' | '90d' | '1y';
