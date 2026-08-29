import { apiFetch } from '@/api/client';
import type {
  McpConnection,
  BridgeToken,
  AuditEntry,
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

export async function listAudit(): Promise<AuditEntry[]> {
  const body = await apiFetch('/manage/audit');
  return unwrap<AuditEntry>(body, 'entries');
}
