import type { Env } from '../types';
import { decryptJson } from './crypto';
import { getSessionId, setSessionId, clearSessionId } from './mcp-session';

export interface ConnectionRow {
  id: string;
  name: string;
  server_url: string;
  auth_type: 'bearer' | 'header' | 'none';
  encrypted_credentials: string | null;
}

interface StoredCredentials {
  header?: string; // required when auth_type === 'header'
  value: string;
}

export class BackendError extends Error {
  status: number;
  backendStatus?: number; // the backend server's actual HTTP status, e.g. 404/400 — undefined for timeouts/network errors
  constructor(status: number, message: string, backendStatus?: number) {
    super(message);
    this.status = status;
    this.backendStatus = backendStatus;
  }
}

const TIMEOUT_MS = 15_000;

// Streamable HTTP transport (MCP spec) allows servers to respond with
// text/event-stream instead of plain JSON. Frames look like:
//   event: message
//   data: {"jsonrpc":"2.0",...}
//
// We don't need true streaming here — every caller (health check, tools/list,
// tools/call) wants a single complete JSON-RPC response — so read the whole
// body as text and pull the JSON out of the last `data:` line.
async function parseSseJsonRpc(res: Response): Promise<unknown> {
  const text = await res.text();
  const dataLines = text
    .split('\n')
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice('data:'.length).trim())
    .filter(Boolean);

  if (dataLines.length === 0) {
    throw new BackendError(502, 'backend sent an event-stream response with no data frames');
  }

  try {
    // Last frame is the actual JSON-RPC response in a single-request flow;
    // earlier frames (if any) would be intermediate notifications.
    return JSON.parse(dataLines[dataLines.length - 1]);
  } catch {
    throw new BackendError(502, 'backend event-stream data frame was not valid JSON');
  }
}

async function buildAuthHeaders(connection: ConnectionRow, env: Env): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Accept': 'application/json, text/event-stream',
  };

  if (connection.auth_type !== 'none' && connection.encrypted_credentials) {
    const creds = await decryptJson<StoredCredentials>(connection.encrypted_credentials, env);
    if (connection.auth_type === 'bearer') {
      headers.Authorization = `Bearer ${creds.value}`;
    } else if (connection.auth_type === 'header' && creds.header) {
      headers[creds.header] = creds.value;
    }
  }

  return headers;
}

// Single outbound call. Does not know about session retry — that's handled
// by callBackendMcp, which may call this twice (once to re-initialize).
async function sendOnce(
  connection: ConnectionRow,
  method: string,
  params: unknown,
  headers: Record<string, string>
): Promise<{ body: unknown; sessionId: string | null; status: number }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(connection.server_url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
      signal: controller.signal,
    });

    const sessionId = res.headers.get('mcp-session-id');

    if (!res.ok) {
      // Status surfaced to caller so callBackendMcp can decide whether this
      // looks like a stale-session rejection worth retrying.
      return { body: null, sessionId, status: res.status };
    }

    const contentType = res.headers.get('content-type') || '';
    const body = contentType.includes('text/event-stream')
      ? await parseSseJsonRpc(res)
      : await res.json();

    return { body, sessionId, status: res.status };
  } catch (err: unknown) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new BackendError(504, 'backend request timed out');
    }
    throw new BackendError(502, err instanceof Error ? err.message : 'backend error');
  } finally {
    clearTimeout(timeout);
  }
}

export async function callBackendMcp(
  connection: ConnectionRow,
  method: string,
  params: unknown,
  env: Env
): Promise<unknown> {
  const headers = await buildAuthHeaders(connection, env);
  const existingSessionId = await getSessionId(connection.id, env);
  if (existingSessionId) {
    headers['Mcp-Session-Id'] = existingSessionId;
  }

  const first = await sendOnce(connection, method, params, headers);

  if (first.status >= 200 && first.status < 300) {
    if (first.sessionId && first.sessionId !== existingSessionId) {
      await setSessionId(connection.id, first.sessionId, env);
    }
    return first.body;
  }

  // A 400 against a connection that had a stored session looks like a stale/
  // invalid session rejection (matches the Streamable HTTP transport's
  // "Invalid or missing session ID" pattern) — re-initialize once and retry.
  // Session-less backends (no existingSessionId) skip this path entirely and
  // fall through to the normal BackendError below.
  if (first.status === 400 && existingSessionId) {
    await clearSessionId(connection.id, env);

    const initHeaders = await buildAuthHeaders(connection, env);
    const initResult = await sendOnce(
      connection,
      'initialize',
      { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 'BridgeMCP', version: '1.0.0' } },
      initHeaders
    );

    if (initResult.status < 200 || initResult.status >= 300 || !initResult.sessionId) {
      throw new BackendError(502, `backend rejected re-initialize (status ${initResult.status})`, initResult.status);
    }

    await setSessionId(connection.id, initResult.sessionId, env);

    const retryHeaders = { ...initHeaders, 'Mcp-Session-Id': initResult.sessionId };
    const second = await sendOnce(connection, method, params, retryHeaders);

    if (second.status < 200 || second.status >= 300) {
      throw new BackendError(502, `backend responded ${second.status} after session retry`, second.status);
    }

    if (second.sessionId && second.sessionId !== initResult.sessionId) {
      await setSessionId(connection.id, second.sessionId, env);
    }

    return second.body;
  }

  throw new BackendError(502, `backend responded ${first.status}`, first.status);
}
