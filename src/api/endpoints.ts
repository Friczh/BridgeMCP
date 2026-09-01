import { apiFetch } from '@/api/client';
import type {
  McpConnection,
  BridgeToken,
  AuditEntry,
  AuditDailyStat,
  CreateConnectionResponse,
  CreateTokenResponse,
  AuthType,
  TokenExpiry,
} from '@/types';

// Worker responses may come back either as a bare array or `{ connections: [...] }` etc.
// depending on route — normalize here so views never branch on shape.
function unwrap<T>(body: unknown, key: string): T[] {
  if (Array.isArray(body)) return body as T[];
  const obj = body as Record<string, unknown> | null;
  return (obj?.[key] as T[]) ?? [];
}

export async function listConnections(): Promise<McpConnection[]> {
  const body = await apiFetch('/manage/connections');
  return unwrap<McpConnection>(body, 'connections');
}

export interface CreateConnectionInput {
  name: string;
  server_url: string;
  auth_type: AuthType;
  credentials?: { header?: string; value: string };
}

export async function createConnection(input: CreateConnectionInput): Promise<CreateConnectionResponse> {
  const body = await apiFetch<CreateConnectionResponse>('/manage/connections', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  if (!body) throw new Error('empty response creating connection');
  return body;
}

export async function deleteConnection(id: string): Promise<void> {
  await apiFetch(`/manage/connections/${id}`, { method: 'DELETE' });
}

export async function recheckConnection(id: string) {
  return apiFetch(`/manage/connections/${id}/check`, { method: 'POST' });
}

export async function listTokens(): Promise<BridgeToken[]> {
  const body = await apiFetch('/manage/tokens');
  return unwrap<BridgeToken>(body, 'tokens');
}

export async function createToken(name: string, expiry: TokenExpiry): Promise<CreateTokenResponse> {
  const body = await apiFetch<CreateTokenResponse>('/manage/tokens', {
    method: 'POST',
    body: JSON.stringify({ name, expiry }),
  });
  if (!body) throw new Error('empty response creating token');
  return body;
}

export async function revokeToken(id: string): Promise<void> {
  await apiFetch(`/manage/tokens/${id}`, { method: 'DELETE' });
}

export interface AuditFilters {
  tool_name?: string;
  success?: 'true' | 'false';
  date_from?: string;
  date_to?: string;
  connection_id?: string; // uuid or "null" sentinel for orphaned rows
  bridge_token_id?: string;
  limit?: number;
  offset?: number;
}

export async function listAudit(filters: AuditFilters = {}): Promise<AuditEntry[]> {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== '') params.set(key, String(value));
  }
  const qs = params.toString();
  const body = await apiFetch(`/manage/audit${qs ? `?${qs}` : ''}`);
  return unwrap<AuditEntry>(body, 'audit');
}

// Unconditional — ignores any active filters, deletes everything (design.md:
// "always clear everything," no soft delete, no undo).
export async function clearAudit(): Promise<void> {
  await apiFetch('/manage/audit', { method: 'DELETE' });
}

export async function getAuditStats(days = 7): Promise<AuditDailyStat[]> {
  const body = await apiFetch(`/manage/audit/stats?days=${days}`);
  return unwrap<AuditDailyStat>(body, 'stats');
}